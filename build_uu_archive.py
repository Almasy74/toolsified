#!/usr/bin/env python3
import csv, json, sys, hashlib, datetime, subprocess, os
from pathlib import Path
from urllib.parse import urlparse, urlunparse
from collections import defaultdict

# --- konfig ---
DOCS = Path("docs")
SOURCE_JSON = DOCS / "uu-status-details.json"   # dagens fulle datasett
SOURCE_CSV  = DOCS / "uu-status.csv"            # fallback om JSON mangler
DATA_DIR    = DOCS / "data" / "uustatus"
LOGS_DIR    = DATA_DIR / "logs"
LATEST_JSON = DATA_DIR / "latest.json"          # forrige baseline for diff (persistert i repo)
CHANGES_LOG = LOGS_DIR / "changes.jsonl"
SNAP_BY_UPDATED = DATA_DIR / "snapshots_by_updated"  # hendelsesbaserte snapshots

# ---------- util ----------
def today_str():
    return datetime.datetime.utcnow().strftime("%Y-%m-%d")

def load_json(fp, fallback=None):
    try:
        if not fp.exists():
            return fallback
        with fp.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return fallback

def load_csv(fp):
    if not fp.exists():
        return []
    with fp.open("r", encoding="utf-8") as f:
        r = csv.DictReader(f)
        return list(r)

def to_domain(url):
    try:
        return urlparse(url).hostname or ""
    except Exception:
        return ""

def canon_url(u: str) -> str:
    """Normaliser URL så matching blir stabil mellom kjøringer."""
    try:
        p = urlparse((u or "").strip())
        netloc = (p.hostname or "").lower()
        if p.port and not ((p.scheme == "http" and p.port == 80) or (p.scheme == "https" and p.port == 443)):
            netloc = f"{netloc}:{p.port}"
        path = p.path or ""
        if path != "/" and path.endswith("/"):
            path = path[:-1]
        return urlunparse((p.scheme, netloc, path, "", "", ""))
    except Exception:
        return (u or "").strip()

def _extract_possible_total(raw):
    candidates = [
        "totalNonConformities", "total_non_conformities",
        "violationsCount", "violations_count",
        "nonConformitiesCount", "non_conformities_count",
        "wcagCount", "wcag_count",
        "wcagViolationsCount", "wcag_violations_count",
        "ncTotal", "count", "total"
    ]
    for k in candidates:
        v = raw.get(k)
        if isinstance(v, (int, float)):
            return int(v)
        if isinstance(v, str) and v.strip().isdigit():
            return int(v.strip())
    return None

def _extract_codes(raw):
    """
    Hent WCAG-koder uansett struktur:
      - liste av strenger
      - liste av objekter (felter: code/wcag/criterion/id/wcagId/wcag_id)
      - dict (nøkler anses som koder)
      - semikolon-separert streng
    """
    code_field_candidates = [
        "nonConformities", "violations", "wcag", "wcagCodes",
        "wcag_violations", "wcag_nonconformities", "issues", "problems"
    ]
    data = None
    for k in code_field_candidates:
        if k in raw:
            data = raw.get(k)
            break
    if data is None:
        # prøv å finne et felt med wcag/violation/nonconform/issue/problem i navnet
        for k in raw.keys():
            lk = k.lower()
            if any(s in lk for s in ["wcag", "violation", "nonconform", "issue", "problem"]):
                data = raw.get(k); break

    codes = set()
    if data is None:
        return []

    if isinstance(data, str):
        for s in data.split(";"):
            s = s.strip()
            if s: codes.add(s)
        return sorted(codes)

    if isinstance(data, list):
        for item in data:
            if isinstance(item, str):
                s = item.strip()
                if s: codes.add(s)
            elif isinstance(item, dict):
                for key in ["code", "wcag", "criterion", "id", "wcagId", "wcag_id"]:
                    v = item.get(key)
                    if isinstance(v, str) and v.strip():
                        codes.add(v.strip()); break
        return sorted(codes)

    if isinstance(data, dict):
        for k in data.keys():
            ks = str(k).strip()
            if ks: codes.add(ks)
        return sorted(codes)

    return []

def normalize_entry(raw):
    url = (raw.get("url") or raw.get("href") or "").strip()
    domain = (raw.get("domain") or to_domain(url)).strip()
    title = (raw.get("title") or raw.get("name") or "").strip()
    updatedAt = (raw.get("updatedAt") or raw.get("lastChecked") or "").strip()

    nc_list = _extract_codes(raw)
    total = _extract_possible_total(raw)
    if total is None:
        total = len(nc_list)

    return {
        "url": url,
        "domain": domain,
        "title": title,
        "updatedAt": updatedAt,
        "nonConformities": sorted(nc_list),
        "totalNonConformities": int(total),
    }

def sha1(obj):
    return hashlib.sha1(json.dumps(obj, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()

def index_by_url(items):
    m = {}
    for it in items:
        if not isinstance(it, dict): continue
        u = it.get("url")
        if not u: continue
        m[canon_url(u)] = it
    return m

def read_current():
    data = load_json(SOURCE_JSON)
    if isinstance(data, dict) and isinstance(data.get("urls"), list):
        return [normalize_entry(x) for x in data["urls"]]
    rows = load_csv(SOURCE_CSV)
    return [normalize_entry(x) for x in rows]

def read_prev_from_ref(ref: str):
    try:
        out = subprocess.check_output(["git", "show", f"{ref}:{LATEST_JSON.as_posix()}"], text=True)
        js = json.loads(out)
        urls = js.get("urls") if isinstance(js, dict) else []
        return urls if isinstance(urls, list) else []
    except Exception:
        return None  # ref finnes ikke, eller fila manglet i ref

# --------- diff rules ----------
CHECK_FIELDS = ["title", "status", "updatedAt", "totalNonConformities"]

def compute_change(prev_entry, curr_entry):
    p_nc = set(prev_entry.get("nonConformities") or [])
    c_nc = set(curr_entry.get("nonConformities") or [])
    added = sorted(list(c_nc - p_nc))
    removed = sorted(list(p_nc - c_nc))

    changed = {}
    for f in CHECK_FIELDS:
        if prev_entry.get(f) != curr_entry.get(f):
            changed[f] = {"before": prev_entry.get(f), "after": curr_entry.get(f)}
    if added or removed:
        if "totalNonConformities" not in changed and len(p_nc) != len(c_nc):
            changed["totalNonConformities"] = {"before": len(p_nc), "after": len(c_nc)}

    if changed or added or removed:
        return (changed or None, added, removed)
    return (None, [], [])

def diff_once(prev_rows, curr_rows):
    prev_by = index_by_url(prev_rows or [])
    curr_by = index_by_url(curr_rows or [])
    changes = []
    now = datetime.datetime.utcnow()
    now_iso = now.isoformat(timespec="seconds") + "Z"
    detected_date = now.strftime("%Y-%m-%d")

    for url, c in curr_by.items():
        p = prev_by.get(url)
        if p is None:
            updated_date = (c.get("updatedAt") or "")[:10] or today_str()
            changes.append({
                "ts": now_iso,
                "detectedDate": detected_date,
                "url": c.get("url") or url,
                "domain": c.get("domain") or to_domain(c.get("url") or url),
                "before_hash": None,
                "after_hash": sha1(c),
                "added": c.get("nonConformities") or [],
                "removed": [],
                "changed": {
                    "newUrl": True,
                    "totalNonConformities": {"before": 0, "after": c.get("totalNonConformities", 0)}
                },
                "updatedDate": updated_date
            })
        else:
            changed, added, removed = compute_change(p, c)
            if changed or added or removed:
                updated_date = (c.get("updatedAt") or "")[:10] or today_str()
                changes.append({
                    "ts": now_iso,
                    "detectedDate": detected_date,
                    "url": c.get("url") or url,
                    "domain": c.get("domain") or to_domain(c.get("url") or url),
                    "before_hash": sha1(dict(p)),
                    "after_hash": sha1(dict(c)),
                    "added": added,
                    "removed": removed,
                    "changed": changed,
                    "updatedDate": updated_date
                })

    # Fjernede URLer
    for url, p in prev_by.items():
        if url in curr_by: continue
        p_nc = set(p.get("nonConformities") or [])
        removed = sorted(list(p_nc))
        updated_date = (p.get("updatedAt") or "")[:10] or today_str()
        changes.append({
            "ts": now_iso,
            "detectedDate": detected_date,
            "url": p.get("url") or url,
            "domain": p.get("domain") or to_domain(p.get("url") or url),
            "before_hash": sha1(dict(p)),
            "after_hash": None,
            "added": [],
            "removed": removed,
            "changed": {
                "removedUrl": True,
                "totalNonConformities": {"before": len(p_nc), "after": 0}
            },
            "updatedDate": updated_date
        })

    return changes, prev_by, curr_by

# ---------- main ----------
def main():
    # Sørg for mapper
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    SNAP_BY_UPDATED.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Les dagens datasett
    curr = read_current()
    if not isinstance(curr, list):
        print("Fant ikke gyldig dagsdata i docs/uu-status-details.json eller docs/uu-status.csv", file=sys.stderr)
        sys.exit(1)

    # Bestem baseline-strategi
    forced_ref = os.getenv("BASELINE_REF", "").strip()
    auto_bt = os.getenv("AUTO_BACKTRACK", "").strip().lower() in ("1", "true", "yes", "on")
    max_bt = int(os.getenv("MAX_BACKTRACK", "10"))

    candidate_refs = []
    if forced_ref:
        candidate_refs = [forced_ref]
    elif auto_bt:
        candidate_refs = ["HEAD"] + [f"HEAD~{i}" for i in range(1, max_bt+1)]
    else:
        candidate_refs = ["HEAD"]  # standard, sammenlign mot forrige commit

    used_ref = None
    final_changes = []
    last_curr_by = {}

    # Prøv refs til vi finner endringer
    for ref in candidate_refs:
        prev_rows = read_prev_from_ref(ref)
        if prev_rows is None:
            continue
        changes, prev_by, curr_by = diff_once(prev_rows, curr)

        # Valgfri debug for en bestemt URL
        dbg = os.getenv("DEBUG_URL_CONTAINS", "").strip()
        if dbg:
            for url, c in curr_by.items():
                if dbg.lower() in (c.get("url") or url).lower():
                    p = prev_by.get(url)
                    prev_codes = sorted((p or {}).get("nonConformities") or [])
                    curr_codes = sorted(c.get("nonConformities") or [])
                    print(f"DEBUG URL (ref={ref}):", c.get("url") or url)
                    print("  prev codes:", prev_codes)
                    print("  curr codes:", curr_codes)
                    print("  prev total:", (p or {}).get("totalNonConformities"))
                    print("  curr total:", c.get("totalNonConformities"))
                    break

        if changes:
            used_ref = ref
            final_changes = changes
            last_curr_by = curr_by
            break

    if used_ref is None:
        print("Ingen endringer oppdaget (prøvde refs: " + ", ".join(candidate_refs) + ").")
    else:
        print(f"Diff-baseline: {used_ref}")
        with CHANGES_LOG.open("a", encoding="utf-8") as f:
            for row in final_changes:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
        print(f"Endringer logget: {len(final_changes)}")

        # Skriv snapshots per updatedDate
        changed_by_date = defaultdict(list)
        for ch in final_changes:
            u = last_curr_by.get(canon_url(ch["url"]))
            if not u:
                continue
            key = ch.get("updatedDate") or today_str()
            changed_by_date[key].append(u)

        for date_key, entries in changed_by_date.items():
            out_fp = SNAP_BY_UPDATED / f"{date_key}.json"
            existing = load_json(out_fp, fallback={"urls": []})
            existing_urls = existing.get("urls", [])
            exist_by = index_by_url(existing_urls)
            for e in entries:
                exist_by[canon_url(e["url"])] = e
            merged = {"urls": list(exist_by.values())}
            out_fp.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"Skrev snapshot for updatedDate={date_key}: {out_fp}")

    # Oppdater latest.json (fullt datasett) — ALLTID (etter diff)
    snap_obj = {"urls": curr}
    LATEST_JSON.write_text(json.dumps(snap_obj, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Oppdaterte {LATEST_JSON}")

if __name__ == "__main__":
    main()

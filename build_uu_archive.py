#!/usr/bin/env python3
import csv, json, sys, hashlib, datetime, subprocess, os
from pathlib import Path
from urllib.parse import urlparse, urlunparse
from collections import defaultdict

# --- konfig ---
DOCS = Path("docs")
SOURCE_JSON = DOCS / "uu-status-details.json"   # dagens fulle datasett (fra scrape/enrich)
SOURCE_CSV  = DOCS / "uu-status.csv"            # fallback hvis JSON mangler
DATA_DIR    = DOCS / "data" / "uustatus"
LOGS_DIR    = DATA_DIR / "logs"
LATEST_JSON = DATA_DIR / "latest.json"          # forrige baseline for diff
CHANGES_LOG = LOGS_DIR / "changes.jsonl"
SNAP_BY_UPDATED = DATA_DIR / "snapshots_by_updated"

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
    """Normaliser URL for stabil matching."""
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

def _extract_total(raw):
    for k in [
        "totalNonConformities","total_non_conformities",
        "violationsCount","violations_count",
        "nonConformitiesCount","non_conformities_count",
        "wcagCount","wcag_count",
        "wcagViolationsCount","wcag_violations_count",
        "ncTotal","count","total"
    ]:
        v = raw.get(k)
        if isinstance(v, (int, float)): return int(v)
        if isinstance(v, str) and v.strip().isdigit(): return int(v.strip())
    return None

def _extract_codes(raw):
    for field in ["nonConformities","violations","wcag","wcagCodes","wcag_violations","wcag_nonconformities","issues","problems"]:
        if field in raw:
            data = raw[field]; break
    else:
        data = None
        for k in raw.keys():
            lk = k.lower()
            if any(s in lk for s in ["wcag","violation","nonconform","issue","problem"]):
                data = raw[k]; break

    codes = set()
    if data is None: return []

    if isinstance(data, str):
        for s in data.split(";"):
            s = s.strip()
            if s: codes.add(s)
        return sorted(codes)

    if isinstance(data, list):
        for it in data:
            if isinstance(it, str) and it.strip():
                codes.add(it.strip())
            elif isinstance(it, dict):
                for kk in ["code","wcag","criterion","id","wcagId","wcag_id"]:
                    v = it.get(kk)
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

    codes = _extract_codes(raw)
    total = _extract_total(raw)
    if total is None:
        total = len(codes)

    return {
        "url": url,
        "domain": domain,
        "title": title,
        "updatedAt": updatedAt,
        "nonConformities": sorted(codes),
        "totalNonConformities": int(total),
    }

def sha1(obj):
    return hashlib.sha1(json.dumps(obj, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()

def make_key(it: dict) -> str | None:
    """Primær nøkkel = URL (kanonisk). Fallback = title+domain."""
    if not isinstance(it, dict): return None
    url = (it.get("url") or it.get("href") or "").strip()
    if url:
        return "url::" + canon_url(url)
    title = (it.get("title") or it.get("name") or "").strip().lower()
    domain = (it.get("domain") or "").strip().lower()
    if title:
        return f"title::{domain}::{title}"
    return None

def index_by_key(items):
    out = {}
    for it in items:
        k = make_key(it)
        if k: out[k] = it
    return out

def read_current():
    data = load_json(SOURCE_JSON)
    if isinstance(data, dict) and isinstance(data.get("urls"), list):
        return [normalize_entry(x) for x in data["urls"]]
    rows = load_csv(SOURCE_CSV)
    return [normalize_entry(x) for x in rows]

def read_prev_from_ref(ref: str):
    """Les baseline latest.json fra gitt git-ref.
       VIKTIG: Ved feil/mangel, returner TOM baseline ([]) i stedet for None,
       slik at vi behandler første kjøring som 'alt er nytt'.
    """
    try:
        blob = subprocess.check_output(["git", "show", f"{ref}:{LATEST_JSON.as_posix()}"], text=True)
        js = json.loads(blob)
        urls = js.get("urls") if isinstance(js, dict) else []
        return urls if isinstance(urls, list) else []
    except Exception:
        # Baseline finnes ikke i denne ref'en -> behandle som tom baseline
        return []

# --------- diff ----------
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
    prev_by = index_by_key(prev_rows or [])
    curr_by = index_by_key(curr_rows or [])
    changes = []
    now = datetime.datetime.utcnow()
    now_iso = now.isoformat(timespec="seconds") + "Z"
    detected_date = now.strftime("%Y-%m-%d")

    # Nye/endrede
    for k, c in curr_by.items():
        p = prev_by.get(k)
        if p is None:
            updated_date = (c.get("updatedAt") or "")[:10] or today_str()
            changes.append({
                "ts": now_iso,
                "detectedDate": detected_date,
                "url": c.get("url") or "",
                "domain": c.get("domain") or to_domain(c.get("url") or ""),
                "before_hash": None,
                "after_hash": sha1(c),
                "added": c.get("nonConformities") or [],
                "removed": [],
                "changed": {
                    "newEntry": True,
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
                    "url": c.get("url") or "",
                    "domain": c.get("domain") or to_domain(c.get("url") or ""),
                    "before_hash": sha1(dict(p)),
                    "after_hash": sha1(dict(c)),
                    "added": added,
                    "removed": removed,
                    "changed": changed,
                    "updatedDate": updated_date
                })

    # Fjernet
    for k, p in prev_by.items():
        if k in curr_by:
            continue
        p_nc = set(p.get("nonConformities") or [])
        removed = sorted(list(p_nc))
        updated_date = (p.get("updatedAt") or "")[:10] or today_str()
        changes.append({
            "ts": now_iso,
            "detectedDate": detected_date,
            "url": p.get("url") or "",
            "domain": p.get("domain") or to_domain(p.get("url") or ""),
            "before_hash": sha1(dict(p)),
            "after_hash": None,
            "added": [],
            "removed": removed,
            "changed": {
                "removedEntry": True,
                "totalNonConformities": {"before": len(p_nc), "after": 0}
            },
            "updatedDate": updated_date
        })

    return changes

# ---------- main ----------
def main():
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    SNAP_BY_UPDATED.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    curr = read_current()
    if not isinstance(curr, list):
        print("Fant ikke gyldig dagsdata i docs/uu-status-details.json eller docs/uu-status.csv", file=sys.stderr)
        sys.exit(1)

    forced_ref = os.getenv("BASELINE_REF", "").strip()
    auto_bt = os.getenv("AUTO_BACKTRACK", "").strip().lower() in ("1", "true", "yes", "on")
    max_bt = int(os.getenv("MAX_BACKTRACK", "10"))

    if forced_ref:
        refs = [forced_ref]
    elif auto_bt:
        refs = ["HEAD"] + [f"HEAD~{i}" for i in range(1, max_bt+1)]
    else:
        refs = ["HEAD"]

    final_changes = []
    used_ref = None

    for ref in refs:
        prev_rows = read_prev_from_ref(ref)  # NB: alltid liste (kan være tom)
        changes = diff_once(prev_rows, curr)
        if changes:
            used_ref = ref
            final_changes = changes
            break

    print(f"Dagens datasett: {len(curr)} elementer.")
    if used_ref:
        print(f"Diff-baseline: {used_ref}  |  Endringer funnet: {len(final_changes)}")
    else:
        print("Ingen endringer oppdaget (refs testet: " + ", ".join(refs) + ").")

    # 1) Logg endringer
    if final_changes:
        with CHANGES_LOG.open("a", encoding="utf-8") as f:
            for row in final_changes:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")

        # 2) Skriv snapshots per updatedDate
        changed_by_date = defaultdict(list)
        # bygg index for dagens datasett
        curr_index = index_by_key(curr)
        for ch in final_changes:
            candidate = None
            url = (ch.get("url") or "").strip()
            if url:
                kk = "url::" + canon_url(url)
                candidate = curr_index.get(kk)
            if not candidate:
                # fallback: finn via title+domain
                for it in curr:
                    if (it.get("url") or "") == url:
                        candidate = it; break
            if not candidate:
                continue
            key = (ch.get("updatedDate") or today_str())
            changed_by_date[key].append(candidate)

        for date_key, entries in changed_by_date.items():
            out_fp = SNAP_BY_UPDATED / f"{date_key}.json"
            existing = load_json(out_fp, fallback={"urls": []})
            exist_by = index_by_key(existing.get("urls", []))
            for e in entries:
                kk = make_key(e)
                if kk: exist_by[kk] = e
            out_fp.write_text(json.dumps({"urls": list(exist_by.values())}, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"Skrev snapshot for {date_key}: {out_fp}")

    # 3) Oppdater baseline (ALLTID etter diff)
    LATEST_JSON.write_text(json.dumps({"urls": curr}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Oppdaterte {LATEST_JSON}")

if __name__ == "__main__":
    main()

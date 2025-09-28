#!/usr/bin/env python3
import csv, json, sys, hashlib, datetime, subprocess, os
from pathlib import Path
from urllib.parse import urlparse
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

def _extract_possible_total(raw):
    """
    Finn totalsum fra ulike mulige felt-navn.
    """
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
        # tall som string
        if isinstance(v, str) and v.strip().isdigit():
            return int(v.strip())
    return None

def _extract_codes(raw):
    """
    Ekstraher WCAG-koder fra ulike mulige strukturer/feltnavn.
    Støtter:
      - liste av strenger
      - liste av objekter (bruker 'code' / 'wcag' / 'criterion' / 'id')
      - dict (tolker nøklene som koder)
    """
    # vanlige kandidater til felt som inneholder kodene
    code_field_candidates = [
        "nonConformities", "violations", "wcag", "wcagCodes",
        "wcag_violations", "wcag_nonconformities", "issues", "problems"
    ]
    data = None
    for k in code_field_candidates:
        if k in raw:
            data = raw.get(k)
            break

    # på CSV kan det ligge i et "wcag"-aktig felt som semikolon-separert string
    if data is None:
        for k in raw.keys():
            if "wcag" in k.lower() or "violation" in k.lower() or "nonconform" in k.lower():
                data = raw.get(k)
                break

    codes = set()

    if data is None:
        return []

    # string: "1.1.1; 1.3.1"
    if isinstance(data, str):
        for s in data.split(";"):
            s = s.strip()
            if s:
                codes.add(s)
        return sorted(codes)

    # liste
    if isinstance(data, list):
        for item in data:
            if isinstance(item, str):
                s = item.strip()
                if s:
                    codes.add(s)
            elif isinstance(item, dict):
                # prøv vanlige nøkkelnavn for kode
                for key in ["code", "wcag", "criterion", "id", "wcagId", "wcag_id"]:
                    v = item.get(key)
                    if isinstance(v, str) and v.strip():
                        codes.add(v.strip())
                        break
        return sorted(codes)

    # dict: tolk nøkler som koder
    if isinstance(data, dict):
        for k in data.keys():
            ks = str(k).strip()
            if ks:
                codes.add(ks)
        return sorted(codes)

    return []

def normalize_entry(raw):
    """Konverter kilde (JSON/CSV) til felles format. Lister sorteres, whitespace trimmes."""
    url = (raw.get("url") or raw.get("href") or "").strip()
    domain = (raw.get("domain") or to_domain(url)).strip()
    title = (raw.get("title") or raw.get("name") or "").strip()
    updatedAt = (raw.get("updatedAt") or raw.get("lastChecked") or "").strip()

    # Ekstraher koder og total – robust mot ulike strukturer
    nc_list = _extract_codes(raw)
    total = _extract_possible_total(raw)

    if total is None:
        total = len(nc_list)  # fallback

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
    return { it["url"]: it for it in items if isinstance(it, dict) and it.get("url") }

def read_current():
    """Les dagens fulle datasett (primært JSON, fallback CSV)."""
    data = load_json(SOURCE_JSON)
    if isinstance(data, dict) and isinstance(data.get("urls"), list):
        return [normalize_entry(x) for x in data["urls"]]
    rows = load_csv(SOURCE_CSV)
    return [normalize_entry(x) for x in rows]

def read_previous_full():
    """Les forrige baseline fra GIT HEAD (sikrest). Fallback til latest.json på disk."""
    try:
        out = subprocess.check_output(
            ["git", "show", f"HEAD:{LATEST_JSON.as_posix()}"],
            text=True
        )
        js = json.loads(out)
        urls = js.get("urls") if isinstance(js, dict) else []
        return urls if isinstance(urls, list) else []
    except Exception:
        # Fallback: fil på disk (første kjøring uten HEAD)
        js = load_json(LATEST_JSON, fallback={"urls": []})
        urls = js.get("urls") if isinstance(js, dict) else []
        return urls if isinstance(urls, list) else []

# --------- diff rules ----------
CHECK_FIELDS = ["title", "status", "updatedAt", "totalNonConformities"]

def compute_change(prev_entry, curr_entry):
    """
    Returner (changed_dict, added_list, removed_list) hvis det er en relevant endring,
    ellers (None, [], []).
    """
    p_nc = set(prev_entry.get("nonConformities") or [])
    c_nc = set(curr_entry.get("nonConformities") or [])

    added = sorted(list(c_nc - p_nc))
    removed = sorted(list(p_nc - c_nc))

    changed = {}
    # registrer feltendringer eksplisitt
    for f in CHECK_FIELDS:
        if prev_entry.get(f) != curr_entry.get(f):
            changed[f] = {"before": prev_entry.get(f), "after": curr_entry.get(f)}

    # hvis nonConformities-lister er ulike, og total ikke allerede fanget opp:
    if added or removed:
        if "totalNonConformities" not in changed and len(p_nc) != len(c_nc):
            changed["totalNonConformities"] = {"before": len(p_nc), "after": len(c_nc)}

    # En endring finnes dersom vi har feltendringer eller added/removed
    if changed or added or removed:
        return (changed or None, added, removed)
    return (None, [], [])

# ---------- main ----------
def main():
    # Sørg for mapper
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    SNAP_BY_UPDATED.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # 1) Les nåværende og forrige baseline
    curr = read_current()
    if not isinstance(curr, list):
        print("Fant ikke gyldig dagsdata i docs/uu-status-details.json eller docs/uu-status.csv", file=sys.stderr)
        sys.exit(1)

    prev = read_previous_full()
    prev_by = index_by_url(prev)
    curr_by = index_by_url(curr)

    # Valgfri debug: skriv ut koder/total for en bestemt URL (substring-match)
    dbg = os.getenv("DEBUG_URL_CONTAINS", "").strip()
    if dbg:
        for url, c in curr_by.items():
            if dbg in url:
                p = prev_by.get(url)
                prev_codes = sorted((p or {}).get("nonConformities") or [])
                curr_codes = sorted(c.get("nonConformities") or [])
                print("DEBUG URL:", url)
                print("  prev codes:", prev_codes)
                print("  curr codes:", curr_codes)
                print("  prev total:", (p or {}).get("totalNonConformities"))
                print("  curr total:", c.get("totalNonConformities"))
                break

    # 2) Kalkulér endringer URL for URL
    changes = []
    now = datetime.datetime.utcnow()
    now_iso = now.isoformat(timespec="seconds") + "Z"
    detected_date = now.strftime("%Y-%m-%d")  # når VI oppdaget endringen

    # Endringer og nye URLer
    for url, c in curr_by.items():
        p = prev_by.get(url)
        if p is None:
            # Ny URL
            updated_date = (c.get("updatedAt") or "")[:10] or today_str()
            changes.append({
                "ts": now_iso,
                "detectedDate": detected_date,
                "url": url,
                "domain": c.get("domain") or to_domain(url),
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
                    "url": url,
                    "domain": c.get("domain") or to_domain(url),
                    "before_hash": sha1(dict(p)),
                    "after_hash": sha1(dict(c)),
                    "added": added,
                    "removed": removed,
                    "changed": changed,
                    "updatedDate": updated_date
                })

    # Fjernede URLer (fantes før, finnes ikke nå)
    for url, p in prev_by.items():
        if url in curr_by:
            continue
        p_nc = set(p.get("nonConformities") or [])
        removed = sorted(list(p_nc))
        updated_date = (p.get("updatedAt") or "")[:10] or today_str()
        changes.append({
            "ts": now_iso,
            "detectedDate": detected_date,
            "url": url,
            "domain": p.get("domain") or to_domain(url),
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

    # 3) Append endringer til logg (hvis noen)
    if changes:
        with CHANGES_LOG.open("a", encoding="utf-8") as f:
            for row in changes:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
        print(f"Endringer logget: {len(changes)}")
    else:
        print("Ingen endringer oppdaget.")

    # 4) Oppdater latest.json (fullt datasett) — ALLTID (etter diff)
    snap_obj = {"urls": curr}
    LATEST_JSON.write_text(json.dumps(snap_obj, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Oppdaterte {LATEST_JSON}")

    # 5) Skriv hendelsesbaserte snapshots KUN hvis det var endringer
    if not changes:
        print("Hopper over snapshots_by_updated (ingen endringer).")
        return

    # Gruppér endrede entries per updatedDate og skriv/merg JSON per dato
    changed_by_date = defaultdict(list)
    for ch in changes:
        u = curr_by.get(ch["url"])
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
            exist_by[e["url"]] = e  # siste versjon vinner

        merged = {"urls": list(exist_by.values())}
        out_fp.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Skrev snapshot for updatedDate={date_key}: {out_fp}")

if __name__ == "__main__":
    main()

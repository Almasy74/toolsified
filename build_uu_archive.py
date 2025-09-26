#!/usr/bin/env python3
import csv, json, os, sys, hashlib, datetime
from pathlib import Path
from urllib.parse import urlparse

# --- konfig ---
DOCS = Path("docs")
SOURCE_JSON = DOCS / "uu-status-details.json"   # primærkilde for dagens data
SOURCE_CSV  = DOCS / "uu-status.csv"            # fallback om JSON mangler
SNAP_DIR    = DOCS / "data" / "uustatus" / "snapshots"
LOGS_DIR    = DOCS / "data" / "uustatus" / "logs"
LATEST_JSON = DOCS / "data" / "uustatus" / "latest.json"
CHANGES_LOG = LOGS_DIR / "changes.jsonl"

def today_str():
    return datetime.datetime.utcnow().strftime("%Y-%m-%d")

def load_json(fp):
    if not fp.exists(): return None
    with fp.open("r", encoding="utf-8") as f:
        return json.load(f)

def load_csv(fp):
    if not fp.exists(): return []
    with fp.open("r", encoding="utf-8") as f:
        r = csv.DictReader(f)
        return list(r)

def to_domain(url):
    try:
        return urlparse(url).hostname or ""
    except Exception:
        return ""

def normalize_entry(raw):
    """Konverter dagens kilde (JSON/CSV) til felles format."""
    # Prøv vanlige feltnavn fra uu-status-details.json
    url = (raw.get("url") or raw.get("href") or "").strip()
    domain = (raw.get("domain") or to_domain(url)).strip()
    title = (raw.get("title") or raw.get("name") or "").strip()
    updatedAt = (raw.get("updatedAt") or raw.get("lastChecked") or "").strip()

    # nonConformities: prøv flere mulige nøkler
    nc = raw.get("nonConformities") or raw.get("violations") or raw.get("wcag") or []
    if isinstance(nc, str):
        # f.eks. semikolonseparert i CSV
        nc = [s.strip() for s in nc.split(";") if s.strip()]
    elif isinstance(nc, list):
        nc = [str(x).strip() for x in nc if str(x).strip()]
    else:
        nc = []

    # totalNonConformities (om finnes), ellers len(nc)
    total = raw.get("totalNonConformities")
    try:
        total = int(total) if total is not None else len(nc)
    except Exception:
        total = len(nc)

    # Bygg normalisert objekt
    norm = {
        "url": url,
        "domain": domain,
        "title": title,
        "updatedAt": updatedAt,
        "nonConformities": sorted(nc),
        "totalNonConformities": total,
    }
    return norm

def sha1(obj):
    return hashlib.sha1(json.dumps(obj, sort_keys=True).encode("utf-8")).hexdigest()

def index_by_url(items):
    return { it["url"]: it for it in items if it.get("url") }

def read_current():
    # primært fra JSON
    data = load_json(SOURCE_JSON)
    if data and isinstance(data, dict) and "urls" in data and isinstance(data["urls"], list):
        curr = [normalize_entry(x) for x in data["urls"]]
        return curr

    # fallback fra CSV
    rows = load_csv(SOURCE_CSV)
    curr = [normalize_entry(x) for x in rows]
    return curr

def read_last_snapshot():
    if not SNAP_DIR.exists(): return None, []
    files = sorted([p for p in SNAP_DIR.glob("*.json") if p.is_file()])
    if not files: return None, []
    last = files[-1]
    js = load_json(last) or {}
    prev = js.get("urls") if isinstance(js, dict) else None
    prev = prev if isinstance(prev, list) else []
    return last, prev

def main():
    SNAP_DIR.mkdir(parents=True, exist_ok=True)
    LOGS_DIR.mkdir(parents=True, exist_ok=True)

    curr = read_current()
    if not isinstance(curr, list):
        print("Fant ikke gyldig dagsdata i docs/uu-status-details.json eller docs/uu-status.csv", file=sys.stderr)
        sys.exit(1)

    # forrige snapshot
    prev_fp, prev = read_last_snapshot()
    prev_by = index_by_url(prev)
    curr_by = index_by_url(curr)

    changes = []
    now_iso = datetime.datetime.utcnow().isoformat(timespec="seconds") + "Z"

    for url, c in curr_by.items():
        p = prev_by.get(url)
        if p is None:
            # ny url
            changes.append({
                "ts": now_iso,
                "url": url,
                "domain": c["domain"],
                "before_hash": None,
                "after_hash": sha1(c),
                "added": c["nonConformities"],
                "removed": [],
                "changed": {
                    "newUrl": True,
                    "totalNonConformities": {"before": 0, "after": c["totalNonConformities"]}
                }
            })
        else:
            # diff
            # lag "rene" varianter for hashing (unngå volatilt)
            p_clean = dict(p); c_clean = dict(c)
            # hasher
            if sha1(p_clean) != sha1(c_clean):
                pset = set(p.get("nonConformities") or [])
                cset = set(c.get("nonConformities") or [])
                added = sorted(list(cset - pset))
                removed = sorted(list(pset - cset))
                changed = {}

                for f in ["title", "status", "updatedAt", "totalNonConformities"]:
                    pa = p.get(f)
                    ca = c.get(f)
                    if pa != ca:
                        changed[f] = {"before": pa, "after": ca}

                if "totalNonConformities" not in changed and len(pset) != len(cset):
                    changed["totalNonConformities"] = {"before": len(pset), "after": len(cset)}

                changes.append({
                    "ts": now_iso,
                    "url": url,
                    "domain": c["domain"],
                    "before_hash": sha1(p_clean),
                    "after_hash": sha1(c_clean),
                    "added": added,
                    "removed": removed,
                    "changed": changed or None
                })

    # skriv logg (append)
    if changes:
        with CHANGES_LOG.open("a", encoding="utf-8") as f:
            for row in changes:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
        print(f"Endringer logget: {len(changes)}")
    else:
        print("Ingen endringer oppdaget.")

    # skriv dagens snapshot + latest
    out_fp = SNAP_DIR / f"{today_str()}.json"
    snap_obj = {"urls": curr}
    out_fp.write_text(json.dumps(snap_obj, ensure_ascii=False, indent=2), encoding="utf-8")
    Path(LATEST_JSON).write_text(json.dumps(snap_obj, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Skrev snapshot: {out_fp} og oppdaterte {LATEST_JSON}")

if __name__ == "__main__":
    main()

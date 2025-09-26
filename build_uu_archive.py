#!/usr/bin/env python3
import csv, json, sys, hashlib, datetime
from pathlib import Path
from urllib.parse import urlparse
from collections import defaultdict

# --- konfig ---
DOCS = Path("docs")
SOURCE_JSON = DOCS / "uu-status-details.json"   # dagens fulle datasett
SOURCE_CSV  = DOCS / "uu-status.csv"            # fallback om JSON mangler
DATA_DIR    = DOCS / "data" / "uustatus"
LOGS_DIR    = DATA_DIR / "logs"
LATEST_JSON = DATA_DIR / "latest.json"          # forrige baseline for diff
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

def normalize_entry(raw):
    """Konverter kilde (JSON/CSV) til felles format. Lister sorteres, whitespace trimmes."""
    url = (raw.get("url") or raw.get("href") or "").strip()
    domain = (raw.get("domain") or to_domain(url)).strip()
    title = (raw.get("title") or raw.get("name") or "").strip()
    updatedAt = (raw.get("updatedAt") or raw.get("lastChecked") or "").strip()

    # nonConformities: prøv flere mulige nøkler
    nc = raw.get("nonConformities") or raw.get("violations") or raw.get("wcag") or []
    if isinstance(nc, str):
        nc = [s.strip() for s in nc.split(";") if s.strip()]
    elif isinstance(nc, list):
        nc = [str(x).strip() for x in nc if str(x).strip()]
    else:
        nc = []
    nc_sorted = sorted(nc)

    # totalNonConformities (om finnes), ellers len(nc)
    total = raw.get("totalNonConformities")
    try:
        total = int(total) if total is not None else len(nc_sorted)
    except Exception:
        total = len(nc_sorted)

    return {
        "url": url,
        "domain": domain,
        "title": title,
        "updatedAt": updatedAt,
        "nonConformities": nc_sorted,
        "totalNonConformities": total,
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
    """Les forrige baseline fra latest.json (bruk tomt sett om mangler)."""
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

    # 2) Kalkulér endringer URL for URL
    changes = []
    now = datetime.datetime.utcnow()
    now_iso = now.isoformat(timespec="seconds") + "Z"
    detected_date = now.strftime("%Y-%m-%d")  # nytt felt: når VI oppdaget det

    # Endringer og nye URLer
    for url, c in curr_by.items():
        p = prev_by.get(url)
        if p is None:
            # Ny URL
            updated_date = (c.get("updatedAt") or "")[:10] or today_str()
            changes.append({
                "ts": now_iso,
                "detectedDate": detected_date,   # <--- nytt
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
                    "detectedDate": detected_date,  # <--- nytt
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
            "detectedDate": detected_date,      # <--- nytt
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

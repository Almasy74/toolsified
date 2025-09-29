#!/usr/bin/env python3
import argparse, json, os, re
from datetime import datetime, timezone

ap = argparse.ArgumentParser()
ap.add_argument("--knowledge", required=True)
ap.add_argument("--crawl", required=True)
ap.add_argument("--out", required=True)
args = ap.parse_args()

def read_json(path, default=None):
    if default is None: default = []
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default

def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def toks(s):
    return re.findall(r"[a-zæøå0-9]+", (s or "").lower())

# --- 1) Les kilder ---
crawl = read_json(args.crawl, default=[])
aliases = read_json(os.path.join(args.knowledge, "aliases.no.json"), default={})

# Valgfritt: manuelt vedlikeholdte filer (brukes som supplement)
manual_components = read_json(os.path.join(args.knowledge, "components.json"), default=[])
manual_patterns   = read_json(os.path.join(args.knowledge, "patterns.json"),   default=[])

# --- 2) Normaliser crawl og lag tokens ---
normed = []
for d in crawl:
    if not isinstance(d, dict): 
        continue
    url     = d.get("url")
    title   = d.get("title") or ""
    name    = d.get("name")  or title.replace(" - Skatteetaten","").strip() or title
    dtype   = d.get("type")  or "doc"
    summary = d.get("summary") or ""
    tips    = d.get("tips") or []
    anchors = d.get("anchors") or []
    depth   = d.get("depth", None)

    token_source = " ".join([title, name, summary, " ".join(anchors)])
    tokens = toks(token_source)

    normed.append({
        "url": url,
        "title": title,
        "name": name,
        "type": dtype,
        "summary": summary,
        "tips": tips,
        "anchors": anchors,
        "depth": depth,
        "tokens": tokens
    })

# --- 3) Del i komponenter / mønstre / øvrige docs ---
crawl_components = [d for d in normed if d.get("type") == "component"]
crawl_patterns   = [d for d in normed if d.get("type") == "pattern"]
all_docs         = normed[:]  # alt, inkl. components/patterns

# --- 4) Slå sammen med manuelle (uten å duplisere) ---
def uniq_by(items, keyfn):
    seen = set()
    out = []
    for it in items:
        k = keyfn(it)
        if k in seen: 
            continue
        seen.add(k)
        out.append(it)
    return out

# For komponenter: nøkkel = docs URL eller id/navn
def comp_key(c):
    return c.get("url") or c.get("id") or c.get("name")

# For patterns: nøkkel = URL eller id
def pat_key(p):
    return p.get("url") or p.get("id")

# Mapper for å bringe manuelle komponenter litt nærmere crawlets format
def adapt_manual_component(c):
    # Forventet felter: id, name, aliases, links.docs/storybook, uu
    url = (c.get("links") or {}).get("docs")
    name = c.get("name") or c.get("id")
    return {
        "url": url,
        "title": name,
        "name": name,
        "type": "component",
        "summary": "",
        "tips": c.get("uu") or [],
        "anchors": [],
        "depth": None,
        "tokens": toks(" ".join([name or "", " ".join(c.get("aliases", []))]))
    }

def adapt_manual_pattern(p):
    # Forventet felter: id, links.pattern, summary, etc.
    url = (p.get("links") or {}).get("pattern")
    name = p.get("id") or p.get("title") or url
    tokens = []
    for i in (p.get("intent") or []):
        tokens.extend(toks(i))
    return {
        "url": url,
        "title": name,
        "name": name,
        "type": "pattern",
        "summary": p.get("summary") or "",
        "tips": (p.get("uu_check") or []) + (p.get("common_pitfalls") or []),
        "anchors": [],
        "depth": None,
        "tokens": tokens
    }

merged_components = uniq_by(
    crawl_components + [adapt_manual_component(c) for c in manual_components],
    comp_key
)

merged_patterns = uniq_by(
    crawl_patterns + [adapt_manual_pattern(p) for p in manual_patterns],
    pat_key
)

# --- 5) (Valgfritt) Legg inn enkle bildekoblinger hvis du har screenshots ---
# Eksempel: map "button"-komponenten til et lokalt bilde i docs/find/screenshots/
for d in merged_components:
    if d.get("url") and "/komponenter/button" in d["url"]:
        d["image"] = "./screenshots/button-default.png"

# --- 6) Bygg endelig index ---
index = {
    "generated": True,
    "generated_at": datetime.now(timezone.utc).isoformat(),

    # Søkegrunnlag
    "components": merged_components,
    "patterns": merged_patterns,
    "all_docs": all_docs,

    # Alias-ordbok (for UI til å gjøre ekstra matching hvis ønskelig)
    "aliases": aliases,
}

write_json(args.out, index)
print(f"Wrote index to {args.out} "
      f"({len(merged_components)} components, {len(merged_patterns)} patterns, {len(all_docs)} docs)")



import argparse, json, os, glob

ap = argparse.ArgumentParser()
ap.add_argument("--knowledge", required=True)
ap.add_argument("--crawl", required=True)
ap.add_argument("--out", required=True)
args = ap.parse_args()

def read_json(p):
    try:
        with open(p, encoding="utf-8") as f: return json.load(f)
    except: return []

crawl = read_json(args.crawl)
components = read_json(os.path.join(args.knowledge, "components.json"))
patterns = read_json(os.path.join(args.knowledge, "patterns.json"))

index = {
  "generated": True,
  "components": components,
  "patterns": patterns,
  "crawl": [{"url": d.get("url"), "title": d.get("title")} for d in crawl],
  "aliases": read_json(os.path.join(args.knowledge, "aliases.no.json")),
}

with open(args.out, "w", encoding="utf-8") as f:
    json.dump(index, f, ensure_ascii=False, indent=2)


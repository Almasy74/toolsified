import argparse, json, requests
from bs4 import BeautifulSoup

ap = argparse.ArgumentParser()
ap.add_argument("--sources", required=True)
ap.add_argument("--out", required=True)
args = ap.parse_args()

with open(args.sources, "r", encoding="utf-8") as f:
    src = json.load(f)

docs = []
for url in src.get("nav", []):
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "lxml")
        title = (soup.title.string or "").strip() if soup.title else url
        docs.append({"url": url, "title": title, "type": "nav"})
    except Exception as e:
        docs.append({"url": url, "error": str(e), "type": "nav"})

with open(args.out, "w", encoding="utf-8") as f:
    json.dump(docs, f, ensure_ascii=False, indent=2)
print(f"Wrote {len(docs)} docs to {args.out}")

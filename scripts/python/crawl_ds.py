import argparse, json, urllib.parse, requests
from bs4 import BeautifulSoup

ap = argparse.ArgumentParser()
ap.add_argument("--sources", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--max-depth", type=int, default=3)   # <-- default 3 nivå
ap.add_argument("--max-pages", type=int, default=400)
ap.add_argument("--timeout", type=int, default=10)
args = ap.parse_args()

def norm_url(base, href):
    if not href: return None
    u = urllib.parse.urljoin(base, href.split('#')[0])
    # normaliser trailing slash
    if u.endswith('/'): u = u[:-1]
    return u

with open(args.sources, "r", encoding="utf-8") as f:
    src = json.load(f)

roots = [u.rstrip('/') for u in src.get("nav",[])]
allowed_hosts = {urllib.parse.urlparse(u).netloc for u in roots}

def allowed(u: str) -> bool:
    pu = urllib.parse.urlparse(u)
    if pu.netloc not in allowed_hosts: return False
    # hold oss under en av root-stiene
    return any(u.startswith(r) for r in roots)

seen = set()
queue = [(r, 0) for r in roots]
docs  = []

while queue and len(seen) < args.max_pages:
    url, depth = queue.pop(0)
    if url in seen or not allowed(url): continue
    seen.add(url)

    try:
        r = requests.get(url, timeout=args.timeout, headers={"User-Agent":"ds-crawler/0.2"})
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "lxml")

        title = (soup.title.string or "").strip() if soup.title else url
        # trekk ut H2/H3-overskrifter (gir deg rask oversikt)
        sections = [h.get_text(" ", strip=True) for h in soup.select("h2, h3")][:25]

        docs.append({
            "url": url,
            "title": title,
            "type": "doc",
            "depth": depth,
            "sections": sections
        })

        # følg lenker videre inntil max-depth
        if depth < args.max_depth:
            for a in soup.select("a[href]"):
                u = norm_url(url, a.get("href"))
                if not u: continue
                # dropp filer vi ikke vil ha
                if any(u.lower().endswith(ext) for ext in (".pdf",".jpg",".jpeg",".png",".gif",".svg",".zip",".doc",".docx",".xls",".xlsx")):
                    continue
                if allowed(u) and u not in seen:
                    queue.append((u, depth+1))

    except Exception as e:
        docs.append({"url": url, "error": str(e), "type": "error", "depth": depth})

with open(args.out, "w", encoding="utf-8") as f:
    json.dump(docs, f, ensure_ascii=False, indent=2)

print(f"Crawled {len(docs)} pages (depth <= {args.max_depth}) → {args.out}")

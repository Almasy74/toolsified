import argparse, json, urllib.parse, requests
from bs4 import BeautifulSoup

ap = argparse.ArgumentParser()
ap.add_argument("--sources", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--max-depth", type=int, default=3)   # 0 = bare nav, 1 = ett nivå ned, osv.
ap.add_argument("--max-pages", type=int, default=400)
ap.add_argument("--timeout", type=int, default=10)
args = ap.parse_args()

def norm_url(base, href):
    """Løs opp relative lenker, fjern fragment, normaliser trailing slash."""
    if not href:
        return None
    u = urllib.parse.urljoin(base, href.split('#')[0])
    if u.endswith('/'):
        u = u[:-1]
    return u

with open(args.sources, "r", encoding="utf-8") as f:
    src = json.load(f)

# Normaliser rot-URLer og avgrens til disse
roots = [u.rstrip('/') for u in src.get("nav", [])]
allowed_hosts = {urllib.parse.urlparse(u).netloc for u in roots}

def allowed(u: str) -> bool:
    """Kun samme host og under en av oppgitte rot-stier."""
    pu = urllib.parse.urlparse(u)
    if pu.netloc not in allowed_hosts:
        return False
    return any(u.startswith(r) for r in roots)

seen = set()
queue = [(r, 0) for r in roots]
docs  = []

def text_or_none(soup: BeautifulSoup, selector: str):
    el = soup.select_one(selector)
    return el.get_text(" ", strip=True) if el else None

def classify_type(url: str) -> str:
    ul = url.lower()
    if "/designsystemet/komponenter/" in ul:
        return "component"
    if "/monster/" in ul:
        return "pattern"
    return "doc"

def extract_summary(soup: BeautifulSoup) -> str:
    # Prøv meta description først
    md = soup.select_one('meta[name="description"]')
    if md and md.get("content"):
        return md["content"].strip()[:400]
    # Ellers første avsnitt
    p = soup.select_one("main p, article p, .content p, p")
    if p:
        return p.get_text(" ", strip=True)[:400]
    return ""

def extract_tips(soup: BeautifulSoup) -> list:
    """Finn kuler/ol-li under seksjoner med relevante overskrifter."""
    section_headings = ["Tilgjengelighet", "Bruk", "Best practice", "God praksis", "Do", "Don't", "Obs", "Anbefalinger"]
    tips = []
    # gå gjennom H2/H3 og se etter ul/ol rett etterpå
    for h in soup.select("h2, h3"):
        title = h.get_text(" ", strip=True)
        if any(s.lower() in title.lower() for s in section_headings):
            # finn første liste etter overskriften (søskene)
            sib = h.find_next_sibling()
            while sib and sib.name not in ("ul", "ol") and sib.name not in ("h2", "h3"):
                sib = sib.find_next_sibling()
            if sib and sib.name in ("ul", "ol"):
                for li in sib.select("li")[:8]:
                    t = li.get_text(" ", strip=True)
                    if t:
                        tips.append(t)
    # fallbacks: se etter lister inne i seksjoner som åpenbart er “tilgjengelighet” osv.
    if not tips:
        for sel in ['section[aria-labelledby*="tilgjeng"] ul', 'section[aria-labelledby*="bruk"] ul']:
            for li in soup.select(f"{sel} li")[:8]:
                t = li.get_text(" ", strip=True)
                if t:
                    tips.append(t)
    return tips[:12]

def extract_anchors(soup: BeautifulSoup) -> list:
    return [h.get_text(" ", strip=True) for h in soup.select("h2, h3")][:30]

while queue and len(seen) < args.max_pages:
    url, depth = queue.pop(0)
    if url in seen or not allowed(url):
        continue
    seen.add(url)

    try:
        r = requests.get(url, timeout=args.timeout, headers={"User-Agent": "ds-crawler/0.3"})
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "lxml")

        title = (soup.title.string or "").strip() if soup.title else url
        name = title.replace(" - Skatteetaten", "").strip() or title
        doc_type = classify_type(url)
        summary = extract_summary(soup)
        tips = extract_tips(soup)
        anchors = extract_anchors(soup)

        docs.append({
            "url": url,
            "title": title,
            "name": name,
            "type": doc_type,
            "depth": depth,
            "summary": summary,
            "tips": tips,
            "anchors": anchors
        })

        # følg lenker videre inntil max-depth
        if depth < args.max_depth:
            for a in soup.select("a[href]"):
                u = norm_url(url, a.get("href"))
                if not u:
                    continue
                # dropp filer vi ikke vil ha
                low = u.lower()
                if low.endswith((".pdf", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".zip", ".doc", ".docx", ".xls", ".xlsx")):
                    continue
                if allowed(u) and u not in seen:
                    queue.append((u, depth + 1))

    except Exception as e:
        docs.append({
            "url": url,
            "error": str(e),
            "type": "error",
            "depth": depth
        })

with open(args.out, "w", encoding="utf-8") as f:
    json.dump(docs, f, ensure_ascii=False, indent=2)

print(f"Crawled {len(docs)} pages (depth <= {args.max_depth}) → {args.out}")

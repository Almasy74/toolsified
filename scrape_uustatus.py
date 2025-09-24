#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import csv, html, re, sys, time
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict
import requests
from bs4 import BeautifulSoup

HEADERS = {"User-Agent": "UUStatus-Scraper/1.0 (+contact: toolsified)"}
TIMEOUT = 20
RATE_SECONDS = 0.7

NOR_MONTHS = {
    "januar":1,"februar":2,"mars":3,"april":4,"mai":5,"juni":6,
    "juli":7,"august":8,"september":9,"oktober":10,"november":11,"desember":12
}
RE_CONFORMANCE = re.compile(r"\b(i\s+samsvar|delvis\s+i\s+samsvar|ikke\s+i\s+samsvar)\b", re.IGNORECASE)
RE_BREAKS     = re.compile(r"Det er brudd på\s+(\d+)\s+av\s+(\d+)\s+krav", re.IGNORECASE)
RE_WCAG_CODE  = re.compile(r"\b([1-4]\.[1-4]\.[0-9]{1,2}[a-z]?)\b")
RE_UPDATED1   = re.compile(r"sist\s+oppdatert\s+(\d{1,2})\.\s*([a-zæøå]+)\.?\s+(\d{4})", re.IGNORECASE)
RE_UPDATED2   = re.compile(r"(sist\s+oppdatert|sist\s+endret)\s*[:\-]?\s*(\d{1,2}\.\d{1,2}\.\d{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})", re.IGNORECASE)

def fetch(url: str) -> Optional[str]:
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        if r.status_code == 200 and "text/html" in r.headers.get("Content-Type",""):
            return r.text
    except requests.RequestException:
        return None
    return None

def parse_updated(text: str) -> Optional[str]:
    m = RE_UPDATED1.search(text)
    if m:
        d = int(m.group(1)); mon_txt = m.group(2).lower(); y = int(m.group(3))
        month = NOR_MONTHS.get(mon_txt)
        if month:
            return f"{y:04d}-{month:02d}-{d:02d}"
    m2 = RE_UPDATED2.search(text)
    if m2:
        val = m2.group(2)
        mm = re.match(r"(\d{1,2})\.(\d{1,2})\.(\d{4})$", val)
        if mm:
            d, m, y = map(int, mm.groups())
            return f"{y:04d}-{m:02d}-{d:02d}"
        if re.match(r"\d{4}-\d{2}-\d{2}$", val):
            return val
    return None

def parse_wcag(soup: BeautifulSoup, full_text: str) -> List[str]:
    codes = set()
    for el in soup.find_all(["li","p","span","td","dt","dd"]):
        t = el.get_text(" ", strip=True)
        for m in RE_WCAG_CODE.finditer(t):
            codes.add(m.group(1))
    if not codes:
        for m in RE_WCAG_CODE.finditer(full_text):
            codes.add(m.group(1))
    def sort_key(k):
        parts = re.split(r"[^\d]+", k)
        nums = [int(p) for p in parts if p.isdigit()]
        tail = re.sub(r"[\d\.]", "", k)
        return (*nums, tail)
    return sorted(codes, key=sort_key)

def parse_page(url: str) -> Dict[str,str]:
    html_text = fetch(url)
    if not html_text:
        return {"url": url, "title": "", "updated": "", "conformance": "", "breaks": "", "wcag": "", "status":"ERROR_FETCH"}
    soup = BeautifulSoup(html_text, "html.parser")
    full_text = soup.get_text(" ", strip=True)

    title = (soup.find("h1").get_text(" ", strip=True) if soup.find("h1") else (soup.title.string.strip() if soup.title else url))
    conf = RE_CONFORMANCE.search(full_text)
    conformance = conf.group(1).lower() if conf else ""
    br = RE_BREAKS.search(full_text)
    breaks = br.group(1) if br else ""
    updated = parse_updated(full_text) or ""

    wcag_list = parse_wcag(soup, full_text)
    wcag = ", ".join(wcag_list)

    return {
        "url": url,
        "title": title,
        "updated": updated,
        "conformance": conformance,
        "breaks": breaks if breaks else (str(len(wcag_list)) if wcag_list else ""),
        "wcag": wcag,
        "status":"OK"
    }

def build_html(rows: List[Dict[str,str]], title="UU-status – tilgjengelighetserklæringer") -> str:
    now = datetime.utcnow().isoformat() + "Z"
    head = f"""<!doctype html>
<html lang="no"><meta charset="utf-8"><title>{html.escape(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; padding:24px; max-width:1200px; margin:auto;}}
h1{{margin:0 0 12px; font-size:20px;}}
small{{color:#555;}}
table{{border-collapse:collapse; width:100%; margin-top:12px;}}
th,td{{border:1px solid #e2e2e2; padding:8px; vertical-align:top;}}
th{{background:#f7f7f7; text-align:left;}}
code{{font-family:ui-monospace,Menlo,Consolas,monospace;}}
.status-err{{color:#b00020; font-weight:600;}}
</style>
<h1>{html.escape(title)}</h1>
<small>Generert: {now}</small>
<table><thead><tr>
  <th>Løsning</th><th>Sist oppdatert</th><th>Samsvar</th><th>Brudd</th><th>WCAG-koder</th><th>Status</th>
</tr></thead><tbody>
"""
    body = []
    for r in rows:
        status = r["status"]
        status_cell = status if status=="OK" else f"<span class='status-err'>{html.escape(status)}</span>"
        body.append(
            "<tr>"
            f"<td><a href='{html.escape(r['url'])}' target='_blank' rel='noopener'>{html.escape(r['title'] or r['url'])}</a></td>"
            f"<td>{html.escape(r['updated'])}</td>"
            f"<td>{html.escape(r['conformance'])}</td>"
            f"<td>{html.escape(r['breaks'])}</td>"
            f"<td><code>{html.escape(r['wcag'])}</code></td>"
            f"<td>{status_cell}</td>"
            "</tr>"
        )
    tail = "</tbody></table></html>"
    return head + "\n".join(body) + tail

def main():
    csv_path = Path("urls.csv")
    if not csv_path.exists():
        print("Fant ikke urls.csv"); sys.exit(1)

    rows = []
    with csv_path.open("r", encoding="utf-8") as f:
        for i, rec in enumerate(csv.DictReader(f), start=1):
            url = (rec.get("url") or "").strip()
            if not url: continue
            data = parse_page(url)
            rows.append(data)
            print(f"[{i}] {data['status']:<11} {data['updated'] or '-':<10}  {data['breaks'] or '0':>3}  {url}")
            time.sleep(RATE_SECONDS)

    out_dir = Path("uu-status")
    out_dir.mkdir(exist_ok=True)
    (out_dir / "index.html").write_text(build_html(rows, title="UU-status – oversikt"), encoding="utf-8")
    print("Skrev uu-status/index.html")

if __name__ == "__main__":
    main()

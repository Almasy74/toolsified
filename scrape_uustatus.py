#!/usr/bin/env python3
import csv, re, time
from datetime import datetime, timezone
from pathlib import Path
import requests
from bs4 import BeautifulSoup

# INPUT og OUTPUT
INPUT_CSV = Path("uustatus-urls.csv")  # <-- gi kildelista di dette navnet
OUTPUT_CSV = Path("uu-status.csv")

HEADERS = {"User-Agent": "toolsified-uustatus-scraper (+https://github.com/Almasy74/toolsified)"}

# Mønstre (norske tekster på uustatus.no)
BRUDD_RE = re.compile(r"Det er brudd på\s+(\d+)\s+av\s+(\d+)\s+krav", re.IGNORECASE)
SIST_OPPDATERT_RE = re.compile(r"sist oppdatert\s+(\d{1,2}\.\s*\w+\s*\d{4})", re.IGNORECASE)
OPPRETTET_RE = re.compile(r"opprettet (?:første\s*gang|første gang)\s+(\d{1,2}\.\s*\w+\s*\d{4})", re.IGNORECASE)

MONTHS = {
    "januar":"January","februar":"February","mars":"March","april":"April",
    "mai":"May","juni":"June","juli":"July","august":"August",
    "september":"September","oktober":"October","november":"November","desember":"December"
}

def parse_no_date_to_iso(s):
    if not s:
        return ""
    raw = s.strip()
    for no, en in MONTHS.items():
        raw = re.sub(no, en, raw, flags=re.IGNORECASE)
    try:
        dt = datetime.strptime(raw.replace("  ", " "), "%d. %B %Y")
        return dt.date().isoformat()
    except Exception:
        return ""

def scrape_one(name, url):
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        status = r.status_code
        html = r.text
    except Exception as e:
        return {
            "Navn": name, "Url": url, "Brudd": "", "KravTotalt": "", "SistOppdatert": "",
            "Opprettet": "", "Statuskode": "", "Feil": str(e), "SistSjekket": datetime.now(timezone.utc).isoformat()
        }

    soup = BeautifulSoup(html, "lxml")
    text = soup.get_text(" ", strip=True)

    m_brudd = BRUDD_RE.search(text)
    brudd = m_brudd.group(1) if m_brudd else ""
    krav = m_brudd.group(2) if m_brudd else ""

    m_upd = SIST_OPPDATERT_RE.search(text)
    m_created = OPPRETTET_RE.search(text)
    updated_iso = parse_no_date_to_iso(m_upd.group(1)) if m_upd else ""
    created_iso = parse_no_date_to_iso(m_created.group(1)) if m_created else ""

    return {
        "Navn": name,
        "Url": url,
        "Brudd": brudd,
        "KravTotalt": krav,
        "SistOppdatert": updated_iso,
        "Opprettet": created_iso,
        "Statuskode": status,
        "Feil": "",
        "SistSjekket": datetime.now(timezone.utc).isoformat()
    }

def read_sources(path: Path):
    # tåler UTF-8 med/uten BOM
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=';')
        for row in reader:
            name = (row.get("Navn") or "").strip()
            url = (row.get("Url") or "").strip()
            if name and url:
                yield name, url

def main():
    if not INPUT_CSV.exists():
        raise SystemExit(f"Mangler {INPUT_CSV}. Opprett en semikolon-CSV med header 'Navn;Url'.")

    rows = []
    for name, url in read_sources(INPUT_CSV):
        rows.append(scrape_one(name, url))
        time.sleep(0.8)  # vær høflig

    fieldnames = ["Navn","Url","Brudd","KravTotalt","SistOppdatert","Opprettet","Statuskode","Feil","SistSjekket"]
    with OUTPUT_CSV.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter=';')
        writer.writeheader()
        writer.writerows(rows)

if __name__ == "__main__":
    main()

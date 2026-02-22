# Toolsified SEO Expansion Playbook

**Strategic Goal:** Use Google Search Console (GSC) testing data to mathematically scale content clusters that Google is already rewarding with impressions. 

**Rule of Thumb:** 
- **1 Query Signal** = 5–10 new pages generated using the exact same programmatic engine.
- Only scale clusters that show impressions > 20 and average position between 15–60.

---

## Signal Validation Window

A query signal must meet scoring criteria for **at least 14 consecutive days** before expansion is allowed.

*This prevents scaling temporary Google test impressions.*

---

## Signal Scoring Model

Each query signal receives a score before expansion.

**Score = (Impressions Weight) + (Position Weight) + (Cluster Match)**

**Impressions:**
- 20–50 = +1
- 50–200 = +2
- 200+ = +3

**Position:**
- 40–60 = +1
- 20–39 = +2
- 10–19 = +3

**Cluster Match:**
- Existing cluster = +2
- Adjacent cluster = +1

*Only expand signals with score ≥ 4.*

---

## Expansion Formula

Pages generated per signal:

- **Score 4** → 5 pages
- **Score 5** → 8 pages
- **Score 6+** → 12 pages

---

## Expansion Rate Limit

Maximum new pages per deployment cycle: **15**.

Large expansions must be split across multiple weeks to protect crawl budget and index quality.

---

## Cluster Authority Rule

New pages must remain within the functional purpose of the parent tool. Expansion may vary parameters, not intent.
- ✅ *USD → EUR*
- ❌ *Crypto tax reporting*

---

## Expansion Log

| Date Deployed | Query Observed (Signal) | Intent Type | Pattern Detected | New Pages Generated |
| :--- | :--- | :--- | :--- | :--- |
| YYYY-MM-DD | *Pending GSC Data* | *Currency / Time / Crypto* | *e.g., USD-* cluster* | *e.g., USD-JPY, USD-CHF...* |
| | | | | |
| | | | | |

---

## Current Expansion Backlog (The Next 100 Pages)
*Targeting 100 new programmatic pages based strictly on GSC validation.*

### 🟢 Currency Cluster (Target: 50 Pages)
*High Volume*
- **Signals:** *Waiting for GSC data*
- **Planned Additions:** 
  - (To be determined mathematically from signals)

### 🔵 Timezone Cluster (Target: 30 Pages)
*Easy Ranking*
- **Signals:** *Waiting for GSC data*
- **Planned Additions:**
  - (To be determined mathematically from signals)

### 🟣 Crypto Cluster (Target: 20 Pages)
*High Value*
- **Signals:** *Waiting for GSC data*
- **Planned Additions:**
  - (To be determined mathematically from signals)

---

## 10-Step Signal Radar Workflow 

*How to properly extract signals from GSC without guessing.*

1. **Open the Right Report:** Go to GSC → Performance → Search results. (Do not use Page view first).
2. **Set the Time Filter:** Date → Last 28 days. **Compare → Previous period.** (SEO signals are trends, not levels).
3. **Enable All Columns:** Turn on Clicks, Impressions, CTR, and Position.
4. **The Critical Filter:** Click + New → Query → Custom (regex). Enter: `(to|convert|timezone|time|crypto|btc|usd|eur)`. This removes noise testing outside our core clusters.
5. **Sort Correctly:** Sort by **Impressions ↓** (Descending), NOT clicks. Impressions indicate the ranking test phase.
6. **Identify the SIGNAL:** Look for query patterns (e.g., `usd to nok`, `usd to sek` both showing impressions). This means Google is testing the *USD cluster*, not just one page.
7. **Visual Cluster Check (Pro Move):** Click a query → Pages tab. If multiple pages get impressions from the same query, Google is mapping cluster authority (Green light).
8. **Export:** Export → Google Sheets. Add a "Signal Score" column and apply the Signal Scoring Model formula.
9. **Spot the Winners:** Look for Impressions going ↑ week-over-week and slow Position improvement. 0 clicks is normal; traffic comes last.
10. **Ignore the Noise:** Do not react to positions 80-100, single-day spikes, rare long sentences, or branded coincidences. Scale only stable testing.

---

## Kill Rule

Do NOT expand if:

- Position > 60 after 30 days
- Impressions do not grow week-over-week
- Query introduces a new category outside existing clusters

---

## The Expansion Flywheel

Expansion creates new impressions → impressions create signals → signals create expansion.

---

**HARD RULE:** Never build pages without a prior GSC signal after Phase 4.

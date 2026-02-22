# Toolsified SEO Expansion Playbook

**Strategic Goal:** Use Google Search Console (GSC) testing data to mathematically scale content clusters that Google is already rewarding with impressions. 

**Rule of Thumb:** 
- **1 Query Signal** = 5–10 new pages generated using the exact same programmatic engine.
- Only scale clusters that show impressions > 20 and average position between 15–60.

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

## Weekly Expansion Workflow (10 minutes)

1. Open GSC → Queries → Last 28 days
2. Export top 50 queries
3. Apply Signal Scoring
4. Select highest scoring signal
5. Generate pages using Expansion Formula
6. Deploy
7. Log expansion

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

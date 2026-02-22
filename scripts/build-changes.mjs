// scripts/build-changes.mjs
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const LATEST_PATH = "docs/data/uustatus/latest.json";
const LOG_PATH = "docs/data/uustatus/logs/changes.jsonl";
const SNAP_DIR = "docs/data/uustatus/snapshots_by_updated";

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function readPrevFromGit(p) {
  try {
    const out = execSync(`git show HEAD:${p}`, { encoding: "utf8" });
    return JSON.parse(out);
  } catch {
    return null; // Første kjøring – ingenting å sammenligne med
  }
}

function normSet(arr = []) {
  return new Set((arr || []).map(String).map(s => s.trim()).filter(Boolean));
}

function byKey(list = []) {
  // Nøkkel: domain + " " + url (juster hvis dine felt heter noe annet)
  const map = new Map();
  for (const row of list) {
    const key = `${row.domain || ""} ${row.url || ""}`.trim();
    if (key) map.set(key, row);
  }
  return map;
}

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function appendJSONL(p, obj) {
  ensureDir(path.dirname(p));
  fs.appendFileSync(p, JSON.stringify(obj) + "\n");
}

function writeSnapshot(updatedDate, rows) {
  if (!updatedDate) return;
  ensureDir(SNAP_DIR);
  const outPath = path.join(SNAP_DIR, `${updatedDate}.json`);
  fs.writeFileSync(outPath, JSON.stringify(rows, null, 2));
}

const latest = readJSON(LATEST_PATH);
const prev = readPrevFromGit(LATEST_PATH);

if (!prev) {
  console.log("Ingen forrige latest.json i HEAD – hopper over diff (første kjøring).");
  process.exit(0);
}

const prevMap = byKey(prev.rows || prev);   // tilpass hvis struktur er annerledes
const currMap = byKey(latest.rows || latest);

for (const [key, currRow] of currMap.entries()) {
  const prevRow = prevMap.get(key);
  if (!prevRow) continue; // Ny URL – kan logges separat hvis ønskelig

  // Antatt felt med WCAG-koder. Juster til dine feltnavn.
  const prevCodes = normSet(prevRow.wcag || prevRow.violations || prevRow.requirements);
  const currCodes = normSet(currRow.wcag || currRow.violations || currRow.requirements);

  const added = [...currCodes].filter(x => !prevCodes.has(x));
  const removed = [...prevCodes].filter(x => !currCodes.has(x));

  if (added.length === 0 && removed.length === 0) continue;

  const entry = {
    ts: new Date().toISOString(),
    domain: currRow.domain || prevRow.domain || "",
    url: currRow.url || prevRow.url || "",
    updatedDate: (currRow.updatedAt || currRow.updated || "").slice(0, 10),
    added,
    removed
  };

  appendJSONL(LOG_PATH, entry);
}

// (valgfritt) lag snapshots pr. updatedDate basert på nåværende latest.json
const byUpdated = new Map();
for (const r of (latest.rows || latest)) {
  const d = (r.updatedAt || r.updated || "").slice(0, 10);
  if (!d) continue;
  if (!byUpdated.has(d)) byUpdated.set(d, []);
  byUpdated.get(d).push(r);
}
for (const [d, rows] of byUpdated) {
  writeSnapshot(d, rows);
}

console.log("Difflogg og snapshots oppdatert.");

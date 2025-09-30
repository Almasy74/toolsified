// scripts/capture-stories.mjs
import { chromium } from 'playwright';
import fs from 'fs/promises';

const BASE = process.env.STORYBOOK_BASE; // f.eks. https://skatteetaten.github.io/designsystemet
const outDir = 'docs/screenshots';

const index = JSON.parse(await (await fetch(`${BASE}/index.json`)).text());
// Storybook 7: index.entries har id -> { type: 'story'|'docs', ... }
const storyIds = Object.values(index.entries)
  .filter(e => e.type === 'story')        // unngå docs-sider
  .map(e => e.id);

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });

// slå av animasjoner for stabile bilder
await page.addStyleTag({ content: `*,*::before,*::after{animation:none!important;transition:none!important}` });
// scripts/capture-stories.mjs
import { chromium } from 'playwright';
import fs from 'fs/promises';

const BASE = process.env.STORYBOOK_BASE || 'https://skatteetaten.github.io/designsystemet';
const OUT = process.env.OUTPUT_DIR || 'docs/find/screenshots';

const res = await fetch(`${BASE}/index.json`);
if (!res.ok) throw new Error(`Could not load index.json: ${res.status}`);
const index = await res.json();

// Storybook 7+: index.entries = { <key>: { id, type, title, ... } }
let stories = Object.values(index.entries).filter(e => e.type === 'story');

// Kun preview-stories (enden --preview)
stories = stories.filter(e => e.id?.endsWith('--preview'));

await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });

// Deaktiver animasjoner for stabile bilder
await page.addStyleTag({ content: `*,*::before,*::after{animation:none!important;transition:none!important}` });

for (const s of stories) {
  const id = s.id;
  const url = `${BASE}/iframe.html?id=${id}&globals=backgrounds.grid:false`;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Vent til root er synlig og har areal > 0 (ikke bare “finnes”)
    await page.waitForSelector('#storybook-root', { state: 'attached', timeout: 15000 });
    await page.waitForFunction(() => {
      const el = document.getElementById('storybook-root');
      if (!el) return false;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.visibility !== 'hidden' && cs.opacity !== '0' && r.width > 2 && r.height > 2;
    }, { timeout: 15000 });

    // Hvis komponenten er liten / midtstilt, ta screenshot av root
    const root = await page.$('#storybook-root');
    await root.screenshot({ path: `${OUT}/${id}.png` });
    console.log('✓', id);
  } catch (err) {
    console.warn('⚠️  Skippet pga. timeout/feil:', id, String(err).slice(0, 200));
    // fortsett med neste story
  }
}

await browser.close();

for (const id of storyIds) {
  const url = `${BASE}/iframe.html?id=${id}`;
  await page.goto(url, { waitUntil: 'networkidle' });

  // vent til story er lastet
  await page.waitForSelector('#storybook-root, [data-storyloaded]', { timeout: 10000 });

  // klipp til selve story-roten hvis mulig
  const target = await page.$('#storybook-root') || page.locator('body');
  await target.screenshot({ path: `${outDir}/${id}.png` });
  console.log('✓', id);
}

await browser.close();

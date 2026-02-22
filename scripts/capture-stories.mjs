// scripts/capture-stories.mjs
// Enkel og robust: henter kun preview-stories og tar screenshots av canvas (iframe.html)
import fs from 'fs/promises';
import { chromium } from 'playwright';

const BASE = process.env.STORYBOOK_BASE || 'https://skatteetaten.github.io/designsystemet';
const OUT  = process.env.OUTPUT_DIR     || 'docs/find/screenshots';

// 1) Hent Storybook-indeks
const res = await fetch(`${BASE}/index.json`);
if (!res.ok) throw new Error(`Kunne ikke laste index.json: ${res.status} ${res.statusText}`);
const index = await res.json();

// 2) Filtrer til stories (ikke docs), og helst preview-varianter
let stories = Object.values(index.entries || {}).filter(e => e.type === 'story');
stories = stories.filter(e => e.id?.endsWith('--preview') || /--(basic|default)$/.test(e.id));

await fs.mkdir(OUT, { recursive: true });

// 3) Start browser
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });

// Slå av animasjoner for stabilitet
await page.addStyleTag({ content: `*,*::before,*::after{animation:none!important;transition:none!important}` });

// 4) Loop gjennom stories
for (const s of stories) {
  const id = s.id;
  const url = `${BASE}/iframe.html?id=${id}&globals=backgrounds.grid:false`;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Vent til root finnes, er synlig og har areal > 0
    await page.waitForSelector('#storybook-root', { state: 'attached', timeout: 15000 });
    await page.waitForFunction(() => {
      const el = document.getElementById('storybook-root');
      if (!el) return false;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.visibility !== 'hidden' && cs.opacity !== '0' && r.width > 2 && r.height > 2;
    }, { timeout: 15000 });

    const root = await page.$('#storybook-root');
    await root.screenshot({ path: `${OUT}/${id}.png` });
    console.log('✓', id);
  } catch (err) {
    console.warn('⚠️  Skippet:', id, '-', (err && err.message) ? err.message : String(err));
    // Fortsett videre selv om én feiler
  }
}

await browser.close();

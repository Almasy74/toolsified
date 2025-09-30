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

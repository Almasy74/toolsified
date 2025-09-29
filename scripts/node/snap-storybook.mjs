#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = process.argv[2] || "knowledge/screens.json";
const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));

function ensureDir(p) { fs.mkdirSync(path.dirname(p), { recursive: true }); }

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  for (const job of cfg) {
    const {
      id, url, selector = ".sbdocs-preview",
      nth = 0, out, width = 1200, height = 800
    } = job;

    console.log(`→ [${id}] ${url}`);
    await page.setViewportSize({ width, height });
    await page.goto(url, { waitUntil: "networkidle" });

    // Noen Storybook-dok-sider lazy-loader – gi dem et ekstra lite hopp
    await page.waitForTimeout(400);

    // Finn element
    const els = await page.$$(selector);
    if (!els.length) {
      console.warn(`  ! Fant ikke selector "${selector}" – prøver fallback #storybook-root`);
      const root = await page.$("#storybook-root, #root, #storybook-docs");
      if (!root) { console.error(`  x Ingen elementer å skyte for ${id}`); continue; }
      ensureDir(out);
      await root.screenshot({ path: out });
      console.log(`  ✓ Lagret ${out}`);
      continue;
    }

    const el = els[Math.min(nth, els.length - 1)];
    ensureDir(out);
    await el.screenshot({ path: out });
    console.log(`  ✓ Lagret ${out}`);
  }

  await browser.close();
})();

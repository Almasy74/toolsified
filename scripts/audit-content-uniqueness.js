const fs = require('fs');
const path = require('path');

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (e.isFile() && p.endsWith('.html')) out.push(p);
  }
  return out;
}

const roots = ['currency', 'crypto', 'time-zone', 'time-code'];
const files = roots.filter((r) => fs.existsSync(r)).flatMap((r) => walk(r));

const stop = new Set(
  'the a an and or but if then else to of in on for with from by as at is are was were be been being this that these those it its your our we you they them their his her can could should would may might into over under between about before after during not no yes than very more most less least also use using used tool tools page calculator convert conversion time date amount value local global'.split(' ')
);

function textOf(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-zA-Z#0-9]+;/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(t) {
  return t.split(' ').filter((w) => w.length > 3 && !stop.has(w));
}

function vec(tok) {
  const m = new Map();
  for (const w of tok) m.set(w, (m.get(w) || 0) + 1);
  return m;
}

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const v of a.values()) na += v * v;
  for (const v of b.values()) nb += v * v;
  for (const [k, v] of a) {
    const bv = b.get(k);
    if (bv) dot += v * bv;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

const docs = files.map((f) => {
  const html = fs.readFileSync(f, 'utf8');
  const t = tokens(textOf(html));
  return { f, v: vec(t) };
});

const pairs = [];
for (let i = 0; i < docs.length; i += 1) {
  for (let j = i + 1; j < docs.length; j += 1) {
    pairs.push({ a: docs[i].f, b: docs[j].f, score: cosine(docs[i].v, docs[j].v) });
  }
}
pairs.sort((x, y) => y.score - x.score);

console.log(`Scanned docs: ${docs.length}`);
console.log('Top 30 highest-similarity pairs:');
for (const p of pairs.slice(0, 30)) {
  console.log(`${p.score.toFixed(4)}\t${p.a}\t${p.b}`);
}

for (const t of [0.99, 0.98, 0.95, 0.9]) {
  const n = pairs.filter((p) => p.score >= t).length;
  console.log(`Pairs >= ${t}: ${n}`);
}

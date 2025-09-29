const norm = (s)=> (s||'').toLowerCase();
const words = (s)=> (s||'').toLowerCase().match(/[a-zæøå0-9]+/g) || [];

function scoreDoc(queryTokens, doc) {
  const set = new Set(doc.tokens || []);
  let s = 0;
  for (const t of queryTokens) if (set.has(t)) s += 1;
  // bonus for navn/komponent
  if (doc.type === 'component') s += 2;
  return s;
}

function findAnswerPack(q, idx) {
  const qTokens = words(q);
  if (!qTokens.length) return null;

  // 1) komponent-kandidater
  const comps = (idx.components || [])
    .map(d => ({ doc: d, score: scoreDoc(qTokens, d) }))
    .filter(x => x.score > 0)
    .sort((a,b)=>b.score-a.score);

  // 2) mønster-kandidater
  const pats = (idx.patterns || [])
    .map(d => ({ doc: d, score: scoreDoc(qTokens, d) }))
    .filter(x => x.score > 0)
    .sort((a,b)=>b.score-a.score);

  // 3) fallback: all docs (språk/god praksis)
  const docs = (idx.all_docs || [])
    .map(d => ({ doc: d, score: scoreDoc(qTokens, d) }))
    .filter(x => x.score > 0)
    .sort((a,b)=>b.score-a.score);

  return {
    component: comps[0]?.doc || null,
    patterns: pats.slice(0,3).map(x=>x.doc),
    extras: docs.slice(0,5).map(x=>x.doc)
  };
}

function renderAnswerPack(pack) {
  const el = document.getElementById('results');
  if (!pack) { el.innerHTML = '<p>Ingen treff.</p>'; return; }
  const comp = pack.component;

  const compCard = comp ? `
  <article class="card">
    <h2>Komponent: ${comp.name || comp.title}</h2>
    ${comp.image ? `<img src="${comp.image}" alt="" loading="lazy" />` : ''}
    <p>${comp.summary || ''}</p>
    <p><a href="${comp.url}" target="_blank" rel="noopener">Åpne komponent-dokumentasjonen</a></p>
    ${ (comp.tips && comp.tips.length) ? `
      <h3>Tips & obs</h3>
      <ul>${comp.tips.slice(0,6).map(t=>`<li>${t}</li>`).join('')}</ul>` : '' }
  </article>` : '';

  const patList = pack.patterns?.length ? `
  <article class="card">
    <h2>Kjente mønstre</h2>
    <ul>
      ${pack.patterns.map(p=>`<li><a href="${p.url}" target="_blank">${p.title}</a></li>`).join('')}
    </ul>
  </article>` : '';

  const extraList = pack.extras?.length ? `
  <details class="card"><summary>Relatert innhold</summary>
    <ul>${pack.extras.map(d=>`<li><a href="${d.url}" target="_blank">${d.title}</a></li>`).join('')}</ul>
  </details>` : '';

  el.innerHTML = compCard + patList + extraList;
}

async function init() {
  const idx = await loadIndex();
  // (valgfritt) map bilde til komponentnavn hvis du har screenshots
  for (const d of idx.components || []) {
    if (/\/komponenter\/button/i.test(d.url)) d.image = './screenshots/button-default.png';
  }

  const input = document.getElementById('q');
  const go = document.getElementById('go');
  const run = () => renderAnswerPack(findAnswerPack(input.value, idx));
  go.addEventListener('click', run);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
  input.addEventListener('input', debounce(run, 150));

  // demo: “Neste-knapp”
  input.value = 'Neste-knapp';
  run();
}
window.addEventListener('DOMContentLoaded', init);

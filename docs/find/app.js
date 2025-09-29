async function loadIndex() {
  const res = await fetch('index.json', { cache: 'no-store' });
  return await res.json();
}

function norm(s) { return (s || '').toLowerCase().trim(); }

function match(query, idx) {
  const q = norm(query);
  const hits = [];

  // 1) Match patterns på intent
  for (const p of idx.patterns || []) {
    const intents = (p.intent || []).map(norm);
    if (intents.some(i => q.includes(i) || i.includes(q))) {
      hits.push({ type: 'pattern', item: p, score: 100 });
    }
  }

  // 2) Enkle alias-treff (tabell/grid…)
  for (const [k, vals] of Object.entries(idx.aliases || {})) {
    const words = [k, ...vals];
    if (words.some(w => q.includes(norm(w)))) {
      // legg inn relevante komponenter
      for (const c of idx.components || []) {
        if (c.aliases && c.aliases.map(norm).some(a => words.map(norm).includes(a))) {
          hits.push({ type: 'component', item: c, score: 50 });
        }
      }
    }
  }

  // 3) Fallback: enkel søk i titler fra crawl
  for (const d of idx.crawl || []) {
    if (norm(d.title).includes(q)) hits.push({ type: 'doc', item: d, score: 10 });
  }

  // sorter grovt
  return hits.sort((a,b) => b.score - a.score);
}

function render(hits) {
  const el = document.getElementById('results');
  if (!hits.length) { el.innerHTML = '<p>Ingen treff.</p>'; return; }

  const parts = hits.slice(0, 6).map(h => {
    if (h.type === 'pattern') {
      const p = h.item;
      return `
      <article class="card">
        <h2>Mønster: ${p.id}</h2>
        <p>${p.summary}</p>
        <h3>Anbefalte komponenter</h3>
        <ul>${(p.components||[]).map(c=>`<li>${c}</li>`).join('')}</ul>
        <h3>UU-sjekk</h3>
        <ul>${(p.uu_check||[]).map(x=>`<li>${x}</li>`).join('')}</ul>
        <p><a href="${p.links?.pattern}" target="_blank" rel="noopener">Les mer (mønstre)</a></p>
      </article>`;
    }
    if (h.type === 'component') {
      const c = h.item;
      return `
      <article class="card">
        <h2>Komponent: ${c.name}</h2>
        <p>Alias: ${(c.aliases||[]).join(', ')}</p>
        <p><a href="${c.links?.storybook}" target="_blank" rel="noopener">Storybook</a>
           • <a href="${c.links?.docs}" target="_blank" rel="noopener">Dok</a></p>
        <h3>UU-notater</h3>
        <ul>${(c.uu||[]).map(x=>`<li>${x}</li>`).join('')}</ul>
      </article>`;
    }
    const d = h.item;
    return `<p><a href="${d.url}" target="_blank" rel="noopener">${d.title}</a></p>`;
  });

  el.innerHTML = parts.join('');
}

(async function init() {
  const idx = await loadIndex();
  const input = document.getElementById('q');
  const go = document.getElementById('go');

  function run() {
    const q = input.value;
    if (!q) return render([]);
    match(q, idx).then(render);
  }
  go.addEventListener('click', run);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });

  // demo-spørring for å verifisere
  input.value = 'tabell der brukere kan legge til nye rader';
  run();
})();

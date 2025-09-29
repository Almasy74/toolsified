(function () {
  const $ = (id) => document.getElementById(id);

  function render(hits) {
    const el = $('results');
    if (!hits || !hits.length) { el.innerHTML = '<p>Ingen treff ennå.</p>'; return; }
    el.innerHTML = hits.map(h => {
      if (h.type === 'pattern') {
        const p = h.item;
        return `<article class="card">
          <h2>Mønster: ${p.id}</h2>
          <p>${p.summary || ''}</p>
          <h3>Anbefalte komponenter</h3>
          <ul>${(p.components||[]).map(c=>`<li>${c}</li>`).join('')}</ul>
        </article>`;
      }
      if (h.type === 'component') {
        const c = h.item;
        return `<article class="card">
          <h2>Komponent: ${c.name}</h2>
          <p>Alias: ${(c.aliases||[]).join(', ')}</p>
          <p><a href="${c.links?.storybook}" target="_blank" rel="noopener">Storybook</a>
             • <a href="${c.links?.docs}" target="_blank" rel="noopener">Dok</a></p>
        </article>`;
      }
      const d = h.item;
      return `<p><a href="${d.url}" target="_blank" rel="noopener">${d.title}</a></p>`;
    }).join('');
  }

  function norm(s){ return (s||'').toLowerCase().trim(); }

  function match(query, idx) {
    const q = norm(query);
    const hits = [];

    for (const p of idx.patterns || []) {
      const intents = (p.intent || []).map(norm);
      if (intents.some(i => q.includes(i) || i.includes(q))) {
        hits.push({ type: 'pattern', item: p, score: 100 });
      }
    }

    for (const c of idx.components || []) {
      const all = [c.name, ...(c.aliases||[])].map(norm);
      if (all.some(w => q.includes(w) || w.includes(q))) {
        hits.push({ type: 'component', item: c, score: 50 });
      }
    }

    for (const d of idx.crawl || []) {
      if (norm(d.title).includes(q)) hits.push({ type: 'doc', item: d, score: 10 });
    }

    return hits.sort((a,b) => b.score - a.score);
  }

  async function loadIndex() {
    try {
      console.log('find page at', location.href);
      const res = await fetch('./index.json', { cache: 'no-store' });
      console.log('fetch index.json ->', res.status, res.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      console.log('index keys:', Object.keys(data));
      return data;
    } catch (e) {
      console.error('index.json error:', e);
      $('results').innerHTML = `<p>Feil ved lasting av index.json: ${String(e)}</p>`;
      return { patterns:[], components:[], crawl:[], aliases:{} };
    }
  }

  window.addEventListener('DOMContentLoaded', async () => {
    const idx = await loadIndex();

    // sanity: vis noe med én gang
    render(match('tabell', idx));

    const input = $('q');
    const go = $('go');
    const run = () => render(match(input.value, idx));
    go.addEventListener('click', run);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
  });
})();

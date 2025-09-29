(function () {
  const $ = (id) => document.getElementById(id);

  function render(hits) {
    const el = $('results');
    if (!hits || !hits.length) { el.innerHTML = '<p>Ingen treff.</p>'; return; }
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

  const norm = (s) => (s||'').toLowerCase().trim();

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
      const res = await fetch('./index.json', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error('index.json error:', e);
      $('results').innerHTML = `<p>Feil ved lasting av index.json: ${String(e)}</p>`;
      return { patterns:[], components:[], crawl:[], aliases:{} };
    }
  }

  // enkel debounce for input
  const debounce = (fn, ms=200) => {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(()=>fn(...args), ms); };
  };

  window.addEventListener('DOMContentLoaded', async () => {
    const idx = await loadIndex();
    const input = $('q');
    const go = $('go');

    const run = () => {
      const q = input.value;
      console.log('RUN search:', q);
      render(match(q, idx));
    };

    // 1) Klikk på Søk
    go.addEventListener('click', () => { console.log('CLICK search'); run(); });

    // 2) Enter i feltet
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { console.log('ENTER search'); e.preventDefault(); run(); }
    });

    // 3) Live-søk mens man skriver
    input.addEventListener('input', debounce(run, 150));

    // Demo: vis noe ved første last (uten å låse input)
    if (!input.value) input.placeholder = 'f.eks. tabell der brukere kan legge til nye rader';
    render(match('tabell', idx));
  });
})();

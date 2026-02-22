const fs = require('fs');
const path = require('path');

const baseUrl = 'https://toolsified.com';
const testFiles = [
    'index.html',
    'currency/usd-to-eur/index.html',
    'currency/eur-to-nok/index.html',
    'currency/nok-to-usd/index.html',
    'time-zone/pst-to-est/index.html',
    'time-zone/cet-to-jst/index.html',
    'time-zone/sgt-to-pst/index.html',
    'crypto/btc-to-usd/index.html',
    'crypto/eth-to-eur/index.html',
    'time-code/convert-edt-to-local-time/index.html'
];

testFiles.forEach(file => {
    const fullPath = path.join(__dirname, '..', file);
    if (!fs.existsSync(fullPath)) {
        console.error(`File NOT FOUND: ${file}`);
        return;
    }

    const html = fs.readFileSync(fullPath, 'utf8');

    const titleMatch = html.match(/<title>([^<]*)<\/title>/);
    const title = titleMatch ? titleMatch[1] : 'MISSING';

    const h1Match = html.match(/<h1[^>]*>([^<]*)<\/h1>/);
    const h1 = h1Match ? h1Match[1] : 'MISSING';

    const canonicalMatch = html.match(/<link rel="canonical" href="([^"]*)"/);
    const canonical = canonicalMatch ? canonicalMatch[1] : 'MISSING';

    // Naive count for nav and related
    const navMatches = (html.match(/class="main-nav"[\s\S]*?<\/nav>/) || [''])[0].match(/<a /g);
    const navCount = navMatches ? navMatches.length : 0;

    const relatedMatches = html.match(/class="(related-tools|internal-links-cluster)"[\s\S]*?<\/div>/g);
    let relatedLinksCount = 0;
    if (relatedMatches) {
        relatedMatches.forEach(m => {
            const links = m.match(/<a /g);
            if (links) relatedLinksCount += links.length;
        });
    }

    console.log(`--- Audit: ${file} ---`);
    console.log(`Title: ${title}`);
    console.log(`H1: ${h1}`);
    console.log(`Canonical: ${canonical}`);
    console.log(`Nav links: ${navCount}`);
    console.log(`Related links: ${relatedLinksCount}`);

    const expectedCanonical = baseUrl + (file === 'index.html' ? '/' : '/' + file.replace('/index.html', ''));
    if (canonical !== expectedCanonical && canonical !== expectedCanonical + '/') {
        console.warn(`WARNING: Canonical mismatch! Expected approximately ${expectedCanonical}`);
    }
    console.log('');
});

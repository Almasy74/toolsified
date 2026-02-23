const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

// Data Sources
const dataCurrency = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));
const dataTz = JSON.parse(fs.readFileSync(path.join(__dirname, 'data-tz.json'), 'utf8'));
const dataCrypto = JSON.parse(fs.readFileSync(path.join(__dirname, 'data-crypto.json'), 'utf8'));
const dataTimecode = JSON.parse(fs.readFileSync(path.join(__dirname, 'data-timecode.json'), 'utf8'));

// Templates
const tplCurrency = fs.readFileSync(path.join(__dirname, 'currency-template.html'), 'utf8');
const tplTz = fs.readFileSync(path.join(__dirname, 'timezone-template.html'), 'utf8');
const tplCrypto = fs.readFileSync(path.join(__dirname, 'crypto-template.html'), 'utf8');
const tplTimecode = fs.readFileSync(path.join(__dirname, 'timecode-template.html'), 'utf8');

const sitemapFile = path.join(rootDir, 'sitemap.xml');

const baseUrls = [
    'https://toolsified.com/',
    'https://toolsified.com/time-code',
    'https://toolsified.com/multi-timezone',
    'https://toolsified.com/currency',
    'https://toolsified.com/crypto',
    'https://toolsified.com/privacy',
    'https://toolsified.com/contact',
    'https://toolsified.com/terms',
    'https://toolsified.com/about'
];
const generatedUrls = [];

const currentYear = new Date().getFullYear();

// Helper to get random items from an array
function getRandom(arr, n, exclude) {
    const result = new Array(n);
    let len = arr.length;
    const taken = new Array(len);
    if (n > len) n = len;
    let count = 0;
    while (count < n) {
        const x = Math.floor(Math.random() * len);
        const item = arr[x];
        if (item === exclude || taken[x]) continue;
        result[count++] = item;
        taken[x] = true;
    }
    return result.filter(x => x);
}

const urlMap = {
    currency: dataCurrency.map(p => ({ url: `/currency/${p.base.toLowerCase()}-to-${p.target.toLowerCase()}`, name: `${p.base} to ${p.target} Rate` })),
    timezone: dataTz.map(p => ({ url: `/time-zone/${p.baseVar}-to-${p.targetVar}`, name: `${p.baseName} to ${p.targetName}` })),
    crypto: dataCrypto.map(p => ({ url: `/crypto/${p.baseVar}-to-${p.targetVar}`, name: `${p.baseName} to ${p.targetName}` })),
    timecode: dataTimecode.map(p => ({ url: `/time-code/convert-${p.var}-to-local-time`, name: `${p.name} to Local` }))
};

function generateRelatedCluster(currentCategory, currentUrl) {
    let links = [];

    // Pick 3 from current category
    const sameCat = getRandom(urlMap[currentCategory], 3, currentUrl);
    links = links.concat(sameCat);

    // Pick 1 from a cross category
    let crossCatKey = 'currency';
    if (currentCategory === 'currency') crossCatKey = 'crypto';
    if (currentCategory === 'crypto') crossCatKey = 'currency';
    if (currentCategory === 'timezone') crossCatKey = 'timecode';
    if (currentCategory === 'timecode') crossCatKey = 'timezone';

    const crossCat = getRandom(urlMap[crossCatKey], 1);
    links = links.concat(crossCat);

    return links.map(l => `<p><a href="${l.url}" style="color: var(--primary-color); text-decoration: underline;">${l.name}</a></p>`).join('\n');
}

function generatePages(dataList, templateHtml, outDir, categoryKey, fileNameFunc, replaceFunc) {
    console.log(`Building ${dataList.length} pages for ${outDir}...`);
    dataList.forEach(item => {
        const folderName = fileNameFunc(item);
        const destDir = path.join(rootDir, outDir, folderName);
        const destFile = path.join(destDir, 'index.html');
        const currentUrl = `/${outDir}/${folderName}`;

        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

        const relatedCluster = generateRelatedCluster(categoryKey, currentUrl);
        let html = replaceFunc(templateHtml, item, relatedCluster);

        fs.writeFileSync(destFile, html, 'utf8');
        generatedUrls.push(`https://toolsified.com${currentUrl}`);
    });
}

// 1. Currency
generatePages(dataCurrency, tplCurrency, 'currency', 'currency',
    (p) => `${p.base.toLowerCase()}-to-${p.target.toLowerCase()}`,
    (html, p, related) => html
        .replace(/\[FROM_TICKER\]/g, p.base)
        .replace(/\[TO_TICKER\]/g, p.target)
        .replace(/\[FROM_NAME\]/g, p.baseName)
        .replace(/\[TO_NAME\]/g, p.targetName)
        .replace(/\[FROM_VAR\]/g, p.base.toLowerCase())
        .replace(/\[TO_VAR\]/g, p.target.toLowerCase())
        .replace(/\[YEAR\]/g, currentYear)
        .replace(/\[RELATED_CLUSTER\]/g, related)
);

// 2. Timezone
generatePages(dataTz, tplTz, 'time-zone', 'timezone',
    (p) => `${p.baseVar}-to-${p.targetVar}`,
    (html, p, related) => html
        .replace(/\[FROM_TZ\]/g, p.base)
        .replace(/\[TO_TZ\]/g, p.target)
        .replace(/\[FROM_NAME\]/g, p.baseName)
        .replace(/\[TO_NAME\]/g, p.targetName)
        .replace(/\[FROM_VAR\]/g, p.baseVar)
        .replace(/\[TO_VAR\]/g, p.targetVar)
        .replace(/\[YEAR\]/g, currentYear)
        .replace(/\[RELATED_CLUSTER\]/g, related)
);

// 3. Crypto
generatePages(dataCrypto, tplCrypto, 'crypto', 'crypto',
    (p) => `${p.baseVar}-to-${p.targetVar}`,
    (html, p, related) => html
        .replace(/\[FROM_TICKER\]/g, p.base)
        .replace(/\[TO_TICKER\]/g, p.target)
        .replace(/\[FROM_NAME\]/g, p.baseName)
        .replace(/\[TO_NAME\]/g, p.targetName)
        .replace(/\[FROM_VAR\]/g, p.baseVar)
        .replace(/\[TO_VAR\]/g, p.targetVar)
        .replace(/\[YEAR\]/g, currentYear)
        .replace(/\[RELATED_CLUSTER\]/g, related)
);

// 4. Timecode
generatePages(dataTimecode, tplTimecode, 'time-code', 'timecode',
    (p) => `convert-${p.var}-to-local-time`,
    (html, p, related) => html
        .replace(/\[FORMAT\]/g, p.format)
        .replace(/\[NAME\]/g, p.name)
        .replace(/\[VAR\]/g, p.var)
        .replace(/\[YEAR\]/g, currentYear)
        .replace(/\[RELATED_CLUSTER\]/g, related)
);

console.log('Generating sitemap.xml...');
let sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

baseUrls.forEach(url => { sitemapXml += `  <url><loc>${url}</loc></url>\n`; });
generatedUrls.forEach(url => { sitemapXml += `  <url><loc>${url}</loc></url>\n`; });

sitemapXml += `</urlset>`;
fs.writeFileSync(sitemapFile, sitemapXml, 'utf8');

console.log('Build complete! sitemap.xml updated with ' + (baseUrls.length + generatedUrls.length) + ' URLs.');

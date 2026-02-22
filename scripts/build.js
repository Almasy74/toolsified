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
    'https://toolsified.com/contact'
];
const generatedUrls = [];

function generatePages(dataList, templateHtml, outDir, fileNameFunc, replaceFunc) {
    console.log(`Building ${dataList.length} pages for ${outDir}...`);
    dataList.forEach(item => {
        const folderName = fileNameFunc(item);
        const destDir = path.join(rootDir, outDir, folderName);
        const destFile = path.join(destDir, 'index.html');

        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

        let html = replaceFunc(templateHtml, item);
        fs.writeFileSync(destFile, html, 'utf8');
        generatedUrls.push(`https://toolsified.com/${outDir}/${folderName}`);
    });
}

// 1. Currency
generatePages(dataCurrency, tplCurrency, 'currency',
    (p) => `${p.base.toLowerCase()}-to-${p.target.toLowerCase()}`,
    (html, p) => html
        .replace(/\[FROM_TICKER\]/g, p.base)
        .replace(/\[TO_TICKER\]/g, p.target)
        .replace(/\[FROM_NAME\]/g, p.baseName)
        .replace(/\[TO_NAME\]/g, p.targetName)
        .replace(/\[FROM_VAR\]/g, p.base.toLowerCase())
        .replace(/\[TO_VAR\]/g, p.target.toLowerCase())
);

// 2. Timezone
generatePages(dataTz, tplTz, 'time-zone',
    (p) => `${p.baseVar}-to-${p.targetVar}`,
    (html, p) => html
        .replace(/\[FROM_TZ\]/g, p.base)
        .replace(/\[TO_TZ\]/g, p.target)
        .replace(/\[FROM_NAME\]/g, p.baseName)
        .replace(/\[TO_NAME\]/g, p.targetName)
        .replace(/\[FROM_VAR\]/g, p.baseVar)
        .replace(/\[TO_VAR\]/g, p.targetVar)
);

// 3. Crypto
generatePages(dataCrypto, tplCrypto, 'crypto',
    (p) => `${p.baseVar}-to-${p.targetVar}`,
    (html, p) => html
        .replace(/\[FROM_TICKER\]/g, p.base)
        .replace(/\[TO_TICKER\]/g, p.target)
        .replace(/\[FROM_NAME\]/g, p.baseName)
        .replace(/\[TO_NAME\]/g, p.targetName)
        .replace(/\[FROM_VAR\]/g, p.baseVar)
        .replace(/\[TO_VAR\]/g, p.targetVar)
);

// 4. Timecode
generatePages(dataTimecode, tplTimecode, 'time-code',
    (p) => `convert-${p.var}-to-local-time`,
    (html, p) => html
        .replace(/\[FORMAT\]/g, p.format)
        .replace(/\[NAME\]/g, p.name)
        .replace(/\[VAR\]/g, p.var)
);

console.log('Generating sitemap.xml...');
let sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

baseUrls.forEach(url => { sitemapXml += `  <url><loc>${url}</loc></url>\n`; });
generatedUrls.forEach(url => { sitemapXml += `  <url><loc>${url}</loc></url>\n`; });

sitemapXml += `</urlset>`;
fs.writeFileSync(sitemapFile, sitemapXml, 'utf8');

console.log('Build complete! sitemap.xml updated with ' + (baseUrls.length + generatedUrls.length) + ' URLs.');

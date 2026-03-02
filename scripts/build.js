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
    'https://toolsified.com/business-days',
    'https://toolsified.com/meeting-overlap',
    'https://toolsified.com/inflation-calculator',
    'https://toolsified.com/crypto-tax-estimator',
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

function hashString(input) {
    let h = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
        h ^= input.charCodeAt(i);
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return h >>> 0;
}

const pairNoteLibrary = {
    currency: [
        'If you are paid in [FROM_TICKER] and budget in [TO_TICKER], check this pair before recurring transfers.',
        'For travel planning, compare this rate with your card issuer margin before final booking.',
        'When invoices are quoted in [FROM_TICKER], use this pair to validate [TO_TICKER] budget impact.',
        'For supplier quotes, confirm whether the quote date and payment date can create rate drift.',
        'If you hold reserves in [FROM_TICKER], monitor this pair before large [TO_TICKER] purchases.',
        'For ecommerce spend, this pair helps normalize cross-border prices into one reporting unit.',
        'In monthly planning, track this pair trend to avoid underestimating foreign-currency costs.',
        'If conversion fees are fixed, test different transfer sizes to reduce effective cost.',
        'For contract negotiations, this pair can support transparent currency adjustment discussions.',
        'When comparing offers, convert all options into [TO_TICKER] before ranking.'
    ],
    timezone: [
        'Use this specific corridor for recurring calls between [FROM_NAME] and [TO_NAME] teams.',
        'Check this pair around DST transitions to avoid one-hour scheduling errors.',
        'For launch coordination, convert canonical release time from [FROM_NAME] into [TO_NAME].',
        'If support handoffs span these regions, validate overlap windows weekly.',
        'For interview scheduling, this pair reduces ambiguity in candidate communications.',
        'When deadlines are region-bound, convert from [FROM_NAME] legal time to [TO_NAME] local time.',
        'For webinars, publish both [FROM_NAME] and [TO_NAME] versions to reduce no-shows.',
        'This route is useful when one team plans in [FROM_NAME] and delivery happens in [TO_NAME].',
        'During seasonal clock changes, verify whether offset differs from last month.',
        'For distributed standups, confirm this pair before setting recurring invites.'
    ],
    crypto: [
        'This pair is useful for checking historical [FROM_TICKER] performance in [TO_TICKER] terms.',
        'Before tax season, compare multiple sell dates to test sensitivity for this pair.',
        'For monthly reviews, keep assumptions for this pair documented with date and amount.',
        'If portfolio base currency is [TO_TICKER], this pair helps evaluate realized outcomes.',
        'Use this route for quick hindsight checks before full ledger reconciliation.',
        'When volatility spikes, compare short windows to understand timing impact.',
        'For investor updates, this pair can provide a transparent directional estimate.',
        'If fees were charged in asset units, reconcile exchange statements after using this estimate.',
        'Use this pair to test whether holding longer improved nominal result historically.',
        'When reporting internally, include date ranges used for this pair.'
    ],
    timecode: [
        'This page helps translate [FORMAT] invite text into local schedule context quickly.',
        'For incident response, convert [FORMAT] timestamps into all operator regions.',
        'If announcements use [FORMAT], publish converted ISO times for clarity.',
        'Use this converter to standardize shorthand [FORMAT] text into explicit local output.',
        'For interview logistics, confirm [FORMAT] phrases before sending calendar invites.',
        'If teams copy chat shorthand, convert [FORMAT] text to avoid ambiguity.',
        'For recurring events, store original [FORMAT] phrase and converted ISO string together.',
        'When confusion exists around DST, convert [FORMAT] text for each audience region.',
        'This translator is useful when source messages contain informal [FORMAT] time codes.',
        'Use this page to verify [FORMAT] phrases before external publication.'
    ]
};

const currencyContextLibrary = [
    'This pair is frequently checked when teams compare procurement costs across [FROM_NAME] and [TO_NAME] billing environments.',
    'Users often rely on this pair when salary, invoicing, or supplier contracts are priced in [FROM_TICKER] but reporting is done in [TO_TICKER].',
    'This conversion route is practical when planning cross-border budgets that start in [FROM_TICKER] and settle in [TO_TICKER].',
    'For international transfers, this pair helps estimate directional value before selecting a payment rail.',
    'When monitoring monthly spend, this pair can flag whether foreign-currency costs are drifting against your home budget.',
    'This pair is useful for normalizing quotes from vendors operating in different currency regions.',
    'If your operating cash is mainly [FROM_TICKER], this route helps estimate [TO_TICKER] outflows for upcoming commitments.',
    'This conversion is commonly used for travel planning when accommodation and services are priced in [TO_TICKER].',
    'For finance teams, this pair supports quick checks before formal treasury or accounting rate workflows are applied.',
    'When comparing competing offers, this pair helps create a single-currency view for faster decisions.'
];

const currencyScenarioLibrary = [
    'Estimate a software subscription renewal quoted in [FROM_TICKER] and compare final impact in [TO_TICKER].',
    'Convert payroll benchmark numbers from [FROM_TICKER] to [TO_TICKER] during compensation planning.',
    'Normalize cross-border ecommerce supplier invoices into [TO_TICKER] for margin review.',
    'Check whether a travel package priced in [FROM_TICKER] fits your [TO_TICKER] trip budget.',
    'Compare two agency retainers where one proposal is in [FROM_TICKER] and the other in [TO_TICKER].',
    'Translate project milestone payments to [TO_TICKER] before approving procurement documents.',
    'Estimate advance payment requirements when a contract clause is settled in [FROM_TICKER].',
    'Review quarterly spend trends by converting historical [FROM_TICKER] values into [TO_TICKER].',
    'Prepare client-facing budget options in [TO_TICKER] when base pricing is maintained in [FROM_TICKER].',
    'Cross-check card spending limits by converting planned [FROM_TICKER] purchases into [TO_TICKER].',
    'Evaluate marketplace pricing differences by converting listings from [FROM_TICKER] into [TO_TICKER].',
    'Assess conference travel expenses where registration is billed in [FROM_TICKER] but approvals are in [TO_TICKER].',
    'Plan tuition or training costs when invoices are denominated in [FROM_TICKER] and savings are in [TO_TICKER].',
    'Estimate subscription churn risk from currency moves when customer billing is in [FROM_TICKER].',
    'Validate partner commission statements by converting [FROM_TICKER] totals into [TO_TICKER].',
    'Build a simple what-if scenario for budget committees using [FROM_TICKER]-to-[TO_TICKER] assumptions.',
    'Check if supplier minimum-order thresholds in [FROM_TICKER] remain viable in [TO_TICKER] terms.',
    'Translate ad-spend plans from [FROM_TICKER] into [TO_TICKER] before monthly allocation meetings.',
    'Estimate onboarding package costs when relocation support is quoted in [FROM_TICKER].',
    'Compare event sponsorship tiers denominated in [FROM_TICKER] against [TO_TICKER] funding limits.'
];

const currencyFaqLibrary = [
    { q: 'How often should I re-check [FROM_TICKER] to [TO_TICKER] before payment?', a: 'For large or time-sensitive transactions, re-check close to execution time because market rates can move between quote and settlement.' },
    { q: 'Can I rely on this [FROM_TICKER]/[TO_TICKER] rate for invoices?', a: 'Use it as a reference estimate. Final invoice settlement depends on your provider rate policy, timestamp, and possible fees.' },
    { q: 'Why can two transfer services give different [FROM_TICKER] to [TO_TICKER] totals?', a: 'Providers may apply different spread, markup, and fee structures. The reference conversion is only one part of final pricing.' },
    { q: 'Is the converter useful for monthly budgeting in [TO_TICKER]?', a: 'Yes. It is suitable for planning assumptions, but accounting close should use approved internal rate policies.' },
    { q: 'Does this page include card fees or remittance charges?', a: 'No. It shows a rate-based conversion result. Network fees and provider charges are external to the calculator.' },
    { q: 'Can I compare reverse direction, [TO_TICKER] to [FROM_TICKER], on the same page?', a: 'Yes. Use the swap button or choose opposite currencies in the selectors.' },
    { q: 'Why does exchange timing matter for [FROM_TICKER] and [TO_TICKER]?', a: 'If your approval and execution are separated in time, the booked rate may differ from the earlier reference quote.' },
    { q: 'Should I keep a buffer when converting [FROM_TICKER] into [TO_TICKER]?', a: 'For high-volatility periods or large transactions, a small buffer can reduce risk of under-budgeting.' },
    { q: 'Can this conversion output be used for contract clauses?', a: 'You can use it for preliminary review, but contractual terms should define official source and timing rules explicitly.' },
    { q: 'Does Toolsified require login to convert [FROM_TICKER] to [TO_TICKER]?', a: 'No account is required for this calculator.' }
];

const cryptoScenarioLibrary = [
    'Test how a [FROM_TICKER] position performs in [TO_TICKER] terms across two different exit dates.',
    'Run a quick realized P/L estimate before reconciling full exchange exports.',
    'Compare multiple transaction rows to see timing impact under one fiat baseline.',
    'Prepare a directional investor update using transparent date-based assumptions.',
    'Validate whether a prior strategy produced positive nominal outcome in [TO_TICKER].',
    'Check downside sensitivity by moving sell date to a lower-price window.',
    'Estimate gain/loss before deciding whether to realize or defer a position.',
    'Create draft month-end performance notes before accounting system close.',
    'Use row-by-row output to isolate which transaction contributed most to total movement.',
    'Perform a pre-tax estimate review before handing records to professional tools.'
];

const cryptoFaqLibrary = [
    { q: 'Can this [FROM_TICKER] calculator replace exchange account statements?', a: 'No. Exchange statements remain authoritative for executed prices and fees.' },
    { q: 'Does this page include trading fees in [TO_TICKER] output?', a: 'No, the estimate is rate-based and does not automatically include venue fee schedules.' },
    { q: 'Why do results differ across platforms for the same dates?', a: 'Different providers can use different historical datasets, sampling windows, or pricing conventions.' },
    { q: 'Is this suitable for official tax reporting?', a: 'Use it for planning only, then reconcile with complete transaction records and local tax rules.' },
    { q: 'Can I model multiple transactions in one view?', a: 'Yes, add rows and compute each position independently.' },
    { q: 'Does holding period change this tool calculation?', a: 'The formula itself is date-rate based; holding period mainly matters in downstream tax treatment.' },
    { q: 'Can I use this to compare hypothetical sell dates?', a: 'Yes, changing the sell date is a common way to test timing sensitivity.' },
    { q: 'Is there account creation required for this crypto tool?', a: 'No account is required for basic calculations.' }
];

const timecodeScenarioLibrary = [
    'Translate [FORMAT]-based meeting invites into local team schedules before calendar booking.',
    'Convert incident handoff timestamps from [FORMAT] into operator-local time zones.',
    'Normalize social post announcements that include [FORMAT] shorthand only.',
    'Generate copy-ready local and ISO timestamps from [FORMAT] phrases for runbooks.',
    'Verify interview times written in [FORMAT] before sending confirmations.',
    'Check launch announcements in [FORMAT] against regional audience clocks.',
    'Convert community event times in [FORMAT] for moderators across regions.',
    'Resolve ambiguous scheduling text that includes [FORMAT] near DST change dates.'
];

const timecodeFaqLibrary = [
    { q: 'What if the [FORMAT] abbreviation appears without a date?', a: 'The parser can infer context, but adding a date improves reliability around timezone transitions.' },
    { q: 'Can I convert one [FORMAT] input into several zones?', a: 'Yes, add target zones and the same parsed moment is rendered for each selection.' },
    { q: 'Why might [FORMAT] output differ from a chat app preview?', a: 'Apps may parse shorthand differently; this tool applies a consistent abbreviation mapping model.' },
    { q: 'Does this converter support relative words with [FORMAT]?', a: 'Yes, phrases such as tomorrow or next weekday are supported in common patterns.' },
    { q: 'Should I include ISO time after converting [FORMAT]?', a: 'Yes, ISO output improves clarity for technical teams and cross-platform communication.' },
    { q: 'Can this page prevent DST scheduling mistakes?', a: 'It helps by using date-aware timezone conversion instead of static offset assumptions.' },
    { q: 'Is a user account needed to parse [FORMAT] time code?', a: 'No account is required.' },
    { q: 'Can I copy converted output directly?', a: 'Yes, each result row includes copy-ready text with local, ISO, and offset values.' }
];

function uniqueNotes(categoryKey, stableKey, replacements) {
    const library = pairNoteLibrary[categoryKey] || [];
    if (!library.length) return '';
    const used = new Set();
    let seed = hashString(stableKey);
    const picks = [];
    while (picks.length < 3 && used.size < library.length) {
        const idx = seed % library.length;
        seed = (seed * 1664525 + 1013904223) >>> 0;
        if (used.has(idx)) continue;
        used.add(idx);
        let line = library[idx];
        Object.entries(replacements).forEach(([k, v]) => {
            line = line.replace(new RegExp(`\\[${k}\\]`, 'g'), v);
        });
        picks.push(`<li>${line}</li>`);
    }
    return picks.join('\n');
}

function uniqueLines(stableKey, library, n, replacements, renderer) {
    if (!library.length) return '';
    const used = new Set();
    let seed = hashString(stableKey + '|lines|' + library.length);
    const picks = [];
    while (picks.length < n && used.size < library.length) {
        const idx = seed % library.length;
        seed = (seed * 1664525 + 1013904223) >>> 0;
        if (used.has(idx)) continue;
        used.add(idx);
        let value = library[idx];
        if (typeof value === 'string') {
            Object.entries(replacements).forEach(([k, v]) => {
                value = value.replace(new RegExp(`\\[${k}\\]`, 'g'), v);
            });
        } else if (value && typeof value === 'object') {
            value = Object.fromEntries(Object.entries(value).map(([key, content]) => {
                let replaced = content;
                Object.entries(replacements).forEach(([k, v]) => {
                    replaced = replaced.replace(new RegExp(`\\[${k}\\]`, 'g'), v);
                });
                return [key, replaced];
            }));
        }
        picks.push(renderer(value));
    }
    return picks.join('\n');
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
        .replace(/\[PAIR_CONTEXT_A\]/g, uniqueLines(`${p.base}-to-${p.target}`, currencyContextLibrary, 1, {
            FROM_TICKER: p.base,
            TO_TICKER: p.target,
            FROM_NAME: p.baseName,
            TO_NAME: p.targetName
        }, x => x))
        .replace(/\[PAIR_CONTEXT_B\]/g, uniqueLines(`${p.target}-to-${p.base}`, currencyContextLibrary, 1, {
            FROM_TICKER: p.base,
            TO_TICKER: p.target,
            FROM_NAME: p.baseName,
            TO_NAME: p.targetName
        }, x => x))
        .replace(/\[PAIR_SCENARIOS\]/g, uniqueLines(`${p.base}-${p.target}`, currencyScenarioLibrary, 5, {
            FROM_TICKER: p.base,
            TO_TICKER: p.target,
            FROM_NAME: p.baseName,
            TO_NAME: p.targetName
        }, x => `<li>${x}</li>`))
        .replace(/\[PAIR_FAQ\]/g, uniqueLines(`${p.base}|${p.target}`, currencyFaqLibrary, 4, {
            FROM_TICKER: p.base,
            TO_TICKER: p.target,
            FROM_NAME: p.baseName,
            TO_NAME: p.targetName
        }, x => `<div class="faq-item" style="margin-bottom: 16px;"><strong>${x.q}</strong><p>${x.a}</p></div>`))
        .replace(/\[FROM_TICKER\]/g, p.base)
        .replace(/\[TO_TICKER\]/g, p.target)
        .replace(/\[FROM_NAME\]/g, p.baseName)
        .replace(/\[TO_NAME\]/g, p.targetName)
        .replace(/\[FROM_VAR\]/g, p.base.toLowerCase())
        .replace(/\[TO_VAR\]/g, p.target.toLowerCase())
        .replace(/\[YEAR\]/g, currentYear)
        .replace(/\[PAIR_NOTES\]/g, uniqueNotes('currency', `${p.base.toLowerCase()}-to-${p.target.toLowerCase()}`, {
            FROM_TICKER: p.base,
            TO_TICKER: p.target,
            FROM_NAME: p.baseName,
            TO_NAME: p.targetName
        }))
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
        .replace(/\[PAIR_NOTES\]/g, uniqueNotes('timezone', `${p.baseVar}-to-${p.targetVar}`, {
            FROM_NAME: p.baseName,
            TO_NAME: p.targetName
        }))
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
        .replace(/\[PAIR_SCENARIOS\]/g, uniqueLines(`${p.baseVar}-${p.targetVar}-scn`, cryptoScenarioLibrary, 5, {
            FROM_TICKER: p.base,
            TO_TICKER: p.target,
            FROM_NAME: p.baseName,
            TO_NAME: p.targetName
        }, x => `<li>${x}</li>`))
        .replace(/\[PAIR_FAQ\]/g, uniqueLines(`${p.baseVar}-${p.targetVar}-faq`, cryptoFaqLibrary, 4, {
            FROM_TICKER: p.base,
            TO_TICKER: p.target,
            FROM_NAME: p.baseName,
            TO_NAME: p.targetName
        }, x => `<div class="faq-item" style="margin-bottom: 16px;"><strong>${x.q}</strong><p>${x.a}</p></div>`))
        .replace(/\[PAIR_NOTES\]/g, uniqueNotes('crypto', `${p.baseVar}-to-${p.targetVar}`, {
            FROM_TICKER: p.base,
            TO_TICKER: p.target,
            FROM_NAME: p.baseName,
            TO_NAME: p.targetName
        }))
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
        .replace(/\[PAIR_SCENARIOS\]/g, uniqueLines(`${p.var}-scn`, timecodeScenarioLibrary, 5, {
            FORMAT: p.format,
            NAME: p.name
        }, x => `<li>${x}</li>`))
        .replace(/\[PAIR_FAQ\]/g, uniqueLines(`${p.var}-faq`, timecodeFaqLibrary, 4, {
            FORMAT: p.format,
            NAME: p.name
        }, x => `<div class="faq-item" style="margin-bottom: 16px;"><strong>${x.q}</strong><p>${x.a}</p></div>`))
        .replace(/\[PAIR_NOTES\]/g, uniqueNotes('timecode', p.var, {
            FORMAT: p.format,
            NAME: p.name
        }))
        .replace(/\[RELATED_CLUSTER\]/g, related)
);

console.log('Generating sitemap.xml...');
let sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

baseUrls.forEach(url => { sitemapXml += `  <url><loc>${url}</loc></url>\n`; });
generatedUrls.forEach(url => { sitemapXml += `  <url><loc>${url}</loc></url>\n`; });

sitemapXml += `</urlset>`;
fs.writeFileSync(sitemapFile, sitemapXml, 'utf8');

console.log('Build complete! sitemap.xml updated with ' + (baseUrls.length + generatedUrls.length) + ' URLs.');

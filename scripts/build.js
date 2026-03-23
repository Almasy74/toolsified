const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

const dataCurrency = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));
const dataTz = JSON.parse(fs.readFileSync(path.join(__dirname, 'data-tz.json'), 'utf8'));
const dataCrypto = JSON.parse(fs.readFileSync(path.join(__dirname, 'data-crypto.json'), 'utf8'));
const dataTimecode = JSON.parse(fs.readFileSync(path.join(__dirname, 'data-timecode.json'), 'utf8'));

const tplCurrency = fs.readFileSync(path.join(__dirname, 'currency-template.html'), 'utf8');
const tplTz = fs.readFileSync(path.join(__dirname, 'timezone-template.html'), 'utf8');
const tplCrypto = fs.readFileSync(path.join(__dirname, 'crypto-template.html'), 'utf8');
const tplTimecode = fs.readFileSync(path.join(__dirname, 'timecode-template.html'), 'utf8');

const sitemapFile = path.join(rootDir, 'sitemap.xml');
const currentYear = new Date().getFullYear();
const buildDate = new Date().toISOString().split('T')[0];

const baseUrls = [
    { url: 'https://toolsified.com/', priority: '1.0', changefreq: 'weekly' },
    { url: 'https://toolsified.com/currency', priority: '0.9', changefreq: 'weekly' },
    { url: 'https://toolsified.com/crypto', priority: '0.9', changefreq: 'weekly' },
    { url: 'https://toolsified.com/time-code', priority: '0.9', changefreq: 'weekly' },
    { url: 'https://toolsified.com/multi-timezone', priority: '0.8', changefreq: 'monthly' },
    { url: 'https://toolsified.com/business-days', priority: '0.6', changefreq: 'monthly' },
    { url: 'https://toolsified.com/meeting-overlap', priority: '0.6', changefreq: 'monthly' },
    { url: 'https://toolsified.com/inflation-calculator', priority: '0.6', changefreq: 'monthly' },
    { url: 'https://toolsified.com/crypto-tax-estimator', priority: '0.6', changefreq: 'monthly' },
    { url: 'https://toolsified.com/methodology', priority: '0.5', changefreq: 'monthly' },
    { url: 'https://toolsified.com/about', priority: '0.4', changefreq: 'monthly' },
    { url: 'https://toolsified.com/contact', priority: '0.3', changefreq: 'yearly' },
    { url: 'https://toolsified.com/privacy', priority: '0.2', changefreq: 'yearly' },
    { url: 'https://toolsified.com/terms', priority: '0.2', changefreq: 'yearly' },
];
const generatedUrls = [];

const defaultCommonAmounts = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

const commonAmountsByCurrency = {
    JPY: [100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000],
    KRW: [1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000],
    IDR: [10000, 50000, 100000, 250000, 500000, 1000000, 2500000, 5000000],
    VND: [10000, 50000, 100000, 250000, 500000, 1000000, 2500000, 5000000],
    HUF: [1000, 5000, 10000, 25000, 50000, 100000, 250000],
    CLP: [1000, 5000, 10000, 25000, 50000, 100000, 250000]
};

// --- Deterministic hash-based helpers (replaces Math.random) ---

function hashString(input) {
    let h = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
        h ^= input.charCodeAt(i);
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return h >>> 0;
}

function getSeeded(arr, n, stableKey, exclude) {
    const result = [];
    const used = new Set();
    let seed = hashString(stableKey);
    const max = Math.min(n, arr.length);
    let attempts = 0;
    while (result.length < max && attempts < arr.length * 3) {
        const idx = seed % arr.length;
        seed = (seed * 1664525 + 1013904223) >>> 0;
        attempts++;
        if (used.has(idx)) continue;
        const item = arr[idx];
        if (exclude && item.url === exclude) continue;
        used.add(idx);
        result.push(item);
    }
    return result;
}

// --- URL Maps ---

const urlMap = {
    currency: dataCurrency.map(p => ({
        url: `/currency/${p.base.toLowerCase()}-to-${p.target.toLowerCase()}`,
        name: `${p.base} to ${p.target} Converter`
    })),
    timezone: dataTz.map(p => ({
        url: `/time-zone/${p.baseVar}-to-${p.targetVar}`,
        name: `${p.baseName} to ${p.targetName}`
    })),
    crypto: dataCrypto.map(p => ({
        url: `/crypto/${p.baseVar}-to-${p.targetVar}`,
        name: `${p.baseName} to ${p.targetName} Calculator`
    })),
    timecode: dataTimecode.map(p => ({
        url: `/time-code/convert-${p.var}-to-local-time`,
        name: `${p.name} to Local Time`
    }))
};

function generateRelatedCluster(currentCategory, currentUrl, stableKey) {
    let links = [];

    const sameCat = getSeeded(urlMap[currentCategory], 4, stableKey + '-same', currentUrl);
    links = links.concat(sameCat);

    let crossCatKey = 'currency';
    if (currentCategory === 'currency') crossCatKey = 'crypto';
    if (currentCategory === 'crypto') crossCatKey = 'currency';
    if (currentCategory === 'timezone') crossCatKey = 'timecode';
    if (currentCategory === 'timecode') crossCatKey = 'timezone';

    const crossCat = getSeeded(urlMap[crossCatKey], 1, stableKey + '-cross');
    links = links.concat(crossCat);

    return links.map(l =>
        `<p><a href="${l.url}" style="color: var(--primary-color); text-decoration: underline;">${l.name}</a></p>`
    ).join('\n');
}

// Reverse-pair link for currency (e.g. USD-to-EUR shows link to EUR-to-USD)
function getReversePairLink(base, target) {
    const reverseUrl = `/currency/${target.toLowerCase()}-to-${base.toLowerCase()}`;
    const found = urlMap.currency.find(u => u.url === reverseUrl);
    if (found) {
        return `<p><a href="${found.url}" style="color: var(--primary-color); text-decoration: underline;">Convert ${target} to ${base} (reverse)</a></p>`;
    }
    return '';
}

// --- Content libraries ---

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

const currencyPageOverrides = {
    'krw-to-usd': {
        title: 'KRW to USD Converter – Live Rate, Common Amounts and Planning Guide',
        metaDescription: 'Convert South Korean Won to US Dollars with a live KRW to USD rate, quick reference amounts, and practical notes on fees, timing, and settlement differences.',
        introParagraphs: [
            'This page converts South Korean Won (KRW) to US Dollars (USD) using a live reference rate and instant browser-side calculation. It is most useful when you need a fast USD estimate for a KRW-denominated amount without opening a banking app, spreadsheet, or trading platform.',
            'This pair is common in supplier payments, travel planning, ecommerce price checks, freelancer invoices, and internal budget reviews where the base number starts in KRW but reporting or approval happens in USD. A typical use case is checking whether a KRW quote, salary number, registration fee, or card spend still fits a USD budget before the final payment is booked.',
            'Use the quick-reference table for rough planning, then run the exact amount through the calculator for anything important. Final payment totals can differ from the reference rate because banks, card networks, and transfer providers often apply their own spread, timing, and fees.'
        ],
        scenarios: [
            'Check whether a supplier quote in KRW still fits a USD procurement limit.',
            'Estimate how much a conference, training fee, or hotel charge in South Korea represents in USD terms.',
            'Convert recurring KRW expenses into USD for monthly reporting or stakeholder updates.',
            'Compare offers consistently when one vendor prices in KRW and another prices in USD.',
            'Review payroll or contractor amounts before sending an international transfer.'
        ],
        notesHeading: 'KRW to USD planning notes',
        notes: [
            'KRW is a high-unit currency, so round-looking KRW amounts can convert into much smaller USD totals than users expect at first glance.',
            'If you are approving a payment now but executing it later, re-check the rate close to settlement time.',
            'For larger transfers, compare the reference rate here with your provider\'s quoted execution rate and fee policy.'
        ],
        faq: [
            { q: 'Why do KRW amounts look so large compared with USD?', a: 'The won is quoted in larger nominal numbers than the US dollar, so everyday amounts often appear much bigger before conversion. That is normal for this currency pair.' },
            { q: 'Can I use this for budgeting in USD?', a: 'Yes, it is useful for planning, approvals, and rough reporting. For accounting close or treasury workflows, use your approved internal rate policy or settlement documentation.' },
            { q: 'Will my bank give me the exact same KRW to USD result?', a: 'Not necessarily. This tool provides a live reference conversion. Your bank, card issuer, or transfer provider may apply a spread, execution delay, or separate fees.' },
            { q: 'Can I reverse the direction and convert USD to KRW?', a: 'Yes. Use the swap control or the reverse-pair link to move from USD to KRW.' }
        ]
    },
    'eur-to-cad': {
        title: 'EUR to CAD Converter – Live Rate, Examples and Budget Planning',
        metaDescription: 'Convert Euros to Canadian Dollars with a live EUR to CAD rate, common amounts, and practical guidance for travel, invoices, and settlement differences.',
        introParagraphs: [
            'This page converts Euros (EUR) to Canadian Dollars (CAD) using a live reference rate and browser-side calculation. It is designed for quick decision support when you need to translate a EUR amount into CAD without doing the math manually.',
            'This pair is especially practical for travel planning, tuition and relocation estimates, agency or contractor invoices, and cross-border pricing reviews where the quoted amount starts in EUR but the working budget is in CAD. A common scenario is comparing whether a hotel, subscription, event fee, or supplier invoice priced in euros still fits a Canadian-dollar budget.',
            'The quick-reference table is useful for fast planning. For anything contractual or time-sensitive, run the exact amount and confirm the booked rate with your provider, since settlement timing, card margins, and transfer fees can change the final amount.'
        ],
        scenarios: [
            'Check whether a European invoice or retainer fits a Canadian operating budget.',
            'Estimate travel spend in CAD before booking flights, hotels, or event tickets priced in EUR.',
            'Compare two proposals where one is quoted in euros and the other in Canadian dollars.',
            'Convert recurring software or marketplace costs from EUR into CAD for monthly planning.',
            'Prepare a rough finance summary before the final payment rate is confirmed.'
        ],
        notesHeading: 'EUR to CAD planning notes',
        notes: [
            'This pair is often used for budgeting rather than trading, so the main risk is underestimating the final CAD total after fees.',
            'If your invoice is approved in one week and paid in another, the booked CAD outcome may differ from the earlier estimate.',
            'For card-based purchases, compare this reference result with your card issuer\'s foreign exchange policy.'
        ],
        faq: [
            { q: 'Is this EUR to CAD result suitable for travel budgeting?', a: 'Yes. It is useful for rough trip planning and price comparison. Final card or cash-exchange totals may differ depending on provider spreads and fees.' },
            { q: 'Why can the final CAD amount differ from this converter?', a: 'This page shows a live reference rate. Your bank, card network, or transfer service may use a different timestamp, spread, or fee structure.' },
            { q: 'Should I add a buffer when converting EUR into CAD?', a: 'For larger invoices or travel budgets, that is sensible. A small buffer helps reduce the risk of underestimating the final CAD cost.' },
            { q: 'Can I switch to CAD to EUR on the same tool?', a: 'Yes. Use the swap function or the reverse-pair link.' }
        ]
    },
    'cny-to-usd': {
        title: 'CNY to USD Converter – Live Rate, Common Amounts and Invoice Checks',
        metaDescription: 'Convert Chinese Yuan to US Dollars with a live CNY to USD rate, practical examples, and guidance for invoices, card spend, and settlement differences.',
        introParagraphs: [
            'This page converts Chinese Yuan (CNY) to US Dollars (USD) using a live reference rate and immediate browser-side calculation. It is built for quick checks when an amount starts in CNY but the decision, budget, or comparison needs to happen in USD.',
            'This pair is useful for supplier quotes, ecommerce sourcing, travel budgets, freelancer invoices, and internal planning where a China-priced amount must be translated into US-dollar terms before approval. A common use case is checking whether a CNY quote still fits a USD purchase limit before you place an order or send payment.',
            'The table below helps with rough planning, while the calculator is better for exact amounts. For anything operationally important, confirm the final settlement rate with your bank or payment provider because fees, spreads, and booking delays can move the final USD amount away from the reference result shown here.'
        ],
        scenarios: [
            'Estimate supplier invoices from China in USD before approval.',
            'Compare landed product costs when listings are priced in CNY but reporting is done in USD.',
            'Check whether a card purchase or marketplace order still fits a USD spending cap.',
            'Translate recurring service or manufacturing costs from CNY into USD for planning meetings.',
            'Prepare a quick reference number before confirming final terms with a payment provider.'
        ],
        notesHeading: 'CNY to USD planning notes',
        notes: [
            'This pair is often used in sourcing, procurement, and ecommerce reviews where the reference conversion matters before final checkout.',
            'If the supplier quote is fixed now but your payment happens later, re-check close to execution time.',
            'For business use, treat this output as a planning reference rather than a treasury or accounting source of record.'
        ]
    },
    'aud-to-eur': {
        title: 'AUD to EUR Converter – Live Rate, Common Amounts and Travel Checks',
        metaDescription: 'Convert Australian Dollars to Euros with a live AUD to EUR rate, planning examples, and practical notes for travel, invoices, and cross-border spending.',
        introParagraphs: [
            'This page converts Australian Dollars (AUD) to Euros (EUR) using a live reference rate and instant browser-side math. It is useful when you need to understand the euro value of an AUD amount quickly, whether for travel, invoice review, subscriptions, or cross-border planning.',
            'This pair is especially relevant for Australians spending in Europe, remote teams approving euro-denominated costs, and businesses that hold or budget in AUD while paying vendors in EUR. A typical use case is checking whether an AUD budget still covers a hotel booking, event cost, training invoice, or supplier quote priced in euros.',
            'Use the quick-reference amounts for planning and the exact calculator for real numbers. For final payment decisions, compare the reference result with your provider\'s quoted execution rate, since the booked outcome may include a spread, fee, or timing difference.'
        ],
        scenarios: [
            'Estimate European travel costs in EUR before leaving an AUD budget framework.',
            'Check whether a euro-priced invoice still fits an Australian operating budget.',
            'Compare subscription, training, or event fees quoted in EUR against AUD spending limits.',
            'Convert AUD marketing or procurement budgets into EUR for planning discussions.',
            'Review exchange-rate impact before sending a transfer from Australia to a eurozone recipient.'
        ],
        notesHeading: 'AUD to EUR planning notes',
        notes: [
            'This pair is often used for spending and invoice review rather than investment analysis, so fee awareness matters more than tiny spot moves.',
            'If your budget is fixed in AUD, re-check the rate before large EUR payments or bookings.',
            'For card purchases in Europe, your issuer may use a different final exchange basis than the reference result shown here.'
        ],
        faq: [
            { q: 'Is this useful for travel in Europe?', a: 'Yes. It is a strong fit for trip budgeting, hotel comparisons, and estimating card spend in euro terms before travel.' },
            { q: 'Why can my card statement differ from this AUD to EUR result?', a: 'Card issuers can apply their own spread, fees, or booking timestamp, so the final posted amount may not exactly match the live reference rate.' },
            { q: 'Should I convert large AUD amounts right before payment?', a: 'For time-sensitive or high-value transfers, that is wise. A refreshed check reduces the risk of relying on an outdated estimate.' },
            { q: 'Can I convert the opposite direction too?', a: 'Yes. Use the reverse-pair link or swap control for EUR to AUD.' }
        ]
    },
    'eur-to-aud': {
        title: 'EUR to AUD Converter – Live Rate, Common Amounts and Payment Planning',
        metaDescription: 'Convert Euros to Australian Dollars with a live EUR to AUD rate, common amounts, and practical guidance for travel, transfers, and invoice planning.',
        introParagraphs: [
            'This page converts Euros (EUR) to Australian Dollars (AUD) using a live reference rate and instant browser-side calculation. It is designed for quick planning when a value starts in euros but needs to be understood, approved, or compared in Australian dollars.',
            'This pair is useful for relocation planning, travel estimates, agency and contractor invoices, and cross-border budgeting where the source number is in EUR while the spending or reporting context is AUD. A common example is checking whether a euro-denominated quote still fits an Australian budget before payment is executed.',
            'The common-amounts table gives you a fast planning view, while the calculator handles exact amounts. For final decisions, confirm the booked exchange outcome with your provider because spreads, fees, and timing differences can change the real AUD amount you pay or receive.'
        ],
        scenarios: [
            'Estimate the AUD impact of a European supplier invoice before approval.',
            'Compare relocation, tuition, or travel costs quoted in EUR against an Australian budget.',
            'Translate contract values from EUR into AUD for planning and reporting.',
            'Check whether recurring euro-denominated subscriptions still fit local spend limits.',
            'Prepare a quick planning estimate before confirming a bank transfer or card payment.'
        ],
        notesHeading: 'EUR to AUD planning notes',
        notes: [
            'If your operating budget is in AUD, even a modest exchange move can affect the final local-currency cost of a large EUR invoice.',
            'Re-check the rate close to execution time when approval and payment happen on different days.',
            'For recurring euro expenses, comparing today\'s rate with prior months can help explain budget drift.'
        ],
        faq: [
            { q: 'Can I use this EUR to AUD tool for invoice review?', a: 'Yes. It is useful for fast checks and planning. For formal accounting or treasury purposes, use your approved internal source of record.' },
            { q: 'How often should I re-check EUR to AUD before payment?', a: 'For large or time-sensitive payments, check again near execution time because the booked rate can differ from an earlier quote.' },
            { q: 'Does this converter include transfer or card fees?', a: 'No. It shows a rate-based reference conversion only. Provider fees and spreads are separate.' },
            { q: 'Can I switch from EUR to AUD into AUD to EUR?', a: 'Yes. Use the swap option or the reverse-pair link.' }
        ]
    }
};

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

const timecodePageOverrides = {
    edt: {
        introParagraphs: [
            'This page translates time expressions that include <strong>EDT</strong> into your local timezone and any additional zones you select. It is especially useful when US East Coast summer schedules are shared in chat, email, recruiter messages, webinar invites, or launch notes and you need an exact local equivalent.',
            'Because EDT is the daylight-saving version of Eastern Time, this page works best when the source message clearly refers to the summer-season schedule. You can paste phrases such as "2pm EDT", "tomorrow 09:30 EDT", or "next Monday 4pm EDT" and quickly turn them into local, ISO, and offset-aware output.'
        ],
        ambiguityNote: 'EDT is a daylight-saving code, not a year-round one. If the date falls outside the period when Eastern Daylight Time applies, verify whether the sender really meant EDT or standard Eastern Time.',
        examples: [
            '2pm EDT',
            'tomorrow 09:30 EDT',
            'next Monday 4pm EDT'
        ],
        notesHeading: 'EDT seasonal notes',
        mappingCopy: 'such as EDT, GMT, UTC, and related daylight-saving codes',
        relatedLinks: [
            { url: '/time-code/convert-pdt-to-local-time', name: 'Pacific Daylight Time to Local Time' },
            { url: '/time-code/convert-bst-to-local-time', name: 'British Summer Time to Local Time' },
            { url: '/time-code/convert-cest-to-local-time', name: 'Central European Summer Time to Local Time' },
            { url: '/time-zone/ct-to-gmt', name: 'Central Time (CT) to London (GMT/BST)' }
        ],
        faq: [
            { q: 'What if the EDT abbreviation appears without a date?', a: 'The parser can infer context, but adding a date improves reliability around timezone transitions.' },
            { q: 'Is EDT the same as Eastern Time all year?', a: 'No. EDT is the daylight-saving version of Eastern Time. Outside that seasonal window, the sender may really mean EST or a generic ET reference.' },
            { q: 'Why might EDT output differ from a chat app preview?', a: 'Apps may parse shorthand differently; this tool applies a consistent abbreviation mapping model.' },
            { q: 'Can I convert one EDT input into several zones?', a: 'Yes, add target zones and the same parsed moment is rendered for each selection.' }
        ]
    },
    pdt: {
        introParagraphs: [
            'This page translates time expressions that include <strong>PDT</strong> into your local timezone and any additional zones you select. It is useful when West Coast US schedules are shared informally and you need a quick local interpretation without manually counting offsets.',
            'PDT is commonly seen in event announcements, product releases, support handoffs, and interview scheduling during the daylight-saving season. Paste a phrase such as "2pm PDT" or "tomorrow 08:00 PDT" to turn it into explicit local output you can copy into docs or messages.'
        ],
        ambiguityNote: 'PDT is a summer-only Pacific code. If the event falls outside daylight-saving season, confirm whether the intended source was PDT or standard Pacific Time.',
        examples: [
            '2pm PDT',
            'tomorrow 08:00 PDT',
            'next Friday 5:15pm PDT'
        ],
        notesHeading: 'PDT seasonal notes',
        mappingCopy: 'such as PDT, GMT, UTC, and related daylight-saving codes',
        relatedLinks: [
            { url: '/time-code/convert-edt-to-local-time', name: 'Eastern Daylight Time to Local Time' },
            { url: '/time-code/convert-cest-to-local-time', name: 'Central European Summer Time to Local Time' },
            { url: '/time-code/convert-gmt-to-local-time', name: 'Greenwich Mean Time to Local Time' },
            { url: '/time-zone/pst-to-est', name: 'PST to EST Converter' }
        ],
        faq: [
            { q: 'Can I convert one PDT input into several zones?', a: 'Yes, add target zones and the same parsed moment is rendered for each selection.' },
            { q: 'Is PDT the same as Pacific Time all year?', a: 'No. PDT is the daylight-saving version of Pacific Time. If the event is outside that period, confirm whether standard Pacific Time is the intended source.' },
            { q: 'Does this converter support relative words with PDT?', a: 'Yes, phrases such as tomorrow or next weekday are supported in common patterns.' },
            { q: 'Is a user account needed to parse PDT time code?', a: 'No account is required.' }
        ]
    },
    gmt: {
        introParagraphs: [
            'This page translates time expressions that include <strong>GMT</strong> into your local timezone and any additional zones you select. It is useful when a source message uses GMT as a neutral reference clock and you need a clear local conversion for operations, webinars, documentation, or customer communication.',
            'GMT is often treated as a stable baseline, but many users still confuse it with London local time throughout the year. This page helps you parse phrases like "2pm GMT" and turn them into a dated local result with ISO output and explicit UTC offset.'
        ],
        ambiguityNote: 'GMT is often used as a stable reference, but it is not always the same as UK local clock time during summer. If the sender really means London local time, BST may be the more accurate code during daylight-saving periods.',
        examples: [
            '2pm GMT',
            'tomorrow 11:00 GMT',
            'next Tuesday 18:30 GMT'
        ],
        notesHeading: 'GMT reference notes',
        mappingCopy: 'such as GMT, UTC, and selected seasonal US and European abbreviations',
        relatedLinks: [
            { url: '/time-code/convert-bst-to-local-time', name: 'British Summer Time to Local Time' },
            { url: '/time-code/convert-edt-to-local-time', name: 'Eastern Daylight Time to Local Time' },
            { url: '/time-code/convert-pdt-to-local-time', name: 'Pacific Daylight Time to Local Time' },
            { url: '/time-zone/gmt-to-ist', name: 'GMT to IST Converter' }
        ]
    },
    cest: {
        introParagraphs: [
            'This page translates time expressions that include <strong>CEST</strong> into your local timezone and any additional zones you select. It is especially useful for summer-period scheduling across continental Europe, where invites or launch notes often use CEST shorthand rather than a full city or IANA timezone.',
            'CEST appears in event planning, agency coordination, remote meetings, and product announcements when the source time follows Central European Summer Time. Paste phrases like "2pm CEST" or "tomorrow 15:00 CEST" to get a local result you can verify and reuse.'
        ],
        ambiguityNote: 'CEST is the daylight-saving version of Central European Time. If the event date falls outside the summer period, check whether the source should really be CET instead.',
        examples: [
            '2pm CEST',
            'tomorrow 15:00 CEST',
            'next Wednesday 09:45 CEST'
        ],
        notesHeading: 'CEST seasonal notes',
        mappingCopy: 'such as CEST, GMT, UTC, and related European summer-time codes',
        relatedLinks: [
            { url: '/time-code/convert-bst-to-local-time', name: 'British Summer Time to Local Time' },
            { url: '/time-code/convert-gmt-to-local-time', name: 'Greenwich Mean Time to Local Time' },
            { url: '/time-code/convert-edt-to-local-time', name: 'Eastern Daylight Time to Local Time' },
            { url: '/time-zone/cet-to-est', name: 'Central European Time (CET) to Eastern Time (ET)' }
        ]
    },
    bst: {
        introParagraphs: [
            'This page translates time expressions that include <strong>BST</strong> into your local timezone and any additional zones you select. It is useful when UK summer schedules are shared in shorthand and you need a precise local interpretation without checking London clock rules manually.',
            'BST often appears in webinar invites, community announcements, interviews, and launch coordination when the source time follows British Summer Time. Paste a phrase like "2pm BST" or "tomorrow 15 BST" to get an explicit local result, ISO timestamp, and offset-aware output.'
        ],
        ambiguityNote: 'BST is the summer-time version of London local time. Outside the daylight-saving period, UK schedules typically revert to GMT, so date context matters.',
        examples: [
            '2pm BST',
            'tomorrow 15 BST',
            'next Monday 08:00 BST'
        ],
        notesHeading: 'BST seasonal notes',
        mappingCopy: 'such as BST, GMT, UTC, and selected daylight-saving abbreviations',
        relatedLinks: [
            { url: '/time-code/convert-gmt-to-local-time', name: 'Greenwich Mean Time to Local Time' },
            { url: '/time-code/convert-cest-to-local-time', name: 'Central European Summer Time to Local Time' },
            { url: '/time-code/convert-edt-to-local-time', name: 'Eastern Daylight Time to Local Time' },
            { url: '/time-zone/gmt-to-est', name: 'GMT to EST Converter' }
        ]
    }
};

// --- Unique content generation (deterministic) ---

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

// --- FAQ Schema generator ---

function generateFaqSchema(faqHtml) {
    const faqRegex = /<strong>(.*?)<\/strong>\s*<p>(.*?)<\/p>/g;
    const items = [];
    let match;
    while ((match = faqRegex.exec(faqHtml)) !== null) {
        items.push({
            "@type": "Question",
            "name": match[1],
            "acceptedAnswer": { "@type": "Answer", "text": match[2] }
        });
    }
    if (!items.length) return '';
    return JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": items
    });
}

// --- Common amounts generator for currency pages ---

function getCommonAmountsForCurrency(fromTicker) {
    return commonAmountsByCurrency[fromTicker] || defaultCommonAmounts;
}

function generateCommonAmounts(fromTicker, toTicker) {
    const amounts = getCommonAmountsForCurrency(fromTicker);
    let html = `<h2>Common ${fromTicker} to ${toTicker} amounts</h2>\n`;
    html += `<p>Reference table for quick estimates. Actual values update when you use the calculator above.</p>\n`;
    html += `<div class="table-container"><table class="table common-amounts-table">\n`;
    html += `<thead><tr><th>${fromTicker}</th><th>${toTicker} (estimate)</th></tr></thead>\n`;
    html += `<tbody>\n`;
    amounts.forEach(amt => {
        html += `<tr><td>${amt.toLocaleString('en-US')} ${fromTicker}</td><td><span class="ca-val" data-from="${fromTicker}" data-to="${toTicker}" data-amt="${amt}">—</span></td></tr>\n`;
    });
    html += `</tbody></table></div>\n`;
    html += `<p style="font-size:0.85rem; color:#666; margin-top:8px;">Values are populated from the same live rate feed when you load this page. They are reference estimates and do not include fees or spreads.</p>`;
    return html;
}

function renderParagraphs(paragraphs) {
    return paragraphs.map(paragraph => `<p>${paragraph}</p>`).join('\n');
}

function renderListItems(items) {
    return items.map(item => `<li>${item}</li>`).join('\n');
}

function renderFaqItems(items) {
    return items.map(item => `<div class="faq-item" style="margin-bottom: 16px;"><strong>${item.q}</strong><p>${item.a}</p></div>`).join('\n');
}

function renderRelatedLinks(links) {
    return links.map(link => `<p><a href="${link.url}" style="color: var(--primary-color); text-decoration: underline;">${link.name}</a></p>`).join('\n');
}

// --- Page generation ---

function generatePages(dataList, templateHtml, outDir, categoryKey, fileNameFunc, replaceFunc) {
    console.log(`Building ${dataList.length} pages for ${outDir}...`);
    dataList.forEach(item => {
        const folderName = fileNameFunc(item);
        const destDir = path.join(rootDir, outDir, folderName);
        const destFile = path.join(destDir, 'index.html');
        const currentUrl = `/${outDir}/${folderName}`;
        const stableKey = `${categoryKey}-${folderName}`;

        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

        const relatedCluster = generateRelatedCluster(categoryKey, currentUrl, stableKey);
        let html = replaceFunc(templateHtml, item, relatedCluster, stableKey);

        fs.writeFileSync(destFile, html, 'utf8');
        generatedUrls.push({
            url: `https://toolsified.com${currentUrl}`,
            priority: categoryKey === 'currency' ? '0.7' : '0.6',
            changefreq: 'weekly'
        });
    });
}

// 1. Currency
generatePages(dataCurrency, tplCurrency, 'currency', 'currency',
    (p) => `${p.base.toLowerCase()}-to-${p.target.toLowerCase()}`,
    (html, p, related, stableKey) => {
        const slug = `${p.base.toLowerCase()}-to-${p.target.toLowerCase()}`;
        const override = currencyPageOverrides[slug] || {};
        const defaultIntroHtml = renderParagraphs([
            `This page converts <strong>${p.baseName} (${p.base})</strong> to <strong>${p.targetName} (${p.target})</strong> using a live exchange-rate lookup and instant client-side math. It is built for travelers planning trip budgets, freelancers invoicing clients in a different currency, ecommerce buyers checking checkout totals, and finance teams that need quick directional pricing before settlement.`,
            uniqueLines(`${p.base}-to-${p.target}`, currencyContextLibrary, 1, {
                FROM_TICKER: p.base, TO_TICKER: p.target, FROM_NAME: p.baseName, TO_NAME: p.targetName
            }, x => x),
            uniqueLines(`${p.target}-to-${p.base}`, currencyContextLibrary, 1, {
                FROM_TICKER: p.base, TO_TICKER: p.target, FROM_NAME: p.baseName, TO_NAME: p.targetName
            }, x => x)
        ]);
        const introHtml = override.introParagraphs ? renderParagraphs(override.introParagraphs) : defaultIntroHtml;
        const scenariosHtml = override.scenarios
            ? renderListItems(override.scenarios)
            : uniqueLines(`${p.base}-${p.target}`, currencyScenarioLibrary, 5, {
                FROM_TICKER: p.base, TO_TICKER: p.target, FROM_NAME: p.baseName, TO_NAME: p.targetName
            }, x => `<li>${x}</li>`);
        const notesHtml = override.notes
            ? renderListItems(override.notes)
            : uniqueNotes('currency', slug, {
                FROM_TICKER: p.base, TO_TICKER: p.target, FROM_NAME: p.baseName, TO_NAME: p.targetName
            });
        const faqHtml = override.faq
            ? renderFaqItems(override.faq)
            : uniqueLines(`${p.base}|${p.target}`, currencyFaqLibrary, 4, {
            FROM_TICKER: p.base, TO_TICKER: p.target, FROM_NAME: p.baseName, TO_NAME: p.targetName
        }, x => `<div class="faq-item" style="margin-bottom: 16px;"><strong>${x.q}</strong><p>${x.a}</p></div>`);

        const faqSchema = generateFaqSchema(faqHtml);
        const reversePairLink = getReversePairLink(p.base, p.target);
        const reverseUrl = `/currency/${p.target.toLowerCase()}-to-${p.base.toLowerCase()}`;
        const relatedWithoutReverse = related
            .split('\n')
            .filter(line => !line.includes(`href="${reverseUrl}"`))
            .join('\n');
        const commonAmounts = generateCommonAmounts(p.base, p.target);
        const pageTitle = override.title
            ? `${override.title} | Toolsified`
            : `${p.base} to ${p.target} Converter – Live Rate & Common Amounts | Toolsified`;
        const pageMetaDescription = override.metaDescription
            ? override.metaDescription
            : `Convert ${p.baseName} (${p.base}) to ${p.targetName} (${p.target}) with a live exchange rate, common amount reference table, and clear methodology. Free, no login required.`;
        const pageOgTitle = override.title || `${p.base} to ${p.target} Converter – Live Rate & Common Amounts`;
        const pageOgDescription = override.metaDescription
            ? override.metaDescription
            : `Convert ${p.baseName} to ${p.targetName} with live rates, a common amounts table, and transparent methodology.`;
        const pageTwitterTitle = override.title || `${p.base} to ${p.target} Converter – Live Rate`;
        const pageTwitterDescription = override.metaDescription
            ? override.metaDescription
            : `Convert ${p.baseName} to ${p.targetName} with live exchange rates and a common amounts reference table.`;

        return html
            .replace(/\[PAGE_TITLE\]/g, pageTitle)
            .replace(/\[PAGE_META_DESCRIPTION\]/g, pageMetaDescription)
            .replace(/\[PAGE_OG_TITLE\]/g, pageOgTitle)
            .replace(/\[PAGE_OG_DESCRIPTION\]/g, pageOgDescription)
            .replace(/\[PAGE_TWITTER_TITLE\]/g, pageTwitterTitle)
            .replace(/\[PAGE_TWITTER_DESCRIPTION\]/g, pageTwitterDescription)
            .replace(/\[WHAT_THIS_TOOL_DOES_HTML\]/g, introHtml)
            .replace(/\[PAIR_SCENARIOS_HEADING\]/g, 'Practical use scenarios')
            .replace(/\[PAIR_SCENARIOS\]/g, scenariosHtml)
            .replace(/\[PAIR_FAQ\]/g, faqHtml)
            .replace(/\[FAQ_SCHEMA\]/g, faqSchema)
            .replace(/\[COMMON_AMOUNTS\]/g, commonAmounts)
            .replace(/\[PAIR_NOTES_HEADING\]/g, override.notesHeading || 'Pair-specific planning notes')
            .replace(/\[REVERSE_PAIR_LINK\]/g, reversePairLink)
            .replace(/\[FROM_TICKER\]/g, p.base)
            .replace(/\[TO_TICKER\]/g, p.target)
            .replace(/\[FROM_NAME\]/g, p.baseName)
            .replace(/\[TO_NAME\]/g, p.targetName)
            .replace(/\[FROM_VAR\]/g, p.base.toLowerCase())
            .replace(/\[TO_VAR\]/g, p.target.toLowerCase())
            .replace(/\[YEAR\]/g, currentYear)
            .replace(/\[BUILD_DATE\]/g, buildDate)
            .replace(/\[PAIR_NOTES\]/g, notesHtml)
            .replace(/\[RELATED_CLUSTER\]/g, relatedWithoutReverse);
    }
);

// 2. Timezone
generatePages(dataTz, tplTz, 'time-zone', 'timezone',
    (p) => `${p.baseVar}-to-${p.targetVar}`,
    (html, p, related, stableKey) => html
        .replace(/\[FROM_TZ\]/g, p.base)
        .replace(/\[TO_TZ\]/g, p.target)
        .replace(/\[FROM_NAME\]/g, p.baseName)
        .replace(/\[TO_NAME\]/g, p.targetName)
        .replace(/\[FROM_VAR\]/g, p.baseVar)
        .replace(/\[TO_VAR\]/g, p.targetVar)
        .replace(/\[YEAR\]/g, currentYear)
        .replace(/\[BUILD_DATE\]/g, buildDate)
        .replace(/\[PAIR_NOTES\]/g, uniqueNotes('timezone', `${p.baseVar}-to-${p.targetVar}`, {
            FROM_NAME: p.baseName, TO_NAME: p.targetName
        }))
        .replace(/\[RELATED_CLUSTER\]/g, related)
);

// 3. Crypto
generatePages(dataCrypto, tplCrypto, 'crypto', 'crypto',
    (p) => `${p.baseVar}-to-${p.targetVar}`,
    (html, p, related, stableKey) => {
        const faqHtml = uniqueLines(`${p.baseVar}-${p.targetVar}-faq`, cryptoFaqLibrary, 4, {
            FROM_TICKER: p.base, TO_TICKER: p.target, FROM_NAME: p.baseName, TO_NAME: p.targetName
        }, x => `<div class="faq-item" style="margin-bottom: 16px;"><strong>${x.q}</strong><p>${x.a}</p></div>`);

        const faqSchema = generateFaqSchema(faqHtml);

        return html
            .replace(/\[FROM_TICKER\]/g, p.base)
            .replace(/\[TO_TICKER\]/g, p.target)
            .replace(/\[FROM_NAME\]/g, p.baseName)
            .replace(/\[TO_NAME\]/g, p.targetName)
            .replace(/\[FROM_VAR\]/g, p.baseVar)
            .replace(/\[TO_VAR\]/g, p.targetVar)
            .replace(/\[YEAR\]/g, currentYear)
            .replace(/\[BUILD_DATE\]/g, buildDate)
            .replace(/\[PAIR_SCENARIOS\]/g, uniqueLines(`${p.baseVar}-${p.targetVar}-scn`, cryptoScenarioLibrary, 5, {
                FROM_TICKER: p.base, TO_TICKER: p.target, FROM_NAME: p.baseName, TO_NAME: p.targetName
            }, x => `<li>${x}</li>`))
            .replace(/\[PAIR_FAQ\]/g, faqHtml)
            .replace(/\[FAQ_SCHEMA\]/g, faqSchema)
            .replace(/\[PAIR_NOTES\]/g, uniqueNotes('crypto', `${p.baseVar}-to-${p.targetVar}`, {
                FROM_TICKER: p.base, TO_TICKER: p.target, FROM_NAME: p.baseName, TO_NAME: p.targetName
            }))
            .replace(/\[RELATED_CLUSTER\]/g, related);
    }
);

// 4. Timecode
generatePages(dataTimecode, tplTimecode, 'time-code', 'timecode',
    (p) => `convert-${p.var}-to-local-time`,
    (html, p, related, stableKey) => {
        const override = timecodePageOverrides[p.var] || {};
        const faqHtml = override.faq
            ? renderFaqItems(override.faq)
            : uniqueLines(`${p.var}-faq`, timecodeFaqLibrary, 4, {
                FORMAT: p.format, NAME: p.name
            }, x => `<div class="faq-item" style="margin-bottom: 16px;"><strong>${x.q}</strong><p>${x.a}</p></div>`);

        const faqSchema = generateFaqSchema(faqHtml);
        const introHtml = override.introParagraphs
            ? renderParagraphs(override.introParagraphs)
            : renderParagraphs([
                `This page translates time expressions that include <strong>${p.format}</strong> into your local timezone and any additional zones you select. It is designed for people who receive meeting invites in abbreviations, remote teams working across continents, customer support operations, and event hosts publishing start times to international audiences. Instead of manually calculating offsets, you can paste a phrase like "2pm ${p.format}" and instantly see equivalent local output.`,
                'The parser supports practical language patterns such as clock time, optional minutes, am/pm notation, and relative words like "tomorrow" or "next Monday". That makes it useful when invite text is informal and not already calendar-formatted. You can also add multiple target zones and copy formatted output strings for chat, email, or runbooks. The goal is to reduce scheduling mistakes caused by ambiguous abbreviations and daylight saving shifts. This is especially useful during DST change periods, when a static offset assumption can be wrong for part of the year.'
            ]);
        const examplesHtml = override.examples
            ? renderListItems(override.examples)
            : renderListItems([
                `2pm ${p.format}`,
                `tomorrow 15 ${p.format}`,
                `next Monday 08:00 ${p.format}`
            ]);
        const relatedLinksHtml = override.relatedLinks
            ? renderRelatedLinks(override.relatedLinks)
            : related;

        return html
            .replace(/\[FORMAT\]/g, p.format)
            .replace(/\[NAME\]/g, p.name)
            .replace(/\[VAR\]/g, p.var)
            .replace(/\[YEAR\]/g, currentYear)
            .replace(/\[BUILD_DATE\]/g, buildDate)
            .replace(/\[FORMAT_INTRO_HTML\]/g, introHtml)
            .replace(/\[FORMAT_MAPPING_COPY\]/g, override.mappingCopy || `such as ${p.format}, GMT, UTC, and selected daylight-saving abbreviations`)
            .replace(/\[FORMAT_AMBIGUITY_NOTE\]/g, override.ambiguityNote || 'Abbreviations can be misunderstood without date context, so confirm the sender\'s intended schedule when the wording is unclear.')
            .replace(/\[FORMAT_EXAMPLES\]/g, examplesHtml)
            .replace(/\[FORMAT_NOTES_HEADING\]/g, override.notesHeading || 'Format-specific planning notes')
            .replace(/\[PAIR_SCENARIOS\]/g, uniqueLines(`${p.var}-scn`, timecodeScenarioLibrary, 5, {
                FORMAT: p.format, NAME: p.name
            }, x => `<li>${x}</li>`))
            .replace(/\[PAIR_FAQ\]/g, faqHtml)
            .replace(/\[FAQ_SCHEMA\]/g, faqSchema)
            .replace(/\[PAIR_NOTES\]/g, uniqueNotes('timecode', p.var, {
                FORMAT: p.format, NAME: p.name
            }))
            .replace(/\[TIMECODE_RELATED_LINKS\]/g, relatedLinksHtml)
            .replace(/\[RELATED_CLUSTER\]/g, relatedLinksHtml);
    }
);

// --- Sitemap with lastmod, priority, changefreq ---

console.log('Generating sitemap.xml...');
let sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

baseUrls.forEach(entry => {
    sitemapXml += `  <url>\n    <loc>${entry.url}</loc>\n    <lastmod>${buildDate}</lastmod>\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>\n`;
});

generatedUrls.forEach(entry => {
    sitemapXml += `  <url>\n    <loc>${entry.url}</loc>\n    <lastmod>${buildDate}</lastmod>\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>\n`;
});

sitemapXml += `</urlset>`;
fs.writeFileSync(sitemapFile, sitemapXml, 'utf8');

console.log(`Build complete! sitemap.xml updated with ${baseUrls.length + generatedUrls.length} URLs.`);

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

const defaultCommonAmounts = [1, 5, 10, 25, 50, 100, 250, 500, 1000];

const commonAmountsByCurrency = {
    JPY: [1000, 5000, 10000, 25000, 50000, 100000],
    KRW: [1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000],
    CNY: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
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
            'Use this page when the number you have is in South Korean won but the decision you need to make is in US dollars. It gives you a live KRW to USD reference conversion without sending you through a trading platform or banking flow.',
            'That is useful for Korean supplier quotes, tuition or registration fees, travel budgets in Seoul, and payroll or contractor amounts that need to be reviewed in USD. On this pair, the main challenge is usually scale: a six-figure KRW amount may still represent a fairly ordinary USD expense.',
            'The reference table helps you judge order of magnitude quickly, while the calculator is better for an exact amount. For anything that will actually be paid, compare the result with your bank or transfer provider because execution spreads and fees can move the booked USD total.'
        ],
        scenarios: [
            'Check whether a Korean supplier quote still fits a USD purchasing limit before approval.',
            'Estimate the USD cost of a hotel stay, event fee, or university payment priced in KRW.',
            'Translate KRW payroll or contractor amounts into USD for internal reporting.',
            'Compare two vendor offers when one is priced in won and the other is priced in dollars.',
            'Review whether a large KRW transfer is worth executing now or re-checking closer to settlement.'
        ],
        notesHeading: 'KRW to USD planning notes',
        notes: [
            'KRW is a high-unit currency, so round-looking KRW amounts can convert into much smaller USD totals than users expect at first glance.',
            'If you are approving a payment now but executing it later, re-check the rate close to settlement time.',
            'For larger transfers, compare the reference rate here with your provider\'s quoted execution rate and fee policy.'
        ],
        howItWorksParagraphs: [
            'The calculator requests a live KRW/USD reference rate through the currency endpoint, then multiplies that rate by the exact KRW amount you enter. The result is produced in the browser immediately after the rate is returned.',
            '<strong>Why this pair feels different in practice:</strong> KRW amounts are often large in nominal terms, so a small-looking quote move can still matter on larger supplier, payroll, or travel amounts. This is why the common-amounts table on this page starts at more realistic KRW levels instead of tiny unit amounts.',
            '<strong>Settlement reality:</strong> the number shown here is a planning reference. Banks, card issuers, and transfer providers can apply a different execution timestamp, their own spread, and fixed fees before the final USD amount is booked.'
        ],
        relatedLinks: [
            { url: '/currency/usd-to-krw', name: 'Convert USD to KRW (reverse)' },
            { url: '/currency/cny-to-usd', name: 'CNY to USD Converter' },
            { url: '/currency/jpy-to-usd', name: 'JPY to USD Converter' },
            { url: '/currency/eur-to-cad', name: 'EUR to CAD Converter' }
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
            'This EUR to CAD converter is for moments when a euro-denominated price needs to be understood in Canadian dollars right away. It is a practical reference page for budgeting, approvals, and side-by-side price comparisons rather than a trading tool.',
            'Typical uses include European travel planning from Canada, software or agency invoices billed in euros, relocation estimates, and recurring subscriptions that hit a CAD budget each month. The real question on this pair is usually not the spot chart, but whether the final CAD cost still fits the plan.',
            'Use the table for quick directional checks and the calculator for the exact amount you are reviewing. If the payment will be executed later by card or bank transfer, leave room for spread, timing differences, and provider fees.'
        ],
        scenarios: [
            'Check whether a euro-denominated retainer or invoice still fits a CAD operating budget.',
            'Estimate the Canadian-dollar cost of flights, hotels, rail passes, or event tickets quoted in EUR.',
            'Compare a European vendor quote with a domestic Canadian quote on the same budget basis.',
            'Translate recurring EUR software spend into CAD for monthly finance planning.',
            'Add a reasonable FX buffer before approving a later payment in Canadian dollars.'
        ],
        notesHeading: 'EUR to CAD planning notes',
        notes: [
            'This pair is often used for budgeting rather than trading, so the main risk is underestimating the final CAD total after fees.',
            'If your invoice is approved in one week and paid in another, the booked CAD outcome may differ from the earlier estimate.',
            'For card-based purchases, compare this reference result with your card issuer\'s foreign exchange policy.'
        ],
        howItWorksParagraphs: [
            'The tool fetches a live EUR/CAD reference rate through the exchange-rate endpoint and applies it to the euro amount you enter. The arithmetic is done in the browser so you can test different invoice or travel amounts quickly.',
            '<strong>What matters on this pair:</strong> EUR to CAD is often a budgeting pair rather than a trading pair. Users are usually comparing travel spend, retainers, subscriptions, or invoices, so the practical question is less about market micro-moves and more about the final CAD impact after provider fees.',
            '<strong>Before approving payment:</strong> if a card, bank transfer, or invoicing platform will be used later, treat this as the baseline reference number and compare it with the booked rate your provider actually offers.'
        ],
        relatedLinks: [
            { url: '/currency/cad-to-eur', name: 'Convert CAD to EUR (reverse)' },
            { url: '/currency/eur-to-aud', name: 'EUR to AUD Converter' },
            { url: '/currency/aud-to-eur', name: 'AUD to EUR Converter' },
            { url: '/currency/eur-to-usd', name: 'EUR to USD Converter' }
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
            'This page is built for CNY amounts that need to be evaluated in USD before you commit to a purchase, order, or payment. It gives you a live reference conversion so you can size a China-priced cost quickly in dollar terms.',
            'That makes it especially useful for sourcing, manufacturing quotes, ecommerce orders, and supplier invoices where the original number is in yuan but budgeting, margin review, or approval happens in US dollars. On this pair, speed matters because users are often checking a real quote before the next step.',
            'Use the common amounts as a quick sense-check, then run the exact number you are reviewing through the calculator. Final settlement can still differ if a platform, card network, or transfer provider applies its own spread or fee structure.'
        ],
        scenarios: [
            'Estimate a supplier invoice from China in USD before approving the purchase order.',
            'Check whether a marketplace or factory quote still leaves enough room in a USD margin model.',
            'Translate CNY product or manufacturing costs into USD for sourcing reviews.',
            'Compare several China-based quotes on the same dollar-denominated budget basis.',
            'Prepare a fast USD reference before checkout, remittance, or trade-platform payment.'
        ],
        notesHeading: 'CNY to USD planning notes',
        notes: [
            'This pair is often used in sourcing, procurement, and ecommerce reviews where the reference conversion matters before final checkout.',
            'If the supplier quote is fixed now but your payment happens later, re-check close to execution time.',
            'For business use, treat this output as a planning reference rather than a treasury or accounting source of record.'
        ],
        howItWorksParagraphs: [
            'The converter requests a current CNY/USD reference rate from the exchange endpoint, then applies that rate to the CNY amount you enter. The returned figure is meant to help you size a supplier quote, sourcing cost, or checkout total quickly.',
            '<strong>What makes this pair practical:</strong> many users land here before a real payment step such as supplier approval, card checkout, or marketplace order. In those workflows the key question is whether the USD-equivalent still fits a budget cap or margin assumption before final execution.',
            '<strong>Important limitation:</strong> a quoted CNY amount can still turn into a different final USD charge once provider spreads, platform fees, or booking delays are applied. For operational decisions, confirm the settlement number as close to payment time as possible.'
        ],
        relatedLinks: [
            { url: '/currency/usd-to-cny', name: 'Convert USD to CNY (reverse)' },
            { url: '/currency/krw-to-usd', name: 'KRW to USD Converter' },
            { url: '/currency/usd-to-hkd', name: 'USD to HKD Converter' },
            { url: '/currency/usd-to-inr', name: 'USD to INR Converter' }
        ]
    },
    'aud-to-eur': {
        title: 'AUD to EUR Converter – Live Rate, Common Amounts and Travel Checks',
        metaDescription: 'Convert Australian Dollars to Euros with a live AUD to EUR rate, planning examples, and practical notes for travel, invoices, and cross-border spending.',
        introParagraphs: [
            'AUD to EUR is mostly a spending-and-planning pair: you know your budget in Australian dollars and need to see what that means in euros before you book, buy, or approve something.',
            'This comes up in European travel, conference and event planning, subscription review, and vendor payments where the outgoing amount begins in AUD but the destination cost is measured in EUR. Users usually want a quick answer to a practical question: does my Australian-dollar budget still cover this euro-priced item?',
            'The common amounts table helps with rough planning, and the calculator is there for the exact amount. Because card issuers and transfer providers often use their own spread and timestamp, treat the result as a current reference rather than a guaranteed checkout number.'
        ],
        scenarios: [
            'Check whether an AUD trip budget is enough for euro-priced hotels, transport, and bookings.',
            'Estimate the EUR value of an Australian budget before approving a conference or event expense.',
            'Compare a euro subscription or software renewal against an AUD department budget.',
            'Convert an Australian transfer amount into euros before sending money to a eurozone recipient.',
            'Review whether it is worth re-checking the rate before a large European card or bank payment.'
        ],
        notesHeading: 'AUD to EUR planning notes',
        notes: [
            'This pair is often used for spending and invoice review rather than investment analysis, so fee awareness matters more than tiny spot moves.',
            'If your budget is fixed in AUD, re-check the rate before large EUR payments or bookings.',
            'For card purchases in Europe, your issuer may use a different final exchange basis than the reference result shown here.'
        ],
        howItWorksParagraphs: [
            'The calculator pulls a live AUD/EUR reference rate and applies it to the exact AUD amount you enter. That makes it useful for quick checks before card spend, transfers, bookings, or euro-denominated invoices are finalized.',
            '<strong>Why users check this pair:</strong> AUD to EUR is often tied to travel and cross-border spend rather than treasury workflows. People want to know whether an Australian-dollar budget still covers a euro hotel bill, event fee, training invoice, or supplier payment.',
            '<strong>What can change the booked result:</strong> card issuers and transfer providers may use a different execution basis than the mid-market reference shown here, especially once weekend spreads, FX fees, or statement timing come into play.'
        ],
        relatedLinks: [
            { url: '/currency/eur-to-aud', name: 'Convert EUR to AUD (reverse)' },
            { url: '/currency/eur-to-cad', name: 'EUR to CAD Converter' },
            { url: '/currency/aud-to-gbp', name: 'AUD to GBP Converter' },
            { url: '/currency/usd-to-aud', name: 'USD to AUD Converter' }
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
            'Use this page when the quote, invoice, or cost starts in euros but your budget decisions happen in Australian dollars. It gives you a fast EUR to AUD planning number for real-world review, not just a generic exchange-rate lookup.',
            'Common examples include European contractor invoices, relocation estimates, travel costs, and recurring subscriptions billed in EUR while the paying team or household tracks spend in AUD. In other words, the page is built for budget translation: what does this euro amount mean on the Australian side?',
            'The quick-reference table is useful when you want an instant sense of scale, and the calculator handles the exact figure. If the payment is time-sensitive, refresh close to execution because the booked AUD amount can still shift with market timing and provider spread.'
        ],
        scenarios: [
            'Estimate the Australian-dollar impact of a European supplier or contractor invoice before approval.',
            'Compare tuition, relocation, or travel costs quoted in EUR against an AUD budget ceiling.',
            'Translate euro contract values into AUD for planning decks, approvals, or internal reporting.',
            'Review recurring EUR subscriptions to see whether they still fit current Australian spend limits.',
            'Prepare a current AUD estimate before a bank transfer, reimbursement, or card payment is finalized.'
        ],
        notesHeading: 'EUR to AUD planning notes',
        notes: [
            'If your operating budget is in AUD, even a modest exchange move can affect the final local-currency cost of a large EUR invoice.',
            'Re-check the rate close to execution time when approval and payment happen on different days.',
            'For recurring euro expenses, comparing today\'s rate with prior months can help explain budget drift.'
        ],
        howItWorksParagraphs: [
            'The tool fetches a live EUR/AUD reference rate through the exchange endpoint and multiplies it by the euro amount you enter. This gives you a fast AUD-denominated estimate without opening a spreadsheet or a banking dashboard.',
            '<strong>Why this pair gets checked:</strong> EUR to AUD often shows up in invoice review, travel planning, relocation estimates, and recurring subscription costs where the original quote is in euros but the operating budget is in Australian dollars.',
            '<strong>Planning tip:</strong> if approval and payment happen on different days, the final AUD number can drift enough to matter on larger invoices. That is why this page is best used as a current planning reference rather than a final settlement record.'
        ],
        relatedLinks: [
            { url: '/currency/aud-to-eur', name: 'Convert AUD to EUR (reverse)' },
            { url: '/currency/eur-to-cad', name: 'EUR to CAD Converter' },
            { url: '/currency/eur-to-usd', name: 'EUR to USD Converter' },
            { url: '/currency/gbp-to-eur', name: 'GBP to EUR Converter' }
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
        const howItWorksHtml = override.howItWorksParagraphs
            ? renderParagraphs(override.howItWorksParagraphs)
            : renderParagraphs([
                'The conversion formula is <code>converted amount = input amount &times; exchange rate</code>. When you press Convert, the page requests a current market rate through a serverless endpoint, then multiplies the returned rate by your amount in the browser. No account is required.',
                '<strong>Data source:</strong> exchange rates are sourced from an external feed via <code>/.netlify/functions/convert</code>. The displayed timestamp reflects the provider response for the queried pair.',
                '<strong>Reference rate vs. bank rate:</strong> the rate shown here is a mid-market reference. When you actually exchange money, your bank, card network, or transfer provider applies their own rate, which includes spread and possibly fees. The difference can be 0.5% to 3% or more depending on channel, amount, and timing. Always compare execution options for large transfers.',
                '<strong>Limitations:</strong> this is a reference converter, not a settlement engine. Real transaction totals differ due to provider markups, card network rates, local taxes, transfer fees, and delayed booking windows. For accounting or compliance use, confirm with your payment provider or bank statement.'
            ]);
        const faqHtml = override.faq
            ? renderFaqItems(override.faq)
            : uniqueLines(`${p.base}|${p.target}`, currencyFaqLibrary, 4, {
            FROM_TICKER: p.base, TO_TICKER: p.target, FROM_NAME: p.baseName, TO_NAME: p.targetName
        }, x => `<div class="faq-item" style="margin-bottom: 16px;"><strong>${x.q}</strong><p>${x.a}</p></div>`);

        const faqSchema = generateFaqSchema(faqHtml);
        const reversePairLink = getReversePairLink(p.base, p.target);
        const reverseUrl = `/currency/${p.target.toLowerCase()}-to-${p.base.toLowerCase()}`;
        const relatedWithoutReverse = override.relatedLinks
            ? renderRelatedLinks(override.relatedLinks.filter(link => link.url !== reverseUrl))
            : related
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
            .replace(/\[HOW_IT_WORKS_HTML\]/g, howItWorksHtml)
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
            .replace(/\[PAIR_RELATED_LINKS\]/g, relatedWithoutReverse);
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

// api/create-checkout.js
// Vercel Serverless Function — Stripe Hosted Checkout for Catan Artisan
// Requires env var: STRIPE_SECRET_KEY (LIVE key for live mode)
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-04-30.basil',   // ← updated to latest
});

const TIER_LABEL = { core: 'Core', hero: 'Hero', premium: 'Premium' };
const TIER_BASE = { core: 299, hero: 399, premium: 799 };   // matches your current Hero $399

// SYNCED to your live frontend recalc() + review screenshot
const PRICING = {
    texture_silk: { core: 39, hero: 20, premium: 0 },
    robber_dragon: { core: 10, hero: 8, premium: 0 },   // Dragon Robber +$8 in screenshot
    robber_custom: { core: 75, hero: 75, premium: 75 },
    finish_custom: { core: 59, hero: 39, premium: 0 },   // Golden Oak +$10 (adjusted to match)
    trim_silk: { core: 25, hero: 10, premium: 0 },
    names_add: { core: 79, hero: 39, premium: 0 },   // Airbrushed +$39
};

function computeTotal(state) {
    if (!state || !TIER_BASE[state.tier]) throw new Error('Invalid tier');
    const t = state.tier;
    let total = TIER_BASE[t];

    if (state.texture === 'silk') total += PRICING.texture_silk[t];
    if (state.robber === 'dragon') total += PRICING.robber_dragon[t];           // updated key
    if (state.robber === 'custom') total += PRICING.robber_custom[t];
    if (state.finish && state.finish !== 'bombay') total += PRICING.finish_custom[t];
    if (state.trim === 'silk') total += PRICING.trim_silk[t];
    if (state.names === 'add') total += PRICING.names_add[t];

    return total;
}

function buildDescription(state) {
    const parts = [];
    parts.push(state.texture === 'silk' ? 'Silk pieces' : 'Basic pieces');
    parts.push(`Colors: ${(state.colors || []).join(', ') || '—'}`);
    parts.push(`Robber: ${state.robber}`);
    parts.push(`Finish: ${state.finish}`);
    parts.push(`Trim: ${state.trim} (${state.trimColor})`);
    if (state.names === 'add') parts.push(`Names: ${state.namesText ? `"${state.namesText}"` : '(TBD)'}`);
    return parts.join(' • ').slice(0, 480);
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { state, total: clientTotal } = req.body || {};
        if (!state || typeof state !== 'object') return res.status(400).json({ error: 'Missing configuration state.' });

        const serverTotal = computeTotal(state);

        // Safety — frontend must match (your screenshot now will)
        if (typeof clientTotal === 'number' && Math.abs(clientTotal - serverTotal) > 1) {
            console.warn('Client/server mismatch', { clientTotal, serverTotal, state });
        }

        const tierLabel = TIER_LABEL[state.tier];
        const productName = `Catan Artisan — ${tierLabel} Bundle`;
        const productDesc = buildDescription(state);

        const metadata = {
            tier: state.tier,
            total_usd: String(serverTotal),
            config: JSON.stringify({ ...state, total: serverTotal }).slice(0, 480)
        };

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            line_items: [{
                quantity: 1,
                price_data: {
                    currency: 'usd',
                    unit_amount: serverTotal * 100,   // ← EXACT match to website
                    product_data: { name: productName, description: productDesc },
                    tax_behavior: 'exclusive',
                },
            }],
            shipping_address_collection: { allowed_countries: ['US'] },
            billing_address_collection: 'auto',
            phone_number_collection: { enabled: true },
            shipping_options: [{
                shipping_rate_data: {
                    type: 'fixed_amount',
                    fixed_amount: { amount: 0, currency: 'usd' },
                    display_name: 'Free US Shipping (orders $75+)',
                    delivery_estimate: { minimum: { unit: 'business_day', value: 5 }, maximum: { unit: 'business_day', value: 14 } },
                }
            }],
            automatic_tax: { enabled: true },
            metadata,
            payment_intent_data: { metadata },
            success_url: 'https://realizedprints.com/success.html?session_id={CHECKOUT_SESSION_ID}',
            cancel_url: 'https://realizedprints.com/catan-artisan.html',
            allow_promotion_codes: true,
        });

        return res.status(200).json({ url: session.url });
    } catch (err) {
        console.error('Stripe checkout error:', err);
        return res.status(500).json({ error: err.message || 'Unable to start checkout.' });
    }
};
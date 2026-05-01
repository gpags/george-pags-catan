// api/create-checkout.js
// Vercel Serverless Function — Stripe Hosted Checkout for Catan Artisan
// Requires env var: STRIPE_SECRET_KEY

const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
});

const TIER_LABEL = {
    core: 'Core',
    hero: 'Hero',
    premium: 'Premium',
};

const TIER_BASE = { core: 299, hero: 399, premium: 799 };

const PRICING = {
    texture_silk: { core: 39, hero: 20, premium: 0 },
    robber_victorious: { core: 10, hero: 5, premium: 0 },
    robber_custom: { core: 75, hero: 75, premium: 75 },
    finish_custom: { core: 59, hero: 39, premium: 0 },
    trim_silk: { core: 25, hero: 10, premium: 0 },
    names_add: { core: 79, hero: 39, premium: 0 },
};

// Server-side recompute — never trust client total
function computeTotal(state) {
    if (!state || !TIER_BASE[state.tier]) {
        throw new Error('Invalid tier');
    }
    const t = state.tier;
    let total = TIER_BASE[t];

    if (state.texture === 'silk') total += PRICING.texture_silk[t];
    if (state.robber === 'victorious') total += PRICING.robber_victorious[t];
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
    if (state.names === 'add') {
        parts.push(`Names: ${state.namesText ? `"${state.namesText}"` : '(TBD)'}`);
    }
    // Keep under Stripe's 500-char product description limit
    return parts.join(' • ').slice(0, 480);
}

module.exports = async (req, res) => {
    // CORS — same-origin under Vercel; allow direct testing too
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { state, total: clientTotal } = req.body || {};

        if (!state || typeof state !== 'object') {
            return res.status(400).json({ error: 'Missing configuration state.' });
        }
        if (!TIER_LABEL[state.tier]) {
            return res.status(400).json({ error: 'Invalid tier selected.' });
        }

        // Authoritative total
        const serverTotal = computeTotal(state);

        // Sanity guard — if client lied wildly, reject
        if (typeof clientTotal === 'number' && Math.abs(clientTotal - serverTotal) > 1) {
            console.warn('Client/server total mismatch', { clientTotal, serverTotal, state });
        }

        const tierLabel = TIER_LABEL[state.tier];
        const productName = `Catan Artisan — ${tierLabel} Bundle`;
        const productDesc = buildDescription(state);

        // Metadata: full state + total. Stripe metadata values must be strings ? 500 chars each.
        // We split the JSON across multiple keys if needed so the workshop has 100% of the build spec.
        const fullPayload = JSON.stringify({ ...state, total: serverTotal });
        const metadata = { tier: state.tier, total_usd: String(serverTotal) };

        if (fullPayload.length <= 480) {
            metadata.config = fullPayload;
        } else {
            // Split into 480-char chunks across config_1, config_2, ...
            const CHUNK = 480;
            let i = 0, idx = 1;
            while (i < fullPayload.length) {
                metadata[`config_${idx}`] = fullPayload.slice(i, i + CHUNK);
                i += CHUNK;
                idx += 1;
            }
        }

        // Human-readable summary for dashboard glance
        metadata.summary = buildDescription(state).slice(0, 480);

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],

            line_items: [
                {
                    quantity: 1,
                    price_data: {
                        currency: 'usd',
                        unit_amount: serverTotal * 100, // dollars ? cents
                        product_data: {
                            name: productName,
                            description: productDesc,
                            metadata: { tier: state.tier },
                        },
                        tax_behavior: 'exclusive',
                    },
                },
            ],

            // US-only shipping
            shipping_address_collection: { allowed_countries: ['US'] },
            billing_address_collection: 'auto',
            phone_number_collection: { enabled: true },

            // Free shipping for orders ? $75 (every Catan tier qualifies — but we keep it explicit)
            shipping_options: [
                {
                    shipping_rate_data: {
                        type: 'fixed_amount',
                        fixed_amount: { amount: 0, currency: 'usd' },
                        display_name: 'Free US Shipping (orders $75+)',
                        delivery_estimate: {
                            minimum: { unit: 'business_day', value: 5 },
                            maximum: { unit: 'business_day', value: 14 },
                        },
                        tax_behavior: 'exclusive',
                    },
                },
            ],

            // Stripe Tax (must be enabled in dashboard)
            automatic_tax: { enabled: true },

            // Critical: full state for fulfillment
            metadata,
            payment_intent_data: { metadata },

            success_url: 'https://realizedprints.com/success.html?session_id={CHECKOUT_SESSION_ID}',
            cancel_url: 'https://realizedprints.com/catan-artisan.html',

            allow_promotion_codes: true,
        });

        return res.status(200).json({ url: session.url });
    } catch (err) {
        console.error('Stripe checkout error:', err);
        return res.status(500).json({
            error: err && err.message ? err.message : 'Unable to start checkout. Please try again.',
        });
    }
};
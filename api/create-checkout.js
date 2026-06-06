// api/create-checkout.js
// Vercel Serverless Function � Stripe Hosted Checkout for Catan Artisan
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

const TIER_BASE = { core: 299, hero: 399, premium: 599 };

const PRICING = {
    texture_silk: { core: 39, hero: 20, premium: 0 },
    robber_victorious: { core: 10, hero: 5, premium: 0 },
    robber_dragon: { core: 15, hero: 8, premium: 0 },
    robber_custom: { core: 75, hero: 75, premium: 75 },
    finish_custom: { core: 20, hero: 10, premium: 0 },
    trim_silk: { core: 25, hero: 10, premium: 0 },
    names_add: { core: 39, hero: 19, premium: 0 },
};

// Server-side recompute � never trust client total
function computeTotal(state) {
    if (!state || !TIER_BASE[state.tier]) {
        throw new Error('Invalid tier');
    }
    const t = state.tier;
    let total = TIER_BASE[t];

    if (state.texture === 'silk') total += PRICING.texture_silk[t];
    if (state.robber === 'victorious') total += PRICING.robber_victorious[t];
    if (state.robber === 'dragon') total += PRICING.robber_dragon[t];
    if (state.robber === 'custom') total += PRICING.robber_custom[t];
    if (state.finish && state.finish !== 'bombay') total += PRICING.finish_custom[t];
    if (state.trim === 'silk') total += PRICING.trim_silk[t];
    if (state.names === 'add') total += PRICING.names_add[t];

    return total;
}

function buildDescription(state) {
    const parts = [];
    parts.push(state.texture === 'silk' ? 'Silk pieces' : 'Basic pieces');
    parts.push(`Colors: ${(state.colors || []).join(', ') || '�'}`);
    parts.push(`Robber: ${state.robber}`);
    parts.push(`Finish: ${state.finish}`);
    parts.push(`Trim: ${state.trim} (${state.trimColor})`);
    if (state.names === 'add') {
        parts.push(`Names: ${state.namesText ? `"${state.namesText}"` : '(TBD)'}`);
    }
    // Keep under Stripe's 500-char product description limit
    return parts.join(' � ').slice(0, 480);
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { state, total: clientTotal } = req.body || {};

        // === JUNE 2026 STOCK LIMIT CHECK ===
        const now = new Date();
        const isJune2026 = now.getMonth() === 5 && now.getFullYear() === 2026;

        if (isJune2026) {
            // Check if they're using the free winner code
            const isWinner = state.robber === 'custom' && state.namesText?.toLowerCase().includes('winner');
            // Better way: we'll check the promotion code later if needed

            if (!isWinner) {
                // Call your Google Apps Script to get current paid count
                const countRes = await fetch('https://script.google.com/macros/s/AKfycbwXxOFOEL9VFdua7Xl_AvfHmo4Ge2MafGLJASzTZG5-jTH7PxY8lUBHP7DcRjhUpEScGQ/exec', {
                    method: 'POST',
                    body: JSON.stringify({ action: 'getPaidOrderCount' })
                });
                const countData = await countRes.json();

                if (countData.count >= 9) {
                    return res.status(400).json({
                        error: 'SOLD_OUT',
                        message: 'We have reached our limit of 9 paid sets for June.'
                    });
                }
            }
        }

        // ... rest of your existing code (computeTotal, buildDescription, metadata, etc.)

        const session = await stripe.checkout.sessions.create({
            // your existing session creation code...
            allow_promotion_codes: true,
        });

        // After successful checkout, record the order (you can do this in a webhook later)
        // For now we can record it here if you want immediate counting

        return res.status(200).json({ url: session.url });

    } catch (err) {
        console.error('Stripe checkout error:', err);
        return res.status(500).json({ error: err.message || 'Unable to start checkout.' });
    }
};
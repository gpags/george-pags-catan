// api/checkout.js
// Vercel Serverless Function — Stripe Hosted Checkout for the Realized Prints cat shop.
// Requires env var: STRIPE_SECRET_KEY
//
// The Catan Artisan configurator has its own endpoint (api/create-checkout.js)
// and is deliberately not touched by this file — a bad deploy here cannot take
// down Catan checkout, and vice versa.
//
// SECURITY: the cart lives in localStorage and is editable in devtools. Every
// price, add-on and bundle discount below is recomputed from assets/catalog.js.
// Nothing the client sends about money is read — only handle, color, qty and
// which add-ons were ticked.

const Stripe = require('stripe');
const CATALOG = require('../assets/catalog.js');

const { BY_HANDLE, ADDONS, COLOR_LABEL, FREE_SHIP, unitsPaid } = CATALOG;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
});

const SITE = 'https://realizedprints.com';

// PHASE 3 PLACEHOLDER — one flat rate below the free-shipping threshold.
// Replace with the weight bands in LAUNCH-PLAN.md once you have real Pirate
// Ship quotes; `weightOz` and `boxClass` are already on every product for it.
const FLAT_SHIPPING_CENTS = 700;

const MAX_LINES = 50;
const MAX_QTY = 99;
const NAME_MAX = 18;   // must match the maxlength on the product page field

/* Names are engraved and echoed into Stripe metadata — strip anything that
   isn't safe to print or store, and cap it at the same length the form allows. */
function cleanName(v) {
    if (typeof v !== 'string') return '';
    return v.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, NAME_MAX);
}

/* Recompute one cart line from the catalog. Throws a customer-safe message. */
function priceLine(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('Malformed cart item.');

    const product = BY_HANDLE[raw.handle];
    if (!product) throw new Error('One of the items in your cart is no longer available.');

    const qty = Math.floor(Number(raw.qty));
    if (!(qty >= 1 && qty <= MAX_QTY)) {
        throw new Error(`Quantity for ${product.t} must be between 1 and ${MAX_QTY}.`);
    }
    if (!(product.stock > 0)) {
        throw new Error(`${product.t} is sold out — it'll be back on the next drop.`);
    }
    if (qty > product.stock) {
        throw new Error(`We only have ${product.stock} of ${product.t} left right now.`);
    }

    const color = String(raw.color || '');
    if (product.colorsAvailable.indexOf(color) === -1) {
        throw new Error(`${product.t} isn't available in that color.`);
    }

    const addons = raw.addons && typeof raw.addons === 'object' ? raw.addons : {};
    const name = cleanName(addons.name);
    const match = addons.match === true || addons.match === 'true';

    // Add-ons are charged per unit, on the units actually paid for.
    const unitCents = Math.round(
        (product.price + (name ? ADDONS.name.price : 0) + (match ? ADDONS.match.price : 0)) * 100
    );
    const paid = unitsPaid(qty, product.bundleTiers);
    const free = qty - paid;

    return {
        product, qty, color, name, match, paid, free,
        unitCents,
        amountCents: unitCents * paid,
    };
}

/* Stripe metadata values cap at 500 chars — split the order payload across
   numbered keys so a large cart doesn't silently lose its print details. */
function chunkInto(metadata, key, value) {
    const CHUNK = 480;
    if (value.length <= CHUNK) { metadata[key] = value; return; }
    for (let i = 0, idx = 1; i < value.length; i += CHUNK, idx += 1) {
        metadata[`${key}_${idx}`] = value.slice(i, i + CHUNK);
    }
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { items } = req.body || {};

        if (!Array.isArray(items) || !items.length) {
            return res.status(400).json({ error: 'Your cart is empty.' });
        }
        if (items.length > MAX_LINES) {
            return res.status(400).json({ error: 'That is too many separate items for one order — please split it.' });
        }

        let lines;
        try {
            lines = items.map(priceLine);
        } catch (e) {
            // Validation failures are the customer's problem to fix, not a 500.
            return res.status(400).json({ error: 'INVALID_CART', message: e.message });
        }

        const subtotalCents = lines.reduce((s, l) => s + l.amountCents, 0);
        if (subtotalCents <= 0) {
            return res.status(400).json({ error: 'Your cart total came to nothing — please try again.' });
        }

        const freeShipping = subtotalCents >= FREE_SHIP * 100;
        const shippingCents = freeShipping ? 0 : FLAT_SHIPPING_CENTS;

        const line_items = lines.map(l => {
            const colorLabel = COLOR_LABEL[l.color] || l.color;
            const bits = [`Qty ${l.qty}`];
            if (l.free) bits.push(`${l.free} free`);
            bits.push(`$${(l.unitCents / 100).toFixed(2)} each`);
            if (l.name) bits.push(`Engraved “${l.name}”`);
            if (l.match) bits.push('Exact pattern match — photo to follow');

            return {
                quantity: 1,   // the whole line is one priced unit; bundle maths is already applied
                price_data: {
                    currency: 'usd',
                    unit_amount: l.amountCents,
                    product_data: {
                        name: `${l.product.t} — ${colorLabel}`,
                        description: bits.join(' · ').slice(0, 480),
                        // Per-line metadata so the print queue can read a single
                        // order line without parsing the session-level blob.
                        metadata: {
                            handle: l.product.h,
                            sku: l.product.sku,
                            color: l.color,
                            qty: String(l.qty),
                            free: String(l.free),
                            name: l.name,
                            match: String(l.match),
                        },
                    },
                    tax_behavior: 'exclusive',
                },
            };
        });

        // What success.html and the print queue read back.
        const metadata = {
            shop: 'cats',
            item_count: String(lines.reduce((n, l) => n + l.qty, 0)),
            subtotal_usd: (subtotalCents / 100).toFixed(2),
            needs_photo: String(lines.some(l => l.match)),
        };
        chunkInto(metadata, 'items', JSON.stringify(lines.map(l => ({
            handle: l.product.h,
            color: l.color,
            qty: l.qty,
            name: l.name,
            match: l.match,
        }))));
        chunkInto(metadata, 'summary', lines.map(l =>
            `${l.qty}× ${l.product.t} (${COLOR_LABEL[l.color] || l.color})` +
            (l.name ? ` “${l.name}”` : '') + (l.match ? ' +match' : '')
        ).join(' | '));

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            // No payment_method_types — Stripe's dynamic payment methods then
            // offer Link, Apple Pay, Google Pay and card based on the buyer.
            line_items,
            shipping_address_collection: { allowed_countries: ['US'] },
            billing_address_collection: 'auto',
            phone_number_collection: { enabled: true },
            shipping_options: [
                {
                    shipping_rate_data: {
                        type: 'fixed_amount',
                        fixed_amount: { amount: shippingCents, currency: 'usd' },
                        display_name: freeShipping
                            ? 'Free USPS Ground Advantage'
                            : 'USPS Ground Advantage',
                        delivery_estimate: {
                            minimum: { unit: 'business_day', value: 5 },
                            maximum: { unit: 'business_day', value: 10 },
                        },
                        tax_behavior: 'exclusive',
                    },
                },
            ],
            automatic_tax: { enabled: true },
            metadata,
            payment_intent_data: { metadata },
            success_url: `${SITE}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${SITE}/#catalog`,
            allow_promotion_codes: true,
        });

        return res.status(200).json({ url: session.url });

    } catch (err) {
        console.error('Cat shop checkout error:', err);
        return res.status(500).json({
            error: 'Unable to start checkout. Please try again.',
        });
    }
};

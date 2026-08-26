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

const {
    BY_HANDLE, ADDONS, COLOR_LABEL, FREE_SHIP, priceFor, savingAt, giftsFor,
    SECOND_UNIT_OFF, secondUnitDiscount, orderProblem, needsPhoto,
} = CATALOG;

/* Explicit list, deliberately NOT Stripe's dynamic payment methods. Dynamic
   keeps re-adding buy-now-pay-later options (Klarna, Affirm, Afterpay) as
   Stripe enables them, and we don't want BNPL on made-to-order goods.
   Apple Pay and Google Pay need no entry — they ride on 'card' automatically
   once the domain is verified in Stripe.

   Shop Pay is absent because it is Shopify's wallet and cannot be offered
   through Stripe at all. 'link' is the equivalent: sign in, autofill, one tap. */
const PAYMENT_METHODS = ['card', 'link', 'amazon_pay', 'cashapp', 'us_bank_account'];

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
});

const SITE = 'https://realizedprints.com';

/* Weight-banded USPS Ground Advantage, computed before the session is made.
   Stripe Checkout cannot fetch live carrier rates mid-session, so the band is
   picked from the packed weight of the cart.

   BAND PRICES ARE STILL ESTIMATES — replace each `cents` with a real Pirate
   Ship quote for that weight in your actual boxes. The band structure is
   right; only the numbers need confirming. Product `weightOz` values are also
   placeholders (grep catalog.js for TODO). */
const PACKAGING_OZ = 2;          // mailer/box + filler
const SHIPPING_BANDS = [
    { maxOz: 8,        cents: 500,  label: 'USPS Ground Advantage' },
    { maxOz: 16,       cents: 700,  label: 'USPS Ground Advantage' },
    { maxOz: 48,       cents: 1000, label: 'USPS Ground Advantage' },
    { maxOz: Infinity, cents: 1400, label: 'USPS Ground Advantage' },
];

function shippingFor(lines, gifts) {
    let oz = PACKAGING_OZ;
    for (const l of lines) oz += (l.product.weightOz || 0) * l.qty;
    /* Gifts go in the same parcel and still weigh something. */
    for (const g of gifts) oz += (BY_HANDLE[g.handle] || {}).weightOz || 0;
    const band = SHIPPING_BANDS.find(b => oz <= b.maxOz);
    return { oz, cents: band.cents, label: band.label };
}

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

    /* Bundle price comes from the catalog's explicit ladder. Add-ons are
       charged on every unit — the nameplate is ADDONS.name at price 0, so
       this is currently always zero and is kept so a future paid add-on
       still prices correctly. */
    const addonsPerUnit = name ? ADDONS.name.price : 0;
    const bundleCents = Math.round(priceFor(product, qty) * 100);
    const addonCents = Math.round(addonsPerUnit * 100) * qty;
    const savedCents = Math.round(savingAt(product, qty) * 100);

    return {
        product, qty, color, name,
        savedCents,
        unitCents: Math.round((bundleCents + addonCents) / qty),
        amountCents: bundleCents + addonCents,
    };
}

/* ================================================================
   Apply the order-level 40%-off-the-second-scratcher discount.

   Stripe will not take a negative line item, and creating a coupon on
   the fly is an extra API call that can fail after the cart has already
   been priced. So the discount is subtracted from the scratcher lines
   themselves, split across them in proportion to how many scratcher
   units each line holds.

   The remainder from the split lands on the last scratcher line, so the
   cents always add up to exactly what catalog.js said they would.
   ================================================================ */
function applySecondUnitDiscount(lines) {
    const offCents = Math.round(
        secondUnitDiscount(lines.map(l => ({ handle: l.product.h, qty: l.qty }))) * 100
    );
    if (offCents <= 0) return 0;

    const scratchers = lines.filter(l => l.product.v === 'scratcher');
    const totalUnits = scratchers.reduce((n, l) => n + l.qty, 0);
    if (!totalUnits) return 0;

    let handed = 0;
    scratchers.forEach((l, i) => {
        const share = i === scratchers.length - 1
            ? offCents - handed
            : Math.floor(offCents * l.qty / totalUnits);
        handed += share;
        l.discountCents = share;
        l.amountCents -= share;
        l.savedCents += share;
        l.unitCents = Math.round(l.amountCents / l.qty);
    });
    return offCents;
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

        /* Cart-shape rules the catalog owns — currently "a keychain only
           ships with a scratcher". Checked in the drawer too, but that check
           runs in localStorage-land and is editable in devtools. */
        const problem = orderProblem(items.map(i => ({ handle: i.handle, qty: Number(i.qty) })));
        if (problem) {
            return res.status(400).json({ error: 'INVALID_CART', message: problem });
        }

        const discountCents = applySecondUnitDiscount(lines);

        const subtotalCents = lines.reduce((s, l) => s + l.amountCents, 0);
        if (subtotalCents <= 0) {
            return res.status(400).json({ error: 'Your cart total came to nothing — please try again.' });
        }

        /* Gifts are decided here, never taken from the request — the client
           could otherwise ask for a free keychain on a $5 order. */
        const gifts = giftsFor(subtotalCents / 100);

        const freeShipping = subtotalCents >= FREE_SHIP * 100;
        const ship = shippingFor(lines, gifts);
        const shippingCents = freeShipping ? 0 : ship.cents;

        const line_items = lines.map(l => {
            const colorLabel = COLOR_LABEL[l.color] || l.color;
            const bits = [`Qty ${l.qty}`];
            bits.push(`$${(l.unitCents / 100).toFixed(2)} each`);
            if (l.savedCents) bits.push(`saving $${(l.savedCents / 100).toFixed(2)}`);
            if (l.discountCents) bits.push(`${Math.round(SECOND_UNIT_OFF * 100)}% off the second`);
            if (l.name) bits.push(`Nameplate “${l.name}”`);

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
                            saved: (l.savedCents / 100).toFixed(2),
                            name: l.name,
                        },
                    },
                    tax_behavior: 'exclusive',
                },
            };
        });

        /* Gifts ride along as $0 line items so they appear on the Stripe
           receipt and in the print queue, and the customer can see exactly
           what they earned. */
        for (const g of gifts) {
            const gp = BY_HANDLE[g.handle];
            if (!gp) continue;
            line_items.push({
                quantity: 1,
                price_data: {
                    currency: 'usd',
                    unit_amount: 0,
                    product_data: {
                        name: `FREE GIFT: ${gp.t} — ${COLOR_LABEL[g.color] || g.color}`,
                        description: `Free on orders over $${g.minSpend}`,
                        metadata: {
                            handle: gp.h, sku: gp.sku, color: g.color,
                            qty: '1', free: '1', gift: 'true', name: ''
                        },
                    },
                    tax_behavior: 'exclusive',
                },
            });
        }

        // What success.html and the print queue read back.
        const metadata = {
            shop: 'cats',
            item_count: String(lines.reduce((n, l) => n + l.qty, 0)),
            subtotal_usd: (subtotalCents / 100).toFixed(2),
            second_unit_off_usd: (discountCents / 100).toFixed(2),
            /* Every scratcher and every keychain is drawn from a photo of the
               customer's cat, so almost every order needs one. api/upload-photo.js
               refuses an upload unless this is 'true' — it used to be set from the
               deleted "exact pattern match" add-on, which would have silently
               switched the whole photo flow off. */
            needs_photo: String(needsPhoto(lines.map(l => ({ handle: l.product.h, qty: l.qty })))),
            gifts: gifts.map(g => g.handle).join(',') || 'none',
            /* Packed weight, so a label can be bought without re-weighing. */
            packed_oz: String(ship.oz),
            shipping_usd: (shippingCents / 100).toFixed(2),
        };
        chunkInto(metadata, 'items', JSON.stringify(
            lines.map(l => ({
                handle: l.product.h,
                color: l.color,
                qty: l.qty,
                name: l.name,
            })).concat(gifts.map(g => ({
                handle: g.handle, color: g.color, qty: 1, name: '', gift: true
            })))
        ));
        chunkInto(metadata, 'summary', lines.map(l =>
            `${l.qty}× ${l.product.t} (${COLOR_LABEL[l.color] || l.color})` +
            (l.name ? ` “${l.name}”` : '')
        ).join(' | '));

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: PAYMENT_METHODS,
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
                            : ship.label,
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
            /* The cat shop has its own confirmation page. /success is Catan's and
               renders a Catan order summary. */
            success_url: `${SITE}/order-complete?session_id={CHECKOUT_SESSION_ID}`,
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

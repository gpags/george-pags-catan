/* ================================================================
   scripts/send-test-webhook.js

   Sends a correctly-signed, fake `checkout.session.completed` event to
   your live webhook endpoint. No money moves, no Stripe test mode, no
   Stripe CLI install.

   This exists because Stripe removed the "Send test webhook" button
   from LIVE-mode endpoints — it only appears on test-mode ones.

   Stripe authenticates webhooks with an HMAC of the raw body using the
   endpoint's signing secret. You have that secret, so you can produce a
   signature Stripe itself would consider valid. api/webhook.js can't
   tell this apart from the real thing, which is exactly the point.

   USAGE (from the project folder):

     node scripts/send-test-webhook.js whsec_YOUR_SECRET

   Optional second argument to aim somewhere else:

     node scripts/send-test-webhook.js whsec_... https://realizedprints.com/api/webhook

   Add --match to simulate an order needing a pattern-match photo.
   ================================================================ */
const crypto = require('crypto');

const secret = process.argv[2];
const url = process.argv[3] && process.argv[3].startsWith('http')
    ? process.argv[3]
    : 'https://realizedprints.com/api/webhook';
const wantsMatch = process.argv.includes('--match');

if (!secret || !secret.startsWith('whsec_')) {
    console.error(`
Missing signing secret.

  node scripts/send-test-webhook.js whsec_YOUR_SECRET [url] [--match]

Find the secret in Stripe: Developers -> Webhooks -> click your endpoint
-> "Signing secret" -> Reveal. It starts with whsec_.
`);
    process.exit(1);
}

/* A realistic cat-shop order. The shape matches what api/checkout.js
   actually writes, so this exercises the real print-list rendering
   rather than an empty stub. */
const items = [
    { handle: 'cat-clicker', color: 'orange', qty: 3, name: 'Sox', match: wantsMatch },
    { handle: 'cat-paw-keychain', color: 'orange', qty: 1, name: '', match: false, gift: true },
];

const event = {
    id: 'evt_local_test_' + Date.now(),
    object: 'event',
    type: 'checkout.session.completed',
    created: Math.floor(Date.now() / 1000),
    livemode: true,
    data: {
        object: {
            id: 'cs_live_LOCALTEST' + Date.now(),
            object: 'checkout.session',
            amount_total: 3500,
            currency: 'usd',
            payment_status: 'paid',
            customer_details: {
                email: 'webhook-test@example.com',
                name: 'Webhook Test',
                phone: '+15555550123',
            },
            shipping_details: {
                name: 'Webhook Test',
                address: {
                    line1: '60 Hickory Drive', line2: '',
                    city: 'Basking Ridge', state: 'NJ',
                    postal_code: '07920', country: 'US',
                },
            },
            metadata: {
                shop: 'cats',
                item_count: '4',
                subtotal_usd: '35.00',
                packed_oz: '9',
                shipping_usd: '7.00',
                needs_photo: String(wantsMatch),
                gifts: 'cat-paw-keychain',
                summary: '3x Cat Clicker (Orange tabby) "Sox" | 1x Cat Paw Keychain (gift)',
                items: JSON.stringify(items),
            },
        },
    },
};

const payload = JSON.stringify(event);
const timestamp = Math.floor(Date.now() / 1000);

/* Stripe's scheme: HMAC-SHA256 over "<timestamp>.<raw body>". */
const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`, 'utf8')
    .digest('hex');
const header = `t=${timestamp},v1=${signature}`;

(async () => {
    console.log(`POST ${url}`);
    console.log(`      simulating a $35.00 order${wantsMatch ? ' WITH a pattern-match photo needed' : ''}\n`);
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Stripe-Signature': header },
            body: payload,
        });
        const text = await res.text();
        console.log(`  HTTP ${res.status}`);
        console.log(`  ${text}\n`);

        if (res.status === 200) {
            console.log('  Endpoint accepted it. Check realizedprints@gmail.com for');
            console.log('  "New order $35.00' + (wantsMatch ? ' — PHOTO NEEDED' : '') + ' — 3x Cat Clicker...".');
            console.log('  No email? The reason is in Vercel -> Logs, filtered to /api/webhook.');
        } else if (res.status === 400) {
            console.log('  Rejected. Almost always the wrong signing secret, or the');
            console.log('  STRIPE_WEBHOOK_SECRET in Vercel does not match this one.');
        } else if (res.status === 500) {
            console.log('  Endpoint is up but errored — STRIPE_WEBHOOK_SECRET is probably');
            console.log('  not set in Vercel, or you have not redeployed since adding it.');
        } else if (res.status === 404) {
            console.log('  No function at that URL. Check the deploy actually included api/webhook.js.');
        }
    } catch (err) {
        console.error('  Could not reach the endpoint:', err && err.message);
    }
})();

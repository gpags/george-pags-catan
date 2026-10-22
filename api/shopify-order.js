// api/shopify-order.js
// Shopify "Order payment" webhook → friend rewards, once the store runs on
// Shopify. It does for Shopify orders what api/webhook.js's referralCredits()
// does for Stripe ones: if the buyer's email or phone matches a friend someone
// listed on the rewards page (Quest 2), that friend is marked converted, a
// referral_payouts row is stored (reason 'intro', $0, session_id
// "shopify:<order id>" so a retried webhook is never counted twice), and
// lib/friend-rewards.js emails the shop and the person who sent them.
//
// Setup (Shopify admin → Settings → Notifications → Webhooks):
//   Create webhook → Event "Order payment", format JSON,
//   URL https://george-pags-catan.vercel.app/api/shopify-order
//   Copy the signing secret shown on that page into Vercel as
//   SHOPIFY_WEBHOOK_SECRET, then redeploy.
//
// Env vars: SHOPIFY_WEBHOOK_SECRET, SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY,
//           RESEND_API_KEY, SHOP_EMAIL (same as the other endpoints).

const crypto = require('crypto');
const db = require('../lib/db.js');
const { normContact, normEmail } = require('../lib/referrals.js');
const { friendReward } = require('../lib/friend-rewards.js');

/* Shopify signs the RAW body. Read the request stream before anything touches
   req.body, whose getter would parse (and re-shape) the JSON. */
async function rawBody(req) {
    const chunks = [];
    if (req.readable) for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    if (chunks.length) return Buffer.concat(chunks);
    if (Buffer.isBuffer(req.body)) return req.body;
    if (typeof req.body === 'string') return Buffer.from(req.body, 'utf8');
    return Buffer.alloc(0);
}

function signedByShopify(body, header, secret) {
    if (!header || !secret) return false;
    const want = crypto.createHmac('sha256', secret).update(body).digest();
    let got;
    try { got = Buffer.from(String(header), 'base64'); } catch (_) { return false; }
    return got.length === want.length && crypto.timingSafeEqual(got, want);
}

/* Everywhere Shopify may have put the buyer's email and phone. */
function buyerOf(order) {
    const c = order.customer || {};
    const email = normEmail(order.email || order.contact_email || c.email);
    const phones = [order.phone, c.phone, (order.billing_address || {}).phone, (order.shipping_address || {}).phone]
        .map(p => normContact(p).phone).filter(Boolean);
    return { email, phones: Array.from(new Set(phones)) };
}

async function creditFriend(order) {
    const { email, phones } = buyerOf(order);
    if (!email && !phones.length) return 'no buyer email or phone';
    if (!db.enabled()) return 'database not connected';

    const ors = [email && `friend_email.eq.${db.q(email)}`]
        .concat(phones.map(p => `friend_phone.eq.${db.q(p)}`)).filter(Boolean).join(',');
    const found = await db.select('referrals', `status=eq.pending&or=(${ors})&order=created_at.asc`);
    const rows = (found.ok && found.data) || [];
    if (!rows.length) return 'not a listed friend';

    const ref = `shopify:${order.id}`;
    const now = new Date().toISOString();
    const first = rows[0];
    await db.update('referrals', `id=eq.${first.id}`, { status: 'converted', converted_session: ref, converted_at: now });
    const others = rows.slice(1).map(r => r.id);
    if (others.length) await db.update('referrals', `id=in.(${others.join(',')})`, { status: 'converted_other', converted_session: ref, converted_at: now });

    const c = {
        email: first.referrer_email, name: first.referrer_name || '', reason: 'intro', friend: first.friend_name,
        selfUse: !!email && normEmail(first.referrer_email) === email,
    };
    const ins = await db.insert('referral_payouts', [{
        referrer_email: normEmail(c.email), referrer_name: c.name, reason: 'intro', code: null,
        session_id: ref, buyer_email: email, amount_usd: 0, self_use: c.selfUse,
    }]);
    /* 409 = this order was already credited (Shopify retried the webhook). */
    if (ins.status === 409) return 'already credited';

    const items = (order.line_items || []).map(li => `${li.title}${li.quantity > 1 ? ` ×${li.quantity}` : ''}`).join(', ');
    await friendReward(c, {
        buyerEmail: email,
        buyerLabel: email || phones[0],
        ref: `${order.test ? 'TEST ' : ''}Shopify order ${order.name || order.id}${items ? ` (${items})` : ''}`,
    });
    return 'credited';
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
    if (!secret) {
        console.error('shopify-order: SHOPIFY_WEBHOOK_SECRET is not set');
        return res.status(500).json({ error: 'Webhook not configured' });
    }
    const body = await rawBody(req);
    if (!signedByShopify(body, req.headers['x-shopify-hmac-sha256'], secret)) {
        return res.status(401).json({ error: 'Bad signature' });
    }

    let order;
    try { order = JSON.parse(body.toString('utf8')); } catch (_) { return res.status(400).json({ error: 'Bad JSON' }); }

    /* Answer 200 whatever happens here: a failure must never make Shopify retry
       forever, and the order itself is already safe in Shopify. */
    try {
        const result = await creditFriend(order);
        console.log('shopify-order:', order.name || order.id, '—', result);
        return res.status(200).json({ ok: true, result });
    } catch (e) {
        console.error('shopify-order: error', e && e.message);
        return res.status(200).json({ ok: false });
    }
};
/* after the handler is assigned, or the assignment above would drop it */
module.exports.config = { api: { bodyParser: false } };

// api/webhook.js
// Stripe webhook → "you just got an order" email to the shop.
//
// Without this, a sale is invisible until someone opens the Stripe Dashboard.
//
// Required env vars:
//   STRIPE_SECRET_KEY       (already set)
//   STRIPE_WEBHOOK_SECRET   from the endpoint you create in Stripe (starts "whsec_")
//   RESEND_API_KEY          see lib/email.js
//   SHOP_EMAIL              realizedprints@gmail.com
//
// Handles cat shop orders (metadata.shop === 'cats') in full detail, and still
// sends a short alert for Catan Artisan orders so no sale goes unnoticed.

const Stripe = require('stripe');
const CATALOG = require('../assets/catalog.js');
const { sendEmail, esc, SHOP_EMAIL } = require('../lib/email.js');

const { BY_HANDLE, COLOR_LABEL } = CATALOG;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

/* Stripe signs the RAW body. Vercel parses bodies by default, which would
   destroy the signature, so parsing is turned off for this route only. */
module.exports.config = { api: { bodyParser: false } };

async function rawBody(req) {
    if (Buffer.isBuffer(req.body)) return req.body;
    if (typeof req.body === 'string') return Buffer.from(req.body, 'utf8');
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    return Buffer.concat(chunks);
}

function joinChunks(md, base) {
    if (md[base]) return md[base];
    return Object.keys(md)
        .filter(k => new RegExp('^' + base + '_\\d+$').test(k))
        .sort((a, b) => parseInt(a.split('_').pop()) - parseInt(b.split('_').pop()))
        .map(k => md[k])
        .join('');
}

function addressBlock(session) {
    const d = session.customer_details || {};
    const a = (session.shipping_details && session.shipping_details.address) || d.address || {};
    const name = (session.shipping_details && session.shipping_details.name) || d.name || '';
    const lines = [name, a.line1, a.line2,
        [a.city, a.state, a.postal_code].filter(Boolean).join(' '), a.country]
        .filter(Boolean);
    return lines.map(esc).join('<br>');
}

/* The email is the print worksheet — everything needed to make the order
   without opening the Stripe Dashboard. */
function catOrderEmail(session, md) {
    let items = [];
    try { items = JSON.parse(joinChunks(md, 'items') || '[]'); } catch (_) { }

    const rows = items.map(i => {
        const p = BY_HANDLE[i.handle];
        const bits = [];
        if (i.qty > 1) bits.push('<strong>x' + i.qty + '</strong>');
        if (i.name) bits.push('engrave “<strong>' + esc(i.name) + '</strong>”');
        if (i.match) bits.push('<strong style="color:#c62b6d">EXACT PATTERN MATCH — wait for photo</strong>');
        if (i.gift) bits.push('<em>free gift</em>');
        return `<tr>
            <td style="padding:8px 10px;border-bottom:1px solid #eee">${esc(p ? p.t : i.handle)}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #eee">${esc(COLOR_LABEL[i.color] || i.color)}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #eee">${bits.join(' · ') || '—'}</td>
        </tr>`;
    }).join('');

    const total = session.amount_total ? (session.amount_total / 100).toFixed(2) : '?';
    const needsPhoto = md.needs_photo === 'true';

    const html = `
    <div style="font-family:system-ui,sans-serif;max-width:640px">
      <h2 style="margin:0 0 4px">New order — $${esc(total)}</h2>
      <p style="margin:0 0 16px;color:#666">${esc(md.item_count || '?')} item(s) ·
         packed weight ${esc(md.packed_oz || '?')} oz · shipping $${esc(md.shipping_usd || '?')}</p>

      ${needsPhoto ? `<p style="background:#fdeaf2;color:#c62b6d;padding:12px 14px;border-radius:8px;font-weight:700">
        This order includes an Exact Pattern Match. Do not print it until the customer sends a photo.
        If nothing arrives within 7 days, print the preset colour and refund the match fee.</p>` : ''}

      <h3 style="margin:18px 0 6px">Print list</h3>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <tr style="text-align:left;background:#f6f6f8">
          <th style="padding:8px 10px">Item</th><th style="padding:8px 10px">Colour</th><th style="padding:8px 10px">Notes</th>
        </tr>
        ${rows || '<tr><td colspan="3" style="padding:10px">See Stripe for details.</td></tr>'}
      </table>

      <h3 style="margin:18px 0 6px">Ship to</h3>
      <p style="margin:0;font-size:14px;line-height:1.6">${addressBlock(session)}</p>

      <h3 style="margin:18px 0 6px">Customer</h3>
      <p style="margin:0;font-size:14px">
        ${esc((session.customer_details || {}).email || '—')}<br>
        ${esc((session.customer_details || {}).phone || '')}
      </p>

      <p style="margin:20px 0 0;color:#888;font-size:12px">Stripe session ${esc(session.id)}</p>
    </div>`;

    return {
        subject: `New order $${total}${needsPhoto ? ' — PHOTO NEEDED' : ''} — ${md.summary || 'Realized Prints'}`.slice(0, 120),
        html,
    };
}

function catanOrderEmail(session, md) {
    const total = session.amount_total ? (session.amount_total / 100).toFixed(2) : '?';
    return {
        subject: `New Catan Artisan order — $${total}`,
        html: `<div style="font-family:system-ui,sans-serif">
            <h2>New Catan Artisan order — $${esc(total)}</h2>
            <p>${esc(md.summary || '')}</p>
            <h3>Ship to</h3><p style="line-height:1.6">${addressBlock(session)}</p>
            <p>${esc((session.customer_details || {}).email || '')}</p>
            <p style="color:#888;font-size:12px">Stripe session ${esc(session.id)}</p>
        </div>`,
    };
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
        console.error('webhook: STRIPE_WEBHOOK_SECRET is not set');
        return res.status(500).json({ error: 'Webhook not configured' });
    }

    let event;
    try {
        const body = await rawBody(req);
        event = stripe.webhooks.constructEvent(body, req.headers['stripe-signature'], secret);
    } catch (err) {
        /* A parsed-away body shows up here as a signature failure, so say so. */
        console.error('webhook: signature verification failed —', err && err.message);
        return res.status(400).json({ error: 'Invalid signature' });
    }

    if (event.type !== 'checkout.session.completed') {
        return res.status(200).json({ received: true, ignored: event.type });
    }

    try {
        /* Re-fetch so the address and totals are the authoritative ones. */
        const session = await stripe.checkout.sessions.retrieve(event.data.object.id);
        const md = session.metadata || {};
        const mail = md.shop === 'cats' ? catOrderEmail(session, md) : catanOrderEmail(session, md);

        const result = await sendEmail({
            to: SHOP_EMAIL,
            subject: mail.subject,
            html: mail.html,
            replyTo: (session.customer_details || {}).email || undefined,
        });
        if (!result.sent) console.error('webhook: order email not sent —', result.reason, session.id);
    } catch (err) {
        /* Never 500 here: the payment already succeeded, and a non-200 makes
           Stripe retry for days over what is only a notification. */
        console.error('webhook: handler error', err && err.message);
    }

    return res.status(200).json({ received: true });
};

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
const db = require('../lib/db.js');
const { normContact, normEmail } = require('../lib/referrals.js');

const { BY_HANDLE, COLOR_LABEL } = CATALOG;

const SITE = process.env.SITE_URL || 'https://www.mycatscratcher.com';

/* The "this is a gift" flag and note, set from the product page. */
function giftInfo(md) {
    return { on: md.gift_order === 'true', note: joinChunks(md, 'gift_note') || '' };
}

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
        if (i.name) bits.push('names “<strong>' + esc(i.name) + '</strong>”');
        if (i.match) bits.push('<strong style="color:#c62b6d">EXACT PATTERN MATCH — wait for photo</strong>');
        if (i.gift) bits.push('<em>free gift</em>');
        if (i.free) bits.push('<strong>FREE — 2+ scratcher milestone</strong>');
        if (i.sub) bits.push('<strong>SUBSCRIPTION — repeats every 3 months</strong>');
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
        ON HOLD until the customer sends a photo of their cat(s) — it arrives as a separate
        "Cat photo received" email (upload) or as a reply to their confirmation. Do not start it before then.</p>` : ''}

      ${giftInfo(md).on ? `<div style="background:#fff6d6;color:#5a4400;padding:12px 14px;border-radius:8px;margin-top:10px">
        <strong>🎁 GIFT ORDER — no prices or receipt in the box.</strong>
        ${giftInfo(md).note ? `<br>Include this note:<br><span style="white-space:pre-wrap;font-style:italic">${esc(giftInfo(md).note)}</span>` : '<br>No note written.'}
      </div>` : ''}

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

/* Stripe's receipt proves payment. It does not say what happens next, and it
   does not ask for the pattern-match photo — which is the one thing an order
   can stall on. This does both. */
function customerEmail(session, md) {
    let items = [];
    try { items = JSON.parse(joinChunks(md, 'items') || '[]'); } catch (_) { }

    const lines = items.map(i => {
        const p = BY_HANDLE[i.handle];
        const extra = [];
        if (i.qty > 1) extra.push('qty ' + i.qty);
        if (i.name) extra.push('names “' + esc(i.name) + '”');
        if (i.free) extra.push('free with 2+ scratchers');
        if (i.sub) extra.push('delivered every 3 months — reply any time to pause or cancel');
        if (i.match) extra.push('exact pattern match');
        return `<li style="margin-bottom:6px">${i.gift ? '🎁 ' : ''}<strong>${esc(p ? p.t : i.handle)}</strong>
                — ${esc(COLOR_LABEL[i.color] || i.color)}${extra.length ? ' · ' + extra.join(' · ') : ''}
                ${i.gift ? '<em>(free gift)</em>' : ''}</li>`;
    }).join('');

    const needsPhoto = md.needs_photo === 'true';

    const html = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;color:#1a1440">
      <h2 style="margin:0 0 6px">Thank you — your cats are queued 🐾</h2>
      <p style="margin:0 0 18px;color:#555">We're a husband-and-wife print shop, so your order
      comes off our own printers. Here's what happens next.</p>

      ${needsPhoto ? `<div style="background:#fdeaf2;border:2px dashed #ff3d9a;border-radius:10px;padding:14px;margin-bottom:18px">
        <strong style="color:#c62b6d">Send us a photo of your cat</strong>
        <p style="margin:6px 0 0;font-size:14px">We paint your scratcher to match your cat, so we need
        one clear, well-lit photo of each cat.</p>
        <p style="margin:10px 0 0"><a href="${SITE}/order-complete?session_id=${encodeURIComponent(session.id)}"
           style="display:inline-block;background:#ef8a2e;color:#fff;text-decoration:none;
                  padding:11px 20px;border-radius:999px;font-weight:700">Upload your photo</a></p>
        <p style="margin:10px 0 0;font-size:14px">Or just <strong>reply to this email</strong> with it
        attached (and the names you want, for Homestead Buddies).</p>
        <p style="margin:10px 0 0;font-size:13px;color:#777">Your order is on hold until your photo
        arrives, and we start the moment it does.</p></div>` : ''}

      ${giftInfo(md).on ? `<div style="background:#fff6d6;border-radius:10px;padding:14px;margin-bottom:18px;font-size:14px">
        🎁 <strong>We'll pack this as a gift</strong> — no prices or receipt in the box${giftInfo(md).note ? ', with your note' : ''}.
      </div>` : ''}

      <h3 style="margin:0 0 6px;font-size:16px">Your order</h3>
      <ul style="margin:0 0 18px;padding-left:18px;font-size:15px">${lines || '<li>See your receipt for details.</li>'}</ul>

      <h3 style="margin:0 0 6px;font-size:16px">What happens next</h3>
      <ol style="margin:0 0 18px;padding-left:18px;font-size:15px;line-height:1.7">
        <li>We make your order in <strong>1–2 business days</strong>${needsPhoto ? ' once your photo arrives' : ''}, and email you photo and video updates as it comes together.</li>
        <li>It ships in <strong>3–5 business days</strong>. You get a tracking email as soon as the label is made.</li>
        <li>Anything at all — just reply to this email. It comes straight to the two of us.</li>
      </ol>

      <p style="font-size:13px;color:#777;margin:0">
        Order reference <strong>${esc(String(session.id).slice(-12).toUpperCase())}</strong><br>
        Made to order in the USA · returns and shipping terms at mycatscratcher.com/pages/policies
      </p>
    </div>`;

    return { subject: 'Your Cat Scratchers order is confirmed 🐾', html };
}

/* A Subscribe & Save renewal: Stripe charged the card, now pads need posting.
   The address comes from the Customer, which checkout.session.completed
   stamps below (Stripe doesn't copy it there on its own). */
async function renewalEmail(invoice) {
    let customer = {};
    try { customer = await stripe.customers.retrieve(String(invoice.customer)); } catch (_) { }
    const sh = customer.shipping || {};
    const a = sh.address || {};
    const addr = [sh.name, a.line1, a.line2, [a.city, a.state, a.postal_code].filter(Boolean).join(' ')]
        .filter(Boolean).map(esc).join('<br>');
    const lines = ((invoice.lines || {}).data || [])
        .map(l => `<li>${esc(l.description || '')}</li>`).join('');
    const total = ((invoice.amount_paid || 0) / 100).toFixed(2);
    return {
        subject: `Subscription renewal — ship refill pads to ${sh.name || customer.email || 'customer'}`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:640px">
          <h2 style="margin:0 0 6px">Subscription renewal — $${esc(total)} paid</h2>
          <p style="margin:0 0 14px;color:#666">Post these pads. Shipping on renewals is free.</p>
          <ul>${lines || '<li>See the invoice in Stripe.</li>'}</ul>
          <h3 style="margin:16px 0 6px">Ship to</h3>
          <p style="margin:0;line-height:1.6">${addr || 'No address on file — check the customer in Stripe.'}</p>
          <p style="margin:14px 0 0">${esc(customer.email || '')}</p>
          <p style="margin:18px 0 0;color:#888;font-size:12px">Invoice ${esc(invoice.id)} · subscription ${esc(String(invoice.subscription || ''))}</p>
        </div>`,
    };
}

/* ================================================================
   REFERRAL PAYOUTS — $AFF_PAY_USD owed to whoever brought this buyer in.

   Two ways an order earns one (postinginfo.html):
     code   the buyer typed someone's referral code; it is a Stripe
            promotion code made by api/program.js with metadata.program
            'referral' and the owner's email.
     intro  the buyer's email or phone matches a friend someone introduced
            (needs Supabase — lib/db.js). The earliest introducer wins, and
            only when no referral code was used — one payout per order.

   Each one emails the shop ("$10 owed to …"), stores a referral_payouts row
   (unique per order + person + reason, so a Stripe retry never doubles it),
   and emails the referrer the good news. Someone using their own code is
   flagged, not paid. Nothing here can affect the order itself.
   ================================================================ */
async function referralCredits(session) {
    const buyer = session.customer_details || {};
    const buyerEmail = normEmail(buyer.email);
    const buyerPhone = normContact(buyer.phone).phone;
    const credits = [];

    const discounts = ((session.total_details || {}).breakdown || {}).discounts || [];
    for (const d of discounts) {
        const pcId = d && d.discount && d.discount.promotion_code;
        if (!pcId) continue;
        let pc = null;
        try { pc = await stripe.promotionCodes.retrieve(String(pcId)); } catch (_) { continue; }
        const md = (pc && pc.metadata) || {};
        if (md.program !== 'referral' || !md.affiliate_email) continue;
        credits.push({
            email: md.affiliate_email, name: md.affiliate_name || '', reason: 'code', code: pc.code,
            payout: [md.payout, md.pay_to].filter(Boolean).join(' '),
            selfUse: !!buyerEmail && normEmail(md.affiliate_email) === buyerEmail,
        });
    }

    if (db.enabled() && (buyerEmail || buyerPhone)) {
        const ors = [buyerEmail && `friend_email.eq.${db.q(buyerEmail)}`, buyerPhone && `friend_phone.eq.${db.q(buyerPhone)}`]
            .filter(Boolean).join(',');
        const found = await db.select('referrals', `status=eq.pending&or=(${ors})&order=created_at.asc`);
        const rows = (found.ok && found.data) || [];
        if (rows.length) {
            const first = rows[0];
            /* One $10 per order: a typed code beats an intro, since the buyer chose it. */
            if (!credits.length) {
                credits.push({ email: first.referrer_email, name: first.referrer_name || '', reason: 'intro',
                    friend: first.friend_name, selfUse: normEmail(first.referrer_email) === buyerEmail });
            }
            const now = new Date().toISOString();
            await db.update('referrals', `id=eq.${first.id}`, { status: 'converted', converted_session: session.id, converted_at: now });
            const others = rows.slice(1).map(r => r.id);
            if (others.length) await db.update('referrals', `id=in.(${others.join(',')})`, { status: 'converted_other', converted_session: session.id, converted_at: now });
        }
    }

    for (const c of credits) {
        const ins = await db.insert('referral_payouts', [{
            referrer_email: normEmail(c.email), referrer_name: c.name, reason: c.reason, code: c.code || null,
            session_id: session.id, buyer_email: buyerEmail, amount_usd: CATALOG.AFF_PAY_USD, self_use: c.selfUse,
        }]);
        /* 409 = this order already credited this person (Stripe retried the event). */
        if (ins.status === 409) continue;

        const how = c.reason === 'code' ? `used their code <strong>${esc(c.code)}</strong>`
            : `was introduced by them${c.friend ? ` (as “${esc(c.friend)}”)` : ''}`;
        await sendEmail({
            to: SHOP_EMAIL,
            subject: (c.selfUse ? `Referral code SELF-USE — no payout — ${c.email}`
                : `$${CATALOG.AFF_PAY_USD} referral owed to ${c.name || c.email}`).slice(0, 120),
            replyTo: c.email,
            html: `<div style="font-family:system-ui,sans-serif;max-width:600px">
              <h2 style="margin:0 0 6px">${c.selfUse ? 'Own code used — do not pay' : `$${esc(CATALOG.AFF_PAY_USD)} referral owed`}</h2>
              <p>The buyer (${esc(buyerEmail || buyer.phone || 'unknown')}) ${how}.</p>
              <p><strong>Pay:</strong> ${esc(c.name)} &lt;${esc(c.email)}&gt;${c.payout ? ` — ${esc(c.payout)}` : ''}</p>
              <p style="color:#888;font-size:12px">Stripe session ${esc(session.id)}.${db.enabled() ? ' Logged in referral_payouts — tick "paid" once paid.' : ''}
              Hold until the return window closes if you like; refunded orders don't count.</p></div>`,
        });
        if (!c.selfUse) {
            await sendEmail({
                to: c.email, replyTo: SHOP_EMAIL,
                subject: `Someone you sent our way just ordered — $${CATALOG.AFF_PAY_USD} for you 🐾`,
                html: `<div style="font-family:system-ui,sans-serif;max-width:600px;color:#1f3a5c">
                  <h2 style="margin:0 0 8px">Thank you${c.name ? ', ' + esc(c.name.split(' ')[0]) : ''}!</h2>
                  <p>A friend ${c.reason === 'code' ? `used your code <strong>${esc(c.code)}</strong>` : 'you introduced'} just ordered a
                  scratcher. That's <strong>$${esc(CATALOG.AFF_PAY_USD)}</strong> added to your next payout on the 1st.</p>
                  <p style="color:#6b7f97;font-size:13px">Keep sharing — there's no limit. ${SITE.replace(/^https?:\/\//, '')}/postinginfo</p></div>`,
            });
        }
    }
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

    /* Pad subscription renewals. The first invoice (billing_reason
       'subscription_create') is the original order, already handled by
       checkout.session.completed — only later cycles need a shipment. */
    if (event.type === 'invoice.paid') {
        const invoice = event.data.object;
        if (invoice.billing_reason === 'subscription_cycle') {
            try {
                const mail = await renewalEmail(invoice);
                const r = await sendEmail({ to: SHOP_EMAIL, subject: mail.subject, html: mail.html,
                    replyTo: invoice.customer_email || undefined });
                if (!r.sent) console.error('webhook: renewal email not sent —', r.reason, invoice.id);
            } catch (err) { console.error('webhook: renewal handler error', err && err.message); }
        }
        return res.status(200).json({ received: true });
    }

    if (event.type !== 'checkout.session.completed') {
        return res.status(200).json({ received: true, ignored: event.type });
    }

    try {
        /* Re-fetch so the address and totals are the authoritative ones.
           Stripe's Dashboard "Send test webhook" button posts a SYNTHETIC event
           whose session id does not exist, so the retrieve 404s. The signature
           was already verified above, which is what proves the event really came
           from Stripe — so fall back to the event's own payload rather than
           dropping the notification and leaving the test looking broken. */
        let session = event.data.object;
        try {
            session = await stripe.checkout.sessions.retrieve(session.id, { expand: ['total_details.breakdown'] });
        } catch (e) {
            console.warn('webhook: could not re-fetch', session.id,
                '— using the event payload instead (normal for Dashboard test events):', e && e.message);
        }
        const md = session.metadata || {};

        /* Subscription orders: save the shipping address onto the Customer so
           each renewal email knows where to post the pads. */
        if (session.mode === 'subscription' && session.customer && session.shipping_details) {
            try {
                await stripe.customers.update(String(session.customer), {
                    shipping: { name: session.shipping_details.name, address: session.shipping_details.address,
                                phone: (session.customer_details || {}).phone || undefined },
                });
            } catch (e) { console.warn('webhook: could not save shipping to customer —', e && e.message); }
        }

        const mail = md.shop === 'cats' ? catOrderEmail(session, md) : catanOrderEmail(session, md);

        const result = await sendEmail({
            to: SHOP_EMAIL,
            subject: mail.subject,
            html: mail.html,
            replyTo: (session.customer_details || {}).email || undefined,
        });
        if (!result.sent) console.error('webhook: order email not sent —', result.reason, session.id);

        /* Then the customer's own confirmation. Cat shop only — Catan has its
           own flow and its own copy. */
        const buyer = (session.customer_details || {}).email;
        if (md.shop === 'cats' && buyer) {
            const c = customerEmail(session, md);
            const r2 = await sendEmail({
                to: buyer, subject: c.subject, html: c.html, replyTo: SHOP_EMAIL,
            });
            if (!r2.sent) console.error('webhook: customer email not sent —', r2.reason, session.id);
        }

        if (md.shop === 'cats') {
            try { await referralCredits(session); }
            catch (e) { console.error('webhook: referral credit error', e && e.message); }
        }
    } catch (err) {
        /* Never 500 here: the payment already succeeded, and a non-200 makes
           Stripe retry for days over what is only a notification. */
        console.error('webhook: handler error', err && err.message);
    }

    return res.status(200).json({ received: true });
};

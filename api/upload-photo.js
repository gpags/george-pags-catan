// api/upload-photo.js
// Cat-photo intake for "match my cat" orders, keyed to the Stripe session so a
// photo can never be orphaned from its order.
//
// The photo is EMAILED to the shop as an attachment (via Resend) rather than
// stored anywhere — the owner wants cat photos in the inbox, not in a bucket,
// and it means no storage service or BLOB token to configure.
//
// Required env vars (all already set for the contact form and order emails):
//   STRIPE_SECRET_KEY, RESEND_API_KEY, EMAIL_FROM, SHOP_EMAIL
//
// The browser downscales the image to ~1600px JPEG before posting, which keeps
// every upload far under Vercel's 4.5MB request limit and makes it fast on
// phone data. 1600px is plenty for matching coat colour and markings.

const Stripe = require('stripe');
const { sendEmail, esc, SHOP_EMAIL } = require('../lib/email.js');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

const MAX_BYTES = 4 * 1024 * 1024;          // after client-side downscale
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { sessionId, dataUrl } = req.body || {};

        if (!sessionId || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
            return res.status(400).json({ error: 'That link looks wrong. Please use the link from your confirmation email.' });
        }
        if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
            return res.status(400).json({ error: 'Please choose a photo file.' });
        }

        /* Only a real, paid order that actually needs a photo may upload.
           Without this the endpoint would email the shop anything anyone sent. */
        let session;
        try {
            session = await stripe.checkout.sessions.retrieve(sessionId);
        } catch (_) {
            return res.status(404).json({ error: 'We could not find that order.' });
        }
        const md = session.metadata || {};
        if (session.payment_status !== 'paid') {
            return res.status(403).json({ error: 'That order is not marked as paid yet.' });
        }
        if (md.shop !== 'cats' || md.needs_photo !== 'true') {
            return res.status(403).json({ error: 'This order doesn’t need a photo — you’re all set.' });
        }

        const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl);
        if (!m) return res.status(400).json({ error: 'We could not read that image.' });
        const [, mime, b64] = m;
        if (!ALLOWED.includes(mime)) {
            return res.status(400).json({ error: 'Please send a JPG, PNG or WEBP.' });
        }
        const bytes = Buffer.byteLength(b64, 'base64');
        if (!bytes) return res.status(400).json({ error: 'That file came through empty.' });
        if (bytes > MAX_BYTES) {
            return res.status(413).json({ error: 'That photo is too large even after resizing. Try another.' });
        }

        const ref = sessionId.slice(-12).toUpperCase();
        const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
        const buyer = (session.customer_details || {}).email || '';

        const sent = await sendEmail({
            to: SHOP_EMAIL,
            subject: `Cat photo received — order ${ref}`,
            html: `<div style="font-family:system-ui,sans-serif">
                <h2 style="margin:0 0 8px">Cat photo received 📸</h2>
                <p style="margin:0 0 12px">Order <strong>${esc(ref)}</strong> from ${esc(buyer || 'unknown')}
                   is now unblocked. The photo is attached.</p>
                <p style="margin:0;color:#555;font-size:14px">${esc(md.summary || '')}</p>
                <p style="margin:14px 0 0;color:#888;font-size:12px">Reply to this email to answer the customer.
                   Stripe session ${esc(sessionId)}</p>
            </div>`,
            replyTo: buyer || undefined,
            attachments: [{ filename: `order-${ref}-${Date.now()}.${ext}`, content: b64 }],
        });
        if (!sent.sent) {
            console.error('upload-photo: email failed —', sent.reason);
            return res.status(502).json({ error: 'We could not send that photo just now.', reason: sent.reason });
        }

        /* Best effort: stamp the payment so a reminder job (or a glance at the
           Stripe Dashboard) can tell which orders are still waiting. */
        if (session.payment_intent) {
            try {
                await stripe.paymentIntents.update(String(session.payment_intent), {
                    metadata: { photo_received: new Date().toISOString() },
                });
            } catch (e) { console.warn('upload-photo: could not stamp payment —', e && e.message); }
        }

        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error('upload-photo error:', err && err.message);
        return res.status(500).json({ error: 'We could not send that photo. Please reply to your confirmation email with it instead.' });
    }
};

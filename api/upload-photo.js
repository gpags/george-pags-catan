// api/upload-photo.js
// Exact-pattern-match photo intake, keyed to the Stripe session so a photo can
// never be orphaned from its order.
//
// Required env vars:
//   STRIPE_SECRET_KEY        (already set)
//   BLOB_READ_WRITE_TOKEN    created automatically when you add a Blob store
//                            in Vercel → Storage. Nothing to copy by hand.
//   RESEND_API_KEY / SHOP_EMAIL   so the shop gets the link immediately.
//
// The browser downscales the image to ~1600px JPEG before posting, which keeps
// every upload far under Vercel's 4.5MB request limit and makes it fast on
// phone data. 1600px is plenty for matching coat colour and markings.

const Stripe = require('stripe');
const { put } = require('@vercel/blob');
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

        /* Only a real, paid order that actually asked for a match may upload.
           Without this the endpoint is an open file host. */
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
            return res.status(403).json({ error: 'That order did not include an exact pattern match.' });
        }

        const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl);
        if (!m) return res.status(400).json({ error: 'We could not read that image.' });
        const [, mime, b64] = m;
        if (!ALLOWED.includes(mime)) {
            return res.status(400).json({ error: 'Please send a JPG, PNG or WEBP.' });
        }
        const buf = Buffer.from(b64, 'base64');
        if (!buf.length) return res.status(400).json({ error: 'That file came through empty.' });
        if (buf.length > MAX_BYTES) {
            return res.status(413).json({ error: 'That photo is too large even after resizing. Try another.' });
        }

        const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
        /* Foldered by session id so every photo for an order sits together, and
           suffixed so a customer can send more than one. */
        const blob = await put(`match-photos/${sessionId}/${Date.now()}.${ext}`, buf, {
            access: 'public',
            contentType: mime,
            addRandomSuffix: true,
        });

        /* Tell the shop straight away — this is the thing that unblocks printing. */
        const buyer = (session.customer_details || {}).email || 'unknown';
        await sendEmail({
            to: SHOP_EMAIL,
            subject: `Match photo received — ${esc(md.summary || sessionId.slice(-12).toUpperCase())}`,
            html: `<div style="font-family:system-ui,sans-serif">
                <h2 style="margin:0 0 8px">Match photo received</h2>
                <p style="margin:0 0 12px">Order <strong>${esc(sessionId.slice(-12).toUpperCase())}</strong>
                   from ${esc(buyer)} is now unblocked.</p>
                <p style="margin:0 0 12px"><a href="${esc(blob.url)}">Open the photo</a></p>
                <img src="${esc(blob.url)}" alt="" style="max-width:420px;border-radius:10px">
                <p style="margin:14px 0 0;color:#888;font-size:12px">${esc(md.summary || '')}</p>
            </div>`,
            replyTo: buyer !== 'unknown' ? buyer : undefined,
        });

        return res.status(200).json({ ok: true, url: blob.url });
    } catch (err) {
        console.error('upload-photo error:', err && err.message);
        return res.status(500).json({ error: 'We could not save that photo. Please email it to us instead.' });
    }
};

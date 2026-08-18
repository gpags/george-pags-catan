// lib/email.js
// One place that actually sends mail. Used by api/webhook.js (new-order
// alerts) and api/contact.js (customer messages).
//
// Deliberately NOT inside /api — Vercel turns every file in /api into a
// routable function, and this is a helper, not an endpoint.
//
// Uses Resend over plain fetch so there is no new npm dependency to install.
//
// Required env vars (set in Vercel → Settings → Environment Variables):
//   RESEND_API_KEY      from resend.com, starts "re_"
//   SHOP_EMAIL          where order alerts land (realizedprints@gmail.com)
//   EMAIL_FROM          verified sender, e.g. "Realized Prints <orders@realizedprints.com>"
//                       Until the domain is verified in Resend you can use
//                       "onboarding@resend.dev", which can only deliver to the
//                       address that owns the Resend account.

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

const SHOP_EMAIL = process.env.SHOP_EMAIL || 'realizedprints@gmail.com';
const EMAIL_FROM = process.env.EMAIL_FROM || 'Realized Prints <onboarding@resend.dev>';

/* Never throws. Email failing must not take down a webhook or a form post —
   the payment already succeeded and the customer is already gone. */
async function sendEmail({ to, subject, html, text, replyTo }) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
        console.error('email: RESEND_API_KEY is not set — nothing was sent. Subject was:', subject);
        return { sent: false, reason: 'missing RESEND_API_KEY' };
    }
    try {
        const res = await fetch(RESEND_ENDPOINT, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${key}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: EMAIL_FROM,
                to: Array.isArray(to) ? to : [to || SHOP_EMAIL],
                subject,
                html,
                text,
                ...(replyTo ? { reply_to: replyTo } : {}),
            }),
        });
        if (!res.ok) {
            const detail = await res.text().catch(() => '');
            console.error('email: Resend rejected the send', res.status, detail.slice(0, 400));
            return { sent: false, reason: `resend ${res.status}` };
        }
        return { sent: true };
    } catch (err) {
        console.error('email: send threw', err && err.message);
        return { sent: false, reason: 'exception' };
    }
}

const esc = v => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

module.exports = { sendEmail, esc, SHOP_EMAIL, EMAIL_FROM };

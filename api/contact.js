// api/contact.js
// Contact form → email to the shop, with Reply-To set to the customer so
// hitting reply in Gmail answers them directly.
//
// Before this, the form only opened the visitor's mail client. Anyone without
// a configured desktop mail app (i.e. most phone users) silently sent nothing.

const { sendEmail, esc, SHOP_EMAIL } = require('../lib/email.js');

const MAX = { name: 100, email: 200, order: 60, topic: 80, message: 4000 };

/* Anything not on this list is filed as "Something else" rather than
   rejected, so a stale form can never lose a customer's message.
   The <select> in build-products.js contactBody must stay in step, and so
   must the hidden topic field on the cc-custom and cc-partner forms. */
const TOPICS = [
    'Where is my order',
    'Damaged or faulty item',
    'Change or cancel an order',
    'Sending a photo of my cat',
    'Refill pads',
    'Cattoo enquiry',
    'Partner application',
    'Something else',
];

const clean = (v, max) => String(v == null ? '' : v)
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .trim()
    .slice(0, max);

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const b = req.body || {};

    /* Hidden field no human fills in. Bots do. Accept and drop silently so
       they don't learn to work around it. */
    if (clean(b.company, 50)) return res.status(200).json({ ok: true });

    const name = clean(b.name, MAX.name);
    const email = clean(b.email, MAX.email);
    const message = clean(b.message, MAX.message);
    const order = clean(b.order, MAX.order);
    const topicRaw = clean(b.topic, MAX.topic);
    const topic = TOPICS.includes(topicRaw) ? topicRaw : 'Something else';

    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Please fill in your name, email and message.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'That email address doesn’t look right.' });
    }

    const html = `
    <div style="font-family:system-ui,sans-serif;max-width:640px">
      <h2 style="margin:0 0 4px">${esc(topic)}</h2>
      <p style="margin:0 0 16px;color:#666">
        From <strong>${esc(name)}</strong> &lt;${esc(email)}&gt;${order ? ' · order ' + esc(order) : ''}
      </p>
      <div style="white-space:pre-wrap;font-size:15px;line-height:1.6;padding:14px;
                  background:#f6f6f8;border-radius:8px">${esc(message)}</div>
      <p style="margin:18px 0 0;color:#888;font-size:12px">
        Reply to this email and it goes straight back to ${esc(email)}.
      </p>
    </div>`;

    const result = await sendEmail({
        to: SHOP_EMAIL,
        subject: `[${topic}]${order ? ' ' + order : ''} — ${name}`.slice(0, 120),
        html,
        text: `${topic}\nFrom: ${name} <${email}>\n${order ? 'Order: ' + order + '\n' : ''}\n${message}`,
        replyTo: email,
    });

    if (!result.sent) {
        /* Tell the page so it can fall back to the mail client rather than
           pretending a message was delivered. */
        return res.status(502).json({ error: 'SEND_FAILED', message: 'We could not send that just now.' });
    }
    return res.status(200).json({ ok: true });
};

// api/program.js
// The posting & referral program's one endpoint. reviews.html and
// postinginfo.html post here (see CC.initProgramForms in assets/cc.js):
//
//   kind 'review'  survey answers + any friends introduced
//   kind 'join'    "Get my code" — creates a real Stripe promotion code on the
//                  spot, shows it on the page and emails it to them
//   kind 'posts'   their 5 post links + where to ship the free pads
//   kind 'intro'   friends introduced instead of posting
//   kind 'reward'  postinginfo.html's two quests (feedback + one post link)
//                  plus where to ship the free pads
//
// Every submission is emailed to the shop (same Resend setup as the contact
// form) and, when SUPABASE_* env vars are set, stored — see lib/db.js and
// supabase/schema.sql. Friends are stored one row each so api/webhook.js can
// pay the introducer when one of them later buys.
//
// Env vars: STRIPE_SECRET_KEY (already set), RESEND_API_KEY, SHOP_EMAIL,
//           SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (optional but needed
//           for intro payouts and for one-code-per-person).

const Stripe = require('stripe');
const CATALOG = require('../assets/catalog.js');
const { sendEmail, esc, SHOP_EMAIL } = require('../lib/email.js');
const db = require('../lib/db.js');
const { normContact, normEmail } = require('../lib/referrals.js');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
const SITE = process.env.SITE_URL || 'https://www.mycatscratcher.com';

const { AFF_OFF_USD, AFF_PAY_USD, POSTS_NEEDED, INTROS_NEEDED, POST_REWARD_PADS } = CATALOG;

const KINDS = {
    review: 'Customer review',
    join: 'Referral code sign-up',
    posts: 'Posts submitted',
    intro: 'Friend intros',
    reward: 'Reward claim',
};

/* The code only works on an order that has a scratcher in it: Stripe checks
   the subtotal, so the floor is the cheapest scratcher's price. */
const MIN_ORDER_CENTS = Math.round(Math.min.apply(null,
    CATALOG.PRODUCTS.filter(p => p.v === 'scratcher').map(p => p.price)) * 100);

const MAX_FIELDS = 40;
const MAX_REFS = 25;

const clean = (v, max) => String(v == null ? '' : v)
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .trim()
    .slice(0, max);

/* ---------------- Stripe: the referral coupon + one code per person ----------------
   One shared coupon ("$10 off, once") backs every person's promotion code.
   It is created the first time anyone joins, so there is nothing to set up
   by hand in the Dashboard. Change AFF_OFF_USD in catalog.js and a new coupon
   with the new amount is made automatically (the id carries the amount). */
async function referralCoupon() {
    const id = `referral-${AFF_OFF_USD}-off`;
    try {
        return (await stripe.coupons.retrieve(id)).id;
    } catch (e) {
        if (!e || e.statusCode !== 404) throw e;
    }
    try {
        return (await stripe.coupons.create({
            id, amount_off: Math.round(AFF_OFF_USD * 100), currency: 'usd', duration: 'once',
            name: `$${AFF_OFF_USD} off — friend referral`,
        })).id;
    } catch (e) {
        /* two people joining at the same moment both tried to create it */
        if (e && /already exists/i.test(e.message || '')) return id;
        throw e;
    }
}

const codeBase = (wanted, cat, name) => {
    const tidy = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    let c = tidy(wanted);
    if (c.length < 3) c = tidy(cat).slice(0, 12) + Math.round(AFF_OFF_USD);
    if (c.length < 4) c = tidy(name).slice(0, 12) + Math.round(AFF_OFF_USD);
    if (c.length < 4) c = 'FRIEND' + Math.round(AFF_OFF_USD);
    return c.slice(0, 20);
};

async function createPromoCode(base, meta) {
    const coupon = await referralCoupon();
    let code = base;
    for (let i = 0; i < 6; i++) {
        try {
            return await stripe.promotionCodes.create({
                coupon, code, metadata: meta,
                restrictions: { minimum_amount: MIN_ORDER_CENTS, minimum_amount_currency: 'usd' },
            });
        } catch (e) {
            if (!(e && /already exists|already in use|is taken/i.test(e.message || ''))) throw e;
            code = base.slice(0, 16) + Math.floor(10 + Math.random() * 90);
        }
    }
    throw new Error('no free code found');
}

/* ---------------- email bodies ---------------- */
function fieldRows(fields) {
    return fields.map(f => `<tr><td style="padding:6px 10px;color:#666;vertical-align:top;white-space:nowrap">${esc(f.label)}</td>
        <td style="padding:6px 10px;white-space:pre-wrap">${esc(f.value)}</td></tr>`).join('');
}
function refRows(refs) {
    return refs.map((r, i) => `<tr><td style="padding:6px 10px;color:#666">${i + 1}</td>
        <td style="padding:6px 10px"><strong>${esc(r.name)}</strong></td>
        <td style="padding:6px 10px">${esc(r.contact)}</td>
        <td style="padding:6px 10px;color:#444">${esc(r.note)}</td></tr>`).join('');
}

function shopEmail(kind, b, extra) {
    const refs = b.referrals;
    const pads = (kind === 'intro' || kind === 'review') && refs.length >= INTROS_NEEDED;
    const html = `
    <div style="font-family:system-ui,sans-serif;max-width:680px">
      <h2 style="margin:0 0 4px">${esc(KINDS[kind])}</h2>
      <p style="margin:0 0 14px;color:#666">From <strong>${esc(b.name)}</strong> &lt;${esc(b.email)}&gt;</p>
      ${extra || ''}
      ${kind === 'posts' ? `<p style="background:#fff6d6;padding:10px 12px;border-radius:8px">Check the ${POSTS_NEEDED} posts, then ship a free
        ${POST_REWARD_PADS}-pad pack to the address below.</p>` : ''}
      ${kind === 'reward' ? `<p style="background:#fff6d6;padding:10px 12px;border-radius:8px">Both quests done. Check the post link
        (or look for their emailed photo), then ship a free ${POST_REWARD_PADS}-pad pack to the address below.</p>` : ''}
      ${pads ? `<p style="background:#e5f4e3;padding:10px 12px;border-radius:8px"><strong>${refs.length} friends introduced — that earns
        the free ${POST_REWARD_PADS}-pad pack.</strong> Reply to ask for a shipping address if it isn't below.</p>` : ''}
      ${b.fields.length ? `<table style="border-collapse:collapse;font-size:14px;width:100%">${fieldRows(b.fields)}</table>` : ''}
      ${refs.length ? `<h3 style="margin:18px 0 6px">Friends introduced (${refs.length})</h3>
        <p style="margin:0 0 8px;color:#666;font-size:13px">Reach out once, mentioning ${esc(b.name)}. If one orders with this
        email or phone, the order email will say "$${AFF_PAY_USD} referral owed".</p>
        <table style="border-collapse:collapse;font-size:14px;width:100%">${refRows(refs)}</table>` : ''}
      <p style="margin:18px 0 0;color:#888;font-size:12px">Reply to this email to answer ${esc(b.email)} directly.${db.enabled() ? '' :
        ' (Database not connected — this email is the only copy.)'}</p>
    </div>`;
    const subject = `[${KINDS[kind]}] ${b.name}${refs.length ? ` — ${refs.length} friend${refs.length > 1 ? 's' : ''}` : ''}`;
    return { subject: subject.slice(0, 120), html };
}

function codeEmail(name, code) {
    return {
        subject: `Your Cat Scratchers referral code: ${code}`,
        html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;color:#1f3a5c">
          <h2 style="margin:0 0 8px">You're in, ${esc(name.split(' ')[0])}! 🐾</h2>
          <p style="margin:0 0 14px">Your referral code is</p>
          <p style="font-size:28px;font-weight:800;letter-spacing:.06em;margin:0 0 14px;padding:10px 16px;
                    border:2px dashed #4fa156;border-radius:10px;display:inline-block">${esc(code)}</p>
          <ul style="line-height:1.7;padding-left:18px">
            <li>Friends get <strong>$${AFF_OFF_USD} off</strong> a scratcher when they type it at checkout.</li>
            <li>You get <strong>$${AFF_PAY_USD}</strong> for every order that uses it. No limit.</li>
            <li>Finish the 2 quick quests (your feedback + one post) and we send you
                ${POST_REWARD_PADS} free refill pads.</li>
          </ul>
          <p>The quests, post ideas and captions to copy:
             <a href="${SITE}/postinginfo">${SITE.replace(/^https?:\/\//, '')}/postinginfo</a></p>
          <p style="color:#6b7f97;font-size:13px">Private account or a Story? Reply to this email with the photo, video or
             screenshot and we'll take it from there.</p>
        </div>`,
    };
}

/* ---------------- handler ---------------- */
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    let raw = req.body || {};
    if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (_) { raw = {}; } }

    /* Honeypot: accept and drop. */
    if (clean(raw.company, 50)) return res.status(200).json({ ok: true });

    const kind = clean(raw.kind, 10);
    if (!KINDS[kind]) return res.status(400).json({ error: 'Unknown form.' });

    const b = {
        name: clean(raw.name, 100),
        email: clean(raw.email, 200),
        fields: (Array.isArray(raw.fields) ? raw.fields : []).slice(0, MAX_FIELDS).map(f => ({
            key: clean(f && f.key, 40), label: clean(f && f.label, 80), value: clean(f && f.value, 3000),
        })).filter(f => f.key && f.value),
        referrals: (Array.isArray(raw.referrals) ? raw.referrals : []).slice(0, MAX_REFS).map(r => ({
            name: clean(r && r.name, 100), contact: clean(r && r.contact, 200), note: clean(r && r.note, 500),
        })).filter(r => r.name && r.contact),
    };
    const field = k => (b.fields.find(f => f.key === k) || {}).value || '';

    if (!b.name || !b.email) return res.status(400).json({ error: 'Please fill in your name and email.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) return res.status(400).json({ error: 'That email address doesn’t look right.' });
    if (kind === 'intro' && !b.referrals.length) return res.status(400).json({ error: 'Please add at least one friend.' });

    const email = normEmail(b.email);
    let code = null, codeNote = '';

    /* ---- join: one real Stripe promotion code per person ---- */
    if (kind === 'join') {
        const existing = await db.select('affiliates', `email=eq.${db.q(email)}&select=code`);
        if (existing.ok && existing.data && existing.data[0]) {
            code = existing.data[0].code;
            codeNote = `<p>Already had a code — re-sent <strong>${esc(code)}</strong>.</p>`;
        } else {
            try {
                const pc = await createPromoCode(codeBase(field('wantcode'), field('catname'), b.name), {
                    program: 'referral', affiliate_name: b.name, affiliate_email: email,
                    payout: field('payout'), pay_to: field('payto'),
                });
                code = pc.code;
                codeNote = `<p style="background:#e5f4e3;padding:10px 12px;border-radius:8px">Stripe promotion code
                    <strong>${esc(code)}</strong> created ($${AFF_OFF_USD} off, orders $${MIN_ORDER_CENTS / 100}+). Nothing to do.</p>`;
                await db.insert('affiliates', [{
                    name: b.name, email, cat_name: field('catname'), handles: field('handles'),
                    payout: field('payout'), pay_to: field('payto'), code, stripe_promo_id: pc.id,
                }]);
            } catch (e) {
                console.error('program: could not create promotion code —', e && e.message);
                codeNote = `<p style="background:#fdeaf2;color:#c62b6d;padding:10px 12px;border-radius:8px"><strong>Stripe could not
                    create a code automatically</strong> (${esc(e && e.message)}). Make one by hand in Stripe → Product catalog →
                    Coupons and email it to them.</p>`;
            }
        }
        if (code) {
            const m = codeEmail(b.name, code);
            const r = await sendEmail({ to: b.email, subject: m.subject, html: m.html, replyTo: SHOP_EMAIL });
            if (!r.sent) console.error('program: code email to member not sent —', r.reason);
        }
    }

    /* ---- store ---- */
    const stored = await db.insert('submissions', [{
        kind, name: b.name, email,
        data: { fields: b.fields, referrals: b.referrals, ...(code ? { code } : {}) },
    }]);
    if (b.referrals.length) {
        await db.insert('referrals', b.referrals.map(r => {
            const c = normContact(r.contact);
            return {
                referrer_name: b.name, referrer_email: email, friend_name: r.name, friend_contact: r.contact,
                friend_email: c.email, friend_phone: c.phone, note: r.note, source: kind,
            };
        }));
    }

    /* ---- tell the shop ---- */
    const mail = shopEmail(kind, b, codeNote);
    const sent = await sendEmail({ to: SHOP_EMAIL, subject: mail.subject, html: mail.html, replyTo: b.email });
    if (!sent.sent) console.error('program: shop email not sent —', sent.reason);

    /* Lost only if nothing at all happened with it. */
    if (!sent.sent && !stored.ok && !code) {
        return res.status(502).json({ error: 'We couldn’t send that just now. Please try again in a minute.', reason: sent.reason });
    }
    return res.status(200).json({ ok: true, ...(code ? { code } : {}) });
};

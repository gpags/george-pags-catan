// lib/friend-rewards.js
// The rewards page's Quest 2: a friend someone listed just ordered. Used by
// api/webhook.js (Stripe orders on the Vercel site) and api/shopify-order.js
// (Shopify orders after the move). Callers have already matched the buyer to a
// referrals row and stored its referral_payouts row (reason 'intro', $0).

const CATALOG = require('../assets/catalog.js');
const { sendEmail, esc, SHOP_EMAIL } = require('./email.js');
const db = require('./db.js');
const { normEmail } = require('./referrals.js');

const SITE = process.env.SITE_URL || 'https://www.mycatscratcher.com';

/* ================================================================
   FRIEND REWARDS — postinginfo.html Quest 2. A friend someone listed just
   ordered. Count that person's friend orders so far (referral_payouts rows,
   reason 'intro', not self-use) and tell the shop and them which reward
   that reaches: CATALOG.FRIEND_REWARDS, e.g. 1 → keychain, 3 → refill,
   5 → another scratcher. Rewards are sent by hand.
   ================================================================ */
async function friendReward(c, { buyerEmail, buyerLabel, ref }) {
    const rewards = CATALOG.FRIEND_REWARDS || [];
    const counted = await db.select('referral_payouts',
        `referrer_email=eq.${db.q(normEmail(c.email))}&reason=eq.intro&self_use=is.false&select=id`);
    const n = counted.ok && Array.isArray(counted.data) ? counted.data.length : 0;
    const hit = rewards.find(t => t.sales === n);
    const next = rewards.find(t => t.sales > n);
    const who = c.name || c.email;
    const buyerShown = esc(buyerLabel || buyerEmail || 'unknown');

    await sendEmail({
        to: SHOP_EMAIL,
        replyTo: c.email,
        subject: (c.selfUse ? `Friend intro SELF-ORDER — doesn't count — ${who}`
            : hit ? `Friend reward unlocked: ${hit.reward} for ${who}`
            : `Friend order #${n || '?'} for ${who}`).slice(0, 120),
        html: `<div style="font-family:system-ui,sans-serif;max-width:600px">
          <h2 style="margin:0 0 6px">${c.selfUse ? 'They ordered for themselves — not counted'
            : hit ? `Send ${esc(who)} ${esc(hit.reward)}` : `Friend order #${n || '?'} for ${esc(who)}`}</h2>
          <p>The buyer (${buyerShown}) was introduced by ${esc(who)} &lt;${esc(c.email)}&gt;${c.friend ? ` as “${esc(c.friend)}”` : ''}.</p>
          ${c.selfUse ? '' : `<p><strong>Friend orders so far:</strong> ${n || 'unknown (database not connected)'}.
            ${hit ? `That unlocks <strong>${esc(hit.reward)}</strong>. Ship it with a note.` : ''}
            ${next ? `Next reward: ${esc(next.reward)} at ${next.sales}.` : ''}</p>`}
          <p style="color:#888;font-size:12px">${esc(ref || "")}. Logged in referral_payouts (reason intro, $0).
          Refunded orders shouldn't count; hold the reward until the return window closes if you like.</p></div>`,
    });
    if (c.selfUse || !n) return;
    await sendEmail({
        to: c.email, replyTo: SHOP_EMAIL,
        subject: hit ? `You unlocked ${hit.reward}! 🐾` : `A friend you sent our way just ordered 🐾`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:600px;color:#1f3a5c">
          <h2 style="margin:0 0 8px">Thank you${c.name ? ', ' + esc(c.name.split(' ')[0]) : ''}!</h2>
          <p>A friend you told us about just ordered a scratcher. That's <strong>${n} friend${n > 1 ? 's' : ''}</strong> so far.</p>
          ${hit ? `<p>You've unlocked <strong>${esc(hit.reward)}</strong>. We'll email you when it ships.</p>` : ''}
          ${next ? `<p>Next up: <strong>${esc(next.reward)}</strong> when ${next.sales} friends have ordered.</p>` : ''}
          <p style="color:#6b7f97;font-size:13px">Know more cat parents? Add them anytime: ${SITE.replace(/^https?:\/\//, '')}/postinginfo#quest2</p></div>`,
    });
}

module.exports = { friendReward };

// lib/referrals.js
// Shared by api/program.js (storing friends people introduce) and
// api/webhook.js (matching a new order back to whoever introduced the buyer).
// Both sides must normalise contacts the same way or nothing ever matches.

/* "Jamie@Example.com " -> { email:'jamie@example.com' }
   "(555) 123-4567" / "+1 555 123 4567" -> { phone:'5551234567' } */
function normContact(raw) {
    const v = String(raw || '').trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { email: v.toLowerCase(), phone: null };
    let d = v.replace(/\D/g, '');
    if (d.length === 11 && d[0] === '1') d = d.slice(1);
    if (d.length >= 10) d = d.slice(-10);
    return { email: null, phone: d.length >= 7 ? d : null };
}

const normEmail = v => (String(v || '').trim().toLowerCase() || null);

module.exports = { normContact, normEmail };

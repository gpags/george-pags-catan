// api/get-session.js
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const sessionId = req.query.session_id;
    if (!sessionId || !/^cs_(test|live)_/.test(sessionId)) {
        return res.status(400).json({ error: 'Invalid session_id' });
    }

    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const md = session.metadata || {};

        // Reassemble JSON from chunked keys (config or config_1..N)
        let raw = md.config || '';
        if (!raw) {
            const chunks = Object.keys(md)
                .filter(k => /^config_\d+$/.test(k))
                .sort((a, b) => parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]))
                .map(k => md[k]);
            raw = chunks.join('');
        }

        let parsed = {};
        try { parsed = raw ? JSON.parse(raw) : {}; } catch (_) { }

        const total = parsed.total || Number(md.total_usd) || (session.amount_total ? session.amount_total / 100 : 0);

        return res.status(200).json({
            state: parsed,
            total,
            paid: session.payment_status === 'paid',
            email: session.customer_details?.email || null,
        });
    } catch (err) {
        console.error('get-session error:', err);
        return res.status(500).json({ error: 'Could not retrieve order' });
    }
};
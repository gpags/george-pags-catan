// lib/db.js
// Tiny Supabase client over plain fetch (PostgREST), so there is no new npm
// dependency. Used by api/program.js (reviews, posters, posts, friend intros)
// and api/webhook.js (matching orders to referrers).
//
// Required env vars (Vercel → Settings → Environment Variables):
//   SUPABASE_URL                 https://<project>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    Project Settings → API → service_role (secret!)
//
// Tables come from supabase/schema.sql — run it once in the Supabase SQL editor.
//
// Never throws. With the env vars missing every call is a no-op that returns
// { ok:false, skipped:true }, so forms still email the shop and checkout still
// works; only the "match a later order to the friend who was introduced" part
// needs the database.

const BASE = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const enabled = () => !!(BASE && KEY);

async function call(method, path, body, prefer) {
    if (!enabled()) return { ok: false, skipped: true, data: null };
    try {
        const res = await fetch(`${BASE}/rest/v1/${path}`, {
            method,
            headers: {
                apikey: KEY,
                Authorization: `Bearer ${KEY}`,
                'Content-Type': 'application/json',
                ...(prefer ? { Prefer: prefer } : {}),
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const text = await res.text();
        let data = null;
        try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
        if (!res.ok) {
            console.error('db:', method, path.split('?')[0], res.status, String(text).slice(0, 300));
            return { ok: false, status: res.status, data };
        }
        return { ok: true, data };
    } catch (err) {
        console.error('db: request threw', err && err.message);
        return { ok: false, data: null };
    }
}

const q = v => encodeURIComponent(String(v));

module.exports = {
    enabled,
    insert: (table, rows) => call('POST', table, rows, 'return=representation'),
    /* query is PostgREST syntax, e.g. "email=eq.a%40b.co&order=created_at.asc" */
    select: (table, query) => call('GET', `${table}?${query || ''}`),
    update: (table, query, patch) => call('PATCH', `${table}?${query}`, patch, 'return=representation'),
    q,
};

-- Cat Scratchers — posting & referral program tables.
-- Run once: Supabase dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run (everything is "if not exists").
--
-- Only the server (api/program.js, api/webhook.js) touches these, with the
-- service_role key. Row Level Security is ON with no policies, so the public
-- anon key can read or write nothing.

-- Every form submission, whole, as the shop saw it.
create table if not exists submissions (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  kind        text not null,            -- review | join | posts | intro | reward
  name        text,
  email       text,
  data        jsonb not null default '{}'::jsonb
);

-- People with a referral code (the "Get my code" form).
create table if not exists affiliates (
  id               bigserial primary key,
  created_at       timestamptz not null default now(),
  name             text,
  email            text not null unique,
  cat_name         text,
  handles          text,
  payout           text,
  pay_to           text,
  code             text not null unique,
  stripe_promo_id  text
);

-- Friends someone introduced (reviews page + postinginfo intro form).
create table if not exists referrals (
  id                bigserial primary key,
  created_at        timestamptz not null default now(),
  referrer_name     text,
  referrer_email    text not null,
  friend_name       text,
  friend_contact    text,
  friend_email      text,              -- lower-cased, if the contact was an email
  friend_phone      text,              -- last 10 digits, if it was a phone number
  note              text,
  source            text,              -- review | intro
  status            text not null default 'pending',  -- pending | contacted | converted | converted_other
  converted_session text,
  converted_at      timestamptz
);
create index if not exists referrals_email_idx on referrals (friend_email);
create index if not exists referrals_phone_idx on referrals (friend_phone);

-- $10 owed to someone, written by the Stripe webhook. Tick "paid" when you pay.
create table if not exists referral_payouts (
  id              bigserial primary key,
  created_at      timestamptz not null default now(),
  referrer_email  text not null,
  referrer_name   text,
  reason          text not null,       -- code | intro
  code            text,
  session_id      text not null,
  buyer_email     text,
  amount_usd      numeric(8,2) not null,
  self_use        boolean not null default false,
  paid            boolean not null default false,
  paid_at         timestamptz,
  unique (session_id, referrer_email, reason)
);

alter table submissions      enable row level security;
alter table affiliates       enable row level security;
alter table referrals        enable row level security;
alter table referral_payouts enable row level security;

-- Handy view: what you owe, per person, unpaid only.
-- security_invoker makes the view obey RLS like the tables do; without it a
-- view runs as its owner and the public API could read everyone's emails.
create or replace view payouts_due with (security_invoker = true) as
  select referrer_email, max(referrer_name) as referrer_name,
         count(*) as sales, sum(amount_usd) as owed
  from referral_payouts
  where not paid and not self_use
  group by referrer_email
  order by owed desc;

revoke all on payouts_due from anon, authenticated;

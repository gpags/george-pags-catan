# Deploy notes — cat shop takeover

## What's new (nothing existing was overwritten)

```
index.html             ← the cat shop homepage (live)
assets/catalog.js      ← THE catalog: products, colors, add-ons, bundle maths
assets/rp.css          ← shop styles (own class names, no collision with output.css)
assets/rp.js           ← persistent cart, checkout hand-off, page chrome
api/checkout.js        ← cat shop Stripe Checkout (server-side repricing)
products/*.html        ← 20 generated product pages
pages/*.html           ← 4 generated policy pages
build-products.js      ← regenerates products/ and pages/ from assets/catalog.js
vercel.json            ← { "cleanUrls": true } so /products/name works
```

## One catalog, three readers

`assets/catalog.js` is a UMD module — it works as a browser global and as a
CommonJS `require`. All three consumers read the same file:

| Reader | How | Uses it for |
|---|---|---|
| `assets/rp.js` | `<script>` → `window.RP_CATALOG` | cart display, bundle maths |
| `build-products.js` | `require('./assets/catalog.js')` | generating all 24 pages |
| `api/checkout.js` | `require('../assets/catalog.js')` | repricing every order |

**Nothing else in the repo may hardcode a price.** Change a price in
`catalog.js`, run `node build-products.js`, and the storefront, the product
pages and the Stripe line items all move together. This replaced an older
setup where `build-products.js` string-scraped and `eval`'d the product array
out of `rp.js`.

The cart in `localStorage` now stores only `{h, qty, color, name, match}` —
no prices at all. Titles, images and prices are looked up from the catalog on
render, and the server recomputes the total independently, so editing the cart
in devtools changes neither the displayed price nor the charged one. The
storage key moved to `rp_cart_v2`; any `v1` cart is dropped on first load.

Untouched: `output.css`, `input.css`, `Catan/`, `Images/`,
`meowmeow.html`, `CustomFigurines.html`, `privacy-policy.html`, `success.html`.

## Two checkout endpoints, on purpose

| Endpoint | Serves | Payload |
|---|---|---|
| `api/checkout.js` | the cat shop | `{items:[{handle,color,qty,addons}]}` |
| `api/create-checkout.js` | Catan configurator + `CustomFigurines.html` | `{state, total}` |

They are separate files so a bad cat-shop deploy cannot take down Catan
checkout. `Catan/index.html` and `CustomFigurines.html` still POST to
`/api/create-checkout` and were not edited. The only change to that file was
deleting the June-2026 stock gate, which could no longer fire and cost every
order a blocking round trip to a Google Apps Script; its `cancel_url` still
points at `/catan`, which is correct for Catan.

## Why /catan keeps working

Verified by loading `Catan/index.html` after the new files were in place:

- It still loads its own `../output.css` — **do not delete output.css or input.css**,
  the Catan pages are the only things using them.
- Our `assets/rp.css` does **not** leak into it. Different class names, separate file,
  never linked from the Catan page.
- Its "Back to Home" links point at `../index.html`, `../index.html#collections` and
  `../index.html#story`. Those now land on the cat shop, which is what you wanted —
  and `index.html` deliberately carries `id="collections"` and `id="story"`
  anchors so those links still scroll somewhere sensible instead of dying.
- The new homepage links to `catan/` (lowercase, trailing slash) — byte-identical to
  what the current `index.html` uses, so routing behaviour is unchanged.

## The one thing to watch: `cleanUrls`

`vercel.json` is new. `cleanUrls: true` is what makes `/products/chonk-cat` resolve.
Side effect: Vercel will now 308-redirect `/meowmeow.html` → `/meowmeow`, and the same
for every other root `.html` page. Old links keep working via the redirect, but if you
have paid ads or printed QR codes pointing at a `.html` URL, they'll take one extra hop.

`trailingSlash` is deliberately **not** set, so `/catan/` behaves exactly as it does today.

Links inside the site are written as `products/<name>.html` so they work when you open
the files locally. In production `cleanUrls` redirects those to the pretty
`/products/<name>` form.

## Build stamp — stale pages announce themselves

`assets/catalog.js` derives a `BUILD_ID` from the pricing-relevant data
(size ladders, add-ons, gift thresholds, and every product's handle, price,
size, stock and `bundlePrices`). `build-products.js` bakes that id into every
generated page, and each page compares it against the catalog the browser
actually loaded.

If they differ the page logs a clear console error and shows a red banner,
instead of half-working. **This is not hypothetical** — pages generated before
the pricing rewrite called `RP.unitsPaid()`, which no longer exists. `refresh()`
threw after updating the quantity but before the price, so the stepper kept
moving while the price and bundle buttons silently froze. That is exactly the
bug reported from the live site, and it means `products/` was deployed older
than `assets/`.

**Always push `assets/` and `products/` together.** If you ever see the banner,
run `node build-products.js` and redeploy.

`refresh()` now also computes every value before writing any of them, so a
future error can't leave the quantity updated and the price stale.

## Adding a product later

1. Add an entry to the `PRODUCTS` array in `assets/catalog.js`
2. `node build-products.js`

Duplicate handles, bad prices, unknown vibes and unknown colour keys throw at
require time, so a bad hand-edit fails the build instead of shipping.

## Offers: explicit bundle prices + a free gift ladder

### Bundles are set prices, not ratios

`SIZE_BUNDLES` in `assets/catalog.js` holds `[quantity, dollars above base]`
per size. Each product's `bundlePrices` is derived from it as
`[quantity, TOTAL price]`:

| Size | Ladder | Example |
|---|---|---|
| S | 1, 3, 5, 10 @ base +$0/+$5/+$10/+$15 | $15 Cat Clicker: 1/$15, 3/$20, 5/$25, 10/$30 |
| M | 1, 2, 3, 5 @ base +$0/+$5/+$10/+$15 | $26 Sleepy Chonk: 1/$26, 2/$31, 3/$36, 5/$41 |
| L | 1, 2, 3 @ base +$0/+$10/+$20 | $34 Cat On The Moon: 1/$34, 2/$44, 3/$54 |

Edit those three rows and every product of that size follows. To take one
product off the pattern, give it its own `bundlePrices` array of
`[quantity, TOTAL price]` pairs.

`priceFor(product, qty)` finds the **cheapest combination of rungs** that
covers the requested quantity. Two consequences worth knowing:

- A quantity between rungs is billed at whichever is cheaper — asking for 4
  clickers costs $25, the 5-rung price, not $35.
- The price curve never goes backwards. There is a test that walks quantities
  1–60 and asserts buying one more is never cheaper.

Add-ons are charged on **every unit** now (three engraved cats is three
engravings), not just the "paid" units of the old ratio model.

The old ratio machinery (`unitsPaid`, `freeUnits`, `MONOTONIC_PRICING`,
`tierLabel`) is gone, as is the plate cost model and the build-time margin
report — it needed maintenance the shop won't do.

### Free gift ladder

Runs alongside the bundles, from Hormozi's Method 4 (*"the Free Things can Be
Different from the Paid Thing"*):

| Spend | Gift | Costs us |
|---|---|---|
| $25+ | Cat Paw Keychain | ~$1.50 |
| $45+ | + Cat Clicker | ~$1.50 |
| $65+ | (free shipping, unchanged) | — |

Gifts are granted **server-side** in `api/checkout.js` from the recomputed
subtotal and added as $0 line items. A client that injects `gift: true` or a
fake subtotal gets nothing — there is a test for exactly that.

## Buying

Two paths, both hitting `POST /api/checkout` and both repriced server-side:

- **Add to cart** → cart drawer → *Express checkout* / *Check out*.
- **Buy it now** on a product page → straight to Stripe with just that one
  configuration, skipping the cart entirely.

### Payment methods are pinned, not dynamic

`PAYMENT_METHODS` in `api/checkout.js`:

```js
['card', 'link', 'amazon_pay', 'cashapp', 'us_bank_account']
```

Dynamic payment methods were turned OFF deliberately. Left on, Stripe keeps
adding buy-now-pay-later options (Klarna, Affirm, Afterpay) as it enables them,
and we don't want BNPL on made-to-order goods. Pinning the list means a new
BNPL can never appear without a code change.

- **Apple Pay and Google Pay need no entry** — they ride on `card` automatically
  once the domain is verified in Stripe (Settings → Payments → Payment method
  domains).
- **Shop Pay is not on the list and cannot be.** It is Shopify's own wallet;
  Stripe does not offer it at any price. `link` is the equivalent — sign in,
  card and address autofill, one tap. The only route to a real Shop Pay button
  is moving the storefront to Shopify.
- `us_bank_account` (ACH) is included because it was already enabled. Worth
  knowing: ACH settles in days and can be reversed well after you've printed
  and shipped. Drop it from the array if that risk isn't worth the lower fee.

## Shipping — weight bands

Stripe Checkout can't pull live carrier rates mid-session, so the rate is
computed from the packed weight before the session is created:

| Packed weight | Charge |
|---|---|
| ≤ 8 oz | $5 |
| 8–16 oz | $7 |
| 1–3 lb | $10 |
| 3 lb+ | $14 |
| Order ≥ $65 | **Free** |

Packed weight = 2 oz packaging + each product's `weightOz` × qty + any gift's
weight. It is written to session metadata as `packed_oz` so a label can be
bought without re-weighing the parcel.

**The band prices are still estimates and so are the product weights.** The
structure is right; the numbers need real Pirate Ship quotes for your actual
boxes, and `weightOz` needs a kitchen scale. Both are marked TODO.

## Order confirmation — two pages, two shops

| Page | Shop | Endpoint |
|---|---|---|
| `/success` | Catan Artisan | `GET /api/get-session` → `{state, total, paid, email}` |
| `/order-complete` | cat shop | `GET /api/get-session` → `{shop:'cats', items, gifts, needsPhoto, ...}` |

`success.html` renders a Catan order summary — tier, robber, box finish. The cat
shop used to point at it, so a cat customer saw "Catan Artisan — Core Bundle"
with empty fields. The cat shop now has its own generated `order-complete.html`
and `success.html` was not modified.

`api/get-session.js` is shared and was extended **additively**: an order whose
metadata carries `shop: 'cats'` gets the cat response; anything else falls
through to the original Catan response, byte for byte. There is a test asserting
the Catan shape is unchanged.

The confirmation page clears the cart, shows every line including free gifts,
and — when the order has `needs_photo` — shows the exact-pattern-match photo
request with the 7-day rule from the policies page.

**The photo is still requested by email, not uploaded.** Real upload (Vercel
Blob or S3 presigned PUT, keyed to the session id) is Phase 4.1 and is the next
piece of work.

## "You may also like"

One shared row on every product page, ranked by the `sales` field and
excluding the current product, so the same hero items get promoted site-wide.

**`sales` is seeded placeholder data, not real orders.** Feeding it real
numbers is a Phase 4.2 job — see the plan in the summary; it needs the Stripe
webhook and order sheet built first.

## Email — order alerts and the contact form

Both go through `lib/email.js` (Resend over plain `fetch`, so there is no new
npm dependency). It never throws: a failed send is logged, never a 500.

| Route | Trigger | Goes to |
|---|---|---|
| `api/webhook.js` | Stripe `checkout.session.completed` | `SHOP_EMAIL` — full print worksheet |
| `api/contact.js` | contact form POST | `SHOP_EMAIL`, Reply-To = the customer |

The order email is the print worksheet: every line with colour, quantity,
engraving text, a loud EXACT PATTERN MATCH warning, free gifts, the shipping
address, packed weight and the customer's email. Catan orders still get a
short alert so no sale goes unnoticed.

The contact form now POSTs. It used to only open the visitor's mail client,
which silently sent nothing for anyone without one configured — most phone
users. The mail client is now the fallback if the endpoint is unreachable.
There is a hidden `company` honeypot field; a filled one is accepted and
dropped.

### Setup — four env vars, none of them optional

1. **Resend account** at resend.com, create an API key.
2. In **Vercel → Settings → Environment Variables** (Production):
   - `RESEND_API_KEY` — starts `re_`
   - `SHOP_EMAIL` — `realizedprints@gmail.com`
   - `EMAIL_FROM` — until the domain is verified in Resend, use
     `Realized Prints <onboarding@resend.dev>`. That test sender can only
     deliver to the address that owns the Resend account, which is fine for
     order alerts but **will not deliver contact-form mail elsewhere**. Verify
     `realizedprints.com` in Resend to lift that.
   - `STRIPE_WEBHOOK_SECRET` — from step 3.
3. **Stripe → Developers → Webhooks → Add endpoint**
   - URL `https://realizedprints.com/api/webhook`
   - Event: `checkout.session.completed` only
   - Copy the signing secret (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`
4. Redeploy, then use Stripe's **Send test webhook** button and confirm an
   email arrives.

`api/webhook.js` sets `config.api.bodyParser = false` because Stripe signs the
raw body — Vercel's default JSON parsing would destroy the signature. If you
ever see "signature verification failed" in the logs with a correct secret,
that export is the first thing to check.

**Belt and braces:** Stripe Dashboard → Settings → Notifications also has a
"Successful payments" email toggle. It has no order detail, but it costs
nothing and covers you if the webhook is ever misconfigured.

## Pattern-match photo intake

| Piece | What it does |
|---|---|
| `api/upload-photo.js` | validates the order, stores the file in Vercel Blob, emails you the link |
| `order-complete.html` | upload button, shown only when the order needs a photo |
| customer email | "Upload your photo" button linking back to the same page |

The browser **downscales to 1600px JPEG before uploading**. That keeps every
request far under Vercel's 4.5MB limit, uploads in seconds on phone data, and
1600px is more than enough to match coat colour and markings.

The endpoint is not an open file host. Before storing anything it retrieves the
Stripe session and requires it to exist, be `paid`, be a cat-shop order, and
have `needs_photo: true`. Files land at `match-photos/<session_id>/…` so a photo
can never be orphaned from its order, and the shop gets an email with the image
inline the moment it arrives — that email is what unblocks printing.

### Setup

1. **Vercel → Storage → Create → Blob**, connect it to this project.
   `BLOB_READ_WRITE_TOKEN` is injected automatically — nothing to copy.
2. Redeploy. `@vercel/blob` is in `package.json` and installs on build.

## Testing the webhook

**Stripe removed "Send test webhook" from LIVE-mode endpoints** — the button
only exists on test-mode ones. So use the bundled script instead:

```
node scripts/send-test-webhook.js whsec_YOUR_SECRET
node scripts/send-test-webhook.js whsec_YOUR_SECRET --match
```

It builds a realistic cat order, signs it with the endpoint's signing secret
using Stripe's own scheme (HMAC-SHA256 over `<timestamp>.<raw body>`), and
POSTs it. `api/webhook.js` cannot tell it apart from a real Stripe delivery,
which is the point. No money moves and no Stripe CLI is needed.

Verified locally against a server implementing Stripe's documented verification
(timing-safe compare, 5-minute tolerance): a correct secret returns 200 and
sends both emails; a wrong secret returns 400 `Invalid signature`.

The script also explains each failure status — 400 means the secret does not
match, 500 means `STRIPE_WEBHOOK_SECRET` is unset in Vercel, 404 means the
function did not deploy.

Note `api/webhook.js` falls back to the event's own payload when the session
re-fetch 404s. Synthetic events reference sessions that do not exist, and the
signature check has already proved the event is genuine, so dropping it would
make a correct setup look broken.

## Still to do

- **Photography.** Every image is a MakerWorld placeholder. The gallery thumbnails on
  product pages are currently other products standing in for per-colour shots.
- **`sales` is fake.** The bestseller row ranks on it. Real order counts need Phase 4.2.
- **Catalog placeholders.** `weightOz`, `boxClass` and `stock` are guesses on all 20
  products, and `colorsAvailable` is all nine everywhere. Grep `catalog.js` for `TODO`.
- **Shipping band prices.** The weight-band structure is live, but the four band
  prices and every `weightOz` are estimates. Get real Pirate Ship quotes and weigh
  one packed parcel per size.
- **`success.html` can't read the order back yet.** `api/checkout.js` writes
  `{handle, color, name, match}` into session metadata, but retrieving it needs a
  `GET /api/session?session_id=…` endpoint that doesn't exist. Blocks Phase 4.1.
- **Promo codes still stack with bundles.** `allow_promotion_codes: true` is on, but
  `/pages/policies` says codes aren't combinable with bundles. Enforce server-side
  (Phase 5.3) or change the copy.
- **Catan's endpoint still pins `payment_method_types: ['card']`.** Dropping that one
  line from `api/create-checkout.js` would give the Catan configurator Link, Apple Pay
  and Google Pay too. Left alone deliberately — it's a live revenue path.

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

## Adding a product later

1. Add an entry to the `PRODUCTS` array in `assets/catalog.js`
2. `node build-products.js`

Duplicate handles, bad prices, unknown vibes and unknown colour keys throw at
require time, so a bad hand-edit fails the build instead of shipping.

## Bundle pricing — per product

`bundleTiers` is an array of `[units received, units paid for]` pairs, set per
product. The maths lives in `unitsPaid()` in `assets/catalog.js` and is used by
the product page, the cart and the checkout endpoint, so the number never
changes between them.

```js
bundleTiers: [[3,1],[16,5],[40,10]]   // S — pay 1 get 3, pay 5 get 16, pay 10 get 40
bundleTiers: [[2,1],[7,2],[13,3]]     // M — pay 1 get 2, pay 2 get 7,  pay 3 get 13
bundleTiers: []                       // L — no bundle
```

| Size | Products | Best per-unit | Example |
|---|---|---|---|
| S | 5 | 75% off | 40 keychains @ $10 = $100 ($2.50 ea) |
| M | 11 | 77% off | 13 Sleepy Chonks @ $26 = $78 ($6.00 ea) |
| L | 4 | — | never discounts |

Product-page tier buttons, their per-unit prices, the policies table and the
FAQ are all generated from these arrays. A tier larger than the product's
`stock` is hidden rather than offered and then rejected at checkout.

### The remainder gap, and `MONOTONIC_PRICING`

Because the leftover units are charged at full price, some quantities cost
**more** than a slightly larger one — 12 Sleepy Chonks is $130, but 13 is $78.
Two ways to handle it, set by one constant in `assets/catalog.js`:

- `MONOTONIC_PRICING = false` **(current)** — charge the tiers exactly as
  written, and show a nudge on the product page: *"Take 13 instead and pay
  $52.00 less"*. Nobody overpays without being offered the better deal, and it
  pushes basket size up.
- `MONOTONIC_PRICING = true` — never charge more than a larger quantity would.
  The shopper at 12 simply pays the 13-unit price. Less revenue in those gaps,
  but the price curve never goes backwards.

Flip the constant and storefront, cart and Stripe all follow.

## Buying

Two paths, both hitting `POST /api/checkout` and both repriced server-side:

- **Add to cart** → cart drawer → *Express checkout* / *Check out*.
- **Buy it now** on a product page → straight to Stripe with just that one
  configuration, skipping the cart entirely.

Express checkout is not a separate integration — Stripe Link, Apple Pay and
Google Pay appear inside the session because `payment_method_types` is not
pinned. Shop Pay is Shopify-only and cannot be offered here.

## "You may also like"

One shared row on every product page, ranked by the `sales` field and
excluding the current product, so the same hero items get promoted site-wide.

**`sales` is seeded placeholder data, not real orders.** Feeding it real
numbers is a Phase 4.2 job — see the plan in the summary; it needs the Stripe
webhook and order sheet built first.

## Still to do

- **Photography.** Every image is a MakerWorld placeholder. The gallery thumbnails on
  product pages are currently other products standing in for per-colour shots.
- **`sales` is fake.** The bestseller row ranks on it. Real order counts need Phase 4.2.
- **Catalog placeholders.** `weightOz`, `boxClass` and `stock` are guesses on all 20
  products, and `colorsAvailable` is all nine everywhere. Grep `catalog.js` for `TODO`.
- **Shipping bands (Phase 3).** `api/checkout.js` charges one flat
  `FLAT_SHIPPING_CENTS` rate under $65 and free over it. The weight bands need real
  Pirate Ship quotes; `weightOz`/`boxClass` are already in place for them.
- **`success.html` can't read the order back yet.** `api/checkout.js` writes
  `{handle, color, name, match}` into session metadata, but retrieving it needs a
  `GET /api/session?session_id=…` endpoint that doesn't exist. Blocks Phase 4.1.
- **Promo codes still stack with bundles.** `allow_promotion_codes: true` is on, but
  `/pages/policies` says codes aren't combinable with bundles. Enforce server-side
  (Phase 5.3) or change the copy.
- **Catan's endpoint still pins `payment_method_types: ['card']`.** Dropping that one
  line from `api/create-checkout.js` would give the Catan configurator Link, Apple Pay
  and Google Pay too. Left alone deliberately — it's a live revenue path.

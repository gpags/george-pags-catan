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

## Offers: free gift ladder, not quantity discounts

The old "3 for the price of 1" ladder was replaced. Two reasons, both from
Alex Hormozi's *Money Models*:

1. **Method 4 is not a discount.** The boots example: *"Buy 1 Pair of Boots,
   Get TWO Pair Free — they charged 3x for a single pair of boots because they
   came with two more pairs."* The price went UP; "free" was the framing. Our
   version charged one unit's price for three, which is a 67% giveaway.
2. **The free thing should be a different, cheaper thing.** *"Instead of Buy 1
   shirt get 1 free, you can do buy 1 shirt get Socks Free"* and *"More Free
   Cheaper Things can work better than Fewer Free Expensive Things."*

So spending more earns a free **small** item, not a discount on the thing they
came for. Set in `GIFTS` in `assets/catalog.js`:

| Spend | Gift | Costs us | Perceived value |
|---|---|---|---|
| $25+ | Cat Paw Keychain | $1.50 | $10 |
| $45+ | + Cat Clicker | $1.50 | $15 |
| $65+ | (free shipping, unchanged) | — | — |

Gifts are granted **server-side** in `api/checkout.js` from the recomputed
subtotal and added as $0 line items. A client that injects `gift: true` or a
fake subtotal gets nothing — there is a test for exactly that.

Volume tiers run **alongside** the gifts, sized by profit per printer-hour
(see below), not by percentage off:

| Size | Tiers | Why |
|---|---|---|
| S | `[[3,1],[16,5],[40,10]]` | a small plate is 2.5h for 20 units, so even 40-for-$150 earns ~$28/printer-hour |
| M | `[[5,4]]` | 1.67h per unit; anything deeper drops under $10/printer-hour |
| L | `[]` | 13.5h per unit — already only ~$2/printer-hour at full price |

## Cost model — per plate, not per unit

`costUsd` was a flat per-unit guess and it was wrong. Owner's figures: a Cat
Clicker costs ~$1.50 to make one and ~$1.70 to make two. The plate run is
almost the whole cost; the marginal unit is ~$0.20. What scales is how many
fit on a build plate — **L 2-3, M 5-8, S 10-30**.

```js
cost(qty) = ceil(qty / plateQty) * plateRunUsd + qty * filamentUsd
```

Set in `PLATE` in `assets/catalog.js`, calibrated to reproduce $1.50 / $1.70
exactly. `node build-products.js` prints a margin table every build and warns
if any single unit drops under 50% margin or any bundle tier would sell below
cost.

**Consequence worth knowing:** bulk is cheap here. 40 clickers cost $10.60 to
make. Volume offers are far more affordable than a normal unit-cost business
would allow — the binding constraint is printer *hours*, not dollars, so the
number to watch is profit per plate-hour once plate times are measured.

`plateRunUsd`, `plateQty` and `filamentUsd` are PROVISIONAL and calibrated
from one product. Time a real plate per size before trusting them.

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

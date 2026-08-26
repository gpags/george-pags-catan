# CatCustoms — Launch Plan

**Written:** 2026-08-26
**Goal:** turn the CatCustoms review build into the live realizedprints.com storefront,
with working Stripe checkout and Resend email.

> Read §1 before writing any code. Most of what this needs **already exists and works.**
> The job is wiring, not building.

---

## 1. What already exists — do not rebuild it

The repo has a complete, working commerce backend from the figurine shop. CatCustoms
plugs into it.

| File | What it does | Status |
|---|---|---|
| `lib/email.js` | Resend wrapper. `sendEmail({to, subject, html, text, replyTo})` | ✅ works |
| `api/contact.js` | Contact form → email, Reply-To set to the customer | ✅ works |
| `api/checkout.js` | Stripe Hosted Checkout. **Recomputes every price server-side from `assets/catalog.js`** | ✅ works |
| `api/webhook.js` | Stripe webhook → "you got an order" email | ✅ works |
| `api/upload-photo.js` | Post-purchase photo intake, keyed to the Stripe session. Browser downscales to ~1600px, stores in Vercel Blob, emails the shop the link | ✅ works |
| `api/get-session.js` | Reads a Stripe session for the confirmation page | ✅ works |
| `order-complete.html` | Confirmation page. Already wired to `get-session` + `upload-photo` | ✅ works, **generated** |

**The photo-after-purchase flow the whole CatCustoms UX depends on is already built.**
It was made for "exact pattern match" on figurines. It needs re-labeling, not rewriting.

### Environment variables (all already in Vercel)

```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
SHOP_EMAIL          # where alerts land
EMAIL_FROM          # verified sender on realizedprints.com
BLOB_READ_WRITE_TOKEN
```

---

## 2. Invariants that will break the live site

1. **`api/checkout.js` reads prices from `assets/catalog.js` and ignores anything the
   client sends about money.** CatCustoms products *must* be added to `catalog.js` or
   checkout cannot price them. This is the single linchpin of the whole launch.
2. **`BUILD_ID` is baked into every generated page** and checked at load. Editing
   `catalog.js` changes it. Ship `catalog.js` and every `products/*.html` **together**
   or every product page shows a loud build-mismatch error.
3. **`build-products.js` only writes, never prunes.** Removing a product leaves an
   orphan HTML file live at its URL. Delete by hand.
4. **Never hand-edit `products/*.html`, `pages/*.html` or `order-complete.html`** — all
   generated. Edit `build-products.js` and re-run it.
5. **`/catan` must keep working.** Never delete root `output.css` / `input.css`.
6. **Images live in lowercase `images/`.** The capital `Images/` folder is dead
   Catan-era legacy. `/catan` alone has 89 lowercase references.
7. **Never `git add -A`** — the tree carries unrelated pre-existing deletions.
8. Owner deploys by hand through the GitHub web UI. Every change needs an explicit
   upload list and delete list.

---

## 3. Current state of the CatCustoms front end

Five pages, fully designed and QA'd on desktop and mobile. **Zero backend wiring.**

| File | Purpose |
|---|---|
| `catcustoms.html` | Landing. Hero fork: Core Scratcher $59 / Cattoo $349 |
| `cc-template.html` | Product page. Color picker, name field, qty, upsells |
| `cc-custom.html` | Cattoo 1-of-1. Nine-step journey + enquiry form |
| `cc-refills.html` | Refill pads. 1/3/6 packs, plan vs one-time |
| `cc-partner.html` | Affiliates. Vet / Shelter / Pet Store / Sitter |
| `assets/cc.css` | All styling |
| `assets/cc.js` | Artwork, cart, PDP logic, forms |

**What is fake right now:**
- Cart lives in `localStorage`. The Checkout button shows a warning and does nothing.
- Both forms open a `mailto:` link instead of posting anywhere.
- `CC.PRICE` in `assets/cc.js` is the only place CatCustoms prices are written down.
  **This duplicates `catalog.js` and must be deleted once catalog.js owns pricing.**

### Prices to encode

| Item | Price |
|---|---|
| Core Scratcher (template) | **$59** |
| Second unit, same order | **40% off** ($35.40) |
| Cattoo (1-of-1) | **$349**, 3 per month |
| Refill pad ×1 | $10 |
| Refill pad ×3 | $25 |
| Refill pad ×6 | $40 |
| Refill subscription | 10% off any pack |
| Keychain ×1 / ×2 | $4 / $6 |

---

## 4. The plan, in order

### Phase 1 — Put CatCustoms into `assets/catalog.js` ⚠️ the linchpin

Everything else depends on this. Nothing can be bought until it is done.

1. Replace `PRODUCTS` with the CatCustoms line.
   - Handles: `cottage-cream`, `cottage-butter`, `cottage-blossom`, `cottage-lilac`,
     `sleepy-meadow`, `cattoo`, `refill-1`, `refill-3`, `refill-6`, `keychain-1`, `keychain-2`.
2. Replace `VIBES` with the design families (validator throws on an unknown vibe).
3. Replace `COLORS` with the four Cottage colorways. The validator throws on an unknown
   color key, so `colorsAvailable` must only list keys that exist.
4. **Delete `ADDONS.match`** (`'Exact pattern match', price:12`). The business does not
   offer it. It is threaded through `rp.js:34`, `rp.js:83`, `checkout.js:96-106`,
   `checkout.js:167` and `api/contact.js:16` — all five need touching.
5. Repoint `GIFTS` at the keychain handle.
6. Encode the **40%-off-second-unit** rule. `catalog.js` already has `bundlePrices` as
   explicit `[qty, total]` pairs — use `[[1,59],[2,94.40]]` rather than inventing a
   new discount mechanism.
7. **Decide the refill subscription.** `api/checkout.js` is `mode: 'payment'` — a single
   charge. A real subscription needs `mode: 'subscription'`, a new endpoint and a
   customer portal. **Recommendation: ship prepaid packs only for v1.** A 6-pack is one
   payment and works today. Relabel "Plan / SAVE 10%" as a prepaid discount, or hide the
   toggle until subscriptions exist.
8. Run `node build-products.js`.
9. Ship `catalog.js` + every `products/*.html` + `pages/*.html` + `order-complete.html`
   in one commit.

### Phase 2 — Wire the cart to Stripe

1. In `assets/cc.js`, **delete `CC.PRICE`** and read from `window.RP_CATALOG` instead.
   Load `assets/catalog.js` before `cc.js` on every CatCustoms page.
2. Rewrite `CC.cart` items to the shape `api/checkout.js` expects: `{handle, qty, color,
   name, addons}`. Send no money — the server recomputes it all.
3. Point `[data-checkout]` at `POST /api/checkout`, then redirect to `session.url`.
4. Delete the yellow "not wired to Stripe" warning from the drawer in all five pages.
5. Confirm `metadata.shop === 'cats'` is set so `api/webhook.js` sends the detailed
   order email.

### Phase 3 — Forms to Resend

1. **Cattoo enquiry** (`cc-custom.html`) and **partner application** (`cc-partner.html`)
   currently use `data-mailto`. Replace `CC.initForms` with a `POST /api/contact`.
2. `api/contact.js` has a `TOPICS` whitelist and `MAX` field lengths. Add the two new
   form types, or add a `source` field and widen the whitelist.
3. Keep `replyTo` set to the customer's email — replying from the inbox then answers
   them directly.
4. Show a real success state on submit. Do not navigate away.
5. Confirm `EMAIL_FROM` is a verified sender on `realizedprints.com`.

### Phase 4 — Post-purchase photo upload

Mostly relabeling. The mechanism works.

1. In `build-products.js`, change `orderCompletePage()` copy from "Exact pattern match —
   send a photo" to the CatCustoms ask: **a photo of your cat, plus the name for the
   nameplate.**
2. Add a **name** text field alongside the photo upload, and pass it through
   `api/upload-photo.js` into the shop email. Right now only the image is captured.
3. Re-run `build-products.js`.

### Phase 5 — Rewrite the generated content pages

All five `pages/*.html` are figurine copy and are wrong for CatCustoms. They talk about
**filament**, **PLA softening in hot cars**, **nine core colors**, **exact pattern match
at +$12** and **husband-and-wife printing figurines**.

Edit these bodies in `build-products.js` (~lines 423–900), then re-run it:

- `policiesBody` — shipping, returns, the refill policy
- `faqBody` — replace figurine Q&A with the CatCustoms FAQ
- `contactBody` — contact form (already posts to `api/contact.js`)
- `tosBody` — terms
- `privacyBody` — photos of your pet, Vercel Blob storage

⚠️ **One conflict to fix.** The returns policy excludes *"damage from drops, **pets**,
dishwashers, heat, or normal wear."* On a scratcher, pet damage is the entire function of
the product. Reword so the **pad is consumable by design** and the exclusion applies to
the frame.

### Phase 6 — Make CatCustoms the homepage

1. Rename `catcustoms.html` → `index.html`.
2. Archive the current figurine `index.html` (rename to `shop-figurines.html`, or delete
   — see §5).
3. Update every internal link that points at `catcustoms.html`:
   - `assets/cc.js` — none
   - all five pages — brand logo href, nav, footer, breadcrumbs
   - Simplest: find-and-replace `catcustoms.html` → `index.html`, then
     `href="index.html#templates"` → `href="#templates"` on the homepage itself.
4. `vercel.json` has `cleanUrls: true`, so `/cc-template` works without the extension.
   Consider renaming the `cc-*.html` files to friendlier URLs before launch — after
   launch a rename costs you SEO and any shared links.

### Phase 7 — Retire the figurine shop

Per `SCRATCHER-LINE-HANDOFF.md` §2: **16 of 18 figurine SKUs are other people's
MakerWorld/Thingiverse models**, many licensed non-commercial, none individually cleared,
all hotlinking the designers' own renders. That blocks their launch, not CatCustoms'.

Once `catalog.js` holds only CatCustoms products, the 18 old `products/*.html` files
become orphans still live at their URLs. **Delete them by hand** — the build script will
not.

---

## 5. Decisions still needed

1. **Refill subscription: real or prepaid?** Real recurring billing is a new endpoint
   plus a customer portal. Prepaid packs work today. This changes Phase 1 step 7.
2. **What happens to the old figurine `index.html`?** Archive at a new path, or delete?
3. **Cattoo capacity — is "2 of 3 spots left" tracked anywhere?** It is hard-coded in the
   HTML right now. Either wire it to something real or make it static and honest.
4. **Affiliate links and commission.** The partner page promises a personal link and a
   20% client code. Nothing generates or tracks either. v1 can be manual (you email them
   a Stripe promo code), but the page should not promise a dashboard that does not exist.
5. **Does the Cattoo take payment on the page, or after the conversation?** Currently it
   is an enquiry form with no charge. That is defensible for a $349 commission — decide
   deliberately.

---

## 6. Go-live checklist

**Before flipping the homepage**

- [ ] `node build-products.js` run, and `catalog.js` + all generated pages shipped together
- [ ] `BUILD_ID` matches — no mismatch banner on any product page
- [ ] Stripe **test mode**: buy a Core Scratcher, a 2-unit order (check the 40% discount),
      a refill pack and a keychain
- [ ] Order email arrives via the webhook, with the right color/name/qty
- [ ] Confirmation page loads, photo upload works, the shop email has the image link
- [ ] Contact form → inbox. Reply-To answers the customer
- [ ] Cattoo enquiry → inbox
- [ ] Partner application → inbox, with the right audience type
- [ ] Switch Stripe to **live** keys and re-run one real purchase

**Content**

- [ ] All five `pages/*.html` rewritten — no filament, PLA or nine-colors copy left
- [ ] Pet-damage exclusion reworded in the returns policy
- [ ] Journey photos 6–9 shot and saved (print bed, painting, boxed, unboxing)
- [ ] Cardboard pad photo shot → `images/cc-refill-inserts.jpg`
- [ ] `keychains.jpg` resized (currently 3 MB — target ~200 KB at 1200px wide)
- [ ] Reviews block still shows its EMPTY-ON-PURPOSE warning, or has real reviews

**Housekeeping**

- [ ] `catcustoms.html` → `index.html`, old index archived
- [ ] All internal links updated
- [ ] The 18 orphan `products/*.html` deleted by hand
- [ ] Dead capital `Images/` folder cleaned up (separate job — do not touch near `/catan`)
- [ ] `/catan` still loads

---

## 7. Known gaps in the current build

| Gap | Where | Severity |
|---|---|---|
| Checkout does nothing | all pages, cart drawer | blocks launch |
| Forms only open `mailto:` | `cc-custom`, `cc-partner` | blocks launch |
| `CC.PRICE` duplicates pricing | `assets/cc.js` | will drift — delete in Phase 2 |
| Generated pages are figurine copy | `pages/*.html` | blocks launch |
| Journey photos 6–9 missing | `cc-custom.html` | cosmetic, weakens the $349 pitch |
| Cardboard pad photo missing | `catcustoms.html`, `cc-refills.html` | cosmetic, drawing stands in |
| Bamboo / Castle / Bloom have no product page | landing | marked "Coming soon", buttons disabled |
| Affiliate links not generated or tracked | `cc-partner.html` | promise exceeds the build |

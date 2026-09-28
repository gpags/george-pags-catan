/* ================================================================
   CatCustoms — SHARED CATALOG
   The single source of truth for products, prices, colorways,
   add-ons and bundle pricing. Read by all four consumers so they
   can never disagree about a price:

     assets/rp.js        (browser)  -> window.RP_CATALOG
     assets/cc.js        (browser)  -> window.RP_CATALOG
     build-products.js   (node)     -> require('./assets/catalog.js')
     api/checkout.js     (node)     -> require('../assets/catalog.js')

   If you change a price here, the storefront, the generated pages
   and the Stripe line items all move together. Nothing else in the
   repo may hardcode a price.

   ----------------------------------------------------------------
   THINGS STILL MARKED TODO — grep for TODO.

     weightOz   packed shipping weight. Every value below is a GUESS.
                Weigh one packed unit on a kitchen scale before going
                live: api/checkout.js picks the postage band from it,
                and a wrong number loses real money on every order.
     FREE_SHIP_AT / FREE_KEYS_AT  order milestones — see the note on them.
     GIFTS      deliberately empty for v1 — see the note on it.
   ================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RP_CATALOG = factory();
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';

/* ---------- design families ----------
   `v` groups products. The validator throws on an unknown one, and
   api/checkout.js uses `v === 'scratcher'` to decide what the
   $30-off-the-second-scratcher rule applies to, and `v === 'keychain'` to
   enforce the scratcher-required rule. Renaming a key here means
   changing both places. */
const VIBES = {
  scratcher: {name:'Cat scratchers', color:'#c9533f', blurb:'A frame that lasts, a pad that does not, and your cat drawn into the design.'},
  refill:    {name:'Refill pads',    color:'#bb8b52', blurb:'The only part that wears out. Lifts out, drops in, fits every design.'},
  keychain:  {name:'Keychains',      color:'#7d9b6a', blurb:'The same cat we drew for your scratcher, pocket-sized. Add one at checkout.'}
};

/* ---------- colorways ----------
   These MUST stay in step with the COAT lookup in assets/cc.js — the
   keys are the same and the labels are shown to the customer on the
   Stripe receipt and in the order email.

   Basking Paws is not personalised at all (see PRODUCTS below) — the
   only choice on that page is which of 6 cat coats ships. Homestead
   Buddies still shares one finish, 'meadow': sky blue, hill green, sun
   yellow, matching the real product photography. The old Storybook
   Cottage colorways (cream/butter/blossom/lilac) and the separate
   'sage' single-finish key are retired along with the timber-cottage
   art style; images/cc-cottage-*.jpg stay on disk but nothing
   references them any more.

   'natural' is refill pads — the only other single-finish product. */
const COLORS = [
  ['tuxedo',    'Tuxedo',       'co-tuxedo'],
  ['orange',    'Orange Tabby', 'co-orange'],
  ['calico',    'Calico',       'co-calico'],
  ['black',     'Black',        'co-black'],
  ['greywhite', 'Grey & White', 'co-greywhite'],
  ['grey',      'Grey',         'co-grey'],
  /* Not a paint colour: "paint it to match my cat". Picking it is what
     makes an order need a photo — see needsPhoto() below. */
  ['mycat',     'Matched to my cat (photo)', 'co-mycat'],
  ['meadow',    'Sky & Meadow', 'co-meadow'],
  ['natural',   'Natural kraft','co-natural']
];
const COLOR_KEYS  = COLORS.map(c => c[0]);
const COLOR_LABEL = COLORS.reduce((m,[k,label]) => (m[k] = label, m), {});

/* ================================================================
   ADD-ONS

   The $12 'Exact pattern match' add-on is GONE. The business does not
   offer an exact match — the illustration style drops detail by
   design, and every page says so. Removing it is not cosmetic:
   api/checkout.js used to set metadata.needs_photo from it, and
   api/upload-photo.js refuses an upload unless needs_photo is true.
   needs_photo is now derived from whether the order contains anything
   personalised, so the photo flow survives the add-on being deleted.

   The nameplate itself is never charged for separately — names are
   part of Homestead Buddies' price. ADDONS.name stays at price 0 so a
   typed name still travels to Stripe metadata and into the order email.
   ================================================================ */
const ADDONS = { name:{label:'Name on the nameplate', price:0} };

/* ================================================================
   ORDER MILESTONES — counted in scratchers, not dollars (Sep 2026
   owner decision), so the cart can say "1 more scratcher and…":

     2 scratchers  $30 off the second (SECOND_OFF_USD below)
                   + a free keychain for every scratcher in the order
     3 scratchers  free shipping

   api/checkout.js applies all three from these same functions, so the
   cart's promise and the Stripe total can't disagree.
   ================================================================ */
const FREE_KEYS_AT = 2;
const FREE_SHIP_AT = 3;

function scratcherCount(items) {
  return (items || []).reduce((n, it) => {
    const p = BY_HANDLE[it && it.handle];
    return n + (p && p.v === 'scratcher' ? Math.max(0, Math.floor(it.qty) || 0) : 0);
  }, 0);
}
function freeShipping(items) { return scratcherCount(items) >= FREE_SHIP_AT; }
/* One free keychain per scratcher, once the order has at least two. */
function freeKeychains(items) {
  const n = scratcherCount(items);
  return n >= FREE_KEYS_AT ? n : 0;
}

/* ================================================================
   PHOTOGRAPHY

   photoReal is true only where images/ holds a genuine photograph of
   the real product. The sitewide "product imagery is illustration"
   footer line disappears by itself once all of them are true.

   Still outstanding: a photo of the Sleepy Meadow frame (currently a
   render) and images/cc-refill-inserts.jpg (currently the drawn
   stand-in in CC.insert).
   ================================================================ */
const ALL_PHOTOS_REAL = () => PRODUCTS.every(p => p.photoReal);

/* ================================================================
   FREE GIFT LADDER — deliberately EMPTY for v1.

   The obvious move is a free keychain over $X. Don't: the keychain is
   a paid $4 upsell on the product page, and giving it away on every
   scratcher order removes that revenue line before it has ever run.

   The place a gift ladder does earn its keep is the partner channel —
   see SCRATCHER-LINE-HANDOFF.md §4.4. A free keychain or refill pack
   for a sitter's client costs a couple of dollars, reads as worth ten,
   and cannot stack its way into a loss the way a 50% code can.

   To switch it on later, add { minSpend, handle, color } rows. Note
   that giftsFor() cannot see which colorway the cart holds, so a gift
   row has to name one fixed color.
   ================================================================ */
const GIFTS = [];

/* Which gifts a given subtotal (in dollars) has earned. Anything out
   of stock is skipped rather than promised and then not shipped. */
function giftsFor(subtotal) {
  return GIFTS
    .filter(g => subtotal >= g.minSpend)
    .filter(g => (BY_HANDLE[g.handle] || {}).stock > 0);
}

/* The next gift not yet earned, for the "spend $X more" prompt. */
function nextGift(subtotal) {
  return GIFTS.find(g => subtotal < g.minSpend && (BY_HANDLE[g.handle] || {}).stock > 0) || null;
}

/* ---------- size classes ----------
   Kept only because build-products.js and BUILD_ID still reference
   the table. Every CatCustoms product declares its own bundlePrices
   below, so nothing actually falls through to these ladders. */
const SIZE_BUNDLES = {
  S: [[1, 0]],
  M: [[1, 0]],
  L: [[1, 0]],
  XL:[[1, 0]]
};

/* ================================================================
   CATALOG

   Two designs, ONE handle each, and both are always made for the
   customer's own cat(s) — there is no ready-to-ship tier and no
   paid personalisation upsell (Sep 2026 owner decision):
     basking-paws       $55  one cat, always matched to their photo
     homestead-buddies  $87  two cats matched to photos, plus names
   Both are personalised:true, so every scratcher order needs a photo.

   The only upsells are refills and keychains. Every second scratcher
   is $30 off (SECOND_OFF_USD below); see ORDER MILESTONES for the rest.

   Refills and keychains are one handle each with a quantity ladder,
   which is exactly what bundlePrices exists to express: refills read
   1/$12, 2/$22, 3/$30 and keychains read 1/$4, 2/$6.

   `canonical` names the hand-designed page that already sells this
   product. build-products.js skips generating a products/*.html for
   any product that has one, so there is never a second, off-brand
   product page competing with the designed one at its own URL.

   `stock` is made-to-order, not shelf count — nothing is pre-built.
   Setting one to 0 renders "Sold out" everywhere and blocks checkout,
   which is how you close the line if you need to stop taking orders.
   ================================================================ */
const PRODUCTS = [
  /* Basking Paws: ALWAYS painted to match the customer's own cat from a
     photo sent after checkout (owner decision, Sep 2026 — the colour
     picker is gone), so its only colour is 'mycat'. No nameplate. The
     preset coat keys below stay in COLORS for the keychain and for any
     old carts. Only 'tuxedo' has a real
     photograph (images/bp-tuxedo.jpg, a copy of the launch photo); the
     other 5 fall back to CC.meadowScene(1, colorKey)'s drawn coat —
     see the COAT lookup in assets/cc.js. Swap in a real photo for any
     of them later by adding images/bp-<color>.jpg; swatchImg picks it
     up automatically, no other change needed. */
  {id:101, h:'basking-paws', t:'Basking Paws', v:'scratcher', size:'XL', price:55,
   sales:0, new:1, badge:'best', exclusive:1,
   colorsAvailable:['mycat'],
   bundlePrices:[[1,55]],
   canonical:'basking-paws.html',
   img:'images/bp-tuxedo.jpg', swatchImg:'images/bp-{color}.jpg', catCount:1,
   personalised:true,
   desc:'Rolling hills, clouds and a little sun, with one sleeping cat moulded into the side, painted to match your own cat. Send a photo after checkout.',
   /*TODO*/ weightOz:64, boxClass:'box-XL', stock:99, photoReal:true},

  {id:103, h:'homestead-buddies', t:'Homestead Buddies', v:'scratcher', size:'XL', price:87,
   sales:0, new:1, badge:'', exclusive:1,
   colorsAvailable:['meadow'], bundlePrices:[[1,87]],
   canonical:'homestead-buddies.html',
   /* No real two-cat photograph exists yet — see SCRATCHER-LINE-HANDOFF
      and the note on homestead-buddies.html. img is deliberately empty
      (not the one-cat Basking Paws photo) so the page draws the honest
      two-cat meadow scene instead of implying a photo that isn't real.
      The old 'homestead-buddies-custom' handle ($84) was folded into
      this one: names and both cats' likenesses are always included. */
   img:'', catCount:2,
   personalised:true,
   desc:'The same meadow scene as Basking Paws, built for two — your two cats drawn into the hillside together, with their names on the front. Send photos after you order.',
   /*TODO*/ weightOz:66, boxClass:'box-XL', stock:99, photoReal:false},

  {id:105, h:'refill', t:'Refill pads', v:'refill', size:'M', price:12,
   sales:0, new:0, badge:'', exclusive:1,
   colorsAvailable:['natural'],
   /* 1/$12, 2/$22, 3/$30. priceFor() finds the cheapest combination, so
      4 pads is 3+1 = $42. The product page offers 1, 2 or 3. */
   bundlePrices:[[1,12],[2,22],[3,30]],
   canonical:'cc-refills.html',
   img:'images/cc-refill-inserts.jpg',
   personalised:false,
   desc:'The corrugated pad your cat actually shreds. Lifts out, drops in, no glue and no tools. One size fits every CatCustoms design.',
   /*TODO*/ weightOz:6, boxClass:'box-M', stock:99, photoReal:false},

  {id:106, h:'keychain', t:'Keychain of your cat', v:'keychain', size:'S', price:4,
   sales:0, new:0, badge:'', exclusive:1,
   /* Rides along with any scratcher now, in that scratcher's own color:
      the Basking Paws coat picked, or the shared Homestead Buddies
      meadow finish. personalised:false because a coat-matched keychain
      needs no photo of its own — when it DOES carry a real likeness
      (added from a Homestead Buddies custom order) the scratcher line
      it travels with is what sets metadata.needs_photo, not this one. */
   colorsAvailable:['tuxedo','orange','calico','black','greywhite','grey','meadow','mycat'],
   bundlePrices:[[1,4],[2,6]],
   canonical:'basking-paws.html',
   img:'images/keychains.jpg',
   personalised:false,
   desc:'The same cat as your scratcher, pocket-sized. Only available alongside a scratcher order.',
   /*TODO*/ weightOz:1, boxClass:'poly-S', stock:99, photoReal:true}
];

/* Derived fields + a cheap integrity check so a bad hand-edit fails
   loudly at build/boot time instead of silently mispricing an order. */
const BY_HANDLE = {};
PRODUCTS.forEach(p => {
  /* Images are local files in lowercase images/ now. The old MakerWorld
     CDN wrapper is gone with the figurine SKUs that needed it. */
  p.imgUrl = p.img;
  p.sku = 'CC-' + String(p.id).padStart(4, '0');
  if (BY_HANDLE[p.h]) throw new Error('catalog: duplicate handle ' + p.h);
  if (!(p.price > 0)) throw new Error('catalog: bad price on ' + p.h);
  if (!VIBES[p.v]) throw new Error('catalog: unknown vibe "' + p.v + '" on ' + p.h);
  if (!p.colorsAvailable.length) throw new Error('catalog: no colors on ' + p.h);
  p.colorsAvailable.forEach(c => {
    if (COLOR_KEYS.indexOf(c) === -1) throw new Error('catalog: unknown color "' + c + '" on ' + p.h);
  });
  if (!p.bundlePrices) {
    p.bundlePrices = (SIZE_BUNDLES[p.size] || SIZE_BUNDLES.M).map(([q, add]) => [q, p.price + add]);
  }
  BY_HANDLE[p.h] = p;
});

/* ================================================================
   BUNDLE PRICING — explicit prices, not ratios

   Each product carries `bundlePrices`: [[quantity, TOTAL price], ...].

   priceFor() finds the cheapest combination of packs (and singles)
   that covers the requested quantity. That means the customer is
   never charged more for buying more, and a quantity that falls
   between two rungs is billed at whichever is cheaper.
   ================================================================ */
function packsFor(product) {
  return (product.bundlePrices || [])
    .filter(t => Array.isArray(t) && t[0] >= 1 && t[1] >= 0)
    .slice()
    .sort((a, b) => a[0] - b[0]);
}

function priceFor(product, qty) {
  const n = Math.max(0, Math.floor(qty) || 0);
  if (!n) return 0;
  const packs = packsFor(product);
  if (!packs.length) return product.price * n;

  /* cost[q] = cheapest way to cover q units. Either one more single, or
     any pack that covers part (or all) of the remainder. */
  const cost = new Array(n + 1).fill(Infinity);
  cost[0] = 0;
  for (let q = 1; q <= n; q++) {
    cost[q] = cost[q - 1] + product.price;
    for (const [pq, pp] of packs) {
      const rest = Math.max(0, q - pq);
      if (cost[rest] + pp < cost[q]) cost[q] = cost[rest] + pp;
    }
  }
  return cost[n];
}

/* ================================================================
   IMAGE PATHS

   Product images are local files under lowercase images/ now, not
   absolute CDN URLs. A page in products/ or pages/ sits one level
   down, so a bare "images/foo.jpg" would resolve to
   "products/images/foo.jpg" and 404.

   Every consumer resolves through here against its own base — '' at
   the root, '../' one level down. An absolute URL passes through
   untouched, so a CDN-hosted image would still work.
   ================================================================ */
function imgSrc(product, base) {
  const u = (product && product.imgUrl) || '';
  if (/^(https?:)?\/\//.test(u) || u.charAt(0) === '/') return u;
  return (base || '') + u;
}

/* ================================================================
   SUBSCRIBE & SAVE — refill pads only. The pack price minus SUB_OFF,
   billed and shipped every SUB_EVERY_MONTHS. api/checkout.js turns a
   cart line with sub:true into a recurring Stripe price from these.
   ================================================================ */
const SUB_OFF = 0.25;
const SUB_EVERY_MONTHS = 3;
function subPriceFor(product, qty) {
  return Math.round(priceFor(product, qty) * (1 - SUB_OFF) * 100) / 100;
}

/* What a single unit works out at, for the "$X each" line. */
function unitPriceAt(product, qty) {
  const n = Math.max(1, Math.floor(qty) || 1);
  return priceFor(product, n) / n;
}

/* What they save against buying `qty` at full price. */
function savingAt(product, qty) {
  const n = Math.max(0, Math.floor(qty) || 0);
  return Math.max(0, product.price * n - priceFor(product, n));
}

/* The next rung up, when moving to it costs nothing extra or very
   little — powers the "add one more" nudge on the product page. */
function betterDeal(product, qty) {
  const packs = packsFor(product);
  if (!packs.length) return null;
  const n = Math.max(1, Math.floor(qty) || 1);
  const here = priceFor(product, n);
  for (const [pq] of packs) {
    if (pq > n && priceFor(product, pq) <= here) {
      return { qty: pq, price: priceFor(product, pq), extra: 0 };
    }
  }
  return null;
}

/* ================================================================
   BUY ONE, GET $30 OFF THE SECOND — THE SECOND-SCRATCHER RULE

   This is an ORDER-LEVEL rule, not a per-product bundle ladder, and
   it has to be: bundle ladders are per handle, so a customer buying
   one Storybook Cottage and one Sleepy Meadow would be two lines of
   qty 1 and would get nothing — while the page told them the second
   one was discounted.

   Every second scratcher in the order comes off by SECOND_OFF_USD
   (never below $0). Four
   scratchers means two discounted, which is the same way a bundle
   ladder behaves and the same way "every second one" reads.

   The units are sorted most-expensive-first and the discount is
   applied to the even-indexed ones, so when two designs are ever
   priced differently it is the cheaper of each pair that discounts —
   never the more expensive.

   `items` is [{handle, qty}, ...]. Both api/checkout.js and
   assets/cc.js call this so the browser and Stripe cannot disagree.
   ================================================================ */
const SECOND_OFF_USD = 30;

function secondUnitDiscount(items) {
  const units = [];
  (items || []).forEach(it => {
    const p = BY_HANDLE[it && it.handle];
    if (!p || p.v !== 'scratcher') return;
    const n = Math.max(0, Math.floor(it.qty) || 0);
    for (let i = 0; i < n; i++) units.push(p.price);
  });
  units.sort((a, b) => b - a);
  let off = 0;
  for (let i = 1; i < units.length; i += 2) off += Math.min(units[i], SECOND_OFF_USD);
  return Math.round(off * 100) / 100;
}

/* ================================================================
   ORDER RULES

   The keychain is $4 because the cat's likeness has already been
   drawn for the scratcher — the marginal design cost is zero. Sold on
   its own it loses money on the first unit, because somebody still has
   to draw a cat. So it is only ever an add-on.

   The cart drawer checks this before enabling Checkout, and
   api/checkout.js checks it again before creating a session, because
   a cart in localStorage is editable in devtools.
   ================================================================ */
function orderProblem(items) {
  const has = v => (items || []).some(it => {
    const p = BY_HANDLE[it && it.handle];
    return p && p.v === v && (Math.floor(it.qty) || 0) > 0;
  });
  if (has('keychain') && !has('scratcher')) {
    return 'Keychains are made from the artwork we draw for your scratcher, so they only come with one.';
  }
  return null;
}

/* Anything that needs a photo of the customer's cat before it can be
   made. This is what api/checkout.js stamps into metadata.needs_photo,
   and what api/upload-photo.js checks before accepting an upload.

   True for an always-personalised product (Homestead Buddies), or any
   line whose colour is 'mycat'. A preset Basking Paws coat needs no
   photo, and asking for one we would do nothing with is a promise we
   would then have to explain away. Callers must pass `color`. */
function needsPhoto(items) {
  return (items || []).some(it => {
    const p = BY_HANDLE[it && it.handle];
    return !!(p && (p.personalised || it.color === 'mycat'));
  });
}

/* Where the picker should look for the photo of one colorway. Products
   without per-colorway photography fall back to their single image. */
function colorImg(product, colorKey) {
  if (!product) return '';
  /* No photo of "your cat" exists yet — show the product's main photo. */
  if (colorKey === 'mycat') return product.imgUrl || '';
  if (product.swatchImg && colorKey) return product.swatchImg.replace('{color}', colorKey);
  return product.imgUrl || '';
}

/* ================================================================
   BUILD STAMP

   Generated pages bake this in and compare it at load. If the HTML in
   products/ or pages/ was built from a different catalog than the one
   the browser just loaded, the page says so loudly instead of
   half-working.

   Derived from the pricing-relevant data only, so it changes exactly
   when a rebuild is actually required.
   ================================================================ */
function buildId() {
  const shape = JSON.stringify([
    SIZE_BUNDLES, ADDONS, FREE_SHIP_AT, FREE_KEYS_AT, GIFTS, SECOND_OFF_USD, SUB_OFF, SUB_EVERY_MONTHS,
    PRODUCTS.map(p => [p.h, p.price, p.size, p.stock, p.bundlePrices])
  ]);
  let h = 5381;
  for (let i = 0; i < shape.length; i++) h = ((h * 33) ^ shape.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
const BUILD_ID = buildId();

return {
  VIBES, COLORS, COLOR_KEYS, COLOR_LABEL, ADDONS, PRODUCTS, BY_HANDLE,
  SIZE_BUNDLES, FREE_SHIP_AT, FREE_KEYS_AT, scratcherCount, freeShipping, freeKeychains,
  SUB_OFF, SUB_EVERY_MONTHS, subPriceFor, GIFTS, giftsFor, nextGift,
  priceFor, unitPriceAt, savingAt, betterDeal, packsFor, imgSrc,
  SECOND_OFF_USD, secondUnitDiscount, orderProblem, needsPhoto, colorImg,
  BUILD_ID, ALL_PHOTOS_REAL
};
});

/* ================================================================
   Realized Prints — SHARED CATALOG
   The single source of truth for products, colors, add-ons and
   bundle pricing. Read by all three consumers so they can never
   disagree about a price:

     assets/rp.js        (browser)  -> window.RP_CATALOG
     build-products.js   (node)     -> require('./assets/catalog.js')
     api/checkout.js     (node)     -> require('../assets/catalog.js')

   If you change a price here, the storefront, the generated product
   pages and the Stripe line items all move together. Nothing else
   in the repo may hardcode a price.

   ----------------------------------------------------------------
   PLACEHOLDERS — every field after the "TODO" marker on each
   product line is a GUESS and must be replaced before launch.
   Grep the file for TODO to find all 20 of them.

     weightOz   packed shipping weight — needed for Phase 3 postage
                bands. Weigh one packed unit on a kitchen scale.
     boxClass   which mailer/box it ships in. Names are arbitrary;
                they only need to match the Phase 3 band table.
     stock      real unit count. 0 renders "Sold out" everywhere.

   `colorsAvailable` is currently ALL9 on every product, which is
   also a placeholder — trim each one to the colors you actually
   stock filament for.
   ================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RP_CATALOG = factory();
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';

const IMG = 'https://makerworld.bblmw.com/makerworld/model/';
const im = p => IMG + p + '?x-oss-process=image/resize,w_900/format,webp';

/* ---------- vibes (base figure / 3D style) ---------- */
const VIBES = {
  chonky:  {name:'Chonky',   color:'#ff8a3d', blurb:'Round, heavy, and extremely pleased with themselves. Pick a vibe, then pick your cat’s colors.'},
  chibi:   {name:'Chibi',    color:'#ff3d9a', blurb:'Big heads, tiny paws, smooth surfaces. The cutest thing we print.'},
  flexi:   {name:'Flexi',    color:'#2f6bff', blurb:'Print-in-place articulated spines. They wiggle straight off the plate.'},
  lowpoly: {name:'Low Poly', color:'#3ddc97', blurb:'Faceted, geometric, grown-up. The one your partner will actually allow on the shelf.'},
  knitted: {name:'Knitted',  color:'#a855f7', blurb:'Printed knit texture that reads handmade. Cosy without the yarn.'},
  witchy:  {name:'Witchy',   color:'#6b4bd8', blurb:'Hats, staffs, and moons. Built for the tabletop crowd.'}
};

/* ---------- nine core animal colors ---------- */
const COLORS = [
  ['orange','Orange tabby','co-orange'], ['tuxedo','Tuxedo','co-tuxedo'], ['calico','Calico','co-calico'],
  ['grey','Grey tabby','co-grey'],       ['brown','Brown tabby','co-brown'], ['tortie','Tortoiseshell','co-tortie'],
  ['siamese','Siamese','co-siamese'],    ['black','Black','co-black'],     ['white','White','co-white']
];
const COLOR_KEYS  = COLORS.map(c => c[0]);
const COLOR_LABEL = COLORS.reduce((m,[k,label]) => (m[k] = label, m), {});

/* Placeholder for colorsAvailable. Frozen so a stray mutation can't
   silently rewrite every product's color list at once. */
const ALL9 = Object.freeze(COLOR_KEYS.slice());

const ADDONS = { name:{label:'Put a name on it', price:5}, match:{label:'Exact pattern match', price:12} };

const FREE_SHIP = 65;

/* ---------- size classes ----------
   `size` drives the bundle tier group. Tiers agreed:
     S  [[3,1],[16,5],[40,10]]   pay 1 get 3 / pay 5 get 16 / pay 10 get 40
     M  [[2,1],[7,2],[13,3]]     pay 1 get 2 / pay 2 get 7  / pay 3 get 13
     L  []                       no bundle
   Each ladder is monotonic: every tier up is cheaper per unit than the
   one below it. Deepest cuts are 75%% (S) and 77%% (M) — margin-sensitive.
   Tiers are still written out per product below so any single item
   can be pulled out of its group without changing the whole band. */
const SIZE_TIERS = { S: [[3,1],[16,5],[40,10]], M: [[2,1],[7,2],[13,3]], L: [] };

/* ================================================================
   CATALOG
   tiers format: [units received, units paid for]
   ================================================================ */
const PRODUCTS = [
  {id:1, h:'chonk-cat',            t:'Chonk Cat',            v:'chonky',  size:'L', price:28, sales:98,  new:0, badge:'best', bundleTiers:[],            colorsAvailable:ALL9, img:'US8b84684e083da2/design/a10a0453f876e2aa.png',        desc:'A gloriously round cat with a face that says it has never once been told no. 95mm tall, prints solid, sits flat on any shelf.', /*TODO*/ weightOz:9, boxClass:'box-L', stock:12},
  {id:2, h:'just-a-fat-cat',       t:'Just A Fat Cat',       v:'chonky',  size:'M', price:26, sales:71,  new:0, badge:'',     bundleTiers:[[2,1],[7,2],[13,3]],colorsAvailable:ALL9, img:'US1958705a9b055b/design/7f6591f6a3701033.png',        desc:'No pose, no gimmick, just a very large cat. Smooth surfaces, no visible layer lines on the belly.', /*TODO*/ weightOz:5, boxClass:'box-M', stock:25},
  {id:3, h:'sleepy-chonk',         t:'Sleepy Chonk',         v:'chonky',  size:'M', price:26, sales:84,  new:0, badge:'',     bundleTiers:[[2,1],[7,2],[13,3]],colorsAvailable:ALL9, img:'US423f6abd75703/design/76fc93bdb5a4970c.jpeg',        desc:'Curled, paws tucked, fully asleep. The one people pick up and refuse to put down.', /*TODO*/ weightOz:5, boxClass:'box-M', stock:25},
  {id:4, h:'chibi-sitting-cat',    t:'Chibi Sitting Cat',    v:'chibi',   size:'M', price:22, sales:91,  new:0, badge:'best', bundleTiers:[[2,1],[7,2],[13,3]],colorsAvailable:ALL9, img:'USd27d295167c1da/design/2025-07-23_5d4511eb5ffbd8.png', desc:'Big head, tiny paws, tail wrapped round the side. 70mm — the easiest one to start a shelf with.', /*TODO*/ weightOz:5, boxClass:'box-M', stock:25},
  {id:5, h:'yawning-chibi-cat',    t:'Yawning Chibi Cat',    v:'chibi',   size:'M', price:22, sales:77,  new:1, badge:'new',  bundleTiers:[[2,1],[7,2],[13,3]],colorsAvailable:ALL9, img:'USa8052536c37dcd/design/2025-09-10_b13d6265afd3c.png',  desc:'Caught mid-yawn with its jaw wide open. Reads instantly from across a room.', /*TODO*/ weightOz:5, boxClass:'box-M', stock:25},
  {id:6, h:'stretching-chibi-cat', t:'Stretching Chibi Cat', v:'chibi',   size:'M', price:26, sales:62,  new:1, badge:'',     bundleTiers:[[2,1],[7,2],[13,3]],colorsAvailable:ALL9, img:'USbfedd9c3c494fc/design/2025-09-05_ab666ee339217.png',  desc:'Front paws forward, back arched. A long, low silhouette that suits a shelf edge.', /*TODO*/ weightOz:5, boxClass:'box-M', stock:25},
  {id:7, h:'flexi-cat-keychain',   t:'Flexi Cat Keychain',   v:'flexi',   size:'S', price:12, sales:120, new:0, badge:'bogo', bundleTiers:[[3,1],[16,5],[40,10]],colorsAvailable:ALL9, img:'US6b941ba8302236/design/2c7d72fa7a1a4499.png',        desc:'Articulated spine, printed in one piece. Clips to a bag and wiggles the whole way there.', /*TODO*/ weightOz:2, boxClass:'poly-S', stock:40},
  {id:8, h:'eggo-flexi-cat',       t:'EGGO Flexi Cat',       v:'flexi',   size:'M', price:18, sales:66,  new:1, badge:'new',  bundleTiers:[[2,1],[7,2],[13,3]],colorsAvailable:ALL9, img:'USc93f92f737d9f9/design/7a063b158d3ec0d1.jpg',        desc:'A chunkier flexi with deeper segments. More satisfying in the hand, still pocket sized.', /*TODO*/ weightOz:5, boxClass:'box-M', stock:25},
  {id:9, h:'flexi-cat-toy',        t:'Flexi Cat Toy',        v:'flexi',   size:'S', price:16, sales:54,  new:0, badge:'',     bundleTiers:[[3,1],[16,5],[40,10]],colorsAvailable:ALL9, img:'US87ee968d70c396/design/854ab97a1aaa6e15.jpg',        desc:'The desk-sized flexi. Big enough to fidget with properly, no keyring loop.', /*TODO*/ weightOz:2, boxClass:'poly-S', stock:0},
  {id:10,h:'polyart-cat',          t:'Polyart Cat',          v:'lowpoly', size:'L', price:30, sales:47,  new:0, badge:'',     bundleTiers:[],            colorsAvailable:ALL9, img:'USee1f05ca8ad757/design/2026-01-02_74299a8008cdf8.jpeg',desc:'Faceted, geometric, deliberately not cute. Looks like sculpture in a matte finish.', /*TODO*/ weightOz:9, boxClass:'box-L', stock:12},
  {id:11,h:'low-poly-kitten',      t:'Low Poly Kitten',      v:'lowpoly', size:'M', price:24, sales:88,  new:0, badge:'',     bundleTiers:[[2,1],[7,2],[13,3]],colorsAvailable:ALL9, img:'US9ac748e1f44cbe/design/2025-06-25_8c2c08fed57e18.png', desc:'A smaller, softer take on the faceted style. Prints support-free.', /*TODO*/ weightOz:5, boxClass:'box-M', stock:25},
  {id:12,h:'knitted-cat-and-heart',t:'Knitted Cat & Heart',  v:'knitted', size:'M', price:25, sales:73,  new:0, badge:'',     bundleTiers:[[2,1],[7,2],[13,3]],colorsAvailable:ALL9, img:'USa0cdd547441cc5/design/1296df07d3400d57.jpg',        desc:'Printed knit texture over the whole body, holding a heart. Reads handmade, not printed.', /*TODO*/ weightOz:5, boxClass:'box-M', stock:25},
  {id:13,h:'valentine-cats',       t:'Valentine Cats',       v:'knitted', size:'M', price:27, sales:59,  new:0, badge:'',     bundleTiers:[[2,1],[7,2],[13,3]],colorsAvailable:ALL9, img:'US392726ce369e51/design/75b7f3689637e1d6.jpg',        desc:'Sold as a pair, each with a heart-tipped tail. Seasonal — back for February.', /*TODO*/ weightOz:5, boxClass:'box-M', stock:0},
  {id:14,h:'cat-mage',             t:'Cat Mage',             v:'witchy',  size:'L', price:32, sales:41,  new:1, badge:'new',  bundleTiers:[],            colorsAvailable:ALL9, img:'USb8026e4b9070a5/design/928c0adb2e327397.png',        desc:'Staff, hat, and a deeply unimpressed expression. Scales to 28mm for the tabletop.', /*TODO*/ weightOz:9, boxClass:'box-L', stock:12},
  {id:15,h:'cat-on-the-moon',      t:'Cat On The Moon',      v:'witchy',  size:'L', price:34, sales:69,  new:0, badge:'',     bundleTiers:[],            colorsAvailable:ALL9, img:'US416f1196034dc/design/2025-07-04_0adc6d211b9ea8.jpg',  desc:'Perched on a crescent, 140mm tall. Our biggest piece and the best gift in the range.', /*TODO*/ weightOz:12,boxClass:'box-L', stock:12},
  {id:16,h:'monitor-buddy',        t:'Monitor Buddy',        v:'chibi',   size:'M', price:18, sales:95,  new:1, badge:'best', bundleTiers:[[2,1],[7,2],[13,3]],colorsAvailable:ALL9, img:'US92596077edfe56/design/bf532d11dd01e816.png',        desc:'Weighted paws hook over the top edge of a screen. Fits monitors and laptops up to 12mm.', /*TODO*/ weightOz:5, boxClass:'box-M', stock:25},
  {id:17,h:'cat-phone-holder',     t:'Cat Phone Holder',     v:'chibi',   size:'M', price:20, sales:58,  new:0, badge:'',     bundleTiers:[[2,1],[7,2],[13,3]],colorsAvailable:ALL9, img:'US931592a14e2589/design/2025-09-07_14593a0d045d88.jpg', desc:'Two-part slot-together stand, no glue. Holds a phone upright or landscape.', /*TODO*/ weightOz:5, boxClass:'box-M', stock:25},
  {id:18,h:'cat-ring-holder',      t:'Cat Ring Holder',      v:'lowpoly', size:'S', price:17, sales:44,  new:0, badge:'',     bundleTiers:[[3,1],[16,5],[40,10]],colorsAvailable:ALL9, img:'US7ea5f81d2d5672/design/0b5ed54000f4c3eb.png',        desc:'The tail is the ring post. Weighted base so it does not tip when you grab a ring.', /*TODO*/ weightOz:3, boxClass:'poly-S', stock:40},
  {id:19,h:'cat-paw-keychain',     t:'Cat Paw Keychain',     v:'flexi',   size:'S', price:10, sales:110, new:0, badge:'bogo', bundleTiers:[[3,1],[16,5],[40,10]],colorsAvailable:ALL9, img:'US3844e8ad64d1c5/design/2025-03-30_9b5f916808dd7.jpg', desc:'A clicky paw with a satisfying snap. Optional recess inside for an NFC tag.', /*TODO*/ weightOz:1, boxClass:'poly-S', stock:40},
  {id:20,h:'cat-clicker',          t:'Cat Clicker',          v:'chonky',  size:'S', price:15, sales:102, new:1, badge:'best', bundleTiers:[[3,1],[16,5],[40,10]],colorsAvailable:ALL9, img:'US13c90689edb9dd/design/7c22f4c81f77549b.png',        desc:'Press the belly. That is the whole product, and it is extremely hard to stop doing.', /*TODO*/ weightOz:2, boxClass:'poly-S', stock:40}
];

/* Derived fields + a cheap integrity check so a bad hand-edit fails
   loudly at build/boot time instead of silently mispricing an order. */
const BY_HANDLE = {};
PRODUCTS.forEach(p => {
  p.imgUrl = im(p.img);
  p.sku = 'RP-' + String(p.id).padStart(4, '0');
  if (BY_HANDLE[p.h]) throw new Error('catalog: duplicate handle ' + p.h);
  if (!(p.price > 0)) throw new Error('catalog: bad price on ' + p.h);
  if (!VIBES[p.v]) throw new Error('catalog: unknown vibe "' + p.v + '" on ' + p.h);
  p.colorsAvailable.forEach(c => {
    if (COLOR_KEYS.indexOf(c) === -1) throw new Error('catalog: unknown color "' + c + '" on ' + p.h);
  });
  BY_HANDLE[p.h] = p;
});

/* ================================================================
   BUNDLE PRICING
   tiers: [[unitsReceived, unitsPaid], ...] — e.g. [[2,1],[15,5]]
   The largest tier is applied first as many whole times as it fits,
   the remainder falls through to smaller tiers, and anything still
   left over is charged at full price.
   ================================================================ */
/* If a product's tiers leave a "remainder" gap, buying one MORE unit can
   cost LESS than the current quantity (e.g. 12 @ $26 = $130, but 13 = $78).
   Two ways to handle that, and they are a pricing decision:

     MONOTONIC_PRICING = false  (current)
       Charge exactly the tiers as written. The product page shows a nudge
       offering the better quantity, so nobody overpays without being told.

     MONOTONIC_PRICING = true
       Never charge more than a larger quantity would cost. The shopper at
       12 simply pays the 13-unit price. Lower revenue in those gaps, but
       the price curve never goes backwards.

   Flip this one constant to switch; storefront, cart and Stripe all follow. */
const MONOTONIC_PRICING = false;

/* Drop nonsense tiers rather than trusting them, largest first. */
function validTiers(tiers) {
  return (Array.isArray(tiers) ? tiers : [])
    .filter(t => Array.isArray(t) && t[0] > 1 && t[1] >= 0 && t[1] < t[0])
    .slice()
    .sort((a, b) => b[0] - a[0]);
}

/* Largest tier applied as many whole times as it fits, remainder falls
   through to smaller tiers, anything still left is charged at full price. */
function rawUnitsPaid(qty, sorted) {
  let left = Math.max(0, Math.floor(qty) || 0), paid = 0;
  for (const [received, payFor] of sorted) {
    const n = Math.floor(left / received);
    if (!n) continue;
    paid += n * payFor;
    left -= n * received;
  }
  return paid + left;
}

function unitsPaid(qty, tiers) {
  const sorted = validTiers(tiers);
  const q = Math.max(0, Math.floor(qty) || 0);
  if (!sorted.length) return q;
  let paid = rawUnitsPaid(q, sorted);
  if (MONOTONIC_PRICING) {
    const span = sorted[0][0];
    for (let n = q + 1; n <= q + span; n++) paid = Math.min(paid, rawUnitsPaid(n, sorted));
  }
  return paid;
}

function freeUnits(qty, tiers) { return Math.max(0, Math.floor(qty) || 0) - unitsPaid(qty, tiers); }

/* The nearest larger quantity that costs strictly less than `qty` does.
   Powers the "add one more and pay less" nudge. null when there isn't one. */
function betterDeal(qty, tiers) {
  const sorted = validTiers(tiers);
  const q = Math.max(1, Math.floor(qty) || 0);
  if (!sorted.length || MONOTONIC_PRICING) return null;
  const cost = rawUnitsPaid(q, sorted);
  const span = sorted[0][0];
  for (let n = q + 1; n <= q + span; n++) {
    const c = rawUnitsPaid(n, sorted);
    if (c < cost) return { qty: n, paid: c, saves: cost - c };
  }
  return null;
}

/* Human label for a tier, used by the product page buttons and the
   policies table. [15,5] -> "Buy 5 get 10". */
function tierLabel(received, payFor) {
  return 'Buy ' + payFor + ' get ' + (received - payFor);
}

return {
  VIBES, COLORS, COLOR_KEYS, COLOR_LABEL, ADDONS, PRODUCTS, BY_HANDLE,
  SIZE_TIERS, FREE_SHIP, unitsPaid, freeUnits, tierLabel, betterDeal,
  validTiers, MONOTONIC_PRICING
};
});

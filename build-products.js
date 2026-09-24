/* ================================================================
   build-products.js — static site builder for the cat shop.
   Run:  node build-products.js

   Generates:
     products/<handle>.html   one page per product (data from assets/rp.js)
     pages/policies.html      shipping + returns + custom + bundles
     pages/faq.html
     pages/contact.html
     pages/privacy.html

   Header/footer chrome lives in ONE place below so all 24 pages
   stay in sync. Re-run after editing products or policy copy.
   ================================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SUPPORT_EMAIL = 'realizedprints@gmail.com';
const BIZ = 'Realized Prints LLC';
const ADDR = '60 Hickory Drive, Basking Ridge, NJ';
const UPDATED = 'August 17, 2026';

/* Same catalog module the storefront and api/checkout.js read, so the
   generated pages, the cart and the Stripe line items cannot drift. */
const CATALOG = require('./assets/catalog.js');
const { PRODUCTS, VIBES, ADDONS, GIFTS, FREE_SHIP, BY_HANDLE, SIZE_BUNDLES, priceFor, savingAt, imgSrc, BUILD_ID } = CATALOG;

/* Every distinct bundle tier actually in use, so the policies table and
   the FAQ describe the real offer instead of a stale hardcoded list. */
/* The distinct ladder shapes in use, for the policies page. */
const LADDERS = Object.entries(SIZE_BUNDLES).map(([size, rows]) => [size, rows]);

/* Site-wide bestseller ranking, used by every product page's "You may also
   like" row. `sales` is currently seeded placeholder data — see the
   BESTSELLERS note in DEPLOY-NOTES.md for the plan to feed it real orders. */
const BESTSELLERS = PRODUCTS
  .filter(x => x.stock > 0)
  .slice()
  .sort((a, b) => b.sales - a.sales || a.id - b.id);

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
/* Product images are local files under images/. Generated pages live one
   level down, so they must resolve against their own base — see imgSrc()
   in assets/catalog.js. */
const imgUrl = (p, b) => imgSrc(p, b || '');

/* ================================================================
   SHARED CHROME  (b = path back to site root, e.g. '../')
   ================================================================ */
/* Real accounts only — a dead href="#" next to "Follow us @realizedprints"
   reads as an abandoned shop. Add Facebook back here if an account is made. */
const SOCIALS = [
  ['ig', 'Instagram', 'https://instagram.com/realizedprints'],
  ['tt', 'TikTok',    'https://tiktok.com/@realizedprints'],
  ['yt', 'YouTube',   'https://youtube.com/@realizedprints'],
];
const socLinks = cls => SOCIALS.map(([k, label, url]) =>
  `<a class="${cls}" href="${url}" target="_blank" rel="noopener noreferrer" aria-label="${label}">${SOC_SVG[k]}</a>`).join('');

const SOC_SVG = {
  ig:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="3.6"/><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none"/></svg>',
  tt:'<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 3c.3 2.2 1.6 3.6 3.8 3.8v2.6c-1.3.1-2.5-.2-3.8-.9v5.9c0 4.6-4.4 6.9-8 5-2.3-1.3-3.1-4.4-1.8-6.8 1-1.9 3.2-2.9 5.4-2.5v2.8c-.4-.1-.8-.2-1.2-.2-1.3 0-2.4 1.1-2.4 2.4s1.1 2.4 2.4 2.4 2.4-1 2.4-2.4V3h3.2z"/></svg>',
  fb:'<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M14 9h2.5V6H14c-2.2 0-3.6 1.5-3.6 3.7V11H8.5v3h1.9v7h3v-7h2.3l.4-3h-2.7V9.9c0-.6.3-.9.6-.9z"/></svg>',
  yt:'<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21.6 7.2c-.2-.9-.9-1.6-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4c-.9.2-1.6.9-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.8c.2.9.9 1.6 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5 3-5 3z"/></svg>'
};

const head = (b, title, desc) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="icon" href="${b}images/RPLogo_favicon.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
<link href="${b}assets/rp.css" rel="stylesheet">
<link rel="icon" type="image/jpeg" href="${b}images/bp-logo.jpg">
<!-- Cat Scratchers palette override — rp.css is shared with the rest of
     the Realized Prints umbrella (Catan Artisan, Meow Meow, Custom
     Figurines), so its own file stays untouched. Every rp.css rule reads
     these same custom-property names, so redefining them here recolors
     every generated page (this one included) to match the live
     Cat Scratchers brand without forking the stylesheet. -->
<style>
:root{
  --blue:#3f8ee8; --blue-600:#1f66b8; --blue-300:#8dc4f6; --blue-50:#eaf4ff; --blue-100:#dcecff; --blue-200:#c3d9fb; --blue-900:#12305e;
  --pink:#ef8a2e; --pink-600:#d16f16; --pink-300:#f7bd85; --pink-50:#fff3e6; --pink-200:#fad2a8;
  /* pink-900/pink-100 are the footer's bg/text pair (rp.css's own comment
     calls this out as the swap point) — navy, to match the rest of the
     site's footer, not another orange. */
  --pink-900:#1f3a5c; --pink-100:#c9d8ea;
  --yellow:#ffcf3f; --mint:#4fa156; --mint-100:#dcefd9; --mint-200:#bfe3b8; --mint-800:#265c2e; --mint-900:#173f1f;
  --grape:#a855f7; --tangerine:#ff8a3d;
  --ink:#1f3a5c; --ink-2:#35547a; --muted:#6b7f97;
  --paper:#fff; --paper-2:#f2f8ff; --line:#dde6f0;
  --shadow:0 2px 4px rgba(31,58,92,.05), 0 12px 28px -14px rgba(63,142,232,.30);
  --shadow-lift:0 4px 8px rgba(31,58,92,.07), 0 28px 54px -22px rgba(239,138,46,.45);
}
/* Disabled for now, same as the rest of the site — delete this rule to
   bring the countdown bar back. */
.drop-bar{display:none}
</style>
</head>
<body data-base="${b}">`;

const chromeTop = b => `
<div class="drop-bar" id="dropBar">
  <div class="drop-in">
    <span class="drop-label">Next Inventory Drop</span>
    <div class="cd" id="cd" aria-live="polite"></div>
    <span class="drop-when" id="dropWhen">—</span>
  </div>
  <button class="drop-x" id="dropX" aria-label="Dismiss">
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M6 6l12 12M18 6L6 18"/></svg>
  </button>
</div>

<div class="marquee" aria-label="Store highlights"><div class="mq-track" id="mqTrack"></div></div>

<header class="head-main">
  <div class="wrap head-row">
    <div class="head-left">
      <a class="ibtn" href="${b}index.html#templates" aria-label="Search">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>
      </a>
      <div class="soc">${socLinks('ibtn')}</div>
    </div>
    <a class="brand" href="${b}index.html">
      <span class="brand-name">Cat Scratchers</span>
      <span class="brand-sub">by Realized Prints</span>
    </a>
    <div class="head-right">
      <button class="ibtn" id="cartBtn" aria-label="Open cart">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M6 7h12l-1.2 12H7.2z"/><path d="M9 7a3 3 0 016 0"/></svg>
        <span class="cart-pill" id="cartPill">0</span>
      </button>
    </div>
  </div>
</header>

<!-- The same links as the hand-designed Cat Scratchers pages, in the same
     order, so the nav does not change shape when a customer crosses from
     index.html into a generated page. Cattoo is deliberately not linked
     here — pulled site-wide for now, same as everywhere else. The old
     "Shop" dropdown is gone: it was built at runtime from the catalog's
     vibes and pointed at /products/ pages that no longer exist. rp.js
     mountShopDropdown() no-ops without #shopDrop. -->
<nav class="nav-strip" aria-label="Main">
  <div class="wrap nav-in">
    <div><a class="nlink" href="${b}pages/contact.html">Contact Us</a></div>
    <div><a class="nlink" href="${b}index.html#templates">Scratchers</a></div>
    <div><a class="nlink" href="${b}cc-partner.html">Affiliates</a></div>
    <div><a class="nlink" href="${b}pages/policies.html#faq">FAQ</a></div>
  </div>
</nav>`;

const cartDrawer = () => `
<div class="cart-ov" id="cartOv"></div>
<aside class="cart" id="cart" aria-label="Cart">
  <div class="cart-h">
    <h3>Your cart</h3>
    <button class="ibtn" id="cartClose" aria-label="Close cart">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
  </div>
  <div class="cart-body" id="cartBody"></div>
  <div class="cart-f" id="cartFoot" style="display:none">
    <div class="cart-tot"><span>Subtotal</span><span id="cartTotal">$0</span></div>
    <button class="pay-shop" id="expressPay">Express checkout</button>
    <button class="btn btn-ghost btn-block" id="checkoutBtn">Check out</button>
    <span class="pay-alt">Link · Apple Pay · Google Pay · Card</span>
    <p class="cart-err" id="cartErr" style="display:none"></p>
  </div>
</aside>`;

const footer = b => `
<footer class="foot">
  <div class="wrap">
    <div class="foot-g">
      <div>
        <div class="foot-brand">Realized Prints</div>
        <p class="foot-note">Husband &amp; wife, printed in the USA. Made in 1–2 business days, ships in 3–5.</p>
        <div class="foot-soc">${socLinks('')}</div>
      </div>
      <div><h4>Shop</h4><ul>
        <li><a href="${b}index.html#templates">Scratchers</a></li>
        <li><a href="${b}cc-refills.html">Refill inserts</a></li>
      </ul></div>
      <div><h4>Other lines</h4><ul>
        <li><a href="${b}catan/">Catan Artisan</a></li>
        <li><a href="${b}meowmeow.html">Meow Meow Blind Bags</a></li>
        <li><a href="${b}CustomFigurines.html">Custom Figurines</a></li>
      </ul></div>
      <div><h4>Help</h4><ul>
        <li><a href="${b}pages/policies.html#shipping">Shipping</a></li>
        <li><a href="${b}pages/policies.html#returns">Returns</a></li>
        <li><a href="${b}pages/policies.html#faq">FAQ</a></li>
        <li><a href="${b}pages/terms.html">Terms</a></li>
        <li><a href="${b}pages/privacy.html">Privacy</a></li>
        <li><a href="${b}pages/contact.html">Contact</a></li>
      </ul></div>
    </div>
    <div class="foot-b">
      <span>© 2026 Realized Prints · Husband &amp; wife, printed in the USA.</span>
      ${CATALOG.ALL_PHOTOS_REAL() ? '' : '<span>Product imagery is placeholder.</span>'}
    </div>
  </div>
</footer>
<script src="${b}assets/catalog.js"></script>
<script src="${b}assets/rp.js"></script>`;

/* ================================================================
   PRODUCT PAGE
   ================================================================ */
/* The free-gift ladder is empty in v1 (see the note in assets/catalog.js), so
   this block renders nothing at all rather than promising a gift that
   giftsFor() will never grant. Fill GIFTS and it comes back on its own. */
function giftBlock() {
  const rows = GIFTS.filter(g => BY_HANDLE[g.handle]);
  if (!rows.length) return '';
  const line = rows
    .map(g => `$${g.minSpend}+ for a free ${esc(BY_HANDLE[g.handle].t)}`)
    .join(', or ');
  return `      <div class="pdp-gift" id="pdpGift">
        Free gift with every order over $${rows[0].minSpend}
        <span>Spend ${line}.</span>
      </div>`;
}

function productPage(p) {
  const v = VIBES[p.v];
  /* One shared bestseller row on every product page, ranked by `sales`, so
     the same hero products get promoted site-wide instead of each page
     pushing its own vibe-mates. */
  const rel = BESTSELLERS.filter(x => x.id !== p.id).slice(0, 5);
  const b = '../';
  /* Bundle buttons are rendered from the product's own tiers, smallest
     first, so a product can carry any combination without a code change. */
  /* Smallest first. A tier we could not fulfil from stock is hidden rather
     than shown and then rejected by the checkout endpoint. */
  /* Explicit [quantity, total price] rungs. A rung we could not fulfil from
     stock is hidden rather than offered and then rejected at checkout. */
  const tiers = (p.bundlePrices || [])
    .filter(([qty]) => qty <= p.stock)
    .slice()
    .sort((a, x) => a[0] - x[0]);

  return `<!-- products/${p.h}.html — generated by build-products.js. Do not edit by hand. -->
${head(b, p.t + ' — Realized Prints', p.desc)}
${chromeTop(b)}
<div class="wrap">
  <nav class="crumb" aria-label="Breadcrumb">
    <a href="${b}index.html">Home</a> / <a href="${b}index.html#templates">${esc(v.name)}</a> / ${esc(p.t)}
  </nav>

  <div class="pdp">
    <div class="pdp-gal">
      <div class="pdp-main">
        ${p.photoReal ? '' : '<span class="stage-ph">Placeholder</span>'}
        <img id="galMain" src="${imgUrl(p, b)}" alt="${esc(p.t)}">
      </div>
      <div class="pdp-thumbs" id="galThumbs"></div>
    </div>

    <div class="pdp-buy">
      <div class="pdp-vibe">${esc(v.name)}</div>
      <h1>${esc(p.t)}</h1>
      <div class="pdp-price">$${p.price}.00 USD</div>
      <div class="pdp-ship">Shipping calculated at checkout · Made in 1–2 business days, ships in 3–5</div>
      <div class="pdp-sku">SKU: ${p.sku || 'RP-' + String(p.id).padStart(4,'0')}</div>
      <div class="pdp-free">Free USPS Ground Advantage shipping on U.S. orders $${FREE_SHIP}+</div>
      <p class="pdp-desc">${esc(p.desc)}</p>

      <div class="opt-t">Core animal color — <span id="colorName"></span></div>
      <div class="co-row" id="colorRow"></div>

      <div class="opt-t">Custom add-ons</div>
      <label class="addon">
        <input type="checkbox" id="addName">
        <span><span class="addon-t">${esc(ADDONS.name.label)}</span><span class="addon-d">Engraved into the base</span></span>
        <span class="addon-p">+$${ADDONS.name.price}</span>
      </label>
      <input class="nameft" id="nameField" type="text" placeholder="Your cat's name" maxlength="18">
${tiers.length ? `
      <div class="opt-t">Bundle &amp; save</div>
      <div class="tiers" id="tiers">
${tiers.map(([qty, total]) =>
`        <button class="tier" data-q="${qty}" aria-pressed="${qty === 1}">${p.price * qty - total > 0 ? '<span class="tier-free">SAVE $' + (p.price * qty - total) + '</span>' : ''}<b>${qty} for $${total}</b><i class="tier-ea">$${(total / qty).toFixed(2)} each</i></button>`).join('\n')}
      </div>` : ''}

${giftBlock()}

      <div class="qty-row">
        <div class="qty">
          <button id="qMinus" aria-label="Decrease quantity">−</button>
          <span id="qVal">1</span>
          <button id="qPlus" aria-label="Increase quantity">+</button>
        </div>
        <span class="p-total" id="pTotal">$0</span>
      </div>
      <div class="savenote" id="saveNote"></div>
      <button class="nudge" id="nudge" type="button" hidden></button>

      ${p.stock > 0
        ? `<button class="btn btn-pink btn-block" id="buyNow">Buy it now</button>
      <button class="btn btn-ghost btn-block" id="addCart">Add to cart</button>
      <span class="pay-alt">Link · Apple Pay · Google Pay · Card</span>
      <p class="cart-err" id="pdpErr" style="display:none"></p>`
        : '<div class="pdp-oos">Sold out — back on the next drop</div>'}

      <p style="font-size:12.5px;color:var(--muted);margin-top:14px">
        Made to order — see <a href="${b}pages/policies.html#returns" style="color:var(--blue);font-weight:700">returns</a>
        and <a href="${b}pages/policies.html#shipping" style="color:var(--blue);font-weight:700">shipping</a>.
      </p>
    </div>
  </div>

  <section class="rowsec">
    <h2>You may also like</h2>
    <div class="grid" id="relGrid"></div>
  </section>
</div>
${cartDrawer()}
${footer(b)}
<script>
/* Built against catalog ${BUILD_ID}. If the browser loaded a different
   catalog than this page was generated from, say so instead of silently
   half-working — a stale page used to freeze the price and bundle buttons
   while the quantity stepper kept moving. */
if (RP.BUILD_ID !== ${JSON.stringify(BUILD_ID)}) {
  console.error('Realized Prints: this page was built from catalog ${BUILD_ID} '
    + 'but assets/catalog.js is ' + RP.BUILD_ID + '. Run: node build-products.js');
  /* The warning must never be the thing that breaks the page. */
  try {
    var stale = document.createElement('div');
    stale.className = 'stale-warn';
    stale.textContent = 'This page is out of date — please refresh. If it persists, the site needs rebuilding.';
    document.body.insertBefore(stale, document.body.firstChild);
  } catch (e) { /* console.error above is enough */ }
}
const PROD = RP.BY_HANDLE[${JSON.stringify(p.h)}];
const REL_IDS = ${JSON.stringify(rel.map(r => r.id))};
/* Only the colors this product actually ships in. */
const COLORS = RP.COLORS.filter(c => PROD.colorsAvailable.indexOf(c[0]) !== -1);
let color = COLORS[0], qty = 1;

const THUMBS = [RP.imgSrc(PROD, RP.BASE), ...REL_IDS.slice(0,3).map(id => RP.imgSrc(RP.PRODUCTS.find(x=>x.id===id), RP.BASE))];
document.getElementById('galThumbs').innerHTML = THUMBS.map((src,i) =>
  '<button aria-pressed="'+(i===0)+'" data-src="'+src+'"><img src="'+src+'" alt="View '+(i+1)+'"></button>').join('');
document.getElementById('galThumbs').addEventListener('click', e => {
  const b = e.target.closest('button'); if(!b) return;
  document.getElementById('galMain').src = b.dataset.src;
  document.querySelectorAll('#galThumbs button').forEach(x=>x.setAttribute('aria-pressed','false'));
  b.setAttribute('aria-pressed','true');
});

document.getElementById('colorRow').innerHTML = COLORS.map(([k,label,cls],i) =>
  '<button class="co-btn '+cls+'" data-c="'+i+'" aria-pressed="'+(i===0)+'" aria-label="'+label+'" title="'+label+'"></button>').join('');
document.getElementById('colorName').textContent = color[1];
document.getElementById('colorRow').addEventListener('click', e => {
  const b = e.target.closest('.co-btn'); if(!b) return;
  color = COLORS[Number(b.dataset.c)];
  document.querySelectorAll('#colorRow .co-btn').forEach(x=>x.setAttribute('aria-pressed','false'));
  b.setAttribute('aria-pressed','true');
  document.getElementById('colorName').textContent = color[1];
});

function unitPrice(){
  return PROD.price
    + (document.getElementById('addName').checked ? RP.ADDONS.name.price : 0);
}
function itemForCart(){
  return {
    h: PROD.h, qty, color: color[0],
    name: document.getElementById('addName').checked
      ? (document.getElementById('nameField').value.trim() || 'name TBC') : ''
  };
}
function refresh(){
  /* Everything is computed before anything is written, so a failure can't
     leave the quantity updated while the price stays stale. */
  const addons = (document.getElementById('addName').checked ? RP.ADDONS.name.price : 0);
  /* Every second scratcher is 40% off. That is an order-level rule, so it is
     not in PROD.bundlePrices — without this line the page would quote $118 for
     two while Stripe charged $94.40. */
  const orderOff = RP.secondUnitDiscount([{ handle: PROD.h, qty: qty }]);
  const due = RP.priceFor(PROD, qty) + addons * qty - orderOff;
  const was = (PROD.price + addons) * qty;
  const saved = was - due;
  document.getElementById('qVal').textContent = qty;
  document.getElementById('pTotal').innerHTML = saved > 0
    ? '<span class="was">'+RP.money(was)+'</span>'+RP.money(due) : RP.money(due);
  document.getElementById('saveNote').textContent = saved > 0
    ? 'You save '+RP.money(saved)+' on '+qty : '';
  document.getElementById('nameField').classList.toggle('show', document.getElementById('addName').checked);
  const tiers = document.getElementById('tiers');
  if (tiers) tiers.querySelectorAll('.tier').forEach(t =>
    t.setAttribute('aria-pressed', String(Number(t.dataset.q) === qty)));

  /* These tiers charge the remainder at full price, so some quantities cost
     more than a slightly larger one. Offer the better deal rather than let
     someone overpay without knowing. */
  const gift = document.getElementById('pdpGift');
  if (gift) {
    const earned = RP.giftsFor(due), nxt = RP.nextGift(due);
    const got = earned.map(g => RP.BY_HANDLE[g.handle].t);
    gift.innerHTML = got.length
      ? '🎁 Free ' + got.join(' + ') + ' included'
        + (nxt ? '<span>Add ' + RP.money(nxt.minSpend - due) + ' more for a free ' + RP.BY_HANDLE[nxt.handle].t + ' too.</span>' : '')
      : '🎁 Free gift on orders over $' + nxt.minSpend
        + '<span>Add ' + RP.money(nxt.minSpend - due) + ' more for a free ' + RP.BY_HANDLE[nxt.handle].t + '.</span>';
  }

  const nudge = document.getElementById('nudge');
  const deal = RP.betterDeal(PROD, qty);
  if (nudge) {
    if (deal && deal.qty <= PROD.stock) {
      nudge.hidden = false;
      nudge.dataset.q = deal.qty;
      nudge.textContent = 'Take ' + deal.qty + ' for the same price';
    } else {
      nudge.hidden = true;
    }
  }
}
document.getElementById('qPlus').onclick  = () => { qty++; refresh(); };
document.getElementById('qMinus').onclick = () => { if(qty>1) qty--; refresh(); };
document.getElementById('addName').onchange  = refresh;
const tiersEl = document.getElementById('tiers');
if (tiersEl) tiersEl.addEventListener('click', e => {
  const t = e.target.closest('.tier'); if(!t) return;
  qty = Number(t.dataset.q); refresh();
});
const nudgeEl = document.getElementById('nudge');
if (nudgeEl) nudgeEl.onclick = () => { qty = Number(nudgeEl.dataset.q); refresh(); };

/* Only the handle, color key, qty and add-ons ever leave this page. Title,
   image and price are looked up from the catalog on render, and the server
   reprices from the same catalog at checkout. */
const add = document.getElementById('addCart');
if (add) add.onclick = () => RP.addToCart(itemForCart());

/* Buy it now skips the cart entirely and opens Stripe Checkout with just
   this configuration. */
const buy = document.getElementById('buyNow');
if (buy) buy.onclick = () => RP.buyNow(itemForCart(), buy, document.getElementById('pdpErr'));
document.getElementById('relGrid').innerHTML =
  REL_IDS.map(id => RP.cardHTML(RP.PRODUCTS.find(x=>x.id===id))).join('');
refresh();
</script>
</body>
</html>
`;
}

/* ================================================================
   CONTENT PAGES
   ================================================================ */
function contentPage({file, title, desc, heroTitle, heroLede, updated, jump, body, wide}) {
  const b = '../';
  return `<!-- pages/${file} — generated by build-products.js. Do not edit by hand. -->
${head(b, title, desc)}
${chromeTop(b)}
<section class="page-hero">
  <div class="wrap">
    <h1>${heroTitle}</h1>
    <p>${heroLede}</p>
    ${updated ? `<div class="updated">Last updated ${updated}</div>` : ''}
  </div>
</section>

<div class="wrap">
${wide ? `<div style="padding:38px 0 20px">${body}</div>` : `  <div class="page-body">
    <nav class="jump" aria-label="On this page">
      <h4>On this page</h4>
      <ul>${jump.map(([id,label]) => `<li><a href="#${id}">${label}</a></li>`).join('')}</ul>
    </nav>
    <div class="prose">
${body}
    </div>
  </div>`}
</div>
${cartDrawer()}
${footer(b)}
</body>
</html>
`;
}

/* ---------- POLICIES + FAQ (one page) ----------
   pages/faq.html is now only a redirect to #faq on this page (see
   redirectPage below and vercel.json), so every answer lives in one place.
   Every price here is read from assets/catalog.js — never type one in. */
const m = n => '$' + (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, '');
const REFILL = BY_HANDLE.refill, KEYCHAIN = BY_HANDLE.keychain;
const HALF = Math.round(CATALOG.SECOND_UNIT_OFF * 100);
const refillLadder = CATALOG.packsFor(REFILL)
  .map(([q]) => `${q === 1 ? 'one pad' : q + ' pads'} for ${m(priceFor(REFILL, q))}`).join(', ');
const keyLadder = CATALOG.packsFor(KEYCHAIN)
  .map(([q]) => `${q === 1 ? 'one' : q} for ${m(priceFor(KEYCHAIN, q))}`).join(', ');
const POLICIES_UPDATED = 'September 24, 2026';

/* ---------- FAQ ----------
   Rendered as the #faq section of pages/policies.html.
   [anchor id, heading, [[question, answer, optional question id], ...]] */
const FAQ = [
  ['faq-orders', 'Orders &amp; shipping', [
    ['How long does it take?',
     '<p>1–2 business days to make once your photo arrives, then 3–5 business days in the mail. We email you photo and video updates while it\'s being made, so you\'re never left guessing.</p>'],
    ['When do I send my cat\'s photo?',
     '<p>After you order. There\'s nothing to upload before you pay. We email you, and you reply with a clear photo of each cat, plus the names you want on Homestead Buddies.</p>'],
    ['What if I don\'t send a photo straight away?',
     '<p>Your order waits on hold, and we\'ll send you a reminder or two. If we haven\'t heard from you within 30 days, we cancel and refund you in full.</p>'],
    ['Where is my order?',
     '<p>Your tracking number is in the email we send when the label is made. If tracking hasn\'t moved for 7 business days, <a href="contact.html">message us</a> and we\'ll chase it. See <a href="#shipping">lost, late or missing parcels</a>.</p>'],
    ['Can I send it to someone else as a gift?',
     '<p>Yes. Put their address as the shipping address at checkout and your own email, so the photo request and progress updates come to you. Message us if you\'d like a note put in the box.</p>'],
    ['Do you ship outside the U.S.?',
     '<p>Not yet. U.S. addresses only for now.</p>']
  ]],
  ['faq-scratcher', 'Your scratcher', [
    ['Will it look exactly like my cat?',
     '<p>Not exactly. Here\'s the honest answer:</p><ul><li>We paint the 3D model in software.</li><li>We match it as closely as we can to your cat\'s pattern.</li><li>We simplify some patterns to suit the art style.</li><li>Colours and markings come through. Fine detail does not.</li></ul>'],
    ['One cat or two: which one do I want?',
     '<p><a href="../basking-paws.html">Basking Paws</a> has one cat and no nameplate. <a href="../homestead-buddies.html">Homestead Buddies</a> has two cats and their names on the front. Only have one cat but want names? Order Homestead Buddies and tell us what you\'d like in the second spot.</p>'],
    ['How big is it?',
     '<p>Basking Paws is about 17.7 × 11.8 × 7.9 in (450 × 300 × 200 mm) and weighs around 5 lb.</p>'],
    ['How do refills work?',
     '<p>The pad lifts out and a new one drops in. No glue, no tools. Most cats need a new pad every 2 months, but most owners swap theirs about every 6. Prices: ' + refillLadder + '. <a href="../cc-refills.html">Buy refills</a>.</p>'],
    ['What if my cat ignores it?',
     '<p>Put it where they already scratch. Next to the couch or on a rug works best. A little catnip on the pad helps too. Still no luck? Message us and we\'ll help as best we can.</p>', 'faq-ignores'],
    ['Is it safe for my cat?',
     '<p>Yes, it\'s made to be scratched. Stand it on a flat, stable floor, swap the pad once it\'s shredded flat, and stop using it if any part ever comes loose. See <a href="#care">care &amp; safety</a>.</p>']
  ]],
  ['faq-problems', 'Problems', [
    ['It arrived damaged.',
     '<p>Message us within 7 days of delivery with photos of the damage, the box and the label, and we\'ll replace it free. Don\'t send it back unless we ask. <a href="#damage">Full details</a>.</p>'],
    ['A part broke after a few weeks.',
     '<p>If it failed under normal use within 30 days of delivery, we replace the part free. Past that, or if it was an accident, message us anyway. A replacement part is often cheap.</p>'],
    ['You got something wrong.',
     '<p>Wrong item, a name we misspelled, the wrong number of cats: it\'s our mistake, and we remake it free.</p>'],
    ['Can I change or cancel my order?',
     '<p>Yes, for a full refund, any time before we start making it. <a href="contact.html">Message us</a> as soon as you can.</p>']
  ]],
  ['faq-partners', 'Partners', [
    ['I run a vet clinic, shelter, pet store or sitting business. Can we work together?',
     '<p>Yes. See <a href="../cc-partner.html">partner options</a>. No stock, no packing, and you earn on every order.</p>']
  ]]
];

const policiesBody = `
<div class="callout note"><strong>The short version.</strong>
<ul>
  <li>Made in <strong>1–2 business days</strong> once your cat's photo arrives, then <strong>3–5 business days</strong> in the mail. U.S. only.</li>
  <li>Free shipping on orders over <strong>${m(FREE_SHIP)}</strong>.</li>
  <li>Arrived damaged? Tell us within <strong>7 days</strong> of delivery, with photos, and we replace it free.</li>
  <li>A part fails within <strong>30 days</strong>? Also covered.</li>
  <li>Every scratcher is made for your cat, so we can't take change-of-mind returns. You can cancel for a
      full refund any time before we start making it.</li>
</ul></div>

<h2 id="shipping">Shipping</h2>

<h3>Where we ship</h3>
<p>Any U.S. address, including Alaska, Hawaii and PO boxes. We don't ship internationally yet.</p>

<h3>How long it takes</h3>
<table>
  <tr><th>Step</th><th>Time</th></tr>
  <tr><td>You reply to our email with a photo of your cat</td><td>Whenever you're ready. Your order waits for it.</td></tr>
  <tr><td>We make your scratcher</td><td>1–2 business days after the photo arrives</td></tr>
  <tr><td>In the mail</td><td>3–5 business days</td></tr>
</table>
<p>Business days are Monday to Friday, not counting U.S. federal holidays. We email you photo and video
updates of your actual piece while it's being made, then a tracking number when it ships.</p>

<h3>Shipping cost</h3>
<p>Shipping is worked out at checkout from the size and weight of your order, and you see it before you
pay. Orders over <strong>${m(FREE_SHIP)}</strong> ship free.</p>

<h3>Tracking</h3>
<p>We email a tracking number when the label is made. The carrier's first scan can lag a day or two
behind that email. That's normal.</p>

<h3>Address mistakes</h3>
<p>Please double-check your address at checkout. Spotted a mistake? Message us straight away and we'll fix
it before the label is made. If a parcel comes back to us because of an address error, we'll send it
again. You'll only pay the new postage.</p>

<h3>Lost, late or missing parcels</h3>
<ul>
  <li><strong>Tracking hasn't moved for 7 business days?</strong> Message us. We'll chase the carrier and
      open a claim. If the carrier confirms the parcel is lost, we remake it and send it again, free.</li>
  <li><strong>Marked delivered but not there?</strong> Check around your door, with neighbours and in any
      mailroom. Then give it 48 hours, because parcels marked delivered early often turn up. Still missing?
      Message us within 7 days of the delivery scan and we'll help you file a claim with the carrier.
      Once a parcel is marked delivered to the address you gave us, we can't cover theft ourselves. Your
      homeowner's or renter's insurance may cover it.</li>
</ul>

<h2 id="orders">Orders, changes &amp; cancellations</h2>
<ul>
  <li><strong>Changes</strong> to names, coat or address are free until we start making your scratcher.
      Just message us.</li>
  <li><strong>Cancel for a full refund</strong> any time before we start making it. Once we've started,
      it's being made for your cat, so it can't be cancelled.</li>
  <li><strong>Waiting on your photo:</strong> your order stays on hold until your photo arrives, and we'll
      send you friendly reminders. If we haven't heard from you within <strong>30 days</strong>, we'll
      cancel the order and refund you in full.</li>
</ul>

<h2 id="returns">Returns &amp; refunds</h2>
<p>Every scratcher is made to order for one cat, so we can't resell it. That means
<strong>no returns for change of mind</strong>, or because your cat isn't interested yet. Before you give
up, see <a href="#faq-ignores">what to do if your cat ignores it</a>.</p>
<h3>When we make it right</h3>
<ul>
  <li>It arrived damaged, or a part failed within 30 days (see <a href="#damage">Damage &amp; defects</a>).</li>
  <li>We made a mistake: the wrong item, a name we misspelled, or the wrong number of cats.
      We remake it free.</li>
</ul>
<h3>Refill pads</h3>
<p>Unopened refill pads can be returned within 30 days of delivery. You pay the return postage, and we
refund the pads once they're back with us.</p>
<h3>How refunds are paid</h3>
<p>Refunds go back to your original payment method within 5 business days of approval. Your bank may
take another 3–10 business days to show it.</p>

<h2 id="damage">Damage &amp; defects</h2>

<h3>Damaged on arrival</h3>
<ol>
  <li>Message us within <strong>7 days of delivery</strong> through the <a href="contact.html">contact page</a>
      or by replying to your order email.</li>
  <li>Include your order reference and clear photos of <strong>the damage</strong>, <strong>the outside of
      the box</strong> and <strong>the shipping label</strong>.</li>
  <li>Keep the box and packing until we've sorted it out. The carrier sometimes asks to see them.</li>
</ol>
<p>We'll send a replacement part, or a whole new scratcher if the damage calls for it, at no cost. Don't
send anything back unless we ask.</p>

<h3>Defects within 30 days</h3>
<p>If a part breaks, splits or comes loose under normal use within 30 days of delivery, we replace that
part free. If a replacement part can't fix it, we replace the scratcher.</p>

<h3>What isn't covered</h3>
<ul>
  <li>Shredded cardboard pads. Shredding is their job, and <a href="../cc-refills.html">refills</a> replace them.</li>
  <li>Damage from chewing, drops, water, outdoor use or modifications.</li>
  <li>Normal wear: scuffs, scratches on the frame, fading in direct sun.</li>
  <li>Small differences from photos or screens (see <a href="#custom">how we match your cat</a>).</li>
</ul>

<h3>How we handle claims</h3>
<p>We reply within 1–2 business days. We may ask for another photo or a short video, and now and then
for the broken part back (we pay the postage). If we can't replace something, we refund it instead.
We look at every claim individually.</p>

<h2 id="custom">Your cat's photo &amp; personalisation</h2>
<h3>Sending your photo</h3>
<p>After you order, we email you. Reply with <strong>one clear, well-lit photo of each cat</strong>. The
whole cat in daylight works best, and asleep on a blanket is perfect. Nothing to upload before you pay.</p>
<h3>How we match your cat</h3>
<ul>
  <li>We paint the 3D model in software, matching your cat's colours and markings as closely as the art
      style allows.</li>
  <li>Some complex patterns are simplified to suit the style.</li>
  <li>Colours and markings come through. Fine fur detail does not.</li>
</ul>
<h3>Names</h3>
<p>Homestead Buddies carries your cats' names, up to 18 characters, printed exactly as you type them.
Please check the spelling. If we get it wrong, we remake it free. Basking Paws has no nameplate.</p>
<h3>Your photos stay private</h3>
<p>We use your photos only to make your order, and never post them or your finished piece without asking
first. See our <a href="privacy.html">privacy policy</a>.</p>

<h2 id="pricing">Pricing, discounts &amp; payment</h2>
<ul>
  <li>Prices are in U.S. dollars. Sales tax is added at checkout where it applies.</li>
  <li><strong>Buy one, get one ${HALF}% off:</strong> every second scratcher in the same order is ${HALF}% off,
      applied automatically to the lower-priced one.</li>
  <li><strong>Refill pads:</strong> ${refillLadder}.</li>
  <li><strong>Keychains</strong> (only with a scratcher): ${keyLadder}.</li>
  <li>Discount codes go in at checkout, one per order. We can't add a code after an order is placed.</li>
  <li>Payment runs through Stripe's secure checkout: card, Apple Pay, Google Pay or Link. We never see
      your full card number.</li>
</ul>

<h2 id="care">Care &amp; safety</h2>
<ul>
  <li>Swap the pad when it's shredded flat. Vacuum up the crumbs as you go.</li>
  <li>Wipe the frame with a damp cloth. Don't soak it.</li>
  <li>Keep it indoors, dry, and away from radiators and direct heat.</li>
  <li>Stand it on a flat, stable floor. Check it now and then, and stop using it if any part is loose or broken.</li>
  <li>It's a scratcher, not a toy for children. Keep an eye on kittens around loose bits of cardboard.</li>
</ul>

<h2 id="faq">Frequently asked questions</h2>
${FAQ.map(([id, section, items]) => `
<h3 id="${id}">${section}</h3>
${items.map(([q, a, qid]) => `<details class="acc"${qid ? ` id="${qid}"` : ''}><summary>${q}</summary><div class="acc-in">${a}</div></details>`).join('\n')}`).join('\n')}

<h2 id="contact">Still have a question?</h2>
<p>Email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> or use the
<a href="contact.html">contact page</a>. You're writing to the two people who make your scratcher, and we
reply within 1–2 business days.</p>
<p style="font-size:13px;color:var(--muted)">${BIZ} · ${ADDR}</p>
`;

/* A page that only forwards to another URL. vercel.json does the same
   redirect server-side; this file covers old links, local previews and
   any host that ignores vercel.json. */
const redirectPage = to => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>FAQ has moved</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${to}">
<meta http-equiv="refresh" content="0; url=${to}">
<script>location.replace(${JSON.stringify(to)});</script>
</head>
<body><p>Our FAQ now lives on the <a href="${to}">Policies &amp; FAQ page</a>.</p></body>
</html>
`;

/* ---------- CONTACT ---------- */
const contactBody = `
<div class="contact-grid">
  <div class="cform">
    <h2 style="font-size:1.5rem;margin-bottom:6px">Send us a message</h2>
    <p style="font-size:14.5px;color:var(--muted);margin-bottom:20px">
      We reply within 1–2 business days. For a damaged item, include your order number and photos.</p>
    <form id="contactForm" novalidate>
      <div class="cfield"><label for="cf-name">Your name</label>
        <input id="cf-name" name="name" type="text" autocomplete="name" required></div>
      <div class="cfield"><label for="cf-email">Email</label>
        <input id="cf-email" name="email" type="email" autocomplete="email" required></div>
      <div class="cfield"><label for="cf-order">Order number <span style="font-weight:600;color:var(--muted)">(if you have one)</span></label>
        <input id="cf-order" name="order" type="text" placeholder="From your order email"></div>
      <div class="cfield"><label for="cf-topic">What's this about?</label>
        <select id="cf-topic" name="topic">
          <option>Where is my order</option>
          <option>Damaged or faulty item</option>
          <option>Change or cancel an order</option>
          <option>Sending a photo of my cat</option>
          <option>Refill pads</option>
          <option>Partner application</option>
          <option>Something else</option>
        </select></div>
      <div class="cfield" aria-hidden="true" style="position:absolute;left:-9999px">
        <label for="cf-company">Company</label>
        <input id="cf-company" name="company" type="text" tabindex="-1" autocomplete="off"></div>
      <div class="cfield"><label for="cf-msg">Message</label>
        <textarea id="cf-msg" name="message" required></textarea>
        <div class="hint">Sending photos? Reply to our confirmation email and attach them there.</div></div>
      <button class="btn btn-pink btn-block" type="submit">Send message</button>
      <p id="cf-status" style="font-size:13.5px;font-weight:700;margin-top:12px;min-height:20px"></p>
    </form>
  </div>

  <div class="cinfo">
    <div class="cblock" id="about">
      <h3>Who you're talking to</h3>
      <p>We're a husband-and-wife print shop in New Jersey. There's no support team — messages come
      straight to the two of us, and we answer them between prints. If you email at 2am you'll hear
      back in the morning, not in nine business days.</p>
    </div>
    <div class="cblock">
      <h3>Email</h3>
      <p><a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a><br>
      <span style="color:var(--muted);font-size:13.5px">Replies in 1–2 business days, Mon–Fri.</span></p>
    </div>
    <div class="cblock">
      <h3>Business details</h3>
      <p>${BIZ}<br>${ADDR}</p>
    </div>
    <div class="cblock">
      <h3>Before you write in</h3>
      <p>Most questions are answered in our <a href="policies.html#faq">FAQ</a>, especially
      "where is my order" and how we match your cat. Shipping, returns and damage are all on the
      <a href="policies.html">Policies &amp; FAQ page</a>.</p>
    </div>
  </div>
</div>
`;

/* ---------- TERMS OF SERVICE ---------- */
const tosBody = `
<p>These terms cover buying from ${BIZ} ("we", "us"). Placing an order means you accept them.
We have tried to write them in plain English rather than defensive legalese — if something here
seems unfair, <a href="contact.html">tell us</a>.</p>

<h2 id="who">1. Who you're buying from</h2>
<p>${BIZ}, ${ADDR}. A husband-and-wife print shop, not a warehouse. Contact:
<a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>

<h2 id="orders">2. Orders and acceptance</h2>
<ul>
  <li>Your order is an <strong>offer to buy</strong>. It's accepted when we email your confirmation.</li>
  <li>We may decline or cancel an order and refund you in full — most often because something sold
      out between your click and our queue, or an address looks undeliverable.</li>
  <li>We ship to <strong>United States addresses only</strong> at present.</li>
  <li>Everything is <strong>made to order</strong>. Nothing sits on a shelf.</li>
</ul>

<h2 id="pricing">3. Prices and payment</h2>
<ul>
  <li>Prices are in <strong>US dollars</strong> and exclude sales tax, which is calculated at checkout.</li>
  <li>Payment is handled by <strong>Stripe</strong>. We never see or store your card number.</li>
  <li>Bundle prices are shown on each product page and applied automatically. If a quantity falls
      between two bundles you are charged whichever is cheaper.</li>
  <li>Every price is recalculated on our server at checkout. If a price is listed in error we will
      tell you before charging you, and you can cancel.</li>
  <li>Discount codes are not combinable with bundle pricing.</li>
</ul>

<h2 id="ip">4. Photos and personalisation you send us</h2>
<div class="callout warn"><strong>This section matters — please read it.</strong></div>
<ul>
  <li>You keep ownership of any photo you send for an exact pattern match.</li>
  <li>You grant us a limited licence to use that photo <strong>solely to make your order</strong>.</li>
  <li>We will <strong>never publish your photo, or a picture of your finished order, without asking
      you first</strong>. "No" is a completely fine answer.</li>
  <li>You confirm you have the right to send us the photo and that it doesn't infringe anyone else's
      rights.</li>
  <li>We may decline any personalisation request — including engraved text — that is unlawful,
      hateful, or infringes someone's trademark or copyright. We'll refund you if we do.</li>
  <li>Engraved names are printed <strong>exactly as you type them</strong>. Check your spelling.</li>
</ul>

<h2 id="delivery">5. Making and delivery</h2>
<ul>
  <li>Production is <strong>1–2 business days</strong>, counted from when your photo arrives,
      plus carrier transit (typically 3–5 business days).</li>
  <li>Risk passes to you on delivery. If it arrives damaged, that's covered under our
      <a href="policies.html#returns">returns policy</a>.</li>
  <li>Delivery estimates are estimates. Carriers have bad weeks.</li>
</ul>

<h2 id="returns-tos">6. Returns</h2>
<p>Because everything is made to order, <strong>all sales are final</strong> except for damage,
defects, or our mistake. The full detail, including how to claim and how long it takes, is on the
<a href="policies.html#returns">policies page</a> and forms part of these terms.</p>

<h2 id="product">7. What you're actually buying</h2>
<ul>
  <li>These are <strong>decorative 3D-printed PLA objects</strong>. They are not toys, not pet toys,
      and not food safe.</li>
  <li>Colour, finish and layer texture vary slightly between batches. That's the process, not a defect.</li>
  <li>Read the <a href="policies.html#safety">safety section</a> before giving one to a child or
      leaving one with an animal.</li>
</ul>

<h2 id="liability">8. Liability</h2>
<p>We stand behind our work, and nothing here limits liability for death or personal injury caused
by our negligence, for fraud, or anything else that cannot lawfully be limited.</p>
<p>Beyond that, our total liability for any order is limited to <strong>what you paid for that
order</strong>. We are not liable for indirect or consequential losses. The products are supplied
for decorative use, and you accept responsibility for using them sensibly — see the safety section.</p>

<h2 id="conduct">9. Using this site</h2>
<ul>
  <li>Don't attempt to interfere with the site, its checkout, or other customers' orders.</li>
  <li>Site content, text and our own photography belong to us. Don't reuse them commercially
      without asking.</li>
</ul>

<h2 id="law">10. Law</h2>
<p>These terms are governed by the laws of the State of New Jersey, USA, and disputes go to the
courts of New Jersey.</p>

<h2 id="changes-tos">11. Changes</h2>
<p>We may update these terms. The version that applies to your order is the one published when you
placed it. Material changes get a new date at the top of this page.</p>

<h2 id="contact-tos">12. Contact</h2>
<p>${BIZ}<br>${ADDR}<br><a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
`;

/* ---------- PRIVACY ---------- */
const privacyBody = `
<p>${BIZ} ("we", "us") collects only what we need to sell you a thing and get it to your door.
No trackers we can't justify, no selling your data, no dark patterns.</p>

<h2 id="collect">1. What we collect</h2>
<ul>
  <li><strong>Order information</strong> — name, email, shipping and billing address, phone number,
      and what you ordered.</li>
  <li><strong>Payment information</strong> — handled entirely by Stripe. Card numbers never reach
      our servers and we never see them.</li>
  <li><strong>Photos you send us</strong> for an exact pattern match, and any pet name you ask us
      to engrave.</li>
  <li><strong>Messages</strong> you send through the contact form — your name, email, and what you wrote.</li>
  <li><strong>Your cart</strong>, stored in your own browser. It never leaves your device until you
      check out, and it contains no payment details.</li>
  <li><strong>Marketing email address</strong>, if you opt in.</li>
</ul>

<h2 id="use">2. How we use it</h2>
<ul>
  <li>To make, pack, and ship your order, and to email you about it.</li>
  <li>To match filament to your cat, when you've asked us to.</li>
  <li>To answer your messages.</li>
  <li>To handle damage claims, replacements, and refunds.</li>
  <li>To meet tax and accounting obligations.</li>
  <li>To send marketing email — only if you opted in, with one-click unsubscribe on every one.</li>
</ul>
<p>We do not sell your personal information, and we never have.</p>

<h2 id="photos">3. Photos of your pet</h2>
<p>These get their own section because they deserve one.</p>
<ul>
  <li>Photos you send are used <strong>only</strong> to colour-match your order.</li>
  <li>We will <strong>never post your photo, or a picture of your finished order, publicly without
      asking you first</strong>. If we'd love to share one, we'll ask, and "no" is a completely fine answer.</li>
  <li>We delete match photos within <strong>90 days</strong> of your order shipping unless you've
      told us we can keep using one.</li>
  <li>Ask us to delete a photo sooner and we'll do it.</li>
</ul>

<h2 id="share">4. Who we share it with</h2>
<p>Only the services needed to run the shop, and only what they need:</p>
<table>
  <tr><th>Service</th><th>What it gets</th><th>Why</th></tr>
  <tr><td>Stripe</td><td>name, email, address, phone, order contents</td><td>takes payment, calculates sales tax, handles refunds</td></tr>
  <tr><td>Resend</td><td>your email address and order details</td><td>sends your confirmation and our order alerts</td></tr>
  <tr><td>Vercel</td><td>standard request logs, IP address</td><td>hosts and serves the site</td></tr>
  <tr><td>USPS</td><td>name and delivery address</td><td>delivers your parcel</td></tr>
</table>
<p>Each is contractually required to protect your data and may not use it for their own purposes.
We may also disclose information if the law requires it.</p>

<h2 id="rights">5. Your rights</h2>
<ul>
  <li><strong>Unsubscribe</strong> — one click in any marketing email, or just reply and ask.</li>
  <li><strong>Access or delete</strong> — email us and we'll respond within 45 days.</li>
  <li><strong>Correct</strong> — tell us and we'll fix it.</li>
  <li><strong>Do not sell</strong> — nothing to opt out of; we don't sell data.</li>
  <li><strong>California and New Jersey residents</strong> have additional rights under CCPA/CPRA
      and the NJDPA. Contact us to exercise them, and we won't treat you differently for asking.</li>
</ul>
<p>We keep order records as long as tax and accounting rules require, even if you unsubscribe.</p>

<h2 id="cookies">6. Cookies and tracking</h2>
<p>We use the minimum. Your cart is kept in your browser's local storage so it survives moving
between pages — that's a convenience feature, not tracking, and it never leaves your device until
checkout. Stripe sets its own cookies during payment to prevent fraud. Blocking storage in your
browser will empty your cart on navigation but won't otherwise break the site.</p>

<h2 id="security">7. Security</h2>
<p>The site runs over HTTPS and payment is handled by a PCI-compliant processor. Order totals are
recalculated on our server rather than trusted from your browser. No system is perfectly secure and
we won't pretend otherwise — but we hold very little sensitive data by design.</p>

<h2 id="children">8. Children</h2>
<p>This shop isn't directed at children under 13 and we don't knowingly collect their data. If you
believe a child has sent us information, email us and we'll delete it.</p>

<h2 id="changes">9. Changes</h2>
<p>We'll post material changes here with a new date at the top of the page.</p>

<h2 id="contact-privacy">10. Contact</h2>
<p>${BIZ}<br>${ADDR}<br>
<a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
`;

/* ================================================================
   WRITE
   ================================================================ */
const OUT_P = path.join(ROOT, 'products');
const OUT_G = path.join(ROOT, 'pages');
if (!fs.existsSync(OUT_P)) fs.mkdirSync(OUT_P, { recursive: true });
if (!fs.existsSync(OUT_G)) fs.mkdirSync(OUT_G, { recursive: true });

/* A product with a hand-designed page — catalog `canonical` — does NOT get a
   generated one. Otherwise the same SKU is live at two URLs: the designed
   CatCustoms page the customer is sent to, and an off-brand generated twin
   still reachable (and indexable) at /products/<handle>. The catalog stays the
   single source of price either way; only the page is skipped. */
const GENERATED = PRODUCTS.filter(p => !p.canonical);
for (const p of GENERATED) fs.writeFileSync(path.join(OUT_P, p.h + '.html'), productPage(p), 'utf8');

/* ================================================================
   ORDER CONFIRMATION  (root: /order-complete)
   Deliberately separate from /success, which belongs to Catan Artisan
   and renders a Catan order summary.
   ================================================================ */
function orderCompletePage() {
  const b = '';
  return `<!-- order-complete.html — generated by build-products.js. Do not edit by hand. -->
${head(b, 'Thank you — Realized Prints', 'Your order is confirmed. Here is what happens next.')}
${chromeTop(b)}
<div class="wrap">
  <section class="page-hero">
    <h1>Thank you<span id="ocName"></span>!</h1>
    <p id="ocLede">Your order is confirmed. We're getting the printers warm.</p>
  </section>

  <div class="oc-grid">
    <div class="oc-main">
      <h2 class="oc-h">What you ordered</h2>
      <div id="ocItems" class="oc-items"><p class="oc-muted">Loading your order…</p></div>
      <div class="oc-tot" id="ocTotalRow" style="display:none">
        <span>Total paid</span><span id="ocTotal"></span>
      </div>

      <div class="pdp-gift" id="ocPhoto" style="display:none">
        📸 We need a photo of your cat
        <span>We paint your scratcher to match your cat. The easiest way: <strong>reply to your
        confirmation email</strong> with one clear, well-lit photo of each cat. Your order is on hold
        until it arrives. You can also upload it here.</span>
        <div class="oc-up">
          <label class="btn btn-pink btn-block oc-up-btn" for="ocFile">Choose a photo</label>
          <input id="ocFile" type="file" accept="image/*" capture="environment" hidden>
          <p class="oc-muted" id="ocUpMsg">JPG, PNG or WEBP. We resize it on your phone before sending,
             so it works fine on mobile data.</p>
          <img id="ocPreview" alt="" style="display:none">
        </div>
        <span style="margin-top:10px">Prefer email? Send it to
          <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> quoting your order reference.</span>
      </div>
    </div>

    <aside class="oc-side">
      <h2 class="oc-h">What happens next</h2>
      <ol class="oc-steps">
        <li>We make your order in <strong>1–2 business days</strong> once your photo arrives, and email you photo and video updates.</li>
        <li>It ships in <strong>3–5 business days</strong>.</li>
        <li>You get a tracking email the moment the label is made.</li>
        <li>Questions? Reply to your receipt, or use the <a href="${b}pages/contact.html">contact page</a>.</li>
      </ol>
      <div class="oc-ref">
        <span class="oc-muted">Order reference</span>
        <strong id="ocRef">—</strong>
      </div>
      <a class="btn btn-pink btn-block" href="${b}index.html#templates">Keep shopping</a>
    </aside>
  </div>
</div>
${cartDrawer()}
${footer(b)}
<script>
/* The cart is done — the order is with Stripe now. */
try { localStorage.removeItem('rp_cart_v2'); localStorage.removeItem('cc_cart_v3'); } catch (e) {}

const sessionId = new URLSearchParams(location.search).get('session_id');
const itemsEl = document.getElementById('ocItems');
document.getElementById('ocRef').textContent = sessionId ? sessionId.slice(-12).toUpperCase() : '—';

/* Downscale in the browser: a 1600px JPEG is plenty to match coat colour and
   markings, keeps every upload under Vercel's request limit, and uploads in
   seconds on phone data instead of pushing a 9MB original. */
function shrink(file, maxPx) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onerror = function () { reject(new Error('Could not read that file.')); };
    reader.onload = function () {
      const img = new Image();
      img.onerror = function () { reject(new Error('That does not look like an image.')); };
      img.onload = function () {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function mountUpload() {
  const input = document.getElementById('ocFile');
  const msg = document.getElementById('ocUpMsg');
  const btn = document.querySelector('.oc-up-btn');
  const prev = document.getElementById('ocPreview');
  if (!input) return;

  input.addEventListener('change', async function () {
    const file = input.files && input.files[0];
    if (!file) return;
    btn.classList.add('is-busy');
    btn.textContent = 'Sending…';
    msg.textContent = 'Resizing and uploading…';
    try {
      const dataUrl = await shrink(file, 1600);
      prev.src = dataUrl; prev.style.display = 'block';
      const res = await fetch('/api/upload-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId, dataUrl: dataUrl })
      });
      const d = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(d.error || 'Upload failed.');
      btn.textContent = 'Photo received ✓';
      btn.classList.add('is-done');
      msg.textContent = 'Got it — that is everything we need. Send another if you like.';
    } catch (e) {
      btn.classList.remove('is-busy');
      btn.textContent = 'Try again';
      msg.textContent = e.message + ' You can also just email the photo to us.';
    }
  });
}

function row(label, sub, price) {
  return '<div class="oc-item"><div><div class="oc-item-t">' + label + '</div>'
       + (sub ? '<div class="oc-muted">' + sub + '</div>' : '') + '</div>'
       + '<div class="oc-item-p">' + price + '</div></div>';
}

async function loadOrder() {
  if (!sessionId) {
    itemsEl.innerHTML = '<p class="oc-muted">No order reference found. If you just paid, your receipt email has the details.</p>';
    return;
  }
  try {
    const res = await fetch('/api/get-session?session_id=' + encodeURIComponent(sessionId));
    if (!res.ok) throw new Error('lookup failed');
    const d = await res.json();
    if (d.shop !== 'cats') {
      itemsEl.innerHTML = '<p class="oc-muted">This looks like a Catan Artisan order — <a href="/success?session_id='
        + encodeURIComponent(sessionId) + '">view it here</a>.</p>';
      return;
    }

    const gifts = d.gifts || [];
    const html = (d.items || []).map(function (i) {
      const p = RP.BY_HANDLE[i.handle];
      const title = p ? p.t : i.handle;
      const bits = [];
      bits.push(RP.COLOR_LABEL[i.color] || i.color);
      if (i.qty > 1) bits.push('Qty ' + i.qty);
      if (i.name) bits.push('engraved "' + i.name + '"');
      if (i.match) bits.push('exact pattern match');
      return row(i.gift ? '🎁 ' + title + ' (free gift)' : title, bits.join(' · '), i.gift ? 'FREE' : '');
    }).join('');
    itemsEl.innerHTML = html || '<p class="oc-muted">Your receipt email has the full details.</p>';

    if (d.total) {
      document.getElementById('ocTotal').textContent = RP.money(d.total);
      document.getElementById('ocTotalRow').style.display = 'flex';
    }
    if (d.needsPhoto) { document.getElementById('ocPhoto').style.display = 'block'; mountUpload(); }
    if (d.email) document.getElementById('ocLede').textContent =
      'Your order is confirmed and a receipt is on its way to ' + d.email + '.';
  } catch (e) {
    itemsEl.innerHTML = '<p class="oc-muted">We could not load the order details here, but your payment went through '
      + 'and your receipt email has everything. Contact us if anything looks wrong.</p>';
  }
}
loadOrder();
</script>
</body>
</html>
`;
}

const PAGES = [
  {file:'policies.html', title:'Policies & FAQ — Cat Scratchers',
   desc:'Shipping times, returns, damage and replacements, your cat\'s photo, pricing, care, and answers to common questions about Cat Scratchers.',
   heroTitle:'Policies &amp; FAQ', heroLede:'Shipping, returns, damage and every question we get, in plain English, all on one page.',
   updated:POLICIES_UPDATED,
   jump:[['shipping','Shipping'],['orders','Orders &amp; cancellations'],['returns','Returns &amp; refunds'],
         ['damage','Damage &amp; defects'],['custom','Your cat\'s photo'],['pricing','Pricing &amp; payment'],
         ['care','Care &amp; safety'],['faq','FAQ'],['contact','Contact']],
   body:policiesBody},

  {file:'contact.html', title:'Contact Us — Realized Prints',
   desc:'Message the husband-and-wife team behind Realized Prints. Replies in 1–2 business days.',
   heroTitle:'Contact us', heroLede:'Two people, one spare room, two printers. Your message comes straight to us.',
   updated:null, jump:[], body:contactBody, wide:true},

  {file:'terms.html', title:'Terms of Service — Realized Prints',
   desc:'The terms you agree to when you buy from Realized Prints — orders, pricing, photos you send us, delivery, returns and liability.',
   heroTitle:'Terms of service', heroLede:'What you agree to when you buy from us. Plain English, no fine-print games.',
   updated:UPDATED,
   jump:[['who','Who you’re buying from'],['orders','Orders'],['pricing','Prices &amp; payment'],
         ['ip','Photos you send us'],['delivery','Making &amp; delivery'],['returns-tos','Returns'],
         ['product','What you’re buying'],['liability','Liability'],['conduct','Using this site'],
         ['law','Law'],['changes-tos','Changes'],['contact-tos','Contact']],
   body:tosBody},

  {file:'privacy.html', title:'Privacy Policy — Realized Prints',
   desc:'How Realized Prints collects, uses and protects your information, including photos sent for pattern matching.',
   heroTitle:'Privacy policy', heroLede:'What we collect, why, and what we do with photos of your cat.',
   updated:UPDATED,
   jump:[['collect','What we collect'],['use','How we use it'],['photos','Photos of your pet'],
         ['share','Who we share with'],['rights','Your rights'],['cookies','Cookies &amp; tracking'],
         ['security','Security'],['children','Children'],['changes','Changes'],['contact-privacy','Contact']],
   body:privacyBody}
];
for (const pg of PAGES) fs.writeFileSync(path.join(OUT_G, pg.file), contentPage(pg), 'utf8');
fs.writeFileSync(path.join(OUT_G, 'faq.html'), redirectPage('policies.html#faq'), 'utf8');
fs.writeFileSync(path.join(ROOT, 'order-complete.html'), orderCompletePage(), 'utf8');

console.log('Generated ' + GENERATED.length + ' product page(s) into products/'
  + (GENERATED.length < PRODUCTS.length
      ? '  (skipped ' + PRODUCTS.filter(p => p.canonical).map(p => p.h).join(', ')
        + ' — they have hand-designed pages)'
      : ''));
console.log('Generated order-complete.html (cat shop confirmation page)');
console.log('Generated ' + PAGES.length + ' content pages into pages/:');
console.log(PAGES.map(p => '  /pages/' + p.file.replace('.html','')).join('\n'));

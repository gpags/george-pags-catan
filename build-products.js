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
const { PRODUCTS, VIBES, ADDONS, GIFTS, BY_HANDLE, SIZE_BUNDLES, priceFor, savingAt, BUILD_ID } = CATALOG;

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
const imgUrl = p => p.imgUrl;   // derived in assets/catalog.js

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
      <a class="ibtn" href="${b}index.html#catalog" aria-label="Search">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>
      </a>
      <div class="soc">${socLinks('ibtn')}</div>
    </div>
    <a class="brand" href="${b}index.html">
      <span class="brand-name">Realized Prints</span>
      <span class="brand-sub">Cats, printed to order</span>
    </a>
    <div class="head-right">
      <button class="ibtn" id="cartBtn" aria-label="Open cart">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M6 7h12l-1.2 12H7.2z"/><path d="M9 7a3 3 0 016 0"/></svg>
        <span class="cart-pill" id="cartPill">0</span>
      </button>
    </div>
  </div>
</header>

<nav class="nav-strip" aria-label="Main">
  <div class="wrap nav-in">
    <div><a class="nlink" href="${b}pages/contact.html">Contact Us</a></div>
    <div>
      <button class="nlink" aria-expanded="false">Shop
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <ul class="ndrop" id="shopDrop"></ul>
    </div>
    <div><a class="nlink" href="${b}pages/policies.html">Policies</a></div>
    <div><a class="nlink" href="${b}pages/faq.html">FAQ</a></div>
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
        <p class="foot-note">Husband &amp; wife, printed in the USA. Made to order in 5–10 business days.</p>
        <div class="foot-soc">${socLinks('')}</div>
      </div>
      <div><h4>Shop</h4><ul>
        <li><a href="${b}index.html#catalog">All cats</a></li>
        <li><a href="${b}index.html#catalog">New arrivals</a></li>
        <li><a href="${b}index.html#catalog">Bundles</a></li>
      </ul></div>
      <div><h4>Other lines</h4><ul>
        <li><a href="${b}catan/">Catan Artisan</a></li>
        <li><a href="${b}meowmeow.html">Meow Meow Blind Bags</a></li>
        <li><a href="${b}CustomFigurines.html">Custom Figurines</a></li>
      </ul></div>
      <div><h4>Help</h4><ul>
        <li><a href="${b}pages/policies.html#shipping">Shipping</a></li>
        <li><a href="${b}pages/policies.html#returns">Returns</a></li>
        <li><a href="${b}pages/faq.html">FAQ</a></li>
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
    <a href="${b}index.html">Home</a> / <a href="${b}index.html?vibe=${p.v}#catalog">${esc(v.name)}</a> / ${esc(p.t)}
  </nav>

  <div class="pdp">
    <div class="pdp-gal">
      <div class="pdp-main">
        ${p.photoReal ? '' : '<span class="stage-ph">Placeholder</span>'}
        <img id="galMain" src="${imgUrl(p)}" alt="${esc(p.t)}">
      </div>
      <div class="pdp-thumbs" id="galThumbs"></div>
    </div>

    <div class="pdp-buy">
      <div class="pdp-vibe">${esc(v.name)}</div>
      <h1>${esc(p.t)}</h1>
      <div class="pdp-price">$${p.price}.00 USD</div>
      <div class="pdp-ship">Shipping calculated at checkout · Made to order in 5–10 business days</div>
      <div class="pdp-sku">SKU: ${p.sku || 'RP-' + String(p.id).padStart(4,'0')}</div>
      <div class="pdp-free">Free USPS Ground Advantage shipping on U.S. orders $65+</div>
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
      <label class="addon">
        <input type="checkbox" id="addMatch">
        <span><span class="addon-t">${esc(ADDONS.match.label)}</span><span class="addon-d">Send a photo after checkout — we hand-match it</span></span>
        <span class="addon-p">+$${ADDONS.match.price}</span>
      </label>
${tiers.length ? `
      <div class="opt-t">Bundle &amp; save</div>
      <div class="tiers" id="tiers">
${tiers.map(([qty, total]) =>
`        <button class="tier" data-q="${qty}" aria-pressed="${qty === 1}">${p.price * qty - total > 0 ? '<span class="tier-free">SAVE $' + (p.price * qty - total) + '</span>' : ''}<b>${qty} for $${total}</b><i class="tier-ea">$${(total / qty).toFixed(2)} each</i></button>`).join('\n')}
      </div>` : ''}

      <div class="pdp-gift" id="pdpGift">
        Free gift with every order over $${GIFTS[0].minSpend}
        <span>Spend $${GIFTS[0].minSpend}+ for a free ${esc(BY_HANDLE[GIFTS[0].handle].t)}, or $${GIFTS[1].minSpend}+ to add a free ${esc(BY_HANDLE[GIFTS[1].handle].t)}.</span>
      </div>

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

const THUMBS = [PROD.imgUrl, ...REL_IDS.slice(0,3).map(id => RP.PRODUCTS.find(x=>x.id===id).imgUrl)];
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
    + (document.getElementById('addName').checked ? RP.ADDONS.name.price : 0)
    + (document.getElementById('addMatch').checked ? RP.ADDONS.match.price : 0);
}
function itemForCart(){
  return {
    h: PROD.h, qty, color: color[0],
    name: document.getElementById('addName').checked
      ? (document.getElementById('nameField').value.trim() || 'name TBC') : '',
    match: document.getElementById('addMatch').checked
  };
}
function refresh(){
  /* Everything is computed before anything is written, so a failure can't
     leave the quantity updated while the price stays stale. */
  const addons = (document.getElementById('addName').checked ? RP.ADDONS.name.price : 0)
               + (document.getElementById('addMatch').checked ? RP.ADDONS.match.price : 0);
  const due = RP.priceFor(PROD, qty) + addons * qty;
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
document.getElementById('addMatch').onchange = refresh;
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

/* ---------- POLICIES ---------- */
const policiesBody = `
<h2 id="shipping">Shipping policy</h2>

<h3>Free shipping</h3>
<p>Free USPS Ground Advantage shipping on U.S. domestic orders over <strong>$65</strong>. Below
that, a flat rate is calculated at checkout.</p>

<h3>Processing time</h3>
<p>Everything is made after you order it — nothing sits on a shelf. Allow
<strong>5–10 business days</strong> (Mon–Fri, excluding holidays) for us to print, finish, and pack
your order before it ships. Busy drop weeks can push this slightly longer; if it does, we email you.</p>
<div class="callout note"><strong>Ordering an exact pattern match?</strong> Add roughly
3 more business days. The clock starts when your photo arrives, not when you order.</div>

<h3>Carriers</h3>
<ul>
  <li><strong>United States only, for now.</strong> USPS Ground Advantage on every order.
      Checkout only accepts U.S. shipping addresses.</li>
  <li><strong>International</strong> — not yet. We'd rather not take your money and then discover
      the customs paperwork makes a $15 keychain cost $40 to deliver. It's on the list.</li>
</ul>

<h3>Tracking</h3>
<p>A tracking number is emailed when your order is packed and about to ship. Carrier scans often
lag by a day or two after that first email — a tracking number that has not moved yet is normal.</p>

<h2 id="returns">Returns, refunds &amp; replacements</h2>
<p>Everything is handmade to order in small batches, so <strong>all sales are final</strong> except
in the cases below.</p>

<h3>What is covered</h3>
<ul>
  <li>Your item arrives <strong>damaged</strong>.</li>
  <li>Your item <strong>fails from a material or print defect within 30 days</strong> of purchase.</li>
  <li>We sent the wrong item, colour, or add-on.</li>
</ul>

<h3>What is not covered</h3>
<ul>
  <li>Damage from drops, pets, dishwashers, heat, or normal wear.</li>
  <li>Change of mind on a personalised item — engraved names and pattern-matched prints
      cannot be resold, so they cannot be refunded.</li>
  <li>Minor colour or layer variation between batches (see <a href="#variance">colour variance</a>).</li>
</ul>

<h3>How to make a claim</h3>
<ol>
  <li>Message us through the <a href="contact.html">contact page</a> within
      <strong>7 days of delivery</strong> for damage on arrival, or within
      <strong>30 days of purchase</strong> for a material defect.</li>
  <li>Include your <strong>order number</strong> and clear <strong>photos of the item and the packaging</strong>.</li>
  <li>We reply within 1–2 business days.</li>
</ol>
<p>Approved claims get a replacement. If the item is out of stock, you can choose store credit or
a refund instead. <strong>Do not send anything back unless we ask you to</strong> — usually we won't.</p>

<h3>Timing</h3>
<table>
  <tr><th>Outcome</th><th>Processed within</th></tr>
  <tr><td>Replacement printed and shipped</td><td>5–10 business days</td></tr>
  <tr><td>Store credit issued</td><td>5 business days</td></tr>
  <tr><td>Refund to original payment method</td><td>5 business days</td></tr>
</table>
<p>Refunds land back on your card 3–10 business days after we issue them, depending on your bank.</p>

<h3>Cancellations and changes</h3>
<p>We can change or cancel an order any time before it goes on the printer — usually within about
24 hours. After that the filament is committed and we can't stop it. Message us as fast as you can
and we'll do what we can.</p>

<h2 id="custom">Custom orders &amp; personalisation</h2>

<h3>Exact pattern match</h3>
<p>Choose <strong>Exact pattern match</strong> on any product and check out as normal — there is
nothing to upload before you pay. We ask for the photo on the confirmation screen, and again by
email, so you can send it whenever suits you.</p>
<ul>
  <li>One clear, well-lit photo of your cat is plenty.</li>
  <li>We hand-pick filament to match the coat and send you a photo before it ships.</li>
  <li>If we haven't received a photo within <strong>7 days</strong>, we print the preset colour you
      selected so your order isn't stuck, and refund the match fee.</li>
</ul>
<div class="callout warn"><strong>What a match can and can't do.</strong> These are printed in a
handful of solid filament colours, not painted. We match the coat <em>pattern and colours</em> —
tuxedo markings, calico patches, tabby stripes. We can't reproduce individual fur detail or exact
shading, and we'd rather tell you that now than disappoint you later.</div>

<h3>Name engraving</h3>
<p>Names are engraved into the base exactly as you type them, so please check the spelling. Once a
personalised print starts we can't change it. Up to 18 characters.</p>

<h2 id="bundles">Bundle offers</h2>
<p>Buy more of the same cat and the price per cat drops. The bundle price is
applied automatically in the cart, and it's shown on the product page first, so
the price never changes on you at checkout.</p>
<p>Which rungs a product has depends on its size — bigger cats take far longer to
print, so their bundles are smaller:</p>
<table>
  <tr><th>Size</th><th>Bundles offered</th></tr>
${LADDERS.map(([size, rows]) => `  <tr><td>${{S:'Small', M:'Medium', L:'Large'}[size]}</td><td>${rows.map(([q, add]) => q + (add ? ' for base +$' + add : ' at base price')).join(' &middot; ')}</td></tr>`).join('\n')}
</table>
<p>For example a $15 Cat Clicker runs 1 for $15, 3 for $20, 5 for $25 and 10 for $30.
The exact prices are on every product page.</p>
<ul>
  <li>Bundles apply <strong>per product line</strong> — the units are the same product,
      and you can pick a different colour for each.</li>
  <li>Engraving and pattern match are charged on <strong>every unit</strong>, since each
      one is done by hand.</li>
  <li>If a quantity falls between two rungs you're charged whichever is cheaper —
      you'll never pay more for buying more.</li>
  <li>Not combinable with discount codes.</li>
</ul>

<h2 id="variance">Colour, finish &amp; variance</h2>
<ul>
  <li>Filament varies slightly between batches. Two prints of the same colour won't be identical.</li>
  <li>Screens differ. Colours in photos are a guide, not a guarantee.</li>
  <li>Faint layer lines are a normal, visible part of 3D printing, not a defect.</li>
  <li>Sizes are approximate and listed per product.</li>
</ul>

<h2 id="safety">Safety</h2>
<div class="callout warn"><strong>Not a cat toy, and not a children's toy.</strong> These are
decorative figurines and desk accessories.</div>
<ul>
  <li><strong>Not intended for children under 5.</strong> Small parts present a choking hazard.
      Use with adult supervision.</li>
  <li><strong>Do not leave these with a pet unsupervised.</strong> Printed plastic can be chewed
      into sharp pieces or swallowed. Nothing we sell is a chew toy.</li>
  <li>Printed in PLA. Keep out of hot cars and away from direct heat — PLA softens and will deform.</li>
  <li>Not food safe and not dishwasher safe. Wipe clean with a damp cloth.</li>
</ul>

<h2 id="contact">Questions</h2>
<p>Email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> or use the
<a href="contact.html">contact page</a>. You're emailing the two people who made your order.</p>
<p style="font-size:13px;color:var(--muted)">${BIZ} · ${ADDR}</p>
`;

/* ---------- FAQ ---------- */
/* [anchor id, heading, [[question, answer], ...]] — ids are explicit so they
   can't drift from the jump list when a heading contains an HTML entity. */
const FAQ = [
  ['orders-shipping', 'Orders &amp; shipping', [
    ['How long until my order ships?',
     '<p>5–10 business days to make it, then transit time on top. Everything is printed after you order — nothing is pre-made. Exact pattern match adds around 3 more days.</p>'],
    ['My tracking number hasn\'t updated. Is something wrong?',
     '<p>Almost certainly not. We email tracking when the label is created, which is often a day or two before the carrier scans the parcel. If there\'s no movement after 5 business days, message us and we\'ll chase it.</p>'],
    ['Do you ship internationally?',
     '<p>Not yet — U.S. addresses only. We would rather not take your money and then find that customs paperwork and duties make a $15 keychain cost $40 to deliver. It is on the list once we have the volume to do it properly.</p>'],
    ['When is shipping free?',
     '<p>Orders over $65 ship free via USPS Ground Advantage. Below that, shipping is calculated from the packed weight of your order — a single keychain costs a lot less to post than three big figurines, and you only pay what it actually weighs. The cart shows how far you are from free shipping.</p>'],
    ['Can I change or cancel my order?',
     '<p>If it hasn\'t started printing — usually within about 24 hours — yes. After that the filament is committed. Message us quickly and we\'ll try.</p>'],
    ['What is the inventory drop?',
     '<p>We restock in batches rather than continuously. The countdown at the top of the site shows the next one. Sold-out items come back on a drop.</p>']
  ]],
  ['colours-customisation', 'Colours &amp; customisation', [
    ['How do the nine colours work?',
     '<p>Every figure is available in nine core animal colours — orange tabby, tuxedo, calico, grey tabby, brown tabby, tortoiseshell, siamese, black and white. Same model, different filament. Pick one on the product page.</p>'],
    ['My cat isn\'t one of the nine. What do I do?',
     '<p>Choose <strong>Exact pattern match</strong> (+$12), check out normally, then send a photo on the confirmation screen or by email. There is nothing to upload before you pay.</p>'],
    ['How close will the match actually be?',
     '<p>We match the pattern and colours of the coat — markings, patches, stripes — using solid filament. We can\'t reproduce individual fur detail or soft shading. We send you a photo before it ships, and if it\'s not right we\'ll talk about it.</p>'],
    ['What if I forget to send the photo?',
     '<p>After 7 days we print the preset colour you chose so your order isn\'t stuck waiting, and we refund the match fee.</p>'],
    ['Can I get a name on it?',
     '<p>Yes, +$5, engraved into the base, up to 18 characters. Check your spelling — once it starts printing we can\'t change it.</p>'],
    ['Can you design something completely custom?',
     '<p>Sometimes. Message us with what you have in mind. Bespoke sculpting is priced separately and takes considerably longer.</p>']
  ]],
  ['bundles-pricing', 'Bundles &amp; pricing', [
    ['How do the bundles work?',
     '<p>Every product has a "Bundle &amp; save" row showing set prices for set quantities — a $15 Cat Clicker is 1 for $15, 3 for $20, 5 for $25 or 10 for $30. Pick a quantity and the price is applied automatically in the cart, so it never changes on you at checkout.</p>'],
    ['What if I want a quantity that is not one of the options?',
     '<p>You will be charged whichever bundle is cheapest for that amount. Ask for 4 clickers and you pay the 5-pack price of $25, because it is less than four singles. You will never pay more for buying more.</p>'],
    ['Do bundled cats have to be the same colour?',
     '<p>They have to be the same product, but you can pick a different colour for each one.</p>'],
    ['Can I stack a discount code on a bundle?',
     '<p>No — bundles are already the best price we do.</p>']
  ]],
  ['the-products', 'The products themselves', [
    ['Are these safe for my cat to play with?',
     '<p><strong>No.</strong> These are decorative figurines, not pet toys. Printed plastic can be chewed into sharp pieces or swallowed. Please don\'t leave them with a pet unsupervised.</p>'],
    ['Are they safe for kids?',
     '<p>Not for under-5s — small parts are a choking hazard. Older children, with adult supervision, are fine.</p>'],
    ['What are they made of?',
     '<p>PLA, a plant-based plastic. Sturdy indoors, but it softens in heat — keep them out of hot cars and off radiators.</p>'],
    ['How do I clean one?',
     '<p>Wipe with a damp cloth. Not dishwasher safe, not food safe, no solvents.</p>'],
    ['Why can I see faint lines on the surface?',
     '<p>That\'s how 3D printing works — the object is built in layers. We print at a fine layer height to keep it subtle, but it\'s a characteristic of the process, not a fault.</p>'],
    ['The colour looks slightly different to the photo.',
     '<p>Filament varies between batches and every screen shows colour differently. Photos are a guide. A noticeable mismatch is worth messaging us about; a slight one is normal.</p>']
  ]],
  ['problems', 'Problems', [
    ['My item arrived damaged.',
     '<p>Message us within 7 days of delivery with your order number and photos of the item and the packaging. We\'ll replace it. Don\'t send it back unless we ask.</p>'],
    ['It broke after a few weeks.',
     '<p>If it\'s a material or print defect within 30 days of purchase, that\'s covered. Accidental damage isn\'t, but message us anyway — we can usually reprint a part cheaply.</p>'],
    ['I got the wrong item or colour.',
     '<p>Entirely our fault. Message us and we\'ll fix it at no cost to you.</p>']
  ]]
];
const faqBody = FAQ.map(([id, section, items]) => `
<h2 id="${id}">${section}</h2>
${items.map(([q,a]) => `<details class="acc"><summary>${q}</summary><div class="acc-in">${a}</div></details>`).join('\n')}
`).join('\n');

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
        <input id="cf-order" name="order" type="text" placeholder="RP-0000"></div>
      <div class="cfield"><label for="cf-topic">What's this about?</label>
        <select id="cf-topic" name="topic">
          <option>Where is my order</option>
          <option>Damaged or faulty item</option>
          <option>Change or cancel an order</option>
          <option>Exact pattern match / sending a photo</option>
          <option>Custom or bulk request</option>
          <option>Wholesale &amp; stockists</option>
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
      <p>Most questions are answered on the <a href="faq.html">FAQ</a> — especially
      "where is my order" and how the pattern match works. Shipping and returns terms are on the
      <a href="policies.html">policies page</a>.</p>
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
  <li>Production is <strong>5–10 business days</strong>, plus carrier transit. An exact pattern
      match adds roughly 3 days, counted from when your photo arrives.</li>
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

for (const p of PRODUCTS) fs.writeFileSync(path.join(OUT_P, p.h + '.html'), productPage(p), 'utf8');

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
        <span>You chose <strong>Exact pattern match</strong>. One clear, well-lit photo is all we
        need. If we haven't got one within 7 days we'll print the preset colour you picked so your
        order isn't stuck, and refund the match fee.</span>
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
        <li>We print and finish your order by hand — <strong>5–10 business days</strong>.</li>
        <li>You get a tracking email the moment the label is made.</li>
        <li>Questions? Reply to your receipt, or use the <a href="${b}pages/contact.html">contact page</a>.</li>
      </ol>
      <div class="oc-ref">
        <span class="oc-muted">Order reference</span>
        <strong id="ocRef">—</strong>
      </div>
      <a class="btn btn-pink btn-block" href="${b}index.html#catalog">Keep shopping</a>
    </aside>
  </div>
</div>
${cartDrawer()}
${footer(b)}
<script>
/* The cart is done — the order is with Stripe now. */
try { localStorage.removeItem('rp_cart_v2'); } catch (e) {}

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
  {file:'policies.html', title:'Policies — Realized Prints',
   desc:'Shipping, returns, replacements, custom orders, bundles and safety information for Realized Prints.',
   heroTitle:'Policies', heroLede:'Shipping, returns, custom orders and bundles — in plain English, no fine print games.',
   updated:UPDATED,
   jump:[['shipping','Shipping'],['returns','Returns &amp; refunds'],['custom','Custom orders'],
         ['bundles','Bundles'],['variance','Colour variance'],['safety','Safety'],['contact','Questions']],
   body:policiesBody},

  {file:'faq.html', title:'FAQ — Realized Prints',
   desc:'Answers on shipping times, the nine core colours, exact pattern matching, bundles, materials and safety.',
   heroTitle:'Frequently asked questions', heroLede:'The things people actually ask us. If yours isn\'t here, message us.',
   updated:UPDATED,
   jump:[['orders-shipping','Orders &amp; shipping'],['colours-customisation','Colours &amp; customisation'],
         ['bundles-pricing','Bundles &amp; pricing'],['the-products','The products'],['problems','Problems']],
   body:faqBody},

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
fs.writeFileSync(path.join(ROOT, 'order-complete.html'), orderCompletePage(), 'utf8');

console.log('Generated ' + PRODUCTS.length + ' product pages into products/');
console.log('Generated order-complete.html (cat shop confirmation page)');
console.log('Generated ' + PAGES.length + ' content pages into pages/:');
console.log(PAGES.map(p => '  /pages/' + p.file.replace('.html','')).join('\n'));

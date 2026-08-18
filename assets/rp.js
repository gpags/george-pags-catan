/* ================================================================
   Realized Prints — shared shop runtime
   Persistent cart, checkout hand-off, and page chrome (countdown,
   marquee, nav, cart drawer). Loaded by index.html and every
   /products/*.html page.

   Product data, add-on prices and the bundle maths live in
   assets/catalog.js and are shared with build-products.js and
   api/checkout.js. Nothing in this file may hardcode a price —
   the server recomputes every total from the same catalog, so a
   price invented here would simply be overridden at checkout.

   Pages set  <body data-base="">  (root)  or  data-base="../"  (products/)
   so every generated link works locally on file:// and on Vercel.
   ================================================================ */
(function (global) {
'use strict';

const CATALOG = global.RP_CATALOG;
if (!CATALOG) throw new Error('rp.js: assets/catalog.js must be loaded first');

const { VIBES, COLORS, COLOR_LABEL, ADDONS, PRODUCTS, BY_HANDLE,
        FREE_SHIP, unitsPaid, freeUnits, tierLabel, betterDeal,
        GIFTS, giftsFor, nextGift } = CATALOG;

const BASE = (document.body && document.body.dataset.base) || '';
const CHECKOUT_URL = '/api/checkout';

const money = n => '$' + n.toFixed(2);

/* Unit price for a cart line = base + selected add-ons. Always read
   from the catalog by handle, never from anything stored in the cart,
   so an edited localStorage can't change what is displayed either. */
function unitPrice(it) {
  const p = BY_HANDLE[it.h];
  if (!p) return 0;
  return p.price + (it.name ? ADDONS.name.price : 0) + (it.match ? ADDONS.match.price : 0);
}

/* ================================================================
   CART — persisted so it survives navigating between pages
   Item shape: { h, qty, color, name, match }
   Everything else (title, image, price, tiers) is looked up by `h`.
   ================================================================ */
const KEY = 'rp_cart_v2';   // v1 stored prices in the item; dropped deliberately
let CART = [];
try { CART = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { CART = []; }
/* Drop anything that no longer matches a real product — a renamed or
   retired handle would otherwise sit in the cart and fail at checkout. */
CART = CART.filter(i => i && BY_HANDLE[i.h] && i.qty > 0);

const saveCart = () => { try { localStorage.setItem(KEY, JSON.stringify(CART)); } catch (e) {} };
const tiersFor  = it => (BY_HANDLE[it.h] || {}).bundleTiers || [];
const lineTotal = it => unitPrice(it) * unitsPaid(it.qty, tiersFor(it));
const cartCount = () => CART.reduce((n, i) => n + i.qty, 0);
const cartTotal = () => CART.reduce((s, i) => s + lineTotal(i), 0);

function addToCart(item) { CART.push(item); saveCart(); renderCart(); openCart(); }

/* ================================================================
   CHECKOUT — hands the cart to Stripe.
   Only handle / color / qty / add-ons are sent. The server ignores
   any price it is given and recomputes from assets/catalog.js.
   ================================================================ */
let checkingOut = false;

/* One line of the checkout payload. Prices are deliberately absent — the
   server recomputes them from the same catalog this page rendered from. */
const toPayload = i => ({
  handle: i.h,
  color:  i.color,
  qty:    i.qty,
  addons: { name: i.name || '', match: !!i.match }
});

/* Shared by the cart drawer and the product page's "Buy it now". */
async function postCheckout(items, btn, errEl) {
  if (checkingOut || !items.length) return;
  checkingOut = true;
  const label = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Redirecting…'; }
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }

  try {
    const res = await fetch(CHECKOUT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items.map(toPayload) })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) throw new Error(data.message || data.error || 'Could not start checkout.');
    window.location.href = data.url;
  } catch (e) {
    if (errEl) {
      errEl.textContent = e.message === 'Failed to fetch'
        ? 'Checkout needs the live site — it can’t run from a local file.'
        : e.message;
      errEl.style.display = 'block';
    }
    if (btn) { btn.disabled = false; btn.textContent = label; }
    checkingOut = false;
  }
}

const startCheckout = btn => postCheckout(CART, btn, document.getElementById('cartErr'));
const buyNow = (item, btn, errEl) => postCheckout([item], btn, errEl);

/* ================================================================
   CHROME
   ================================================================ */
function ordinal(n){
  const s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}
function mountCountdown(){
  const bar = document.getElementById('dropBar'); if (!bar) return;
  const cd = document.getElementById('cd');
  function nextDrop(){
    const now = new Date();
    let d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 19, 16, 0, 0)); // 12PM EDT
    while (d - now <= 0) d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+1, 19, 16, 0, 0));
    return d;
  }
  const target = nextDrop();
  const MO = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const when = document.getElementById('dropWhen');
  if (when) when.textContent = MO[target.getUTCMonth()] + ' ' + ordinal(target.getUTCDate()) + ', 12PM EDT';

  const UNITS = [['Days',864e5],['Hours',36e5],['Minutes',6e4],['Seconds',1e3]];
  cd.innerHTML = UNITS.map(([u]) =>
    `<div class="cd-unit"><div class="cd-nums" data-u="${u}"></div><div class="cd-cap">${u}</div></div>`).join('');
  function tick(){
    let left = Math.max(0, target - new Date());
    UNITS.forEach(([u, ms]) => {
      const val = Math.floor(left / ms); left -= val * ms;
      const str = String(val).padStart(2,'0');
      const host = cd.querySelector('[data-u="'+u+'"]');
      if (host.children.length !== str.length)
        host.innerHTML = Array.from(str).map(()=>'<span class="cd-d"></span>').join('');
      Array.from(str).forEach((ch,i)=>{ if(host.children[i].textContent!==ch) host.children[i].textContent=ch; });
    });
  }
  tick(); setInterval(tick, 1000);
  const x = document.getElementById('dropX');
  if (x) x.onclick = () => bar.remove();
}
function mountMarquee(){
  const track = document.getElementById('mqTrack'); if (!track) return;
  const items = [
    ['♥','Follow us @realizedprints'], ['✈','Now shipping worldwide'],
    ['♥','Current fulfillment: 5–10 business days'], ['★','Free US shipping over $65'],
    ['♥','Husband & wife, printed in the USA'], ['🎁','Bundle & save on selected cats'],
    ['★','Nine core animal colors on every figure'], ['♥','Exact pattern match available']
  ];
  const group = '<div class="mq-group">' + items.map(([ic,t]) =>
    `<span class="mq-item"><span aria-hidden="true">${ic}</span>${t}</span>`).join('') + '</div>';
  track.innerHTML = group + group;   // duplicated so the -50% loop is seamless
}
function mountShopDropdown(){
  const host = document.getElementById('shopDrop'); if (!host) return;
  host.innerHTML =
    `<li><a href="${BASE}index.html#catalog"><span class="dot" style="background:linear-gradient(120deg,#2f6bff,#ff3d9a)"></span>All cats</a></li>` +
    Object.entries(VIBES).map(([k,v]) =>
      `<li><a href="${BASE}index.html?vibe=${k}#catalog"><span class="dot" style="background:${v.color}"></span>${v.name}</a></li>`).join('') +
    `<li><a href="${BASE}catan/"><span class="dot" style="background:#19395e"></span>Catan Artisan</a></li>`;

  /* Desktop opens this on :hover via CSS. Touch devices never fire :hover,
     so the button also toggles an .open class — that is the only way the
     menu is reachable on a phone. */
  const wrap = host.parentElement;
  const btn  = wrap && wrap.querySelector('.nlink');
  if (!btn) return;

  const close = () => { host.classList.remove('open'); btn.setAttribute('aria-expanded','false'); };
  const open  = () => {
    /* The mobile rule pins the menu below the nav strip; give it the real
       offset so it lands correctly whether or not the drop bar is dismissed. */
    const nav = document.querySelector('.nav-strip');
    if (nav) host.style.setProperty('--nav-bottom', Math.round(nav.getBoundingClientRect().bottom) + 'px');
    host.classList.add('open'); btn.setAttribute('aria-expanded','true');
  };

  btn.addEventListener('click', e => {
    e.preventDefault();
    host.classList.contains('open') ? close() : open();
  });
  host.addEventListener('click', e => { if (e.target.closest('a')) close(); });
  document.addEventListener('click', e => { if (!wrap.contains(e.target)) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  addEventListener('resize', close);
}

/* ---------- cart drawer ---------- */
function openCart(){
  const c = document.getElementById('cart'); if(!c) return;
  c.classList.add('open'); document.getElementById('cartOv').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCart(){
  const c = document.getElementById('cart'); if(!c) return;
  c.classList.remove('open'); document.getElementById('cartOv').classList.remove('open');
  document.body.style.overflow = '';
}
function renderCart(){
  const pill = document.getElementById('cartPill');
  if (pill) pill.textContent = cartCount();
  const body = document.getElementById('cartBody'); if (!body) return;
  const foot = document.getElementById('cartFoot');

  if (!CART.length){
    body.innerHTML = '<div class="cart-empty"><p>Your cart is empty.</p></div>';
    if (foot) foot.style.display = 'none';
    return;
  }
  const total = cartTotal();
  const left = Math.max(0, FREE_SHIP - total);
  /* Gift ladder, mirrored from the server. api/checkout.js decides the real
     entitlement — this is only the shopper-facing preview of it. */
  const earned = giftsFor(total);
  const next = nextGift(total);
  body.innerHTML =
    `<div class="ship-bar">
       <p>${left > 0 ? "You're " + money(left) + ' away from free shipping' : '🎉 You’ve got free shipping'}</p>
       <div class="ship-track"><div class="ship-fill" style="width:${Math.min(100,total/FREE_SHIP*100)}%"></div></div>
     </div>` +
    (next ? `<div class="gift-bar">Add ${money(next.minSpend - total)} more and we’ll throw in a free
       <strong>${BY_HANDLE[next.handle].t}</strong></div>` : '') +
    earned.map(g => `<div class="ci ci-gift">
        <img src="${BY_HANDLE[g.handle].imgUrl}" alt="${BY_HANDLE[g.handle].t}">
        <div>
          <div class="ci-t">${BY_HANDLE[g.handle].t}</div>
          <div class="ci-m">${COLOR_LABEL[g.color] || g.color} · our gift to you</div>
          <div class="ci-p">FREE</div>
        </div></div>`).join('') +
    CART.map((i,ix) => {
      const p = BY_HANDLE[i.h];
      const free = freeUnits(i.qty, tiersFor(i));
      return `<div class="ci">
        <img src="${p.imgUrl}" alt="${p.t}">
        <div>
          <div class="ci-t">${p.t}</div>
          <div class="ci-m">${COLOR_LABEL[i.color] || i.color}${i.name ? ' · “'+i.name+'”' : ''}${i.match ? ' · exact match' : ''}</div>
          <div class="ci-m">Qty ${i.qty}${free ? ' · '+free+' free' : ''}</div>
          <div class="ci-p">${money(lineTotal(i))}</div>
          <button class="ci-rm" data-rm="${ix}">Remove</button>
        </div></div>`;
    }).join('');
  document.getElementById('cartTotal').textContent = money(total);
  if (foot) foot.style.display = 'block';
}
function mountCart(){
  const body = document.getElementById('cartBody'); if (!body) return;
  body.addEventListener('click', e => {
    const rm = e.target.dataset && e.target.dataset.rm;
    if (rm !== undefined) { CART.splice(Number(rm),1); saveCart(); renderCart(); }
  });
  const btn = document.getElementById('cartBtn');   if (btn) btn.onclick = openCart;
  const cls = document.getElementById('cartClose'); if (cls) cls.onclick = closeCart;
  const ov  = document.getElementById('cartOv');    if (ov)  ov.onclick = closeCart;
  /* Both buttons go to the same Stripe Checkout session. The express
     one is only a visual affordance — Link, Apple Pay and Google Pay
     are offered by Stripe inside the session either way. */
  const exp = document.getElementById('expressPay');
  if (exp) exp.onclick = () => startCheckout(exp);
  const out = document.getElementById('checkoutBtn');
  if (out) out.onclick = () => startCheckout(out);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCart(); });
  renderCart();
}

/* ---------- product card markup (shared by home + related rows) ---------- */
function cardHTML(p){
  const dots = COLORS.filter(([k]) => p.colorsAvailable.indexOf(k) !== -1)
                     .slice(0,5).map(([,,cls]) => `<span class="cdot ${cls}"></span>`).join('');
  const badge = p.badge==='new'  ? '<span class="cbadge b-new">New</span>'
              : p.badge==='best' ? '<span class="cbadge b-best">Bestseller</span>'
              : p.badge==='bogo' ? '<span class="cbadge b-bogo">BOGO free</span>' : '';
  return `<a class="card" href="${BASE}products/${p.h}.html">
    <div class="card-media">${badge}
      <img loading="lazy" src="${p.imgUrl}" alt="${p.t}">
      ${p.stock > 0 ? '' : '<span class="c-oos">Sold out</span>'}
    </div>
    <h3>${p.t}</h3>
    <div class="cvibe">${VIBES[p.v].name}</div>
    <div class="cprice">$${p.price}.00 USD</div>
    <div class="cdots">${dots}</div>
  </a>`;
}

/* ---------- contact form ----------
   No backend yet. Validates, then hands off to the mail client so a
   message can't be silently swallowed by a form that goes nowhere. */
function mountContactForm(){
  const form = document.getElementById('contactForm'); if (!form) return;
  const status = document.getElementById('cf-status');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const name  = form.name.value.trim();
    const email = form.email.value.trim();
    const msg   = form.message.value.trim();
    const order = form.order.value.trim();
    const topic = form.topic.value;

    if (!name || !email || !msg) {
      status.style.color = '#c62b6d';
      status.textContent = 'Please fill in your name, email and message.';
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      status.style.color = '#c62b6d';
      status.textContent = 'That email address doesn’t look right.';
      return;
    }
    const body = [
      'From: ' + name + ' <' + email + '>',
      order ? 'Order: ' + order : null,
      'Topic: ' + topic, '', msg
    ].filter(Boolean).join('\n');
    status.style.color = '#0f7a5a';
    status.textContent = 'Opening your email app so you can send it…';
    window.location.href = 'mailto:gpags987@gmail.com'
      + '?subject=' + encodeURIComponent('[' + topic + ']' + (order ? ' ' + order : ''))
      + '&body=' + encodeURIComponent(body);
  });
}

function boot(){ mountCountdown(); mountMarquee(); mountShopDropdown(); mountCart(); mountContactForm(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

global.RP = { BASE, VIBES, COLORS, COLOR_LABEL, ADDONS, PRODUCTS, BY_HANDLE,
              unitsPaid, freeUnits, tierLabel, betterDeal, money, unitPrice,
              GIFTS, giftsFor, nextGift,
              addToCart, renderCart, openCart, closeCart, cardHTML, FREE_SHIP,
              startCheckout, buyNow, get cart(){ return CART; } };
})(window);

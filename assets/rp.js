/* ================================================================
   Realized Prints — shared shop runtime
   Product data, bundle pricing, persistent cart, chrome (countdown,
   marquee, nav, cart drawer). Loaded by index.html and every
   /products/*.html page.

   Pages set  <body data-base="">  (root)  or  data-base="../"  (products/)
   so every generated link works locally on file:// and on Vercel.
   ================================================================ */
(function (global) {
'use strict';

const BASE = (document.body && document.body.dataset.base) || '';
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

const ADDONS = { name:{label:'Put a name on it', price:5}, match:{label:'Exact pattern match', price:12} };

/* ---------- catalog ----------
   `bundle:true` opts a product into the two bundle tiers.
   Currently the small impulse items only — flip per product. */
const PRODUCTS = [
  {id:1, h:'chonk-cat',            t:'Chonk Cat',            v:'chonky',  price:28, stock:1, sales:98,  new:0, badge:'best', bundle:0, img:'US8b84684e083da2/design/a10a0453f876e2aa.png',        desc:'A gloriously round cat with a face that says it has never once been told no. 95mm tall, prints solid, sits flat on any shelf.'},
  {id:2, h:'just-a-fat-cat',       t:'Just A Fat Cat',       v:'chonky',  price:26, stock:1, sales:71,  new:0, badge:'',     bundle:0, img:'US1958705a9b055b/design/7f6591f6a3701033.png',        desc:'No pose, no gimmick, just a very large cat. Smooth surfaces, no visible layer lines on the belly.'},
  {id:3, h:'sleepy-chonk',         t:'Sleepy Chonk',         v:'chonky',  price:26, stock:1, sales:84,  new:0, badge:'',     bundle:0, img:'US423f6abd75703/design/76fc93bdb5a4970c.jpeg',        desc:'Curled, paws tucked, fully asleep. The one people pick up and refuse to put down.'},
  {id:4, h:'chibi-sitting-cat',    t:'Chibi Sitting Cat',    v:'chibi',   price:22, stock:1, sales:91,  new:0, badge:'best', bundle:0, img:'USd27d295167c1da/design/2025-07-23_5d4511eb5ffbd8.png', desc:'Big head, tiny paws, tail wrapped round the side. 70mm — the easiest one to start a shelf with.'},
  {id:5, h:'yawning-chibi-cat',    t:'Yawning Chibi Cat',    v:'chibi',   price:22, stock:1, sales:77,  new:1, badge:'new',  bundle:0, img:'USa8052536c37dcd/design/2025-09-10_b13d6265afd3c.png',  desc:'Caught mid-yawn with its jaw wide open. Reads instantly from across a room.'},
  {id:6, h:'stretching-chibi-cat', t:'Stretching Chibi Cat', v:'chibi',   price:26, stock:1, sales:62,  new:1, badge:'',     bundle:0, img:'USbfedd9c3c494fc/design/2025-09-05_ab666ee339217.png',  desc:'Front paws forward, back arched. A long, low silhouette that suits a shelf edge.'},
  {id:7, h:'flexi-cat-keychain',   t:'Flexi Cat Keychain',   v:'flexi',   price:12, stock:1, sales:120, new:0, badge:'bogo', bundle:1, img:'US6b941ba8302236/design/2c7d72fa7a1a4499.png',        desc:'Articulated spine, printed in one piece. Clips to a bag and wiggles the whole way there.'},
  {id:8, h:'eggo-flexi-cat',       t:'EGGO Flexi Cat',       v:'flexi',   price:18, stock:1, sales:66,  new:1, badge:'new',  bundle:1, img:'USc93f92f737d9f9/design/7a063b158d3ec0d1.jpg',        desc:'A chunkier flexi with deeper segments. More satisfying in the hand, still pocket sized.'},
  {id:9, h:'flexi-cat-toy',        t:'Flexi Cat Toy',        v:'flexi',   price:16, stock:0, sales:54,  new:0, badge:'',     bundle:1, img:'US87ee968d70c396/design/854ab97a1aaa6e15.jpg',        desc:'The desk-sized flexi. Big enough to fidget with properly, no keyring loop.'},
  {id:10,h:'polyart-cat',          t:'Polyart Cat',          v:'lowpoly', price:30, stock:1, sales:47,  new:0, badge:'',     bundle:0, img:'USee1f05ca8ad757/design/2026-01-02_74299a8008cdf8.jpeg',desc:'Faceted, geometric, deliberately not cute. Looks like sculpture in a matte finish.'},
  {id:11,h:'low-poly-kitten',      t:'Low Poly Kitten',      v:'lowpoly', price:24, stock:1, sales:88,  new:0, badge:'',     bundle:0, img:'US9ac748e1f44cbe/design/2025-06-25_8c2c08fed57e18.png', desc:'A smaller, softer take on the faceted style. Prints support-free.'},
  {id:12,h:'knitted-cat-and-heart',t:'Knitted Cat & Heart',  v:'knitted', price:25, stock:1, sales:73,  new:0, badge:'',     bundle:0, img:'USa0cdd547441cc5/design/1296df07d3400d57.jpg',        desc:'Printed knit texture over the whole body, holding a heart. Reads handmade, not printed.'},
  {id:13,h:'valentine-cats',       t:'Valentine Cats',       v:'knitted', price:27, stock:0, sales:59,  new:0, badge:'',     bundle:0, img:'US392726ce369e51/design/75b7f3689637e1d6.jpg',        desc:'Sold as a pair, each with a heart-tipped tail. Seasonal — back for February.'},
  {id:14,h:'cat-mage',             t:'Cat Mage',             v:'witchy',  price:32, stock:1, sales:41,  new:1, badge:'new',  bundle:0, img:'USb8026e4b9070a5/design/928c0adb2e327397.png',        desc:'Staff, hat, and a deeply unimpressed expression. Scales to 28mm for the tabletop.'},
  {id:15,h:'cat-on-the-moon',      t:'Cat On The Moon',      v:'witchy',  price:34, stock:1, sales:69,  new:0, badge:'',     bundle:0, img:'US416f1196034dc/design/2025-07-04_0adc6d211b9ea8.jpg',  desc:'Perched on a crescent, 140mm tall. Our biggest piece and the best gift in the range.'},
  {id:16,h:'monitor-buddy',        t:'Monitor Buddy',        v:'chibi',   price:18, stock:1, sales:95,  new:1, badge:'best', bundle:1, img:'US92596077edfe56/design/bf532d11dd01e816.png',        desc:'Weighted paws hook over the top edge of a screen. Fits monitors and laptops up to 12mm.'},
  {id:17,h:'cat-phone-holder',     t:'Cat Phone Holder',     v:'chibi',   price:20, stock:1, sales:58,  new:0, badge:'',     bundle:1, img:'US931592a14e2589/design/2025-09-07_14593a0d045d88.jpg', desc:'Two-part slot-together stand, no glue. Holds a phone upright or landscape.'},
  {id:18,h:'cat-ring-holder',      t:'Cat Ring Holder',      v:'lowpoly', price:17, stock:1, sales:44,  new:0, badge:'',     bundle:1, img:'US7ea5f81d2d5672/design/0b5ed54000f4c3eb.png',        desc:'The tail is the ring post. Weighted base so it does not tip when you grab a ring.'},
  {id:19,h:'cat-paw-keychain',     t:'Cat Paw Keychain',     v:'flexi',   price:10, stock:1, sales:110, new:0, badge:'bogo', bundle:1, img:'US3844e8ad64d1c5/design/2025-03-30_9b5f916808dd7.jpg', desc:'A clicky paw with a satisfying snap. Optional recess inside for an NFC tag.'},
  {id:20,h:'cat-clicker',          t:'Cat Clicker',          v:'chonky',  price:15, stock:1, sales:102, new:1, badge:'best', bundle:1, img:'US13c90689edb9dd/design/7c22f4c81f77549b.png',        desc:'Press the belly. That is the whole product, and it is extremely hard to stop doing.'}
];
PRODUCTS.forEach(p => { p.imgUrl = im(p.img); p.sku = 'RP-' + String(p.id).padStart(4,'0'); });

/* ================================================================
   BUNDLE PRICING
   Tier 1  Buy 1 Get 1 Free  ->  2 units, pay 1
   Tier 2  Buy 5 Get 10 Free ->  15 units, pay 5
   Biggest tier is applied first, remainder falls back to BOGO.
   ================================================================ */
function unitsPaid(qty, eligible){
  if (!eligible) return qty;
  let paid = 0, left = qty;
  const fifteens = Math.floor(left / 15);
  paid += fifteens * 5;  left -= fifteens * 15;
  paid += Math.ceil(left / 2);          // BOGO on whatever is left
  return paid;
}
function freeUnits(qty, eligible){ return qty - unitsPaid(qty, eligible); }
const money = n => '$' + n.toFixed(2);

/* ================================================================
   CART — persisted so it survives navigating between pages
   ================================================================ */
const KEY = 'rp_cart_v1';
const FREE_SHIP = 65;
let CART = [];
try { CART = JSON.parse(localStorage.getItem(KEY)) || []; } catch(e) { CART = []; }
const saveCart = () => { try { localStorage.setItem(KEY, JSON.stringify(CART)); } catch(e){} };
const lineTotal = it => it.unit * unitsPaid(it.qty, it.bundle);
const cartCount = () => CART.reduce((n,i) => n + i.qty, 0);
const cartTotal = () => CART.reduce((s,i) => s + lineTotal(i), 0);

function addToCart(item){ CART.push(item); saveCart(); renderCart(); openCart(); }

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
    ['♥','Husband & wife, printed in the USA'], ['🎁','Buy 1 Get 1 Free · Buy 5 Get 10 Free'],
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
  body.innerHTML =
    `<div class="ship-bar">
       <p>${left > 0 ? "You're " + money(left) + ' away from free shipping' : '🎉 You’ve got free shipping'}</p>
       <div class="ship-track"><div class="ship-fill" style="width:${Math.min(100,total/FREE_SHIP*100)}%"></div></div>
     </div>` +
    CART.map((i,ix) => {
      const free = freeUnits(i.qty, i.bundle);
      return `<div class="ci">
        <img src="${i.img}" alt="${i.t}">
        <div>
          <div class="ci-t">${i.t}</div>
          <div class="ci-m">${i.color}${i.name ? ' · “'+i.name+'”' : ''}${i.match ? ' · exact match' : ''}</div>
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
  const pay = document.getElementById('shopPay');
  if (pay) pay.onclick = () => alert('Demo only — this is where Shop Pay / Stripe Checkout takes over.');
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCart(); });
  renderCart();
}

/* ---------- product card markup (shared by home + related rows) ---------- */
function cardHTML(p){
  const dots = COLORS.slice(0,5).map(([,,cls]) => `<span class="cdot ${cls}"></span>`).join('');
  const badge = p.badge==='new'  ? '<span class="cbadge b-new">New</span>'
              : p.badge==='best' ? '<span class="cbadge b-best">Bestseller</span>'
              : p.badge==='bogo' ? '<span class="cbadge b-bogo">BOGO free</span>' : '';
  return `<a class="card" href="${BASE}products/${p.h}.html">
    <div class="card-media">${badge}
      <img loading="lazy" src="${p.imgUrl}" alt="${p.t}">
      ${p.stock ? '' : '<span class="c-oos">Sold out</span>'}
    </div>
    <h3>${p.t}</h3>
    <div class="cvibe">${VIBES[p.v].name}</div>
    <div class="cprice">$${p.price}.00 USD</div>
    <div class="cdots">${dots}</div>
  </a>`;
}

function boot(){ mountCountdown(); mountMarquee(); mountShopDropdown(); mountCart(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

global.RP = { BASE, VIBES, COLORS, ADDONS, PRODUCTS, unitsPaid, freeUnits, money,
              addToCart, renderCart, openCart, closeCart, cardHTML, FREE_SHIP,
              get cart(){ return CART; } };
})(window);

/* ================================================================
   CatCustoms — shared browser JS

   Used by catcustoms.html, cc-template.html, cc-custom.html,
   cc-refills.html, cc-partner.html.

     CC.PRICE      all prices (see note below)
     CC.WAYS       Storybook Cottage colourways
     CC.cottage()  parametric SVG stand-in for product photography
     CC.photo()    <img> with automatic SVG fallback — drop a real
                   photo into Images/ and it takes over on its own
     CC.cart       localStorage cart + slide-over drawer
     CC.mountChrome() countdown + trust marquee, same as rp.js

   PRICES ARE DUPLICATED HERE ON PURPOSE — for now. This is a review
   build with no Stripe wiring. When CatCustoms moves into
   assets/catalog.js, delete CC.PRICE and read from RP_CATALOG so the
   browser, the build script and Stripe cannot disagree about a price.
   ================================================================ */
(function (root) {
'use strict';

var CC = root.CC = {};

/* ---------------- prices ---------------- */
CC.PRICE = {
  template: 59,
  /* second unit is 40% off */
  secondOff: 0.40,
  custom: 279,
  /* refills sold as packs; subscribing takes another 10% off */
  refill: {
    1: { price: 10, label: 'One insert',        note: 'A single replacement' },
    3: { price: 25, label: 'Three · half a year', note: 'About six months of use' },
    6: { price: 40, label: 'Six · a full year',   note: 'About twelve months of use' }
  },
  subDiscount: 0.10,
  keychain: { 1: 4, 2: 6 }
};

/* what a template order costs for n units, with 40% off the second */
CC.templateTotal = function (n) {
  var p = CC.PRICE.template, t = 0;
  for (var i = 0; i < n; i++) t += (i === 1) ? p * (1 - CC.PRICE.secondOff) : p;
  return Math.round(t * 100) / 100;
};
CC.money = function (n) {
  return '$' + (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, '');
};

/* ---------------- colourways ---------------- */
CC.WAYS = {
  cream:   { name:'Cottage Cream', body:'#f2e6d2', bodyDark:'#ddcbb2', timber:'#8a6a4d', timberDark:'#6d5039',
             sign:'#93a883', signInk:'#6b4f3a', plinth:'#e8d9c0', swatch:'#f2e6d2' },
  butter:  { name:'Buttercup',     body:'#f6d84e', bodyDark:'#dcbc32', timber:'#5f676f', timberDark:'#464d54',
             sign:'#a9c39b', signInk:'#6b4f3a', plinth:'#efce3f', swatch:'#f6d84e' },
  blossom: { name:'Blossom',       body:'#f2a9bb', bodyDark:'#dd8fa3', timber:'#9ec9a4', timberDark:'#7fae86',
             sign:'#9ec9a4', signInk:'#7a5c42', plinth:'#eb9bae', swatch:'#f2a9bb' },
  lilac:   { name:'Lilac Sky',     body:'#c3b1e1', bodyDark:'#a996cc', timber:'#a9c9ea', timberDark:'#8bb0d8',
             sign:'#a9c9ea', signInk:'#5f5183', plinth:'#b6a2d9', swatch:'#c3b1e1' }
};
CC.WAY_ORDER = ['cream','butter','blossom','lilac'];

var C = {
  box:'#c9533f', boxDark:'#a8412f', leaf:'#7d9b6a', leafDark:'#658054',
  bloom:'#fff6f2', bloomPink:'#ffc9d4', bloomCore:'#f6c86a',
  card:'#bb8b52', cardDark:'#9a6d3b', cardLine:'#a87a45',
  catA:'#c98f5e', catADark:'#a9713f', catB:'#82828a', catBDark:'#63636b',
  ink:'#3a2a1c'
};

function esc(s){ return String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function cat(x, y, coat, dark, scale) {
  var s = scale || 1;
  return '<g transform="translate(' + x + ',' + y + ') scale(' + s + ')">' +
    '<path d="M-15-7 L-18-22 L-6-14 Z" fill="' + coat + '"/>' +
    '<path d="M15-7 L18-22 L6-14 Z" fill="' + coat + '"/>' +
    '<path d="M-14-9 L-15.6-17 L-8-12.5 Z" fill="' + C.bloomPink + '" opacity=".75"/>' +
    '<path d="M14-9 L15.6-17 L8-12.5 Z" fill="' + C.bloomPink + '" opacity=".75"/>' +
    '<ellipse cx="0" cy="0" rx="17" ry="14.5" fill="' + coat + '"/>' +
    '<path d="M-11-9q4 4 2 9M0-12q0 5 0 8M11-9q-4 4-2 9" stroke="' + dark +
      '" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".7"/>' +
    '<ellipse cx="-6" cy="1.5" rx="3.4" ry="3.8" fill="' + C.ink + '"/>' +
    '<ellipse cx="6" cy="1.5" rx="3.4" ry="3.8" fill="' + C.ink + '"/>' +
    '<circle cx="-4.9" cy="0.2" r="1.2" fill="#fff"/><circle cx="7.1" cy="0.2" r="1.2" fill="#fff"/>' +
    '<path d="M-2.6 7 L2.6 7 L0 9.4 Z" fill="' + C.bloomPink + '"/>' +
    '<path d="M0 9.4v2.2M0 11.6q-3 2.4-6 .8M0 11.6q3 2.4 6 .8" stroke="' + dark +
      '" stroke-width="1.5" fill="none" stroke-linecap="round"/></g>';
}

function flowerbox(x, y, w) {
  var o = '<g transform="translate(' + x + ',' + y + ')">' +
    '<rect x="' + (-w/2) + '" y="0" width="' + w + '" height="15" rx="3" fill="' + C.box + '"/>' +
    '<rect x="' + (-w/2) + '" y="0" width="' + w + '" height="4.5" rx="2" fill="' + C.boxDark + '" opacity=".55"/>';
  var n = Math.max(3, Math.round(w / 13));
  for (var i = 0; i < n; i++) {
    var fx = -w/2 + (w/(n-1))*i, up = (i % 2 ? -8 : -5.5);
    o += '<ellipse cx="' + fx + '" cy="' + (up+2) + '" rx="5" ry="4" fill="' + C.leaf + '"/>' +
         '<circle cx="' + fx + '" cy="' + up + '" r="3.1" fill="' + (i%2 ? C.bloom : C.bloomPink) + '"/>' +
         '<circle cx="' + fx + '" cy="' + up + '" r="1.1" fill="' + C.bloomCore + '"/>';
  }
  return o + '</g>';
}

function sprig(x, y, s) {
  s = s || 1;
  return '<g transform="translate(' + x + ',' + y + ') scale(' + s + ')">' +
    '<ellipse cx="-5" cy="0" rx="5.5" ry="3.4" fill="' + C.leaf + '" transform="rotate(-24 -5 0)"/>' +
    '<ellipse cx="5" cy="0" rx="5.5" ry="3.4" fill="' + C.leafDark + '" transform="rotate(24 5 0)"/>' +
    '<circle cx="0" cy="-3" r="3.4" fill="' + C.bloom + '"/>' +
    '<circle cx="0" cy="-3" r="1.2" fill="' + C.bloomCore + '"/></g>';
}

/* The nameplate always reads "Luna & Ruska" — it is a picture of a real
   previous order, not a live preview. Typing a name in the product page
   must NOT repaint it. */
CC.cottage = function (wayKey) {
  var w = CC.WAYS[wayKey] || CC.WAYS.cream;
  var label = 'Luna & Ruska';
  var uid = 'w' + wayKey;

  var o = '<svg viewBox="0 0 560 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' +
    esc(w.name + ' cottage scratcher') + '">';
  o += '<defs><clipPath id="well' + uid + '"><path d="M99.7 177.8 L374.9 177.8 L464.3 126.2 L189.1 126.2 Z"/></clipPath></defs>';
  o += '<ellipse cx="288" cy="336" rx="220" ry="24" fill="#1a1440" opacity=".11"/>';
  o += '<path d="M70 182 L390 182 L494 122 L174 122 Z" fill="' + w.body + '"/>';
  o += '<path d="M99.7 177.8 L374.9 177.8 L464.3 126.2 L189.1 126.2 Z" fill="' + C.cardDark + '"/>';
  o += '<g clip-path="url(#well' + uid + ')"><path d="M101 176.4 L373.6 176.4 L463 127.6 L190.4 127.6 Z" fill="' + C.card + '"/>';
  for (var i = 0; i <= 40; i++) {
    var t = i/40;
    o += '<line x1="' + (101+(373.6-101)*t).toFixed(1) + '" y1="176.4" x2="' + (190.4+(463-190.4)*t).toFixed(1) +
         '" y2="127.6" stroke="' + C.cardLine + '" stroke-width="2.6" opacity=".9"/>';
  }
  o += '</g>';
  o += '<path d="M390 300 L494 240 L494 122 L390 182 Z" fill="' + w.bodyDark + '"/>';
  o += '<g fill="' + w.timberDark + '" opacity=".85"><path d="M390 190 L494 130 L494 140 L390 200 Z"/>' +
       '<path d="M390 252 L494 192 L494 202 L390 262 Z"/><path d="M436 165 L446 159 L446 277 L436 283 Z"/></g>';
  o += '<path d="M404 244 q0-27 21-39 q21-12 21 13 v34 l-42 24 Z" fill="' + w.sign + '" opacity=".7"/>';
  o += '<path d="M410 242 q0-22 17-32 q17-10 17 11 v28 l-34 20 Z" fill="#3a2e24" opacity=".75"/>';
  o += '<path d="M70 182 L390 182 L390 300 L70 300 Z" fill="' + w.body + '"/>';
  o += '<path d="M70 182 L390 182 L390 194 L70 194 Z" fill="' + w.body + '"/>';
  var scal = 'M70 194 L70 184 ';
  for (var s3 = 0; s3 < 10; s3++) scal += 'q16 -11 32 0 ';
  scal += 'L390 194 Z';
  o += '<path d="' + scal + '" fill="' + w.body + '"/>';
  o += '<path d="M70 194 L390 194" stroke="' + w.bodyDark + '" stroke-width="2.5" opacity=".55"/>';
  o += '<path d="M390 194 L494 134 L494 122 L390 182 Z" fill="' + w.bodyDark + '" opacity=".6"/>';
  o += '<g fill="' + w.timber + '"><rect x="70" y="196" width="320" height="10"/><rect x="70" y="256" width="320" height="9"/>';
  var posts = [70,116,162,208,254,300,346,380];
  for (var p = 0; p < posts.length; p++) o += '<rect x="' + posts[p] + '" y="196" width="10" height="104"/>';
  o += '</g>';
  o += '<g stroke="' + w.timber + '" stroke-width="8" stroke-linecap="round" fill="none" opacity=".95">' +
       '<path d="M176 254 L198 212"/><path d="M240 212 L262 254"/><path d="M314 254 L336 212"/></g>';
  function win(cx) {
    return '<g><path d="M' + (cx-36) + ' 266 v-28 a36 36 0 0 1 72 0 v28 Z" fill="' + w.sign + '"/>' +
      '<path d="M' + (cx-29) + ' 264 v-26 a29 29 0 0 1 58 0 v26 Z" fill="' + w.timberDark + '"/>' +
      '<path d="M' + (cx-23) + ' 263 v-25 a23 23 0 0 1 46 0 v25 Z" fill="#4a3b2e"/></g>';
  }
  o += win(125) + cat(125, 240, C.catA, C.catADark, 1.05) + flowerbox(125, 256, 62);
  o += win(335) + cat(335, 240, C.catB, C.catBDark, 1.05) + flowerbox(335, 256, 62);
  o += '<g transform="translate(230,232) scale(.9)">' +
    '<path d="M-78 0 q0-13 13-15 q3-11 17-9 q7-9 20-5 q9-7 19 0 q13-4 20 5 q14-2 17 9 q13 2 13 15' +
      ' q0 13-13 15 q-3 11-17 9 q-7 9-19 5 q-10 7-20 0 q-13 4-20-5 q-14 2-17-9 q-13-2-13-15 Z" fill="' + w.sign + '"/>' +
    '<path d="M-69 0 q0-9 10-11 q3-8 14-6 q6-7 16-4 q8-5 16 0 q11-3 16 4 q11-2 14 6 q10 2 10 11' +
      ' q0 9-10 11 q-3 8-14 6 q-6 7-16 4 q-8 5-16 0 q-11 3-16-4 q-11 2-14-6 q-10-2-10-11 Z" fill="' + w.body + '"/>' +
    '<text x="0" y="7" text-anchor="middle" font-family="Fredoka, Nunito, sans-serif" font-weight="600" ' +
      'font-size="20" fill="' + w.signInk + '">' + esc(label) + '</text></g>';
  o += sprig(93,288,.95) + sprig(186,288,.8) + sprig(278,288,.8) + sprig(371,288,.95);
  o += '<path d="M58 300 L402 300 L402 322 L58 322 Z" fill="' + w.plinth + '"/>';
  o += '<path d="M402 300 L506 240 L506 262 L402 322 Z" fill="' + w.bodyDark + '"/>';
  o += '<path d="M58 300 L402 300 L408 296 L64 296 Z" fill="' + w.body + '"/>';
  o += '<path d="M402 300 L506 240 L500 237 L396 297 Z" fill="' + w.body + '" opacity=".8"/>';
  return o + '</svg>';
};

/* ================================================================
   PHOTO WITH FALLBACK

   <div class="art" data-photo="Images/cc-cottage-cream.jpg" data-way="cream">

   Renders an <img>. If the file isn't there yet the SVG stand-in takes
   over automatically — so the moment a real photo is saved into
   Images/ under that name, the page starts using it with no code
   change. See Images/CC-IMAGE-LIST.md for the filenames.
   ================================================================ */
CC.paintArt = function (scope) {
  var nodes = (scope || document).querySelectorAll('[data-photo],[data-cottage]');
  Array.prototype.forEach.call(nodes, function (el) {
    if (el.getAttribute('data-painted') === '1') return;
    var src = el.getAttribute('data-photo');
    var way = el.getAttribute('data-way') || el.getAttribute('data-cottage') || 'cream';
    var alt = el.getAttribute('data-alt') || (CC.WAYS[way] ? CC.WAYS[way].name + ' cat scratcher' : 'CatCustoms cat scratcher');
    var note = el.hasAttribute('data-nonote') ? '' : '<span class="artnote" data-note>ILLUSTRATION</span>';

    function drawSvg() {
      el.innerHTML = CC.cottage(way) + note;
    }
    if (!src) { drawSvg(); el.setAttribute('data-painted','1'); return; }

    var img = new Image();
    img.onload = function () {
      el.innerHTML = '<img src="' + esc(src) + '" alt="' + esc(alt) + '">';
      el.setAttribute('data-real','1');
    };
    img.onerror = drawSvg;
    img.src = src;
    drawSvg();                     /* show something immediately */
    el.setAttribute('data-painted','1');
  });
};

/* ================================================================
   PAGE CHROME — countdown + trust marquee, mirroring rp.js
   ================================================================ */
function ordinal(n){ var s=['th','st','nd','rd'], v=n%100; return n + (s[(v-20)%10] || s[v] || s[0]); }

CC.mountChrome = function () {
  /* --- next inventory drop --- */
  var bar = document.getElementById('dropBar'), cd = document.getElementById('cd');
  if (bar && cd) {
    var now = new Date();
    var d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 19, 16, 0, 0));
    while (d - now <= 0) d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+1, 19, 16, 0, 0));
    var MO = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var when = document.getElementById('dropWhen');
    if (when) when.textContent = MO[d.getUTCMonth()] + ' ' + ordinal(d.getUTCDate()) + ', 12PM EDT';
    var UNITS = [['Days',864e5],['Hours',36e5],['Minutes',6e4],['Seconds',1e3]];
    cd.innerHTML = UNITS.map(function (u) {
      return '<div class="cd-unit"><div class="cd-nums" data-u="' + u[0] + '"></div><div class="cd-cap">' + u[0] + '</div></div>';
    }).join('');
    var tick = function () {
      var left = Math.max(0, d - new Date());
      UNITS.forEach(function (u) {
        var val = Math.floor(left / u[1]); left -= val * u[1];
        var str = String(val).length < 2 ? '0' + val : String(val);
        var host = cd.querySelector('[data-u="' + u[0] + '"]');
        if (host.children.length !== str.length)
          host.innerHTML = str.split('').map(function(){ return '<span class="cd-d"></span>'; }).join('');
        str.split('').forEach(function (ch, i) {
          if (host.children[i].textContent !== ch) host.children[i].textContent = ch;
        });
      });
    };
    tick(); setInterval(tick, 1000);
    var x = document.getElementById('dropX');
    if (x) x.onclick = function () { bar.remove(); };
  }

  /* --- trust marquee --- */
  var track = document.getElementById('mqTrack');
  if (track) {
    var items = [
      ['♥','Husband &amp; wife, made in the USA'], ['✈','Shipping across the USA'],
      ['★','Current fulfillment: 5–10 business days'], ['♥','Your cat, designed into the piece'],
      ['🎁','Free US shipping over $65'], ['★','Replaceable cardboard insert'],
      ['♥','Only 3 one-of-one commissions a month']
    ];
    var group = '<div class="mq-group">' + items.map(function (it) {
      return '<span class="mq-item"><span aria-hidden="true">' + it[0] + '</span>' + it[1] + '</span>';
    }).join('') + '</div>';
    track.innerHTML = group + group;
  }

  /* --- mobile nav toggle --- */
  var burger = document.querySelector('[data-burger]');
  if (burger) burger.addEventListener('click', function () {
    var strip = document.querySelector('.nav-strip');
    var open = strip.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
  });
};

/* ================================================================
   CART
   ================================================================ */
var KEY = 'cc_cart_v2';

CC.cart = {
  read: function () { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } },
  write: function (items) { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {} CC.cart.render(); },
  add: function (item) {
    var items = CC.cart.read(); items.push(item); CC.cart.write(items);
    CC.toast(item.title + ' added'); CC.drawer(true);
  },
  remove: function (i) { var items = CC.cart.read(); items.splice(i,1); CC.cart.write(items); },
  total: function () { return CC.cart.read().reduce(function (n, it) { return n + it.price; }, 0); },
  count: function () { return CC.cart.read().reduce(function (n, it) { return n + (it.qty || 1); }, 0); },
  render: function () {
    var items = CC.cart.read();
    Array.prototype.forEach.call(document.querySelectorAll('[data-cart-count]'), function (cnt) {
      cnt.textContent = CC.cart.count() || '0';
    });
    var body = document.querySelector('[data-cart-body]');
    if (!body) return;
    if (!items.length) {
      body.innerHTML = '<div class="dr-empty">Nothing in here yet.<br>Pick a template to get started.</div>';
    } else {
      body.innerHTML = items.map(function (it, i) {
        var art = it.way
          ? '<div class="ci-art"><div class="art" data-cottage="' + it.way + '" data-nonote></div></div>'
          : '<div class="ci-art ci-icon">' + (it.icon || '📦') + '</div>';
        return '<div class="ci">' + art + '<div class="ci-t"><b>' + esc(it.title) + '</b><span>' + esc(it.sub || '') + '</span>' +
          '<button class="ci-rm" data-rm="' + i + '">Remove</button></div>' +
          '<div class="ci-p">' + CC.money(it.price) + '</div></div>';
      }).join('');
      CC.paintArt(body);
    }
    var tot = document.querySelector('[data-cart-total]');
    if (tot) tot.textContent = CC.money(CC.cart.total());
    var co = document.querySelector('[data-checkout]');
    if (co) co.setAttribute('aria-disabled', items.length ? 'false' : 'true');
  }
};

CC.drawer = function (open) {
  var d = document.querySelector('.drawer'), s = document.querySelector('.scrim');
  if (!d) return;
  d.classList.toggle('on', !!open);
  if (s) s.classList.toggle('on', !!open);
  document.body.style.overflow = open ? 'hidden' : '';
};

var toastTimer;
CC.toast = function (msg) {
  var t = document.querySelector('.toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.classList.remove('on'); }, 2400);
};

CC.mount = function () {
  CC.paintArt(document);
  CC.cart.render();
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('[data-cart-open]')) { e.preventDefault(); CC.drawer(true); return; }
    if (t.closest('[data-cart-close]') || t.classList.contains('scrim')) { CC.drawer(false); return; }
    var rm = t.closest('[data-rm]');
    if (rm) { CC.cart.remove(+rm.getAttribute('data-rm')); return; }
    var co = t.closest('[data-checkout]');
    if (co) {
      e.preventDefault();
      if (co.getAttribute('aria-disabled') === 'true') return;
      CC.toast('Checkout is not wired to Stripe yet — see the note below');
    }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') CC.drawer(false); });
};

/* ================================================================
   REFILLS — pack size + one-off vs subscription
   ================================================================ */
CC.initRefills = function () {
  var tiles = document.querySelectorAll('[data-refill]');
  if (!tiles.length) return;
  var modes = document.querySelectorAll('[data-mode]');
  var btn   = document.querySelector('[data-refill-add]');
  var sum   = document.querySelector('[data-refill-label]');
  var pick = 3, sub = true;

  function priceFor(n, isSub) {
    var base = CC.PRICE.refill[n].price;
    return isSub ? Math.round(base * (1 - CC.PRICE.subDiscount) * 100) / 100 : base;
  }

  function paint() {
    Array.prototype.forEach.call(tiles, function (el) {
      var n = +el.getAttribute('data-refill');
      el.setAttribute('aria-pressed', String(n === pick));
      var pn = el.querySelector('[data-tile-price]');
      if (pn) pn.textContent = CC.money(priceFor(n, sub));
      var was = el.querySelector('[data-tile-was]');
      if (was) { was.textContent = CC.money(CC.PRICE.refill[n].price); was.hidden = !sub; }
    });
    Array.prototype.forEach.call(modes, function (m) {
      m.setAttribute('aria-pressed', String((m.getAttribute('data-mode') === 'sub') === sub));
    });
    var p = priceFor(pick, sub);
    if (sum) sum.textContent = CC.PRICE.refill[pick].label + ' — ' + CC.money(p) + (sub ? ', delivered automatically' : ', one time');
    if (btn) btn.textContent = (sub ? 'Subscribe — ' : 'Order — ') + CC.money(p);
  }

  Array.prototype.forEach.call(tiles, function (el) {
    el.addEventListener('click', function () { pick = +el.getAttribute('data-refill'); paint(); });
  });
  Array.prototype.forEach.call(modes, function (m) {
    m.addEventListener('click', function () { sub = m.getAttribute('data-mode') === 'sub'; paint(); });
  });
  if (btn) btn.addEventListener('click', function (e) {
    e.preventDefault();
    CC.cart.add({
      title: CC.PRICE.refill[pick].label,
      sub: (sub ? 'Subscription · 10% off' : 'One-time order') + ' · fits every design',
      price: priceFor(pick, sub), qty: 1, icon: sub ? '🔁' : '📦'
    });
  });
  paint();
};

/* ================================================================
   PRODUCT PAGE
   ================================================================ */
CC.initPDP = function () {
  var root = document.querySelector('[data-pdp]');
  if (!root) return;

  var state = { way: 'cream', name: '', qty: 1, refill: false, keys: 0 };
  var stage    = root.querySelector('[data-pdp-art]');
  var thumbs   = root.querySelectorAll('[data-pdp-thumb]');
  var picks    = root.querySelectorAll('[data-pdp-way]');
  var wayLabel = root.querySelector('[data-way-label]');
  var nameIn   = root.querySelector('[data-pdp-name]');
  var nameEcho = root.querySelector('[data-name-echo]');
  var nameCt   = root.querySelector('[data-name-count]');
  var qtyOut   = root.querySelector('[data-qty-n]');
  var qtyNote  = root.querySelector('[data-qty-note]');
  var totalOut = root.querySelector('[data-pdp-total]');
  var saveOut  = root.querySelector('[data-pdp-save]');
  var addRows  = root.querySelectorAll('[data-add]');
  var addBtn   = root.querySelector('[data-pdp-add]');
  var MAXNAME  = 18;

  function total() {
    var t = CC.templateTotal(state.qty);
    if (state.refill) t += CC.PRICE.refill[3].price;
    if (state.keys)   t += CC.PRICE.keychain[state.keys];
    return t;
  }

  function swapPhoto(el, way) {
    if (!el) return;
    el.setAttribute('data-way', way);
    el.setAttribute('data-photo', 'Images/cc-cottage-' + way + '.jpg');
    el.removeAttribute('data-painted');
    el.removeAttribute('data-real');
    CC.paintArt(el.parentNode);
  }

  function paint() {
    swapPhoto(stage, state.way);
    Array.prototype.forEach.call(picks, function (b) {
      var on = b.getAttribute('data-pdp-way') === state.way;
      b.setAttribute('aria-pressed', String(on));
      if (b.parentNode) b.parentNode.setAttribute('data-on', on ? '1' : '0');
    });
    Array.prototype.forEach.call(thumbs, function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-pdp-thumb') === state.way));
    });
    if (wayLabel) wayLabel.textContent = CC.WAYS[state.way].name;
    if (nameCt)   nameCt.textContent = state.name.length + '/' + MAXNAME;
    if (nameEcho) nameEcho.textContent = state.name || 'Luna & Ruska';
    if (qtyOut)   qtyOut.textContent = state.qty;

    if (qtyNote) {
      if (state.qty === 1) {
        qtyNote.innerHTML = '<b>Add a second and it’s 40% off</b> — ' + CC.money(CC.PRICE.template * 0.6) +
          ' instead of ' + CC.money(CC.PRICE.template) + '. Two cats, two houses, or one for somebody else.';
        qtyNote.setAttribute('data-tone','offer');
      } else {
        qtyNote.innerHTML = '<b>Second one is 40% off.</b> You’re saving ' +
          CC.money(CC.PRICE.template * CC.PRICE.secondOff) + ' on this order.';
        qtyNote.setAttribute('data-tone','won');
      }
    }
    Array.prototype.forEach.call(addRows, function (r) {
      var kind = r.getAttribute('data-add');
      var on = kind === 'refill' ? state.refill : state.keys === +r.getAttribute('data-keys');
      r.setAttribute('data-on', on ? '1' : '0');
      var tick = r.querySelector('.tick');
      if (tick) tick.textContent = on ? '✓' : '';
    });
    if (totalOut) totalOut.textContent = CC.money(total());
    if (saveOut) {
      var saved = (CC.PRICE.template * state.qty) - CC.templateTotal(state.qty);
      saveOut.textContent = saved > 0 ? 'You save ' + CC.money(saved) : '';
      saveOut.hidden = saved <= 0;
    }
  }

  Array.prototype.forEach.call(picks, function (b) {
    b.addEventListener('click', function () { state.way = b.getAttribute('data-pdp-way'); paint(); });
  });
  Array.prototype.forEach.call(thumbs, function (b) {
    b.addEventListener('click', function () { state.way = b.getAttribute('data-pdp-thumb'); paint(); });
  });
  if (nameIn) nameIn.addEventListener('input', function () {
    state.name = nameIn.value.slice(0, MAXNAME);
    if (nameIn.value !== state.name) nameIn.value = state.name;
    paint();
  });
  root.addEventListener('click', function (e) {
    var q = e.target.closest('[data-qty]');
    if (q) { state.qty = Math.max(1, Math.min(9, state.qty + (+q.getAttribute('data-qty')))); paint(); return; }
    var a = e.target.closest('[data-add]');
    if (a) {
      var kind = a.getAttribute('data-add');
      if (kind === 'refill') state.refill = !state.refill;
      else { var k = +a.getAttribute('data-keys'); state.keys = (state.keys === k) ? 0 : k; }
      paint();
    }
  });

  if (addBtn) addBtn.addEventListener('click', function (e) {
    e.preventDefault();
    CC.cart.add({
      title: 'Storybook Cottage' + (state.qty > 1 ? ' ×' + state.qty : ''),
      sub: CC.WAYS[state.way].name + (state.name ? ' · “' + state.name + '”' : ' · name to follow'),
      price: CC.templateTotal(state.qty), qty: state.qty, way: state.way
    });
    if (state.refill) CC.cart.add({
      title: 'Three refill inserts', sub: 'Added with your scratcher',
      price: CC.PRICE.refill[3].price, qty: 1, icon: '📦'
    });
    if (state.keys) CC.cart.add({
      title: state.keys === 2 ? 'Two keychains' : 'One keychain',
      sub: 'Same design, pocket-sized', price: CC.PRICE.keychain[state.keys], qty: 1, icon: '🔑'
    });
  });

  paint();
};

/* ================================================================
   PARTNER PAGE — business vs sitter fork
   ================================================================ */
CC.initPartner = function () {
  var tabs = document.querySelectorAll('[data-ptab]');
  if (!tabs.length) return;
  var panes = document.querySelectorAll('[data-ppane]');
  var typeField = document.querySelector('[data-partner-type]');

  function pick(kind) {
    Array.prototype.forEach.call(tabs, function (t) {
      t.setAttribute('aria-pressed', String(t.getAttribute('data-ptab') === kind));
    });
    Array.prototype.forEach.call(panes, function (p) {
      p.hidden = p.getAttribute('data-ppane') !== kind;
    });
    if (typeField) typeField.value = kind === 'business' ? 'Business (vet / shelter / pet store)' : 'Independent cat sitter';
  }
  Array.prototype.forEach.call(tabs, function (t) {
    t.addEventListener('click', function () { pick(t.getAttribute('data-ptab')); });
  });
  pick('business');
};

/* ================================================================
   FORMS — mailto until a CatCustoms endpoint exists
   ================================================================ */
CC.initForms = function () {
  Array.prototype.forEach.call(document.querySelectorAll('form[data-mailto]'), function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var lines = [];
      Array.prototype.forEach.call(f.querySelectorAll('[name]'), function (el) {
        var lbl = el.getAttribute('data-label') || el.getAttribute('name');
        if (el.value) lines.push(lbl + ': ' + el.value);
      });
      var ok = f.querySelector('.okmsg');
      if (ok) ok.classList.add('on');
      window.location.href = 'mailto:' + f.getAttribute('data-mailto') +
        '?subject=' + encodeURIComponent(f.getAttribute('data-subject') || 'CatCustoms enquiry') +
        '&body=' + encodeURIComponent(lines.join('\n\n'));
    });
  });
};

function boot() {
  CC.mountChrome(); CC.mount(); CC.initRefills(); CC.initPDP(); CC.initPartner(); CC.initForms();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})(window);

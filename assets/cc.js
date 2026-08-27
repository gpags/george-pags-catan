/* ================================================================
   CatCustoms — shared browser JS

   Used by index.html, cottage-kitties.html, sleepy-kitty.html, cc-custom.html,
   cc-refills.html, cc-partner.html.

     CAT          assets/catalog.js — the only place prices live
     CC.WAYS       Cottage Kitties colorways
     CC.cottage()  parametric SVG stand-in for product photography
     CC.photo()    <img> with automatic SVG fallback — drop a real
                   photo into images/ and it takes over on its own
     CC.cart       localStorage cart + slide-over drawer
     CC.mountChrome() countdown + trust marquee, same as rp.js

   catalog.js MUST load before this file on every page. It owns every
   price, the colorway keys, the 40%-off-the-second-scratcher rule and
   the cart-shape rules, and api/checkout.js recomputes all of them
   server-side from that same file.
   ================================================================ */
(function (root) {
'use strict';

var CC = root.CC = {};

/* ---------------- catalog ----------------
   Prices used to live in CC.PRICE, duplicated from assets/catalog.js.
   They do not any more. catalog.js is the single source of truth and
   api/checkout.js recomputes every total from that same file, so what
   this page shows and what Stripe charges cannot drift apart.

   Every CatCustoms page must load assets/catalog.js BEFORE assets/cc.js. */
var CAT = root.RP_CATALOG;
if (!CAT) throw new Error('cc.js: assets/catalog.js must be loaded first');

CC.money = function (n) {
  return '$' + (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, '');
};

/* ---------------- colorways ---------------- */
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


/* A stack of corrugated refill pads. Same fallback contract as
   CC.cottage: a real photo at images/cc-refill-inserts.jpg wins. */
CC.insert = function () {
  var o = '<svg viewBox="0 0 560 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Replacement corrugated cardboard inserts">';
  o += '<ellipse cx="280" cy="340" rx="200" ry="20" fill="#1a1440" opacity=".10"/>';
  function pad(ox, oy, w, h, face, edge, line) {
    var g = '<g transform="translate(' + ox + ',' + oy + ')">';
    g += '<path d="M0 0 L' + w + ' 0 L' + (w + 70) + ' -40 L70 -40 Z" fill="' + face + '"/>';
    g += '<path d="M0 0 L' + w + ' 0 L' + w + ' ' + h + ' L0 ' + h + ' Z" fill="' + edge + '"/>';
    for (var i = 0; i <= 26; i++) {
      var t = i / 26;
      g += '<line x1="' + (t * w).toFixed(1) + '" y1="0" x2="' + (70 + t * w).toFixed(1) +
           '" y2="-40" stroke="' + line + '" stroke-width="2.4" opacity=".85"/>';
    }
    for (var j = 0; j <= 22; j++) {
      var u = j / 22;
      g += '<path d="M' + (u * w).toFixed(1) + ' ' + (h * 0.25) + ' q3 ' + (h * 0.25) + ' 0 ' + (h * 0.5) +
           '" fill="none" stroke="' + line + '" stroke-width="1.8" opacity=".55"/>';
    }
    return g + '</g>';
  }
  o += pad(60, 300, 300, 20, '#c99a5f', '#a87a45', '#b8894f');
  o += pad(90, 268, 300, 20, '#cfa268', '#b0824c', '#bf9057');
  o += pad(122, 236, 300, 20, '#d6ab73', '#b98b53', '#c69a60');
  o += '</svg>';
  return o;
};

/* ================================================================
   PHOTO WITH FALLBACK

   <div class="art" data-photo="images/cc-cottage-cream.jpg" data-way="cream">

   Renders an <img>. If the file isn't there yet the SVG stand-in takes
   over automatically — so the moment a real photo is saved into
   images/ under that name, the page starts using it with no code
   change. See images/CC-IMAGE-LIST.md for the filenames.
   ================================================================ */
CC.paintArt = function (scope) {
  var nodes = (scope || document).querySelectorAll('[data-photo],[data-cottage],[data-insert]');
  Array.prototype.forEach.call(nodes, function (el) {
    if (el.getAttribute('data-painted') === '1') return;
    el.setAttribute('data-painted', '1');

    var src  = el.getAttribute('data-photo');
    var way  = el.getAttribute('data-way') || el.getAttribute('data-cottage') || 'cream';
    var note = el.getAttribute('data-note');          /* placeholder caption, if any */
    var alt  = el.getAttribute('data-alt') ||
               (CC.WAYS[way] ? CC.WAYS[way].name + ' cat scratcher' : 'CatCustoms cat scratcher');
    var chip = el.hasAttribute('data-nonote') ? '' : '<span class="artnote">ILLUSTRATION</span>';

    /* What to draw when no photograph can be found. Slots that name a
       placeholder caption (the journey) get the caption; product slots
       get the drawn cottage. */
    function fallback() {
      if (note) {
        el.classList.add('ph');
        el.innerHTML = '<span class="swap">' + esc(note) +
          (src ? '<code>' + esc(src) + '</code>' : '') + '</span>';
      } else if (el.hasAttribute('data-insert')) {
        el.innerHTML = CC.insert() + chip;
      } else if (CC.WAYS[way]) {
        /* Only the Cottage Kitties colorways have a drawn stand-in. Every
           other design would otherwise be represented by a picture of a
           cottage, which is worse than an honest empty frame. */
        el.innerHTML = CC.cottage(way) + chip;
      } else {
        el.classList.add('ph');
        el.innerHTML = '<span class="swap">' + esc(alt) + '</span>';
      }
    }

    if (!src) { fallback(); return; }

    /* The whole site uses lowercase images/ — Catan alone has 89 such
       references, and the capital Images/ folder is deleted Catan-era
       legacy. Vercel's filesystem is case-sensitive, so if a file were
       ever uploaded to the capital folder by mistake we retry there
       before giving up. Lowercase is the convention; keep it. */
    function flipDir(u) {
      if (u.indexOf('images/') === 0) return 'Images/' + u.slice(7);
      if (u.indexOf('Images/') === 0) return 'images/' + u.slice(7);
      return null;
    }

    function show(url) {
      el.classList.remove('ph');
      el.innerHTML = '<img src="' + esc(url) + '" alt="' + esc(alt) + '" loading="lazy">';
      el.setAttribute('data-real', '1');
    }

    function tryLoad(url, onFail) {
      var img = new Image();
      img.onload = function () { show(url); };
      img.onerror = onFail;
      img.src = url;
    }

    fallback();                                   /* draw something immediately */
    tryLoad(src, function () {
      var alt2 = flipDir(src);
      if (alt2) tryLoad(alt2, fallback); else fallback();
    });
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
      ['🎁','Free US shipping on two-scratcher orders'], ['★','Replaceable cardboard insert'],
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
/* v2 stored a price inside each item. v3 stores only what identifies the
   line — handle, colorway, quantity, nameplate text — and looks the price up
   from the catalog on every render. An edited localStorage can therefore
   change what you see, but never what you are charged: api/checkout.js
   re-derives every cent from the same catalog and ignores the rest. */
var KEY = 'cc_cart_v3';

function cartRead() {
  var raw = [];
  try { raw = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { raw = []; }
  /* Drop anything that is no longer a real product. A renamed or retired
     handle would otherwise sit in the cart and fail at checkout with a
     message the customer cannot act on. */
  return raw.filter(function (i) {
    var p = i && CAT.BY_HANDLE[i.h];
    return !!p && i.qty > 0 && p.colorsAvailable.indexOf(i.color) !== -1;
  });
}

/* The exact payload api/checkout.js expects. No money is sent. */
function cartPayload(items) {
  return (items || cartRead()).map(function (i) {
    return { handle: i.h, qty: i.qty, color: i.color, addons: { name: i.name || '' } };
  });
}

CC.cart = {
  read: cartRead,
  payload: cartPayload,

  write: function (items) {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {}
    CC.cart.render();
  },

  /* Same product, colorway and nameplate collapses into one line with a
     bigger quantity, so the bundle ladder and the second-unit discount
     both see the real quantity instead of two lines of one. */
  add: function (item) {
    var items = cartRead(), i, hit = null;
    for (i = 0; i < items.length; i++) {
      if (items[i].h === item.h && items[i].color === item.color &&
          (items[i].name || '') === (item.name || '')) { hit = items[i]; break; }
    }
    if (hit) hit.qty += (item.qty || 1);
    else items.push({ h: item.h, qty: item.qty || 1, color: item.color, name: item.name || '' });
    CC.cart.write(items);
    CC.toast(((CAT.BY_HANDLE[item.h] || {}).t || 'Item') + ' added');
    CC.drawer(true);
  },

  remove: function (ix) { var items = cartRead(); items.splice(ix, 1); CC.cart.write(items); },

  lineTotal: function (it) {
    var p = CAT.BY_HANDLE[it.h];
    if (!p) return 0;
    return CAT.priceFor(p, it.qty) + (it.name ? CAT.ADDONS.name.price : 0) * it.qty;
  },

  /* Order-level, so it can only be resolved once the whole cart is known.
     api/checkout.js applies the identical catalog function. */
  discount: function () { return CAT.secondUnitDiscount(cartPayload()); },

  total: function () {
    var items = cartRead(), sum = 0, i;
    for (i = 0; i < items.length; i++) sum += CC.cart.lineTotal(items[i]);
    return Math.max(0, Math.round((sum - CC.cart.discount()) * 100) / 100);
  },

  count: function () {
    return cartRead().reduce(function (n, it) { return n + (it.qty || 1); }, 0);
  },

  /* Cart-shape rules the catalog owns, e.g. "a keychain only ships with a
     scratcher". Checked again server-side, because this one runs in
     localStorage-land and is editable in devtools. */
  problem: function () { return CAT.orderProblem(cartPayload()); },

  render: function () {
    var items = cartRead();

    Array.prototype.forEach.call(document.querySelectorAll('[data-cart-count]'), function (cnt) {
      cnt.textContent = CC.cart.count() || '0';
    });

    var body = document.querySelector('[data-cart-body]');
    if (body) {
      if (!items.length) {
        body.innerHTML = '<div class="dr-empty">Nothing in here yet.<br>Pick a design to get started.</div>';
      } else {
        body.innerHTML = items.map(function (it, i) {
          var p = CAT.BY_HANDLE[it.h];
          var bits = [CAT.COLOR_LABEL[it.color] || it.color];
          if (it.qty > 1) bits.push('qty ' + it.qty);
          if (it.name) bits.push('\u201C' + it.name + '\u201D');
          return '<div class="ci">' +
            '<div class="ci-art"><div class="art" data-photo="' + esc(CAT.colorImg(p, it.color)) +
              '" data-way="' + esc(it.color) + '" data-alt="' + esc(p.t) + '" data-nonote></div></div>' +
            '<div class="ci-t"><b>' + esc(p.t) + '</b><span>' + esc(bits.join(' \u00B7 ')) + '</span>' +
            '<button class="ci-rm" data-rm="' + i + '">Remove</button></div>' +
            '<div class="ci-p">' + CC.money(CC.cart.lineTotal(it)) + '</div></div>';
        }).join('');

        var off = CC.cart.discount();
        if (off > 0) {
          body.innerHTML += '<div class="ci ci-off"><div class="ci-t">' +
            '<b>' + Math.round(CAT.SECOND_UNIT_OFF * 100) + '% off your second scratcher</b>' +
            '<span>Applied automatically</span></div>' +
            '<div class="ci-p">\u2212' + CC.money(off) + '</div></div>';
        }
        CC.paintArt(body);
      }
    }

    var tot = document.querySelector('[data-cart-total]');
    if (tot) tot.textContent = CC.money(CC.cart.total());

    /* A cart that breaks a rule must not reach Stripe only to bounce back. */
    var problem = items.length ? CC.cart.problem() : null;
    CC.cartError(problem || '');

    var co = document.querySelector('[data-checkout]');
    if (co) co.setAttribute('aria-disabled', (items.length && !problem) ? 'false' : 'true');
  }
};

/* One place to show a checkout-blocking message, in the drawer footer. */
CC.cartError = function (msg) {
  var el = document.querySelector('[data-cart-error]');
  if (!el) return;
  el.textContent = msg || '';
  el.hidden = !msg;
};

/* ================================================================
   CHECKOUT — hands the cart to Stripe Hosted Checkout.

   Only handle / colorway / quantity / nameplate are sent. The server
   recomputes every price from assets/catalog.js and ignores anything the
   client says about money.
   ================================================================ */
var checkingOut = false;

CC.checkout = function (btn) {
  var items = CC.cart.read();
  if (checkingOut || !items.length) return;

  var problem = CC.cart.problem();
  if (problem) { CC.cartError(problem); return; }

  checkingOut = true;
  var label = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Redirecting\u2026'; }
  CC.cartError('');

  fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: CC.cart.payload(items) })
  }).then(function (res) {
    return res.json().catch(function () { return {}; }).then(function (d) {
      if (!res.ok) throw new Error(d.message || d.error || 'Could not start checkout.');
      return d;
    });
  }).then(function (d) {
    if (!d.url) throw new Error('Could not start checkout.');
    window.location.href = d.url;     /* leaving the page, so stay disabled */
  }).catch(function (err) {
    CC.cartError(err.message || 'Could not start checkout. Please try again.');
    checkingOut = false;
    if (btn) { btn.disabled = false; btn.textContent = label; }
  });
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
      CC.checkout(co);
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

  var btn = document.querySelector('[data-refill-add]');
  var sum = document.querySelector('[data-refill-label]');
  var product = CAT.BY_HANDLE.refill;
  var pick = 3;

  /* Pack labels are copy, not pricing. Every price on this page comes from
     the catalog ladder so the tiles, the button and Stripe cannot disagree. */
  var LABEL = {
    1: 'One pad',
    3: 'Three pads \u00B7 half a year',
    6: 'Six pads \u00B7 a full year'
  };

  function paint() {
    Array.prototype.forEach.call(tiles, function (el) {
      var n = +el.getAttribute('data-refill');
      el.setAttribute('aria-pressed', String(n === pick));
      var pn = el.querySelector('[data-tile-price]');
      if (pn) pn.textContent = CC.money(CAT.priceFor(product, n));

      /* The struck-through "was" price is what n pads cost bought one at a
         time. On the single pad there is no saving, so nothing is shown. */
      var was = el.querySelector('[data-tile-was]');
      if (was) {
        var full = product.price * n;
        var save = full - CAT.priceFor(product, n);
        was.textContent = CC.money(full);
        was.hidden = save <= 0;
      }
    });

    var p = CAT.priceFor(product, pick);
    if (sum) sum.textContent = LABEL[pick] + ' \u2014 ' + CC.money(p);
    if (btn) btn.textContent = 'Add to cart \u2014 ' + CC.money(p);
  }

  Array.prototype.forEach.call(tiles, function (el) {
    el.addEventListener('click', function () { pick = +el.getAttribute('data-refill'); paint(); });
  });

  if (btn) btn.addEventListener('click', function (e) {
    e.preventDefault();
    CC.cart.add({ h: 'refill', qty: pick, color: 'natural' });
  });

  paint();
};

/* ================================================================
   PRODUCT PAGE
   ================================================================ */
CC.initPDP = function () {
  var root_ = document.querySelector('[data-pdp]');
  if (!root_) return;

  /* One implementation, every design. The page names its product with
     data-pdp="<handle>" and everything else — price, colorways, whether
     there is a nameplate at all — is read from the catalog. */
  var product = CAT.BY_HANDLE[root_.getAttribute('data-pdp')];
  if (!product) { console.error('cc.js: unknown product on [data-pdp]'); return; }

  var colors = product.colorsAvailable;
  var state = { color: colors[0], name: '', qty: 1, refill: false, keys: 0 };

  var stage    = root_.querySelector('[data-pdp-art]');
  var picks    = root_.querySelectorAll('[data-pdp-way]');
  var thumbs   = root_.querySelectorAll('[data-pdp-thumb]');
  var wayLabel = root_.querySelector('[data-way-label]');
  var nameIn   = root_.querySelector('[data-pdp-name]');
  var nameEcho = root_.querySelector('[data-name-echo]');
  var nameCt   = root_.querySelector('[data-name-count]');
  var qtyOut   = root_.querySelector('[data-qty-n]');
  var qtyNote  = root_.querySelector('[data-qty-note]');
  var totalOut = root_.querySelector('[data-pdp-total]');
  var saveOut  = root_.querySelector('[data-pdp-save]');
  var addRows  = root_.querySelectorAll('[data-add]');
  var addBtn   = root_.querySelector('[data-pdp-add]');
  var MAXNAME  = 18;

  /* What the cart will hold if they press Add — used to price the page
     with exactly the same functions the cart and Stripe use. */
  /* The keychain is only stocked in the Cottage colorways. A scratcher in a
     colorway it does not share \u2014 Sleepy Kitty is sage \u2014 would otherwise build a
     line api/checkout.js rejects with "isn't available in that color". */
  function keyColor() {
    var kc = (CAT.BY_HANDLE.keychain || {}).colorsAvailable || [];
    return kc.indexOf(state.color) !== -1 ? state.color : kc[0];
  }

  function draft() {
    var lines = [{ handle: product.h, qty: state.qty, color: state.color }];
    if (state.refill) lines.push({ handle: 'refill', qty: 3, color: 'natural' });
    if (state.keys)   lines.push({ handle: 'keychain', qty: state.keys, color: keyColor() });
    return lines;
  }

  function total() {
    var lines = draft(), sum = 0, i, p;
    for (i = 0; i < lines.length; i++) {
      p = CAT.BY_HANDLE[lines[i].handle];
      sum += CAT.priceFor(p, lines[i].qty);
    }
    if (state.name) sum += CAT.ADDONS.name.price * state.qty;
    return Math.max(0, Math.round((sum - CAT.secondUnitDiscount(lines)) * 100) / 100);
  }

  function swapPhoto(el, color) {
    if (!el) return;
    el.setAttribute('data-way', color);
    el.setAttribute('data-photo', CAT.colorImg(product, color));
    el.setAttribute('data-alt', product.t);
    el.removeAttribute('data-painted');
    el.removeAttribute('data-real');
    el.classList.remove('ph');
    CC.paintArt(el.parentNode);
  }

  function paint() {
    swapPhoto(stage, state.color);

    Array.prototype.forEach.call(picks, function (b) {
      var on = b.getAttribute('data-pdp-way') === state.color;
      b.setAttribute('aria-pressed', String(on));
      if (b.parentNode) b.parentNode.setAttribute('data-on', on ? '1' : '0');
    });
    Array.prototype.forEach.call(thumbs, function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-pdp-thumb') === state.color));
    });
    if (wayLabel) wayLabel.textContent = CAT.COLOR_LABEL[state.color] || state.color;

    if (nameCt)   nameCt.textContent = state.name.length + '/' + MAXNAME;
    if (nameEcho) nameEcho.textContent = state.name || 'Luna & Ruska';
    if (qtyOut)   qtyOut.textContent = state.qty;

    if (qtyNote) {
      var off = Math.round(CAT.SECOND_UNIT_OFF * 100);
      if (state.qty === 1) {
        qtyNote.innerHTML = '<b>Add a second and it\u2019s ' + off + '% off</b> \u2014 ' +
          CC.money(product.price * (1 - CAT.SECOND_UNIT_OFF)) + ' instead of ' +
          CC.money(product.price) + '. Two cats, two rooms, or one for somebody else.';
        qtyNote.setAttribute('data-tone', 'offer');
      } else {
        qtyNote.innerHTML = '<b>Every second one is ' + off + '% off.</b> You\u2019re saving ' +
          CC.money(CAT.secondUnitDiscount([{ handle: product.h, qty: state.qty }])) +
          ' on this order.';
        qtyNote.setAttribute('data-tone', 'won');
      }
    }

    Array.prototype.forEach.call(addRows, function (r) {
      var kind = r.getAttribute('data-add');
      var on = kind === 'refill' ? state.refill : state.keys === +r.getAttribute('data-keys');
      r.setAttribute('data-on', on ? '1' : '0');
      var tick = r.querySelector('.tick');
      if (tick) tick.textContent = on ? '\u2713' : '';
    });

    if (totalOut) totalOut.textContent = CC.money(total());
    if (saveOut) {
      var saved = CAT.secondUnitDiscount([{ handle: product.h, qty: state.qty }]);
      saveOut.textContent = saved > 0 ? 'You save ' + CC.money(saved) : '';
      saveOut.hidden = saved <= 0;
    }
  }

  Array.prototype.forEach.call(picks, function (b) {
    b.addEventListener('click', function () { state.color = b.getAttribute('data-pdp-way'); paint(); });
  });
  Array.prototype.forEach.call(thumbs, function (b) {
    b.addEventListener('click', function () { state.color = b.getAttribute('data-pdp-thumb'); paint(); });
  });

  if (nameIn) nameIn.addEventListener('input', function () {
    state.name = nameIn.value.slice(0, MAXNAME);
    if (nameIn.value !== state.name) nameIn.value = state.name;
    paint();
  });

  root_.addEventListener('click', function (e) {
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
    CC.cart.add({ h: product.h, qty: state.qty, color: state.color, name: state.name });
    if (state.refill) CC.cart.add({ h: 'refill', qty: 3, color: 'natural' });
    if (state.keys)   CC.cart.add({ h: 'keychain', qty: state.keys, color: keyColor(), name: state.name });
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
  var LABEL = {
    vet:     'Veterinary practice',
    shelter: 'Shelter or rescue',
    store:   'Pet store',
    sitter:  'Independent cat sitter'
  };

  function pick(kind) {
    Array.prototype.forEach.call(tabs, function (t) {
      t.setAttribute('aria-pressed', String(t.getAttribute('data-ptab') === kind));
    });
    Array.prototype.forEach.call(panes, function (p) {
      p.hidden = p.getAttribute('data-ppane') !== kind;
    });
    if (typeField && LABEL[kind]) typeField.value = LABEL[kind];
    var sel = document.querySelector('select[name="kind"]');
    if (sel && LABEL[kind]) sel.value = LABEL[kind];
  }
  Array.prototype.forEach.call(tabs, function (t) {
    t.addEventListener('click', function () { pick(t.getAttribute('data-ptab')); });
  });
  pick(tabs[0].getAttribute('data-ptab'));
};

/* ================================================================
   FORMS — POST to /api/contact, which emails the shop inbox

   Both forms used to open a mailto: link. That silently sent nothing
   for anyone without a mail client configured, which is most people
   on a phone — the enquiry looked sent and never arrived.

   The endpoint expects { name, email, message, topic, company }.
   These forms collect richer fields than that, so every extra field
   is folded into `message` using its data-label. Keeping the API
   contract narrow means api/contact.js needs no per-form knowledge.

   `topic` must be a member of the TOPICS whitelist in api/contact.js
   or it is filed as "Something else" — the two are kept in step by
   hand, so change them together.

   mailto is still the fallback, but only when the POST actually
   fails, so a customer is never left with nothing.
   ================================================================ */
CC.initForms = function () {
  Array.prototype.forEach.call(document.querySelectorAll('form[data-topic]'), function (f) {

    var btn  = f.querySelector('button[type="submit"]');
    var ok   = f.querySelector('.okmsg');
    var fine = f.querySelector('.fineprint');
    var busy = false;

    /* Fields the endpoint takes as first-class values. Everything else
       becomes a labelled line inside the message body. */
    var SKIP = { yourname:1, email:1, company:1 };

    function say(msg, good) {
      if (!ok) return;
      ok.innerHTML = msg;
      ok.classList.add('on');
      ok.setAttribute('data-tone', good ? 'ok' : 'bad');
    }

    function body() {
      var lines = [];
      Array.prototype.forEach.call(f.querySelectorAll('[name]'), function (el) {
        if (SKIP[el.getAttribute('name')]) return;
        var v = (el.value || '').trim();
        if (!v) return;
        lines.push((el.getAttribute('data-label') || el.getAttribute('name')) + ': ' + v);
      });
      return lines.join('\n\n');
    }

    function mailtoFallback(p) {
      var to = f.getAttribute('data-mailto') || 'realizedprints@gmail.com';
      window.location.href = 'mailto:' + to +
        '?subject=' + encodeURIComponent('[' + p.topic + '] ' + p.name) +
        '&body=' + encodeURIComponent('From: ' + p.name + ' <' + p.email + '>\n\n' + p.message);
    }

    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;

      var nameEl  = f.querySelector('[name="yourname"]');
      var emailEl = f.querySelector('[name="email"]');
      var hp      = f.querySelector('[name="company"]');

      var payload = {
        name:    nameEl  ? nameEl.value.trim()  : '',
        email:   emailEl ? emailEl.value.trim() : '',
        topic:   f.getAttribute('data-topic') || 'Something else',
        message: body(),
        company: hp ? hp.value : ''
      };

      if (!payload.name || !payload.email || !payload.message) {
        return say('Please fill in your name, your email, and tell us a little about your cat.', false);
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
        return say('That email address doesn’t look right.', false);
      }

      busy = true;
      var label = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
      say('Sending…', true);

      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok) throw new Error(data.message || data.error || 'send failed');
          return data;
        });
      }).then(function () {
        /* The hidden partner-type field is set by the tab picker, not by the
           customer, so it has to survive the reset. */
        var keep = f.querySelector('[data-partner-type]');
        var kept = keep ? keep.value : null;
        f.reset();
        if (keep && kept !== null) keep.value = kept;

        say('<b>Thanks — that’s with us.</b> We’ll reply to <strong>' +
            esc(payload.email) + '</strong> within 1–2 business days.', true);
        if (fine) fine.hidden = true;
      }).catch(function () {
        say('<b>That didn’t send.</b> Opening your email app instead — ' +
            'or write to <strong>realizedprints@gmail.com</strong>.', false);
        mailtoFallback(payload);
      }).then(function () {
        busy = false;
        if (btn) { btn.disabled = false; btn.textContent = label; }
      });
    });
  });
};

function boot() {
  CC.mountChrome(); CC.mount(); CC.initRefills(); CC.initPDP(); CC.initPartner(); CC.initForms();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})(window);

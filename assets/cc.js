/* ================================================================
   Cat Scratchers — shared browser JS

   Used by index.html, basking-paws.html, homestead-buddies.html,
   cc-custom.html, cc-refills.html, cc-partner.html.

     CAT            assets/catalog.js — the only place prices live
     CC.meadowScene() parametric SVG stand-in for product photography —
                    sky, hills, sun and 1 or 2 sleeping cats, matching
                    the real Basking Paws photography
     CC.photo()/paintArt()  <img> with automatic SVG fallback — drop a
                    real photo into images/ and it takes over on its own
     CC.cart        localStorage cart + slide-over drawer
     CC.mountChrome() countdown + trust marquee, same as rp.js

   catalog.js MUST load before this file on every page. It owns every
   price, the colorway keys, the half-off-the-second-scratcher rule and
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

   Every Cat Scratchers page must load assets/catalog.js BEFORE assets/cc.js. */
var CAT = root.RP_CATALOG;
if (!CAT) throw new Error('cc.js: assets/catalog.js must be loaded first');

CC.money = function (n) {
  return '$' + (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, '');
};

function esc(s){ return String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ================================================================
   MEADOW SCENE — parametric SVG stand-in for product photography.

   Sky, sun, clouds, two-tone hills and 1 or 2 sleeping cats, drawn in
   the same style as the real Basking Paws photography and the expo
   backdrop art. Used two ways:
     - as the automatic fallback in paintArt() below, if a photo file
       is ever missing
     - as the deliberate PREVIEW art on homestead-buddies.html, which
       has no real two-cat photograph yet (see catalog.js)
   ================================================================ */
function sleepingCat(x, y, scale, coat, dark, cream) {
  var s = scale || 1;
  return '<g transform="translate(' + x + ',' + y + ') scale(' + s + ')">' +
    '<path d="M40 6q22-4 18-22q-3-14-18-10" fill="none" stroke="' + coat +
      '" stroke-width="11" stroke-linecap="round"/>' +
    '<ellipse cx="10" cy="2" rx="34" ry="22" fill="' + coat + '"/>' +
    '<circle cx="-22" cy="4" r="17" fill="' + coat + '"/>' +
    '<path d="M-34-6 L-38-19 L-23-11 Z" fill="' + coat + '"/>' +
    '<path d="M-13-8 L-9-21 L-24-11 Z" fill="' + coat + '"/>' +
    '<ellipse cx="-10" cy="20" rx="9" ry="6" fill="' + cream + '"/>' +
    '<ellipse cx="3" cy="21" rx="9" ry="6" fill="' + cream + '"/>' +
    '<path d="M-29 4q4 3 8 0" stroke="' + dark + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
    '<path d="M-20 10 l-3 2 l3 2 Z" fill="' + dark + '"/>' +
  '</g>';
}

function cloud(cx, cy, s) {
  s = s || 1;
  return '<g transform="translate(' + cx + ',' + cy + ') scale(' + s + ')" fill="#fff" opacity=".92">' +
    '<ellipse cx="0" cy="0" rx="26" ry="15"/><ellipse cx="-21" cy="6" rx="17" ry="11"/>' +
    '<ellipse cx="21" cy="6" rx="17" ry="11"/></g>';
}

/* Basking Paws coat colorways — must stay in step with COLORS in
   assets/catalog.js. Used only as a drawn placeholder for whichever
   colors don't have a real photo yet (see swatchImg in catalog.js). */
CC.COAT = {
  tuxedo:    { coat:'#2b2b2e', dark:'#000',    cream:'#fff'    },
  orange:    { coat:'#e2711d', dark:'#a8500e', cream:'#fff3e4' },
  calico:    { coat:'#e2711d', dark:'#7a4a10', cream:'#fff', patch:'#2b2b2e' },
  black:     { coat:'#242426', dark:'#000',    cream:'#3f3f42' },
  greywhite: { coat:'#8b9096', dark:'#5b6066', cream:'#fff'    },
  grey:      { coat:'#8b9096', dark:'#5b6066', cream:'#c9cdd1' }
};

CC.meadowScene = function (catCount, coatKey) {
  catCount = catCount || 1;
  var label = catCount > 1 ? 'Two sleeping cats in a meadow scene' : 'A sleeping cat in a meadow scene';
  var o = '<svg viewBox="0 0 560 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(label) + '">';
  o += '<defs><linearGradient id="mSky" x1="0" y1="0" x2="0" y2="1">' +
       '<stop offset="0%" stop-color="#3f8ee8"/><stop offset="100%" stop-color="#d8ecff"/></linearGradient></defs>';
  o += '<rect width="560" height="400" fill="url(#mSky)"/>';
  o += '<circle cx="440" cy="82" r="34" fill="#ffcf3f"/>';
  for (var i = 0; i < 12; i++) {
    var a = i * 30 * Math.PI / 180,
        x1 = 440 + Math.cos(a) * 44, y1 = 82 + Math.sin(a) * 44,
        x2 = 440 + Math.cos(a) * 58, y2 = 82 + Math.sin(a) * 58;
    o += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) +
         '" stroke="#ffcf3f" stroke-width="6" stroke-linecap="round"/>';
  }
  o += cloud(92, 74) + cloud(152, 112, .68) + cloud(346, 54, .8);
  o += '<path d="M0 296 Q140 248 280 296 T560 296 V400 H0 Z" fill="#6fb85e"/>';
  o += '<path d="M0 330 Q140 292 280 330 T560 330 V400 H0 Z" fill="#4fa156"/>';
  if (catCount > 1) {
    o += sleepingCat(168, 338, 1.5, '#2b2b2e', '#000', '#fff') +
         sleepingCat(352, 344, 1.5, '#e2711d', '#a8500e', '#fff3e4');
  } else {
    var c = CC.COAT[coatKey] || CC.COAT.tuxedo;
    o += sleepingCat(268, 344, 1.75, c.coat, c.dark, c.cream);
    /* Calico is a rough approximation, not a real tri-color coat — two
       dark patches over the orange base, just enough to read as
       "calico" in a placeholder until a real photo replaces it. */
    if (c.patch) {
      o += '<g transform="translate(268,344) scale(1.75)" fill="' + c.patch + '" opacity=".9">' +
           '<ellipse cx="16" cy="-10" rx="11" ry="8" transform="rotate(-18 16 -10)"/>' +
           '<ellipse cx="-16" cy="-4" rx="7" ry="6" transform="rotate(12 -16 -4)"/></g>';
    }
  }
  return o + '</svg>';
};


/* A stack of corrugated refill pads. Same fallback contract as
   CC.meadowScene: a real photo at images/cc-refill-inserts.jpg wins. */
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

   <div class="art" data-photo="images/bp-scratcher.jpg" data-alt="Basking Paws cat scratcher">
   <div class="art" data-cats="2" data-alt="Homestead Buddies cat scratcher">

   Renders an <img>. If a data-photo file isn't there yet, or a slot
   never names one (Homestead Buddies has no real photo yet), the SVG
   stand-in takes over automatically — so the moment a real photo is
   saved into images/ under that name, the page starts using it with no code
   change. See images/CC-IMAGE-LIST.md for the filenames.
   ================================================================ */
CC.paintArt = function (scope) {
  var nodes = (scope || document).querySelectorAll('[data-photo],[data-cats],[data-insert]');
  Array.prototype.forEach.call(nodes, function (el) {
    if (el.getAttribute('data-painted') === '1') return;
    el.setAttribute('data-painted', '1');

    var src  = el.getAttribute('data-photo');
    var note = el.getAttribute('data-note');          /* placeholder caption, if any */
    var alt  = el.getAttribute('data-alt') || 'A Cat Scratchers piece';
    var chip = el.hasAttribute('data-nonote') ? '' :
      '<span class="artnote">' + esc(el.getAttribute('data-notelabel') || 'ILLUSTRATION') + '</span>';

    /* What to draw when no photograph can be found. Slots that name a
       placeholder caption (the journey) get the caption; a slot naming
       data-cats gets the drawn meadow scene at that cat count. */
    function fallback() {
      if (note) {
        el.classList.add('ph');
        el.innerHTML = '<span class="swap">' + esc(note) +
          (src ? '<code>' + esc(src) + '</code>' : '') + '</span>';
      } else if (el.hasAttribute('data-insert')) {
        el.innerHTML = CC.insert() + chip;
      } else if (el.hasAttribute('data-cats')) {
        el.innerHTML = CC.meadowScene(+el.getAttribute('data-cats') || 1, el.getAttribute('data-coat')) + chip;
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
   PRICES IN COPY — filled from the catalog, never typed into HTML.

   <span data-price="refill" data-qty="3"></span>              $25  what 3 cost
   <span data-price="refill" data-qty="3" data-show="save"></span>  $5   vs buying singles
   <span data-price="homestead-buddies" data-show="delta"
         data-vs="basking-paws"></span>                         $13  gap between two handles

   data-qty defaults to 1. An unknown handle leaves the element empty
   rather than showing a wrong number.
   ================================================================ */
CC.fillPrices = function (scope) {
  var nodes = (scope || document).querySelectorAll('[data-price]');
  Array.prototype.forEach.call(nodes, function (el) {
    var p = CAT.BY_HANDLE[el.getAttribute('data-price')];
    if (!p) { el.textContent = ''; return; }
    var n = +el.getAttribute('data-qty') || 1;
    var show = el.getAttribute('data-show');
    var v;
    if (show === 'save') v = CAT.savingAt(p, n);
    else if (show === 'delta') {
      var vs = CAT.BY_HANDLE[el.getAttribute('data-vs')];
      v = vs ? p.price - vs.price : 0;
    } else v = CAT.priceFor(p, n);
    el.textContent = CC.money(v);
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
      ['★','Made in 1–2 days, ships in 3–5'], ['📸','Photo &amp; video updates as yours is made'],
      ['♥','Painted to match your cat'], ['🎁','Buy one, get the second 50% off'],
      ['✈','Free US shipping on two-scratcher orders'], ['★','Replaceable cardboard insert'],
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
              '" data-way="' + esc(it.color) + '" data-cats="' + (p.catCount || 1) +
              '" data-coat="' + esc(it.color) + '" data-alt="' + esc(p.t) + '" data-nonote></div></div>' +
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
  var baseProduct   = CAT.BY_HANDLE[root_.getAttribute('data-pdp')];
  var customProduct = CAT.BY_HANDLE[root_.getAttribute('data-pdp-custom')] || null;
  if (!baseProduct) { console.error('cc.js: unknown product on [data-pdp]'); return; }

  var state = { mode: 'base', color: baseProduct.colorsAvailable[0], name: '', qty: 1, refill: false, keys: 0 };

  function product() { return (state.mode === 'custom' && customProduct) ? customProduct : baseProduct; }

  /* A page with a base/custom toggle only takes a name in custom mode.
     A page without one (Homestead Buddies is always personalised now)
     takes it whenever the page has a name field at all. */
  function takesName() { return customProduct ? state.mode === 'custom' : !!personalize; }

  var modeBtns    = root_.querySelectorAll('[data-pdp-mode]');
  var personalize = root_.querySelector('[data-pdp-personalize]');
  var baseFine    = root_.querySelector('[data-pdp-basefine]');
  var customFine  = root_.querySelector('[data-pdp-customfine]');
  var priceOut    = root_.querySelector('[data-pdp-price]');
  var namePlaceholder = root_.getAttribute('data-name-placeholder') || 'Luna & Ruska';
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
     with exactly the same functions the cart and Stripe use. The
     keychain needs a likeness to already exist, so it only makes
     sense — and is only offered — once a personalised mode is picked. */
  function keyColor() {
    var kc = (CAT.BY_HANDLE.keychain || {}).colorsAvailable || [];
    return kc.indexOf(state.color) !== -1 ? state.color : kc[0];
  }

  function draft() {
    var lines = [{ handle: product().h, qty: state.qty, color: state.color }];
    if (state.refill) lines.push({ handle: 'refill', qty: 3, color: 'natural' });
    if (state.keys) lines.push({ handle: 'keychain', qty: state.keys, color: keyColor() });
    return lines;
  }

  function total() {
    var lines = draft(), sum = 0, i, p;
    for (i = 0; i < lines.length; i++) {
      p = CAT.BY_HANDLE[lines[i].handle];
      sum += CAT.priceFor(p, lines[i].qty);
    }
    if (takesName() && state.name) sum += CAT.ADDONS.name.price * state.qty;
    return Math.max(0, Math.round((sum - CAT.secondUnitDiscount(lines)) * 100) / 100);
  }

  function swapPhoto(el, p, color) {
    if (!el) return;
    var catCount = p.catCount || 1;
    el.setAttribute('data-cats', String(catCount));
    if (catCount === 1) el.setAttribute('data-coat', color); else el.removeAttribute('data-coat');
    var src = CAT.colorImg(p, color);
    if (src) el.setAttribute('data-photo', src); else el.removeAttribute('data-photo');
    el.setAttribute('data-way', color);
    el.setAttribute('data-alt', p.t);
    el.removeAttribute('data-painted');
    el.removeAttribute('data-real');
    el.classList.remove('ph');
    CC.paintArt(el.parentNode);
  }

  function paint() {
    var p = product();
    swapPhoto(stage, p, state.color);

    Array.prototype.forEach.call(modeBtns, function (b) {
      var on = b.getAttribute('data-pdp-mode') === state.mode;
      b.setAttribute('aria-pressed', String(on));
    });
    if (personalize) personalize.hidden = !takesName();
    if (baseFine)   baseFine.hidden = state.mode === 'custom';
    if (customFine) customFine.hidden = state.mode !== 'custom';

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
    if (nameEcho) nameEcho.textContent = state.name || namePlaceholder;
    if (qtyOut)   qtyOut.textContent = state.qty;
    if (priceOut) priceOut.textContent = CC.money(p.price);

    if (qtyNote) {
      var off = Math.round(CAT.SECOND_UNIT_OFF * 100);
      if (state.qty === 1) {
        qtyNote.innerHTML = '<b>Add a second and it\u2019s ' + off + '% off</b> \u2014 ' +
          CC.money(p.price * (1 - CAT.SECOND_UNIT_OFF)) + ' instead of ' +
          CC.money(p.price) + '. Two cats, two rooms, or one for somebody else.';
        qtyNote.setAttribute('data-tone', 'offer');
      } else {
        qtyNote.innerHTML = '<b>Every second one is ' + off + '% off.</b> You\u2019re saving ' +
          CC.money(CAT.secondUnitDiscount([{ handle: p.h, qty: state.qty }])) +
          ' on this order.';
        qtyNote.setAttribute('data-tone', 'won');
      }
    }

    Array.prototype.forEach.call(addRows, function (r) {
      var kind = r.getAttribute('data-add');
      if (kind === 'key') {
        /* Basking Paws has no custom/base split at all (customProduct is
           null there) — a keychain just matches whichever coat is picked,
           so it's always offered. Homestead Buddies still gates it to
           "Made for your cats", since a keychain there only makes sense
           once a real likeness exists. */
        r.hidden = !!customProduct && state.mode !== 'custom';
        if (r.hidden && state.keys) state.keys = 0;
      }
      var on = kind === 'refill' ? state.refill : state.keys === +r.getAttribute('data-keys');
      r.setAttribute('data-on', on ? '1' : '0');
      var tick = r.querySelector('.tick');
      if (tick) tick.textContent = on ? '\u2713' : '';
    });

    if (totalOut) totalOut.textContent = CC.money(total());
    if (saveOut) {
      var saved = CAT.secondUnitDiscount([{ handle: p.h, qty: state.qty }]);
      saveOut.textContent = saved > 0 ? 'You save ' + CC.money(saved) : '';
      saveOut.hidden = saved <= 0;
    }
  }

  Array.prototype.forEach.call(modeBtns, function (b) {
    b.addEventListener('click', function () {
      var m = b.getAttribute('data-pdp-mode');
      if (m === state.mode || (m === 'custom' && !customProduct)) return;
      state.mode = m;
      if (m === 'base') { state.name = ''; if (nameIn) nameIn.value = ''; state.keys = 0; }
      var colors = product().colorsAvailable;
      if (colors.indexOf(state.color) === -1) state.color = colors[0];
      paint();
    });
  });

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
    if (a && !a.hidden) {
      var kind = a.getAttribute('data-add');
      if (kind === 'refill') state.refill = !state.refill;
      else { var k = +a.getAttribute('data-keys'); state.keys = (state.keys === k) ? 0 : k; }
      paint();
    }
  });

  if (addBtn) addBtn.addEventListener('click', function (e) {
    e.preventDefault();
    var p = product();
    CC.cart.add({ h: p.h, qty: state.qty, color: state.color, name: takesName() ? state.name : '' });
    if (state.refill) CC.cart.add({ h: 'refill', qty: 3, color: 'natural' });
    if (state.keys) {
      CC.cart.add({ h: 'keychain', qty: state.keys, color: keyColor(), name: state.name });
    }
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
          if (!res.ok) {
            console.warn('form: send failed —', data.reason || res.status);
            throw new Error(data.message || data.error || 'send failed');
          }
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

/* ================================================================
   PHOTO CAROUSEL — arrows + dots, N slides.

   <div class="carousel" data-carousel>
     <div class="carousel-track" data-carousel-track>
       <div class="carousel-slide"><img ...></div>
       <div class="carousel-slide"><img ...></div>   -- add more any time
     </div>
     <button data-carousel-prev>...</button>
     <button data-carousel-next>...</button>
     <div class="carousel-dots" data-carousel-dots></div>
   </div>

   With a single slide the arrows and dots hide themselves — there is
   nothing to browse to yet, and an arrow that goes nowhere is worse
   than no arrow. Add a second .carousel-slide later and they appear
   with no other change. */
CC.initCarousel = function () {
  var roots = document.querySelectorAll('[data-carousel]');
  Array.prototype.forEach.call(roots, function (root) {
    var track = root.querySelector('[data-carousel-track]');
    if (!track) return;
    var slides = track.children;
    var n = slides.length;
    var prev = root.querySelector('[data-carousel-prev]');
    var next = root.querySelector('[data-carousel-next]');
    var dotsWrap = root.querySelector('[data-carousel-dots]');
    var i = 0;

    if (n <= 1) {
      if (prev) prev.hidden = true;
      if (next) next.hidden = true;
      if (dotsWrap) dotsWrap.hidden = true;
      return;
    }

    if (dotsWrap) {
      dotsWrap.innerHTML = '';
      for (var d = 0; d < n; d++) {
        var dot = document.createElement('button');
        dot.className = 'carousel-dot';
        dot.type = 'button';
        dot.setAttribute('aria-label', 'Show photo ' + (d + 1) + ' of ' + n);
        (function (idx) { dot.addEventListener('click', function () { go(idx); }); })(d);
        dotsWrap.appendChild(dot);
      }
    }

    function paint() {
      track.style.transform = 'translateX(-' + (i * 100) + '%)';
      if (dotsWrap) Array.prototype.forEach.call(dotsWrap.children, function (dot, idx) {
        dot.setAttribute('aria-current', String(idx === i));
      });
    }
    function go(idx) { i = ((idx % n) + n) % n; paint(); }

    if (prev) prev.addEventListener('click', function () { go(i - 1); });
    if (next) next.addEventListener('click', function () { go(i + 1); });
    paint();
  });
};

function boot() {
  CC.fillPrices(document); CC.mountChrome(); CC.mount(); CC.initCarousel(); CC.initRefills(); CC.initPDP(); CC.initPartner(); CC.initForms();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})(window);

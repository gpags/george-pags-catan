/* ================================================================
   CatCustoms — shared browser JS
   Used by catcustoms.html, cc-template.html, cc-custom.html,
   cc-refills.html, cc-partner.html.

   Contains:
     CC.WAYS      the four Storybook Cottage colourways
     CC.cottage() parametric SVG of the product, drawn from the
                  reference renders. One definition, any colourway,
                  any name on the plate.
     CC.cart      localStorage cart + slide-over drawer
     CC.mount()   wires every [data-cottage], the cart, the refill
                  picker, the PDP options and the mailto forms.

   PRICES ARE DUPLICATED HERE ON PURPOSE — for now. This is a
   review build with no Stripe wiring. When CatCustoms moves into
   assets/catalog.js (Phase 1), delete CC.PRICE and read from
   RP_CATALOG instead so the browser, the build script and Stripe
   cannot disagree about a price. Until then this file is the only
   place a CatCustoms price is written down.
   ================================================================ */
(function (root) {
'use strict';

var CC = root.CC = {};

/* ---------------- prices (see note above) ---------------- */
CC.PRICE = {
  template: 99,
  custom:   349,
  refill:   { 1: 12, 2: 17, 4: 44 },
  keychain: { 1: 4,  2: 6 }
};

/* ---------------- colourways ----------------
   Taken from the four reference renders. `body` is the shell,
   `timber` the beams, `sign` the nameplate frame + window arches. */
CC.WAYS = {
  cream:   { name:'Cottage Cream', body:'#f2e6d2', bodyDark:'#ddcbb2', timber:'#8a6a4d', timberDark:'#6d5039',
             sign:'#93a883', signInk:'#6b4f3a', plinth:'#e8d9c0' },
  butter:  { name:'Buttercup',     body:'#f6d84e', bodyDark:'#dcbc32', timber:'#5f676f', timberDark:'#464d54',
             sign:'#a9c39b', signInk:'#6b4f3a', plinth:'#efce3f' },
  blossom: { name:'Blossom',       body:'#f2a9bb', bodyDark:'#dd8fa3', timber:'#9ec9a4', timberDark:'#7fae86',
             sign:'#9ec9a4', signInk:'#7a5c42', plinth:'#eb9bae' },
  lilac:   { name:'Lilac Sky',     body:'#c3b1e1', bodyDark:'#a996cc', timber:'#a9c9ea', timberDark:'#8bb0d8',
             sign:'#a9c9ea', signInk:'#5f5183', plinth:'#b6a2d9' }
};
CC.WAY_ORDER = ['cream','butter','blossom','lilac'];

/* shared, non-colourway parts */
var C = {
  box:'#c9533f', boxDark:'#a8412f', leaf:'#7d9b6a', leafDark:'#658054',
  bloom:'#fff6f2', bloomPink:'#ffc9d4', bloomCore:'#f6c86a',
  card:'#bb8b52', cardDark:'#9a6d3b', cardLine:'#a87a45',
  catA:'#c98f5e', catADark:'#a9713f', catB:'#82828a', catBDark:'#63636b',
  ink:'#3a2a1c', white:'#ffffff'
};

/* ---------------- the artwork ----------------
   Dimetric 3/4 view. Depth vector d = (104,-60).
   Front face  (70,182)-(390,318)
   Top face    A(70,182) B(390,182) C(494,122) D(174,122)          */
function esc(s){ return String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* a cat peeking out of an arched window */
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
      '" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
    '</g>';
}

/* window box with flowers, sitting under a window */
function flowerbox(x, y, w) {
  var o = '<g transform="translate(' + x + ',' + y + ')">' +
    '<rect x="' + (-w / 2) + '" y="0" width="' + w + '" height="15" rx="3" fill="' + C.box + '"/>' +
    '<rect x="' + (-w / 2) + '" y="0" width="' + w + '" height="4.5" rx="2" fill="' + C.boxDark + '" opacity=".55"/>';
  var n = Math.max(3, Math.round(w / 13));
  for (var i = 0; i < n; i++) {
    var fx = -w / 2 + (w / (n - 1)) * i, up = (i % 2 ? -8 : -5.5);
    o += '<ellipse cx="' + fx + '" cy="' + (up + 2) + '" rx="5" ry="4" fill="' + C.leaf + '"/>';
    o += '<circle cx="' + fx + '" cy="' + up + '" r="3.1" fill="' + (i % 2 ? C.bloom : C.bloomPink) + '"/>';
    o += '<circle cx="' + fx + '" cy="' + up + '" r="1.1" fill="' + C.bloomCore + '"/>';
  }
  return o + '</g>';
}

/* small sprig of leaves + a bloom, used to break up the facade */
function sprig(x, y, s) {
  s = s || 1;
  return '<g transform="translate(' + x + ',' + y + ') scale(' + s + ')">' +
    '<ellipse cx="-5" cy="0" rx="5.5" ry="3.4" fill="' + C.leaf + '" transform="rotate(-24 -5 0)"/>' +
    '<ellipse cx="5" cy="0" rx="5.5" ry="3.4" fill="' + C.leafDark + '" transform="rotate(24 5 0)"/>' +
    '<circle cx="0" cy="-3" r="3.4" fill="' + C.bloom + '"/>' +
    '<circle cx="0" cy="-3" r="1.2" fill="' + C.bloomCore + '"/></g>';
}

/**
 * Build the cottage as an SVG string.
 * @param {string} wayKey  key into CC.WAYS
 * @param {object} [opt]   { name: 'Luna & Ruska' }
 */
CC.cottage = function (wayKey, opt) {
  var w = CC.WAYS[wayKey] || CC.WAYS.cream;
  opt = opt || {};
  var label = (opt.name == null || opt.name === '') ? 'Luna & Ruska' : opt.name;
  var uid = 'w' + wayKey;

  /* Geometry — dimetric 3/4. Depth vector d = (104,-60).
     FRONT face  x 70..390,  y 182 (top) .. 300 (bottom)
     TOP face    A(70,182) B(390,182) C(494,122) D(174,122)
     PLINTH      x 58..402, y 300..322, 8px prouder than the body   */

  var o = '<svg viewBox="0 0 560 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' +
    esc(w.name + ' cottage scratcher, nameplate reading ' + label) + '">';

  o += '<defs><clipPath id="well' + uid + '">' +
       '<path d="M99.7 177.8 L374.9 177.8 L464.3 126.2 L189.1 126.2 Z"/></clipPath></defs>';

  /* 1. ground shadow */
  o += '<ellipse cx="288" cy="336" rx="220" ry="24" fill="#1a1440" opacity=".11"/>';

  /* 2. TOP FACE — shell, then the recessed well, then the corrugated insert */
  o += '<path d="M70 182 L390 182 L494 122 L174 122 Z" fill="' + w.body + '"/>';
  o += '<path d="M99.7 177.8 L374.9 177.8 L464.3 126.2 L189.1 126.2 Z" fill="' + C.cardDark + '"/>';
  o += '<g clip-path="url(#well' + uid + ')">' +
       '<path d="M101 176.4 L373.6 176.4 L463 127.6 L190.4 127.6 Z" fill="' + C.card + '"/>';
  for (var i = 0; i <= 40; i++) {
    var t = i / 40;
    var x1 = (101 + (373.6 - 101) * t).toFixed(1);
    var x2 = (190.4 + (463 - 190.4) * t).toFixed(1);
    o += '<line x1="' + x1 + '" y1="176.4" x2="' + x2 + '" y2="127.6" stroke="' + C.cardLine +
         '" stroke-width="2.6" opacity=".9"/>';
  }
  o += '</g>';

  /* 3. RIGHT side face of the body */
  o += '<path d="M390 300 L494 240 L494 122 L390 182 Z" fill="' + w.bodyDark + '"/>';
  o += '<g fill="' + w.timberDark + '" opacity=".85">' +
       '<path d="M390 190 L494 130 L494 140 L390 200 Z"/>' +
       '<path d="M390 252 L494 192 L494 202 L390 262 Z"/>' +
       '<path d="M436 165 L446 159 L446 277 L436 283 Z"/></g>';
  o += '<path d="M404 244 q0-27 21-39 q21-12 21 13 v34 l-42 24 Z" fill="' + w.sign + '" opacity=".7"/>';
  o += '<path d="M410 242 q0-22 17-32 q17-10 17 11 v28 l-34 20 Z" fill="#3a2e24" opacity=".75"/>';

  /* 4. FRONT face */
  o += '<path d="M70 182 L390 182 L390 300 L70 300 Z" fill="' + w.body + '"/>';

  /* 5. SCALLOPED RIM — sits on the top edge, drawn over both faces */
  var rim = 'M70 190 ';
  for (var s2 = 0; s2 < 8; s2++) rim += 'q10 -10 20 0 q10 10 20 0 ';
  rim += 'L390 190 L494 130 L494 122 L174 122 L70 182 Z';
  o += '<path d="M70 182 L390 182 L390 194 L70 194 Z" fill="' + w.body + '"/>';
  var scal = 'M70 194 L70 184 ';
  for (var s3 = 0; s3 < 10; s3++) scal += 'q16 -11 32 0 ';
  scal += 'L390 194 Z';
  o += '<path d="' + scal + '" fill="' + w.body + '"/>';
  o += '<path d="M70 194 L390 194" stroke="' + w.bodyDark + '" stroke-width="2.5" opacity=".55"/>';
  o += '<path d="M390 194 L494 134 L494 122 L390 182 Z" fill="' + w.bodyDark + '" opacity=".6"/>';

  /* 6. HALF-TIMBERING on the front face */
  o += '<g fill="' + w.timber + '">';
  o += '<rect x="70" y="196" width="320" height="10"/>';
  o += '<rect x="70" y="256" width="320" height="9"/>';
  var posts = [70, 116, 162, 208, 254, 300, 346, 380];
  for (var p = 0; p < posts.length; p++) o += '<rect x="' + posts[p] + '" y="196" width="10" height="104"/>';
  o += '</g>';
  o += '<g stroke="' + w.timber + '" stroke-width="8" stroke-linecap="round" fill="none" opacity=".95">' +
       '<path d="M176 254 L198 212"/><path d="M240 212 L262 254"/><path d="M314 254 L336 212"/></g>';

  /* 7. WINDOWS + CATS + FLOWER BOXES */
  function win(cx) {
    return '<g>' +
      '<path d="M' + (cx - 36) + ' 266 v-28 a36 36 0 0 1 72 0 v28 Z" fill="' + w.sign + '"/>' +
      '<path d="M' + (cx - 29) + ' 264 v-26 a29 29 0 0 1 58 0 v26 Z" fill="' + w.timberDark + '"/>' +
      '<path d="M' + (cx - 23) + ' 263 v-25 a23 23 0 0 1 46 0 v25 Z" fill="#4a3b2e"/>' +
      '</g>';
  }
  o += win(125) + cat(125, 240, C.catA, C.catADark, 1.05) + flowerbox(125, 256, 62);
  o += win(335) + cat(335, 240, C.catB, C.catBDark, 1.05) + flowerbox(335, 256, 62);

  /* 8. NAMEPLATE — between the windows */
  var fs = label.length > 15 ? 15 : label.length > 11 ? 17 : 20;
  o += '<g transform="translate(230,232) scale(.9)">' +
    '<path d="M-78 0 q0-13 13-15 q3-11 17-9 q7-9 20-5 q9-7 19 0 q13-4 20 5 q14-2 17 9 q13 2 13 15' +
         ' q0 13-13 15 q-3 11-17 9 q-7 9-19 5 q-10 7-20 0 q-13 4-20-5 q-14 2-17-9 q-13-2-13-15 Z" ' +
         'fill="' + w.sign + '"/>' +
    '<path d="M-69 0 q0-9 10-11 q3-8 14-6 q6-7 16-4 q8-5 16 0 q11-3 16 4 q11-2 14 6 q10 2 10 11' +
         ' q0 9-10 11 q-3 8-14 6 q-6 7-16 4 q-8 5-16 0 q-11 3-16-4 q-11 2-14-6 q-10-2-10-11 Z" ' +
         'fill="' + w.body + '"/>' +
    '<text x="0" y="7" text-anchor="middle" font-family="Fredoka, Nunito, sans-serif" font-weight="600" ' +
      'font-size="' + fs + '" fill="' + w.signInk + '">' + esc(label) + '</text></g>';

  /* 9. sprigs along the facade */
  o += sprig(93, 288, .95) + sprig(186, 288, .8) + sprig(278, 288, .8) + sprig(371, 288, .95);

  /* 10. PLINTH — last, sits below everything */
  o += '<path d="M58 300 L402 300 L402 322 L58 322 Z" fill="' + w.plinth + '"/>';
  o += '<path d="M402 300 L506 240 L506 262 L402 322 Z" fill="' + w.bodyDark + '"/>';
  o += '<path d="M58 300 L402 300 L408 296 L64 296 Z" fill="' + w.body + '"/>';
  o += '<path d="M402 300 L506 240 L500 237 L396 297 Z" fill="' + w.body + '" opacity=".8"/>';

  o += '</svg>';
  return o;
};

/* ---------------- mount artwork ---------------- */
CC.paintArt = function (scope) {
  var nodes = (scope || document).querySelectorAll('[data-cottage]');
  Array.prototype.forEach.call(nodes, function (el) {
    var way = el.getAttribute('data-cottage');
    var nm = el.getAttribute('data-name');
    el.innerHTML = CC.cottage(way, { name: nm }) +
      (el.hasAttribute('data-nonote') ? '' :
        '<span class="artnote">ILLUSTRATION — swap for photo</span>');
  });
};

/* ================================================================
   CART — localStorage, drawer, no Stripe yet
   ================================================================ */
var KEY = 'cc_cart_v1';

CC.cart = {
  read: function () {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch (e) { return []; }
  },
  write: function (items) {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {}
    CC.cart.render();
  },
  add: function (item) {
    var items = CC.cart.read();
    items.push(item);
    CC.cart.write(items);
    CC.toast(item.title + ' added');
    CC.drawer(true);
  },
  remove: function (i) {
    var items = CC.cart.read();
    items.splice(i, 1);
    CC.cart.write(items);
  },
  total: function () {
    return CC.cart.read().reduce(function (n, it) { return n + (it.price * (it.qty || 1)); }, 0);
  },
  count: function () {
    return CC.cart.read().reduce(function (n, it) { return n + (it.qty || 1); }, 0);
  },
  render: function () {
    var items = CC.cart.read();
    var cnt = document.querySelector('[data-cart-count]');
    if (cnt) {
      cnt.textContent = CC.cart.count() || '';
      if (CC.cart.count()) cnt.removeAttribute('hidden'); else cnt.setAttribute('hidden', '');
    }
    var body = document.querySelector('[data-cart-body]');
    if (!body) return;
    if (!items.length) {
      body.innerHTML = '<div class="dr-empty">Nothing in here yet.<br>Pick a template to get started.</div>';
    } else {
      body.innerHTML = items.map(function (it, i) {
        var art = it.way
          ? '<div class="ci-art"><div class="art" data-cottage="' + it.way + '" data-name="' +
            esc(it.name || '') + '" data-nonote></div></div>'
          : '<div class="ci-art" style="display:grid;place-items:center;font-size:26px">' + (it.icon || '📦') + '</div>';
        return '<div class="ci">' + art +
          '<div class="ci-t"><b>' + esc(it.title) + '</b><span>' + esc(it.sub || '') + '</span>' +
          (it.qty > 1 ? '<span>Qty ' + it.qty + '</span>' : '') +
          '<button class="ci-rm" data-rm="' + i + '">Remove</button></div>' +
          '<div class="ci-p">$' + (it.price * (it.qty || 1)) + '</div></div>';
      }).join('');
      CC.paintArt(body);
    }
    var tot = document.querySelector('[data-cart-total]');
    if (tot) tot.textContent = '$' + CC.cart.total();
    var co = document.querySelector('[data-checkout]');
    if (co) co.setAttribute('aria-disabled', items.length ? 'false' : 'true');
  }
};

CC.drawer = function (open) {
  var d = document.querySelector('.drawer'), s = document.querySelector('.scrim');
  if (!d) return;
  d.classList.toggle('on', !!open);
  if (s) s.classList.toggle('on', !!open);
};

var toastTimer;
CC.toast = function (msg) {
  var t = document.querySelector('.toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.classList.remove('on'); }, 2200);
};

/* ================================================================
   MOUNT
   ================================================================ */
CC.mount = function () {
  CC.paintArt(document);
  CC.cart.render();

  document.addEventListener('click', function (e) {
    var t = e.target;

    var open = t.closest('[data-cart-open]');
    if (open) { e.preventDefault(); CC.drawer(true); return; }
    if (t.closest('[data-cart-close]') || t.classList.contains('scrim')) { CC.drawer(false); return; }

    var rm = t.closest('[data-rm]');
    if (rm) { CC.cart.remove(+rm.getAttribute('data-rm')); return; }

    var co = t.closest('[data-checkout]');
    if (co) {
      e.preventDefault();
      if (co.getAttribute('aria-disabled') === 'true') return;
      CC.toast('Checkout is not wired to Stripe yet — see the note below');
      return;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') CC.drawer(false);
  });
};

/* ---------------- refill picker (landing + refills page) ---------------- */
CC.initRefills = function () {
  var tiles = document.querySelectorAll('[data-refill]');
  if (!tiles.length) return;
  var btn = document.querySelector('[data-refill-add]');
  var out = document.querySelector('[data-refill-label]');
  var pick = 2;

  function paint() {
    Array.prototype.forEach.call(tiles, function (el) {
      el.setAttribute('aria-pressed', String(+el.getAttribute('data-refill') === pick));
    });
    var price = CC.PRICE.refill[pick];
    if (out) out.textContent = pick + (pick === 1 ? ' insert' : ' inserts') + ' — $' + price;
    if (btn) btn.textContent = 'Order ' + pick + (pick === 1 ? ' insert' : ' inserts') + ' — $' + price;
  }

  Array.prototype.forEach.call(tiles, function (el) {
    el.addEventListener('click', function () { pick = +el.getAttribute('data-refill'); paint(); });
  });

  if (btn) btn.addEventListener('click', function (e) {
    e.preventDefault();
    CC.cart.add({
      title: pick + ' refill insert' + (pick === 1 ? '' : 's'),
      sub: 'Corrugated, fits every design',
      price: CC.PRICE.refill[pick], qty: 1, icon: '📦'
    });
  });

  paint();
};

/* ---------------- mailto forms ----------------
   No backend is wired for CatCustoms yet, so rather than fake a
   submission these compose a real email. Swap for a POST to
   /api/contact once the CatCustoms fields are added there. */
CC.initForms = function () {
  var forms = document.querySelectorAll('form[data-mailto]');
  Array.prototype.forEach.call(forms, function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var to = f.getAttribute('data-mailto');
      var subject = f.getAttribute('data-subject') || 'CatCustoms enquiry';
      var lines = [];
      Array.prototype.forEach.call(f.querySelectorAll('[name]'), function (el) {
        var lbl = el.getAttribute('data-label') || el.getAttribute('name');
        if (el.value) lines.push(lbl + ': ' + el.value);
      });
      var ok = f.querySelector('.okmsg');
      if (ok) ok.classList.add('on');
      window.location.href = 'mailto:' + to +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(lines.join('\n\n'));
    });
  });
};

/* ---------------- product page (cc-template.html) ---------------- */
CC.initPDP = function () {
  var root = document.querySelector('[data-pdp]');
  if (!root) return;

  var state = { way: 'cream', name: '', qty: 1, refill: false, keys: 0 };

  var stage    = root.querySelector('[data-pdp-art]');
  var thumbs   = root.querySelectorAll('[data-pdp-thumb]');
  var picks    = root.querySelectorAll('[data-pdp-way]');
  var wayLabel = root.querySelector('[data-way-label]');
  var nameIn   = root.querySelector('[data-pdp-name]');
  var nameCt   = root.querySelector('[data-name-count]');
  var qtyOut   = root.querySelector('[data-qty-n]');
  var totalOut = root.querySelector('[data-pdp-total]');
  var addRows  = root.querySelectorAll('[data-add]');
  var addBtn   = root.querySelector('[data-pdp-add]');
  var MAXNAME  = 18;

  function total() {
    var t = CC.PRICE.template * state.qty;
    if (state.refill) t += CC.PRICE.refill[2];
    if (state.keys) t += CC.PRICE.keychain[state.keys];
    return t;
  }

  function paint() {
    if (stage) {
      stage.setAttribute('data-cottage', state.way);
      stage.setAttribute('data-name', state.name);
      CC.paintArt(stage.parentNode);
    }
    Array.prototype.forEach.call(picks, function (b) {
      var on = b.getAttribute('data-pdp-way') === state.way;
      b.setAttribute('aria-pressed', String(on));
      if (b.parentNode) b.parentNode.setAttribute('data-on', on ? '1' : '0');
    });
    Array.prototype.forEach.call(thumbs, function (b) {
      var k = b.getAttribute('data-pdp-thumb');
      b.setAttribute('aria-pressed', String(k === state.way));
      var inner = b.querySelector('.art');
      if (inner) { inner.setAttribute('data-cottage', k); inner.setAttribute('data-name', state.name); }
    });
    if (thumbs.length) CC.paintArt(thumbs[0].parentNode);
    if (wayLabel) wayLabel.textContent = CC.WAYS[state.way].name;
    if (nameCt) nameCt.textContent = state.name.length + '/' + MAXNAME;
    if (qtyOut) qtyOut.textContent = state.qty;
    Array.prototype.forEach.call(addRows, function (r) {
      var kind = r.getAttribute('data-add');
      var on = kind === 'refill' ? state.refill : state.keys === +r.getAttribute('data-keys');
      r.setAttribute('data-on', on ? '1' : '0');
      var tick = r.querySelector('.tick');
      if (tick) tick.textContent = on ? '✓' : '';
    });
    if (totalOut) totalOut.textContent = '$' + total();
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
    if (q) {
      state.qty = Math.max(1, Math.min(9, state.qty + (+q.getAttribute('data-qty'))));
      paint(); return;
    }
    var a = e.target.closest('[data-add]');
    if (a) {
      var kind = a.getAttribute('data-add');
      if (kind === 'refill') state.refill = !state.refill;
      else { var k = +a.getAttribute('data-keys'); state.keys = (state.keys === k) ? 0 : k; }
      paint(); return;
    }
  });

  if (addBtn) addBtn.addEventListener('click', function (e) {
    e.preventDefault();
    CC.cart.add({
      title: 'Storybook Cottage',
      sub: CC.WAYS[state.way].name + (state.name ? ' · “' + state.name + '”' : ' · name to follow'),
      price: CC.PRICE.template, qty: state.qty, way: state.way, name: state.name
    });
    if (state.refill) CC.cart.add({
      title: '2 refill inserts', sub: 'Added with your scratcher',
      price: CC.PRICE.refill[2], qty: 1, icon: '📦'
    });
    if (state.keys) CC.cart.add({
      title: state.keys === 2 ? '2 cat keychains' : 'Cat keychain',
      sub: 'Same figurine, pocket-sized', price: CC.PRICE.keychain[state.keys], qty: 1, icon: '🔑'
    });
  });

  paint();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () { CC.mount(); CC.initRefills(); CC.initPDP(); CC.initForms(); });
} else {
  CC.mount(); CC.initRefills(); CC.initPDP(); CC.initForms();
}

})(window);

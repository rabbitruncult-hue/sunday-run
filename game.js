(() => {
'use strict';

/* ---------- Campaign config: the only part that changes per brand ---------- */
const CFG = {
  campaign: 'sunday-2026-11-15',
  // The Sunday prize run. Every date, time and place the player reads comes from here.
  sunday: {
    opens: '2026-11-14T12:00:00+02:00',   // the game goes live
    closes: '2026-11-15T07:00:00+02:00',  // the game closes (not shown to players)
    link: 'https://hare-raiser.pages.dev',
    t: {
      runDay: 'Sunday 15 Nov',
      runShort: 'SUN 15 NOV',
      runLine: '6KM run. Sunday 15 Nov, 8am at Pink Dahlia, Saunders.',
      playWhen: 'Saturday, from 12:00.',
      dropLine: 'Saturday 14 Nov at 12:00. Right here, on this link.',
      nextPlay: 'Saturday, 12:00',
      nextRun: 'Sunday 15 Nov, 8am'
    }
  },
  api: 'https://script.google.com/macros/s/AKfycbzY5JsSMTJQUG-SedIqN4Yb3N3L_5MQO2DQyOAfvU8pEGgyw55G8ILwHk7PLkfkVKRTbQ/exec',       // the Sheet's web app URL. Empty = test build, nothing saved.
  claimWa: '27726252347', // the Run Cult PA on WhatsApp: where winners send their claim code.
  tries: 1,
  minCarrots: 12,       // carrots needed to get into the prize draw (the server sends the live number)
  fullCarrots: 24,      // carrots for the best odds
  courseM: 800,
  shownKm: 5,
  speedStart: 15,
  speedEnd: 27,
  lives: 3,
  prizes: [['Under Armour kit', 'kit'], ['Mystery voucher', 'mystery'], ['Gypsy Rabbit voucher', 'voucher'], ['Pink Dahlia coffee', 'pinkdahlia']],
  // Route facts checked 11 Nov 2026: the Cape Wheel is at the V&A Waterfront, Bree St runs up from the
  // Foreshore and blends into Kloof St towards the mountain.
  route: [[35, 'V&A WATERFRONT'], [290, 'BREE ST'], [420, 'BREE ST'], [560, 'KLOOF ST'], [690, 'KLOOF ST']],
  wheelAt: 150,
  fields: [
    { key: 'cut', label: 'Cut', opts: ["Men's", "Women's"] },
    { key: 'shirt', label: 'Shirt size', opts: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
    { key: 'shorts', label: 'Shorts size', opts: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] }
  ],
  terms: [
    'Rabbit Run Cult runs this giveaway. Under Armour, Gypsy Rabbit and Pink Dahlia supply prizes. They do not run the game.',
    'It is free. You only pay your own normal data costs.',
    'Sign up with your own name and cell number. One sign-up and one prize per person.',
    'The game opens on Saturday 14 Nov at 12:00 and closes before the run on Sunday. You get one run.',
    'Every signed-up player who plays wins one prize: Under Armour kit, a mystery voucher, a Gypsy Rabbit voucher or a Pink Dahlia coffee. You find out which one at the run. More carrots give you a better shot at the kit.',
    'Prizes are handed over in person only, at the Run Cult run on Sunday 15 Nov. If you are not there, your prize goes back into the pool. We do not courier, hold prizes or pay out cash.',
    'We try to match your size. Kit depends on stock, so the item or size may differ. No swaps for cash.',
    'We collect your name, cell number and sizes to run this giveaway and hand out prizes. They sit in a private Run Cult sheet and are not shared outside Run Cult. Message Run Cult any time to have yours deleted.',
    'We may share winners\' names in the Run Cult WhatsApp Community.',
    'Bots, scripts, fake numbers and any attempt to cheat mean disqualification. Run Cult can pause, change or end the giveaway at any time and its decision is final.',
    'Play somewhere safe, not while running or driving. Run Cult is not responsible for phone, data or network problems.'
  ],
  bonk: {
    pothole: ['Eish. That pothole has its own postal code.', 'The pothole was there first. It has seniority.', 'Road 1. You 0.'],
    cone: ['The cone did not move. You did.', 'Beaten by a stationary object. Ag shame.', 'It was literally a warning.'],
    phone: ['He was voice noting. For four minutes.', 'He never even looked up.', 'Two people. Zero awareness.'],
    taxi: ['The taxi had right of way. The taxi always has right of way.', 'Hooter 1. You 0.', 'It indicated left and went right. Classic.']
  },
  finishLines: ['Sharp sharp. You made it up Kloof.', 'Lekker. Waterfront to Kloof without bonking.', 'Yoh. Finished, and the southeaster did not even help.']
};

// A local file never talks to the live Sheet.
CFG.api = '';   // PREVIEW COPY: nothing is saved or sent

/* ---------- Setup ---------- */
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const Z0 = 8, ZFAR = 70, ZNEAR = -2.6;
const FONT = '"Helvetica Neue",Helvetica,Arial,sans-serif';
let W = 0, H = 0, DPR = 1, HOR = 0, GY = 0, LW = 0, sky = null;

// Colour art. Everything still draws in line art until (or if) an image fails to load.
const ART = {}, ORANGE = '#ff8a1f';
for (const n of ['carrot', 'wheel', 'taxi', 'cone', 'pothole', 'phone', 'runner', 'bree', 'kloof', 'vna', 'finish']) {
  const im = new Image();
  im.onload = () => { ART[n] = im; if (n === 'sky' && W) buildSky(); };
  im.src = 'assets/art/' + n + '.webp';
}
const SIGN = { 'V&A WATERFRONT': 'vna', 'BREE ST': 'bree', 'KLOOF ST': 'kloof' };

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  HOR = H * 0.30; GY = H * 0.80; LW = Math.min(W * 0.27, 140);
  buildSky();
  draw();
}

// Skyline as seen from the city: Devil's Peak, Table Mountain, Lion's Head, Signal Hill (left to right).
const RIDGE = [[0, .10], [.06, .14], [.15, .30], [.20, .40], [.24, .33], [.27, .30], [.31, .44], [.33, .47], [.66, .47], [.69, .42],
  [.72, .28], [.76, .20], [.80, .27], [.835, .37], [.85, .35], [.87, .26], [.90, .19], [.94, .18], [1, .13]];

function buildSky() {
  sky = document.createElement('canvas');
  sky.width = Math.max(1, Math.round(W * DPR)); sky.height = Math.max(1, Math.round((HOR + 2) * DPR));
  const c = sky.getContext('2d'); c.setTransform(DPR, 0, 0, DPR, 0, 0);
  const g = c.createLinearGradient(0, 0, 0, HOR);
  g.addColorStop(0, '#050505'); g.addColorStop(1, '#1e1e1e');
  c.fillStyle = g; c.fillRect(0, 0, W, HOR + 2);
  if (ART.sky) {
    const im = ART.sky, sc = Math.max(W / im.naturalWidth, HOR * 1.04 / im.naturalHeight), iw = im.naturalWidth * sc, ih = im.naturalHeight * sc;
    c.fillStyle = '#2f8fe8'; c.fillRect(0, 0, W, HOR + 2);
    c.drawImage(im, (W - iw) / 2, HOR + 2 - ih, iw, ih);
    return;
  }
  let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ry = f => HOR - HOR * f * 1.25;
  c.beginPath(); c.moveTo(0, HOR + 2);
  for (const p of RIDGE) c.lineTo(p[0] * W, ry(p[1]));
  c.lineTo(W, HOR + 2); c.closePath();
  c.fillStyle = '#161616'; c.fill(); c.strokeStyle = '#5a5a5a'; c.lineWidth = 1.5; c.stroke();
  return;   // minimalist: the ridge line only
  // the tablecloth
  c.fillStyle = '#fff';
  for (let i = 0; i <= 16; i++) {
    const x = (0.34 + 0.31 * i / 16) * W, rr2 = W * 0.013 * (0.8 + r() * 0.6);
    c.globalAlpha = 0.22; c.beginPath(); c.ellipse(x, ry(.47) + rr2 * 0.5, rr2 * 1.6, rr2 * (0.5 + r() * 0.5), 0, 0, 7); c.fill();
  }
  c.globalAlpha = 1;
  // city bowl lights
  let x = -6;
  while (x < W + 6) {
    const bw = 10 + r() * 22, bh = HOR * (0.03 + r() * 0.09);
    c.fillStyle = '#141414'; c.fillRect(x, HOR - bh, bw, bh + 2);
    c.fillStyle = '#5a5a5a';
    for (let wy = HOR - bh + 3; wy < HOR - 3; wy += 5)
      for (let wx = x + 3; wx < x + bw - 3; wx += 5) if (r() < 0.3) c.fillRect(wx, wy, 1.5, 2);
    x += bw + 1;
  }
}

/* ---------- Saved state on this phone (convenience only, the server holds the real rule) ---------- */
// Kept twice (local storage and a cookie), so clearing one does not hand out 3 fresh runs.
const cookie = {
  get(k) { const m = document.cookie.match(new RegExp('(?:^|; )' + k + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : null; },
  set(k, v) { try { document.cookie = k + '=' + encodeURIComponent(v) + '; max-age=' + 60 * 60 * 24 * 30 + '; path=/; SameSite=Lax; Secure'; } catch (e) { /* optional */ } }
};
const store = {
  get() {
    for (const raw of [(() => { try { return localStorage.getItem('cultrun2'); } catch (e) { return null; } })(), cookie.get('cultrun2')]) {
      try { const d = JSON.parse(raw || 'null'); if (d && d.c === CFG.campaign) return d; } catch (e) { /* next */ }
    }
    return { c: CFG.campaign, tries: 0, best: 0, r: null, su: null };
  },
  set(d) { const v = JSON.stringify(d); try { localStorage.setItem('cultrun2', v); } catch (e) { /* optional */ } cookie.set('cultrun2', v); }
};
// A random id for this phone, so one phone gets one prize draw a week whatever number is typed.
const DEV = (() => {
  let id = null;
  try { id = localStorage.getItem('hr_dev'); } catch (e) { /* fall back */ }
  id = id || cookie.get('hr_dev');
  if (!/^[a-f0-9]{32}$/.test(id || '')) {
    const a = new Uint8Array(16); crypto.getRandomValues(a); id = Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
  }
  try { localStorage.setItem('hr_dev', id); } catch (e) { /* optional */ }
  cookie.set('hr_dev', id);
  return id;
})();
// A print of the phone (model, screen, settings). Same model phones can share one, so it only flags.
const FP = (() => {
  let c = '';
  try {
    const k = document.createElement('canvas'), x = k.getContext('2d'); k.width = 200; k.height = 40;
    x.textBaseline = 'top'; x.font = '16px Arial'; x.fillStyle = '#f60'; x.fillRect(2, 2, 90, 20);
    x.fillStyle = '#069'; x.fillText('Hare Raiser 🥕', 4, 6); c = k.toDataURL();
  } catch (e) { /* optional */ }
  const n = navigator, sc = window.screen || {};
  const s = [n.userAgent, n.language, (n.languages || []).join(','), n.hardwareConcurrency, n.deviceMemory, n.maxTouchPoints,
    sc.width, sc.height, sc.colorDepth, window.devicePixelRatio, Intl.DateTimeFormat().resolvedOptions().timeZone, c].join('|');
  let h1 = 0x811c9dc5, h2 = 0x1505;
  for (let i = 0; i < s.length; i++) { const ch = s.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 16777619) >>> 0; h2 = (Math.imul(h2, 33) + ch) >>> 0; }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
})();
let P = store.get();
const triesLeft = () => Math.max(0, CFG.tries - P.tries);

/* ---------- Game state ---------- */
const S = {
  mode: 'start', t: 0, dist: 0, speed: 6, lane: 0, px: 0, lives: CFG.lives, carrots: 0, hits: 0,
  inv: 0, shake: 0, flash: 0, objs: [], deco: [], nextRow: 60, safe: 0, phase: 0, lastHit: 'cone',
  finishT: 0, confetti: [], pops: []
};

function reset() {
  S.t = 0; S.dist = 0; S.speed = CFG.speedStart; S.lane = 0; S.px = 0; S.lives = CFG.lives;
  S.carrots = 0; S.hits = 0; S.inv = 0; S.shake = 0; S.flash = 0;
  S.objs = [{ k: 'finish', lane: 0, w: CFG.courseM }];
  S.deco = CFG.route.map(r => ({ k: 'sign', w: r[0], side: r[1] === 'V&A WATERFRONT' ? -1 : 1, text: r[1] }));
  S.deco.push({ k: 'wheel', w: CFG.wheelAt, side: -1 });
  S.nextRow = 60; S.safe = 0; S.confetti = []; S.pops = [];
  hud();
}

function spawnRow(w) {
  const prog = w / CFG.courseM, gap = 24 - 8 * prog;
  const free = pick([-1, 0, 1].filter(l => Math.abs(l - S.safe) <= 1));
  const others = [-1, 0, 1].filter(l => l !== free);
  const blocked = Math.random() < 0.22 + 0.4 * prog ? others : [pick(others)];
  // Carrots sit between rows in any lane, so you have to go and fetch them.
  if (Math.random() < 0.8) S.objs.push({ k: 'carrot', lane: pick([-1, 0, 1]), w: w - gap / 2 });
  for (const b of blocked) S.objs.push({ k: pick(['pothole', 'pothole', 'cone', 'cone', 'phone', 'phone', 'taxi']), lane: b, w });
  S.safe = free;
  return gap;
}

/* ---------- Sound and haptics ---------- */
let ac = null;
function audioOn() {
  try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) { ac = null; }
}
function beep(f, d, type, g) {
  if (!ac) return;
  try {
    const o = ac.createOscillator(), gn = ac.createGain(), t = ac.currentTime;
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
    gn.gain.setValueAtTime(g || 0.035, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(gn); gn.connect(ac.destination); o.start(t); o.stop(t + d);
  } catch (e) { /* sound is optional */ }
}
const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* optional */ } };

/* ---------- Screens ---------- */
const screens = ['signup', 'count', 'full', 'over', 'start', 'after', 'terms', 'reveal', 'closed'];
function show(name) {
  for (const s of screens) $(s).classList.toggle('hidden', s !== name);
  fitLines();
  $('hud').classList.toggle('hidden', name !== null);
}
// Headlines marked .oneline shrink until they fit on one line.
function fitLines() {
  for (const el of document.querySelectorAll('.oneline')) {
    if (!el.offsetParent) continue;
    let fs = 46; el.style.fontSize = fs + 'px';
    while (fs > 20 && el.scrollWidth > el.clientWidth) { fs--; el.style.fontSize = fs + 'px'; }
  }
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitLines);
window.addEventListener('resize', fitLines);
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

function hud() {
  const dots = $('lives').children;
  for (let i = 0; i < dots.length; i++) dots[i].classList.toggle('gone', i >= S.lives);
  $('carrotFill').style.width = (clamp(S.carrots / CFG.fullCarrots, 0, 1) * 100) + '%';
  $('carrotBar').classList.toggle('full', S.carrots >= CFG.fullCarrots);
  $('carrotLabel').textContent = plural(S.carrots, 'carrot') + '. More carrots, better shot at the kit.';
}

function fillPrizes(el) {
  el.textContent = '';
  for (const p of CFG.prizes) {
    const li = document.createElement('li'), im = document.createElement('img'), sp = document.createElement('span');
    im.src = 'assets/art/' + p[1] + '.webp'; im.alt = ''; sp.textContent = p[0];
    li.appendChild(im); li.appendChild(sp); el.appendChild(li);
  }
}

// Big word plus a small tag on the 3D buttons.
function setBtn(el, big, tag) {
  el.querySelector('.big').textContent = big;
  const t = el.querySelector('.tag'); t.textContent = tag || ''; t.classList.toggle('hidden', !tag);
}

function paintStart() {
  const left = triesLeft(), btn = $('btnRun');
  if (P.r) setBtn(btn, 'MY PRIZE');
  else if (left > 0) setBtn(btn, P.tries ? 'RUN AGAIN' : "LET'S RUN", CFG.tries > 1 ? 'RUN ' + (P.tries + 1) + ' OF ' + CFG.tries : 'ONE RUN');
  else setBtn(btn, 'LOCK IT IN', plural(P.best, 'carrot'));
}

function startPressed() {
  if (P.r) { revealShow(P.r, false); return; }
  if (triesLeft() > 0) startRun(); else lockIn();
}

function startRun() {
  if (triesLeft() <= 0) return;
  P.tries++; store.set(P);
  audioOn(); reset(); S.mode = 'run'; show(null);
  $('hint').classList.remove('hidden');
  setTimeout(() => $('hint').classList.add('hidden'), 3200);
  beep(660, 0.12, 'sine', 0.05);
}

function endRun(finished) {
  S.mode = 'done';
  P.best = Math.max(P.best, S.carrots); store.set(P); paintStart();
  const km = (CFG.shownKm * clamp(S.dist / CFG.courseM, 0, 1)).toFixed(1);
  paintAfter(finished ? 'FINISHED / ' + CFG.shownKm + ' K' : 'BONKED AT ' + km + ' K', finished ? 'You made it!' : 'Bonked!',
    finished ? pick(CFG.finishLines) : pick(CFG.bonk[S.lastHit] || CFG.bonk.cone), S.carrots);
  if (!finished) beep(140, 0.5, 'sawtooth', 0.05);
}

// Everyone who plays wins, so every run ends on the same two choices: run again or lock the prize in.
function paintAfter(label, title, line, carrots, status) {
  const left = triesLeft();
  $('afterLabel').textContent = label; $('afterTitle').textContent = title; $('afterLine').textContent = line;
  $('aRun').textContent = carrots;
  $('aBest').textContent = 'Best haul ' + P.best + '. ' + (left ? plural(left, 'run') + ' left.' : 'No runs left.');
  $('aBest').classList.toggle('hidden', CFG.tries < 2);
  $('afterMeterWrap').classList.add('hidden');
  $('afterStatus').textContent = status || (left ? 'You have won a prize. Run again for a better shot at the kit, or lock it in.' : 'You have won a prize. Lock it in below.');
  const cash = $('btnCash'), again = $('btnAgain');
  setBtn(cash, 'LOCK IT IN', plural(P.best, 'carrot'));
  again.classList.toggle('hidden', left === 0); again.classList.add('ghost');
  setBtn(again, 'RUN AGAIN', left + ' LEFT');
  $('afterNote').textContent = left > 0 ? 'Locking in ends your runs.' : '';
  show('after');
}

function showClosed() { S.mode = 'start'; show('closed'); }

/* ---------- Server ---------- */
let token = '', tokenAt = 0, lastPayload = null, busy = false;
const sel = {};

function post(body) {
  const ctl = window.AbortController ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), 25000) : 0;
  return fetch(CFG.api, {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body),
    redirect: 'follow', credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctl ? ctl.signal : undefined
  }).then(r => r.json()).finally(() => clearTimeout(timer));
}
function getToken() {
  if (!CFG.api || (token && Date.now() - tokenAt < 2.5 * 3600 * 1000)) return Promise.resolve(token);
  return post({ action: 'start', dev: DEV }).then(r => {
    // A new lives round from the server: this phone gets 3 fresh runs.
    if (r && r.round && P.round !== r.round) {
      P = { c: CFG.campaign, round: String(r.round), tries: 0, best: 0, r: null, su: P.su }; store.set(P); paintStart();
    }
    if (r && r.code === 'closed' && !P.r) showClosed();
    if (r && r.code === 'played' && r.r) {
      P.r = { code: String(r.r.code || ''), go: String(r.r.go || '') };
      P.tries = CFG.tries; store.set(P); paintStart();
      if (S.mode === 'start') revealShow(P.r, false);
    }
    if (r && r.ok) {
      token = r.token; tokenAt = Date.now();
      if (r.min > 0) CFG.minCarrots = Math.floor(r.min);
      if (r.full > 0) CFG.fullCarrots = Math.floor(r.full);
      paintStart(); hud();
    }
    return token;
  }).catch(() => token);
}
function sendEntry() { return getToken().then(t => post(Object.assign({ action: 'enter', token: t }, lastPayload))); }
function waitIfSoon(r, n) {
  n = n || 0;
  if (!r || r.code !== 'soon' || n >= 5) return r;
  return new Promise(res => setTimeout(res, 8000)).then(sendEntry).then(x => waitIfSoon(x, n + 1));
}
const API = {
  enter(payload) {
    lastPayload = payload;
    if (!CFG.api) return new Promise(res => setTimeout(() => res({ ok: true, code: 'TEST-' + Math.floor(1000 + Math.random() * 9000) }), 500));
    return sendEntry().then(r => {
      if (r && (r.code === 'stale' || r.code === 'used') && token) { token = ''; return sendEntry(); }
      return r;
    }).then(waitIfSoon).then(r => {
      if (r && r.code === 'busy') return new Promise(res => setTimeout(res, 3000 + Math.random() * 3000)).then(sendEntry);
      return r;
    }).then(r => {
      // Each run token is good for one entry, so line up a fresh one for the next player on this phone.
      if (r && r.ok) { token = ''; getToken(); }
      return r;
    });
  },
  info() { return CFG.api ? post({ action: 'info' }) : Promise.resolve({ ok: true, now: Date.now(), left: /full/.test(location.hash) ? 0 : -1 }); },
  signup(payload) {
    if (!CFG.api) return new Promise(res => setTimeout(() => res({ ok: true, left: -1 }), 500));
    return post(Object.assign({ action: 'signup' }, payload));
  },
  rsvp(go) {
    if (!CFG.api) return new Promise(res => setTimeout(() => res({ ok: true }), 400));
    return post({ action: 'rsvp', cell: P.su.cell, dev: DEV, code: P.r.code, go: !!go });
  }
};
const FAIL = {
  taken: 'This number already has its prize locked in.',
  closed: 'The game is closed for now.',
  early: 'The game is not open yet. Come back on Saturday at 12:00.',
  nospot: 'This number has no spot. Sign up first.',
  full: 'All the spots are gone.',
  phone: 'This phone already has a spot. One spot per phone.',
  device: 'This phone already locked in a prize. One prize per person.',
  busy: 'The finish line is packed. Give it a few seconds and try again.',
  soon: 'That was quick. Give it a few seconds and try again.',
  bad: 'Something does not look right. Check it and try again.'
};

/* ---------- Entry form and reveal ---------- */
function buildForm() {
  const host = $('chipHost');
  for (const f of CFG.fields) {
    const lab = document.createElement('div'); lab.className = 'chipLabel'; lab.textContent = f.label;
    const row = document.createElement('div'); row.className = 'chips';
    for (const o of f.opts) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = o;
      b.addEventListener('click', () => {
        sel[f.key] = o; for (const c of row.children) c.classList.toggle('on', c === b);
        $('sErr').textContent = ''; buzz(10);
      });
      row.appendChild(b);
    }
    host.appendChild(lab); host.appendChild(row);
  }
  for (const t of CFG.terms) { const li = document.createElement('li'); li.textContent = t; $('termsList').appendChild(li); }
  for (const el of document.querySelectorAll('[data-prizes]')) fillPrizes(el);
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = SUN.t[el.dataset.t] || '';
  $('lnkShare').href = 'https://wa.me/?text=' + encodeURIComponent('Everyone wins a prize at Run Cult this ' + SUN.t.runDay + '. Sign up now, play the game on Saturday at 12:00, collect at the run: ' + SUN.link);
}

// Mirrors the server: one real number always becomes one value.
function normCell(v) {
  v = String(v).trim();
  let plus = v.charAt(0) === '+', d = v.replace(/\D/g, '');
  if (d.indexOf('00') === 0) { d = d.slice(2); plus = true; }
  if (plus || (d.indexOf('27') === 0 && d.length >= 11)) {
    if (/^270[6-8]\d{8}$/.test(d)) d = '27' + d.slice(3);
    return /^27[6-8]\d{8}$/.test(d) ? '+' + d : null;
  }
  return /^0[6-8]\d{8}$/.test(d) ? '+27' + d.slice(1) : null;
}

function revealStart() {
  show('reveal');
  const box = $('shaker');
  $('prize').classList.add('hidden'); box.classList.remove('hidden');
  box.style.animation = 'none'; void box.offsetWidth; box.style.animation = '';
  beep(300, 0.1); setTimeout(() => beep(360, 0.1), 300); setTimeout(() => beep(430, 0.1), 600);
}

// The prize stays a mystery until the finish line. The only choice here is coming or passing it on.
function revealShow(r, fresh) {
  show('reveal');
  $('shaker').classList.add('hidden');
  const go = r.go || '', first = P.su ? P.su.name.split(' ')[0] : '';
  $('rTitle').textContent = go === 'no' ? 'Legend. Prize passed on.' : go === 'yes' ? 'See you Sunday' + (first ? ', ' + first : '') + '.' : "It's waiting at the finish line.";
  const line = go === 'no' ? '' : go === 'yes' ? 'Your prize will be packed for you. You find out which one at the finish.' : 'You find out which one at the run. ' + SUN.t.runLine;
  $('rLine').textContent = line; $('rLine').classList.toggle('hidden', !line);
  $('rAsk').classList.toggle('hidden', !!go); $('rGo').classList.toggle('hidden', go !== 'yes'); $('rPass').classList.toggle('hidden', go !== 'no');
  $('rPrizes').classList.toggle('hidden', go === 'no');
  $('rPill').classList.toggle('hidden', go === 'no');
  $('claimCode').textContent = r.code || first;
  $('rErr').textContent = '';
  $('prize').classList.remove('hidden');
  $('reveal').scrollTop = 0;
  if (fresh) { beep(880, 0.25, 'sine', 0.06); buzz([60, 40, 120]); }
}

function lockIn() {
  if (busy || !P.su) return;
  busy = true; revealStart();
  const fail = msg => { busy = false; paintAfter('', 'Almost.', '', P.best, msg || 'Could not lock in your prize. Check your signal and tap again.'); };
  Promise.all([API.enter({ campaign: CFG.campaign, name: P.su.name, cell: P.su.cell, sizes: P.su.sizes, carrots: P.best, dev: DEV, fp: FP }),
    new Promise(r => setTimeout(r, 1150))]).then(([r]) => {
    if (r && r.code === 'closed') { busy = false; showClosed(); return; }
    if (!r || !r.ok) { fail(FAIL[r && r.code]); return; }
    if (r.again && !r.code) { fail('This number already locked in its prize. Open this link in the browser you played in.'); return; }
    busy = false;
    P.r = { code: String(r.code || ''), go: String(r.go || '') };
    P.tries = CFG.tries; store.set(P); paintStart(); revealShow(P.r, true);
  }).catch(() => fail());
}

function rsvp(go) {
  if (busy || !P.r) return;
  busy = true; $('rErr').textContent = '';
  API.rsvp(go).then(r => {
    busy = false;
    if (!r || !r.ok) { $('rErr').textContent = 'Could not save that. Check your signal and tap again.'; return; }
    P.r.go = go ? 'yes' : 'no'; store.set(P); revealShow(P.r, true);
  }).catch(() => { busy = false; $('rErr').textContent = 'Could not save that. Check your signal and tap again.'; });
}

/* ---------- Sunday prize run: sign up first, countdown, then the game ---------- */
const SUN = CFG.sunday;
let backIn = false, OPENS = Date.parse(SUN.opens), CLOSES = Date.parse(SUN.closes), skew = 0, spotsLeft = null, tick = 0;
// Local test only: #open skips the countdown, #over jumps past closing time.
if (true) {
  const h = location.hash;
  if (/open/.test(h)) OPENS = 0;
  if (/over/.test(h)) { OPENS = 0; CLOSES = 1; }
  if (/fresh/.test(h)) P = { c: CFG.campaign, tries: 0, best: 0, r: null, su: null };
  if (/su|won/.test(h)) P.su = { name: 'Thandi Mokoena', cell: '+27825550001', sizes: { cut: "Women's", shirt: 'M', shorts: 'M' } };
  if (/won/.test(h)) P.r = { code: 'RC-7KQ2M', go: /go/.test(h) ? 'yes' : /pass/.test(h) ? 'no' : '' };
}
const now = () => Date.now() + skew;
const pad = n => String(n).padStart(2, '0');

function paintSpots() {
  /* no spots limit is shown: sign-ups are open to everyone */
}

function paintClock() {
  const ms = OPENS - now();
  if (ms <= 0) { clearInterval(tick); tick = 0; route(); return; }
  const s = Math.floor(ms / 1000);
  $('cD').textContent = Math.floor(s / 86400); $('cH').textContent = pad(Math.floor(s % 86400 / 3600));
  $('cM').textContent = pad(Math.floor(s % 3600 / 60)); $('cS').textContent = pad(s % 60);
}

function showCount() {
  $('cHello').textContent = "You're in, " + P.su.name.split(' ')[0] + '.';
  show('count'); paintClock();
  if (!tick && OPENS > now()) tick = setInterval(paintClock, 1000);
}

// Picks the one screen this player should see right now.
function route() {
  if (S.mode === 'run' || S.mode === 'finishing') return;
  paintSpots();
  if (P.r) { revealShow(P.r, false); return; }
  if (now() >= CLOSES) { show('over'); return; }
  if (!P.su) { show(spotsLeft === 0 && !backIn ? 'full' : 'signup'); return; }
  if (now() < OPENS) { showCount(); return; }
  S.mode = 'start'; paintStart(); show('start'); getToken();
}

$('suForm').addEventListener('submit', e => {
  e.preventDefault();
  if (busy) return;
  const name = $('sName').value.trim().replace(/\s+/g, ' '), cell = normCell($('sCell').value);
  let err = '';
  if (name.length < 2 || !/^[\p{L} .'-]+$/u.test(name)) err = 'Pop in your name and surname.';
  else if (!/\S \S/.test(name)) err = 'Add your surname too, so we can find you on Sunday.';
  else if (!cell) err = 'That does not look like a South African cell number.';
  else {
    for (const f of CFG.fields) if (!sel[f.key]) { err = 'Pick your ' + f.label.toLowerCase() + '.'; break; }
    if (!err && !$('sOk').checked) err = 'Tick the box to say you can run on ' + SUN.t.runDay + '.';
  }
  $('sErr').textContent = err;
  if (err) { buzz(40); return; }
  const btn = $('btnSign');
  busy = true; btn.disabled = true; setBtn(btn, 'SAVING');
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  const done = () => { busy = false; btn.disabled = false; setBtn(btn, 'SAVE MY SPOT'); };
  API.signup({ campaign: CFG.campaign, name, cell, sizes: Object.assign({}, sel), dev: DEV, fp: FP }).then(r => {
    done();
    if (r && r.code === 'full') { spotsLeft = 0; backIn = false; route(); return; }
    if (!r || !r.ok) { $('sErr').textContent = FAIL[r && r.code] || 'Could not save your spot. Check your signal and try again.'; return; }
    P.su = { name, cell, sizes: Object.assign({}, sel) }; store.set(P);
    if (r.left >= 0) spotsLeft = Math.floor(r.left);
    beep(880, 0.2, 'sine', 0.06); buzz([40, 30, 80]);
    route(); $('count').scrollTop = 0;
  }).catch(() => { done(); $('sErr').textContent = 'Could not save your spot. Check your signal and try again.'; });
});

$('btnRun').addEventListener('click', startPressed);
$('btnAgain').addEventListener('click', startRun);
$('btnCash').addEventListener('click', lockIn);
$('btnBackIn').addEventListener('click', () => { backIn = true; route(); });
$('btnGo').addEventListener('click', () => rsvp(true));
$('btnPass').addEventListener('click', () => rsvp(false));
$('btnUndoGo').addEventListener('click', () => rsvp(false));
$('btnUndoPass').addEventListener('click', () => rsvp(true));
$('lnkTerms').addEventListener('click', e => { e.preventDefault(); show('terms'); });
$('btnTermsClose').addEventListener('click', () => show('signup'));

/* ---------- Input ---------- */
function move(d) {
  if (S.mode !== 'run') return;
  const n = clamp(S.lane + d, -1, 1);
  if (n !== S.lane) { S.lane = n; beep(420, 0.04, 'sine', 0.02); }
}
let ptr = null;
cv.addEventListener('pointerdown', e => { ptr = { x: e.clientX, id: e.pointerId, used: false }; });
cv.addEventListener('pointermove', e => {
  if (!ptr || ptr.id !== e.pointerId || ptr.used) return;
  const dx = e.clientX - ptr.x;
  if (Math.abs(dx) > 22) { move(dx > 0 ? 1 : -1); ptr.used = true; }
});
const endPtr = e => {
  if (!ptr || ptr.id !== e.pointerId) return;
  if (!ptr.used && e.type === 'pointerup') move(e.clientX > W / 2 ? 1 : -1);
  ptr = null;
};
cv.addEventListener('pointerup', endPtr);
cv.addEventListener('pointercancel', endPtr);
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a') move(-1);
  else if (e.key === 'ArrowRight' || e.key === 'd') move(1);
});
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('touchmove', e => { if (!(e.target.closest && e.target.closest('.scroll'))) e.preventDefault(); }, { passive: false });

/* ---------- Update ---------- */
function update(dt) {
  S.t += dt; S.phase += dt * (S.mode === 'run' || S.mode === 'finishing' ? 13 : 7);
  S.inv = Math.max(0, S.inv - dt); S.shake = Math.max(0, S.shake - dt); S.flash = Math.max(0, S.flash - dt);
  S.px += (S.lane * LW - S.px) * Math.min(1, dt * 18);
  for (const c of S.confetti) { c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 500 * dt; c.r += c.vr * dt; }
  for (const p of S.pops) p.t += dt;
  S.pops = S.pops.filter(p => p.t < 0.6);

  if (S.mode === 'start') { S.dist += 6 * dt; return; }
  if (S.mode === 'done') return;
  if (S.mode === 'finishing') {
    S.dist += S.speed * dt; S.speed = Math.max(4, S.speed - 14 * dt);
    S.finishT -= dt; if (S.finishT <= 0) endRun(true);
    return;
  }

  const prog = clamp(S.dist / CFG.courseM, 0, 1);
  S.speed = CFG.speedStart + (CFG.speedEnd - CFG.speedStart) * Math.pow(prog, 0.8);
  S.dist += S.speed * dt;
  while (S.nextRow < S.dist + ZFAR && S.nextRow < CFG.courseM - 45) S.nextRow += spawnRow(S.nextRow);

  for (const o of S.objs) {
    if (o.done || o.k === 'finish') continue;
    const z = o.w - S.dist;
    if (z < 1.0 && z > -1.0 && Math.abs(S.px - o.lane * LW) < LW * 0.48) {
      if (o.k === 'carrot') {
        o.done = true; o.gone = true; S.carrots++; hud();
        S.pops.push({ x: W / 2 + S.px, y: GY - LW * 1.45, t: 0 });
        if (S.carrots === CFG.minCarrots) { beep(660, 0.1, 'sine', 0.06); setTimeout(() => beep(990, 0.18, 'sine', 0.06), 90); buzz([30, 30, 60]); }
        else { beep(880, 0.08, 'sine', 0.05); setTimeout(() => beep(1320, 0.1, 'sine', 0.05), 70); buzz(15); }
      } else if (S.inv <= 0) {
        o.done = true; S.lives--; S.hits++; S.inv = 1.2; S.shake = 0.35; S.flash = 0.18; S.lastHit = o.k;
        hud(); beep(110, 0.22, 'sawtooth', 0.06); buzz(90);
        if (S.lives <= 0) { endRun(false); return; }
      }
    }
  }
  S.objs = S.objs.filter(o => !o.gone && o.w - S.dist > -5);
  S.deco = S.deco.filter(o => o.w - S.dist > -6);

  $('barFill').style.width = (prog * 100).toFixed(1) + '%';
  $('km').textContent = (CFG.shownKm * prog).toFixed(1) + ' K';

  if (S.dist >= CFG.courseM) {
    S.mode = 'finishing'; S.finishT = 1.3;
    $('barFill').style.width = '100%'; $('km').textContent = CFG.shownKm.toFixed(1) + ' K';
    for (let i = 0; i < 70; i++) S.confetti.push({
      x: W / 2 + rnd(-W * 0.4, W * 0.4), y: HOR + rnd(-20, 60), vx: rnd(-120, 120), vy: rnd(-380, -120),
      r: rnd(0, 6), vr: rnd(-8, 8), s: rnd(4, 9), c: pick(['#fff', '#fff', ORANGE, ORANGE, '#A6A6A6'])
    });
    beep(523, 0.12, 'sine', 0.06); setTimeout(() => beep(659, 0.12, 'sine', 0.06), 120); setTimeout(() => beep(784, 0.3, 'sine', 0.06), 240);
    buzz([40, 40, 40, 40, 120]);
  }
}

/* ---------- Drawing ---------- */
function proj(x, z) { const s = Z0 / (Z0 + z); return { x: W / 2 + x * s, y: HOR + (GY - HOR) * s, s }; }

function quad(x, za, zb, w, col) {
  const a = proj(x, Math.max(za, ZNEAR)), b = proj(x, zb);
  ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(a.x - w * a.s / 2, a.y); ctx.lineTo(a.x + w * a.s / 2, a.y);
  ctx.lineTo(b.x + w * b.s / 2, b.y); ctx.lineTo(b.x - w * b.s / 2, b.y); ctx.fill();
}

function rr(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

function drawWorld() {
  ctx.fillStyle = '#0A0A0A'; ctx.fillRect(0, HOR, W, H - HOR);
  ctx.drawImage(sky, 0, 0, W, HOR + 2);
  const hw = LW * 1.78, n = proj(0, ZNEAR);
  ctx.fillStyle = '#1b1b1b'; ctx.beginPath();
  ctx.moveTo(W / 2, HOR); ctx.lineTo(W / 2 + hw * n.s, n.y); ctx.lineTo(W / 2 - hw * n.s, n.y); ctx.fill();
  quad(-LW * 1.6, ZNEAR, 600, LW * 0.06, '#8a8a8a');
  quad(LW * 1.6, ZNEAR, 600, LW * 0.06, '#8a8a8a');
  const off = S.dist % 6;
  for (let z = -off - 6; z < ZFAR + 30; z += 6) {
    if (z + 3 < ZNEAR) continue;
    quad(-LW * 0.5, z, z + 3, LW * 0.05, '#6a6a6a');
    quad(LW * 0.5, z, z + 3, LW * 0.05, '#6a6a6a');
  }
  const lo = S.dist % 25;
  for (let z = ZFAR + 50 - ((ZFAR + 50 - (25 - lo)) % 25); z > ZNEAR; z -= 25) {
    for (const side of [-1, 1]) {
      const p = proj(side * LW * 2.25, z), u = LW * p.s, top = p.y - u * 2.7;
      ctx.strokeStyle = '#2E2E2E'; ctx.lineWidth = Math.max(1, u * 0.05);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, top); ctx.lineTo(p.x - side * u * 0.5, top); ctx.stroke();
      ctx.fillStyle = '#ffc27a';
      ctx.globalAlpha = 0.10; ctx.beginPath(); ctx.arc(p.x - side * u * 0.5, top, Math.min(u * 0.5, 38), 0, 7); ctx.fill();
      ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(p.x - side * u * 0.5, top, Math.max(1, u * 0.09), 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function drawDeco(o) {
  const z = o.w - S.dist;
  if (z > ZFAR + 60 || z < ZNEAR) return;
  ctx.globalAlpha = clamp((ZFAR + 60 - z) / 25, 0, 1);
  const sim = o.k === 'sign' ? ART[SIGN[o.text]] : ART.wheel;
  if (sim) {
    const p = proj(o.side * LW * (o.k === 'sign' ? 2.0 : 4.4), z), u = LW * p.s, h = u * (o.k === 'sign' ? 3.1 : 5.6), w = h * sim.naturalWidth / sim.naturalHeight;
    // Bree and Kloof blades hang to the right of their pole, so the pole sits at the kerb.
    const x0 = o.k === 'sign' && o.text !== 'V&A WATERFRONT' ? p.x - w * 0.07 : p.x - w / 2;
    ctx.drawImage(sim, x0, p.y - h, w, h);
    ctx.globalAlpha = 1; return;
  }
  if (o.k === 'sign') {
    const p = proj(o.side * LW * 2.05, z), u = LW * p.s, fs = u * 0.27;
    ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = Math.max(1, u * 0.05);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - u * 1.9); ctx.stroke();
    ctx.font = '700 ' + fs + 'px ' + FONT;
    const tw = ctx.measureText(o.text).width + fs * 1.2, bx = o.side > 0 ? p.x - tw + u * 0.1 : p.x - u * 0.1;
    ctx.fillStyle = '#fff'; rr(bx, p.y - u * 1.9, tw, fs * 1.7, fs * 0.2); ctx.fill();
    if (fs > 4) { ctx.fillStyle = '#0A0A0A'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.text, bx + tw / 2, p.y - u * 1.9 + fs * 0.9); }
  } else {
    // The Cape Wheel: 30 cabins.
    const p = proj(o.side * LW * 4.3, z), u = LW * p.s, R = u * 2.1, cx = p.x, cy = p.y - R - u * 0.5, rot = S.t * 0.15;
    ctx.strokeStyle = '#9a9a9a'; ctx.lineWidth = Math.max(1, u * 0.035);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - R * 0.5, p.y); ctx.moveTo(cx, cy); ctx.lineTo(cx + R * 0.5, p.y); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
    ctx.lineWidth = Math.max(0.6, u * 0.015);
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.86, 0, 7); ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 15; i++) { const a = rot + i * Math.PI / 7.5; ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); }
    ctx.stroke();
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 30; i++) { const a = rot + i * Math.PI / 15; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, Math.max(0.8, u * 0.06), 0, 7); ctx.fill(); }
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(1, u * 0.12), 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawCarrot(x, y, s) {
  // leaves
  ctx.fillStyle = '#bdbdbd';
  for (const a of [-0.5, 0, 0.5]) {
    ctx.save(); ctx.translate(x, y - s * 0.42); ctx.rotate(a);
    ctx.beginPath(); ctx.ellipse(0, -s * 0.22, s * 0.075, s * 0.24, 0, 0, 7); ctx.fill(); ctx.restore();
  }
  // root
  ctx.fillStyle = '#fff'; ctx.beginPath();
  ctx.moveTo(x - s * 0.24, y - s * 0.42);
  ctx.quadraticCurveTo(x, y - s * 0.56, x + s * 0.24, y - s * 0.42);
  ctx.quadraticCurveTo(x + s * 0.16, y + s * 0.2, x, y + s * 0.6);
  ctx.quadraticCurveTo(x - s * 0.16, y + s * 0.2, x - s * 0.24, y - s * 0.42);
  ctx.fill();
  ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = Math.max(0.8, s * 0.035); ctx.beginPath();
  ctx.moveTo(x - s * 0.17, y - s * 0.2); ctx.lineTo(x - s * 0.02, y - s * 0.17);
  ctx.moveTo(x + s * 0.15, y - s * 0.02); ctx.lineTo(x + s * 0.02, y + s * 0.02);
  ctx.moveTo(x - s * 0.1, y + s * 0.2); ctx.lineTo(x, y + s * 0.23); ctx.stroke();
}

function shade(x, y, rx, ry, a) {
  ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill(); ctx.restore();
}
// Bottom-centre anchored sprite, h in px.
function spr(im, x, y, h) { const w = h * im.naturalWidth / im.naturalHeight; ctx.drawImage(im, x - w / 2, y - h, w, h); }

function drawArt(o, x, y, u, A, z) {
  const im = ART[o.k];
  if (!im) return false;
  if (o.k === 'pothole') {
    const w = u * 1.0, h = w * im.naturalHeight / im.naturalWidth; ctx.drawImage(im, x - w / 2, y - h * 0.55, w, h);
  } else if (o.k === 'cone') { shade(x, y, u * 0.32, u * 0.07, 0.5); spr(im, x, y + u * 0.03, u * 0.82);
  } else if (o.k === 'phone') { shade(x, y, u * 0.3, u * 0.07, 0.5); spr(im, x, y + u * 0.02, u * 1.55);
  } else if (o.k === 'taxi') { shade(x, y, u * 0.5, u * 0.09, 0.55); spr(im, x, y + u * 0.03, u * 1.12);
  } else if (o.k === 'carrot') {
    const h = u * 1.0, by = y - u * 0.26 + Math.sin(S.t * 4 + o.w) * u * 0.06;
    shade(x, y, h * 0.26, h * 0.07, 0.45);
    const g = ctx.createRadialGradient(x, by - h / 2, 0, x, by - h / 2, h * 0.85);
    g.addColorStop(0, 'rgba(255,138,31,.38)'); g.addColorStop(1, 'rgba(255,138,31,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, by - h / 2, h * 0.85, 0, 7); ctx.fill();
    spr(im, x, by, h);
  } else if (o.k === 'finish') {
    const l = proj(-LW * 1.75, z), r = proj(LW * 1.75, z);
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 ? '#fff' : '#161616';
      ctx.fillRect(l.x + (r.x - l.x) * i / 12, y - u * 0.05, (r.x - l.x) / 12 + 0.5, u * 0.1);
    }
    const w = (r.x - l.x) * 1.14; ctx.drawImage(im, x - w / 2, y - w * im.naturalHeight / im.naturalWidth, w, w * im.naturalHeight / im.naturalWidth);
  } else return false;
  return true;
}

function drawObj(o) {
  const z = o.w - S.dist;
  if (z > ZFAR + 20 || z < ZNEAR) return;
  const p = proj(o.lane * LW, z), u = LW * p.s, x = p.x, y = p.y;
  ctx.globalAlpha = clamp((ZFAR + 20 - z) / 20, 0, 1) * (o.done && o.k !== 'carrot' ? 0.35 : 1);
  const A = ctx.globalAlpha;

  if (drawArt(o, x, y, u, A, z)) { ctx.globalAlpha = 1; return; }
  if (o.k === 'pothole') {
    ctx.fillStyle = '#000'; ctx.strokeStyle = '#6a6a6a'; ctx.lineWidth = Math.max(1, u * 0.03);
    ctx.beginPath(); ctx.ellipse(x, y, u * 0.42, u * 0.13, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#3d3d3d'; ctx.beginPath();
    ctx.moveTo(x - u * 0.42, y); ctx.lineTo(x - u * 0.6, y - u * 0.05);
    ctx.moveTo(x + u * 0.4, y + u * 0.02); ctx.lineTo(x + u * 0.58, y + u * 0.07); ctx.stroke();
  } else if (o.k === 'cone') {
    ctx.fillStyle = '#d9d9d9'; rr(x - u * 0.3, y - u * 0.07, u * 0.6, u * 0.09, u * 0.02); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath();
    ctx.moveTo(x - u * 0.2, y - u * 0.06); ctx.lineTo(x - u * 0.045, y - u * 0.78); ctx.lineTo(x + u * 0.045, y - u * 0.78); ctx.lineTo(x + u * 0.2, y - u * 0.06); ctx.fill();
    ctx.fillStyle = '#161616';
    ctx.beginPath(); ctx.moveTo(x - u * 0.155, y - u * 0.27); ctx.lineTo(x - u * 0.125, y - u * 0.41); ctx.lineTo(x + u * 0.125, y - u * 0.41); ctx.lineTo(x + u * 0.155, y - u * 0.27); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - u * 0.095, y - u * 0.55); ctx.lineTo(x - u * 0.07, y - u * 0.66); ctx.lineTo(x + u * 0.07, y - u * 0.66); ctx.lineTo(x + u * 0.095, y - u * 0.55); ctx.fill();
  } else if (o.k === 'phone') {
    const sw = Math.sin(S.t * 5 + o.w) * u * 0.03;
    ctx.fillStyle = '#000'; ctx.globalAlpha = A * 0.5; ctx.beginPath(); ctx.ellipse(x, y, u * 0.3, u * 0.07, 0, 0, 7); ctx.fill(); ctx.globalAlpha = A;
    ctx.fillStyle = '#3a3a3a'; ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = Math.max(1, u * 0.025);
    rr(x - u * 0.17, y - u * 0.62 + sw, u * 0.14, u * 0.62 - sw, u * 0.05); ctx.fill(); ctx.stroke();
    rr(x + u * 0.03, y - u * 0.62 - sw, u * 0.14, u * 0.62 + sw, u * 0.05); ctx.fill(); ctx.stroke();
    rr(x - u * 0.25, y - u * 1.22, u * 0.5, u * 0.68, u * 0.12); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y - u * 1.36, u * 0.17, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = A * 0.16; ctx.beginPath(); ctx.arc(x, y - u * 1.12, u * 0.36, 0, 7); ctx.fill(); ctx.globalAlpha = A;
    rr(x - u * 0.075, y - u * 1.1, u * 0.15, u * 0.24, u * 0.025); ctx.fill();
  } else if (o.k === 'taxi') {
    // minibus taxi, seen from behind
    ctx.fillStyle = '#000'; ctx.globalAlpha = A * 0.5; ctx.beginPath(); ctx.ellipse(x, y, u * 0.46, u * 0.08, 0, 0, 7); ctx.fill(); ctx.globalAlpha = A;
    ctx.fillStyle = '#111'; rr(x - u * 0.36, y - u * 0.16, u * 0.14, u * 0.16, u * 0.03); ctx.fill(); rr(x + u * 0.22, y - u * 0.16, u * 0.14, u * 0.16, u * 0.03); ctx.fill();
    ctx.fillStyle = '#e6e6e6'; ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = Math.max(1, u * 0.02);
    rr(x - u * 0.4, y - u * 0.98, u * 0.8, u * 0.9, u * 0.09); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1b1b1b'; rr(x - u * 0.32, y - u * 0.9, u * 0.64, u * 0.34, u * 0.05); ctx.fill();
    ctx.fillStyle = '#6a6a6a'; ctx.fillRect(x - u * 0.4, y - u * 0.47, u * 0.8, u * 0.045);
    ctx.fillStyle = '#fff'; rr(x - u * 0.37, y - u * 0.36, u * 0.1, u * 0.16, u * 0.02); ctx.fill(); rr(x + u * 0.27, y - u * 0.36, u * 0.1, u * 0.16, u * 0.02); ctx.fill();
    ctx.fillStyle = '#1b1b1b'; rr(x - u * 0.13, y - u * 0.3, u * 0.26, u * 0.1, u * 0.015); ctx.fill();
    ctx.fillStyle = '#3a3a3a'; ctx.fillRect(x - u * 0.42, y - u * 0.12, u * 0.84, u * 0.05);
  } else if (o.k === 'carrot') {
    const s = u * 0.62, by = y - u * 0.7 + Math.sin(S.t * 4 + o.w) * u * 0.05;
    ctx.fillStyle = '#000'; ctx.globalAlpha = A * 0.45; ctx.beginPath(); ctx.ellipse(x, y, s * 0.3, s * 0.08, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.globalAlpha = A * 0.1; ctx.beginPath(); ctx.arc(x, by, s * 0.95, 0, 7); ctx.fill();
    ctx.globalAlpha = A; ctx.save(); ctx.translate(x, by); ctx.rotate(0.35); drawCarrot(0, 0, s); ctx.restore();
  } else if (o.k === 'finish') {
    const l = proj(-LW * 1.75, z), r = proj(LW * 1.75, z), top = y - u * 2.5, bh = u * 0.55;
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 ? '#fff' : '#161616';
      const x0 = l.x + (r.x - l.x) * i / 12; ctx.fillRect(x0, y - u * 0.05, (r.x - l.x) / 12 + 0.5, u * 0.1);
    }
    ctx.strokeStyle = '#d9d9d9'; ctx.lineWidth = Math.max(1.5, u * 0.07);
    ctx.beginPath(); ctx.moveTo(l.x, y); ctx.lineTo(l.x, top); ctx.moveTo(r.x, y); ctx.lineTo(r.x, top); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(l.x, top, r.x - l.x, bh);
    ctx.fillStyle = '#0A0A0A'; ctx.font = '700 ' + (bh * 0.62) + 'px ' + FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('F I N I S H', x, top + bh * 0.54);
  }
  ctx.globalAlpha = 1;
}

function drawPlayer() {
  if (S.inv > 0 && Math.floor(S.inv * 14) % 2) return;
  const u = LW * 0.8, x = W / 2 + S.px, sn = Math.sin(S.phase), bob = Math.abs(Math.cos(S.phase)) * u * 0.05;
  const lean = clamp((S.lane * LW - S.px) / LW, -1, 1) * 0.16, y = GY;
  ctx.fillStyle = '#000'; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.ellipse(x, y + u * 0.02, u * 0.34, u * 0.08, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  if (ART.runner) {
    const im = ART.runner, h = u * 2.05, w = h * im.naturalWidth / im.naturalHeight;
    ctx.save(); ctx.translate(x, y - bob * 1.6); ctx.rotate(lean); if (sn > 0) ctx.scale(-1, 1);
    ctx.shadowColor = 'rgba(255,255,255,.55)'; ctx.shadowBlur = 10;
    ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore();
    return;
  }
  ctx.save(); ctx.translate(x, y - bob); ctx.rotate(lean);
  ctx.fillStyle = '#0A0A0A'; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, u * 0.022); ctx.lineJoin = 'round';
  const part = () => { ctx.fill(); ctx.stroke(); };
  const la = Math.max(0, sn) * u * 0.2, ra = Math.max(0, -sn) * u * 0.2;
  rr(-u * 0.2, -u * 0.56, u * 0.17, u * 0.56 - la, u * 0.07); part();
  rr(u * 0.03, -u * 0.56, u * 0.17, u * 0.56 - ra, u * 0.07); part();
  rr(-u * 0.42, -u * 1.08 + sn * u * 0.05, u * 0.15, u * 0.46, u * 0.07); part();
  rr(u * 0.27, -u * 1.08 - sn * u * 0.05, u * 0.15, u * 0.46, u * 0.07); part();
  ctx.beginPath(); ctx.moveTo(-u * 0.3, -u * 1.12); ctx.quadraticCurveTo(0, -u * 1.2, u * 0.3, -u * 1.12);
  ctx.lineTo(u * 0.27, -u * 0.48); ctx.quadraticCurveTo(0, -u * 0.43, -u * 0.27, -u * 0.48); ctx.closePath(); part();
  for (const sd of [-1, 1]) {
    ctx.save(); ctx.translate(sd * u * 0.1, -u * 1.42); ctx.rotate(sd * (0.2 + sn * 0.07 * sd));
    ctx.beginPath(); ctx.ellipse(0, -u * 0.24, u * 0.065, u * 0.27, 0, 0, 7); part(); ctx.restore();
  }
  ctx.beginPath(); ctx.arc(0, -u * 1.28, u * 0.23, 0, 7); part();
  ctx.restore();
}

function draw() {
  if (!sky) return;
  ctx.save();
  if (S.shake > 0) ctx.translate(rnd(-1, 1) * S.shake * 22, rnd(-1, 1) * S.shake * 22);
  drawWorld();
  for (const d of S.deco) drawDeco(d);
  for (let i = S.objs.length - 1; i >= 0; i--) if (S.objs[i].w - S.dist >= 0) drawObj(S.objs[i]);
  drawPlayer();
  for (let i = S.objs.length - 1; i >= 0; i--) if (S.objs[i].w - S.dist < 0) drawObj(S.objs[i]);
  ctx.restore();
  for (const p of S.pops) {
    ctx.globalAlpha = 1 - p.t / 0.6; ctx.fillStyle = ORANGE; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 22px ' + FONT; ctx.fillText('+1', p.x, p.y - p.t * 60);
  }
  ctx.globalAlpha = 1;
  for (const c of S.confetti) {
    if (c.y > H + 20) continue;
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r); ctx.fillStyle = c.c; ctx.fillRect(-c.s / 2, -c.s / 4, c.s, c.s / 2); ctx.restore();
  }
  if (S.flash > 0) { ctx.globalAlpha = S.flash * 2.2; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}

/* ---------- Loop ---------- */
let last = 0, running = true;
function frame(ts) {
  if (!running) return;
  const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
  update(dt); draw();
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => {
  running = !document.hidden;
  if (running) { last = performance.now(); requestAnimationFrame(frame); }
});
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);

// Test hook for headless checks. Only exists on a local file, never on the live site.
if (location.protocol === 'file:') window.__t = { S, CFG, update, draw, startRun, endRun, revealShow, lockIn, route, showClosed, P: () => P, setP: v => { P = v; store.set(P); } };

resize();
buildForm();
paintStart();
$('hud').classList.add('hidden');
route();
API.info().then(r => {
  if (!r || !r.ok) return;
  if (r.now > 0) skew = r.now - Date.now();
  if (CFG.api && r.opens > 0) OPENS = r.opens;
  if (CFG.api && r.closes > 0) CLOSES = r.closes;
  if (r.left >= 0) spotsLeft = Math.floor(r.left);
  if (!document.activeElement || !/^(INPUT)$/.test(document.activeElement.tagName)) route(); else paintSpots();
}).catch(() => {});
if (CFG.api) for (const n of document.querySelectorAll('.testnote')) n.classList.add('hidden');
requestAnimationFrame(frame);
})();

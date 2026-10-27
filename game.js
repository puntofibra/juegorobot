/* =========================================================
   LUCASBOT 5G · Futurmovil  —  juego de vuelo neón
   ========================================================= */
'use strict';
const CFG = {
  API: 'https://script.google.com/macros/s/AKfycbz-jBZwrOqy0Lz7Ln49xJAnjGpg8UPaGiF680tAHkLQnQDG75Y77mFFylLvtGhEXAu3/exec',
  GOOGLE: '454055120059-nuhaop4r62urc3u036cc3grpqo71ulg7.apps.googleusercontent.com',         // ID de cliente OAuth para «Entrar con Google»
  URL: 'https://puntofibra.github.io/juegorobot/',
  SAL: 'lucas5g-fm'
};

/* ---------- utilidades ---------- */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
function store(k, v) { try { localStorage.setItem('lucas5g_' + k, JSON.stringify(v)); } catch (e) {} }
function load(k, d) { try { const v = localStorage.getItem('lucas5g_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
function hex2rgb(h) { if (h.startsWith('rgb')) return h.match(/\d+/g).slice(0, 3).map(Number); h = h.replace('#', ''); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
function mixHex(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return 'rgb(' + A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',') + ')'; }
function rgba(h, a) { const c = hex2rgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
function uuid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }); }
function firma(str) { let h = 5381; str = CFG.SAL + '|' + str; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
const DEV = load('dev', null) || (() => { const d = uuid(); store('dev', d); return d; })();
const vib = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

/* =========================================================
   AUDIO (síntesis Web Audio, sin archivos)
   ========================================================= */
const Audio5 = (() => {
  let ac = null, master, sfx, mus, comp, noiseBuf, thrG, thrF, musFilter;
  let snd = load('snd', true), musOn = load('mus', true);
  let step = 0, nextT = 0, timer = null, intensity = 0;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ac = new AC();
    comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master = ac.createGain(); master.gain.value = snd ? 0.9 : 0;
    comp.connect(master); master.connect(ac.destination);
    sfx = ac.createGain(); sfx.gain.value = 0.75; sfx.connect(comp);
    musFilter = ac.createBiquadFilter(); musFilter.type = 'lowpass'; musFilter.frequency.value = 2400;
    mus = ac.createGain(); mus.gain.value = musOn ? 0.32 : 0; mus.connect(musFilter); musFilter.connect(comp);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // propulsor continuo
    const n = ac.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    thrF = ac.createBiquadFilter(); thrF.type = 'bandpass'; thrF.frequency.value = 500; thrF.Q.value = 0.8;
    thrG = ac.createGain(); thrG.gain.value = 0;
    n.connect(thrF); thrF.connect(thrG); thrG.connect(sfx); n.start();
    nextT = ac.currentTime + 0.1;
    timer = setInterval(sched, 25);
  }
  function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  function tone(f, dur, type = 'sine', vol = .25, slide = 0, delay = 0, dest) {
    if (!ac) return; const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
    env(g, t, 0.006, vol, dur); o.connect(g); g.connect(dest || sfx); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, f1, f2, type = 'lowpass', delay = 0, dest) {
    if (!ac) return; const t = ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f1, t); f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ac.createGain(); env(g, t, 0.004, vol, dur);
    s.connect(f); f.connect(g); g.connect(dest || sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  // ---- música synthwave (Am F C G) ----
  const prog = [[45, [57, 60, 64, 69]], [41, [53, 57, 60, 65]], [48, [55, 60, 64, 67]], [43, [55, 59, 62, 67]]];
  const BPM = 112, S16 = 60 / BPM / 4;
  let musMode = 'menu';
  function sched() {
    if (!ac) return;
    while (nextT < ac.currentTime + 0.12) { playStep(step, nextT); nextT += S16; step = (step + 1) % 256; }
  }
  function playStep(s, t) {
    if (!musOn || !snd) return;
    const bar = Math.floor(s / 16) % 4, st = s % 16, ch = prog[bar];
    const dly = t - ac.currentTime;
    // bajo en corcheas
    if (st % 2 === 0) tone(mtof(ch[0] + (st % 8 === 4 ? 12 : 0)), S16 * 1.6, 'sawtooth', 0.16, 0, dly, mus);
    // arpegio
    if (musMode === 'game' || st % 2 === 0) tone(mtof(ch[1][st % 4] + 12), S16 * 0.9, 'square', 0.045, 0, dly, mus);
    // pad al inicio del compás
    if (st === 0) ch[1].forEach(m => tone(mtof(m), S16 * 15, 'triangle', 0.035, 0, dly, mus));
    if (musMode === 'game') {
      if (st % 4 === 0) { tone(150, 0.22, 'sine', 0.55, 0.3, dly, mus); }         // bombo
      if (st % 8 === 4) noise(0.16, 0.28, 3000, 900, 'bandpass', dly, mus);       // caja
      if (st % 2 === 1) noise(0.04, 0.08 + intensity * 0.06, 9000, 7000, 'highpass', dly, mus); // charles
    }
  }
  return {
    init,
    get snd() { return snd; }, get mus() { return musOn; },
    toggleSnd() { snd = !snd; store('snd', snd); if (master) master.gain.setTargetAtTime(snd ? 0.9 : 0, ac.currentTime, 0.05); return snd; },
    toggleMus() { musOn = !musOn; store('mus', musOn); if (mus) mus.gain.setTargetAtTime(musOn ? 0.32 : 0, ac.currentTime, 0.1); return musOn; },
    mode(m) { musMode = m; },
    setIntensity(v) { intensity = v; if (musFilter) musFilter.frequency.setTargetAtTime(2400 + v * 5000, ac.currentTime, 0.2); },
    thrust(on, turbo) {
      if (!thrG) return; const t = ac.currentTime;
      thrG.gain.setTargetAtTime(on ? (turbo ? 0.22 : 0.14) : 0.02, t, 0.05);
      thrF.frequency.setTargetAtTime(on ? (turbo ? 1400 : 800) : 350, t, 0.08);
    },
    thrustOff() { if (thrG) thrG.gain.setTargetAtTime(0, ac.currentTime, 0.05); },
    coin(c) { const f = 880 * Math.pow(2, Math.min(c, 24) / 24); tone(f, 0.09, 'square', 0.07); tone(f * 1.5, 0.12, 'sine', 0.09, 0, 0.04); },
    power() { tone(300, 0.35, 'sawtooth', 0.12, 4); tone(600, 0.35, 'square', 0.06, 3, 0.05); noise(0.3, 0.12, 800, 8000, 'bandpass'); },
    shieldBreak() { noise(0.35, 0.3, 6000, 300, 'bandpass'); tone(900, 0.3, 'triangle', 0.15, 0.3); },
    smash() { noise(0.25, 0.35, 2500, 200); tone(220, 0.2, 'square', 0.12, 0.4); },
    boom() { noise(0.9, 0.7, 1800, 60); tone(110, 0.8, 'sine', 0.7, 0.25); tone(55, 1, 'sawtooth', 0.2, 0.5); },
    skid(v) { noise(0.12, 0.10 * v + .02, 1800, 700, 'bandpass'); },
    near() { noise(0.25, 0.18, 400, 4000, 'bandpass'); tone(1200, 0.15, 'sine', 0.08, 1.6); },
    click() { tone(1400, 0.05, 'square', 0.06); },
    beep(hi) { tone(hi ? 1320 : 660, hi ? 0.4 : 0.15, 'square', 0.1); },
    warn() { tone(1000, 0.08, 'square', 0.07); tone(1000, 0.08, 'square', 0.07, 0, 0.12); },
    launch() { noise(0.6, 0.25, 300, 5000, 'bandpass'); tone(200, 0.5, 'sawtooth', 0.08, 3); },
    zone() { [0, 4, 7, 12].forEach((n, i) => tone(mtof(69 + n), 0.25, 'square', 0.07, 0, i * 0.08)); },
    record() { [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => tone(mtof(72 + n), 0.3, 'square', 0.08, 0, i * 0.07)); }
  };
})();

/* =========================================================
   CANVAS Y RECURSOS
   ========================================================= */
const cv = $('#cv'), ctx = cv.getContext('2d');
let DPR = 1, VW = 0, VH = 0, S = 1, W = 1280, H = 720, GROUND = 650, CEIL = 46, PX = 300;
const IMG = {};
const IMG_LIST = ['caido', 'luna', 'altos', 'altos-luz', 'bajos', 'bajos-luz', 'capa', 'superlucas', 'vuela', 'saluda', 'celebra', 'duda', 'senala', 'mando', 'switch', 'telefono', 'portatil', 'halloween', 'navidad', 'piscina'];

function loadImages(cb) {
  let n = 0;
  IMG_LIST.forEach(k => {
    const im = new Image();
    im.onload = im.onerror = () => { n++; $('#cargaBar').style.width = (n / IMG_LIST.length * 100) + '%'; if (n === IMG_LIST.length) cb(); };
    im.src = 'img/' + k + '.webp'; IMG[k] = im;
  });
}

function off(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; return c; }
const glowCache = {};
function glowSpr(col) {
  if (glowCache[col]) return glowCache[col];
  const c = off(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.22, col); gr.addColorStop(0.5, rgba(col, 0.35)); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return glowCache[col] = c;
}

/* ---- paletas por zona ---- */
const ZONAS = [
  { n: 'BARRIO NEÓN', a: '#19ff6a', b: '#00e5ff', top: '#02030a', bot: '#0a1f2a', sun1: '#19ff6a', sun2: '#00e5ff' },
  { n: 'AUTOPISTA 5G', a: '#00e5ff', b: '#ff2bd6', top: '#03021a', bot: '#1d0b3a', sun1: '#00e5ff', sun2: '#ff2bd6' },
  { n: 'NÚCLEO DE FIBRA', a: '#ff2bd6', b: '#ffd23f', top: '#0e0210', bot: '#2e0a26', sun1: '#ffd23f', sun2: '#ff2bd6' },
  { n: 'SERVIDOR CENTRAL', a: '#ffd23f', b: '#19ff6a', top: '#0b0702', bot: '#2a1a05', sun1: '#ffd23f', sun2: '#ff6a2b' }
];
let zona = 0, layers = null, prevLayers = null, layerFade = 1;
let skyTop = ZONAS[0].top, skyBot = ZONAS[0].bot, skyFrom = null, skyT = 1;
const TILE = 1400;
const LETREROS = ['FUTURMOVIL', '5G', 'FIBRA 1GB', 'PUNTOFIBRA', 'LUCAS', 'WIFI', 'TV+FÚTBOL', 'ONLINE', '24H', 'DATOS'];


function artLayer(name, h, z, R) {
  const im = IMG[name], gl = IMG[name + '-luz'];
  if (!im || !im.complete || !im.naturalWidth) return null;
  const w = h * im.naturalWidth / im.naturalHeight, p = ZONAS[z];
  const c = off(w * R, h * R), g = c.getContext('2d');
  g.drawImage(im, 0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-atop';
  if (name === 'altos') { g.fillStyle = 'rgba(4,7,16,.28)'; g.fillRect(0, 0, c.width, c.height); }
  if (z > 0) { g.fillStyle = rgba(p.a, .1); g.fillRect(0, 0, c.width, c.height); }
  // borde superior iluminado por el color de la zona
  let lc = null;
  if (gl && gl.complete && gl.naturalWidth) {
    lc = off(w * R, h * R); const lg = lc.getContext('2d');
    lg.drawImage(gl, 0, 0, lc.width, lc.height);
    if (z > 0) { lg.globalCompositeOperation = 'source-atop'; lg.fillStyle = rgba(p.a, .85); lg.fillRect(0, 0, lc.width, lc.height); }
  }
  return { c, lc, w, h };
}
function drawArt(Lr, par, t, glowA) {
  if (!Lr) return;
  const o = -((camX * par) % Lr.w), y = GROUND - Lr.h;
  for (let x = o; x < W; x += Lr.w) ctx.drawImage(Lr.c, x, y, Lr.w + 1, Lr.h);
  if (Lr.lc) {
    const a0 = ctx.globalAlpha; ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a0 * glowA * (.8 + .2 * Math.sin(t * 2.2) + Math.random() * .04);
    for (let x = o; x < W; x += Lr.w) ctx.drawImage(Lr.lc, x, y, Lr.w + 1, Lr.h);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a0;
  }
}
function buildLayers(z) {
  const p = ZONAS[z], R = S * DPR;
  const L = { z };
  // sol
  const sr = Math.min(H * 0.17, 170), sc = off(sr * 2.6 * R, sr * 2.6 * R), sg = sc.getContext('2d');
  sg.scale(R, R); const cx = sr * 1.3, cy = sr * 1.3;
  let gr = sg.createRadialGradient(cx, cy, sr * 0.6, cx, cy, sr * 1.3); gr.addColorStop(0, rgba(p.sun2, .35)); gr.addColorStop(1, 'rgba(0,0,0,0)');
  sg.fillStyle = gr; sg.fillRect(0, 0, sr * 2.6, sr * 2.6);
  gr = sg.createLinearGradient(0, cy - sr, 0, cy + sr); gr.addColorStop(0, p.sun1); gr.addColorStop(1, p.sun2);
  sg.fillStyle = gr; sg.beginPath(); sg.arc(cx, cy, sr, 0, TAU); sg.fill();
  sg.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 9; i++) { const y = cy + sr * 0.05 + i * i * sr * 0.012 + i * sr * 0.06; sg.fillRect(0, y, sr * 2.6, 2 + i * 1.3); }
  L.sun = sc; L.sunR = sr;
  // capa lejana
  const fc = off(TILE * R, GROUND * R), fg = fc.getContext('2d'); fg.scale(R, R);
  let x = 0;
  while (x < TILE) {
    let w = rnd(50, 120); if (x + w > TILE - 40) w = TILE - x;
    const h = rnd(H * 0.1, H * 0.4), y = GROUND - h;
    fg.fillStyle = '#080c1a'; fg.fillRect(x, y, w - 2, h);
    fg.fillStyle = rgba(p.a, 0.18); fg.fillRect(x, y, w - 2, 1.5);
    for (let wy = y + 8; wy < GROUND - 8; wy += 11) for (let wx = x + 6; wx < x + w - 8; wx += 9)
      if (Math.random() < 0.22) { fg.fillStyle = rgba(Math.random() < .7 ? p.b : p.a, rnd(.1, .4)); fg.fillRect(wx, wy, 4, 5); }
    x += w;
  }
  L.far = fc;
  // capas de ilustración: altos detrás, bajos delante
  L.ant = [];
  L.altos = artLayer('altos', GROUND * 0.6, z, R);
  L.bajos = artLayer('bajos', GROUND * 0.27, z, R);
  return L;
}

/* ---- estrellas ---- */
let stars = [];
function makeStars() { stars = []; for (let i = 0; i < 90; i++) stars.push({ x: Math.random() * W, y: Math.random() * GROUND * 0.7, s: rnd(.5, 1.8), t: Math.random() * TAU }); }

/* ---- sprites cacheados ---- */
let coinSpr = null, ICONS = {};
function buildSprites() {
  const R = 2, c = off(64 * R, 64 * R), g = c.getContext('2d'); g.scale(R, R);
  g.drawImage(glowSpr('#19ff6a'), 0, 0, 64, 64);
  const hexP = (r) => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } g.closePath(); };
  hexP(15); let gr = g.createLinearGradient(0, 17, 0, 47); gr.addColorStop(0, '#d9ffe8'); gr.addColorStop(.5, '#19ff6a'); gr.addColorStop(1, '#07a843');
  g.fillStyle = gr; g.fill(); g.strokeStyle = '#eafff2'; g.lineWidth = 1.5; g.stroke();
  hexP(8); g.fillStyle = 'rgba(0,60,25,.55)'; g.fill();
  g.fillStyle = '#fff'; g.font = '900 8px Orbitron, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('G', 32, 32.5);
  coinSpr = c;
  ['escudo', 'iman', 'turbo', 'x2'].forEach(t => { const ic = off(96, 96), ig = ic.getContext('2d'); ig.translate(48, 48); drawIcon(ig, t, 34); ICONS[t] = ic; });
}
const PW = {
  escudo: { col: '#00e5ff', nom: 'Escudo', desc: 'aguanta un golpe' },
  iman: { col: '#b14bff', nom: 'Imán', desc: 'atrae los datos' },
  turbo: { col: '#ffd23f', nom: 'Turbo 5G', desc: 'velocidad y arrasa todo' },
  x2: { col: '#ff2bd6', nom: 'x2', desc: 'puntos dobles' }
};
function drawIcon(g, t, s) {
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
  const col = PW[t].col; g.shadowColor = col; g.shadowBlur = 10; g.fillStyle = '#fff'; g.strokeStyle = '#fff';
  if (t === 'escudo') {
    g.beginPath(); g.moveTo(0, -s * .55); g.lineTo(s * .45, -s * .35); g.quadraticCurveTo(s * .42, s * .3, 0, s * .58); g.quadraticCurveTo(-s * .42, s * .3, -s * .45, -s * .35); g.closePath();
    g.lineWidth = s * .1; g.stroke(); g.fillStyle = rgba(col, .6); g.fill();
  } else if (t === 'iman') {
    g.lineWidth = s * .22; g.strokeStyle = col; g.beginPath(); g.arc(0, 0, s * .32, Math.PI, 0, true); g.stroke();
    g.beginPath(); g.moveTo(-s * .32, 0); g.lineTo(-s * .32, -s * .35); g.moveTo(s * .32, 0); g.lineTo(s * .32, -s * .35); g.stroke();
    g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(-s * .32, -s * .28); g.lineTo(-s * .32, -s * .42); g.moveTo(s * .32, -s * .28); g.lineTo(s * .32, -s * .42); g.stroke();
  } else if (t === 'turbo') {
    g.beginPath(); g.moveTo(s * .12, -s * .6); g.lineTo(-s * .32, s * .08); g.lineTo(-s * .02, s * .08); g.lineTo(-s * .14, s * .6); g.lineTo(s * .34, -s * .1); g.lineTo(s * .04, -s * .1); g.closePath();
    g.fillStyle = '#fff'; g.fill(); g.lineWidth = 2; g.strokeStyle = col; g.stroke();
  } else {
    g.font = '900 ' + (s * .62) + 'px Orbitron, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('x2', 0, s * .04);
  }
  g.restore();
}

/* =========================================================
   ESTADO DEL JUEGO
   ========================================================= */
let state = 'load', camX = 0, speed = 0, meters = 0, coins = 0, bonus = 0, combo = 0, comboT = 0, playT = 0;
let timeScale = 1, hitStop = 0, shake = 0, flashA = 0, flashCol = '#fff';
let holding = false, best = load('best', 0);
let spawnX = 0, nextPower = 0, missileT = 0, lastZone = 0;
const L = { y: 360, vy: 0, rot: 0, sx: 1, sy: 1, vis: false, inX: 0, trail: [], dead: false, spin: 0, ground: false };
const pw = { escudo: false, iman: 0, turbo: 0, x2: 0, invul: 0 };
let coinsArr = [], lasers = [], viruses = [], missiles = [], powers = [], parts = [], texts = [], warns = [];

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  VW = window.innerWidth; VH = window.innerHeight;
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  S = VH < 500 && VW > VH ? VH / 600 : Math.min(VH / 720, VW / 520); W = VW / S; H = VH / S;   // móvil en horizontal: más zoom
  GROUND = H - Math.min(80, H * 0.1); CEIL = 46; PX = clamp(W * (W < 700 ? 0.27 : 0.24), 125, 340);
  layers = buildLayers(zona); prevLayers = null; layerFade = 1; makeStars();
}

const top_ = () => CEIL + 52, bot_ = () => GROUND - 50;
/* Lucas volando (superlucas): tamaño en pantalla y zonas de choque */
const DH = 118, DW = DH * 640 / 456;                            // Lucas caído
const LH = 100, LW = LH * 720 / 361, AX = 0.62, AY = 0.60;     // ancla = centro del cuerpo
const HITC = [[20, -20, 27], [-10, 14, 26], [64, 0, 11]];
const NOZZ = [[.295, .76, 1], [.33, .855, .9]];                   // toberas (x, y relativos a la imagen, escala)
const FLAME_ANG = Math.PI + 0.14;                                // hacia atrás y un poco abajo     // cabeza, cuerpo, puño [dx, dy, r]
function lucasCircles() {
  const cs = Math.cos(L.rot), sn = Math.sin(L.rot), x = camX + PX, y = L.y;
  return HITC.map(([dx, dy, r]) => [x + dx * cs - dy * sn, y + dx * sn + dy * cs, r]);
}
function nearest(fn) { let m = 1e9; for (const c of lucasCircles()) m = Math.min(m, fn(c[0], c[1]) - c[2]); return m; }

/* ---------- partículas ---------- */
function emit(o) { if (parts.length > 650) parts.splice(0, 40); o.max = o.life; parts.push(o); }
function P(x, y, vx, vy, life, size, col, type = 'glow', extra) { emit(Object.assign({ x, y, vx, vy, life, size, col, type, drag: 0, grav: 0, rot: 0, vr: 0 }, extra)); }
function burst(x, y, col, n = 30, sp = 500) {
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = rnd(sp * .2, sp); P(x, y, Math.cos(a) * v, Math.sin(a) * v, rnd(.3, .8), rnd(6, 16), col, 'glow', { drag: 3 }); }
  for (let i = 0; i < n * .6; i++) { const a = Math.random() * TAU, v = rnd(sp * .5, sp * 1.4); P(x, y, Math.cos(a) * v, Math.sin(a) * v, rnd(.2, .5), rnd(1.5, 3), '#ffffff', 'spark', { drag: 2 }); }
  P(x, y, 0, 0, .45, 20, col, 'ring', { grow: 160 });
}
function floatText(txt, x, y, col = '#fff', size = 22) { texts.push({ txt, x, y, col, size, life: 1, max: 1 }); }

/* ---------- objetos ---------- */
function addCoin(x, y) { coinsArr.push({ x, y, ph: Math.random() * TAU }); }
function addLaser(x, y, len, ang, rs = 0) { lasers.push({ x, y, len, ang, rs, min: 1e9, done: false, ph: Math.random() * 10 }); }
function addVirus(x, y) { viruses.push({ x, y0: y, y, ph: Math.random() * TAU, amp: rnd(30, 90), sp: rnd(1.5, 3), rot: 0 }); }
function addPower(x, y, t) { powers.push({ x, y0: y, y, t, ph: 0 }); }

function difficulty() { return clamp(meters / 3000, 0, 1); }
function spawnChunk() {
  const d = difficulty(), top = top_(), bot = bot_(), span = bot - top, mid = (top + bot) / 2;
  let x = spawnX, w = 0;
  const r = Math.random();
  const opts = [];
  opts.push(['coins', 1.2 - d * .5]);
  opts.push(['laser', 1.1]);
  if (meters > 120) opts.push(['laser2', .6 + d]);
  if (meters > 250) opts.push(['rot', .4 + d * .8]);
  if (meters > 200) opts.push(['virus', .5 + d * .8]);
  if (meters > 400) opts.push(['tunnel', .3 + d * .6]);
  const tot = opts.reduce((s, o) => s + o[1], 0); let q = r * tot, kind = opts[0][0];
  for (const o of opts) { q -= o[1]; if (q <= 0) { kind = o[0]; break; } }

  if (camX + W > nextPower && kind !== 'tunnel') {
    nextPower = camX + W + rnd(2200, 3400);
    const types = ['escudo', 'iman', 'turbo', 'x2'];
    addPower(x + 40, rnd(top + 30, bot - 30), pick(types)); x += 160;
  }

  if (kind === 'coins') {
    const t = ri(0, 2);
    if (t === 0) { const n = ri(7, 12), y = rnd(top, bot); for (let i = 0; i < n; i++) addCoin(x + i * 44, y); w = n * 44; }
    else if (t === 1) { const n = ri(10, 16), y0 = rnd(top + 90, bot - 90), amp = rnd(50, 110); for (let i = 0; i < n; i++) addCoin(x + i * 42, y0 + Math.sin(i * .5) * amp); w = n * 42; }
    else { const rows = ri(3, 4), cols = ri(5, 8), y0 = rnd(top, bot - rows * 40); for (let a = 0; a < rows; a++) for (let b = 0; b < cols; b++) addCoin(x + b * 40, y0 + a * 40); w = cols * 40; }
  } else if (kind === 'laser') {
    const ang = pick([Math.PI / 2, Math.PI / 2, Math.PI / 4, -Math.PI / 4, 0]);
    const len = ang === 0 ? rnd(160, 260) : span * rnd(.32, .5);
    const hy = Math.abs(Math.sin(ang)) * len / 2;
    const y = rnd(top - 20 + hy, bot + 20 - hy);
    addLaser(x + len * Math.abs(Math.cos(ang)) / 2 + 20, y, len, ang);
    // datos de premio por el lado libre
    const free = y > mid ? rnd(top, y - hy - 60) : rnd(y + hy + 60, bot);
    if (Math.random() < .7) for (let i = 0; i < 5; i++) addCoin(x + i * 40, clamp(free, top, bot));
    w = Math.max(len * Math.abs(Math.cos(ang)) + 40, 200);
  } else if (kind === 'laser2') {
    const len = span * rnd(.42, .55), gap = rnd(260, 360);
    addLaser(x + 20, top - 30 + len / 2, len, Math.PI / 2);
    addLaser(x + 20 + gap, bot + 30 - len / 2, len, Math.PI / 2);
    for (let i = 0; i < 6; i++) addCoin(x + 20 + gap * (i / 5), lerp(bot - 20, top + 20, i / 5));
    w = gap + 60;
  } else if (kind === 'rot') {
    const len = span * rnd(.36, .46), y = mid + rnd(-span * .12, span * .12);
    addLaser(x + len / 2 + 20, y, len, Math.random() * Math.PI, (Math.random() < .5 ? -1 : 1) * rnd(1.1, 1.6 + d));
    w = len + 80;
  } else if (kind === 'virus') {
    const n = ri(2, 3 + Math.round(d * 2));
    for (let i = 0; i < n; i++) addVirus(x + i * rnd(150, 230), rnd(top + 30, bot - 30));
    w = n * 200;
  } else if (kind === 'tunnel') {
    const len = rnd(420, 620), gapH = rnd(190, 240) - d * 30, yc = rnd(top + gapH / 2 + 30, bot - gapH / 2 - 30);
    addLaser(x + len / 2, yc - gapH / 2, len, 0);
    addLaser(x + len / 2, yc + gapH / 2, len, 0);
    for (let i = 0; i < len / 44; i++) addCoin(x + 20 + i * 44, yc);
    w = len;
  }
  spawnX = x + w + lerp(430, 250, d) + rnd(0, 140);
}

/* ---------- partida ---------- */
function resetGame() {
  camX = 0; speed = 0; meters = 0; coins = 0; bonus = 0; combo = 0; comboT = 0; playT = 0;
  timeScale = 1; hitStop = 0; shake = 0; holding = false;
  coinsArr = []; lasers = []; viruses = []; missiles = []; powers = []; parts = []; texts = []; warns = [];
  Object.assign(pw, { escudo: false, iman: 0, turbo: 0, x2: 0, invul: 0 });
  Object.assign(L, { y: (top_() + bot_()) / 2, vy: 0, rot: 0, sx: 1, sy: 1, vis: true, inX: -200, trail: [], dead: false, spin: 0, skid: [], dx: 0, dvx: 0 });
  spawnX = W + 500; nextPower = 2400; missileT = 9; lastZone = 0;
  if (zona !== 0) setZone(0, true);
  updHud(true);
}
function setZone(z, instant) {
  zona = z; prevLayers = instant ? null : layers; layers = buildLayers(z); layerFade = instant ? 1 : 0;
  skyFrom = [skyTop, skyBot]; skyT = instant ? 1 : 0;
  if (instant) { skyTop = ZONAS[z].top; skyBot = ZONAS[z].bot; }
}
function baseSpeed() { return 430 + 520 * (1 - Math.exp(-meters / 2600)); }

/* ---------- colisiones ---------- */
function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy; let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
  t = clamp(t, 0, 1); const cx = x1 + t * dx, cy = y1 + t * dy; return Math.hypot(px - cx, py - cy);
}
function laserEnds(l) { const c = Math.cos(l.ang) * l.len / 2, s = Math.sin(l.ang) * l.len / 2; return [l.x - c, l.y - s, l.x + c, l.y + s]; }

function hit(srcX, srcY, kill) {
  if (pw.turbo > 0) { kill && kill(); smashFx(srcX, srcY); return; }
  if (pw.invul > 0) return;
  if (pw.escudo) {
    pw.escudo = false; pw.invul = 1.3; kill && kill();
    Audio5.shieldBreak(); vib(60); shake = 14; flash('#00e5ff', .35); hitStop = .06;
    const px = camX + PX, py = L.y;
    for (let i = 0; i < 26; i++) { const a = i / 26 * TAU; P(px + Math.cos(a) * 70, py + Math.sin(a) * 70, Math.cos(a) * 380, Math.sin(a) * 380, .5, 3, '#00e5ff', 'spark', { drag: 2 }); }
    floatText('¡ESCUDO ROTO!', PX, L.y - 80, '#00e5ff', 22);
    updPwHud(); return;
  }
  die();
}
function smashFx(x, y) {
  burst(x, y, '#ffd23f', 24, 520); Audio5.smash(); shake = Math.max(shake, 8); bonus += 50 * (pw.x2 > 0 ? 2 : 1);
  floatText('+' + (50 * (pw.x2 > 0 ? 2 : 1)), x - camX, y - 30, '#ffd23f', 24);
}
function die() {
  if (L.dead) return;
  L.dead = true; state = 'dying'; dieT = 0; hitStop = .14; shake = 26; flash('#ffffff', .8);
  Audio5.boom(); Audio5.thrustOff(); vib([80, 40, 160]);
  const px = camX + PX;
  burst(px, L.y, '#ff2b4e', 46, 700); burst(px, L.y, '#19ff6a', 30, 420);
  for (let i = 0; i < 18; i++) P(px, L.y, rnd(-300, 300), rnd(-500, -100), rnd(.8, 1.6), rnd(3, 7), '#9aa7b8', 'debris', { grav: 1400, vr: rnd(-12, 12), drag: .5 });
  L.vy = -420; L.dx = 0; L.dvx = 260; L.landed = false; L.swapT = 0; L.rot = 0; L.sx = L.sy = 1; $('#btnPausa').classList.add('oculto'); pw.iman = pw.x2 = pw.turbo = 0; pw.escudo = false; updPwHud(); combo = 0; updCombo();
}
let dieT = 0;

/* ---------- efectos de pantalla ---------- */
function flash(col, a) { flashCol = col; flashA = Math.max(flashA, a); }

/* =========================================================
   UPDATE
   ========================================================= */
function update(dt) {
  const rdt = dt;
  if (hitStop > 0) { hitStop -= dt; dt = 0; }
  dt *= timeScale;
  const t = performance.now() / 1000;

  // cielo / transición de zona
  if (skyT < 1) { skyT = Math.min(1, skyT + rdt / 1.6); skyTop = mixHex(skyFrom[0], ZONAS[zona].top, skyT); skyBot = mixHex(skyFrom[1], ZONAS[zona].bot, skyT); if (skyT >= 1) { skyTop = ZONAS[zona].top; skyBot = ZONAS[zona].bot; } }
  if (layerFade < 1) { layerFade = Math.min(1, layerFade + rdt / 1.6); if (layerFade >= 1) prevLayers = null; }

  if (state === 'menu' || state === 'load') { camX += 140 * rdt; updParts(rdt); return; }
  if (state === 'pause') return;

  // velocidad
  if (state === 'play' || state === 'count') {
    const target = state === 'count' ? 260 : baseSpeed() * (pw.turbo > 0 ? 2.2 : 1);
    speed = lerp(speed, target, Math.min(1, dt * (pw.turbo > 0 ? 4 : 1.6)));
  } else if (state === 'dying') speed = lerp(speed, 0, Math.min(1, dt * 1.6));
  camX += speed * dt;
  if (state === 'play') { meters += speed * dt / 40; playT += dt; }

  // zonas
  const zn = Math.floor(meters / 800);
  if (state === 'play' && zn !== lastZone) { lastZone = zn; setZone(zn % ZONAS.length); showBanner('ZONA ' + (zn + 1), ZONAS[zn % ZONAS.length].n, ZONAS[zn % ZONAS.length].a); Audio5.zone(); }
  Audio5.setIntensity(clamp(meters / 3000, 0, 1) + (pw.turbo > 0 ? .5 : 0));

  // Lucas
  updLucas(dt, rdt);

  if (state === 'play') {
    while (spawnX < camX + W + 300) spawnChunk();
    // misiles
    if (meters > 350) {
      missileT -= dt;
      if (missileT <= 0) { warns.push({ y: L.y, t: 1.35 }); missileT = rnd(7, 13) - difficulty() * 4; if (difficulty() > .5 && Math.random() < .4) warns.push({ y: L.y + rnd(-150, 150), t: 1.7 }); }
    }
    // combo
    if (comboT > 0) { comboT -= dt; if (comboT <= 0) { combo = 0; updCombo(); } }
    // power-ups
    if (pw.iman > 0) pw.iman -= dt;
    if (pw.x2 > 0) pw.x2 -= dt;
    if (pw.turbo > 0) { pw.turbo -= dt; if (pw.turbo <= 0) { pw.invul = 1.2; flash('#ffd23f', .25); } }
    if (pw.invul > 0) pw.invul -= dt;
    updPwHud();
  }

  const px = camX + PX, py = L.y, R = 30;
  // datos
  for (let i = coinsArr.length - 1; i >= 0; i--) {
    const c = coinsArr[i];
    if (c.x < camX - 100) { coinsArr.splice(i, 1); continue; }
    if (state !== 'play') continue;
    let dx = px - c.x, dy = py - c.y, d = Math.hypot(dx, dy);
    if (pw.iman > 0 && d < 330 && c.x < camX + W) { const k = Math.min(1, dt * (900 / Math.max(d, 40))); c.x += dx * k; c.y += dy * k; d = Math.hypot(px - c.x, py - c.y); c.mag = true; }
    if (nearest((x, y) => Math.hypot(x - c.x, y - c.y)) < 18) {
      coinsArr.splice(i, 1); coins++; combo++; comboT = .8;
      const mult = Math.min(5, 1 + Math.floor(combo / 10)) * (pw.x2 > 0 ? 2 : 1);
      bonus += 10 * mult; Audio5.coin(combo);
      for (let k = 0; k < 6; k++) P(c.x, c.y, rnd(-160, 160) + speed * .3, rnd(-160, 160), rnd(.2, .45), rnd(5, 10), '#19ff6a', 'glow', { drag: 4 });
      P(c.x, c.y, 0, 0, .25, 10, '#bfffd6', 'ring', { grow: 70 });
      if (combo % 10 === 0) { floatText('COMBO x' + Math.min(5, 1 + combo / 10), PX + 60, L.y - 70, '#ffd23f', 26); }
      updCombo();
    }
  }
  // láseres
  for (let i = lasers.length - 1; i >= 0; i--) {
    const l = lasers[i]; l.ang += l.rs * dt; l.ph += dt;
    const e = laserEnds(l);
    if (Math.max(e[0], e[2]) < camX - 120) { lasers.splice(i, 1); continue; }
    if (state !== 'play' || l.dead) continue;
    const d = nearest((x, y) => segDist(x, y, e[0], e[1], e[2], e[3]));
    if (d < 4) { hit(px, py, () => { l.dead = true; for (let k = 0; k <= 10; k++) burst(lerp(e[0], e[2], k / 10), lerp(e[1], e[3], k / 10), '#ff2b4e', 4, 260); lasers.splice(i, 1); }); if (L.dead) return; continue; }
    if (Math.abs(px - l.x) < l.len / 2 + 60) l.min = Math.min(l.min, d);
    if (!l.done && Math.max(e[0], e[2]) < px - 70) {
      l.done = true;
      if (l.min < 28 && pw.turbo <= 0) {
        const b = 25 * (pw.x2 > 0 ? 2 : 1); bonus += b; Audio5.near(); floatText('¡POR LOS PELOS! +' + b, PX, L.y - 70, '#00e5ff', 20);
        flash('#00e5ff', .12); hitStop = .035;
      }
    }
  }
  // virus
  for (let i = viruses.length - 1; i >= 0; i--) {
    const v = viruses[i]; v.ph += dt * v.sp; v.rot += dt * 2; v.y = v.y0 + Math.sin(v.ph) * v.amp; v.x -= 70 * dt;
    if (v.x < camX - 100) { viruses.splice(i, 1); continue; }
    if (state !== 'play') continue;
    if (Math.random() < .3) P(v.x + rnd(-10, 10), v.y + rnd(-10, 10), rnd(20, 80), rnd(-30, 30), .4, rnd(4, 8), '#ff2bd6', 'glow');
    if (nearest((x, y) => Math.hypot(x - v.x, y - v.y)) < 21) { hit(v.x, v.y, () => { burst(v.x, v.y, '#ff2bd6', 30, 500); viruses.splice(i, 1); }); if (L.dead) return; }
  }
  // avisos de misil
  for (let i = warns.length - 1; i >= 0; i--) {
    const w = warns[i]; w.t -= dt;
    if (w.t > .35) w.y = lerp(w.y, L.y, Math.min(1, dt * 3));
    if (Math.floor(w.t * 8) !== w.lb) { w.lb = Math.floor(w.t * 8); if (w.t > 0 && w.lb % 2 === 0) Audio5.warn(); }
    if (w.t <= 0) { warns.splice(i, 1); missiles.push({ x: camX + W + 80, y: w.y, v: 950 }); }
  }
  // misiles
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i]; m.x -= m.v * dt;
    for (let k = 0; k < 2; k++) P(m.x + 38, m.y + rnd(-4, 4), rnd(100, 260), rnd(-40, 40), rnd(.2, .45), rnd(8, 14), pick(['#ff8a2b', '#ffd23f', '#ff2b4e']), 'glow', { drag: 2 });
    if (Math.random() < .5) P(m.x + 44, m.y, rnd(60, 160), rnd(-20, 20), rnd(.6, 1), rnd(6, 10), '', 'smoke', { drag: 1.5 });
    if (m.x < camX - 200) { missiles.splice(i, 1); continue; }
    if (state !== 'play') continue;
    if (nearest((x, y) => Math.hypot(x - m.x, y - m.y)) < 12) { hit(m.x, m.y, () => { burst(m.x, m.y, '#ff8a2b', 34, 600); missiles.splice(i, 1); }); if (L.dead) return; }
  }
  // power-ups
  for (let i = powers.length - 1; i >= 0; i--) {
    const p = powers[i]; p.ph += dt; p.y = p.y0 + Math.sin(p.ph * 2.5) * 16;
    if (p.x < camX - 100) { powers.splice(i, 1); continue; }
    if (state !== 'play') continue;
    if (nearest((x, y) => Math.hypot(x - p.x, y - p.y)) < 30) { powers.splice(i, 1); takePower(p.t, p.x, p.y); }
  }
  updParts(dt);
  // texto flotante (tiempo real)
  for (let i = texts.length - 1; i >= 0; i--) { const tx = texts[i]; tx.life -= rdt * .9; tx.y -= 50 * rdt; if (tx.life <= 0) texts.splice(i, 1); }

  if (state === 'dying') { dieT += rdt; timeScale = dieT < .5 ? lerp(.35, 1, dieT * 2) : 1; if (dieT > 2.4) gameOver(); }
  updHud();
}

function takePower(t, x, y) {
  const col = PW[t].col; Audio5.power(); vib(40); flash(col, .3); burst(x, y, col, 36, 520);
  floatText(PW[t].nom.toUpperCase() + '!', PX, L.y - 80, col, 28);
  if (t === 'escudo') pw.escudo = true;
  if (t === 'iman') pw.iman = 9;
  if (t === 'x2') pw.x2 = 10;
  if (t === 'turbo') { pw.turbo = 4.5; shake = 10; }
  updPwHud();
}

function updLucas(dt, rdt) {
  if (!L.vis) return;
  const top = top_(), bot = bot_();
  if (L.inX < 0) L.inX = Math.min(0, L.inX + rdt * 420);
  if (L.dead) {
    L.swapT += rdt;
    const gy = GROUND - DH * .44, wx = camX + PX + L.dx;
    L.vy += 2000 * dt; L.y += L.vy * dt; L.dx += L.dvx * dt;
    if (!L.landed) {
      L.rot = lerp(L.rot, .18, Math.min(1, dt * 6));
      if (L.y >= gy) {                       // impacto con el suelo
        L.y = gy; L.landed = true; L.vy = 0; L.dvx = Math.max(L.dvx, 420); L.sy = .72; L.sx = 1.22;
        shake = 14; hitStop = .05; vib(50); Audio5.smash();
        for (let i = 0; i < 16; i++) P(wx + rnd(-50, 50), GROUND - 6, rnd(-260, 260), rnd(-260, -60), rnd(.6, 1.1), rnd(10, 20), '', 'smoke', { drag: 2 });
        for (let i = 0; i < 10; i++) P(wx + rnd(-30, 30), GROUND - 4, rnd(-150, 350), rnd(-420, -150), rnd(.5, .9), rnd(3, 6), '#7d8698', 'debris', { grav: 1600, vr: rnd(-14, 14) });
      }
    } else {
      L.y = gy; L.rot = lerp(L.rot, -.04 + Math.sin(L.swapT * 22) * .015 * Math.min(1, L.dvx / 300), Math.min(1, dt * 8));
      const prev = L.dvx; L.dvx = Math.max(0, L.dvx - 520 * dt);
      if (L.dvx > 25) {                      // derrape: polvo, chispas y marca en el suelo
        if (Math.random() < .9) P(wx - DW * .28 + rnd(-10, 10), GROUND - 8, rnd(-200, -60) * L.dvx / 420, rnd(-120, -30), rnd(.5, 1), rnd(8, 16) * (.5 + L.dvx / 420), '', 'smoke', { drag: 1.8 });
        if (Math.random() < .8) P(wx + DW * .3 + rnd(-6, 6), GROUND - 4, rnd(-380, -120), rnd(-220, -40), rnd(.25, .45), rnd(1.5, 2.5), pick(['#ffd23f', '#ff8a2b', '#ffffff']), 'spark', { grav: 900, drag: 1 });
        L.skid.push([wx + DW * .3, L.dvx / 420]); if (L.skid.length > 120) L.skid.shift();
        if (Math.floor(L.swapT * 9) !== L.sb) { L.sb = Math.floor(L.swapT * 9); Audio5.skid && Audio5.skid(L.dvx / 420); }
      } else if (prev > 25) { L.sx = 1.08; L.sy = .9; }   // frenazo final
    }
    L.sx = lerp(L.sx, 1, Math.min(1, dt * 7)); L.sy = lerp(L.sy, 1, Math.min(1, dt * 7));
    if (Math.random() < .25) P(wx + rnd(-20, 30), L.y - DH * .3, rnd(-20, 20), rnd(-80, -30), rnd(.8, 1.4), rnd(6, 12), '', 'smoke', { drag: 1 });
    return;
  }
  const thr = (state === 'play' && holding) || (state === 'count' && L.y > (top + bot) / 2 + 10);
  const G = 2350, T = 5300, MAXV = 830;
  if (thr) L.vy -= T * dt;
  L.vy += G * dt; L.vy = clamp(L.vy, -MAXV, MAXV * 1.15);
  L.y += L.vy * dt;
  if (L.y > bot) { if (L.vy > 500) { shake = 4; for (let i = 0; i < 8; i++) P(camX + PX + rnd(-20, 20), bot + 50, rnd(-200, 100), rnd(-200, -40), .4, 2, '#19ff6a', 'spark', { grav: 600 }); } L.y = bot; L.vy = 0; }
  if (L.y < top) { L.y = top; L.vy = Math.max(0, L.vy); }
  const tr = clamp(L.vy / MAXV * .32, -.32, .32);
  L.rot = lerp(L.rot, tr, Math.min(1, dt * 10));
  // squash & stretch
  if (thr && !L.wasThr) { L.sx = .92; L.sy = 1.1; }
  L.wasThr = thr;
  L.sx = lerp(L.sx, 1, Math.min(1, dt * 8)); L.sy = lerp(L.sy, 1, Math.min(1, dt * 8));
  if (state === 'play') Audio5.thrust(thr, pw.turbo > 0);

  // llamas del propulsor (salen hacia atrás, a la izquierda)
  const cs = Math.cos(L.rot), sn = Math.sin(L.rot);
  const turbo = pw.turbo > 0;
  L.fl = lerp(L.fl || .5, turbo ? 1.7 : thr ? 1.15 : .5, Math.min(1, dt * 10));
  NOZZ.forEach(([rx, ry, kk]) => {
    const fl = L.fl * 78 * kk * .55;
    const ox = (rx - AX) * LW + Math.cos(FLAME_ANG) * fl, oy = (ry - AY) * LH + Math.sin(FLAME_ANG) * fl;
    const wx = camX + PX + L.inX + ox * cs - oy * sn, wy = L.y + ox * sn + oy * cs;
    const n = thr ? (turbo ? 2 : 1) : (Math.random() < .5 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const v = thr ? rnd(300, 520) : rnd(120, 220), a = L.rot + FLAME_ANG + rnd(-.25, .25);
      P(wx + rnd(-3, 3), wy + rnd(-3, 3), Math.cos(a) * v, Math.sin(a) * v, thr ? rnd(.18, .32) : rnd(.1, .18), thr ? rnd(7, 12) : rnd(4, 7),
        turbo ? pick(['#ffd23f', '#ffffff', '#19ff6a']) : pick(['#19ff6a', '#19ff6a', '#7dffb0', '#00e5ff']), 'glow', { drag: 2.5 });
    }
    if (thr && Math.random() < .25) P(wx, wy, rnd(-600, -300), rnd(40, 200), .25, 1.5, '#d9ffe8', 'spark', { drag: 1 });
  });
  // estela
  L.trail.unshift({ x: camX + PX + L.inX, y: L.y, r: L.rot }); if (L.trail.length > 8) L.trail.pop();
}

function updParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
    p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
  }
}

/* =========================================================
   RENDER
   ========================================================= */
function render() {
  const t = performance.now() / 1000;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  let sx = 0, sy = 0;
  if (shake > 0) { sx = rnd(-shake, shake); sy = rnd(-shake, shake); shake = Math.max(0, shake - 60 / 60 * 1.2); }
  ctx.setTransform(DPR * S, 0, 0, DPR * S, sx * DPR * S, sy * DPR * S);

  // cielo
  const sk = ctx.createLinearGradient(0, 0, 0, GROUND); sk.addColorStop(0, skyTop); sk.addColorStop(1, skyBot);
  ctx.fillStyle = sk; ctx.fillRect(-30, -30, W + 60, GROUND + 30);
  // estrellas
  for (const s of stars) { const a = .35 + .35 * Math.sin(t * 2 + s.t); ctx.fillStyle = `rgba(255,255,255,${a})`; const x = ((s.x - camX * .02) % W + W) % W; ctx.fillRect(x, s.y, s.s, s.s); }
  // sol
  drawMoon(t);
  drawLayerSet(prevLayers, 1 - layerFade, t); drawLayerSet(layers, prevLayers ? layerFade : 1, t);

  // neblina en el horizonte
  const z = ZONAS[zona];
  const hz = ctx.createLinearGradient(0, GROUND - 160, 0, GROUND); hz.addColorStop(0, 'rgba(0,0,0,0)'); hz.addColorStop(1, rgba(z.a, .16));
  ctx.fillStyle = hz; ctx.fillRect(0, GROUND - 160, W, 160);

  drawFloor(z); drawCeil(z, t);

  ctx.save(); ctx.translate(-camX, 0);
  drawCoins(t); drawPowers(t); drawLasers(t); drawViruses(t); drawMissiles(t);
  drawParts(false);
  ctx.restore();
  drawWarns(t);
  drawLucas(t);
  if (pw.turbo > 0 && state === 'play') drawSpeedLines(t);
  drawTexts();

  if (flashA > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = flashA; ctx.fillStyle = flashCol; ctx.fillRect(0, 0, cv.width, cv.height); ctx.globalAlpha = 1; flashA = Math.max(0, flashA - .05); }
}


/* ---- luna giratoria ---- */
let moonC = null, moonG = null, moonX = null;
function drawMoon(t) {
  const im = IMG.luna; if (!im || !im.complete || !im.naturalWidth) return;
  const mr = Math.min(H * .15, GROUND * .19, 140);          // radio de la esfera
  const size = mr / 0.455;                                   // tamaño total de la imagen (incluye satélites)
  const portrait = W < 700;
  const tx = (state === 'menu' || state === 'load') ? (portrait ? W * .78 : W * .1 + mr) : W * .72;
  moonX = moonX == null ? tx : lerp(moonX, tx, .03);
  const cx = moonX, cy = Math.max(CEIL + mr + 50, GROUND - GROUND * .7);
  const R = S * DPR, ip = Math.ceil(size * R), px = Math.ceil(ip * 1.45), c0 = px / 2, rr = mr * R;   // lienzo 1.45x para que al girar no se corten las esquinas
  if (!moonC || moonC.width !== px) { moonC = off(px, px); moonG = moonC.getContext('2d'); moonG.imageSmoothingQuality = 'high'; }
  const g = moonG;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, px, px);
  g.translate(c0, c0); g.rotate(t * 0.11); g.drawImage(im, -ip / 2, -ip / 2, ip, ip); g.setTransform(1, 0, 0, 1, 0, 0);
  // sombreado fijo (la luz no gira, la luna sí) => sensación de esfera
  g.globalCompositeOperation = 'source-atop';
  const sh = g.createRadialGradient(c0 - rr * .45, c0 - rr * .5, rr * .1, c0, c0, rr * 1.12);
  sh.addColorStop(0, 'rgba(255,255,255,.12)'); sh.addColorStop(.5, 'rgba(10,20,40,.05)'); sh.addColorStop(.82, 'rgba(5,10,25,.45)'); sh.addColorStop(1, 'rgba(3,6,15,.75)');
  g.fillStyle = sh; g.beginPath(); g.arc(c0, c0, rr * 1.03, 0, TAU); g.fill();
  g.fillStyle = 'rgba(8,14,32,.2)'; g.fillRect(0, 0, px, px);
  if (zona > 0) { g.fillStyle = rgba(ZONAS[zona].a, .09); g.fillRect(0, 0, px, px); }
  g.globalCompositeOperation = 'source-over';
  const z = ZONAS[zona], pul = 1 + Math.sin(t * 1.4) * .05;
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .28;
  ctx.drawImage(glowSpr(z.a), cx - mr * 2.3 * pul, cy - mr * 2.3 * pul, mr * 4.6 * pul, mr * 4.6 * pul);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(moonC, cx - size * .725, cy - size * .725, size * 1.45, size * 1.45);
  // borde iluminado
  ctx.globalCompositeOperation = 'lighter';
  const rim = ctx.createLinearGradient(cx - mr, cy - mr, cx + mr, cy + mr); rim.addColorStop(0, rgba(z.a, 0)); rim.addColorStop(.6, rgba(z.a, .15)); rim.addColorStop(1, rgba(z.a, .6));
  ctx.strokeStyle = rim; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, mr * 1.005, 0, TAU); ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
}
function drawLayerSet(Ls, a, t) {
  if (!Ls || a <= 0) return;
  ctx.globalAlpha = a;
  drawArt(Ls.altos, .14, t, .55);
  // neblina entre capas para dar profundidad
  const hz2 = ctx.createLinearGradient(0, GROUND - GROUND * .3, 0, GROUND); hz2.addColorStop(0, 'rgba(5,8,18,0)'); hz2.addColorStop(1, rgba(ZONAS[Ls.z].a, .10));
  ctx.fillStyle = hz2; ctx.fillRect(0, GROUND - GROUND * .3, W, GROUND * .3);
  drawArt(Ls.bajos, .34, t, .8);
  // antenas parpadeantes
  const offM = -((camX * .22) % TILE);
  ctx.globalCompositeOperation = 'lighter';
  for (let x0 = offM; x0 < W; x0 += TILE) for (const an of Ls.ant) {
    const x = x0 + an[0]; if (x < -20 || x > W + 20) continue;
    const b = Math.sin(t * 3 + an[2]) > .2 ? 1 : .15; ctx.globalAlpha = a * b;
    ctx.drawImage(glowSpr('#ff2b4e'), x - 8, an[1] - 8, 16, 16);
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}
function tile(c, par) { const o = -((camX * par) % TILE); for (let x = o; x < W; x += TILE) ctx.drawImage(c, x, 0, TILE + 1, GROUND); }

function drawFloor(z) {
  const fh = H - GROUND;
  const g = ctx.createLinearGradient(0, GROUND, 0, H); g.addColorStop(0, '#060912'); g.addColorStop(1, '#02030a');
  ctx.fillStyle = g; ctx.fillRect(-30, GROUND, W + 60, fh + 30);
  ctx.save(); ctx.beginPath(); ctx.rect(0, GROUND, W, fh + 30); ctx.clip();
  ctx.strokeStyle = rgba(z.a, .35); ctx.lineWidth = 1;
  const vpx = W / 2, vpy = GROUND - 260, sp = 90, off = camX % sp;
  ctx.beginPath();
  for (let i = -30; i <= 30; i++) { const xb = vpx + (i * sp - off) * 3.2; const f = (GROUND - vpy) / (H - vpy); ctx.moveTo(vpx + (xb - vpx) * f, GROUND); ctx.lineTo(xb, H); }
  const ph = (camX / 140) % 1;
  for (let i = 0; i < 9; i++) { const tt = (i + 1 - ph) / 9; const y = GROUND + fh * tt * tt; ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke(); ctx.restore();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rgba(z.a, .9); ctx.fillRect(0, GROUND - 1, W, 2);
  ctx.fillStyle = rgba(z.a, .25); ctx.fillRect(0, GROUND - 4, W, 8);
  ctx.globalCompositeOperation = 'source-over';
}
function drawCeil(z, t) {
  ctx.fillStyle = '#03040a'; ctx.fillRect(-30, -30, W + 60, CEIL + 30);
  ctx.fillStyle = '#0d1424'; ctx.fillRect(0, CEIL - 12, W, 8);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rgba(z.b, .8); ctx.fillRect(0, CEIL - 1, W, 2);
  const sp = 160, o = -(camX % sp);
  for (let x = o; x < W + sp; x += sp) { const on = Math.sin(t * 4 + x * .01) > -.3; ctx.globalAlpha = on ? 1 : .3; ctx.drawImage(glowSpr(z.b), x - 9, CEIL - 17, 18, 18); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

function drawCoins(t) {
  for (const c of coinsArr) {
    if (c.x < camX - 40 || c.x > camX + W + 40) continue;
    const s = Math.cos(t * 4 + c.ph + c.x * .004); const w = Math.max(.15, Math.abs(s));
    ctx.drawImage(coinSpr, c.x - 32 * w, c.y - 32, 64 * w, 64);
  }
}
function drawPowers(t) {
  for (const p of powers) {
    const col = PW[p.t].col;
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSpr(col), p.x - 60, p.y - 60, 120, 120); ctx.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(5,10,20,.85)'; ctx.beginPath(); ctx.arc(0, 0, 28, 0, TAU); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash([10, 7]); ctx.rotate(t * 2); ctx.beginPath(); ctx.arc(0, 0, 31, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.rotate(-t * 2); const sc = 1 + Math.sin(t * 6) * .06; ctx.scale(sc, sc);
    ctx.drawImage(ICONS[p.t], -24, -24, 48, 48);
    ctx.restore();
  }
}
function drawLasers(t) {
  ctx.lineCap = 'round';
  for (const l of lasers) {
    const e = laserEnds(l); if (Math.max(e[0], e[2]) < camX - 40 || Math.min(e[0], e[2]) > camX + W + 40) continue;
    const fl = .85 + Math.random() * .15;
    ctx.globalCompositeOperation = 'lighter';
    [[26, .1], [14, .25], [6, .7]].forEach(([w, a]) => { ctx.strokeStyle = `rgba(255,43,78,${a * fl})`; ctx.lineWidth = w + Math.sin(t * 20 + l.ph) * 1.5; ctx.beginPath(); ctx.moveTo(e[0], e[1]); ctx.lineTo(e[2], e[3]); ctx.stroke(); });
    ctx.strokeStyle = `rgba(255,235,240,${fl})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(e[0], e[1]); ctx.lineTo(e[2], e[3]); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    for (const [x, y] of [[e[0], e[1]], [e[2], e[3]]]) {
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSpr('#ff2b4e'), x - 26, y - 26, 52, 52); ctx.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.translate(x, y); ctx.rotate(l.ang + t * (l.rs ? 0 : 1.5));
      ctx.fillStyle = '#141a2a'; ctx.strokeStyle = '#ff5c7a'; ctx.lineWidth = 2.5;
      ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.lineTo(Math.cos(a) * 13, Math.sin(a) * 13); } ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
      ctx.restore();
    }
    if (l.rs) { ctx.fillStyle = '#ff5c7a'; ctx.beginPath(); ctx.arc(l.x, l.y, 7, 0, TAU); ctx.fill(); }
  }
}
function drawViruses(t) {
  for (const v of viruses) {
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSpr('#ff2bd6'), v.x - 50, v.y - 50, 100, 100); ctx.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.translate(v.x, v.y); ctx.rotate(v.rot);
    ctx.strokeStyle = '#ff7be6'; ctx.lineWidth = 3; ctx.fillStyle = '#ff7be6';
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, r2 = 30 + Math.sin(t * 8 + i) * 3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 18, Math.sin(a) * 18); ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); ctx.stroke(); ctx.beginPath(); ctx.arc(Math.cos(a) * r2, Math.sin(a) * r2, 3.5, 0, TAU); ctx.fill(); }
    const g = ctx.createRadialGradient(-6, -6, 2, 0, 0, 22); g.addColorStop(0, '#ffb8f3'); g.addColorStop(.5, '#d61aa8'); g.addColorStop(1, '#4a0a40');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 21, 0, TAU); ctx.fill();
    ctx.rotate(-v.rot);
    // ojos enfadados
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-7, -2, 5, 6, 0, 0, TAU); ctx.ellipse(7, -2, 5, 6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a0016'; ctx.beginPath(); ctx.arc(-8, -1, 2.5, 0, TAU); ctx.arc(6, -1, 2.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#1a0016'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-13, -10); ctx.lineTo(-3, -6); ctx.moveTo(13, -10); ctx.lineTo(3, -6); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 11, 5, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    ctx.restore();
  }
}
function drawMissiles(t) {
  for (const m of missiles) {
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSpr('#ff8a2b'), m.x + 10, m.y - 30, 70, 60); ctx.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.translate(m.x, m.y);
    const g = ctx.createLinearGradient(0, -9, 0, 9); g.addColorStop(0, '#e8edf5'); g.addColorStop(1, '#6b768a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-30, 0); ctx.quadraticCurveTo(-22, -10, -8, -9); ctx.lineTo(34, -9); ctx.lineTo(34, 9); ctx.lineTo(-8, 9); ctx.quadraticCurveTo(-22, 10, -30, 0); ctx.fill();
    ctx.fillStyle = '#ff2b4e'; ctx.fillRect(-6, -9, 6, 18);
    ctx.beginPath(); ctx.moveTo(24, -9); ctx.lineTo(38, -20); ctx.lineTo(36, -9); ctx.moveTo(24, 9); ctx.lineTo(38, 20); ctx.lineTo(36, 9); ctx.fill();
    ctx.restore();
  }
}
function drawWarns(t) {
  for (const w of warns) {
    const blink = w.t < .35 ? (Math.floor(t * 16) % 2) : (Math.floor(t * 6) % 2);
    const x = W - 46;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,43,78,${.08 + (w.t < .35 ? .2 : 0)})`; ctx.lineWidth = 2; ctx.setLineDash([12, 10]);
    ctx.beginPath(); ctx.moveTo(0, w.y); ctx.lineTo(x - 30, w.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.drawImage(glowSpr('#ff2b4e'), x - 40, w.y - 40, 80, 80);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = blink ? '#ff2b4e' : '#ffd23f';
    ctx.beginPath(); ctx.moveTo(x, w.y - 24); ctx.lineTo(x + 24, w.y + 18); ctx.lineTo(x - 24, w.y + 18); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#100'; ctx.font = '900 24px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', x, w.y + 4);
  }
}
function drawParts() {
  for (const p of parts) {
    const a = clamp(p.life / p.max, 0, 1);
    if (p.type === 'glow') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; const s = p.size * (.4 + a * .6); ctx.drawImage(glowSpr(p.col), p.x - s, p.y - s, s * 2, s * 2); }
    else if (p.type === 'spark') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.strokeStyle = p.col; ctx.lineWidth = p.size; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .035, p.y - p.vy * .035); ctx.stroke(); }
    else if (p.type === 'ring') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.strokeStyle = p.col; ctx.lineWidth = 3 * a + .5; ctx.beginPath(); ctx.arc(p.x, p.y, p.size + (1 - a) * p.grow, 0, TAU); ctx.stroke(); }
    else if (p.type === 'smoke') { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a * .45; ctx.fillStyle = '#2a2f3e'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (2 - a), 0, TAU); ctx.fill(); }
    else if (p.type === 'debris') { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col; ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size); ctx.restore(); }
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

/* ---- llamas del propulsor dibujadas (en coordenadas del sprite) ---- */
function jetFlame(g, x, y, ang, w, L, wob, stops) {
  g.save(); g.translate(x, y); g.rotate(ang);
  const gr = g.createLinearGradient(0, 0, L, 0); stops.forEach(([o, c]) => gr.addColorStop(o, c));
  g.fillStyle = gr; g.beginPath(); g.moveTo(0, -w / 2);
  g.bezierCurveTo(L * .35, -w / 2, L * .7, -w * .2 + wob * .5, L, wob);
  g.bezierCurveTo(L * .7, w * .2 + wob * .5, L * .35, w / 2, 0, w / 2);
  g.closePath(); g.fill(); g.restore();
}
function drawJetFlames(t) {
  const turbo = pw.turbo > 0 && state === 'play', f = L.fl || .5;
  ctx.globalCompositeOperation = 'lighter';
  NOZZ.forEach(([rx, ry, k], i) => {
    const x = (rx - AX) * LW, y = (ry - AY) * LH, w = 17 * k;
    const len = (78 + Math.sin(t * 31 + i * 2) * 6 + Math.sin(t * 47 + i) * 4 + Math.random() * 6) * f * k;
    const wob = (Math.sin(t * 17 + i * 1.7) + Math.sin(t * 33 + i) * .5) * w * .2;
    const mid = turbo ? 'rgba(255,210,63,' : 'rgba(25,255,106,', edge = turbo ? 'rgba(255,140,40,0)' : 'rgba(0,229,255,0)';
    ctx.globalAlpha = .9;
    ctx.drawImage(glowSpr(turbo ? '#ffd23f' : '#19ff6a'), x - len * .9, y - w * 1.6, len * 1.3, w * 3.2);
    ctx.globalAlpha = 1;
    jetFlame(ctx, x, y, FLAME_ANG, w * 1.8, len * 1.3, wob * 1.4, [[0, mid + '.5)'], [.45, mid + '.3)'], [1, edge]]);
    jetFlame(ctx, x, y, FLAME_ANG, w * 1.1, len, wob, [[0, 'rgba(255,255,255,.95)'], [.2, 'rgba(210,255,230,.9)'], [.55, mid + '.75)'], [1, mid + '0)']]);
    jetFlame(ctx, x, y, FLAME_ANG, w * .55, len * .5, wob * .4, [[0, 'rgba(255,255,255,1)'], [.7, 'rgba(240,255,245,.7)'], [1, 'rgba(255,255,255,0)']]);
  });
  ctx.globalCompositeOperation = 'source-over';
}

function drawCaido(t) {
  const x = PX + L.dx, y = L.y, k = clamp(L.swapT / .22, 0, 1);
  // marca de derrape en el suelo
  if (L.skid.length > 1) {
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 1; i < L.skid.length; i++) {
      const a = L.skid[i - 1], b = L.skid[i];
      ctx.strokeStyle = `rgba(255,170,60,${.35 * b[1]})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(a[0] - camX, GROUND - 2); ctx.lineTo(b[0] - camX, GROUND - 2); ctx.stroke();
      ctx.strokeStyle = `rgba(0,0,0,${.45 * b[1]})`; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(a[0] - camX, GROUND + 3); ctx.lineTo(b[0] - camX, GROUND + 3); ctx.stroke();
    }
    ctx.restore();
  }
  // sombra
  const sd = clamp(1 - (GROUND - DH * .44 - y) / 300, .2, 1);
  ctx.fillStyle = `rgba(0,0,0,${.45 * sd})`; ctx.beginPath(); ctx.ellipse(x, GROUND - 2, DW * .42 * sd, 9 * sd, 0, 0, TAU); ctx.fill();
  // transición: el volador desaparece en un destello y aparece el caído con un "pop"
  if (k < 1) {
    const im = IMG.superlucas; ctx.save(); ctx.globalAlpha = 1 - k; ctx.translate(x, y); ctx.scale(1 + k * .3, 1 - k * .2);
    ctx.drawImage(im, -AX * LW, -AY * LH, LW, LH); ctx.restore();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - k) * .9;
    ctx.drawImage(glowSpr('#ffffff'), x - 110, y - 110, 220, 220); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  const pop = k < 1 ? 1.35 - .35 * (1 - Math.pow(1 - k, 3)) : 1;
  ctx.save(); ctx.globalAlpha = k; ctx.translate(x, GROUND); ctx.rotate(L.rot); ctx.scale(L.sx * pop, L.sy * pop);
  ctx.drawImage(IMG.caido, -DW / 2, -(GROUND - y) - DH * .5, DW, DH);
  ctx.restore();
  // estrellitas de mareo girando
  if (L.landed) {
    for (let i = 0; i < 3; i++) {
      const a = t * 3 + i * TAU / 3, sx = x + DW * .15 + Math.cos(a) * 34, sy = y - DH * .52 + Math.sin(a) * 9;
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .7; ctx.drawImage(glowSpr('#ffd23f'), sx - 9, sy - 9, 18, 18);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffe680'; ctx.font = '900 13px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('★', sx, sy);
    }
  }
}
function drawLucas(t) {
  if (L.dead && L.vis && IMG.caido.complete) { drawCaido(t); return; }
  if (!L.vis || !IMG.superlucas.complete) return;
  const im = IMG.superlucas, h = LH, w = LW, ax = -AX * w, ay = -AY * h;
  const x = PX + L.inX, y = L.y;
  // estela turbo
  if (pw.turbo > 0 && state === 'play') {
    for (let i = L.trail.length - 1; i >= 1; i -= 1) {
      const tr = L.trail[i]; ctx.globalAlpha = .28 * (1 - i / L.trail.length);
      ctx.save(); ctx.translate(x - i * 22, tr.y); ctx.rotate(tr.r); ctx.drawImage(im, ax, ay, w, h); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  // halo
  ctx.globalCompositeOperation = 'lighter';
  const pul = 1 + Math.sin(t * 5) * .06;
  ctx.globalAlpha = pw.turbo > 0 ? .55 : .4; const gc = pw.turbo > 0 ? '#ffd23f' : '#19ff6a';
  ctx.drawImage(glowSpr(gc), x - 110 * pul, y - 80 * pul, 210 * pul, 160 * pul);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  // cuerpo
  const blink = pw.invul > 0 && Math.floor(t * 14) % 2 === 0;
  if (!blink) {
    ctx.save(); ctx.translate(x, y + Math.sin(t * 3) * 2); ctx.rotate(L.rot); ctx.scale(L.sy, L.sx);
    drawJetFlames(t);
    ctx.drawImage(im, ax, ay, w, h); ctx.restore();
  }
  // escudo
  if (pw.escudo) {
    ctx.save(); ctx.translate(x - 14, y); ctx.scale(1.7, 1);
    const r = 64 + Math.sin(t * 6) * 2.5;
    const g = ctx.createRadialGradient(0, 0, r * .6, 0, 0, r); g.addColorStop(0, 'rgba(0,229,255,0)'); g.addColorStop(.85, 'rgba(0,229,255,.18)'); g.addColorStop(1, 'rgba(160,250,255,.55)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(0,229,255,.9)'; ctx.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) { const a = t * 2 + i * TAU / 3; ctx.beginPath(); ctx.arc(0, 0, r, a, a + .7); ctx.stroke(); }
    ctx.restore(); ctx.globalCompositeOperation = 'source-over';
  }
  // imán
  if (pw.iman > 0) {
    ctx.save(); ctx.translate(x, y); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2; i++) { const r = ((t * 120 + i * 60) % 120) + 60; ctx.strokeStyle = `rgba(177,75,255,${(1 - (r - 60) / 120) * .5})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); }
    ctx.restore(); ctx.globalCompositeOperation = 'source-over';
  }
}
function drawSpeedLines(t) {
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const y = (Math.sin(i * 91.7) * .5 + .5) * H, len = 120 + (i % 4) * 60;
    const x = W - ((t * 2400 + i * 397) % (W + len * 2));
    ctx.strokeStyle = `rgba(255,240,180,${.12 + (i % 3) * .06})`; ctx.lineWidth = 1 + (i % 2);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}
function drawTexts() {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const tx of texts) {
    const a = clamp(tx.life / tx.max, 0, 1), sc = tx.life > .85 ? 1 + (tx.life - .85) * 3 : 1;
    ctx.globalAlpha = a; ctx.font = `900 ${tx.size * sc}px Orbitron, sans-serif`;
    ctx.fillStyle = tx.col; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * .5;
    ctx.fillText(tx.txt, tx.x + 1, tx.y + 1); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(tx.txt, tx.x, tx.y);
    ctx.fillStyle = '#fff'; ctx.fillText(tx.txt, tx.x, tx.y);
    ctx.fillStyle = tx.col; ctx.globalAlpha = a * .55; ctx.fillText(tx.txt, tx.x, tx.y);
  }
  ctx.globalAlpha = 1;
}

/* =========================================================
   HUD Y PANTALLAS
   ========================================================= */
let lastPts = -1, lastM = -1, lastD = -1;
const score = () => Math.floor(meters) + bonus;
function updHud(force) {
  const p = score(), m = Math.floor(meters);
  if (force || p !== lastPts) { $('#hPts').textContent = p.toLocaleString('es-ES'); lastPts = p; }
  if (force || m !== lastM) { $('#hM').textContent = m; lastM = m; }
  if (force || coins !== lastD) { $('#hD').textContent = coins; lastD = coins; }
}
function updCombo() {
  const el = $('#hCombo'), mult = Math.min(5, 1 + Math.floor(combo / 10));
  if (combo >= 5) { el.textContent = 'COMBO ' + combo + (mult > 1 ? '  ·  x' + mult : ''); el.classList.add('on'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  else el.classList.remove('on');
}
const pwMax = { iman: 9, turbo: 4.5, x2: 10 };
let pwSig = '';
function updPwHud() {
  const act = [];
  if (pw.escudo) act.push(['escudo', 1]);
  ['turbo', 'iman', 'x2'].forEach(k => { if (pw[k] > 0) act.push([k, pw[k] / pwMax[k]]); });
  const sig = act.map(a => a[0]).join(',');
  const box = $('#hPw');
  if (sig !== pwSig) {
    pwSig = sig; box.innerHTML = act.map(([k]) => `<div class="pw" data-k="${k}" style="--col:${PW[k].col}"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="23"/></svg><img src="${ICONS[k].toDataURL()}"></div>`).join('');
  }
  act.forEach(([k, f]) => { const c = box.querySelector(`[data-k="${k}"] circle`); if (c) { const L2 = 2 * Math.PI * 23; c.style.strokeDasharray = L2; c.style.strokeDashoffset = L2 * (1 - f); } });
}
function showBanner(a, b, col) {
  const el = $('#banner'); el.style.setProperty('--bc', col);
  el.innerHTML = `<small>${a}</small><span>${b}</span>`; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}
function show(id, dim) {
  $$('.screen').forEach(s => s.classList.remove('show', 'dim'));
  if (id) { const s = $(id); s.classList.add('show'); if (dim) s.classList.add('dim'); }
}
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

/* ---- botones de sonido ---- */
const SVG_SND = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke-width="2" stroke-linecap="round"/></svg>';
const SVG_SND_OFF = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l6 6M22 9l-6 6" fill="none" stroke-width="2" stroke-linecap="round"/></svg>';
const SVG_MUS = '<svg viewBox="0 0 24 24"><path d="M9 18V6l11-2v12" fill="none" stroke-width="2"/><circle cx="6.5" cy="18" r="2.8"/><circle cx="17.5" cy="16" r="2.8"/></svg>';
function paintSnd() {
  const b = $('#btnSonido'); b.innerHTML = Audio5.snd ? SVG_SND : SVG_SND_OFF; b.classList.toggle('off', !Audio5.snd);
  const m = $('#btnMusica'); m.innerHTML = SVG_MUS; m.classList.toggle('off', !Audio5.mus || !Audio5.snd);
}

/* ---- menú ---- */
const FRASES = ['¡Hola! Soy Lucas', 'Mantén pulsado para volar', 'Recoge datos y haz combos', 'Cuidado con los láseres', 'El turbo 5G lo arrasa todo', '¿Superas mi récord?', 'Futurmovil: fibra, móvil y TV'];
let fraseI = 0, fraseTimer;
function goMenu() {
  state = 'menu'; L.vis = false; Audio5.mode('menu'); Audio5.thrustOff();
  $('#hud').classList.add('oculto'); $('#btnPausa').classList.add('oculto');
  pintaCuenta(); $('#cuenta').innerHTML = '';
  show('#sMenu');
  clearInterval(fraseTimer);
  fraseTimer = setInterval(() => { const b = $('#bocadillo'); b.classList.add('out'); setTimeout(() => { fraseI = (fraseI + 1) % FRASES.length; b.textContent = FRASES[fraseI]; b.classList.remove('out'); }, 300); }, 3800);
}
function temporada() {
  const d = new Date(), m = d.getMonth() + 1, day = d.getDate(), k = m * 100 + day;
  let t = null;
  if (k >= 1010 && k <= 1102) t = ['halloween', '¡Feliz Halloween! Lucas ya tiene su sombrero de bruja.'];
  else if (k >= 1201 || k <= 107) t = ['navidad', '¡Feliz Navidad de parte de Lucas y Futurmovil!'];
  else if (k >= 615 && k <= 910) t = ['piscina', '¡Feliz verano! Lucas se ha ido a la piscina.'];
  const el = $('#temporada');
  if (t) { el.querySelector('img').src = 'img/' + t[0] + '.webp'; el.querySelector('span').textContent = t[1]; el.classList.remove('oculto'); }
}

/* ---- partida ---- */
/* ---- móvil: pantalla completa y horizontal ---- */
const esMovil = window.matchMedia('(pointer:coarse)').matches;
const enVertical = () => esMovil && window.matchMedia('(orientation:portrait)').matches;
function pantallaJuego() {
  if (!esMovil) return;
  const el = document.documentElement;
  try {
    const fs = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen && el.webkitRequestFullscreen();
    Promise.resolve(fs).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => {});
  } catch (e) {}
}
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
window.matchMedia('(orientation:portrait)').addEventListener && window.matchMedia('(orientation:portrait)').addEventListener('change', () => { if (enVertical()) pause(); setTimeout(resize, 250); });
function startGame() {
  if (enVertical()) { pantallaJuego(); return; }
  if (!SES) { abrirLogin('entrar'); return; }
  pantallaJuego();
  Audio5.init(); Audio5.click();
  clearInterval(fraseTimer);
  show(null); resetGame(); state = 'count'; Audio5.mode('game');
  $('#hud').classList.remove('oculto'); updPwHud(); updCombo();
  const seq = ['3', '2', '1', '¡VUELA!'], el = $('#cuenta');
  Audio5.launch();
  seq.forEach((s, i) => setTimeout(() => {
    el.innerHTML = `<span class="${i === 3 ? 'go' : ''}">${s}</span>`; Audio5.beep(i === 3);
    if (i === 3) { state = 'play'; $('#btnPausa').classList.remove('oculto'); setTimeout(() => el.innerHTML = '', 700); showBanner('ZONA 1', ZONAS[0].n, ZONAS[0].a); }
  }, i * 650));
}
function pause() { if (state !== 'play') return; state = 'pause'; holding = false; Audio5.thrustOff(); show('#sPausa', true); }
function resume() { show(null); state = 'play'; Audio5.click(); }

let lastResult = null;
function gameOver() {
  state = 'over'; Audio5.thrustOff(); Audio5.mode('menu');
  const pts = score(), rec = pts > best;
  if (rec) { best = pts; store('best', best); }
  lastResult = { pts, m: Math.floor(meters), d: coins, dur: Math.round(playT * 1000) };
  $('#hud').classList.add('oculto');
  const card = $('#sFin .card'); card.classList.toggle('record-new', rec);
  $('#finTit').textContent = rec ? '¡NUEVO RÉCORD!' : pick(['¡BOOM!', 'FIN DE LA PARTIDA', '¡CASI!', 'LUCAS NECESITA REPARACIÓN']);
  $('#finImg').src = 'img/' + (rec ? 'celebra' : 'caido') + '.webp'; $('#finImg').classList.toggle('caido', !rec);
  countUp('#fPts', pts); countUp('#fM', lastResult.m); countUp('#fD', coins); $('#fBest').textContent = best.toLocaleString('es-ES');
  show('#sFin', true);
  if (rec && pts > 0) { Audio5.record(); confetti(); }
  $('#envio').textContent = '';
  if (SES) enviar();
}
function countUp(sel, val) {
  const el = $(sel), t0 = performance.now(), dur = 900;
  (function f() { const k = Math.min(1, (performance.now() - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(val * e).toLocaleString('es-ES'); if (k < 1) requestAnimationFrame(f); })();
}
function confetti() {
  for (let i = 0; i < 120; i++) {
    const a = rnd(-Math.PI * .9, -Math.PI * .1), v = rnd(400, 1000);
    P(camX + W / 2 + rnd(-200, 200), H * .7, Math.cos(a) * v, Math.sin(a) * v, rnd(1.5, 2.5), rnd(3, 6), pick(['#19ff6a', '#00e5ff', '#ff2bd6', '#ffd23f', '#ffffff']), 'debris', { grav: 700, vr: rnd(-10, 10), drag: .6 });
  }
}

/* ---- API (JSONP) ---- */
function jsonp(params) {
  return new Promise((res, rej) => {
    if (!CFG.API) return rej('sin API');
    const cb = 'cb' + Date.now() + Math.floor(Math.random() * 1e4), s = document.createElement('script');
    const to = setTimeout(() => { cleanup(); rej('tiempo'); }, 12000);
    function cleanup() { clearTimeout(to); delete window[cb]; s.remove(); }
    window[cb] = d => { cleanup(); res(d); };
    s.onerror = () => { cleanup(); rej('red'); };
    s.src = CFG.API + '?' + new URLSearchParams(Object.assign({}, params, { cb })).toString();
    document.head.appendChild(s);
  });
}
function enviar() {
  if (!lastResult || lastResult.pts <= 0 || !SES) return;
  const r = lastResult, f = firma([SES.perfil.usuario, r.pts, r.m, r.d, r.dur].join('|'));
  $('#envio').textContent = 'Guardando en el ranking…';
  api('enviar', { token: SES.token, puntos: r.pts, metros: r.m, datos: r.d, dur: r.dur, firma: f })
    .then(d => {
      if (d.ok) {
        SES.perfil.partidas++; if (d.nuevoRecord) SES.perfil.record = r.pts; store('ses', SES);
        $('#envio').innerHTML = `Ranking semanal: puesto <b style="color:#19ff6a">#${d.puesto}</b>` + (d.nuevoRecord ? ' · <b style="color:#ffd23f">¡récord personal guardado!</b>' : '');
      } else $('#envio').textContent = d.error || 'No se pudo guardar';
    })
    .catch(() => $('#envio').textContent = 'Sin conexión con el ranking');
}
let rkData = null, rkTab = 'semana';
function openRanking() {
  Audio5.init(); Audio5.click(); show('#sRanking', true); rkTab = 'semana';
  $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === rkTab));
  const ul = $('#rkLista');
  if (!CFG.API) { ul.innerHTML = '<li class="vacio">El ranking estará disponible muy pronto</li>'; return; }
  ul.innerHTML = '<li class="vacio">Cargando…</li>';
  jsonp({ accion: 'top' }).then(d => { rkData = d; paintRanking(); }).catch(() => ul.innerHTML = '<li class="vacio">No se pudo cargar el ranking</li>');
}
function paintRanking() {
  const ul = $('#rkLista'); if (!rkData) return;
  const list = rkData[rkTab] || [], yo = (SES ? SES.perfil.usuario : '').toLowerCase();
  const pr = $('#premio');
  if (rkTab === 'semana' && rkData.premio) { pr.textContent = 'Premio de la semana: ' + rkData.premio; pr.classList.remove('oculto'); } else pr.classList.add('oculto');
  if (!list.length) { ul.innerHTML = '<li class="vacio">Todavía no hay puntuaciones. ¡Sé el primero!</li>'; return; }
  ul.innerHTML = list.map((r, i) => `<li class="p${i + 1} ${r.nombre.toLowerCase() === yo ? 'yo' : ''}" style="animation-delay:${i * 35}ms"><span class="n">${i + 1}</span><span class="nm"></span><span class="p">${Number(r.puntos).toLocaleString('es-ES')}</span></li>`).join('');
  ul.querySelectorAll('.nm').forEach((el, i) => el.textContent = list[i].nombre);
}

/* ---- compartir / instalar ---- */
function compartir(txt) {
  Audio5.init(); Audio5.click();
  const text = txt || '¡Juega a LUCASBOT 5G de Futurmovil y vuela con Lucas!';
  if (navigator.share) navigator.share({ title: 'LUCASBOT 5G', text, url: CFG.URL }).catch(() => {});
  else window.open('https://wa.me/?text=' + encodeURIComponent(text + ' ' + CFG.URL), '_blank');
}
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
function instalar() {
  Audio5.init(); Audio5.click();
  if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt.userChoice.finally(() => deferredPrompt = null); }
  else if (isIOS) show('#sIos', true);
  else toast('Abre el menú del navegador y elige «Instalar aplicación»');
}

/* =========================================================
   ENTRADA
   ========================================================= */
function down(e) {
  if (state === 'play') { holding = true; if (e && e.cancelable) e.preventDefault(); }
}
function up() { holding = false; }
cv.addEventListener('pointerdown', down);
window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
cv.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('keydown', e => {
  if (e.repeat) return;
  if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) { if (state === 'play') { holding = true; e.preventDefault(); } else if (state === 'menu' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); startGame(); } }
  if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'play') pause(); else if (state === 'pause') resume(); }
  if (e.code === 'Enter' && state === 'over' && document.activeElement.tagName !== 'INPUT') startGame();
});
window.addEventListener('keyup', e => { if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) holding = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('blur', () => { holding = false; });
window.addEventListener('resize', () => { resize(); });

$('#btnJugar').onclick = startGame;
$('#btnOtra').onclick = startGame;
$('#btnRanking').onclick = openRanking;
$('#btnFinRank').onclick = openRanking;
$('#btnAyuda').onclick = () => { Audio5.init(); Audio5.click(); show('#sAyuda', true); };
$('#btnCompartir').onclick = () => compartir();
$('#btnFinComp').onclick = () => compartir(`¡He hecho ${lastResult ? lastResult.pts.toLocaleString('es-ES') : 0} puntos con Lucas en LUCASBOT 5G de Futurmovil! ¿Me superas?`);
$('#btnInstalar').onclick = instalar;
if (standalone) $('#btnInstalar').classList.add('oculto');
$('#btnFinMenu').onclick = () => { Audio5.click(); goMenu(); };
$('#btnPausa').onclick = e => { e.stopPropagation(); pause(); };
$('#btnSeguir').onclick = resume;
$('#btnSalir').onclick = () => { Audio5.click(); goMenu(); };
$$('[data-cerrar]').forEach(b => b.onclick = () => { Audio5.click(); if (state === 'over') show('#sFin', true); else if (state === 'pause') show('#sPausa', true); else goMenu(); });
$$('.tab').forEach(t => t.onclick = () => { rkTab = t.dataset.tab; $$('.tab').forEach(x => x.classList.toggle('on', x === t)); Audio5.click(); paintRanking(); });
$('#btnSonido').onclick = () => { Audio5.init(); Audio5.toggleSnd(); paintSnd(); };
$('#btnMusica').onclick = () => { Audio5.init(); if (!Audio5.snd) Audio5.toggleSnd(); Audio5.toggleMus(); paintSnd(); };
document.addEventListener('pointerdown', () => Audio5.init(), { once: true });


/* =========================================================
   FUEGO ANIMADO DE LUCAS EN EL MENÚ
   ========================================================= */
const heroFx = $('#heroFx'), hctx = heroFx.getContext('2d'), heroImg = $('#heroImg');
const NOZ = [[.368, .945, 1], [.457, .96, 1.15], [.55, .945, 1]];   // centro x, y de cada tobera (relativo a la imagen)
let hParts = [];
function flamePath(x, y, w, L, wob) {
  hctx.beginPath(); hctx.moveTo(x - w / 2, y);
  hctx.bezierCurveTo(x - w / 2, y + L * .35, x - w * .2 + wob * .5, y + L * .7, x + wob, y + L);
  hctx.bezierCurveTo(x + w * .2 + wob * .5, y + L * .7, x + w / 2, y + L * .35, x + w / 2, y);
  hctx.closePath();
}
function flame(x, y, w, L, wob, stops) {
  const g = hctx.createLinearGradient(x, y, x, y + L);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  hctx.fillStyle = g; flamePath(x, y, w, L, wob); hctx.fill();
}
function drawHeroFire(dt, t) {
  const cr = heroFx.getBoundingClientRect(); if (!cr.width || !heroImg.complete) return;
  const d = Math.min(window.devicePixelRatio || 1, 2), cw = Math.round(cr.width * d), ch = Math.round(cr.height * d);
  if (heroFx.width !== cw || heroFx.height !== ch) { heroFx.width = cw; heroFx.height = ch; }
  const ir = heroImg.getBoundingClientRect(), sc = ir.height / 555;
  hctx.setTransform(d, 0, 0, d, 0, 0); hctx.clearRect(0, 0, cr.width, cr.height);
  hctx.globalCompositeOperation = 'lighter';
  // resplandor general bajo los propulsores
  const bx = ir.left - cr.left + .457 * ir.width, by = ir.top - cr.top + .99 * ir.height;
  const pul = 1 + Math.sin(t * 9) * .08 + Math.random() * .05;
  hctx.globalAlpha = .55; hctx.drawImage(glowSpr('#19ff6a'), bx - 130 * sc * pul, by - 40 * sc, 260 * sc * pul, 230 * sc * pul); hctx.globalAlpha = 1;
  NOZ.forEach(([rx, ry, k], i) => {
    const x = ir.left - cr.left + rx * ir.width, y = ir.top - cr.top + ry * ir.height;
    const w = 50 * sc;
    const L = (150 + Math.sin(t * 23 + i * 2.1) * 14 + Math.sin(t * 41 + i) * 9 + Math.random() * 12) * sc * k;
    const wob = (Math.sin(t * 13 + i * 1.7) + Math.sin(t * 29 + i) * .5) * w * .18;
    flame(x, y, w * 1.7, L * 1.3, wob * 1.4, [[0, 'rgba(120,255,180,.45)'], [.4, 'rgba(25,255,106,.28)'], [1, 'rgba(0,229,255,0)']]);
    flame(x, y, w * 1.05, L, wob, [[0, 'rgba(255,255,255,.95)'], [.18, 'rgba(200,255,225,.9)'], [.5, 'rgba(25,255,106,.75)'], [1, 'rgba(0,200,120,0)']]);
    flame(x, y, w * .5, L * .5, wob * .4, [[0, 'rgba(255,255,255,1)'], [.6, 'rgba(230,255,240,.8)'], [1, 'rgba(255,255,255,0)']]);
    // chispas y lenguas sueltas
    const n = Math.random() < .7 ? 2 : 1;
    for (let j = 0; j < n; j++) hParts.push({ x: x + rnd(-w * .3, w * .3), y: y + L * rnd(.3, .6), vx: rnd(-25, 25) * sc, vy: rnd(220, 420) * sc, life: rnd(.25, .55), max: .55, s: rnd(5, 11) * sc, col: pick(['#19ff6a', '#19ff6a', '#7dffb0', '#00e5ff']) });
    if (Math.random() < .25) hParts.push({ x, y: y + L * .4, vx: rnd(-90, 90) * sc, vy: rnd(300, 520) * sc, life: .45, max: .45, s: 1.6 * sc, col: '#e8fff1', spark: 1 });
  });
  for (let i = hParts.length - 1; i >= 0; i--) {
    const p = hParts[i]; p.life -= dt; if (p.life <= 0) { hParts.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .98;
    const a = clamp(p.life / p.max, 0, 1); hctx.globalAlpha = a;
    if (p.spark) { hctx.strokeStyle = p.col; hctx.lineWidth = p.s; hctx.beginPath(); hctx.moveTo(p.x, p.y); hctx.lineTo(p.x - p.vx * .03, p.y - p.vy * .03); hctx.stroke(); }
    else { const r = p.s * (.5 + a * .7); hctx.drawImage(glowSpr(p.col), p.x - r, p.y - r, r * 2, r * 2); }
  }
  if (hParts.length > 260) hParts.splice(0, hParts.length - 260);
  hctx.globalAlpha = 1; hctx.globalCompositeOperation = 'source-over';
}


/* =========================================================
   CUENTAS: registro, acceso, Google y recuperación
   ========================================================= */
let SES = load('ses', null), trasLogin = null;
function api(accion, datos) {
  return fetch(CFG.API, { method: 'POST', body: JSON.stringify(Object.assign({ accion }, datos || {})) })
    .then(r => r.json()).catch(() => ({ ok: false, error: 'Sin conexión. Inténtalo otra vez.' }));
}
function pintaCuenta() {
  const rec = Math.max(best, SES ? SES.perfil.record || 0 : 0);
  $('#mRecord').textContent = rec.toLocaleString('es-ES');
  const c = $('#miCuenta');
  if (SES) { c.classList.remove('oculto'); $('#cUsuario').textContent = SES.perfil.usuario; c.querySelector('.avatar').textContent = SES.perfil.usuario[0].toUpperCase(); }
  else c.classList.add('oculto');
  $('#btnJugar span').textContent = SES ? 'JUGAR' : 'ENTRAR Y JUGAR';
}
function sesion(d) {
  SES = { token: d.token, perfil: d.perfil }; store('ses', SES);
  if (SES.perfil.record > best) { best = SES.perfil.record; store('best', best); }
  Audio5.zone(); toast('¡Hola, ' + d.perfil.usuario + '!'); pintaCuenta();
  goMenu(); setTimeout(startGame, 350);
}
function vistaLogin(v) {
  $$('#sLogin .lv').forEach(x => x.classList.toggle('on', x.dataset.v === v));
  msg('');
  const f = $(`#sLogin .lv[data-v="${v}"] input`); if (f && !esMovil) setTimeout(() => f.focus(), 80);
}
function abrirLogin(v) { Audio5.init(); Audio5.click(); show('#sLogin', true); vistaLogin(v || 'entrar'); initGoogle(); }
function msg(t, tipo) { const m = $('#lMsg'); m.textContent = t || ''; m.className = 'lmsg ' + (tipo || ''); }
function ocupado(form, on) { const b = form.querySelector('button[type=submit]'); b.disabled = on; b.style.opacity = on ? .6 : 1; }
async function enviarForm(form, accion, extra) {
  const d = Object.fromEntries(new FormData(form)); ocupado(form, true); msg('Un momento…');
  const r = await api(accion, Object.assign(d, extra || {})); ocupado(form, false);
  return r;
}
$('#fEntrar').onsubmit = async e => { e.preventDefault(); const r = await enviarForm(e.target, 'entrar'); r.ok ? sesion(r) : msg(r.error, 'err'); };
$('#fCrear').onsubmit = async e => { e.preventDefault(); const r = await enviarForm(e.target, 'registrar'); r.ok ? sesion(r) : msg(r.error, 'err'); };
$('#fRecuperar').onsubmit = async e => {
  e.preventDefault(); const r = await enviarForm(e.target, 'recuperar');
  if (!r.ok) return msg(r.error, 'err');
  $('#rsEmail').value = $('#rEmail').value; vistaLogin('restablecer'); msg('Si el correo tiene cuenta, te hemos enviado el código. Mira también en spam.', 'ok');
};
$('#fRestablecer').onsubmit = async e => { e.preventDefault(); const r = await enviarForm(e.target, 'restablecer'); r.ok ? sesion(r) : msg(r.error, 'err'); };
$$('#sLogin [data-ir]').forEach(a => a.onclick = () => { Audio5.click(); vistaLogin(a.dataset.ir); });
$('#btnSalirCuenta').onclick = () => { Audio5.click(); if (SES) api('salir', { token: SES.token }); SES = null; store('ses', null); pintaCuenta(); toast('Has cerrado sesión'); };

// comprobar si el nombre de usuario está libre mientras se escribe
function vigilaUsuario(inp, est) {
  let tm;
  inp.addEventListener('input', () => {
    clearTimeout(tm); const u = inp.value.trim(); est.className = ''; est.textContent = '';
    if (!u) return;
    if (!/^[A-Za-z0-9ÑñÁÉÍÓÚáéíóúÜü_.\-]{3,16}$/.test(u)) { est.className = 'no'; est.textContent = u.length < 3 ? 'mín. 3' : 'no válido'; return; }
    est.textContent = '…';
    tm = setTimeout(async () => {
      const r = await api('disponible', { usuario: u });
      if (inp.value.trim() !== u) return;
      est.className = r.disponible ? 'ok' : 'no'; est.textContent = r.disponible ? '✓ libre' : '✗ cogido';
    }, 450);
  });
}
vigilaUsuario($('#cUser'), $('#cUserEst'));
vigilaUsuario($('#gUser'), $('#gUserEst'));

// Entrar con Google
let gIniciado = false, gCred = null;
function initGoogle() {
  if (!CFG.GOOGLE) { $$('#sLogin .gWrap').forEach(g => g.classList.add('oculto')); return; }
  if (gIniciado) return;
  if (!(window.google && google.accounts && google.accounts.id)) { setTimeout(initGoogle, 300); return; }
  gIniciado = true;
  google.accounts.id.initialize({ client_id: CFG.GOOGLE, callback: async res => {
    gCred = res.credential; msg('Entrando con Google…');
    const r = await api('google', { credential: gCred });
    if (!r.ok) return msg(r.error, 'err');
    if (r.necesitaUsuario) { vistaLogin('gusuario'); $('#gUser').value = r.sugerido || ''; $('#gUser').dispatchEvent(new Event('input')); return; }
    sesion(r);
  } });
  $$('#sLogin .gBtn').forEach(el => google.accounts.id.renderButton(el, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', locale: 'es' }));
}
$('#fGUsuario').onsubmit = async e => { e.preventDefault(); const r = await enviarForm(e.target, 'google', { credential: gCred }); r.ok && !r.necesitaUsuario ? sesion(r) : msg(r.error || 'Elige otro nombre', 'err'); };

// validar la sesión guardada al abrir el juego
if (SES) api('yo', { token: SES.token }).then(r => {
  if (r.ok) { SES.perfil = r.perfil; store('ses', SES); if (r.perfil.record > best) { best = r.perfil.record; store('best', best); } pintaCuenta(); }
  else if (r.sesion === false) { SES = null; store('ses', null); pintaCuenta(); }
});

/* =========================================================
   ARRANQUE
   ========================================================= */
let last = performance.now();
function loop(now) {
  const dt = Math.min(.034, (now - last) / 1000); last = now;
  update(dt); render();
  if (state === 'menu' || state === 'load') drawHeroFire(dt, now / 1000);
  requestAnimationFrame(loop);
}
resize(); paintSnd();
const fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
loadImages(() => {
  Promise.race([fontsReady, new Promise(r => setTimeout(r, 2500))]).then(() => {
    buildSprites(); layers = buildLayers(zona);
    $('#ayudaPw').innerHTML = Object.keys(PW).map(k => `<div><img src="${ICONS[k].toDataURL()}"><span><b style="color:${PW[k].col}">${PW[k].nom}</b>: ${PW[k].desc}</span></div>`).join('');
    setTimeout(goMenu, 400);
  });
});
requestAnimationFrame(loop);
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

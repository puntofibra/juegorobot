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
  let ac = null, master, sfx, mus, comp, noiseBuf, thrG, thrF, musFilter, eco;
  let snd = load('snd', true), musOn = load('mus', true);
  let step = 0, nextT = 0, timer = null, intensity = 0;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function init() {
    if (ac) { if (ac.state === 'suspended' && !document.hidden) ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ac = new AC();
    comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master = ac.createGain(); master.gain.value = snd ? 0.9 : 0;
    comp.connect(master); master.connect(ac.destination);
    sfx = ac.createGain(); sfx.gain.value = 0.75; sfx.connect(comp);
    musFilter = ac.createBiquadFilter(); musFilter.type = 'lowpass'; musFilter.frequency.value = 2400;
    mus = ac.createGain(); mus.gain.value = musOn ? 0.32 : 0; mus.connect(musFilter); musFilter.connect(comp);
    // eco para la cajita de música de Halloween (seco + repeticiones)
    eco = ac.createGain(); eco.connect(mus);
    const dl = ac.createDelay(1), fb = ac.createGain(), wet = ac.createGain(), ef = ac.createBiquadFilter();
    dl.delayTime.value = 0.47; fb.gain.value = 0.38; wet.gain.value = 0.55; ef.type = 'lowpass'; ef.frequency.value = 2200;
    eco.connect(dl); dl.connect(ef); ef.connect(fb); fb.connect(dl); ef.connect(wet); wet.connect(mus);
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
    while (nextT < ac.currentTime + 0.12) { const hw = typeof TEMA !== 'undefined' && TEMA === 'halloween'; if (hw) playStepH(step, nextT); else playStep(step, nextT); nextT += hw ? S16H : S16; step = (step + 1) % 256; }
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
  // ---- música de Halloween: terror synth de los 80 (Rem · Sib · Solm · La) ----
  const progH = [[38, [62, 65, 69, 74]], [34, [58, 62, 65, 70]], [43, [55, 58, 62, 67]], [33, [57, 61, 64, 69]]];
  const S16H = 60 / 96 / 4;
  const cajita = [0, 2, 1, 3, 2, 1, 0, -1];
  function campana(dly) {
    const t = ac.currentTime + dly;
    [[1, .16], [2.76, .07], [5.4, .04], [.5, .09], [2, .05]].forEach(([m, v]) => {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = 146.8 * m;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .008); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);
      o.connect(g); g.connect(eco); o.start(t); o.stop(t + 4.3);
    });
  }
  function theremin(notas, dly, dn) {
    const t = ac.currentTime + dly, T = notas.length * dn;
    const o = ac.createOscillator(), g = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain();
    o.type = 'sine'; l.frequency.value = 5.8; lg.gain.value = 7; l.connect(lg); lg.connect(o.frequency);
    o.frequency.setValueAtTime(mtof(notas[0]), t);
    notas.forEach((n, i) => { if (i) o.frequency.exponentialRampToValueAtTime(mtof(n), t + i * dn + dn * .35); });
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.045, t + .4); g.gain.setValueAtTime(.045, t + T - .5); g.gain.exponentialRampToValueAtTime(0.0001, t + T);
    o.connect(g); g.connect(eco); o.start(t); l.start(t); o.stop(t + T + .05); l.stop(t + T + .05);
  }
  function playStepH(s, t) {
    if (!musOn || !snd) return;
    const bar = Math.floor(s / 16) % 4, st = s % 16, ch = progH[bar], dly = t - ac.currentTime, juego = musMode === 'game';
    // bajo pulsante en semicorcheas (octava en cada pulso)
    if (juego || st % 2 === 0) tone(mtof(ch[0] + (st % 4 === 2 ? 12 : 0)), S16H * 1.3, 'sawtooth', juego ? 0.13 : 0.1, 0, dly, mus);
    // cajita de música siniestra con eco
    if (st % 2 === 0) { const i = cajita[(st / 2) % 8], n = i < 0 ? ch[1][0] - 1 : ch[1][i]; tone(mtof(n + 12), S16H * 3, 'sine', 0.05, 0, dly, eco); tone(mtof(n + 24), S16H * 1.5, 'triangle', 0.012, 0, dly, eco); }
    // coro oscuro al inicio del compás
    if (st === 0) ch[1].slice(0, 3).forEach(m => { tone(mtof(m - 12), S16H * 15, 'triangle', 0.03, 0, dly, mus); tone(mtof(m - 12) * 1.006, S16H * 15, 'sawtooth', 0.008, 0, dly, mus); });
    // campana de iglesia cada 4 compases
    if (s % 64 === 0) campana(dly);
    if (!juego) { if (s % 32 === 8) theremin(bar === 0 ? [74, 73, 70, 69] : [69, 70, 65, 62], dly, S16H * 4); return; }
    // percusión de partida
    if (st === 0 || st === 10) { tone(90, 0.4, 'sine', 0.6, 0.35, dly, mus); noise(0.12, 0.12, 400, 80, 'lowpass', dly, mus); }   // bombo grave
    if (st === 4 || st === 12) noise(0.45, 0.22, 2200, 500, 'bandpass', dly, mus);                                               // caja con cola
    if (st % 2 === 1) tone(st % 4 === 1 ? 3200 : 2400, 0.03, 'square', 0.02 + intensity * 0.015, 0, dly, mus);                    // tic-tac de reloj
  }
  // pausar todo el sonido cuando el juego no está en pantalla (otra app, botón de inicio, pantalla apagada)
  let oculto = false;
  function dormir() { oculto = true; if (ac && ac.state === 'running') ac.suspend().catch(() => {}); }
  function despertar() { oculto = false; if (ac && ac.state === 'suspended') ac.resume().then(() => { nextT = Math.max(nextT, ac.currentTime + 0.05); }).catch(() => {}); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) dormir(); else despertar(); });
  window.addEventListener('pagehide', dormir);
  window.addEventListener('pageshow', () => { if (!document.hidden) despertar(); });
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
/* ---- temas (se activan desde el panel admin) ---- */
let TEMA = load('tema', 'normal');
const ZONAS_N = ZONAS.map(z => Object.assign({}, z));
const ZONAS_H = [
  { n: 'CEMENTERIO DIGITAL', a: '#ff7a1a', b: '#b14bff', top: '#020104', bot: '#1d0a1c', sun1: '#ffe7a3', sun2: '#ff8a1f' },
  { n: 'BOSQUE MALDITO', a: '#9dff3a', b: '#ff7a1a', top: '#010402', bot: '#0d1a0b', sun1: '#f4ffd0', sun2: '#9dff3a' },
  { n: 'CASTILLO VAMPIRO', a: '#ff2b4e', b: '#b14bff', top: '#050103', bot: '#260510', sun1: '#ffd6c2', sun2: '#ff2b4e' },
  { n: 'CRIPTA DEL SERVIDOR', a: '#b14bff', b: '#ff7a1a', top: '#030107', bot: '#170a2a', sun1: '#ecd9ff', sun2: '#b14bff' }
];
const HW = () => TEMA === 'halloween';
const OJOS_POS = {}, tumbasC = {};
let arbolesC = null, calSprG = null, lamparas = null, nieblaTira = null;   // cachés del modo Halloween
function paletaTema() { (HW() ? ZONAS_H : ZONAS_N).forEach((z, i) => Object.assign(ZONAS[i], z)); }
paletaTema();
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
  if (HW()) {   // Halloween: edificios en silueta negra con sombras
    const sg = g.createLinearGradient(0, 0, 0, c.height);
    if (name === 'altos') { sg.addColorStop(0, '#120818'); sg.addColorStop(.35, '#07040b'); sg.addColorStop(1, '#030205'); }
    else { sg.addColorStop(0, '#0a0510'); sg.addColorStop(.3, '#040207'); sg.addColorStop(1, '#010102'); }
    g.fillStyle = sg; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = rgba(p.a, name === 'altos' ? .05 : .03); g.fillRect(0, 0, c.width, c.height * .25);
  } else {
    if (name === 'altos') { g.fillStyle = 'rgba(4,7,16,.28)'; g.fillRect(0, 0, c.width, c.height); }
    if (z > 0) { g.fillStyle = rgba(p.a, .1); g.fillRect(0, 0, c.width, c.height); }
  }
  // borde superior iluminado por el color de la zona
  let lc = null;
  if (gl && gl.complete && gl.naturalWidth && !HW()) {
    lc = off(w * R, h * R); const lg = lc.getContext('2d');
    lg.drawImage(gl, 0, 0, lc.width, lc.height);
    if (z > 0 || HW()) { lg.globalCompositeOperation = 'source-atop'; lg.fillStyle = rgba(p.a, HW() ? .45 : .85); lg.fillRect(0, 0, lc.width, lc.height); }
  }
  return Object.assign({ c, lc, w, h }, HW() ? ojosCapa(name, im, w, h) : {});
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
  if (Lr.ojos) {
    const a0 = ctx.globalAlpha, pa = a0 * (.65 + .35 * Math.sin(t * 2.1)), ciclo = (t * .45) % 5, pb = a0 * (ciclo > 4.8 ? .05 : .65 + .35 * Math.sin(t * 1.7 + 2.4)), sp = spriteOjos();
    ctx.globalCompositeOperation = 'lighter';
    for (let x = o; x < W; x += Lr.w) for (let i = 0; i < Lr.ojos.length; i++) {
      const e = Lr.ojos[i], ex = x + e[0]; if (ex < -30 || ex > W + 30) continue;
      ctx.globalAlpha = i % 2 ? pb : pa; ctx.drawImage(sp, ex - e[2] * 7, y + e[1] - e[2] * 5, e[2] * 14, e[2] * 10);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a0;
  }
}
function buildLayers(z) {
  const R = S * DPR;
  const L = { z, R };
  // capas de ilustración: altos detrás, bajos delante
  L.ant = [];
  L.altos = artLayer('altos', GROUND * 0.6, z, R);
  L.bajos = artLayer('bajos', GROUND * 0.27, z, R);
  if (HW()) { L.arboles = capaArboles(R); L.tumbas = capaTumbas(R, z); }
  return L;
}
/* prepara la zona siguiente en trocitos (un trozo por fotograma) para que el cambio de zona no dé tirones */
let zonaLista = null, zonaPrep = -1;
function prepZona(z) {
  if (zonaPrep === z || (zonaLista && zonaLista.z === z)) return;
  zonaPrep = z; const R = S * DPR, L = { z, R }, pasos = [
    () => L.altos = artLayer('altos', GROUND * 0.6, z, R),
    () => L.bajos = artLayer('bajos', GROUND * 0.27, z, R),
    () => { if (HW()) { L.arboles = capaArboles(R); L.tumbas = capaTumbas(R, z); } L.ant = []; }];
  const sig = () => { if (zonaPrep !== z) return; const f = pasos.shift(); if (f) { f(); setTimeout(sig, 30); } else { zonaLista = L; zonaPrep = -1; } };
  setTimeout(sig, 0);
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
  zonaLista = null; zonaPrep = -1; layers = buildLayers(zona); prevLayers = null; layerFade = 1; makeStars();
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
  camX = 0; speed = 0; meters = 0; coins = 0; bonus = 0; combo = 0; comboT = 0; playT = 0; premioAvisado = false; $('#finItem').classList.add('oculto'); document.querySelectorAll('.finExtra').forEach(e => e.remove());
  timeScale = 1; hitStop = 0; shake = 0; holding = false;
  coinsArr = []; lasers = []; viruses = []; missiles = []; powers = []; parts = []; texts = []; warns = [];
  Object.assign(pw, { escudo: false, iman: 0, turbo: 0, x2: 0, invul: 0 });
  Object.assign(L, { y: (top_() + bot_()) / 2, vy: 0, rot: 0, sx: 1, sy: 1, vis: true, inX: -200, trail: [], dead: false, spin: 0, skid: [], dx: 0, dvx: 0 });
  spawnX = W + 500; nextPower = 2400; missileT = 9; lastZone = 0;
  if (zona !== 0) setZone(0, true);
  updHud(true);
}
function setZone(z, instant) {
  const lista = zonaLista && zonaLista.z === z && zonaLista.R === S * DPR ? zonaLista : null; zonaLista = null;
  zona = z; prevLayers = instant ? null : layers; layers = lista || buildLayers(z); layerFade = instant ? 1 : 0;
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
  if (state === 'play') { meters += speed * dt / 40; playT += dt; if (!premioAvisado && PREMIO && SES && score() >= PREMIO.minimo) { premioAvisado = true; const it = ITEMS[PREMIO.tipo]; showBanner('¡OBJETO DESBLOQUEADO!', (it ? it.nom : PREMIO.tipo).toUpperCase(), '#ff9a2b'); Audio5.record(); flash('#ff9a2b', .25); } }

  // zonas
  const zn = Math.floor(meters / 800);
  if (state === 'play' && meters % 800 > 560) prepZona((zn + 1) % ZONAS.length);
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
    if (d < 4) { hit(px, py, () => { l.dead = true; for (let k = 0; k <= 10; k++) burst(lerp(e[0], e[2], k / 10), lerp(e[1], e[3], k / 10), HW() ? '#9dff3a' : '#ff2b4e', 4, 260); lasers.splice(i, 1); }); if (L.dead) return; continue; }
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
    if (Math.random() < .3) P(v.x + rnd(-10, 10), v.y + rnd(-10, 10), rnd(20, 80), rnd(-30, 30), .4, rnd(4, 8), HW() ? '#7a1fd6' : '#ff2bd6', 'glow');
    if (nearest((x, y) => Math.hypot(x - v.x, y - v.y)) < 21) { hit(v.x, v.y, () => { burst(v.x, v.y, HW() ? '#b14bff' : '#ff2bd6', 30, 500); viruses.splice(i, 1); }); if (L.dead) return; }
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
  if (HW()) drawBandada(t);
  drawLayerSet(prevLayers, 1 - layerFade, t); drawLayerSet(layers, prevLayers ? layerFade : 1, t);
  if (HW()) drawNiebla(t);

  // neblina en el horizonte
  const z = ZONAS[zona];
  const hz = ctx.createLinearGradient(0, GROUND - 160, 0, GROUND); hz.addColorStop(0, 'rgba(0,0,0,0)'); hz.addColorStop(1, rgba(z.a, .16));
  ctx.fillStyle = hz; ctx.fillRect(0, GROUND - 160, W, 160);

  drawFloor(z); drawCeil(z, t);
  if (HW()) drawTelas(t);

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
let moonC = null, moonG = null, moonX = null, moonN = 0, moonZ = '';
function drawMoon(t) {
  const im = IMG.luna; if (!im || !im.complete || !im.naturalWidth) return;
  const mr = Math.min(H * .15, GROUND * .19, 140);          // radio de la esfera
  const size = mr / 0.455;                                   // tamaño total de la imagen (incluye satélites)
  const portrait = W < 700;
  const tx = (state === 'menu' || state === 'load') ? (portrait ? W * .78 : W * .1 + mr) : W * .72;
  moonX = moonX == null ? tx : lerp(moonX, tx, .03);
  const cx = moonX, cy = Math.max(CEIL + mr + 50, GROUND - GROUND * .7);
  const R = S * DPR, ip = Math.ceil(size * R), px = Math.ceil(ip * 1.45), c0 = px / 2, rr = mr * R;   // lienzo 1.45x para que al girar no se corten las esquinas
  let nueva = false;
  if (!moonC || moonC.width !== px) { moonC = off(px, px); moonG = moonC.getContext('2d'); moonG.imageSmoothingQuality = 'high'; nueva = true; }
  moonN = (moonN + 1) % 3;
  if (nueva || moonN === 0 || moonZ !== zona + TEMA) {   // la luna gira muy despacio: basta repintarla 1 de cada 3 fotogramas
  moonZ = zona + TEMA;
  const g = moonG;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, px, px);
  g.translate(c0, c0); g.rotate(t * 0.11); g.drawImage(im, -ip / 2, -ip / 2, ip, ip); g.setTransform(1, 0, 0, 1, 0, 0);
  // sombreado fijo (la luz no gira, la luna sí) => sensación de esfera
  g.globalCompositeOperation = 'source-atop';
  const sh = g.createRadialGradient(c0 - rr * .45, c0 - rr * .5, rr * .1, c0, c0, rr * 1.12);
  sh.addColorStop(0, 'rgba(255,255,255,.12)'); sh.addColorStop(.5, 'rgba(10,20,40,.05)'); sh.addColorStop(.82, 'rgba(5,10,25,.45)'); sh.addColorStop(1, 'rgba(3,6,15,.75)');
  g.fillStyle = sh; g.beginPath(); g.arc(c0, c0, rr * 1.03, 0, TAU); g.fill();
  g.fillStyle = 'rgba(8,14,32,.2)'; g.fillRect(0, 0, px, px);
  if (HW()) { g.fillStyle = rgba(ZONAS[zona].sun2, .38); g.fillRect(0, 0, px, px); g.fillStyle = 'rgba(255,240,200,.12)'; g.fillRect(0, 0, px, px); }
  else if (zona > 0) { g.fillStyle = rgba(ZONAS[zona].a, .09); g.fillRect(0, 0, px, px); }
  g.globalCompositeOperation = 'source-over';
  }
  const z = ZONAS[zona], pul = 1 + Math.sin(t * 1.4) * .05;
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = HW() ? .42 : .28;
  ctx.drawImage(glowSpr(HW() ? z.sun2 : z.a), cx - mr * 2.3 * pul, cy - mr * 2.3 * pul, mr * 4.6 * pul, mr * 4.6 * pul);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(moonC, cx - size * .725, cy - size * .725, size * 1.45, size * 1.45);
  // borde iluminado
  ctx.globalCompositeOperation = 'lighter';
  const rim = ctx.createLinearGradient(cx - mr, cy - mr, cx + mr, cy + mr); rim.addColorStop(0, rgba(z.a, 0)); rim.addColorStop(.6, rgba(z.a, .15)); rim.addColorStop(1, rgba(z.a, .6));
  ctx.strokeStyle = rim; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, mr * 1.005, 0, TAU); ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  LUNA = { x: cx, y: cy, r: mr };
}
let LUNA = { x: 0, y: 0, r: 0 };
function drawLayerSet(Ls, a, t) {
  if (!Ls || a <= 0) return;
  ctx.globalAlpha = a;
  drawArt(Ls.altos, .14, t, .55);
  // neblina entre capas para dar profundidad
  const hz2 = ctx.createLinearGradient(0, GROUND - GROUND * .3, 0, GROUND); hz2.addColorStop(0, 'rgba(5,8,18,0)'); hz2.addColorStop(1, rgba(ZONAS[Ls.z].a, .10));
  ctx.fillStyle = hz2; ctx.fillRect(0, GROUND - GROUND * .3, W, GROUND * .3);
  if (Ls.arboles) drawTira(Ls.arboles, .24);
  drawArt(Ls.bajos, .34, t, .8);
  if (Ls.tumbas) drawTira(Ls.tumbas, .5);
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
  if (HW()) {
    ctx.globalCompositeOperation = 'source-over';
    if (!lamparas) { const c = off(sp * 2, 60 * 2), g = c.getContext('2d'); g.scale(2, 2); g.strokeStyle = 'rgba(160,140,170,.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(sp / 2, 0); g.lineTo(sp / 2, 16); g.stroke(); g.globalAlpha = .7; g.drawImage(glowSpr('#ff7a1a'), sp / 2 - 22, 4, 44, 44); g.globalAlpha = 1; g.drawImage(spriteCalabaza(), sp / 2 - 11, 15, 22, 22); lamparas = c; }
    ctx.globalAlpha = .85 + .15 * Math.sin(t * 6);
    for (let x = o; x < W + sp; x += sp) ctx.drawImage(lamparas, x - sp / 2, CEIL - 4, sp, 60);
    ctx.globalAlpha = 1;
  } else for (let x = o; x < W + sp; x += sp) { const on = Math.sin(t * 4 + x * .01) > -.3; ctx.globalAlpha = on ? 1 : .3; ctx.drawImage(glowSpr(z.b), x - 9, CEIL - 17, 18, 18); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

function drawCoins(t) {
  for (const c of coinsArr) {
    if (c.x < camX - 40 || c.x > camX + W + 40) continue;
    const s = Math.cos(t * 4 + c.ph + c.x * .004); const w = Math.max(.15, Math.abs(s));
    if (HW()) { const b = Math.sin(t * 5 + c.ph) * 2.5, k = .8 + .2 * w; ctx.drawImage(spriteCalabazaG(), c.x - 30 * k, c.y - 30 + b, 60 * k, 60); }
    else ctx.drawImage(coinSpr, c.x - 32 * w, c.y - 32, 64 * w, 64);
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
    if (HW()) { drawGusano(e, l, t); continue; }
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
    if (HW()) { drawMurcielago(v, t); continue; }
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
    if (HW()) { drawCuchillo(m, t); continue; }
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
/* Ventana de confirmación con el estilo del juego (sustituye a confirm()) */
function confirma(o) {
  return new Promise(ok => {
    const m = $('#modal'), si = $('#mSi'), no = $('#mNo');
    $('#mIco').textContent = o.ico || '?'; $('#mIco').className = 'mIco' + (o.peligro ? ' peligro' : '');
    $('#mTit').textContent = o.titulo || '¿Seguro?'; $('#mTxt').innerHTML = o.html || '';
    si.textContent = o.si || 'Aceptar'; no.textContent = o.no || 'Cancelar';
    si.className = o.peligro ? 'btn peligro' : 'btn jugar peq';
    m.classList.remove('oculto'); m.classList.remove('sale'); void m.offsetWidth; m.classList.add('entra');
    try { Audio5.click(); } catch (e) {}
    const fin = r => { m.classList.add('sale'); setTimeout(() => { m.classList.add('oculto'); m.classList.remove('entra', 'sale'); }, 180); si.onclick = no.onclick = m.onclick = null; document.removeEventListener('keydown', tecla); ok(r); };
    const tecla = e => { if (e.key === 'Escape') fin(false); else if (e.key === 'Enter') fin(true); };
    si.onclick = () => fin(true); no.onclick = () => fin(false);
    m.onclick = e => { if (e.target === m) fin(false); };
    document.addEventListener('keydown', tecla);
    setTimeout(() => si.focus(), 50);
  });
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
const FRASES_N = ['¡Hola! Soy Lucas', 'Mantén pulsado para volar', 'Recoge datos y haz combos', 'Cuidado con los láseres', 'El turbo 5G lo arrasa todo', '¿Superas mi récord?', 'Futurmovil: fibra, móvil y TV'];
const FRASES_H = ['¡Feliz Halloween!', '¿Truco o trato?', 'Cuidado con los murciélagos', 'Esquiva los gusanos', '¡Vienen cuchillos!', 'Recoge calabazas y haz combos', 'Futurmovil: fibra, móvil y TV'];
const FRASES = (TEMA === 'halloween' ? FRASES_H : FRASES_N).slice();
let fraseI = 0, fraseTimer;
function goMenu() {
  state = 'menu'; L.vis = false; Audio5.mode('menu'); Audio5.thrustOff();
  if (temaPendiente) aplicaTema(temaPendiente);
  $('#hud').classList.add('oculto'); $('#btnPausa').classList.add('oculto');
  pintaCuenta(); $('#cuenta').innerHTML = ''; cargaHoy();
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
  if (!esMovil || standalone || document.fullscreenElement || document.webkitFullscreenElement) return;   // solo una vez: evita el aviso del navegador en cada partida
  const el = document.documentElement;
  try {
    const fs = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen && el.webkitRequestFullscreen();
    Promise.resolve(fs).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => {});
  } catch (e) {}
}
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
window.matchMedia('(orientation:portrait)').addEventListener && window.matchMedia('(orientation:portrait)').addEventListener('change', () => { if (enVertical()) pause(); setTimeout(resize, 250); });
function startGame() {
  if (['play', 'count', 'dying'].includes(state)) return;   // nunca reiniciar una partida en marcha
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // que la barra espaciadora no vuelva a pulsar el botón
  if (guardando) { toast('Espera un momento, guardando tu puntuación…'); return; }
  if (enVertical()) { pantallaJuego(); return; }
  if ($('#sInv').classList.contains('show')) return;
  if (!SES) { abrirLogin('entrar'); return; }
  PARTIDA = null; api('inicio', { token: SES.token }).then(d => { if (d.ok) PARTIDA = d.partida; else if (d.sesion === false) { SES = null; store('ses', null); } });
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

/* ---- contador en vivo: jugadores de hoy ---- */
let hoyPrev = { j: -1, p: -1 }, hoyT = 0;
function animaNum(el, de, a) {
  const t0 = performance.now(); el.classList.remove('salto'); void el.offsetWidth; if (de >= 0 && de !== a) el.classList.add('salto');
  (function f() { const k = Math.min(1, (performance.now() - t0) / 800), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(Math.max(0, de) + (a - Math.max(0, de)) * e).toLocaleString('es-ES'); if (k < 1) requestAnimationFrame(f); })();
}
function cargaHoy() {
  if (!CFG.API) return;
  clearTimeout(hoyT); hoyT = setTimeout(() => { if (state === 'menu') cargaHoy(); }, 60000);
  api('hoy').then(d => {
    if (!d.ok) return;
    $('#enVivo').classList.remove('oculto');
    $('#hoyJugTxt').textContent = d.jugadores === 1 ? 'piloto ha volado' : 'pilotos han volado';
    animaNum($('#hoyJug'), hoyPrev.j, d.jugadores); animaNum($('#hoyPar'), hoyPrev.p, d.partidas);
    hoyPrev = { j: d.jugadores, p: d.partidas };
    if (d.tema) aplicaTema(d.tema);
  });
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
let guardando = false;
function bloqueaOtra(si) {
  guardando = si; const b = $('#btnOtra'), j = $('#btnJugar');
  b.disabled = si; b.classList.toggle('guardando', si); b.innerHTML = si ? '<i class="spin"></i>Guardando…' : 'Otra vez';
  j.disabled = si; j.classList.toggle('guardando', si);
}
function enviar() {
  if (!lastResult || lastResult.pts <= 0 || !SES) return;
  if (!PARTIDA) { $('#envio').textContent = 'No se pudo validar la partida (sin conexión al empezar)'; return; }
  const r = lastResult, partida = PARTIDA, f = firma([SES.perfil.usuario, r.pts, r.m, r.d, r.dur, partida].join('|')); PARTIDA = null;
  $('#envio').textContent = 'Guardando en el ranking…';
  bloqueaOtra(true);
  const limite = new Promise(res => setTimeout(() => res({ ok: false, error: 'El ranking está tardando demasiado. Inténtalo más tarde.' }), 25000));
  Promise.race([api('enviar', { token: SES.token, puntos: r.pts, metros: r.m, datos: r.d, dur: r.dur, partida, firma: f }), limite])
    .then(d => {
      if (d.ok) {
        SES.perfil.partidas++; if (d.nuevoRecord) SES.perfil.record = r.pts; store('ses', SES);
        $('#envio').innerHTML = `Ranking semanal: puesto <b style="color:#19ff6a">#${d.puesto}</b>` + (d.nuevoRecord ? ' · <b style="color:#ffd23f">¡récord personal guardado!</b>' : '');
        (d.items || (d.item ? [d.item] : [])).forEach((it, i) => setTimeout(() => mostrarItemGanado(it, i > 0), i * 1400));
      } else $('#envio').textContent = d.error || 'No se pudo guardar';
    })
    .catch(() => $('#envio').textContent = 'Sin conexión con el ranking')
    .finally(() => bloqueaOtra(false));
}
let rkData = null, rkTab = 'semana';
function openRanking() {
  Audio5.init(); Audio5.click(); show('#sRanking', true); rkTab = 'semana';
  $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === rkTab));
  const ul = $('#rkLista');
  if (!CFG.API) { ul.innerHTML = '<li class="vacio">El ranking estará disponible muy pronto</li>'; return; }
  ul.innerHTML = '<li class="vacio">Cargando…</li>';
  api('top').then(d => { if (!d.ok) throw 0; rkData = d; aplicaCatalogo(d.catalogo); paintRanking(); }).catch(() => ul.innerHTML = '<li class="vacio">No se pudo cargar el ranking</li>');
}
function paintRanking() {
  const ul = $('#rkLista'); if (!rkData) return;
  const list = rkData[rkTab] || [], yo = (SES ? SES.perfil.usuario : '').toLowerCase();
  const pr = $('#premio');
  if (rkTab === 'semana' && rkData.premio) { const it = rkData.item && ITEMS[rkData.item.tipo]; pr.innerHTML = (it ? `<img src="${it.img}" alt="">` : '') + 'Premio de la semana: <b></b>'; pr.querySelector('b').textContent = rkData.premio; pr.classList.remove('oculto'); } else pr.classList.add('oculto');
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
const standalone = window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches || navigator.standalone;
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
  if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) { if (state === 'play') { holding = true; e.preventDefault(); } else if (['count', 'dying'].includes(state)) e.preventDefault(); else if (state === 'menu' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); startGame(); } }
  if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'play') pause(); else if (state === 'pause') resume(); }
  if (e.code === 'Enter' && state === 'over' && document.activeElement.tagName !== 'INPUT') startGame();
});
window.addEventListener('keyup', e => { if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) { holding = false; if (['play', 'count', 'dying', 'pause'].includes(state) && e.code === 'Space') e.preventDefault(); } });
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
document.addEventListener('pointerdown', () => { Audio5.init(); if (!enVertical()) pantallaJuego(); }, { once: true });


/* =========================================================
   FUEGO ANIMADO DE LUCAS EN EL MENÚ
   ========================================================= */
let hctx = null;
const FX_MENU = { cv: $('#heroFx'), img: $('#heroImg'), noz: [[.368, .945, 1], [.457, .96, 1.15], [.55, .945, 1]], parts: [] };   // toberas: x, y relativos a la imagen
const FX_RANK = { cv: $('#rankFx'), img: $('#rankImg'), noz: [[.245, .955, .9], [.36, .975, 1.05], [.487, .955, .9]], parts: [] };
const FX_AYUDA = { cv: $('#ayudaFx'), img: $('#ayudaImg'), noz: [[.27, .955, .9], [.37, .975, 1.05], [.478, .955, .9]], parts: [] };
FX_MENU.g = FX_MENU.cv.getContext('2d'); FX_RANK.g = FX_RANK.cv.getContext('2d'); FX_AYUDA.g = FX_AYUDA.cv.getContext('2d');
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
function drawHeroFire(dt, t, o) {
  hctx = o.g; const heroFx = o.cv, heroImg = o.img, NOZ = o.noz, hParts = o.parts;
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
let SES = load('ses', null), trasLogin = null, PARTIDA = null;
let trasSesion = null;   // si está definido, se ejecuta tras iniciar sesión en vez de empezar partida
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
  if (trasSesion) { const f = trasSesion; trasSesion = null; return f(); }
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
   ITEMS COLECCIONABLES Y SALA DE INVENTARIO
   ========================================================= */
const ITEMS = {
  calabaza: { nom: 'Calabaza Bot', img: 'img/items/calabaza.webp', ancho: 1 },
  copa_plata: { nom: 'Copa de Plata · Campeón semanal', img: 'img/items/copa_plata.webp', ancho: .95 },
  copa_oro: { nom: 'Copa de Oro · Récord histórico', img: 'img/items/copa_oro.webp', ancho: 1.05 }
};
let PREMIO = null, premioAvisado = false;
function aplicaCatalogo(lista) {   // trofeos creados desde el panel admin
  if (!Array.isArray(lista)) return;
  lista.forEach(c => { if (c && c.tipo && !ITEMS_BASE.includes(c.tipo)) ITEMS[c.tipo] = { nom: c.nom, img: c.img, ancho: c.ancho || 1, desc: c.desc || '', custom: true }; });
  store('cat', lista);
}
const ITEMS_BASE = Object.keys(ITEMS);
aplicaCatalogo(load('cat', []));
function cargaPremio() { if (CFG.API) api('top').then(d => { if (d.ok) { PREMIO = d.item || null; rkData = rkData || d; aplicaCatalogo(d.catalogo); if (d.tema) aplicaTema(d.tema); } }); }
function mostrarItemGanado(item, extra) {
  const it = ITEMS[item.tipo] || { nom: item.tipo, img: 'img/icon-192.png?v=2' };
  let box = $('#finItem');
  if (extra) { const c = box.cloneNode(true); c.id = ''; c.classList.add('finExtra'); c.querySelector('button').onclick = () => { show(null); abrirSala(); }; box.after(c); box = c; }
  else document.querySelectorAll('.finExtra').forEach(e => e.remove());
  box.classList.toggle('oro', item.tipo === 'copa_oro'); box.classList.toggle('plata', item.tipo === 'copa_plata');
  box.querySelector('small').textContent = item.tipo === 'copa_oro' ? '¡NUEVO RÉCORD HISTÓRICO!' : item.tipo === 'copa_plata' ? '¡CAMPEÓN DE LA SEMANA!' : '¡OBJETO CONSEGUIDO!';
  if (item.tipo.startsWith('copa')) confetti();
  box.querySelector('img').src = it.img; box.querySelector('b').textContent = it.nom; box.querySelector('code').textContent = 'ID ' + item.id;
  box.classList.remove('oculto'); box.style.animation = 'none'; void box.offsetWidth; box.style.animation = '';
  Audio5.record(); flash('#ff9a2b', .3); vib([40, 30, 80]);
  salaNuevos.add(item.id);
}

const Y_MIN = .3;   // los objetos no pueden subir por encima de la mitad alta (ahí está la barra superior)
let salaItems = [], salaNuevos = new Set(), salaCambios = new Map(), salaT = 0, salaZ = 1;
const salaBox = $('#salaBox'), salaCont = $('#salaItems');
function abrirSala() {
  if (!SES) return abrirLogin('entrar');
  Audio5.init(); Audio5.click();
  $('#sInv').classList.add('show'); $('#salaNom').textContent = SES.perfil.usuario;
  $('#itemInfo').classList.add('oculto'); $('#salaAyuda').style.opacity = 1;
  salaCont.innerHTML = '<div class="salaVacia">Cargando tu sala…</div>';
  api('inventario', { token: SES.token }).then(d => {
    if (!d.ok) { salaCont.innerHTML = '<div class="salaVacia">No se pudo cargar tu sala</div>'; return; }
    aplicaCatalogo(d.catalogo); salaItems = d.items; pintaSala();
  });
}
function cerrarSala() {
  guardaSala(true); $('#sInv').classList.remove('show'); $('#itemInfo').classList.add('oculto'); Audio5.click();
  if (state === 'over') show('#sFin', true); else if (state === 'pause') show('#sPausa', true); else goMenu();
}
function posPorDefecto(i) {   // colocación inicial ordenada sobre el suelo
  const fila = Math.floor(i / 7), col = i % 7;
  return { x: .22 + col * .095 + (fila % 2) * .045, y: Math.min(.97, .74 + fila * .07) };
}
function tamItem(y, tipo) { return (5.5 + 7 * Math.max(0, y - .45)) * ((ITEMS[tipo] || {}).ancho || 1); }   // % del ancho de la sala: más grande cuanto más cerca
function pintaSala() {
  salaCont.innerHTML = '';
  $('#salaCnt').textContent = salaItems.length;
  if (!salaItems.length) {
    const it = PREMIO && ITEMS[PREMIO.tipo];
    salaCont.innerHTML = `<div class="salaVacia">${it ? `<img src="${it.img}" alt="">` : ''}Tu sala está vacía.<br>${PREMIO ? `Haz más de <b>${PREMIO.minimo.toLocaleString('es-ES')}</b> puntos en una partida para conseguir tu primer objeto.` : 'Consigue objetos superando los retos semanales.'}</div>`;
    return;
  }
  let sinPos = 0;
  salaItems.forEach(o => { if (o.y != null && o.y < Y_MIN) { o.y = Y_MIN + .05; salaCambios.set(o.id, o); }
    if (o.x == null || o.y == null) { const p = posPorDefecto(sinPos++); o.x = p.x; o.y = p.y; salaCambios.set(o.id, o); } salaZ = Math.max(salaZ, (o.z || 0) + 1); });
  salaItems.forEach(o => {
    const it = ITEMS[o.tipo] || { nom: o.tipo, img: 'img/icon-192.png?v=2' };
    const el = document.createElement('div'); el.className = 'item' + (salaNuevos.has(o.id) ? ' nuevo' : ''); el.dataset.id = o.id;
    el.innerHTML = `<img src="${it.img}" alt="${it.nom}" draggable="false">`;
    salaCont.appendChild(el); colocaItem(el, o); arrastrable(el, o, it);
  });
  salaNuevos.clear();
  if (salaCambios.size) guardaSala();
}
function colocaItem(el, o) {
  el.style.left = (o.x * 100) + '%'; el.style.top = (o.y * 100) + '%';
  el.style.width = tamItem(o.y, o.tipo) + '%'; el.style.zIndex = Math.round(o.y * 1000) * 100 + (o.z || 0) % 100;
}
function arrastrable(el, o, it) {
  let ini = null;
  el.addEventListener('pointerdown', e => {
    e.preventDefault(); el.setPointerCapture(e.pointerId);
    const r = salaBox.getBoundingClientRect();
    ini = { px: e.clientX, py: e.clientY, x: o.x, y: o.y, w: r.width, h: r.height, movido: false };
    $('#itemInfo').classList.add('oculto');
  });
  el.addEventListener('pointermove', e => {
    if (!ini) return;
    const dx = e.clientX - ini.px, dy = e.clientY - ini.py;
    if (!ini.movido && Math.hypot(dx, dy) < 6) return;
    if (!ini.movido) { ini.movido = true; el.classList.add('arrastra'); o.z = salaZ++; $('#salaAyuda').style.opacity = 0; }
    o.x = clamp(ini.x + dx / ini.w, .03, .97); o.y = clamp(ini.y + dy / ini.h, Y_MIN, .995);
    colocaItem(el, o);
  });
  const fin = () => {
    if (!ini) return;
    if (ini.movido) { el.classList.remove('arrastra'); salaCambios.set(o.id, o); guardaSala(); Audio5.click(); }
    else infoItem(el, o, it);
    ini = null;
  };
  el.addEventListener('pointerup', fin); el.addEventListener('pointercancel', fin);
}
function infoItem(el, o, it) {
  const box = $('#itemInfo'), r = el.getBoundingClientRect(), sr = $('#sInv').getBoundingClientRect();
  box.querySelector('img').src = it.img; box.querySelector('b').textContent = it.nom;
  box.querySelector('code').textContent = 'ID ' + o.id;
  box.querySelector('small').textContent = o.fecha ? 'Conseguido el ' + new Date(o.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  box.style.left = (r.left + r.width / 2 - sr.left) + 'px'; box.style.top = Math.max(80, r.top - 8 - sr.top) + 'px';
  box.classList.remove('oculto'); box.style.animation = 'none'; void box.offsetWidth; box.style.animation = '';
  clearTimeout(box._t); box._t = setTimeout(() => box.classList.add('oculto'), 3500);
}
function guardaSala(ya) {
  clearTimeout(salaT);
  const enviar = () => {
    if (!salaCambios.size || !SES) return;
    const pos = [...salaCambios.values()].map(o => ({ id: o.id, x: o.x, y: o.y, z: o.z || 0 })); salaCambios.clear();
    const est = $('#salaEstado'); est.textContent = 'Guardando…'; est.classList.add('on');
    api('sala', { token: SES.token, pos }).then(d => { est.textContent = d.ok ? '✓ Guardado' : 'No se pudo guardar'; setTimeout(() => est.classList.remove('on'), 1500); });
  };
  if (ya) enviar(); else salaT = setTimeout(enviar, 900);
}
$('#btnInventario').onclick = abrirSala;
$('#btnSalaVolver').onclick = cerrarSala;
$('#btnVerSala').onclick = () => { show(null); abrirSala(); };
$('#sInv').addEventListener('pointerdown', e => { if (!e.target.closest('.item')) $('#itemInfo').classList.add('oculto'); });
window.addEventListener('keydown', e => { if (e.code === 'Escape' && $('#sInv').classList.contains('show')) cerrarSala(); });
window.addEventListener('pagehide', () => guardaSala(true));
cargaPremio();

/* =========================================================
   ARRANQUE
   ========================================================= */
let last = performance.now();
function loop(now) {
  const dt = Math.min(.034, (now - last) / 1000); last = now;
  update(dt); render();
  if (state === 'menu' || state === 'load') drawHeroFire(dt, now / 1000, FX_MENU);
  if ($('#sRanking').classList.contains('show')) drawHeroFire(dt, now / 1000, FX_RANK);
  if ($('#sAyuda').classList.contains('show')) drawHeroFire(dt, now / 1000, FX_AYUDA);
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

/* ---- actualización automática: si hay una versión nueva, se recarga sola en el menú ---- */
const VERSION = 32;   // subir este número (y version.json) en cada actualización
let nuevaVersion = 0, actualizando = false, ultVer = 0;
function compruebaVersion(forzar) {
  if (actualizando || (!forzar && Date.now() - ultVer < 30000)) return; ultVer = Date.now();
  fetch('version.json?n=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null)
    .then(d => { if (d && Number(d.v) > VERSION) { nuevaVersion = Number(d.v); intentaActualizar(); } }).catch(() => {});
}
function libreParaActualizar() {
  return state === 'menu' && $('#sMenu').classList.contains('show') && !guardando && !$('#sInv').classList.contains('show')
    && $('#modal').classList.contains('oculto') && !$('#sAdmin').classList.contains('show');
}
function intentaActualizar() {
  if (!nuevaVersion || actualizando || !libreParaActualizar()) return;
  actualizando = true;
  const ov = $('#actualiza'); ov.classList.remove('oculto');
  (async () => {
    try { const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); if (reg) await reg.update(); } catch (e) {}
    try { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } catch (e) {}
  })().finally(() => setTimeout(() => location.reload(), 1400));
}
setTimeout(() => compruebaVersion(true), 4000);
setInterval(() => compruebaVersion(true), 120000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') compruebaVersion(); });
setInterval(intentaActualizar, 3000);   // si llegó durante una partida, se aplica al volver al menú

/* =========================================================
   PANEL DE ADMINISTRACIÓN · 10 toques a Lucas en 5 s + llave NFC
   ========================================================= */
(() => {
  let toques = [], ADM = null, ADMD = null, nfcCtrl = null;
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = n => (Number(n) || 0).toLocaleString('es-ES');
  const itemDe = t => ITEMS[t] || { nom: t, img: 'img/icon-192.png?v=2' };
  const heroe = $('.heroLucas');
  heroe.addEventListener('pointerdown', () => {
    if (state !== 'menu') return;
    const t = performance.now(); toques = toques.filter(x => t - x < 5000); toques.push(t);
    if (toques.length >= 10) { toques = []; abrirAdmin(); }
  });

  function msg(t, cls) { const m = $('#admMsg'); m.textContent = t; m.className = cls || ''; }
  function anim(cls) { $('#nfcAnim').className = 'nfcAnim ' + (cls || ''); }
  const hayNfc = 'NDEFReader' in window;
  let modoQr = '', qrPoll = 0, qrFin = 0, leyendo = false;
  function vistaLlave(titulo, texto, cls) {
    $('#admPanel').classList.add('oculto'); $('#admLlave').classList.remove('oculto');
    $('#admLlave h2').textContent = titulo; msg(texto, cls); anim('');
    $('#admLlave .admCerrar').textContent = 'Cancelar';
    $('#admQr').classList.add('oculto'); $('#btnNfc').classList.remove('oculto'); $('#btnAdmLogin').classList.add('oculto');
  }
  function abrirAdmin() {
    Audio5.init(); Audio5.record(); vib([30, 40, 30]);
    show('#sAdmin');
    if (ADM) return verPanel();
    if (!hayNfc && !modoQr) return mostrarQr();          // ordenador: se autoriza con el móvil
    vistaLlave(modoQr ? 'Autorizar ordenador' : 'Acceso administrador', modoQr ? 'Pasa tu llave para dar acceso al ordenador' : 'Acerca tu llave NFC a la parte trasera del móvil');
    if (!SES) { msg('Primero inicia sesión con la cuenta de administrador.', 'err'); $('#btnNfc').classList.add('oculto'); $('#btnAdmLogin').classList.remove('oculto'); return; }
    if (!hayNfc) { msg('Este navegador no puede leer NFC. Usa Chrome en un móvil Android con NFC activado.', 'err'); return; }
    escanear(true);
  }
  function pararNfc() { if (nfcCtrl) { nfcCtrl.abort(); nfcCtrl = null; } leyendo = false; }
  function cerrarAdmin() {
    pararNfc(); clearInterval(qrPoll); qrPoll = 0; Audio5.click();
    if (modoQr) { modoQr = ''; document.body.classList.remove('admQr'); }
    goMenu();
  }
  $$('.admCerrar').forEach(b => b.onclick = cerrarAdmin);
  $('#btnAdmLogin').onclick = () => { trasSesion = () => { show(null); abrirAdmin(); }; abrirLogin('entrar'); };

  /* El lector NFC se mantiene encendido mientras esta pantalla está abierta:
     así el móvil no abre la web que la llave lleva grabada (Chrome tiene el lector en exclusiva). */
  async function escanear(auto) {
    if (!SES || !hayNfc) return;
    try {
      if (!nfcCtrl) {
        nfcCtrl = new AbortController();
        const r = new NDEFReader();
        await r.scan({ signal: nfcCtrl.signal });
        r.onreadingerror = () => { if (leyendo) return; anim('err'); msg('No pude leer esa llave. Vuelve a intentarlo (puede que no sea compatible).', 'err'); };
        r.onreading = e => leida(e.serialNumber || '');
      }
      anim('busca'); msg(modoQr ? 'Esperando llave… acércala para autorizar el ordenador' : 'Esperando llave… acércala al móvil');
    } catch (err) {
      pararNfc(); anim('');
      if (auto) msg('Pulsa «Escanear llave» y acerca tu llave NFC a la parte trasera del móvil');
      else { anim('err'); msg(err && err.name === 'NotAllowedError' ? 'Necesito permiso para usar NFC. Acéptalo y vuelve a pulsar.' : 'No se pudo activar el NFC. Comprueba que está encendido en el móvil.', 'err'); }
    }
  }
  $('#btnNfc').onclick = () => { if (!SES) return; escanear(false); };
  function leida(llave) {
    if (leyendo || ADM && !modoQr) return;       // ignora lecturas repetidas (el lector sigue activo)
    if (!llave) { anim('err'); return msg('La llave no tiene número de serie legible.', 'err'); }
    leyendo = true; anim('busca'); msg('Comprobando llave…');
    api('admin_entrar', { token: SES.token, llave, qr: modoQr || undefined }).then(d => {
      if (!d.ok) { leyendo = false; anim('err'); vib([80, 60, 80]); return msg(d.error || 'Llave no autorizada', 'err'); }
      anim('ok'); vib([30, 30, 120]); Audio5.record();
      if (modoQr) { $('#btnNfc').classList.add('oculto'); msg('✓ Ordenador autorizado. Ya puedes seguir en el PC.', 'ok'); $('#admLlave .admCerrar').textContent = 'Cerrar'; return; }
      ADM = d.admin;
      msg(d.nueva ? '¡Llave registrada como llave de administrador!' : '¡Acceso concedido!', 'ok');
      setTimeout(verPanel, 700);
    });
  }

  /* ---- ordenador sin NFC: QR para autorizar con el móvil ---- */
  function cargaQrLib() {
    if (window.qrcode) return Promise.resolve();
    return new Promise((ok, ko) => { const s = document.createElement('script'); s.src = 'js/qrcode.min.js?v=1'; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
  }
  function mostrarQr() {
    vistaLlave('Acceso administrador', 'Generando código…');
    $('#btnNfc').classList.add('oculto'); $('#admQr').classList.remove('oculto'); $('#admQrImg').innerHTML = '';
    clearInterval(qrPoll);
    Promise.all([api('qr_nuevo'), cargaQrLib()]).then(([d]) => {
      if (!d.ok) return msg(d.error || 'No se pudo generar el código', 'err');
      const url = CFG.URL.replace(/\/?$/, '/') + '?admqr=' + d.code;
      const q = qrcode(0, 'M'); q.addData(url); q.make(); $('#admQrImg').innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
      msg('Escanea este código con tu móvil y pasa la llave NFC en el móvil'); anim('busca');
      qrFin = Date.now() + d.seg * 1000;
      qrPoll = setInterval(() => {
        const queda = Math.max(0, Math.round((qrFin - Date.now()) / 1000));
        $('#admQrT').textContent = queda ? `Caduca en ${Math.floor(queda / 60)}:${String(queda % 60).padStart(2, '0')}` : '';
        if (!queda) { clearInterval(qrPoll); anim(''); msg('El código ha caducado.', 'err'); $('#admQrImg').innerHTML = '<button class="btn sec" id="btnQrNuevo">Generar otro código</button>'; $('#btnQrNuevo').onclick = mostrarQr; return; }
        if (queda % 2) return;
        api('qr_estado', { code: d.code }).then(r => {
          if (!r.ok || !r.admin || !qrPoll) return;
          clearInterval(qrPoll); qrPoll = 0; ADM = r.admin; anim('ok'); Audio5.record(); msg('¡Acceso concedido desde el móvil!', 'ok'); setTimeout(verPanel, 700);
        });
      }, 1000);
    }).catch(() => msg('No se pudo generar el código QR. Revisa la conexión.', 'err'));
  }
  // el móvil abre el juego desde el QR del ordenador
  const qrParam = new URLSearchParams(location.search).get('admqr');
  if (qrParam && /^[A-Za-z0-9]{20,64}$/.test(qrParam)) {
    modoQr = qrParam; document.body.classList.add('admQr');
    history.replaceState(null, '', location.pathname);
    const espera = setInterval(() => { if (state === 'menu') { clearInterval(espera); abrirAdmin(); } }, 300);
  }

  function adm(op, datos) {
    return api('admin', Object.assign({ admin: ADM, op }, datos || {})).then(d => {
      if (d.caducada) { ADM = null; leyendo = false; toast('La sesión de administrador ha caducado'); abrirAdmin(); }
      return d;
    });
  }
  function verPanel() {
    $('#admLlave').classList.add('oculto'); $('#admPanel').classList.remove('oculto');
    recargar();
  }
  function recargar() {
    $('#admCat').innerHTML = '<p class="admNota">Cargando…</p>';
    return adm('resumen').then(d => { if (!d.ok) return toast(d.error || 'Error'); ADMD = d; aplicaCatalogo(d.catalogo); pintaTodo(); });
  }
  $$('#admTabs button').forEach(b => b.onclick = () => {
    $$('#admTabs button').forEach(x => x.classList.toggle('on', x === b));
    $$('.admTab').forEach(x => x.classList.toggle('on', x.dataset.t === b.dataset.t)); Audio5.click();
  });
  function pintaTodo() { pintaCatalogo(); pintaSelects(); pintaPremios(); pintaJugadores(); cargaCanjes(); pintaTemas(); }

  /* ---- trofeos ---- */
  function pintaCatalogo() {
    $('#admCat').innerHTML = Object.keys(ITEMS).map(t => { const it = ITEMS[t];
      return `<div class="tr ${it.custom ? '' : 'base'}" data-t="${esc(t)}"><img src="${esc(it.img)}" alt=""><b>${esc(it.nom)}</b><code>${esc(t)}</code></div>`; }).join('');
    $$('#admCat .tr:not(.base)').forEach(el => el.onclick = () => editarTrofeo(el.dataset.t));
  }
  let pngB64 = '';
  const fT = $('#fTrofeo');
  function limpiaForm() {
    fT.reset(); fT.tipo.value = ''; pngB64 = ''; $('#tPrev').removeAttribute('src'); $('#tPrevTxt').style.display = '';
    $('#tTit').textContent = 'Nuevo trofeo'; $('#tBtn').textContent = 'Crear trofeo'; $('#tCancel').classList.add('oculto'); $('#tAncho').textContent = '100%';
    $$('#admCat .tr').forEach(x => x.classList.remove('edit'));
  }
  function editarTrofeo(t) {
    const it = ITEMS[t]; limpiaForm();
    fT.tipo.value = t; fT.nombre.value = it.nom; fT.desc.value = it.desc || ''; fT.ancho.value = it.ancho || 1; $('#tAncho').textContent = Math.round((it.ancho || 1) * 100) + '%';
    $('#tPrev').src = it.img; $('#tPrevTxt').style.display = 'none';
    $('#tTit').textContent = 'Editar trofeo: ' + it.nom; $('#tBtn').textContent = 'Guardar cambios'; $('#tCancel').classList.remove('oculto');
    $(`#admCat .tr[data-t="${t}"]`).classList.add('edit'); fT.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  $('#tCancel').onclick = limpiaForm;
  fT.ancho.oninput = () => $('#tAncho').textContent = Math.round(fT.ancho.value * 100) + '%';
  $('#tPng').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.type !== 'image/png') { toast('La imagen tiene que ser PNG'); return; }
    const img = new Image();
    img.onload = () => {
      let max = 512, url;
      do {   // reduce a máx. 512 px conservando la transparencia
        const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); url = c.toDataURL('image/png'); max -= 96;
      } while (url.length > 1500000 && max > 160);
      pngB64 = url; $('#tPrev').src = url; $('#tPrevTxt').style.display = 'none'; URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(f);
  };
  fT.onsubmit = e => {
    e.preventDefault();
    const editando = !!fT.tipo.value;
    if (!editando && !pngB64) return toast('Sube la imagen PNG del trofeo');
    const b = $('#tBtn'); b.disabled = true; b.textContent = 'Guardando…';
    const datos = { nombre: fT.nombre.value, desc: fT.desc.value, ancho: fT.ancho.value };
    if (pngB64) datos.png = pngB64;
    (editando ? adm('editarTrofeo', Object.assign({ tipo: fT.tipo.value }, datos)) : adm('crearTrofeo', datos)).then(d => {
      b.disabled = false;
      if (!d.ok) { b.textContent = editando ? 'Guardar cambios' : 'Crear trofeo'; return toast(d.error || 'No se pudo guardar'); }
      toast(editando ? 'Trofeo actualizado' : '¡Trofeo creado!'); Audio5.record(); limpiaForm(); recargar();
    });
  };

  /* ---- premio semanal ---- */
  function opciones(sel, extra) {
    return extra + Object.keys(ITEMS).map(t => `<option value="${esc(t)}"${t === sel ? ' selected' : ''}>${esc(ITEMS[t].nom)}</option>`).join('');
  }
  function pintaSelects() {
    $('#fRegalar').tipo.innerHTML = opciones('', '<option value="">Elige trofeo…</option>');
    const b = ADMD.base, fB = $('#fBase');
    fB.tipo.innerHTML = opciones(b.tipo, `<option value=""${b.tipo ? '' : ' selected'}>Sin premio</option>`);
    fB.minimo.value = b.minimo; fB.maxDia.value = b.maxDia; fB.texto.value = b.texto;
    $('#admUsuarios').innerHTML = ADMD.jugadores.map(j => `<option value="${esc(j.usuario)}">`).join('');
  }
  $('#fBase').onsubmit = e => {
    e.preventDefault(); const f = e.target;
    adm('config', { tipo: f.tipo.value, minimo: f.minimo.value, maxDia: f.maxDia.value, texto: f.texto.value }).then(d => toast(d.ok ? 'Premio por defecto guardado' : d.error));
  };
  function pintaPremios() {
    $('#admSemanas').innerHTML = ADMD.semanas.map((s, i) => { const p = s.prog;
      return `<div class="admSem${i === 0 ? ' actual' : ''}" data-s="${s.semana}">
        <div class="sl">${i === 0 ? '<em>ESTA SEMANA</em>' : ''}<b>Semana ${Number(s.semana.split('W')[1])}</b><small>${s.desde} – ${s.hasta}</small></div>
        <select>${opciones(p ? p.tipo : '__def', `<option value="__def"${p ? '' : ' selected'}>Por defecto</option><option value=""${p && !p.tipo ? ' selected' : ''}>Sin premio</option>`)}</select>
        <input type="number" min="0" step="100" placeholder="Puntos mín." value="${p && p.minimo ? p.minimo : ''}">
        <input maxlength="200" placeholder="Texto para los jugadores" value="${esc(p ? p.texto : '')}">
        <button class="btn sec">Guardar</button></div>`; }).join('');
    $$('#admSemanas .admSem').forEach(row => {
      const [sel, min, txt] = row.querySelectorAll('select,input'), b = row.querySelector('button');
      b.onclick = () => {
        b.textContent = '…';
        const datos = sel.value === '__def' ? { semana: row.dataset.s, borrar: true } : { semana: row.dataset.s, tipo: sel.value, minimo: min.value, texto: txt.value };
        adm('programar', datos).then(d => { b.textContent = d.ok ? '✓ Guardado' : 'Error'; b.classList.toggle('ok', !!d.ok); if (!d.ok) toast(d.error); setTimeout(() => { b.textContent = 'Guardar'; b.classList.remove('ok'); }, 1800); });
      };
    });
  }

  /* ---- jugadores ---- */
  function pintaJugadores() {
    const q = $('#admBuscar').value.trim().toLowerCase();
    const lista = ADMD.jugadores.filter(j => !q || j.usuario.toLowerCase().includes(q) || j.email.toLowerCase().includes(q));
    $('#jugCnt').textContent = `(${ADMD.jugadores.length} en total · ${ADMD.jugadores.reduce((a, j) => a + Object.values(j.items).reduce((x, y) => x + y, 0), 0)} objetos repartidos)`;
    $('#admJug').innerHTML = lista.map(j => { const tot = Object.values(j.items).reduce((a, b) => a + b, 0);
      return `<div class="jg" data-id="${esc(j.id)}"><div class="fila1">
        <span class="jPos">${ADMD.jugadores.indexOf(j) + 1}</span>
        <span class="jNom"><b>${esc(j.usuario)}${j.google ? ' <small>· Google</small>' : ''}</b><small>${esc(j.email)}</small></span>
        <span class="jNum">${fmt(j.record)}<small>récord</small></span>
        <span class="jNum">${fmt(j.partidas)}<small>partidas</small></span>
        <span class="jIco">${tot ? Object.keys(j.items).map(t => `<span title="${esc(itemDe(t).nom)}"><img src="${esc(itemDe(t).img)}" alt="">×${j.items[t]}</span>`).join('') : '<small style="color:#678">sin objetos</small>'}</span>
      </div><div class="det oculto"></div></div>`; }).join('') || '<p class="admNota">Ningún jugador coincide.</p>';
    $$('#admJug .fila1').forEach(f => f.onclick = () => detalle(f.parentNode));
  }
  $('#admBuscar').oninput = () => ADMD && pintaJugadores();
  function detalle(el) {
    const det = el.querySelector('.det');
    if (!det.classList.contains('oculto')) return det.classList.add('oculto');
    det.classList.remove('oculto'); det.innerHTML = 'Cargando objetos…';
    adm('itemsJugador', { id: el.dataset.id }).then(d => {
      if (!d.ok) return det.textContent = 'Error';
      det.innerHTML = d.items.length ? d.items.map(o => `<div class="it"><img src="${esc(itemDe(o.tipo).img)}" alt=""><code>${esc(o.id)}</code><span>${esc(itemDe(o.tipo).nom)} · ${o.fecha ? new Date(o.fecha).toLocaleDateString('es-ES') : ''} · ${esc(o.origen)}</span><button data-id="${esc(o.id)}">Quitar</button></div>`).join('') : 'Este jugador aún no tiene objetos.';
      det.querySelectorAll('button').forEach(b => b.onclick = ev => {
        ev.stopPropagation();
        confirma({ ico: '🗑', peligro: true, titulo: 'Quitar objeto', html: `¿Quitar el objeto <b>${esc(b.dataset.id)}</b> a este jugador?<br><small>Desaparecerá de su sala.</small>`, si: 'Quitar' }).then(si => {
          if (si) adm('quitarItem', { id: b.dataset.id }).then(r => { if (r.ok) { toast('Objeto quitado'); recargar(); } else toast(r.error); });
        });
      });
    });
  }

  /* ---- temas ---- */
  function pintaTemas() { const act = (ADMD && ADMD.tema) || 'normal'; $$('#admTemas .tema[data-tema]').forEach(b => b.classList.toggle('on', b.dataset.tema === act)); }
  $$('#admTemas .tema[data-tema]').forEach(b => b.onclick = () => {
    const t = b.dataset.tema; if (ADMD && ADMD.tema === t) return;
    const nom = t === 'halloween' ? 'Halloween 🎃' : 'Normal';
    confirma({ ico: t === 'halloween' ? '🎃' : '🤖', titulo: 'Cambiar tema', si: 'Activar ' + (t === 'halloween' ? 'Halloween' : 'Normal'), no: 'Cancelar',
      html: `El juego pasará a modo <b>${nom}</b> para todos los jugadores.` }).then(si => {
      if (!si) return;
      adm('tema', { tema: t }).then(d => { if (!d.ok) return toast(d.error || 'No se pudo cambiar'); ADMD.tema = t; pintaTemas(); aplicaTema(t); toast('Tema ' + nom + ' activado'); Audio5.record(); });
    });
  });

  /* ---- canjear (premio en mano → se elimina el trofeo) ---- */
  const fechaC = t => t ? new Date(t).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  function cargaCanjes() {
    adm('canjes').then(d => {
      if (!d.ok) return;
      $('#canjeLog').innerHTML = d.canjes.length ? d.canjes.map(c => { const it = itemDe(c.tipo);
        return `<div class="cjL"><img src="${esc(it.img)}" alt=""><span><b>${esc(it.nom)}</b> <code>${esc(c.id)}</code><small>${esc(c.usuario)} · ${fechaC(c.fecha)}${c.nota ? ' · ' + esc(c.nota) : ''}</small></span></div>`; }).join('')
        : '<p class="admNota">Todavía no se ha canjeado ningún trofeo.</p>';
    });
  }
  function pintaCanje(items, usuario) {
    const res = $('#canjeRes');
    if (!items.length) { res.innerHTML = `<p class="admNota">${esc(usuario)} no tiene trofeos para canjear.</p>`; return; }
    res.innerHTML = items.map(o => { const it = itemDe(o.tipo);
      return `<div class="cjI"><img src="${esc(it.img)}" alt=""><div><b>${esc(it.nom)}</b><code>${esc(o.id)}</code><small>De <b>${esc(o.usuario || usuario)}</b> · conseguido ${fechaC(o.fecha)}${o.origen ? ' · ' + esc(o.origen) : ''}</small></div>
        <button class="btn peligro" data-id="${esc(o.id)}" data-u="${esc(o.usuario || usuario)}" data-t="${esc(o.tipo)}">Canjear</button></div>`; }).join('');
    $$('#canjeRes [data-id]').forEach(b => b.onclick = () => canjear(b));
  }
  function canjear(b) {
    const it = itemDe(b.dataset.t);
    confirma({ ico: '🎁', peligro: true, titulo: 'Canjear trofeo', si: 'Canjear y eliminar', no: 'Cancelar',
      html: `<div class="mItems" style="justify-content:center"><span style="width:90px"><img src="${esc(it.img)}" alt="" style="width:64px;height:64px"><i>${esc(it.nom)}</i></span></div>
        <p>Vas a entregar el premio en mano a <b>${esc(b.dataset.u)}</b> y su trofeo <b>${esc(b.dataset.id)}</b> se eliminará de su sala.</p>
        <input id="mNota" class="mNota" maxlength="200" placeholder="¿Qué premio le das? (opcional)">` }).then(si => {
      if (!si) return;
      const nota = ($('#mNota') || {}).value || '';
      b.disabled = true; b.textContent = '…';
      adm('canjear', { id: b.dataset.id, nota }).then(d => {
        if (!d.ok) { b.disabled = false; b.textContent = 'Canjear'; return toast(d.error || 'No se pudo canjear'); }
        toast(`Canjeado: ${d.id} de ${d.usuario}`); Audio5.record(); vib([30, 30, 90]);
        const card = b.closest('.cjI'); card.classList.add('fuera'); setTimeout(() => card.remove(), 400);
        cargaCanjes(); recargar();
      });
    });
  }
  $('#fCanje').onsubmit = e => {
    e.preventDefault(); const q = e.target.q.value.trim(); if (!q) return;
    const res = $('#canjeRes'); res.innerHTML = '<p class="admNota">Buscando…</p>';
    if (/^LB-/i.test(q)) return adm('buscarItem', { id: q }).then(d => d.ok ? pintaCanje(d.items) : res.innerHTML = `<p class="admNota err">${esc(d.error)}</p>`);
    const j = ADMD && ADMD.jugadores.find(x => x.usuario.toLowerCase() === q.toLowerCase());
    if (!j) { res.innerHTML = '<p class="admNota err">No hay ningún jugador ni trofeo con ese nombre o ID.</p>'; return; }
    adm('itemsJugador', { id: j.id }).then(d => d.ok ? pintaCanje(d.items, j.usuario) : res.innerHTML = '<p class="admNota err">Error al cargar</p>');
  };

  /* ---- regalar ---- */
  $('#fRegalar').onsubmit = e => {
    e.preventDefault(); const f = e.target, b = f.querySelector('button'); b.disabled = true;
    adm('regalar', { usuario: f.usuario.value.trim(), tipo: f.tipo.value, motivo: f.motivo.value }).then(d => {
      b.disabled = false;
      if (!d.ok) return toast(d.error || 'No se pudo regalar');
      toast(`¡Regalado a ${d.usuario}! ID ${d.id}`); Audio5.record(); f.reset(); recargar();
    });
  };
})();

/* =========================================================
   JUGADORES CONECTADOS E INTERCAMBIO DE OBJETOS
   ========================================================= */
(() => {
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const itemDe = t => ITEMS[t] || { nom: t, img: 'img/icon-192.png?v=2' };
  const salaAbierta = () => $('#sInv').classList.contains('show');
  let ONLINE = [], TR = null, pingT = 0, verT = 0, ofertaT = 0, miOferta = new Set(), vistoFin = '', avisoCerrado = '';

  /* ---- ping: conectados + trato pendiente ---- */
  function ping() {
    clearTimeout(pingT);
    const sig = salaAbierta() ? 4000 : 20000;
    if (!SES || !CFG.API || document.visibilityState !== 'visible') { pingT = setTimeout(ping, sig); return; }
    api('ping', { token: SES.token, sala: salaAbierta() }).then(d => {
      if (d.ok) { ONLINE = d.online || []; pintaOnline(); recibe(d.trato); }
      pingT = setTimeout(ping, salaAbierta() ? 4000 : 20000);
    });
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') ping(); });
  setTimeout(ping, 2500);

  function pintaOnline() {
    const n = ONLINE.length, c = $('#onCnt'); c.textContent = n; c.classList.toggle('cero', !n);
    if (vistaAct() === 'lista') pintaLista();
  }
  function pintaLista() {
    $('#tLista').innerHTML = ONLINE.length ? ONLINE.map(j => `<div class="tJug"><span class="av">${esc(j.usuario[0].toUpperCase())}</span><b>${esc(j.usuario)}<small>${j.sala ? 'En su sala ahora' : 'Conectado'}</small></b><button class="btn sec" data-inv="${esc(j.usuario)}">Intercambiar</button></div>`).join('')
      : '<div class="tVacio">Ahora mismo no hay nadie más conectado.<br>Cuando entre alguien aparecerá aquí.</div>';
    $$('#tLista [data-inv]').forEach(b => b.onclick = () => invitar(b.dataset.inv, b));
  }

  /* ---- panel ---- */
  function vista(v) { $('#tPanel').classList.remove('oculto'); $$('#tPanel .tVista').forEach(x => x.classList.toggle('on', x.dataset.v === v)); }
  function vistaAct() { if ($('#tPanel').classList.contains('oculto')) return ''; const v = $('#tPanel .tVista.on'); return v ? v.dataset.v : ''; }
  function cierraPanel() { $('#tPanel').classList.add('oculto'); clearInterval(verT); verT = 0; }
  $('#btnTrueque').onclick = () => {
    Audio5.click(); $('#btnTrueque').classList.remove('aviso');
    if (TR && (TR.estado === 'invitado' || TR.estado === 'abierto')) return muestraTrato(TR);
    vista('lista'); pintaLista(); ping();
  };
  $$('#tPanel [data-tcerrar]').forEach(b => b.onclick = () => { Audio5.click(); cierraPanel(); });
  $$('#tPanel [data-tcancelar]').forEach(b => b.onclick = () => {
    if (!TR) return cierraPanel();
    if (TR.estado !== 'abierto') return op('cancelar');
    confirma({ ico: '✕', peligro: true, titulo: 'Cancelar intercambio', html: `¿Seguro que quieres cancelar el intercambio con <b>${esc(TR.otro)}</b>?`, si: 'Sí, cancelar', no: 'Seguir' }).then(si => { if (si && TR) op('cancelar'); });
  });

  function op(o, datos) {
    if (!TR) return Promise.resolve();
    return api('trato', Object.assign({ token: SES.token, op: o, id: TR.id }, datos || {})).then(d => { if (d.ok) recibe(d.trato, true); else toast(d.error || 'Error'); return d; });
  }
  function invitar(usuario, b) {
    b.disabled = true; b.textContent = '…';
    api('trato', { token: SES.token, op: 'invitar', a: usuario }).then(d => {
      b.disabled = false; b.textContent = 'Intercambiar';
      if (!d.ok) return toast(d.error || 'No se pudo invitar');
      Audio5.click(); recibe(d.trato, true);
    });
  }

  /* ---- llega el estado del trato (por ping o por una acción) ---- */
  function recibe(t, directo) {
    if (!t) { if (TR && (TR.estado === 'invitado' || TR.estado === 'abierto') && !directo) { /* desapareció: caducó */ fin({ estado: 'caducado', otro: TR.otro, msg: '' }); } return; }
    const antes = TR; TR = t;
    if (t.estado === 'invitado' || t.estado === 'abierto') {
      if (t.estado === 'abierto' && (!antes || antes.id !== t.id || antes.estado !== 'abierto')) miOferta = new Set(t.mio.map(o => o.id));
      if (salaAbierta()) {
        $('#tAviso').classList.add('oculto');
        const v = vistaAct();
        if (t.estado === 'abierto' || v === 'espera' || v === 'invita' || directo || !t.invitaYo) muestraTrato(t);
      } else if (state !== 'play' && avisoCerrado !== t.id + t.estado) aviso(t);
      if (!verT && salaAbierta() && vistaAct() && vistaAct() !== 'lista') verT = setInterval(() => op('ver'), 2000);
    } else if (vistoFin !== t.id) fin(t);
  }
  function muestraTrato(t) {
    $$('#tPanel .tOtro').forEach(e => e.textContent = t.otro);
    if (t.estado === 'invitado') { vista(t.invitaYo ? 'espera' : 'invita'); }
    else { vista('trato'); pintaTrato(t); }
    if (!verT) verT = setInterval(() => op('ver'), 2000);
  }
  $('#tSi').onclick = () => { Audio5.click(); op('responder', { si: true }); };
  $('#tNo').onclick = () => { Audio5.click(); op('responder', { si: false }); };

  function tarjeta(o, extra) { const it = itemDe(o.tipo); return `<div class="tIt ${extra || ''}" data-id="${esc(o.id)}" title="${esc(it.nom)} · ${esc(o.id)}"><img src="${esc(it.img)}" alt=""><span>${esc(it.nom)}</span></div>`; }
  function pintaTrato(t) {
    const mio = salaItems.filter(o => miOferta.has(o.id));
    $('#tMio').innerHTML = mio.map(o => tarjeta(o)).join(''); $('#tMioN').textContent = mio.length ? `(${mio.length})` : '';
    $('#tSuyo').innerHTML = t.suyo.map(o => tarjeta(o)).join(''); $('#tSuyoN').textContent = t.suyo.length ? `(${t.suyo.length})` : '';
    $('#tInv').innerHTML = salaItems.length ? salaItems.map(o => tarjeta(o, miOferta.has(o.id) ? 'sel' : '')).join('') : '<div class="tVacio">No tienes objetos todavía</div>';
    $$('#tInv .tIt, #tMio .tIt').forEach(el => el.onclick = () => cambiaOferta(el.dataset.id));
    const yo = $('#tOkYo'), otro = $('#tOkOtro');
    yo.textContent = t.okYo ? 'Tú: ✓ aceptado' : 'Tú: sin aceptar'; yo.className = t.okYo ? 'ok' : '';
    otro.textContent = t.okOtro ? `${t.otro}: ✓ aceptado` : `${t.otro}: sin aceptar`; otro.className = t.okOtro ? 'ok' : '';
    $('#tMsg').textContent = t.msg && !/^(¡|Intercambio)/.test(t.msg) ? t.msg : '';
    const b = $('#tAceptar'), vacio = !t.mio.length && !t.suyo.length, pendiente = !!ofertaT;
    b.disabled = t.okYo || vacio || pendiente;
    b.textContent = t.okYo ? (t.okOtro ? 'Cerrando…' : 'Esperando…') : 'Aceptar trato';
  }
  function cambiaOferta(id) {
    if (!TR || TR.estado !== 'abierto') return;
    miOferta.has(id) ? miOferta.delete(id) : miOferta.add(id); Audio5.click();
    TR.okYo = false; TR.okOtro = false;
    clearTimeout(ofertaT); ofertaT = setTimeout(() => { ofertaT = 0; op('ofrecer', { items: [...miOferta] }); }, 600);
    pintaTrato(TR);
  }
  $('#tAceptar').onclick = () => {
    if (!TR) return;
    const fila = (lista, vacio) => lista.length ? `<div class="mItems">${lista.map(o => { const it = itemDe(o.tipo); return `<span title="${esc(it.nom)} · ${esc(o.id)}"><img src="${esc(it.img)}" alt=""><i>${esc(it.nom)}</i></span>`; }).join('')}</div>` : `<div class="mNada">${vacio}</div>`;
    const t = TR, regalo = !t.suyo.length && t.mio.length;
    confirma({ ico: '⇄', titulo: 'Confirmar intercambio', si: 'Aceptar trato', no: 'Revisar',
      html: `<div class="mTrato"><div><h4>Das <small>(${t.mio.length})</small></h4>${fila(t.mio, 'Nada')}</div>
        <div class="mFlecha">⇄</div>
        <div><h4>Recibes de ${esc(t.otro)} <small>(${t.suyo.length})</small></h4>${fila(t.suyo, 'Nada')}</div></div>
        ${regalo ? '<p class="mAviso">Vas a regalar estos objetos sin recibir nada a cambio.</p>' : ''}` })
      .then(si => { if (si && TR && TR.id === t.id) op('aceptar'); });
  };

  /* ---- final ---- */
  function fin(t) {
    vistoFin = t.id; clearInterval(verT); verT = 0; $('#tAviso').classList.add('oculto');
    const prev = TR; TR = null; miOferta = new Set();
    if (t.id) api('trato', { token: SES.token, op: 'ver', id: t.id });   // marca como visto
    const ok = t.estado === 'hecho';
    const tit = ok ? '¡Intercambio realizado!' : t.estado === 'rechazado' ? 'Intercambio rechazado' : t.estado === 'caducado' ? 'El intercambio ha caducado' : t.estado === 'error' ? 'No se pudo hacer el intercambio' : 'Intercambio cancelado';
    const txt = ok ? `Ya tienes en tu sala lo que te ha dado ${t.otro}.` : (t.msg || '');
    if (ok) { confetti(); Audio5.record(); vib([30, 30, 120]); }
    if (salaAbierta()) {
      $('#tFinIco').textContent = ok ? '✓' : '✕'; $('#tFinIco').classList.toggle('err', !ok);
      $('#tFinTit').textContent = tit; $('#tFinTxt').textContent = txt; vista('fin');
      if (ok) api('inventario', { token: SES.token }).then(d => { if (d.ok) { aplicaCatalogo(d.catalogo); const antes = new Set(salaItems.map(o => o.id)); salaItems = d.items; salaItems.forEach(o => { if (!antes.has(o.id)) salaNuevos.add(o.id); }); pintaSala(); } });
    } else if (state !== 'play' && (ok || prev)) toast(tit);
  }

  /* ---- aviso fuera de la sala ---- */
  function aviso(t) {
    $('#tAvisoTit').textContent = t.estado === 'invitado' ? (t.invitaYo ? `Esperando a ${t.otro}…` : `${t.otro} quiere intercambiar contigo`) : `Intercambio abierto con ${t.otro}`;
    $('#tAvisoTxt').textContent = t.estado === 'invitado' && !t.invitaYo ? 'Abre tu inventario para ver el trato' : 'Está en tu inventario';
    $('#tAviso').classList.remove('oculto'); if (!t.invitaYo) { Audio5.click(); vib(40); }
  }
  $('#tAvisoVer').onclick = () => { $('#tAviso').classList.add('oculto'); if (state === 'play') return; show(null); abrirSala(); setTimeout(() => TR && muestraTrato(TR), 300); };
  $('#tAvisoNo').onclick = () => { $('#tAviso').classList.add('oculto'); if (TR) avisoCerrado = TR.id + TR.estado; };

  // al abrir la sala: ping rápido y, si hay trato en marcha, mostrarlo
  const abrirOrig = abrirSala;
  abrirSala = function () { abrirOrig(); setTimeout(ping, 400); if (TR && (TR.estado === 'invitado' || TR.estado === 'abierto')) { $('#btnTrueque').classList.add('aviso'); setTimeout(() => TR && muestraTrato(TR), 900); } };
  $('#btnInventario').onclick = abrirSala;
  const cerrarOrig = cerrarSala;
  cerrarSala = function () { cierraPanel(); cerrarOrig(); };
  $('#btnSalaVolver').onclick = cerrarSala;
})();

/* =========================================================
   MODO HALLOWEEN · dibujo del escenario y de los enemigos
   ========================================================= */
// ojos rojos: busca puntos dentro de los edificios (píxeles opacos)
function ojosEn(im, w, h, n) {
  try {
    const sw = 360, sh = Math.max(20, Math.round(sw * h / w)), c = off(sw, sh), g = c.getContext('2d');
    g.drawImage(im, 0, 0, sw, sh); const d = g.getImageData(0, 0, sw, sh).data, A = (x, y) => d[(y * sw + x) * 4 + 3];
    const out = [];
    for (let k = 0; k < n * 6 && out.length < n; k++) {
      const x = 4 + Math.floor(Math.random() * (sw - 8)); let top = -1;
      for (let y = 0; y < sh; y++) if (A(x, y) > 200) { top = y; break; }
      if (top < 0 || top > sh * .8) continue;
      const y = Math.round(top + (sh - top) * rnd(.12, .7));
      if (A(x - 3, y) < 220 || A(x + 3, y) < 220 || A(x, y - 3) < 220) continue;
      if (out.some(o => Math.abs(o[0] - x / sw * w) < 18 && Math.abs(o[1] - y / sh * h) < 12)) continue;
      out.push([x / sw * w, y / sh * h, Math.random() * 100, rnd(.8, 1.25)]);
    }
    return out;
  } catch (e) { return null; }
}
function drawOjos(x, y, s, t, ph) {
  if (x < -20 || x > W + 20) return;
  const ciclo = (t * .7 + ph) % 6, parp = ciclo > 5.82 ? Math.abs(ciclo - 5.91) / .09 : 1;   // parpadeo
  const brillo = .65 + .35 * Math.sin(t * 2.3 + ph * 3), sep = s * 2.7;
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= brillo;
  ctx.drawImage(glowSpr('#ff1a1a'), x - s * 7, y - s * 5, s * 14, s * 10);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#ff2a2a';
  ctx.beginPath(); ctx.ellipse(x - sep / 2, y, s * 1.15, s * .8 * parp + .01, -.25, 0, TAU); ctx.ellipse(x + sep / 2, y, s * 1.15, s * .8 * parp + .01, .25, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffd0c0'; ctx.fillRect(x - sep / 2 - s * .25, y - s * .25 * parp, s * .5, s * .4 * parp); ctx.fillRect(x + sep / 2 - s * .25, y - s * .25 * parp, s * .5, s * .4 * parp);
  ctx.globalAlpha /= brillo;
}
function ojosCapa(name, im, w, h) {
  if (!OJOS_POS[name]) { const e = ojosEn(im, w, h, name === 'altos' ? 9 : 7); if (!e) return {}; OJOS_POS[name] = e.map(o => [o[0] / w, o[1] / h, o[2], o[3]]); }
  const s0 = name === 'altos' ? 1.7 : 2.6;
  return { ojos: OJOS_POS[name].map(e => [e[0] * w, e[1] * h, s0 * e[3]]) };
}
let ojoSpr = null;
function spriteOjos() {   // par de ojos rojos con su brillo (se dibuja de una vez)
  if (ojoSpr) return ojoSpr;
  const c = off(112, 80), g = c.getContext('2d'), s = 8, x0 = 56, y0 = 40, sep = s * 2.7;
  g.drawImage(glowSpr('#ff1a1a'), 0, 0, 112, 80);
  g.fillStyle = '#ff2a2a'; g.beginPath(); g.ellipse(x0 - sep / 2, y0, s * 1.15, s * .8, -.25, 0, TAU); g.ellipse(x0 + sep / 2, y0, s * 1.15, s * .8, .25, 0, TAU); g.fill();
  g.fillStyle = '#ffd0c0'; g.fillRect(x0 - sep / 2 - s * .25, y0 - s * .25, s * .5, s * .4); g.fillRect(x0 + sep / 2 - s * .25, y0 - s * .25, s * .5, s * .4);
  return ojoSpr = c;
}
function drawTira(Lr, par) { const o = -((camX * par) % Lr.w), y = GROUND - Lr.h; for (let x = o; x < W; x += Lr.w) ctx.drawImage(Lr.c, x, y, Lr.w + 1, Lr.h); }

// árboles muertos retorcidos
function capaArboles(R) {
  const clave = R + '|' + GROUND; if (arbolesC && arbolesC.clave === clave) return arbolesC.v;
  const v = capaArboles0(R); arbolesC = { clave, v }; return v;
}
function capaArboles0(R) {
  const h = GROUND * .52, c = off(TILE * R, h * R), g = c.getContext('2d'); g.scale(R, R);
  g.strokeStyle = g.fillStyle = '#050207'; g.lineCap = 'round';
  const rama = (x, y, len, ang, w, d) => {
    const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len, cx = (x + ex) / 2 + rnd(-len, len) * .18, cy = (y + ey) / 2 + rnd(-len, len) * .18;
    g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
    if (d <= 0 || len < 6) return;
    const n = d > 4 ? 2 : (Math.random() < .5 ? 2 : 3);
    for (let i = 0; i < n; i++) rama(ex, ey, len * rnd(.58, .8), ang + rnd(-.75, .75) + (i - (n - 1) / 2) * .35, w * .62, d - 1);
  };
  let x = rnd(40, 160);
  while (x < TILE - 60) {
    const th = h * rnd(.55, .98), base = h, w0 = rnd(9, 16);
    g.beginPath(); g.moveTo(x - w0 * 1.6, base); g.quadraticCurveTo(x - w0 * .5, base - 10, x - w0 * .45, base - 22); g.lineTo(x + w0 * .45, base - 22); g.quadraticCurveTo(x + w0 * .5, base - 10, x + w0 * 1.6, base); g.fill();
    rama(x, base - 18, th * .42, -Math.PI / 2 + rnd(-.12, .12), w0, 6);
    if (Math.random() < .45) { g.fillStyle = '#ff8a1f'; const hy = base - th * rnd(.18, .3); g.beginPath(); g.ellipse(x - 2, hy, 1.6, 1.1, 0, 0, TAU); g.ellipse(x + 3, hy, 1.6, 1.1, 0, 0, TAU); g.fill(); g.fillStyle = '#050207'; }   // ojos en el tronco
    x += rnd(190, 330);
  }
  return { c, w: TILE, h };
}
// cementerio en primer plano: lápidas, cruces y verja
function capaTumbas(R, z) {
  const clave = R + '|' + z; if (tumbasC[clave]) return tumbasC[clave];
  return tumbasC[clave] = capaTumbas0(R, z);
}
function capaTumbas0(R, z) {
  const h = 70, c = off(TILE * R, h * R), g = c.getContext('2d'); g.scale(R, R);
  const p = ZONAS[z], borde = rgba(p.a, .4);
  const lapida = (x, w, hh, rot) => {
    g.save(); g.translate(x, h); g.rotate(rot);
    g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(-w / 2, -hh + w / 2); g.arc(0, -hh + w / 2, w / 2, Math.PI, 0); g.lineTo(w / 2, 0); g.closePath();
    g.fillStyle = '#030204'; g.fill(); g.strokeStyle = borde; g.lineWidth = 1; g.stroke();
    if (w > 22) { g.fillStyle = 'rgba(120,110,140,.22)'; g.font = '700 ' + Math.round(w * .32) + 'px Orbitron, sans-serif'; g.textAlign = 'center'; g.fillText('RIP', 0, -hh + w * .75); }
    g.restore();
  };
  const cruz = (x, hh, rot) => { g.save(); g.translate(x, h); g.rotate(rot); g.fillStyle = '#030204'; g.fillRect(-3, -hh, 6, hh); g.fillRect(-11, -hh * .74, 22, 6); g.strokeStyle = borde; g.lineWidth = .8; g.strokeRect(-3, -hh, 6, hh); g.restore(); };
  const verja = (x0, x1) => {
    g.fillStyle = '#030204'; g.fillRect(x0, h - 30, x1 - x0, 3); g.fillRect(x0, h - 12, x1 - x0, 3);
    for (let x = x0; x <= x1; x += 9) { g.fillRect(x - 1.2, h - 40, 2.4, 40); g.beginPath(); g.moveTo(x - 3.5, h - 40); g.lineTo(x, h - 48); g.lineTo(x + 3.5, h - 40); g.fill(); }
  };
  let x = 30;
  while (x < TILE - 40) {
    const r = Math.random();
    if (r < .22) { const l = rnd(90, 200); if (x + l < TILE - 20) verja(x, x + l); x += l + rnd(30, 70); }
    else if (r < .7) { lapida(x, rnd(18, 32), rnd(26, 46), rnd(-.12, .12)); x += rnd(40, 110); }
    else { cruz(x, rnd(30, 46), rnd(-.15, .15)); x += rnd(40, 100); }
  }
  // hierba seca
  g.fillStyle = '#030204'; for (let i = 0; i < 160; i++) { const gx = Math.random() * TILE, gh = rnd(4, 11); g.beginPath(); g.moveTo(gx - 2, h); g.lineTo(gx + rnd(-3, 3), h - gh); g.lineTo(gx + 2, h); g.fill(); }
  return { c, w: TILE, h };
}
// calabaza (datos y farolillos)
let calSpr = null;
function spriteCalabaza() {
  if (calSpr) return calSpr;
  const c = off(128, 128), g = c.getContext('2d'); g.scale(2, 2); g.translate(32, 35);
  const gr = g.createRadialGradient(-6, -8, 2, 0, 0, 26); gr.addColorStop(0, '#ffb15a'); gr.addColorStop(.55, '#ff7a1a'); gr.addColorStop(1, '#a8400a');
  g.fillStyle = gr;
  [[-11, 0, 13, 17], [11, 0, 13, 17], [0, 0, 14, 18]].forEach(([x, y, rx, ry]) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); });
  g.strokeStyle = 'rgba(110,35,0,.55)'; g.lineWidth = 1.4;
  [-14, -5, 5, 14].forEach(x => { g.beginPath(); g.moveTo(x * .5, -17); g.quadraticCurveTo(x * 1.35, 0, x * .5, 17); g.stroke(); });
  g.fillStyle = '#4a7a1a'; g.beginPath(); g.moveTo(-2.5, -16); g.quadraticCurveTo(-1, -24, 5, -26); g.lineTo(6, -23); g.quadraticCurveTo(2, -21, 2.5, -16); g.fill();
  g.fillStyle = '#ffe14a'; g.shadowColor = '#ffb000'; g.shadowBlur = 8;
  g.beginPath(); g.moveTo(-12, -4); g.lineTo(-5, -4); g.lineTo(-8.5, -11); g.closePath(); g.moveTo(12, -4); g.lineTo(5, -4); g.lineTo(8.5, -11); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(-14, 4); g.lineTo(-9, 9); g.lineTo(-6, 6); g.lineTo(-3, 10); g.lineTo(0, 7); g.lineTo(3, 10); g.lineTo(6, 6); g.lineTo(9, 9); g.lineTo(14, 4); g.quadraticCurveTo(0, 16, -14, 4); g.fill();
  return calSpr = c;
}
function spriteCalabazaG() {   // calabaza con su brillo ya pintado (1 solo dibujo por calabaza)
  if (calSprG) return calSprG;
  const c = off(120, 120), g = c.getContext('2d'); g.globalAlpha = .55; g.drawImage(glowSpr('#ff7a1a'), 0, 0, 120, 120); g.globalAlpha = 1; g.drawImage(spriteCalabaza(), 26, 26, 68, 68);
  return calSprG = c;
}
// alas de murciélago (silueta)
function alasMurcielago(g, f) {
  for (const sd of [-1, 1]) {
    const tipY = -16 - f * 15, midY = -8 - f * 9;
    g.beginPath(); g.moveTo(sd * 6, -4);
    g.quadraticCurveTo(sd * 22, midY - 10, sd * 46, tipY);
    g.quadraticCurveTo(sd * 41, tipY + 9, sd * 37, tipY + 15);
    g.quadraticCurveTo(sd * 32, tipY + 9, sd * 27, midY + 13);
    g.quadraticCurveTo(sd * 22, midY + 8, sd * 17, midY + 15);
    g.quadraticCurveTo(sd * 13, midY + 10, sd * 7, 8);
    g.closePath(); g.fill(); g.stroke();
  }
}
// enemigo: murciélago (sustituye al virus)
function drawMurcielago(v, t) {
  const f = Math.sin(t * 15 + v.ph * 2);
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .75; ctx.drawImage(glowSpr('#7a1fd6'), v.x - 52, v.y - 46, 104, 92); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.translate(v.x, v.y + f * 3); ctx.rotate(Math.cos(v.ph) * .14);
  ctx.fillStyle = '#17081f'; ctx.strokeStyle = 'rgba(190,110,255,.75)'; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
  alasMurcielago(ctx, f);
  ctx.strokeStyle = 'rgba(190,110,255,.25)'; ctx.lineWidth = 1;
  for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 7, -2); ctx.lineTo(sd * 37, -1 - f * 12); ctx.moveTo(sd * 7, -2); ctx.lineTo(sd * 27, 4 - f * 6); ctx.stroke(); }
  ctx.fillStyle = '#14061c'; ctx.strokeStyle = 'rgba(190,110,255,.8)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(-11, -23); ctx.lineTo(-2, -12); ctx.lineTo(2, -12); ctx.lineTo(11, -23); ctx.lineTo(8, -8); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 2, 11, 14, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSpr('#ff1a1a'), -14, -12, 28, 16); ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#ff2626'; ctx.beginPath(); ctx.ellipse(-4.5, -4, 3, 2.3, -.35, 0, TAU); ctx.ellipse(4.5, -4, 3, 2.3, .35, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(-5.5, -5, 1.4, 1.2); ctx.fillRect(3.6, -5, 1.4, 1.2);
  ctx.beginPath(); ctx.moveTo(-4, 6); ctx.lineTo(-2.6, 11); ctx.lineTo(-1.2, 6); ctx.moveTo(1.2, 6); ctx.lineTo(2.6, 11); ctx.lineTo(4, 6); ctx.fill();
  ctx.restore();
}
// murciélagos lejanos en el cielo (pasan por delante de la luna)
function drawBandada(t) {
  ctx.fillStyle = '#050208'; ctx.strokeStyle = 'rgba(0,0,0,0)'; ctx.lineWidth = 0;
  for (let i = 0; i < 9; i++) {
    const sp = 34 + (i * 13) % 40, x = W + 120 - ((t * sp + i * 211) % (W + 260)), cerca = LUNA.r && Math.abs(i % 3) === 0;
    const y = (cerca ? LUNA.y - LUNA.r * .5 + (i * 23) % (LUNA.r) : CEIL + 70 + (i * 61) % Math.max(60, GROUND * .32)) + Math.sin(t * 1.7 + i) * 12;
    const s = .32 + (i % 4) * .08, f = Math.sin(t * (9 + i) + i);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); alasMurcielago(ctx, f); ctx.beginPath(); ctx.ellipse(0, 1, 7, 9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff3030'; ctx.fillRect(-3.5, -3, 2.2, 1.8); ctx.fillRect(1.3, -3, 2.2, 1.8); ctx.fillStyle = '#050208';
    ctx.restore();
  }
}
// enemigo: gusano (sustituye al láser) — ocupa la misma línea de choque
function drawGusano(e, l, t) {
  const x1 = e[0], y1 = e[1], x2 = e[2], y2 = e[3], dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(157,255,58,.09)'; ctx.lineWidth = 30; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  const N = Math.max(10, Math.round(len / 8));
  let hx = x1, hy = y1;
  for (let pas = 0; pas < 2; pas++) {   // pasada 0: anillos; pasada 1: brillos (menos cambios de color)
    for (let i = 0; i <= N; i++) {
      const k = i / N, env = Math.sin(Math.min(1, k * 1.1) * Math.PI) * .8 + .2, w = Math.sin(k * Math.PI * 3.2 - t * 7 + l.ph) * 4.5 * env;
      const x = x1 + dx * k + nx * w, y = y1 + dy * k + ny * w, r = 4 + 6.5 * Math.min(1, k * 2.2) * (k > .92 ? 1.08 : 1);
      if (pas === 0) { ctx.fillStyle = i % 2 ? '#3d7a12' : '#5aa11d'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); hx = x; hy = y; }
      else { if (i === 0) { ctx.fillStyle = 'rgba(210,255,140,.35)'; ctx.beginPath(); } ctx.moveTo(x - nx * r * .35 + r * .38, y - ny * r * .35); ctx.arc(x - nx * r * .35, y - ny * r * .35, r * .38, 0, TAU); }
    }
    if (pas === 1) ctx.fill();
  }
  // cabeza
  const ux = dx / len, uy = dy / len, a = Math.atan2(uy, ux);
  ctx.save(); ctx.translate(hx + ux * 3, hy + uy * 3); ctx.rotate(a);
  const hg = ctx.createRadialGradient(-3, -3, 1, 0, 0, 13); hg.addColorStop(0, '#9be04a'); hg.addColorStop(1, '#2c5a0c');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(0, 0, 13, 12, 0, 0, TAU); ctx.fill();
  const abre = 3 + Math.sin(t * 9 + l.ph) * 2.5;
  ctx.fillStyle = '#2a0006'; ctx.beginPath(); ctx.ellipse(9, 0, 5, abre, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f4f0dc'; for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(6 + k * 2.6, s * abre); ctx.lineTo(7.3 + k * 2.6, s * (abre - 2.4)); ctx.lineTo(8.6 + k * 2.6, s * abre); ctx.fill(); }
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#fff36a'; ctx.beginPath(); ctx.arc(1, s * 6.5, 3.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d4000f'; ctx.beginPath(); ctx.arc(2.2, s * 6.5, 1.8, 0, TAU); ctx.fill();
  }
  ctx.restore();
  if (l.rs) { ctx.fillStyle = '#2c5a0c'; ctx.beginPath(); ctx.arc(l.x, l.y, 5, 0, TAU); ctx.fill(); }
}
// enemigo: cuchillo (sustituye al misil)
function drawCuchillo(m, t) {
  ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(Math.sin(t * 22 + m.y) * .035);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 1; i <= 3; i++) { ctx.strokeStyle = `rgba(220,230,255,${.18 / i})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(44 + i * 8, -6 + i * 4); ctx.lineTo(90 + i * 22, -6 + i * 4); ctx.stroke(); }
  ctx.drawImage(glowSpr('#dfe8ff'), -40, -20, 60, 40);
  ctx.globalCompositeOperation = 'source-over';
  // hoja
  const bg = ctx.createLinearGradient(0, -9, 0, 7); bg.addColorStop(0, '#ffffff'); bg.addColorStop(.45, '#c9d2e0'); bg.addColorStop(1, '#6d7789');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(-38, 3); ctx.quadraticCurveTo(-22, -10, 12, -9); ctx.lineTo(12, 7); ctx.lineTo(-28, 7); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-34, 1); ctx.quadraticCurveTo(-20, -8, 11, -7.5); ctx.stroke();
  const gl = ((t * 1.8) % 1) * 60 - 40;   // destello que recorre la hoja
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.moveTo(gl, -8); ctx.lineTo(gl + 5, -8); ctx.lineTo(gl + 1, 7); ctx.lineTo(gl - 4, 7); ctx.fill();
  // sangre
  ctx.fillStyle = '#b3001b'; ctx.beginPath(); ctx.moveTo(-38, 3); ctx.quadraticCurveTo(-31, -4, -24, -6); ctx.lineTo(-22, 1); ctx.quadraticCurveTo(-25, 7, -28, 7); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-26, 9.5 + Math.sin(t * 3 + m.y) * 1.2, 1.6, 2.6, 0, 0, TAU); ctx.fill();
  // guarda y mango
  ctx.fillStyle = '#3a3f4a'; ctx.fillRect(12, -12, 5, 23); ctx.fillStyle = '#7d8696'; ctx.fillRect(12, -12, 5, 2);
  const mg = ctx.createLinearGradient(0, -6, 0, 6); mg.addColorStop(0, '#7a4a26'); mg.addColorStop(1, '#3b200c');
  ctx.fillStyle = mg; ctx.beginPath(); ctx.moveTo(17, -6); ctx.lineTo(40, -5); ctx.quadraticCurveTo(45, 0, 40, 5); ctx.lineTo(17, 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d9c7a0'; [22, 29, 36].forEach(x => { ctx.beginPath(); ctx.arc(x, 0, 1.6, 0, TAU); ctx.fill(); });
  ctx.restore();
}
// niebla que se arrastra por el suelo
function drawNiebla(t) {
  const TW = 1600, TH = 150;
  if (!nieblaTira) {
    const k = .5, c = off(TW * k, TH * k), g = c.getContext('2d'); g.scale(k, k);
    for (let i = 0; i < 7; i++) {
      const col = i % 3 === 1 ? '#3aa860' : '#7a3cc8', x = i * 230 + 60, y = 70 + (i % 3) * 18, rx = 240, ry = 55;
      const gr = g.createRadialGradient(0, 0, 4, 0, 0, 1); gr.addColorStop(0, rgba(col, .16)); gr.addColorStop(1, rgba(col, 0));
      g.save(); g.translate(x, y); g.scale(rx, ry); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore();
      if (x + rx > TW) { g.save(); g.translate(x - TW, y); g.scale(rx, ry); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore(); }
    }
    nieblaTira = c;
  }
  const o = -(((camX * .45 + t * 22) % TW) + TW) % TW, y = GROUND - TH + 20;
  ctx.globalAlpha = .9 + .1 * Math.sin(t * .8);
  for (let x = o; x < W; x += TW) ctx.drawImage(nieblaTira, x, y, TW + 1, TH);
  ctx.globalAlpha = 1;
}
// telarañas en las esquinas y araña colgando (menú)
let telaSpr = null;
function drawTelas(t) {
  if (!telaSpr) {
    const S2 = 170, c = off(S2 * 2, S2 * 2), g = c.getContext('2d'); g.scale(2, 2);
    g.strokeStyle = 'rgba(225,220,255,.32)'; g.lineWidth = .8;
    const angs = [0, .2, .42, .66, .9, 1.13, 1.35, 1.5708].map(a => a * 1);
    angs.forEach(a => { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * S2, Math.sin(a) * S2); g.stroke(); });
    for (let r = 16; r < S2 * .95; r += 15 + r * .08) {
      g.beginPath();
      for (let i = 0; i < angs.length - 1; i++) {
        const a0 = angs[i], a1 = angs[i + 1], am = (a0 + a1) / 2, rr = r * .86;
        if (i === 0) g.moveTo(Math.cos(a0) * r, Math.sin(a0) * r);
        g.quadraticCurveTo(Math.cos(am) * rr, Math.sin(am) * rr, Math.cos(a1) * r, Math.sin(a1) * r);
      }
      g.stroke();
    }
    telaSpr = c;
  }
  const s = Math.min(1, H / 700) * 150;
  ctx.drawImage(telaSpr, 0, CEIL - 4, s, s);
  ctx.save(); ctx.translate(W, CEIL - 4); ctx.scale(-1, 1); ctx.drawImage(telaSpr, 0, 0, s * .8, s * .8); ctx.restore();
  if (state !== 'menu') return;
  const ax = W * .93, ay = CEIL + 80 + Math.sin(t * .7) * 40;
  ctx.strokeStyle = 'rgba(230,230,255,.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax, CEIL - 2); ctx.lineTo(ax, ay - 8); ctx.stroke();
  ctx.save(); ctx.translate(ax, ay); ctx.strokeStyle = '#050208'; ctx.lineWidth = 2;
  for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) { const m = Math.sin(t * 6 + k) * 2; ctx.beginPath(); ctx.moveTo(0, -2 + k * 3); ctx.quadraticCurveTo(sd * 12, -10 + k * 5 + m, sd * 16, 2 + k * 5); ctx.stroke(); }
  ctx.fillStyle = '#07030a'; ctx.beginPath(); ctx.ellipse(0, 4, 7, 9, 0, 0, TAU); ctx.ellipse(0, -6, 5, 5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ff2a2a'; ctx.fillRect(-3, -8, 2, 2); ctx.fillRect(1, -8, 2, 2);
  ctx.restore();
}

/* ---- aplicar tema ---- */
let temaPendiente = null;
function textosTema() {
  const hw = HW();
  document.body.classList.toggle('tema-halloween', hw);
  $$('[data-hw]').forEach(el => { if (el.dataset.normal == null) el.dataset.normal = el.textContent; el.textContent = hw ? el.dataset.hw : el.dataset.normal; });
  FRASES.length = 0; FRASES.push(...(hw ? FRASES_H : FRASES_N));
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = hw ? '#1a0a12' : '#05060f';
}
function aplicaTema(t, ya) {
  t = t === 'halloween' ? 'halloween' : 'normal';
  if (t === TEMA && !ya) return;
  if (!ya && ['play', 'count', 'dying'].includes(state)) { temaPendiente = t; return; }
  TEMA = t; temaPendiente = null; store('tema', t);
  paletaTema(); textosTema();
  skyTop = ZONAS[zona].top; skyBot = ZONAS[zona].bot; skyT = 1;
  zonaLista = null; zonaPrep = -1; calSprG = null; lamparas = null;
  layers = buildLayers(zona); prevLayers = null; layerFade = 1;
}
textosTema();

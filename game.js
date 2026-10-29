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
    while (nextT < ac.currentTime + 0.12) { const tm = typeof TEMA !== 'undefined' ? TEMA : 'normal'; if (tm === 'halloween') playStepH(step, nextT); else if (tm === 'navidad') playStepN(step, nextT); else if (tm === 'fallas') playStepF(step, nextT); else playStep(step, nextT); nextT += tm === 'halloween' ? S16H : tm === 'navidad' ? S16N : tm === 'fallas' ? S16F : S16; step = (step + 1) % 256; }
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
  // ---- música de Navidad: villancico electrónico con cascabeles y campanitas ----
  // melodía de «Jingle Bells» (James Lord Pierpont, 1857, dominio público) en negras: 0 = silencio
  const S16N = 60 / 136 / 4;
  const melN = [64, 64, 64, 0, 64, 64, 64, 0, 64, 67, 60, 62, 64, 0, 0, 0, 65, 65, 65, 65, 65, 64, 64, 64, 64, 62, 62, 64, 62, 0, 67, 0];
  const acN = [[48, [60, 64, 67]], [48, [60, 64, 67]], [48, [60, 64, 67]], [48, [60, 64, 67]], [53, [57, 60, 65]], [48, [60, 64, 67]], [50, [57, 62, 66]], [43, [55, 59, 62]]];
  function cascabel(dly, v) { noise(0.07, v, 9000, 6500, 'highpass', dly, mus); noise(0.05, v * .6, 12000, 9000, 'highpass', dly + 0.02, mus); }
  function campanita(f, dly, v) { tone(f, 0.9, 'sine', v, 0, dly, eco); tone(f * 2.76, 0.35, 'sine', v * .35, 0, dly, eco); tone(f * 5.4, 0.15, 'sine', v * .15, 0, dly, eco); }
  function playStepN(s, t) {
    if (!musOn || !snd) return;
    const bar = Math.floor(s / 16) % 8, st = s % 16, ch = acN[bar], dly = t - ac.currentTime, juego = musMode === 'game';
    // melodía con campanitas (glockenspiel)
    if (st % 4 === 0) { const n = melN[(bar % 8) * 4 + st / 4]; if (n) campanita(mtof(n + 12), dly, juego ? 0.06 : 0.07); }
    // bajo saltarín (raíz – quinta)
    if (st % 4 === 0) tone(mtof(ch[0] - 12 + (st % 8 === 4 ? 7 : 0)), S16N * 3, 'triangle', juego ? 0.2 : 0.15, 0, dly, mus);
    // acordes en contratiempo (piano eléctrico)
    if (st % 8 === 4 || (juego && st % 8 === 6)) ch[1].forEach(m => tone(mtof(m), S16N * 1.6, 'square', 0.014, 0, dly, mus));
    // pad cálido al inicio del compás
    if (st === 0) ch[1].forEach(m => tone(mtof(m - 12), S16N * 15, 'triangle', 0.022, 0, dly, mus));
    // cascabeles
    if (juego ? st % 2 === 0 : st % 4 === 2) cascabel(dly, st % 4 === 0 ? 0.07 : 0.045);
    // adornos de arpa al cambiar de frase
    if (s % 64 === 60) [72, 76, 79, 84, 88].forEach((n, i) => campanita(mtof(n), dly + i * 0.05, 0.03));
    if (!juego) return;
    if (st % 4 === 0) tone(140, 0.2, 'sine', 0.5, 0.3, dly, mus);                         // bombo
    if (st % 8 === 4) { noise(0.14, 0.24, 3500, 1000, 'bandpass', dly, mus); noise(0.05, 0.12, 6000, 3000, 'bandpass', dly + 0.012, mus); }   // palmas
  }
  // ---- música de Fallas: pasodoble de dolçaina y tabalet (melodía original) + petardos ----
  const S16F = 60 / 118 / 4;
  // melodía en corcheas por compás (0 = silencio, -1 = mantener): Rem · La7 · Rem · La7 · Solm · Rem · La7 · Rem
  const melF = [
    [74, 0, 74, 76, 77, 76, 74, 72], [73, 0, 73, 74, 76, 74, 73, 69], [74, 0, 74, 76, 77, 79, 81, 79], [77, 76, 74, 73, 76, -1, 0, 0],
    [79, 0, 79, 77, 76, 74, 72, 70], [69, 0, 74, 72, 70, 69, 67, 65], [64, 65, 67, 69, 70, 69, 67, 61], [62, -1, -1, 0, 69, 0, 62, 0]];
  const acF = [[38, [62, 65, 69]], [33, [61, 64, 67]], [38, [62, 65, 69]], [33, [61, 64, 67]], [43, [62, 67, 70]], [38, [62, 65, 69]], [33, [61, 64, 67]], [38, [62, 65, 69]]];
  const tabalet = [1, 0, 0, .6, 1, 0, .6, 0, 1, 0, 0, .6, 1, .5, .7, .9];
  function petardo(dly, v) { noise(0.32, v, 2600, 70, 'lowpass', dly, mus); tone(70, 0.25, 'sine', v * .9, 0.4, dly, mus); noise(0.05, v * .7, 7000, 3000, 'highpass', dly, mus); }
  function dolcaina(n, dly, dur, v) {   // instrumento de lengüeta: cuadrada + sierra con vibrato ligero
    if (!ac) return; const t = ac.currentTime + dly;
    const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter(), l = ac.createOscillator(), lg = ac.createGain();
    o.type = 'square'; o2.type = 'sawtooth'; o.frequency.value = o2.frequency.value = mtof(n); o2.detune.value = 6;
    l.frequency.value = 6; lg.gain.value = mtof(n) * .008; l.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    f.type = 'bandpass'; f.frequency.value = mtof(n) * 2.2; f.Q.value = .9;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .02); g.gain.setValueAtTime(v * .85, t + dur * .7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(mus); [o, o2, l].forEach(x => { x.start(t); x.stop(t + dur + .05); });
  }
  function playStepF(s, t) {
    if (!musOn || !snd) return;
    const bar = Math.floor(s / 16) % 8, st = s % 16, ch = acF[bar], dly = t - ac.currentTime, juego = musMode === 'game';
    // dolçaina
    if (st % 2 === 0) { const n = melF[bar][st / 2]; if (n > 0) { let d = 1; while (st / 2 + d < 8 && melF[bar][st / 2 + d] === -1) d++; dolcaina(n, dly, S16F * 2 * d * .92, juego ? 0.05 : 0.06); } }
    // tabalet (caja valenciana)
    const tb = tabalet[st]; if (tb) noise(0.07, (juego ? 0.16 : 0.11) * tb, 2600, 1200, 'bandpass', dly, mus);
    if (bar % 4 === 3 && st >= 12) noise(0.05, 0.12, 3000, 1500, 'bandpass', dly + S16F / 2, mus);   // redoble
    // bajo de pasodoble (bombardino): un-pa
    if (st % 4 === 0) tone(mtof(ch[0] - (st % 8 === 4 ? -7 : 0)), S16F * 2.2, 'sawtooth', juego ? 0.09 : 0.07, 0, dly, mus);
    if (st % 4 === 2) ch[1].forEach(m => tone(mtof(m - 12), S16F * 1.2, 'square', 0.013, 0, dly, mus));
    if (!juego) { if (s % 64 === 48) for (let k = 0; k < 6; k++) noise(0.04, 0.03, 9000, 5000, 'highpass', dly + k * 0.07 + Math.random() * .04, mus); return; }   // petardeo lejano
    // en partida: bombo y petardos de mascletà que crecen con la intensidad
    if (st % 4 === 0) tone(110, 0.2, 'sine', 0.45, 0.35, dly, mus);
    if ((st === 7 || st === 15) && Math.random() < .35 + intensity * .4) petardo(dly, 0.22 + intensity * .1);
  }
  function mascleta() {   // ráfaga de petardos que acelera, como el final de una mascletà
    if (!ac || !snd) return; let d = 0, paso = .26;
    for (let k = 0; k < 26; k++) { petardo(d, .3 + Math.random() * .15); d += paso; paso = Math.max(.045, paso * .88); }
    for (let k = 0; k < 5; k++) petardo(d + k * .03, .45);
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
  let apagado = false;
  function despertar() { if (apagado) return; oculto = false; if (ac && ac.state === 'suspended') ac.resume().then(() => { nextT = Math.max(nextT, ac.currentTime + 0.05); }).catch(() => {}); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) dormir(); else despertar(); });
  window.addEventListener('pagehide', dormir);
  window.addEventListener('pageshow', () => { if (!document.hidden) despertar(); });
  return {
    init,
    apagar() { apagado = true; dormir(); }, encender() { apagado = false; despertar(); }, mascleta() { mascleta(); },
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
let TEMA_PRUEBA = load('temaPrueba', null);   // modo pruebas del admin: tema solo en este dispositivo
let TEMA = TEMA_PRUEBA || load('tema', 'normal'), TEMA_SERVIDOR = load('tema', 'normal');
const ZONAS_N = ZONAS.map(z => Object.assign({}, z));
const ZONAS_H = [
  { n: 'CEMENTERIO DIGITAL', a: '#ff7a1a', b: '#b14bff', top: '#020104', bot: '#1d0a1c', sun1: '#ffe7a3', sun2: '#ff8a1f' },
  { n: 'BOSQUE MALDITO', a: '#9dff3a', b: '#ff7a1a', top: '#010402', bot: '#0d1a0b', sun1: '#f4ffd0', sun2: '#9dff3a' },
  { n: 'CASTILLO VAMPIRO', a: '#ff2b4e', b: '#b14bff', top: '#050103', bot: '#260510', sun1: '#ffd6c2', sun2: '#ff2b4e' },
  { n: 'CRIPTA DEL SERVIDOR', a: '#b14bff', b: '#ff7a1a', top: '#030107', bot: '#170a2a', sun1: '#ecd9ff', sun2: '#b14bff' }
];
const ZONAS_X = [
  { n: 'POLO NORTE 5G', a: '#ff3b4e', b: '#2fe37a', top: '#020617', bot: '#0b2447', sun1: '#f2f8ff', sun2: '#9fd2ff' },
  { n: 'BOSQUE NEVADO', a: '#2fe37a', b: '#ffd23f', top: '#01080d', bot: '#0b2e2a', sun1: '#f2fff8', sun2: '#9fffd6' },
  { n: 'TALLER DE SANTA', a: '#ffd23f', b: '#ff3b4e', top: '#0a0408', bot: '#2b0d17', sun1: '#fff6e0', sun2: '#ffcf7a' },
  { n: 'AURORA BOREAL', a: '#7af0ff', b: '#c77dff', top: '#020415', bot: '#16123d', sun1: '#eef9ff', sun2: '#a8e6ff' }
];
const ZONAS_F = [
  { n: 'PLAZA DEL AYUNTAMIENTO', a: '#ffd23f', b: '#ff3b3b', top: '#05030f', bot: '#2a0f22', sun1: '#fff1c9', sun2: '#ffb347' },
  { n: 'LUCES DE RUZAFA', a: '#ff4fd8', b: '#ffd23f', top: '#070214', bot: '#2b0b3a', sun1: '#ffe9ff', sun2: '#ff8ae0' },
  { n: 'NIT DEL FOC', a: '#4ab8ff', b: '#ffd23f', top: '#020414', bot: '#14204a', sun1: '#eaf6ff', sun2: '#8fd0ff' },
  { n: 'LA CREMÀ', a: '#ff5a1a', b: '#ffd23f', top: '#0a0302', bot: '#3a0e04', sun1: '#ffe3b0', sun2: '#ff6a1a' }
];
const HW = () => TEMA === 'halloween', NV = () => TEMA === 'navidad', FA = () => TEMA === 'fallas';
const OJOS_POS = {}, tumbasC = {};
let arbolesC = null, calSprG = null, lamparas = null, nieblaTira = null;   // cachés del modo Halloween
const LUCES_POS = {}, NIEVE_TOP = {};
let genteC = null, bunSpr = null, humoTira = null, mascletaT = 0;
const fuegos = [];   // cachés del modo Fallas
let pinosC = null, regalosC = null, guirnaldaC = null, monedaSpr = null, bombillas = null, copos = null;   // cachés del modo Navidad
function paletaTema() { (HW() ? ZONAS_H : NV() ? ZONAS_X : FA() ? ZONAS_F : ZONAS_N).forEach((z, i) => Object.assign(ZONAS[i], z)); }
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
  if (FA()) {   // Fallas: noche de fiesta, cálida
    g.fillStyle = name === 'altos' ? 'rgba(70,18,40,.55)' : 'rgba(60,16,24,.42)'; g.fillRect(0, 0, c.width, c.height);
  } else if (NV()) {   // Navidad: noche fría azulada
    g.fillStyle = name === 'altos' ? 'rgba(8,22,56,.42)' : 'rgba(6,16,40,.30)'; g.fillRect(0, 0, c.width, c.height);
  } else if (HW()) {   // Halloween: edificios en silueta negra con sombras
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
    if (NV() || FA()) { lg.globalCompositeOperation = 'source-atop'; lg.fillStyle = FA() ? 'rgba(255,170,70,.9)' : 'rgba(255,196,90,.9)'; lg.fillRect(0, 0, lc.width, lc.height); }   // ventanas cálidas
    else if (z > 0 || HW()) { lg.globalCompositeOperation = 'source-atop'; lg.fillStyle = rgba(p.a, HW() ? .45 : .85); lg.fillRect(0, 0, lc.width, lc.height); }
  }
  if (NV()) nieveTejados(g, name, im, w, h, R);
  if (FA() && name === 'altos') { const ha = GROUND * .5; g.save(); g.globalCompositeOperation = 'source-over'; g.setTransform(R, 0, 0, R, 0, (h - ha) * R); dibujaArcos(g, w, ha); g.restore(); }
  return Object.assign({ c, lc, w, h }, HW() ? ojosCapa(name, im, w, h) : NV() ? lucesCapa(name, im, w, h) : {});
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
  if (Lr.luces) drawLuces(Lr, o, y, t);
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
  if (NV()) { L.arboles = capaPinos(R); L.tumbas = capaRegalos(R); }
  if (FA()) { L.tumbas = capaGente(R); }
  return L;
}
/* prepara la zona siguiente en trocitos (un trozo por fotograma) para que el cambio de zona no dé tirones */
let zonaLista = null, zonaPrep = -1;
function prepZona(z) {
  if (zonaPrep === z || (zonaLista && zonaLista.z === z)) return;
  zonaPrep = z; const R = S * DPR, L = { z, R }, pasos = [
    () => L.altos = artLayer('altos', GROUND * 0.6, z, R),
    () => L.bajos = artLayer('bajos', GROUND * 0.27, z, R),
    () => { if (HW()) { L.arboles = capaArboles(R); L.tumbas = capaTumbas(R, z); } if (NV()) { L.arboles = capaPinos(R); L.tumbas = capaRegalos(R); } if (FA()) { L.tumbas = capaGente(R); } L.ant = []; }];
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
  $('#finProx').className = 'finProx oculto';
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

  if (state === 'menu' || state === 'load' || state === 'adios') { camX += 140 * rdt; updParts(rdt); return; }
  if (state === 'pause') return;

  // velocidad
  if (state === 'play' || state === 'count') {
    const target = state === 'count' ? 260 : baseSpeed() * (pw.turbo > 0 ? 2.2 : 1);
    speed = lerp(speed, target, Math.min(1, dt * (pw.turbo > 0 ? 4 : 1.6)));
  } else if (state === 'dying') speed = lerp(speed, 0, Math.min(1, dt * 1.6));
  camX += speed * dt;
  if (state === 'play') { meters += speed * dt / 40; playT += dt; if (!premioAvisado && PREMIO && SES && score() >= (MIN_HOY || PREMIO.minimo)) { premioAvisado = true; const it = ITEMS[PREMIO.tipo]; showBanner('¡OBJETO DESBLOQUEADO!', (it ? it.nom : PREMIO.tipo).toUpperCase(), '#ff9a2b'); Audio5.record(); flash('#ff9a2b', .25); } }

  // zonas
  const zn = Math.floor(meters / 800);
  if (state === 'play' && meters % 800 > 560) prepZona((zn + 1) % ZONAS.length);
  if (state === 'play' && zn !== lastZone) { lastZone = zn; setZone(zn % ZONAS.length); showBanner('ZONA ' + (zn + 1), ZONAS[zn % ZONAS.length].n, ZONAS[zn % ZONAS.length].a); if (FA()) { Audio5.mascleta(); mascletaT = 2.2; } else Audio5.zone(); }
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
    if (d < 4) { hit(px, py, () => { l.dead = true; for (let k = 0; k <= 10; k++) burst(lerp(e[0], e[2], k / 10), lerp(e[1], e[3], k / 10), HW() ? '#9dff3a' : NV() ? '#ffffff' : FA() ? '#ffd23f' : '#ff2b4e', 4, 260); lasers.splice(i, 1); }); if (L.dead) return; continue; }
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
    if (Math.random() < .3) P(v.x + rnd(-10, 10), v.y + rnd(-10, 10), rnd(20, 80), rnd(-30, 30), .4, rnd(4, 8), HW() ? '#7a1fd6' : NV() ? '#ffd23f' : FA() ? '#ff8a1f' : '#ff2bd6', 'glow');
    if (nearest((x, y) => Math.hypot(x - v.x, y - v.y)) < 21) { hit(v.x, v.y, () => { burst(v.x, v.y, HW() ? '#b14bff' : NV() ? '#ff3b4e' : FA() ? '#ffb347' : '#ff2bd6', 30, 500); viruses.splice(i, 1); }); if (L.dead) return; }
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
  if (NV() && (state === 'menu' || zona === 3)) drawAurora(t);   // aurora boreal: en el menú y en la zona «AURORA BOREAL"
  // estrellas
  for (const s of stars) { const a = .35 + .35 * Math.sin(t * 2 + s.t); ctx.fillStyle = `rgba(255,255,255,${a})`; const x = ((s.x - camX * .02) % W + W) % W; ctx.fillRect(x, s.y, s.s, s.s); }
  // sol
  drawMoon(t);
  if (HW()) drawBandada(t);
  if (NV()) drawTrineo(t);
  if (FA()) drawFuegos(t);
  drawLayerSet(prevLayers, 1 - layerFade, t); drawLayerSet(layers, prevLayers ? layerFade : 1, t);
  if (HW()) drawNiebla(t);
  if (NV()) drawNieve(t, 0);
  if (FA()) drawHumo(t);

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
  if (NV()) drawNieve(t, 1);
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
  if (NV()) { g.fillStyle = 'rgba(160,205,255,.22)'; g.fillRect(0, 0, px, px); }
  else if (FA()) { g.fillStyle = 'rgba(255,170,90,.2)'; g.fillRect(0, 0, px, px); }
  else if (HW()) { g.fillStyle = rgba(ZONAS[zona].sun2, .38); g.fillRect(0, 0, px, px); g.fillStyle = 'rgba(255,240,200,.12)'; g.fillRect(0, 0, px, px); }
  else if (zona > 0) { g.fillStyle = rgba(ZONAS[zona].a, .09); g.fillRect(0, 0, px, px); }
  g.globalCompositeOperation = 'source-over';
  }
  const z = ZONAS[zona], pul = 1 + Math.sin(t * 1.4) * .05;
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = HW() ? .42 : NV() || FA() ? .34 : .28;
  ctx.drawImage(glowSpr(HW() || NV() || FA() ? z.sun2 : z.a), cx - mr * 2.3 * pul, cy - mr * 2.3 * pul, mr * 4.6 * pul, mr * 4.6 * pul);
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
  if (NV()) { drawGuirnalda(t); }
  else if (FA()) { drawTraca(t); }
  else if (HW()) {
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
    else if (NV()) ctx.drawImage(spriteMoneda(), c.x - 30 * w, c.y - 30, 60 * w, 60);
    else if (FA()) { const k = .78 + .22 * w; ctx.drawImage(spriteBunuelo(), c.x - 30 * k, c.y - 30, 60 * k, 60); }
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
    if (NV()) { drawBaston(e, l, t); continue; }
    if (FA()) { drawRistra(e, l, t); continue; }
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
    if (NV()) { drawBolaMala(v, t); continue; }
    if (FA()) { if (Math.floor(Math.abs(v.y0) / 41) % 2) drawTNT(v, t); else drawNinot(v, t); continue; }
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
    if (NV()) { drawCarambano(m, t); continue; }
    if (FA()) { drawCohete(m, t); continue; }
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
  $('#btnCerrar').classList.toggle('oculto', id !== '#sMenu');
  if (id) { const s = $(id); s.classList.add('show'); if (dim) s.classList.add('dim'); }
}
/* Ventana de confirmación con el estilo del juego (sustituye a confirm()) */
function confirma(o) {
  return new Promise(ok => {
    const m = $('#modal'), si = $('#mSi'), no = $('#mNo');
    if (/^</.test(o.ico || '')) $('#mIco').innerHTML = o.ico; else $('#mIco').textContent = o.ico || '?';
    $('#mIco').className = 'mIco' + (o.peligro ? ' peligro' : '');
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
const FRASES_X = ['¡Feliz Navidad!', 'Ho, ho, ho… ¡a volar!', 'Recoge monedas de oro', 'Cuidado con los bastones de caramelo', 'Las bolas de Navidad muerden', '¡Carámbanos a la vista!', 'Futurmovil: fibra, móvil y TV'];
const FRASES_F = ['¡Bones Falles!', '¡Que empiece la mascletà!', 'Cuidado con las tracas', '¡Cohetes a la vista!', 'Recoge buñuelos', '¡Visca les Falles!', 'Futurmovil: fibra, móvil y TV'];
const FRASES = (TEMA === 'halloween' ? FRASES_H : TEMA === 'navidad' ? FRASES_X : TEMA === 'fallas' ? FRASES_F : FRASES_N).slice();
let fraseI = 0, fraseTimer;
function goMenu() {
  state = 'menu'; L.vis = false; Audio5.mode('menu'); Audio5.thrustOff();
  if (temaPendiente) aplicaTema(temaPendiente, false, true);
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
  if ($('#sInv').classList.contains('show') || CHAT_ON) return;
  if (!SES) { abrirLogin('entrar'); return; }
  PARTIDA = null; api('inicio', { token: SES.token }).then(d => { if (d.ok) { PARTIDA = d.partida; if (d.minimo) MIN_HOY = d.minimo; } else if (d.sesion === false) { SES = null; store('ses', null); } });
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
function retoCartel(d, pts) {
  const el = $('#finProx'), n = v => Number(v).toLocaleString('es-ES');
  if (d.item) {
    el.className = 'finProx sube';
    el.innerHTML = `<i>🔥</i><div><small>¡RETO SUBIDO!</small><b>Próximo trofeo de hoy: <em>${n(d.siguiente)}</em> puntos</b><span>Buen vuelo, piloto. El siguiente te costará un poco más… ¡esfuérzate!</span></div>`;
  } else if (d.minimo > d.base && pts >= d.base) {
    el.className = 'finProx casi';
    el.innerHTML = `<i>🎯</i><div><small>TU RETO DE HOY</small><b>Necesitas <em>${n(d.minimo)}</em> puntos para el siguiente trofeo</b><span>Te faltaron ${n(d.minimo - pts)}. ¡Mañana el reto vuelve a ${n(d.base)}!</span></div>`;
  } else return;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
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
        if (d.siguiente) { MIN_HOY = d.siguiente; retoCartel(d, r.pts); }
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
/* ---- salir del juego ---- */
$('#btnCerrar').onclick = () => {
  confirma({ ico: '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 3v8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M6.6 6.6a8 8 0 1 0 10.8 0" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>', titulo: 'Salir del juego', html: '¿Seguro que quieres salir de <b>LUCASBOT 5G</b>?', si: 'Salir', no: 'Seguir jugando', peligro: true }).then(si => {
    if (!si) return;
    Audio5.apagar(); clearInterval(fraseTimer); state = 'adios';
    try { window.close(); } catch (e) {}
    setTimeout(() => { if (!document.hidden) show('#sAdios', true); }, 350);   // si el navegador no deja cerrar, pantalla de despedida
  });
};
$('#btnVolverJuego').onclick = () => { Audio5.encender(); Audio5.click(); goMenu(); };
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
let PREMIO = null, premioAvisado = false, MIN_HOY = 0;   // MIN_HOY: reto personal de hoy (sube 1.000 con cada trofeo)
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
let last = performance.now(), CHAT_ON = false;
function loop(now) {
  const dt = Math.min(.034, (now - last) / 1000); last = now;
  if (CHAT_ON) { requestAnimationFrame(loop); return; }   // en la sala de chat no se dibuja el juego de fondo
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
const VERSION = 37;   // subir este número (y version.json) en cada actualización
let nuevaVersion = 0, actualizando = false, ultVer = 0;
function compruebaVersion(forzar) {
  if (actualizando || (!forzar && Date.now() - ultVer < 30000)) return; ultVer = Date.now();
  fetch('version.json?n=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null)
    .then(d => { if (d && Number(d.v) > VERSION) { nuevaVersion = Number(d.v); intentaActualizar(); } }).catch(() => {});
}
function libreParaActualizar() {
  return state === 'menu' && $('#sMenu').classList.contains('show') && !guardando && !$('#sInv').classList.contains('show') && !CHAT_ON
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
  function pintaTemas() {
    const act = (ADMD && ADMD.tema) || 'normal';
    $$('#admTemas .tema[data-tema]').forEach(b => { b.classList.toggle('on', b.dataset.tema === act); b.classList.toggle('prueba', !!TEMA_PRUEBA && b.dataset.tema === TEMA_PRUEBA); });
    $('#chkPruebas').checked = !!TEMA_PRUEBA;
    $('#pruebasTxt').textContent = TEMA_PRUEBA ? 'Estás probando un tema solo en este dispositivo. Los jugadores siguen viendo el tema marcado como ACTIVO.' : 'Actívalo para probar un tema solo tú, sin que lo vean los jugadores.';
  }
  $('#chkPruebas').onchange = e => {
    if (e.target.checked) { TEMA_PRUEBA = TEMA; store('temaPrueba', TEMA_PRUEBA); toast('Modo pruebas activado: los cambios de tema solo los verás tú'); }
    else { TEMA_PRUEBA = null; store('temaPrueba', null); aplicaTema((ADMD && ADMD.tema) || TEMA_SERVIDOR, false, true); toast('Modo pruebas desactivado: vuelves a ver lo mismo que los jugadores'); }
    document.body.classList.toggle('pruebas', !!TEMA_PRUEBA); Audio5.click(); pintaTemas();
  };
  $$('#admTemas .tema[data-tema]').forEach(b => b.onclick = () => {
    const t = b.dataset.tema;
    if (TEMA_PRUEBA) { TEMA_PRUEBA = t; store('temaPrueba', t); aplicaTema(t, false, true); pintaTemas(); Audio5.click(); toast('Probando el tema ' + b.querySelector('b').textContent + ' (solo tú)'); return; }
    if (ADMD && ADMD.tema === t) return;
    const NOMS = { normal: ['Normal', '🤖'], halloween: ['Halloween', '🎃'], navidad: ['Navidad', '🎄'], fallas: ['Fallas', '🔥'] }, nom = NOMS[t][0] + ' ' + NOMS[t][1];
    confirma({ ico: NOMS[t][1], titulo: 'Cambiar tema', si: 'Activar ' + NOMS[t][0], no: 'Cancelar',
      html: `El juego pasará a modo <b>${nom}</b> para todos los jugadores.` }).then(si => {
      if (!si) return;
      adm('tema', { tema: t }).then(d => { if (!d.ok) return toast(d.error || 'No se pudo cambiar'); ADMD.tema = t; aplicaTema(t); pintaTemas(); toast('Tema ' + nom + ' activado para todos'); Audio5.record(); });
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
  const salaAbierta = () => $('#sInv').classList.contains('show') || CHAT_ON;
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
  window.trueque = {   // para la sala de chat
    invitar(usuario) { api('trato', { token: SES.token, op: 'invitar', a: usuario }).then(d => { if (!d.ok) return toast(d.error || 'No se pudo invitar'); Audio5.click(); recibe(d.trato, true); }); },
    activo: () => TR && (TR.estado === 'invitado' || TR.estado === 'abierto'), ver: () => TR && muestraTrato(TR)
  };

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


/* =========================================================
   MODO NAVIDAD · escenario y enemigos
   ========================================================= */
function bordeSuperior(name, im) {   // altura del tejado en cada columna (normalizada), calculada una vez
  if (NIEVE_TOP[name]) return NIEVE_TOP[name];
  try {
    const sw = 360, sh = 120, c = off(sw, sh), g = c.getContext('2d'); g.drawImage(im, 0, 0, sw, sh);
    const d = g.getImageData(0, 0, sw, sh).data, top = [];
    for (let x = 0; x < sw; x++) { let t = 1; for (let y = 0; y < sh; y++) if (d[(y * sw + x) * 4 + 3] > 160) { t = y / sh; break; } top.push(t); }
    return NIEVE_TOP[name] = top;
  } catch (e) { return NIEVE_TOP[name] = []; }
}
function nieveTejados(g, name, im, w, h, R) {
  const top = bordeSuperior(name, im); if (!top.length) return;
  const n = top.length, cw = g.canvas.width / n, H0 = g.canvas.height, gr = name === 'altos' ? 2.2 : 3.2;
  g.globalCompositeOperation = 'source-over';
  for (let i = 1; i < n - 1; i++) {
    const t = top[i]; if (t >= .97) continue;
    const y = t * H0, plano = Math.abs(top[i - 1] - t) * H0 < 4 * R && Math.abs(top[i + 1] - t) * H0 < 4 * R;
    if (!plano) continue;
    const th = (gr + Math.sin(i * 1.7) * .8) * R;
    g.fillStyle = '#eef6ff'; g.fillRect(i * cw - .5, y - th * .55, cw + 1, th);
    g.fillStyle = 'rgba(190,215,255,.7)'; g.fillRect(i * cw - .5, y + th * .45, cw + 1, R * .8);
    if (i % 23 === 0) { g.fillStyle = 'rgba(225,240,255,.9)'; g.fillRect(i * cw, y + th * .4, cw * .6, th * rnd(1.2, 2.6)); }   // carámbanos pequeños
  }
}
function lucesCapa(name, im, w, h) {
  if (!LUCES_POS[name]) {
    const top = bordeSuperior(name, im), n = top.length, out = [];
    let i = 2;
    while (i < n - 12 && out.length < 44) {
      let j = i; while (j < n - 1 && top[j] < .9 && Math.abs(top[j + 1] - top[i]) < .025) j++;
      if (j - i >= 12) {
        const len = j - i;
        for (let k = 0; k <= len; k += 3) { const xx = i + k, sag = Math.sin(k / len * Math.PI) * .03; out.push([xx / n, top[xx] + .035 + sag, out.length % 4]); }
        i = j + 4;
      } else i++;
    }
    LUCES_POS[name] = out;
  }
  return { luces: LUCES_POS[name].map(e => [e[0] * w, e[1] * h, e[2]]), lucS: name === 'altos' ? .8 : 1.15 };
}
function spriteBombillas() {
  if (bombillas) return bombillas;
  return bombillas = ['#ff3b4e', '#2fe37a', '#ffd23f', '#4aa8ff'].map(col => { const c = off(48, 48), g = c.getContext('2d'); g.drawImage(glowSpr(col), 0, 0, 48, 48); g.fillStyle = '#fff'; g.beginPath(); g.arc(24, 24, 3.2, 0, TAU); g.fill(); return c; });
}
function drawLuces(Lr, o, y, t) {
  const sp = spriteBombillas(), a0 = ctx.globalAlpha, paso = Math.floor(t * 3.5), s = Lr.lucS * 14;
  ctx.globalCompositeOperation = 'lighter';
  for (let x = o; x < W; x += Lr.w) for (let i = 0; i < Lr.luces.length; i++) {
    const e = Lr.luces[i], ex = x + e[0]; if (ex < -20 || ex > W + 20) continue;
    ctx.globalAlpha = a0 * ((i + paso) % 4 === 0 ? .25 : 1);
    ctx.drawImage(sp[e[2]], ex - s, y + e[1] - s, s * 2, s * 2);
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a0;
}
// pinos nevados (algunos decorados)
function capaPinos(R) {
  const clave = R + '|' + GROUND; if (pinosC && pinosC.clave === clave) return pinosC.v;
  const h = GROUND * .5, c = off(TILE * R, h * R), g = c.getContext('2d'); g.scale(R, R);
  let x = rnd(30, 120);
  while (x < TILE - 60) {
    const th = h * rnd(.5, .95), bw = th * rnd(.36, .46), tiers = 4, deco = Math.random() < .4;
    g.fillStyle = '#2a1608'; g.fillRect(x - th * .03, h - th * .12, th * .06, th * .12);
    for (let k = 0; k < tiers; k++) {
      const yb = h - th * .1 - k * th * .21, ww = bw * (1 - k * .2), yt = yb - th * .34;
      g.fillStyle = k % 2 ? '#0c2e1d' : '#0a2618';
      g.beginPath(); g.moveTo(x - ww / 2, yb); g.quadraticCurveTo(x - ww * .2, yb - th * .05, x, yt); g.quadraticCurveTo(x + ww * .2, yb - th * .05, x + ww / 2, yb); g.closePath(); g.fill();
      g.fillStyle = 'rgba(235,245,255,.92)';   // nieve en el borde de cada piso
      g.beginPath(); g.moveTo(x - ww / 2, yb); g.quadraticCurveTo(x, yb - th * .045, x + ww / 2, yb); g.quadraticCurveTo(x, yb - th * .015, x - ww / 2, yb); g.fill();
      if (deco) { ['#ff3b4e', '#ffd23f', '#4aa8ff', '#2fe37a'].forEach((col, q) => { g.fillStyle = col; g.beginPath(); g.arc(x + (q - 1.5) * ww * .2, yb - th * .06 - (q % 2) * th * .04, 1.8, 0, TAU); g.fill(); }); }
    }
    if (deco) { g.fillStyle = '#ffd23f'; g.save(); g.translate(x, h - th * .1 - (tiers - 1) * th * .21 - th * .35); g.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 2.6 : 6, a = k / 10 * TAU - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.fill(); g.restore(); }
    x += rnd(110, 230);
  }
  // nieve acumulada al pie
  g.fillStyle = '#dfeeff'; for (let xx = 0; xx < TILE; xx += 40) { g.beginPath(); g.ellipse(xx + 20, h + 2, 34, 8, 0, Math.PI, 0); g.fill(); }
  const v = { c, w: TILE, h }; pinosC = { clave, v }; return v;
}
// primer plano: nieve, regalos, muñecos de nieve, farolas y bastones
function capaRegalos(R) {
  const clave = R + '|' + GROUND; if (regalosC && regalosC.clave === clave) return regalosC.v;
  const h = 76, c = off(TILE * R, h * R), g = c.getContext('2d'); g.scale(R, R);
  const regalo = (x, w, hh, col, cinta) => {
    g.fillStyle = col; g.fillRect(x - w / 2, h - 8 - hh, w, hh);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x - w / 2, h - 8 - hh, w * .35, hh);
    g.fillStyle = cinta; g.fillRect(x - 2.5, h - 8 - hh, 5, hh); g.fillRect(x - w / 2, h - 8 - hh * .6, w, 4);
    g.beginPath(); g.ellipse(x - 5, h - 10 - hh, 5, 3, -.5, 0, TAU); g.ellipse(x + 5, h - 10 - hh, 5, 3, .5, 0, TAU); g.fill();
  };
  const muneco = x => {
    g.fillStyle = '#f4f9ff'; [[0, 14, 14], [0, 36, 10], [0, 52, 7.5]].forEach(([dx, dy, r]) => { g.beginPath(); g.arc(x + dx, h - 8 - dy, r, 0, TAU); g.fill(); });
    g.fillStyle = 'rgba(160,190,230,.45)'; g.beginPath(); g.arc(x + 4, h - 8 - 12, 12, 0, TAU); g.fill();
    g.fillStyle = '#111'; g.fillRect(x - 8, h - 8 - 62, 16, 3); g.fillRect(x - 5.5, h - 8 - 74, 11, 12);
    g.fillStyle = '#ff3b4e'; g.fillRect(x - 5.5, h - 8 - 65, 11, 2.5);
    g.fillStyle = '#111'; g.beginPath(); g.arc(x - 2.6, h - 8 - 54, 1.1, 0, TAU); g.arc(x + 2.6, h - 8 - 54, 1.1, 0, TAU); g.fill();
    g.fillStyle = '#ff8a1f'; g.beginPath(); g.moveTo(x, h - 8 - 52); g.lineTo(x - 9, h - 8 - 50.5); g.lineTo(x, h - 8 - 50); g.fill();
    g.strokeStyle = '#3a2412'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 9, h - 8 - 38); g.lineTo(x - 22, h - 8 - 46); g.moveTo(x + 9, h - 8 - 38); g.lineTo(x + 22, h - 8 - 44); g.stroke();
    g.fillStyle = '#2fe37a'; g.fillRect(x - 8, h - 8 - 46, 16, 3); g.fillRect(x + 3, h - 8 - 46, 3, 10);
  };
  const farola = x => {
    g.fillStyle = 'rgba(255,200,110,.18)'; g.beginPath(); g.arc(x, h - 66, 24, 0, TAU); g.fill();
    g.fillStyle = '#0b1424'; g.fillRect(x - 1.8, h - 64, 3.6, 56); g.fillRect(x - 6, h - 70, 12, 6);
    g.fillStyle = '#ffd88a'; g.fillRect(x - 4, h - 68, 8, 4);
    g.fillStyle = '#ff3b4e'; g.beginPath(); g.ellipse(x, h - 52, 6, 3, 0, 0, TAU); g.fill();
  };
  const baston = x => { g.lineWidth = 4.5; g.lineCap = 'round'; g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(x, h - 8); g.lineTo(x, h - 42); g.arc(x - 7, h - 42, 7, 0, Math.PI, true); g.stroke();
    g.strokeStyle = '#e8102f'; g.setLineDash([4, 4]); g.stroke(); g.setLineDash([]); };
  let x = 40;
  while (x < TILE - 50) {
    const r = Math.random();
    if (r < .38) { const n = 1 + Math.floor(Math.random() * 3); for (let k = 0; k < n; k++) regalo(x + k * 22, rnd(16, 24), rnd(12, 22), pick(['#c8102e', '#127a3a', '#1f4fbf', '#c99a0c']), pick(['#ffd23f', '#ffffff', '#ff3b4e'])); x += n * 22 + rnd(60, 130); }
    else if (r < .58) { muneco(x); x += rnd(110, 200); }
    else if (r < .78) { farola(x); x += rnd(120, 220); }
    else { baston(x); x += rnd(80, 160); }
  }
  g.fillStyle = '#eaf4ff';   // montículos de nieve
  for (let xx = -20; xx < TILE + 20; xx += 34) { g.beginPath(); g.ellipse(xx, h - 4, rnd(24, 34), rnd(6, 10), 0, Math.PI, 0); g.fill(); }
  g.fillRect(0, h - 5, TILE, 5);
  const v = { c, w: TILE, h }; regalosC = { clave, v }; return v;
}
// aurora boreal (franja horneada que se desplaza muy despacio)
let auroraC = null;
function drawAurora(t) {
  const TW = 1800, TH = Math.round(GROUND * .55);
  if (!auroraC || auroraC.clave !== TH) {
    const k = .4, c = off(TW * k, TH * k), g = c.getContext('2d'); g.scale(k, k);
    [['#3dffb0', 0], ['#38e8ff', 2.1], ['#b07dff', 4.2]].forEach(([col, f], q) => {
      for (let x = 0; x < TW; x += 6) {
        const base = TH * (.42 + .16 * Math.sin(x / 260 + f) + .06 * Math.sin(x / 90 + f * 2)), alto = TH * (.18 + .12 * Math.sin(x / 170 + f * 1.3));
        const gr = g.createLinearGradient(0, base - alto, 0, base); gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(.75, rgba(col, q === 2 ? .10 : .16)); gr.addColorStop(1, rgba(col, 0));
        g.fillStyle = gr; g.fillRect(x, base - alto, 7, alto);
      }
    });
    auroraC = { clave: TH, c };
  }
  const o = -(((t * 9 + camX * .02) % TW) + TW) % TW;
  ctx.globalAlpha = .75 + .25 * Math.sin(t * .5);
  for (let x = o; x < W; x += TW) ctx.drawImage(auroraC.c, x, CEIL, TW + 1, TH);
  ctx.globalAlpha = 1;
}
// trineo de Santa pasando por delante de la luna
function drawTrineo(t) {
  const PER = 26, p = (t % PER) / PER; if (p > .55 || !LUNA.r) return;
  const k = p / .55, x = W + 260 - k * (W + 820), y = LUNA.y - LUNA.r * .15 + Math.sin(k * 9) * 10 - k * 30, s = Math.max(.55, Math.min(1, LUNA.r / 120));
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = ctx.strokeStyle = '#06101f'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  // trineo
  ctx.beginPath(); ctx.moveTo(150, 4); ctx.quadraticCurveTo(160, -22, 196, -20); ctx.lineTo(206, 4); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(140, 12); ctx.lineTo(210, 12); ctx.quadraticCurveTo(218, 12, 216, 4); ctx.stroke();
  ctx.beginPath(); ctx.arc(172, -26, 9, 0, TAU); ctx.fill();   // Santa
  ctx.beginPath(); ctx.moveTo(166, -32); ctx.lineTo(176, -46); ctx.lineTo(180, -30); ctx.fill();
  ctx.beginPath(); ctx.ellipse(192, -26, 11, 9, 0, 0, TAU); ctx.fill();   // saco
  // renos
  for (let r = 0; r < 4; r++) {
    const rx = r * 34, ry = -6 + Math.sin(t * 9 + r) * 2, pata = Math.sin(t * 14 + r * 1.3) * 6;
    ctx.beginPath(); ctx.ellipse(rx, ry, 12, 5.5, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(rx - 13, ry - 7, 4.5, 3.5, -.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(rx - 9, ry - 3); ctx.lineTo(rx - 12, ry - 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rx - 14, ry - 10); ctx.lineTo(rx - 12, ry - 17); ctx.lineTo(rx - 16, ry - 20); ctx.moveTo(rx - 12, ry - 17); ctx.lineTo(rx - 8, ry - 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rx - 7, ry + 3); ctx.lineTo(rx - 9 - pata, ry + 12); ctx.moveTo(rx + 8, ry + 3); ctx.lineTo(rx + 10 + pata, ry + 12); ctx.stroke();
    if (r < 3) { ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(rx + 10, ry); ctx.lineTo(rx + 22, ry - 4); ctx.stroke(); ctx.lineWidth = 2; }
  }
  ctx.beginPath(); ctx.moveTo(112, -6); ctx.lineTo(160, -12); ctx.lineWidth = 1; ctx.stroke();
  // nariz de Rudolph
  ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSpr('#ff2b2b'), -32, -22, 22, 22); ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#ff3030'; ctx.beginPath(); ctx.arc(-21, -11, 2.2, 0, TAU); ctx.fill();
  ctx.restore();
  // estela de purpurina
  if (Math.random() < .5) P(camX + x + 200 * s, y, rnd(40, 90), rnd(-10, 30), .8, rnd(2, 4), pick(['#ffd23f', '#ffffff', '#7af0ff']), 'glow');
}
// nieve cayendo (capa 0 detrás, capa 1 delante)
let nieveT = 0;
function drawNieve(t, capa) {
  if (!copos) { copos = []; for (let i = 0; i < 150; i++) { const big = i < 22; copos.push({ x: Math.random() * W, y: Math.random() * H, r: big ? rnd(2.4, 3.8) : rnd(.8, 2), v: big ? rnd(55, 85) : rnd(25, 55), ph: Math.random() * TAU, c: big ? 1 : 0 }); } }
  if (capa === 0) {
    const dt = Math.min(.05, nieveT ? t - nieveT : 0); nieveT = t;
    const viento = (state === 'play' ? speed : 140) * .12;
    for (const f of copos) {
      f.y += f.v * dt; f.x += (Math.sin(t * 1.3 + f.ph) * 18 - viento * (f.c ? 1.6 : 1)) * dt;
      if (f.y > H + 6) { f.y = -6; f.x = Math.random() * W; } if (f.x < -10) f.x += W + 20; if (f.x > W + 10) f.x -= W + 20;
    }
  }
  ctx.fillStyle = capa ? 'rgba(255,255,255,.9)' : 'rgba(225,238,255,.7)'; ctx.beginPath();
  for (const f of copos) if (f.c === capa) { ctx.moveTo(f.x + f.r, f.y); ctx.arc(f.x, f.y, f.r, 0, TAU); }
  ctx.fill();
}
// guirnalda del techo con bombillas
function drawGuirnalda(t) {
  const TW = 640;
  if (!guirnaldaC) {
    guirnaldaC = [0, 1].map(fase => {
      const c = off(TW * 2, 70 * 2), g = c.getContext('2d'); g.scale(2, 2);
      g.strokeStyle = '#0d4a26'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath();
      for (let x = 0; x <= TW; x += 80) { g.moveTo(x, 4); g.quadraticCurveTo(x + 40, 26, x + 80, 4); } g.stroke();
      g.strokeStyle = '#1b7a3e'; g.lineWidth = 2; g.setLineDash([2, 3]); g.stroke(); g.setLineDash([]);
      const cols = ['#ff3b4e', '#ffd23f', '#4aa8ff', '#2fe37a'];
      for (let x = 0, i = 0; x < TW; x += 20, i++) {
        const tt = (x % 80) / 80, y = 4 + 4 * 22 * tt * (1 - tt) + 6, on = (i + fase) % 2 === 0, col = cols[i % 4];
        if (on) { g.globalAlpha = .8; g.drawImage(glowSpr(col), x - 12, y - 10, 24, 24); g.globalAlpha = 1; }
        g.fillStyle = on ? col : rgba(col, .35); g.beginPath(); g.ellipse(x, y + 2, 3, 4.5, 0, 0, TAU); g.fill();
        g.fillStyle = '#c9b46a'; g.fillRect(x - 2, y - 3, 4, 3);
      }
      return c;
    });
  }
  const o = -(camX % TW), gc = guirnaldaC[Math.floor(t * 2) % 2];
  for (let x = o; x < W; x += TW) ctx.drawImage(gc, x, CEIL - 6, TW + 1, 70);
}
// moneda de oro (datos)
function spriteMoneda() {
  if (monedaSpr) return monedaSpr;
  const c = off(120, 120), g = c.getContext('2d'); g.globalAlpha = .6; g.drawImage(glowSpr('#ffcc33'), 0, 0, 120, 120); g.globalAlpha = 1;
  g.translate(60, 60);
  let gr = g.createLinearGradient(-20, -20, 20, 20); gr.addColorStop(0, '#fff2a8'); gr.addColorStop(.5, '#ffc928'); gr.addColorStop(1, '#b07800');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 21, 0, TAU); g.fill();
  g.strokeStyle = '#8a5a00'; g.lineWidth = 2; g.stroke();
  g.strokeStyle = 'rgba(255,250,210,.8)'; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, 16, 0, TAU); g.stroke();
  g.fillStyle = '#d99a00'; g.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 4.5 : 11, a = k / 10 * TAU - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.fill();
  g.fillStyle = '#fff6c4'; g.beginPath(); g.ellipse(-8, -9, 6, 3, -.7, 0, TAU); g.fill();
  return monedaSpr = c;
}
// enemigo: bastón de caramelo (sustituye al láser)
function drawBaston(e, l, t) {
  const x1 = e[0], y1 = e[1], x2 = e[2], y2 = e[3], dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux, R0 = 11;
  const cx = x2 + nx * R0, cy = y2 + ny * R0, a0 = Math.atan2(-ny, -nx);
  const traza = () => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.arc(cx, cy, R0, a0, a0 + Math.PI * 1.15, true); };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255,60,80,.12)'; ctx.lineWidth = 28; traza(); ctx.stroke();
  ctx.strokeStyle = '#fbfbff'; ctx.lineWidth = 13; traza(); ctx.stroke();
  ctx.lineCap = 'butt'; ctx.lineWidth = 12; ctx.strokeStyle = '#e3102c'; ctx.setLineDash([7, 8]); ctx.lineDashOffset = -(t * 34 + l.ph * 10); traza(); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x1 - nx * 3, y1 - ny * 3); ctx.lineTo(x2 - nx * 3, y2 - ny * 3); ctx.stroke();
  if (l.rs) { ctx.fillStyle = '#e3102c'; ctx.beginPath(); ctx.arc(l.x, l.y, 4, 0, TAU); ctx.fill(); }
}
// enemigo: bola de Navidad malvada (sustituye al virus)
const COL_BOLA = [['#ff5a6e', '#c8102e', '#5a0010'], ['#5cff9a', '#0fa94a', '#04361a'], ['#7ab8ff', '#1f5fff', '#081a55'], ['#fff0a0', '#e0a400', '#5a3c00']];
function drawBolaMala(v, t) {
  const cb = COL_BOLA[Math.floor(Math.abs(v.y0) / 37) % 4];
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .55; ctx.drawImage(glowSpr(cb[1]), v.x - 46, v.y - 46, 92, 92); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.translate(v.x, v.y); ctx.rotate(Math.sin(t * 3 + v.ph) * .22);
  // mecha chispeante
  ctx.strokeStyle = '#6b5a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -27); ctx.quadraticCurveTo(6, -34, 3, -40); ctx.stroke();
  ctx.globalCompositeOperation = 'lighter'; const ch = 14 + Math.random() * 10; ctx.drawImage(glowSpr('#ffd23f'), 3 - ch / 2, -40 - ch / 2, ch, ch); ctx.globalCompositeOperation = 'source-over';
  // cuerpo brillante
  const gr = ctx.createRadialGradient(-7, -8, 2, 0, 0, 22); gr.addColorStop(0, cb[0]); gr.addColorStop(.55, cb[1]); gr.addColorStop(1, cb[2]);
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 6, 19, 5, 0, 0, TAU); ctx.stroke();   // franja decorativa
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(-8, -10, 5, 2.6, -.6, 0, TAU); ctx.fill();
  // capuchón dorado
  ctx.fillStyle = '#d9b44a'; ctx.fillRect(-6, -25, 12, 6); ctx.fillStyle = '#fff1a8'; ctx.fillRect(-6, -25, 12, 1.6);
  // cara malvada
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-7, -2, 4.6, 5.2, 0, 0, TAU); ctx.ellipse(7, -2, 4.6, 5.2, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#120006'; ctx.beginPath(); ctx.arc(-6, -1, 2.3, 0, TAU); ctx.arc(6, -1, 2.3, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#120006'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-12, -9); ctx.lineTo(-3, -6); ctx.moveTo(12, -9); ctx.lineTo(3, -6); ctx.stroke();
  ctx.fillStyle = '#120006'; ctx.beginPath(); ctx.moveTo(-8, 8); ctx.quadraticCurveTo(0, 15, 8, 8); ctx.quadraticCurveTo(0, 11, -8, 8); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-5, 9); ctx.lineTo(-3.5, 12); ctx.lineTo(-2, 9.6); ctx.moveTo(2, 9.6); ctx.lineTo(3.5, 12); ctx.lineTo(5, 9); ctx.fill();
  ctx.restore();
}
// enemigo: carámbano de hielo (sustituye al misil)
function drawCarambano(m, t) {
  ctx.save(); ctx.translate(m.x, m.y);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 1; i <= 3; i++) { ctx.strokeStyle = `rgba(190,230,255,${.22 / i})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(36 + i * 8, -7 + i * 5); ctx.lineTo(86 + i * 24, -7 + i * 5); ctx.stroke(); }
  ctx.drawImage(glowSpr('#9fd8ff'), -44, -24, 92, 48);
  ctx.globalCompositeOperation = 'source-over';
  const gr = ctx.createLinearGradient(0, -12, 0, 12); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.5, '#bfe6ff'); gr.addColorStop(1, '#5aa6ef');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(-42, 0); ctx.lineTo(30, -12); ctx.lineTo(34, -6); ctx.lineTo(38, -10); ctx.lineTo(40, 0); ctx.lineTo(38, 9); ctx.lineTo(33, 6); ctx.lineTo(30, 12); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-36, -1); ctx.lineTo(28, -9); ctx.stroke();
  ctx.strokeStyle = 'rgba(90,150,220,.5)'; ctx.beginPath(); ctx.moveTo(-20, 1); ctx.lineTo(20, 5); ctx.moveTo(0, -4); ctx.lineTo(24, -2); ctx.stroke();
  const gl = ((t * 1.6) % 1) * 70 - 40; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.moveTo(gl, -7); ctx.lineTo(gl + 4, -7); ctx.lineTo(gl + 1, 6); ctx.lineTo(gl - 3, 6); ctx.fill();
  ctx.restore();
  if (Math.random() < .35) P(m.x + rnd(20, 40), m.y + rnd(-8, 8), rnd(60, 160), rnd(-20, 20), .5, rnd(1.5, 3), '#dff2ff', 'glow');
}


/* =========================================================
   MODO FALLAS · escenario, fuegos y enemigos
   ========================================================= */
// arcos de luces estilo Ruzafa + falla monumental (capa intermedia)
function dibujaArcos(g, ancho, h) {
  const cols = ['#ffd23f', '#ffffff', '#ff4fd8', '#4ab8ff', '#ff5a3a'];
  const punto = (x, y, col, r) => { g.globalAlpha = .55; g.drawImage(glowSpr(col), x - r * 4, y - r * 4, r * 8, r * 8); g.globalAlpha = 1; g.fillStyle = '#fff8e0'; g.beginPath(); g.arc(x, y, r * .7, 0, TAU); g.fill(); };
  // falla monumental en el centro del tramo
  const fx = ancho * .55, fb = h, esc = Math.min(1, h / 280);
  g.save(); g.translate(fx, fb); g.scale(esc, esc); g.translate(-fx, -fb);
  g.fillStyle = '#1d3f8a'; g.fillRect(fx - 90, fb - 40, 180, 40); g.fillStyle = '#f4f1e8'; g.fillRect(fx - 90, fb - 40, 180, 6); g.fillStyle = '#ffd23f'; for (let k = 0; k < 9; k++) g.fillRect(fx - 84 + k * 20, fb - 26, 10, 10);
  g.fillStyle = '#c23b2a'; g.fillRect(fx - 60, fb - 70, 120, 30); g.fillStyle = '#ffd23f'; g.fillRect(fx - 60, fb - 70, 120, 4);
  // ninot gigante
  const nx = fx, ny = fb - 70;
  g.fillStyle = '#2f8f5a'; g.beginPath(); g.moveTo(nx - 36, ny); g.quadraticCurveTo(nx - 44, ny - 80, nx - 18, ny - 118); g.lineTo(nx + 18, ny - 118); g.quadraticCurveTo(nx + 44, ny - 80, nx + 36, ny); g.closePath(); g.fill();
  g.fillStyle = '#ffd23f'; g.fillRect(nx - 30, ny - 64, 60, 6);
  g.strokeStyle = '#f2c9a0'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(nx - 26, ny - 100); g.quadraticCurveTo(nx - 64, ny - 112, nx - 74, ny - 146); g.moveTo(nx + 26, ny - 100); g.quadraticCurveTo(nx + 66, ny - 92, nx + 80, ny - 128); g.stroke();
  g.fillStyle = '#f2c9a0'; g.beginPath(); g.arc(nx, ny - 150, 34, 0, TAU); g.fill();
  g.fillStyle = '#e8463a'; g.beginPath(); g.ellipse(nx + 14, ny - 146, 16, 11, .2, 0, TAU); g.fill();   // narizota
  g.fillStyle = '#fff'; g.beginPath(); g.arc(nx - 10, ny - 160, 9, 0, TAU); g.arc(nx + 12, ny - 162, 9, 0, TAU); g.fill();
  g.fillStyle = '#111'; g.beginPath(); g.arc(nx - 7, ny - 159, 4, 0, TAU); g.arc(nx + 15, ny - 161, 4, 0, TAU); g.fill();
  g.strokeStyle = '#7a2a1a'; g.lineWidth = 3; g.beginPath(); g.arc(nx + 2, ny - 136, 13, .25, Math.PI - .25); g.stroke();
  g.fillStyle = '#222'; g.beginPath(); g.ellipse(nx, ny - 182, 40, 8, 0, 0, TAU); g.fill(); g.fillRect(nx - 22, ny - 210, 44, 28);   // sombrero
  g.fillStyle = '#e8463a'; g.fillRect(nx - 22, ny - 192, 44, 6);
  // ninots pequeños alrededor
  [[-70, '#ff8ac7'], [70, '#7fd0ff']].forEach(([dx, col]) => { const bx = nx + dx; g.fillStyle = col; g.beginPath(); g.ellipse(bx, fb - 58, 12, 18, 0, 0, TAU); g.fill(); g.fillStyle = '#f2c9a0'; g.beginPath(); g.arc(bx, fb - 84, 11, 0, TAU); g.fill(); g.fillStyle = '#e8463a'; g.beginPath(); g.arc(bx + 6, fb - 83, 4, 0, TAU); g.fill(); });
  // la falla queda en segundo plano (algo más oscura que los obstáculos)
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(20,8,30,.42)'; g.fillRect(fx - 160, fb - 300, 320, 300); g.globalCompositeOperation = 'source-over';
  g.restore();
  // focos que iluminan la falla
  const fg = g.createRadialGradient(fx, fb - 120, 10, fx, fb - 120, 170); fg.addColorStop(0, 'rgba(255,220,150,.22)'); fg.addColorStop(1, 'rgba(255,220,150,0)');
  g.fillStyle = fg; g.fillRect(fx - 200, fb - 300, 400, 300);
  // arcos de luces (Ruzafa)
  const nA = Math.max(2, Math.round(ancho / 230)), pasoA = ancho / nA;
  for (let a = 0; a < nA; a++) { const x0 = a * pasoA + (pasoA - 190) / 2;
    if (Math.abs(x0 + 95 - fx) < 170) continue;
    const w = 190, top = h * .06, base = h - 6, ci = Math.floor(x0 / 230);
    g.strokeStyle = 'rgba(40,20,30,.8)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x0, base); g.lineTo(x0, top + 40); g.moveTo(x0 + w, base); g.lineTo(x0 + w, top + 40); g.stroke();
    for (let y = base; y > top + 40; y -= 11) { punto(x0, y, cols[(ci + 1) % 5], 1.6); punto(x0 + w, y, cols[(ci + 1) % 5], 1.6); }
    for (let k = 0; k <= 26; k++) { const a = Math.PI + k / 26 * Math.PI, x = x0 + w / 2 + Math.cos(a) * w / 2, y = top + 40 + Math.sin(a) * 40; punto(x, y, cols[ci % 5], 1.8); }
    for (let k = 0; k <= 18; k++) { const a = Math.PI + k / 18 * Math.PI, x = x0 + w / 2 + Math.cos(a) * w * .32, y = top + 52 + Math.sin(a) * 26; punto(x, y, cols[(ci + 2) % 5], 1.4); }
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; punto(x0 + w / 2 + Math.cos(a) * 12, top + 8 + Math.sin(a) * 12, cols[(ci + 3) % 5], 1.3); }   // rosetón
    punto(x0 + w / 2, top + 8, '#ffffff', 2.2);
  }
}
// primer plano: público viendo la mascletà (falleras, móviles grabando) y vallas
function capaGente(R) {
  const clave = R + '|' + GROUND; if (genteC && genteC.clave === clave) return genteC.v;
  const h = 64, c = off(TILE * R, h * R), g = c.getContext('2d'); g.scale(R, R);
  for (let x = 6; x < TILE; x += rnd(13, 20)) {
    const alto = rnd(26, 40), y = h - alto, fallera = Math.random() < .16, movil = Math.random() < .12;
    g.fillStyle = '#07040a';
    g.beginPath(); g.ellipse(x, h, rnd(11, 15), alto * .55, 0, Math.PI, 0); g.fill();
    g.beginPath(); g.arc(x, y + 4, rnd(6, 7.5), 0, TAU); g.fill();
    if (fallera) { g.beginPath(); g.arc(x - 8, y + 4, 3.6, 0, TAU); g.arc(x + 8, y + 4, 3.6, 0, TAU); g.fill(); g.fillStyle = '#ffd23f'; g.beginPath(); g.ellipse(x, y - 4, 6, 3, 0, Math.PI, 0); g.fill(); }
    if (movil) { const mx = x + rnd(-4, 6), my = y - 10; g.strokeStyle = '#07040a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 4, y + 14); g.lineTo(mx + 2, my + 8); g.stroke(); g.globalAlpha = .45; g.drawImage(glowSpr('#bfe6ff'), mx - 10, my - 10, 22, 22); g.globalAlpha = 1; g.fillStyle = '#dff2ff'; g.fillRect(mx - 3, my - 4, 7, 10); }
  }
  // vallas metálicas
  g.strokeStyle = 'rgba(160,170,190,.55)'; g.lineWidth = 1.5;
  for (let x = 0; x < TILE; x += 70) { g.strokeRect(x + 2, h - 26, 66, 22); for (let k = 8; k < 66; k += 8) { g.beginPath(); g.moveTo(x + 2 + k, h - 26); g.lineTo(x + 2 + k, h - 4); g.stroke(); } }
  const v = { c, w: TILE, h }; genteC = { clave, v }; return v;
}
// fuegos artificiales en el cielo (calculados sin crear objetos por fotograma)
const COL_FUEGO = ['#ffd23f', '#ff4fd8', '#4ab8ff', '#7dff6a', '#ff5a3a', '#ffffff'];
let fuegoSig = 0, fuegoT = 0;
function drawFuegos(t) {
  const dt = Math.min(.05, fuegoT ? t - fuegoT : 0); fuegoT = t;
  if (mascletaT > 0) { mascletaT -= dt; if (Math.random() < .35) { shake = Math.max(shake, 4); flash('#fff1c0', .06); } }
  if (t > fuegoSig && fuegos.length < 4) {
    fuegoSig = t + rnd(.7, 1.6) * (mascletaT > 0 ? .4 : 1);
    fuegos.push({ x: rnd(W * .08, W * .92), y: rnd(CEIL + 40, GROUND * .42), t0: t, col: pick(COL_FUEGO), col2: pick(COL_FUEGO), n: 26 + Math.floor(Math.random() * 10), v: rnd(110, 170), ph: Math.random() * 6 });
  }
  ctx.globalCompositeOperation = 'lighter';
  for (let i = fuegos.length - 1; i >= 0; i--) {
    const f = fuegos[i], age = t - f.t0, subida = .55;
    if (age > subida + 1.9) { fuegos.splice(i, 1); continue; }
    if (age < subida) {   // el cohete sube
      const k = age / subida, y = GROUND - (GROUND - f.y) * (1 - (1 - k) * (1 - k));
      ctx.globalAlpha = .9; ctx.drawImage(glowSpr('#ffcf7a'), f.x - 6, y - 6, 12, 12);
      ctx.globalAlpha = .35; ctx.drawImage(glowSpr('#ff9a3a'), f.x - 3, y + 4, 6, 26);
      continue;
    }
    const a = age - subida, al = Math.max(0, 1 - a / 1.9), r = f.v * (1 - Math.exp(-a * 2.6)), caida = 28 * a * a;
    if (a < .12) { ctx.globalAlpha = (1 - a / .12) * .7; ctx.drawImage(glowSpr(f.col), f.x - 70, f.y - 70, 140, 140); }
    for (let k = 0; k < f.n; k++) {
      const an = k / f.n * TAU + f.ph, rr = r * (k % 3 === 0 ? .62 : 1), x = f.x + Math.cos(an) * rr, y = f.y + Math.sin(an) * rr + caida;
      const parp = a > 1.1 ? (Math.sin(t * 40 + k) > 0 ? 1 : .3) : 1;
      ctx.globalAlpha = al * parp; ctx.drawImage(glowSpr(k % 3 === 0 ? f.col2 : f.col), x - 5, y - 5, 10, 10);
    }
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
// humo de pólvora a ras de suelo
function drawHumo(t) {
  const TW = 1600, TH = 170;
  if (!humoTira) {
    const k = .5, c = off(TW * k, TH * k), g = c.getContext('2d'); g.scale(k, k);
    for (let i = 0; i < 9; i++) {
      const x = i * 180 + 40, y = 100 + (i % 3) * 16, rx = 200, ry = 60;
      const gr = g.createRadialGradient(0, 0, 4, 0, 0, 1); gr.addColorStop(0, 'rgba(200,190,200,.16)'); gr.addColorStop(1, 'rgba(200,190,200,0)');
      for (const dx of [0, -TW]) { g.save(); g.translate(x + dx, y); g.scale(rx, ry); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore(); }
    }
    humoTira = c;
  }
  const o = -(((camX * .5 + t * 16) % TW) + TW) % TW;
  ctx.globalAlpha = (mascletaT > 0 ? 1 : .7) + .1 * Math.sin(t * .7);
  for (let x = o; x < W; x += TW) ctx.drawImage(humoTira, x, GROUND - TH + 24, TW + 1, TH);
  ctx.globalAlpha = 1;
}
// traca encendida colgada del techo
let tracaC = null;
function drawTraca(t) {
  const sp = 22, TW = sp * 40;
  if (!tracaC) {
    const c = off(TW * 2, 24 * 2), g = c.getContext('2d'); g.scale(2, 2);
    g.strokeStyle = '#8a6a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 4); g.lineTo(TW, 4); g.stroke();
    for (let k = 0; k < 40; k++) { const x = k * sp + sp / 2; g.fillStyle = k % 2 ? '#e3241b' : '#f2c21b'; g.fillRect(x - 3, 5, 6, 13); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(x - 3, 5, 2, 13); g.fillStyle = '#5a3a1a'; g.fillRect(x - .7, 4, 1.4, 2); }
    tracaC = c;
  }
  const o = -(camX % TW);
  for (let x = o; x < W; x += TW) ctx.drawImage(tracaC, x, CEIL, TW + 1, 24);
  const fuego = W - ((t * 260) % (W + 400));   // la explosión avanza y deja hueco
  ctx.fillStyle = '#03040a'; ctx.fillRect(fuego - 4, CEIL + 3, 124, 18);
  if (fuego > -20 && fuego < W + 20) {
    ctx.globalCompositeOperation = 'lighter'; const r = 22 + Math.random() * 18;
    ctx.drawImage(glowSpr('#ffcf5a'), fuego - r, CEIL + 10 - r, r * 2, r * 2); ctx.globalCompositeOperation = 'source-over';
    if (Math.random() < .5) P(camX + fuego + rnd(0, 30), CEIL + 12, rnd(-80, 80), rnd(20, 160), .5, rnd(2, 4), pick(['#ffd23f', '#ffffff', '#ff8a1f']), 'spark', { drag: 2 });
  }
}
// buñuelo (se recoge)
function spriteBunuelo() {
  if (bunSpr) return bunSpr;
  const c = off(120, 120), g = c.getContext('2d'); g.globalAlpha = .5; g.drawImage(glowSpr('#ffb347'), 0, 0, 120, 120); g.globalAlpha = 1;
  g.translate(60, 60);
  const gr = g.createRadialGradient(-6, -8, 4, 0, 0, 24); gr.addColorStop(0, '#ffd889'); gr.addColorStop(.6, '#d9862b'); gr.addColorStop(1, '#8a4a12');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 21, 0, TAU); g.arc(0, 0, 7, 0, TAU, true); g.fill('evenodd');
  g.strokeStyle = 'rgba(120,60,10,.6)'; g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, 14, .4, 2.2); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.85)'; for (let k = 0; k < 26; k++) { const a = Math.random() * TAU, r = rnd(9, 19); g.fillRect(Math.cos(a) * r, Math.sin(a) * r, 1.6, 1.6); }   // azúcar
  return bunSpr = c;
}
// enemigo: ristra de petardos con la mecha encendida (sustituye al láser)
function drawRistra(e, l, t) {
  const x1 = e[0], y1 = e[1], x2 = e[2], y2 = e[3], dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  ctx.strokeStyle = 'rgba(255,160,40,.10)'; ctx.lineWidth = 26; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = '#7a5528'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  const n = Math.floor(len / 9), chispa = ((t * .45 + l.ph * .1) % 1) * len;
  for (let i = 0; i <= n; i++) {
    const d = i * 9, x = x1 + ux * d, y = y1 + uy * d, lado = i % 2 ? 1 : -1;
    ctx.save(); ctx.translate(x + nx * lado * 5, y + ny * lado * 5); ctx.rotate(Math.atan2(ny, nx) + lado * .25);
    ctx.fillStyle = i % 3 === 0 ? '#f2c21b' : '#e3241b'; ctx.fillRect(-6, -3, 12, 6);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-6, -3, 12, 1.5);
    ctx.fillStyle = '#2a1a0a'; ctx.fillRect(-6, -3, 1.5, 6); ctx.fillRect(4.5, -3, 1.5, 6);
    ctx.restore();
  }
  const cx = x1 + ux * chispa, cy = y1 + uy * chispa, r = 14 + Math.random() * 10;
  ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSpr('#ffcf5a'), cx - r, cy - r, r * 2, r * 2); ctx.globalCompositeOperation = 'source-over';
  if (Math.random() < .4) P(cx, cy, rnd(-120, 120), rnd(-120, 60), .35, rnd(2, 3.5), pick(['#ffd23f', '#ffffff', '#ff8a1f']), 'spark', { drag: 3 });
}
// enemigo: ninot cabezón enfadado (sustituye al virus)
function drawNinot(v, t) {
  ctx.save(); ctx.translate(v.x, v.y); ctx.rotate(Math.sin(t * 2.4 + v.ph) * .18);
  // mecha encendida en la cabeza (¡que se quema!)
  ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(4, -22); ctx.quadraticCurveTo(10, -30, 7, -36); ctx.stroke();
  ctx.globalCompositeOperation = 'lighter'; const ch = 12 + Math.random() * 10; ctx.drawImage(glowSpr('#ffcf5a'), 7 - ch / 2, -36 - ch / 2, ch, ch); ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#f0c49a'; ctx.beginPath(); ctx.ellipse(0, 0, 20, 22, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a1a12'; ctx.beginPath(); ctx.ellipse(-2, -17, 18, 8, -.1, Math.PI, 0); ctx.fill();   // pelo
  ctx.fillStyle = '#d9a17a'; ctx.beginPath(); ctx.ellipse(-20, 2, 5, 7, 0, 0, TAU); ctx.ellipse(20, 2, 5, 7, 0, 0, TAU); ctx.fill();   // orejas
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-8, -5, 6, 0, TAU); ctx.arc(8, -5, 6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-6 + Math.sin(t * 3) * 1.5, -4, 2.6, 0, TAU); ctx.arc(10 + Math.sin(t * 3) * 1.5, -4, 2.6, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-14, -14); ctx.lineTo(-3, -10); ctx.moveTo(14, -14); ctx.lineTo(3, -10); ctx.stroke();
  ctx.fillStyle = '#e8463a'; ctx.beginPath(); ctx.ellipse(2, 3, 7, 6, .2, 0, TAU); ctx.fill();   // narizota
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(0, 1, 2, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a1a12'; ctx.fillRect(-10, 9, 22, 3);   // bigote
  ctx.strokeStyle = '#7a2a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(1, 20, 7, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  ctx.restore();
}
// enemigo: cartuchos de TNT (sustituye al virus)
function drawTNT(v, t) {
  ctx.save(); ctx.translate(v.x, v.y); ctx.rotate(Math.sin(t * 3 + v.ph) * .25);
  ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -18); ctx.quadraticCurveTo(-8, -28, -3, -34); ctx.stroke();
  ctx.globalCompositeOperation = 'lighter'; const ch = 14 + Math.random() * 12; ctx.drawImage(glowSpr('#ffcf5a'), -3 - ch / 2, -34 - ch / 2, ch, ch); ctx.globalCompositeOperation = 'source-over';
  [-12, 0, 12].forEach((x, i) => {
    const gr = ctx.createLinearGradient(x - 6, 0, x + 6, 0); gr.addColorStop(0, '#8a0e0e'); gr.addColorStop(.45, '#e3241b'); gr.addColorStop(1, '#7a0a0a');
    ctx.fillStyle = gr; ctx.fillRect(x - 6, -18 + (i === 1 ? -3 : 0), 12, 36);
  });
  ctx.fillStyle = '#2a1a0a'; ctx.fillRect(-19, -6, 38, 5); ctx.fillRect(-19, 8, 38, 5);
  ctx.fillStyle = '#f2e3b0'; ctx.fillRect(-15, -1, 30, 9);
  ctx.fillStyle = '#c21b1b'; ctx.font = '900 8px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('TNT', 0, 4);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-6, -10, 3.4, 4, 0, 0, TAU); ctx.ellipse(6, -10, 3.4, 4, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-5, -9, 1.7, 0, TAU); ctx.arc(5, -9, 1.7, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10, -15.5); ctx.lineTo(-2, -13); ctx.moveTo(10, -15.5); ctx.lineTo(2, -13); ctx.stroke();
  ctx.restore();
}
// enemigo: cohete (sustituye al misil)
function drawCohete(m, t) {
  ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(Math.sin(t * 25 + m.y) * .03);
  // llama y chispas detrás
  ctx.globalCompositeOperation = 'lighter';
  const fl = 34 + Math.random() * 18;
  ctx.drawImage(glowSpr('#ff8a1f'), 28, -14, fl + 20, 28); ctx.drawImage(glowSpr('#ffe08a'), 28, -7, fl * .6, 14);
  ctx.globalCompositeOperation = 'source-over';
  // varilla
  ctx.fillStyle = '#c9a36a'; ctx.fillRect(10, 5, 44, 2.4);
  // cuerpo
  const gr = ctx.createLinearGradient(0, -9, 0, 9); gr.addColorStop(0, '#ff6a5a'); gr.addColorStop(.5, '#e3241b'); gr.addColorStop(1, '#8a0e0e');
  ctx.fillStyle = gr; ctx.fillRect(-14, -8, 44, 16);
  ctx.fillStyle = '#f2f2f2'; ctx.fillRect(2, -8, 6, 16); ctx.fillRect(16, -8, 4, 16);
  ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(-14, -8); ctx.lineTo(-34, 0); ctx.lineTo(-14, 8); ctx.closePath(); ctx.fill();   // punta
  ctx.fillStyle = '#1d3f8a'; ctx.beginPath(); ctx.moveTo(22, -8); ctx.lineTo(34, -17); ctx.lineTo(32, -8); ctx.moveTo(22, 8); ctx.lineTo(34, 17); ctx.lineTo(32, 8); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-14, -7, 44, 2.5);
  ctx.restore();
  if (Math.random() < .6) P(m.x + rnd(40, 60), m.y + rnd(-6, 6), rnd(80, 220), rnd(-50, 50), .4, rnd(1.5, 3.5), pick(['#ffd23f', '#ff8a1f', '#ffffff']), 'spark', { drag: 2 });
}

/* ---- aplicar tema ---- */
let temaPendiente = null;
function textosTema() {
  const hw = HW(), nv = NV(), fa = FA();
  document.body.classList.toggle('tema-halloween', hw); document.body.classList.toggle('tema-navidad', nv); document.body.classList.toggle('tema-fallas', fa);
  $$('[data-hw]').forEach(el => { if (el.dataset.normal == null) el.dataset.normal = el.textContent; el.textContent = hw ? el.dataset.hw : nv && el.dataset.nv ? el.dataset.nv : fa && el.dataset.fa ? el.dataset.fa : el.dataset.normal; });
  FRASES.length = 0; FRASES.push(...(hw ? FRASES_H : nv ? FRASES_X : fa ? FRASES_F : FRASES_N));
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = hw ? '#1a0a12' : nv ? '#071a33' : fa ? '#2a0f22' : '#05060f';
}
function aplicaTema(t, ya, prueba) {
  t = ['halloween', 'navidad', 'fallas'].includes(t) ? t : 'normal';
  if (!prueba) { TEMA_SERVIDOR = t; store('tema', t); if (TEMA_PRUEBA) return; }   // en modo pruebas se ignora el tema de los jugadores
  if (t === TEMA && !ya) return;
  if (!ya && ['play', 'count', 'dying'].includes(state)) { temaPendiente = t; return; }
  TEMA = t; temaPendiente = null;
  paletaTema(); textosTema();
  skyTop = ZONAS[zona].top; skyBot = ZONAS[zona].bot; skyT = 1;
  zonaLista = null; zonaPrep = -1; calSprG = null; lamparas = null; guirnaldaC = null; fuegos.length = 0;
  layers = buildLayers(zona); prevLayers = null; layerFade = 1;
}
textosTema(); document.body.classList.toggle('pruebas', !!TEMA_PRUEBA);

/* =========================================================
   SALA DE CHAT TIPO HABBO (lobby isométrico)
   ========================================================= */
(() => {
  const cv = $('#chatCv'), g = cv.getContext('2d'), N = 10;
  let Wc = 0, Hc = 0, DP = 1, TW = 64, TH = 32, WH = 96, OX = 0, OY = 0;
  const yo = { x: 5, y: 8, px: 5, py: 8, dir: 1 };
  const otros = new Map(), burbujas = new Map();
  let actividad = 0, firma0 = '';
  /* ritmo adaptativo: si alguien se mueve o escribe, consulta cada 0,7 s; si la sala está en calma, cada 2 s.
     Con mucha gente se frena un poco para no saturar el servidor. */
  function bucleSync() {
    if (!CHAT_ON) return;
    const calma = performance.now() - actividad > 8000, mucha = otros.size > 10;
    sync(); syncId = setTimeout(bucleSync, calma ? 2000 : mucha ? 1100 : 700);
  }
  let seq = 0, enCurso = false, pendMsg = '', emo = '', emoHasta = 0, rafId = 0, syncId = 0, hover = null, menuDe = null, lastT = 0, primera = true;
  const DECOR = [{ x: 0, y: 0, t: 'copa_oro' }, { x: 9, y: 0, t: 'copa_plata' }, { x: 0, y: 9, t: 'calabaza' }];
  const bloqueada = (x, y) => DECOR.some(d => d.x === x && d.y === y);
  const logo = new Image(); logo.src = 'img/logo.webp?v=2';
  const miNombre = () => SES ? SES.perfil.usuario : '';
  const colNombre = n => { let h = 0; for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) % 360; return `hsl(${h},90%,62%)`; };

  function tam() {
    DP = Math.min(window.devicePixelRatio || 1, 2); Wc = innerWidth; Hc = innerHeight;
    cv.width = Math.round(Wc * DP); cv.height = Math.round(Hc * DP);
    const arriba = 64, abajo = 64, util = Hc - arriba - abajo;
    TH = Math.max(12, Math.min(util / (N + 3.4), (Wc - 30) / (N * 2 + 1))); TW = TH * 2; WH = TH * 3.2;
    OX = Wc / 2; OY = arriba + WH + Math.max(0, (util - (N * TH + WH)) / 2);
  }
  const T = (x, y) => [OX + (x - y) * TW / 2, OY + (x + y) * TH / 2];             // vértice superior de la casilla
  const C = (x, y) => [OX + (x - y) * TW / 2, OY + (x + y) * TH / 2 + TH / 2];    // centro de la casilla
  function casilla(sx, sy) { const a = (sx - OX) / (TW / 2), b = (sy - OY) / (TH / 2), x = Math.floor((a + b) / 2), y = Math.floor((b - a) / 2); return x >= 0 && y >= 0 && x < N && y < N ? { x, y } : null; }
  const rombo = (x, y) => { const [tx, ty] = T(x, y); g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + TW / 2, ty + TH / 2); g.lineTo(tx, ty + TH); g.lineTo(tx - TW / 2, ty + TH / 2); g.closePath(); };

  function paredes(t) {
    const [ax, ay] = T(0, 0), [lx, ly] = [OX - N * TW / 2, OY + N * TH / 2], [rx, ry] = [OX + N * TW / 2, OY + N * TH / 2];
    // pared izquierda
    let gr = g.createLinearGradient(lx, 0, ax, 0); gr.addColorStop(0, '#0c1230'); gr.addColorStop(1, '#141d44');
    g.fillStyle = gr; g.beginPath(); g.moveTo(ax, ay); g.lineTo(lx, ly); g.lineTo(lx, ly - WH); g.lineTo(ax, ay - WH); g.closePath(); g.fill();
    // ventanas con la ciudad de noche
    for (let k = 0; k < 3; k++) {
      const u0 = 1.3 + k * 2.9, u1 = u0 + 2, p = u => [ax - u * TW / 2, ay + u * TH / 2];
      const [x0, y0] = p(u0), [x1, y1] = p(u1), top = WH * .78, bot = WH * .28;
      const wg = g.createLinearGradient(0, y0 - top, 0, y0 - bot); wg.addColorStop(0, '#05030f'); wg.addColorStop(1, '#1d0b3a');
      g.fillStyle = wg; g.beginPath(); g.moveTo(x0, y0 - top); g.lineTo(x1, y1 - top); g.lineTo(x1, y1 - bot); g.lineTo(x0, y0 - bot); g.closePath(); g.fill();
      g.save(); g.clip();
      for (let i = 0; i < 14; i++) { const f = i / 14, bx = x0 + (x1 - x0) * f, by = y0 + (y1 - y0) * f - bot, bh = WH * (.1 + .28 * ((i * 37) % 7) / 7); g.fillStyle = '#0a0f22'; g.fillRect(bx, by - bh, (x1 - x0) / 14 + 1, bh); if (Math.sin(t * 2 + i) > .3) { g.fillStyle = i % 3 ? '#19ff6a' : '#00e5ff'; g.fillRect(bx + 2, by - bh + 4, 2, 2); } }
      g.restore();
      g.strokeStyle = 'rgba(0,229,255,.7)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x0, y0 - top); g.lineTo(x1, y1 - top); g.lineTo(x1, y1 - bot); g.lineTo(x0, y0 - bot); g.closePath(); g.stroke();
    }
    // pared derecha
    gr = g.createLinearGradient(ax, 0, rx, 0); gr.addColorStop(0, '#1a2452'); gr.addColorStop(1, '#10173a');
    g.fillStyle = gr; g.beginPath(); g.moveTo(ax, ay); g.lineTo(rx, ry); g.lineTo(rx, ry - WH); g.lineTo(ax, ay - WH); g.closePath(); g.fill();
    // logo Futurmovil como cartel de neón en la pared
    if (logo.complete && logo.naturalWidth) {
      const u0 = 2.2, lw = 5.6 * TW / 2, lh = lw * logo.naturalHeight / logo.naturalWidth, [px, py] = [ax + u0 * TW / 2, ay + u0 * TH / 2 - WH * .78];
      g.save(); g.translate(px, py); g.transform(1, .5, 0, 1, 0, 0);
      g.shadowColor = '#00e5ff'; g.shadowBlur = 14 + Math.sin(t * 3) * 4; g.drawImage(logo, 0, 0, lw, lh); g.restore();
    }
    // tiras de neón
    g.lineWidth = 2; g.strokeStyle = 'rgba(25,255,106,.85)'; g.beginPath(); g.moveTo(lx, ly - WH); g.lineTo(ax, ay - WH); g.lineTo(rx, ry - WH); g.stroke();
    g.strokeStyle = 'rgba(0,229,255,.6)'; g.beginPath(); g.moveTo(lx, ly); g.lineTo(ax, ay); g.lineTo(rx, ry); g.stroke();
    g.strokeStyle = 'rgba(25,255,106,.35)'; g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax, ay - WH); g.stroke();
  }
  function suelo(t) {
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
      rombo(x, y); g.fillStyle = (x + y) % 2 ? '#0d1630' : '#101c3a'; g.fill();
      g.strokeStyle = 'rgba(0,229,255,.16)'; g.lineWidth = 1; g.stroke();
    }
    // alfombra central con brillo
    for (let x = 3; x <= 6; x++) for (let y = 3; y <= 6; y++) { rombo(x, y); g.fillStyle = `rgba(25,255,106,${.05 + .03 * Math.sin(t * 2 + x + y)})`; g.fill(); }
    if (hover && !bloqueada(hover.x, hover.y)) { rombo(hover.x, hover.y); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.stroke(); }
    if (Math.hypot(yo.px - yo.x, yo.py - yo.y) > .05) { rombo(yo.x, yo.y); g.fillStyle = 'rgba(25,255,106,.25)'; g.fill(); }
  }
  function decor(d, t) {
    const [cx, cy] = C(d.x, d.y), it = ITEMS[d.t];
    g.fillStyle = '#1a2452'; g.beginPath(); g.moveTo(cx - TW * .3, cy); g.lineTo(cx, cy + TH * .3); g.lineTo(cx + TW * .3, cy); g.lineTo(cx + TW * .3, cy - TH * .6); g.lineTo(cx, cy - TH * .3); g.lineTo(cx - TW * .3, cy - TH * .6); g.closePath(); g.fill();
    g.fillStyle = '#26336e'; g.beginPath(); g.moveTo(cx - TW * .3, cy - TH * .6); g.lineTo(cx, cy - TH * .9); g.lineTo(cx + TW * .3, cy - TH * .6); g.lineTo(cx, cy - TH * .3); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,229,255,.6)'; g.lineWidth = 1; g.stroke();
    const im = it && (decor.img[d.t] || (decor.img[d.t] = Object.assign(new Image(), { src: it.img })));
    if (im && im.complete && im.naturalWidth) { const h = TH * 2.6, w = h * im.naturalWidth / im.naturalHeight; g.drawImage(im, cx - w / 2, cy - TH * .75 - h + Math.sin(t * 2 + d.x) * 2, w, h); }
  }
  decor.img = {};
  function avatar(a, nom, t, esYo) {
    const [cx, cy] = C(a.px, a.py), im = IMG.capa; if (!im || !im.naturalWidth) return;
    const h = TH * 3.5, w = h * im.naturalWidth / im.naturalHeight, anda = Math.hypot(a.px - a.x, a.py - a.y) > .05;
    const e = a.e || '', baila = e === 'baile', salta = e === 'saluda';
    let bob = Math.sin(t * (anda ? 10 : 2.4) + (a.ph || 0)) * (anda ? 2.5 : 1.6); if (salta) bob -= Math.abs(Math.sin(t * 9)) * TH * .5;
    g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(cx, cy, TW * .26, TH * .22, 0, 0, TAU); g.fill();
    g.save(); g.translate(cx, cy - TH * .15 + bob); if (baila) g.rotate(Math.sin(t * 8) * .25); g.scale(a.dir < 0 ? -1 : 1, 1);
    g.drawImage(im, -w / 2, -h, w, h); g.restore();
    // nombre
    const ty = cy - h - TH * .25 + bob; g.font = `700 ${Math.max(11, TH * .42)}px Rajdhani, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const tw = g.measureText(nom).width + 14, th = Math.max(16, TH * .62);
    g.fillStyle = 'rgba(5,10,22,.78)'; g.beginPath(); g.roundRect ? g.roundRect(cx - tw / 2, ty - th / 2, tw, th, th / 2) : g.rect(cx - tw / 2, ty - th / 2, tw, th); g.fill();
    g.strokeStyle = esYo ? '#19ff6a' : colNombre(nom); g.lineWidth = 1.2; g.stroke();
    g.fillStyle = esYo ? '#19ff6a' : '#fff'; g.fillText(nom, cx, ty + 1);
    if (e === 'amor') for (let k = 0; k < 3; k++) { const f = ((t * .8 + k / 3) % 1); g.globalAlpha = 1 - f; g.font = `${TH * .7}px sans-serif`; g.fillText('❤️', cx + Math.sin(f * 6 + k) * TW * .2, ty - th - f * TH * 2); g.globalAlpha = 1; }
    if (salta) { g.font = `${TH * .8}px sans-serif`; g.fillText('👋', cx + TW * .32, ty - th * .2); }
    a._sx = cx; a._top = ty - th; a._sy = cy;
    // bocadillos
    const bs = burbujas.get(nom); if (!bs) return;
    let by = ty - th / 2 - 6; const ahora = performance.now() / 1000;
    for (let i = bs.length - 1; i >= 0; i--) {
      const b = bs[i], edad = ahora - b.t; if (edad > 8) { bs.splice(i, 1); continue; }
      g.font = `600 ${Math.max(12, TH * .45)}px Rajdhani, sans-serif`;
      const lineas = partir(b.txt, Math.max(120, TW * 3.2)), lh = Math.max(14, TH * .52), bw = Math.min(Math.max(...lineas.map(l => g.measureText(l).width)) + 18, TW * 3.6), bh = lineas.length * lh + 8;
      by -= bh + 6; g.globalAlpha = edad > 7 ? 8 - edad : Math.min(1, edad * 6);
      g.fillStyle = '#fff'; g.beginPath(); g.roundRect ? g.roundRect(cx - bw / 2, by, bw, bh, 9) : g.rect(cx - bw / 2, by, bw, bh); g.fill();
      if (i === bs.length - 1) { g.beginPath(); g.moveTo(cx - 6, by + bh); g.lineTo(cx, by + bh + 7); g.lineTo(cx + 6, by + bh); g.fill(); }
      g.fillStyle = '#0a1020'; lineas.forEach((l, k) => g.fillText(l, cx, by + 4 + lh / 2 + k * lh));
      g.globalAlpha = 1;
    }
  }
  function partir(txt, max) {
    const pal = txt.split(' '), out = []; let l = '';
    for (const p of pal) { const prueba = l ? l + ' ' + p : p; if (g.measureText(prueba).width > max && l) { out.push(l); l = p; } else l = prueba; }
    if (l) out.push(l); return out.slice(0, 4);
  }
  function mover(a, dt) {
    const dx = a.x - a.px, dy = a.y - a.py, d = Math.hypot(dx, dy); if (d < .001) { a.px = a.x; a.py = a.y; return; }
    const v = Math.min(d, 3.4 * dt); a.px += dx / d * v; a.py += dy / d * v;
    const sxd = dx - dy; if (Math.abs(sxd) > .01) a.dir = sxd > 0 ? 1 : -1;
  }
  function frame(now) {
    if (!CHAT_ON) return;
    const t = now / 1000, dt = Math.min(.05, lastT ? t - lastT : 0); lastT = t;
    mover(yo, dt); otros.forEach(o => mover(o, dt));
    if (emo && t > emoHasta) emo = '';
    yo.e = emo;
    g.setTransform(DP, 0, 0, DP, 0, 0);
    const bg = g.createLinearGradient(0, 0, 0, Hc); bg.addColorStop(0, '#03040c'); bg.addColorStop(1, '#0a1226'); g.fillStyle = bg; g.fillRect(0, 0, Wc, Hc);
    paredes(t); suelo(t);
    const ents = DECOR.map(d => ({ k: d.x + d.y, f: () => decor(d, t) }));
    ents.push({ k: yo.px + yo.py + .01, f: () => avatar(yo, miNombre(), t, true) });
    otros.forEach((o, nom) => ents.push({ k: o.px + o.py, f: () => avatar(o, nom, t, false) }));
    ents.sort((a, b) => a.k - b.k).forEach(e => e.f());
    rafId = requestAnimationFrame(frame);
  }

  /* ---- red ---- */
  function log(nom, txt, clase) {
    const box = $('#chatLog'), p = document.createElement('p'); if (clase) p.className = clase;
    if (nom) { const b = document.createElement('b'); b.textContent = nom + ': '; p.appendChild(b); }
    p.appendChild(document.createTextNode(txt)); box.appendChild(p);
    while (box.children.length > 60) box.firstChild.remove();
    box.scrollTop = box.scrollHeight;
  }
  function burbuja(nom, txt) { if (!burbujas.has(nom)) burbujas.set(nom, []); const l = burbujas.get(nom); l.push({ txt, t: performance.now() / 1000 }); if (l.length > 3) l.shift(); }
  function sync() {
    if (!CHAT_ON || enCurso || document.hidden) return;
    enCurso = true; const msg = pendMsg; pendMsg = '';
    api('chat', { token: SES.token, op: 'sync', x: yo.x, y: yo.y, e: emo, msg, desde: seq }).then(d => {
      enCurso = false;
      if (!d.ok) { if (msg) pendMsg = msg + (pendMsg ? ' ' + pendMsg : ''); estado(d.error || 'Sin conexión con la sala…'); return; }
      estado('');
      const vistos = new Set();
      d.users.forEach(u => {
        if (u.u === miNombre()) return; vistos.add(u.u);
        let o = otros.get(u.u);
        if (!o) { o = { x: u.x, y: u.y, px: u.x, py: u.y, dir: 1, ph: Math.random() * 6 }; otros.set(u.u, o); if (!primera) log('', u.u + ' ha entrado en la sala', 'sis'); }
        o.x = u.x; o.y = u.y; o.e = u.e;
      });
      otros.forEach((o, n) => { if (!vistos.has(n)) { otros.delete(n); log('', n + ' ha salido de la sala', 'sis'); } });
      d.msgs.forEach(m => { const mio = m.u === miNombre(); if (!(mio && !primera)) { log(m.u, m.txt, mio ? 'yo' : ''); if (!primera) burbuja(m.u, m.txt); } });
      const f = d.users.map(u => u.u + u.x + ',' + u.y + u.e).join('|') + '#' + d.seq;
      if (f !== firma0 || d.msgs.length) { actividad = performance.now(); firma0 = f; }
      seq = d.seq || seq; primera = false;
      $('#chatN').textContent = d.users.length;
    });
  }
  function estado(txt) { const e = $('#chatEstado'); if (txt) { e.textContent = txt; e.classList.remove('fuera'); } else e.classList.add('fuera'); }
  function decir(txt) {
    txt = String(txt || '').trim().slice(0, 120); if (!txt) return;
    pendMsg = pendMsg ? pendMsg + ' ' + txt : txt;
    burbuja(miNombre(), txt); log(miNombre(), txt, 'yo'); Audio5.click(); actividad = performance.now();
    setTimeout(sync, 60);
  }

  /* ---- entrada ---- */
  function punto(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  cv.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { const [x, y] = punto(e); hover = casilla(x, y); } });
  cv.addEventListener('pointerdown', e => {
    const [x, y] = punto(e); cerrarMenu();
    // ¿ha tocado a otro jugador?
    let sel = null; otros.forEach((o, n) => { if (o._sx != null && Math.abs(x - o._sx) < TW * .45 && y > o._top - 6 && y < o._sy + 4) sel = n; });
    if (sel) { abrirMenu(sel); return; }
    const c = casilla(x, y); if (!c || bloqueada(c.x, c.y)) return;
    yo.x = c.x; yo.y = c.y; actividad = performance.now(); Audio5.click(); setTimeout(sync, 30);
  });
  function abrirMenu(nom) {
    menuDe = nom; const o = otros.get(nom), m = $('#chatMenu');
    $('#chatMenuNom').textContent = nom; m.style.left = o._sx + 'px'; m.style.top = Math.max(70, o._top - 8) + 'px'; m.classList.remove('oculto'); Audio5.click();
  }
  function cerrarMenu() { $('#chatMenu').classList.add('oculto'); menuDe = null; }
  $('#chatMenuTrato').onclick = () => { const n = menuDe; cerrarMenu(); if (!n) return; if (window.trueque.activo()) return window.trueque.ver(); window.trueque.invitar(n); };
  $('#chatMenuHola').onclick = () => { const n = menuDe; cerrarMenu(); if (n) { emo = 'saluda'; emoHasta = performance.now() / 1000 + 3; decir('👋 ¡Hola, ' + n + '!'); } };
  $('#chatForm').onsubmit = e => { e.preventDefault(); const i = $('#chatTxt'); decir(i.value); i.value = ''; };
  $$('#chatForm .emo').forEach(b => b.onclick = () => { emo = b.dataset.e; emoHasta = performance.now() / 1000 + (emo === 'baile' ? 6 : 3); Audio5.click(); setTimeout(sync, 30); });
  $('#chatTxt').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') e.target.blur(); });

  /* ---- abrir / cerrar ---- */
  function abrirChat() {
    if (!SES) return abrirLogin('entrar');
    CHAT_ON = true; Audio5.click();
    $('#sInv').classList.remove('show'); $('#sChat').classList.add('show'); $('#sChat').appendChild($('#tPanel'));
    tam(); otros.clear(); burbujas.clear(); seq = 0; primera = true; pendMsg = ''; emo = ''; cerrarMenu();
    yo.x = yo.px = 3 + Math.floor(Math.random() * 4); yo.y = yo.py = 7 + Math.floor(Math.random() * 3); yo.dir = 1;
    $('#chatLog').innerHTML = ''; log('', 'Bienvenido al lobby, ' + miNombre() + '. Toca el suelo para moverte y a otro jugador para intercambiar.', 'sis');
    estado('Entrando en la sala…'); lastT = 0;
    cancelAnimationFrame(rafId); rafId = requestAnimationFrame(frame);
    clearTimeout(syncId); actividad = performance.now(); bucleSync();
  }
  function cerrarChat() {
    if (!CHAT_ON) return;
    CHAT_ON = false; clearTimeout(syncId); cancelAnimationFrame(rafId); cerrarMenu();
    api('chat', { token: SES.token, op: 'salir' });
    $('#sChat').classList.remove('show'); $('#sInv').appendChild($('#tPanel'));
    abrirSala();
  }
  $('#btnLobby').onclick = abrirChat;
  $('#btnChatVolver').onclick = cerrarChat;
  window.addEventListener('resize', () => { if (CHAT_ON) tam(); });
  window.addEventListener('keydown', e => { if (CHAT_ON && e.code === 'Escape' && document.activeElement !== $('#chatTxt')) cerrarChat(); });
  window.addEventListener('pagehide', () => { if (CHAT_ON && SES) navigator.sendBeacon && navigator.sendBeacon(CFG.API, JSON.stringify({ accion: 'chat', op: 'salir', token: SES.token })); });
})();

/* ==========================================================
   LUCAS 5G · Futurmovil — API del ranking (JSONP)
   Hoja: "juego robot"
   ========================================================== */
const SHEET_ID = '1S4MBKmxWGxOZBQxus7gwg0xix9CooDOwu_rY35NG_6s';
const TZ = 'Europe/Madrid';
const SAL = 'lucas5g-fm';
const CAB = ['Fecha', 'Semana', 'Nombre', 'Puntos', 'Metros', 'Datos', 'Segundos', 'Dispositivo'];

function doGet(e) {
  const p = (e && e.parameter) || {};
  let out;
  try {
    if (p.accion === 'enviar') out = enviar_(p);
    else if (p.accion === 'top') out = top_();
    else out = { ok: true, juego: 'LUCAS 5G', semana: semana_(new Date()) };
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  const json = JSON.stringify(out);
  if (p.cb && /^[\w$.]+$/.test(p.cb)) {
    return ContentService.createTextOutput(p.cb + '(' + json + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

/* Ejecutar una vez a mano para crear las hojas y dar permisos */
function preparar() {
  hojaPuntos_(); hojaConfig_();
  return 'Hojas listas';
}

function ss_() { return SpreadsheetApp.openById(SHEET_ID); }

function hojaPuntos_() {
  const ss = ss_();
  let sh = ss.getSheetByName('Puntuaciones');
  if (!sh) {
    sh = ss.getSheets().length === 1 && ss.getSheets()[0].getLastRow() === 0 ? ss.getSheets()[0].setName('Puntuaciones') : ss.insertSheet('Puntuaciones');
    sh.getRange(1, 1, 1, CAB.length).setValues([CAB]).setFontWeight('bold').setBackground('#0b1222').setFontColor('#19ff6a');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 150); sh.setColumnWidth(3, 160);
  }
  return sh;
}
function hojaConfig_() {
  const ss = ss_();
  let sh = ss.getSheetByName('Config');
  if (!sh) {
    sh = ss.insertSheet('Config');
    sh.getRange('A1:B1').setValues([['Premio semanal', '']]);
    sh.getRange('A2:B2').setValues([['Ayuda', 'Escribe en B1 el premio de esta semana (vacío = no se muestra). El ranking semanal va de lunes a domingo.']]);
    sh.getRange('A1:A2').setFontWeight('bold');
    sh.setColumnWidth(1, 140); sh.setColumnWidth(2, 520);
  }
  return sh;
}

/* Semana ISO (lunes a domingo) en hora de Madrid, p. ej. 2026-W44 */
function semana_(d) {
  const p = Utilities.formatDate(d, TZ, 'yyyy-MM-dd').split('-').map(Number);
  const t = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const w = Math.ceil(((t - y0) / 86400000 + 1) / 7);
  return t.getUTCFullYear() + '-W' + (w < 10 ? '0' : '') + w;
}

function firma_(str) {
  let h = 5381; str = SAL + '|' + str;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function enviar_(p) {
  const nombre = String(p.nombre || '').replace(/[<>"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  const puntos = parseInt(p.puntos, 10) || 0, metros = parseInt(p.metros, 10) || 0, datos = parseInt(p.datos, 10) || 0, dur = parseInt(p.dur, 10) || 0;
  const dev = String(p.dev || '').slice(0, 40);
  if (!nombre) throw new Error('Falta el nombre');
  if (String(p.firma) !== firma_([nombre, puntos, metros, datos, dur].join('|'))) throw new Error('Puntuación no válida');
  // comprobaciones de sentido común
  const seg = dur / 1000;
  if (seg < 3 || metros > seg * 45 + 50 || puntos > metros * 2 + datos * 100 + 1000 || puntos < metros) throw new Error('Puntuación no válida');

  const cache = CacheService.getScriptCache();
  if (dev && cache.get('r_' + dev)) throw new Error('Espera unos segundos');
  if (dev) cache.put('r_' + dev, '1', 8);

  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  const sem = semana_(new Date());
  try {
    hojaPuntos_().appendRow([new Date(), sem, nombre, puntos, metros, datos, Math.round(seg), dev]);
  } finally { lock.releaseLock(); }
  cache.remove('top');

  const t = calcTop_();
  const idx = t.semanaFull.findIndex(r => r.nombre.toLowerCase() === nombre.toLowerCase());
  return { ok: true, puesto: idx + 1 };
}

function calcTop_() {
  const sh = hojaPuntos_();
  const n = sh.getLastRow() - 1;
  const rows = n > 0 ? sh.getRange(2, 1, n, 6).getValues() : [];
  const sem = semana_(new Date());
  const bestS = {}, bestT = {};
  rows.forEach(r => {
    const nom = String(r[2] || '').trim(); if (!nom) return;
    const k = nom.toLowerCase(), pts = Number(r[3]) || 0;
    if (!bestT[k] || pts > bestT[k].puntos) bestT[k] = { nombre: nom, puntos: pts };
    if (String(r[1]) === sem && (!bestS[k] || pts > bestS[k].puntos)) bestS[k] = { nombre: nom, puntos: pts };
  });
  const ord = o => Object.keys(o).map(k => o[k]).sort((a, b) => b.puntos - a.puntos);
  const semanaFull = ord(bestS);
  return { semanaFull, semana: semanaFull.slice(0, 25), total: ord(bestT).slice(0, 25), sem };
}

function top_() {
  const cache = CacheService.getScriptCache();
  const c = cache.get('top'); if (c) return JSON.parse(c);
  const t = calcTop_();
  let premio = String(hojaConfig_().getRange('B1').getValue() || '').trim();
  const out = { ok: true, semana: t.semana, total: t.total, sem: t.sem, premio };
  cache.put('top', JSON.stringify(out), 30);
  return out;
}

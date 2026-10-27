/* ==========================================================
   LUCASBOT 5G · Futurmovil — API (cuentas + ranking)
   Hoja: "juego robot"
   ========================================================== */
const SHEET_ID = '1S4MBKmxWGxOZBQxus7gwg0xix9CooDOwu_rY35NG_6s';
const TZ = 'Europe/Madrid';
const SAL = 'lucas5g-fm';
const GOOGLE_CLIENT_ID = '';   // ID de cliente OAuth (web) para "Entrar con Google"
const CAB_P = ['Fecha', 'Semana', 'Usuario', 'Puntos', 'Metros', 'Datos', 'Segundos', 'IdUsuario'];
const CAB_U = ['Id', 'Usuario', 'Email', 'Hash', 'Sal', 'Creado', 'UltimoAcceso', 'Google', 'Record', 'Partidas', 'Token', 'TokenExpira', 'CodigoRec', 'CodigoExpira'];
const U = {}; CAB_U.forEach((k, i) => U[k] = i);

/* ---------------- entrada ---------------- */
function doGet(e) {
  const p = (e && e.parameter) || {};
  return responder_(manejar_(p), p.cb);
}
function doPost(e) {
  let p = {};
  try { p = JSON.parse(e.postData.contents || '{}'); } catch (err) {}
  return responder_(manejar_(p));
}
function manejar_(p) {
  try {
    switch (p.accion) {
      case 'top': return top_();
      case 'disponible': return { ok: true, disponible: usuarioLibre_(p.usuario) };
      case 'registrar': return registrar_(p);
      case 'entrar': return entrar_(p);
      case 'google': return google_(p);
      case 'yo': return yo_(p);
      case 'salir': return salir_(p);
      case 'recuperar': return recuperar_(p);
      case 'restablecer': return restablecer_(p);
      case 'enviar': return enviar_(p);
      default: return { ok: true, juego: 'LUCASBOT 5G', semana: semana_(new Date()), google: !!GOOGLE_CLIENT_ID };
    }
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
}
function responder_(out, cb) {
  const json = JSON.stringify(out);
  if (cb && /^[\w$.]+$/.test(cb)) return ContentService.createTextOutput(cb + '(' + json + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

/* Ejecutar una vez a mano: crea las hojas y pide los permisos */
function preparar() {
  hojaPuntos_(); hojaConfig_(); hojaUsuarios_();
  MailApp.getRemainingDailyQuota();
  UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=x', { muteHttpExceptions: true });
  return 'Hojas listas';
}

/* ---------------- hojas ---------------- */
function ss_() { return SpreadsheetApp.openById(SHEET_ID); }
function hoja_(nombre, cab) {
  const ss = ss_();
  let sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#0b1222').setFontColor('#19ff6a');
    sh.setFrozenRows(1);
  }
  return sh;
}
function hojaPuntos_() { return hoja_('Puntuaciones', CAB_P); }
function hojaUsuarios_() {
  const sh = hoja_('Usuarios', CAB_U);
  sh.getRange('C:C').setNumberFormat('@'); sh.getRange('K:N').setNumberFormat('@');
  return sh;
}
function hojaConfig_() {
  const ss = ss_();
  let sh = ss.getSheetByName('Config');
  if (!sh) {
    sh = ss.insertSheet('Config');
    sh.getRange('A1:B2').setValues([['Premio semanal', ''], ['Ayuda', 'Escribe en B1 el premio de esta semana (vacío = no se muestra). El ranking semanal va de lunes a domingo.']]);
    sh.getRange('A1:A2').setFontWeight('bold'); sh.setColumnWidth(2, 520);
  }
  return sh;
}

/* ---------------- utilidades ---------------- */
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
function sha_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
}
function hashPass_(pass, sal) { let h = sal + '|' + pass; for (let i = 0; i < 300; i++) h = sha_(h + '|' + sal); return h; }
function limpiaEmail_(e) { return String(e || '').trim().toLowerCase(); }
function emailValido_(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 120; }
function usuarioValido_(u) { return /^[A-Za-z0-9ÑñÁÉÍÓÚáéíóúÜü_.\-]{3,16}$/.test(u); }
function passValida_(p) { return typeof p === 'string' && p.length >= 6 && p.length <= 100; }

function filas_() {
  const sh = hojaUsuarios_(), n = sh.getLastRow() - 1;
  return { sh, rows: n > 0 ? sh.getRange(2, 1, n, CAB_U.length).getValues() : [] };
}
function buscar_(rows, campo, valor) {
  valor = String(valor || '').toLowerCase();
  for (let i = 0; i < rows.length; i++) if (String(rows[i][U[campo]]).toLowerCase() === valor && valor) return i;
  return -1;
}
function usuarioLibre_(u) {
  u = String(u || '').trim();
  if (!usuarioValido_(u)) return false;
  return buscar_(filas_().rows, 'Usuario', u) < 0;
}
function guardaFila_(sh, i, row) { sh.getRange(i + 2, 1, 1, CAB_U.length).setValues([row]); }
function nuevaSesion_(sh, i, row) {
  row[U.Token] = Utilities.getUuid() + Utilities.getUuid().slice(0, 8);
  row[U.TokenExpira] = String(Date.now() + 1000 * 60 * 60 * 24 * 90);
  row[U.UltimoAcceso] = new Date();
  guardaFila_(sh, i, row);
  return { ok: true, token: row[U.Token], perfil: perfil_(row) };
}
function perfil_(row) {
  return { id: row[U.Id], usuario: row[U.Usuario], email: row[U.Email], record: Number(row[U.Record]) || 0, partidas: Number(row[U.Partidas]) || 0, google: !!row[U.Google] };
}
function porToken_(token) {
  token = String(token || '');
  if (token.length < 30) return null;
  const f = filas_(), i = buscar_(f.rows, 'Token', token);
  if (i < 0) return null;
  const row = f.rows[i];
  if (Number(row[U.TokenExpira]) < Date.now()) return null;
  return { sh: f.sh, i, row };
}
function freno_(clave, max, seg) {
  const c = CacheService.getScriptCache(), n = Number(c.get(clave) || 0);
  if (n >= max) throw new Error('Demasiados intentos. Espera unos minutos.');
  c.put(clave, String(n + 1), seg);
}
function conLock_(fn) {
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ---------------- cuentas ---------------- */
function registrar_(p) {
  const email = limpiaEmail_(p.email), usuario = String(p.usuario || '').trim(), pass = p.pass;
  if (!emailValido_(email)) throw new Error('El correo no es válido');
  if (!usuarioValido_(usuario)) throw new Error('El nombre de usuario debe tener de 3 a 16 letras, números, punto, guion o guion bajo');
  if (!passValida_(pass)) throw new Error('La contraseña debe tener al menos 6 caracteres');
  return conLock_(() => {
    const f = filas_();
    if (buscar_(f.rows, 'Email', email) >= 0) throw new Error('Ya existe una cuenta con ese correo');
    if (buscar_(f.rows, 'Usuario', usuario) >= 0) throw new Error('Ese nombre de usuario ya está cogido');
    const sal = Utilities.getUuid();
    const row = new Array(CAB_U.length).fill('');
    row[U.Id] = 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    row[U.Usuario] = usuario; row[U.Email] = email; row[U.Sal] = sal; row[U.Hash] = hashPass_(pass, sal);
    row[U.Creado] = new Date(); row[U.Record] = 0; row[U.Partidas] = 0;
    f.sh.appendRow(row);
    return nuevaSesion_(f.sh, f.rows.length, row);
  });
}
function entrar_(p) {
  const id = String(p.id || '').trim(), pass = p.pass;
  freno_('login_' + id.toLowerCase(), 8, 900);
  const f = filas_();
  let i = buscar_(f.rows, 'Email', limpiaEmail_(id)); if (i < 0) i = buscar_(f.rows, 'Usuario', id);
  if (i < 0 || !f.rows[i][U.Hash] || hashPass_(String(pass || ''), f.rows[i][U.Sal]) !== f.rows[i][U.Hash]) throw new Error('Usuario o contraseña incorrectos');
  return nuevaSesion_(f.sh, i, f.rows[i]);
}
function google_(p) {
  if (!GOOGLE_CLIENT_ID) throw new Error('El acceso con Google no está activado todavía');
  const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(p.credential || ''), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('No se pudo verificar tu cuenta de Google');
  const info = JSON.parse(r.getContentText());
  if (info.aud !== GOOGLE_CLIENT_ID || String(info.email_verified) !== 'true') throw new Error('Cuenta de Google no válida');
  const email = limpiaEmail_(info.email);
  return conLock_(() => {
    const f = filas_(); let i = buscar_(f.rows, 'Email', email);
    if (i >= 0) { f.rows[i][U.Google] = info.sub; return nuevaSesion_(f.sh, i, f.rows[i]); }
    const usuario = String(p.usuario || '').trim();
    if (!usuario) return { ok: true, necesitaUsuario: true, email, sugerido: (info.given_name || email.split('@')[0]).replace(/[^A-Za-z0-9_.\-]/g, '').slice(0, 16) };
    if (!usuarioValido_(usuario)) throw new Error('El nombre de usuario debe tener de 3 a 16 letras, números, punto, guion o guion bajo');
    if (buscar_(f.rows, 'Usuario', usuario) >= 0) throw new Error('Ese nombre de usuario ya está cogido');
    const row = new Array(CAB_U.length).fill('');
    row[U.Id] = 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    row[U.Usuario] = usuario; row[U.Email] = email; row[U.Google] = info.sub; row[U.Creado] = new Date(); row[U.Record] = 0; row[U.Partidas] = 0;
    f.sh.appendRow(row);
    return nuevaSesion_(f.sh, f.rows.length, row);
  });
}
function yo_(p) {
  const s = porToken_(p.token); if (!s) return { ok: false, sesion: false };
  return { ok: true, perfil: perfil_(s.row) };
}
function salir_(p) {
  const s = porToken_(p.token); if (!s) return { ok: true };
  s.row[U.Token] = ''; s.row[U.TokenExpira] = ''; guardaFila_(s.sh, s.i, s.row);
  return { ok: true };
}
function recuperar_(p) {
  const email = limpiaEmail_(p.email);
  freno_('rec_' + email, 4, 1800);
  const f = filas_(), i = buscar_(f.rows, 'Email', email);
  if (i >= 0) {
    const code = String(Math.floor(100000 + Math.random() * 900000)), row = f.rows[i];
    row[U.CodigoRec] = sha_(code + '|' + row[U.Id]); row[U.CodigoExpira] = String(Date.now() + 15 * 60 * 1000);
    guardaFila_(f.sh, i, row);
    MailApp.sendEmail({
      to: email, name: 'LucasBot 5G · Futurmovil', subject: 'Tu código para recuperar la contraseña: ' + code,
      htmlBody: '<div style="font-family:Arial,sans-serif;background:#05060f;color:#e9fff1;padding:24px;border-radius:14px;max-width:460px">' +
        '<h2 style="color:#19ff6a;margin:0 0 10px">LucasBot 5G</h2><p>Hola <b>' + row[U.Usuario] + '</b>, tu código para crear una contraseña nueva es:</p>' +
        '<p style="font-size:34px;letter-spacing:8px;font-weight:bold;color:#00e5ff;margin:14px 0">' + code + '</p>' +
        '<p style="color:#9cd">Caduca en 15 minutos. Si no lo has pedido tú, ignora este correo.</p></div>'
    });
  }
  return { ok: true };   // misma respuesta exista o no el correo
}
function restablecer_(p) {
  const email = limpiaEmail_(p.email), code = String(p.codigo || '').trim();
  freno_('res_' + email, 6, 1800);
  if (!passValida_(p.pass)) throw new Error('La contraseña debe tener al menos 6 caracteres');
  const f = filas_(), i = buscar_(f.rows, 'Email', email);
  if (i < 0) throw new Error('Código incorrecto o caducado');
  const row = f.rows[i];
  if (!row[U.CodigoRec] || Number(row[U.CodigoExpira]) < Date.now() || sha_(code + '|' + row[U.Id]) !== row[U.CodigoRec]) throw new Error('Código incorrecto o caducado');
  const sal = Utilities.getUuid(); row[U.Sal] = sal; row[U.Hash] = hashPass_(p.pass, sal); row[U.CodigoRec] = ''; row[U.CodigoExpira] = '';
  return nuevaSesion_(f.sh, i, row);
}

/* ---------------- puntuaciones ---------------- */
function enviar_(p) {
  const s = porToken_(p.token);
  if (!s) throw new Error('Inicia sesión para guardar tu puntuación');
  const puntos = parseInt(p.puntos, 10) || 0, metros = parseInt(p.metros, 10) || 0, datos = parseInt(p.datos, 10) || 0, dur = parseInt(p.dur, 10) || 0;
  const usuario = s.row[U.Usuario];
  if (String(p.firma) !== firma_([usuario, puntos, metros, datos, dur].join('|'))) throw new Error('Puntuación no válida');
  const seg = dur / 1000;
  if (seg < 3 || metros > seg * 45 + 50 || puntos > metros * 2 + datos * 100 + 1000 || puntos < metros) throw new Error('Puntuación no válida');
  freno_('env_' + s.row[U.Id], 1, 6);
  const sem = semana_(new Date());
  let nuevoRecord = false;
  conLock_(() => {
    hojaPuntos_().appendRow([new Date(), sem, usuario, puntos, metros, datos, Math.round(seg), s.row[U.Id]]);
    const s2 = porToken_(p.token); const row = s2.row;
    row[U.Partidas] = (Number(row[U.Partidas]) || 0) + 1;
    if (puntos > (Number(row[U.Record]) || 0)) { row[U.Record] = puntos; nuevoRecord = true; }
    guardaFila_(s2.sh, s2.i, row);
  });
  CacheService.getScriptCache().remove('top');
  const t = calcTop_();
  const idx = t.semanaFull.findIndex(r => r.nombre.toLowerCase() === String(usuario).toLowerCase());
  return { ok: true, puesto: idx + 1, nuevoRecord };
}
function calcTop_() {
  const sh = hojaPuntos_(), n = sh.getLastRow() - 1;
  const rows = n > 0 ? sh.getRange(2, 1, n, 6).getValues() : [];
  const sem = semana_(new Date()), bestS = {}, bestT = {};
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
  const cache = CacheService.getScriptCache(), c = cache.get('top'); if (c) return JSON.parse(c);
  const t = calcTop_();
  const out = { ok: true, semana: t.semana, total: t.total, sem: t.sem, premio: String(hojaConfig_().getRange('B1').getValue() || '').trim() };
  cache.put('top', JSON.stringify(out), 30);
  return out;
}

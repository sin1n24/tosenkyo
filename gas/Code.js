/**
 * フィジカル投扇興 月間番付（GAS Webアプリ＋このスプレッドシート）
 *  GET  ?month=YYYY-MM&n=20  → その月の上位（合計点の高い順、同点は早い者勝ち）
 *  GET  ?month=YYYY-MM&n=20&per=1 → 1人（同じ名前）につき最高の1件。others にその人の他の記録（上位3件まで）と more（総数）
 *  GET  ?ping=1              → 受け皿が生きているかだけ（表を読まない。ページを開くたびに呼ばれる）
 * 一覧は1分間キャッシュする（投稿・削除で消す）。
 *  POST {name, total, ids[5], throws[5], ver} → 1件追加
 * 点数は送られた銘(ids)からサーバー側で計算し直す。各投げの入力(throws)は保存しておき、
 * 閲覧者のブラウザが同じ物理で計算し直して点数が本物か確かめる（ゲーム側の verifyEntry）。
 */
const SHEET = 'scores';
const ADMIN_KEY = '';  // 管理用（公開リポジトリの gas/Code.js では空）
const PTS = { yumeukihashi: 100, kiritsubo: 75, mio: 40, ukifune: 30, akashi: 20, kobai: 20, hananoen: 12,
  suma: 10, yugao: 8, matsukaze: 5, hanachirusato: 3, sekiya: 1, tenarai: 0, kotsuri: -1, nowaki: -30 };
const FORMS = ['straight', 'curve', 'circle', 'zigzag'];
const G_KEYS = ['maxDev', 'chord', 'turnSum', 'firstDevSign'];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.appendRow(['month', 'time', 'name', 'total', 'ids', 'throws', 'ver', 'env', 'sig']);
    sh.getRange('A:A').setNumberFormat('@'); // 月キーが日付に化けないように
  }
  if (sh.getRange('C1').getNumberFormat() !== '@') { sh.getRange('C:C').setNumberFormat('@'); sh.getRange('E:I').setNumberFormat('@'); }
  if (sh.getRange(1, 8).getValue() === '') sh.getRange(1, 8, 1, 2).setValues([['env', 'sig']]); // 列を足す前に作ったシート
  return sh;
}
const monthKey_ = (d) => Utilities.formatDate(d || new Date(), 'Asia/Tokyo', 'yyyy-MM');
const monthKeyOf_ = (v) => (v instanceof Date ? monthKey_(v) : String(v));
const json_ = (o) => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);

function list_(month, n) {
  const rows = sheet_().getDataRange().getValues().slice(1).filter((r) => monthKeyOf_(r[0]) === month);
  rows.sort((a, b) => (b[3] - a[3]) || (new Date(a[1]) - new Date(b[1])));
  const out = [];
  for (const r of rows) {
    if (out.length >= n) break;
    try {
      out.push({ time: new Date(r[1]).toISOString(), name: String(r[2]), total: Number(r[3]),
        ids: JSON.parse(r[4]), throws: JSON.parse(r[5]), ver: String(r[6]),
        env: String(r[7] || ''), sig: String(r[8] || '') });
    } catch (err) { /* 壊れた行は飛ばす */ }
  }
  return out;
}

// 1人（同じ名前）につき最高の1件。その人の他の記録は others に（点の高い順に3件まで）
function perName_(month, n) {
  const all = list_(month, 100000), by = {}, out = [];
  for (const r of all) {
    const k = r.name;
    if (!by[k]) { if (out.length >= n) continue; by[k] = r; r.others = []; r.more = 0; out.push(r); }
    else { by[k].more++; if (by[k].others.length < 3) by[k].others.push(r); }
  }
  return out;
}
const cacheKey_ = (month, n, per) => ['L', month, n, per ? 1 : 0].join('_');
function clearListCache_(month) {
  const keys = [];
  for (const n of [1, 20, 50]) for (const per of [0, 1]) keys.push(cacheKey_(month, n, per));
  CacheService.getScriptCache().removeAll(keys);
}
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.ping) return json_({ ok: true });
  const month = /^\d{4}-\d{2}$/.test(p.month || '') ? p.month : monthKey_();
  const n = [1, 20, 50].indexOf(Number(p.n)) >= 0 ? Number(p.n) : 20;   // キャッシュが散らないよう件数は決まった値だけ
  const per = !!p.per;
  const cache = CacheService.getScriptCache(), key = cacheKey_(month, n, per);
  const hit = cache.get(key);
  if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);
  const body = JSON.stringify({ ok: true, month, per, list: per ? perName_(month, n) : list_(month, n) });
  if (body.length < 95000) cache.put(key, body, 60);   // キャッシュは1件100KBまで
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function cleanName_(s) {
  // 先頭の = + - @ は表計算で数式として扱われるので外す
  return String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().replace(/^[=+\-@]+/, '').trim().slice(0, 12);
}
function isNum_(v) { return typeof v === 'number' && isFinite(v); }
// 端末の大まかな種類（例 iOS/webkit）と計算の指紋（16進8桁）。それ以外の形は捨てる
const cleanEnv_ = (s) => (/^[A-Za-z]{2,10}\/[a-z]{3,8}$/.test(String(s || '')) ? String(s) : '');
const cleanSig_ = (s) => (/^[0-9a-f]{8}$/.test(String(s || '')) ? String(s) : '');
// 投稿しすぎの抑止（全体で1分に30件まで）。照合の記録は別の枠（投稿の枠を食わないように）
function overLimit_(kind) {
  const cache = CacheService.getScriptCache();
  const key = (kind || 'n') + Math.floor(Date.now() / 60000);
  const cnt = Number(cache.get(key) || 0);
  if (cnt >= 30) return true;
  cache.put(key, String(cnt + 1), 120);
  return false;
}
// 照合の結果を残す（閲覧者の端末で上位の記録を計算し直した結果。端末どうしの計算差を後で調べるため）
function logChecks_(d) {
  if (overLimit_('c')) return json_({ ok: false, error: 'busy' });
  const list = Array.isArray(d.checks) ? d.checks.slice(0, 20) : [];
  const env = cleanEnv_(d.env), sig = cleanSig_(d.sig), ver = String(d.ver || '').slice(0, 12);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('checks');
  if (!sh) { sh = ss.insertSheet('checks'); sh.appendRow(['time', 'viewerEnv', 'viewerSig', 'viewerVer', 'entryTime', 'entryName', 'entryEnv', 'entrySig', 'entryVer', 'result', 'got']); }
  const now = new Date();
  const rows = list.map((c) => [now, env, sig, ver, String(c.time || '').slice(0, 30), cleanName_(c.name), cleanEnv_(c.env), cleanSig_(c.sig),
    String(c.ver || '').slice(0, 12), ['ok', 'old', 'device', 'ng'].indexOf(c.res) >= 0 ? c.res : '?',
    Array.isArray(c.got) ? c.got.filter((id) => id in PTS).slice(0, 5).join(',') : '']);
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  return json_({ ok: true, logged: rows.length });
}

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad json' }); }
  if (!d || typeof d !== 'object') return json_({ ok: false, error: 'bad json' });
  if (d.action === 'delete') return deleteByName_(d);
  if (d.action === 'check') return logChecks_(d);
  const name = cleanName_(d.name);
  if (!name) return json_({ ok: false, error: 'name' });
  const ids = d.ids, th = d.throws;
  if (!Array.isArray(ids) || ids.length !== 5 || !ids.every((id) => id in PTS)) return json_({ ok: false, error: 'ids' });
  if (!Array.isArray(th) || th.length !== 5) return json_({ ok: false, error: 'throws' });
  for (const t of th) {
    if (!t || !['p', 'x', 'y', 'a'].every((k) => isNum_(t[k])) || FORMS.indexOf(t.f) < 0) return json_({ ok: false, error: 'throw' });
    if (t.p < 0.2 || t.p > 0.91 || Math.abs(t.a) > 0.81 || Math.abs(t.x) > 0.15 || t.y < 0.13 || t.y > 0.45) return json_({ ok: false, error: 'range' });
    const g = t.g || {};
    const clean = {};
    for (const k of G_KEYS) if (k in g) { if (!isNum_(g[k])) return json_({ ok: false, error: 'g' }); clean[k] = g[k]; }
    t.g = clean;
  }
  const total = ids.reduce((s, id) => s + PTS[id], 0);
  if (total !== d.total) return json_({ ok: false, error: 'total' });
  const ver = String(d.ver || '').slice(0, 12);

  if (overLimit_()) return json_({ ok: false, error: 'busy' });

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const now = new Date();
    const month = monthKey_(now);
    const thJson = JSON.stringify(th.map((t) => ({ p: t.p, x: t.x, y: t.y, a: t.a, f: t.f, g: t.g })));
    const dup = sheet_().getDataRange().getValues().slice(1).some((r) => monthKeyOf_(r[0]) === month && String(r[5]) === thJson);
    if (dup) return json_({ ok: true, dup: true, month, ...rankOf_(month, name, total) });
    sheet_().appendRow([month, now, name, total, JSON.stringify(ids), thJson, ver, cleanEnv_(d.env), cleanSig_(d.sig)]);
    clearListCache_(month);
    return json_({ ok: true, month, ...rankOf_(month, name, total) });
  } finally {
    lock.releaseLock();
  }
}

// 番付での順位（1人1件の並び）：自分より最高点が上の人の数＋1。count は載っている人数
function rankOf_(month, name, total) {
  const best = {};
  for (const r of list_(month, 100000)) if (!(r.name in best)) best[r.name] = r.total;
  const mine = Math.max(total, name in best ? best[name] : -Infinity);
  const names = Object.keys(best);
  return { rank: names.filter((k) => k !== name && best[k] > mine).length + 1, count: names.length, best: mine };
}

// 管理用：今月の指定した名前の記録を消す（ADMIN_KEY が空なら無効）
function deleteByName_(d) {
  if (overLimit_()) return json_({ ok: false, error: 'busy' });   // 鍵の総当たりも抑える
  if (!ADMIN_KEY || d.key !== ADMIN_KEY) return json_({ ok: false, error: 'forbidden' });
  const sh = sheet_(), vals = sh.getDataRange().getValues(), month = monthKey_();
  let n = 0;
  for (let r = vals.length - 1; r >= 1; r--) {
    if (monthKeyOf_(vals[r][0]) === month && String(vals[r][2]) === String(d.name)) { sh.deleteRow(r + 1); n++; }
  }
  clearListCache_(month);
  return json_({ ok: true, deleted: n });
}

// 初回だけエディタから実行して権限を承認する（承認しないと /exec が 403 になる）
function setup() {
  sheet_();
  Logger.log('ok: ' + ScriptApp.getService().getUrl());
}

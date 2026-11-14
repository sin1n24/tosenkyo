/**
 * フィジカル投扇興 月間番付（GAS Webアプリ＋このスプレッドシート）
 *  GET  ?month=YYYY-MM&n=20  → その月の上位（合計点の高い順、同点は早い者勝ち）
 *  POST {name, total, ids[5], throws[5], ver} → 1件追加
 * 点数は送られた銘(ids)からサーバー側で計算し直す。各投げの入力(throws)は保存しておき、
 * 閲覧者のブラウザが同じ物理で計算し直して点数が本物か確かめる（ゲーム側の verifyEntry）。
 */
const SHEET = 'scores';
const PTS = { yumeukihashi: 100, kiritsubo: 75, mio: 40, ukifune: 30, akashi: 20, kobai: 20, hananoen: 12,
  suma: 10, yugao: 8, matsukaze: 5, hanachirusato: 3, sekiya: 1, tenarai: 0, kotsuri: -1, nowaki: -30 };
const FORMS = ['straight', 'curve', 'circle', 'zigzag'];
const G_KEYS = ['maxDev', 'chord', 'turnSum', 'firstDevSign'];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.appendRow(['month', 'time', 'name', 'total', 'ids', 'throws', 'ver']);
    sh.getRange('A:A').setNumberFormat('@'); // 月キーが日付に化けないように
  }
  return sh;
}
const monthKey_ = (d) => Utilities.formatDate(d || new Date(), 'Asia/Tokyo', 'yyyy-MM');
const monthKeyOf_ = (v) => (v instanceof Date ? monthKey_(v) : String(v));
const json_ = (o) => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);

function list_(month, n) {
  const rows = sheet_().getDataRange().getValues().slice(1).filter((r) => monthKeyOf_(r[0]) === month);
  rows.sort((a, b) => (b[3] - a[3]) || (new Date(a[1]) - new Date(b[1])));
  return rows.slice(0, n).map((r) => ({
    time: new Date(r[1]).toISOString(), name: String(r[2]), total: Number(r[3]),
    ids: JSON.parse(r[4]), throws: JSON.parse(r[5]), ver: String(r[6]),
  }));
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  const month = /^\d{4}-\d{2}$/.test(p.month || '') ? p.month : monthKey_();
  const n = Math.max(1, Math.min(50, Number(p.n) || 20));
  return json_({ ok: true, month, list: list_(month, n) });
}

function cleanName_(s) {
  return String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 12);
}
function isNum_(v) { return typeof v === 'number' && isFinite(v); }

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad json' }); }
  const name = cleanName_(d.name);
  if (!name) return json_({ ok: false, error: 'name' });
  const ids = d.ids, th = d.throws;
  if (!Array.isArray(ids) || ids.length !== 5 || !ids.every((id) => id in PTS)) return json_({ ok: false, error: 'ids' });
  if (!Array.isArray(th) || th.length !== 5) return json_({ ok: false, error: 'throws' });
  for (const t of th) {
    if (!t || !['p', 'x', 'y', 'a'].every((k) => isNum_(t[k])) || FORMS.indexOf(t.f) < 0) return json_({ ok: false, error: 'throw' });
    const g = t.g || {};
    const clean = {};
    for (const k of G_KEYS) if (k in g) { if (!isNum_(g[k])) return json_({ ok: false, error: 'g' }); clean[k] = g[k]; }
    t.g = clean;
  }
  const total = ids.reduce((s, id) => s + PTS[id], 0);
  if (total !== d.total) return json_({ ok: false, error: 'total' });
  const ver = String(d.ver || '').slice(0, 12);

  // 投稿しすぎの抑止（全体で1分に30件まで）
  const cache = CacheService.getScriptCache();
  const key = 'n' + Math.floor(Date.now() / 60000);
  const cnt = Number(cache.get(key) || 0);
  if (cnt >= 30) return json_({ ok: false, error: 'busy' });
  cache.put(key, String(cnt + 1), 120);

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const now = new Date();
    const month = monthKey_(now);
    sheet_().appendRow([month, now, name, total, JSON.stringify(ids), JSON.stringify(th.map((t) => ({ p: t.p, x: t.x, y: t.y, a: t.a, f: t.f, g: t.g }))), ver]);
    const list = list_(month, 1000);
    const rank = list.filter((r) => r.total > total).length + 1;
    return json_({ ok: true, month, rank, count: list.length });
  } finally {
    lock.releaseLock();
  }
}

// 初回だけエディタから実行して権限を承認する（承認しないと /exec が 403 になる）
function setup() {
  sheet_();
  Logger.log('ok: ' + ScriptApp.getService().getUrl());
}

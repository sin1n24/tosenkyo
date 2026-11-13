/* ============================================================
   投扇興 〜扇、ひとひら舞う〜
   Three.js + cannon-es  スマホ向け 3D 投扇興
   (c) sin1's studio
   ============================================================ */
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const glCanvas = $('gl');
const trailCanvas = $('trail');
const trailCtx = trailCanvas.getContext('2d');
const inputLayer = $('input-layer');
const reticleEl = $('reticle');
const DEBUG = location.search.includes('debug');

/* ---------- 定数 ---------- */
const CFG = {
  handPos: new THREE.Vector3(0, 0.30, 1.15),   // 扇の投じ位置
  aimRange: { x: 0.12, yMin: 0.16, yMax: 0.42 },
  aimDefault: { x: 0, y: 0.285 },              // 蝶の下端あたり
  speedMin: 1.9, speedMax: 3.8,
  launchUpBias: 0.55,
  baseTimeScale: 0.85,
  slowMoScale: 0.32,
  fixedDt: 1 / 120,
  throwsPerGame: 5,                             // 五投勝負
};

const MAKURA = { w: 0.09, h: 0.27, d: 0.09 };   // 底面正方形・背の高い台
const CHO = { w: 0.09, h: 0.095 };

/* ---------- 銘定 ---------- */
const MEI = {
  yumeukihashi: { name: '夢浮橋', yomi: 'ゆめのうきはし', romaji: 'Yume no Ukihashi', pts: 100, desc: '扇は蝶と枕の橋となる' },
  kiritsubo:    { name: '桐壺',   yomi: 'きりつぼ',       romaji: 'Kiritsubo',        pts: 75,  desc: '扇は枕に 蝶は立ちて落つ' },
  mio:          { name: '澪標',   yomi: 'みおつくし',     romaji: 'Miotsukushi',      pts: 40,  desc: '扇 枕の上に憩う' },
  ukifune:      { name: '浮舟',   yomi: 'うきふね',       romaji: 'Ukifune',          pts: 30,  desc: '落ちた扇に蝶が乗る' },
  akashi:       { name: '明石',   yomi: 'あかし',         romaji: 'Akashi',           pts: 20,  desc: '蝶 地に立つ' },
  kobai:        { name: '紅梅',   yomi: 'こうばい',       romaji: 'Kobai',            pts: 20,  desc: '蝶は動ぜず 扇は枕に上がる' },
  hananoen:     { name: '花宴',   yomi: 'はなのえん',     romaji: 'Hana no En',       pts: 12,  desc: '蝶 枕の縁にとどまる' },
  suma:         { name: '須磨',   yomi: 'すま',           romaji: 'Suma',             pts: 10,  desc: '蝶落ち 扇は枕に寄り添う' },
  yugao:        { name: '夕顔',   yomi: 'ゆうがお',       romaji: 'Yugao',            pts: 8,   desc: '蝶 扇の陰に伏す' },
  matsukaze:    { name: '松風',   yomi: 'まつかぜ',       romaji: 'Matsukaze',        pts: 5,   desc: '蝶 枕の上に伏す' },
  hanachirusato:{ name: '花散里', yomi: 'はなちるさと',   romaji: 'Hanachirusato',    pts: 3,   desc: '蝶は落ち 扇は流れる' },
  sekiya:       { name: '関屋',   yomi: 'せきや',         romaji: 'Sekiya',           pts: 1,   desc: '蝶は残り 扇は枕に触れる' },
  tenarai:      { name: '手習',   yomi: 'てならい',       romaji: 'Tenarai',          pts: 0,   desc: '扇 むなしく座敷を滑る' },
  kotsuri:      { name: 'コツリ', yomi: 'こつり',         romaji: 'Kotsuri',          pts: -1,  desc: '扇 枕を打つのみ' },
  nowaki:       { name: '野分',   yomi: 'のわき',         romaji: 'Nowaki',           pts: -30, desc: '枕 風に倒る' },
};
const MEI_ORDER = ['yumeukihashi','kiritsubo','mio','ukifune','akashi','kobai','hananoen',
  'suma','yugao','matsukaze','hanachirusato','sekiya','tenarai','kotsuri','nowaki'];

/* ---------- 言語（銘・タイトルは常に日本語、説明系のみ切替） ---------- */
let lang = localStorage.getItem('tosenkyo_lang') || 'ja';
const MEI_EN = {
  yumeukihashi: 'The fan rests bridging pillow and butterfly',
  kiritsubo:    'Fan on the pillow; the butterfly falls yet stands',
  mio:          'The fan comes to rest atop the pillow',
  ukifune:      'The butterfly rides the fallen fan',
  akashi:       'The butterfly lands standing on the floor',
  kobai:        'The butterfly holds on; the fan climbs the pillow',
  hananoen:     'The butterfly lingers at the pillow’s edge',
  suma:         'Butterfly down; the fan leans on the pillow',
  yugao:        'The butterfly rests beneath the fan',
  matsukaze:    'The butterfly lies fallen atop the pillow',
  hanachirusato:'Butterfly falls; the fan drifts away',
  sekiya:       'The butterfly stays; the fan touches the pillow',
  tenarai:      'The fan glides by, touching nothing',
  kotsuri:      'The fan strikes only the pillow',
  nowaki:       'The pillow is toppled — a gale',
};
const L = {
  ja: {
    guideAim: '狙う所に触れる ― 指を引いて微調整',
    guideSwipe: '下から上へ ふわりと払う',
    btnPlay: '遊 ぶ', btnScores: '銘定表', btnTips: '手ほどき', btnAimOk: '構え、よし',
    btnRetry: '今一度', btnShare: '結果を伝える', btnToTitle: '表座敷へ', btnMenuQuit: '表座敷へ戻る',
    scoresTitle: '銘定表', tipsTitle: '手ほどき', menuTitle: '小休止',
    btnResume: '続ける', btnClose: '閉じる', soundOn: '音：鳴', soundOff: '音：消',
    resultLabel: '結びの一巻', bestLabel: 'これまでの最高 ',
    scoresNote1: '扇・蝶・枕のかたちに、源氏物語五十四帖の名を借りて点を定めます。',
    scoresNote2: '【流派について】銘とその点は流派ごとに異なります。本作の銘定は、都御流の源氏物語形式を基に、御扇流・其扇流などの定めを参考にした独自のものです。',
    tips: [
      '<b>ふわりと投じる。</b>力任せは扇の乱れのもと。枕を倒せば「野分」、大きく点を失います。',
      '<b>狙いは蝶の下端。</b>裾を掬うように当てると、蝶は宙に舞い、良い銘が生まれやすくなります。',
      '<b>枕の上端は禁物。</b>縁に扇が当たると「コツリ」。音は良くても点になりません。',
      '<b>払い方で飛び方が変わる。</b>まっすぐ払えば素直に水平を保ち、弧を描けば横に回り、円を描けば傾いて滑り、ジグザグなら縦に暴れます。',
      '<b>呼吸を読む。</b>狙いは息づかいでわずかに揺れます。止まる一瞬を見極めて構えましょう。',
      '<b>かたちは時の運。</b>同じ投げでも結びは一度きり。それもまた一興です。',
    ],
    langBtn: 'English',
  },
  en: {
    guideAim: 'Touch where to aim — drag to fine-tune',
    guideSwipe: 'Swipe up — a gentle toss',
    btnPlay: 'Play', btnScores: 'Scoring', btnTips: 'How to Play', btnAimOk: 'Ready',
    btnRetry: 'Once More', btnShare: 'Share', btnToTitle: 'Title', btnMenuQuit: 'Quit to Title',
    scoresTitle: 'Scoring', tipsTitle: 'How to Play', menuTitle: 'Break',
    btnResume: 'Resume', btnClose: 'Close', soundOn: 'Sound: On', soundOff: 'Sound: Off',
    resultLabel: 'Final Tally', bestLabel: 'Best: ',
    scoresNote1: 'Each final arrangement of fan, butterfly and pillow is a “mei” — a form named after a chapter of the Tale of Genji, each worth its own points.',
    scoresNote2: 'About schools: forms and points vary by school. This game uses its own scoring based on the Miyako-Goryu Genji style, with reference to the Gosen-ryu and Kisen-ryu schools.',
    tips: [
      '<b>Toss gently.</b> Throwing hard scatters the fan — topple the pillow and “Nowaki” costs you 30 points.',
      '<b>Aim for the butterfly’s base.</b> Scoop its lower edge and it dances into the air — better forms follow.',
      '<b>Avoid the pillow’s rim.</b> Clip it and that’s “Kotsuri” — a fine sound, but minus one point.',
      '<b>Your stroke shapes the flight.</b> A straight swipe glides flat and true; an arc adds sideways spin; a circle banks the fan; a zigzag makes it tumble.',
      '<b>Watch your breathing.</b> The reticle sways gently; catch the moment it settles before you commit.',
      '<b>The final form is fate.</b> No two throws end alike — that, too, is part of the game.',
    ],
    langBtn: '日本語',
  },
};
const meiDesc = (id) => lang === 'ja' ? MEI[id].desc : MEI_EN[id];

/* ---------- 漢数字 ---------- */
const KD = ['〇','一','二','三','四','五','六','七','八','九'];
function toKanji(n) {
  n = Math.round(n);
  if (n === 0) return '〇';
  if (n < 0) return toKanji(-n);
  let s = '';
  const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), o = n % 10;
  if (h) s += (h > 1 ? KD[h] : '') + '百';
  if (t) s += (t > 1 ? KD[t] : '') + '十';
  if (o) s += KD[o];
  return s;
}
function ptsLabel(p) {
  if (lang === 'en') return p === 0 ? 'no score' : (p < 0 ? `−${-p} pts` : `${p} pts`);
  if (p === 0) return '無点';
  if (p < 0) return '過料' + toKanji(-p) + '点';
  return toKanji(p) + '点';
}
function totalLabel(n) {
  if (lang === 'en') return `${n} pts`;
  return (n < 0 ? '過料' : '') + toKanji(Math.abs(n)) + '点';
}

/* ---------- 音 ---------- */
let actx = null, muted = false;
function audio() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function env(g, t0, a, d, peak = 1) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}
function tone(freq, type, a, d, peak, detune = 0, when = 0) {
  if (muted) return;
  const c = audio(), t0 = c.currentTime + when;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq; o.detune.value = detune;
  env(g, t0, a, d, peak);
  o.connect(g).connect(c.destination);
  o.start(t0); o.stop(t0 + a + d + 0.05);
}
function noiseBurst(dur, peak, filterFreq, when = 0) {
  if (muted) return;
  const c = audio(), t0 = c.currentTime + when;
  const len = Math.max(1, (dur * c.sampleRate) | 0);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = filterFreq;
  const g = c.createGain(); env(g, t0, 0.01, dur, peak);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t0);
}
const snd = {
  tap:   () => tone(660, 'triangle', 0.005, 0.12, 0.12),
  ready: () => { tone(440, 'triangle', 0.005, 0.2, 0.1); tone(660, 'triangle', 0.005, 0.25, 0.08, 0, 0.07); },
  whoosh:() => noiseBurst(0.35, 0.16, 900),
  bell:  () => { tone(2493, 'sine', 0.003, 0.7, 0.16); tone(3322, 'sine', 0.003, 0.5, 0.09, 8); tone(2493, 'sine', 0.003, 0.4, 0.07, -6, 0.09); },
  thud:  () => { tone(130, 'sine', 0.004, 0.14, 0.25); noiseBurst(0.08, 0.1, 500); },
  slide: () => noiseBurst(0.22, 0.06, 1600),
  score: (pts) => {
    if (pts >= 30) [523, 659, 784, 1047].forEach((f, i) => tone(f, 'triangle', 0.005, 0.5, 0.12, 0, i * 0.09));
    else if (pts > 0) [659, 784].forEach((f, i) => tone(f, 'triangle', 0.005, 0.4, 0.1, 0, i * 0.09));
    else if (pts < 0) tone(196, 'sine', 0.01, 0.5, 0.14);
    else tone(330, 'sine', 0.01, 0.3, 0.07);
  },
};

/* ---------- Three.js ---------- */
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0a09);
scene.fog = new THREE.FogExp2(0x0d0a09, 0.22);

const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 20);
camera.position.set(0, 0.5, 1.6);

/* 照明 */
scene.add(new THREE.AmbientLight(0x584a3c, 1.15));
const key = new THREE.SpotLight(0xffe2b0, 55, 9, Math.PI / 4.6, 0.55, 2);
key.position.set(0.9, 2.6, 1.6);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.bias = -0.0004;
const keyTarget = new THREE.Object3D(); keyTarget.position.set(0, 0, 0.3);
scene.add(keyTarget); key.target = keyTarget;
scene.add(key);
const rim = new THREE.PointLight(0x6a7fb0, 3.2, 5);
rim.position.set(-1.2, 0.9, -1.0);
scene.add(rim);
// 手前（客側）からの柔らかい補助光：漆黒が潰れないように
const fill = new THREE.DirectionalLight(0xffe0c0, 0.85);
fill.position.set(0.3, 1.2, 2.4);
scene.add(fill);

/* ---------- 舞台 ---------- */
function makeCanvasTexture(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
{
  // 床（漆の間）
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshStandardMaterial({ color: 0x17120e, roughness: 0.55, metalness: 0.25 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // 緋毛氈
  const mousenTex = makeCanvasTexture(128, 512, (c, w, h) => {
    c.fillStyle = '#7a1420'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      c.fillStyle = `rgba(${120 + Math.random() * 60 | 0},20,30,${Math.random() * 0.16})`;
      c.fillRect(Math.random() * w, Math.random() * h, 1.6, 1.6);
    }
  });
  const mousen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.68, 2.7),
    new THREE.MeshStandardMaterial({ map: mousenTex, roughness: 0.96 })
  );
  mousen.rotation.x = -Math.PI / 2;
  mousen.position.set(0, 0.003, 0.75);
  mousen.receiveShadow = true;
  scene.add(mousen);

  // 金屏風
  const goldTex = makeCanvasTexture(256, 128, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#8a6a2a'); g.addColorStop(0.45, '#caa24e');
    g.addColorStop(0.72, '#a37e34'); g.addColorStop(1, '#6e5322');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      c.fillStyle = `rgba(255,235,180,${Math.random() * 0.08})`;
      c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
  const panelGeo = new THREE.PlaneGeometry(0.55, 1.15);
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(panelGeo, new THREE.MeshStandardMaterial({
      map: goldTex, roughness: 0.35, metalness: 0.75,
      emissive: 0x332200, emissiveIntensity: 0.25,
    }));
    p.position.set((i - 1.5) * 0.53, 0.575, -0.8 + (i % 2 ? 0.05 : 0));
    p.rotation.y = (i % 2 ? -1 : 1) * 0.16;
    scene.add(p);
  }

  // 漂う金の塵（雰囲気）
  const dustGeo = new THREE.BufferGeometry();
  const dustN = 34, dustPos = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 2.4;
    dustPos[i * 3 + 1] = 0.1 + Math.random() * 1.2;
    dustPos[i * 3 + 2] = -0.7 + Math.random() * 2.6;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0xeecf7d, size: 0.006, transparent: true, opacity: 0.5, depthWrite: false,
  }));
  scene.add(dust);
  dust.userData.update = (t) => {
    const p = dustGeo.attributes.position;
    for (let i = 0; i < dustN; i++) {
      p.array[i * 3 + 1] += Math.sin(t * 0.4 + i) * 0.0002;
      p.array[i * 3] += Math.cos(t * 0.23 + i * 2.1) * 0.00015;
    }
    p.needsUpdate = true;
  };
  scene.userData.dust = dust;
}

/* ---------- 模型（暫定形状：後日差し替え可） ---------- */
// ▼枕（桐箱）— 差し替え時はこの関数を GLTF ロードに置換
function buildMakuraMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(MAKURA.w, MAKURA.h, MAKURA.d),
    new THREE.MeshStandardMaterial({ color: 0x2b1017, roughness: 0.4, metalness: 0.1 })
  );
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(body.geometry),
    new THREE.LineBasicMaterial({ color: 0xc9a24b })
  );
  g.add(edges);
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(MAKURA.w + 0.002, 0.018, MAKURA.d + 0.002),
    new THREE.MeshStandardMaterial({ color: 0xc9a24b, roughness: 0.35, metalness: 0.7 })
  );
  band.position.y = -MAKURA.h / 2 + 0.03;
  g.add(band);
  return g;
}

// ▼蝶（銀杏形の的）— 差し替え時はこの関数を GLTF ロードに置換
function buildChoMesh() {
  const g = new THREE.Group();
  const sector = (r, a0, a1, notch) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    const N = 24;
    for (let i = 0; i <= N; i++) {
      const a = a0 + (a1 - a0) * (i / N);
      let rr = r;
      if (notch) rr = r * (1 - 0.10 * Math.exp(-Math.pow((i / N - 0.5) * 7, 2))); // 銀杏の切れ込み
      s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    s.closePath();
    return s;
  };
  const a0 = Math.PI / 2 - 0.98, a1 = Math.PI / 2 + 0.98;
  const back = new THREE.Mesh(
    new THREE.ShapeGeometry(sector(0.052, a0, a1, true)),
    new THREE.MeshStandardMaterial({ color: 0xc9a24b, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide })
  );
  back.position.set(0, 0.036, -0.001);
  const front = new THREE.Mesh(
    new THREE.ShapeGeometry(sector(0.047, a0, a1, true)),
    new THREE.MeshStandardMaterial({ color: 0xb3341f, roughness: 0.6, side: THREE.DoubleSide })
  );
  front.position.set(0, 0.036, 0.0012);
  back.castShadow = front.castShadow = true;
  g.add(back, front);
  // 軸
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0035, 0.0045, 0.04, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.5 })
  );
  stem.position.y = 0.02;
  g.add(stem);
  // 台座の円盤（物理の接地面に合わせる）
  const foot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.02, 0.006, 16),
    new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.5 })
  );
  foot.position.y = 0.003;
  foot.castShadow = true;
  g.add(foot);
  // 鈴
  const bellMat = new THREE.MeshStandardMaterial({ color: 0xeecf7d, roughness: 0.25, metalness: 0.9 });
  for (const sx of [-1, 1]) {
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), bellMat);
    bell.position.set(sx * 0.043, 0.052, 0.004);
    g.add(bell);
  }
  // 物理 body の原点（板中央よりやや下）に合わせて下げる
  const wrap = new THREE.Group();
  g.position.y = -0.0375;
  wrap.add(g);
  return wrap;
}

// ▼扇（開いた扇子）— 差し替え時はこの関数を GLTF ロードに置換
function buildFanMesh() {
  const g = new THREE.Group();
  const R = 0.17, R0 = 0.035, SPAN = 1.95; // 約112°
  const a0 = Math.PI / 2 - SPAN / 2, a1 = Math.PI / 2 + SPAN / 2;
  const paperShape = new THREE.Shape();
  const N = 28;
  for (let i = 0; i <= N; i++) {
    const a = a0 + (a1 - a0) * (i / N);
    const m = paperShape[i === 0 ? 'moveTo' : 'lineTo'];
    m.call(paperShape, Math.cos(a) * R, Math.sin(a) * R);
  }
  for (let i = N; i >= 0; i--) {
    const a = a0 + (a1 - a0) * (i / N);
    paperShape.lineTo(Math.cos(a) * R0, Math.sin(a) * R0);
  }
  paperShape.closePath();
  const paperGeo = new THREE.ExtrudeGeometry(paperShape, { depth: 0.0028, bevelEnabled: false });
  const cy = 0.105; // 重心を原点へ
  paperGeo.translate(0, -cy, -0.0014);
  const paper = new THREE.Mesh(paperGeo, new THREE.MeshStandardMaterial({
    color: 0xf2e6cf, roughness: 0.85, side: THREE.DoubleSide,
  }));
  paper.castShadow = paper.receiveShadow = true;
  g.add(paper);
  // 朱の縁取り
  const rimShape = new THREE.Shape();
  for (let i = 0; i <= N; i++) {
    const a = a0 + (a1 - a0) * (i / N);
    const m = rimShape[i === 0 ? 'moveTo' : 'lineTo'];
    m.call(rimShape, Math.cos(a) * R, Math.sin(a) * R);
  }
  for (let i = N; i >= 0; i--) {
    const a = a0 + (a1 - a0) * (i / N);
    rimShape.lineTo(Math.cos(a) * (R - 0.02), Math.sin(a) * (R - 0.02));
  }
  rimShape.closePath();
  const rimGeo = new THREE.ExtrudeGeometry(rimShape, { depth: 0.003, bevelEnabled: false });
  rimGeo.translate(0, -cy, -0.0015);
  const rimMesh = new THREE.Mesh(rimGeo, new THREE.MeshStandardMaterial({
    color: 0xb3341f, roughness: 0.7, side: THREE.DoubleSide,
  }));
  g.add(rimMesh);
  // 骨
  const boneMat = new THREE.MeshStandardMaterial({ color: 0x4a3016, roughness: 0.5 });
  for (let i = 0; i < 9; i++) {
    const a = a0 + (a1 - a0) * (i / 8);
    const bone = new THREE.Mesh(new THREE.BoxGeometry(0.004, R - 0.008, 0.0022), boneMat);
    bone.position.set(Math.cos(a) * (R / 2), Math.sin(a) * (R / 2) - cy, 0.0022);
    bone.rotation.z = a - Math.PI / 2;
    bone.castShadow = true;
    g.add(bone);
  }
  // 要
  const kaname = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.008, 12),
    new THREE.MeshStandardMaterial({ color: 0xc9a24b, metalness: 0.8, roughness: 0.3 }));
  kaname.rotation.x = Math.PI / 2;
  kaname.position.set(0, -cy, 0);
  g.add(kaname);
  // XY 平面で作った面を XZ（水平）へ倒す：面法線を +Y に
  const wrap = new THREE.Group();
  g.rotation.x = -Math.PI / 2;
  wrap.add(g);
  return wrap;
}

// ▼GLB モデル（TripoAI 製、models/）。物理 body の原点・軸に合わせて焼き込み済み。
//   読み込み完了までは暫定形状を表示し、失敗時はそのまま暫定形状を使う。
const MODEL_VER = 1; // GLB を差し替えたら上げる（キャッシュ対策）
const gltfLoader = new GLTFLoader();
function withModel(name, buildFallback) {
  const wrap = new THREE.Group();
  const fallback = buildFallback();
  wrap.add(fallback);
  gltfLoader.load(`models/${name}.glb?v=${MODEL_VER}`, (gltf) => {
    gltf.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    wrap.remove(fallback);
    wrap.add(gltf.scene);
  }, undefined, (err) => console.warn(`[model] ${name}.glb の読み込みに失敗。暫定形状を使用`, err));
  return wrap;
}
const makuraMesh = withModel('makura', buildMakuraMesh); scene.add(makuraMesh);
const choMesh = withModel('cho', buildChoMesh); scene.add(choMesh);
const fanMesh = withModel('fan', buildFanMesh); scene.add(fanMesh);

/* ---------- 物理 ---------- */
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.solver.iterations = 24;
world.allowSleep = true;
// 軽い薄板（扇）の接触発散を防ぐため、接触をやわらかく解く
world.defaultContactMaterial.contactEquationStiffness = 1e6;
world.defaultContactMaterial.contactEquationRelaxation = 4;

const matFloor = new CANNON.Material('floor');
const matFan = new CANNON.Material('fan');
const matWood = new CANNON.Material('wood');
const SOFT = { contactEquationStiffness: 1e6, contactEquationRelaxation: 4 };
world.addContactMaterial(new CANNON.ContactMaterial(matFan, matFloor, { friction: 0.55, restitution: 0.02, ...SOFT }));
world.addContactMaterial(new CANNON.ContactMaterial(matFan, matWood, { friction: 0.65, restitution: 0.05, ...SOFT }));
world.addContactMaterial(new CANNON.ContactMaterial(matWood, matFloor, { friction: 0.5, restitution: 0.05, ...SOFT }));
world.addContactMaterial(new CANNON.ContactMaterial(matWood, matWood, { friction: 0.45, restitution: 0.08, ...SOFT }));

const floorBody = new CANNON.Body({ mass: 0, material: matFloor, shape: new CANNON.Plane() });
floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(floorBody);

const makuraBody = new CANNON.Body({
  mass: 1.4, material: matWood,
  shape: new CANNON.Box(new CANNON.Vec3(MAKURA.w / 2, MAKURA.h / 2, MAKURA.d / 2)),
});
makuraBody.sleepSpeedLimit = 0.08; makuraBody.sleepTimeLimit = 0.4;
world.addBody(makuraBody);

// 原点＝重心を板の中央に置く（底に置くと起き上がり小法師になってしまう）
const CHO_HALF_H = 0.0475;
const choBody = new CANNON.Body({ mass: 0.02, material: matWood });
// 板をわずかに上へずらす＝重心が板中央より少し下（錘付きの蝶。たまに立って落ちる）
choBody.addShape(new CANNON.Box(new CANNON.Vec3(CHO.w / 2, CHO_HALF_H, 0.004)), new CANNON.Vec3(0, 0.01, 0));
// 台座（接地面）：直立が安定するよう広め
choBody.addShape(new CANNON.Box(new CANNON.Vec3(0.018, 0.006, 0.018)), new CANNON.Vec3(0, -CHO_HALF_H + 0.016, 0));
choBody.linearDamping = 0.2; choBody.angularDamping = 0.3;
choBody.sleepSpeedLimit = 0.06; choBody.sleepTimeLimit = 0.35;
world.addBody(choBody);

const fanBody = new CANNON.Body({
  mass: 0.09, material: matFan,
  shape: new CANNON.Box(new CANNON.Vec3(0.14, 0.012, 0.075)),
});
// 要（かなめ）側にも当たり判定を持たせ、床へのめり込みを防ぐ
fanBody.addShape(new CANNON.Box(new CANNON.Vec3(0.02, 0.01, 0.02)), new CANNON.Vec3(0, 0, 0.098));
fanBody.linearDamping = 0.05; fanBody.angularDamping = 0.9;
fanBody.sleepSpeedLimit = 0.07; fanBody.sleepTimeLimit = 0.35;
world.addBody(fanBody);

/* 衝突記録 */
const contacts = { fanCho: false, fanMakura: false, firstHit: null, makuraImpact: 0 };
let lastBellT = 0, lastThudT = 0;
let lastPower = 0, toppleFired = false;
fanBody.addEventListener('collide', (e) => {
  const now = performance.now();
  if (e.body === choBody) {
    contacts.fanCho = true;
    if (!contacts.firstHit) contacts.firstHit = 'cho';
    // 鈴は強い接触のみ・回数制限つき（触れ続けても鳴り続けない）
    const ivCho = Math.abs(e.contact.getImpactVelocityAlongNormal());
    if ((state === 'flight' || state === 'judge') && bellCount < 3 && ivCho > 0.5 && now - lastBellT > 400) {
      snd.bell(); lastBellT = now; bellCount++;
      spawnBurst(choBody.position, 0xeecf7d, 14, 0.5);
    }
    onFirstImpact();
  } else if (e.body === makuraBody) {
    contacts.fanMakura = true;
    if (!contacts.firstHit) contacts.firstHit = 'makura';
    const iv = Math.abs(e.contact.getImpactVelocityAlongNormal());
    contacts.makuraImpact = Math.max(contacts.makuraImpact, iv);
    // 野分：強い投げが飛翔の勢いのまま枕を打ったときだけ倒れる（弱投・落下後の接触では倒れない）
    if (lastPower > 0.75 && flightT < 1.0 && contacts.firstHit !== 'floor' && !toppleFired) {
      toppleFired = true;
      const dir = new CANNON.Vec3(fanBody.velocity.x, 0, fanBody.velocity.z);
      const L = dir.length();
      if (L > 0.1) {
        dir.scale(0.45 / L, dir);
        makuraBody.applyImpulse(dir, new CANNON.Vec3(0, MAKURA.h * 0.45, 0));
      }
    }
    if (now - lastThudT > 180) { snd.thud(); lastThudT = now; }
    onFirstImpact();
  } else if (e.body === floorBody) {
    if (!contacts.firstHit) contacts.firstHit = 'floor';
    if (now - lastThudT > 300) { snd.slide(); lastThudT = now; }
    onFirstImpact();
  }
});
let bellCount = 0;
choBody.addEventListener('collide', (e) => {
  // 蝶が転がる度に鳴り続けないよう、強い衝突のみ・回数制限つき
  if (e.body !== floorBody) return;
  if (state !== 'flight' && state !== 'judge') return;
  if (bellCount >= 2) return;
  const iv = Math.abs(e.contact.getImpactVelocityAlongNormal());
  const now = performance.now();
  if (iv > 0.6 && now - lastBellT > 600) { snd.bell(); lastBellT = now; bellCount++; }
});

/* ---------- 空力（扇のふわり） ---------- */
const AERO = {
  kDragFace: 0.075, kDragEdge: 0.005,
  kLift: 0.025, kFloat: 0.75,       // kFloat: 飛翔中の見かけ重力軽減率
  kFlutter: 0.0005, kAlign: 0.0008, // kAlign: 面を上に保つ復元（滑空姿勢）
  vMax: 5, wMax: 10,                // 発散防止の上限
};
const _v = new CANNON.Vec3(), _n = new CANNON.Vec3(), _tmp = new CANNON.Vec3();
const UPV = new CANNON.Vec3(0, 1, 0);
let flightT = 0;
// 投げ方（スワイプの形）による回転成分
// 直線=無回転で長く水平 / カーブ=ヨー / 円=ロール / ジグザグ=ピッチ（後半で解放）
let stableFrac = 0.85;                       // 水平を維持する飛距離の割合（最低 0.5）
const pendingSpin = { pitch: 0, roll: 0 };   // 後半で解放される回転
let spinReleased = true;
const _euler = new CANNON.Vec3();
const _flatQ = new CANNON.Quaternion();
function clampBody(body, vMax, wMax) {
  const s = body.velocity.length();
  if (s > vMax) body.velocity.scale(vMax / s, body.velocity);
  const w = body.angularVelocity.length();
  if (w > wMax) body.angularVelocity.scale(wMax / w, body.angularVelocity);
}
function applyAero(dt) {
  clampBody(fanBody, AERO.vMax, AERO.wMax);
  clampBody(choBody, 5, 30);
  // 前半は面を水平に強制維持（ヨー回転のみ許す）。過ぎたら形に応じた回転を解放
  let stabilizing = false;
  if (state === 'flight' && !impacted) {
    if (fanBody.position.z > CFG.handPos.z * (1 - stableFrac)) {
      stabilizing = true;
      fanBody.quaternion.toEuler(_euler);
      _flatQ.setFromEuler(0, _euler.y, 0);
      fanBody.quaternion.slerp(_flatQ, 0.22, fanBody.quaternion);
      fanBody.angularVelocity.x *= 0.5;
      fanBody.angularVelocity.z *= 0.5;
    } else if (!spinReleased) {
      spinReleased = true;
      fanBody.angularVelocity.x += pendingSpin.pitch;
      fanBody.angularVelocity.z += pendingSpin.roll;
    }
  }
  const v = fanBody.velocity, s = v.length();
  if (s < 0.08) return;
  fanBody.quaternion.vmult(new CANNON.Vec3(0, 1, 0), _n);
  _v.copy(v); _v.scale(1 / s, _v);
  const cos = _n.dot(_v);
  // 抗力
  const kd = AERO.kDragEdge + AERO.kDragFace * Math.abs(cos);
  _tmp.copy(_v); _tmp.scale(-kd * s * s, _tmp);
  fanBody.applyForce(_tmp, fanBody.position);
  // 揚力（面で風を受けて滑空）：v に垂直な n 成分の向きに働く
  const liftMag = AERO.kLift * s * s * Math.abs(cos);
  _tmp.copy(_n); const vc = _v.scale(cos, new CANNON.Vec3()); _tmp.vsub(vc, _tmp);
  const L = _tmp.length();
  if (L > 0.001) {
    _tmp.scale((liftMag / L) * -Math.sign(cos), _tmp);
    fanBody.applyForce(_tmp, fanBody.position);
  }
  // 浮遊感（演出上の重力打ち消し）
  if (flightT < 1.6) {
    const f = AERO.kFloat * Math.min(1, s / 2.2);
    fanBody.applyForce(new CANNON.Vec3(0, 9.82 * fanBody.mass * f, 0), fanBody.position);
  }
  if (!stabilizing) {
    // ひらひら（フラッタ）
    const fl = Math.sin(flightT * 15 + 1.7) * AERO.kFlutter * s;
    fanBody.torque.x += fl;
    fanBody.torque.z += Math.cos(flightT * 11) * AERO.kFlutter * 0.6 * s;
    // 面を上へ戻す復元トルク：木の葉のようにゆっくり滑空する
    const sgnUp = _n.y >= 0 ? 1 : -1;
    _tmp.copy(_n); _tmp.scale(sgnUp, _tmp);
    const axis = new CANNON.Vec3(); _tmp.cross(UPV, axis);
    axis.scale(AERO.kAlign * s * s, axis);
    fanBody.torque.vadd(axis, fanBody.torque);
  }
  // 床際での過大な跳ね返り抑制
  if (fanBody.position.y < 0.06 && fanBody.velocity.y > 1.0) fanBody.velocity.y = 0.25;
}

/* 勝負どころ（衝突があり得る局面）を過ぎたら強制的に静める */
function calmSettling(dt) {
  if (!impacted && fanBody.position.z > -0.15) return;
  if (impacted) {
    // 当たった後の扇は力尽きる：全体を減衰し、手前への跳ね返りは殺す
    fanBody.velocity.scale(Math.max(0, 1 - 1.6 * dt), fanBody.velocity);
    if (fanBody.velocity.z > 0.4) fanBody.velocity.z *= 0.4;
  }
  for (const b of [fanBody, choBody]) {
    if (b.position.y < 0.14) {
      if (b.velocity.y > 0.35) b.velocity.y *= 0.45;
      b.velocity.scale(Math.max(0, 1 - 2.2 * dt), b.velocity);
      b.angularVelocity.scale(Math.max(0, 1 - 3 * dt), b.angularVelocity);
    }
  }
}

/* ---------- 粒子 ---------- */
const PN = 240;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3);
const pVel = new Float32Array(PN * 3), pLife = new Float32Array(PN);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const dotTex = makeCanvasTexture(32, 32, (c) => {
  const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 32, 32);
});
const points = new THREE.Points(pGeo, new THREE.PointsMaterial({
  size: 0.014, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false,
  blending: THREE.AdditiveBlending, map: dotTex, alphaTest: 0.01,
}));
points.frustumCulled = false;
scene.add(points);
let pHead = 0;
const _c = new THREE.Color();
function spawnBurst(pos, colorHex, n, speed) {
  _c.set(colorHex);
  for (let i = 0; i < n; i++) {
    const idx = pHead; pHead = (pHead + 1) % PN;
    pPos[idx * 3] = pos.x; pPos[idx * 3 + 1] = pos.y; pPos[idx * 3 + 2] = pos.z;
    const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI;
    const sp = speed * (0.3 + Math.random() * 0.7);
    pVel[idx * 3] = Math.sin(ph) * Math.cos(th) * sp;
    pVel[idx * 3 + 1] = Math.abs(Math.cos(ph)) * sp * 0.9 + 0.15;
    pVel[idx * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp;
    pCol[idx * 3] = _c.r; pCol[idx * 3 + 1] = _c.g; pCol[idx * 3 + 2] = _c.b;
    pLife[idx] = 0.9 + Math.random() * 0.6;
  }
  pGeo.attributes.color.needsUpdate = true;
}
function updateParticles(dt) {
  for (let i = 0; i < PN; i++) {
    if (pLife[i] <= 0) { pPos[i * 3 + 1] = -10; continue; }
    pLife[i] -= dt;
    pVel[i * 3 + 1] -= 1.6 * dt;
    pPos[i * 3] += pVel[i * 3] * dt;
    pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt;
    pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
  }
  pGeo.attributes.position.needsUpdate = true;
}

/* ---------- カメラ演出 ---------- */
const camState = {
  pos: new THREE.Vector3(0, 0.5, 1.6), look: new THREE.Vector3(0, 0.1, 0),
  up: new THREE.Vector3(0, 1, 0),
  fromPos: new THREE.Vector3(), fromLook: new THREE.Vector3(), fromUp: new THREE.Vector3(),
  toPos: new THREE.Vector3(), toLook: new THREE.Vector3(), toUp: new THREE.Vector3(),
  t: 1, dur: 1,
};
function camGoto(pos, look, dur = 0.9, up = [0, 1, 0]) {
  camState.fromPos.copy(camState.pos); camState.fromLook.copy(camState.look); camState.fromUp.copy(camState.up);
  camState.toPos.set(...pos); camState.toLook.set(...look); camState.toUp.set(...up);
  camState.t = 0; camState.dur = dur;
}
const easeInOut = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
function updateCamera(dt) {
  if (camState.t < 1) {
    camState.t = Math.min(1, camState.t + dt / camState.dur);
    const e = easeInOut(camState.t);
    camState.pos.lerpVectors(camState.fromPos, camState.toPos, e);
    camState.look.lerpVectors(camState.fromLook, camState.toLook, e);
    camState.up.lerpVectors(camState.fromUp, camState.toUp, e).normalize();
  }
  if (state === 'title') {
    const a = clock.elapsedTime * 0.12;
    camState.pos.set(Math.sin(a) * 1.15, 0.52 + Math.sin(a * 0.7) * 0.06, Math.cos(a) * 1.15 + 0.35);
    camState.look.set(0, 0.2, 0.05);
  }
  if (state === 'flight') {
    // 扇を目で追う
    camState.look.lerp(new THREE.Vector3().copy(fanBody.position), Math.min(1, dt * 6));
  }
  camera.up.copy(camState.up);
  camera.position.copy(camState.pos);
  camera.lookAt(camState.look);
}

/* ---------- 状態 ---------- */
let state = 'title';
let throwIndex = 0, totalScore = 0;
const throwResults = [];
let timeScale = CFG.baseTimeScale, timeScaleTarget = CFG.baseTimeScale;
let impacted = false, settleFrames = 0, judgeStarted = false;
const clock = new THREE.Clock();

/* 狙い */
const aim = { x: CFG.aimDefault.x, y: CFG.aimDefault.y };
let swayT = 0;
const aimWorld = new THREE.Vector3();

/* スワイプ */
const swipe = { active: false, pts: [], t0: 0 };

/* ---------- 配置リセット ---------- */
function resetBodies() {
  makuraBody.position.set(0, MAKURA.h / 2 + 0.001, 0);
  makuraBody.quaternion.set(0, 0, 0, 1);
  makuraBody.velocity.setZero(); makuraBody.angularVelocity.setZero();
  makuraBody.wakeUp();
  choBody.position.set(0, MAKURA.h + CHO_HALF_H - 0.01 + 0.0005, 0);
  choBody.quaternion.set(0, 0, 0, 1);
  choBody.velocity.setZero(); choBody.angularVelocity.setZero();
  choBody.wakeUp();
  // 構え中は扇を手元（画面下）に伏せて置く
  fanBody.position.set(0, 0.05, 1.42);
  fanBody.quaternion.setFromEuler(0.55, 0, 0);
  fanBody.velocity.setZero(); fanBody.angularVelocity.setZero();
  fanBody.type = CANNON.Body.KINEMATIC; // 投げるまで固定
  fanBody.updateMassProperties();
  contacts.fanCho = false; contacts.fanMakura = false;
  contacts.firstHit = null; contacts.makuraImpact = 0;
  impacted = false; settleFrames = 0; judgeStarted = false;
  bellCount = 0; flightT = 0; toppleFired = false;
  spinReleased = true; pendingSpin.pitch = 0; pendingSpin.roll = 0;
  timeScale = timeScaleTarget = CFG.baseTimeScale;
  // 蝶を枕の上に完全に落ち着かせてから開始（投擲直後に勝手に落ちるのを防ぐ）
  for (let i = 0; i < 40; i++) world.step(CFG.fixedDt);
  choBody.velocity.setZero(); choBody.angularVelocity.setZero();
  makuraBody.velocity.setZero(); makuraBody.angularVelocity.setZero();
}
resetBodies();

/* ---------- UI ヘルパ ---------- */
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }
function setGuide(text) {
  const g = $('phase-guide');
  if (!text) { hide(g); return; }
  g.textContent = text;
  g.style.animation = 'none'; void g.offsetWidth; g.style.animation = '';
  show(g);
}
function updateHUD() {
  $('hud-throw').textContent = lang === 'ja'
    ? toKanji(throwIndex + 1) + '投目'
    : `Throw ${throwIndex + 1} / ${CFG.throwsPerGame}`;
  $('hud-score').textContent = totalLabel(totalScore);
}

/* ---------- フェーズ遷移 ---------- */
function startGame() {
  throwIndex = 0; totalScore = 0; throwResults.length = 0;
  hide($('screen-title')); hide($('screen-result'));
  show($('hud'));
  updateHUD();
  startAim();
}
function startAim() {
  state = 'aim';
  resetBodies();
  aim.x = CFG.aimDefault.x; aim.y = CFG.aimDefault.y;
  // 蝶に寄った視点（約3倍拡大）
  camGoto([0, 0.33, 0.55], [0, 0.295, 0], 1.0);
  show(reticleEl); reticleEl.classList.remove('lock');
  setGuide(L[lang].guideAim);
  show($('btn-aim-ok'));
  clearTrail();
}
function startSwipe() {
  state = 'swipe';
  hide($('btn-aim-ok'));
  // 扇を投擲位置へ（手に取る）
  fanBody.position.set(CFG.handPos.x, CFG.handPos.y, CFG.handPos.z);
  fanBody.quaternion.setFromEuler(0.15, 0, 0);
  reticleEl.classList.add('lock');
  camGoto([0, 1.5, 0.62], [0, 0, 0.62], 0.9, [0, 0, -1]);
  setGuide(L[lang].guideSwipe);
  snd.ready();
  setTimeout(() => { if (state === 'swipe') hide(reticleEl); }, 900);
}
function launchFan(power, azimuth, form = 'straight', g = {}) {
  state = 'flight';
  setGuide(null);
  hide(reticleEl);
  snd.whoosh();
  fanBody.type = CANNON.Body.DYNAMIC;
  fanBody.updateMassProperties();
  fanBody.wakeUp();
  // 発射方向：手元 → 狙い点（スワイプ左右で補正）
  const target = new THREE.Vector3(
    THREE.MathUtils.clamp(aimWorld.x + azimuth * 0.3, -0.45, 0.45),
    aimWorld.y, 0);
  const dir = target.clone().sub(CFG.handPos).normalize();
  // 山なりに：上向き成分を加える（強投は弾道が寝て、枕を直撃しやすくなる）
  const flatten = Math.max(0, power - 0.8) * 1.2;
  dir.y += (CFG.launchUpBias + (aimWorld.y - 0.28) * 0.4) * (1 - flatten);
  dir.normalize();
  const speed = CFG.speedMin + (CFG.speedMax - CFG.speedMin) * power;
  lastPower = power;
  fanBody.velocity.set(dir.x * speed, dir.y * speed, dir.z * speed);
  // スワイプの形 → 回転成分
  // 直線：無回転のまま長く水平 / カーブ：ヨー / 円：ロール / ジグザグ：ピッチ
  stableFrac = 0.5;
  pendingSpin.pitch = 0; pendingSpin.roll = 0;
  spinReleased = false;
  let yawSpin = 0;
  if (form === 'straight') {
    stableFrac = 0.85;
    spinReleased = true;
  } else if (form === 'curve') {
    yawSpin = THREE.MathUtils.clamp((g.maxDev / g.chord) * 3, -1, 1) * 7;
    spinReleased = true;
  } else if (form === 'circle') {
    pendingSpin.roll = Math.sign(g.turnSum || 1) * 9;
  } else if (form === 'zigzag') {
    pendingSpin.pitch = 6 * (g.firstDevSign || 1);
  }
  fanBody.angularVelocity.set(0, yawSpin, 0);
  camGoto([0.52, 0.42, 1.05], [0, 0.25, 0.3], 0.8);
  flightT = 0;
}
function onFirstImpact() {
  if (impacted) return;
  impacted = true;
  timeScaleTarget = CFG.baseTimeScale;
}

/* ---------- 判定 ---------- */
const _q = new CANNON.Vec3();
function upY(body) { body.quaternion.vmult(new CANNON.Vec3(0, 1, 0), _q); return _q.y; }
function horizDist(a, b) { const dx = a.x - b.x, dz = a.z - b.z; return Math.hypot(dx, dz); }
function judge() {
  const mk = makuraBody.position, ch = choBody.position, fn = fanBody.position;
  const mkTop = mk.y + MAKURA.h / 2;
  const makuraDown = upY(makuraBody) < 0.55;
  const choUp = upY(choBody) > 0.72;
  const choOnMakura = !makuraDown && horizDist(ch, mk) < 0.105 && ch.y > mkTop - 0.03;
  const fanTilt = upY(fanBody);
  const fanNearMakura = horizDist(fn, mk) < 0.20;
  // 「枕に乗る」＝ほぼ水平のまま枕の上に掛かって留まる（実物の澪標も多くは扇が枕から張り出す）
  const fanOnMakura = !makuraDown && contacts.fanMakura && fanTilt > 0.8 &&
    fn.y > MAKURA.h - 0.05 && horizDist(fn, mk) < 0.17;
  const fanLeaning = !fanOnMakura && contacts.fanMakura && fanNearMakura &&
    fanTilt > 0.25 && fanTilt <= 0.8 && fn.y > 0.02;
  const choOnFan = ch.y > fn.y + 0.002 && horizDist(ch, fn) < 0.11 && ch.y < fn.y + 0.09;
  const fanTouchCho = horizDist(fn, ch) < 0.13 && Math.abs(fn.y - ch.y) < 0.08;
  const choHanging = !choOnMakura && horizDist(ch, mk) < 0.115 && ch.y > 0.058 && ch.y < mkTop + 0.02;
  const bridge = !fanOnMakura && fanNearMakura && contacts.fanMakura && fanTouchCho && fn.y > 0.045;

  let id;
  if (makuraDown) id = 'nowaki';
  else if (choOnMakura) {
    if (choUp) {
      if (fanOnMakura) id = 'kobai';
      else if (fanLeaning) id = 'sekiya';
      else if (contacts.fanMakura) id = 'kotsuri';
      else id = 'tenarai';
    } else id = 'matsukaze';
  } else {
    if (bridge && choUp) id = 'yumeukihashi';
    else if (fanOnMakura) id = choUp ? 'kiritsubo' : 'mio';
    else if (choOnFan) id = choUp ? 'ukifune' : 'yugao';
    else if (choHanging) id = 'hananoen';
    else if (choUp) id = 'akashi';
    else if (fanLeaning) id = 'suma';
    else id = 'hanachirusato';
  }
  const mei = MEI[id];
  const pts = mei.pts;
  if (DEBUG) console.log('JUDGE', JSON.stringify({
    id, pts, choUp, choOnMakura, fanOnMakura, fanLeaning, choOnFan,
    fan: [fn.x, fn.y, fn.z].map(v => +v.toFixed(3)),
    cho: [ch.x, ch.y, ch.z].map(v => +v.toFixed(3)),
    contacts: { ...contacts },
  }));
  return { id, mei, pts };
}

function finishThrow() {
  if (judgeStarted) return;
  judgeStarted = true;
  state = 'judge';
  const res = judge();
  res.snap = [makuraBody, choBody, fanBody].map(b => ({ p: b.position.clone(), q: b.quaternion.clone() })); // 伝える画面用
  throwResults.push(res);
  totalScore += res.pts;
  camGoto([0.40, 0.34, 0.66], [0, 0.16, 0], 1.1);
  // 演出
  setTimeout(() => {
    snd.score(res.pts);
    if (res.pts >= 30) {
      $('flash').classList.add('on');
      setTimeout(() => $('flash').classList.remove('on'), 550);
      spawnBurst(new CANNON.Vec3(0, 0.25, 0.1), 0xeecf7d, 60, 1.1);
      spawnBurst(new CANNON.Vec3(0, 0.3, 0.2), 0xf5c2c8, 40, 0.8);
    } else if (res.pts >= 8) {
      spawnBurst(new CANNON.Vec3(0, 0.2, 0.05), 0xeecf7d, 24, 0.7);
    }
    showMeiCard(res);
  }, 750);
}

let cardTimer = null;
function showMeiCard(res) {
  state = 'card';
  $('mei-name').textContent = res.mei.name;
  $('mei-yomi').textContent = lang === 'ja' ? res.mei.yomi : res.mei.romaji;
  $('mei-desc').textContent = meiDesc(res.id); // 銘定表と同じ説明を表示

  const p = $('mei-points');
  p.textContent = ptsLabel(res.pts);
  p.className = res.pts > 0 ? 'plus' : (res.pts === 0 ? 'zero' : 'minus');
  $('btn-card-share').classList.toggle('hidden', res.pts < SHARE_MIN_PTS);
  show($('mei-card'));
  updateHUD();
  cardTimer = setTimeout(nextThrow, (DEBUG && window.dbgHoldCard) ? 60000 : (res.pts >= SHARE_MIN_PTS ? 6000 : 3000));
}
function nextThrow() {
  if (cardTimer) { clearTimeout(cardTimer); cardTimer = null; }
  hide($('mei-card')); hide($('btn-card-share'));
  throwIndex++;
  if (throwIndex >= CFG.throwsPerGame) showResult();
  else { updateHUD(); startAim(); }
}

/* ---------- 銘の見本（銘定表の行をタップすると実際の座敷で再現） ---------- */
// p: body 原点の位置[m]、r: [x, y, z] 回転（YXZ 順＝先に倒して、後から向きを回す）
// 蝶: 枕上に立つ y=0.3075 / 床に立つ y=0.0375 / 倒れ y≈0.02（r.x=-H 仰向け。伏せ(+H)は朱が隠れて分かりにくいので使わない）
// 扇: 床に伏す y=0.012 / 枕上 y=0.282 / r.x>0 で外周側（-Z）が持ち上がる
const H = Math.PI / 2;
const CHO_ON_MAKURA = { p: [0, 0.3075, 0], r: [0, 0, 0] };
const FAN_LEAN = { p: [0, 0.10, 0.09], r: [1.0, 0.15, 0] };       // 枕の前面にもたれる
const FAN_ON_MAKURA = { p: [0, 0.29, 0.03], r: [0.35, 0.3, 0] };       // 少し傾けて面を見せる
const MEI_POSE = {
  // 扇の幅で、枕の上端から床に立つ蝶の頭へ斜めに架かる（高低差0.175÷幅0.30 → 約36°）
  yumeukihashi: { cho: { p: [0.27, 0.0375, 0.02], r: [0, -0.25, 0] }, fan: { p: [0.152, 0.19, 0.0], r: [0, 0, -0.62] } },
  kiritsubo:    { cho: { p: [0.13, 0.0375, 0.06], r: [0, -0.4, 0] }, fan: FAN_ON_MAKURA },
  mio:          { cho: { p: [0.11, 0.02, 0.12], r: [-H, 0.5, 0] }, fan: FAN_ON_MAKURA },
  ukifune:      { cho: { p: [0.03, 0.0615, 0.19], r: [0, 0.3, 0] }, fan: { p: [0.02, 0.012, 0.20], r: [0, 0.4, 0] } },
  akashi:       { cho: { p: [0.12, 0.0375, 0.06], r: [0, -0.3, 0] }, fan: { p: [-0.12, 0.012, 0.22], r: [0, 0.8, 0] } },
  kobai:        { cho: CHO_ON_MAKURA, fan: { p: [0, 0.29, 0.10], r: [0.25, 0.1, 0] } },
  // 台座は枕の上に残り、蝶は縁から頭を垂れて引っ掛かる
  hananoen:     { cho: { p: [0.054, 0.262, 0.0], r: [0, 0, -2.3] }, fan: { p: [-0.10, 0.012, 0.24], r: [0, -0.6, 0] } },
  suma:         { cho: { p: [0.13, 0.02, -0.04], r: [-H, 0.3, 0] }, fan: FAN_LEAN },
  yugao:        { cho: { p: [0.04, 0.044, 0.17], r: [-H, 0.6, 0] }, fan: { p: [0.05, 0.012, 0.18], r: [0, 0.2, 0] } },
  matsukaze:    { cho: { p: [0, 0.29, 0], r: [-H, 0.4, 0] }, fan: { p: [-0.12, 0.012, 0.24], r: [0, -0.5, 0] } },
  hanachirusato:{ cho: { p: [0.12, 0.02, 0.02], r: [-H, 0.7, 0] }, fan: { p: [-0.19, 0.012, 0.06], r: [0, -1.0, 0] } },
  sekiya:       { cho: CHO_ON_MAKURA, fan: FAN_LEAN },
  tenarai:      { cho: CHO_ON_MAKURA, fan: { p: [-0.20, 0.012, -0.04], r: [0, -0.5, 0] } },
  kotsuri:      { cho: CHO_ON_MAKURA, fan: { p: [0.03, 0.012, 0.17], r: [0, 0.25, 0] } },
  nowaki:       { makura: { p: [0, 0.045, -0.10], r: [-H, 0, 0] },
                  cho: { p: [0.12, 0.02, -0.26], r: [-H, 0.9, 0] }, fan: { p: [-0.05, 0.012, 0.16], r: [0, -0.3, 0] } },
};
// finishThrow と同じ向き（[0.40,0.34,0.66]→[0,0.16,0]）から少し引いて、縦長画面でも札の上に全体が収まるようにする
const MEI_VIEW = { pos: [0.70, 0.42, 1.16], look: [0, 0.10, 0] };
const MAKURA_STAND = { p: [0, MAKURA.h / 2 + 0.001, 0], r: [0, 0, 0] };
const poseEuler = new THREE.Euler(0, 0, 0, 'YXZ'), poseQuat = new THREE.Quaternion();
function placeBody(body, pose) {
  body.position.set(...pose.p);
  poseQuat.setFromEuler(poseEuler.set(pose.r[0], pose.r[1], pose.r[2], 'YXZ'));
  body.quaternion.set(poseQuat.x, poseQuat.y, poseQuat.z, poseQuat.w);
  body.velocity.setZero(); body.angularVelocity.setZero();
}
function applyMeiPose(id) {
  const P = MEI_POSE[id];
  placeBody(makuraBody, P.makura || MAKURA_STAND);
  placeBody(choBody, P.cho);
  placeBody(fanBody, P.fan);
}
let poseSaved = null;
const POSE_HIDE = ['screen-title', 'screen-result', 'hud', 'btn-aim-ok', 'reticle', 'phase-guide', 'modal-scores', 'modal-menu', 'mei-card'];
const SHARE_MIN_PTS = 30;                                             // これ以上の銘は投擲中のカードからも伝えられる
const SHARE_VIEW = { pos: [0.70, 0.50, 1.16], look: [0, 0.19, 0] };  // 上に文字を載せるので物を画面下寄りに
let shareCtx = null;
function showMeiPose(id, share = null) {
  if (cardTimer) { clearTimeout(cardTimer); cardTimer = null; }
  if (!poseSaved) {
    poseSaved = {
      state,
      bodies: [makuraBody, choBody, fanBody].map(b => ({ b, p: b.position.clone(), q: b.quaternion.clone() })),
      cam: { pos: camState.pos.clone(), look: camState.look.clone(), up: camState.up.clone() },
      shown: POSE_HIDE.filter(k => !$(k).classList.contains('hidden')),
    };
  }
  state = 'pose';
  POSE_HIDE.forEach(k => hide($(k)));
  if (share) { openShareView(share); return; }
  applyMeiPose(id);
  camGoto(MEI_VIEW.pos, MEI_VIEW.look, 0.8);
  const m = MEI[id];
  $('mei-name').textContent = m.name;
  $('mei-yomi').textContent = lang === 'ja' ? m.yomi : m.romaji;
  $('mei-desc').textContent = meiDesc(id);
  const p = $('mei-points');
  p.textContent = ptsLabel(m.pts);
  p.className = m.pts > 0 ? 'plus' : (m.pts === 0 ? 'zero' : 'minus');
  $('mei-card').classList.add('pose');
  $('mei-card').dataset.hint = lang === 'ja' ? 'タップで銘定表へ戻る' : 'Tap to return';
  show($('mei-card'));
}
function openShareView(sh) {
  shareCtx = sh;
  const r = sh.res, m = r.mei;
  [makuraBody, choBody, fanBody].forEach((b, i) => {
    b.position.copy(r.snap[i].p); b.quaternion.copy(r.snap[i].q);
    b.velocity.setZero(); b.angularVelocity.setZero();
  });
  // 3つの物の中心を見て、散らばり具合に応じて引く（蝶が枕の陰に隠れないように）
  const cx = r.snap.reduce((a, o) => a + o.p.x, 0) / 3, cz = r.snap.reduce((a, o) => a + o.p.z, 0) / 3;
  const spread = Math.max(...r.snap.map(o => Math.hypot(o.p.x - cx, o.p.z - cz)));
  const k = Math.max(1, spread / 0.22);
  const off = SHARE_VIEW.pos.map((v, i) => (v - SHARE_VIEW.look[i]) * k);
  // 枕→蝶の向きと視線がほぼ重なる（蝶が枕の真後ろ）ときは、横から見る向きへ回す
  const mk = r.snap[0].p, ch = r.snap[1].p;
  const dx = ch.x - mk.x, dz = ch.z - mk.z, dl = Math.hypot(dx, dz);
  let hx = off[0], hz = off[2];
  const hl = Math.hypot(hx, hz);
  if (dl > 0.05 && Math.abs((dx * hx + dz * hz) / (dl * hl)) > 0.6) {
    let px = -dz / dl, pz = dx / dl;                 // 枕→蝶に直交する向き
    if (px * hx + pz * hz < 0) { px = -px; pz = -pz; } // 既定の視点に近い側を選ぶ
    // 真横まで回すと金屏風が外れて背景が暗くなるので、既定の向きと半々に混ぜる（約45°）
    const mx = px + hx / hl, mz = pz + hz / hl, ml = Math.hypot(mx, mz);
    hx = mx / ml * hl; hz = mz / ml * hl;
  }
  camGoto([cx + hx, SHARE_VIEW.look[1] + off[1], cz + hz], [cx, SHARE_VIEW.look[1], cz], 0.9);
  $('sv-mei').textContent = m.name;
  $('sv-yomi').textContent = lang === 'ja' ? m.yomi : m.romaji;
  $('sv-desc').textContent = meiDesc(r.id);
  const p = $('sv-pts');
  p.textContent = ptsLabel(r.pts);
  p.className = r.pts > 0 ? 'plus' : (r.pts === 0 ? 'zero' : 'minus');
  $('sv-total').textContent = sh.line;
  const sv = $('share-view');
  sv.classList.toggle('rare', r.pts >= SHARE_MIN_PTS);
  sv.style.animation = 'none'; void sv.offsetWidth; sv.style.animation = '';
  show(sv);
  shareFile = null;
  setTimeout(() => { if (shareCtx === sh) prepareShareImage(); }, 1150);
  // 派手に：金の閃光と紙吹雪
  setTimeout(() => {
    if (state !== 'pose') return;
    snd.score(r.pts);
    if (r.pts > 0) {
      $('flash').classList.add('on');
      setTimeout(() => $('flash').classList.remove('on'), 550);
      spawnBurst(new CANNON.Vec3(0, 0.3, 0.05), 0xeecf7d, r.pts >= SHARE_MIN_PTS ? 90 : 30, 1.1);
      if (r.pts >= SHARE_MIN_PTS) spawnBurst(new CANNON.Vec3(0, 0.35, 0.15), 0xf5c2c8, 60, 0.9);
    }
  }, 700);
}
function endMeiPose() {
  if (!poseSaved) return;
  const s = poseSaved; poseSaved = null;
  shareCtx = null; hide($('share-view'));
  hide($('mei-card')); $('mei-card').classList.remove('pose');
  s.bodies.forEach(({ b, p, q }) => { b.position.copy(p); b.quaternion.copy(q); b.velocity.setZero(); b.angularVelocity.setZero(); });
  state = s.state;
  camGoto(s.cam.pos.toArray(), s.cam.look.toArray(), 0.6, s.cam.up.toArray());
  s.shown.forEach(k => show($(k)));
  if (state === 'card') cardTimer = setTimeout(nextThrow, 4000);  // カードに戻ったら改めて待つ
}
$('mei-card').addEventListener('click', () => { if (state === 'pose') { snd.tap(); endMeiPose(); } });

/* ---------- 結果 ---------- */
// 五投勝負の番付
const RANKS = [
  { min: 150, name: '扇聖',   comment: '扇はもはや、あなたの指の続きです。', en: 'The fan is now an extension of your fingers.' },
  { min: 100, name: '達人',   comment: '座敷が静まり返る見事な手並みでした。', en: 'A masterful hand that silences the room.' },
  { min: 60,  name: '粋人',   comment: '扇の行方に、遊び心が宿っています。', en: 'There is playfulness in your fan’s flight.' },
  { min: 30,  name: '風雅',   comment: '扇がふわりと、良い風に乗りはじめました。', en: 'Your fan is starting to catch a good wind.' },
  { min: 10,  name: '入門',   comment: '扇が手に馴染んできました。次の一投へ。', en: 'The fan begins to sit well in your hand.' },
  { min: 0,   name: '手習の身', comment: '焦らず、ふわりと。それがすべての基本です。', en: 'Gently does it — that is the whole secret.' },
  { min: -999, name: '野分の後', comment: '風が強すぎました。座敷を整えて、もう一度。', en: 'The wind blew too hard. Set the room straight and try again.' },
];
function showResult() {
  state = 'result';
  hide($('hud'));
  const rank = RANKS.find(r => totalScore >= r.min);
  $('result-total').textContent = totalLabel(totalScore);
  $('result-rank').textContent = '「' + rank.name + '」';
  $('result-comment').textContent = lang === 'ja' ? rank.comment : rank.en;
  const best = Number(localStorage.getItem('tosenkyo_best') || '-9999');
  const isNew = totalScore > best;
  if (isNew) localStorage.setItem('tosenkyo_best', String(totalScore));
  const bestEl = $('result-best');
  bestEl.textContent = L[lang].bestLabel + totalLabel(Math.max(best, totalScore));
  bestEl.classList.toggle('new', isNew);
  const list = $('result-list');
  list.innerHTML = '';
  throwResults.forEach((r, i) => {
    const li = document.createElement('li');
    const no = lang === 'ja' ? `${toKanji(i + 1)}投` : `#${i + 1}`;
    li.innerHTML = `<span>${no}</span><b>${r.mei.name}</b>` +
      `<span class="pt${r.pts < 0 ? ' minus' : ''}">${ptsLabel(r.pts)}</span>`;
    list.appendChild(li);
  });
  // 上の項目から順に出す。関連商品は最後に間を置いて出し、出るまでは押せない（うっかり押し防止）
  const sr = $('screen-result');
  [...sr.children].forEach((el, i) => {
    const d = el.id === 'related' ? 6.5 : el.id === 'ad-slot' ? 7.0 : i * 0.55;
    el.style.setProperty('--d', d + 's');
  });
  sr.classList.remove('reveal'); void sr.offsetWidth; sr.classList.add('reveal');
  show(sr);
  camGoto([0.7, 0.55, 1.2], [0, 0.2, 0], 1.4);
}

/* ---------- 入力 ---------- */
let dragActive = false, lastPX = 0, lastPY = 0;
const aimRay = new THREE.Raycaster(), aimPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), aimHit = new THREE.Vector3();
inputLayer.addEventListener('pointerdown', (e) => {
  audio();
  if (state === 'aim') {
    dragActive = true; lastPX = e.clientX; lastPY = e.clientY;
    // 触れた場所へ照準を移す（その後のドラッグは微調整）
    aimRay.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
    if (aimRay.ray.intersectPlane(aimPlane, aimHit)) {
      aim.x = THREE.MathUtils.clamp(aimHit.x, -CFG.aimRange.x, CFG.aimRange.x);
      aim.y = THREE.MathUtils.clamp(aimHit.y, CFG.aimRange.yMin, CFG.aimRange.yMax);
    }
  } else if (state === 'swipe') {
    swipe.active = true;
    swipe.pts = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    swipe.t0 = performance.now();
  } else if (state === 'card') {
    nextThrow();
  }
});
inputLayer.addEventListener('pointermove', (e) => {
  if (state === 'aim' && dragActive) {
    const k = 0.0006; // 拡大視点に合わせて感度を下げる
    aim.x = THREE.MathUtils.clamp(aim.x + (e.clientX - lastPX) * k, -CFG.aimRange.x, CFG.aimRange.x);
    aim.y = THREE.MathUtils.clamp(aim.y - (e.clientY - lastPY) * k, CFG.aimRange.yMin, CFG.aimRange.yMax);
    lastPX = e.clientX; lastPY = e.clientY;
  } else if (state === 'swipe' && swipe.active) {
    swipe.pts.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    drawTrail();
  }
});
inputLayer.addEventListener('pointerup', () => {
  if (state === 'aim') dragActive = false;
  else if (state === 'swipe' && swipe.active) {
    swipe.active = false;
    evaluateSwipe();
  }
});
inputLayer.addEventListener('pointercancel', () => { dragActive = false; swipe.active = false; clearTrail(); });
// 短冊はタップで次の一投へ（短冊が入力レイヤーを覆うため個別に受ける）
$('mei-card').addEventListener('pointerdown', () => { if (state === 'card') nextThrow(); });

function evaluateSwipe() {
  const pts = swipe.pts;
  clearTrail();
  if (pts.length < 4) return;
  const p0 = pts[0], p1 = pts[pts.length - 1];
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const chord = Math.hypot(dx, dy);
  if (chord < 50 || dy > -30) return; // 上向きスワイプのみ
  // 形の特徴抽出：経路長・総回転角・弦からの膨らみとその符号反転
  let pathLen = 0, turnSum = 0, prevAng = null;
  let maxDev = 0, devSignChanges = 0, prevSign = 0, firstDevSign = 0;
  const nx = -dy / chord, ny = dx / chord;
  for (let i = 1; i < pts.length; i++) {
    const sdx = pts[i].x - pts[i - 1].x, sdy = pts[i].y - pts[i - 1].y;
    const sl = Math.hypot(sdx, sdy);
    pathLen += sl;
    if (sl > 2) {
      const a = Math.atan2(sdy, sdx);
      if (prevAng !== null) {
        let d = a - prevAng;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        turnSum += d;
      }
      prevAng = a;
    }
    const dev = (pts[i].x - p0.x) * nx + (pts[i].y - p0.y) * ny;
    if (Math.abs(dev) > Math.abs(maxDev)) maxDev = dev;
    const sg = dev > 8 ? 1 : (dev < -8 ? -1 : 0);
    if (sg !== 0) {
      if (firstDevSign === 0) firstDevSign = sg;
      if (prevSign !== 0 && sg !== prevSign) devSignChanges++;
      prevSign = sg;
    }
  }
  const ratio = pathLen / chord;
  let form = 'straight';
  if (Math.abs(turnSum) > 4.2 && ratio > 1.5) form = 'circle';
  else if (devSignChanges >= 2) form = 'zigzag';
  else if (Math.abs(maxDev / chord) > 0.16) form = 'curve';
  if (DEBUG) console.log('SWIPE', JSON.stringify({ form, chord: +chord.toFixed(0), pathLen: +pathLen.toFixed(0), turnSum: +turnSum.toFixed(2), maxDev: +maxDev.toFixed(0), devSignChanges }));
  // 強さ：距離と速さ
  const dur = Math.max(60, p1.t - p0.t);
  const speedPx = chord / dur; // px/ms
  const hRef = Math.min(innerHeight, 800);
  const power = THREE.MathUtils.clamp(0.55 * (chord / (hRef * 0.55)) + 0.6 * (speedPx / 1.6), 0.08, 1);
  // 方向（左右）
  const azimuth = THREE.MathUtils.clamp(dx / chord, -0.8, 0.8);
  launchFan(power, azimuth, form, { maxDev, chord, turnSum, firstDevSign });
}

/* スワイプ軌跡 */
function drawTrail() {
  const c = trailCtx;
  c.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
  const pts = swipe.pts;
  if (pts.length < 2) return;
  c.lineCap = 'round'; c.lineJoin = 'round';
  const dpr = devicePixelRatio || 1;
  for (let i = 1; i < pts.length; i++) {
    const a = i / pts.length;
    c.strokeStyle = `rgba(238,207,125,${a * 0.85})`;
    c.lineWidth = (2 + a * 7) * dpr;
    c.beginPath();
    c.moveTo(pts[i - 1].x * dpr, pts[i - 1].y * dpr);
    c.lineTo(pts[i].x * dpr, pts[i].y * dpr);
    c.stroke();
  }
}
function clearTrail() { trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height); }

/* ---------- ボタン ---------- */
$('btn-start').addEventListener('click', () => { snd.tap(); startGame(); });
$('btn-aim-ok').addEventListener('click', () => { snd.tap(); startSwipe(); });
$('btn-retry').addEventListener('click', () => { snd.tap(); startGame(); });
$('btn-to-title').addEventListener('click', () => { snd.tap(); hide($('screen-result')); resetBodies(); show($('screen-title')); state = 'title'; });
$('btn-scores').addEventListener('click', () => { snd.tap(); show($('modal-scores')); });
$('btn-tips').addEventListener('click', () => { snd.tap(); show($('modal-tips')); });
$('btn-menu').addEventListener('click', () => { snd.tap(); show($('modal-menu')); });
// 小休止から開いたときはメニューを畳み、閉じたら小休止へ戻す（以前はメニューの裏に開いて操作できなかった）
let fromMenu = false;
$('btn-menu-scores').addEventListener('click', () => { snd.tap(); fromMenu = true; hide($('modal-menu')); show($('modal-scores')); });
$('btn-menu-tips').addEventListener('click', () => { snd.tap(); fromMenu = true; hide($('modal-menu')); show($('modal-tips')); });
$('btn-menu-sound').addEventListener('click', (e) => {
  muted = !muted;
  e.target.textContent = muted ? L[lang].soundOff : L[lang].soundOn;
  if (!muted) snd.tap();
});
$('btn-menu-quit').addEventListener('click', () => {
  hide($('modal-menu')); hide($('hud')); hide(reticleEl); hide($('btn-aim-ok'));
  hide($('mei-card')); setGuide(null); clearTrail();
  resetBodies(); state = 'title'; show($('screen-title'));
});
document.querySelectorAll('.btn-close').forEach(b =>
  b.addEventListener('click', (e) => {
    snd.tap();
    const m = e.target.closest('.modal');
    m.classList.add('hidden');
    if (fromMenu && m.id !== 'modal-menu') { fromMenu = false; show($('modal-menu')); }
  }));
// 結果を伝える：五投のうち最高の銘（同点なら後の投）の形を見せる
$('btn-share').addEventListener('click', () => {
  snd.tap();
  let best = throwResults[0];
  throwResults.forEach(r => { if (r.pts >= best.pts) best = r; });
  if (!best) return;
  const rank = RANKS.find(r => totalScore >= r.min);
  const line = lang === 'ja'
    ? `五投 計${totalLabel(totalScore)}「${rank.name}」`
    : `5 throws · ${totalLabel(totalScore)} · “${rank.name}”`;
  showMeiPose(best.id, { res: best, line, total: true });
});
$('btn-card-share').addEventListener('pointerdown', (e) => e.stopPropagation()); // カードのタップ送りに奪われないように
$('btn-card-share').addEventListener('click', (e) => {
  e.stopPropagation();
  if (state !== 'card') return;
  snd.tap();
  const r = throwResults[throwResults.length - 1];
  const line = lang === 'ja' ? `${toKanji(throwResults.length)}投目` : `Throw ${throwResults.length}`;
  showMeiPose(r.id, { res: r, line, total: false });
});
$('btn-sv-back').addEventListener('click', () => { snd.tap(); endMeiPose(); });
function shareText() {
  const r = shareCtx.res, rank = RANKS.find(x => totalScore >= x.min);
  const head = lang === 'ja'
    ? `フィジカル投扇興で「${r.mei.name}」${ptsLabel(r.pts)}！`
    : `“${r.mei.name}” for ${ptsLabel(r.pts)} in Physical Tosenkyo!`;
  const tail = shareCtx.total
    ? (lang === 'ja' ? `\n五投 計${totalLabel(totalScore)}「${rank.name}」` : `\n5 throws: ${totalLabel(totalScore)} “${rank.name}”`)
    : '';
  return head + tail + '\n#フィジカル投扇興';
}
const shareUrl = () => location.origin + location.pathname.replace(/index\.html$/, '');

// 伝える画面をそのまま1枚の画像にする（3D は描いた直後に読み取り、文字とロゴは画面上の位置に描き重ねる）
function buildShareImage() {
  renderer.render(scene, camera);
  const W = glCanvas.width, Hh = glCanvas.height, k = W / innerWidth;
  const c = document.createElement('canvas');
  c.width = W; c.height = Hh;
  const g = c.getContext('2d');
  g.drawImage(glCanvas, 0, 0);
  // 上下の暗がり（CSS と同じ）
  let gr = g.createLinearGradient(0, 0, 0, Hh * 0.48);
  gr.addColorStop(0, 'rgba(14,9,11,.82)'); gr.addColorStop(0.71, 'rgba(14,9,11,.35)'); gr.addColorStop(1, 'rgba(14,9,11,0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, Hh * 0.48);
  gr = g.createLinearGradient(0, Hh, 0, Hh * 0.74);
  gr.addColorStop(0, 'rgba(14,9,11,.8)'); gr.addColorStop(1, 'rgba(14,9,11,0)');
  g.fillStyle = gr; g.fillRect(0, Hh * 0.74, W, Hh * 0.26);
  // 枠
  const rare = $('share-view').classList.contains('rare');
  g.strokeStyle = rare ? '#eecf7d' : 'rgba(238,207,125,.55)';
  g.lineWidth = (rare ? 2 : 1) * k;
  g.strokeRect(10 * k, 10 * k, W - 20 * k, Hh - 20 * k);
  // 文字
  for (const id of ['sv-total', 'sv-desc', 'sv-pts', 'sv-yomi', 'sv-mei']) {
    const el = $(id);
    if (!el.textContent || el.offsetParent === null) continue;
    const rc = el.getBoundingClientRect(), cs = getComputedStyle(el);
    g.font = `${cs.fontWeight} ${parseFloat(cs.fontSize) * k}px ${cs.fontFamily}`;
    if ('letterSpacing' in g) g.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : (parseFloat(cs.letterSpacing) * k) + 'px';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const x = (rc.left + rc.width / 2) * k, y = (rc.top + rc.height / 2) * k;
    g.shadowColor = 'rgba(0,0,0,.85)'; g.shadowBlur = 8 * k; g.shadowOffsetY = 2 * k;
    if (id === 'sv-mei' && rare) {
      const lg = g.createLinearGradient(0, rc.top * k, 0, rc.bottom * k);
      lg.addColorStop(0.05, '#fffdf2'); lg.addColorStop(0.4, '#ffeeb5'); lg.addColorStop(0.7, '#f3d68a'); lg.addColorStop(1, '#e2bd66');
      g.fillStyle = lg;
    } else g.fillStyle = cs.color;
    g.fillText(el.textContent, x, y);
  }
  const t = document.querySelector('.sv-title');
  {
    const rc = t.getBoundingClientRect(), cs = getComputedStyle(t);
    g.font = `${parseFloat(cs.fontSize) * k}px ${cs.fontFamily}`;
    if ('letterSpacing' in g) g.letterSpacing = (parseFloat(cs.letterSpacing) * k) + 'px';
    g.fillStyle = cs.color; g.fillText(t.textContent, (rc.left + rc.width / 2) * k, (rc.top + rc.height / 2) * k);
  }
  g.shadowColor = 'transparent';
  const logo = document.querySelector('.sv-brand');
  if (logo.complete) { const rc = logo.getBoundingClientRect(); g.drawImage(logo, rc.left * k, rc.top * k, rc.width * k, rc.height * k); }
  // 画面に出していない URL を下端に小さく
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  g.font = `${11 * k}px "Shippori Mincho B1", serif`;
  g.fillStyle = 'rgba(205,191,164,.8)';
  g.fillText(location.host + location.pathname.replace(/index\.html$/, '').replace(/\/$/, ''), W / 2, Hh - 22 * k);
  return new Promise(res => c.toBlob(b => res(b), 'image/png'));
}
let shareFile = null;
async function prepareShareImage() {
  shareFile = null;
  try {
    const blob = await buildShareImage();
    if (blob && shareCtx) shareFile = new File([blob], `tosenkyo_${shareCtx.res.id}.png`, { type: 'image/png' });
  } catch (e) { console.warn('[share] 画像の作成に失敗', e); }
}
// 画像付きで共有：スマホの共有シートに画像を渡す。渡せない環境では画像を保存してもらう
$('btn-sv-share').addEventListener('click', async () => {
  if (!shareCtx) return;
  snd.tap();
  if (!shareFile) await prepareShareImage();
  if (!shareFile) return;
  const text = shareText() + '\n' + shareUrl();
  try {
    if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
      await navigator.share({ files: [shareFile], text });
      return;
    }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(shareFile); a.download = shareFile.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
});
// Xでポスト：文と URL だけ（画像は付かない）
$('btn-sv-post').addEventListener('click', () => {
  if (!shareCtx) return;
  snd.tap();
  window.open('https://x.com/intent/post?text=' + encodeURIComponent(shareText()) + '&url=' + encodeURIComponent(shareUrl()), '_blank', 'noopener');
});

/* ---------- 銘定表 ---------- */
const MEI_IMG_VER = 2; // mei/*.jpg を撮り直したら上げる
function buildMeiTable() {
  const tbl = $('mei-table');
  tbl.innerHTML = '';
  for (const id of MEI_ORDER) {
    const m = MEI[id];
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="t"><img src="mei/${id}.jpg?v=${MEI_IMG_VER}" alt="" loading="lazy" decoding="async"></td>` +
      `<td class="n">${m.name}<small>${lang === 'ja' ? m.yomi : m.romaji}</small><span class="d">${meiDesc(id)}</span></td>` +
      `<td class="p${m.pts < 0 ? ' minus' : ''}">${ptsLabel(m.pts)}</td>`;
    tr.addEventListener('click', () => {
      if (state === 'flight' || state === 'judge' || state === 'card') return; // 投擲中は開かない
      snd.tap(); showMeiPose(id);
    });
    tbl.appendChild(tr);
  }
}

/* ---------- 言語適用 ---------- */
function applyLang() {
  const T = L[lang];
  document.documentElement.lang = lang;
  document.documentElement.classList.toggle('en', lang === 'en');
  $('btn-start').textContent = T.btnPlay;
  $('btn-scores').textContent = T.btnScores;
  $('btn-tips').textContent = T.btnTips;
  $('btn-aim-ok').textContent = T.btnAimOk;
  $('btn-retry').textContent = T.btnRetry;
  $('btn-share').textContent = T.btnShare;
  $('btn-to-title').textContent = T.btnToTitle;
  $('btn-menu-scores').textContent = T.btnScores;
  $('btn-menu-tips').textContent = T.btnTips;
  $('btn-menu-quit').textContent = T.btnMenuQuit;
  $('btn-menu-sound').textContent = muted ? T.soundOff : T.soundOn;
  $('btn-lang').textContent = T.langBtn;
  document.querySelector('#modal-scores h2').textContent = T.scoresTitle;
  document.querySelector('#modal-tips h2').textContent = T.tipsTitle;
  document.querySelector('#modal-menu h2').textContent = T.menuTitle;
  const notes = document.querySelectorAll('#modal-scores .modal-note');
  notes[0].textContent = T.scoresNote1;
  notes[1].textContent = T.scoresNote2;
  $('tips-list').innerHTML = T.tips.map(s => `<li>${s}</li>`).join('');
  document.querySelector('.result-label').textContent = T.resultLabel;
  $('sv-hint').textContent = lang === 'ja' ? 'この形を伝えよう' : 'Share this shape';
  $('btn-sv-share').innerHTML = lang === 'ja' ? '<small>画像付きで</small>共有' : '<small>with image</small>Share';
  $('btn-sv-post').textContent = lang === 'ja' ? 'Xでポスト' : 'Post on X';
  $('btn-sv-back').textContent = lang === 'ja' ? '戻る' : 'Back';
  $('btn-card-share').textContent = lang === 'ja' ? 'この形を伝える' : 'Share this shape';
  $('related-h').textContent = lang === 'ja' ? 'ゆかりの品' : 'Related items';
  document.querySelector('.related-note').textContent = lang === 'ja'
    ? "Amazonアソシエイトとして、sin1's studioは適格販売により収入を得ています。"
    : "As an Amazon Associate, sin1's studio earns from qualifying purchases.";
  document.querySelectorAll('.modal .btn-close').forEach(b => {
    b.textContent = b.closest('#modal-menu') ? T.btnResume : T.btnClose;
  });
  buildMeiTable();
  updateHUD();
}
$('btn-lang').addEventListener('click', () => {
  snd.tap();
  lang = lang === 'ja' ? 'en' : 'ja';
  localStorage.setItem('tosenkyo_lang', lang);
  applyLang();
});
applyLang();

/* ---------- リサイズ ---------- */
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const dpr = devicePixelRatio || 1;
  trailCanvas.width = w * dpr; trailCanvas.height = h * dpr;
}
addEventListener('resize', resize);
resize();

/* ---------- デバッグ ---------- */
if (DEBUG) {
  window.CFG = CFG; window.AERO = AERO;
  window.dbgBodies = { fanBody, choBody, makuraBody };
  window.dbgState = () => state;
  window.dbgStart = () => startGame();
  window.dbgThrow = (power = 0.5, ax = 0, ay = 0.285) => {
    aim.x = ax; aim.y = ay;
    aimWorld.set(ax, ay, 0);
    if (state === 'aim') startSwipe();
    setTimeout(() => launchFan(power, 0), 1000);
  };
  window.dbgShare = (i = -1) => { const r = throwResults.at(i); showMeiPose(r.id, { res: r, line: 'debug', total: false }); };
  // 告知画像用：見本の配置で「伝える画面」を出す（line は下段の文言）
  window.dbgShareMei = (id, line = '') => {
    applyMeiPose(id);
    const res = { id, mei: MEI[id], pts: MEI[id].pts,
      snap: [makuraBody, choBody, fanBody].map(b => ({ p: b.position.clone(), q: b.quaternion.clone() })) };
    showMeiPose(id, { res, line, total: false });
  };
  window.dbgShareImage = async () => { const b = await buildShareImage(); return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); };
  window.dbgMeiPose = (id) => { showMeiPose(id); hide($('mei-card')); };
  window.MEI_ORDER = MEI_ORDER;
  window.dbgResult = () => throwResults.map(r => `${r.id}:${r.pts}`).join(', ');
  // ?debug&wire: 物理形状(Box)をワイヤーで重ねて表示（見た目と当たりのずれ確認用）
  if (new URLSearchParams(location.search).has('wire')) {
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true, depthTest: false });
    for (const [body, mesh] of [[makuraBody, makuraMesh], [choBody, choMesh], [fanBody, fanMesh]]) {
      body.shapes.forEach((sh, i) => {
        if (!sh.halfExtents) return;
        const he = sh.halfExtents;
        const w = new THREE.Mesh(new THREE.BoxGeometry(he.x * 2, he.y * 2, he.z * 2), wireMat);
        w.position.copy(body.shapeOffsets[i]);
        w.quaternion.copy(body.shapeOrientations[i]);
        w.renderOrder = 999;
        mesh.add(w);
      });
    }
  }
}

/* ---------- メインループ ---------- */
function syncMeshes() {
  makuraMesh.position.copy(makuraBody.position);
  makuraMesh.quaternion.copy(makuraBody.quaternion);
  choMesh.position.copy(choBody.position);
  choMesh.quaternion.copy(choBody.quaternion);
  fanMesh.position.copy(fanBody.position);
  fanMesh.quaternion.copy(fanBody.quaternion);
}
function updateReticle() {
  swayT += 0.016;
  const sx = Math.sin(swayT * 1.1) * 0.010 + Math.sin(swayT * 2.3 + 1) * 0.005;
  const sy = Math.cos(swayT * 0.9) * 0.008 + Math.sin(swayT * 1.7) * 0.004;
  aimWorld.set(aim.x + sx, aim.y + sy, 0);
  const v = aimWorld.clone().project(camera);
  reticleEl.style.left = ((v.x + 1) / 2 * innerWidth) + 'px';
  reticleEl.style.top = ((-v.y + 1) / 2 * innerHeight) + 'px';
}
function stepPhysics(dt) {
  // 接近スローモーション
  if (state === 'flight' && !impacted) {
    const d = fanBody.position.distanceTo(choBody.position);
    timeScaleTarget = d < 0.5 ? CFG.slowMoScale : CFG.baseTimeScale;
  }
  timeScale += (timeScaleTarget - timeScale) * Math.min(1, dt * 6);
  const scaled = dt * timeScale;
  let acc = scaled;
  while (acc > 0) {
    const h = Math.min(CFG.fixedDt, acc);
    if (state === 'flight' || state === 'judge') { flightT += h; applyAero(h); }
    world.step(h);
    if (state === 'flight' || state === 'judge' || state === 'card') calmSettling(h);
    acc -= h;
  }
}
function checkSettle() {
  if (state !== 'flight' || flightT < 0.7) return;
  const fs = fanBody.velocity.length() + fanBody.angularVelocity.length() * 0.1;
  const cs = choBody.velocity.length();
  const ms = makuraBody.velocity.length();
  const flewPast = fanBody.position.z < -0.9 || Math.abs(fanBody.position.x) > 1.3;
  if ((fs < 0.09 && cs < 0.06 && ms < 0.06) || flewPast) settleFrames++;
  else settleFrames = 0;
  if (settleFrames > 42 || flightT > 7.5) finishThrow();
}
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  if (state === 'flight' || state === 'judge' || state === 'card') stepPhysics(dt);
  checkSettle();
  syncMeshes();
  if (state === 'aim') updateReticle();
  updateParticles(dt);
  updateCamera(dt);
  scene.userData.dust?.userData.update(t);
  if (DEBUG && window.dbgCam) { camera.position.set(...window.dbgCam.pos); camera.lookAt(...window.dbgCam.look); }
  renderer.render(scene, camera);
}
animate();

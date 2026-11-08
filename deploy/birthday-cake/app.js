// Birthday Cake (HAPPY BIRTHDAY) — порт birthday_cake.py на JavaScript.
import { AT, FILL, TAU, cellHash, doubles, loadBinary, outlineLetter, outlines, rays, run, smooth } from "./engine.js";
import { ATLAS, CONFETTI, FLAME_U, FLAME_V, WICK_TOP } from "./data.js";

const LOOP = 18.0, BUILD = 3.4;
const SPONGE = 0, CRUST = 1, CREAM = 2, FROST = 3, RED = 4, RED_HI = 5, PLATE = 6, GOLD = 7, CORE = 8, FLAME = 9,
  GLOW = 10, WICK = 11, LIT_S = 12, LIT_F = 13, HAPPY = 14, BDAY = 15;
const R = 1.6, CANDLE = [0.62 * R, 0, 0];
const CENTER = [1.0, 0, 0];
const F = 2.9;

const norm3 = (v) => { const n = Math.hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const clip01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// камера: глаз (1, 2.6, 7) смотрит на (1, 1.45, 0)
const EYE = [1.0, 2.6, 7.0];
const FWD = norm3([0, 1.45 - 2.6, -7.0]);
const RIGHT = norm3(cross(FWD, [0, 1, 0]));
const UP = cross(RIGHT, FWD);
const VIEW = [-FWD[0], -FWD[1], -FWD[2]];

const flameU = doubles(FLAME_U), flameV = doubles(FLAME_V);

// данные торта (точки) — грузятся из cake.bin.gz
let NP = 0, P0, N0, T0, K0, ORDER, GRAIN, FLY;
let PX, PY, PZ, SH, TG, KK;

export async function init(buf) {
  const head = new Int32Array(buf.slice(0, 8));
  const n = head[0], m = head[1];
  let o = 8;
  const take = (Type, count) => {
    const bytes = count * Type.BYTES_PER_ELEMENT;
    const arr = new Type(buf.slice(o, o + bytes));
    o += bytes;
    return arr;
  };
  const p = take(Int16Array, n * 3), nn = take(Int8Array, n * 3);
  T0 = take(Uint8Array, n);
  K0 = take(Uint8Array, n);
  const ord = take(Uint16Array, n), grain = take(Uint8Array, n);
  const flyIdx = take(Int32Array, m), flyVec = take(Float32Array, m * 3);
  NP = n;
  P0 = new Float64Array(n * 3);
  N0 = new Float64Array(n * 3);
  for (let i = 0; i < n * 3; i++) { P0[i] = p[i] / 10000; N0[i] = nn[i] / 127; }
  ORDER = new Float64Array(n);
  GRAIN = new Float64Array(n);
  for (let i = 0; i < n; i++) { ORDER[i] = ord[i] / 50000; GRAIN[i] = grain[i] / 255; }
  FLY = new Float64Array(n * 3);
  for (let j = 0; j < m; j++) for (let k = 0; k < 3; k++) FLY[flyIdx[j] * 3 + k] = flyVec[j * 3 + k];
  const MAX = n + 900;
  PX = new Float64Array(MAX); PY = new Float64Array(MAX); PZ = new Float64Array(MAX);
  SH = new Float64Array(MAX); TG = new Int32Array(MAX); KK = new Int32Array(MAX);
}

const flicker = (t) => 0.82 + 0.1 * Math.sin(t * 13) + 0.06 * Math.sin(t * 29 + 1) + 0.04 * Math.sin(t * 47 + 2);

function pop(p) {
  const c1 = 1.70158, q = p - 1;
  return 1 + (c1 + 1) * q ** 3 + c1 * q ** 2;
}

// надписи HAPPY / BIRTHDAY: насколько каждая клетка закрыта буквами (0..1)
const TEXT = new Map();
let wordCanvas = null;
export let wordFont = '"DejaVu Sans Bold", "Arial Black", sans-serif';

function word(text, cols, rows, scale, cy) {
  const key = `${text}|${cols}|${rows}|${Math.round(scale * 100)}`;
  if (TEXT.has(key)) return TEXT.get(key);
  const cov = new Float64Array(rows * cols);
  if (typeof document !== "undefined") {
    const w = cols * 9, h = rows * 14;
    if (!wordCanvas) { wordCanvas = document.createElement("canvas"); wordCanvas.width = w; wordCanvas.height = h; }
    const c = wordCanvas.getContext("2d", { willReadFrequently: true });
    c.fillStyle = "#000";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#fff";
    c.font = `bold ${Math.trunc(136 * scale)}px ${wordFont}`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text, w / 2, cy * 14);
    const data = c.getImageData(0, 0, w, h).data;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        let s = 0;
        for (let y = 0; y < 14; y++) {
          let p = ((r * 14 + y) * w + col * 9) * 4;
          for (let x = 0; x < 9; x++, p += 4) s += data[p];
        }
        cov[r * cols + col] = s / (14 * 9) / 255;
      }
    }
  }
  TEXT.set(key, cov);
  return cov;
}

function frame(t, cols, rows, aspect) {
  const turn = 0.95 + 0.08 * Math.sin(t * 0.5);
  const cy = Math.cos(turn), sy = Math.sin(turn);
  const head = ((t - 0.2) / (BUILD - 0.2)) * 1.25;
  const on = smooth((t - 4.4) / 0.8);
  const f = flicker(t);
  // кончик фитиля
  const tx = CANDLE[0] - CENTER[0], ty = WICK_TOP, tz = CANDLE[2] - CENTER[2];
  const tip = [cy * tx + sy * tz + CENTER[0], ty, -sy * tx + cy * tz + CENTER[2]];
  const light = [tip[0] + 0.03 * Math.sin(t * 2.3), tip[1] + 0.18, tip[2] + 0.05];
  const key = norm3([-0.5, 0.8, 0.6]);
  const rim = [0.8, 0.3, -0.5];
  const hk = norm3([key[0] + VIEW[0], key[1] + VIEW[1], key[2] + VIEW[2]]);
  const hr = norm3([rim[0] + VIEW[0], rim[1] + VIEW[1], rim[2] + VIEW[2]]);

  let n = 0;
  for (let i = 0; i < NP; i++) {
    const o = i * 3;
    const rev = smooth((head - ORDER[i]) / 0.12);
    if (!(rev > 0.01)) continue;
    const x0 = P0[o] - CENTER[0], z0 = P0[o + 2] - CENTER[2];
    const x = cy * x0 + sy * z0 + CENTER[0] + (1 - rev) * FLY[o];
    const y = P0[o + 1] + (1 - rev) * FLY[o + 1];
    const z = -sy * x0 + cy * z0 + CENTER[2] + (1 - rev) * FLY[o + 2];
    const n0 = cy * N0[o] + sy * N0[o + 2], n1 = N0[o + 1], n2 = -sy * N0[o] + cy * N0[o + 2];
    const diff = clip01(n0 * key[0] + n1 * key[1] + n2 * key[2]);
    const spec = clip01(n0 * hk[0] + n1 * hk[1] + n2 * hk[2]) ** 24 + 0.7 * clip01(n0 * hr[0] + n1 * hr[1] + n2 * hr[2]) ** 18;
    const dx = light[0] - x, dy = light[1] - y, dz = light[2] - z;
    const dist = Math.hypot(dx, dy, dz);
    const glow = on * f * (0.3 + 0.7 * clip01((n0 * dx + n1 * dy + n2 * dz) / dist)) * Math.exp(-((dist / 1.6) ** 2)) * 1.3;
    const t0 = T0[i];
    PX[n] = x; PY[n] = y; PZ[n] = z;
    SH[n] = (0.3 + 0.45 * diff + 0.12 * spec + 0.45 * glow) * rev * GRAIN[i] * (K0[i] === 0 ? 0.6 : 1.0);
    TG[n] = glow > 0.3 ? (t0 === SPONGE || t0 === CRUST ? LIT_S : t0 === FROST ? LIT_F : t0) : t0;
    KK[n] = K0[i];
    n++;
  }

  // пламя
  const grow = smooth((t - 4.3) / 0.7);
  if (grow > 0) {
    const lean = 0.05 * Math.sin(t * 2.3) + 0.02 * Math.sin(t * 7);
    const hgt = 0.6 * f * grow;
    for (let j = 0; j < 900; j++) {
      const u = flameU[j], v = flameV[j];
      const width = 0.15 * Math.sin(Math.PI * v ** 0.75) * (1 - 0.35 * v);
      const core = Math.abs(u) < 0.5 && v < 0.62;
      PX[n] = tip[0] + u * width * grow + lean * v * v;
      PY[n] = tip[1] + (v - 0.12) * hgt;
      PZ[n] = tip[2] + 0.05;
      SH[n] = (core ? 1.0 : 0.82) * (0.6 + 0.4 * grow);
      TG[n] = core ? CORE : FLAME;
      KK[n] = 6;
      n++;
    }
  }

  // в клетки (ближняя точка побеждает)
  const cells = rows * cols;
  const part = new Int32Array(cells).fill(-1);
  const depth = new Float64Array(cells).fill(99);
  const lumR = new Float64Array(cells);
  const tag = new Int32Array(cells);
  const R0 = RIGHT[0], R1 = RIGHT[1], R2 = RIGHT[2], U0 = UP[0], U1 = UP[1], U2 = UP[2], F0 = FWD[0], F1 = FWD[1], F2 = FWD[2];
  const kx = F * 0.5 * cols, ky = F * 0.5 * aspect * rows;
  for (let i = 0; i < n; i++) {
    const rx = PX[i] - EYE[0], ry = PY[i] - EYE[1], rz = PZ[i] - EYE[2];
    const z = rx * F0 + ry * F1 + rz * F2;
    if (!(z > 0.2)) continue;
    const ix = Math.trunc(0.5 * cols + ((rx * R0 + ry * R1 + rz * R2) / z) * kx);
    const iy = Math.trunc(0.5 * rows - ((rx * U0 + ry * U1 + rz * U2) / z) * ky);
    if (ix < 0 || ix >= cols || iy < 0 || iy >= rows) continue;
    const c = iy * cols + ix;
    if (z <= depth[c]) { depth[c] = z; part[c] = KK[i]; lumR[c] = SH[i]; tag[c] = TG[i]; }
  }
  const { edge, gx, gy } = outlines(part, depth, rows, cols);
  const char = new Int32Array(cells), lum = new Float64Array(cells), hh = new Int32Array(cells);
  const outlineSet = new Set("/|\\-_+".split("").map((ch) => AT[ch]));
  const crumbs = "o0ae.:o0".split("").map((ch) => AT[ch]);
  const t2 = Math.trunc(t * 2);
  let count = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const h = cellHash(r, c);
      hh[i] = h;
      if (part[i] < 0) continue;
      count++;
      let level = Math.trunc(lumR[i] * 3.2);
      level = level < 0 ? 0 : level > 3 ? 3 : level;
      let ch = edge[i] ? outlineLetter(gx[i], gy[i]) : FILL[level][(h + Math.trunc(t * 4 + (h % 11))) % 12];
      let l = edge[i] ? Math.max(0.5, lumR[i]) : clip01(lumR[i]);
      // текстура: крошки в бисквите, волны в креме
      if (!outlineSet.has(ch)) {
        const tg = tag[i];
        const crumb = crumbs[(h + t2 * (h % 3 === 0 ? 1 : 0)) % 8];
        const wave = h % 5 === 0 ? AT["^"] : AT["~"];
        if (tg === SPONGE || tg === LIT_S) ch = crumb;
        else if (tg === CRUST) ch = AT["="];
        else if (tg === CREAM) { ch = AT["~"]; l = Math.max(l, 0.85); }
        else if (tg === FROST || tg === LIT_F) ch = wave;
        else if (tg === PLATE) ch = h % 4 === 0 ? AT[":"] : AT["."];
        else if (tg === GOLD) ch = AT["="];
      }
      if (tag[i] === PLATE) l *= 0.8;
      char[i] = ch;
      lum[i] = l;
    }
  }

  // ореол вокруг пламени
  const lr = [light[0] - EYE[0], light[1] - EYE[1], light[2] - EYE[2]];
  const lz = lr[0] * F0 + lr[1] * F1 + lr[2] * F2;
  const fcy = Math.trunc((0.5 - ((lr[0] * U0 + lr[1] * U1 + lr[2] * U2) / lz) * F * 0.5 * aspect) * rows);
  const fcx = Math.trunc((0.5 + ((lr[0] * R0 + lr[1] * R1 + lr[2] * R2) / lz) * F * 0.5) * cols);
  if (on > 0) {
    const rg = (6 + 1.5 * f) * on;
    const t9 = Math.trunc(t * 9);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (char[i] !== 0) continue;
        const fall = 1 - Math.hypot(r - fcy, ((c - fcx) * 9) / 14) / rg;
        if (!(fall > 0) || (hh[i] + t9) % 3 === 0) continue;
        char[i] = fall < 0.4 ? AT["."] : fall < 0.7 ? AT[":"] : AT["+"];
        lum[i] = 0.6 * fall * on * f;
        tag[i] = GLOW;
      }
    }
  }

  // искры, пока свеча зажигается
  if (t > 4.3 && t < 5.4) {
    const k = (t - 4.3) / 1.1;
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4 + k * 3;
      const sy2 = Math.trunc(fcy + 2 - k * 7 * (0.6 + 0.4 * (i % 3)) + Math.sin(a) * 2);
      const sx2 = Math.trunc(fcx + Math.cos(a) * (2 + k * 9));
      if (sy2 >= 0 && sy2 < rows && sx2 >= 0 && sx2 < cols && char[sy2 * cols + sx2] === 0) {
        const j = sy2 * cols + sx2;
        char[j] = AT[i % 2 ? "*" : "+"]; lum[j] = 1 - k; tag[j] = CORE;
      }
    }
  }

  // конфетти
  let pieces = 0;
  for (let i = 0; i < CONFETTI.length; i++) {
    const [x0, speed, delay, amp, w, ph, col] = CONFETTI[i];
    const age = t - 6.2 - delay;
    if (age < 0) continue;
    const y = Math.trunc((age * speed) % (rows + 4)) - 2;
    const x = Math.trunc(x0 + amp * Math.sin(w * t + ph));
    if (y >= 0 && y < rows && x >= 0 && x < cols && (char[y * cols + x] === 0 || tag[y * cols + x] === GLOW)) {
      const spin = i % 7 ? "-/|\\"[Math.trunc(t * w * 3 + ph) % 4] : "o";
      const j = y * cols + x;
      char[j] = AT[spin]; lum[j] = 0.85; tag[j] = col;
      pieces++;
    }
  }

  // слова
  for (const [text, ts, row, tg] of [["HAPPY", 8.0, 0.09, HAPPY], ["BIRTHDAY", 8.55, 0.21, BDAY]]) {
    const p = clip01((t - ts) / 0.5);
    if (p <= 0) continue;
    const cov = word(text, cols, rows, 1.55 - 0.55 * pop(p), rows * row);
    const sp = smooth(p * 1.6);
    const at = (r, c) => cov[(((r % rows) + rows) % rows) * cols + (((c % cols) + cols) % cols)]; // np.roll
    const t4 = Math.trunc(t * 4);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const h = hh[i];
        if (!(cov[i] > 0.45 && (h % 997) / 997 < sp)) continue;
        const gxv = -(at(r, c + 1) - at(r, c - 1));
        const gyv = -(at(r + 1, c) - at(r - 1, c));
        const isEdge = at(r - 1, c) < 0.45 || at(r + 1, c) < 0.45 || at(r, c - 1) < 0.45 || at(r, c + 1) < 0.45;
        char[i] = isEdge ? outlineLetter(gxv * 10, gyv * 10) : FILL[3][(h + t4 + (h % 11)) % 12];
        const shine = 0.8 + 0.2 * Math.sin(t * 3 - c * 0.12);
        lum[i] = clip01(shine * (1 + 0.5 * (1 - p)));
        tag[i] = tg;
      }
    }
  }

  if (t > 9.6) {
    const lit = [];
    for (let i = 0; i < cells; i++) if (tag[i] === HAPPY) lit.push(i);
    for (let k = 0; k < 2; k++) {
      const q = Math.trunc(t * 1.3 + k * 0.5);
      if (lit.length) {
        const idx = lit[(q * 7919 + k * 104729) % lit.length];
        rays(char, lum, tag, Math.floor(idx / cols), idx % cols, Math.trunc(2 + 4 * Math.sin(((t * 1.3 + k * 0.5) % 1) * Math.PI)), rows, cols, 1, CORE);
      }
    }
  }

  return { char, lum, tag, info: { candle: on > 0.5 ? "lit" : "off", flame: f * on, confetti: pieces }, count };
}

export const APP = {
  W: 1080, H: 960, CW: 9, CH: 14, TRAIL: 0.4, LOOP,
  COLORS: [
    [236, 160, 52], [150, 84, 36], [255, 250, 238], [255, 246, 232],
    [240, 50, 70], [255, 140, 150], [232, 222, 206], [228, 176, 84],
    [255, 250, 228], [255, 158, 52], [255, 184, 96], [90, 70, 60],
    [255, 184, 72], [255, 226, 168], [255, 212, 138], [255, 176, 204],
    [255, 96, 160], [70, 160, 255], [60, 200, 110], [255, 214, 50], [255, 128, 40], [245, 245, 255],
  ].map((c) => c.map((v) => Math.fround(v / 255))),
  ATLAS,
  SIGN: "Raph · 2026",
  frame,
  hud: (info) => `candle ${info.candle}   flame ${info.flame.toFixed(2)}   confetti ${info.confetti}`,
  async init() {
    await init(await loadBinary("cake.bin.gz"));
    // шрифт для HAPPY BIRTHDAY
    try {
      const face = new FontFace("DejaVu Sans Bold", "url(DejaVuSans-Bold.ttf)");
      await face.load();
      document.fonts.add(face);
    } catch (e) {
      wordFont = '"Arial Black", Impact, sans-serif';
    }
  },
};

if (typeof document !== "undefined") APP.init().then(() => run(APP));

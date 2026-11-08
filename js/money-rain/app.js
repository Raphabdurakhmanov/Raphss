// Money Rain — порт money_rain.py на JavaScript.
import { AT, FILL, TAU, cellHash, ints, outlineLetter, outlines, run } from "../engine.js";
import { ATLAS, BILLS, PATTERN } from "./data.js";

const PAPER = 0, INK = 1, BORDER = 2, PORTRAIT = 3, FACE = 4, NUM = 5, SEAL = 6;
const TONE = [0.95, 0.6, 0.75, 0.62, 1.0, 0.9, 0.9];

// сетка точек купюры 72 x 32
const NU = 72, NV = 32, NP = NU * NV;
const U = new Float64Array(NP);
const V = new Float64Array(NP);
for (let j = 0; j < NV; j++) {
  for (let i = 0; i < NU; i++) {
    U[j * NU + i] = -1 + (2 * i) / (NU - 1);
    V[j * NU + i] = -1 + (2 * j) / (NV - 1);
  }
}
const HALF_L = 1.0, HALF_W = 0.42;
const TAGS = ints(PATTERN);
const TOP = 3.4, FALL = 7.2;
const F = 2.9;

// камера: глаз (0,0,7.5) смотрит в 0 -> right=(1,0,0)... считаем как в оригинале
const EYE = [0, 0, 7.5];
const FWD = [0, 0, -1];
const RIGHT = [-FWD[2], 0, FWD[0]]; // cross(fwd, [0,1,0])
{
  const n = Math.hypot(...RIGHT);
  RIGHT[0] /= n; RIGHT[1] /= n; RIGHT[2] /= n;
}
const UP = [
  RIGHT[1] * FWD[2] - RIGHT[2] * FWD[1],
  RIGHT[2] * FWD[0] - RIGHT[0] * FWD[2],
  RIGHT[0] * FWD[1] - RIGHT[1] * FWD[0],
];

function rot(ax, ay, az) {
  const cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay), cz = Math.cos(az), sz = Math.sin(az);
  const rx = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]];
  const ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]];
  const rz = [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]];
  const mul = (a, b) => a.map((row, i) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));
  return mul(mul(rz, ry), rx);
}

const KEY = (() => {
  const k = [-0.3, 0.7, 0.65];
  const n = Math.hypot(...k);
  return k.map((v) => v / n);
})();

// буферы на все 16 купюр
const MAXP = BILLS.length * NP;
const PX = new Float64Array(MAXP), PY = new Float64Array(MAXP), PZ = new Float64Array(MAXP);
const SH = new Float64Array(MAXP);
const TG = new Int32Array(MAXP);
const KK = new Int32Array(MAXP);

function frame(t, cols, rows, aspect) {
  let n = 0;
  for (let k = 0; k < BILLS.length; k++) {
    const b = BILLS[k];
    const u = ((t - b.delay) * b.speed) / FALL;
    if (u < 0) continue;
    const ph = b.ph + t * 2.2 * b.w;
    const r = rot(0.9 * Math.sin(t * 1.3 * b.w + b.ph), t * b.spin + b.ph, 0.5 * Math.sin(t * 0.9 * b.w + b.ph * 2));
    const y0 = TOP - (((u % 1) + 1) % 1) * FALL;
    const x0 = b.x + b.sway * Math.sin(t * 1.1 * b.w + b.ph);
    for (let i = 0; i < NP; i++) {
      const uu = U[i], vv = V[i];
      const bend = 0.16 * Math.sin(uu * 2.2 + ph) + 0.08 * uu * uu;
      const slope = 0.16 * 2.2 * Math.cos(uu * 2.2 + ph) + 0.16 * uu;
      const p0 = uu * HALF_L, p1 = vv * HALF_W, p2 = bend * HALF_L;
      let n0 = -slope, n1 = 0, n2 = 1;
      const nl = Math.hypot(n0, n1, n2);
      n0 /= nl; n1 /= nl; n2 /= nl;
      const X = r[0][0] * p0 + r[0][1] * p1 + r[0][2] * p2 + x0;
      const Y = r[1][0] * p0 + r[1][1] * p1 + r[1][2] * p2 + y0;
      const Z = r[2][0] * p0 + r[2][1] * p1 + r[2][2] * p2 + b.z;
      const N0 = r[0][0] * n0 + r[0][1] * n1 + r[0][2] * n2;
      const N1 = r[1][0] * n0 + r[1][1] * n1 + r[1][2] * n2;
      const N2 = r[2][0] * n0 + r[2][1] * n1 + r[2][2] * n2;
      const side = Math.abs(N0 * KEY[0] + N1 * KEY[1] + N2 * KEY[2]);
      let depth = 0.55 + (0.45 * (Z + 3.5)) / 5.3;
      depth = depth < 0.4 ? 0.4 : depth > 1 ? 1 : depth;
      PX[n] = X; PY[n] = Y; PZ[n] = Z;
      SH[n] = (0.55 + 0.45 * side) * TONE[TAGS[i]] * depth;
      TG[n] = TAGS[i];
      KK[n] = k;
      n++;
    }
  }
  const cells = rows * cols;
  const char = new Int32Array(cells);
  const lum = new Float64Array(cells);
  const tag = new Int32Array(cells);
  if (n === 0) return { char, lum, tag, info: { bills: 0, falling: 0 }, count: 0 };

  // z-буфер: ближняя точка побеждает (как сортировка от дальних к ближним)
  const part = new Int32Array(cells).fill(-1);
  const depth = new Float64Array(cells).fill(99);
  const shade = new Float64Array(cells);
  for (let i = 0; i < n; i++) {
    const rx = PX[i] - EYE[0], ry = PY[i] - EYE[1], rz = PZ[i] - EYE[2];
    const x = rx * RIGHT[0] + ry * RIGHT[1] + rz * RIGHT[2];
    const y = rx * UP[0] + ry * UP[1] + rz * UP[2];
    const z = rx * FWD[0] + ry * FWD[1] + rz * FWD[2];
    if (!(z > 0.2)) continue;
    const ix = Math.trunc((0.5 + (x / z) * F * 0.5) * cols);
    const iy = Math.trunc((0.5 - (y / z) * F * 0.5 * aspect) * rows);
    if (ix < 0 || ix >= cols || iy < 0 || iy >= rows) continue;
    const c = iy * cols + ix;
    if (z <= depth[c]) {
      depth[c] = z;
      part[c] = KK[i];
      shade[c] = SH[i];
      tag[c] = TG[i];
    }
  }

  const { edge, gx, gy } = outlines(part, depth, rows, cols);
  const ti = Math.trunc(t * 3);
  let count = 0;
  const outlineSet = new Set("/|\\-_+".split("").map((ch) => AT[ch]));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (part[i] < 0) {
        char[i] = 0;
        lum[i] = 0;
        continue;
      }
      count++;
      const h = cellHash(r, c);
      let level = Math.trunc(shade[i] * 3.2);
      level = level < 0 ? 0 : level > 3 ? 3 : level;
      let ch;
      if (edge[i]) {
        ch = outlineLetter(gx[i], gy[i]);
        lum[i] = Math.max(0.55, shade[i]);
      } else {
        ch = FILL[level][(h + Math.trunc(t * 4 + (h % 11))) % 12];
        lum[i] = Math.min(Math.max(shade[i] * 1.5, 0), 1);
      }
      // узор купюры внутри (не на контуре)
      if (!outlineSet.has(ch)) {
        switch (tag[i]) {
          case PAPER: ch = r % 2 ? AT["~"] : AT["-"]; break;
          case INK: ch = AT["="]; break;
          case BORDER: ch = AT["#"]; break;
          case PORTRAIT: ch = FILL[3][(h + ti) % 12]; break;
          case FACE: ch = h % 3 ? AT["o"] : AT["e"]; break;
          case NUM: ch = [AT["1"], AT["0"], AT["0"]][c % 3]; break;
          case SEAL: ch = AT["$"]; break;
        }
      }
      char[i] = ch;
    }
  }
  const speed = BILLS.reduce((a, b) => a + b.speed, 0) / BILLS.length;
  return { char, lum, tag, info: { bills: BILLS.length, falling: Math.round(speed * 100) / 100 }, count };
}

export const APP = {
  W: 1080, H: 960, CW: 9, CH: 14, TRAIL: 0.35, LOOP: 20.0,
  COLORS: [
    [226, 240, 214], [96, 176, 116], [150, 210, 146], [92, 160, 108],
    [238, 242, 222], [176, 236, 176], [126, 222, 166],
  ].map((c) => c.map((v) => Math.fround(v / 255))),
  ATLAS,
  SIGN: "Raph · 2026",
  frame,
  hud: (info) => `bills ${info.bills}   falling ${info.falling.toFixed(2)}`,
};

if (typeof document !== "undefined") run(APP);

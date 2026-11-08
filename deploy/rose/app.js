// Rose (IN BLOOM) — порт rose.py на JavaScript.
import { AT, FILL, TAU, cellHash, doubles, linspace, outlineLetter, outlines, run, smooth } from "./engine.js";
import { ATLAS, DEW, DROP_AT, GLITTER, SPLASH, SPK } from "./data.js";

const LOOP = 20.0;
const FLOOR = -1.22;
const STEM = 0, LEAF = 1, SEPAL = 2, PETAL = 3, EDGE = 4, GLINT = 5, FIRE_R = 6, FIRE_B = 7, DUST = 8, REFL = 9;
const HEAD_Y = 0.22;

const spk = doubles(SPK);         // 1600 x 5
const glit = doubles(GLITTER);    // 700 x 5
const dew = doubles(DEW);         // 40 x 2
const splash = doubles(SPLASH);   // 8 x 2

const norm3 = (v) => {
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function stemCurve(s) {
  return [0.045 * Math.sin(s * 3.1 + 0.4) - 0.02, -1.15 + s * (HEAD_Y + 1.15), 0.02 * Math.sin(s * 2.0)];
}

// np.gradient по сетке (ny, nx) вдоль оси: центральные разности, по краям — односторонние
function gradient(arr, ny, nx, axis, out) {
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const i = y * nx + x;
      let a, b, d;
      if (axis === 1) {
        if (x === 0) { a = i; b = i + 1; d = 1; }
        else if (x === nx - 1) { a = i - 1; b = i; d = 1; }
        else { a = i - 1; b = i + 1; d = 2; }
      } else {
        if (y === 0) { a = i; b = i + nx; d = 1; }
        else if (y === ny - 1) { a = i - nx; b = i; d = 1; }
        else { a = i - nx; b = i + nx; d = 2; }
      }
      for (let k = 0; k < 3; k++) out[i * 3 + k] = (arr[b * 3 + k] - arr[a * 3 + k]) / d;
    }
  }
}

// ---- стебель и листья (не меняются) ----
function makeStem() {
  const ns = 260, nphi = 14;
  const S = linspace(0, 1, ns);
  const PHI = linspace(0, TAU, nphi, false);
  const P = new Float64Array(ns * nphi * 3), N = new Float64Array(ns * nphi * 3), SS = new Float64Array(ns * nphi);
  for (let j = 0; j < nphi; j++) {
    for (let i = 0; i < ns; i++) {
      const idx = j * ns + i;
      const s = S[i], phi = PHI[j];
      const c = stemCurve(s);
      const n = [Math.cos(phi), 0, Math.sin(phi)];
      const r = 0.026 + 0.006 * (1 - s);
      for (let k = 0; k < 3; k++) {
        P[idx * 3 + k] = c[k] + n[k] * r;
        N[idx * 3 + k] = n[k];
      }
      SS[idx] = s;
    }
  }
  return [P, N, SS];
}

function makeLeaf(at, side, length, lift, twist) {
  const nx = 70, ny = 25, n = nx * ny;
  const SL = linspace(0, 1, nx), WL = linspace(-1, 1, ny);
  const base = stemCurve(at);
  const d = norm3([side * Math.cos(lift), Math.sin(lift), 0.25 * twist]);
  const wide = norm3(cross(d, [0, 0, 1]));
  const up = cross(wide, d);
  const P = new Float64Array(n * 3), N = new Float64Array(n * 3), S = new Float64Array(n);
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const i = y * nx + x;
      const s = SL[x], w = WL[y];
      const sc = s < 0 ? 0 : s > 1 ? 1 : s;
      const hw = (0.15 * Math.pow(Math.sin(Math.PI * sc), 0.75) * length) / 0.42;
      const lift2 = 0.05 * Math.abs(w) - 0.1 * s * s;
      for (let k = 0; k < 3; k++) {
        P[i * 3 + k] = base[k] + d[k] * 0.07 + d[k] * (s * length) + wide[k] * (w * hw) + up[k] * lift2;
      }
      S[i] = s;
    }
  }
  const du = new Float64Array(n * 3), dv = new Float64Array(n * 3);
  gradient(P, ny, nx, 1, du);
  gradient(P, ny, nx, 0, dv);
  for (let i = 0; i < n; i++) {
    const c = cross([du[i * 3], du[i * 3 + 1], du[i * 3 + 2]], [dv[i * 3], dv[i * 3 + 1], dv[i * 3 + 2]]);
    const l = Math.hypot(c[0], c[1], c[2]) + 1e-9;
    let nn = [c[0] / l, c[1] / l, c[2] / l];
    const sg = Math.sign(nn[0] * up[0] + nn[1] * up[1] + nn[2] * up[2] + 1e-9);
    for (let k = 0; k < 3; k++) N[i * 3 + k] = nn[k] * sg;
  }
  return [P, N, S];
}

const [STEM_P, STEM_N, STEM_S] = makeStem();
const LEAF_AT = [0.32, 0.55];
const LEAVES = [makeLeaf(LEAF_AT[0], -1, 0.42, 0.35, 1), makeLeaf(LEAF_AT[1], 1, 0.36, 0.45, -1)];

// чашелистики: сетка 34 x 9
const SEP_NS = 34, SEP_NW = 9, SEP_N = SEP_NS * SEP_NW;
const SEP_S = new Float64Array(SEP_N), SEP_W = new Float64Array(SEP_N);
{
  const s = linspace(0, 1, SEP_NS), w = linspace(-1, 1, SEP_NW);
  for (let j = 0; j < SEP_NW; j++) for (let i = 0; i < SEP_NS; i++) { SEP_S[j * SEP_NS + i] = s[i]; SEP_W[j * SEP_NS + i] = w[j]; }
}
const N_SEPAL = 5 * SEP_N;

function sepals(open, P, N, off) {
  const L = 0.36 - 0.06 * open;
  for (let i = 0; i < 5; i++) {
    const a = (TAU * i) / 5 + 0.3;
    for (let j = 0; j < SEP_N; j++) {
      const s = SEP_S[j], w = SEP_W[j];
      const beta = 1.05 + 0.35 * open + (0.55 + 0.75 * open) * s;
      const r = 0.045 + L * s * Math.sin(beta);
      const ang = a + (w * 0.1 * Math.pow(1 - s, 1.3)) / Math.max(r / 0.2, 0.25);
      const y = HEAD_Y + 0.02 + L * s * Math.cos(beta);
      const o = (off + i * SEP_N + j) * 3;
      P[o] = Math.cos(ang) * r; P[o + 1] = y; P[o + 2] = Math.sin(ang) * r;
      let n0 = Math.cos(ang) * Math.cos(beta), n1 = -Math.sin(beta), n2 = Math.sin(ang) * Math.cos(beta);
      const l = Math.hypot(n0, n1, n2);
      N[o] = n0 / l; N[o + 1] = n1 / l; N[o + 2] = n2 / l;
    }
  }
}

// ---- лепестки: одна спиральная поверхность 40 x 1300 ----
const NT = 1300, NX = 40, NPET = NT * NX;
const THv = linspace(2.2 * Math.PI, 20 * Math.PI, NT), XXv = linspace(0, 1, NX);
const TH = new Float64Array(NPET), XX = new Float64Array(NPET), THN = new Float64Array(NPET);
const PETAL_J = new Int32Array(NPET), PETAL_SJ = new Float64Array(NPET), PETAL_V = new Float64Array(NPET);
{
  const tmin = THv[0], tmax = THv[NT - 1];
  let idMin = Infinity;
  const ids = new Int32Array(NPET);
  for (let x = 0; x < NX; x++) {
    for (let t = 0; t < NT; t++) {
      const i = x * NT + t;
      TH[i] = THv[t]; XX[i] = XXv[x];
      THN[i] = (THv[t] - tmin) / (tmax - tmin);
      ids[i] = Math.floor((3.6 * THv[t]) / TAU);
      if (ids[i] < idMin) idMin = ids[i];
    }
  }
  for (let i = 0; i < NPET; i++) {
    PETAL_J[i] = ids[i] - idMin;
    PETAL_SJ[i] = 1 - THN[i];
    PETAL_V[i] = XX[i];
  }
}
const SIZE = 0.8;
const pBuf = new Float64Array(NPET * 3), duBuf = new Float64Array(NPET * 3), dvBuf = new Float64Array(NPET * 3);
const pmod = (a, m) => ((a % m) + m) % m;

function petals(open, P, N, edge, off) {
  const A = 1.6 + 4.0 * open;
  const w = smooth(open / 0.6);
  for (let i = 0; i < NPET; i++) {
    const th = TH[i], xx = XX[i];
    const phi = (Math.PI / 2) * Math.exp(-th / (A * Math.PI));
    const q = 1.25 * (1 - pmod(3.6 * th, TAU) / Math.PI) ** 2 - 0.25;
    const X = 1 - 0.5 * q * q;
    const yy = 1.95653 * xx * xx * (1.27689 * xx - 1) ** 2 * Math.sin(phi);
    const r = X * (xx * Math.sin(phi) + yy * Math.cos(phi));
    let px = r * Math.sin(th) * SIZE, py = X * (xx * Math.cos(phi) - yy * Math.sin(phi)) * SIZE, pz = r * Math.cos(th) * SIZE;
    py *= 0.84 + 0.16 * open;
    px *= 1.05 - 0.05 * open;
    pz *= 1.05 - 0.05 * open;
    py += HEAD_Y;
    const thn = THN[i];
    const rb = ((0.17 * xx ** 0.7 * (1 - xx) ** 0.75) / 0.367) * (1 - 0.3 * thn) + 0.003;
    const bx = rb * Math.sin(th), by = HEAD_Y + 0.03 + 0.52 * xx * (1 - 0.06 * thn), bz = rb * Math.cos(th);
    pBuf[i * 3] = bx * (1 - w) + px * w;
    pBuf[i * 3 + 1] = by * (1 - w) + py * w;
    pBuf[i * 3 + 2] = bz * (1 - w) + pz * w;
  }
  gradient(pBuf, NX, NT, 1, duBuf);
  gradient(pBuf, NX, NT, 0, dvBuf);
  for (let i = 0; i < NPET; i++) {
    const a0 = duBuf[i * 3], a1 = duBuf[i * 3 + 1], a2 = duBuf[i * 3 + 2];
    const b0 = dvBuf[i * 3], b1 = dvBuf[i * 3 + 1], b2 = dvBuf[i * 3 + 2];
    let c0 = a1 * b2 - a2 * b1, c1 = a2 * b0 - a0 * b2, c2 = a0 * b1 - a1 * b0;
    const l = Math.hypot(c0, c1, c2) + 1e-9;
    c0 /= l; c1 /= l; c2 /= l;
    const th = TH[i];
    const sg = Math.sign(c0 * Math.sin(th) + c1 * 0.2 + c2 * Math.cos(th) + 1e-9);
    const o = (off + i) * 3;
    P[o] = pBuf[i * 3]; P[o + 1] = pBuf[i * 3 + 1]; P[o + 2] = pBuf[i * 3 + 2];
    N[o] = c0 * sg; N[o + 1] = c1 * sg; N[o + 2] = c2 * sg;
    edge[i] = XX[i] > 0.93 ? 1 : 0;
  }
}

function bloom(t) {
  let u = (t - 5.5) / 9.0;
  u = u < 0 ? 0 : u > 1 ? 1 : u;
  return u * (2 - u) * 0.55 + u * u * (3 - 2 * u) * 0.45;
}

// порядок «прорисовки»
const DRAW0 = 0.3, DRAW1 = 5.4, O_MAX = 1.66;

function sway(t) {
  return 0.22 * Math.sin(Math.max(t - 7.0, 0) * 0.35) * smooth((t - 7.0) / 4.0);
}

// камера
const EYE = [0, 1.75, 4.0];
const FWD = norm3([0 - EYE[0], -0.05 - EYE[1], 0 - EYE[2]]);
const RIGHT = norm3(cross(FWD, [0, 1, 0]));
const UP = cross(RIGHT, FWD);
const VIEW = [-FWD[0], -FWD[1], -FWD[2]];

// сколько всего точек тела
const N_STEM = STEM_S.length, N_LEAF0 = LEAVES[0][2].length, N_LEAF1 = LEAVES[1][2].length;
const NB = N_STEM + N_LEAF0 + N_LEAF1 + N_SEPAL + NPET;
const OFF_LEAF0 = N_STEM, OFF_LEAF1 = N_STEM + N_LEAF0, OFF_SEP = OFF_LEAF1 + N_LEAF1, OFF_PET = OFF_SEP + N_SEPAL;

const BODY = new Float64Array(NB * 3), NORM = new Float64Array(NB * 3);
const ORDER = new Float64Array(NB), KIND = new Int32Array(NB), PART = new Int32Array(NB), SHADE = new Float64Array(NB);
const KREV = new Float64Array(NB), TIP = new Uint8Array(NB);
const PEDGE = new Uint8Array(NPET);
// статичные части один раз
BODY.set(STEM_P, 0); NORM.set(STEM_N, 0);
BODY.set(LEAVES[0][0], OFF_LEAF0 * 3); NORM.set(LEAVES[0][1], OFF_LEAF0 * 3);
BODY.set(LEAVES[1][0], OFF_LEAF1 * 3); NORM.set(LEAVES[1][1], OFF_LEAF1 * 3);
const STATIC_BODY = BODY.slice(0, OFF_SEP * 3), STATIC_NORM = NORM.slice(0, OFF_SEP * 3);
for (let i = 0; i < N_STEM; i++) ORDER[i] = STEM_S[i];
for (let i = 0; i < N_LEAF0; i++) ORDER[OFF_LEAF0 + i] = LEAF_AT[0] + 0.05 + LEAVES[0][2][i] * 0.25;
for (let i = 0; i < N_LEAF1; i++) ORDER[OFF_LEAF1 + i] = LEAF_AT[1] + 0.05 + LEAVES[1][2][i] * 0.25;
for (let i = 0; i < 5; i++) for (let j = 0; j < SEP_N; j++) ORDER[OFF_SEP + i * SEP_N + j] = 1.0 + 0.1 * SEP_S[j];
for (let i = 0; i < NPET; i++) ORDER[OFF_PET + i] = 1.1 + PETAL_V[i] * 0.42 + PETAL_SJ[i] * 0.1;
const OUTER = [];
for (let i = 0; i < NPET; i++) if (PETAL_SJ[i] > 0.55) OUTER.push(i);

// частицы
const MAXPART = 1600 + 700 + 64;
const QP = new Float64Array(MAXPART * 3), QS = new Float64Array(MAXPART), QT = new Int32Array(MAXPART);
// видимые частицы за кадр
const MAXV = 200000;
const VI = new Int32Array(MAXV), VJ = new Int32Array(MAXV), VT = new Int32Array(MAXV);
const VS = new Float64Array(MAXV), VZ = new Float64Array(MAXV);

function frame(t, cols, rows, aspect) {
  // ---- сцена ----
  const yaw = sway(t);
  const op = bloom(t);
  BODY.set(STATIC_BODY, 0);
  NORM.set(STATIC_NORM, 0);
  sepals(op, BODY, NORM, OFF_SEP);
  petals(op, BODY, NORM, PEDGE, OFF_PET);
  for (let i = 0; i < NB; i++) {
    if (i < N_STEM) { KIND[i] = STEM; PART[i] = 0; }
    else if (i < OFF_LEAF1) { KIND[i] = LEAF; PART[i] = 1; }
    else if (i < OFF_SEP) { KIND[i] = LEAF; PART[i] = 2; }
    else if (i < OFF_PET) { KIND[i] = SEPAL; PART[i] = 3; }
    else { KIND[i] = PEDGE[i - OFF_PET] ? EDGE : PETAL; PART[i] = 10 + PETAL_J[i - OFF_PET]; }
  }
  const head = ((t - DRAW0) / (DRAW1 - DRAW0)) * O_MAX;
  for (let i = 0; i < NB; i++) {
    const o = ORDER[i];
    const soft = o >= 1.0 ? 0.09 : 0.05;
    KREV[i] = smooth((head - o) / soft);
    TIP[i] = Math.abs(head - o) < 0.03 && o < 1.0 ? 1 : 0;
  }

  // внешние нижние лепестки отстают от покачивания
  const vel = (sway(t + 0.05) - sway(t - 0.05)) / 0.1;
  const rip = smooth((t - 8.0) / 2.0);
  for (let j = 0; j < NPET; j++) {
    let loose = (PETAL_SJ[j] - 0.45) / 0.55;
    loose = (loose < 0 ? 0 : loose > 1 ? 1 : loose) * PETAL_V[j] ** 2 * op;
    const ripple = 0.01 * Math.sin(t * 2.4 + PETAL_J[j] * 1.7) * rip;
    const o = (OFF_PET + j) * 3;
    BODY[o] += -0.1 * vel * loose;
    BODY[o + 1] += (ripple - 0.006 * Math.abs(vel)) * loose;
  }
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  for (let i = 0; i < NB; i++) {
    const o = i * 3;
    let x = BODY[o], z = BODY[o + 2];
    BODY[o] = cy * x + sy * z; BODY[o + 2] = -sy * x + cy * z;
    x = NORM[o]; z = NORM[o + 2];
    NORM[o] = cy * x + sy * z; NORM[o + 2] = -sy * x + cy * z;
  }

  const key = norm3([-0.35, 0.85, 0.65]);
  const rim = norm3([Math.cos(t * 0.8), 0.4, Math.sin(t * 0.8)]);
  const hk = norm3([key[0] + VIEW[0], key[1] + VIEW[1], key[2] + VIEW[2]]);
  const hr = norm3([rim[0] + VIEW[0], rim[1] + VIEW[1], rim[2] + VIEW[2]]);
  for (let i = 0; i < NB; i++) {
    const o = i * 3;
    const n0 = NORM[o], n1 = NORM[o + 1], n2 = NORM[o + 2];
    let diff = n0 * key[0] + n1 * key[1] + n2 * key[2];
    diff = diff < 0 ? 0 : diff > 1 ? 1 : diff;
    let a = n0 * hk[0] + n1 * hk[1] + n2 * hk[2];
    let b = n0 * hr[0] + n1 * hr[1] + n2 * hr[2];
    a = a < 0 ? 0 : a > 1 ? 1 : a;
    b = b < 0 ? 0 : b > 1 ? 1 : b;
    const spec = a ** 24 + 0.7 * b ** 18;
    const isPetal = KIND[i] >= PETAL;
    const depth = i < OFF_PET ? 1 : 0.74 + 0.26 * PETAL_SJ[i - OFF_PET];
    SHADE[i] = (0.62 + 0.6 * diff + (isPetal ? 0.35 : 0.25) * spec) * depth;
  }

  // роса на внешних лепестках
  if (op > 0.85) {
    for (let d = 0; d < 40; d++) {
      const idx = OUTER[Math.trunc(dew[d * 2] * OUTER.length)] + OFF_PET;
      let tw = Math.sin(t * 3 + dew[d * 2 + 1] * 30);
      tw = (tw < 0 ? 0 : tw > 1 ? 1 : tw) ** 8;
      if (tw > 0.4) KIND[idx] = GLINT;
      SHADE[idx] = Math.max(SHADE[idx], 0.6 + 0.6 * tw);
    }
  }

  const tipIdx = [];
  for (let i = 0; i < NB; i++) {
    if (KREV[i] < 0.96) {
      PART[i] = -2;
      SHADE[i] = TIP[i] ? 1.2 : 0.0;
      KIND[i] = TIP[i] ? GLINT : DUST;
    }
    if (TIP[i]) tipIdx.push(i);
  }

  // частицы: искры, блёстки, капли
  let nq = 0;
  if (tipIdx.length > 0 && t <= DRAW1 + 0.2) {
    for (let s = 0; s < 1600; s++) {
      const r = s * 5;
      const k = tipIdx[Math.trunc(spk[r] * tipIdx.length)];
      const age = (t * 1.7 + spk[r + 1]) % 1.0;
      const a = spk[r + 2] * TAU;
      const sp = 0.3 + 0.5 * spk[r + 3];
      const vx = Math.cos(a) * sp, vy = 0.3 + 0.7 * spk[r + 4], vz = Math.sin(a) * sp;
      const tt = age * 0.55;
      QP[nq * 3] = BODY[k * 3] + vx * tt;
      QP[nq * 3 + 1] = BODY[k * 3 + 1] + vy * tt - 0.5 * 1.4 * tt * tt;
      QP[nq * 3 + 2] = BODY[k * 3 + 2] + vz * tt;
      QS[nq] = (1 - age) ** 1.4 * (0.6 + 0.4 * Math.sin(age * 25 + a));
      QT[nq] = spk[r + 3] > 0.6 ? GLINT : DUST;
      nq++;
    }
  }
  const sparkEnd = nq;
  for (let s = 0; s < 700; s++) {
    const r = s * 5;
    const a = glit[r] * TAU + t * (0.05 + 0.08 * glit[r + 1]);
    const rad = 0.55 + 1.6 * glit[r + 2] ** 0.7;
    const y = -1.1 + 2.3 * glit[r + 3] + 0.05 * Math.sin(t * 0.6 + glit[r + 4] * TAU);
    QP[nq * 3] = Math.cos(a) * rad;
    QP[nq * 3 + 1] = y;
    QP[nq * 3 + 2] = Math.sin(a) * rad * 0.6 - 0.35;
    let tw = Math.sin(t * (1.2 + 2.5 * glit[r + 1]) + glit[r + 4] * 40);
    tw = (tw < 0 ? 0 : tw > 1 ? 1 : tw) ** 6;
    QS[nq] = (0.1 + 0.85 * tw) * smooth((t - 1.0 - glit[r + 3] * 3.0) / 1.5);
    QT[nq] = glit[r + 4] < 0.12 ? FIRE_B : glit[r + 4] < 0.3 ? FIRE_R : GLINT;
    nq++;
  }
  // padding to python order: [body, refl, glitter, sparks, drops]
  const drops = dewDrops(t);

  // ---- в клетки ----
  const cells = rows * cols;
  const part = new Int32Array(cells).fill(-1);
  const depth = new Float64Array(cells).fill(99);
  const lumR = new Float64Array(cells);
  const tag = new Int32Array(cells);
  const F = 2.9;
  const R0 = RIGHT[0], R1 = RIGHT[1], R2 = RIGHT[2], U0 = UP[0], U1 = UP[1], U2 = UP[2], F0 = FWD[0], F1 = FWD[1], F2 = FWD[2];
  const E0 = EYE[0], E1 = EYE[1], E2 = EYE[2];
  const kx = F * 0.5 * cols, ky = F * 0.5 * aspect * rows;
  // тело
  for (let i = 0; i < NB; i++) {
    if (PART[i] < 0) continue;
    const rx = BODY[i * 3] - E0, ry = BODY[i * 3 + 1] - E1, rz = BODY[i * 3 + 2] - E2;
    const z = rx * F0 + ry * F1 + rz * F2;
    if (!(z > 0.2)) continue;
    const ix = Math.trunc(0.5 * cols + ((rx * R0 + ry * R1 + rz * R2) / z) * kx);
    const iy = Math.trunc(0.5 * rows - ((rx * U0 + ry * U1 + rz * U2) / z) * ky);
    if (ix < 0 || ix >= cols || iy < 0 || iy >= rows) continue;
    const c = iy * cols + ix;
    if (z <= depth[c]) {
      depth[c] = z; part[c] = PART[i]; lumR[c] = SHADE[i]; tag[c] = KIND[i];
    }
  }

  const { edge, gx, gy } = outlines(part, depth, rows, cols);
  const char = new Int32Array(cells);
  const lum = new Float64Array(cells);
  const hh = new Int32Array(cells);
  const sparkle = new Uint8Array(cells);
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
      const inside = FILL[level][(h + Math.trunc(t * 4 + (h % 11))) % 12];
      char[i] = edge[i] ? outlineLetter(gx[i], gy[i]) : inside;
      if (tag[i] === GLINT) {
        sparkle[i] = 1;
        char[i] = AT["*"];
      }
      const l = lumR[i];
      lum[i] = edge[i] ? Math.max(0.85, l) : Math.min(Math.max(0.45 + (0.55 * l) / 0.9, 0.45), 1);
    }
  }

  // частицы и отражение — только в пустых клетках; ближняя побеждает
  let nv = 0;
  const pdepth = new Float64Array(cells).fill(Infinity);
  const pick = new Int32Array(cells).fill(-1);
  const addParticle = (x, y, z, s, tg) => {
    if (!(s > 0.02)) return;
    const rx = x - E0, ry = y - E1, rz = z - E2;
    const Z = rx * F0 + ry * F1 + rz * F2;
    if (!(Z > 0.2)) return;
    const ix = Math.trunc(0.5 * cols + ((rx * R0 + ry * R1 + rz * R2) / Z) * kx);
    const iy = Math.trunc(0.5 * rows - ((rx * U0 + ry * U1 + rz * U2) / Z) * ky);
    if (ix < 0 || ix >= cols || iy < 0 || iy >= rows) return;
    const c = iy * cols + ix;
    if (part[c] >= 0) return;
    if (nv >= VI.length) return;
    VI[nv] = iy; VJ[nv] = ix; VS[nv] = s; VT[nv] = tg; VZ[nv] = Z;
    if (Z <= pdepth[c]) { pdepth[c] = Z; pick[c] = nv; }
    nv++;
  };
  // порядок как в Python: тело с part=-2 (нераскрытое), отражение, блёстки, искры, капли
  for (let i = 0; i < NB; i++) if (PART[i] === -2) addParticle(BODY[i * 3], BODY[i * 3 + 1], BODY[i * 3 + 2], SHADE[i], KIND[i]);
  for (let i = 0; i < NB; i++) {
    if (KREV[i] < 0.96) continue;
    const rs = 0.18 * Math.min(Math.max(SHADE[i], 0), 1.2);
    addParticle(BODY[i * 3], 2 * FLOOR - BODY[i * 3 + 1], BODY[i * 3 + 2], rs, REFL);
  }
  for (let q = sparkEnd; q < nq; q++) addParticle(QP[q * 3], QP[q * 3 + 1], QP[q * 3 + 2], QS[q], QT[q]);
  for (let q = 0; q < sparkEnd; q++) addParticle(QP[q * 3], QP[q * 3 + 1], QP[q * 3 + 2], QS[q], QT[q]);
  for (const d of drops) addParticle(d[0], d[1], d[2], d[3], d[4]);

  for (let c = 0; c < cells; c++) {
    const k = pick[c];
    if (k < 0) continue;
    const fi = VI[k], fj = VJ[k], fs = VS[k], ft = VT[k];
    if (ft === REFL) {
      let lv = Math.trunc(fs * 6);
      lv = lv < 0 ? 0 : lv > 1 ? 1 : lv;
      char[c] = FILL[lv][(fi * 31 + fj) % 12];
    } else {
      char[c] = fs > 0.7 ? AT["*"] : fs > 0.35 ? AT["+"] : AT["."];
    }
    lum[c] = fs < 0 ? 0 : fs > 1 ? 1 : fs;
    tag[c] = ft;
  }

  // лучи: самые яркие блики, падающие капли, самая яркая пыль
  const scored = [];
  for (let i = 0; i < cells; i++) if (sparkle[i]) scored.push([lum[i] + (hh[i] % 7) * 0.01, i]);
  scored.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  for (let n = 0; n < Math.min(4, scored.length); n++) {
    if (scored[n][0] <= 0) break;
    const idx = scored[n][1];
    rays(char, lum, tag, Math.floor(idx / cols), idx % cols, Math.trunc(4 + 6 * (0.5 + 0.5 * Math.sin(t * 7 + n * 1.7))), rows, cols, 1);
  }
  // в Python fi/fj идут от дальних к ближним; сортируем только нужные
  const drp = [], brt = [];
  for (let k = 0; k < nv; k++) {
    if (VT[k] === FIRE_B && VS[k] > 1.0) drp.push(k);
    if (VS[k] > 0.9 && (VT[k] === GLINT || VT[k] === FIRE_B || VT[k] === FIRE_R)) brt.push(k);
  }
  const farFirst = (a, b) => VZ[b] - VZ[a] || a - b;
  drp.sort(farFirst);
  brt.sort(farFirst);
  for (const k of drp) rays(char, lum, tag, VI[k], VJ[k], 5, rows, cols, 1);
  for (const k of brt.slice(0, 5)) rays(char, lum, tag, VI[k], VJ[k], Math.trunc(2 + 3 * Math.min(VS[k], 1.1)), rows, cols, 0.6);
  const deg = (((yaw * 180) / Math.PI) % 360 + 360) % 360;
  return { char, lum, tag, info: { bloom: op, deg }, count };
}

function rays(char, lum, tag, cy, cx, reach, rows, cols, strength) {
  const AX = [[0, 1, "-"], [0, -1, "-"], [1, 0, "|"], [-1, 0, "|"]];
  const DG = [[1, 1, "\\"], [-1, -1, "\\"], [1, -1, "/"], [-1, 1, "/"]];
  for (let dist = 1; dist <= reach; dist++) {
    const fade = (1 - dist / (reach + 1)) * strength;
    for (const [dy, dx, ch] of AX) {
      const yy = cy + dy * dist, xx = cx + dx * dist * 2;
      if (yy >= 0 && yy < rows && xx >= 0 && xx < cols && lum[yy * cols + xx] < fade) {
        const i = yy * cols + xx;
        char[i] = AT[ch]; lum[i] = fade; tag[i] = GLINT;
      }
    }
    if (dist <= Math.floor(reach / 2)) {
      for (const [dy, dx, ch] of DG) {
        const yy = cy + dy * dist, xx = cx + dx * dist;
        if (yy >= 0 && yy < rows && xx >= 0 && xx < cols && lum[yy * cols + xx] < fade * 0.7) {
          const i = yy * cols + xx;
          char[i] = AT[ch]; lum[i] = fade * 0.7; tag[i] = GLINT;
        }
      }
    }
  }
  char[cy * cols + cx] = AT["*"];
  lum[cy * cols + cx] = 1.0;
}

// капли: висят на нижнем лепестке, падают, разбиваются брызгами
const DROP_T0 = [13.4, 14.9, 16.2, 17.4];
const G_DROP = 1.7;

function dewDrops(t) {
  const out = [];
  for (let d = 0; d < 4; d++) {
    const tau = t - DROP_T0[d];
    if (tau < 0) continue;
    const hang = 1.4;
    const o = (OFF_PET + DROP_AT[d]) * 3;
    const start = [BODY[o], BODY[o + 1] - 0.012, BODY[o + 2] + 0.01];
    if (tau < hang) {
      const g = 0.006 + (0.012 * tau) / hang;
      const s = 0.8 + (0.5 * tau) / hang;
      for (const [dx, dy] of [[0, 0], [g, 0], [-g, 0], [0, -g], [0, -2 * g]]) out.push([start[0] + dx, start[1] + dy, start[2], s, FIRE_B]);
      continue;
    }
    const u = tau - hang;
    const y = start[1] - 0.5 * G_DROP * u * u;
    if (y > FLOOR + 0.02) {
      const v = G_DROP * u;
      [0.0, 0.02, 0.04, 0.07, 0.1].forEach((back, j) => out.push([start[0], y + back * Math.min(v, 1.2), start[2], 1.3 - 0.22 * j, FIRE_B]));
    } else {
      const w = u - Math.sqrt((2 * (start[1] - FLOOR)) / G_DROP);
      if (w > 0.7) continue;
      for (let s = 0; s < 8; s++) {
        const a = splash[s * 2] * TAU;
        const sp = 0.25 + 0.35 * splash[s * 2 + 1];
        const py = FLOOR + 0.02 + 0.9 * sp * w - 0.5 * G_DROP * w * w;
        if (py >= FLOOR) out.push([start[0] + Math.cos(a) * sp * w, py, start[2] + Math.sin(a) * sp * w * 0.5, 0.9 * (1 - w / 0.7), FIRE_B]);
      }
    }
  }
  return out;
}

export const APP = {
  W: 1080, H: 960, CW: 9, CH: 14, TRAIL: 0.5, LOOP,
  COLORS: [[70, 214, 96], [52, 196, 84], [80, 206, 100], [255, 34, 64], [255, 120, 146], [255, 255, 255],
    [255, 176, 204], [188, 220, 255], [255, 214, 150], [140, 60, 76]].map((c) => c.map((v) => Math.fround(v / 255))),
  ATLAS,
  SIGN: "Raph · 2026",
  frame,
  hud: (info) => `bloom ${(info.bloom * 100).toFixed(1).padStart(5, " ")}%   sway ${info.deg.toFixed(2).padStart(6, "0")}°`,
};

if (typeof document !== "undefined") run(APP);

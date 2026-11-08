// Diamond Ring (WILL YOU) — порт diamond_ring.py на JavaScript.
import { AT, FILL, TAU, cellHash, doubles, linspace, outlineLetter, outlines, rays, run, smooth } from "./engine.js";
import { ATLAS, BURST, DUSTS, HALO, SPK, STARS } from "./data.js";

const LOOP = 20.0, BUILD = 3.2, TURN = 12.0, FLOOR = -0.78;
const BAND = 0, PRONG = 1, GEM = 2, GLINT = 3, FIRE_R = 4, FIRE_B = 5, FIRE_G = 6, DUST = 7, REFL = 8, STAR = 9;
const R_BAND = 0.55, TUBE = 0.065;
const GIRDLE_Y = 0.88, GIRDLE_R = 0.25, TABLE_Y = 1.0, TABLE_R = 0.135, CULET_Y = 0.66;
const DRAW0 = 0.3, DRAW1 = 5.6;

const norm3 = (v) => { const n = Math.hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const clip01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// ---- кольцо: ободок, лапки, камень ----
const P = [], N = [], PART = [], KIND = [], GEMF = [];

{ // ободок 44 x 520
  const A = linspace(0, TAU, 520, false), B = linspace(0, TAU, 44, false);
  for (let j = 0; j < 44; j++) {
    for (let i = 0; i < 520; i++) {
      const a = A[i], b = B[j];
      const rr = TUBE * (1 - 0.35 * clip01(Math.sin(a)) ** 6);
      const c = [Math.cos(a), Math.sin(a), 0];
      const n = [c[0] * Math.cos(b), c[1] * Math.cos(b), Math.sin(b)];
      P.push([c[0] * R_BAND + n[0] * rr, c[1] * R_BAND + n[1] * rr, n[2] * rr * 1.5]);
      N.push(norm3(n));
      PART.push(0); KIND.push(BAND); GEMF.push(0);
    }
  }
}
const N_BAND = P.length;
{ // 4 лапки
  const U = linspace(0, 1, 40), PH = linspace(0, TAU, 12, false);
  for (let k = 0; k < 4; k++) {
    const a = (TAU * (k + 0.5)) / 4;
    const base = [0.08 * Math.cos(a), R_BAND + 0.02, 0.08 * Math.sin(a)];
    const tip = [(GIRDLE_R + 0.015) * Math.cos(a), TABLE_Y - 0.03, (GIRDLE_R + 0.015) * Math.sin(a)];
    const d = norm3(sub(tip, base));
    const s = norm3(cross(d, [0, 0, 1]));
    const w = cross(s, d);
    for (let j = 0; j < 12; j++) {
      for (let i = 0; i < 40; i++) {
        const phi = PH[j], u = U[i];
        const n = [Math.cos(phi) * s[0] + Math.sin(phi) * w[0], Math.cos(phi) * s[1] + Math.sin(phi) * w[1], Math.cos(phi) * s[2] + Math.sin(phi) * w[2]];
        P.push([base[0] + u * (tip[0] - base[0]) + n[0] * 0.022, base[1] + u * (tip[1] - base[1]) + n[1] * 0.022, base[2] + u * (tip[2] - base[2]) + n[2] * 0.022]);
        N.push(n);
        PART.push(1); KIND.push(PRONG); GEMF.push(0);
      }
    }
  }
}
{ // камень: плоские грани
  const L = linspace(0, 1, 16);
  let k = 0;
  const facet = (a, b, c, n) => {
    const nn = norm3(n);
    for (let vi = 0; vi < 16; vi++) {
      for (let ui = 0; ui < 16; ui++) {
        const u = L[ui], v = L[vi];
        if (!(u + v <= 1)) continue;
        P.push([a[0] + (b[0] - a[0]) * u + (c[0] - a[0]) * v, a[1] + (b[1] - a[1]) * u + (c[1] - a[1]) * v, a[2] + (b[2] - a[2]) * u + (c[2] - a[2]) * v]);
        N.push(nn);
        PART.push(10 + k); KIND.push(GEM); GEMF.push(k);
      }
    }
    k++;
  };
  const m = 16;
  for (let i = 0; i < m; i++) {
    const a0 = (TAU * i) / m, a1 = (TAU * (i + 1)) / m;
    const g0 = [GIRDLE_R * Math.cos(a0), GIRDLE_Y, GIRDLE_R * Math.sin(a0)];
    const g1 = [GIRDLE_R * Math.cos(a1), GIRDLE_Y, GIRDLE_R * Math.sin(a1)];
    const t0 = [TABLE_R * Math.cos(a0), TABLE_Y, TABLE_R * Math.sin(a0)];
    const t1 = [TABLE_R * Math.cos(a1), TABLE_Y, TABLE_R * Math.sin(a1)];
    const culet = [0, CULET_Y, 0];
    let crown = cross(sub(g1, g0), sub(t0, g0));
    const sc = Math.sign(crown[1]) || 1;
    crown = crown.map((x) => x * sc);
    facet(g0, g1, t0, crown);
    facet(g1, t1, t0, [crown[0], crown[1] * 1.15, crown[2]]);
    let pav = cross(sub(culet, g0), sub(g1, g0));
    const sp = -Math.sign(pav[1]) || 1;
    pav = pav.map((x) => x * sp);
    facet(g0, g1, culet, pav);
    facet([0, TABLE_Y, 0], t0, t1, [0, 1, 0]);
  }
}
const NR = P.length;
const RP = new Float64Array(NR * 3), RN = new Float64Array(NR * 3);
for (let i = 0; i < NR; i++) for (let k = 0; k < 3; k++) { RP[i * 3 + k] = P[i][k]; RN[i * 3 + k] = N[i][k]; }

// порядок прорисовки 0 .. 1.7
const ORDER = new Float64Array(NR);
let ORDER_MAX = 0;
for (let i = 0; i < NR; i++) {
  const x = RP[i * 3], y = RP[i * 3 + 1];
  let o;
  if (KIND[i] === BAND) {
    let ang = Math.atan2(y, x) + Math.PI / 2;
    ang = Math.atan2(Math.sin(ang), Math.cos(ang)); // np.angle(exp(1j*a))
    o = Math.abs(ang) / Math.PI;
  } else if (KIND[i] === PRONG) o = 1.0 + ((y - R_BAND) / (TABLE_Y - R_BAND)) * 0.25;
  else o = 1.25 + ((y - CULET_Y) / (TABLE_Y - CULET_Y)) * 0.45;
  ORDER[i] = o;
  if (o > ORDER_MAX) ORDER_MAX = o;
}

const spk = doubles(SPK), burstR = doubles(BURST), halo = doubles(HALO), dusts = doubles(DUSTS), stars = doubles(STARS);
const NSPK = 2600;
const SPK_IDX = new Int32Array(NSPK), SPK_BORN = new Float64Array(NSPK);
for (let s = 0; s < NSPK; s++) {
  SPK_IDX[s] = Math.trunc(spk[s * 5] * NR);
  SPK_BORN[s] = DRAW0 + (ORDER[SPK_IDX[s]] / ORDER_MAX) * (DRAW1 - DRAW0);
}

const spin = (t) => (TAU * Math.max(t - DRAW1 - 0.6, 0)) / TURN;
const flash = (t) => Math.exp(-(((t - DRAW1 - 0.15) / 0.18) ** 2));

// камера
const EYE = [0, 0.85, 4.7];
const FWD = norm3(sub([0, 0.22, 0], EYE));
const RIGHT = norm3(cross(FWD, [0, 1, 0]));
const UP = cross(RIGHT, FWD);
const VIEW = [-FWD[0], -FWD[1], -FWD[2]];

const BODY = new Float64Array(NR * 3);
const SH = new Float64Array(NR), KD = new Int32Array(NR), PT = new Int32Array(NR), KREV = new Float64Array(NR);
const MAXV = 120000;
const VI = new Int32Array(MAXV), VJ = new Int32Array(MAXV), VT = new Int32Array(MAXV), VS = new Float64Array(MAXV);

function frame(t, cols, rows, aspect) {
  const yaw = spin(t);
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const key = norm3([0, 0.8, 0.6]);
  const rim = norm3([Math.cos(t * 0.9), 0.5, Math.sin(t * 0.9)]);
  const hk = norm3([key[0] + VIEW[0], key[1] + VIEW[1], key[2] + VIEW[2]]);
  const hr = norm3([rim[0] + VIEW[0], rim[1] + VIEW[1], rim[2] + VIEW[2]]);
  const head = ((t - DRAW0) / (DRAW1 - DRAW0)) * ORDER_MAX;
  const fireShift = Math.trunc(t * 7);
  const fl = 1 + 0.8 * flash(t);
  let glints = 0;
  for (let i = 0; i < NR; i++) {
    const o = i * 3;
    const x = RP[o], z = RP[o + 2];
    BODY[o] = cy * x + sy * z; BODY[o + 1] = RP[o + 1]; BODY[o + 2] = -sy * x + cy * z;
    const n0 = cy * RN[o] + sy * RN[o + 2], n1 = RN[o + 1], n2 = -sy * RN[o] + cy * RN[o + 2];
    const diff = clip01(n0 * key[0] + n1 * key[1] + n2 * key[2]);
    const spec = clip01(n0 * hk[0] + n1 * hk[1] + n2 * hk[2]) ** 30 + 0.9 * clip01(n0 * hr[0] + n1 * hr[1] + n2 * hr[2]) ** 24;
    const metal = KIND[i] !== GEM;
    let shade = metal ? 0.5 + 0.35 * diff + 0.9 * spec : 0.8 + 0.2 * diff + 1.4 * spec;
    let kind = KIND[i];
    if (!metal && spec > 0.18) {
      glints++;
      kind = [GLINT, FIRE_R, FIRE_B, FIRE_G][(GEMF[i] + fireShift) % 4];
    }
    if (metal && spec > 0.5) kind = GLINT;
    const k = smooth((head - ORDER[i]) / 0.06);
    const tip = Math.abs(head - ORDER[i]) < 0.035;
    KREV[i] = k;
    if (k < 0.96) {
      PT[i] = -2;
      shade = tip ? 1.2 : 0.0;
      kind = tip ? GLINT : DUST;
    } else PT[i] = PART[i];
    SH[i] = shade; // до вспышки (для отражения)
    KD[i] = kind;
  }

  const cells = rows * cols;
  const part = new Int32Array(cells).fill(-1);
  const depth = new Float64Array(cells).fill(99);
  const lumR = new Float64Array(cells);
  const tag = new Int32Array(cells);
  const F = 2.9;
  const R0 = RIGHT[0], R1 = RIGHT[1], R2 = RIGHT[2], U0 = UP[0], U1 = UP[1], U2 = UP[2], F0 = FWD[0], F1 = FWD[1], F2 = FWD[2];
  const kx = F * 0.5 * cols, ky = F * 0.5 * aspect * rows;
  let pz = 0, pix = 0, piy = 0;
  const project = (x, y, z) => {
    const rx = x - EYE[0], ry = y - EYE[1], rz = z - EYE[2];
    pz = rx * F0 + ry * F1 + rz * F2;
    if (!(pz > 0.2)) return false;
    pix = Math.trunc(0.5 * cols + ((rx * R0 + ry * R1 + rz * R2) / pz) * kx);
    piy = Math.trunc(0.5 * rows - ((rx * U0 + ry * U1 + rz * U2) / pz) * ky);
    return pix >= 0 && pix < cols && piy >= 0 && piy < rows;
  };
  for (let i = 0; i < NR; i++) {
    if (PT[i] < 0) continue;
    if (!project(BODY[i * 3], BODY[i * 3 + 1], BODY[i * 3 + 2])) continue;
    const c = piy * cols + pix;
    if (pz <= depth[c]) { depth[c] = pz; part[c] = PT[i]; lumR[c] = SH[i] * fl; tag[c] = KD[i]; }
  }

  const { edge, gx, gy } = outlines(part, depth, rows, cols, 0.02);
  const char = new Int32Array(cells), lum = new Float64Array(cells), hh = new Int32Array(cells), sparkle = new Uint8Array(cells);
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
      char[i] = edge[i] ? outlineLetter(gx[i], gy[i]) : FILL[level][(h + Math.trunc(t * 4 + (h % 11))) % 12];
      const tg = tag[i];
      if (tg === GLINT || tg === FIRE_R || tg === FIRE_B || tg === FIRE_G) { sparkle[i] = 1; char[i] = AT["*"]; }
      const l = lumR[i];
      lum[i] = edge[i] ? Math.max(0.75, l) : Math.min(Math.max(l, 0.3), 1);
    }
  }

  // частицы: ближняя в пустой клетке побеждает
  let nv = 0;
  const pdepth = new Float64Array(cells).fill(Infinity);
  const pick = new Int32Array(cells).fill(-1);
  const add = (x, y, z, s, tg) => {
    if (!(s > 0.02)) return;
    if (!project(x, y, z)) return;
    const c = piy * cols + pix;
    if (part[c] >= 0 || nv >= MAXV) return;
    VI[nv] = piy; VJ[nv] = pix; VS[nv] = s; VT[nv] = tg;
    if (pz <= pdepth[c]) { pdepth[c] = pz; pick[c] = nv; }
    nv++;
  };
  // [тело (нераскрытое), отражение, пыль, звёзды, искры, вспышка, орбиты]
  for (let i = 0; i < NR; i++) if (PT[i] === -2) add(BODY[i * 3], BODY[i * 3 + 1], BODY[i * 3 + 2], SH[i] * fl, KD[i]);
  for (let i = 0; i < NR; i++) {
    if (KREV[i] < 0.96) continue;
    add(BODY[i * 3], 2 * FLOOR - BODY[i * 3 + 1] - 0.06, BODY[i * 3 + 2], 0.22 * Math.min(Math.max(SH[i], 0), 1.2), REFL);
  }
  const dustOn = smooth((t - BUILD + 0.5) / 1.5);
  for (let d = 0; d < 520; d++) {
    const r = d * 4;
    const a = dusts[r] * TAU + t * (0.3 + 0.5 * dusts[r + 1]);
    const rad = 0.9 + 0.8 * dusts[r + 2];
    const y = ((dusts[r + 3] * 2.4 + t * 0.08) % 2.4) - 0.8;
    const tw = 0.25 + 0.75 * clip01(Math.sin(t * (2 + 3 * dusts[r + 1]) + dusts[r] * 40)) ** 4;
    add(Math.cos(a) * rad, y, Math.sin(a) * rad * 0.7, tw * dustOn, DUST);
  }
  for (let s = 0; s < 90; s++) {
    add(stars[s * 3] * 10 - 5, stars[s * 3 + 1] * 6 - 1.5, -6.0, 0.1 + 0.1 * Math.sin(t * 2 + stars[s * 3 + 2] * TAU), STAR);
  }
  for (let s = 0; s < NSPK; s++) {
    const r = s * 5;
    const age = t - SPK_BORN[s];
    const life = 0.9 + 0.9 * spk[r + 1];
    const alive = age > 0 && age < life ? 1 : 0;
    const a = spk[r + 2] * TAU;
    const sp = 0.4 + 0.6 * spk[r + 3];
    const o = SPK_IDX[s] * 3;
    const glow = clip01(1 - age / life) ** 1.3 * alive * (0.6 + 0.4 * Math.sin(age * 30 + a));
    add(RP[o] + Math.cos(a) * sp * age, RP[o + 1] + (0.5 + 0.9 * spk[r + 4]) * age - 0.5 * 2.2 * age * age, RP[o + 2] + Math.sin(a) * sp * age,
      glow, spk[r + 3] > 0.7 ? GLINT : DUST);
  }
  const kb = t - DRAW1 - 0.1;
  if (kb >= 0 && kb <= 2.2) {
    const glow = clip01(1 - kb / 2.2) ** 1.5;
    for (let s = 0; s < 700; s++) {
      const r = s * 3;
      const a = burstR[r] * TAU;
      const rad = 0.85 + 2.4 * (1 - Math.exp(-kb * 2.0)) * (0.97 + 0.06 * burstR[r + 1]);
      const b1 = burstR[r + 1];
      add(Math.cos(a) * rad, 0.42 + Math.sin(a) * rad, (burstR[r + 2] - 0.5) * 0.05 - 0.4, glow,
        b1 < 0.25 ? FIRE_R : b1 < 0.45 ? FIRE_B : b1 < 0.6 ? FIRE_G : GLINT);
    }
  }
  const on = smooth((t - DRAW1 - 0.3) / 1.5);
  if (on > 0) {
    const n = 450;
    for (let i = 0; i < 2; i++) {
      const tilt = i === 0 ? 0.55 : -0.55;
      const c = Math.cos(tilt), s = Math.sin(tilt);
      for (let j = 0; j < n; j++) {
        const q = i * n + j;
        const a = halo[q * 2] * TAU + t * (i === 0 ? 0.9 : -0.7);
        const x = Math.cos(a) * 1.05, y = Math.sin(a) * 0.32, z = Math.sin(a) * 0.95;
        const hd = (halo[q * 2] * 37 + t * 1.3) % 1.0;
        const glow = on * (0.15 + 0.85 * clip01(1 - hd * 3)) * (0.6 + 0.4 * Math.sin(t * 6 + halo[q * 2 + 1] * TAU));
        add(x * c - y * s, x * s + y * c + 0.42, z, glow, halo[q * 2 + 1] > 0.5 ? DUST : GLINT);
      }
    }
  }

  for (let c = 0; c < cells; c++) {
    const k = pick[c];
    if (k < 0) continue;
    const fi = VI[k], fj = VJ[k], fs = VS[k], ft = VT[k];
    let letter;
    if (ft === REFL) {
      let lv = Math.trunc(fs * 6);
      lv = lv < 0 ? 0 : lv > 1 ? 1 : lv;
      letter = FILL[lv][(fi * 31 + fj) % 12];
    } else if (ft === DUST) letter = fs > 0.7 ? AT["*"] : fs > 0.35 ? AT["+"] : AT["."];
    else if (ft === STAR) letter = AT["."];
    else letter = (fi + fj) % 3 === 0 ? AT["&"] : (fi + fj) % 3 === 1 ? AT["8"] : AT["%"];
    char[c] = letter;
    lum[c] = clip01(fs);
    tag[c] = ft;
  }

  // лучи от шести самых ярких бликов
  const scored = [];
  for (let i = 0; i < cells; i++) if (sparkle[i]) scored.push([lum[i] + (hh[i] % 7) * 0.01, i]);
  scored.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  for (let n = 0; n < Math.min(6, scored.length); n++) {
    if (scored[n][0] <= 0) break;
    const idx = scored[n][1];
    const pulse = 0.5 + 0.5 * Math.sin(t * 7 + n * 1.7);
    rays(char, lum, tag, Math.floor(idx / cols), idx % cols, Math.trunc(5 + 9 * pulse), rows, cols, 1, GLINT);
  }
  const deg = ((((yaw * 180) / Math.PI) % 360) + 360) % 360;
  return { char, lum, tag, info: { deg, glints }, count };
}

export const APP = {
  W: 1080, H: 960, CW: 6, CH: 9, TRAIL: 0.5, LOOP,
  COLORS: [[214, 220, 232], [232, 236, 244], [226, 238, 255], [255, 255, 255], [255, 170, 200],
    [160, 210, 255], [255, 230, 160], [255, 214, 140], [150, 150, 165], [120, 120, 140]].map((c) => c.map((v) => Math.fround(v / 255))),
  ATLAS,
  SIGN: "Raph · 2026",
  frame,
  hud: (info) => `rotation ${info.deg.toFixed(2).padStart(6, "0")}°   glints ${String(info.glints).padStart(4, " ")}`,
};

if (typeof document !== "undefined") run(APP);

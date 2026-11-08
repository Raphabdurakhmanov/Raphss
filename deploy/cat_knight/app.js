// Cat Knight — готовые 600 кадров из cat.bin.gz, рисуем их как в cat_knight.py
import { loadBinary, run } from "./engine.js";
import { ATLAS, COLORS, COUNT, WIND, ZOOM } from "./data.js";

const FPS = 30;
let N = 0, CELLS = 0, CHAR, LUM, TAG;

export async function init(buf) {
  const [n, rows, cols] = new Int32Array(buf.slice(0, 12));
  N = n;
  CELLS = rows * cols;
  const all = new Uint8Array(buf, 12);
  CHAR = all.subarray(0, n * CELLS);
  LUM = all.subarray(n * CELLS, 2 * n * CELLS);
  TAG = all.subarray(2 * n * CELLS, 3 * n * CELLS);
}

const char = new Int32Array(87 * 154), lum = new Float64Array(87 * 154), tag = new Int32Array(87 * 154);

function frame(t) {
  const i = Math.min(Math.trunc(t * FPS), N - 1);
  const o = i * CELLS;
  const last = COLORS.length - 1;
  for (let k = 0; k < CELLS; k++) {
    char[k] = CHAR[o + k];
    lum[k] = LUM[o + k] / 255;
    tag[k] = Math.min(TAG[o + k], last);
  }
  return { char, lum, tag, info: { i }, count: COUNT[i] };
}

export const APP = {
  W: 1080, H: 960, CW: 7, CH: 11, TRAIL: 0.4, LOOP: 600 / FPS, FPS,
  COLORS: COLORS.map((c) => c.map((v) => Math.fround(v))),
  ATLAS,
  SIGN: "Raph · 2026",
  frame,
  hud: (info) => `zoom ${ZOOM[info.i].toFixed(2)}   wind ${WIND[info.i].toFixed(2)}`,
  async init() {
    await init(await loadBinary("cat.bin.gz"));
  },
};

if (typeof document !== "undefined") APP.init().then(() => run(APP));

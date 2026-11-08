// Общий движок для всех работ: буквы -> пиксели, хвост, свечение, подписи, управление.
// Каждая работа даёт функцию frame(t) с тремя массивами (буква, яркость, цвет) на клетку.

function b64ToBytes(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function floats(s) {
  return new Float32Array(b64ToBytes(s).buffer);
}

export function doubles(s) {
  return new Float64Array(b64ToBytes(s).buffer);
}

export function ints(s) {
  return new Int32Array(b64ToBytes(s).buffer);
}

export function bytes(s) {
  return b64ToBytes(s);
}

// app = { W, H, CW, CH, TRAIL, COLORS: [[r,g,b] 0..1], ATLAS: base64 (n, CH, CW) uint8,
//         LOOP, FPS, SIGN, frame(t, cols, rows, aspect) -> {char, lum, tag, info, count}, hud(info, t) }
export function run(app) {
  const { W, H, CW, CH } = app;
  const FPS = app.FPS || 30;
  const COLS = Math.floor(W / CW);
  const ROWS = Math.floor(H / CH);
  const ASPECT = (COLS * CW) / (ROWS * CH);
  const atlas = bytes(app.ATLAS);
  const glyphSize = CW * CH;
  const nColors = app.COLORS.length;
  const fade = Math.floor(app.TRAIL * 255);

  const canvas = document.getElementById("view");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // слой с буквами (как self.trail в оригинале)
  const art = document.createElement("canvas");
  art.width = W;
  art.height = H;
  const artCtx = art.getContext("2d");
  const image = artCtx.createImageData(W, H);
  const px = image.data;
  for (let i = 3; i < px.length; i += 4) px[i] = 255;

  // свечение: уменьшить и растянуть обратно (как blur() в оригинале)
  const glowA = document.createElement("canvas");
  glowA.width = W / 4;
  glowA.height = H / 4;
  const glowB = document.createElement("canvas");
  glowB.width = W / 8;
  glowB.height = H / 8;
  const gA = glowA.getContext("2d");
  const gB = glowB.getContext("2d");
  const blurOk = typeof gA.filter === "string";

  const colR = new Uint8Array(COLS * ROWS);
  const colG = new Uint8Array(COLS * ROWS);
  const colB = new Uint8Array(COLS * ROWS);

  let t = 0;
  let paused = false;
  let last = null;
  let acc = 0;
  let result = null;

  function reset() {
    t = 0;
    for (let i = 0; i < px.length; i += 4) {
      px[i] = px[i + 1] = px[i + 2] = 0;
    }
  }

  function drawLetters() {
    result = app.frame(t, COLS, ROWS, ASPECT);
    const { char, lum, tag } = result;
    for (let i = 0; i < COLS * ROWS; i++) {
      let k = tag[i];
      if (k < 0) k = 0;
      else if (k >= nColors) k = nColors - 1;
      let l = lum[i];
      if (!(l > 0)) l = 0;
      else if (l > 1) l = 1;
      const c = app.COLORS[k];
      colR[i] = Math.floor(c[0] * l * 255);
      colG[i] = Math.floor(c[1] * l * 255);
      colB[i] = Math.floor(c[2] * l * 255);
    }
    // старый кадр гаснет, новый ложится сверху (max)
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const cell = row * COLS + col;
        const g0 = char[cell] * glyphSize;
        const r = colR[cell];
        const g = colG[cell];
        const b = colB[cell];
        for (let y = 0; y < CH; y++) {
          let p = ((row * CH + y) * W + col * CW) * 4;
          const gy = g0 + y * CW;
          for (let x = 0; x < CW; x++, p += 4) {
            const m = atlas[gy + x];
            const vr = (m * r + 255) >> 8;
            const vg = (m * g + 255) >> 8;
            const vb = (m * b + 255) >> 8;
            const fr = (px[p] * fade + 255) >> 8;
            const fg = (px[p + 1] * fade + 255) >> 8;
            const fb = (px[p + 2] * fade + 255) >> 8;
            px[p] = vr > fr ? vr : fr;
            px[p + 1] = vg > fg ? vg : fg;
            px[p + 2] = vb > fb ? vb : fb;
          }
        }
      }
    }
    // полоска снизу, куда клетки не попадают, тоже гаснет
    for (let p = ROWS * CH * W * 4; p < px.length; p += 4) {
      px[p] = (px[p] * fade + 255) >> 8;
      px[p + 1] = (px[p + 1] * fade + 255) >> 8;
      px[p + 2] = (px[p + 2] * fade + 255) >> 8;
    }
    artCtx.putImageData(image, 0, 0);
  }

  function glow(layer, lctx, amount, radius) {
    lctx.imageSmoothingEnabled = true;
    lctx.clearRect(0, 0, layer.width, layer.height);
    if (blurOk) lctx.filter = `blur(${radius}px)`;
    lctx.drawImage(art, 0, 0, layer.width, layer.height);
    if (blurOk) lctx.filter = "none";
    ctx.globalAlpha = amount;
    ctx.drawImage(layer, 0, 0, W, H);
  }

  function pad(n, width, digits) {
    return n.toFixed(digits).padStart(width, "0");
  }

  function drawScreen() {
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(art, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    glow(glowA, gA, 0.75, 1);
    glow(glowB, gB, 0.45, 2);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    ctx.font = '17px "DejaVu Sans Mono", Menlo, Consolas, monospace';
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    const y = H - 70;
    ctx.fillStyle = "rgb(120,112,128)";
    ctx.fillText(app.SIGN, 64, y - 26);
    ctx.fillStyle = "rgb(110,104,120)";
    ctx.fillText(app.hud(result.info, t), 64, y);
    const count = Math.max(0, result.count | 0);
    // как f"{count:05,d}" в Python: 488 -> 0,488
    const digits = String(count).padStart(4, "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    ctx.fillText(`letters ${digits}`, 64, y + 26);
    ctx.fillStyle = "rgb(255,122,182)";
    ctx.textAlign = "right";
    ctx.fillText(`${Math.floor(t * 2) % 2 === 0 ? "●" : " "} t ${pad(t, 5, 2)}s`, W - 64, 30);
  }

  function tick(now) {
    requestAnimationFrame(tick);
    if (last === null) last = now;
    acc += (now - last) / 1000;
    last = now;
    if (acc < 1 / FPS - 0.002) return; // как clock.tick(30)
    const dt = acc;
    acc = 0;
    if (!paused) {
      t += Math.min(dt, 1 / 15);
      if (t >= app.LOOP) reset();
      drawLetters();
    }
    drawScreen();
  }

  addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      paused = !paused;
      e.preventDefault();
    } else if (e.code === "KeyR") {
      reset();
    }
  });
  canvas.addEventListener("click", () => {
    paused = !paused;
  });

  drawLetters();
  drawScreen();
  requestAnimationFrame(tick);
}

// ---- маленькие помощники для портов с numpy ----

export const TAU = Math.PI * 2;

export function smooth(x) {
  x = x < 0 ? 0 : x > 1 ? 1 : x;
  return x * x * (3 - 2 * x);
}

export function clip(x, a, b) {
  return x < a ? a : x > b ? b : x;
}

export function linspace(a, b, n, endpoint = true) {
  const out = new Float64Array(n);
  const step = (b - a) / (endpoint ? n - 1 : n);
  for (let i = 0; i < n; i++) out[i] = a + step * i;
  if (endpoint && n > 1) out[n - 1] = b;
  return out;
}

export const CHARS = " .,:~+*^01|/\\-_#()x" + "1il!;:" + "rtfjcvxz=+" + "aeoun0{}[]<>" + "08B$#&%Q";
export const AT = {};
// в Python dict берёт последнее вхождение повторяющейся буквы
for (let i = 0; i < CHARS.length; i++) AT[CHARS[i]] = i;

const POOLS = ["1il!;:", "rtfjcvxz=+", "aeoun0{}[]<>", "08B$#&%Q"];
export const FILL = POOLS.map((p) => Array.from({ length: 12 }, (_, k) => AT[p[k % p.length]]));

export function outlineLetter(gx, gy) {
  const ax = Math.abs(gx);
  const ay = Math.abs(gy);
  if (ax + ay === 0) return AT["+"];
  if (ax > 2 * ay) return AT["|"];
  if (ay > 2 * ax) return gy > 0 ? AT["_"] : AT["-"];
  return gx * gy > 0 ? AT["/"] : AT["\\"];
}

// 8-соседи для контуров: клетка у пустоты или у другой части дальше
export function outlines(part, depth, rows, cols, gap = 0.035) {
  const n = rows * cols;
  const edge = new Uint8Array(n);
  const gx = new Float64Array(n);
  const gy = new Float64Array(n);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (part[i] < 0) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const rr = r + dy;
          const cc = c + dx;
          let nb = -1;
          let nz = 99;
          if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) {
            nb = part[rr * cols + cc];
            nz = depth[rr * cols + cc];
          }
          const out = nb < 0 || (nb !== part[i] && nz > depth[i] + gap);
          if (out) {
            gx[i] += dx;
            gy[i] += dy;
            if (dx === 0 || dy === 0) edge[i] = 1;
          }
        }
      }
    }
  }
  return { edge, gx, gy };
}

export function cellHash(r, c) {
  return (r * 7919 + c * 104729) % 9973;
}

// лучи-звёздочки от яркой клетки (как rays() в оригиналах)
export function rays(char, lum, tag, cy, cx, reach, rows, cols, strength, glintTag) {
  const AX = [[0, 1, AT["-"]], [0, -1, AT["-"]], [1, 0, AT["|"]], [-1, 0, AT["|"]]];
  const DG = [[1, 1, AT["\\"]], [-1, -1, AT["\\"]], [1, -1, AT["/"]], [-1, 1, AT["/"]]];
  for (let dist = 1; dist <= reach; dist++) {
    const fade = (1 - dist / (reach + 1)) * strength;
    for (const [dy, dx, ch] of AX) {
      const yy = cy + dy * dist, xx = cx + dx * dist * 2;
      if (yy >= 0 && yy < rows && xx >= 0 && xx < cols && lum[yy * cols + xx] < fade) {
        const i = yy * cols + xx;
        char[i] = ch; lum[i] = fade; tag[i] = glintTag;
      }
    }
    if (dist <= Math.floor(reach / 2)) {
      for (const [dy, dx, ch] of DG) {
        const yy = cy + dy * dist, xx = cx + dx * dist;
        if (yy >= 0 && yy < rows && xx >= 0 && xx < cols && lum[yy * cols + xx] < fade * 0.7) {
          const i = yy * cols + xx;
          char[i] = ch; lum[i] = fade * 0.7; tag[i] = glintTag;
        }
      }
    }
  }
  char[cy * cols + cx] = AT["*"];
  lum[cy * cols + cx] = 1.0;
}

// загрузка .bin / .bin.gz
// если сервер уже разжал файл сам (Content-Encoding: gzip), второй раз не разжимаем
export async function loadBinary(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url + ": " + res.status);
  const buf = await res.arrayBuffer();
  const head = new Uint8Array(buf, 0, 2);
  if (head[0] !== 0x1f || head[1] !== 0x8b) return buf;
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
}

// node tools/compare.mjs <app> <dump.json>
import fs from "fs";
const [app, dump] = process.argv.slice(2);
const mod = await import(`../${app}/app.js`);
const { APP } = mod;
// данные из .bin.gz для node читаем через zlib
if (mod.init) {
  const zlib = await import("zlib");
  const name = fs.readdirSync(new URL(`../${app}/`, import.meta.url)).find((f) => f.endsWith(".bin.gz"));
  const raw = zlib.gunzipSync(fs.readFileSync(new URL(`../${app}/${name}`, import.meta.url)));
  await mod.init(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
}
const ref = JSON.parse(fs.readFileSync(dump, "utf8"));
const cols = Math.floor(APP.W / APP.CW), rows = Math.floor(APP.H / APP.CH);
const aspect = (cols * APP.CW) / (rows * APP.CH);
for (const r of ref) {
  const t0 = performance.now();
  const f = APP.frame(r.t, cols, rows, aspect);
  const ms = performance.now() - t0;
  let dc = 0, dl = 0, dt = 0, nz = 0;
  for (let i = 0; i < r.char.length; i++) {
    if (r.char[i] !== f.char[i]) dc++;
    if (Math.abs(r.lum[i] - f.lum[i]) > 0.01) dl++;
    if (r.lum[i] > 0 && r.tag[i] !== f.tag[i]) dt++;
    if (r.char[i]) nz++;
  }
  console.log(`t=${r.t} ms=${ms.toFixed(1)} cells=${nz} char_diff=${dc} lum_diff=${dl} tag_diff=${dt} count ${r.count}/${f.count}`);
}
// скорость на прогретом JIT
{
  const t0 = performance.now(); let n = 0;
  for (let t = 0; t < 20; t += 0.25) { APP.frame(t, cols, rows, aspect); n++; }
  console.log(`avg ms/frame over full loop: ${((performance.now() - t0) / n).toFixed(1)}`);
}

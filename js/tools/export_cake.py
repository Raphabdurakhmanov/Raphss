import gzip, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from load_app import load
from atlas import atlas, b64
import numpy as np

g = load("birthday-cake")
P0, N0, T0, K0, ORDER, FLY, GRAIN = (g[k] for k in ["P0", "N0", "T0", "K0", "ORDER", "FLY", "GRAIN"])
n = len(P0)
fly_idx = np.flatnonzero(np.any(FLY != 0, axis=1)).astype(np.int32)
parts = [
    np.array([n, len(fly_idx)], np.int32).tobytes(),
    np.round(P0 * 10000).astype(np.int16).tobytes(),
    np.round(N0 * 127).astype(np.int8).tobytes(),
    T0.astype(np.uint8).tobytes(),
    K0.astype(np.uint8).tobytes(),
    np.round(ORDER * 50000).astype(np.uint16).tobytes(),
    np.round(GRAIN * 255).astype(np.uint8).tobytes(),
    fly_idx.tobytes(),
    FLY[fly_idx].astype(np.float32).tobytes(),
]
raw = b"".join(parts)
outdir = Path(__file__).resolve().parents[1] / "birthday-cake"
outdir.mkdir(exist_ok=True)
(outdir / "cake.bin.gz").write_bytes(gzip.compress(raw, 9))
print("points", n, "fly", len(fly_idx), "raw", len(raw), "gz", (outdir / "cake.bin.gz").stat().st_size)
print("P range", P0.min(), P0.max(), "ORDER", ORDER.min(), ORDER.max())

# конфетти и пламя (в оригинале — тот же random каждый кадр)
rng = np.random.default_rng(11)
conf = []
for i in range(110):
    x0, speed, delay = rng.uniform(0, g["COLS"]), rng.uniform(4, 9), rng.uniform(0, 5)
    amp, w, ph, col = rng.uniform(1, 4), rng.uniform(1, 2.5), rng.uniform(0, g["TAU"]), rng.choice(g["DOTS"])
    conf.append([x0, speed, delay, amp, w, ph, int(col)])
rng = np.random.default_rng(3)
u, v = rng.uniform(-1, 1, 900), rng.uniform(0, 1, 900)
(outdir / "data.js").write_text(
    "// сгенерировано tools/export_cake.py\n"
    f"export const ATLAS = \"{b64(atlas(g['CHARS'], g['CW'], g['CH'], g['FONT_PX']))}\";\n"
    f"export const WICK_TOP = {float(g['WICK_TOP'])!r};\n"
    f"export const CONFETTI = {json.dumps(conf)};\n"
    f"export const FLAME_U = \"{b64(u.astype(np.float64))}\";\n"
    f"export const FLAME_V = \"{b64(v.astype(np.float64))}\";\n"
)
print((outdir / "data.js").stat().st_size)

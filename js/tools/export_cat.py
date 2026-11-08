"""Cat Knight: кадры из npz -> cat.bin.gz (char, lum*255, tag) + data.js"""
import gzip
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from atlas import atlas, b64

ROOT = Path(__file__).resolve().parents[2]
f = np.load(ROOT / "CAT-KNIGHT" / "cat_knight_frames.npz")
char, tag = f["char"], f["tag"]
lum = np.round(np.clip(f["lum"].astype(np.float32), 0, 1) * 255).astype(np.uint8)
n, rows, cols = char.shape
head = np.array([n, rows, cols], np.int32).tobytes()
# порядок: все char, потом все lum, потом все tag — так сжимается лучше
raw = head + char.tobytes() + lum.tobytes() + tag.tobytes()
out = Path(__file__).resolve().parents[1] / "cat-knight"
out.mkdir(exist_ok=True)
(out / "cat.bin.gz").write_bytes(gzip.compress(raw, 9))
chars = " .,:~+*^01|/\\-_#()x" + "1il!;:" + "rtfjcvxz=+" + "aeoun0{}[]<>" + "08B$#&%Q"
(out / "data.js").write_text(
    "// сгенерировано tools/export_cat.py\n"
    f"export const ATLAS = \"{b64(atlas(chars, 7, 11, 12))}\";\n"
    f"export const COLORS = {np.round(f['colors'].astype(float), 6).tolist()};\n"
    f"export const ZOOM = {np.round(f['zoom'].astype(float), 4).tolist()};\n"
    f"export const WIND = {np.round(f['wind'].astype(float), 4).tolist()};\n"
    f"export const COUNT = {f['count'].tolist()};\n"
)
print("frames", n, rows, cols, "raw", len(raw), "gz", (out / "cat.bin.gz").stat().st_size)

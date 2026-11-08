import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from load_app import load
from atlas import atlas, b64
import numpy as np

g = load("diamond-ring")
f64 = lambda a: b64(np.asarray(a, np.float64))
out = Path(__file__).resolve().parents[1] / "diamond-ring" / "data.js"
out.parent.mkdir(exist_ok=True)
out.write_text(
    "// сгенерировано tools/export_diamond.py\n"
    f"export const ATLAS = \"{b64(atlas(g['CHARS'], g['CW'], g['CH'], g['FONT_PX']))}\";\n"
    + "".join(f"export const {k} = \"{f64(g[k])}\";\n" for k in ["SPK", "BURST", "HALO", "DUSTS", "STARS"])
)
print(out, out.stat().st_size, len(g["RING_P"]), g["COLS"], g["ROWS"], len(g["GEM_P"]))

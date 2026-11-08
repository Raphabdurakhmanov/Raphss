import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from load_app import load
from atlas import atlas, b64
import numpy as np

g = load("rose")
f64 = lambda a: b64(np.asarray(a, np.float64))
out = Path(__file__).resolve().parents[1] / "rose" / "data.js"
out.parent.mkdir(exist_ok=True)
out.write_text(
    "// сгенерировано tools/export_rose.py\n"
    f"export const ATLAS = \"{b64(atlas(g['CHARS'], g['CW'], g['CH'], g['FONT_PX']))}\";\n"
    f"export const SPK = \"{f64(g['SPK'])}\";\n"
    f"export const GLITTER = \"{f64(g['GLITTER'])}\";\n"
    f"export const DEW = \"{f64(g['DEW'])}\";\n"
    f"export const SPLASH = \"{f64(g['SPLASH'])}\";\n"
    f"export const DROP_AT = {[int(x) for x in g['DROP_AT']]};\n"
)
print(out, out.stat().st_size, g['DROP_AT'], g['COLS'], g['ROWS'])

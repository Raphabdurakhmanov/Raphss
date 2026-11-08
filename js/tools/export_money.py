import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from load_app import load
from atlas import atlas, b64
import numpy as np

g = load("money-rain")
bills = [{k: float(v) for k, v in b.items()} for b in g["BILLS"]]
out = Path(__file__).resolve().parents[1] / "money-rain" / "data.js"
out.parent.mkdir(exist_ok=True)
out.write_text(
    "// сгенерировано tools/export_money.py\n"
    f"export const ATLAS = \"{b64(atlas(g['CHARS'], g['CW'], g['CH'], g['FONT_PX']))}\";\n"
    f"export const BILLS = {json.dumps(bills)};\n"
    f"export const PATTERN = \"{b64(g['PATTERN'].astype(np.int32))}\";\n"
)
print(out, out.stat().st_size)

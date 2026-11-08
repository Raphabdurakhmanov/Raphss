"""Считает кадры оригинальным Python-кодом и сохраняет для сравнения с JS."""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from load_app import load

app, times, out = sys.argv[1], [float(x) for x in sys.argv[2].split(",")], sys.argv[3]
g = load(app)
res = []
for t in times:
    char, lum, tag, info, count = g["frame"](t, g["COLS"], g["ROWS"], g["ASPECT"])
    res.append({"t": t, "char": char.ravel().astype(int).tolist(), "lum": [round(float(x), 4) for x in lum.ravel()],
                "tag": tag.ravel().astype(int).tolist(), "count": int(count)})
Path(out).write_text(json.dumps(res))

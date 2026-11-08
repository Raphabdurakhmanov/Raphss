"""Собирает готовые к хостингу папки deploy/<работа>/ (Vercel, Netlify и т.д.).

То же, что делает pygbag --build: index.html + <работа>.apk (zip с assets/).
Запуск: python scripts/build_static.py
"""
import struct
import zipfile
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = (ROOT / "web" / "pygbag-index.tmpl.html").read_text(encoding="utf-8")

APPS = {
    "rose": "IN BLOOM · Raph",
    "cat-knight": "CAT KNIGHT · Raph",
    "money-rain": "MONEY RAIN · Raph",
    "birthday-cake": "HAPPY BIRTHDAY · Raph",
    "diamond-ring": "WILL YOU · Raph",
}
EXTRA = {"cat-knight": [ROOT / "CAT-KNIGHT" / "cat_knight_frames.npz"]}
FONTS = sorted((ROOT / "web" / "fonts").glob("*.ttf"))


def favicon():
    # простая иконка 16x16: розовая точка на чёрном
    w = h = 16
    rows = b""
    for y in range(h):
        rows += b"\x00"
        for x in range(w):
            inside = (x - 7.5) ** 2 + (y - 7.5) ** 2 < 30
            rows += bytes((255, 122, 182) if inside else (0, 0, 0))

    def chunk(kind, data):
        c = kind + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b""))


for app, title in APPS.items():
    out = ROOT / "deploy" / app
    out.mkdir(parents=True, exist_ok=True)
    html = TEMPLATE.replace("{APP}", app).replace("{TITLE}", title)
    (out / "index.html").write_text(html, encoding="utf-8")
    (out / "favicon.png").write_bytes(favicon())
    with zipfile.ZipFile(out / f"{app}.apk", "w", zipfile.ZIP_DEFLATED) as z:
        z.write(ROOT / "web" / app / "main.py", "assets/main.py")
        for f in FONTS + EXTRA.get(app, []):
            z.write(f, f"assets/{f.name}")
    print(app, "->", out.relative_to(ROOT), round((out / f"{app}.apk").stat().st_size / 1024), "KB")

"""Собирает JS-версии в deploy/<работа>/ — готовые статические сайты.

python js/tools/build.py
"""
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
JS = ROOT / "js"
DEPLOY = ROOT / "deploy"
FONT = JS / "fonts" / "DejaVuSansMono.ttf"

APPS = {
    "rose": "IN BLOOM · Raph",
    "cat-knight": "CAT KNIGHT · Raph",
    "money-rain": "MONEY RAIN · Raph",
    "birthday-cake": "HAPPY BIRTHDAY · Raph",
    "diamond-ring": "WILL YOU · Raph",
}

# один и тот же vercel.json и в корне, и в каждой папке:
# Vercel всегда ищет папку deploy — если её нет (Root Directory = deploy/<работа>), копируем туда текущую папку
VERCEL_JSON = (ROOT / "vercel.json").read_text(encoding="utf-8")

# галерея со ссылками на все работы
shutil.copy(JS / "gallery.html", DEPLOY / "index.html")
(DEPLOY / "vercel.json").write_text(VERCEL_JSON, encoding="utf-8")

template = (JS / "index.tmpl.html").read_text(encoding="utf-8")

for app, title in APPS.items():
    src = JS / app
    if not (src / "app.js").exists():
        print("skip", app, "(ещё нет JS-версии)")
        continue
    out = DEPLOY / app
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    # движок кладём рядом и правим путь импорта
    shutil.copy(JS / "engine.js", out / "engine.js")
    for f in src.iterdir():
        if f.suffix in (".js", ".bin", ".gz") and f.name != "app.test.js":
            text = None
            if f.suffix == ".js":
                text = f.read_text(encoding="utf-8").replace('from "../engine.js"', 'from "./engine.js"')
                (out / f.name).write_text(text, encoding="utf-8")
            else:
                shutil.copy(f, out / f.name)
    shutil.copy(FONT, out / FONT.name)
    if app == "birthday-cake":
        shutil.copy(FONT.with_name("DejaVuSans-Bold.ttf"), out / "DejaVuSans-Bold.ttf")
    shutil.copy(JS / "favicon.png", out / "favicon.png")
    (out / "index.html").write_text(template.replace("{TITLE}", title), encoding="utf-8")
    (out / "vercel.json").write_text(VERCEL_JSON, encoding="utf-8")
    size = sum(f.stat().st_size for f in out.iterdir()) // 1024
    print(app, "->", out.relative_to(ROOT), size, "KB")

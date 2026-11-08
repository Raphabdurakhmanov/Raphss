"""Загружает оригинальный .py работы без pygame (для экспорта данных и тестов)."""
import runpy
import sys
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
FILES = {
    "rose": "ROSE/rose.py",
    "money-rain": "MONEY-RAIN/money_rain.py",
    "birthday-cake": "BIRTHDAY-CAKE/birthday_cake.py",
    "diamond-ring": "DIAMOND-RING/diamond_ring.py",
    "cat-knight": "CAT-KNIGHT/cat_knight.py",
}


def load(app):
    sys.modules.setdefault("pygame", mock.MagicMock())
    return runpy.run_path(str(ROOT / FILES[app]), run_name="not_main")

"""Глифы букв (белым на чёрном) для каждой работы — как glyphs() в оригинале, только через Pillow."""
import base64
import numpy as np
from PIL import Image, ImageDraw, ImageFont

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"


def atlas(chars, cw, ch, px):
    font = ImageFont.truetype(FONT, px)
    asc, desc = font.getmetrics()
    out = []
    for c in chars:
        im = Image.new("L", (cw, ch), 0)
        w = font.getlength(c)
        # как pygame: картинка символа высотой asc+desc, по центру ячейки
        x = (cw - round(w)) // 2
        y = (ch - (asc + desc)) // 2
        ImageDraw.Draw(im).text((x, y), c, font=font, fill=255)
        out.append(np.asarray(im, np.uint8))
    return np.stack(out)  # (n, ch, cw)


def b64(arr):
    return base64.b64encode(np.ascontiguousarray(arr).tobytes()).decode()

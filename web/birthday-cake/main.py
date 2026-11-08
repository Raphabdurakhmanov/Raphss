# Birthday Cake
# Raph, 2026. Free to use for personal projects, see LICENSE.txt.
#
#   pip install -r requirements.txt
#   python birthday_cake.py
#
# Space pause, R restart, S screenshot, Esc quit

import asyncio
import sys
import time
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pygame

TAU = np.pi * 2
LOOP = 18.0         # length of one run (s)
BUILD = 3.4         # cake is drawn in by this time

POOLS = ["1il!;:", "rtfjcvxz=+", "aeoun0{}[]<>", "08B$#&%Q"]   # dark -> bright
CHARS = " .,:~+*^01|/\\-_#()x" + "".join(POOLS)
AT = {c: i for i, c in enumerate(CHARS)}
FILL = np.array([[AT[p[k % len(p)]] for k in range(12)] for p in POOLS])

SPONGE, CRUST, CREAM, FROST, RED, RED_HI, PLATE, GOLD, CORE, FLAME, GLOW, WICK, LIT_S, LIT_F, HAPPY, BDAY = range(16)
DOTS = np.arange(16, 22)    # sprinkle / confetti colours


def smooth(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


def rot_y(p, a):
    c, s = np.cos(a), np.sin(a)
    return np.stack([c * p[:, 0] + s * p[:, 2], p[:, 1], -s * p[:, 0] + c * p[:, 2]], 1)


# camera

def camera(eye, target):
    eye, target = np.asarray(eye, float), np.asarray(target, float)
    fwd = (target - eye) / np.linalg.norm(target - eye)
    right = np.cross(fwd, [0, 1.0, 0])
    right /= np.linalg.norm(right)
    up = np.cross(right, fwd)

    def look(P):
        rel = P - eye
        return rel @ right, rel @ up, rel @ fwd, -fwd
    return look


look = camera(eye=(1.0, 2.6, 7.0), target=(1.0, 1.45, 0))
F = 2.9     # lens


# cake slice: a wedge of a round cake, two sponge layers with cream between

R, FT, TOP = 1.6, 0.08, 0.98        # radius, frosting thickness, height
A0, A1 = np.radians(-28), np.radians(30)
CANDLE = np.array([0.62 * R, 0.0, 0.0])


def ring(a):
    return np.stack([np.cos(a), 0 * a, -np.sin(a)], -1)


def frosting(x, z):
    # height of the top: piped ridge near the edge + swirl around the candle
    r, a = np.hypot(x, z), np.arctan2(-z, x)
    edge = 0.15 * np.exp(-((r - 1.3) / 0.26) ** 2) * (0.55 + 0.45 * np.sin(a * 22 - r * 14))
    d = np.hypot(x - CANDLE[0], z - CANDLE[2])
    swirl = 0.2 * np.exp(-(d / 0.34) ** 2) * (0.6 + 0.4 * np.sin(np.arctan2(z, x - CANDLE[0]) * 3 + d * 30))
    return TOP + 0.04 + edge + swirl


def cake():
    rng = np.random.default_rng(7)
    P, N, T, K = [], [], [], []

    def add(p, n, t, k):
        P.append(p), N.append(n), T.append(np.broadcast_to(t, len(p))), K.append(np.broadcast_to(k, len(p)))

    # cut faces
    for a, side in ((A0, 1), (A1, -1)):
        n = 9000
        r, y = rng.uniform(0, R + FT, n), rng.uniform(0, TOP, n)
        p = r[:, None] * ring(np.full(n, a)) + y[:, None] * [0, 1, 0]
        crust = (y < 0.05) | ((y > 0.37) & (y < 0.42)) | ((y > 0.56) & (y < 0.6)) | ((y > 0.9) & (y < 0.95))
        cream = (y > 0.42) & (y < 0.56)
        frost = (y >= 0.95) | (r > R)
        t = np.where(frost, FROST, np.where(cream, CREAM, np.where(crust, CRUST, SPONGE)))
        k = np.where(frost, 3, np.where(cream, 2, 1))
        add(p, np.tile(side * np.array([np.sin(a), 0, np.cos(a)]), (n, 1)), t, k)

    # outer side
    n = 9000
    a, y = rng.uniform(A0, A1, n), rng.uniform(0, TOP + 0.04, n)
    p = (R + FT + 0.025 * np.sin(a * 40 + y * 9))[:, None] * ring(a) + y[:, None] * [0, 1, 0]
    add(p, ring(a), FROST, 3)

    # top
    n = 12000
    r, a = (R + FT) * np.sqrt(rng.uniform(0, 1, n)), rng.uniform(A0, A1, n)
    xz = r[:, None] * ring(a)
    x, z, e = xz[:, 0], xz[:, 2], 0.01
    y = frosting(x, z)
    nr = np.stack([-(frosting(x + e, z) - y) / e, np.ones(n), -(frosting(x, z + e) - y) / e], 1)
    add(np.stack([x, y, z], 1), nr / np.linalg.norm(nr, axis=1, keepdims=True), FROST, 3)

    # candle (twisted stripes) and wick
    base = frosting(CANDLE[0], CANDLE[2]) - 0.05
    n = 2500
    a, y = rng.uniform(0, TAU, n), rng.uniform(0, 0.62, n)
    rad = np.stack([np.cos(a), 0 * a, np.sin(a)], 1)
    add(CANDLE + 0.075 * rad + (base + y)[:, None] * [0, 1, 0], rad,
        np.where(np.sin(a + y * 16) > 0.45, RED_HI, RED), 4)
    w = np.linspace(0, 0.07, 30)
    add(CANDLE + (base + 0.62 + w)[:, None] * [0, 1, 0], np.tile([0, 0, 1.0], (30, 1)), WICK, 4)

    # plate with a scalloped gold rim
    n, rp = 9000, 1.3
    a, u = rng.uniform(0, TAU, n), np.sqrt(rng.uniform(0, 1, n))
    rim = rp + 0.06 * np.sin(a * 12)
    r = u * rim
    p = np.stack([1.0 + r * np.cos(a), -0.02 + 0.06 * u ** 4, r * np.sin(a)], 1)
    add(p, np.tile([0, 1.0, 0], (n, 1)), np.where(u > 0.93, GOLD, PLATE), 0)
    a, y = rng.uniform(0, TAU, 3000), rng.uniform(-0.1, 0.04, 3000)
    rim = rp + 0.06 * np.sin(a * 12)
    add(np.stack([1.0 + rim * np.cos(a), y, rim * np.sin(a)], 1),
        np.stack([np.cos(a), 0 * a, np.sin(a)], 1), GOLD, 0)

    # sprinkles: on top, then a few on the plate
    for i in range(110):
        if i < 90:
            r, a = rng.uniform(0.25, R, 1), rng.uniform(A0 + 0.05, A1 - 0.05, 1)
            c = (r[:, None] * ring(a))[0]
            if np.hypot(*(c - CANDLE)[[0, 2]]) < 0.12:
                continue
            c[1] = frosting(c[0], c[2]) + 0.02
        else:
            a, r = rng.uniform(1.2, 4.6), rng.uniform(0.95, 1.2)
            c = np.array([1.0 + r * np.cos(a), 0.0, r * np.sin(a)])
        d = rng.normal(size=3) * [1, 0.3, 1]
        s = np.linspace(-0.06, 0.06, 10)[:, None]
        add(c + s * d / np.linalg.norm(d), np.tile([0, 1.0, 0], (10, 1)), rng.choice(DOTS), 5)

    P, N, T, K = (np.concatenate(v) for v in (P, N, T, K))
    order = (P[:, 1] + 0.12) / 2.3 + rng.uniform(0, 0.1, len(P))            # build from the bottom up
    fly = np.where(rng.uniform(0, 1, len(P))[:, None] < 1 / 30, rng.normal(size=(len(P), 3)) * 2.2, 0)
    return P, N, T.astype(int), K.astype(int), order, fly, base + 0.69


P0, N0, T0, K0, ORDER, FLY, WICK_TOP = cake()
GRAIN = np.where(np.isin(T0, (SPONGE, CRUST)), np.random.default_rng(5).uniform(0.6, 1.0, len(T0)), 1.0)
CENTER = np.array([1.0, 0, 0])


# candle flame

def flicker(t):
    return 0.82 + 0.1 * np.sin(t * 13) + 0.06 * np.sin(t * 29 + 1) + 0.04 * np.sin(t * 47 + 2)


def flame(t, tip, grow, f):
    rng = np.random.default_rng(3)
    u, v = rng.uniform(-1, 1, 900), rng.uniform(0, 1, 900)
    width = 0.15 * np.sin(np.pi * v ** 0.75) * (1 - 0.35 * v)
    lean = 0.05 * np.sin(t * 2.3) + 0.02 * np.sin(t * 7)
    hgt = 0.6 * f * grow
    p = tip + np.stack([u * width * grow + lean * v ** 2, (v - 0.12) * hgt, 0 * u + 0.05], 1)
    core = (np.abs(u) < 0.5) & (v < 0.62)
    return p, np.where(core, CORE, FLAME), np.where(core, 1.0, 0.82)


def project(p, cols, rows, aspect):
    x, y, z, _ = look(p[None])
    return int((0.5 - y[0] / z[0] * F * 0.5 * aspect) * rows), int((0.5 + x[0] / z[0] * F * 0.5) * cols)


# HAPPY / BIRTHDAY

FONT_FILE = Path(__file__).with_name("DejaVuSans-Bold.ttf")
TEXT = {}
HEAVY = {}


def heavy_font(px):
    if px not in HEAVY:
        HEAVY[px] = pygame.font.Font(str(FONT_FILE), px)
    return HEAVY[px]


def word(text, cols, rows, scale, cy):
    # coverage of each letter cell, 0..1
    key = (text, cols, rows, round(scale, 2))
    if key not in TEXT:
        surf = pygame.Surface((cols * 9, rows * 14))
        g = heavy_font(int(136 * scale)).render(text, True, (255, 255, 255))
        surf.blit(g, g.get_rect(center=(int(cols * 4.5), int(cy * 14))))
        im = pygame.surfarray.array3d(surf)[:, :, 0].T.astype(np.float32)
        TEXT[key] = im.reshape(rows, 14, cols, 9).mean((1, 3)) / 255
    return TEXT[key]


def pop(p):
    # ease out with a little overshoot
    c1 = 1.70158
    q = p - 1
    return 1 + (c1 + 1) * q ** 3 + c1 * q ** 2


# points -> letters

def outline_letter(gx, gy):
    ax, ay = np.abs(gx), np.abs(gy)
    c = np.where(ax > 2 * ay, AT["|"], np.where(ay > 2 * ax, np.where(gy > 0, AT["_"], AT["-"]),
                 np.where(gx * gy > 0, AT["/"], AT["\\"])))
    return np.where((ax + ay) == 0, AT["+"], c)


def raster(t, cols, rows, aspect, P, shade, T, K):
    x, y, z, _ = look(P)
    zz = np.maximum(z, 0.2)
    sx = (0.5 + x / zz * F * 0.5) * cols
    sy = (0.5 - y / zz * F * 0.5 * aspect) * rows
    order = np.argsort(-z)                              # far to near
    sx, sy, z, shade, T, K = sx[order], sy[order], z[order], shade[order], T[order], K[order]
    ix, iy = sx.astype(int), sy.astype(int)
    ok = (ix >= 0) & (ix < cols) & (iy >= 0) & (iy < rows) & (z > 0.2)

    part = np.full((rows, cols), -1)
    depth = np.full((rows, cols), 99.0)
    lum = np.zeros((rows, cols))
    tag = np.zeros((rows, cols), int)
    part[iy[ok], ix[ok]], depth[iy[ok], ix[ok]] = K[ok], z[ok]
    lum[iy[ok], ix[ok]], tag[iy[ok], ix[ok]] = shade[ok], T[ok]
    body = part >= 0

    # outline: cells next to empty space or to another part further back
    pp = np.pad(part, 1, constant_values=-1)
    pd = np.pad(depth, 1, constant_values=99)
    edge = np.zeros_like(body)
    gx = np.zeros((rows, cols))
    gy = np.zeros((rows, cols))
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dx == dy == 0:
                continue
            nb = pp[1 + dy:rows + 1 + dy, 1 + dx:cols + 1 + dx]
            nz = pd[1 + dy:rows + 1 + dy, 1 + dx:cols + 1 + dx]
            out = body & ((nb < 0) | ((nb != part) & (nz > depth + 0.035)))
            gx += dx * out
            gy += dy * out
            if dx == 0 or dy == 0:
                edge |= out

    r, c = np.mgrid[0:rows, 0:cols]
    h = (r * 7919 + c * 104729) % 9973                  # fixed per-cell hash
    level = np.clip((lum * 3.2).astype(int), 0, 3)
    fill = FILL[level, (h + (t * 4 + h % 11).astype(int)) % 12]
    char = np.where(body, np.where(edge, outline_letter(gx, gy), fill), 0)
    lum = np.where(body, np.where(edge, np.maximum(0.5, lum), np.clip(lum, 0, 1)), 0)
    return SimpleNamespace(char=char, lum=lum, tag=tag, body=body, h=h, rows=rows, cols=cols, count=int(body.sum()))


def rays(g, cy, cx, reach, glint_tag, diag=0.7):
    # four-point star
    char, lum, tag, rows, cols = g.char, g.lum, g.tag, g.rows, g.cols
    for dist in range(1, reach + 1):
        fade = 1 - dist / (reach + 1)
        for (dy, dx, ch) in ((0, 1, "-"), (0, -1, "-"), (1, 0, "|"), (-1, 0, "|")):
            yy, xx = cy + dy * dist, cx + dx * dist * 2
            if 0 <= yy < rows and 0 <= xx < cols and lum[yy, xx] < fade:
                char[yy, xx], lum[yy, xx], tag[yy, xx] = AT[ch], fade, glint_tag
        if dist <= reach // 2:
            for (dy, dx, ch) in ((1, 1, "\\"), (-1, -1, "\\"), (1, -1, "/"), (-1, 1, "/")):
                yy, xx = cy + dy * dist, cx + dx * dist
                if 0 <= yy < rows and 0 <= xx < cols and lum[yy, xx] < fade * diag:
                    char[yy, xx], lum[yy, xx], tag[yy, xx] = AT[ch], fade * diag, glint_tag
    char[cy, cx], lum[cy, cx] = AT["*"], 1.0


# one frame

def frame(t, cols, rows, aspect):
    turn = 0.95 + 0.08 * np.sin(t * 0.5)
    P = rot_y(P0 - CENTER, turn) + CENTER
    N = rot_y(N0, turn)
    head = (t - 0.2) / (BUILD - 0.2) * 1.25
    rev = smooth((head - ORDER) / 0.12)
    P = P + (1 - rev)[:, None] * FLY

    on = smooth((t - 4.4) / 0.8)
    f = flicker(t)
    tip = rot_y((CANDLE + [0, WICK_TOP, 0] - CENTER)[None], turn)[0] + CENTER
    light = tip + [0.03 * np.sin(t * 2.3), 0.18, 0.05]

    # key light + warm candle light that only reaches what is close
    view = look(P)[3]
    key = np.array([-0.5, 0.8, 0.6]) / np.linalg.norm([-0.5, 0.8, 0.6])
    rim = np.array([0.8, 0.3, -0.5])
    diff = np.clip(N @ key, 0, 1)
    half_k = (key + view) / np.linalg.norm(key + view)
    half_r = (rim + view) / np.linalg.norm(rim + view)
    spec = np.clip(N @ half_k, 0, 1) ** 24 + 0.7 * np.clip(N @ half_r, 0, 1) ** 18
    d = light - P
    dist = np.linalg.norm(d, axis=1)
    glow = on * f * (0.3 + 0.7 * np.clip((N * d).sum(1) / dist, 0, 1)) * np.exp(-(dist / 1.6) ** 2) * 1.3
    shade = (0.3 + 0.45 * diff + 0.12 * spec + 0.45 * glow) * rev * GRAIN * np.where(K0 == 0, 0.6, 1.0)
    T = np.where(glow > 0.3, np.where(np.isin(T0, (SPONGE, CRUST)), LIT_S,
                                      np.where(T0 == FROST, LIT_F, T0)), T0)
    keep = rev > 0.01
    P, shade, T, K = P[keep], shade[keep], T[keep], K0[keep]

    grow = smooth((t - 4.3) / 0.7)
    if grow > 0:
        fp, ft, fs = flame(t, tip, grow, f)
        P, shade = np.concatenate([P, fp]), np.concatenate([shade, fs * (0.6 + 0.4 * grow)])
        T, K = np.concatenate([T, ft]), np.concatenate([K, np.full(len(fp), 6)])

    g = raster(t, cols, rows, aspect, P, shade, T, K)
    char, lum, tag = g.char, g.lum, g.tag
    r, c = np.mgrid[0:rows, 0:cols]
    h = g.h

    # texture: crumbs in the sponge, waves in the cream
    inner = g.body & ~np.isin(char, [AT[x] for x in "/|\\-_+"])
    crumb = np.array([AT[x] for x in "o0ae.:o0"])[(h + int(t * 2) * (h % 3 == 0)) % 8]
    wave = np.where(h % 5 == 0, AT["^"], AT["~"])
    texture = {SPONGE: crumb, LIT_S: crumb, CRUST: AT["="], CREAM: AT["~"], FROST: wave, LIT_F: wave,
               PLATE: np.where(h % 4 == 0, AT[":"], AT["."]), GOLD: AT["="]}
    for k, ch in texture.items():
        char = np.where(inner & (tag == k), ch, char)
    lum = np.where(inner & (tag == CREAM), np.maximum(lum, 0.85), lum)
    lum = np.where(g.body & (tag == PLATE), lum * 0.8, lum)

    # halo around the flame
    cy, cx = project(light, cols, rows, aspect)
    if on > 0:
        rg = (6 + 1.5 * f) * on
        fall = 1 - np.hypot(r - cy, (c - cx) * 9 / 14) / rg
        halo = (char == 0) & (fall > 0) & ((h + int(t * 9)) % 3 != 0)
        char = np.where(halo, np.where(fall < 0.4, AT["."], np.where(fall < 0.7, AT[":"], AT["+"])), char)
        lum = np.where(halo, 0.6 * fall * on * f, lum)
        tag = np.where(halo, GLOW, tag)

    # sparks while it lights
    if 4.3 < t < 5.4:
        k = (t - 4.3) / 1.1
        for i in range(14):
            a = i * 2.4 + k * 3
            sy, sx = int(cy + 2 - k * 7 * (0.6 + 0.4 * (i % 3)) + np.sin(a) * 2), int(cx + np.cos(a) * (2 + k * 9))
            if 0 <= sy < rows and 0 <= sx < cols and char[sy, sx] == 0:
                char[sy, sx], lum[sy, sx], tag[sy, sx] = AT["*" if i % 2 else "+"], 1 - k, CORE

    # confetti
    pieces = 0
    rng = np.random.default_rng(11)
    for i in range(110):
        x0, speed, delay = rng.uniform(0, cols), rng.uniform(4, 9), rng.uniform(0, 5)
        amp, w, ph, col = rng.uniform(1, 4), rng.uniform(1, 2.5), rng.uniform(0, TAU), rng.choice(DOTS)
        age = t - 6.2 - delay
        if age < 0:
            continue
        y = int(age * speed % (rows + 4)) - 2
        x = int(x0 + amp * np.sin(w * t + ph))
        if 0 <= y < rows and 0 <= x < cols and (char[y, x] == 0 or tag[y, x] == GLOW):
            spin = "-/|\\"[int(t * w * 3 + ph) % 4] if i % 7 else "o"
            char[y, x], lum[y, x], tag[y, x] = AT[spin], 0.85, col
            pieces += 1

    # the words
    for text, ts, row, tg in (("HAPPY", 8.0, 0.09, HAPPY), ("BIRTHDAY", 8.55, 0.21, BDAY)):
        p = np.clip((t - ts) / 0.5, 0, 1)
        if p <= 0:
            continue
        cov = word(text, cols, rows, 1.55 - 0.55 * pop(p), rows * row)
        on_t = (cov > 0.45) & ((h % 997) / 997 < smooth(p * 1.6))
        gx = -(np.roll(cov, -1, 1) - np.roll(cov, 1, 1))
        gy = -(np.roll(cov, -1, 0) - np.roll(cov, 1, 0))
        edge = on_t & ((np.roll(cov, 1, 0) < 0.45) | (np.roll(cov, -1, 0) < 0.45) |
                       (np.roll(cov, 1, 1) < 0.45) | (np.roll(cov, -1, 1) < 0.45))
        fill = FILL[3, (h + int(t * 4) + h % 11) % 12]
        char = np.where(on_t, np.where(edge, outline_letter(gx * 10, gy * 10), fill), char)
        shine = 0.8 + 0.2 * np.sin(t * 3 - c * 0.12)
        lum = np.where(on_t, np.clip(shine * (1 + 0.5 * (1 - p)), 0, 1), lum)
        tag = np.where(on_t, tg, tag)

    g.char, g.lum, g.tag = char, lum, tag
    if t > 9.6:
        lit = np.argwhere(tag == HAPPY)
        for n in range(2):
            q = int(t * 1.3 + n * 0.5)
            if len(lit):
                sy, sx = lit[(q * 7919 + n * 104729) % len(lit)]
                rays(g, int(sy), int(sx), int(2 + 4 * np.sin((t * 1.3 + n * 0.5) % 1 * np.pi)), CORE)

    info = {"candle": "lit" if on > 0.5 else "off", "flame": float(f * on), "confetti": pieces}
    return g.char, g.lum, g.tag, info, g.count


# window

TITLE = "Birthday Cake - Raph"
SIGN = "Raph · 2026"
CW, CH, FONT_PX = 9, 14, 15
W, H = 1080, 960
COLS, ROWS = W // CW, H // CH
ASPECT = (COLS * CW) / (ROWS * CH)
TRAIL = 0.4
COLORS = np.array([
    [236, 160, 52], [150, 84, 36], [255, 250, 238], [255, 246, 232],     # sponge, crust, cream, frosting
    [240, 50, 70], [255, 140, 150], [232, 222, 206], [228, 176, 84],     # candle x2, plate, gold
    [255, 250, 228], [255, 158, 52], [255, 184, 96], [90, 70, 60],       # flame core, flame, glow, wick
    [255, 184, 72], [255, 226, 168], [255, 212, 138], [255, 176, 204],   # lit sponge, lit frosting, words
    [255, 96, 160], [70, 160, 255], [60, 200, 110], [255, 214, 50], [255, 128, 40], [245, 245, 255],
], np.float32) / 255
DIM, PINK = (110, 104, 120), (255, 122, 182)
MONO = "consolas,menlo,dejavusansmono,couriernew,monospace"


def hud(info):
    return f"candle {info['candle']}   flame {info['flame']:.2f}   confetti {info['confetti']}"


def glyphs():
    font = pygame.font.Font(str(Path(__file__).with_name("DejaVuSansMono.ttf")), FONT_PX)
    atlas = []
    for ch in CHARS:
        s = pygame.Surface((CW, CH))
        g = font.render(ch, True, (255, 255, 255))
        s.blit(g, ((CW - g.get_width()) // 2, (CH - g.get_height()) // 2))
        atlas.append(pygame.surfarray.array3d(s)[:, :, 0].T.astype(np.float32) / 255)
    return np.stack(atlas)


class Canvas:
    def __init__(self, atlas):
        self.atlas = (atlas * 255).astype(np.uint8)
        self.shape = pygame.Surface((COLS * CW, ROWS * CH))
        self.trail = pygame.Surface((W, H))
        self.fade = (int(TRAIL * 255),) * 3

    def reset(self):
        self.trail.fill((0, 0, 0))

    def draw(self, t):
        char, lum, tag, info, count = frame(t, COLS, ROWS, ASPECT)
        mask = self.atlas[char.T].transpose(0, 3, 1, 2).reshape(COLS * CW, ROWS * CH)
        pygame.surfarray.blit_array(self.shape, np.repeat(mask[..., None], 3, 2))
        col = (COLORS[np.clip(tag, 0, len(COLORS) - 1)] * np.clip(lum, 0, 1)[..., None] * 255).astype(np.uint8)
        tint = pygame.transform.scale(pygame.surfarray.make_surface(col.transpose(1, 0, 2)), self.shape.get_size())
        self.shape.blit(tint, (0, 0), special_flags=pygame.BLEND_MULT)
        self.trail.fill(self.fade, special_flags=pygame.BLEND_MULT)     # previous frame fades
        self.trail.blit(self.shape, (0, 0), special_flags=pygame.BLEND_MAX)
        return self.trail, info, count


def blur(surf, k, radius):
    small = pygame.transform.smoothscale(surf, (W // k, H // k))
    if hasattr(pygame.transform, "gaussian_blur"):
        small = pygame.transform.gaussian_blur(small, max(1, radius // k))
    return pygame.transform.smoothscale(small, (W, H))


def glow_layer(surf, amount):
    layer = surf.copy()
    layer.fill((int(255 * amount),) * 3, special_flags=pygame.BLEND_MULT)
    return layer


def window_size():
    # в браузере страница сама масштабирует холст
    return W, H


async def main():
    pygame.init()
    size = window_size()
    window = pygame.display.set_mode(size)
    pygame.display.set_caption(TITLE)
    screen = pygame.Surface((W, H))
    small = pygame.font.Font(str(Path(__file__).with_name("DejaVuSansMono.ttf")), 17)
    canvas, clock = Canvas(glyphs()), pygame.time.Clock()
    t, paused = 0.0, False
    art, info, count = canvas.draw(t)
    while True:
        for e in pygame.event.get():
            if e.type == pygame.QUIT or (e.type == pygame.KEYDOWN and e.key == pygame.K_ESCAPE):
                pygame.quit()
                return
            if e.type == pygame.KEYDOWN and e.key == pygame.K_SPACE:
                paused = not paused
            if e.type == pygame.KEYDOWN and e.key == pygame.K_r:
                t = 0.0
                canvas.reset()
            if e.type == pygame.KEYDOWN and e.key == pygame.K_s:
                pygame.image.save(screen, str(Path(__file__).with_name(f"cake_{int(time.time())}.png")))
        dt = clock.tick(30) / 1000
        if not paused:
            t += min(dt, 1 / 15)
            if t > LOOP:
                t = 0.0
                canvas.reset()
            art, info, count = canvas.draw(t)
        screen.fill((0, 0, 0))
        screen.blit(art, (0, 0))
        screen.blit(glow_layer(blur(art, 4, 5), 0.75), (0, 0), special_flags=pygame.BLEND_ADD)
        screen.blit(glow_layer(blur(art, 8, 22), 0.45), (0, 0), special_flags=pygame.BLEND_ADD)
        y = H - 70
        screen.blit(small.render(SIGN, True, (120, 112, 128)), (64, y - 26))
        screen.blit(small.render(hud(info), True, DIM), (64, y))
        screen.blit(small.render(f"letters {count:05,d}", True, DIM), (64, y + 26))
        tt = small.render(f"{'●' if int(t * 2) % 2 == 0 else ' '} t {t:05.2f}s", True, PINK)
        screen.blit(tt, (W - 64 - tt.get_width(), 30))
        window.blit(screen if size == (W, H) else pygame.transform.smoothscale(screen, size), (0, 0))
        pygame.display.flip()
        await asyncio.sleep(0)  # отдаём ход браузеру, иначе вкладка зависнет


asyncio.run(main())

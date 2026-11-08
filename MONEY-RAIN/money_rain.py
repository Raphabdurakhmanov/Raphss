# Money Rain
# Raph, 2026. Free to use for personal projects, see LICENSE.txt.
#
#   pip install -r requirements.txt
#   python money_rain.py
#
# Space pause, R restart, S screenshot, Esc quit

import sys
import time
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pygame

TAU = np.pi * 2
LOOP = 20.0         # length of one run (s)

POOLS = ["1il!;:", "rtfjcvxz=+", "aeoun0{}[]<>", "08B$#&%Q"]   # dark -> bright
CHARS = " .,:~+*^01|/\\-_#()x" + "".join(POOLS)
AT = {c: i for i, c in enumerate(CHARS)}
FILL = np.array([[AT[p[k % len(p)]] for k in range(12)] for p in POOLS])

PAPER, INK, BORDER, PORTRAIT, FACE, NUM, SEAL = range(7)
TONE = np.array([0.95, 0.6, 0.75, 0.62, 1.0, 0.9, 0.9])


def rot(ax, ay, az):
    cx, sx, cy, sy, cz, sz = np.cos(ax), np.sin(ax), np.cos(ay), np.sin(ay), np.cos(az), np.sin(az)
    rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return rz @ ry @ rx


# camera

def camera(eye, target):
    eye, target = np.asarray(eye, float), np.asarray(target, float)
    fwd = (target - eye) / np.linalg.norm(target - eye)
    right = np.cross(fwd, [0, 1.0, 0])
    right /= np.linalg.norm(right)
    up = np.cross(right, fwd)

    def look(P):
        rel = P - eye
        return rel @ right, rel @ up, rel @ fwd
    return look


look = camera(eye=(0, 0, 7.5), target=(0, 0, 0))
F = 2.9     # lens


# one note: a grid of points with a printed pattern

GU, GV = np.meshgrid(np.linspace(-1, 1, 72), np.linspace(-1, 1, 32))
U, V = GU.ravel(), GV.ravel()
HALF_L, HALF_W = 1.0, 0.42                      # about 2.35 : 1


def bill_pattern(u, v):
    tag = np.full(len(u), PAPER)
    oval = ((u - 0.05) / 0.3) ** 2 + (v / 0.62) ** 2 < 1
    face = ((u - 0.05) / 0.17) ** 2 + ((v - 0.08) / 0.36) ** 2 < 1
    corner = (np.abs(np.abs(u) - 0.76) < 0.1) & (np.abs(np.abs(v) - 0.58) < 0.18)
    seal = ((u + 0.52) / 0.12) ** 2 + (v / 0.26) ** 2 < 1
    frame = ((np.abs(u) > 0.84) & (np.abs(u) < 0.88)) | ((np.abs(v) > 0.72) & (np.abs(v) < 0.78))
    tag[frame | (np.abs(np.abs(v) - 0.3) < 0.03) & (np.abs(u) < 0.6) & ~oval] = INK
    tag[seal] = SEAL
    tag[corner] = NUM
    tag[oval] = PORTRAIT
    tag[face] = FACE
    tag[(np.abs(u) > 0.93) | (np.abs(v) > 0.86)] = BORDER
    return tag


PATTERN = bill_pattern(U, V)


# sixteen notes, each with its own place, depth, speed and wobble

rng = np.random.default_rng(17)
BILLS = [dict(x=(k * 0.618 % 1) * 4.8 - 2.4, z=rng.uniform(-3.0, 1.2), speed=rng.uniform(0.55, 0.9),
              delay=k * 0.62 + rng.uniform(0, 0.25), sway=rng.uniform(0.3, 0.7), w=rng.uniform(0.7, 1.3),
              ph=rng.uniform(0, TAU), spin=rng.choice([-1, 1]) * rng.uniform(0.4, 1.1)) for k in range(16)]
TOP, FALL = 3.4, 7.2                              # enter above the frame, leave below it


def bill(b, t):
    # soft S-curve rolling along the note
    ph = b["ph"] + t * 2.2 * b["w"]
    bend = 0.16 * np.sin(U * 2.2 + ph) + 0.08 * U ** 2
    slope = 0.16 * 2.2 * np.cos(U * 2.2 + ph) + 0.16 * U
    p = np.stack([U * HALF_L, V * HALF_W, bend * HALF_L], 1)
    n = np.stack([-slope, 0 * U, np.ones_like(U)], 1)
    n /= np.linalg.norm(n, axis=1, keepdims=True)
    r = rot(0.9 * np.sin(t * 1.3 * b["w"] + b["ph"]), t * b["spin"] + b["ph"], 0.5 * np.sin(t * 0.9 * b["w"] + b["ph"] * 2))
    u = (t - b["delay"]) * b["speed"] / FALL                   # < 0: not in the air yet
    y = TOP - (u % 1.0) * FALL
    x = b["x"] + b["sway"] * np.sin(t * 1.1 * b["w"] + b["ph"])
    return p @ r.T + [x, y, b["z"]], n @ r.T, u >= 0


# points -> letters

def outline_letter(gx, gy):
    ax, ay = np.abs(gx), np.abs(gy)
    c = np.where(ax > 2 * ay, AT["|"], np.where(ay > 2 * ax, np.where(gy > 0, AT["_"], AT["-"]),
                 np.where(gx * gy > 0, AT["/"], AT["\\"])))
    return np.where((ax + ay) == 0, AT["+"], c)


def raster(t, cols, rows, aspect, P, shade, T, K):
    x, y, z = look(P)
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

    # outline: cells next to empty space or to another note further back
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
    lum = np.where(body, np.where(edge, np.maximum(0.55, lum), np.clip(lum * 1.5, 0, 1)), 0)
    return SimpleNamespace(char=char, lum=lum, tag=tag, body=body, h=h, count=int(body.sum()))


# one frame

def frame(t, cols, rows, aspect):
    P, N, T, K = [], [], [], []
    for k, b in enumerate(BILLS):
        p, n, live = bill(b, t)
        if not live:
            continue
        P.append(p), N.append(n), T.append(PATTERN), K.append(np.full(len(p), k))
    if not P:
        z = np.zeros((rows, cols), int)
        return z, z.astype(float), z, {"bills": 0, "falling": 0.0}, 0
    P, N, T, K = (np.concatenate(a) for a in (P, N, T, K))

    key = np.array([-0.3, 0.7, 0.65]) / np.linalg.norm([-0.3, 0.7, 0.65])
    side = np.abs(N @ key)                                   # both sides catch light
    depth = np.clip(0.55 + 0.45 * (P[:, 2] + 3.5) / 5.3, 0.4, 1.0)
    shade = (0.55 + 0.45 * side) * TONE[T] * depth

    g = raster(t, cols, rows, aspect, P, shade, T, K)
    r, c = np.mgrid[0:rows, 0:cols]
    inner = g.body & ~np.isin(g.char, [AT[x] for x in "/|\\-_+"])
    texture = {PAPER: np.where(r % 2, AT["~"], AT["-"]), INK: AT["="], BORDER: AT["#"],
               PORTRAIT: FILL[3, (g.h + int(t * 3)) % 12], FACE: np.where(g.h % 3, AT["o"], AT["e"]),
               NUM: np.array([AT["1"], AT["0"], AT["0"]])[c % 3], SEAL: AT["$"]}
    for k, ch in texture.items():
        g.char = np.where(inner & (g.tag == k), ch, g.char)
    info = {"bills": len(BILLS), "falling": round(float(np.mean([b["speed"] for b in BILLS])), 2)}
    return g.char, g.lum, g.tag, info, g.count


# window

TITLE = "Money Rain - Raph"
SIGN = "Raph · 2026"
CW, CH, FONT_PX = 9, 14, 15
W, H = 1080, 960
COLS, ROWS = W // CW, H // CH
ASPECT = (COLS * CW) / (ROWS * CH)
TRAIL = 0.35
COLORS = np.array([
    [226, 240, 214], [96, 176, 116], [150, 210, 146], [92, 160, 108],     # paper, ink, border, portrait
    [238, 242, 222], [176, 236, 176], [126, 222, 166],                    # face, numbers, seal
], np.float32) / 255
DIM, PINK = (110, 104, 120), (255, 122, 182)
MONO = "consolas,menlo,dejavusansmono,couriernew,monospace"


def hud(info):
    return f"bills {info['bills']}   falling {info['falling']:.2f}"


def glyphs():
    font = pygame.font.SysFont(MONO, FONT_PX)
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
    # shrink on small / scaled displays
    info = pygame.display.Info()
    k = 1.0
    if info.current_w > 0 and info.current_h > 0:
        k = min(1.0, 0.85 * info.current_h / H, 0.95 * info.current_w / W)
    return int(W * k), int(H * k)


def main():
    pygame.init()
    size = window_size()
    window = pygame.display.set_mode(size)
    pygame.display.set_caption(TITLE)
    screen = pygame.Surface((W, H))
    small = pygame.font.SysFont(MONO, 17)
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
                pygame.image.save(screen, str(Path(__file__).with_name(f"money_{int(time.time())}.png")))
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


if __name__ == "__main__":
    sys.exit(main())

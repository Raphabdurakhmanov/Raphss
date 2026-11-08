# Cat Knight
# Raph, 2026. Full code, shared for personal projects, see LICENSE.txt.
#
#   pip install -r requirements.txt
#   python cat_knight.py
#
# Space pause, R restart, S screenshot, Esc quit
#
# The kitten knight was drawn in letters from a photo that isn't mine,
# so the photo is not included. cat_knight_frames.npz holds the finished
# letters of all 600 frames, and this file draws them in a window.

import sys
import time
from pathlib import Path

import numpy as np
import pygame

TITLE = "Cat Knight - Raph"
SIGN = "Raph · 2026"
FPS = 30
CW, CH, FONT_PX = 7, 11, 12              # one letter cell, in pixels
W, H = 1080, 960
COLS, ROWS = W // CW, H // CH
TRAIL = 0.4                              # how much of the last frame stays behind
DIM, PINK = (110, 104, 120), (255, 122, 182)
MONO = "consolas,menlo,dejavusansmono,couriernew,monospace"

POOLS = ["1il!;:", "rtfjcvxz=+", "aeoun0{}[]<>", "08B$#&%Q"]   # dark -> bright
CHARS = " .,:~+*^01|/\\-_#()x" + "".join(POOLS)

DATA = Path(__file__).with_name("cat_knight_frames.npz")
if not DATA.exists():
    sys.exit("cat_knight_frames.npz should sit next to this file.")
FRAMES = np.load(DATA)
LETTERS = FRAMES["char"]                 # (600, rows, cols) index into CHARS
LIGHT = FRAMES["lum"].astype(np.float32)  # brightness of each letter, 0..1
TONE = FRAMES["tag"]                     # index into COLORS
COLORS = FRAMES["colors"]                # the colours of the knight, the cape and the grass
ZOOM, WIND, COUNT = FRAMES["zoom"], FRAMES["wind"], FRAMES["count"]
LOOP = len(LETTERS) / FPS


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

    def draw(self, i):
        # letters in white, then tinted with their colour and brightness
        mask = self.atlas[LETTERS[i].T].transpose(0, 3, 1, 2).reshape(COLS * CW, ROWS * CH)
        pygame.surfarray.blit_array(self.shape, np.repeat(mask[..., None], 3, 2))
        col = (COLORS[np.clip(TONE[i], 0, len(COLORS) - 1)] * np.clip(LIGHT[i], 0, 1)[..., None] * 255).astype(np.uint8)
        tint = pygame.transform.scale(pygame.surfarray.make_surface(col.transpose(1, 0, 2)), self.shape.get_size())
        self.shape.blit(tint, (0, 0), special_flags=pygame.BLEND_MULT)
        self.trail.fill(self.fade, special_flags=pygame.BLEND_MULT)     # previous frame fades
        self.trail.blit(self.shape, (0, 0), special_flags=pygame.BLEND_MAX)
        return self.trail


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
    t, paused, i = 0.0, False, 0
    art = canvas.draw(0)
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
                pygame.image.save(screen, str(Path(__file__).with_name(f"cat_knight_{int(time.time())}.png")))
        dt = clock.tick(FPS) / 1000
        if not paused:
            t += min(dt, 1 / 15)
            if t >= LOOP:
                t = 0.0
                canvas.reset()
            i = min(int(t * FPS), len(LETTERS) - 1)
            art = canvas.draw(i)
        screen.fill((0, 0, 0))
        screen.blit(art, (0, 0))
        screen.blit(glow_layer(blur(art, 4, 5), 0.75), (0, 0), special_flags=pygame.BLEND_ADD)
        screen.blit(glow_layer(blur(art, 8, 22), 0.45), (0, 0), special_flags=pygame.BLEND_ADD)
        y = H - 70
        screen.blit(small.render(SIGN, True, (120, 112, 128)), (64, y - 26))
        screen.blit(small.render(f"zoom {ZOOM[i]:.2f}   wind {WIND[i]:.2f}", True, DIM), (64, y))
        screen.blit(small.render(f"letters {int(COUNT[i]):05,d}", True, DIM), (64, y + 26))
        tt = small.render(f"{'●' if int(t * 2) % 2 == 0 else ' '} t {t:05.2f}s", True, PINK)
        screen.blit(tt, (W - 64 - tt.get_width(), 30))
        window.blit(screen if size == (W, H) else pygame.transform.smoothscale(screen, size), (0, 0))
        pygame.display.flip()


if __name__ == "__main__":
    sys.exit(main())

"""Build the Motivado logo: the traced wordmark with a yellow play button in place of the "o".

Usage: python tools/make_logo.py <press logo jpg, 2500 px wide> apps/web/public
Writes logo.svg, a transparent logo.png (860 px) and favicon.ico next to it.
Needs numpy and Pillow only. The lettering is traced from the press logo (letters = the dark pixels);
the play button replaces the ring symbol that used to sit between the "m" and the "t".
"""
import sys

import numpy as np
from PIL import Image, ImageDraw

SRC = sys.argv[1]
OUT_DIR = sys.argv[2].rstrip('/')

LETTERS = '#3c4046'
PLAY = '#ffcd2c'         # yellow disc, the accent of the site
TRIANGLE = '#3c4046'
# the disc sits where the "o" belongs: between the m (ends x=477) and the t (starts x=818), on the x-height
CX, CY, R = 647.0, 331.0, 142.0

im = np.array(Image.open(SRC).convert('RGB')).astype(np.int32)
H, W, _ = im.shape
charcoal_mask = (im.max(axis=2) < 100).astype(np.float32)
# nothing of the old ring symbol may remain inside the disc region
yy, xx = np.mgrid[0:H, 0:W]
charcoal_mask[(xx - CX) ** 2 + (yy - CY) ** 2 <= (R + 10) ** 2] = 0


def box_blur(a):
    p = np.pad(a, 1)
    return sum(p[i:i + a.shape[0], j:j + a.shape[1]] for i in range(3) for j in range(3)) / 9.0


def contours(field, thr=0.5):
    """Marching squares with exact edge-id linking; returns closed polygons as (N,2) arrays (x, y)."""
    F = np.pad(field, 1)
    h, w = F.shape
    a, b = F[:-1, :-1], F[:-1, 1:]      # tl, tr
    c, d_ = F[1:, 1:], F[1:, :-1]       # br, bl
    idx = (a > thr) * 8 + (b > thr) * 4 + (c > thr) * 2 + (d_ > thr) * 1
    cells = np.argwhere((idx > 0) & (idx < 15))
    segs = []

    def pt(kind, i, j):
        # point on an edge of cell (i, j); coordinates in padded space
        if kind == 't':
            t = (thr - F[i, j]) / (F[i, j + 1] - F[i, j])
            return ('h', i, j), (j + t, i)
        if kind == 'b':
            t = (thr - F[i + 1, j]) / (F[i + 1, j + 1] - F[i + 1, j])
            return ('h', i + 1, j), (j + t, i + 1)
        if kind == 'l':
            t = (thr - F[i, j]) / (F[i + 1, j] - F[i, j])
            return ('v', i, j), (j, i + t)
        t = (thr - F[i, j + 1]) / (F[i + 1, j + 1] - F[i, j + 1])
        return ('v', i, j + 1), (j + 1, i + t)

    table = {1: [('l', 'b')], 2: [('b', 'r')], 3: [('l', 'r')], 4: [('t', 'r')], 6: [('t', 'b')],
             7: [('l', 't')], 8: [('l', 't')], 9: [('t', 'b')], 11: [('t', 'r')], 12: [('l', 'r')],
             13: [('b', 'r')], 14: [('l', 'b')]}
    for i, j in cells:
        k = int(idx[i, j])
        if k in (5, 10):
            centre = (F[i, j] + F[i, j + 1] + F[i + 1, j] + F[i + 1, j + 1]) / 4 > thr
            if k == 5:
                pairs = [('l', 't'), ('b', 'r')] if centre else [('l', 'b'), ('t', 'r')]
            else:
                pairs = [('l', 'b'), ('t', 'r')] if centre else [('l', 't'), ('b', 'r')]
        else:
            pairs = table[k]
        for p, q in pairs:
            segs.append((pt(p, i, j), pt(q, i, j)))

    adj = {}
    for s in segs:
        adj.setdefault(s[0][0], []).append(s)
        adj.setdefault(s[1][0], []).append(s)
    used = set()
    loops = []
    for s in segs:
        if id(s) in used:
            continue
        used.add(id(s))
        pts = [s[0][1], s[1][1]]
        cur = s[1][0]
        while True:
            nxt = None
            for t in adj[cur]:
                if id(t) not in used:
                    nxt = t
                    break
            if nxt is None:
                break
            used.add(id(nxt))
            if nxt[0][0] == cur:
                pts.append(nxt[1][1])
                cur = nxt[1][0]
            else:
                pts.append(nxt[0][1])
                cur = nxt[0][0]
        loops.append(np.array(pts) - 1.0)    # undo the padding
    return loops


def simplify(p, eps):
    """Douglas-Peucker on a closed polygon."""
    if len(p) < 4:
        return p
    # split at the point farthest from the first one
    far = int(np.argmax(((p - p[0]) ** 2).sum(axis=1)))
    parts = [p[:far + 1], np.vstack([p[far:], p[:1]])]

    def dp(pts):
        keep = np.zeros(len(pts), bool)
        keep[0] = keep[-1] = True
        stack = [(0, len(pts) - 1)]
        while stack:
            s, e = stack.pop()
            if e <= s + 1:
                continue
            a, b = pts[s], pts[e]
            ab = b - a
            n = np.hypot(*ab)
            seg = pts[s + 1:e] - a
            dist = np.abs(ab[0] * seg[:, 1] - ab[1] * seg[:, 0]) / n if n else np.hypot(seg[:, 0], seg[:, 1])
            k = int(np.argmax(dist))
            if dist[k] > eps:
                m = s + 1 + k
                keep[m] = True
                stack += [(s, m), (m, e)]
        return pts[keep]

    a = dp(parts[0])
    b = dp(parts[1])
    return np.vstack([a[:-1], b[:-1]])


def path(loops, eps):
    out = []
    for lp in loops:
        if len(lp) < 12:
            continue
        s = simplify(lp, eps)
        if len(s) < 3:
            continue
        out.append('M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in s) + 'Z')
    return ''.join(out)


letters = path(contours(box_blur(charcoal_mask)), 0.9)

ys, xs = np.nonzero(charcoal_mask > 0.5)
x0, x1 = int(xs.min()) - 8, int(max(xs.max(), CX + R)) + 8
y0, y1 = int(ys.min()) - 8, int(max(ys.max(), CY + R)) + 8
vb = f'{x0} {y0} {x1 - x0} {y1 - y0}'

# play triangle, optically centred (a little to the right of the disc centre)
tri = [(CX - 0.26 * R, CY - 0.46 * R), (CX - 0.26 * R, CY + 0.46 * R), (CX + 0.50 * R, CY)]
tri_d = 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in tri) + 'Z'

svg = '\n'.join(
    [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="Motivado">',
        f'<path fill="{LETTERS}" fill-rule="evenodd" d="{letters}"/>',
        f'<circle cx="{CX}" cy="{CY}" r="{R}" fill="{PLAY}"/>',
        f'<path fill="{TRIANGLE}" d="{tri_d}"/>',
        '</svg>',
    ]
)
open(OUT_DIR + '/logo.svg', 'w', encoding='utf-8').write(svg)
print('viewBox', vb, 'bytes', len(svg))


def hexrgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# raster: draw at 3x the final size, then reduce, so the edges are smooth
SCALE = 860 * 3 / (x1 - x0)
w3, h3 = round((x1 - x0) * SCALE), round((y1 - y0) * SCALE)
canvas = Image.new('RGBA', (w3, h3), (0, 0, 0, 0))
lm = Image.fromarray((charcoal_mask[y0:y1, x0:x1] > 0.5).astype(np.uint8) * 255, 'L').resize((w3, h3), Image.LANCZOS)
canvas.paste(Image.new('RGBA', (w3, h3), hexrgb(LETTERS) + (255,)), (0, 0), lm)
d = ImageDraw.Draw(canvas)
sx = lambda x: (x - x0) * SCALE
sy = lambda y: (y - y0) * SCALE
d.ellipse([sx(CX - R), sy(CY - R), sx(CX + R), sy(CY + R)], fill=hexrgb(PLAY) + (255,))
d.polygon([(sx(x), sy(y)) for x, y in tri], fill=hexrgb(TRIANGLE) + (255,))
png = canvas.resize((860, round(860 * h3 / w3)), Image.LANCZOS)
png.save(OUT_DIR + '/logo.png', optimize=True)
print('png', png.size)

# favicon: the play button alone, on transparent ground
ico = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
di = ImageDraw.Draw(ico)
di.ellipse([8, 8, 248, 248], fill=hexrgb(PLAY) + (255,))
k = 240 / (2 * R)
c = 128
di.polygon([(c + (x - CX) * k, c + (y - CY) * k) for x, y in tri], fill=hexrgb(TRIANGLE) + (255,))
ico.save(OUT_DIR + '/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
print('favicon.ico')

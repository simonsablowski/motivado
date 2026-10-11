"""Rebuild the Motivado logo as a flat SVG: true circles for the three rings, a traced wordmark.

Usage: python tools/vectorise_logo.py <press logo jpg, 2500 px wide> apps/web/public
Writes logo.svg and a transparent logo.png (860 px) next to it. Needs numpy and Pillow only.

The ring geometry was fitted to the press logo (three annuli, outer radius 234, inner radius 137,
eccentric holes, stacked blue < yellow < orange at 76 % opacity). Change RING_COLOURS to rebalance.
"""
import sys

import numpy as np
from PIL import Image

SRC = sys.argv[1]
OUT_DIR = sys.argv[2].rstrip('/')

# ring colours at 76 % opacity over white; the press logo used #69bec4, #ffcd2c, #f7871f
RING_COLOURS = {'blue': '#69bec4', 'yellow': '#ffcd2c', 'orange': '#f7981f'}
ALPHA = 0.76
CHARCOAL_NEW = '#3c4046'
R_OUT, R_IN = 233.95, 137.35
# stacking order bottom to top: (outer centre, hole centre) in press-logo pixels
RINGS = {
    'blue': ((581.4, 295.1), (608.8, 313.7)),
    'yellow': ((709.9, 312.8), (677.3, 314.0)),
    'orange': ((634.5, 377.1), (655.1, 352.0)),
}

im = np.array(Image.open(SRC).convert('RGB')).astype(np.int32)
H, W, _ = im.shape
mx = im.max(axis=2)
# the wordmark is the only really dark thing; the grey ".de" is lighter and drops out
charcoal_mask = (mx < 100).astype(np.float32)


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


charcoal = path(contours(box_blur(charcoal_mask)), 0.9)

# artwork bounds: rings and wordmark
yy, xx = np.mgrid[0:H, 0:W]
ring_mask = np.zeros((H, W), bool)
member = {}
for name, (co, ci) in RINGS.items():
    m = ((xx - co[0]) ** 2 + (yy - co[1]) ** 2 <= R_OUT**2) & ((xx - ci[0]) ** 2 + (yy - ci[1]) ** 2 > R_IN**2)
    member[name] = m
    ring_mask |= m
art = ring_mask | (charcoal_mask > 0.5)
ys, xs = np.nonzero(art)
x0, x1, y0, y1 = int(xs.min()) - 8, int(xs.max()) + 8, int(ys.min()) - 8, int(ys.max()) + 8
vb = f'{x0} {y0} {x1 - x0} {y1 - y0}'


def circle(c, r):
    return f'M{c[0] - r:.2f} {c[1]:.2f}a{r} {r} 0 1 0 {2 * r} 0a{r} {r} 0 1 0 {-2 * r} 0Z'


parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="Motivado">']
for name, (co, ci) in RINGS.items():
    d_ = circle(co, R_OUT) + circle(ci, R_IN)
    parts.append(f'<path fill="{RING_COLOURS[name]}" fill-opacity="{ALPHA}" fill-rule="evenodd" d="{d_}"/>')
parts.append(f'<path fill="{CHARCOAL_NEW}" fill-rule="evenodd" d="{charcoal}"/>')
parts.append('</svg>')
svg = '\n'.join(parts)
open(OUT_DIR + '/logo.svg', 'w', encoding='utf-8').write(svg)
print('viewBox', vb, 'bytes', len(svg))


# raster fallback with the same composition (structured data, social cards)
def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


canvas = np.zeros((H, W, 4), float)          # premultiplied RGBA, transparent
for name in RINGS:
    col = hexrgb(RING_COLOURS[name])
    m = member[name][..., None]
    a = ALPHA
    canvas[..., :3] = np.where(m, canvas[..., :3] * (1 - a) + col * a, canvas[..., :3])
    canvas[..., 3:4] = np.where(m, canvas[..., 3:4] * (1 - a) + a, canvas[..., 3:4])
ch = hexrgb(CHARCOAL_NEW)
cm = (charcoal_mask > 0.5)[..., None]
canvas[..., :3] = np.where(cm, ch, canvas[..., :3])
canvas[..., 3:4] = np.where(cm, 1.0, canvas[..., 3:4])
a = canvas[..., 3:4]
rgb = np.where(a > 0, canvas[..., :3] / np.maximum(a, 1e-6), 0)
img = np.concatenate([rgb, a * 255], axis=2).clip(0, 255).astype(np.uint8)
big = Image.fromarray(img[y0:y1, x0:x1], 'RGBA')
out_w = 860
out_h = round(out_w * big.height / big.width)
big.resize((out_w, out_h), Image.LANCZOS).save(OUT_DIR + '/logo.png', optimize=True)
print('png', (out_w, out_h))

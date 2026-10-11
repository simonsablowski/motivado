"""Draw the social card (1200x630): teal field, headline, logo on a white tab, four topic photos.

Usage: python tools/make_og_image.py apps/web/public
Needs Pillow and the Segoe UI fonts that ship with Windows.
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

out = sys.argv[1].rstrip('/')
TEAL = (47, 127, 140)
WHITE = (255, 255, 255)
SUN = (155, 240, 228)
INK = (38, 41, 46)
W, H = 1200, 630

img = Image.new('RGB', (W, H), TEAL)
d = ImageDraw.Draw(img)

font_b = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 50)
font_r = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 30)

# logo on a white tab, top left
logo = Image.open(os.path.join(out, 'logo.png')).convert('RGBA')
lw = 330
logo = logo.resize((lw, round(lw * logo.height / logo.width)), Image.LANCZOS)
d.rectangle([0, 0, 470, 150], fill=WHITE)
img.paste(logo, (50, 150 // 2 - logo.height // 2), logo)

# headline
d.text((60, 220), 'Persönliches Coaching,', font=font_b, fill=WHITE)
d.text((60, 290), 'wann Sie es brauchen.', font=font_b, fill=SUN)
d.text((60, 410), 'Coaching per Video: individuell,', font=font_r, fill=WHITE)
d.text((60, 452), 'mit Experten, in Ihrem Tempo.', font=font_r, fill=WHITE)
d.text((60, 560), 'motivado.com', font=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 28), fill=WHITE)

# four topic photos as a 2x2 block on the right
size, gap = 250, 12
for i, name in enumerate(['beziehung', 'gesundheit', 'karriere', 'erziehung']):
    p = Image.open(os.path.join(out, 'img', name + '.jpg')).convert('RGB')
    s = min(p.width, p.height)
    p = p.crop(((p.width - s) // 2, (p.height - s) // 2, (p.width + s) // 2, (p.height + s) // 2)).resize((size, size), Image.LANCZOS)
    img.paste(p, (640 + (i % 2) * (size + gap), 65 + (i // 2) * (size + gap)))

img.save(os.path.join(out, 'og.jpg'), quality=88, optimize=True)
print('og.jpg', os.path.getsize(os.path.join(out, 'og.jpg')) // 1024, 'KB')

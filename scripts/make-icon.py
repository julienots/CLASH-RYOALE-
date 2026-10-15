# Génère l'icône du lanceur (œil abyssal sur fond sombre) dans toutes les densités Android.
import sys, os, math
from PIL import Image, ImageDraw, ImageFilter
out = sys.argv[1]
S = 512
im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
# fond : disque sombre avec dégradé radial
for r in range(S // 2, 0, -2):
    t = r / (S / 2)
    c = (int(20 + 40 * (1 - t)), int(8 + 6 * (1 - t)), int(18 + 30 * (1 - t)), 255)
    d.ellipse([S / 2 - r, S / 2 - r, S / 2 + r, S / 2 + r], fill=c)
# couronne d'épines d'os
for k in range(12):
    a = k / 12 * 2 * math.pi
    x0, y0 = S / 2 + math.cos(a) * 150, S / 2 + math.sin(a) * 150
    x1, y1 = S / 2 + math.cos(a) * 236, S / 2 + math.sin(a) * 236
    nx, ny = -math.sin(a) * 16, math.cos(a) * 16
    d.polygon([(x0 + nx, y0 + ny), (x1, y1), (x0 - nx, y0 - ny)], fill=(221, 210, 187, 255))
# globe oculaire
d.ellipse([S / 2 - 150, S / 2 - 105, S / 2 + 150, S / 2 + 105], fill=(240, 228, 214, 255))
glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse([S / 2 - 95, S / 2 - 95, S / 2 + 95, S / 2 + 95], fill=(185, 140, 255, 200))
glow = glow.filter(ImageFilter.GaussianBlur(18))
im = Image.alpha_composite(im, glow)
d = ImageDraw.Draw(im)
d.ellipse([S / 2 - 78, S / 2 - 78, S / 2 + 78, S / 2 + 78], fill=(150, 80, 255, 255))
d.ellipse([S / 2 - 52, S / 2 - 52, S / 2 + 52, S / 2 + 52], fill=(200, 150, 255, 255))
d.ellipse([S / 2 - 16, S / 2 - 68, S / 2 + 16, S / 2 + 68], fill=(5, 3, 4, 255))
d.ellipse([S / 2 - 50, S / 2 - 48, S / 2 - 26, S / 2 - 24], fill=(255, 255, 255, 230))
for name, size in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
    folder = os.path.join(out, f'mipmap-{name}')
    os.makedirs(folder, exist_ok=True)
    im.resize((size, size), Image.LANCZOS).save(os.path.join(folder, 'ic_launcher.png'))
im.save(os.path.join(out, 'icon-512.png'))

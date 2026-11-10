#!/usr/bin/env python3
"""contact.py — tile the per-shot preview stills (build/preview/<id>_mid.jpg) into review sheets.
   python3 tools/contact.py            → build/contact/sheet_01.jpg … (3×3 tiles, 640×360 each, labelled)
Run `node tools/preview.js s01 s02 …` first to refresh the stills."""
import os, sys, glob
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PREV = os.path.join(ROOT, 'build', 'preview')
OUT = os.path.join(ROOT, 'build', 'contact')
os.makedirs(OUT, exist_ok=True)
ids = [f's{i:02d}' for i in range(1, 38)] + ['title']
suffix = sys.argv[1] if len(sys.argv) > 1 else 'mid'
tiles = []
for i in ids:
    p = os.path.join(PREV, f'{i}_{suffix}.jpg')
    if os.path.exists(p):
        im = Image.open(p).convert('RGB').resize((640, 360), Image.LANCZOS)
    else:
        im = Image.new('RGB', (640, 360), (40, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 70, 22], fill=(0, 0, 0)); d.text((6, 5), i, fill=(255, 255, 0))
    tiles.append(im)
per = 9
for k in range(0, len(tiles), per):
    sh = Image.new('RGB', (1920, 1080))
    for j, im in enumerate(tiles[k:k + per]):
        sh.paste(im, ((j % 3) * 640, (j // 3) * 360))
    f = os.path.join(OUT, f'sheet_{suffix}_{k // per + 1:02d}.jpg')
    sh.save(f, quality=88)
    print(f)

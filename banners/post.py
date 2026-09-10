#!/usr/bin/env python3
"""Stamp a generated illustration into a branded 1600x900 post for X.

    python3 banners/post.py art.jpg "Hold the bag.\nGet the tendies." "SUBLINE" out.png

The model draws the subject on a plain #071013 ground; this does the layout, so
every post in the series shares the same typography, margins and colours.
"""
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1600, 900
GROUND = (7, 16, 19)
WHITE = (243, 248, 248)
STEEL = (171, 196, 206)
MUTED = (126, 148, 155)

MARGIN = 96   # left margin for all type
GUTTER = 90   # minimum breathing room between the text and the art

ROOT = Path(__file__).resolve().parent.parent
BOLD = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
SEMI = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"


def key_subject(path: Path) -> Image.Image:
    """Lift the artwork off its flat dark ground.

    Thin bright lines (a grid the model added despite being told not to) are
    removed with a morphological opening; large shapes and crumbs survive.
    """
    src = Image.open(path).convert("RGB")
    mask = src.convert("L").point(lambda v: 255 if v > 45 else 0)
    mask = mask.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))
    mask = mask.filter(ImageFilter.GaussianBlur(1.1))
    art = src.convert("RGBA")
    art.putalpha(mask)
    box = art.getchannel("A").getbbox()
    if not box:
        raise SystemExit("nothing found on the ground — is the background flat and dark?")
    return art.crop(box)


def build(art_path: Path, headline: str, subline: str, out: Path) -> None:
    art = key_subject(art_path)
    canvas = Image.new("RGBA", (W, H), (*GROUND, 255))
    d = ImageDraw.Draw(canvas)

    lines = headline.replace("\\n", "\n").split("\n")
    small = ImageFont.truetype(SEMI, 24)

    # Set the type first and measure it, then give the art whatever is left.
    # Otherwise a long headline runs under the illustration.
    size = 92
    while size > 44:
        big = ImageFont.truetype(BOLD, size)
        text_w = max(d.textlength(line, font=big) for line in lines)
        text_w = max(text_w, d.textlength(subline.upper(), font=small))
        if MARGIN + text_w + GUTTER < W * 0.62:
            break
        size -= 6
    big = ImageFont.truetype(BOLD, size)
    text_right = MARGIN + max(
        max(d.textlength(line, font=big) for line in lines),
        d.textlength(subline.upper(), font=small),
    )

    box_w = W - text_right - GUTTER - 70
    box_h = int(H * 0.82)
    scale = min(box_w / art.width, box_h / art.height)
    art = art.resize((round(art.width * scale), round(art.height * scale)), Image.LANCZOS)
    art_x = W - art.width - 70
    canvas.alpha_composite(art, (art_x, (H - art.height) // 2))

    mark = Image.open(ROOT / "public" / "wordmark.webp").convert("RGBA")
    mh = 52
    mark = mark.resize((round(mark.width * mh / mark.height), mh), Image.LANCZOS)
    canvas.alpha_composite(mark, (MARGIN, 96))

    y = 340 - (len(lines) - 1) * size // 2
    for i, line in enumerate(lines):
        d.text((MARGIN, y), line, font=big, fill=WHITE if i == 0 else STEEL)
        y += int(size * 1.12)

    if subline:
        d.text((MARGIN, y + 34), subline.upper(), font=small, fill=MUTED)

    canvas.convert("RGB").save(out)

    # Belt and braces: confirm the gutter between type and art really is empty.
    px = canvas.load()
    clash = sum(
        1
        for yy in range(0, H, 4)
        for xx in range(int(text_right), min(int(text_right) + GUTTER, W), 4)
        if abs(px[xx, yy][0] - GROUND[0]) + abs(px[xx, yy][1] - GROUND[1]) > 24
    )
    print(
        f"{out}  {W}x{H}  type {size}px, art from x={art_x}"
        + ("  ⚠ арт заходит в отбивку" if clash > 300 else "  ✓ отбивка чистая")
    )


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    src = Path(sys.argv[1])
    head = sys.argv[2]
    sub = sys.argv[3] if len(sys.argv) > 3 else ""
    dst = Path(sys.argv[4]) if len(sys.argv) > 4 else Path(
        f"banners/post-{re.sub(r'[^a-z0-9]+', '-', head.lower())[:28].strip('-')}.png"
    )
    build(src, head, sub, dst)

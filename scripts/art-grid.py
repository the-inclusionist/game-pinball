# SPDX-License-Identifier: AGPL-3.0-or-later
"""A table's imported picture, magnified, with its own coordinates drawn on it.

⚠️ THIS EXISTS BECAUSE A LAYOUT IS AUTHORED IN NUMBERS AND A PICTURE IS NOT. `app/assets/tables/*.png`
is the table at its own size -- 100 to 360 pixels across -- and placing a bumper on it by eye means
reading a coordinate off an image where one table unit is one pixel. The Dev paints the art and then
says "refazer os mapas em cima de cada arte"; this is the ruler that makes that a measurement instead
of a guess.

    python scripts/art-grid.py wide-arc [four-flippers ...]

writes `shots/grid-<name>.png`: the picture at 4x with a line every 20 table units, a brighter line
every 100, and the coordinate printed along the top and the left. Nothing here ships -- it is a tool
for the person doing the authoring, in the same spirit as `shots/` itself: look at the output.
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SCALE = 4
STEP = 20
MAJOR = 100


def grid_one(name: str) -> None:
    source = ROOT / 'app' / 'assets' / 'tables' / f'{name}.png'
    if not source.exists():
        print(f'{name}: no picture at {source}')
        return

    art = Image.open(source).convert('RGB')
    w, h = art.size
    out = art.resize((w * SCALE, h * SCALE), Image.NEAREST)
    draw = ImageDraw.Draw(out)

    for x in range(0, w + 1, STEP):
        colour = (255, 210, 60) if x % MAJOR == 0 else (120, 120, 140)
        draw.line([(x * SCALE, 0), (x * SCALE, h * SCALE)], fill=colour)
        draw.text((x * SCALE + 2, 2), str(x), fill=colour)
    for y in range(0, h + 1, STEP):
        colour = (255, 210, 60) if y % MAJOR == 0 else (120, 120, 140)
        draw.line([(0, y * SCALE), (w * SCALE, y * SCALE)], fill=colour)
        draw.text((2, y * SCALE + 2), str(y), fill=colour)

    target = ROOT / 'shots' / f'grid-{name}.png'
    target.parent.mkdir(parents=True, exist_ok=True)
    out.save(target)
    print(f'{name:<14} {w}x{h} -> {target.relative_to(ROOT)}')


if __name__ == '__main__':
    for picture in sys.argv[1:] or ['wide-arc', 'four-flippers', 'narrow-tower', 'bare-minimum']:
        grid_one(picture)

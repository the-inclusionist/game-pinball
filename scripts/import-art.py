#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Reduce the Dev's playfield art to what the game ships.

========================= WHY THIS FILE EXISTS AT ALL =========================
IT DID NOT, AND THAT WAS THE DEFECT. The six pictures in `app/assets/tables/` were produced by a
script that lived in a scratch directory and is gone. Nobody could say what dim had been applied,
what the pictures had been quantised to, or how to make a seventh — and the answer to the first
question turned out to matter a great deal: measured after the fact, the art was multiplied down to a
median luminance of Y 0.0079, a picture at seven per cent lightness. That number was nobody's
decision. It fell out of a rule ("no pixel brighter than ADR-0007's ceiling") applied to a whole
picture.

So the pipeline is a file now, and it says what it does.

========================= PYTHON, IN A TYPESCRIPT REPOSITORY =========================
Deliberate, and it is not a slippery slope. This runs on the Dev's machine when his art changes; the
masters are gitignored (see `.gitignore`, and `art/README.md` for why), so nothing automated can ever
run this — there is no input for it in a clone. A tool that cannot be part of a gate does not have to
share the game's toolchain, and JPEG decoding plus a box filter plus colour quantisation is four
lines of Pillow against a great deal of TypeScript.

    python scripts/import-art.py            # every table
    python scripts/import-art.py low-orbit  # just one

========================= THE TWO NUMBERS, AND WHERE THEY COME FROM =========================
⚠️ THE CEILING IS THE BALL'S. The ball is the one thing on a table that can be anywhere, so it is the
one thing that cannot have a precomputed shadow under it — `gfx/surround` darkens the backdrop around
COMPONENTS, whose positions are known, and the ball is not one. Its colour is (238, 242, 248), a
relative luminance of Y 0.8846, and 3:1 against that allows a backdrop up to Y 0.2615. That is the
brightest any pixel of any picture may be, and it is a derived figure rather than a taste.

⚠️ AND THE FLOOR IS THE DEV'S OWN INSTRUCTION. "Escureça as imagens e ilumine somente a região onde
quer um item." The pictures are meant to read as night, with the table's lights picking out what can
be played. So the reduction lands each picture's MEDIAN at a stated target rather than leaving it
wherever the ceiling happens to put it — which is what produced Y 0.0079 and the complaint that
followed: "as cores das mesas ficaram escuras demais".

Both are applied in LINEAR light. Multiplying the bytes is a gamma-space operation: it moves the
three channels by different amounts and walks a warm grey toward blue, on a table whose whole
identity is that colour means something.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent

# ⚠️ THE PLAYFIELD, NOT THE SCREEN. The screen is 320x180 and the camera scrolls; these are the
# canvases the art has to fit, and `tests/gfx-backdrop` refuses a picture that is not exactly one of
# them — a stretched playfield puts the art a few pixels from the geometry EVERYWHERE, which is worse
# than having none. `art/README.md` is the copy of this table the Dev works from.
SIZES = {
    'low-orbit': (183, 235),
    'ion-storm': (183, 250),
    'crater-run': (183, 260),
    'slipstream': (183, 245),
    'long-climb': (183, 300),
    'ring-belt': (360, 240),
}

#: The ball's own luminance, from `gfx/table-palette.BALL` = (238, 242, 248).
BALL_LUMINANCE = 0.8846
#: WCAG 2.2, 1.4.11. The same constant as `gfx/surround.REQUIRED_RATIO`.
REQUIRED_RATIO = 3.0
#: The brightest a picture may be, so the ball clears the ratio against it wherever it goes.
CEILING = (BALL_LUMINANCE + 0.05) / REQUIRED_RATIO - 0.05

#: Where the shoulder starts: half the ceiling. Below it a picture is untouched; above it the last
#: half of the headroom is spent asymptotically, so nothing clips. See `reduce_one` for the
#: measurement that chose it over a hard cut and over the two other knees tried.
KNEE = CEILING * 0.5

#: Where a picture's median lands: CIE L* 25, a night picture rather than a black one.
#:
#: ⚠️ THE MEDIAN AND NOT THE MEAN, because these pictures are mostly dark with small bright things in
#: them — a rocket exhaust, a lit mine, a bright ring. A mean is dragged around by those and would
#: make a table with a big highlight darker everywhere else to compensate.
TARGET_LSTAR = 25.0

#: How many colours survive. Quantisation is what keeps six pictures inside a precache budget meant
#: for school laptops; at this size the loss is not visible and the saving is four to one.
COLOURS = 192


def to_linear(a):
    c = a.astype(np.float64) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def to_srgb(a):
    """Linear light to sRGB bytes, rounding DOWN.

    ⚠️ DOWN, LIKE `gfx/surround.ENCODE`, AND FOR THE SAME REASON. Rounding to nearest put
    `slipstream`'s brightest pixel at Y 0.2632 against a ceiling of 0.2615 -- so the ball, whose 3:1
    against the backdrop IS that ceiling, came out at 2.98:1 over part of one table. The shoulder
    above never reaches the ceiling by construction; the encoder was putting it there. A bound may
    only ever be missed on the safe side.
    """
    out = np.where(a <= 0.0031308, 12.92 * a, 1.055 * np.maximum(a, 0) ** (1 / 2.4) - 0.055)
    return np.clip(np.floor(out * 255.0), 0, 255).astype(np.uint8)


def luminance(linear):
    return 0.2126 * linear[..., 0] + 0.7152 * linear[..., 1] + 0.0722 * linear[..., 2]


def lstar(y):
    y = np.asarray(y, dtype=float)
    f = np.where(y > 0.008856, np.cbrt(np.maximum(y, 0)), 7.787 * y + 16.0 / 116.0)
    return 116.0 * f - 16.0


def from_lstar(l):
    f = (l + 16.0) / 116.0
    return f ** 3 if f ** 3 > 0.008856 else (f - 16.0 / 116.0) / 7.787


def reduce_one(name):
    size = SIZES[name]
    master = ROOT / 'art' / f'{name}.jpg'
    if not master.exists():
        print(f'{name}: no master at {master}')
        return

    # ⚠️ BOX, WHICH IS AN AREA AVERAGE. The masters run about ten times the playfield and the ratios
    # are not whole numbers, so every output pixel is a weighted average of the input area it covers.
    # A resampler that interpolates instead (bicubic, Lanczos) invents edges that were never drawn and
    # rings around every highlight, which at 183 pixels wide is most of the picture.
    art = Image.open(master).convert('RGB').resize(size, Image.BOX)
    linear = to_linear(np.asarray(art))

    y = luminance(linear)
    lit = y[y > 1e-4]
    median = float(np.median(lit)) if lit.size else 0.0

    # Scale so the median lands on target.
    k = (from_lstar(TARGET_LSTAR) / median) if median > 0 else 1.0
    lifted = linear * k

    # Then hold the CEILING per pixel, not over the picture.
    #
    # ⚠️ AND PULLING THE WHOLE PICTURE DOWN IS THE SAME MISTAKE THIS WHOLE CHANGE IS ABOUT. Scaling
    # everything until the brightest pixel fits charges the entire image for its highlights: measured,
    # it put `slipstream` at a median of L* 1.9 and `low-orbit` at 10.1 while asking for 25, because
    # each has a small very bright thing in it. The ceiling is a bound on a PIXEL, so it is enforced
    # on the pixels that break it and nowhere else -- the same argument, and the same arithmetic, as
    # `gfx/surround.applySurround`.
    #
    # ⚠️ AND IT ROLLS OFF RATHER THAN CUTTING, which was the FIRST version and cost real picture.
    # A hard clip at the ceiling left 9.7% of `low-orbit`, 14.0% of `ion-storm` and 22.3% of
    # `slipstream` sitting at exactly one luminance -- a fifth of a picture with its detail gone, on
    # the table whose bright streaks ARE its content. And it was not the master's fault: 0.01% of
    # `slipstream`'s master has all three channels at 250 or over, so the flat band was made here.
    #
    # Everything under the knee is untouched; above it the remaining headroom is spent asymptotically,
    # so the order of two pixels is never lost and nothing ever reaches the ceiling exactly. Measured
    # at three knees, this one keeps every median where it was (20.4 to 25.0, unchanged) and takes the
    # share sitting within one per cent of the ceiling from 9.7-22.3% down to 0.00-0.01% on five of
    # the six tables.
    #
    # ⚠️ `slipstream` STAYS AT 15.4% AND THAT IS ITS DISTRIBUTION, NOT A BUG HERE. Its median is
    # Y 0.0073 -- space is black, and correctly so -- so placing that median at L* 25 is a x6.0 scale,
    # which stretches a wide band of mid-tones past the ceiling before the knee compresses them back
    # together. The alternative was measured too: anchoring a high percentile instead of the median
    # drops it to a median of L* 2.5, which is the near-black the Dev complained about in the first
    # place. This is the better half of a real trade, and it is his to re-decide.
    over = luminance(lifted)
    hot = over > KNEE
    if hot.any():
        headroom = CEILING - KNEE
        rolled = KNEE + headroom * (1.0 - np.exp(-(over[hot] - KNEE) / headroom))
        lifted[hot] *= (rolled / over[hot])[:, None]

    out = to_srgb(lifted)
    picture = Image.fromarray(out, 'RGB').quantize(colors=COLOURS, method=Image.MEDIANCUT)

    target = ROOT / 'app' / 'assets' / 'tables' / f'{name}.png'
    picture.save(target, optimize=True)

    after = luminance(to_linear(np.asarray(picture.convert('RGB'))))
    print(f'{name:<12} {art.size[0]}x{art.size[1]}  x{k:.3f}  '
          f'median L* {lstar(np.median(after)):5.1f}  peak L* {lstar(after.max()):5.1f}  '
          f'{target.stat().st_size // 1024} KB')


if __name__ == '__main__':
    wanted = sys.argv[1:] or list(SIZES)
    print(f'ceiling Y {CEILING:.4f} (L* {lstar(CEILING):.1f}), from the ball at 3:1')
    for table in wanted:
        if table not in SIZES:
            raise SystemExit(f'unknown table {table}; known: {", ".join(SIZES)}')
        reduce_one(table)

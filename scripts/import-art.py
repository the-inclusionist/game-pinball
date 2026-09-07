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

#: How many colours survive.
#:
#: ⚠️ MEASURED, AFTER THIS CONSTANT WAS FIRST JUSTIFIED WITH A SENTENCE NOBODY HAD CHECKED. It said
#: "the loss is not visible and the saving is four to one" and BOTH HALVES WERE WRONG. Encoding each
#: table at four counts and comparing against the unquantised picture in CIE76:
#:
#:                  64          128         192         256        full
#:     low-orbit    3.40 dE     2.30        1.59        1.37       50.8 KB
#:     ion-storm    6.92        4.98        4.14        3.69       72.7 KB
#:     crater-run   2.37        1.62        1.39        1.13       64.7 KB
#:     slipstream   3.28        2.30        1.84        1.65       92.1 KB
#:     long-climb   5.11        3.56        2.91        2.69       92.6 KB
#:     ring-belt    2.83        2.30        2.07        1.95      153.7 KB
#:
#: THE SAVING IS BETWEEN 2.6x AND 3.0x, not four. And the loss IS visible on two tables: CIE76 calls
#: about 2.3 the smallest difference a person notices, and `ion-storm` averages 4.14 at this count
#: with `long-climb` at 2.91. The worst one per cent of pixels is worse still — 15 to 23 dE, which on
#: the palette's own scale is a different colour. That is scenery rather than a role, so it costs
#: legibility nothing, but it is not "not visible" and saying so was inventing evidence.
#:
#: ⚠️ AND THE NUMBER SURVIVES THE CORRECTION, WHICH IS WHY IT IS STILL 192. The curve has its knee
#: here: 64 to 128 buys a third of the error back, 128 to 192 another quarter, and 192 to 256 only a
#: tenth for another 10% of the bytes. Going unquantised would cost 330 KB across the six for the
#: remaining 1.4 to 4.1 dE of scenery.
#:
#: The trade against the precache budget is the Dev's, and the numbers above are what he would be
#: deciding on. The plan's budget worry is written in megabytes — a 3 MB SoundFont — so 330 KB is not
#: obviously refused; it simply has not been asked.
COLOURS = 192

#: The two photographs behind the screens that have no table on them.
#:
#: ⚠️ THE DEV: "Use background.jpg como fundo de todas as telas que não tenham mesa com exceção da
#: primeira tela. Para a tela inicial, use start.jpg como background." So `start` is the title and
#: `background` is everything between it and a table — the selector and the mission screen.
#:
#: ⚠️ 320x180, WHICH IS THE GAME. Every screen in this project is laid out on that grid and scaled up
#: with `image-rendering: pixelated`; a photograph at the page's own resolution behind pixel art at a
#: sixth of it would be the one sharp thing on the screen. It also costs about 20 KB instead of 2 MB,
#: on a game meant to run offline on a school machine.
SCREENS = {
    'start': (320, 180),
    'background': (320, 180),
}

#: Which of them is dimmed, and `start` is not.
#:
#: ⚠️ THE DEV, AFTER SEEING IT: "Pirmeira tela: não use filtro para escurecer, deixe a imagem
#: original." So the title keeps the photograph as it was taken, and the contrast the text needs comes
#: from the TEXT instead — a cherry border around SPACE STUDENT and a neon glow under PINBALL, both of
#: which he specified in the same breath. An outline is a legitimate way to hold 1.4.3 on a busy
#: ground, and it is the way a title screen has always done it.
#:
#: ⚠️ AND IT IS ONLY THE TITLE. `background.png` still carries the ceiling: the selector and the mission
#: screen have paragraphs of small text on them, in two weights, and no outline in the world makes a
#: seven-pixel legend readable over an undimmed photograph.
SCREEN_DIMMED = {
    'start': False,
    'background': True,
}

#: `shell/title-dom.INK`, the colour of the text on those screens = (232, 236, 244).
INK_LUMINANCE = 0.83585
#: WCAG 2.2, 1.4.3, normal text. Not 1.4.11's 3 — these are WORDS, and the smallest of them is the
#: byline at about eight pixels.
TEXT_RATIO = 4.5
#: The brightest a screen photograph may be, so the text on it clears the ratio wherever it falls.
SCREEN_CEILING = (INK_LUMINANCE + 0.05) / TEXT_RATIO - 0.05

#: Brighter than the tables' 25, and the reason is that nothing has to be seen THROUGH these.
#:
#: A table's ceiling is the BALL's: a six-pixel object that can be anywhere, so the art behind it is
#: held down everywhere. A screen has no ball — it has text, and text is at known places with a known
#: colour. So the picture only owes the ratio to the words, and can be a picture.
SCREEN_TARGET_LSTAR = 30.0


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


def shape(linear, ceiling, target):
    """Lift the median to `target` L*, then hold `ceiling` per pixel with a soft shoulder.

    ⚠️ EXTRACTED SO THE SCREENS AND THE TABLES USE THE SAME CURVE. The argument for every part of it
    is in `reduce_one` below and applies unchanged: the median rather than the mean because these
    pictures are mostly dark with small bright things in them; the ceiling on the PIXEL rather than on
    the picture, because scaling everything until the brightest fits charges the whole image for its
    highlights; and a shoulder rather than a clip, because a hard cut left a fifth of some tables at
    exactly one luminance.
    """
    y = luminance(linear)
    lit = y[y > 1e-4]
    median = float(np.median(lit)) if lit.size else 0.0
    k = (from_lstar(target) / median) if median > 0 else 1.0
    lifted = linear * k

    knee = ceiling * 0.5
    over = luminance(lifted)
    hot = over > knee
    if hot.any():
        headroom = ceiling - knee
        rolled = knee + headroom * (1.0 - np.exp(-(over[hot] - knee) / headroom))
        lifted[hot] *= (rolled / over[hot])[:, None]
    return lifted, k


def reduce_screen(name):
    size = SCREENS[name]
    master = ROOT / 'art' / f'{name}.jpg'
    if not master.exists():
        print(f'{name}: no master at {master}')
        return

    art = Image.open(master).convert('RGB')
    # ⚠️ CROPPED TO THE SCREEN'S SHAPE BEFORE IT IS REDUCED. `start.jpg` is 2752x1536 (16:9) and
    # `background.jpg` 1024x572 (16:8.9), and neither is exactly 16:9 — squeezing them to 320x180
    # would stretch a photograph by a per cent or two, which on a face or a horizon is visible and on
    # a game's title screen is the first thing anybody sees. The centre is kept.
    want = size[0] / size[1]
    have = art.size[0] / art.size[1]
    if abs(have - want) > 1e-3:
        if have > want:
            wide = int(round(art.size[1] * want))
            left = (art.size[0] - wide) // 2
            art = art.crop((left, 0, left + wide, art.size[1]))
        else:
            tall = int(round(art.size[0] / want))
            top = (art.size[1] - tall) // 2
            art = art.crop((0, top, art.size[0], top + tall))
    art = art.resize(size, Image.BOX)

    # ⚠️ THE SAME CURVE AS A TABLE'S, and two attempts at a cleverer one are recorded here because
    # both were worse and both looked right on paper. `background.jpg` is a photograph with almost no
    # range in it — measured at 320x180, its first percentile is L* 7.2, its median L* 9.3 and its
    # ninety-fifth L* 26.6 — so lifting its median to L* 30 necessarily flattens it further, and the
    # result reads as washed.
    #
    # A POWER CURVE (y -> y**g, which fixes zero) lifts the DARKEST values most when g < 1: it took
    # `start`'s fifth percentile from L* 4.0 to 9.6 and `background`'s from 27.3 to 28.2, which is the
    # opposite of keeping blacks black. SUBTRACTING THE MASTER'S OWN BLACK POINT worked arithmetically
    # — `background`'s range went from 17 points to 26 — and the multiply it then needs is x25.8, which
    # amplifies the JPEG's noise and its blue cast until the picture is mottled.
    #
    # The flatness is the master's, and a BACKGROUND is the one picture where flat and dark is not a
    # fault. What this file owes it is the contrast ceiling, which the shared curve gives it.
    linear = to_linear(np.asarray(art))
    if SCREEN_DIMMED[name]:
        lifted, k = shape(linear, SCREEN_CEILING, SCREEN_TARGET_LSTAR)
    else:
        # ⚠️ UNTOUCHED, WHICH IS THE DEV'S INSTRUCTION AND HAS A COST HE IS OWED IN NUMBERS. Nothing
        # holds the ground down any more, so the text on it holds itself up: see `SCREEN_DIMMED`, and
        # `tests/screen-art` measures what the outline actually buys against this very file.
        lifted, k = linear, 1.0
    picture = Image.fromarray(to_srgb(lifted), 'RGB').quantize(colors=COLOURS, method=Image.MEDIANCUT)

    target = ROOT / 'app' / 'assets' / 'screens' / f'{name}.png'
    target.parent.mkdir(parents=True, exist_ok=True)
    picture.save(target, optimize=True)

    after = luminance(to_linear(np.asarray(picture.convert('RGB'))))
    lit = np.sort(after.reshape(-1))
    low = lstar(lit[int(lit.size * 0.05)])
    high = lstar(lit[int(lit.size * 0.95)])
    print(f'{name:<12} {size[0]}x{size[1]}  ^{k:.3f}  '
          f'median L* {lstar(np.median(after)):5.1f}  P5 {low:5.1f}  P95 {high:5.1f}  '
          f'peak L* {lstar(after.max()):5.1f}  {target.stat().st_size // 1024} KB')


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

    # The median lands on target and the ceiling is then held per pixel, not over the picture.
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
    lifted, k = shape(to_linear(np.asarray(art)), CEILING, TARGET_LSTAR)

    out = to_srgb(lifted)
    picture = Image.fromarray(out, 'RGB').quantize(colors=COLOURS, method=Image.MEDIANCUT)

    target = ROOT / 'app' / 'assets' / 'tables' / f'{name}.png'
    picture.save(target, optimize=True)

    after = luminance(to_linear(np.asarray(picture.convert('RGB'))))
    print(f'{name:<12} {art.size[0]}x{art.size[1]}  x{k:.3f}  '
          f'median L* {lstar(np.median(after)):5.1f}  peak L* {lstar(after.max()):5.1f}  '
          f'{target.stat().st_size // 1024} KB')


if __name__ == '__main__':
    wanted = sys.argv[1:] or list(SIZES) + list(SCREENS)
    print(f'table ceiling  Y {CEILING:.4f} (L* {lstar(CEILING):.1f}), from the ball at 3:1')
    print(f'screen ceiling Y {SCREEN_CEILING:.4f} (L* {lstar(SCREEN_CEILING):.1f}), from the text at 4.5:1')
    for name in wanted:
        if name in SIZES:
            reduce_one(name)
        elif name in SCREENS:
            reduce_screen(name)
        else:
            raise SystemExit(f'unknown picture {name}; known: {", ".join(list(SIZES) + list(SCREENS))}')

// SPDX-License-Identifier: AGPL-3.0-or-later
// A COMET, ITS NUMBER, AND THE TWO THINGS IT HAS TO BE TOLD APART FROM.
//
// ⚠️ THE ONE THAT MATTERS MOST IS THE FIRST TEST BELOW: a multiple and a non-multiple must be drawn
// IDENTICALLY apart from the digits. A comet that hints at its own answer is not a multiplication
// drill, and a hint carried in colour is one that some children get and others do not.
import { describe, test, expect } from 'vitest';
import { createFramebuffer, type Framebuffer } from '../app/js/gfx/framebuffer.js';
import { drawComet, COMET_BODY, COMET_BLUE } from '../app/js/gfx/comet-view.js';
import { drawNumber, numberWidth, GLYPHS, DIGIT_WIDTH, DIGIT_HEIGHT } from '../app/js/gfx/digits.js';
import { COMET_RADIUS, type Comet } from '../app/js/control/comet-mission.js';
import { paletteFor, type Rgb } from '../app/js/gfx/table-palette.js';
import { packRgb } from '../app/js/gfx/table-view.js';
import { surroundCeiling } from '../app/js/gfx/surround.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { drawTable, blitView, drawBall } from '../app/js/gfx/table-view.js';
import { layoutHud, DEFAULT_HUD } from '../app/js/shell/hud.js';
import { LOW_ORBIT } from '../app/js/table/catalog.js';
import { buildPng, readPng, magnify } from './helpers/png.js';

/** The playfield's window on the 320x180 screen, which is what everything here is clipped to. */
const INTO = { x: 40, y: 0, width: 183, height: 180 };

const comet = (over: Partial<Comet> = {}): Comet => ({
  id: 1, value: 24, multiple: true, x: 90, y: 60, state: 'falling', scale: 1, alpha: 1, ...over,
});

function screen(fill = 0): Framebuffer {
  const fb = createFramebuffer(320, 180);
  fb.pixels.fill(fill);
  return fb;
}

const channel = (c: number): number => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (c: Rgb): number =>
  0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
const ratio = (a: number, b: number): number =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

describe('⚠️ a comet gives nothing away about its own number', () => {
  test('the two kinds are drawn pixel for pixel the same', () => {
    const right = screen();
    const wrong = screen();
    drawComet(right, comet({ value: 42, multiple: true }), INTO, 0, 0);
    drawComet(wrong, comet({ value: 42, multiple: false }), INTO, 0, 0);

    const differing = [...right.pixels].filter((p, i) => p !== wrong.pixels[i]).length;
    expect(differing, 'the drawing looks at `multiple` somewhere, and that answers the question'
      + ' the mission exists to ask').toBe(0);
  });
});

describe('the colour is a measurement, not a preference', () => {
  /**
   * ⚠️ THE COMET IS CAUGHT BETWEEN TWO THINGS AT OPPOSITE ENDS, and this is the arithmetic that says
   * there is any room at all. The art is dimmed on the way in so nothing in it is brighter than the
   * ceiling the BALL needs to clear 3:1 — the same number `scripts/import-art.py` works to. So the
   * comet has to clear 3:1 against a ground that can be that bright, and against the near-white ball
   * it may end up beside. The window between those is narrow, and this is what keeps a future edit
   * from picking a nicer orange that quietly leaves it.
   */
  const ball = paletteFor('slate', { cbSafe: false }).ball;
  const brightestArt = surroundCeiling(luminance(ball));
  const body = luminance(COMET_BODY);

  test('⚠️ the halo brings the art around a comet under the ceiling — measured on real pixels', () => {
    /**
     * ⚠️ THIS IS THE ASSERTION THE FIRST VERSION OF THIS FILE COULD NOT PASS, and the reason the
     * drawing has a halo at all. There is NO single colour that clears 3:1 against art running from
     * black to Y = 0.2615: the requirement leaves only "as bright as the ball" or "darker than the
     * black parts", and both fail the other end. The comet therefore does what every component on
     * these tables does and darkens its own neighbourhood.
     *
     * Drawn over the BRIGHTEST ground the importer can produce, because that is the case that fails.
     */
    const ground = brightestArt;
    const byte = Math.floor(255 * (1.055 * ground ** (1 / 2.4) - 0.055));
    const fb = screen();
    for (let i = 0; i < fb.pixels.length; i++) {
      fb.bytes[i * 4] = byte;
      fb.bytes[i * 4 + 1] = byte;
      fb.bytes[i * 4 + 2] = byte;
      fb.bytes[i * 4 + 3] = 255;
    }
    const c = comet({ x: 90, y: 90 });
    drawComet(fb, c, INTO, 0, 0);

    const cx = INTO.x + c.x;
    const cy = INTO.y + c.y;
    let brightest = 0;
    let where = '';
    for (let y = 0; y < fb.height; y++) {
      for (let x = 0; x < fb.width; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= COMET_RADIUS || d > COMET_RADIUS + 2) continue;
        const at = (y * fb.width + x) * 4;
        const y1 = luminance({ r: fb.bytes[at]!, g: fb.bytes[at + 1]!, b: fb.bytes[at + 2]! });
        if (y1 > brightest) {
          brightest = y1;
          where = `${x},${y}`;
        }
      }
    }

    expect(brightest, 'the halo touched nothing at all').toBeLessThan(ground);
    expect(ratio(body, brightest), `the brightest pixel touching the comet is at ${where},`
      + ` Y=${brightest.toFixed(4)} against a body of Y=${body.toFixed(4)}`)
      .toBeGreaterThanOrEqual(3);
  });

  /**
   * ⚠️ THIS USED TO ASK FOR 3:1 BETWEEN THE COMET'S FILL AND THE BALL, and the Dev's colour retires the
   * question rather than failing it. He asked for white comets — "brancos internamente" — and the ball
   * is near-white, so the fills now measure 1.00:1 against each other and are MEANT to.
   *
   * What separates them is the blue ring, which is the pair that is actually adjacent when a ball
   * touches a comet. That is the assertion below, and it is the same claim this one was making: the
   * player can tell the two apart where they meet.
   */

  test('⚠️ and the blue clears 4.5:1 against the white, because it is the RIM AND the digits', () => {
    /**
     * ⚠️ ONE COLOUR DOING TWO JOBS, so it takes the stricter of the two bars. As a ring, WCAG 1.4.11
     * would ask 3:1; as the number a player has to read while it falls, 1.4.3 asks 4.5:1. The Dev put
     * them on the same colour — "azuis na borda e no número" — so the number decides.
     */
    expect(ratio(luminance(COMET_BLUE), body), 'the number is the one thing here that must be easy')
      .toBeGreaterThanOrEqual(4.5);
  });

  test('⚠️ and the ball is told from a comet by the RIM, not by the fill', () => {
    // They are both white, deliberately: "brancos internamente". Two near-white things touching are one
    // thing unless something between them is not white, and that is what the blue ring is for.
    expect(ratio(luminance(COMET_BLUE), luminance(ball)), 'the ball meets the rim, and cannot see it')
      .toBeGreaterThanOrEqual(3);
  });
});

describe('nothing is drawn outside the playfield window', () => {
  /**
   * ⚠️ ADR-0002: the 137 columns beside the playfield belong to the HUD. A comet on a narrow table can
   * sit at the very edge, and an unclipped disc would put a slice of itself on the score.
   */
  const spill = (fb: Framebuffer): number => {
    let count = 0;
    for (let y = 0; y < fb.height; y++) {
      for (let x = 0; x < fb.width; x++) {
        const outside = x < INTO.x || x >= INTO.x + INTO.width
          || y < INTO.y || y >= INTO.y + INTO.height;
        if (outside && fb.pixels[y * fb.width + x] !== 0) count++;
      }
    }
    return count;
  };

  test('a comet against the left edge keeps its pixels inside', () => {
    const fb = screen();
    drawComet(fb, comet({ x: 1, y: 90 }), INTO, 0, 0);
    expect(spill(fb), 'pixels landed on the HUD columns').toBe(0);
    expect([...fb.pixels].some((p) => p !== 0), 'and nothing was drawn at all').toBe(true);
  });

  test('a comet above the top of the view keeps its pixels inside', () => {
    const fb = screen();
    drawComet(fb, comet({ x: 90, y: -COMET_RADIUS + 2 }), INTO, 0, 0);
    expect(spill(fb), 'pixels landed above the playfield').toBe(0);
  });

  test('one the camera has scrolled away from is not drawn at all', () => {
    const fb = screen();
    drawComet(fb, comet({ x: 90, y: 40 }), INTO, 0, 400);
    expect([...fb.pixels].filter((p) => p !== 0).length, 'a comet off the view was drawn').toBe(0);
  });
});

describe('the burst', () => {
  test('⚠️ it MIXES with what is behind it rather than replacing it', () => {
    // "explode de forma suave". A burst that stopped being drawn would pop out of existence; one drawn
    // solid would be a disc that grows. Half-way through, its pixels have to be part comet and part
    // whatever was behind — which is a claim about actual numbers, so it is checked as one.
    const ground = 0xff203040;
    const body = packRgb(COMET_BODY);
    const fb = screen(ground);
    drawComet(fb, comet({ state: 'bursting', scale: 1.4, alpha: 0.5 }), INTO, 0, 0);

    const touched = new Set([...fb.pixels].filter((p) => p !== ground));
    expect(touched.size, 'the burst drew nothing at all').toBeGreaterThan(0);
    expect(touched.has(body), 'the burst was painted solid — at half alpha nothing may come out'
      + ' the body colour exactly').toBe(false);
  });

  test('and it is a ring, so the middle is left alone', () => {
    const ground = 0xff203040;
    const fb = screen(ground);
    const c = comet({ state: 'bursting', scale: 1.6, alpha: 1 });
    drawComet(fb, c, INTO, 0, 0);
    const middle = fb.pixels[Math.round(c.y) * fb.width + Math.round(INTO.x + c.x)];
    expect(middle, 'the burst is a filled disc, which reads as growing rather than coming apart')
      .toBe(ground);
  });
});

describe('the digits', () => {
  test('⚠️ no two glyphs are the same picture', () => {
    // The failure this prevents is a typo in the table above: two numbers that look alike are two
    // questions a player cannot tell apart, and nothing else in this repository would notice.
    const drawn = GLYPHS.map((g) => g.join('/'));
    expect(new Set(drawn).size, 'two digits are drawn identically').toBe(10);
    for (const [i, glyph] of GLYPHS.entries()) {
      expect(glyph.length, `digit ${i} is not ${DIGIT_HEIGHT} rows`).toBe(DIGIT_HEIGHT);
      for (const row of glyph) expect(row.length, `digit ${i} is not ${DIGIT_WIDTH} wide`).toBe(DIGIT_WIDTH);
    }
  });

  test('a number is drawn the width it says it is', () => {
    expect(numberWidth(7)).toBe(DIGIT_WIDTH);
    expect(numberWidth(42)).toBe(DIGIT_WIDTH * 2 + 1);

    const fb = screen();
    drawNumber(fb, 42, 100, 90, 0xffffffff, INTO);
    let left = Infinity;
    let right = -Infinity;
    for (let y = 0; y < fb.height; y++) {
      for (let x = 0; x < fb.width; x++) {
        if (fb.pixels[y * fb.width + x] !== 0) {
          left = Math.min(left, x);
          right = Math.max(right, x);
        }
      }
    }
    expect(right - left + 1, 'the drawn number is not the width `numberWidth` promised')
      .toBe(numberWidth(42));
  });

  test('⚠️ and it is clipped by the caller rectangle, not only by the buffer', () => {
    const fb = screen();
    const tight = { x: 100, y: 88, width: 3, height: 2 };
    drawNumber(fb, 88, 100, 89, 0xffffffff, tight);
    for (let y = 0; y < fb.height; y++) {
      for (let x = 0; x < fb.width; x++) {
        if (fb.pixels[y * fb.width + x] === 0) continue;
        expect(x >= tight.x && x < tight.x + tight.width, `a digit pixel at column ${x}`).toBe(true);
        expect(y >= tight.y && y < tight.y + tight.height, `a digit pixel at row ${y}`).toBe(true);
      }
    }
  });
});

/**
 * ⚠️ AND A PICTURE ON DISK, BECAUSE `CLAUDE.md` SAYS SO: "Look at the output, not only at the
 * assertions. Every render gate in this repository asked about a part... and none asked what the frame
 * looks like. Three defects lived in that gap at once."
 *
 * Every assertion above is about a part — a ratio, a clipped edge, a blended pixel. None of them can
 * tell whether a comet READS: whether the digits are legible at three by five, whether the halo looks
 * like a shadow or like damage, whether three of them over a real playfield is a game or a mess. This
 * writes the frame and leaves it where a person can open it.
 */
describe('the frame itself', () => {
  test('a table, three comets and the ball, at shots/comets.png', () => {
    const table = LOW_ORBIT;
    const artPath = `app/assets/tables/${table.name}.png`;
    const art = existsSync(artPath) ? readPng(readFileSync(artPath)) : null;
    const picture = drawTable({
      table,
      litLamps: [],
      ...(art && art.width === table.size.width && art.height === table.size.height
        ? { backdrop: art.pixels } : {}),
    });

    const layout = layoutHud({ ...DEFAULT_HUD, playfieldWidth: table.size.width });
    const fb = createFramebuffer(320, 180);
    blitView(fb, picture, layout.playfield, 0, 0);

    // Three at once, which is the most the Dev allows, at the three sizes a comet is ever seen at:
    // arriving, on its way out, and coming apart.
    const shown: Comet[] = [
      { id: 1, value: 24, multiple: true, x: 40, y: 40, state: 'falling', scale: 1, alpha: 1 },
      { id: 2, value: 7, multiple: false, x: 100, y: 95, state: 'fading', scale: 0.62, alpha: 1 },
      { id: 3, value: 56, multiple: true, x: 145, y: 140, state: 'bursting', scale: 1.5, alpha: 0.55 },
    ];
    for (const c of shown) drawComet(fb, c, layout.playfield, 0, 0);
    drawBall(fb, { active: true, position: { x: 62, y: 52 } }, table.ballRadius, layout.playfield, 0, 0);

    mkdirSync('shots', { recursive: true });
    const MAGNIFY = 3;
    writeFileSync(
      'shots/comets.png',
      buildPng(
        magnify(new Uint8Array(fb.bytes.buffer, fb.bytes.byteOffset, fb.bytes.length),
          fb.width, fb.height, MAGNIFY),
        fb.width * MAGNIFY, fb.height * MAGNIFY,
      ),
    );

    expect(existsSync('shots/comets.png'), 'the shot was not written').toBe(true);
  });
});

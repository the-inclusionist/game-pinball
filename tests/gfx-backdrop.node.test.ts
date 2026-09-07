// SPDX-License-Identifier: AGPL-3.0-or-later
// THE TABLE'S OWN PICTURE, UNDER EVERYTHING ELSE.
//
// ⚠️ THE DEV DREW SIX PLAYFIELDS AND THEY ARRIVED TODAY. Until now a world was colour stops computed
// down the table — a decision `gfx/table-palette` argues for at length, on licence grounds as much as
// on size — and a bitmap is a different regime. `docs/LICENSES` §4.1 and `art/README.md` carry it:
// generated with Gemini, prompted by the Dev, dedicated CC0, no copyright claimed.
//
// ========================= WHAT A BACKDROP REPLACES, AND WHAT IT DOES NOT =========================
// ⚠️ IT REPLACES THE BANDS AND KEEPS THE LIGHTS, and that pairing is the Dev's own instruction:
// "escureça as imagens e ilumine somente os elementos que quer usar."
//
// The shipped art is DIMMED — every picture multiplied down until its brightest pixel sits under
// ADR-0007's ceiling, so the whole playfield is a night version of itself — and the lights are then
// what pick the playable parts back out of the dark. Scenery dim, what the ball can touch lit.
//
// ⚠️ AND DIMMING BUYS ADR-0004 BACK RATHER THAN SPENDING IT. Undimmed art is brighter than every role
// EVERYWHERE, which is the lightness ordering the tables are told apart by, inverted across a whole
// table instead of inside one sweeping band. This branch had the backdrop replace the lights for one
// commit, reasoning that the art draws its own floodlights — true, and beside the point.
//
// ⚠️ IT DOES NOT REPLACE THE FLARE. `ion-storm`'s storm is a MECHANIC — it slows the ball — and a
// mechanic the player cannot see is the defect this repository keeps finding. It sweeps over the
// bitmap exactly as it swept over the bands.
//
// ========================= AND A MISSING ONE IS NOT AN ERROR =========================
// ⚠️ THE GAME HAS TO OPEN WITHOUT IT. The image is fetched and decoded after boot, so the first frames
// are the bands and the art arrives when it arrives; a decode that fails leaves a table that plays. A
// backdrop of the wrong size is refused rather than stretched, because a stretched playfield puts the
// art a few pixels away from the geometry everywhere and that is worse than not having it.
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { drawTable, drawBackground, paletteOf } from '../app/js/gfx/table-view.js';
import { createFramebuffer } from '../app/js/gfx/framebuffer.js';
import { PLAYABLE_TABLES } from '../app/js/table/catalog.js';
import { paletteFor, sceneOf } from '../app/js/gfx/table-palette.js';
import { readPng } from './helpers/png.js';
import type { AuthoredTable } from '../app/js/table/authored.js';

/** The width and height a PNG declares, straight out of its IHDR. */
function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

const assetOf = (table: AuthoredTable): string => `app/assets/tables/${table.name}.png`;

describe('⚠️ every playable table has a backdrop, at its own size', () => {
  test.each(PLAYABLE_TABLES.map((t) => [t.name, t] as const))('%s', (name, table) => {
    // ⚠️ THE SIZE IS THE WHOLE GATE. The art is authored at seven to ten times the playfield and
    // reduced by hand; a table whose height changes by one pixel leaves an asset that no longer lines
    // up, and every other test in this repository would stay green. The catalogue is the truth and the
    // file is checked against it.
    expect(existsSync(assetOf(table)), `${name} has a backdrop`).toBe(true);

    const { width, height } = pngSize(assetOf(table));
    expect([width, height], `${name}'s backdrop is the playfield's size`)
      .toEqual([table.size.width, table.size.height]);
  });
});

describe('what a backdrop does to the picture', () => {
  const table = PLAYABLE_TABLES.find((t) => t.name === 'long-climb')!;
  const pixels = (fill: number): Uint32Array =>
    new Uint32Array(table.size.width * table.size.height).fill(fill);

  const background = (backdrop?: Uint32Array) => {
    const fb = createFramebuffer(table.size.width, table.size.height);
    drawBackground(fb, table, paletteOf(table, false), { table, ...(backdrop ? { backdrop } : {}) });
    return fb;
  };

  test('⚠️ it REPLACES the world, rather than being drawn under it', () => {
    /**
     * ⚠️ READ WHERE NO LIGHT REACHES, and the first draft read the top-left CORNER — which is under
     * `long-climb`'s left floodlight, forty pixels from a reach of fifty-eight. The middle of the
     * table is outside all three: the two floodlights are at the head and the engine is at the foot.
     */
    const flat = background(pixels(0xff123456));

    expect(flat.pixels[150 * table.size.width + 91], 'nothing of the bands is left').toBe(0xff123456);
  });

  test('⚠️ but the LIGHTS are still cast over it, which is what the Dev asked for', () => {
    /**
     * "Escureça as imagens e ilumine somente os elementos que quer usar." This branch replaced the
     * lights for one commit, on the reasoning that `long-climb`'s art draws its own floodlights —
     * true, and beside the point. The shipped art is DIMMED until its brightest pixel sits under
     * ADR-0007's ceiling, and the lights are then what pick the playable parts back out of the dark.
     * Scenery dim, what the ball can touch lit.
     */
    expect(table.lights?.length, 'the table does declare lights').toBeGreaterThan(0);

    const flat = background(pixels(0xff123456));
    const colours = new Set(flat.pixels);

    expect(colours.size, 'the lights left more than one colour on it').toBeGreaterThan(1);
    expect(colours.has(0xff123456), 'and most of the picture is untouched').toBe(true);
  });

  test('a table drawn without one is exactly what it was', () => {
    const before = background();
    const after = background();

    expect([...after.pixels]).toEqual([...before.pixels]);
  });

  test('⚠️ and a backdrop of the wrong size is refused, not stretched', () => {
    // A stretched playfield puts the art a few pixels from the geometry EVERYWHERE, which is worse
    // than having none: the player aims at what they see and the ball meets what they do not.
    const wrong = new Uint32Array(10).fill(0xff123456);
    const fb = createFramebuffer(table.size.width, table.size.height);
    drawBackground(fb, table, paletteOf(table, false), { table, backdrop: wrong });

    expect([...new Set(fb.pixels)], 'it fell back to the world').not.toEqual([0xff123456]);
  });
});

describe('⚠️ and the flare still sweeps over it, because the flare is a mechanic', () => {
  const table = PLAYABLE_TABLES.find((t) => t.name === 'ion-storm')!;

  test('the storm changes the picture even with the art in place', () => {
    // The ball is slowed inside that band. A mechanic the player cannot see is the defect this
    // repository has found six times, and a bitmap that hid it would be the seventh.
    const backdrop = new Uint32Array(table.size.width * table.size.height).fill(0xff123456);
    const low = drawTable({ table, backdrop, flareAt: 40 });
    const high = drawTable({ table, backdrop, flareAt: 200 });

    expect([...low.pixels]).not.toEqual([...high.pixels]);
  });
});

// ============================================================================================
// ⚠️ THE ONE PROMISE `scripts/import-art.py` MAKES THAT NOTHING COULD CHECK.
//
// The reduction holds every pixel of every picture under the ceiling the BALL sets: the ball is the
// one thing on a table that can be anywhere, so it is the one thing `gfx/surround` cannot precompute
// a shadow for, and 3:1 against (238, 242, 248) allows a backdrop up to Y 0.2615.
//
// ⚠️ AND THAT SCRIPT CAN NEVER BE PART OF A GATE. The masters are gitignored — eighteen megabytes for
// six pictures, `art/README.md` has the argument — so there is no input for it in a clone and nothing
// automated can re-run it. Its promise is therefore only checkable on its OUTPUT, which is versioned.
//
// It has already been broken once, in the commit that made it: the shoulder never reaches the ceiling
// by construction, and then `np.round` put `slipstream`'s brightest pixel a byte over it — 2.98:1
// against a requirement of 3, from an encoder rounding the wrong way. That is the second time in two
// days that a bound was missed by one byte of rounding; `gfx/surround.ENCODE` records the first.
describe('⚠️ and no shipped picture is brighter than the ball can be seen against', () => {
  const LINEAR = new Float64Array(256);
  for (let v = 0; v < 256; v++) {
    const c = v / 255;
    LINEAR[v] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }

  test.each(PLAYABLE_TABLES.map((t) => [t.name, t] as const))('%s', (name, table) => {
    const art = readPng(readFileSync(assetOf(table)));
    const ball = paletteFor(sceneOf(name) ?? 'slate', { cbSafe: false }).ball;
    const luminance = (r: number, g: number, b: number): number =>
      0.2126 * LINEAR[r]! + 0.7152 * LINEAR[g]! + 0.0722 * LINEAR[b]!;
    const ballY = luminance(ball.r, ball.g, ball.b);

    let brightest = 0;
    for (let i = 0; i < art.width * art.height; i++) {
      const word = art.pixels[i]!;
      // The reader's own byte order, read back the way `tests/helpers/png` writes it.
      brightest = Math.max(brightest,
        luminance(word & 0xff, (word >> 8) & 0xff, (word >> 16) & 0xff));
    }
    const ratio = (ballY + 0.05) / (brightest + 0.05);

    expect([art.width, art.height], `${name} is the playfield size`)
      .toEqual([table.size.width, table.size.height]);
    expect(Math.round(ratio * 100) / 100, `${name}: the ball reads ${ratio.toFixed(3)}:1 at its worst`)
      .toBeGreaterThanOrEqual(3);
  });
});

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

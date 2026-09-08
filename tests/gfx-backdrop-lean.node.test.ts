// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PICTURE LEANS WITH THE TABLE, OR IT IS LYING ABOUT WHERE THE WALLS ARE.
//
// ⚠️ THE DEV, LOOKING AT A TABLE IN PLAY: "Você deformou os artefatos que compõe a mesa mas não deformou
// a arte?" He is right, and it is the worst kind of wrong `gfx/backdrop` has a rule about.
//
// That module refuses a picture of the wrong SIZE, and says why: "a stretched playfield puts the art a
// few pixels from the geometry EVERYWHERE, which is worse than having none: the player aims at what they
// see and the ball meets what they do not." Then `table/perspective` leaned every component nine degrees
// and the bitmap went on being blitted upright — the right size and the wrong SHAPE, which the rule was
// about and the check was not. At the top of `factory` the wall and its painted wall are 47 units apart.
//
// ========================= THE CLAIM IS THAT ONE MAP IS THE OTHER'S INVERSE =========================
// The geometry's map is `taperMap`: it says where a component at (x, y) is drawn. The picture's map has
// to be its inverse — for the destination column the walls now stand in, which column of the painted
// rectangle belongs there. Asserting that against a hand-written formula would be writing the transform
// twice and hoping; this file round-trips through `taperMap` itself, so the two cannot drift apart
// without a gate going red.
import { describe, test, expect } from 'vitest';
import { leanPicture } from '../app/js/gfx/backdrop.js';
import { taperMap, leanOf } from '../app/js/table/perspective.js';
import { plungerLaneOf } from '../app/js/table/cabinet.js';
import { PLAYABLE_TABLES } from '../app/js/table/catalog.js';

const TABLE = PLAYABLE_TABLES[0]!;
const { width: W, height: H } = TABLE.size;

/** A picture in which every pixel says which column it came from, so a warp can be read back. */
function columnStripes(): Uint32Array {
  const out = new Uint32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out[y * W + x] = x + 1;
  return out;
}

describe('the backdrop is leaned by the table’s own map', () => {
  const leaned = leanPicture(columnStripes(), TABLE.size);
  const map = taperMap(TABLE);

  test.each([0, 40, 100, H - 60, H - 1])('at y = %i the picture follows the geometry', (y) => {
    /**
     * ⚠️ THE ROUND TRIP IS THE WHOLE ASSERTION. For a source column `x`, `taperMap` says which column
     * the geometry standing there is drawn in; the picture must have carried that same column to that
     * same place. Within one, because both ends round to whole pixels and a picture cannot hold a
     * fraction of a column.
     */
    for (let x = 4; x < W - 4; x += 7) {
      const at = Math.round(map(x, y));
      if (at < 0 || at >= W) continue;
      const carried = leaned[y * W + at]! - 1;
      expect(Math.abs(carried - x), `y=${y}: column ${x} is drawn at ${at} and the picture has`
        + ` ${carried} there`).toBeLessThanOrEqual(1);
    }
  });

  test('⚠️ the base row is untouched, because the lean is nothing there', () => {
    // `table/perspective` makes the floor the identity on purpose: the flippers, the drain and the
    // plunger's seat are the numbers this port tuned by playing. If the picture moved there, it would
    // be moving under the one part of the table nothing else moves under.
    /**
     * ⚠️ FROM ONE TO W−2, AND THE EDGE COLUMN IS NOT A ROUNDING ERROR TO WAVE AT. The identity is at
     * `y = h`, which is the floor LINE; the last row of pixels is one above it and leans by a sixth of
     * a unit. So the outermost column of that row comes from a sixth of a pixel outside the picture and
     * is left empty, exactly as the corners at the top are. Asserting over it would be asserting that a
     * lean of nine degrees is a lean of nothing.
     */
    const row = (H - 1) * W;
    for (let x = 1; x < W - 1; x++) expect(leaned[row + x], `column ${x}`).toBe(x + 1);
  });

  test('⚠️ and the corners outside the trapezium are left empty', () => {
    /**
     * They are not part of the table any more: nothing stands there and no ball can reach it.
     * Stretching the art into them would be painting playfield where there is none — which is the
     * same mistake as stretching a picture of the wrong size, one shape further in.
     */
    const inset = leanOf(TABLE) * H;

    expect(leaned[0], 'the top-left corner has picture in it').toBe(0);
    expect(leaned[Math.round(inset) - 2], 'still outside the left wall at the top').toBe(0);
    expect(leaned[Math.round(inset) + 4], 'and inside it there IS picture').toBeGreaterThan(0);
  });

  test('⚠️ the lane slides whole, which is what keeps it passable', () => {
    /**
     * The playfield is squeezed and the lane is only moved — `table/perspective` argues why at length,
     * and a picture that squeezed the lane would draw a wedge over a corridor that is not one. Two
     * columns a fixed distance apart inside the lane must stay that distance apart after the warp.
     */
    const { divider } = plungerLaneOf(TABLE.size);
    const y = 60;
    const inset = leanOf(TABLE) * (H - y);
    const left = Math.round(divider + 2 - inset);
    const right = Math.round(W - 6 - inset);

    const carriedLeft = leaned[y * W + left]! - 1;
    const carriedRight = leaned[y * W + right]! - 1;

    expect(carriedRight - carriedLeft, `the lane's ${W - 8 - divider} units came out`
      + ` ${carriedRight - carriedLeft}`).toBeCloseTo(right - left, 0);
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
// A COMPONENT OF THE 1995 TABLE, AS A RECTANGLE ON THE SCREEN.
//
// The engine's declaration wants one of these per component: `{ name, role, bounds }`, in the pixels of
// the picture. The authored tables carry theirs in the file that declares them; the 1995 table carries
// its shapes in record 600, in the table's own float units, and nothing had ever turned one into the
// other.
//
// ⚠️ THIS IS HALF OF WHAT THE ACCESSIBILITY LAYER NEEDS AND IT IS THE HALF WITHOUT A JUDGEMENT IN IT.
// The other half is the ROLE — hazard, goal, key, gate, structure, climb, water, free — and the
// authored tables assign those by hand, one component at a time, with no rule anywhere that derives a
// role from a kind: `plunger` is `structure` while `lane.launch` is `free`. Inventing a mapping for the
// eighteen kinds of the 1995 table would be inventing what a blind player is told the table contains,
// which is the Dev's call and not a transcription. So the geometry is done and the description waits.
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { readGroups } from '../app/js/dat/partman.js';
import { floatAttribute } from '../app/js/dat/attributes.js';
import { boundsOfWall, WALL_RECORD } from '../app/js/table/original.js';
import { readCamera, screenBoundsOf, decodePlayfield } from '../app/js/gfx/original-view.js';
import { halve } from '../app/js/gfx/scale.js';

const DAT = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.DAT';
const archive = () => {
  if (!existsSync(DAT)) return null;
  const buf = readFileSync(DAT);
  return readGroups(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
};

/** The same halving the demonstration draws at — decision 5 of the plan. */
const SCALE = 0.5;

describe('a component’s rectangle on the halved playfield', () => {
  test('⚠️ `a_bump1` lands where the picture shows it, and it is a bumper-sized rectangle', () => {
    // Record 600 of `a_bump1` is `[1, 0.01, -3.72, 0.35]` — a CIRCLE of radius 0.35 at (0.01, -3.72).
    // On the picture that is a little over four pixels across, up in the middle of the table where the
    // attack bumpers are, which is exactly where `shots/demo-original-live.png` shows their caps.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);
    const camera = readCamera(groups, { scale: SCALE });
    const picture = halve(decodePlayfield(groups));
    const record = floatAttribute(groups.find((g) => g.name === 'a_bump1')!, WALL_RECORD)!;

    const rect = screenBoundsOf(boundsOfWall([...record]), camera.projection);

    expect(rect.width, 'a 0.7-unit circle, halved').toBeGreaterThan(2);
    expect(rect.width).toBeLessThan(12);
    // ⚠️ AND IT IS WIDER THAN IT IS TALL, which is the projection and not a defect. The 1995 camera
    // looks down the table at an angle, so a circle on the playfield is an ellipse on the screen —
    // six pixels across and five high for this one. I wrote `toBeCloseTo(width)` first, assuming a
    // square, and the number said otherwise.
    expect(rect.height, 'foreshortened').toBeLessThan(rect.width);
    expect(rect.height).toBeGreaterThan(rect.width * 0.6);
    // Inside the picture, in its upper half — the attack bumpers are above the middle of the table.
    expect(rect.x).toBeGreaterThan(0);
    expect(rect.x + rect.width).toBeLessThan(picture.width);
    expect(rect.y + rect.height, 'above the middle').toBeLessThan(picture.height / 2);
  });

  test('⚠️ THE FOUR CORNERS, because the table’s axes are not the screen’s', () => {
    // Projecting only the minimum and maximum corner would be right if the camera only scaled. It
    // rotates as well, and a rectangle built from two corners of a rotated projection is neither of
    // them. The proof is a box whose corners project to a WIDER extent than its two extremes do.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);
    const { projection } = readCamera(groups, { scale: SCALE });
    const box = { xMin: -4, yMin: -4, xMax: 4, yMax: 4 };

    const four = screenBoundsOf(box, projection);

    // ⚠️ THE NUMBERS, NOT A COMPARISON WITH A SECOND CALCULATION. I wrote this as
    // `expect(four.width).toBeGreaterThanOrEqual(two.width)` with `two` computed here from the same
    // pair of corners — so the mutant that reduced the function to those two corners made the two
    // sides equal and the assertion passed. Third time this week a test has read by the same link as
    // the code it was checking.
    //
    // The box (-4,-4) to (4,4) projects to corners (121,62) (61,62) (126,117) (56,117): screen x runs
    // from 56 to 126 because `toScreen` divides by a depth that depends on table Y, so the same table X
    // lands in a different column at each end of the box. Seventy pixels across from four corners;
    // sixty-five from the two extremes, which is the five this rule is worth.
    expect(four.width).toBeCloseTo(70, 0);
    expect(four.height).toBeCloseTo(55, 0);
  });

  test('⚠️ and a record that reaches past the table is NOT clamped', () => {
    // `drain`'s line runs from x = -10.39 to x = 10.32 on a table sixteen wide. Whether that is a clamp
    // or a refusal depends on what the caller is for, so this returns the rectangle it computed and
    // says so rather than quietly trimming it.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);
    const camera = readCamera(groups, { scale: SCALE });
    const picture = halve(decodePlayfield(groups));
    const record = floatAttribute(groups.find((g) => g.name === 'drain')!, WALL_RECORD)!;

    const rect = screenBoundsOf(boundsOfWall([...record]), camera.projection);

    expect(rect.x + rect.width, 'wider than the picture, and left that way')
      .toBeGreaterThan(picture.width);
  });
});

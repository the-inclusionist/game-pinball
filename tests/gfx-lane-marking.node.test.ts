// SPDX-License-Identifier: AGPL-3.0-or-later
// A LANE IS A STRETCH OF FLOOR, AND IT WAS DRAWN AS A SOLID BODY.
//
// ⚠️ THE DEV, PLAYING: "Você está desenhando artefatos embaixo das pás e continuidade das pás: não tem
// como interagir com estes itens, desenhe-os nos lugares certos."
//
// Two complaints in one sentence, and the second half names the defect exactly: THINGS THE BALL CANNOT
// INTERACT WITH, DRAWN AS THOUGH IT COULD. The inlanes sit twelve pixels wide and twenty-two tall
// directly above each flipper's pivot, filled in solid grey with a lit top edge — the same mark a
// bumper, a wall and a target get — so beside a paddle stroked in the same family of grey they read as
// the paddle continuing upward. A player aims at one and the ball goes straight through.
//
// ========================= AND IT IS NOT A PLACEMENT PROBLEM =========================
// The first reading was that the inlanes are in the wrong place. They are not: an inlane IS the strip
// between the funnel guide and the paddle it feeds, and `table/cabinet` records moving them onto the
// pivots for exactly that reason. What is wrong is the MARK.
//
// `gfx/table-view` had one branch for "this component declared no collision" and it used the most
// emphatic mark available: a filled rectangle with light and shade on it. Fill is mass. A lane has no
// mass — `table/authored` says so in as many words, "a lane is a stretch of table the ball rolls
// over", and `STRUCK_KINDS` is the list it is deliberately absent from.
//
// ========================= RAILS RATHER THAN AN OUTLINE =========================
// ⚠️ AN OUTLINE IS STILL A CLOSED SHAPE, which is to say still an object — a hollow box instead of a
// solid one. Two rails along the long edges, open at both ends, are what a lane looks like from above
// and are the one mark that cannot be mistaken for something to hit. The ends being open is the whole
// of it: that is where the ball comes in and goes out.
//
// ⚠️ AND ONLY LANES. A well, a hole and a drain declare no collision either, and each is a MOUTH — a
// filled shape is the right mark for something that swallows the ball, and the drain reading as a red
// bar across the floor is the table telling the truth. The rule is the kind, not the absence.
import { describe, test, expect } from 'vitest';
import { drawTable, packRgb, paletteOf } from '../app/js/gfx/table-view.js';
import { backdropAt } from '../app/js/gfx/table-palette.js';
import { ION_STORM } from '../app/js/table/ion-storm.js';
import type { AuthoredComponent, AuthoredTable } from '../app/js/table/authored.js';

const table: AuthoredTable = ION_STORM;
const palette = paletteOf(table, false);
const at = (fb: { pixels: Uint32Array }, x: number, y: number): number =>
  fb.pixels[y * table.size.width + x]!;

/** The colour the world is at that row, which is what a lane must leave showing through. */
const groundAt = (y: number): number => packRgb(
  palette.bands
    ? backdropAt(palette.bands, table.size.height <= 1 ? 0 : y / (table.size.height - 1))
    : palette.ground,
);

const named = (name: string): AuthoredComponent => table.components.find((c) => c.name === name)!;

describe('a lane is drawn as floor and not as furniture', () => {
  const picture = drawTable({ table });

  test('⚠️ the floor between its rails is the WORLD, not the lane', () => {
    // The claim the Dev's sentence is about. A filled lane is a body the ball passes through, which is
    // the one thing a picture must never say.
    const lane = named('inlane.left').bounds;
    const midX = Math.floor(lane.x + lane.width / 2);
    const midY = Math.floor(lane.y + lane.height / 2);

    expect(at(picture, midX, midY)).toBe(groundAt(midY));
  });

  test('its two long edges are drawn, so it is still a lane and not nothing at all', () => {
    const lane = named('inlane.left').bounds;
    const midY = Math.floor(lane.y + lane.height / 2);
    const rail = packRgb(palette.roles[named('inlane.left').role]);

    expect(at(picture, Math.floor(lane.x), midY), 'the left rail').toBe(rail);
    expect(at(picture, Math.floor(lane.x + lane.width) - 1, midY), 'the right rail').toBe(rail);
  });

  test('⚠️ and its ENDS ARE OPEN, which is what makes it read as somewhere to go through', () => {
    // An outline would close them, and a closed shape is an object however thin its border is.
    const lane = named('inlane.left').bounds;
    const midX = Math.floor(lane.x + lane.width / 2);

    expect(at(picture, midX, Math.floor(lane.y)), 'the top end').toBe(groundAt(Math.floor(lane.y)));
    expect(at(picture, midX, Math.floor(lane.y + lane.height) - 1), 'the bottom end')
      .toBe(groundAt(Math.floor(lane.y + lane.height) - 1));
  });

  test('a WIDE lane gets its rails along its long axis, which is the other one', () => {
    // The rails follow the direction of travel, and the direction of travel is the long side. A lane
    // railed on its short sides would be two dashes with a gap, which is not a lane, it is a gate.
    const wide: AuthoredTable = {
      ...table,
      components: [...table.components, {
        name: 'lane.wide', kind: 'lane', role: 'key',
        bounds: { x: 60, y: 40, width: 40, height: 10 },
        scores: [100], control: 'LaneControl', lamps: [],
      }],
    };
    const fb = drawTable({ table: wide });
    const rail = packRgb(paletteOf(wide, false).roles.key);

    expect(at(fb, 80, 40), 'the top rail').toBe(rail);
    expect(at(fb, 80, 49), 'the bottom rail').toBe(rail);
    expect(at(fb, 60, 45), 'the left end is open').toBe(groundAt(45));
  });
});

describe('⚠️ and everything that is NOT a lane keeps its body', () => {
  const picture = drawTable({ table });

  test('a drain is a mouth, and a mouth is filled', () => {
    // The rule is the KIND, not the absence of a collision — a drain declares none either. A drain
    // drawn as two rails would be an open channel the ball rolls along, which is the opposite of what
    // it does to a ball.
    const drain = named('drain').bounds;
    const midX = Math.floor(drain.x + drain.width / 2);
    const midY = Math.floor(drain.y + drain.height / 2);

    expect(at(picture, midX, midY)).toBe(packRgb(palette.roles[named('drain').role]));
  });

  test('and a bumper is still a bumper', () => {
    const bumper = named('storm1');
    const midX = Math.floor(bumper.bounds.x + bumper.bounds.width / 2);
    const midY = Math.floor(bumper.bounds.y + bumper.bounds.height / 2);

    expect(at(picture, midX, midY)).not.toBe(groundAt(midY));
  });
});

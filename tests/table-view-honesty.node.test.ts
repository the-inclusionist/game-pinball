// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { drawTable, paletteOf, packRgb, EDGE_THICKNESS } from '../app/js/gfx/table-view.js';
import { backdropAt } from '../app/js/gfx/table-palette.js';
import { CATALOG as TABLES } from '../app/js/table/catalog.js';

/**
 * The colour of nothing, on THIS table.
 *
 * ⚠️ IT USED TO BE ONE CONSTANT for every table, and that stopped being true when the tables were
 * given worlds to stand in: `low-orbit`'s ground is the blue of its sky, `narrow-tower`'s the red of
 * Mars. Comparing against the neutral would count every pixel of every table as painted, and this
 * whole file would pass by finding lies everywhere and reporting the first twelve.
 *
 * It reads the ground the same way the renderer does, which would hide a fault in `paletteOf`
 * itself — but that is not what this file is asking about. What is painted where is; that the
 * ground is the table's own colour and not the neutral is asserted in `tests/gfx-table-view`.
 */
/**
 * ⚠️ AT A ROW, BECAUSE A WORLD MAY BE A GRADIENT NOW. This took the table's one flat `ground` until
 * `Scene.bands` arrived — the Dev's four themes are backgrounds that change with height — and with a
 * gradient in place EVERY pixel differs from the flat colour, so this whole file reported the entire
 * table as painted where nothing is solid. Six tests at once, which is the gate correctly refusing a
 * question that had stopped making sense rather than a defect in the drawing.
 *
 * The question it asks is unchanged: is this pixel a colour other than the ground HERE.
 */
const groundAt = (table: AuthoredTable, y: number) => {
  const palette = paletteOf(table, false);
  if (!palette.bands) return packRgb(palette.ground);
  const at = table.size.height <= 1 ? 0 : y / (table.size.height - 1);
  return packRgb(backdropAt(palette.bands, at));
};
import { CATALOG } from '../app/js/table/catalog.js';
import type { AuthoredTable } from '../app/js/table/authored.js';

/**
 * ⚠️ THE PICTURE IS NOT ALLOWED TO CLAIM SOLID WHERE NOTHING IS SOLID.
 *
 * `drawTable` filled every component's BOUNDS, and for most components that is close enough to the
 * truth: a wall's collision line runs along the edge of a four-pixel rectangle, so a player aiming at
 * the rectangle is wrong by at most four pixels.
 *
 * A DIAGONAL breaks it completely. `wide-arc`'s ramp is a line from (250, 170) to (330, 90) inside
 * bounds of 84x84, so the drawing painted a solid yellow square whose far corner is eighty pixels from
 * anything the ball can touch. Booting the built page is what showed it: a big block where the ball
 * flies straight through. That is not a matter of art style — no style makes a picture that lies about
 * the geometry fair to play.
 *
 * The rule, then: a component that DECLARES collision is drawn as that collision. A component that
 * declares none is drawn as its bounds, because for a drain or a lane the bounds is not an
 * approximation of something else — it IS the thing.
 *
 * The check below measures distance geometrically while the renderer rasterises with a loop, so the
 * two answer the same question by different means rather than agreeing with themselves.
 */

/** Exact distance from a point to a segment. The renderer does not compute this; that is the point. */
function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Rounding slack: a rasteriser lands on whole pixels and a distance does not. */
const SLACK = 1.5;

function isSolidAt(table: AuthoredTable, px: number, py: number): boolean {
  for (const component of table.components) {
    // ⚠️ A FLIPPER IS SOLID ALONG ITS OWN DECLARATION, NOT ACROSS ITS BOUNDS. When flippers stopped
    // declaring `collision` and started declaring a pivot and a tip, this file went on passing — and
    // it passed by COLLUSION: the renderer fell into "no collision, so fill the bounds" and so did the
    // check, and the two agreed with each other about a rectangle the ball flies through. The whole
    // point of measuring distance here is to not be the same code as the renderer, and that is worth
    // nothing if both sides consult the same fallback.
    if (component.kind === 'flipper' && component.flipper) {
      const f = component.flipper;
      if (distanceToSegment(px, py, f.pivot.x, f.pivot.y, f.tipAtRest.x, f.tipAtRest.y)
        <= EDGE_THICKNESS / 2 + SLACK) {
        return true;
      }
      continue;
    }
    if (!component.collision?.length) {
      const b = component.bounds;
      if (px >= b.x - SLACK && px <= b.x + b.width + SLACK && py >= b.y - SLACK && py <= b.y + b.height + SLACK) {
        return true;
      }
      continue;
    }
    for (const shape of component.collision) {
      if (shape.kind === 'circle') {
        if (Math.hypot(px - shape.at.x, py - shape.at.y) <= shape.radius + SLACK) return true;
      } else if (
        distanceToSegment(px, py, shape.from.x, shape.from.y, shape.to.x, shape.to.y)
        <= EDGE_THICKNESS / 2 + SLACK
      ) {
        return true;
      }
    }
  }
  return false;
}

describe('⚠️ the drawing tells the truth about what the ball can touch', () => {
  test.each(CATALOG.map((t) => [t.name, t] as const))(
    '%s: no painted pixel sits where the ball would pass straight through',
    (_name, table) => {
      const fb = drawTable({ table });
      const lies: string[] = [];

      for (let y = 0; y < fb.height; y++) {
        for (let x = 0; x < fb.width; x++) {
          if (fb.pixels[y * fb.width + x] === groundAt(table, y)) continue;
          if (!isSolidAt(table, x + 0.5, y + 0.5)) lies.push(`${x},${y}`);
        }
      }

      expect(lies.slice(0, 12)).toEqual([]);
    },
  );

  test('⚠️ and the stroke is not wide enough to overstate on its own', () => {
    // The check above imports EDGE_THICKNESS, so it measures against whatever width the renderer
    // declares — which means a wide enough stroke would satisfy it while painting a rectangle again.
    // The bound closes that: an edge drawn wider than the BALL is wider than the thing that hits it,
    // and at that point the picture has resumed claiming area the physics does not have.
    for (const table of CATALOG) {
      expect(EDGE_THICKNESS).toBeLessThanOrEqual(table.ballRadius);
    }
    expect(EDGE_THICKNESS).toBeGreaterThanOrEqual(1);
  });

  test('⚠️ a flipper is drawn along its pivot and tip, not across its bounds', () => {
    // The specific pixel: `low-orbit`'s left flipper has bounds (52,206)-(80,213) and runs from
    // (52,206) to (80,213), so the bounds' OTHER corner — (52,212) — is under the rectangle and away
    // from the flipper. It was painted while flippers carried a collision line, stopped being painted
    // when the renderer started drawing collisions, and started again when flippers stopped declaring
    // one. Third time it has been wrong, and the first time anything says so.
    const lowOrbit = CATALOG.find((t) => t.name === 'low-orbit')!;
    const fb = drawTable({ table: lowOrbit });

    expect(fb.pixels[212 * fb.width + 53]).toBe(groundAt(lowOrbit, 212));
  });

  test('wide-arc’s ramp corner is empty space, and is drawn as empty space', () => {
    // The specific pixel the browser showed as a solid yellow block. The line's far corner
    // (330, 170) is eighty pixels from the ramp and inside the bounds that used to be filled.
    const wideArc = CATALOG.find((t) => t.name === 'wide-arc')!;
    const fb = drawTable({ table: wideArc });

    expect(fb.pixels[170 * fb.width + 328]).toBe(groundAt(wideArc, 170));
  });
});

/**
 * ⚠️ HOW MUCH OF THE TABLE IS PAINTED, PINNED TO A NUMBER.
 *
 * A golden count is a blunt instrument and it is here because the sharp ones did not work. Lighting the
 * components introduced a highlight stamped half a pixel above each two-pixel line: it covered the body,
 * turned the walls and the ramp pale on screen, and WIDENED every stroke — the drawing claiming area
 * the ball cannot touch, which is the defect this whole file was written for.
 *
 * Nothing caught it. The check above tolerates half a pixel; the shading tests cover the fill helpers
 * and not the stroke path; every other assertion in the repository stayed green. It was found by
 * opening the PNG, and then confirmed by putting the mutation back and watching seventeen tests pass.
 *
 * A count catches it exactly, because widening a line cannot help but change one. The cost is that a
 * deliberate change to a table's geometry or to `EDGE_THICKNESS` must come here and update the number
 * ON PURPOSE — which is the point: area is not something to change by accident.
 *
 * ⚠️ AND THEY DROPPED AGAIN WHEN THE PLUNGER FOLLOWED THE FLIPPERS OUT, for the same reason: it slides
 * down its lane as it is drawn back, so a plunger stroked into a composition made once per change is a
 * plunger that never moves. Both are drawn per frame now, and the area they used to occupy here is the
 * area these counts lost — twice.
 *
 * ⚠️ EVERY NUMBER DROPPED ON 2026-09-06 AND THAT WAS THE FIX LANDING. Flippers left this picture: they
 * were stroked at their resting angle into a composition made once per change, so the paddle swung in
 * the physics and the screen showed it at rest for ever. They are drawn per frame now, with the ball,
 * from the live geometry — so the area they used to occupy here is the area the counts lost.
 */
/**
 * ⚠️ EVERY ONE OF THESE FELL, SOME BY NEARLY HALF, THE DAY LANES STOPPED BEING FILLED.
 *
 * `ring-belt` 13654 to 7246, `long-climb` 10863 to 5820, `ion-storm` 9277 to 5373. A lane is now two
 * rails with the floor showing between them rather than a solid rectangle — see `gfx/table-view`'s
 * `drawLaneRails` and the Dev's report that the inlanes read as an extension of the paddles.
 *
 * ⚠️ AND THE SIZE OF THE FALL IS ITSELF THE FINDING. Half of what these tables painted was lane, drawn
 * with the mark this renderer uses for things the ball bounces off. The three that did not move —
 * `wide-arc`, `four-flippers`, `bare-minimum` — are the three with no lanes on them, which is a
 * check on the reading rather than a coincidence.
 *
 * ⚠️ AND THEY MOVED AGAIN, BY A HANDFUL EACH, WHEN THE OUTLANES BECAME THE SIDE CHANNELS. Four pixels
 * on most tables: an outlane is longer now — guide top to floor rather than thirty pixels parked in a
 * corner — but it is two rails either way, so the change is the rails' length and nothing else.
 * `ring-belt` moved 68 and `low-orbit` 39 because their guides moved with the channel.
 */
const PAINTED = {
  // ⚠️ 6991 UNTIL THE TABLE WAS AUTHORED UP TO THE 1995 DENSITY. `tests/table-density` measures the
  // archive at 5.25 scoring components per ten thousand pixels and this table at 4.19, which is what
  // the Dev's "mesas tão simples" means once somebody counts. It gained a three-target DROP BANK on
  // the right — the half of the table where nothing was worth hitting — and the two RETURN LANES it
  // had never had, so the lower third pays for good play and not only for bad luck. +528 painted
  // pixels — 7519 with the bank against the lane divider, 7555 once it was moved under the bumpers
  // where it is reachable. This number is a golden: it moves when somebody says why.
  // ⚠️ +214 when this table finally started calling `cabinet()`. It had been writing its own shell
  // — all sixteen components — since before that module existed, so every cabinet change reached
  // five tables and skipped this one. The difference is mostly the bottom assembly moving seven
  // pixels left: this file centred the flippers and the drain on the TABLE, and the cabinet
  // centres them on the PLAY, because sixteen pixels of the width are the plunger lane.
  'low-orbit': 4972,
  // +572 on each of the four below: the cabinet's two inlanes, which five tables had never had.
  // The lower third paid 2000 for bad luck through the outlanes and nothing at all for good play.
  // ⚠️ +1768 when this table was authored up to the 1995 density: two more bumpers in the storm,
  // four drop targets in two flank shelves, three more arc rollovers and two ion trails down the
  // sides, and the eye rollover in the middle. Bumpers are the expensive ones to paint — a filled circle against a stroked line.
  'ion-storm': 5369,
  // ⚠️ +1070: the two INLANES the cabinet now gives all five of its tables, and this table's own
  // authoring up to the 1995 density — two flank drop banks and a three-rollover reentry row.
  'crater-run': 4335,
  // ⚠️ +2640, the largest single move in this table: three more bumpers in a second gauntlet, a
  // four-target drop column up the left wall, two rebounders, four rollovers on the flanks and
  // three across the head. It is 300 tall against a 180 window and had 56 pixels of nothing in
  // the middle of its own climb.
  'long-climb': 5816,
  // ⚠️ +5437, and it is the last of the six to be authored up to the 1995 density — it was the
  // thinnest by a distance, at a THIRD of the archive's. Three more rocks on the belt, a
  // three-target drop column against each far wall, two rebounder cornices, and seventeen
  // rollovers spread across a table 360 wide whose outer thirds paid nothing at all.
  // -7 when the east scree column moved up twelve pixels: sixty balls never reached its lowest target,
  // which sat where the funnel has already gathered the ball toward the middle.
  'ring-belt': 7178,
  // ⚠️ +2122 when this table was authored up to the 1995 density: two more eddies in the chamber, a
  // three-target drop COLUMN on its wall, two spillways in its corners, three wake rollovers and
  // two rebounders below the vanes.
  'slipstream': 4774,
  'wide-arc': 4313,
  // ⚠️ 3553 UNTIL THE BALL GAINED A RADIUS. `table/physics-build` now offsets every wall by it, the way
  // the original does and `physics/wall` already did for the 1995 table, and two of this fixture's
  // gates went red: the ball scored nothing and flapping changed nothing. Both were passing on luck.
  // `landing1` became a shelf spanning the tower rather than a thirty-pixel target a descending ball
  // met one time in four, and the table gained the funnel guides it had never had. That is +1285
  // painted pixels — 984 of them the wider landing — and it is a change to the TABLE, not to the
  // drawing: this number is a golden, so it moves only when somebody says why.
  'narrow-tower': 3138,
  'four-flippers': 2623,
  'bare-minimum': 388,
};

describe('⚠️ and the drawing never grows', () => {
  test('every table paints exactly the area it painted before', () => {
    const counted: Record<string, number> = {};
    for (const table of TABLES) {
      // ⚠️ ROW BY ROW, because a world may be a gradient. Comparing against one flat colour counted
      // 43,005 painted pixels on `low-orbit` — every pixel of the table — the moment `sky` grew its
      // bands. The count means "how much is not ground", and what the ground IS depends on the row.
      const fb = drawTable({ table });
      let painted = 0;
      for (let y = 0; y < fb.height; y++) {
        const ground = groundAt(table, y);
        for (let x = 0; x < fb.width; x++) if (fb.pixels[y * fb.width + x] !== ground) painted++;
      }
      counted[table.name] = painted;
    }

    expect(counted).toEqual(PAINTED);
  });

  test('and the CB-Safe palette paints the same area, because it is a colour and not a shape', () => {
    for (const table of TABLES) {
      const normal = drawTable({ table });
      const safe = drawTable({ table, cbSafe: true });
      const groundNormal = packRgb(paletteOf(table, false).ground);
      const groundSafe = packRgb(paletteOf(table, true).ground);
      const count = (fb: { pixels: Uint32Array }, ground: number) => {
        let n = 0;
        for (const p of fb.pixels) if (p !== ground) n++;
        return n;
      };

      expect(count(safe, groundSafe), table.name).toBe(count(normal, groundNormal));
    }
  });
});

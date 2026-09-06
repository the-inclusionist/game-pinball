// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { drawTable, paletteOf, packRgb, EDGE_THICKNESS } from '../app/js/gfx/table-view.js';

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
const groundOf = (table: AuthoredTable) => packRgb(paletteOf(table, false).ground);
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
          if (fb.pixels[y * fb.width + x] === groundOf(table)) continue;
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

    expect(fb.pixels[212 * fb.width + 53]).toBe(groundOf(lowOrbit));
  });

  test('wide-arc’s ramp corner is empty space, and is drawn as empty space', () => {
    // The specific pixel the browser showed as a solid yellow block. The line's far corner
    // (330, 170) is eighty pixels from the ramp and inside the bounds that used to be filled.
    const wideArc = CATALOG.find((t) => t.name === 'wide-arc')!;
    const fb = drawTable({ table: wideArc });

    expect(fb.pixels[170 * fb.width + 328]).toBe(groundOf(wideArc));
  });
});

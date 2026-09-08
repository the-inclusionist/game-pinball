// SPDX-License-Identifier: AGPL-3.0-or-later
// NOTHING A BALL CAN LAND ON MAY BE FLAT.
//
// ⚠️ FOUND BY SURVEYING WHERE BALLS COME TO REST, the day `physics/collision` learnt that friction is
// proportional to the impact. Twelve launches per table, twenty seconds each, and then the question:
// which balls are still standing? Four of the eleven tables held one, and every case was the same shape
// — a ball sitting on top of a drop target at half a unit a second, for ever.
//
// ========================= A FLAT FACE IS A SHELF AND THE PHYSICS IS RIGHT =========================
// There is no defect in the collision for this one. Gravity on a horizontal surface has NO component
// along it, so a ball that stops there has nothing to start it again — and until the friction changed,
// nothing could reach one anyway, because a wall took nine tenths of the along-wall speed on every touch
// and a ball that met anything stopped being a ball that was going anywhere.
//
// So this is a rule about TABLES, not about the engine: a drop target is a thin plate in a real machine
// and the ball cannot balance on its edge. Ours are boxes sixteen wide whose faces were written
// horizontal, which is a shelf with a score on it.
//
// ========================= AND THE ONE EXCEPTION IS THE ONE THAT IS MEANT TO HOLD ===================
// The plunger's face is flat and faces up on every table, because that is where the ball WAITS. Half of
// every table's launches end there — a draw that does not clear the lane comes back down and lands on
// the rod — and `table/cabinet`'s own note records the day it had no face at all and the ball fell
// through the floor of the table to y = 1841.
import { describe, test, expect } from 'vitest';
import { CATALOG } from '../app/js/table/catalog.js';

/**
 * How much a face may drop across its own width before it counts as a slope, as a ratio.
 *
 * ⚠️ ONE IN TWENTY, WHICH IS THREE DEGREES, AND IT IS DELIBERATELY SHALLOW. The bar is not "steep
 * enough to be fun", it is "not flat" — with friction charged against the impact a ball rolls down
 * anything that is not level, so what this gate has to refuse is the level, not the gentle.
 *
 * ⚠️ AND A STEEPER BAR WOULD BE THIS FILE DESIGNING TABLES. Whether a target sheds the ball fast or slow
 * is the author's business; whether it holds it for ever is not.
 */
const LEAST_SLOPE = 0.05;

interface Flat { readonly table: string; readonly component: string; readonly at: string; }

/**
 * Every up-facing horizontal collision line in the catalogue.
 *
 * ⚠️ UP-FACING IS THE WHOLE TEST, AND IT IS THE WINDING THAT SAYS SO. `table/authored`'s normal is
 * `(dy, −dx)`, so a horizontal line written LEFT TO RIGHT has its normal pointing up the screen and
 * catches what falls onto it; the same line written right to left faces DOWN and is struck from below.
 * `four-flippers`'s centre target and `slipstream`'s two vanes are flat and wound the other way, and
 * they are not shelves — a ball cannot rest under a ceiling.
 */
function flatShelves(): Flat[] {
  const found: Flat[] = [];
  for (const table of CATALOG) {
    for (const component of table.components) {
      // The plunger is the exception this file exists to name. See the header.
      if (component.kind === 'plunger') continue;
      for (const shape of component.collision ?? []) {
        if (shape.kind !== 'line') continue;
        const run = shape.to.x - shape.from.x;
        const rise = shape.to.y - shape.from.y;
        if (run === 0) continue;
        // `(dy, −dx)`: a normal with a negative y points up the screen, at what falls.
        const facesUp = -run < 0;
        if (!facesUp) continue;
        if (Math.abs(rise / run) >= LEAST_SLOPE) continue;
        found.push({
          table: table.name,
          component: component.name,
          at: `(${shape.from.x},${shape.from.y})-(${shape.to.x},${shape.to.y})`,
        });
      }
    }
  }
  return found;
}

describe('a face the ball can land on sheds it', () => {
  test('⚠️ no table has a flat up-facing shelf, except the plunger', () => {
    /**
     * ⚠️ THE FAILURE MESSAGE NAMES EVERY ONE, because this is a ledger-shaped gate and a count would
     * make the reader go and find them. When it was written it named eight: three drop targets on
     * `low-orbit`, three on `factory`, `long-climb`'s crest, `ring-belt`'s core and `slipstream`'s
     * meteor.
     */
    const shelves = flatShelves();

    expect(shelves.map((s) => `${s.table}/${s.component} ${s.at}`), 'these hold a ball for ever')
      .toEqual([]);
  });

  test('⚠️ and the scan can see one, or it is a gate with no subject', () => {
    /**
     * The shape every green test with no subject takes, and this repository has rewritten several. A
     * flat face is invented here and the scanner has to find it — otherwise "no shelves" would go on
     * passing after somebody changed the winding rule or the shape of `collision`.
     */
    const shelf = { kind: 'line' as const, from: { x: 10, y: 50 }, to: { x: 30, y: 50 } };
    const run = shelf.to.x - shelf.from.x;

    expect(-run < 0, 'a left-to-right line does not face up').toBe(true);
    expect(Math.abs((shelf.to.y - shelf.from.y) / run) < LEAST_SLOPE, 'and it is not flat').toBe(true);
  });
});

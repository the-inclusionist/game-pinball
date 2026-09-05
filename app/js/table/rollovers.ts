// SPDX-License-Identifier: AGPL-3.0-or-later
// table/rollovers — the components the ball crosses rather than strikes.
//
// ========================= SEVEN COMPONENTS SAID NOTHING WHEN THE BALL WENT THROUGH THEM =========================
// `low-orbit` has three reentry lanes, three wormhole wells and a kicker; `narrow-tower` has three
// landings. Each declares a score, a control, often a lamp. None declares collision, and none should —
// a lane is a stretch of table the ball ROLLS OVER and a well is a hole it falls INTO, and giving
// either an edge would turn it into a wall. `STRUCK_KINDS` exists to keep exactly that rule.
//
// But the physics only reports an EDGE being hit, so nothing could ever notice the ball crossing one.
// The behaviour was ported, the score was declared, the lamp was declared, and the report was missing.
//
// ========================= `drainedBy` ALREADY DID THIS ONCE, FOR ONE REGION =========================
// The drain was found the hard way: a ball simulated to y = 4408 on a table 235 tall, forever, because
// nothing said where a table ends. `drainedBy` answered that with a position test. This is the same
// idea for every other region, plus the part a drain does not need.
//
// ⚠️ THAT PART IS "ONCE". A drain fires and the ball is gone; a lane is crossed and the ball carries
// on. Reporting presence rather than ENTRY would score a lane sixty times a second while the ball sat
// on it, which would make one lane worth more than every bumper on the table put together.
//
// ========================= THERE IS ALREADY A `TRollover`, AND IT IS NOT THIS =========================
// `table/rollover.ts` is the faithful port, and it works a completely different way: it installs TWO
// wall sets from float attributes 600 and 603 and toggles which one the collision search can see, so
// that "there is no inside/outside test anywhere". That mechanism needs two polylines per lane, which
// the 1995 archive supplies and an authored table has no way to declare.
//
// So this is not a replacement and the port is not dead. See ADR-0003: the table is implemented twice
// on purpose, and the line between the two is what data a table can declare.
//
// ========================= THE TWO LISTS PARTITION THE TABLE =========================
// `STRUCK_KINDS` is what the ball bounces off. This is what it passes over or into. A kind in both
// would be a wall that also scores for being crossed, so a test holds that they do not overlap.
//
// Two kinds are deliberately outside both. A DRAIN is `drainedBy`'s, because two things reporting the
// same event would score it and then lose the ball, or lose it and then score it, depending on an order
// nobody chose. A PLUNGER is where the ball STARTS: as a rollover it would fire on the first poll of
// every ball, before the player had done anything.

import type { ComponentKind } from '../i18n/names.js';
import type { AuthoredTable } from './authored.js';

export const ROLLOVER_KINDS: readonly ComponentKind[] = ['lane', 'well', 'kicker', 'hole'];

export interface RolloverWatch {
  /**
   * The regions the ball has just entered. Call once per frame per ball; the answer is the CHANGE since
   * the last call, which is why the watch has to be kept rather than recomputed.
   */
  poll(ball: { position: { x: number; y: number } }): string[];
}

/**
 * The ball's CENTRE, not its circumference. A rollover in a real machine is a switch under the middle
 * of the lane, and using the radius would fire a lane the ball merely brushed past.
 */
function contains(bounds: { x: number; y: number; width: number; height: number }, x: number, y: number): boolean {
  return x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;
}

export function createRolloverWatch(table: AuthoredTable): RolloverWatch {
  const regions = table.components.filter((c) => ROLLOVER_KINDS.includes(c.kind));
  const over = new Set<string>();

  return {
    poll(ball) {
      const entered: string[] = [];
      for (const region of regions) {
        const inside = contains(region.bounds, ball.position.x, ball.position.y);
        if (inside && !over.has(region.name)) entered.push(region.name);
        if (inside) over.add(region.name);
        else over.delete(region.name);
      }
      return entered;
    },
  };
}

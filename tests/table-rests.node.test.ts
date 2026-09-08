// SPDX-License-Identifier: AGPL-3.0-or-later
// WHERE A BALL COMES TO REST, AND WHETHER IT IS ALLOWED TO BE THERE.
//
// ⚠️ THE DEV, WITH A SCREENSHOT OF `ring-belt`: "a bolinha simplesmente congelou-se embaixo ao invés de
// rolar pela ladeira." The cause was `physics/collision`'s fixed toll on the along-surface speed and it
// is fixed; this file is the instrument that says whether the CATALOGUE has anywhere else like that.
//
// ========================= A TABLE THAT CAN HOLD A BALL IS A TABLE THAT WILL =====================
// Until friction was charged against the impact, nothing came to rest anywhere: a wall took nine tenths
// of the along-wall speed on every touch, so every ball crept to the drain and no pocket in any layout
// could be reached. That made this question unaskable, which is not the same as answered — and the
// moment it became askable, four balls out of a hundred and thirty-two were sitting on top of drop
// targets at half a unit a second, for ever.
//
// ========================= WHAT COUNTS AS RESTING, AND THE FIRST ANSWER WAS WRONG ================
// ⚠️ THE FIRST VERSION OF THIS SURVEY CALLED "not drained after twenty seconds" A POCKET, and it
// reported thirty-two of them across the catalogue. Reading the speeds killed it: they were 293, 233,
// 202, 193 units a second — balls in full flight, on tables where twenty seconds is a short ball. A
// long ball is not a stuck one.
//
// So resting is DISPLACEMENT AND SPEED TOGETHER, and displacement alone was the second wrong answer.
// A ball in a PERIODIC ORBIT comes back to where it was: two of the tables reported a pocket at 100 and
// 140 units a second, and following those launches for two minutes instead of twenty seconds showed them
// finishing on the plunger like everyone else. A ball that returns to its own starting point is not
// stuck, it is going round.
//
// The pockets that are real were all at half a unit a second to four. So: moved less than two radii in
// the last two seconds AND travelling slower than eight — not going anywhere, and not going fast.
//
// ========================= AND TWO PLACES ARE ALLOWED TO HOLD IT ================================
// The PLUNGER, because that is what it is for: a draw that does not clear the lane comes back down and
// lands on the rod, which is half of every table's launches at these powers, and `table/cabinet`
// records the day it had no face at all and the ball fell through the floor to y = 1841.
//
// And a PADDLE, because cradling a ball on a raised flipper is something a player does on purpose.
import { describe, test, expect } from 'vitest';
import { CATALOG } from '../app/js/table/catalog.js';
import { buildPhysics, FRAME_SECONDS, launchSpeedFor, drainedBy, inPlungerLane }
  from '../app/js/table/physics-build.js';
import { advanceFrame } from '../app/js/physics/step.js';
import type { AuthoredTable } from '../app/js/table/authored.js';

/** Twelve launches from just over half power to full, which is the range a plunger offers. */
const BALLS = 12;
/** Twenty seconds each. Long enough for a ball to settle, short enough for a node suite. */
const FRAMES = 1800;
/** How often the survey looks to see whether the ball has moved. */
const EVERY = 120;
/**
 * Above this speed a ball is in play whatever its displacement says.
 *
 * ⚠️ EIGHT, WHICH IS TEN TIMES `physics/stuck`'s OWN THRESHOLD AND STILL NOWHERE NEAR A ROLL. That file
 * calls anything under 0.8 slow; the pockets this survey found were at 0.5 to 3.9, and a ball rolling
 * down a shallow slope passes eight almost at once. It is set well clear of the fastest thing that has
 * ever been stuck rather than at the edge of it.
 */
const STILL = 8;

/**
 * ⚠️ SEEDED INSIDE THE PHYSICS AND NOT ONLY OUTSIDE IT. The one piece of chance in the simulation is
 * `physics/stuck`'s rescue, which throws a wedged ball in a random direction — and a survey ABOUT balls
 * that stop is the survey most likely to trigger it. `tests/table-secret` failed one run in five on
 * exactly this hole before it was found there.
 */
function seeded(from: number): () => number {
  let seed = from;
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

/** Whether the ball is within a paddle's reach of its pivot — cradled, which is a player's doing. */
function onAPaddle(table: AuthoredTable, x: number, y: number): boolean {
  return table.components.some((c) => {
    if (!c.flipper) return false;
    const { pivot, tipAtRest } = c.flipper;
    const reach = Math.hypot(tipAtRest.x - pivot.x, tipAtRest.y - pivot.y);
    return Math.hypot(x - pivot.x, y - pivot.y) <= reach + table.ballRadius + 2;
  });
}

/** What is standing where the ball stopped, so a failure names the pocket instead of a coordinate. */
function around(table: AuthoredTable, x: number, y: number): string {
  const near = table.components.filter((c) => c.bounds.x - 8 < x && c.bounds.x + c.bounds.width + 8 > x
    && c.bounds.y - 8 < y && c.bounds.y + c.bounds.height + 8 > y).map((c) => c.name);
  return near.length ? near.join(', ') : 'nothing within eight units';
}

/** Every place this table held a ball that is neither the plunger nor a paddle. */
function pockets(table: AuthoredTable): string[] {
  const found: string[] = [];

  for (let shot = 0; shot < BALLS; shot++) {
    const physics = buildPhysics(table, { random: seeded(20260908 + shot * 7919) });
    const ball = physics.spawnBall();
    ball.direction = { x: 0, y: -1 };
    ball.speed = launchSpeedFor(table) * (0.55 + (shot / BALLS) * 0.45);

    let lost: string | null = null;
    let mark = { x: ball.position.x, y: ball.position.y };
    let moved = Number.POSITIVE_INFINITY;

    for (let i = 0; i < FRAMES && !lost; i++) {
      // A player who never stops, which is what makes a cradle possible and a pocket honest.
      if (i % 24 === 0) { physics.setFlippers('left', true); physics.setFlippers('right', true); }
      if (i % 24 === 12) { physics.setFlippers('left', false); physics.setFlippers('right', false); }
      if (i % EVERY === 0) {
        moved = Math.hypot(ball.position.x - mark.x, ball.position.y - mark.y);
        mark = { x: ball.position.x, y: ball.position.y };
      }
      advanceFrame([ball], physics.context, FRAME_SECONDS);
      physics.takeHits();
      physics.stuck.check(ball, i * (1000 / 60));
      lost = drainedBy(table, ball);
    }

    if (lost) continue;
    if (moved > table.ballRadius * 2 || ball.speed > STILL) continue;
    const { x, y } = ball.position;
    if (inPlungerLane(table, ball)) continue;
    if (onAPaddle(table, x, y)) continue;
    found.push(`(${x.toFixed(0)},${y.toFixed(0)}) at ${ball.speed.toFixed(2)} against`
      + ` ${around(table, x, y)}`);
  }
  return found;
}

describe('⚠️ no table holds a ball anywhere it is not meant to', () => {
  test.each(CATALOG.map((t) => [t.name, t] as const))('%s', (name, table) => {
    /**
     * ⚠️ AND THE LEDGER IS EMPTY, WHICH IS THE POINT OF HAVING ONE. `tests/table-reachable` carries a
     * `KNOWN_RARE` list because a component nothing reaches is a design question somebody may argue
     * about; a place that HOLDS the ball is not. There is nothing to excuse: either the player gets the
     * ball back or the table has swallowed it.
     */
    expect(pockets(table), `${name} holds a ball here`).toEqual([]);
  }, 20_000);

  test('⚠️ and the survey can see one, or it is a gate with no subject', () => {
    /**
     * The shape every green test with no subject takes. A table with a flat shelf in the middle of it
     * is exactly what this file was written to find — nine of them were in the catalogue when it was
     * written — so one is put back, in a copy, and the survey has to report it.
     *
     * ⚠️ ACROSS THE MIDDLE AND UNDER THE BUMPERS, because a shelf somewhere the ball never goes proves
     * nothing about the scanner. This is `low-orbit`'s own drop-bank row, level again.
     */
    const table = CATALOG.find((t) => t.name === 'low-orbit')!;
    const withShelf: AuthoredTable = {
      ...table,
      components: table.components.map((c) => (c.name === 'drop1' || c.name === 'drop2'
        ? { ...c, collision: [{ kind: 'line' as const,
          from: { x: c.bounds.x, y: c.bounds.y }, to: { x: c.bounds.x + c.bounds.width, y: c.bounds.y } }] }
        : c)),
    };

    expect(pockets(withShelf).length, 'a level drop bank held nothing').toBeGreaterThan(0);
  }, 20_000);
});

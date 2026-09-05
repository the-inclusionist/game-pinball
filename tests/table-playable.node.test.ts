// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildPhysics, drainedBy, launchSpeedFor, FRAME_SECONDS } from '../app/js/table/physics-build.js';
import { advanceFrame } from '../app/js/physics/step.js';
import { CATALOG, BARE_MINIMUM } from '../app/js/table/catalog.js';
import type { AuthoredTable } from '../app/js/table/authored.js';

/**
 * ⚠️ THE GATE `validateTable` CANNOT BE.
 *
 * Every rule in the validator is about the SHAPE of a table: names, bounds, a drain, a plunger. All
 * five tables passed all of them, and four of the five were still unplayable in the same way — a
 * launched ball went straight up the plunger lane, off the ceiling and straight back down it, and
 * drained without ever entering the play.
 *
 * That is not a property of the description. It is a property of what happens when you RUN it, and
 * the only way to check it is to launch a ball and watch. So this file is a simulation rather than an
 * inspection, and it is the last gate in the project for the same reason it is the most useful: it
 * asks the question a player would.
 */

/** Launches up the lane and steps until the ball is lost or the budget runs out. */
function launchAndWatch(table: AuthoredTable, frames = 4000) {
  const physics = buildPhysics(table);
  const ball = physics.spawnBall();
  const from = { x: ball.position.x, y: ball.position.y };
  ball.direction = { x: 0, y: -1 };
  ball.speed = launchSpeedFor(table);

  const touched: string[] = [];
  let drained: string | null = null;
  let furthestFromLane = 0;

  for (let i = 0; i < frames && !drained; i++) {
    advanceFrame([ball], physics.context, FRAME_SECONDS);
    for (const hit of physics.takeHits()) touched.push(hit.name);
    furthestFromLane = Math.max(furthestFromLane, Math.abs(ball.position.x - from.x));
    drained = drainedBy(table, ball);
  }

  return { touched, drained, furthestFromLane, ball };
}

const PLAYABLE = CATALOG.filter((t) => t !== BARE_MINIMUM);

describe('a launched ball reaches the play', () => {
  test.each(PLAYABLE.map((t) => [t.name, t] as const))(
    '%s: the ball leaves the plunger lane',
    (_name, table) => {
      // The defect this catches, in the words of the run that found it: "straight up the lane, off the
      // ceiling, straight back down the same lane, three balls out of three, without ever entering the
      // play". The lane needs a bend at the top, and nothing about the table's SHAPE says whether it
      // has one.
      const { furthestFromLane } = launchAndWatch(table);

      expect(furthestFromLane).toBeGreaterThan(table.ballRadius * 6);
    },
  );

  test.each(PLAYABLE.map((t) => [t.name, t] as const))(
    '%s: the ball touches something that is not a wall',
    (_name, table) => {
      // Reaching the play is not enough: it has to arrive somewhere that does something. A table
      // where the ball only ever meets walls is a corridor.
      const { touched } = launchAndWatch(table);
      const walls = new Set(table.components.filter((c) => c.kind === 'wall').map((c) => c.name));

      expect(touched.filter((name) => !walls.has(name)).length).toBeGreaterThan(0);
    },
  );

  test.each(PLAYABLE.map((t) => [t.name, t] as const))(
    '%s: the ball is eventually lost, and NOT through a hole in the table',
    (_name, table) => {
      // `outside` means it left the table past an edge, which is a hole in the geometry rather than a
      // way to lose. A finished table loses its ball where it says it does.
      const { drained } = launchAndWatch(table);

      expect(drained).not.toBeNull();
      expect(drained).not.toBe('outside');
    },
  );
});

describe('the floor of the format is exempt, and says so', () => {
  test('bare-minimum is not expected to be playable', () => {
    // It is in the catalogue to show what the validator actually demands. One flipper cannot cover a
    // drain and there is nothing to score, and pretending otherwise here would be inventing a rule to
    // make a test pass.
    const { furthestFromLane } = launchAndWatch(BARE_MINIMUM);

    expect(furthestFromLane).toBeLessThan(BARE_MINIMUM.ballRadius * 6);
  });
});

describe('⚠️ and the GAME has to launch the way the test launches', () => {
  test('the entry point never hard-codes a launch speed', () => {
    // The fault this exists for was green on every gate. `launchSpeedFor` was written because a fixed
    // 260 cleared low-orbit's 235 and fell 75 pixels short of narrow-tower's 420; the test above
    // adopted it immediately, and `main.ts` — the only launch a PLAYER ever performs — kept the
    // constant. A suite that proves a formula while the game ignores it is worse than no suite: it
    // reports the opposite of the truth.
    //
    // So this reads the source rather than the behaviour, on purpose. There is no seam to test through
    // — `launch()` is glue inside a module with side effects — and the rule worth holding is textual
    // anyway: the speed comes from the table, or it is zero.
    const main = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../app/js/main.ts'), 'utf8',
    );
    const assignments = [...main.matchAll(/ball\.speed\s*=\s*([^;]+);/g)].map((m) => m[1]!.trim());

    expect(assignments.length).toBeGreaterThan(0);
    for (const value of assignments) {
      // `0` is how a drained ball is stopped, and is not a launch.
      expect(value === '0' || value.startsWith('launchSpeedFor(')).toBe(true);
    }
  });
});

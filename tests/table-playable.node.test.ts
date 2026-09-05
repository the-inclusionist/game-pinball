// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildPhysics, drainedBy, launchSpeedFor, FRAME_SECONDS } from '../app/js/table/physics-build.js';
import { advanceFrame } from '../app/js/physics/step.js';
import { CATALOG, BARE_MINIMUM } from '../app/js/table/catalog.js';
import type { AuthoredTable } from '../app/js/table/authored.js';
import { createRolloverWatch } from '../app/js/table/rollovers.js';

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

/**
 * Launches up the lane and steps until the ball is lost or the budget runs out.
 *
 * `flapEvery` presses BOTH flippers every n frames and releases them halfway through, which is what a
 * player does who cannot see the ball. Null is a launch nobody touches.
 */
function launchAndWatch(table: AuthoredTable, frames = 4000, flapEvery: number | null = null) {
  const physics = buildPhysics(table);
  // ⚠️ CROSSINGS COUNT TOO. Half of what an authored table offers is regions the ball rolls OVER, and a
  // gate that watched only collisions would call a table a corridor while the ball crossed three lanes.
  const rollovers = createRolloverWatch(table);
  const ball = physics.spawnBall();
  const from = { x: ball.position.x, y: ball.position.y };
  ball.direction = { x: 0, y: -1 };
  ball.speed = launchSpeedFor(table);

  const touched: string[] = [];
  let drained: string | null = null;
  let furthestFromLane = 0;
  let frameCount = 0;

  for (let i = 0; i < frames && !drained; i++) {
    if (flapEvery !== null) {
      if (i % flapEvery === 0) { physics.setFlippers('left', true); physics.setFlippers('right', true); }
      if (i % flapEvery === Math.floor(flapEvery / 2)) {
        physics.setFlippers('left', false); physics.setFlippers('right', false);
      }
    }
    advanceFrame([ball], physics.context, FRAME_SECONDS);
    for (const hit of physics.takeHits()) touched.push(hit.name);
    for (const name of rollovers.poll(ball)) touched.push(name);
    furthestFromLane = Math.max(furthestFromLane, Math.abs(ball.position.x - from.x));
    drained = drainedBy(table, ball);
    frameCount = i + 1;
  }

  return { touched, drained, furthestFromLane, ball, frames: frameCount };
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
    '⚠️ %s: the ball touches something that SCORES',
    (_name, table) => {
      // ⚠️ THIS USED TO SAY "something that is not a wall", AND A FLIPPER SATISFIED IT.
      //
      // Under the weaker claim `four-flippers` passed while touching a wall, a flipper and the drain:
      // nought of its three scoring components, on every launch, deterministically. The gate said the
      // table was playable and the table was a corridor with paddles in it.
      //
      // "Scores" means a component with a score table AND a control, which since `validateTable` learned
      // to refuse an unpaid score is the same thing as "worth something".
      const { touched } = launchAndWatch(table);
      const scoring = new Set(
        table.components.filter((c) => c.scores?.length && c.control).map((c) => c.name),
      );

      expect(touched.filter((name) => scoring.has(name))).not.toEqual([]);
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

describe('⚠️ and the PLAYER can change what happens, which is the difference from a demonstration', () => {
  test.each(PLAYABLE.map((t) => [t.name, t] as const))(
    '%s: flapping the flippers changes the ball’s life',
    (_name, table) => {
      // ⚠️ MEASURED BEFORE IT WAS WRITTEN, AND FOUR OF THE FIVE TABLES FAILED IT SILENTLY. A run with
      // the flippers held down and a run flapping them every 24 frames came out IDENTICAL — same frame
      // count, same score, same drain — on `low-orbit`, `wide-arc` and `four-flippers`. The ball goes
      // from the lane to the drain without ever passing a paddle, so the player is a spectator.
      //
      // None of the three gates above could see it. They ask whether the ball leaves the lane, whether
      // it touches something worth points, and whether it is lost properly — all true of a table you
      // cannot play. This one asks the only question that separates a game from a demonstration.
      //
      // The comparison is the whole LIFE rather than the score alone: a flipper that changes the ball's
      // path without changing what it hits has still done something, and calling that a failure would
      // push the tables towards scoring by luck.
      const quiet = launchAndWatch(table);
      const played = launchAndWatch(table, 4000, 24);

      const different = played.frames !== quiet.frames
        || played.drained !== quiet.drained
        || played.touched.join() !== quiet.touched.join();

      expect(different).toBe(true);
    },
  );
});

describe('the floor of the format is exempt from PLAYING, not from holding its ball', () => {
  test('⚠️ bare-minimum does not lose its ball through a hole either', () => {
    // It was losing it to `outside`, which by this project's own definition is a hole in the geometry
    // rather than a way to lose — `drainedBy` splits the two for exactly this reason and says so.
    // Containing the ball is not a question of whether a table is FUN; it is whether it is a table.
    const { drained } = launchAndWatch(BARE_MINIMUM);

    expect(drained).not.toBe('outside');
  });

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

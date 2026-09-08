// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  buildPhysics, drainedBy, inPlungerLane, launchSpeedFor, FRAME_SECONDS,
} from '../app/js/table/physics-build.js';
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
  /**
   * ⚠️ A SEEDED GENERATOR, BECAUSE THIS SURVEY RUNS THE STUCK WATCH. `physics/stuck`'s rescue throws a
   * wedged ball in a RANDOM direction, and with nothing passed it falls back to `Math.random` — so a
   * gate that compares two runs would be comparing two different games. It was harmless while a wall
   * took nine tenths of the along-wall speed and nothing ever settled anywhere; `physics/collision`
   * charges friction against the impact now, balls come to rest, and the rescue fires.
   *
   * `tests/table-secret` failed once in five runs on exactly this before it was found there too.
   */
  let seed = 20260908;
  const physics = buildPhysics(table, {
    random: () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    },
  });
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
  let relaunches = 0;

  for (let i = 0; i < frames && !drained; i++) {
    if (flapEvery !== null) {
      if (i % flapEvery === 0) { physics.setFlippers('left', true); physics.setFlippers('right', true); }
      if (i % flapEvery === Math.floor(flapEvery / 2)) {
        physics.setFlippers('left', false); physics.setFlippers('right', false);
      }
    }
    /**
     * ⚠️ AND THE PLUNGER IS PRESSED AGAIN, BECAUSE A PLAYER PRESSES IT AGAIN.
     *
     * A draw that does not clear the return bend comes back down the lane and lands on the rod — which
     * is what `table/cabinet` gave the plunger a face FOR, and what half of every table's launches do
     * at the powers `tests/table-rests` surveys with. This loop had no way to fire it, so a ball that
     * came back spent the rest of a four-thousand-frame budget sitting still, and every claim in this
     * file was about the first thirty seconds of one launch that happened to clear.
     *
     * ⚠️ IT WAS HARMLESS UNTIL THE BALL COULD REST. With a wall taking nine tenths of the along-wall
     * speed on every touch nothing settled anywhere, so a returning ball crept off the plunger by
     * itself and the survey never noticed the gap. `physics/collision` charges friction against the
     * impact now and the ball STAYS, which is correct and makes this loop's silence a defect.
     *
     * At full power, because `launchSpeedFor` is what the gate above measures the first launch with and
     * a survey that fired weaker second balls would be answering a different question each time.
     */
    if (inPlungerLane(table, ball) && ball.speed < 1) {
      ball.direction = { x: 0, y: -1 };
      ball.speed = launchSpeedFor(table);
      relaunches++;
    }
    advanceFrame([ball], physics.context, FRAME_SECONDS);
    /**
     * ⚠️ THE STUCK WATCH RUNS HERE BECAUSE IT RUNS IN THE GAME, and leaving it out stopped being
     * harmless the day a ball could come to REST. `physics/collision`'s friction used to take nine
     * tenths of the along-surface speed on every contact, so nothing ever settled anywhere: every ball
     * crept to the drain and these gates measured a table nobody could get stuck on. With a ball that
     * rolls, a corner between a guide and a paddle holds it — which is what a real cradle IS — and four
     * tables reported "the ball is never lost" for a ball sitting exactly where a player would flip it
     * from. `main`'s loop has called this every frame since the physics was ported; this is the survey
     * finally simulating the same game.
     */
    physics.stuck.check(ball, i * (1000 / 60));
    for (const hit of physics.takeHits()) touched.push(hit.name);
    for (const name of rollovers.poll(ball)) touched.push(name);
    furthestFromLane = Math.max(furthestFromLane, Math.abs(ball.position.x - from.x));
    drained = drainedBy(table, ball);
    frameCount = i + 1;
  }

  return { touched, drained, furthestFromLane, ball, frames: frameCount, relaunches };
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
    /**
     * It is in the catalogue to show what the validator actually demands. One flipper cannot cover a
     * drain and there is nothing to score, and pretending otherwise here would be inventing a rule to
     * make a test pass.
     *
     * ⚠️ AND THE CLAIM IS "NOTHING TO SCORE", WHICH IT USED TO MAKE BY PROXY. It asserted that the ball
     * never got more than six radii from the lane — true while the plunger fired straight up a vertical
     * tunnel and this fixture has no return bend, so the launch went up and came back down the same
     * lane. Since `table/perspective` every table leans and the plunger fires ALONG its lane, so the
     * ball leaves the tunnel at nine degrees and crosses 25 units of table before it drains. That is
     * not the fixture becoming playable; it is the proxy expiring. The claim itself is measured now,
     * with the same definition of "scores" the playable tables are held to eight tests above.
     */
    const { touched } = launchAndWatch(BARE_MINIMUM);
    const scoring = new Set(
      BARE_MINIMUM.components.filter((c) => c.scores?.length && c.control).map((c) => c.name),
    );

    expect(touched.filter((name) => scoring.has(name))).toEqual([]);
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
      // `0` is how a drained ball is stopped, and is not a launch. `speed` is the plunger's, and the
      // plunger is built from the table — asserted below, because a name proves nothing on its own.
      /**
       * ⚠️ AND `heir.speed` IS THE THIRD ALLOWED FORM, WHICH IS NOT A LOOPHOLE. `multiball` puts extra
       * balls on the table, and when the primary drains with one still up it ADOPTS it — takes its
       * position and speed and carries on, so the ball the camera is following is the ball still in
       * play. That speed came from the table by the same road every other one did; what this gate
       * refuses is a NUMBER typed into the entry point, and a ball's own speed is not one.
       */
      expect(value === '0' || value === 'speed' || value === 'heir.speed'
        || value.startsWith('launchSpeedFor(')).toBe(true);
    }

    /**
     * ⚠️ AND THE PLUNGER'S FULL DRAW IS THE TABLE'S OWN SPEED, which is where the rule went when the
     * plunger arrived.
     *
     * The Dev asked for a launcher whose force a player controls, so `ball.speed` is now the plunger's
     * output rather than a call to `launchSpeedFor` — and this gate would have been satisfied by
     * `createPlunger({ maxSpeed: 260 })`, which is the exact constant it was written to kill. Allowing
     * the name without checking where the number comes from would have retired the rule while leaving
     * the test green.
     */
    expect(main, 'the plunger is charged from the table, not from a constant')
      .toMatch(/createPlunger\(\{ maxSpeed: launchSpeedFor\(/);
    expect(main, 'and no launch speed is written as a number anywhere')
      .not.toMatch(/maxSpeed: \d/);
  });
});

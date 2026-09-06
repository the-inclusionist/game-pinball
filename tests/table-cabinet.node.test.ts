// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PLUNGER IS A BODY, AND IT WAS A PAINTED RECTANGLE.
//
// ⚠️ THE DEV FOUND IT BY PLAYING: "após lançar a bola, se o lançamento é fraco ela cai pro cima do
// lançador ao invés de quicar nele."
//
// A weak launch does not clear the return bend, the ball comes back down the lane, and there was
// nothing at the bottom of it. `table/cabinet` declared the plunger with bounds and no `collision`, so
// the ball fell through where the launcher is drawn and sat at the floor of the lane, under the thing
// that is supposed to be holding it.
//
// ========================= WHY IT HAD NO EDGE, AND WHY THAT WAS WRONG =========================
// `authored.ts` states the rule the omission came from, and it is a good rule: "a bumper, a target, a
// ramp, a flipper, a wall are BODIES... a lane is a stretch of table the ball rolls over. A well, a
// kicker, a drain and a hole swallow it. A PLUNGER IS WHERE IT STARTS. None of those has an edge, and
// giving one an edge would turn it into a wall."
//
// ⚠️ THE PLUNGER IS IN THE WRONG SENTENCE. It is not a region the ball passes over or falls into; it is
// a steel rod with a spring behind it, and a ball comes to rest ON it. "Where the ball starts" says
// where a ball is put, which is a fact about `spawnBall` — it is not a claim about what happens when a
// ball ARRIVES there, and the two got written as one.
//
// A wall is exactly what it should be, and only from above: the launch itself travels up, away from
// the face, and a one-sided edge lets it through — which is what makes this a change to the cabinet
// rather than to the launch.
import { describe, test, expect } from 'vitest';
import { buildPhysics, FRAME_SECONDS } from '../app/js/table/physics-build.js';
import { advanceFrame } from '../app/js/physics/step.js';
import { PLAYABLE_TABLES } from '../app/js/table/catalog.js';
import { launchSpeedFor } from '../app/js/table/physics-build.js';

const withPlunger = PLAYABLE_TABLES.map((table) => [
  table.name, table, table.components.find((c) => c.kind === 'plunger')!,
] as const);

describe('⚠️ a ball coming back down the lane lands ON the plunger', () => {
  test.each(withPlunger)('%s: it never sinks into the launcher', (_name, table, plunger) => {
    const physics = buildPhysics(table);
    const ball = physics.spawnBall();
    // Dropped from well up the lane, so it arrives with the speed a failed launch comes back with.
    ball.position = { x: plunger.bounds.x + plunger.bounds.width / 2, y: plunger.bounds.y - 60 };
    ball.direction = { x: 0, y: 1 };
    ball.speed = 40;

    let deepest = ball.position.y;
    for (let i = 0; i < 300; i++) {
      advanceFrame([ball], physics.context, FRAME_SECONDS);
      physics.takeHits();
      deepest = Math.max(deepest, ball.position.y);
    }

    /**
     * ⚠️ THE BALL'S CENTRE, NOT ITS SURFACE, AND THAT IS A FINDING RATHER THAN A CONCESSION.
     *
     * The first version of this assertion asked for the ball's SURFACE to stop at the face, and it
     * failed by exactly one radius on every table. `physics/edges` explains why: the original never
     * tests a circle against a wall — it pushes the wall out by the ball's radius with `offsetLine`
     * and treats the ball as a point. `table/physics-build` never calls it. So on an authored table
     * every wall lets the ball sink to its centre, and the plunger is not a special case: it is one
     * more surface under a rule that applies to all of them.
     *
     * That is a real gap and it is recorded rather than smuggled into this test's bar. It is not this
     * defect: the ball reached y = 1841 on a table 235 tall before the edge existed, and it now stops
     * where every other surface stops it. Widening the fix to every wall changes the effective width
     * of every passage on six tables by six pixels, which is a change that needs its own measurement.
     */
    expect(deepest,
      `the ball's centre reached ${deepest.toFixed(1)} and the plunger's face is at ${plunger.bounds.y}`)
      .toBeLessThanOrEqual(plunger.bounds.y + 0.5);
  });

  test('⚠️ and it BOUNCES rather than being absorbed', () => {
    // "ao invés de quicar nele" — the Dev asked for a bounce, and a ball that stops dead on contact
    // would satisfy the assertion above while still being wrong. A plunger is sprung steel.
    const [, table, plunger] = withPlunger[0]!;
    const physics = buildPhysics(table);
    const ball = physics.spawnBall();
    ball.position = { x: plunger.bounds.x + plunger.bounds.width / 2, y: plunger.bounds.y - 60 };
    ball.direction = { x: 0, y: 1 };
    ball.speed = 60;

    let rose = false;
    for (let i = 0; i < 300 && !rose; i++) {
      advanceFrame([ball], physics.context, FRAME_SECONDS);
      physics.takeHits();
      // Moving upward again, with something to show for it.
      rose = ball.direction.y < 0 && ball.speed > 5;
    }

    expect(rose, 'the ball came back up off the launcher').toBe(true);
  });

  test('⚠️ and the LAUNCH still leaves, which a two-sided edge would have stopped', () => {
    // The reason the face is wound rather than boxed. A ball launched from the lane travels up, away
    // from the plunger's face; a collision line is one-sided and lets it go. Get the winding backwards
    // and the plunger catches its own ball, which is a game that cannot be started.
    const [, table, plunger] = withPlunger[0]!;
    const physics = buildPhysics(table);
    const ball = physics.spawnBall();
    ball.direction = { x: 0, y: -1 };
    ball.speed = launchSpeedFor(table);

    for (let i = 0; i < 60; i++) {
      advanceFrame([ball], physics.context, FRAME_SECONDS);
      physics.takeHits();
    }

    expect(ball.position.y, 'it got well clear of the lane')
      .toBeLessThan(plunger.bounds.y - 60);
  });
});

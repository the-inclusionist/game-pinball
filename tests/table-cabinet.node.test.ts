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
import { launchSpeedFor, launchDirectionFor, inPlungerLane } from '../app/js/table/physics-build.js';
import { taperMap } from '../app/js/table/perspective.js';
import { plungerLaneOf } from '../app/js/table/cabinet.js';

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
    // ⚠️ UP THE LANE, WHICH LEANS NINE DEGREES. A plunger fires along its own channel, and on this
    // engine a graze does not glance off a wall — it turns the ball into that wall's normal. See
    // `launchDirectionFor`.
    ball.direction = launchDirectionFor(table);
    ball.speed = launchSpeedFor(table);

    for (let i = 0; i < 60; i++) {
      advanceFrame([ball], physics.context, FRAME_SECONDS);
      physics.takeHits();
    }

    expect(ball.position.y, 'it got well clear of the lane')
      .toBeLessThan(plunger.bounds.y - 60);
  });
});

/**
 * ⚠️ A DROPPED TARGET HAS TO LEAVE THE TABLE, and that is the half `table/target-bank` cannot do.
 *
 * The bank is a rule about names: hit t1, t1 is down. What makes it a MECHANIC is that the ball then
 * passes over where t1 was — otherwise the target is still a wall, the ball still bounces off it, and
 * the player is left hitting something that no longer answers. That is the worst of both: a body with
 * no behaviour.
 *
 * `physics/blocker` already does this for the 1995 table — `for (const edge of o.edges) edge.active =
 * value` — and the authored builder kept no edges at all once they were in the grid. This is that,
 * exposed by component name.
 */
describe('⚠️ switching a component out of the table', () => {
  test('a ball passes through a component whose edges are off', () => {
    const table = PLAYABLE_TABLES[0]!;
    const physics = buildPhysics(table);
    // `wall.top` is the ceiling of `low-orbit`, written left to right so it faces down into the play.
    const ball = physics.spawnBall();
    ball.position = { x: 90, y: 40 };
    ball.direction = { x: 0, y: -1 };
    ball.speed = 200;

    physics.setComponentActive('wall.top', false);
    for (let i = 0; i < 60; i++) {
      advanceFrame([ball], physics.context, FRAME_SECONDS);
      physics.takeHits();
    }

    expect(ball.position.y, 'it went straight out through where the ceiling was').toBeLessThan(0);
  });

  test('and it bounces off the same component while its edges are on', () => {
    // The control: same table, same shot, nothing switched off. Without this the test above would pass
    // on a table with no ceiling at all, which is the shape of every gate this repository has had to
    // rewrite for measuring the wrong thing.
    const table = PLAYABLE_TABLES[0]!;
    const physics = buildPhysics(table);
    const ball = physics.spawnBall();
    ball.position = { x: 90, y: 40 };
    ball.direction = { x: 0, y: -1 };
    ball.speed = 200;

    for (let i = 0; i < 60; i++) {
      advanceFrame([ball], physics.context, FRAME_SECONDS);
      physics.takeHits();
    }

    expect(ball.position.y, 'the ceiling held it in').toBeGreaterThan(0);
  });

  test('and switching it back on makes it solid again', () => {
    const table = PLAYABLE_TABLES[0]!;
    const physics = buildPhysics(table);
    physics.setComponentActive('wall.top', false);

    physics.setComponentActive('wall.top', true);

    const ball = physics.spawnBall();
    ball.position = { x: 90, y: 40 };
    ball.direction = { x: 0, y: -1 };
    ball.speed = 200;
    for (let i = 0; i < 60; i++) {
      advanceFrame([ball], physics.context, FRAME_SECONDS);
      physics.takeHits();
    }

    expect(ball.position.y).toBeGreaterThan(0);
  });
});

/**
 * ⚠️ THE PLUNGER IS STILL THERE WHILE A BALL IS IN PLAY.
 *
 * The Dev, playing: "após lançar a bolinha o lançador deve continuar funcionando, visto que a bolinha
 * pode continuar acima dele." He is describing a real machine: the plunger does not retract when the
 * game starts. A ball that rolls back down the lane can be launched again, and on these tables that
 * happens whenever a launch fails to clear the return bend — which is the very case the plunger's own
 * face was added for.
 *
 * `main.ts` guarded the plunger on the PHASE — `if (phase === 'playing') return` — which is a guard
 * about the game rather than about where the ball is. This is the question it should have been asking,
 * and it is a POSITION test for the same reason `drainedBy` is: nothing collides to report that a ball
 * is sitting in a lane.
 */
describe('⚠️ is the ball in the plunger lane', () => {
  test.each(withPlunger)('%s: a ball resting on the launcher is', (_name, table, plunger) => {
    const physics = buildPhysics(table);
    const ball = physics.spawnBall();

    expect(inPlungerLane(table, ball)).toBe(true);
    expect(plunger.bounds.width, 'and the lane is the plunger’s own width').toBeGreaterThan(0);
  });

  test.each(withPlunger)('%s: a ball up the lane still is', (_name, table, plunger) => {
    const physics = buildPhysics(table);
    const ball = physics.spawnBall();
    // Halfway up the lane, which is where a weak launch leaves it.
    ball.position = { x: plunger.bounds.x + plunger.bounds.width / 2, y: plunger.bounds.y - 80 };

    expect(inPlungerLane(table, ball)).toBe(true);
  });

  test.each(withPlunger)('%s: and a ball out in the play is NOT', (_name, table) => {
    const physics = buildPhysics(table);
    const ball = physics.spawnBall();
    ball.position = { x: 40, y: 120 };

    expect(inPlungerLane(table, ball)).toBe(false);
  });

  test('⚠️ and a ball ABOVE the lane’s top is not, or the plunger reaches the whole table', () => {
    // The lane ends where the divider does — above that the ball is in the play, travelling left
    // across the head of the table. A plunger that could still shove it there would be a second pair
    // of flippers nobody asked for.
    const [, table, plunger] = withPlunger[0]!;
    const physics = buildPhysics(table);
    const ball = physics.spawnBall();
    ball.position = { x: plunger.bounds.x + plunger.bounds.width / 2, y: 10 };

    expect(inPlungerLane(table, ball)).toBe(false);
  });
});

/**
 * ⚠️ THE LANE DIVIDER IS A WALL FROM BOTH SIDES, AND IT WAS A WALL FROM ONE.
 *
 * Found while designing the secret passage the Dev asked for — "que permitam que a bola saia pela
 * lateral baixa ao invés de sair pelo topo" — because a door in a wall the ball can already walk
 * through is not a door.
 *
 * `table/authored` states the rule this comes from: a collision line is ONE-SIDED and its winding
 * decides which side. Every other wall in the cabinet has play on one side and the outside of the
 * table on the other, so one face is all any of them needs. The divider is the only wall in the game
 * with the PLAY on one side and the PLUNGER LANE on the other, and it was wound for the play alone.
 *
 * Measured before it was fixed: a ball in the lane pushed left at 40, 120 and 300 pixels a second
 * crossed it every time, ending at x = 159, 158 and 157 against a divider whose left face is at 162.
 * It did not slow down, because there was nothing there.
 *
 * ⚠️ AND IT IS NOT A HYPOTHETICAL. A ball gains sideways speed in the lane from the return bend and
 * from the plunger's own face, and this repository's whole record is of geometry that "cannot happen"
 * happening on the sixtieth ball.
 */
describe('⚠️ the lane divider holds from the lane side too', () => {
  test.each(withPlunger)('%s: a ball shoved out of the lane stays in it', (name, table, plunger) => {
    /**
     * ⚠️ THE LANE IS WHERE THE LANE IS, AND IT LEANS. Both halves of this used to be written as
     * literals — the ball started in the plunger's own column eighty units higher up, and the divider
     * was `width − 21` — and `table/perspective` slides the whole assembly left by a sixth of a unit
     * for every unit of height. Eighty units up that is thirteen, which is a lane's whole width: the
     * ball was being placed outside the corridor and the answer compared against a divider that is no
     * longer there. `taperMap` is the table's own arithmetic rather than a second copy of it.
     */
    const map = taperMap(table);
    for (const speed of [40, 120, 300]) {
      const physics = buildPhysics(table);
      const ball = physics.spawnBall();
      const y = plunger.bounds.y - 80;
      ball.position = { x: map(plungerLaneOf(table.size).laneX + 5, y), y };
      ball.direction = { x: -1, y: 0 };
      ball.speed = speed;

      for (let i = 0; i < 60; i++) {
        advanceFrame([ball], physics.context, FRAME_SECONDS);
        physics.takeHits();
      }

      // The divider's left face at the height the ball ended at. Anything left of it is in the play,
      // and the ball has no business there without going over the top of the lane.
      const leftFace = map(table.size.width - 21, ball.position.y);
      expect(ball.position.x, `${name} at ${speed}: ended x=${ball.position.x.toFixed(1)}`
        + ` against a divider at ${leftFace.toFixed(1)}`).toBeGreaterThan(leftFace);
    }
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { createStuckWatch, controlBoundsOf } from '../app/js/table/stuck-watch.js';
import { buildPhysics } from '../app/js/table/physics-build.js';
import { CATALOG, LOW_ORBIT } from '../app/js/table/catalog.js';
import { STUCK_IDLE_TICKS, STUCK_GIVE_UP_COUNT } from '../app/js/physics/stuck.js';

/**
 * ⚠️ `physics/stuck` WAS PORTED, TESTED, AND IMPORTED BY NOTHING.
 *
 * A ball that wedges itself stays wedged for ever, and the game goes on running around it. Eleventh time
 * in this port that something declared turned out to be inert — and this one was already known: the
 * `wide-arc` shelf that put the ball to sleep on a seven-degree ramp was exactly this class of failure,
 * diagnosed by reading the detector's threshold and noticing it was right not to fire.
 *
 * ⚠️ STUCK IS A PLACE, NOT A DURATION, which is the module's own first heading. A ball resting on a
 * raised flipper or waiting in the plunger lane is legitimately still and must never be nudged. So the
 * boxes matter more than the timer, and the flipper's box is its SWEPT area rather than its rest
 * position — a raised flipper holds the ball somewhere its declared bounds does not reach.
 */

const still = (x: number, y: number) => ({
  active: true, speed: 0, radius: 3,
  position: { x, y }, prevPosition: { x, y }, direction: { x: 0, y: 1 },
  inGroup: false, inCollisionComponent: false, stuckCounter: 0, lastActiveTime: 0,
});

/** Long enough that the question is asked at all. */
const LATER = STUCK_IDLE_TICKS + 1;

describe('a ball that has stopped somewhere it should not', () => {
  test('is nudged, upward and at exactly speed 1', () => {
    // `throw_ball(&{0,-1,0}, 90, 1.0, 0.0)`: a random direction in the upward half-turn, and the second
    // speed multiplier of zero cancels the random term, so the strength is exact. Random direction is
    // what stops it sticking the same way twice; fixed strength is what stops the rescue looking like a
    // bumper hit.
    const watch = createStuckWatch(LOW_ORBIT, { relaunch: () => {}, random: () => 0.5 });
    const ball = still(90, 100);

    watch.check(ball, LATER);

    expect(ball.speed).toBe(1);
    expect(ball.direction.y).toBeLessThan(0);
  });

  test('but not before it has been still long enough to ask', () => {
    const watch = createStuckWatch(LOW_ORBIT, { relaunch: () => {} });
    const ball = still(90, 100);

    watch.check(ball, STUCK_IDLE_TICKS);

    expect(ball.speed).toBe(0);
  });

  test('and a ball that is moving is left alone', () => {
    const watch = createStuckWatch(LOW_ORBIT, { relaunch: () => {} });
    const ball = { ...still(90, 100), speed: 50 };

    watch.check(ball, LATER);

    expect(ball.speed).toBe(50);
  });
});

describe('⚠️ and a ball that is standing somewhere it is ALLOWED to stand', () => {
  test('resting on a flipper is never nudged', () => {
    const watch = createStuckWatch(LOW_ORBIT, { relaunch: () => {} });
    const flipper = LOW_ORBIT.components.find((c) => c.kind === 'flipper')!.flipper!;
    const ball = still(flipper.tipAtRest.x, flipper.tipAtRest.y);

    watch.check(ball, LATER);

    expect(ball.speed).toBe(0);
  });

  test('⚠️ including on a RAISED one, which its declared bounds does not reach', () => {
    // The bounds is where the flipper sits at rest. Trapping a ball on a raised flipper is a skill, and
    // a rescue that fired there would take the ball off the paddle the player was holding it on.
    const watch = createStuckWatch(LOW_ORBIT, { relaunch: () => {} });
    const flipper = LOW_ORBIT.components.find((c) => c.kind === 'flipper')!.flipper!;
    // Straight above the pivot: inside the sweep, outside the resting rectangle.
    const reach = Math.hypot(flipper.tipAtRest.x - flipper.pivot.x, flipper.tipAtRest.y - flipper.pivot.y);
    const ball = still(flipper.pivot.x, flipper.pivot.y - reach * 0.8);

    watch.check(ball, LATER);

    expect(ball.speed).toBe(0);
  });

  test('and waiting in the plunger lane is never nudged', () => {
    const watch = createStuckWatch(LOW_ORBIT, { relaunch: () => {} });
    const plunger = LOW_ORBIT.components.find((c) => c.kind === 'plunger')!.bounds;
    const ball = still(plunger.x + 2, plunger.y + 2);

    watch.check(ball, LATER);

    expect(ball.speed).toBe(0);
  });
});

describe('when nudging stops working', () => {
  test('⚠️ the ball is relaunched rather than nudged for ever', () => {
    const relaunched: number[] = [];
    const watch = createStuckWatch(LOW_ORBIT, { relaunch: () => relaunched.push(1), random: () => 0.5 });
    const ball = still(90, 100);

    for (let i = 0; i <= STUCK_GIVE_UP_COUNT + 1; i++) {
      ball.speed = 0;
      ball.lastActiveTime = 0;
      watch.check(ball, LATER * (i + 1));
    }

    expect(relaunched.length).toBeGreaterThan(0);
    expect(ball.active).toBe(false);
  });
});

describe('the boxes come from the table', () => {
  test.each(CATALOG.map((t) => [t.name, t] as const))('%s: one per flipper, plus the plunger', (_name, table) => {
    const flippers = table.components.filter((c) => c.kind === 'flipper').length;
    const plungers = table.components.filter((c) => c.kind === 'plunger').length;

    expect(controlBoundsOf(table)).toHaveLength(flippers + plungers);
  });

  test('⚠️ `four-flippers` is why the list is a LIST', () => {
    // `physics/stuck` takes a list rather than two named boxes, and no table had ever put more than
    // three entries in it. This one puts five.
    const four = CATALOG.find((t) => t.name === 'four-flippers')!;

    expect(controlBoundsOf(four)).toHaveLength(5);
  });
});

describe('and it runs inside the game', () => {
  test('the physics exposes the watch, so the frame can drive it', () => {
    expect(buildPhysics(LOW_ORBIT).stuck).toBeDefined();
  });
});

describe('⚠️ and the rescue reaches the REAL ball', () => {
  test('a game ball, not a bare shape, is actually nudged', () => {
    // The adapter bridges `Ball` to `StuckBall`, and a prototype-based view would have been a trap:
    // reads travel up the chain but WRITES SHADOW IT, so `speed = 1` would land on the view and the
    // ball would sit there unchanged while every test above went on passing — because every test above
    // hands in a bare `StuckBall` and never exercises the bridge at all.
    const physics = buildPhysics(LOW_ORBIT, { relaunch: () => {} });
    const ball = physics.spawnBall();
    ball.speed = 0;
    ball.position = { x: 90, y: 100 };
    ball.prevPosition = { x: 90, y: 100 };
    ball.lastActiveTime = 0;

    physics.stuck.check(ball, LATER);

    expect(ball.speed).toBe(1);
    expect(ball.direction.y).toBeLessThan(0);
  });

  test('and a held ball is left where the component put it', () => {
    // `Ball.component` is the same fact as `StuckBall.inCollisionComponent`, read through rather than
    // copied. If the bridge lost it, a sink would have its ball nudged out from under it.
    const physics = buildPhysics(LOW_ORBIT, { relaunch: () => {} });
    const ball = physics.spawnBall();
    ball.speed = 0;
    ball.position = { x: 90, y: 100 };
    ball.prevPosition = { x: 90, y: 100 };
    ball.lastActiveTime = 0;
    ball.component = { fieldEffect: () => {} };

    physics.stuck.check(ball, LATER);

    expect(ball.speed).toBe(0);
  });
});

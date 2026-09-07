// SPDX-License-Identifier: AGPL-3.0-or-later
// A SLOWER BALL WHILE THE DRILL IS ON, AND A LITTLE STEERING.
//
// ⚠️ THE DEV: "Com missões de cometa, a bolinha precisa ser mais lenta, e deve ser possível ter um leve
// controle sobre ela com o direcional, como se ela fosse capaz de produzir uma leve propulsão."
//
// ========================= BOTH OF THEM ARE FORCES, AND THERE IS ALREADY A SEAM =========================
// `physics/step` calls `fieldEffects(ball, destination)` once per ball per frame and adds what it writes
// to the velocity. Gravity has answered through it since the physics was ported; `table/storm`'s flare
// drag became the second user, and its comment says what that meant: "a seam with one user, which is how
// a seam stops being one."
//
// So neither of these is a special case bolted onto the ball. A slower ball is DRAG — a force against
// the way it is going, proportional to how fast it is going, which is what a medium does — and steering
// is a small push in the direction the player is holding. The physics never hears the word "mission".
//
// ========================= AND DRAG IS NOT A SPEED CAP =========================
// ⚠️ THE OBVIOUS IMPLEMENTATION IS `if (speed > max) speed = max`, and it is wrong in a way that would
// have been found by playing rather than by reading. A cap takes energy out of a fast ball and nothing
// out of a slow one, so a bumper's kick vanishes at the top of its arc and the table stops rewarding
// good shots. `-k·v` is proportional: everything slows by the same FRACTION, the ordering of a strong
// shot and a weak one survives, and it is stable at any frame rate.
import { describe, test, expect } from 'vitest';
import { buildPhysics, FRAME_SECONDS, DEFAULT_GRAVITY } from '../app/js/table/physics-build.js';
import { advanceFrame } from '../app/js/physics/step.js';
import { BARE_MINIMUM } from '../app/js/table/catalog.js';
import { MISSION_DRAG, THRUST, thrustField, type ThrustState }
  from '../app/js/table/ball-assist.js';

const NO_THRUST: ThrustState = { up: false, left: false, right: false };

/**
 * Drops a ball down an empty column and reports how fast it is going after `seconds`.
 *
 * ⚠️ `bare-minimum` AND NOT A PLAYABLE TABLE, and the first two versions of this used `low-orbit` and
 * measured its furniture. Started near the left wall, "hold left" drove the ball into it and it came
 * back RIGHT; started down the middle, the ball met a bumper and the free fall it is compared against
 * was a rebound. `bare-minimum` is the floor of the format — a ceiling, one flipper, a plunger and a
 * drain — which is exactly what a probe about FORCES wants: nothing in the way to be measured instead.
 */
function fall(seconds: number, extraField?: Parameters<typeof buildPhysics>[1]) {
  const physics = buildPhysics(BARE_MINIMUM, extraField);
  const ball = physics.spawnBall();
  /**
   * ⚠️ DOWN THE MIDDLE, AND THE FIRST VERSION STARTED AT x = 12. That is four ball-widths from the left
   * wall of a 183-wide table, so "hold left" drove the ball into it and it came back RIGHT — the test
   * reported that pushing left moves the ball right, which was true and was about the wall.
   */
  ball.position = { x: BARE_MINIMUM.size.width / 2, y: 20 };
  ball.direction = { x: 0, y: 1 };
  ball.speed = 0;
  for (let i = 0, n = Math.round(seconds * 60); i < n; i++) {
    advanceFrame([ball], physics.context, FRAME_SECONDS);
    physics.takeHits();
  }
  return ball;
}

describe('the drill slows the ball', () => {
  test('⚠️ with the drag on, the same fall ends slower', () => {
    const free = fall(1.2);
    const dragged = fall(1.2, { extraField: () => ({ drag: MISSION_DRAG, thrust: NO_THRUST }) });

    expect(free.speed, 'the free fall is the reference and it did not move')
      .toBeGreaterThan(DEFAULT_GRAVITY * 0.5);
    expect(dragged.speed, `free ${free.speed.toFixed(0)} vs dragged ${dragged.speed.toFixed(0)}`)
      .toBeLessThan(free.speed * 0.8);
  });

  test('⚠️ and it is a fraction rather than a cap, so a slow ball is slowed too', () => {
    /**
     * The failure a cap would hide. `if (speed > max) speed = max` leaves everything under the cap
     * untouched, so this pair would come out identical — and the table would stop distinguishing a
     * good shot from a poor one anywhere below the cap.
     */
    const shortFree = fall(0.4);
    const shortDragged = fall(0.4, { extraField: () => ({ drag: MISSION_DRAG, thrust: NO_THRUST }) });

    expect(shortFree.speed, 'the short fall is nowhere near any plausible cap').toBeLessThan(60);
    expect(shortDragged.speed, 'a slow ball was not slowed, which is what a cap does')
      .toBeLessThan(shortFree.speed);
  });

  test('and with the drill off, nothing touches the ball at all', () => {
    // The mission is the only thing that turns this on: every other table, and every ball between
    // missions, plays exactly as it did.
    const plain = fall(1.2);
    const zero = fall(1.2, { extraField: () => ({ drag: 0, thrust: NO_THRUST }) });

    expect(zero.speed).toBeCloseTo(plain.speed, 6);
  });
});

describe('the directional gives the ball a little push', () => {
  test('⚠️ holding up fights gravity, which is what "leve propulsão" is', () => {
    const free = fall(1.2);
    const pushed = fall(1.2, {
      extraField: () => ({ drag: 0, thrust: { up: true, left: false, right: false } }),
    });

    expect(pushed.speed, `free ${free.speed.toFixed(0)} vs pushed ${pushed.speed.toFixed(0)}`)
      .toBeLessThan(free.speed);
  });

  test('⚠️ but it is LIGHT: it cannot hold the ball up, let alone lift it', () => {
    /**
     * ⚠️ THE WORD IS "leve", AND IT IS THE WHOLE DESIGN. A thrust that could beat gravity turns a
     * pinball table into a flying game: the player would never drain, the flippers would stop
     * mattering, and the comets would be collected by steering rather than by aiming. It is a nudge —
     * enough to change where the ball lands, not enough to decide it.
     */
    expect(THRUST, 'the push is not weaker than gravity').toBeLessThan(DEFAULT_GRAVITY);
    const free = fall(1.2);
    const pushed = fall(1.2, {
      extraField: () => ({ drag: 0, thrust: { up: true, left: false, right: false } }),
    });

    /**
     * ⚠️ MEASURED AS DISTANCE FALLEN AND NOT AS "is it still going down after two seconds", which is
     * what the first version asked and which the FLOOR answered: at two seconds on `bare-minimum` the
     * ball has reached the bottom and bounced, so its direction is up and the thrust had nothing to do
     * with it. How far it fell in the same time is the claim, and no rebound can flatter it.
     */
    expect(pushed.position.y, 'the ball held station or rose — the push beats gravity')
      .toBeGreaterThan(20 + 30);
    expect(pushed.position.y, 'and it is still slower than a free fall, which is the point')
      .toBeLessThan(free.position.y);
  });

  test('left and right move it sideways, and nothing does when nothing is held', () => {
    const straight = fall(1.2, { extraField: () => ({ drag: 0, thrust: NO_THRUST }) });
    const left = fall(1.2, {
      extraField: () => ({ drag: 0, thrust: { up: false, left: true, right: false } }),
    });
    const right = fall(1.2, {
      extraField: () => ({ drag: 0, thrust: { up: false, left: false, right: true } }),
    });

    expect(left.position.x, 'holding left did not move the ball left').toBeLessThan(straight.position.x);
    expect(right.position.x, 'holding right did not move it right')
      .toBeGreaterThan(straight.position.x);
  });

  test('⚠️ and both directions at once cancel, rather than doubling', () => {
    // A player rolling a thumb across a D-pad reports both for a frame or two, and a cabinet that
    // added them would fling the ball at whichever it happened to read first.
    const field = thrustField({ up: false, left: true, right: true });

    expect(field.x, 'left and right did not cancel').toBe(0);
  });
});

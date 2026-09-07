// SPDX-License-Identifier: AGPL-3.0-or-later
// A LITTLE STEERING WHILE THE DRILL IS ON.
//
// ⚠️ THE DEV: "deve ser possível ter um leve controle sobre ela com o direcional, como se ela fosse
// capaz de produzir uma leve propulsão."
//
// ========================= IT IS A FORCE, AND THERE IS ALREADY A SEAM =========================
// `physics/step` calls `fieldEffects(ball, destination)` once per ball per frame and adds what it writes
// to the velocity. Gravity has answered through it since the physics was ported; `table/storm`'s flare
// drag became the second user, and its comment says what that meant: "a seam with one user, which is how
// a seam stops being one." A push in the direction the player is holding is the third, so steering is
// not a special case bolted onto the ball and the physics never hears the word "mission".
//
// ========================= AND THE OTHER HALF OF THAT ASK IS NOT A FORCE =========================
// ⚠️ THIS FILE ALSO TESTED A DRAG, AND THE DRAG IS GONE. The same sentence asked for a slower ball, it
// was answered with `-k·v`, and the Dev played it: "se a bolinha cai em uma plataforma, ela corre o
// risco de parar, e rola devagar demais em ladeiras ao invés de rodar de forma fluida." A dissipative
// force changes WHERE A BALL CAN GO, and a request about pace never asked for that. The pace is the
// simulated clock now — `tests/mission-slow-motion` carries that gate and the whole argument.
//
// ⚠️ AND THE PUSH SURVIVED THE CHANGE UNTOUCHED, which is the reason to keep this file rather than fold
// it in. Thrust and gravity are both accelerations, so a slowed clock weakens both by the same factor
// and their ratio — the whole of what "leve" means — is what it always was.
import { describe, test, expect } from 'vitest';
import { buildPhysics, FRAME_SECONDS, DEFAULT_GRAVITY } from '../app/js/table/physics-build.js';
import { advanceFrame } from '../app/js/physics/step.js';
import { BARE_MINIMUM } from '../app/js/table/catalog.js';
import { THRUST, thrustField, NO_THRUST } from '../app/js/table/ball-assist.js';

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

describe('the directional gives the ball a little push', () => {
  test('⚠️ holding up fights gravity, which is what "leve propulsão" is', () => {
    const free = fall(1.2);
    const pushed = fall(1.2, {
      extraField: () => ({ up: true, left: false, right: false }),
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
      extraField: () => ({ up: true, left: false, right: false }),
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
    const straight = fall(1.2, { extraField: () => NO_THRUST });
    const left = fall(1.2, {
      extraField: () => ({ up: false, left: true, right: false }),
    });
    const right = fall(1.2, {
      extraField: () => ({ up: false, left: false, right: true }),
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

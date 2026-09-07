// SPDX-License-Identifier: AGPL-3.0-or-later
// table/ball-assist — a slower ball while the drill is on, and a little steering.
//
// ⚠️ THE DEV: "Com missões de cometa, a bolinha precisa ser mais lenta, e deve ser possível ter um leve
// controle sobre ela com o direcional, como se ela fosse capaz de produzir uma leve propulsão."
//
// ========================= BOTH ARE FORCES, AND THE SEAM ALREADY EXISTED =========================
// `physics/step` calls `fieldEffects(ball, destination)` once per ball per frame and adds what it writes
// to the velocity. Gravity has answered through it since the physics was ported, and `table/storm`'s
// flare drag became the second user — its comment says what that meant: "a seam with one user, which is
// how a seam stops being one." This is the third and the fourth.
//
// So neither is a special case bolted onto the ball, and the physics never hears the word "mission". It
// is handed a force per frame and does what it has always done with one.
//
// ========================= AND SLOWER IS DRAG, NOT A CAP =========================
// ⚠️ THE OBVIOUS IMPLEMENTATION IS `if (speed > max) speed = max`, and it is wrong in a way that would
// be found by playing rather than by reading. A cap takes energy out of a fast ball and nothing out of a
// slow one: a bumper's kick would vanish at the top of its arc, a hard flip and a soft one would arrive
// at the same speed, and the table would stop rewarding a good shot anywhere below the cap.
//
// `-k·v` is proportional. Everything slows by the same FRACTION, the ordering of a strong shot and a
// weak one survives, and because `physics/step` multiplies by the frame time the ball loses a share of
// its speed per SECOND rather than per frame — stable at any frame rate. It is the same shape the flare
// already uses, for the same reason.

/** Which way the player is pushing. Three, because down is gravity's and is not offered — see below. */
export interface ThrustState {
  readonly up: boolean;
  readonly left: boolean;
  readonly right: boolean;
}

/**
 * How much of its speed the ball loses per second while a drill is running.
 *
 * ⚠️ 1.1, WHICH IS A LITTLE OVER HALF ITS SPEED A SECOND, and the number is a playability decision
 * rather than a measurement. What it has to be is enough that a player can pick which comet to go for —
 * the comets themselves came down from 9 units a second to 5 for the same reason — without turning the
 * table into treacle: a ball that cannot reach the top of the playfield cannot complete anything the
 * table asks of it either.
 */
export const MISSION_DRAG = 1.1;

/**
 * The push, in table units per second squared.
 *
 * ⚠️ THE WORD IS "leve", AND IT IS THE WHOLE DESIGN. Gravity is 120. This is 34 — a bit over a quarter
 * of it — so holding up NEVER stops the ball falling; it makes it fall more slowly and lands it a
 * little further along. A thrust that could beat gravity would turn a pinball table into a flying game:
 * the player would never drain, the flippers would stop mattering, and the comets would be collected by
 * steering rather than by aiming.
 */
export const THRUST = 34;

/**
 * The player's push as a force.
 *
 * ⚠️ OPPOSITE DIRECTIONS CANCEL RATHER THAN DOUBLING. A player rolling a thumb across a D-pad reports
 * both for a frame or two, and a cabinet that added them would fling the ball at whichever it happened
 * to read first. Subtracting is the only reading that has no order in it.
 *
 * ⚠️ AND THERE IS NO DOWN. Gravity already does that, and `KeyS` is the sonar sweep — an accessibility
 * key `shell/controls` has argued since it was written must work while a ball is in play. Trading it
 * for a push that duplicates gravity would be the worst exchange on the table.
 */
export function thrustField(thrust: ThrustState): { x: number; y: number } {
  return {
    x: ((thrust.right ? 1 : 0) - (thrust.left ? 1 : 0)) * THRUST,
    // `y` grows downward, so pushing UP is negative.
    y: (thrust.up ? -1 : 0) * THRUST,
  };
}

export interface BallAssist {
  /** How much of its speed the ball loses per second. Nought while no drill is running. */
  readonly drag: number;
  readonly thrust: ThrustState;
}

/**
 * The whole assist as one force, ready to be added to gravity.
 *
 * Takes the ball's velocity because drag is against it: `physics/step` hands `fieldEffects` the ball, so
 * the caller has both halves and this needs no knowledge of either.
 */
export function assistField(
  assist: BallAssist, velocity: { x: number; y: number },
): { x: number; y: number } {
  const push = thrustField(assist.thrust);
  return {
    x: push.x - assist.drag * velocity.x,
    y: push.y - assist.drag * velocity.y,
  };
}

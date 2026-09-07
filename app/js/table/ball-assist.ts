// SPDX-License-Identifier: AGPL-3.0-or-later
// table/ball-assist — a slower ball while the drill is on, and a little steering.
//
// ⚠️ THE DEV: "Com missões de cometa, a bolinha precisa ser mais lenta, e deve ser possível ter um leve
// controle sobre ela com o direcional, como se ela fosse capaz de produzir uma leve propulsão."
//
// ========================= AND SLOWER IS THE CLOCK, NOT A FORCE =========================
// ⚠️ THIS FILE SHIPPED A DRAG FIRST, `-k·v` AT k = 1.1, AND THE DEV FOUND WHAT IT COST BY PLAYING IT:
// "o jogo perdeu jogabilidade em vários pontos: além do túnel, se a bolinha cai em uma plataforma, ela
// corre o risco de parar, e rola devagar demais em ladeiras ao invés de rodar de forma fluida."
//
// The argument for the drag was that it is proportional — a cap flattens a good shot and a poor one to
// the same speed, `-k·v` does not — and that argument was correct AND ABOUT THE WRONG QUESTION. It asked
// what happens to the ball's SPEED and never asked what happens to WHERE THE BALL CAN GO. A drag is
// dissipative: it takes energy out of the table and gives none back, so
//
//   · on a level surface nothing acts along the surface at all and the speed decays as e^(-kt). The
//     ball parks, and nothing in the model ever starts it again.
//   · on a slope the roll is capped at g·sinθ/k — 28 units a second on a 15° ramp, however long it is.
//   · sideways, where gravity never helps, the TOTAL travel is bounded by v/k for the life of the ball.
//     36 units at 40 a second: less than half the width of the smallest table in the catalogue.
//
// The tunnel was only the first place it showed, because the climb is long and nothing helps it. The
// commit that exempted the lane cured the symptom that had been reported and left the mechanism running
// everywhere else — which is `CLAUDE.md`'s "one cause found is not the whole cause" happening again.
//
// ⚠️ WHAT WAS ASKED FOR IS A PACE: time to see a comet and choose it. Scaling the simulated step gives
// exactly that. The same forces integrated over a shorter step trace THE SAME CURVE THROUGH THE SAME
// POINTS, reached later — no energy leaves the table, so no surface becomes a trap and no slope is too
// shallow to roll down. Everything already tuned against the full-speed table stays tuned: the bumpers,
// the flipper strength, `LAUNCH_MARGIN`, the drain budgets, the gate that measures the storm.
//
// And it needs no exemption for the plunger lane. The launch is not weakened; it is watched in slow
// motion, which is why `tests/launch-clears-the-lane` now measures the same climb with the drill on and
// off and expects the same number.
//
// ========================= THE STEERING IS STILL A FORCE, AND THE SEAM IS STILL THERE ==================
// `physics/step` calls `fieldEffects(ball, destination)` once per ball per frame and adds what it writes
// to the velocity. Gravity has answered through it since the physics was ported and `table/storm`'s
// flare drag became the second user — a real drag, on a real medium, which is what the mechanism is for.
// The push is the third, and it belongs there for the reason the slowdown does not: it is a force.
//
// ⚠️ AND IT SURVIVES THE CLOCK UNCHANGED, which is the quiet argument for scaling time. Thrust and
// gravity are both accelerations, so a scaled clock weakens both by the same factor and their RATIO —
// the whole design of "leve" — is exactly what it was. The steered path has the same shape at any pace.

/** Which way the player is pushing. Three, because down is gravity's and is not offered — see below. */
export interface ThrustState {
  readonly up: boolean;
  readonly left: boolean;
  readonly right: boolean;
}

/** Nobody leaning on anything. Exported because six of the seven tables are always in this state. */
export const NO_THRUST: ThrustState = { up: false, left: false, right: false };

/**
 * How fast the table's own clock runs while a drill is on.
 *
 * ⚠️ 0.6, AND IT IS A PLAYABILITY DECISION RATHER THAN A MEASUREMENT — the same kind of number the
 * comets' own fall speed is, and it replaces a drag the Dev played and rejected. What it has to be is
 * slow enough that a player can pick which comet to go for, and fast enough that the table still reads
 * as a pinball table: three fifths of the pace is a visible slowdown that no ball ever gets stuck in,
 * because nothing about the geometry has changed.
 */
export const MISSION_TIME_SCALE = 0.6;

/**
 * And with the `slow` capsule taken.
 *
 * ⚠️ TWO THIRDS OF THE DRILL'S OWN PACE, not two thirds of the table's, so the capsule reads as a change
 * from what the player is currently living with rather than from a speed they last saw before the
 * mission started.
 */
export const SLOWED_TIME_SCALE = 0.4;

/**
 * The clock the physics is stepped with, as a fraction of real time.
 *
 * ⚠️ THE TWO CAPSULES ARE THE SAME KNOB TURNED EITHER WAY, which is why `control/power-ups` cancels one
 * when the other is taken and why neither adds a force of its own anywhere. `fast` is the table AT ITS
 * OWN PACE — already five thirds of what the drill leaves, and the one value on the dial that needs no
 * tuning because every other table in the catalogue is played at it. A number above 1 would be a speed
 * this game has never run a ball at, on geometry authored for the speed it has.
 */
export function missionTimeScale(
  o: { drill: boolean; slow: boolean; fast: boolean },
): number {
  if (!o.drill) return 1;
  // ⚠️ SLOW BEFORE FAST, and the game cannot reach the state where it matters. It is pinned by a test
  // anyway because the two failures are not symmetric: a ball that is too slow is only slow, and a
  // ball that is too fast is a ball the player loses to a defect.
  if (o.slow) return SLOWED_TIME_SCALE;
  if (o.fast) return 1;
  return MISSION_TIME_SCALE;
}

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

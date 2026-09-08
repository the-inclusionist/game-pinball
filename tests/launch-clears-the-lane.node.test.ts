// SPDX-License-Identifier: AGPL-3.0-or-later
// A FULL LAUNCH HAS TO GET THE BALL OUT OF THE LANE. ON EVERY TABLE. WITH THE DRILL ON.
//
// ⚠️ THE DEV: "O lançador está tão fraco que a bola não consegue sair do túnel. Dobre a força do
// lançador."
//
// ========================= AND THE LAUNCHER WAS NOT WHAT CHANGED =========================
// ⚠️ THE CAUSE WAS THE COMET DRILL, WHICH WAS A DRAG WHEN THIS FILE WAS WRITTEN. He asked for a slower
// ball during a mission — "a bolinha precisa ser mais lenta" — and `-k·v` at k = 1.1 took that fraction
// of the speed per second away from EVERYTHING, including a ball climbing the plunger lane. Measured
// across the tables, the climb a full draw managed:
//
//     low-orbit   needs 160   free 187   with the drill 121
//     ion-storm   needs 175   free 202   with the drill 126
//     long-climb  needs 225   free 252   with the drill 143
//     factory     needs 229   free 250   with the drill 145
//
// Not one table. He was right about the symptom; the diagnosis is what was wrong.
//
// ⚠️ AND DOUBLING WAS TRIED, MEASURED, AND REJECTED — which is the part worth writing down, because the
// first version of this header said the opposite. It said "doubling does not overshoot, which is why it
// is safe", on the strength of one measurement: the CLIMB barely changes, because the lane's return
// bend caps it. That was true and it was the wrong question. What a stronger launch changes is where
// the ball goes AFTER the bend: at ×2 five gates went red, at ×1.5 three did, and `narrow-tower` still
// could not launch. `LAUNCH_MARGIN` stays at 1.15.
//
// ========================= THE FIX WAS AN EXEMPTION, AND THEN IT WAS THE MECHANISM =====================
// ⚠️ THIS FILE FIRST TESTED A LANE THE DRAG DID NOT REACH. That cured the tunnel and left a dissipative
// force running everywhere else, and the Dev found the rest of it by playing: "se a bolinha cai em uma
// plataforma, ela corre o risco de parar, e rola devagar demais em ladeiras." The slowdown is the
// simulated CLOCK now — `table/ball-assist` argues it — and a clock cannot cost a launch anything,
// because the ball traces the same curve through the same points however fast it is watched.
//
// ⚠️ SO THE SECOND HALF OF THIS FILE ASKS A STRONGER QUESTION THAN IT USED TO. It no longer asks
// whether the ball still just about gets out with the drill on; it asks whether the climb is THE SAME
// NUMBER, which is what "the pace changed and nothing else did" means and what any future force
// smuggled in through `extraField` would break.

import { describe, test, expect } from 'vitest';
import { buildPhysics, FRAME_SECONDS, launchSpeedFor } from '../app/js/table/physics-build.js';
import { advanceFrame } from '../app/js/physics/step.js';
import { CATALOG } from '../app/js/table/catalog.js';
import { MISSION_TIME_SCALE } from '../app/js/table/ball-assist.js';
import type { AuthoredTable } from '../app/js/table/authored.js';

/**
 * The top of the plunger lane's divider, which is where a ball has to reach to enter the play.
 *
 * ⚠️ THE CABINET'S OWN NUMBER, NOT A COPY OF IT. `table/cabinet` sets `dividerTop = 34`, and a test
 * that wrote 34 again would go on passing on the day the cabinet changed — measuring a lane that is no
 * longer there. It is read here as "the height the ball must clear", which is what it means.
 */
const DIVIDER_TOP = 34;

/**
 * Launches at a full draw and reports how far up the table the ball got.
 *
 * ⚠️ `scale` IS THE TABLE'S CLOCK, AND IT IS APPLIED THE WAY `main` APPLIES IT — to the step handed to
 * `advanceFrame`, with proportionally more steps so the same amount of SIMULATED time passes. Running
 * the same frame count at a shorter step would measure a shorter launch and prove nothing about it.
 */
function launch(
  table: AuthoredTable, scale: number,
): { needed: number; climbed: number; freeFlight: number } {
  const physics = buildPhysics(table, {});
  const ball = physics.spawnBall();
  const start = ball.position.y;
  // ⚠️ UP THE LANE, WHICH LEANS NINE DEGREES. A plunger fires along its own channel, and on this
  ball.direction = { x: 0, y: -1 };
  ball.speed = launchSpeedFor(table);

  /**
   * ⚠️ HALF A SIMULATED SECOND, WHICH IS THE PART TWO CLOCKS CAN BE COMPARED OVER. Every table's ball
   * is still in free flight up the lane at that point — nothing on any of them is touched before 0.6 —
   * so the height there is decided by the launch and by gravity and by nothing else. After the first
   * contact the two runs diverge for a reason that is not the drill: a collision resolved a fraction
   * of a unit apart sends the ball somewhere else, and on `low-orbit` that is six units of climb.
   */
  const freeFlightFrames = Math.round(0.5 / (FRAME_SECONDS * scale));
  let freeFlight = start;

  let highest = start;
  for (let i = 0, n = Math.round(900 / scale); i < n; i++) {
    advanceFrame([ball], physics.context, FRAME_SECONDS * scale);
    physics.takeHits();
    highest = Math.min(highest, ball.position.y);
    if (i === freeFlightFrames) freeFlight = ball.position.y;
    if (ball.position.y > table.size.height) break;
  }
  return { needed: start - DIVIDER_TOP, climbed: start - highest, freeFlight: start - freeFlight };
}

describe.each(CATALOG.map((t) => [t.name, t] as const))('%s', (name, table) => {
  test('a full draw clears the lane', () => {
    const { needed, climbed } = launch(table, 1);

    expect(climbed, `${name} needs ${needed.toFixed(0)} to reach the top of the divider`
      + ` and climbs ${climbed.toFixed(0)}`).toBeGreaterThan(needed);
  });

  test('⚠️ and the comet drill does not shorten the climb at all', () => {
    /**
     * The half that was broken, and the half nothing was watching. The plunger lane is the one place
     * on the table where the ball has a long climb and nothing to help it, so it is where anything
     * that quietly costs the ball energy shows up first and worst.
     *
     * ⚠️ TWO UNITS, AND THE NUMBER IS DERIVED RATHER THAN OBSERVED. Over the free flight the two runs
     * integrate the same forces at different step sizes, so the only thing that can separate them is
     * the integrator's own step bias — about ½·g·Δh·t, which at g = 120, Δh = (1 − 0.6)/60 and half a
     * second is 0.2 of a unit. Two is ten times the worst case and still thirty times tighter than the
     * drag this file was written about, which cost between a quarter and a half of the whole climb.
     *
     * ⚠️ AND IT IS THE FREE FLIGHT THAT IS COMPARED, NOT THE APEX. The full climb ends against the
     * return bend, and a collision resolved a fraction of a unit apart puts the ball somewhere else:
     * measured on `low-orbit`, six units of difference that is chaos rather than drag. The claim the
     * clock has to answer is that it takes no ENERGY out, and free flight is where that shows.
     */
    const free = launch(table, 1);
    const drilled = launch(table, MISSION_TIME_SCALE);
    const EULER_SLACK = 2;

    expect(Math.abs(drilled.freeFlight - free.freeFlight), `${name}: free`
      + ` ${free.freeFlight.toFixed(1)}, drilled ${drilled.freeFlight.toFixed(1)}`)
      .toBeLessThan(EULER_SLACK);
    expect(drilled.climbed, `${name} with the drill on: needs ${drilled.needed.toFixed(0)},`
      + ` climbs ${drilled.climbed.toFixed(0)}`).toBeGreaterThan(drilled.needed);
  });
});

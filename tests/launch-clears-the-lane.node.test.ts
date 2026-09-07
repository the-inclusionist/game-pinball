// SPDX-License-Identifier: AGPL-3.0-or-later
// A FULL LAUNCH HAS TO GET THE BALL OUT OF THE LANE. ON EVERY TABLE. WITH THE DRILL ON.
//
// ⚠️ THE DEV: "O lançador está tão fraco que a bola não consegue sair do túnel. Dobre a força do
// lançador."
//
// ========================= AND THE LAUNCHER WAS NOT WHAT CHANGED =========================
// ⚠️ THE CAUSE WAS THE COMET DRILL'S DRAG, WHICH I ADDED THE COMMIT BEFORE. He asked for a slower ball
// during a mission — "a bolinha precisa ser mais lenta" — and `MISSION_DRAG` takes 1.1 of its speed per
// second away from EVERYTHING, including a ball climbing the plunger lane. Measured across the seven
// tables, the climb a full draw manages:
//
//     low-orbit   needs 160   free 187   with the drill 121
//     ion-storm   needs 175   free 202   with the drill 126
//     long-climb  needs 225   free 252   with the drill 143
//     factory     needs 229   free 250   with the drill 145
//
// Not one table. The ball goes up the tunnel, runs out of speed and comes back down, on every table in
// the catalogue, for as long as a mission is running — which since the mission screen shipped is
// always. He is right about the symptom; the diagnosis is what was wrong.
//
// ⚠️ AND DOUBLING WAS TRIED, MEASURED, AND REJECTED — which is the part worth writing down, because the
// first version of this header said the opposite. It said "doubling does not overshoot, which is why it
// is safe", on the strength of one measurement: the CLIMB barely changes, because the lane's return
// bend caps it. That was true and it was the wrong question. What a stronger launch changes is where
// the ball goes AFTER the bend:
//
//     x2.0   five gates red — `crater-run` and `factory` stop letting the flippers change the ball's
//            life, and `low-orbit`, `ring-belt` and others stop reaching components that score
//     x1.5   three still red, and `narrow-tower` STILL cannot launch under the drag, because a
//            proportional force costs a table 420 tall disproportionately more
//
// So the plunger was never the problem and making it stronger does not fix it. The drag is exempted
// inside the LANE instead — a drill that slows play has no business slowing the launch — which puts the
// plunger back exactly where it was when the Dev last played it and leaves six tables tuned as they
// are. Raising `LAUNCH_MARGIN` is a re-tuning of all of them, and it is his to ask for knowing that.

import { describe, test, expect } from 'vitest';
import { buildPhysics, FRAME_SECONDS, launchSpeedFor } from '../app/js/table/physics-build.js';
import { advanceFrame } from '../app/js/physics/step.js';
import { CATALOG } from '../app/js/table/catalog.js';
import { MISSION_DRAG } from '../app/js/table/ball-assist.js';
import type { AuthoredTable } from '../app/js/table/authored.js';
import { plungerLaneOf } from '../app/js/table/cabinet.js';

const NO_THRUST = { up: false, left: false, right: false };

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
 * ⚠️ THE DRILL'S DRAG IS APPLIED THE WAY THE GAME APPLIES IT, which since this defect means NOT inside
 * the plunger lane. `main.ts` asks `plungerLaneOf` and answers a zero drag for a ball still in the
 * tunnel; a gate that applied it flat would be measuring a configuration the game does not run, and
 * would stay red for ever while the game worked.
 *
 * The flat-drag numbers are in this file's header, because they are the evidence for the exemption
 * rather than a state the game can be in.
 */
function launch(table: AuthoredTable, drag: number): { needed: number; climbed: number } {
  const lane = plungerLaneOf(table.size);
  const physics = buildPhysics(table, {
    extraField: (moving) => ({
      drag: moving.position.x > lane.divider && moving.position.y > lane.dividerTop ? 0 : drag,
      thrust: NO_THRUST,
    }),
  });
  const ball = physics.spawnBall();
  const start = ball.position.y;
  ball.direction = { x: 0, y: -1 };
  ball.speed = launchSpeedFor(table);

  let highest = start;
  for (let i = 0; i < 900; i++) {
    advanceFrame([ball], physics.context, FRAME_SECONDS);
    physics.takeHits();
    highest = Math.min(highest, ball.position.y);
    if (ball.position.y > table.size.height) break;
  }
  return { needed: start - DIVIDER_TOP, climbed: start - highest };
}

describe.each(CATALOG.map((t) => [t.name, t] as const))('%s', (name, table) => {
  test('a full draw clears the lane', () => {
    const { needed, climbed } = launch(table, 0);

    expect(climbed, `${name} needs ${needed.toFixed(0)} to reach the top of the divider`
      + ` and climbs ${climbed.toFixed(0)}`).toBeGreaterThan(needed);
  });

  test('⚠️ and it still clears it while the comet drill is slowing the ball', () => {
    /**
     * The half that was broken, and the half nothing was watching. `MISSION_DRAG` is a force on every
     * ball everywhere, and the plunger lane is the one place on the table where the ball has a long
     * climb and nothing to help it — so it is where a proportional drag shows up first and worst.
     */
    const { needed, climbed } = launch(table, MISSION_DRAG);

    expect(climbed, `${name} with the drill on: needs ${needed.toFixed(0)}, climbs ${climbed.toFixed(0)}`)
      .toBeGreaterThan(needed);
  });
});

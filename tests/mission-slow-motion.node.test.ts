// SPDX-License-Identifier: AGPL-3.0-or-later
// A SLOWER BALL IS SLOW MOTION, NOT TREACLE.
//
// ⚠️ THE DEV, AFTER PLAYING WHAT HE ASKED FOR: "Após eu pedir para a bolinha ficar mais lenta, o jogo
// perdeu jogabilidade em vários pontos: além do túnel, se a bolinha cai em uma plataforma, ela corre o
// risco de parar, e rola devagar demais em ladeiras ao invés de rodar de forma fluida."
//
// ========================= HE IS DESCRIBING DRAG, AND DRAG WAS THE WRONG MECHANISM =========================
// ⚠️ `MISSION_DRAG` WAS `-k·v` AT k = 1.1, AND ITS OWN COMMENT ARGUED FOR IT — "everything slows by the
// same FRACTION, the ordering of a strong shot and a weak one survives". That argument is true and it is
// about SPEED. What it never asked is what a dissipative force does to WHERE THE BALL CAN GO, and every
// one of the three symptoms above is that question answered:
//
//   · ON THE FLAT there is no force along the surface, so the only term left is the drag and the speed
//     decays as e^(-1.1t) — 33% of it left after a second, 11% after two. The ball parks. Nothing in the
//     model ever starts it again, and `physics/stuck` will not rescue it either: a ball resting on a
//     platform is not inside a flipper box, but it takes 500 idle ticks — over eight seconds — before
//     anything even asks.
//   · ON A SLOPE the along-surface pull is g·sinθ and drag caps the roll at g·sinθ/k. On a 15° ramp
//     that is 120 × 0.259 / 1.1 = 28 units a second, for ever, however long the ramp. It creeps.
//     "Rola devagar demais em ladeiras ao invés de rodar de forma fluida" is that number.
//   · SIDEWAYS, gravity never helps at all, so the total horizontal travel is bounded by v/k for the
//     whole life of the ball: 36 units at 40 a second, on a table 100 wide. The tunnel was the first
//     place this was noticed because the climb is long and nothing helps it — the fix committed then
//     exempted the LANE, which cured the symptom that had been reported and left the mechanism in
//     place everywhere else. One cause found is not the whole cause.
//
// ========================= AND THE ASK WAS ABOUT PACE, WHICH IS THE CLOCK =========================
// "A bolinha precisa ser mais lenta" is a request about how fast the picture moves, so that a player has
// time to choose which comet to go for. Scaling the physics clock gives exactly that and nothing else:
// integrate the same forces over a shorter simulated step and the ball traces THE SAME CURVE THROUGH THE
// SAME POINTS, arriving later. No energy leaves the table, so there is no speed at which a surface
// becomes a trap and no slope too shallow to roll down.
//
// It is also the only version that keeps every number already tuned — the bumpers, the flipper strength,
// the launch margin, the drain budget — because none of them is touched. A drag re-tunes all of them at
// once, invisibly, which is why five gates went red the first time the plunger was blamed for it.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test, expect } from 'vitest';
import { buildPhysics, FRAME_SECONDS } from '../app/js/table/physics-build.js';
import { advanceFrame } from '../app/js/physics/step.js';
import { BARE_MINIMUM } from '../app/js/table/catalog.js';
import { MISSION_TIME_SCALE, SLOWED_TIME_SCALE, missionTimeScale }
  from '../app/js/table/ball-assist.js';

/** The sideways speed every run below starts with, in table units per second. */
const SIDEWAYS = 40;

/**
 * ⚠️ THE FURTHEST THE OLD DRAG COULD EVER HAVE CARRIED THIS BALL SIDEWAYS, at any time, on any table:
 * the horizontal equation is v' = -k·v with nothing driving it, whose whole integral is v/k. At
 * SIDEWAYS = 40 and k = 1.1 that is 36 units — so on a table 100 wide the ball could not cross from one
 * side to the other however long it was given. The number is written here rather than imported because
 * the constant it comes from is gone, and this is the bar the replacement has to clear.
 */
const FURTHEST_A_DRAG_ALLOWED = SIDEWAYS / 1.1;

/**
 * Slides a ball sideways across an empty part of the table and reports how far it got.
 *
 * ⚠️ SIDEWAYS BECAUSE GRAVITY DOES NOT HELP THERE, and that is exactly the case a level platform puts
 * the ball in: the surface cancels the pull and the only term left acting along it is whatever the
 * drill adds. A vertical drop would have hidden the defect behind gravity, which is why the first
 * measurements of the drill — all of them falls — reported it as working.
 *
 * ⚠️ AND `x` IS EXACT UNDER BOTH CLOCKS. `physics/step` denormalises the direction into a velocity, adds
 * the force and renormalises; with no horizontal force the horizontal component is never touched, so
 * `x` advances by exactly `vx · dt` per frame and the total is `vx × simulated time` whatever the step
 * size. That is what lets the two runs below be compared with a tolerance of half a unit instead of a
 * hand-waved one — any difference bigger than that is the mechanism, not the integrator.
 */
function slide(o: { scale: number; frames: number }): { travelled: number; y: number } {
  const physics = buildPhysics(BARE_MINIMUM, {});
  const ball = physics.spawnBall();
  // Left of centre, moving right: `bare-minimum` is 100 wide with walls at 4 and 96 and the plunger
  // lane divider at 79, and the runs below end around x = 68 — clear of all three.
  ball.position = { x: 20, y: 20 };
  ball.direction = { x: 1, y: 0 };
  ball.speed = SIDEWAYS;
  for (let i = 0; i < o.frames; i++) {
    advanceFrame([ball], physics.context, FRAME_SECONDS * o.scale);
    physics.takeHits();
  }
  return { travelled: ball.position.x - 20, y: ball.position.y };
}

/** 1.2 seconds of simulated time at full speed. */
const FULL_SPEED_FRAMES = 72;

describe('the drill slows the clock, not the ball', () => {
  test('⚠️ the same simulated time carries the ball to the same place', () => {
    /**
     * The defining property of slow motion, and the one a drag cannot have: the path through SPACE is
     * unchanged. Whatever the ball could reach before a drill started, it can still reach.
     */
    const free = slide({ scale: 1, frames: FULL_SPEED_FRAMES });
    const slowed = slide({
      scale: MISSION_TIME_SCALE,
      frames: Math.round(FULL_SPEED_FRAMES / MISSION_TIME_SCALE),
    });

    expect(free.travelled, 'the free run is the reference and it did not move')
      .toBeGreaterThan(FURTHEST_A_DRAG_ALLOWED);
    expect(slowed.travelled, `free ${free.travelled.toFixed(1)}`
      + ` vs drilled ${slowed.travelled.toFixed(1)}`).toBeCloseTo(free.travelled, 0);
  });

  test('⚠️ and it goes further than the drag it replaces could ever have taken it', () => {
    /**
     * The Dev's report as a number. `v/k` is not a rate the old ball would have taken a while to cover
     * — it is the whole distance it had, ever. A ball that lands on a platform with nothing pushing it
     * along has that much travel left and then stops, which is what he watched happen.
     */
    const slowed = slide({
      scale: MISSION_TIME_SCALE,
      frames: Math.round(FULL_SPEED_FRAMES / MISSION_TIME_SCALE),
    });

    expect(slowed.travelled, `${slowed.travelled.toFixed(1)} against a drag's ceiling of`
      + ` ${FURTHEST_A_DRAG_ALLOWED.toFixed(1)}`).toBeGreaterThan(FURTHEST_A_DRAG_ALLOWED);
  });

  test('⚠️ what changes is the pace: the same real time covers less ground', () => {
    /**
     * The half that makes it a slower ball at all, and the half a mutation to `MISSION_TIME_SCALE = 1`
     * is caught by. The test above would still pass with the drill doing nothing.
     */
    const free = slide({ scale: 1, frames: FULL_SPEED_FRAMES });
    const slowed = slide({ scale: MISSION_TIME_SCALE, frames: FULL_SPEED_FRAMES });

    expect(slowed.travelled / free.travelled).toBeCloseTo(MISSION_TIME_SCALE, 2);
  });

  test('a ball that keeps falling keeps falling, so nothing is holding it up', () => {
    // The scale is not a force. A run that ended level with where it started would mean the clock had
    // been mistaken for an anti-gravity field.
    const slowed = slide({
      scale: MISSION_TIME_SCALE,
      frames: Math.round(FULL_SPEED_FRAMES / MISSION_TIME_SCALE),
    });

    expect(slowed.y).toBeGreaterThan(80);
  });
});

describe('who turns the clock down', () => {
  test('⚠️ nothing at all outside a drill, on every other table and between missions', () => {
    /**
     * Six of the seven tables have no comet drill and never will. The mission is the only thing that
     * turns this on, and a scale of anything but exactly 1 elsewhere would re-tune all of them.
     */
    expect(missionTimeScale({ drill: false, slow: false, fast: false })).toBe(1);
    expect(missionTimeScale({ drill: false, slow: true, fast: false }))
      .toBe(1);
  });

  test('the drill alone runs the table slow', () => {
    expect(missionTimeScale({ drill: true, slow: false, fast: false })).toBe(MISSION_TIME_SCALE);
    expect(MISSION_TIME_SCALE, 'a scale of 1 or more is not a slower ball').toBeLessThan(1);
  });

  test('⚠️ the two capsules are the same knob turned either way', () => {
    const plain = missionTimeScale({ drill: true, slow: false, fast: false });
    const slow = missionTimeScale({ drill: true, slow: true, fast: false });
    const fast = missionTimeScale({ drill: true, slow: false, fast: true });

    expect(slow, 'the slow capsule did not slow anything').toBeLessThan(plain);
    expect(slow).toBe(SLOWED_TIME_SCALE);
    /**
     * ⚠️ AND `fast` IS THE TABLE AT ITS OWN PACE RATHER THAN A NEW NUMBER. The drill is what made the
     * ball slow; lifting it entirely is already 1.6 times the speed the player has been living with,
     * and it is the one value on the dial that needs no tuning because every other table already uses
     * it. Going above 1 would be a speed this game has never run a ball at.
     */
    expect(fast, 'the fast capsule is the clock back at normal').toBe(1);
  });

  test('⚠️ and if both ever arrive at once, the slower one wins', () => {
    /**
     * `control/power-ups` cancels one when the other is taken, so this is a state the game does not
     * reach — which is exactly why it is worth pinning. The failure modes are not symmetric: a ball
     * that is too slow is only slow, and a ball that is too fast is a ball the player loses.
     */
    expect(missionTimeScale({ drill: true, slow: true, fast: true })).toBe(SLOWED_TIME_SCALE);
  });
});

describe('and the frame loop actually uses it', () => {
  /**
   * ⚠️ NO UNIT CAN SEE THIS LINE. `main.ts` touches `document` on its first line and cannot be imported
   * by a node test, so the decision was extracted into `missionTimeScale` — which leaves exactly one
   * thing unproved: that the loop hands the scaled step to the physics rather than computing it and
   * dropping it. That is the same gap `tests/shell-boot` records for the movers, discovered there by a
   * body that sat at the start of its path for ever.
   */
  test('⚠️ the physics is stepped with the table clock, not with real time', () => {
    const source = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../app/js/main.ts'), 'utf8',
    );

    expect(source, 'the clock is computed from the drill and the capsules')
      .toMatch(/const tableSeconds = frames \* FRAME_SECONDS \* missionTimeScale\(/);
    expect(source, 'and the balls are advanced with it')
      .toMatch(/advanceFrame\([^)]*physics\.context, tableSeconds\)/);
  });
});

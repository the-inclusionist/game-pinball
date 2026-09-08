// SPDX-License-Identifier: AGPL-3.0-or-later
// A BALL ON A SLOPE ROLLS DOWN IT.
//
// ⚠️ THE DEV, WITH A SCREENSHOT OF `ring-belt`: "a bolinha simplesmente congelou-se embaixo ao invés de
// rolar pela ladeira." The ball is sitting on the right funnel guide, motionless, halfway down it.
//
// ⚠️ AND IT IS NOT THE DRILL, WHICH IS THE FIRST THING I CHECKED AND THE SECOND TIME I HAVE BEEN WRONG
// ABOUT THIS SYMPTOM. `MISSION_DRAG` was a real defect and it is gone — `tests/mission-slow-motion`
// carries that — and the ball still freezes, on a table with no drill running, because the cause is
// underneath both.
//
// ========================= THE TANGENTIAL COMPONENT IS DESTROYED ON CONTACT =========================
// `physics/collision` transcribes `TBall::Collision`:
//
//     v' = smoothness · v_tangential + elasticity · |v_normal| · n
//
// and `table/physics-build` gives a wall `smoothness: 0.1`. NINE TENTHS OF THE ALONG-SURFACE SPEED IS
// TAKEN AWAY BY A TOUCH. That is survivable for a ball that bounces off a wall once. It is fatal for a
// ball RESTING on one, because a resting ball collides every single frame: sixty times a second, so the
// speed it keeps after a second is 0.1^60, which is not a number with a name.
//
// The steady state is what the Dev photographed. Gravity supplies `g·sinθ` along the slope and each
// contact takes back a fraction, so the ball settles at `a / (60·ln(1/s))`: on a 30° ramp, with g = 120
// and s = 0.1, that is 0.43 units a second. It is not slow. It is stopped.
//
// ⚠️ AND THE NUMBER IS OURS RATHER THAN 1995'S, which is why this is a fix and not a deviation from the
// transcription. `RESPONSES` is a table of our own — "one per kind, because a bumper is not a wall" —
// written for the authored tables. The original reads elasticity and smoothness per component out of
// `PINBALL.DAT`, and nothing in this repository has ever compared the two.
import { describe, test, expect } from 'vitest';
import { buildPhysics, FRAME_SECONDS, RESPONSES, DEFAULT_GRAVITY }
  from '../app/js/table/physics-build.js';
import { advanceFrame } from '../app/js/physics/step.js';
import { BARE_MINIMUM } from '../app/js/table/catalog.js';
import type { AuthoredTable } from '../app/js/table/authored.js';

/** How far down the table the slope runs, and how far across. 30° from horizontal. */
const RUN = 60;
const RISE = Math.round(RUN * Math.tan(Math.PI / 6));

/**
 * `bare-minimum` with one long ramp across it, and nothing else in the way.
 *
 * ⚠️ THE WINDING PUTS THE SOLID SIDE UP. `table/authored`'s rule: a line's normal is `(dy, −dx)`, so a
 * face running down and to the RIGHT has its normal pointing up and to the right — which is the side a
 * ball resting on it arrives from. Wound the other way the ball falls straight through and this file
 * measures nothing at all.
 */
function withSlope(): AuthoredTable {
  return {
    ...BARE_MINIMUM,
    components: [
      ...BARE_MINIMUM.components,
      { name: 'slope', kind: 'wall', role: 'structure',
        bounds: { x: 20, y: 60, width: RUN, height: RISE },
        collision: [{ kind: 'line', from: { x: 20, y: 60 }, to: { x: 20 + RUN, y: 60 + RISE } }] },
    ],
  };
}

/** Puts a ball at rest at the top of the slope and reports how far along it got in `seconds`. */
function roll(seconds: number): { travelled: number; speed: number } {
  const table = withSlope();
  const physics = buildPhysics(table);
  const ball = physics.spawnBall();
  // A hair above the face, at rest: everything that happens next is gravity and the surface.
  ball.position = { x: 26, y: 60 + (6 * RISE) / RUN - table.ballRadius - 0.5 };
  ball.direction = { x: 0, y: 1 };
  ball.speed = 0;
  const from = { ...ball.position };

  for (let i = 0, n = Math.round(seconds / FRAME_SECONDS); i < n; i++) {
    advanceFrame([ball], physics.context, FRAME_SECONDS);
    physics.takeHits();
  }
  return {
    travelled: Math.hypot(ball.position.x - from.x, ball.position.y - from.y),
    speed: ball.speed,
  };
}

describe('a ball let go on a slope', () => {
  test('⚠️ rolls down it, instead of stopping where it was put', () => {
    /**
     * ⚠️ HALF OF THE FRICTIONLESS DISTANCE, AND THE BAR IS DELIBERATELY GENEROUS. A ball sliding freely
     * down a 30° incline covers `½·g·sinθ·t²` — 60 units in a second at g = 120 — and a surface is
     * allowed to take some of that. What it is not allowed to do is take ALL of it: measured before the
     * fix, the ball travelled 1.8 units in that second and its speed was 0.6, which is the Dev's
     * screenshot as a number.
     */
    const { travelled, speed } = roll(1);
    const frictionless = 0.5 * DEFAULT_GRAVITY * Math.sin(Math.PI / 6);

    expect(travelled, `it moved ${travelled.toFixed(1)} of a frictionless ${frictionless.toFixed(0)}`)
      .toBeGreaterThan(frictionless / 2);
    expect(speed, 'it is not moving at the end of the run').toBeGreaterThan(20);
  });

  test('⚠️ and it is still rolling FASTER a second later, so nothing has capped it dead', () => {
    // A surface that takes a fixed share per contact settles at a terminal speed; this asks that the
    // terminal be somewhere a player would call rolling rather than somewhere they would call stuck.
    const early = roll(0.5);
    const later = roll(1.5);

    expect(later.speed, `${early.speed.toFixed(1)} then ${later.speed.toFixed(1)}`)
      .toBeGreaterThan(early.speed);
  });
});

describe('what a surface is allowed to take', () => {
  test('⚠️ it takes the along-surface speed in proportion to the impact, not as a toll', () => {
    /**
     * ⚠️ AND THE CONSTANT DID NOT MOVE, WHICH IS THE POINT. The first fix raised `smoothness` from 0.1
     * to 0.98 and it worked — and it re-tuned every table at once, because it changed what a hard hit
     * does as well as what a slide does. Ten gates went red across six files, two of them on tables a
     * player is offered.
     *
     * `frictionByImpact` changes the MODEL instead of the number: a loss proportional to how hard the
     * ball is pressed into the surface. It agrees with the transcription exactly at 45°, differs
     * invisibly on steeper hits, and only lets go where the old model was wrong — a graze, and a
     * slide. `physics/collision` carries the derivation.
     */
    expect(RESPONSES.wall!.frictionByImpact, 'a wall still pays a flat toll').toBe(true);
    expect(RESPONSES.wall!.smoothness, 'the transcribed number was changed as well').toBe(0.1);
  });

  test('and the bumper is left alone, because a kick is not a slide', () => {
    // A bumper is touched once and answers with a boost along its normal; how much of the tangential it
    // keeps is a decision about the SHOT, not about rolling, and this file has no evidence about it.
    expect(RESPONSES.bumper!.boost).toBeGreaterThan(0);
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
// THE FLARE — a band of the table that travels down it and slows whatever it is passing over.
//
// ⚠️ THE DEV'S THEME FOR `ion-storm`, WHICH IS THE LAST OF THE FOUR AND THE ONLY ONE THAT NEEDED A NEW
// MECHANIC: "um fundo que varia de preto, marrom, vermelho, amarelo e branco" — cycling and back — and
// "o flare deixando a bolinha mais lenta durante sua incidência".
//
// ========================= THE TWO HALVES ARE ONE THING =========================
// Read separately those are an animated backdrop and a slowing field, and they would be two mechanics
// that happen to share a table. Read together they are ONE: a bright band sweeping down the playfield.
// A fixed point of the table sees black, then brown, red, yellow, white as the band arrives, and the
// same colours in reverse as it leaves — which is the Dev's cycle exactly, "e volta" included — and
// the ball is slowed precisely while the band is over it, which is "durante sua incidência".
//
// So the flare is a BODY THAT TRAVELS A DECLARED PATH, which this repository already has a name and an
// implementation for: `table/mover`. It differs from a drone in one respect — it does not collide, it
// drags — and sharing the path arithmetic means the flare cannot drift on a slow machine for the
// reasons `table/mover` records at length.
//
// ========================= AND THE DRAG IS A FORCE, NOT A SPEED EDIT =========================
// ⚠️ `physics/step` INTEGRATES `fieldEffects` INTO THE VELOCITY AND RENORMALISES. A field that reached
// in and set `ball.speed` would be fighting that integration rather than joining it: the next frame's
// gravity would be applied to a speed the physics did not produce, and the ball would behave
// differently at 30 frames a second than at 60. A drag force `-k·v` integrated the way gravity is
// gives exponential decay, which is frame-rate stable and is what a real medium does.
import { describe, test, expect } from 'vitest';
import { flareGrip, stormPath, type AuthoredStorm } from '../app/js/table/storm.js';
import { moverAt } from '../app/js/table/mover.js';
import { buildPhysics, FRAME_SECONDS, DEFAULT_GRAVITY } from '../app/js/table/physics-build.js';
import { advanceFrame } from '../app/js/physics/step.js';
import { validateTable, type AuthoredTable } from '../app/js/table/authored.js';
import { BARE_MINIMUM } from '../app/js/table/bare-minimum.js';
import { ION_STORM } from '../app/js/table/ion-storm.js';

const STORM: AuthoredStorm = { seconds: 4, thickness: 40, drag: 6 };
const SIZE = { width: 100, height: 181 };

describe('where the flare is', () => {
  test('⚠️ it is a body travelling a declared path, so `table/mover` answers where', () => {
    // Not a second clock. See the header: one implementation of "position as a function of time".
    const path = stormPath(STORM, SIZE);

    expect(moverAt(path, 0).y).toBe(0);
    expect(moverAt(path, 2).y).toBe(90.5);
    expect(moverAt(path, 4).y).toBe(181);
    // And back, which is the Dev's "e volta".
    expect(moverAt(path, 6).y).toBe(90.5);
  });

  test('and it crosses the whole table, top to bottom', () => {
    const path = stormPath(STORM, SIZE);

    expect(path.from).toEqual({ x: 50, y: 0 });
    expect(path.to).toEqual({ x: 50, y: 181 });
    expect(path.seconds).toBe(4);
  });
});

describe('how hard it grips', () => {
  test('at the centre of the band it is whole', () => {
    expect(flareGrip(100, 100, 40)).toBe(1);
  });

  test('⚠️ and it FADES to the edges rather than switching off at them', () => {
    // A step would make the ball's speed jump at a line nobody drew, and a jump in speed is what a
    // collision looks like. The Dev asked for the ball to be slowed "durante sua incidência" — during
    // the flare's incidence — which is a thing that arrives and passes, not a switch.
    expect(flareGrip(110, 100, 40)).toBe(0.5);
    expect(flareGrip(90, 100, 40)).toBe(0.5);
  });

  test('and outside the band it is nothing at all', () => {
    expect(flareGrip(121, 100, 40)).toBe(0);
    expect(flareGrip(79, 100, 40)).toBe(0);
    expect(flareGrip(0, 100, 40)).toBe(0);
  });
});

describe('a storm a table may not declare', () => {
  const withStorm = (storm: AuthoredStorm): AuthoredTable => ({ ...BARE_MINIMUM, storm });

  test('the honest one is legal', () => {
    expect(validateTable(withStorm(STORM), { viewHeight: 180 })).toEqual([]);
  });

  test('a flare of no thickness is a band nobody can be inside', () => {
    expect(validateTable(withStorm({ ...STORM, thickness: 0 }), { viewHeight: 180 }))
      .toEqual(['storm: needs a thickness — a flare of none is a band nothing can be inside']);
  });

  test('a sweep of no duration is a body in every place at once', () => {
    expect(validateTable(withStorm({ ...STORM, seconds: 0 }), { viewHeight: 180 }))
      .toEqual(['storm: needs a time for its sweep']);
  });

  test('⚠️ and a drag that pushes is not a drag', () => {
    // A negative coefficient turns `-k·v` into acceleration along the ball's own heading, which is a
    // field that adds energy every frame the ball is inside it. The clamp in `physics/step` would cap
    // the result, so the symptom would be "the ball is always at maximum speed on this table" rather
    // than anything pointing here.
    expect(validateTable(withStorm({ ...STORM, drag: -1 }), { viewHeight: 180 }))
      .toEqual(['storm: needs a positive drag — a negative one adds energy instead of taking it']);
  });
});

/**
 * ⚠️ AND IT HAS TO REACH THE BALL, which is the half the arithmetic above cannot answer.
 *
 * This repository's recurring defect is a capability with all its parts and none of its joins: a
 * `fieldEffects` hook that nothing but gravity has ever used, lamps that never reached a pixel, a
 * gamepad that was polled and never read. The tests below are the join, and they are written as A/B
 * against the SAME table without a storm — because gravity is acting the whole time, and the first
 * version of `table/mover`'s own push test measured gravity and called it a push.
 */
describe('⚠️ the flare in a real table', () => {
  const stormy: AuthoredTable = { ...BARE_MINIMUM, storm: STORM };
  const calm: AuthoredTable = { ...BARE_MINIMUM, storm: undefined };

  /** The flare parked mid-table: half a sweep down, where the ball below has clear air to fall in. */
  const middle = STORM.seconds / 2;

  test('the force on a ball inside the flare opposes the way it is going', () => {
    const physics = buildPhysics(stormy);
    physics.flare!.advance(middle);
    const centre = physics.flare!.at.y;

    const ball = physics.spawnBall();
    ball.position = { x: 20, y: centre };
    ball.direction = { x: 0, y: 1 };
    ball.speed = 100;

    const force = { x: 0, y: 0 };
    physics.context.fieldEffects(ball, force);

    // Gravity pulls down at `DEFAULT_GRAVITY`; the drag pulls up at `drag × speed` on a ball at the
    // centre of the band travelling straight down. It is enough to reverse the sign of the total.
    expect(force.y).toBeCloseTo(DEFAULT_GRAVITY - STORM.drag * 100, 5);
  });

  test('⚠️ and a ball OUTSIDE it feels exactly what a calm table gives, which is the whole claim', () => {
    // Without this, a drag applied everywhere passes every other test here. It would be friction on
    // the table rather than a flare on it, and the symptom — "this table plays sluggish" — points
    // nowhere near the code.
    const physics = buildPhysics(stormy);
    physics.flare!.advance(middle);

    const ball = physics.spawnBall();
    ball.position = { x: 20, y: 10 };
    ball.direction = { x: 0, y: 1 };
    ball.speed = 100;

    const inStorm = { x: 0, y: 0 };
    const inCalm = { x: 0, y: 0 };
    physics.context.fieldEffects(ball, inStorm);
    buildPhysics(calm).context.fieldEffects(ball, inCalm);

    expect(inStorm).toEqual(inCalm);
  });

  test('⚠️ a ball falling THROUGH the flare arrives slower than the same ball on a calm table', () => {
    // The claim in the Dev's own words. Both balls fall the same distance from the same place for the
    // same number of frames, so the difference is the flare and nothing else.
    const speeds: number[] = [];

    for (const table of [stormy, calm]) {
      const physics = buildPhysics(table);
      physics.flare?.advance(middle);

      const ball = physics.spawnBall();
      ball.position = { x: 20, y: 40 };
      ball.direction = { x: 0, y: 1 };
      ball.speed = 60;

      for (let i = 0; i < 60; i++) advanceFrame([ball], physics.context, FRAME_SECONDS);
      speeds.push(ball.speed);
    }

    expect(speeds[0]!, `through the flare ${speeds[0]!.toFixed(1)} vs calm ${speeds[1]!.toFixed(1)}`)
      .toBeLessThan(speeds[1]! * 0.8);
  });

  test('a table with no storm has no flare to advance', () => {
    expect(buildPhysics(calm).flare).toBeUndefined();
  });
});

/**
 * ⚠️ AND IT HAS TO BE ON THE TABLE THE DEV ASKED FOR.
 *
 * Everything above would pass with `ion-storm` declaring no storm at all: the arithmetic is right, the
 * validator is right, the field reaches a ball on a synthetic table. That is the exact shape of this
 * repository's oldest defect — a capability with every part built and the last join missing — and the
 * lamps, the gamepad and the mission text each survived a full suite in it.
 */
describe('⚠️ the storm on the table it was written for', () => {
  /** Twenty balls, launched across a range of powers, left to run. The same run with and without. */
  const meanSpeed = (table: AuthoredTable): number => {
    let frames = 0;
    let total = 0;
    for (let seed = 0; seed < 20; seed++) {
      const physics = buildPhysics(table);
      const ball = physics.spawnBall();
      ball.direction = { x: 0, y: -1 };
      ball.speed = 200 + seed * 8;
      for (let i = 0; i < 1500; i++) {
        for (const { mover } of physics.movers) mover.advance(FRAME_SECONDS);
        physics.flare?.advance(FRAME_SECONDS);
        advanceFrame([ball], physics.context, FRAME_SECONDS);
        frames++;
        total += ball.speed;
      }
    }
    return total / frames;
  };

  test('a ball on `ion-storm` is measurably slower than the same ball with the flare taken away', () => {
    const stormy = meanSpeed(ION_STORM);
    const calm = meanSpeed({ ...ION_STORM, storm: undefined });

    // Measured at a fifth. The gate asks for a tenth, so the margin is headroom rather than a fit:
    // a change that halved the flare's effect would still be caught, and one that removed it entirely
    // — which is what an unadvanced flare or an unwired field amounts to — cannot pass at all.
    expect(stormy, `stormy ${stormy.toFixed(0)} vs calm ${calm.toFixed(0)}`).toBeLessThan(calm * 0.9);
  });
});

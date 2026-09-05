// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { advanceFrame, createBall } from '../app/js/physics/step.js';
import { createEdgeManager } from '../app/js/physics/grid.js';
import {
  deriveFlipper, createFlipper, setFlipperMotion, type Flipper,
} from '../app/js/physics/flipper.js';

/**
 * ⚠️ THE FLIPPER IS STEPPED INSIDE THE FRAME, NOT BESIDE IT.
 *
 * `pb::simulate_ball` computes each ball's substeps AND each flipper's in the same pass, takes the
 * larger count for both, and inside every substep moves the balls first and then the flippers. That
 * interleaving is the whole reason a fast flipper can catch a fast ball: run the two loops one after
 * the other instead and the ball crosses the swept area between them.
 *
 * So `advanceFrame` owns the flippers. A separate `stepFlippers()` next to it would have been simpler
 * to write and would have been a different simulation.
 */

function horizontalFlipper(): Flipper {
  // Pivot at (0,0), tip at (10,0), sweeping up to (0,10). The A face is the one that sweeps.
  return createFlipper(deriveFlipper({
    pivot: { x: 0, y: 0 }, tipAtRest: { x: 10, y: 0 }, tipExtended: { x: 0, y: 10 },
    baseRadius: 2, tipRadius: 1, extendTime: 0.1, retractTime: 0.2,
    collisionMult: 2, elasticity: 0.6, smoothness: 0.1, collisionOffset: 0,
  }));
}

const emptyContext = (flippers: Flipper[] = []) => ({
  grid: createEdgeManager(-50, -50, 100, 100),
  fieldEffects: (_b: unknown, d: { x: number; y: number }) => { d.x = 0; d.y = 0; },
  flippers,
});

describe('a flipper stepped by the frame', () => {
  test('a still flipper leaves a resting ball alone', () => {
    const flipper = horizontalFlipper();
    const ball = createBall({ radius: 1, position: { x: 5, y: 1.6 }, direction: { x: 0, y: 1 }, speed: 0 });

    advanceFrame([ball], emptyContext([flipper]), 1 / 60);

    expect(ball.speed).toBe(0);
  });

  test('⚠️ and an extending one KICKS it', () => {
    // The point of the whole exercise. Before this, `physics/flipper` was an island: fully ported,
    // fully tested, and reachable from nothing — so every table in the catalogue had flippers the
    // player could not move and the ball could only bounce off.
    const flipper = horizontalFlipper();
    const ball = createBall({ radius: 1, position: { x: 5, y: 1.6 }, direction: { x: 0, y: 1 }, speed: 0 });

    setFlipperMotion(flipper, 'extending');
    advanceFrame([ball], emptyContext([flipper]), 1 / 60);

    expect(ball.speed).toBeGreaterThan(0);
  });

  test('the swing advances by itself, frame after frame, and then stops', () => {
    const flipper = horizontalFlipper();
    setFlipperMotion(flipper, 'extending');

    for (let i = 0; i < 60 && flipper.motion !== 'still'; i++) {
      advanceFrame([], emptyContext([flipper]), 1 / 60);
    }

    expect(flipper.currentAngle).toBeCloseTo(flipper.angleMax, 9);
    expect(flipper.motion).toBe('still');
  });

  test('and a table with no flippers still steps', () => {
    // `flippers` is optional: every test written before this one passes a context without it, and a
    // table under construction may have none.
    const ball = createBall({ radius: 1, position: { x: 0, y: 0 }, direction: { x: 0, y: 1 }, speed: 10 });

    advanceFrame([ball], {
      grid: createEdgeManager(-50, -50, 100, 100),
      fieldEffects: (_b, d) => { d.x = 0; d.y = 0; },
    }, 1 / 60);

    expect(ball.position.y).toBeGreaterThan(0);
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  rotatePoint, rotateVector, createFlipper, setControlPoints,
  distanceToFlipper, flipperCollision, type Flipper,
} from '../app/js/physics/flipper.js';
import { NO_COLLISION, type Ray } from '../app/js/maths/maths.js';
import type { BallState } from '../app/js/physics/collision.js';

const ray = (ox: number, oy: number, dx: number, dy: number, max = 100): Ray =>
  ({ origin: { x: ox, y: oy }, direction: { x: dx, y: dy }, maxDistance: max, minDistance: 0.002, collisionMask: 0xffff });

/**
 * A horizontal flipper pointing along +X: pivot at (0,0), tip at (10,0). Face A is the top (y = +1),
 * face B the bottom (y = -1).
 *
 * THE ORDER EACH FACE IS DECLARED IN MATTERS: line collision is one-sided, and the top face only
 * collides with something arriving from above when it is declared from +X toward -X. Writing it the
 * intuitive way, (0,1) -> (10,1), makes the ball pass through the top of the flipper and strike the
 * bottom face two units further on. That is exactly what this test caught on its first run.
 */
function testFlipper(overrides: Partial<Flipper> = {}): Flipper {
  const f = createFlipper({
    rotOrigin: { x: 0, y: 0 },
    a1Src: { x: 10, y: 1 }, a2Src: { x: 0, y: 1 },
    b1Src: { x: 0, y: -1 }, b2Src: { x: 10, y: -1 },
    t1Src: { x: 10, y: 0 },
    baseRadius: 1, tipRadius: 1,
    angleMax: 1, extendSpeed: 10, retractSpeed: -10,
    collisionMult: 1, elasticity: 1, smoothness: 1,
    distanceDiv: 10,
  });
  Object.assign(f, overrides);
  setControlPoints(f, f.currentAngle);
  return f;
}

const ball = (dx: number, dy: number, speed: number): BallState =>
  ({ position: { x: 0, y: 0 }, direction: { x: dx, y: dy }, speed });

describe('flipper — rotation', () => {
  test('rotating 90 degrees about the origin takes (1,0) to (0,1)', () => {
    const p = { x: 1, y: 0 };

    rotatePoint(p, 1, 0, { x: 0, y: 0 });

    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(1);
  });

  test('rotates about the GIVEN origin, not the world origin', () => {
    const p = { x: 6, y: 5 };

    rotatePoint(p, 1, 0, { x: 5, y: 5 });

    expect(p.x).toBeCloseTo(5);
    expect(p.y).toBeCloseTo(6);
  });

  test('rotateVector really rotates — the original traces a FIGURE EIGHT', () => {
    // The upstream computes Y from the X it just overwrote. It documents the defect itself and notes
    // it only survives because the angle is always zero where it is called. Corrected here: it cannot
    // change current behavior (angle zero is the identity either way), and the authored table of
    // phase 8 may need a real angle.
    const v = { x: 1, y: 0 };

    rotateVector(v, Math.PI / 2);

    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(1); // with the original's defect this would be 0
  });
});

describe('flipper — the four collision pieces', () => {
  test('the top face returns the LINE perpendicular', () => {
    const f = testFlipper();

    const r = distanceToFlipper(f, ray(5, 5, 0, -1));

    expect(r.distance).toBeCloseTo(4);
    expect(Math.abs(r.direction.y)).toBeCloseTo(1); // vertical normal
    expect(r.direction.x).toBeCloseTo(0);
  });

  test('the TIP returns the RADIAL normal out of the tip circle', () => {
    // Coming from +X straight at the tip at (10,0) with radius 1: it hits at x=11 and the normal points
    // along +X.
    const f = testFlipper();

    const r = distanceToFlipper(f, ray(20, 0, -1, 0));

    expect(r.distance).toBeCloseTo(9);
    expect(r.direction.x).toBeCloseTo(1);
    expect(r.direction.y).toBeCloseTo(0);
  });

  test('when nothing is struck it returns NO_COLLISION', () => {
    const f = testFlipper();

    expect(distanceToFlipper(f, ray(0, 50, 0, 1)).distance).toBe(NO_COLLISION);
  });
});

describe('flipper — the bounce', () => {
  test('a STILL flipper bounces with no kick at all', () => {
    const f = testFlipper({ motion: 'still' });
    const b = ball(0, -1, 10);
    distanceToFlipper(f, ray(5, 5, 0, -1));

    flipperCollision(f, b);

    expect(b.speed).toBeCloseTo(10);
  });

  test('hitting with the TIP sends the ball far further than hitting at the PIVOT', () => {
    // The heart of the flipper, out of one line: `v21 = |moveSpeed| * sqrt(distSq / divisorSq)`. The
    // tangential speed grows with radius, so the kick grows with distance from the pivot. Without it
    // the flipper would be a wall that moves.
    const atTip = testFlipper({ motion: 'extending', moveSpeed: 10 });
    const bTip = ball(0, -1, 10);
    distanceToFlipper(atTip, ray(9, 5, 0, -1));
    flipperCollision(atTip, bTip);

    const atPivot = testFlipper({ motion: 'extending', moveSpeed: 10 });
    const bPivot = ball(0, -1, 10);
    distanceToFlipper(atPivot, ray(2, 5, 0, -1));
    flipperCollision(atPivot, bPivot);

    expect(bTip.speed).toBeGreaterThan(bPivot.speed);
  });

  test('struck FROM BEHIND the flipper gives: elasticity falls with distance from the pivot', () => {
    // Face B is the back while the flipper extends. Far from the pivot it returns LESS energy — which
    // is what stops the ball being spat out when it hits the wrong side of a moving paddle.
    const near = testFlipper({ motion: 'extending', moveSpeed: 10 });
    const bNear = ball(0, 1, 10);
    distanceToFlipper(near, ray(2, -5, 0, 1));
    flipperCollision(near, bNear);

    const far = testFlipper({ motion: 'extending', moveSpeed: 10 });
    const bFar = ball(0, 1, 10);
    distanceToFlipper(far, ray(9, -5, 0, 1));
    flipperCollision(far, bFar);

    expect(bFar.speed).toBeLessThan(bNear.speed);
  });
});

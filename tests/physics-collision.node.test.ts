// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { basicCollision, type BallState } from '../app/js/physics/collision.js';

const ball = (dx: number, dy: number, speed: number): BallState =>
  ({ position: { x: 0, y: 0 }, direction: { x: dx, y: dy }, speed });

/** No boost: an unreachable threshold isolates the bounce from the bumper kick. */
const NO_BOOST = { threshold: 1e9, boost: 0 };

describe('basic collision — the anti-stick nudge', () => {
  test('the ball is repositioned 0.0005 PAST the contact point', () => {
    // Without that offset the ball sits exactly on the surface, the next frame detects it in collision
    // again, and it buzzes in place. It is the same trick every 2D engine uses, and the original does
    // it right here.
    const b = ball(0, -1, 10);

    basicCollision(b, { x: 10, y: 10 }, { x: 0, y: 1 }, { elasticity: 1, smoothness: 1, ...NO_BOOST });

    expect(b.position.x).toBeCloseTo(10);
    expect(b.position.y).toBeCloseTo(10.0005);
  });
});

describe('basic collision — the bounce', () => {
  test('elasticity 1 reverses the direction and keeps the speed', () => {
    const b = ball(0, -1, 10);

    basicCollision(b, { x: 0, y: 0 }, { x: 0, y: 1 }, { elasticity: 1, smoothness: 1, ...NO_BOOST });

    expect(b.direction.y).toBeCloseTo(1);
    expect(b.speed).toBeCloseTo(10);
  });

  test('elasticity 0.5 reverses the direction and takes half the speed', () => {
    const b = ball(0, -1, 10);

    const lost = basicCollision(b, { x: 0, y: 0 }, { x: 0, y: 1 }, { elasticity: 0.5, smoothness: 1, ...NO_BOOST });

    expect(b.direction.y).toBeCloseTo(1);
    expect(b.speed).toBeCloseTo(5);
    expect(lost).toBeCloseTo(10); // the return is the REBOUND speed, not what is left
  });

  test('a ball ALREADY leaving does not change direction, but still loses speed', () => {
    // A negative projection means both vectors point the same way. The original takes the magnitude and
    // carries on: the direction stays, the energy loss happens. Ignoring the case would let the ball
    // gain energy grazing a surface it was already leaving.
    const b = ball(0, 1, 10);

    basicCollision(b, { x: 0, y: 0 }, { x: 0, y: 1 }, { elasticity: 0.5, smoothness: 1, ...NO_BOOST });

    expect(b.direction.y).toBeCloseTo(1);
    expect(b.speed).toBeCloseTo(5);
  });
});

describe('basic collision — the bumper kick', () => {
  test('above the threshold, the boost ACCELERATES the ball', () => {
    const b = ball(0, -1, 10);

    basicCollision(b, { x: 0, y: 0 }, { x: 0, y: 1 }, { elasticity: 1, smoothness: 1, threshold: 1, boost: 20 });

    expect(b.speed).toBeCloseTo(30); // 10 back plus 20 of boost
    expect(b.direction.y).toBeCloseTo(1);
  });

  test('below the threshold the boost stays out — which is why a bumper only answers a hard hit', () => {
    const b = ball(0, -1, 10);

    basicCollision(b, { x: 0, y: 0 }, { x: 0, y: 1 }, { elasticity: 1, smoothness: 1, threshold: 100, boost: 20 });

    expect(b.speed).toBeCloseTo(10);
  });
});

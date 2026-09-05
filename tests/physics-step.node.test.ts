// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { advanceFrame, createBall, type Ball, type StepContext } from '../app/js/physics/step.js';
import { createEdgeManager, type Edge } from '../app/js/physics/grid.js';
import { NO_COLLISION } from '../app/js/maths/maths.js';

const RADIUS = 0.25; // half radius 0.125; max speed 50

function context(force: { x: number; y: number } = { x: 0, y: 0 }): StepContext {
  return {
    grid: createEdgeManager(0, 0, 100, 150),
    fieldEffects: (_b, destination) => { destination.x = force.x; destination.y = force.y; },
  };
}

const ballAt = (x: number, y: number, dx: number, dy: number, speed: number): Ball =>
  createBall({ radius: RADIUS, position: { x, y }, direction: { x: dx, y: dy }, speed });

describe('step — frame setup', () => {
  test('a SLOW ball has its timestep pinned to 0.01', () => {
    // Below 0.8 speed the original clips the time. It is what stops a nearly stationary ball crossing
    // an edge in a single large jump when the frame runs long.
    const b = ballAt(50, 50, 1, 0, 0.5);

    advanceFrame([b], context(), 0.1);

    expect(b.timeDelta).toBe(0.01);
  });

  test('a FAST ball uses the whole frame time', () => {
    const b = ballAt(50, 50, 1, 0, 5);

    advanceFrame([b], context(), 0.02);

    expect(b.timeDelta).toBe(0.02);
  });

  test('speed is capped at radius x 200', () => {
    const b = ballAt(50, 50, 1, 0, 9999);

    advanceFrame([b], context(), 0.001);

    expect(b.speed).toBe(RADIUS * 200);
  });

  test('an inactive ball does not move', () => {
    const b = ballAt(50, 50, 1, 0, 5);
    b.active = false;

    advanceFrame([b], context(), 0.02);

    expect(b.position.x).toBe(50);
  });
});

describe('step — force integration', () => {
  test('the field force ACCELERATES the ball, scaled by time', () => {
    // The direction is denormalized into a velocity, the force is added, and the magnitude of the
    // result becomes the new speed. That is how gravity enters: with no separate acceleration vector.
    const b = ballAt(50, 50, 1, 0, 10);

    advanceFrame([b], context({ x: 100, y: 0 }), 0.01);

    expect(b.speed).toBeCloseTo(11); // 10 + 100 * 0.01
  });

  test('a perpendicular force TURNS the ball', () => {
    const b = ballAt(50, 50, 1, 0, 10);

    advanceFrame([b], context({ x: 0, y: 1000 }), 0.01);

    expect(b.direction.y).toBeGreaterThan(0.5);
  });
});

describe('step — movement and collision', () => {
  test('with no collision the ball advances speed x time', () => {
    const b = ballAt(50, 50, 1, 0, 1);

    advanceFrame([b], context(), 0.01);

    expect(b.position.x).toBeCloseTo(50.01);
  });

  test('the edge is told the distance to it', () => {
    const ctx = context();
    let told: number | null = null;
    const wall: Edge = {
      active: true, collisionGroup: 0xffff,
      findCollisionDistance: () => 0.05,
      edgeCollision: (_b, distance) => { told = distance; },
    };
    ctx.grid.addEdge(ctx.grid.boxX(50), ctx.grid.boxY(50), wall);

    advanceFrame([ballAt(50, 50, 1, 0, 10)], ctx, 0.01);

    expect(told).toBeCloseTo(0.05);
  });

  test('a ball held by a component is not integrated by the grid', () => {
    // While the ball is inside a sink or a kicker, the component moves it. The grid must not touch it:
    // if it did, the ball would climb out of the hole on its own.
    const ctx = context({ x: 1000, y: 0 });
    const b = ballAt(50, 50, 1, 0, 10);
    let called = false;
    b.component = { fieldEffect: () => { called = true; } };

    advanceFrame([b], ctx, 0.01);

    expect(called).toBe(true);
    expect(b.position.x).toBe(50);
    expect(b.speed).toBe(10);
  });
});

describe('step — substeps', () => {
  /** How many times the table was queried in one frame. */
  function countQueries(speed: number, timeDelta: number): number {
    const ctx = context();
    let queries = 0;
    const watcher: Edge = {
      active: true, collisionGroup: 0xffff,
      findCollisionDistance: () => { queries++; return NO_COLLISION; },
      edgeCollision: () => {},
    };
    for (let bx = 0; bx < 10; bx++) ctx.grid.addEdge(bx, ctx.grid.boxY(50), watcher);
    advanceFrame([ballAt(5, 50, 1, 0, speed)], ctx, timeDelta);
    return queries;
  }

  test('the table is queried once per HALF RADIUS traveled', () => {
    // The ball never travels more than half a radius without being tested: that is what stops a fast
    // projectile passing through a thin wall between two frames. Speed 20 over 0.01 is 0.2 of distance;
    // 0.2 / 0.125 is two steps.
    expect(countQueries(20, 0.01)).toBe(2);
  });

  test('the SPEED CAP also limits the number of substeps', () => {
    // Asking for 9999 does not produce 9999 of distance: speed is capped at radius x 200 = 50, the
    // distance becomes 0.5, and that is four steps. The cap is what stops per-frame cost growing
    // without limit — and this is the arithmetic I got wrong writing the test before reading the value.
    expect(countQueries(9999, 0.01)).toBe(4);
  });
});

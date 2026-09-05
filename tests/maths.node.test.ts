// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  NO_COLLISION, cross, dot, normalize2d,
  rayIntersectCircle, lineInit, rayIntersectLine,
} from '../app/js/maths/maths.js';

const ray = (ox: number, oy: number, dx: number, dy: number, max = 100, min = 0) =>
  ({ origin: { x: ox, y: oy }, direction: { x: dx, y: dy }, maxDistance: max, minDistance: min, collisionMask: 0 });

describe('maths — vectors', () => {
  test('the 2D cross product is X1*Y2 - Y1*X2, and its sign is what says which side', () => {
    expect(cross({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(1);
    expect(cross({ x: 0, y: 1 }, { x: 1, y: 0 })).toBe(-1);
  });

  test('normalising returns the PREVIOUS magnitude and leaves the vector unit length', () => {
    const v = { x: 3, y: 4 };

    expect(normalize2d(v)).toBe(5);
    expect(v).toEqual({ x: 0.6, y: 0.8 });
  });

  test('normalising a zero vector does not divide by zero', () => {
    const v = { x: 0, y: 0 };

    expect(normalize2d(v)).toBe(0);
    expect(v).toEqual({ x: 0, y: 0 });
  });

  test('dot product', () => {
    expect(dot({ x: 2, y: 3 }, { x: 4, y: 5 })).toBe(23);
  });
});

describe('maths — ray against circle', () => {
  const circle = (cx: number, cy: number, r: number) => ({ center: { x: cx, y: cy }, radiusSq: r * r });

  test('hits the FIRST intersection, not the second', () => {
    // Radius 2 at (5,0), ray from the origin: enters at x=3 and leaves at x=7.
    expect(rayIntersectCircle(ray(0, 0, 1, 0), circle(5, 0, 2))).toBeCloseTo(3);
  });

  test('pointing the other way, no hit', () => {
    expect(rayIntersectCircle(ray(0, 0, -1, 0), circle(5, 0, 2))).toBe(NO_COLLISION);
  });

  test('passing alongside, no hit', () => {
    expect(rayIntersectCircle(ray(0, 0, 1, 0), circle(5, 5, 1))).toBe(NO_COLLISION);
  });

  test('an origin INSIDE the circle returns a NEGATIVE distance — that is how the ball is pushed out', () => {
    // Without it a ball that already penetrated would never leave: the nearest positive intersection is
    // behind it. The negative sign is the instruction to back out.
    expect(rayIntersectCircle(ray(0, 0, 1, 0), circle(0, 0, 2))).toBeCloseTo(-2);
  });

  test('inside the circle but MOVING AWAY from the centre, no hit', () => {
    // `tca < 0` cuts out before the inside test. Deliberate in the original: whatever is already
    // leaving does not get pushed again.
    expect(rayIntersectCircle(ray(1, 0, 1, 0), circle(0, 0, 2))).toBe(NO_COLLISION);
  });

  test('a hit beyond the maximum distance does not count', () => {
    expect(rayIntersectCircle(ray(0, 0, 1, 0), circle(5, 0, 2))).toBeCloseTo(3);
    expect(rayIntersectCircle(ray(0, 0, 1, 0, 2), circle(5, 0, 2))).toBe(NO_COLLISION);
  });
});

describe('maths — line init', () => {
  test('the perpendicular is the CLOCKWISE one', () => {
    const l = lineInit(0, 0, 10, 0);

    expect(l.direction).toEqual({ x: 1, y: 0 });
    expect(l.perpendicular).toEqual({ x: 0, y: -1 });
  });

  test('a near-vertical line zeroes the X direction and measures the segment along Y', () => {
    // Without that snap to zero, the `direction.x !== 0` test in `rayIntersectLine` would use the X
    // coordinate of a vertical line — where every point shares the same X — and the whole segment
    // would collapse to a point. The wall would then collide at any height.
    const l = lineInit(3, 0, 3, 10);

    expect(l.direction.x).toBe(0);
    expect([l.minCoord, l.maxCoord]).toEqual([0, 10]);
  });

  test('a horizontal line measures the segment along X', () => {
    const l = lineInit(10, 0, 0, 0);

    expect([l.minCoord, l.maxCoord]).toEqual([0, 10]);
  });
});

describe('maths — ray against line', () => {
  // A line from (10,0) to (0,0): direction (-1,0). The order it was DECLARED in decides which face collides.
  const wall = () => lineInit(10, 0, 0, 0);

  test('hits when arriving at the facing side', () => {
    const l = wall();

    expect(rayIntersectLine(ray(5, 5, 0, -1), l)).toBeCloseTo(5);
    expect(l.rayIntersect.x).toBeCloseTo(5);
    expect(l.rayIntersect.y).toBeCloseTo(0);
  });

  test('arriving at the BACK face it passes through — the line is one-sided', () => {
    // Not a defect: it is what lets the original use segments as one-way gates, and what stops the
    // ball being trapped when it penetrates a wall by a frame.
    expect(rayIntersectLine(ray(5, -5, 0, 1), wall())).toBe(NO_COLLISION);
  });

  test('an intersection outside the SEGMENT does not count', () => {
    // It crosses the infinite line at x=15, but the segment only runs from 0 to 10.
    expect(rayIntersectLine(ray(15, 5, 0, -1), wall())).toBe(NO_COLLISION);
  });

  test('a hit beyond the maximum distance does not count', () => {
    expect(rayIntersectLine(ray(5, 5, 0, -1, 2), wall())).toBe(NO_COLLISION);
  });

  test('the minimum distance allows a slightly NEGATIVE hit — the penetration tolerance', () => {
    // Ball half a pixel below the wall: without the tolerance it would fall straight through.
    expect(rayIntersectLine(ray(5, -0.1, 0, -1, 100, 1), wall())).toBeCloseTo(-0.1);
  });
});

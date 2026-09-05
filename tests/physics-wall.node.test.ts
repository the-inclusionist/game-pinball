// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { installWall } from '../app/js/physics/wall.js';
import type { Component, CircleEdge, LineEdge } from '../app/js/physics/edges.js';
import type { Ray } from '../app/js/maths/maths.js';

const component: Component = { collision: () => {} };

const ray = (ox: number, oy: number, dx: number, dy: number, max = 100): Ray =>
  ({ origin: { x: ox, y: oy }, direction: { x: dx, y: dy }, maxDistance: max, minDistance: 0.002, collisionMask: 0xffff });

const lines = (es: readonly unknown[]) => es.filter((e) => (e as LineEdge).kind === 'line') as LineEdge[];
const circles = (es: readonly unknown[]) => es.filter((e) => (e as CircleEdge).kind === 'circle') as CircleEdge[];

/** A counter-clockwise square, CLOSED: the first point repeats at the end. */
const SQUARE = [5, 0, 0, 10, 0, 10, 10, 0, 10, 0, 0];

describe('wall — circle (type 1)', () => {
  test('reads center and radius, and the offset ADDS to the radius', () => {
    // Inflating the wall by the ball's radius is what lets the ball be treated as a point.
    const [e] = installWall([1, 5, 7, 3], { component, offset: 2 });

    const c = e as CircleEdge;
    expect(c.kind).toBe('circle');
    expect(c.center).toEqual({ x: 5, y: 7 });
    expect(c.radius).toBe(5); // 3 + 2
  });
});

describe('wall — line (type 2)', () => {
  test('reads the two points', () => {
    const [e] = installWall([2, 10, 0, 0, 0], { component, offset: 0 });

    const l = e as LineEdge;
    expect(l.kind).toBe('line');
    expect([l.x0, l.y0, l.x1, l.y1]).toEqual([10, 0, 0, 0]);
  });

  test('the offset pushes the line along its perpendicular', () => {
    const [e] = installWall([2, 10, 0, 0, 0], { component, offset: 2 });

    // The line from (10,0) to (0,0) has perpendicular (0,1): it rises by 2, and a ray from above finds
    // it 2 earlier.
    expect((e as LineEdge).findCollisionDistance(ray(5, 5, 0, -1))).toBeCloseTo(3);
  });
});

describe('wall — polygon (type N+1)', () => {
  test('a type value of N+1 becomes N sides out of N+1 points', () => {
    // The format CLOSES the figure by repeating the first point at the end. Reading N points instead of
    // N+1 would leave the last side without a destination, and the ball would escape through a gap a
    // whole side wide.
    const edges = installWall(SQUARE, { component, offset: 0 });

    expect(lines(edges)).toHaveLength(4);
    expect(circles(edges)).toHaveLength(0);
  });

  test('the four sides join the points in the order they were given', () => {
    const ls = lines(installWall(SQUARE, { component, offset: 0 }));

    expect([ls[0]!.x0, ls[0]!.y0, ls[0]!.x1, ls[0]!.y1]).toEqual([0, 0, 10, 0]);
    expect([ls[3]!.x0, ls[3]!.y0, ls[3]!.x1, ls[3]!.y1]).toEqual([0, 10, 0, 0]);
  });

  test('with an offset, every CONVEX corner gains a rounding circle', () => {
    // Pushing four sides outward opens the corners into gaps. The circle at the vertex closes the gap —
    // which is why it only exists when there is an offset.
    const edges = installWall(SQUARE, { component, offset: 2 });

    expect(lines(edges)).toHaveLength(4);
    expect(circles(edges)).toHaveLength(4);
    expect(circles(edges)[0]!.radius).toBeCloseTo(2.002); // offset x 1.001
  });

  test('an offset with the sign opposite to the winding rounds no corner at all', () => {
    // Pushing INWARD closes the corners instead of opening them: there is no gap to cover. The original
    // decides this by the sign of the cross product against the sign of the offset.
    const edges = installWall(SQUARE, { component, offset: -2 });

    expect(lines(edges)).toHaveLength(4);
    expect(circles(edges)).toHaveLength(0);
  });

  test('with no offset there is no corner to cover', () => {
    expect(circles(installWall(SQUARE, { component, offset: 0 }))).toHaveLength(0);
  });
});

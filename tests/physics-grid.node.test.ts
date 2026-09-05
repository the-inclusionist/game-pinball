// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { createEdgeManager, BOXES_X, BOXES_Y, type Edge } from '../app/js/physics/grid.js';
import { NO_COLLISION, type Ray } from '../app/js/maths/maths.js';

/** A fake edge that returns a fixed distance and COUNTS how often it was queried. */
function fakeEdge(distance: number, overrides: Partial<Edge> = {}) {
  let queries = 0;
  const e: Edge = {
    active: true,
    collisionGroup: 0xffff,
    findCollisionDistance: () => { queries++; return distance; },
    edgeCollision: () => {},
    ...overrides,
  };
  return { e, queries: () => queries };
}

const ray = (ox: number, oy: number, dx: number, dy: number, max = 100): Ray =>
  ({ origin: { x: ox, y: oy }, direction: { x: dx, y: dy }, maxDistance: max, minDistance: 0, collisionMask: 0xffff });

/** A 100x150 table at the origin: each box is 10x10. */
const grid = () => createEdgeManager(0, 0, 100, 150);

describe('grid — geometry', () => {
  test('the grid is FIXED at 10x15 boxes, not derived from the table size', () => {
    // True for any table: the original pins 10 and 15 in the constructor. A larger table gets larger
    // boxes, not more of them — which is why per-query cost does not grow with the table.
    expect([BOXES_X, BOXES_Y]).toEqual([10, 15]);
    const g = grid();
    expect([g.advanceX, g.advanceY]).toEqual([10, 10]);
  });

  test('maps a coordinate to a box by flooring', () => {
    const g = grid();

    expect(g.boxX(0)).toBe(0);
    expect(g.boxX(9.99)).toBe(0);
    expect(g.boxX(10)).toBe(1);
    expect(g.boxY(145)).toBe(14);
  });

  test('a coordinate OUTSIDE the table is clamped to the border box, not rejected', () => {
    // The ball leaves the table in normal situations (the drain, the plunger lane). Clamping rather
    // than refusing is what keeps the border edges being tested while it is out there.
    const g = grid();

    expect(g.boxX(-500)).toBe(0);
    expect(g.boxX(99999)).toBe(9);
    expect(g.boxY(-1)).toBe(0);
    expect(g.boxY(99999)).toBe(14);
  });
});

describe('grid — collision search', () => {
  test('finds the edge in the box the ray is in', () => {
    const g = grid();
    const { e } = fakeEdge(7);
    g.addEdge(0, 0, e);

    const r = g.findCollisionDistance(ray(5, 5, 1, 0, 3));

    expect(r.distance).toBe(7);
    expect(r.edge).toBe(e);
  });

  test('the NEAREST edge wins, even when it sits in a later box', () => {
    const g = grid();
    const far = fakeEdge(40);
    const near = fakeEdge(12);
    g.addEdge(0, 0, far.e);
    g.addEdge(1, 0, near.e);

    expect(g.findCollisionDistance(ray(5, 5, 1, 0, 50)).edge).toBe(near.e);
  });

  test('an edge occupying TWO boxes is queried ONCE', () => {
    // A long wall is registered in every box it crosses. Without the processed mark, a ray spanning
    // three boxes would pay three times for the same wall — and the cost would grow with the wall's
    // length, which is exactly what the grid exists to avoid.
    const g = grid();
    const { e, queries } = fakeEdge(40);
    g.addEdge(0, 0, e);
    g.addEdge(1, 0, e);
    g.addEdge(2, 0, e);

    g.findCollisionDistance(ray(5, 5, 1, 0, 50));

    expect(queries()).toBe(1);
  });

  test('the processed mark does NOT survive into the next query', () => {
    // It is cleared at the end of each search. If it leaked, the edge would be invisible forever after
    // the first frame — and the symptom would be the ball passing through a wall that used to work.
    const g = grid();
    const { e, queries } = fakeEdge(7);
    g.addEdge(0, 0, e);

    g.findCollisionDistance(ray(5, 5, 1, 0, 3));
    g.findCollisionDistance(ray(5, 5, 1, 0, 3));

    expect(queries()).toBe(2);
  });

  test('an INACTIVE edge is not queried', () => {
    const g = grid();
    const { e, queries } = fakeEdge(7, { active: false });
    g.addEdge(0, 0, e);

    expect(g.findCollisionDistance(ray(5, 5, 1, 0, 3)).distance).toBe(NO_COLLISION);
    expect(queries()).toBe(0);
  });

  test('an edge in another collision group is not queried', () => {
    const g = grid();
    const { e, queries } = fakeEdge(7, { collisionGroup: 0b0010 });
    g.addEdge(0, 0, e);

    const r = { ...ray(5, 5, 1, 0, 3), collisionMask: 0b0001 };
    expect(g.findCollisionDistance(r).distance).toBe(NO_COLLISION);
    expect(queries()).toBe(0);
  });

  test('an edge already hit this frame is not queried again', () => {
    const g = grid();
    const { e, queries } = fakeEdge(7);
    g.addEdge(0, 0, e);

    g.findCollisionDistance(ray(5, 5, 1, 0, 3), (edge) => edge === e);

    expect(queries()).toBe(0);
  });

  test('a diagonal ray visits the boxes it actually crosses', () => {
    const g = grid();
    const onTheDiagonal = fakeEdge(99);
    const offThePath = fakeEdge(1);
    g.addEdge(2, 2, onTheDiagonal.e);
    g.addEdge(9, 0, offThePath.e);

    // From (5,5) to (35,35): through boxes (0,0), (1,1), (2,2)... and never (9,0).
    const d = Math.SQRT1_2;
    g.findCollisionDistance(ray(5, 5, d, d, 45));

    expect(onTheDiagonal.queries()).toBe(1);
    expect(offThePath.queries()).toBe(0);
  });
});

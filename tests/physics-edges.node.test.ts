// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { createLine, createCircle, offsetLine, type Component } from '../app/js/physics/edges.js';
import { createEdgeManager, placeLineInGrid, placeCircleInGrid, type Edge } from '../app/js/physics/grid.js';
import { NO_COLLISION, type Ray, type Vector2 } from '../app/js/maths/maths.js';

const ray = (ox: number, oy: number, dx: number, dy: number, max = 100): Ray =>
  ({ origin: { x: ox, y: oy }, direction: { x: dx, y: dy }, maxDistance: max, minDistance: 0.002, collisionMask: 0xffff });

/** A component that only records what it received. */
function spy() {
  const received: { position: Vector2; direction: Vector2; distance: number }[] = [];
  const c: Component = {
    collision: (_ball, position, direction, distance) => {
      received.push({ position: { ...position }, direction: { ...direction }, distance });
    },
  };
  return { c, received };
}

const anyBall = { position: { x: 0, y: 0 }, direction: { x: 0, y: -1 }, speed: 1 };

describe('edges — line', () => {
  test('returns the ray distance to the segment', () => {
    const l = createLine({ component: spy().c, start: { x: 10, y: 0 }, end: { x: 0, y: 0 } });

    expect(l.findCollisionDistance(ray(5, 5, 0, -1))).toBeCloseTo(5);
  });

  test('on collision it hands the component the contact point and the PERPENDICULAR', () => {
    const { c, received } = spy();
    const l = createLine({ component: c, start: { x: 10, y: 0 }, end: { x: 0, y: 0 } });
    l.findCollisionDistance(ray(5, 5, 0, -1)); // fills in the intersection, as the original does

    l.edgeCollision(anyBall, 5);

    expect(received[0]!.position).toEqual({ x: 5, y: 0 });
    expect(received[0]!.direction.y).toBeCloseTo(1); // normal pointing up
    expect(received[0]!.distance).toBe(5);
  });

  test('offsetting moves the line along ITS OWN perpendicular', () => {
    // This is how a wall is inflated by the ball's radius: instead of testing the ball as a circle, the
    // original pushes the wall outward and treats the ball as a point. One calculation less per frame,
    // per wall, per ball.
    const l = createLine({ component: spy().c, start: { x: 10, y: 0 }, end: { x: 0, y: 0 } });

    offsetLine(l, 2);

    // The clockwise perpendicular of (-1,0) is (0,1): the line rises by 2.
    expect(l.findCollisionDistance(ray(5, 5, 0, -1))).toBeCloseTo(3);
  });
});

describe('edges — circle', () => {
  test('returns the ray distance to the circle', () => {
    const c = createCircle({ component: spy().c, center: { x: 5, y: 0 }, radius: 2 });

    expect(c.findCollisionDistance(ray(0, 0, 1, 0))).toBeCloseTo(3);
  });

  test('on collision it hands over the RADIAL normal out of the centre', () => {
    const { c, received } = spy();
    const circle = createCircle({ component: c, center: { x: 5, y: 0 }, radius: 2 });
    const ball = { position: { x: 0, y: 0 }, direction: { x: 1, y: 0 }, speed: 1 };

    circle.edgeCollision(ball, 3);

    expect(received[0]!.position).toEqual({ x: 3, y: 0 });
    expect(received[0]!.direction.x).toBeCloseTo(-1); // from the centre (5,0) to the contact (3,0)
  });
});

describe('grid — edge registration', () => {
  /** How many boxes contain this edge. */
  function boxesWith(g: ReturnType<typeof createEdgeManager>, e: Edge): number {
    let n = 0;
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 15; y++) {
        if (g.edgesInBox(x, y).includes(e)) n++;
      }
    }
    return n;
  }

  test('a line is registered in EVERY box it crosses', () => {
    // If it only stayed in the box at its end, the ball would pass through the middle of the wall.
    const g = createEdgeManager(0, 0, 100, 150); // 10x10 boxes
    const l = createLine({ component: spy().c, start: { x: 5, y: 5 }, end: { x: 95, y: 5 } });

    placeLineInGrid(g, l);

    expect(boxesWith(g, l)).toBe(10);
  });

  test('a circle is registered in the boxes it actually touches', () => {
    const g = createEdgeManager(0, 0, 100, 150);
    const c = createCircle({ component: spy().c, center: { x: 15, y: 15 }, radius: 3 });

    placeCircleInGrid(g, c);

    // Radius 3 about (15,15) sits entirely inside box (1,1).
    expect(g.edgesInBox(1, 1)).toContain(c);
    expect(g.edgesInBox(0, 0)).not.toContain(c);
  });

  test('a large circle covers the neighbouring boxes', () => {
    const g = createEdgeManager(0, 0, 100, 150);
    const c = createCircle({ component: spy().c, center: { x: 15, y: 15 }, radius: 8 });

    placeCircleInGrid(g, c);

    expect(g.edgesInBox(0, 1)).toContain(c);
    expect(g.edgesInBox(2, 1)).toContain(c);
  });

  test('the DIAGONAL box stays out, even though it is inside the bounding square', () => {
    // The case that separates a real circle test from a bounding-box test — the only one where the two
    // disagree. With 10x10 boxes, centre at (18,18), radius 2.2:
    //   · the bounding square runs 15.8 to 20.2, so it reaches boxes 1 and 2 on both axes;
    //   · box (2,1) is 2 away from the centre (along the x=20 edge) and IS included;
    //   · box (2,2) only meets it at the corner (20,20), which is 2.83 away — and stays OUT.
    // The first version of this test used centre (17,17) with radius 2, whose bounding square fits
    // inside a single box: the diagonal box was never even visited, and the test passed with the
    // distance check deleted. Mutation testing showed that, not re-reading it.
    const g = createEdgeManager(0, 0, 100, 150);
    const c = createCircle({ component: spy().c, center: { x: 18, y: 18 }, radius: 2.2 });

    placeCircleInGrid(g, c);

    expect(g.edgesInBox(1, 1)).toContain(c);
    expect(g.edgesInBox(2, 1)).toContain(c);
    expect(g.edgesInBox(1, 2)).toContain(c);
    expect(g.edgesInBox(2, 2)).not.toContain(c);
  });

  test('a registered edge is found by the collision search', () => {
    const g = createEdgeManager(0, 0, 100, 150);
    const l = createLine({ component: spy().c, start: { x: 95, y: 30 }, end: { x: 5, y: 30 } });
    placeLineInGrid(g, l);

    const r = g.findCollisionDistance(ray(50, 35, 0, -1, 10));

    expect(r.edge).toBe(l);
    expect(r.distance).toBeCloseTo(5);
    expect(r.distance).not.toBe(NO_COLLISION);
  });
});

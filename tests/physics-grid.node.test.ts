// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  createEdgeManager, insertFieldSquare, BOXES_X, BOXES_Y, type Edge,
} from '../app/js/physics/grid.js';
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

/**
 * ⚠️ A FIELD IS REGISTERED OVER A RECTANGLE OF BOXES, AND ONLY THE BALL'S OWN BOX IS ASKED.
 *
 * `TEdgeManager::FieldEffects` reads the field list of the ONE box the ball is standing in, and asks
 * each field whose collision group intersects the ball's mask. That is what keeps a ramp's gravity to
 * the part of the table the ramp is on — with a flat list of every field on the table, a ball anywhere
 * would feel every ramp at once.
 */
describe('the fields a box holds', () => {
  const field = (collisionGroup: number, tag: string) => ({
    collisionGroup,
    tag,
    fieldEffect: (_ball: unknown, destination: { x: number; y: number }) => {
      destination.x = 1;
      destination.y = 0;
      return true;
    },
  });

  test('a square puts the field in every box it touches, and in no other', () => {
    const grid = createEdgeManager(0, 0, 100, 150);
    const one = field(1, 'one');

    insertFieldSquare(grid, { xMin: 5, yMin: 5, xMax: 15, yMax: 5 }, one);

    // 100 wide over ten boxes is ten apiece; 150 tall over fifteen is ten apiece.
    expect(grid.fieldsInBox(0, 0)).toContain(one);
    expect(grid.fieldsInBox(1, 0)).toContain(one);
    expect(grid.fieldsInBox(2, 0)).not.toContain(one);
    expect(grid.fieldsInBox(0, 1)).not.toContain(one);
  });

  test('⚠️ only the ball’s OWN box is asked', () => {
    const grid = createEdgeManager(0, 0, 100, 150);
    const one = field(1, 'one');
    insertFieldSquare(grid, { xMin: 5, yMin: 5, xMax: 5, yMax: 5 }, one);
    const destination = { x: 0, y: 0 };

    grid.fieldEffects({ position: { x: 95, y: 145 }, collisionMask: 1 }, destination);

    expect(destination, 'the far corner of the table feels nothing').toEqual({ x: 0, y: 0 });
  });

  test('⚠️ and only the fields whose group the ball’s MASK carries', () => {
    // `ball->CollisionMask & field->CollisionGroup`. A free ball's mask is 1 and a ramp's group is 2,
    // so a ball that has not crossed onto the ramp never feels it — the mask IS which world the ball
    // is in.
    const grid = createEdgeManager(0, 0, 100, 150);
    const ramp = field(2, 'ramp');
    insertFieldSquare(grid, { xMin: 5, yMin: 5, xMax: 5, yMax: 5 }, ramp);
    const destination = { x: 0, y: 0 };

    grid.fieldEffects({ position: { x: 5, y: 5 }, collisionMask: 1 }, destination);
    expect(destination, 'a free ball is in world one').toEqual({ x: 0, y: 0 });

    grid.fieldEffects({ position: { x: 5, y: 5 }, collisionMask: 2 }, destination);
    expect(destination.x, 'and a ball on the ramp is in world two').toBe(1);
  });

  test('⚠️ every field in the box is ADDED, each with its own vector', () => {
    // `maths::vector_add(*dstVec, vec)` — and `vec` is declared once, outside the loop, upstream. A
    // field answering false leaves the previous field's value in it; this port zeroes per field for
    // the same reason `TEdgeManager::FieldEffects`' callers do.
    const grid = createEdgeManager(0, 0, 100, 150);
    insertFieldSquare(grid, { xMin: 5, yMin: 5, xMax: 5, yMax: 5 }, field(1, 'a'));
    insertFieldSquare(grid, { xMin: 5, yMin: 5, xMax: 5, yMax: 5 }, field(1, 'b'));
    const destination = { x: 0, y: 0 };

    grid.fieldEffects({ position: { x: 5, y: 5 }, collisionMask: 1 }, destination);

    expect(destination.x, 'both of them').toBe(2);
  });
});

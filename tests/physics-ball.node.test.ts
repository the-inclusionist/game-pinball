// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { createCollisionMemory, COLLISION_LIMIT } from '../app/js/physics/ball.js';
import type { Edge } from '../app/js/physics/grid.js';

const edge = (n: number): Edge =>
  ({ active: true, collisionGroup: 0xffff, findCollisionDistance: () => n, edgeCollision: () => {} });

describe('ball — memory of edges already hit this frame', () => {
  test('remembers what it hit', () => {
    const m = createCollisionMemory();
    const e = edge(1);

    expect(m.alreadyHit(e)).toBe(false);
    m.record(e);
    expect(m.alreadyHit(e)).toBe(true);
  });

  test('holds up to sixteen', () => {
    const m = createCollisionMemory();
    const edges = Array.from({ length: COLLISION_LIMIT }, (_, i) => edge(i));

    edges.forEach((e) => m.record(e));

    expect(edges.every((e) => m.alreadyHit(e))).toBe(true);
  });

  test('on the seventeenth it DISCARDS the oldest eight and restarts at nine', () => {
    // Not an ordinary ring buffer: the original copies the top eight down, puts the new one at index 8
    // and resets the count to 9. The effect is a memory that FORGETS HALF at once instead of forgetting
    // the oldest each time. Transcribed because the physics depends on how much it remembers:
    // forgetting too early lets the ball strike the same edge twice within one frame.
    const m = createCollisionMemory();
    const edges = Array.from({ length: 17 }, (_, i) => edge(i));

    edges.forEach((e) => m.record(e));

    // The first eight are gone.
    expect(edges.slice(0, 8).some((e) => m.alreadyHit(e))).toBe(false);
    // The next eight stayed, and the seventeenth got in.
    expect(edges.slice(8, 16).every((e) => m.alreadyHit(e))).toBe(true);
    expect(m.alreadyHit(edges[16]!)).toBe(true);
  });

  test('forgetting clears everything', () => {
    const m = createCollisionMemory();
    const e = edge(1);
    m.record(e);

    m.forget();

    expect(m.alreadyHit(e)).toBe(false);
  });
});

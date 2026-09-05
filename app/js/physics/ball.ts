// SPDX-License-Identifier: AGPL-3.0-or-later
// physics/ball — the ball's memory of edges it has already hit. Port of `TBall::not_again` and
// `TBall::already_hit`.
//
// WHY IT EXISTS: within one frame the ball can be tested against the same edge more than once, because
// the collision response moves it and the simulation continues with the time that is left. Without the
// memory a wall would be struck twice in a frame and the ball would leave with double the impulse.
//
// AND THE EVICTION IS DELIBERATELY ODD. It is not a ring buffer: when the sixteen slots fill, the
// original copies the TOP EIGHT down to the base, puts the new edge at index 8 and resets the count to
// 9. It forgets HALF at once rather than forgetting the oldest each time.
//
// Transcribed as it stands, because the physics depends on HOW MUCH it remembers: forgetting too early
// restores the double bounce it exists to prevent, and remembering too long makes the ball pass through
// an edge it struck in an earlier, legitimate bounce.

import type { Edge } from './grid.js';

export const COLLISION_LIMIT = 16;
const SURVIVORS = 8;

export interface CollisionMemory {
  record(edge: Edge): void;
  alreadyHit(edge: Edge): boolean;
  /** Called on each new frame. */
  forget(): void;
}

export function createCollisionMemory(): CollisionMemory {
  const collisions: (Edge | null)[] = new Array(COLLISION_LIMIT).fill(null);
  let count = 0;

  return {
    record(edge: Edge): void {
      if (count < COLLISION_LIMIT) {
        collisions[count] = edge;
        count++;
        return;
      }
      // The half-eviction — see the header.
      for (let i = 0; i < SURVIVORS; i++) collisions[i] = collisions[i + SURVIVORS]!;
      collisions[SURVIVORS] = edge;
      count = SURVIVORS + 1;
    },

    alreadyHit(edge: Edge): boolean {
      // Linear scan, as in the original: there are at most sixteen, and a Set would cost more in
      // allocation than it saves in comparisons.
      for (let i = 0; i < count; i++) if (collisions[i] === edge) return true;
      return false;
    },

    forget(): void {
      count = 0;
    },
  };
}

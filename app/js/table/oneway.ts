// SPDX-License-Identifier: AGPL-3.0-or-later
// table/oneway — the one-way gate. Port of `TOneway`.
//
// ========================= TWO LINES ON THE SAME TWO POINTS =========================
// This is the cleverest small thing in the table. A one-way gate is built from ONE pair of points and
// TWO lines wound in opposite directions:
//
//   · the BLOCKING line, pt2 -> pt1, offset outward by the ball's radius — an ordinary wall;
//   · the PASSING line, pt1 -> pt2, offset inward by 0.8 of that radius.
//
// Line collision is one-sided (see `maths.rayIntersectLine`), so each line only answers a ball arriving
// from its own face. Approach from the blocked side and the first line bounces you. Approach from the
// other and the second line catches you — and instead of bouncing, the component lets you through.
//
// ========================= THE 0.8 IS NOT DECORATION =========================
// The passing line sits at 0.8 of the offset, so the two lines are NOT coincident: the passing side is
// slightly nearer. The ball therefore meets the pass before it could ever reach the bounce, which is
// what stops a ball arriving at a shallow angle from clipping the wrong line and being thrown back
// through a gate it had already passed.
//
// ========================= PASSING THROUGH IS NOT A COLLISION =========================
// The component moves the ball to the contact point, marks the edge as already-hit so the same frame
// does not meet it again, and returns. It never touches direction or speed. The step loop carries on
// from there with the distance that is left, so the ball crosses the gate within one frame.

import type { Vector2 } from '../maths/maths.js';
import type { Edge } from '../physics/grid.js';
import type { CollisionComponent } from './collision-component.js';
import type { BallState } from '../physics/collision.js';

/** What the one-way needs from the ball beyond its physical state. */
export interface BallWithMemory extends BallState {
  memory: { record(edge: Edge): void };
}

export interface OnewayOptions {
  /** The line the ball may cross. Everything else bounces. */
  readonly passingEdge: Edge;
  /** Bounce behavior for the blocking side, shared with every other component. */
  readonly bounce: CollisionComponent;
  readonly table: { tiltLocked: boolean };
  readonly passSoundId?: number;
  readonly sound?: { play(soundId: number, ball: unknown): void };
  /** Called when the ball actually crosses. The mission logic counts crossings. */
  readonly onPass?: () => void;
}

export interface Oneway {
  collision(ball: unknown, position: Vector2, direction: Vector2, distance: number, edge: unknown): void;
}

export function createOneway(o: OnewayOptions): Oneway {
  return {
    collision(ball, position, direction, distance, edge): void {
      if (edge !== o.passingEdge) {
        o.bounce.collision(ball, position, direction, distance, edge);
        return;
      }

      const b = ball as BallWithMemory;
      // Mark it first: without this the ball, now sitting exactly on the line, meets it again in the
      // same frame and passes through twice — which would count the crossing twice as well.
      b.memory.record(o.passingEdge);
      b.position.x = position.x;
      b.position.y = position.y;

      // A TILTED TABLE STILL LETS THE BALL THROUGH — it just stops reacting. The pass is geometry; the
      // sound and the score are the table answering, and a tilted table has stopped answering.
      if (o.table.tiltLocked) return;

      if (o.passSoundId !== undefined) o.sound?.play(o.passSoundId, ball);
      o.onPass?.();
    },
  };
}

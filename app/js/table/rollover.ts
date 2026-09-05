// SPDX-License-Identifier: AGPL-3.0-or-later
// table/rollover — the lane the ball rolls over. Port of `TRollover`.
//
// ========================= A STATE MACHINE MADE OF LIVE EDGES =========================
// `build_walls` installs TWO sets of walls from two different float attributes, and gives them two
// different active flags:
//
//     install_wall(attribute 600, ..., &ActiveFlag,   ...);   // the ENTRY boundary, always live
//     install_wall(attribute 603, ..., &RolloverFlag, ...);   // the EXIT boundary, live only inside
//
// `RolloverFlag` starts clear, so the exit boundary does not exist until the ball has crossed the entry
// and set it. Crossing the exit clears it again, and the exit boundary vanishes.
//
// The whole "am I on the lane?" state is carried by WHICH EDGE SET THE COLLISION SEARCH CAN SEE. There
// is no inside/outside test anywhere, and no geometry is ever rebuilt — the same mechanism as the gate,
// used for a different purpose.
//
// ========================= ROLLING OVER IS NOT COLLIDING =========================
// Like the one-way, the component moves the ball to the contact point and marks the edge as
// already-hit, leaving direction and speed alone. A rollover is something the ball passes across.
//
// ========================= ONLY ENTERING SCORES =========================
// The sound and the notification fire on the branch where the flag was CLEAR — going in. Coming out is
// silent, and additionally switches the whole component off for a tenth of a second, so a ball hovering
// on the boundary cannot rattle the lane open and shut.

import type { Vector2 } from '../maths/maths.js';
import type { Edge } from '../physics/grid.js';
import type { SoundPlayer, TableState } from './collision-component.js';
import type { TimerService } from './bumper.js';
import type { BallState } from '../physics/collision.js';

/** How long the whole rollover stays deaf after the ball leaves. The original's literal 0.1. */
const DEAF_SECONDS = 0.1;

export interface RolloverBall extends BallState {
  memory: { record(edge: Edge): void };
}

export interface RolloverOptions {
  readonly table: TableState;
  readonly timer: TimerService;
  /** Live whenever the rollover itself is live. Crossing these takes the ball IN. */
  readonly entryEdges: readonly Edge[];
  /** Live only while the ball is on the lane. Crossing these takes it OUT. */
  readonly exitEdges: readonly Edge[];
  readonly enterSoundId?: number;
  readonly sound?: SoundPlayer;
  readonly setSprite?: (index: number) => void;
  /** The mission logic counts lane crossings. */
  readonly onEnter?: () => void;
}

export interface Rollover {
  collision(ball: unknown, position: Vector2, direction: Vector2, distance: number, edge: unknown): void;
  reset(): void;
  /** True while the ball is on the lane. */
  readonly inside: boolean;
}

export function createRollover(o: RolloverOptions): Rollover {
  let inside = false;

  const setInside = (value: boolean): void => {
    inside = value;
    for (const edge of o.exitEdges) edge.active = value;
    // Hidden while the ball is on it: the ball itself covers the sprite.
    o.setSprite?.(value ? -1 : 0);
  };

  const setLive = (value: boolean): void => {
    for (const edge of o.entryEdges) edge.active = value;
  };

  const rollover: Rollover = {
    get inside() { return inside; },

    collision(ball, position, _direction, _distance, edge): void {
      const b = ball as RolloverBall;
      // Pass through: position moves, direction and speed do not.
      b.position.x = position.x;
      b.position.y = position.y;
      b.memory.record(edge as Edge);

      // A TILTED TABLE STILL LETS THE BALL ACROSS and simply does not register it. Toggling on tilt
      // would leave the lane stuck open when the tilt cleared.
      if (o.table.tiltLocked) return;

      if (inside) {
        // Leaving. Go deaf briefly so a ball hovering on the boundary cannot rattle the lane.
        setLive(false);
        o.timer.set(DEAF_SECONDS, () => setLive(true));
      } else {
        if (o.enterSoundId !== undefined) o.sound?.play(o.enterSoundId, ball);
        o.onEnter?.();
      }

      setInside(!inside);
    },

    reset(): void {
      setLive(true);
      setInside(false);
    },
  };

  rollover.reset();
  return rollover;
}

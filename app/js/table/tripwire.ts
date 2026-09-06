// SPDX-License-Identifier: AGPL-3.0-or-later
// table/tripwire — the line the ball crosses without noticing. Port of `TTripwire`.
//
// ========================= IT IS A WALL RECORD WITH A COMPONENT THAT DOES NOT BOUNCE =========================
// `TTripwire` derives from `TRollover` with `createWall = true`, so its geometry comes from the
// ordinary wall loop like a bumper's or a rebounder's. Nothing about the RECORD says the ball may cross
// it; only the component does, and the whole of that component is four lines: move the ball to the
// contact point, mark the edge, play the soft-hit sound, tell control.
//
// So a table that installs the record and leaves the component to the default gets five lines the ball
// bounces off, and the skill shot becomes unplayable in a way nothing reports.
//
// ========================= AND IT INHERITS A LANE AND THEN THROWS THE LANE AWAY =========================
// `TRollover` keeps `RolloverFlag`, a second boundary and a tenth of a second of deafness, all so that
// only ENTERING counts. `TTripwire::Collision` overrides the lot: no flag, no second set, no deafness.
// Every crossing counts, in both directions, which is what makes it a trip wire and not a lane.

import type { Vector2 } from '../maths/maths.js';
import type { BallState } from '../physics/collision.js';
import type { Edge } from '../physics/grid.js';
import type { SoundPlayer, TableState } from './collision-component.js';
import { playSoundId } from './sound-id.js';

export interface TripwireBall extends BallState {
  memory: { record(edge: Edge): void };
}

export interface TripwireOptions {
  readonly table: TableState;
  /** Record 304 — the same field an ordinary wall uses for a graze. A wire has no voice of its own. */
  readonly softHitSoundId?: number;
  readonly sound?: SoundPlayer;
  /** `control::handler(ControlCollision, this)`. The skill shot counts these. */
  readonly onCross?: () => void;
}

export interface Tripwire {
  collision(ball: unknown, position: Vector2, direction: Vector2, distance: number, edge: unknown): void;
}

export function createTripwire(o: TripwireOptions): Tripwire {
  return {
    collision(ball, position, _direction, _distance, edge): void {
      const b = ball as TripwireBall;
      // Across, not off: the position moves and the direction and speed do not.
      b.position.x = position.x;
      b.position.y = position.y;
      b.memory.record(edge as Edge);

      // ⚠️ A TILTED TABLE STILL LETS THE BALL ACROSS. Tilt takes away the table's answer, not its
      // geometry — a wire that stopped passing the ball would become a wall the moment the game was
      // punishing the player, which is the opposite of what tilt does everywhere else.
      if (o.table.tiltLocked) return;

      playSoundId(o.sound, o.softHitSoundId, ball);
      o.onCross?.();
    },
  };
}

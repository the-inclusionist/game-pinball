// SPDX-License-Identifier: AGPL-3.0-or-later
// table/collision-component — the base every table component reacts through. Port of
// `TCollisionComponent::Collision` and `DefaultCollision`.
//
// The edges know geometry; this knows what a hit MEANS. Almost forty components inherit from it, and
// most of them do nothing more than this: bounce with their own elasticity and pick a sound by how hard
// the hit was.
//
// ========================= TILT MAKES THE TABLE DEAD, NOT JUST SILENT =========================
// When `tiltLocked` is set the original bounces with threshold 1e9 and boost 0 and returns early. That
// is two things at once: NO KICK — a bumper stops kicking, a flipper stops throwing — and NO SOUND. The
// ball keeps rolling on a table that has stopped answering, which is exactly the punishment tilt is.
// Handling only the sound would leave the bumpers still firing on a tilted table.

import { basicCollision, type BallState } from '../physics/collision.js';
import { NO_COLLISION, type Vector2 } from '../maths/maths.js';
import { playSoundId } from './sound-id.js';

/** Above this rebound speed a hit is audible at all. The original's literal 0.2. */
const AUDIBLE_REBOUND = 0.2;

/** What the component needs to know about the table it belongs to. */
export interface TableState {
  tiltLocked: boolean;
}

export interface SoundPlayer {
  play(soundId: number, ball: unknown): void;
}

export interface CollisionComponentOptions {
  readonly table: TableState;
  readonly elasticity: number;
  readonly smoothness: number;
  /** Rebound speed above which the boost applies and the hard sound plays. */
  readonly threshold: number;
  readonly boost: number;
  readonly hardHitSoundId?: number;
  readonly softHitSoundId?: number;
  readonly sound?: SoundPlayer;
}

export interface CollisionComponent {
  collision(ball: unknown, position: Vector2, direction: Vector2, distance: number, edge: unknown): void;
  /**
   * The same reaction, reporting whether the hit was HARD. Subclasses use that boolean to decide
   * whether the hit counts — a target only registers on a hard hit.
   */
  defaultCollision(ball: BallState, position: Vector2, direction: Vector2): boolean;
}

export function createCollisionComponent(o: CollisionComponentOptions): CollisionComponent {
  function react(ball: BallState, position: Vector2, direction: Vector2): boolean {
    if (o.table.tiltLocked) {
      // Dead table: bounce and nothing else. See this module's header.
      basicCollision(ball, position, direction,
        { elasticity: o.elasticity, smoothness: o.smoothness, threshold: NO_COLLISION, boost: 0 });
      return false;
    }

    const reboundSpeed = basicCollision(ball, position, direction,
      { elasticity: o.elasticity, smoothness: o.smoothness, threshold: o.threshold, boost: o.boost });

    if (reboundSpeed > o.threshold) {
      playSoundId(o.sound, o.hardHitSoundId, ball);
      return true;
    }
    if (reboundSpeed > AUDIBLE_REBOUND) playSoundId(o.sound, o.softHitSoundId, ball);
    return false;
  }

  return {
    collision(ball, position, direction) {
      react(ball as BallState, position, direction);
    },
    defaultCollision: react,
  };
}

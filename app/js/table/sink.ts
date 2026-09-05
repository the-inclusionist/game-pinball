// SPDX-License-Identifier: AGPL-3.0-or-later
// table/sink — a hole that swallows the ball and gives it back. Port of `TSink`.
//
// ========================= ON TILT A SINK BECOMES THE DRAIN =========================
// The first line of `TSink::Collision` is:
//
//     if (PinballTable->TiltLockFlag) PinballTable->Drain->Collision(...)
//
// Not "do not swallow" — hand the ball to the DRAIN. On a tilted table every hole on the board stops
// being a hole and becomes a loss. It is the harshest thing tilt does, it is one line, and treating
// tilt as merely "no sound and no score" would lose it entirely.
//
// ========================= GIVING THE BALL BACK WAITS FOR ROOM =========================
// When the timer fires, the sink first asks whether a ball is already sitting at its exit point. If one
// is, it reschedules for 0.5s and tries again. Spawning regardless would put two balls inside each
// other, and the collision response would fling them apart at a speed neither of them earned.
//
// The returned ball starts with collision DISABLED, so it leaves the mouth of the sink before the grid
// can touch it — otherwise it would collide with the sink it is being born inside.

import type { Vector2 } from '../maths/maths.js';
import type { SoundPlayer, TableState } from './collision-component.js';
import type { TimerService } from './bumper.js';

/** The retry delay when the exit is occupied. The original's literal 0.5. */
const RETRY_SECONDS = 0.5;

export interface SinkBall {
  disable(): void;
}

export interface SinkTable extends TableState {
  /** The drain takes the ball when the table is tilted. */
  drainCollision(ball: unknown, position: Vector2, direction: Vector2, distance: number, edge: unknown): void;
  /** Is there already a ball within `radius` of `at`? */
  ballCountInRect(at: Vector2, radius: number): number;
  addBall(at: Vector2): { collisionDisabled: boolean; throwBall(direction: Vector2, angleMult: number, speedMult1: number, speedMult2: number): void };
  /** `CollisionCompOffset` — the radius used for the occupancy test is twice this. */
  collisionCompOffset: number;
}

export interface SinkOptions {
  readonly table: SinkTable;
  readonly timer: TimerService;
  /** Where the ball reappears. */
  readonly ballPosition: Vector2;
  readonly throwDirection: Vector2;
  readonly throwAngleMult: number;
  readonly throwSpeedMult1: number;
  readonly throwSpeedMult2: number;
  /** How long the ball stays swallowed. */
  readonly holdTime: number;
  readonly swallowSoundId?: number;
  readonly releaseSoundId?: number;
  readonly sound?: SoundPlayer;
  readonly onSwallow?: () => void;
}

export interface Sink {
  collision(ball: unknown, position: Vector2, direction: Vector2, distance: number, edge: unknown): void;
  /** Schedules the ball's return. `TSinkResetTimer` in the original; a negative value means the default. */
  scheduleRelease(seconds?: number): void;
}

export function createSink(o: SinkOptions): Sink {
  function release(): void {
    // ROOM FIRST. Two balls born inside each other would be flung apart at a speed neither earned.
    if (o.table.ballCountInRect(o.ballPosition, o.table.collisionCompOffset * 2)) {
      o.timer.set(RETRY_SECONDS, release);
      return;
    }

    const ball = o.table.addBall(o.ballPosition);
    // It leaves the mouth of the sink before the grid can touch it; otherwise it would collide with the
    // very sink it is being born inside.
    ball.collisionDisabled = true;
    ball.throwBall(o.throwDirection, o.throwAngleMult, o.throwSpeedMult1, o.throwSpeedMult2);
    if (o.releaseSoundId !== undefined) o.sound?.play(o.releaseSoundId, ball);
  }

  return {
    collision(ball, position, direction, distance, edge): void {
      if (o.table.tiltLocked) {
        o.table.drainCollision(ball, position, direction, distance, edge);
        return;
      }

      (ball as SinkBall).disable();
      if (o.swallowSoundId !== undefined) o.sound?.play(o.swallowSoundId, ball);
      o.onSwallow?.();
    },

    scheduleRelease(seconds?: number): void {
      const delay = seconds === undefined || seconds < 0 ? o.holdTime : seconds;
      o.timer.set(delay, release);
    },
  };
}

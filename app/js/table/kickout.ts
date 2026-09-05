// SPDX-License-Identifier: AGPL-3.0-or-later
// table/kickout — the hole that grabs the ball and spits it back. Port of `TKickout`.
//
// ========================= THE FIELD IS A CONTROLLER, NOT AN ATTRACTION =========================
// This is the first component that registers a FIELD in the grid rather than only edges, and its
// formula is the interesting part:
//
//     dst = normalize(center - ballPos) * FieldMult  -  ballDirection * ballSpeed
//                    \___ pull toward the center ___/    \___ the ball's ENTIRE velocity ___/
//
// The second term subtracts everything the ball is currently doing. So the field does not merely
// attract: it CANCELS the ball's momentum and substitutes a pull toward the center. That is why a
// kicker hole grabs a ball rolling past at speed instead of letting it skim by the mouth — and it is
// why the formula reads like a velocity controller rather than a force. Dropping the second term would
// leave a hole that a fast ball simply flies over.
//
// ========================= CAPTURE HANDS THE BALL TO THE COMPONENT =========================
// On the first contact the ball is teleported to the circle's center, its Z is pushed down so it sinks
// into the hole, collision is disabled, and the ball's `component` is set to this kickout. From that
// moment `physics/step` skips the grid for that ball entirely and lets the component move it — see the
// held-ball branch there.
//
// ========================= AND IT GOES DEAF AFTER SPITTING =========================
// Releasing throws the ball and clears the active flag, and only 0.05s later does a second timer switch
// it back on. Without that gap the departing ball is still inside the circle and would be captured
// again on the very next frame.

import { normalize2d, type Vector2 } from '../maths/maths.js';
import type { SoundPlayer, TableState } from './collision-component.js';
import type { TimerService } from './bumper.js';
import type { Edge } from '../physics/grid.js';

/** How long the kickout stays deaf after spitting the ball out. The original's `TimerTime2`. */
const DEAF_SECONDS = 0.05;
/** The hold time used when the table is tilted: swallow and spit, fast and silent. */
const TILTED_HOLD_SECONDS = 0.1;

export interface KickoutBall {
  position: Vector2 & { z?: number };
  direction: Vector2;
  speed: number;
  collisionDisabled: boolean;
  component: unknown;
  memory: { record(edge: Edge): void };
  throwBall(direction: Vector2, angleMult: number, speedMult1: number, speedMult2: number): void;
}

export interface KickoutOptions {
  readonly table: TableState;
  readonly timer: TimerService;
  readonly edges: readonly Edge[];
  readonly center: Vector2;
  /** The field's reach, squared. Outside it the field says nothing. */
  readonly fieldRadiusSq: number;
  /** How hard the field pulls toward the center. `FieldMult` in the original. */
  readonly fieldMult: number;
  /** The Z the ball takes while it sits in the hole. */
  readonly capturedZ: number;
  /** Default hold time before the ball is thrown back. `TimerTime1`, the original's 1.5. */
  readonly holdTime: number;
  readonly throwDirection: Vector2;
  readonly throwAngleMult: number;
  readonly throwSpeedMult1: number;
  readonly throwSpeedMult2: number;
  readonly captureSoundId?: number;
  readonly releaseSoundId?: number;
  readonly sound?: SoundPlayer;
  readonly onCapture?: () => void;
}

export interface Kickout {
  collision(ball: unknown, position: Vector2, direction: Vector2, distance: number, edge: unknown): void;
  /** Writes the field force into `destination` and reports whether it had anything to say. */
  fieldEffect(ball: KickoutBall, destination: Vector2): boolean;
  /** `TKickoutRestartTimer`: schedules the throw. A negative value means the default hold time. */
  restartTimer(seconds?: number): void;
  readonly captured: boolean;
}

export function createKickout(o: KickoutOptions): Kickout {
  let captured = false;
  let heldBall: KickoutBall | null = null;
  let originalZ = 0;

  const setActive = (value: boolean): void => {
    for (const edge of o.edges) edge.active = value;
  };

  function release(): void {
    if (!captured) return;
    captured = false;
    o.timer.set(DEAF_SECONDS, () => setActive(true));

    if (!heldBall) return;
    if (o.releaseSoundId !== undefined) o.sound?.play(o.releaseSoundId, heldBall);
    heldBall.position.z = originalZ;
    heldBall.component = null;
    heldBall.collisionDisabled = false;
    heldBall.throwBall(o.throwDirection, o.throwAngleMult, o.throwSpeedMult1, o.throwSpeedMult2);
    // Deaf from THIS instant, not from the timer: the departing ball is still inside the circle.
    setActive(false);
    heldBall = null;
  }

  return {
    get captured() { return captured; },

    collision(ball, position, _direction, _distance, edge): void {
      const b = ball as KickoutBall;

      if (captured) {
        // Already holding one. Anything else that touches simply passes through.
        b.position.x = position.x;
        b.position.y = position.y;
        b.memory.record(edge as Edge);
        return;
      }

      captured = true;
      heldBall = b;
      b.component = this;
      b.position.x = o.center.x;
      b.position.y = o.center.y;
      originalZ = b.position.z ?? 0;
      b.position.z = o.capturedZ;
      b.collisionDisabled = true;

      if (o.table.tiltLocked) {
        // A tilted table swallows and spits it straight back, without a sound and without a score.
        o.timer.set(TILTED_HOLD_SECONDS, release);
        return;
      }

      if (o.captureSoundId !== undefined) o.sound?.play(o.captureSoundId, b);
      o.onCapture?.();
    },

    fieldEffect(ball, destination): boolean {
      // A hole that is already full has nothing to pull with.
      if (captured) return false;

      const direction = { x: o.center.x - ball.position.x, y: o.center.y - ball.position.y };
      if (direction.y * direction.y + direction.x * direction.x > o.fieldRadiusSq) return false;

      normalize2d(direction);
      // Pull toward the center MINUS the ball's whole velocity — see this module's header.
      destination.x = direction.x * o.fieldMult - ball.direction.x * ball.speed;
      destination.y = direction.y * o.fieldMult - ball.direction.y * ball.speed;
      return true;
    },

    restartTimer(seconds?: number): void {
      if (!captured) return;
      const delay = seconds === undefined || seconds < 0 ? o.holdTime : seconds;
      o.timer.set(delay, release);
    },
  };
}

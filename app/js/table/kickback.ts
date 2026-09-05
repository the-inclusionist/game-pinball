// SPDX-License-Identifier: AGPL-3.0-or-later
// table/kickback — the outlane saver. Port of `TKickback`.
//
// ========================= IT IS A THRESHOLD THAT MOVES =========================
// The kickback never decides to kick. It arms itself on the first touch, and seven tenths of a second
// later it drops its own collision THRESHOLD from a billion to zero — after which any contact at all
// counts as a hard hit, and `basicCollision` applies the boost that throws the ball back up the lane.
// There is no state machine about where the ball is: one number changes and the physics does the rest.
//
// ⚠️ AND THE DELAY IS THE GAME. Seven tenths of a second is what the player feels between the ball
// reaching the outlane and the save arriving. A port that kicked on contact would take that away, and
// the shot could never be lost the way the table intends.
//
// ========================= HOW IT KNOWS THE BALL HAS GONE =========================
// `DefaultCollision` answers whether the hit was HARD, and a hard hit clears the armed flag. So the
// kickback does not look for the ball — it notices that it kicked one. The next expiry then reports
// `ControlTimerExpired` instead of kicking again, and that report is what shuts the chute's gate.

import { createCollisionComponent, type SoundPlayer, type TableState } from './collision-component.js';
import { playSoundId } from './sound-id.js';
import type { BallState } from '../physics/collision.js';
import type { Vector2 } from '../maths/maths.js';
import type { TimerService } from './bumper.js';

/** `TimerTime`: how long the ball has to sit there before the save arrives. */
export const KICKBACK_ARM_SECONDS = 0.7;
/** `TimerTime2`: how often it kicks again while the ball is still on it. */
export const KICKBACK_KICK_SECONDS = 0.1;
/**
 * The threshold while it waits. The constructor writes this over whatever record 401 said, so a
 * kickback is the one collision component whose threshold is NOT the archive's.
 */
export const KICKBACK_REST_THRESHOLD = 1e9;

export interface KickbackOptions {
  readonly table: TableState;
  readonly elasticity: number;
  readonly smoothness: number;
  readonly boost: number;
  readonly hardHitSoundId?: number;
  readonly sound?: SoundPlayer;
  readonly timer: TimerService;
  /** 1 while it is kicking, 0 when it stops, -1 on reset. */
  readonly setSprite?: (index: number) => void;
  /** `control::handler(ControlTimerExpired, this)` — what puts the chute's gate back. */
  readonly onTimerExpired?: () => void;
}

export interface Kickback {
  collision(ball: unknown, position: Vector2, direction: Vector2, distance: number, edge: unknown): void;
  /** `KickActiveFlag`. Armed means a timer is running and the ball has not been kicked yet. */
  readonly armed: boolean;
  /** Exposed because it is the whole mechanism, and a test can watch it move. */
  readonly threshold: number;
  /** `SetTiltLock` and `Reset`, which are the same branch in the original. */
  reset(): void;
}

export function createKickback(o: KickbackOptions): Kickback {
  let threshold = KICKBACK_REST_THRESHOLD;
  let armed = false;
  let timerId = 0;

  // ⚠️ A GETTER, so the collision component reads the CURRENT threshold. Passing the number would
  // freeze it at a billion and the kickback would never kick — a component that arms, waits, plays its
  // sound and then bounces the ball as gently as a wall.
  const inner = createCollisionComponent({
    table: o.table,
    elasticity: o.elasticity,
    smoothness: o.smoothness,
    boost: o.boost,
    get threshold() { return threshold; },
    ...(o.sound ? { sound: o.sound } : {}),
  });

  function expired(): void {
    if (armed) {
      threshold = 0;
      timerId = o.timer.set(KICKBACK_KICK_SECONDS, expired);
      playSoundId(o.sound, o.hardHitSoundId, kickback);
      o.setSprite?.(1);
      return;
    }
    o.setSprite?.(0);
    timerId = 0;
    o.onTimerExpired?.();
  }

  const kickback: Kickback = {
    get armed() { return armed; },
    get threshold() { return threshold; },

    collision(ball, position, direction) {
      if (o.table.tiltLocked) {
        // A dead table bounces and nothing else — no arming, no timer, no save.
        inner.collision(ball, position, direction, 0, null);
        return;
      }

      if (!armed) {
        threshold = KICKBACK_REST_THRESHOLD;
        armed = true;
        timerId = o.timer.set(KICKBACK_ARM_SECONDS, expired);
      }
      if (inner.defaultCollision(ball as BallState, position, direction)) armed = false;
    },

    reset(): void {
      if (timerId) o.timer.kill(timerId);
      timerId = 0;
      o.setSprite?.(-1);
      armed = false;
      threshold = KICKBACK_REST_THRESHOLD;
    },
  };

  return kickback;
}

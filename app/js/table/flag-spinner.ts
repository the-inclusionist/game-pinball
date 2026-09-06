// SPDX-License-Identifier: AGPL-3.0-or-later
// table/flag-spinner — the two flags, which are SPINNERS. Port of `TFlagSpinner`.
//
// ⚠️ THE BALL GOES THROUGH. `TFlagSpinner::Collision` moves the ball to the contact point, marks the
// edge and returns — there is no bounce anywhere in it. What the collision does instead is set the
// flag turning, and the turning is the whole component: a frame index that walks around its pictures,
// a speed that starts at twenty times the ball's and decays by a third on every frame, and a timer
// that re-enters at one over that speed.
//
// Installed as an ordinary wall — which is what this port did — `a_flag1` is a horizontal segment at
// y = -4.74 from x 6.5 to 7.5, and the ball comes to REST on it. Two of six seeded minutes of play
// ended with the ball sitting there at a quarter of a unit a second, for ever.
//
// ========================= WHICH EDGE WAS HIT IS WHICH WAY IT TURNS =========================
// `SpinDirection = 2 * (PrevCollider != edge) - 1`. The two lines are the same segment wound opposite
// ways, so line collision — which is one-sided — answers one face each, and the face the ball crossed
// IS the direction of the spin. Read it the other way and every flag on the table turns backwards.

import type { Vector2 } from '../maths/maths.js';
import type { BallState } from '../physics/collision.js';
import type { Edge } from '../physics/grid.js';
import type { SoundPlayer, TableState } from './collision-component.js';
import type { TimerService } from './bumper.js';
import { playSoundId } from './sound-id.js';

/** `TFlagSpinner`'s own fallbacks, used when the archive does not carry the record. */
export const SPINNER_DEFAULTS = { speedDecrement: 0.64999998, maxSpeed: 50000, minSpeed: 5 } as const;

export interface SpinnerBall extends BallState {
  memory: { record(edge: Edge): void };
}

export interface FlagSpinnerOptions {
  readonly table: TableState;
  readonly timer: TimerService;
  /** How many pictures it walks around. The index wraps at both ends. */
  readonly frameCount: number;
  readonly minSpeed: number;
  readonly maxSpeed: number;
  readonly speedDecrement: number;
  /**
   * The edge that turns it BACKWARDS — `PrevCollider`, which is the second of the two lines. Anything
   * else, including the first line, turns it forwards.
   */
  readonly previousCollider?: unknown;
  readonly softHitSoundId?: number;
  readonly sound?: SoundPlayer;
  /** `control::handler(ControlCollision, this)`, sent on EVERY frame of the spin and not just the hit. */
  readonly onSpin?: () => void;
  /** `ControlSpinnerLoopReset`: the index came back round to the first picture. A whole turn. */
  readonly onLoopReset?: () => void;
  readonly setSprite?: (index: number) => void;
}

export interface FlagSpinner {
  collision(ball: unknown, position: Vector2, direction: Vector2, distance: number, edge: unknown): void;
  readonly frameIndex: number;
}

/** `Speed = ball->Speed * 20.0f`. */
const SPIN_PER_BALL_SPEED = 20;

export function createFlagSpinner(o: FlagSpinnerOptions): FlagSpinner {
  let frameIndex = 0;
  let spinDirection = 1;
  let speed = 0;
  let timerId = 0;

  function nextFrame(): void {
    frameIndex += spinDirection;
    // Wrapping at both ends, which is what makes it a wheel rather than a slider.
    if (frameIndex >= o.frameCount) frameIndex = 0;
    else if (frameIndex < 0) frameIndex = o.frameCount - 1;

    if (!o.table.tiltLocked) {
      o.onSpin?.();
      playSoundId(o.sound, o.softHitSoundId, null);
      // ⚠️ THE WHOLE TURN IS ITS OWN MESSAGE. Coming back round to the first picture is what the
      // control layer counts, and it is not the same event as being hit.
      if (frameIndex === 0) o.onLoopReset?.();
    }

    o.setSprite?.(frameIndex);
    speed *= o.speedDecrement;
    if (speed >= o.minSpeed) {
      timerId = o.timer.set(1 / speed, nextFrame);
    } else {
      timerId = 0;
    }
  }

  return {
    get frameIndex() { return frameIndex; },

    collision(ball, position, _direction, _distance, edge): void {
      const b = ball as SpinnerBall;
      // Through, not off: the position moves and nothing else about the ball does.
      b.position.x = position.x;
      b.position.y = position.y;
      b.memory.record(edge as Edge);

      spinDirection = 2 * (o.previousCollider !== edge ? 1 : 0) - 1;
      // ⚠️ A BALL AT A STANDSTILL STILL TURNS IT. Without this the spin speed is zero and the timer is
      // set to one over nothing.
      // ⚠️ AND A MUTATION THAT DROPS THIS GUARD SURVIVES. `1 / Speed` is what it protects, and the
      // guard below never lets a zero speed reach it: the frame runs once either way and the spinner
      // stops. Recorded as an equivalent mutant rather than papered over — it stops being one on a
      // table whose decrement is at or above one, which the original allows and this file does not use.
      speed = b.speed === 0 ? o.minSpeed : b.speed * SPIN_PER_BALL_SPEED;
      if (speed < o.minSpeed) speed = o.minSpeed;
      if (speed > o.maxSpeed) speed = o.maxSpeed;

      if (timerId) { o.timer.kill(timerId); timerId = 0; }
      nextFrame();
    },
  };
}

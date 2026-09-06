// SPDX-License-Identifier: AGPL-3.0-or-later
// table/plunger — the launcher. Port of `TPlunger`.
//
// ========================= THE SAME THRESHOLD TRICK AS THE BUMPER, INVERTED =========================
// The bumper raises its threshold to infinity to switch ITSELF OFF while lit. The plunger sits at an
// infinite threshold ALL THE TIME and drops it to zero for a moment to switch itself ON. A ball that
// merely rolls into a resting plunger is never launched, because no rebound speed can ever exceed 1e9.
//
// So the launch is a WINDOW, not an event:
//   · pressing starts accumulating boost, one increment every 0.025s, capped at the maximum;
//   · releasing sets the threshold to ZERO — now any contact at all applies the whole accumulated
//     boost — and schedules the window to shut after one more 0.025s;
//   · when it shuts, threshold returns to infinity and boost to zero.
//
// If the ball is not touching the plunger during that window, the pull is spent for nothing. That is
// exactly how a real plunger behaves, and it comes out of two numbers rather than any launch logic.
//
// ========================= HOW OFTEN THE LAUNCH ACTUALLY FIRES, MEASURED =========================
// The window is 0.025 s — one and a half frames at sixty — and the ball has to be TOUCHING inside it.
// A ball at rest on the plunger is not continuously in contact: it settles into a limit cycle at speed
// 0.2 and touches every FOUR frames. So a release lands inside a contact about a third of the time.
//
// Swept over hold durations from 100 to 400 frames: 14 of 31 launched. That is the window and the limit
// cycle, not a defect in either — but two things follow from it and both are worth knowing.
//
// ⚠️ A SCRIPTED PULL CAN BE PHASE-LOCKED AND NEVER FIRE. Forty press-release cycles of the same length
// missed forty times: the cycle was a multiple of four frames, so every release landed in the same gap
// between contacts. A test that retries a launch has to VARY the hold, or it is not retrying at all.
//
// ⚠️ AND A FULL PULL TAKES TWO AND A HALF SECONDS. `PullbackIncrement` is
// `floor(MaxPullback / (ListBitmap->size() * 8))` and this plunger has twelve pictures, so the
// increment is ONE and a hundred ticks of 0.025 s are needed for the full hundred. Two seconds of
// holding is a 61% pull, which leaves the ball at speed 64 rather than 105. Nothing is wrong with that
// — it is the original's own arithmetic — but a test that holds for 120 frames is not testing a full
// launch.
//
// ⚠️ AND IT DOES NOT DECIDE WHERE THE BALL GETS TO, which I assumed here and then measured. A 61% pull
// and a full hundred both stop at exactly y = -6.89: the top of the lane is closed, and a ball stopped
// by geometry stops in the same place whatever it was launched with. See `table/original-oneways`.
//
// ========================= THE LAUNCH IS NEVER EXACTLY REPEATABLE =========================
// `boost = rand() * Boost * 0.1 + Boost` — between 1.0 and 1.1 times what was pulled. A deliberate ten
// per cent of jitter, so the same pull never gives the same shot twice.

import { basicCollision, type BallState } from '../physics/collision.js';
import { NO_COLLISION, type Vector2 } from '../maths/maths.js';
import type { SoundPlayer, TableState } from './collision-component.js';
import type { TimerService } from './bumper.js';

/** How much of the boost is random. The original's literal 0.1. */
const JITTER = 0.1;

export interface PlungerOptions {
  readonly table: TableState;
  readonly timer: TimerService;
  readonly maxPullback: number;
  /** Added to the boost on every tick of the pullback timer. */
  readonly pullbackIncrement: number;
  /** Seconds between pullback ticks, and the length of the launch window. The original's 0.025. */
  readonly pullbackDelay: number;
  readonly elasticity: number;
  readonly smoothness: number;
  /** How many sprite frames the plunger has; the frame tracks the pullback fraction. */
  readonly frameCount: number;
  readonly setSprite?: (index: number) => void;
  readonly pullSoundId?: number;
  readonly releaseSoundId?: number;
  readonly sound?: SoundPlayer;
  /** Injected so the jitter is testable. Defaults to Math.random. */
  readonly random?: () => number;
}

export interface Plunger {
  collision(ball: unknown, position: Vector2, direction: Vector2, distance: number, edge: unknown): void;
  press(): void;
  release(): void;
  reset(): void;
  readonly boost: number;
  /** True while the launch window is open. */
  readonly armed: boolean;
}

export function createPlunger(o: PlungerOptions): Plunger {
  const random = o.random ?? Math.random;
  let boost = 0;
  let threshold = NO_COLLISION;
  let pullingBack = false;
  let pullbackTimerId = 0;

  function tick(): void {
    boost += o.pullbackIncrement;
    if (boost <= o.maxPullback) {
      pullbackTimerId = o.timer.set(o.pullbackDelay, tick);
    } else {
      pullbackTimerId = 0;
      boost = o.maxPullback;
    }
    // The frame tracks the fraction pulled, so the sprite IS the state of charge.
    const index = Math.floor((o.frameCount - 1) * (boost / o.maxPullback));
    o.setSprite?.(index);
  }

  function closeWindow(): void {
    threshold = NO_COLLISION;
    boost = 0;
  }

  return {
    get boost() { return boost; },
    get armed() { return threshold === 0; },

    collision(ball, position, direction): void {
      const b = ball as BallState;

      if (o.table.tiltLocked) {
        // A TILTED TABLE LAUNCHES AT FULL POWER regardless of the pull. The original takes the same
        // branch for an automatic relaunch: when the game is clearing the ball itself, how far the
        // player happened to pull is not part of the answer.
        const full = random() * o.maxPullback * JITTER + o.maxPullback;
        basicCollision(b, position, direction, { elasticity: o.elasticity, smoothness: o.smoothness, threshold: 0, boost: full });
        return;
      }

      const shot = random() * boost * JITTER + boost;
      basicCollision(b, position, direction, { elasticity: o.elasticity, smoothness: o.smoothness, threshold, boost: shot });
    },

    press(): void {
      if (pullingBack) return;
      pullingBack = true;
      boost = 0;
      threshold = NO_COLLISION;
      if (o.pullSoundId !== undefined) o.sound?.play(o.pullSoundId, null);
      tick();
    },

    release(): void {
      if (!pullingBack) return;
      pullingBack = false;
      // ZERO, not "lower": any contact at all now applies the whole accumulated boost.
      threshold = 0;
      if (pullbackTimerId) o.timer.kill(pullbackTimerId);
      pullbackTimerId = 0;
      if (o.releaseSoundId !== undefined) o.sound?.play(o.releaseSoundId, null);
      o.setSprite?.(0);
      o.timer.set(o.pullbackDelay, closeWindow);
    },

    reset(): void {
      pullingBack = false;
      if (pullbackTimerId) o.timer.kill(pullbackTimerId);
      pullbackTimerId = 0;
      boost = 0;
      threshold = NO_COLLISION;
      o.setSprite?.(0);
    },
  };
}

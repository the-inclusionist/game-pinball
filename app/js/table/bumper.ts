// SPDX-License-Identifier: AGPL-3.0-or-later
// table/bumper — the bumper. Port of `TBumper`.
//
// ========================= THE DEBOUNCE IS THE THRESHOLD ITSELF =========================
// `Fire()` does three things, and the third is the one nobody would guess:
//
//     SpriteSet(2 * BmpIndex + 1);   // light it
//     Timer = timer::set(TimerTime); // schedule the unlighting
//     Threshold = 1000000000.0;      // <- this
//
// Raising the threshold to infinity for the length of the animation means the bumper cannot fire again
// while it is lit. There is no separate "busy" flag anywhere: the same number that decides whether a
// hit counts as hard doubles as the refractory period.
//
// AND IT HAS A SECOND EFFECT the original never states. In `basicCollision` the boost only applies
// above the threshold, so an infinite threshold also removes the KICK. A ball striking a lit bumper
// bounces off it like a wall — it is not thrown. That falls out of one assignment, and reimplementing
// the debounce with a boolean would quietly lose it.
//
// ========================= THE SPRITES COME IN PAIRS =========================
// `BmpIndex` is the bumper's level, not its frame. The frames are pairs: `2 * level` is idle and
// `2 * level + 1` is lit. That is why the clamp is `2 * next > max` rather than `next > max`.

import { createCollisionComponent, type SoundPlayer, type TableState } from './collision-component.js';
import { NO_COLLISION, type Vector2 } from '../maths/maths.js';
import type { BallState } from '../physics/collision.js';

export interface TimerService {
  set(seconds: number, callback: () => void): number;
  kill(id: number): void;
}

export interface BumperOptions {
  readonly table: TableState;
  readonly elasticity: number;
  readonly smoothness: number;
  readonly threshold: number;
  readonly boost: number;
  /** How long the bumper stays lit, in seconds. `TimerTime` in the original. */
  readonly litTime: number;
  readonly timer: TimerService;
  readonly hardHitSoundId?: number;
  readonly softHitSoundId?: number;
  readonly sound?: SoundPlayer;
  readonly setSprite?: (index: number) => void;
  /** The mission logic counts bumper hits. */
  readonly onFire?: () => void;
}

export interface Bumper {
  collision(ball: unknown, position: Vector2, direction: Vector2, distance: number, edge: unknown): void;
  /** The bumper's level. Frames are `2 * level` idle and `2 * level + 1` lit. */
  readonly level: number;
  readonly lit: boolean;
  setLevel(level: number, frameCount: number): void;
  reset(): void;
}

export function createBumper(o: BumperOptions): Bumper {
  let level = 0;
  let lit = false;
  let timerId = 0;

  // The base component reads its options at call time, so a getter here is what lets the threshold
  // change while the bumper is lit without the base knowing anything about bumpers.
  const component = createCollisionComponent({
    table: o.table,
    elasticity: o.elasticity,
    smoothness: o.smoothness,
    get threshold() { return lit ? NO_COLLISION : o.threshold; },
    boost: o.boost,
    hardHitSoundId: o.hardHitSoundId,
    softHitSoundId: o.softHitSoundId,
    sound: o.sound,
  });

  function unlight(): void {
    lit = false;
    timerId = 0;
    o.setSprite?.(level * 2);
  }

  function fire(): void {
    lit = true;
    o.setSprite?.(2 * level + 1);
    timerId = o.timer.set(o.litTime, unlight);
  }

  return {
    get level() { return level; },
    get lit() { return lit; },

    collision(ball, position, direction): void {
      if (component.defaultCollision(ball as BallState, position, direction)) {
        fire();
        o.onFire?.();
      }
    },

    setLevel(next: number, frameCount: number): void {
      // `if (2 * next > max) next = max / 2`: the clamp is on the PAIR, not on the frame.
      const maxFrame = frameCount - 1;
      let wanted = Math.floor(next);
      if (2 * wanted > maxFrame) wanted = Math.floor(maxFrame / 2);
      if (wanted < 0) wanted = 0;
      if (wanted === level) return;
      level = wanted;
      fire();
    },

    reset(): void {
      if (timerId) o.timer.kill(timerId);
      level = 0;
      unlight();
    },
  };
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// table/blocker — the wall that only exists during a mission. Port of `TBlocker`.
//
// It is the plainest use of the flag-on-the-edge mechanism: born inactive and invisible, switched on by
// the mission logic for a stated number of seconds, switched off again. Its threshold is 1e9, so it
// never kicks the ball — a blocker is a wall, not a bumper.
//
// ========================= THE TIMER DOES NOT SWITCH IT OFF =========================
// The one thing worth noticing. When the timeout fires, `TimerExpired` clears the timer handle and
// notifies control — and that is all. It does NOT deactivate the blocker.
//
// That is a real division of responsibility rather than an oversight: the blocker measures time and the
// mission decides what the time meant. Sometimes the mission extends it (the original keeps an
// `ExtendedDuration` of 5 beside an `InitialDuration` of 55 for exactly that), and a blocker that
// switched itself off would make the extension impossible to express.

import type { Edge } from '../physics/grid.js';
import type { SoundPlayer } from './collision-component.js';
import type { TimerService } from './bumper.js';
import { playSoundId } from './sound-id.js';

export interface BlockerOptions {
  readonly timer: TimerService;
  readonly edges: readonly Edge[];
  readonly enableSoundId?: number;
  readonly disableSoundId?: number;
  readonly sound?: SoundPlayer;
  readonly setSprite?: (index: number) => void;
  /** The timeout fired. What that means is the mission's business, not the blocker's. */
  readonly onTimeout?: () => void;
}

export interface Blocker {
  /** Switches it on. A non-negative `seconds` also starts the timeout; a negative one leaves it open. */
  enable(seconds: number): void;
  disable(): void;
  /** `TBlockerRestartTimeout`: a new deadline without touching whether it is on. */
  restartTimeout(seconds: number): void;
  /** Off and SILENT — used by reset, tilt and player change alike. */
  reset(): void;
  readonly active: boolean;
}

export function createBlocker(o: BlockerOptions): Blocker {
  let active = false;
  let timerId = 0;

  const setActive = (value: boolean): void => {
    active = value;
    for (const edge of o.edges) edge.active = value;
    o.setSprite?.(value ? 0 : -1);
  };

  const clearTimer = (): void => {
    if (timerId) o.timer.kill(timerId);
    timerId = 0;
  };

  const blocker: Blocker = {
    get active() { return active; },

    enable(seconds: number): void {
      setActive(true);
      playSoundId(o.sound, o.enableSoundId, blocker);
      clearTimer();
      if (seconds >= 0) {
        timerId = o.timer.set(seconds, () => { timerId = 0; o.onTimeout?.(); });
      }
    },

    disable(): void {
      clearTimer();
      setActive(false);
      playSoundId(o.sound, o.disableSoundId, blocker);
    },

    restartTimeout(seconds: number): void {
      clearTimer();
      timerId = o.timer.set(Math.max(seconds, 0), () => { timerId = 0; o.onTimeout?.(); });
    },

    reset(): void {
      clearTimer();
      setActive(false);
    },
  };

  blocker.reset();
  return blocker;
}

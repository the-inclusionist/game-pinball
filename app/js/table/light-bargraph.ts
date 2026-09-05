// SPDX-License-Identifier: AGPL-3.0-or-later
// table/light-bargraph — the fuel tank. Port of `TLightBargraph`.
//
// ========================= IT IS A LIGHT GROUP THAT COUNTS IN HALVES =========================
// `fuel_bargraph` is six lamps and TWELVE levels, because a lamp has a lit state and a flashing one.
// `TimeIndex` is the level; the lamps are how it is drawn. `timeIndex / 2` is the split the underlying
// group is given, and an EVEN index additionally flashes the topmost lamp — which is the half-full look
// a player reads as "this one is going".
//
// ⚠️ AND `TLightGroupGetOnCount` ANSWERS THE LEVEL, NOT THE LIT COUNT. That override is the reason this
// file exists. `control::FuelRollover6Control` asks whether the count is greater than ELEVEN with six
// lamps on the table: against a plain `TLightGroup` that question can never be true, so every rollover
// would refill for ever and the tank would never read as full. Wiring the fuel rollovers to a light
// group would not fail — it would quietly play a different game.
//
// ========================= THE TANK DRAINS ON ITS OWN =========================
// Every fill arms a timer taken from record 904 — one time per LEVEL, twelve of them, so a nearly empty
// tank drains at its own rate rather than at a constant one. When it expires the level drops by one and
// `ControlTimerExpired` is announced; when it expires at zero the lamps go out and the announcement is
// `TLightGroupCountdownEnded`, which is a different event and a different mission consequence.
//
// ⚠️ AND EVERY FILL KILLS THE RUNNING TIMER FIRST. Without that, two rollovers in quick succession
// leave two decay timers armed and the tank drains at twice the rate — a bug that looks like bad
// balancing rather than like a leak.

import type { Light } from './light.js';
import type { LightGroup } from './light-group.js';
import type { TimerService } from './bumper.js';

export interface LightBargraphOptions {
  readonly timer: TimerService;
  /** The `TLightGroup` underneath. Every drawing decision is delegated to it. */
  readonly group: LightGroup;
  /** Its members, for the reset that the original expresses as a message to the group. */
  readonly lights: readonly Light[];
  /** Record 904: one decay time per level, so `2 * lights.length` of them. */
  readonly times: readonly number[];
  /** `control::handler(ControlTimerExpired, this)` — a level was lost. */
  readonly onTimerExpired?: () => void;
  /** `control::handler(TLightGroupCountdownEnded, this)` — the tank reached empty. */
  readonly onCountdownEnded?: () => void;
}

export interface LightBargraph {
  /** `TLightGroupGetOnCount`: the LEVEL. See this module's header. */
  readonly onCount: number;
  readonly lightCount: number;
  /** `TLightGroupToggleSplitIndex`: fill to this level. */
  toggleSplitIndex(index: number): void;
  reset(): void;
}

export function createLightBargraph(o: LightBargraphOptions): LightBargraph {
  let timeIndex = 0;
  let timerId = 0;

  const killTimer = (): void => {
    if (timerId) o.timer.kill(timerId);
    timerId = 0;
  };

  /** `TLightResetAndTurnOff` sent to the group, which forwards it to every member, last to first. */
  const resetAndTurnOffAll = (): void => {
    for (let i = o.lights.length - 1; i >= 0; i--) {
      o.lights[i]!.resetTimed();
      o.lights[i]!.turnOff();
    }
  };

  function expired(): void {
    timerId = 0;
    if (timeIndex) {
      bargraph.toggleSplitIndex(timeIndex - 1);
      o.onTimerExpired?.();
    } else {
      resetAndTurnOffAll();
      o.onCountdownEnded?.();
    }
  }

  const bargraph: LightBargraph = {
    get onCount() { return timeIndex; },
    get lightCount() { return o.lights.length; },

    toggleSplitIndex(value: number): void {
      // Killed BEFORE the clamp, as the original does: even a request that turns out to be nonsense
      // has already cancelled the decay.
      killTimer();

      const maxCount = o.lights.length * 2;
      let index = Math.floor(value);
      if (index >= maxCount) index = maxCount - 1;

      if (index >= 0) {
        // Integer division: two levels share a lamp.
        o.group.toggleSplitIndex(Math.floor(index / 2));
        if (!(index & 1)) o.group.startFlasher();
        const seconds = o.times[index];
        if (seconds !== undefined) timerId = o.timer.set(seconds, expired);
        timeIndex = index;
      } else {
        resetAndTurnOffAll();
        timeIndex = 0;
      }
    },

    reset(): void {
      killTimer();
      timeIndex = 0;
      o.group.reset();
    },
  };

  return bargraph;
}

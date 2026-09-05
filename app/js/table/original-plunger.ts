// SPDX-License-Identifier: AGPL-3.0-or-later
// table/original-plunger — the 1995 plunger, which is almost all constants.
//
// ========================= ONE RECORD AND SIX NUMBERS THE FILE DOES NOT HOLD =========================
// `TPlunger`'s constructor reads exactly one attribute — record 601, where the ball sits — and writes
// everything else itself: a maximum pullback of 100, an elasticity and a smoothness of 0.5 each, a
// pullback delay of 0.025 seconds and a threshold of a billion. So a port that looked for those in the
// archive would find nothing and quietly plunge with zeros.
//
// ⚠️ AND THE ELASTICITY IS *NOT* THE VISUAL'S. The constructor reads the visual for its sound indices
// and then overwrites the material with 0.5/0.5. Taking the material from the file — which is what
// every other collision component here does — gives the plunger the wrong bounce, and the ball leaves
// it at a speed nobody chose.
//
// ⚠️ THE INCREMENT IS FLOORED, AND ONLY OUTSIDE FULL TILT. `floor(100 / (frames * 8))` is a whole
// number of units per tick; Full Tilt divides by 50 and does not floor. This port is Space Cadet, so
// the floor stays — and with it the fact that a plunger with many frames climbs in steps of zero.

import { createPlunger, type Plunger } from './plunger.js';
import { visualStatesOf } from './original-components.js';
import { readVisual } from '../dat/visual.js';
import { floatAttribute } from '../dat/attributes.js';
import type { Group } from '../dat/partman.js';
import type { TimerService } from './bumper.js';
import type { TableState } from './collision-component.js';
import type { Vector2 } from '../maths/maths.js';

/** Where the ball sits while the plunger is drawn back. `table->PlungerPosition`. */
export const PLUNGER_POSITION_RECORD = 601;
/** `MaxPullback` outside Full Tilt. */
export const MAX_PULLBACK = 100;
/** `PullbackDelay`: seconds between ticks, and the length of the launch window. */
export const PULLBACK_DELAY = 0.025;
/** Written over whatever the visual said. */
export const PLUNGER_ELASTICITY = 0.5;
export const PLUNGER_SMOOTHNESS = 0.5;

export interface OriginalPlungerOptions {
  readonly table: TableState;
  readonly timer: TimerService;
  readonly sound?: { play(soundId: number, source: unknown): void };
  readonly random?: () => number;
}

/** Where the ball waits to be launched, or null when the group is not a plunger. */
export function plungerPosition(group: Group): Vector2 | null {
  const at = floatAttribute(group, PLUNGER_POSITION_RECORD);
  if (!at || at.length < 2) return null;
  return { x: at[0]!, y: at[1]! };
}

export function buildOriginalPlunger(
  groups: readonly Group[], groupIndex: number, o: OriginalPlungerOptions,
): Plunger | null {
  const group = groups[groupIndex];
  if (!group || !plungerPosition(group)) return null;

  const visual = readVisual(groups, groupIndex);
  const frameCount = visualStatesOf(groups, groupIndex);

  return createPlunger({
    table: o.table,
    timer: o.timer,
    maxPullback: MAX_PULLBACK,
    // `std::floor(MaxPullback / (ListBitmap->size() * 8.0f))`.
    pullbackIncrement: Math.floor(MAX_PULLBACK / (frameCount * 8)),
    pullbackDelay: PULLBACK_DELAY,
    elasticity: PLUNGER_ELASTICITY,
    smoothness: PLUNGER_SMOOTHNESS,
    frameCount,
    pullSoundId: visual.soundIndex4,
    releaseSoundId: visual.soundIndex3,
    ...(o.sound ? { sound: o.sound } : {}),
    ...(o.random ? { random: o.random } : {}),
  });
}

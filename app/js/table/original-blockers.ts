// SPDX-License-Identifier: AGPL-3.0-or-later
// table/original-blockers — the barrier across the drain, which is not there until it is earned.
//
// ⚠️ `TBlocker`'s CONSTRUCTOR ENDS WITH `ActiveFlag = 0` AND `SpriteSet(-1)`. It is invisible and
// intangible until a mission sends `TBlockerEnable`, and it sits directly across the drain. Installed
// as ordinary geometry — which is what any group carrying a wall record gets — it becomes a permanent
// wall in front of the only place a ball can be lost.
//
// That is exactly what happened here: the ball came to rest bouncing between `v_bloc1` and the right
// flipper, seven times a frame, for ever. It never reached the drain, so with the drain wired the game
// could never end; and the stuck watch correctly declined to rescue it, because a ball resting inside
// a flipper's box is where the player put it.

// ========================= AND ONCE IT IS BUILT, IT LOWERS ITSELF =========================
// `createBlocker` ends its constructor with `reset()`, which clears `active` on the edges it was given.
// So a caller that builds the blockers gets the barrier down whether or not it also asked the geometry
// for `startsInactive`. That option is still what a caller installing geometry ALONE needs — and it is
// what keeps the wall from standing across the drain in the window between the two calls.

import { createBlocker, type Blocker } from './blocker.js';
import { readVisual } from '../dat/visual.js';
import type { TimerService } from './bumper.js';
import type { SoundPlayer } from './collision-component.js';
import type { OriginalTable } from './original.js';
import { ObjectType, type Table } from '../dat/loader.js';

/** The groups whose geometry is installed switched OFF. `v_bloc1` in the shipped file. */
export function blockerNames(manifest: Table): Set<string> {
  const names = new Set<string>();
  for (const object of manifest.tableObjects) {
    if (object.type !== ObjectType.Blocker) continue;
    const name = manifest.groups[object.group]?.name;
    if (name) names.add(name);
  }
  return names;
}

export interface OriginalBlockerOptions {
  readonly timer: TimerService;
  readonly sound?: SoundPlayer;
  /**
   * The deadline ran out. What that MEANS is `DrainBallBlockerControl`'s business — the first timeout
   * buys a flashing extension, the second lowers the barrier — so it is reported by name and nothing
   * here acts on it.
   */
  readonly onTimeout?: (groupName: string) => void;
}

/**
 * Every `TBlocker` in the archive, by the group's own name — `v_bloc1` in the shipped file.
 *
 * Like a gate, it takes the built table rather than the archive alone: the switch it is made of acts on
 * the edge objects the grid already holds, and copies would toggle nothing. A blocker whose group
 * installed no geometry is skipped rather than built empty.
 */
export function buildOriginalBlockers(
  manifest: Table, table: OriginalTable, o: OriginalBlockerOptions,
): Map<string, Blocker> {
  const blockers = new Map<string, Blocker>();

  for (const object of manifest.tableObjects) {
    if (object.type !== ObjectType.Blocker) continue;
    const group = manifest.groups[object.group];
    const name = group?.name;
    if (!group || !name) continue;

    const edges = table.edgesOf(name);
    if (!edges.length) continue;

    const visual = readVisual(manifest.groups, object.group);
    blockers.set(name, createBlocker({
      timer: o.timer,
      edges,
      enableSoundId: visual.soundIndex3,
      disableSoundId: visual.soundIndex4,
      ...(o.sound ? { sound: o.sound } : {}),
      ...(o.onTimeout ? { onTimeout: () => o.onTimeout!(name) } : {}),
    }));
  }

  return blockers;
}

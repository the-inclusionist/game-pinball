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

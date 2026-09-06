// SPDX-License-Identifier: AGPL-3.0-or-later
// table/original-tripwires — the five trip lines of the 1995 table, `s_trip1` to `s_trip5`.
//
// ⚠️ THEIR GEOMETRY IS NOT SKIPPED, WHICH IS WHAT MAKES THIS DIFFERENT FROM THE LANES. A rollover
// builds its own two boundaries and the wall loop must leave it alone; a tripwire derives from
// `TRollover` with `createWall = true` and takes the ordinary wall, offset and all. Only the COMPONENT
// differs — so this builds the components and the caller hands them to the geometry it already has.

import { createTripwire, type Tripwire } from './tripwire.js';
import { readVisual } from '../dat/visual.js';
import type { SoundPlayer, TableState } from './collision-component.js';
import { ObjectType, type Table } from '../dat/loader.js';

export interface OriginalTripwireOptions {
  readonly table: TableState;
  readonly sound?: SoundPlayer;
  /** A crossing, by name. The skill shot's five gates are these five wires. */
  readonly onCross?: (groupName: string) => void;
}

export function buildOriginalTripwires(
  manifest: Table, o: OriginalTripwireOptions,
): Map<string, Tripwire> {
  const wires = new Map<string, Tripwire>();

  for (const object of manifest.tableObjects) {
    if (object.type !== ObjectType.Tripwire) continue;
    const group = manifest.groups[object.group];
    const name = group?.name;
    if (!group || !name) continue;

    const visual = readVisual(manifest.groups, object.group);
    wires.set(name, createTripwire({
      table: o.table,
      softHitSoundId: visual.softHitSoundId,
      ...(o.sound ? { sound: o.sound } : {}),
      ...(o.onCross ? { onCross: () => o.onCross!(name) } : {}),
    }));
  }

  return wires;
}

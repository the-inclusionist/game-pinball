// SPDX-License-Identifier: AGPL-3.0-or-later
// table/original-gates — the 1995 table's gates, which are geometry plus a switch.
//
// ========================= A GATE IS NOT A COMPONENT THE COMPONENT BUILDER CAN MAKE =========================
// Every other `T*` this port builds from the archive is made from records alone: a bumper needs a
// threshold, a lamp needs two delays. `TGate` needs the EDGES — it has no collision override at all,
// and opening it clears the `active` flag on the very edge objects that went into the grid. Hand it
// copies and it toggles nothing while every test that only reads the gate still passes.
//
// So this runs after `table/original` has installed the geometry, and takes the table rather than the
// archive alone. That ordering is the whole reason it is a module of its own.
//
// ⚠️ AND THE TWO SOUNDS ARE CROSSED IF YOU GO BY THE NAMES. The original says it in messages:
// `TGateDisable` OPENS the gate — disabling a wall is opening a way through — and plays `SoundIndex3`,
// record 1101. `TGateEnable` puts the wall back and plays `SoundIndex4`, record 1100.

import { createGate, type Gate } from './gate.js';
import { readVisual } from '../dat/visual.js';
import { ObjectType, type Table } from '../dat/loader.js';
import type { OriginalTable } from './original.js';

export interface OriginalGateOptions {
  /** Where a gate's own sounds go. Absent leaves them silent, which is what the demo did before. */
  readonly sound?: { play(soundId: number, source: unknown): void };
}

/**
 * Every `TGate` in the archive, by the group's own name — `v_gate1` and `v_gate2` in the shipped file.
 *
 * A gate whose group installed no geometry is skipped rather than built empty: an empty gate opens and
 * shuts with nothing behind it, which is a component that cannot be wrong and cannot be right either.
 */
export function buildOriginalGates(
  manifest: Table, table: OriginalTable, o: OriginalGateOptions = {},
): Map<string, Gate> {
  const gates = new Map<string, Gate>();

  for (const object of manifest.tableObjects) {
    if (object.type !== ObjectType.Gate) continue;
    const group = manifest.groups[object.group];
    const name = group?.name;
    if (!group || !name) continue;

    const edges = table.edgesOf(name);
    if (!edges.length) continue;

    const visual = readVisual(manifest.groups, object.group);
    gates.set(name, createGate({
      edges,
      openSoundId: visual.soundIndex3,
      shutSoundId: visual.soundIndex4,
      ...(o.sound ? { sound: o.sound } : {}),
    }));
  }

  return gates;
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// dat/loader — turns the PARTOUT's raw groups into the table model.
//
// Port of the part of `loader.cpp` that answers the three questions everything else depends on: where
// each group is, how big the table is, and which objects compose it.

import { readGroups, EntryType, type Group } from './partman.js';

/**
 * The Space Cadet table's object types, per `Doc/.dat file format.txt`.
 * The holes in the numbering (1008, 1009, 1025, 1027, 1032) belong to the format, not to this list.
 */
export const ObjectType = {
  Plunger: 1001,
  Light: 1002,
  LeftFlipper: 1003,
  RightFlipper: 1004,
  Bumper: 1005,
  YellowTarget: 1006,
  Drain: 1007,
  Blocker: 1011,
  Kickout: 1012,
  Gate: 1013,
  Kicker: 1014,
  Rollover: 1015,
  OneWay: 1016,
  Sink: 1017,
  Flag: 1018,
  RedTarget: 1019,
  GreenRollover: 1020,
  Ramp: 1021,
  RampHole: 1022,
  Demo: 1023,
  Tripwire: 1024,
  Lights: 1026,
  BumperList: 1028,
  Kickout2: 1029,
  FuelBargraph: 1030,
  Sound: 1031,
  TextBox: 1033,
} as const;

export interface TableObject {
  readonly type: number;
  /** Index of the group carrying this object's data. */
  readonly group: number;
}

export interface Table {
  readonly groups: readonly Group[];
  /** `null`, not -1: a -1 used without checking is a valid JS index and reads `undefined` in silence. */
  groupIndex(name: string): number | null;
  readonly tableSize: { readonly width: number; readonly height: number } | null;
  readonly tableObjects: readonly TableObject[];
}

/** Reads a type 10 entry's payload as signed int16s. */
function int16s(data: Uint8Array): number[] {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const n = Math.floor(data.byteLength / 2);
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(dv.getInt16(i * 2, true));
  return out;
}

function intsOfGroup(groups: readonly Group[], index: number | null): number[] | null {
  if (index === null) return null;
  const g = groups[index];
  if (!g) return null;
  const e = g.entries.find((x) => x.type === EntryType.Int16s);
  return e?.data ? int16s(e.data) : null;
}

export function loadTable(file: Uint8Array): Table {
  const groups = readGroups(file);

  // A map rather than a scan: `loader.cpp` looks groups up by name constantly, and a linear scan over
  // 541 groups per lookup is the kind of cost that only shows up once the table is already large.
  const byName = new Map<string, number>();
  groups.forEach((g, i) => { if (g.name !== null && !byName.has(g.name)) byName.set(g.name, i); });
  const groupIndex = (name: string): number | null => byName.get(name) ?? null;

  const measures = intsOfGroup(groups, groupIndex('table_size'));
  const tableSize = measures && measures.length >= 2
    ? { width: measures[0]!, height: measures[1]! }
    : null;

  // THE FIRST INTEGER IS NOT AN OBJECT. The spec marks it unknown and the pairs follow it; starting at
  // zero shifts the whole list and every object gets its neighbour's group.
  const raw = intsOfGroup(groups, groupIndex('table_objects')) ?? [];
  const tableObjects: TableObject[] = [];
  for (let i = 1; i + 1 < raw.length; i += 2) {
    tableObjects.push({ type: raw[i]!, group: raw[i + 1]! });
  }

  return { groups, groupIndex, tableSize, tableObjects };
}

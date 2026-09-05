// SPDX-License-Identifier: AGPL-3.0-or-later
// dat/attributes — finding a group's numbered records. Port of `loader::query_float_attribute` and
// `loader::query_iattribute`.
//
// ========================= THE RECORD ID IS THE FIRST ELEMENT =========================
// A group carries several float arrays and several Int16 arrays, and nothing outside them says which is
// which. The original walks them in order, floors the first element of each, and returns the one whose
// value matches the record it was asked for.
//
// ⚠️ AND IT RETURNS A POINTER ONE PAST THAT FIRST ELEMENT. Every caller therefore reads the attribute
// WITHOUT the id in front, which is the whole convention: the same array is `[600, 5, 8, 15, …]` to the
// parser and `[5, 8, 15, …]` to `installWall`. Off by one here and every wall in the table becomes a
// different wall — a line becomes a circle, a four-sided polygon becomes a three-sided one — and
// nothing errors, because every shape is a valid shape.
//
// ========================= TWO ATTRIBUTE SPACES IN ONE GROUP =========================
// `table_objects` carries its wall geometry as float record 600 and its object manifest as Int16 record
// 1025. The numbers do not collide because the spaces are separate, so the reader takes the type.

import { EntryType, type Entry, type Group } from './partman.js';

function viewOf(entry: Entry): DataView | null {
  if (!entry.data) return null;
  return new DataView(entry.data.buffer, entry.data.byteOffset, entry.data.byteLength);
}

/**
 * The floats of `record`, WITHOUT the id. `undefined` when the group does not carry it — which the
 * original answers with a null pointer and an error code nobody reads.
 */
export function floatAttribute(group: Group, record: number): number[] | undefined {
  for (const entry of group.entries) {
    if (entry.type !== EntryType.Float32s) continue;
    const view = viewOf(entry);
    if (!view || view.byteLength < 4) continue;

    // Floored, because the ids are stored as floats and 600.0 is not always exactly 600.
    if (Math.floor(view.getFloat32(0, true)) !== record) continue;

    const values: number[] = [];
    for (let at = 4; at + 4 <= view.byteLength; at += 4) values.push(view.getFloat32(at, true));
    return values;
  }
  return undefined;
}

/** The same for an Int16 array. `table_objects`' manifest is one of these. */
export function int16Attribute(group: Group, record: number): number[] | undefined {
  for (const entry of group.entries) {
    if (entry.type !== EntryType.Int16s) continue;
    const view = viewOf(entry);
    if (!view || view.byteLength < 2) continue;

    if (view.getInt16(0, true) !== record) continue;

    const values: number[] = [];
    for (let at = 2; at + 2 <= view.byteLength; at += 2) values.push(view.getInt16(at, true));
    return values;
  }
  return undefined;
}

/** `loader::query_handle`. Group names are not unique in principle; the first match wins, as there. */
export function groupNamed(groups: readonly Group[], name: string): Group | undefined {
  return groups.find((group) => group.name === name);
}

// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { floatAttribute, int16Attribute, groupNamed } from '../app/js/dat/attributes.js';
import { readGroups, EntryType, type Group } from '../app/js/dat/partman.js';
import { resource } from './helpers/original-data.js';

/**
 * ⚠️ THE RECORD ID IS THE FIRST FLOAT, AND NOTHING ELSE SAYS WHICH ARRAY IS WHICH.
 *
 * `loader::query_float_attribute` walks a group's float arrays in order, floors the first element of
 * each, and returns the one whose value matches — then hands back a pointer ONE PAST it, so every
 * caller reads the attribute without the id in front. That off-by-one is the whole convention: the same
 * array is `[600, 5, 8, 15, …]` to the parser and `[5, 8, 15, …]` to `installWall`.
 *
 * These tests run against the REAL `PINBALL.DAT` where one is present, because a fixture would only
 * prove I can write a fixture. Where it is absent they say so and skip, which is what every other
 * conformance test in this project does.
 */

const DAT = resource('PINBALL.DAT');
const archive = (): Group[] | null => {
  if (!existsSync(DAT)) return null;
  const buf = readFileSync(DAT);
  return readGroups(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
};

describe('reading a group’s attributes', () => {
  test('⚠️ the returned array does NOT include the record id', () => {
    // The single most important property, because `installWall` reads `arr[0]` as the SHAPE. Off by one
    // here and every wall in the table becomes a different wall — a line becomes a circle, a four-sided
    // polygon becomes a three-sided one, and nothing errors.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const table = groupNamed(groups, 'table');
    const wall = floatAttribute(table!, 600);

    // The table's outer boundary: five points closing a quadrilateral, the first repeated at the end.
    expect(wall![0]).toBe(5);
    expect([wall![1], wall![2]]).toEqual([8, 15]);
    expect([wall![9], wall![10]]).toEqual([8, 15]);
  });

  test('a record the group does not carry comes back undefined', () => {
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    expect(floatAttribute(groupNamed(groups, 'table')!, 9999)).toBeUndefined();
  });

  test('and a group can be found by its name', () => {
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    expect(groupNamed(groups, 'table_objects')).toBeDefined();
    expect(groupNamed(groups, 'no-such-group')).toBeUndefined();
  });

  test('⚠️ an Int16 record the group does not carry is undefined too', () => {
    // My first version only asked for 1025, which `table_objects` has — so a mutation that skipped the
    // record check entirely survived, because the first array it met was the right one anyway. A
    // question with only one possible answer is not a question.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    expect(int16Attribute(groupNamed(groups, 'table_objects')!, 9999)).toBeUndefined();
  });

  test('⚠️ the table’s object manifest is an Int16 record, not a float one', () => {
    // `table_objects` record 1025 is the list of `[objectType, groupIndex]` pairs the table is built
    // from. Two different attribute spaces share one group, which is why the reader takes the type.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const manifest = int16Attribute(groupNamed(groups, 'table_objects')!, 1025);

    expect(manifest).toBeDefined();
    expect(manifest!.length % 2).toBe(0);
    expect(manifest!.length).toBeGreaterThan(20);
  });
});

describe('⚠️ the id is FLOORED, and the real archive cannot tell you that', () => {
  test('a record id stored just under its integer belongs to the lower record', () => {
    // Every id in `PINBALL.DAT` is an exact integer, so flooring and rounding agree on all of it and a
    // mutation between the two survives every conformance test there is. This is the one place a
    // synthetic group is the honest instrument: it tests the CONVENTION rather than the data, and the
    // convention is the original's `static_cast<int16_t>(floor(*floatArr))`.
    //
    // It matters because the ids are stored as 32-bit floats. A value written as 600 that comes back as
    // 599.99997 is record 599 to the original and record 600 to a rounding reader, and the wall it
    // returns would be a different wall with no error anywhere.
    const floats = new Float32Array([599.9, 2, 1, 2, 3, 4]);
    const group = {
      name: 'synthetic',
      entries: [{ type: EntryType.Float32s, data: new Uint8Array(floats.buffer) }],
    };

    expect(floatAttribute(group, 599)).toEqual([2, 1, 2, 3, 4]);
    expect(floatAttribute(group, 600)).toBeUndefined();
  });
});

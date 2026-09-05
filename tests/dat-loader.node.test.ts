// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { buildPartout, bodyOf, group, entry, text, int16s } from './helpers/partout.js';
import { EntryType } from '../app/js/dat/partman.js';
import { loadTable, ObjectType } from '../app/js/dat/loader.js';

const namedGroup = (name: string, ...extras: Uint8Array[]) =>
  group(entry(EntryType.GroupName, text(name)), ...extras);

describe('loader — group index', () => {
  test('finds a group by name', () => {
    const file = buildPartout({
      groupCount: 2,
      body: bodyOf(namedGroup('table_size'), namedGroup('s_ramp9')),
    });

    const table = loadTable(file);

    expect(table.groupIndex('s_ramp9')).toBe(1);
  });

  test('a missing group returns null rather than -1', () => {
    // -1 is a valid index in JavaScript when used without checking, and reads `undefined` in silence.
    const file = buildPartout({ groupCount: 1, body: bodyOf(namedGroup('only_this')) });

    expect(loadTable(file).groupIndex('does_not_exist')).toBeNull();
  });
});

describe('loader — table_size', () => {
  test('reads width and height from the int16 pair', () => {
    const file = buildPartout({
      groupCount: 1,
      body: bodyOf(namedGroup('table_size', entry(EntryType.Int16s, int16s(600, 416)))),
    });

    expect(loadTable(file).tableSize).toEqual({ width: 600, height: 416 });
  });
});

describe('loader — table_objects', () => {
  test('reads type/group pairs, discarding the first integer', () => {
    // The spec: "the first integer is unknown, and then comes a series of 16-bit pairs". Starting at
    // zero shifts the whole list and every object gets its neighbour's group.
    const file = buildPartout({
      groupCount: 1,
      body: bodyOf(namedGroup('table_objects',
        entry(EntryType.Int16s, int16s(0, ObjectType.Plunger, 42, ObjectType.Bumper, 43)))),
    });

    const objects = loadTable(file).tableObjects;

    expect(objects).toEqual([
      { type: ObjectType.Plunger, group: 42 },
      { type: ObjectType.Bumper, group: 43 },
    ]);
  });

  test('with no table_objects group the list is empty, not an exception', () => {
    const file = buildPartout({ groupCount: 1, body: bodyOf(namedGroup('something_else')) });

    expect(loadTable(file).tableObjects).toEqual([]);
  });
});

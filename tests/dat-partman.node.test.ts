// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { buildPartout, bodyOf, group, entry, value16Entry, fixedSizeEntry, text, SIGNATURE } from './helpers/partout.js';
import { readHeader, readGroups, EntryType } from '../app/js/dat/partman.js';

describe('partman — PARTOUT header', () => {
  test('reads the signature, app name and description from the fixed-width fields', () => {
    const file = buildPartout({ appName: '3D-Pinball', description: 'Space Cadet Table' });

    const h = readHeader(file);

    expect(h.signature).toBe(SIGNATURE);
    expect(h.appName).toBe('3D-Pinball');
    expect(h.description).toBe('Space Cadet Table');
  });

  test('reads the group count and the body size', () => {
    const file = buildPartout({ groupCount: 541, body: new Uint8Array(12) });

    const h = readHeader(file);

    expect(h.groupCount).toBe(541);
    expect(h.bodySize).toBe(12);
  });

  test('the body starts at 0xB7, which is where the upstream dump puts group 0', () => {
    const file = buildPartout({ body: new Uint8Array([0xaa]) });

    expect(readHeader(file).bodyStart).toBe(0xb7);
  });

  test('rejects a file whose signature is not PARTOUT', () => {
    const file = buildPartout({ signature: 'NOT A PARTOUT' });

    expect(() => readHeader(file)).toThrow(/signature/i);
  });
});

describe('partman — body', () => {
  test('reads one group with one text entry', () => {
    const file = buildPartout({
      groupCount: 1,
      body: bodyOf(group(entry(EntryType.String, text('3D-Pinball')))),
    });

    const groups = readGroups(file);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.entries).toHaveLength(1);
    expect(groups[0]!.entries[0]!.type).toBe(EntryType.String);
    expect(groups[0]!.entries[0]!.data).toEqual(text('3D-Pinball'));
  });

  test('reads several groups in sequence without losing sync', () => {
    const file = buildPartout({
      groupCount: 2,
      body: bodyOf(
        group(entry(EntryType.GroupName, text('table_size'))),
        group(entry(EntryType.GroupName, text('s_ramp9')), entry(EntryType.String, text('ok'))),
      ),
    });

    const groups = readGroups(file);

    expect(groups).toHaveLength(2);
    expect(groups[1]!.entries).toHaveLength(2);
    expect(groups[1]!.name).toBe('s_ramp9');
  });

  test('the type 0 entry carries a WORD of value and NOT a size DWORD', () => {
    const file = buildPartout({
      groupCount: 2,
      body: bodyOf(
        group(value16Entry(0x1234)),
        group(entry(EntryType.GroupName, text('after'))),
      ),
    });

    const groups = readGroups(file);

    expect(groups[0]!.entries[0]!.value).toBe(0x1234);
    // The real proof is not the value: it is that the NEXT group is still legible. A reader treating
    // type 0 like the others would consume four bytes where there are two and read garbage from here to
    // the end of the file, without throwing.
    expect(groups[1]!.name).toBe('after');
  });
});

describe('partman — fixed-size types beyond 0', () => {
  // The upstream's `_field_size[]` table: { 2, -1, 2, -1, ..., 0 }. Indices 0 and 2 are worth two bytes,
  // index 13 is worth none, and everything else reads a size DWORD. The spec in Doc/ only mentions type
  // 0, so a reader written from it alone loses sync on any file that uses 2 or 13.
  test('type 2 has two fixed bytes and no size DWORD', () => {
    const file = buildPartout({
      groupCount: 2,
      body: bodyOf(
        group(fixedSizeEntry(2, new Uint8Array([0xbe, 0xef]))),
        group(entry(EntryType.GroupName, text('after'))),
      ),
    });

    const groups = readGroups(file);

    expect(groups[0]!.entries[0]!.data).toEqual(new Uint8Array([0xbe, 0xef]));
    expect(groups[1]!.name).toBe('after');
  });

  test('type 13 carries no data at all', () => {
    const file = buildPartout({
      groupCount: 2,
      body: bodyOf(
        group(fixedSizeEntry(13, new Uint8Array(0))),
        group(entry(EntryType.GroupName, text('after'))),
      ),
    });

    const groups = readGroups(file);

    expect(groups[0]!.entries[0]!.data).toHaveLength(0);
    expect(groups[1]!.name).toBe('after');
  });
});

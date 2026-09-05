// SPDX-License-Identifier: AGPL-3.0-or-later
// dat/partman — the PARTOUT (.DAT) reader. Port of `partman.cpp`.
//
// Format per `Doc/.dat file format.txt` (AdrienTD). The header's three text fields are FIXED WIDTH and
// zero padded — the useful text is whatever comes before the first NUL.

const OFF = {
  signature: 0x00, appName: 0x15, description: 0x47,
  fileSize: 0xab, groupCount: 0xaf, bodySize: 0xb1,
} as const;
const LEN = { signature: 21, appName: 50, description: 100 } as const;

/**
 * Where the body starts. Not deduced: it is the end of the fixed-size header, and the upstream dump
 * confirms it by listing group 0 at `location: 0xB7`.
 */
export const BODY_START = 0xb7;

/** The only signature this reader accepts. A file with another is not a read error — it is another format. */
export const EXPECTED_SIGNATURE = 'PARTOUT(4.0)RESOURCE';

/** Text of a fixed-width field: stops at the first NUL, and does not drag the padding along. */
function fixedText(a: Uint8Array, start: number, length: number): string {
  const field = a.subarray(start, start + length);
  const end = field.indexOf(0);
  return new TextDecoder('latin1').decode(end === -1 ? field : field.subarray(0, end));
}

export interface Header {
  readonly signature: string;
  readonly appName: string;
  readonly description: string;
  readonly groupCount: number;
  readonly bodySize: number;
  readonly bodyStart: number;
}

export function readHeader(file: Uint8Array): Header {
  const signature = fixedText(file, OFF.signature, LEN.signature);
  // FAILS LOUDLY rather than in silence: carrying on reading the offsets of a format that is not this
  // one would produce plausible numbers and an error thirty functions later, far from the cause.
  if (signature !== EXPECTED_SIGNATURE) {
    throw new Error(`partman: unexpected signature ${JSON.stringify(signature)} — expected ${JSON.stringify(EXPECTED_SIGNATURE)}`);
  }
  const dv = new DataView(file.buffer, file.byteOffset, file.byteLength);
  return {
    signature,
    appName: fixedText(file, OFF.appName, LEN.appName),
    description: fixedText(file, OFF.description, LEN.description),
    groupCount: dv.getUint16(OFF.groupCount, true),
    bodySize: dv.getUint32(OFF.bodySize, true),
    bodyStart: BODY_START,
  };
}

/* ===================== THE BODY: GROUPS AND ENTRIES ===================== */

/**
 * The entry types, per `Doc/.dat file format.txt`. The numbers are not sequential because the original
 * format did not make them so — 2, 4, 6, 7 and 8 simply do not exist.
 */
export const EntryType = {
  /** THE TRAP: carries no size DWORD, it carries a 16-bit value. */
  Value16: 0,
  Bitmap8: 1,
  GroupName: 3,
  Palette: 5,
  String: 9,
  Int16s: 10,
  /** Float arrays: this is where the collision geometry lives. */
  Float32s: 11,
  ZMap: 12,
} as const;
export type EntryType = (typeof EntryType)[keyof typeof EntryType];

export interface Entry {
  readonly type: number;
  /** The entry's raw bytes. */
  readonly data?: Uint8Array;
  /** Only on type 0. */
  readonly value?: number;
}

export interface Group {
  /** The text of the type 3 entry, when the group has one. Not every group has a name. */
  readonly name: string | null;
  readonly entries: readonly Entry[];
}

/**
 * EACH TYPE'S FIXED SIZE, transcribed from the upstream's `partman::_field_size[]`:
 *   { 2, -1, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0 }
 * `-1` means "read a size DWORD before the data". The three that do NOT read one are 0 and 2 (two bytes
 * each) and 13 (no bytes at all).
 *
 * The spec in `Doc/.dat file format.txt` only documents type 0, and that is why this table exists
 * instead of an `if (type === 0)`: a reader written from the spec alone loses sync at the first type 2
 * or 13 — and loses it IN SILENCE, reading garbage from there to the end of the file.
 */
const FIXED_SIZE: readonly number[] = [2, -1, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0];

/** `-1` = the size comes in a DWORD. A type outside the table falls in the same case, as the original does. */
function fixedSizeOf(type: number): number {
  return FIXED_SIZE[type] ?? -1;
}

export function readGroups(file: Uint8Array): Group[] {
  const header = readHeader(file);
  const dv = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const groups: Group[] = [];
  let p = header.bodyStart;

  for (let g = 0; g < header.groupCount; g++) {
    const howMany = dv.getUint8(p); p += 1;
    const entries: Entry[] = [];
    let name: string | null = null;

    for (let e = 0; e < howMany; e++) {
      const type = dv.getUint8(p); p += 1;

      const fixed = fixedSizeOf(type);
      let size: number;
      if (fixed >= 0) {
        size = fixed;
      } else {
        size = dv.getUint32(p, true); p += 4;
      }

      const start = p;
      const data = file.subarray(start, start + size);
      p += size;

      // Type 0 is the only one whose two bytes have a known reading: a WORD. The others stay raw.
      entries.push(type === EntryType.Value16 && size >= 2
        ? { type, data, value: dv.getUint16(start, true) }
        : { type, data });

      if (type === EntryType.GroupName) name = fixedText(data, 0, data.length);
    }

    groups.push({ name, entries });
  }

  return groups;
}

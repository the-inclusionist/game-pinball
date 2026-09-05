// SPDX-License-Identifier: AGPL-3.0-or-later
// tests/helpers/partout — a builder for synthetic PARTOUT files.
//
// WHY A BUILDER AND NOT A FIXTURE FILE: PINBALL.DAT is third-party work and cannot be committed (see
// .gitignore). A test depending on it would only run on a machine that owns the game. This builder
// produces MINIMAL files in the same format, so the parser's logic is testable on its own; the real
// file arrives later, at the conformance gate, checked against AdrienTD's dump.
//
// Format per the upstream's `Doc/.dat file format.txt`.

export const SIGNATURE = 'PARTOUT(4.0)RESOURCE';

/** A FIXED-width text field, zero padded — that is how the format stores the header's three. */
function fixedText(text: string, length: number): Uint8Array {
  const b = new Uint8Array(length);
  for (let i = 0; i < text.length && i < length; i++) b[i] = text.charCodeAt(i);
  return b;
}

export interface SyntheticHeader {
  readonly signature?: string;
  readonly appName?: string;
  readonly description?: string;
  readonly groupCount?: number;
  /** Raw body. Empty by default: the header is testable with no groups at all. */
  readonly body?: Uint8Array;
}

/** Assembles a complete PARTOUT file. The body starts at 0xB7, which the upstream dump confirms. */
export function buildPartout(c: SyntheticHeader = {}): Uint8Array {
  const body = c.body ?? new Uint8Array(0);
  const HEADER_SIZE = 0xb7;
  const file = new Uint8Array(HEADER_SIZE + body.length);
  const dv = new DataView(file.buffer);

  file.set(fixedText(c.signature ?? SIGNATURE, 21), 0x00);
  file.set(fixedText(c.appName ?? '3D-Pinball', 50), 0x15);
  file.set(fixedText(c.description ?? 'Space Cadet Table', 100), 0x47);
  dv.setUint32(0xab, file.length, true);
  dv.setUint16(0xaf, c.groupCount ?? 0, true);
  dv.setUint32(0xb1, body.length, true);
  dv.setUint16(0xb5, 0, true);
  file.set(body, HEADER_SIZE);

  return file;
}

/* ===================== BODY: GROUPS AND ENTRIES ===================== */

/** An ordinary entry: type byte, size DWORD, data. (Type 0 does NOT follow this shape.) */
export function entry(type: number, data: Uint8Array): Uint8Array {
  const b = new Uint8Array(1 + 4 + data.length);
  b[0] = type;
  new DataView(b.buffer).setUint32(1, data.length, true);
  b.set(data, 5);
  return b;
}

/**
 * THE TYPE 0 ENTRY, the format's trap: the type byte is followed by a WORD of value, not by the size
 * DWORD. A reader that treats every type alike loses sync here and reads garbage through the rest of
 * the file — without throwing, which is the worst way to fail.
 */
export function value16Entry(value: number): Uint8Array {
  const b = new Uint8Array(3);
  b[0] = 0;
  new DataView(b.buffer).setUint16(1, value, true);
  return b;
}

/**
 * A FIXED-SIZE entry: type byte followed straight by the data, with no size DWORD. The upstream's
 * `_field_size[]` table says which types are like this — 0 and 2 with two bytes, 13 with none.
 */
export function fixedSizeEntry(type: number, data: Uint8Array): Uint8Array {
  const b = new Uint8Array(1 + data.length);
  b[0] = type;
  b.set(data, 1);
  return b;
}

/** A group: one byte with the entry count, followed by the entries. */
export function group(...entries: Uint8Array[]): Uint8Array {
  const total = entries.reduce((n, e) => n + e.length, 0);
  const b = new Uint8Array(1 + total);
  b[0] = entries.length;
  let p = 1;
  for (const e of entries) { b.set(e, p); p += e.length; }
  return b;
}

/** Concatenates groups into a body. */
export function bodyOf(...groups: Uint8Array[]): Uint8Array {
  const total = groups.reduce((n, g) => n + g.length, 0);
  const b = new Uint8Array(total);
  let p = 0;
  for (const g of groups) { b.set(g, p); p += g.length; }
  return b;
}

/** Bytes of a latin1 string — what type 3 (group name) and type 9 (string) entries carry. */
export function text(s: string): Uint8Array {
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}

/** Bytes of a little-endian int16 array — the payload of a type 10 entry. */
export function int16s(...values: number[]): Uint8Array {
  const b = new Uint8Array(values.length * 2);
  const dv = new DataView(b.buffer);
  values.forEach((v, i) => dv.setInt16(i * 2, v, true));
  return b;
}

/* ===================== 8BPP BITMAP ===================== */

/** The bits of the bitmap header's flags byte, per the upstream spec. */
export const BITMAP_FLAG = { rawUnaligned: 1, dib: 2, spliced: 4 } as const;

export interface SyntheticBitmap {
  readonly resolution?: number;
  readonly width: number;
  readonly height: number;
  readonly x?: number;
  readonly y?: number;
  readonly flags?: number;
  readonly data: Uint8Array;
}

/** Builds the payload of a type 1 entry (8bpp bitmap): 14 header bytes plus data. */
export function bitmap8(b: SyntheticBitmap): Uint8Array {
  const buf = new Uint8Array(14 + b.data.length);
  const dv = new DataView(buf.buffer);
  dv.setInt8(0, b.resolution ?? -1);
  dv.setUint16(1, b.width, true);
  dv.setUint16(3, b.height, true);
  dv.setUint16(5, b.x ?? 0, true);
  dv.setUint16(7, b.y ?? 0, true);
  dv.setUint32(9, b.data.length, true);
  dv.setUint8(13, b.flags ?? 0);
  buf.set(b.data, 14);
  return buf;
}

/* ===================== 16BPP Z-MAP ===================== */

export interface SyntheticZMap {
  readonly width: number;
  readonly height: number;
  /** Pitch/2, in 16-bit cells. Equal to the width by default. */
  readonly stride?: number;
  /** Depths, one per cell. By default a map consistent with stride x height. */
  readonly depths?: Uint16Array;
}

/** Builds the payload of a type 12 entry: 14 header bytes plus 16-bit depths. */
export function zmap16(z: SyntheticZMap): Uint8Array {
  const stride = z.stride ?? z.width;
  const depths = z.depths ?? new Uint16Array(stride * z.height);
  const buf = new Uint8Array(14 + depths.length * 2);
  const dv = new DataView(buf.buffer);
  dv.setUint16(0, z.width, true);
  dv.setUint16(2, z.height, true);
  dv.setUint16(4, stride, true);
  dv.setUint16(12, 80, true); // the spec's "Unknown (80)"
  for (let i = 0; i < depths.length; i++) dv.setUint16(14 + i * 2, depths[i]!, true);
  return buf;
}

/* ===================== SPLICED STREAM ===================== */

export interface SplicedRun {
  /** How many destination pixels to skip before this run. */
  readonly skip: number;
  readonly pixels: readonly { readonly depth: number; readonly index: number }[];
}

/**
 * Builds the upstream's spliced stream. Each run is [skip:int16][count:uint16] followed by `count`
 * pixels of THREE bytes: [depth:uint16][index:uint8]. A negative skip ends it.
 *
 * The three bytes per pixel are the point: a run of odd length leaves the stream on an ODD position,
 * and the next run reads its int16 unaligned. A reader indexed in 16-bit words cannot express that.
 */
export function splicedStream(runs: readonly SplicedRun[]): Uint8Array {
  const bytes: number[] = [];
  const push16 = (v: number) => { bytes.push(v & 0xff, (v >> 8) & 0xff); };
  for (const r of runs) {
    push16(r.skip);
    push16(r.pixels.length);
    for (const p of r.pixels) { push16(p.depth); bytes.push(p.index & 0xff); }
  }
  push16(0xffff); // skip -1: ends the stream
  return new Uint8Array(bytes);
}

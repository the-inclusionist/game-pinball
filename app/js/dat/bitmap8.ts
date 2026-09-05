// SPDX-License-Identifier: AGPL-3.0-or-later
// dat/bitmap8 — the PARTOUT's 8-bits-per-pixel bitmap (entry type 1).
//
// A 14-byte header, per `Doc/.dat file format.txt`:
//   +0  resolution  BYTE  0=640x480 · 1=800x600 · 2=1024x768 · -1=valid at all of them
//   +1  width       WORD
//   +3  height      WORD
//   +5  x           WORD
//   +7  y           WORD
//   +9  size        DWORD
//   +13 flags       BYTE
//   +14 data
//
// THE RESOLUTION IS SIGNED and -1 is the common case for small sprites: a `getUint8` would return 255,
// and a resolution filter would then discard exactly the entries meant to survive it.

const OFF = { resolution: 0, width: 1, height: 3, x: 5, y: 7, size: 9, flags: 13 } as const;
export const HEADER_SIZE = 14;

/**
 * Bits of the flags byte. Bit 0 is `RawBmpUnaligned` upstream: set means UNALIGNED. The spec in `Doc/`
 * calls it "Raw bmp align", which invites the opposite reading — and the opposite reading makes the
 * alignment assertion reject exactly the bitmaps that are correct.
 */
const BIT = { rawUnaligned: 1, dib: 2, spliced: 4 } as const;

/** The three `BitmapTypes` of the upstream. The order they are tested in matters — see `typeOf`. */
export const BitmapType = { Raw: 'raw', Dib: 'dib', Spliced: 'spliced' } as const;
export type BitmapType = (typeof BitmapType)[keyof typeof BitmapType];

/**
 * NOT COMMUTATIVE. gdrv.cpp tests Spliced, then Dib, and only then falls back to Raw — so a bitmap with
 * both bits set is Spliced, not Dib. Testing Dib first would misclassify it, and the symptom would be a
 * scrambled image with nothing pointing at the classification.
 */
function typeOf(flags: number): BitmapType {
  if (flags & BIT.spliced) return BitmapType.Spliced;
  if (flags & BIT.dib) return BitmapType.Dib;
  return BitmapType.Raw;
}

/**
 * The stride of the INDEXED (8bpp) rows, which rounds up to a multiple of 4 when the width does not.
 * The colour destination buffer uses the raw width — two strides on one bitmap, and swapping them
 * skews the image by one column per row.
 *
 * `null` for spliced: that format has no rows, and handing back a number would invite someone to walk
 * it as though it had.
 */
function indexedStrideOf(type: BitmapType, width: number): number | null {
  if (type === BitmapType.Spliced) return null;
  return width % 4 === 0 ? width : width - (width % 4) + 4;
}

export interface BitmapHeader {
  readonly resolution: number;
  readonly width: number;
  readonly height: number;
  readonly x: number;
  readonly y: number;
  readonly dataSize: number;
  readonly rawUnaligned: boolean;
  readonly isDib: boolean;
  /** Combines bitmap and z-map in an RLE-like scheme (the upstream's "skipline"). */
  readonly isSpliced: boolean;
  readonly type: BitmapType;
  /** Stride of the indexed rows; `null` for spliced, which has no rows. */
  readonly indexedStride: number | null;
}

export function readBitmapHeader(payload: Uint8Array): BitmapHeader {
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const flags = dv.getUint8(OFF.flags);
  const width = dv.getUint16(OFF.width, true);
  const type = typeOf(flags);
  return {
    type,
    indexedStride: indexedStrideOf(type, width),
    resolution: dv.getInt8(OFF.resolution),
    width,
    height: dv.getUint16(OFF.height, true),
    x: dv.getUint16(OFF.x, true),
    y: dv.getUint16(OFF.y, true),
    dataSize: dv.getUint32(OFF.size, true),
    rawUnaligned: (flags & BIT.rawUnaligned) !== 0,
    isDib: (flags & BIT.dib) !== 0,
    isSpliced: (flags & BIT.spliced) !== 0,
  };
}

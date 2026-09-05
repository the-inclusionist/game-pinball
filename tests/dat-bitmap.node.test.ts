// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { bitmap8, BITMAP_FLAG } from './helpers/partout.js';
import { readBitmapHeader, BitmapType } from '../app/js/dat/bitmap8.js';

describe('bitmap8 — header', () => {
  test('reads dimensions, position and data size', () => {
    const payload = bitmap8({ width: 365, height: 470, x: 12, y: 34, data: new Uint8Array(7) });

    const h = readBitmapHeader(payload);

    expect(h.width).toBe(365);
    expect(h.height).toBe(470);
    expect(h.x).toBe(12);
    expect(h.y).toBe(34);
    expect(h.dataSize).toBe(7);
  });

  test('resolution -1 means "valid at every resolution"', () => {
    // Read unsigned it would be 255, and a resolution filter would discard exactly the entries meant to
    // survive it.
    const payload = bitmap8({ resolution: -1, width: 1, height: 1, data: new Uint8Array(1) });

    expect(readBitmapHeader(payload).resolution).toBe(-1);
  });

  test('separates the three flag bits instead of handing back the raw byte', () => {
    const payload = bitmap8({
      width: 1, height: 1, data: new Uint8Array(1),
      flags: BITMAP_FLAG.dib | BITMAP_FLAG.spliced,
    });

    const h = readBitmapHeader(payload);

    expect(h.isDib).toBe(true);
    expect(h.isSpliced).toBe(true);
    expect(h.rawUnaligned).toBe(false);
  });
});

describe('bitmap8 — type derived from the flags', () => {
  // The precedence comes from gdrv.cpp and is NOT commutative: Spliced is tested first, then Dib, and
  // the rest falls to Raw. A reader testing Dib first would misclassify every bitmap with both bits.
  test('spliced beats dib when both bits are set', () => {
    const p = bitmap8({ width: 4, height: 1, data: new Uint8Array(4), flags: BITMAP_FLAG.dib | BITMAP_FLAG.spliced });

    expect(readBitmapHeader(p).type).toBe(BitmapType.Spliced);
  });

  test('without spliced, the dib bit decides', () => {
    const p = bitmap8({ width: 4, height: 1, data: new Uint8Array(4), flags: BITMAP_FLAG.dib });

    expect(readBitmapHeader(p).type).toBe(BitmapType.Dib);
  });

  test('with no bit at all it is a raw bitmap', () => {
    const p = bitmap8({ width: 4, height: 1, data: new Uint8Array(4), flags: 0 });

    expect(readBitmapHeader(p).type).toBe(BitmapType.Raw);
  });
});

describe('bitmap8 — indexed stride', () => {
  // The INDEXED (8bpp) rows are padded to a multiple of 4 bytes; the color destination buffer is not.
  // Two different strides on one object, and confusing them skews the image.
  test('a width that is not a multiple of 4 rounds up to the next one', () => {
    const p = bitmap8({ width: 365, height: 2, data: new Uint8Array(368 * 2), flags: BITMAP_FLAG.rawUnaligned });

    expect(readBitmapHeader(p).indexedStride).toBe(368);
  });

  test('a width already a multiple of 4 keeps the stride equal to the width', () => {
    const p = bitmap8({ width: 364, height: 1, data: new Uint8Array(364) });

    expect(readBitmapHeader(p).indexedStride).toBe(364);
  });

  test('spliced has no rows, so it has no indexed stride', () => {
    const p = bitmap8({ width: 365, height: 470, data: new Uint8Array(7), flags: BITMAP_FLAG.spliced });

    expect(readBitmapHeader(p).indexedStride).toBeNull();
  });
});

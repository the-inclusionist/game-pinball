// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { bitmap8, BITMAP_FLAG } from './helpers/partout.js';
import { readBitmapHeader, readIndexedBitmap, BitmapType } from '../app/js/dat/bitmap8.js';
import { readFileSync, existsSync } from 'node:fs';

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

/**
 * ⚠️ A NULL STRIDE IS A REFUSAL, AND `?? width` UNDOES IT.
 *
 * `indexedStrideOf` returns null for spliced on purpose — "that format has no rows, and handing back a
 * number would invite someone to walk it as though it had". Both decoders then wrote
 * `header.indexedStride ?? header.width`, which is exactly the invitation, in both places. A spliced
 * bitmap fed through that comes out as a scrambled picture and no message at all: its stream is
 * [skip][count][depth,index]... in bytes, not rows of indices.
 *
 * The shipped PINBALL.DAT carries none, so nothing was ever wrong on screen. The trap was waiting for
 * a different table — the authored one of phase 8, or anybody's modified archive.
 */
describe('bitmap8 — unpacking a whole bitmap', () => {
  test('a raw bitmap comes back flipped and de-padded, one byte per pixel', () => {
    // Two rows of a 2-wide bitmap padded to a stride of 4: the source's LAST row is the picture's first.
    const payload = bitmap8({
      width: 2, height: 2,
      data: Uint8Array.from([10, 11, 0, 0, 20, 21, 0, 0]),
      flags: BITMAP_FLAG.rawUnaligned,
    });

    const { header, indices } = readIndexedBitmap(payload);

    expect(header.width).toBe(2);
    expect([...indices]).toEqual([20, 21, 10, 11]);
  });

  test('⚠️ a SPLICED bitmap is refused rather than read as rows', () => {
    const payload = bitmap8({ width: 4, height: 2, data: new Uint8Array(9), flags: BITMAP_FLAG.spliced });

    expect(() => readIndexedBitmap(payload)).toThrow(/spliced/i);
  });

  test('and the shipped archive carries none, which is why nothing was ever wrong on screen', async () => {
    const DAT = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.DAT';
    if (!existsSync(DAT)) return expect(existsSync(DAT)).toBe(false);
    const { loadTable } = await import('../app/js/dat/loader.js');
    const { EntryType } = await import('../app/js/dat/partman.js');
    const file = new Uint8Array(readFileSync(DAT));

    const headers = loadTable(file).groups.flatMap((g) => g.entries
      .filter((e) => e.type === EntryType.Bitmap8 && e.data)
      .map((e) => readBitmapHeader(e.data!)));

    expect(headers).toHaveLength(318);
    expect(headers.filter((h) => h.isSpliced), 'spliced bitmaps').toHaveLength(0);
    expect(headers.every((h) => h.type === BitmapType.Raw), 'all 318 are raw').toBe(true);
  });
});

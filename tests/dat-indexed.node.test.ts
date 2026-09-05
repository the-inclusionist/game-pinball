// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { unpackIndexed } from '../app/js/dat/indexed.js';

describe('indexed — unpacking the rows', () => {
  test('flips the rows: the LAST in the file is the first on screen', () => {
    // gdrv::ApplyPalette walks the source from Height-1 down to 0 while writing the destination top
    // down. It is the Windows DIB convention. Reading in order produces the table upside down — and the
    // upstream comment right there says "flip horizontally", which is wrong: the flip is vertical.
    const data = new Uint8Array([
      10, 11, // bottom row on screen
      20, 21, // top row on screen
    ]);

    const r = unpackIndexed(data, { width: 2, height: 2, indexedStride: 2 });

    expect(Array.from(r)).toEqual([20, 21, 10, 11]);
  });

  test('reads with the indexed stride and discards the end-of-row padding', () => {
    // A width of 3 pushes the stride to 4: each row carries one padding byte that is not image.
    const data = new Uint8Array([
      1, 2, 3, 0xee,
      4, 5, 6, 0xee,
    ]);

    const r = unpackIndexed(data, { width: 3, height: 2, indexedStride: 4 });

    expect(Array.from(r)).toEqual([4, 5, 6, 1, 2, 3]);
  });

  test('the result has exactly width x height cells', () => {
    const r = unpackIndexed(new Uint8Array(4 * 5), { width: 3, height: 5, indexedStride: 4 });

    expect(r).toHaveLength(15);
  });
});

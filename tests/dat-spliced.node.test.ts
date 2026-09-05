// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { splicedStream } from './helpers/partout.js';
import { splitSpliced, FILL_INDEX, FILL_DEPTH } from '../app/js/dat/spliced.js';

const px = (depth: number, index: number) => ({ depth, index });

describe('spliced — splitting into an indexed bitmap and a z-map', () => {
  test('writes index and depth at the positions the skip points to', () => {
    const data = splicedStream([{ skip: 1, pixels: [px(0x1111, 7), px(0x2222, 8)] }]);

    const r = splitSpliced(data, { width: 4, height: 1, tableWidth: 4 });

    expect(r.indices[1]).toBe(7);
    expect(r.indices[2]).toBe(8);
    expect(r.depths[1]).toBe(0x1111);
    expect(r.depths[2]).toBe(0x2222);
  });

  test('whatever the run does not touch stays at the fill, not at zero', () => {
    // The original fills the bitmap with 0xFF (index 255, which the palette defines as white) and the
    // z-map with 0xFFFF (as far as possible). Filling with zero would put everything in front of
    // everything else.
    const data = splicedStream([{ skip: 2, pixels: [px(0x1234, 9)] }]);

    const r = splitSpliced(data, { width: 4, height: 1, tableWidth: 4 });

    expect(r.indices[0]).toBe(FILL_INDEX);
    expect(r.depths[0]).toBe(FILL_DEPTH);
  });

  test('an ODD run knocks the stream off alignment and the next run still reads right', () => {
    // THREE bytes per pixel: a run of one pixel leaves the cursor on an odd position. A reader walking
    // the stream in 16-bit words would read the next skip one byte out, and the symptom would be the
    // image falling apart from the first sprite with an odd count — never at the first pixel, which is
    // where anyone would look.
    const data = splicedStream([
      { skip: 0, pixels: [px(0x0101, 1)] },
      { skip: 1, pixels: [px(0x0202, 2)] },
    ]);

    const r = splitSpliced(data, { width: 4, height: 1, tableWidth: 4 });

    expect(r.indices[0]).toBe(1);
    expect(r.indices[2]).toBe(2);
    expect(r.depths[2]).toBe(0x0202);
  });

  test('a negative skip ends the stream', () => {
    const data = splicedStream([{ skip: 0, pixels: [px(0x0303, 3)] }]);

    const r = splitSpliced(data, { width: 4, height: 1, tableWidth: 4 });

    expect(r.indices[1]).toBe(FILL_INDEX);
  });

  test('a skip larger than the width is corrected by the table width', () => {
    // `stride += bmp.Width - tableWidth`: the skip was recorded in terms of the TABLE's width at the
    // original resolution, and has to be re-expressed in this bitmap's width.
    const data = splicedStream([{ skip: 10, pixels: [px(0x0404, 4)] }]);

    // Two rows of 8: the destination has 16 cells, and 8 is the start of the second row.
    const r = splitSpliced(data, { width: 8, height: 2, tableWidth: 10 });

    expect(r.indices[8]).toBe(4); // 10 + 8 - 10 = 8
  });
});

describe('spliced — diagnostics', () => {
  test('counts the pixels written and says it ended on the terminator', () => {
    const data = splicedStream([{ skip: 0, pixels: [px(1, 1), px(2, 2)] }]);

    const r = splitSpliced(data, { width: 4, height: 1, tableWidth: 4 });

    expect(r.pixelsWritten).toBe(2);
    expect(r.endedCleanly).toBe(true);
    expect(r.outOfBounds).toBe(0);
  });

  test('COUNTS what falls outside instead of swallowing it', () => {
    // Writing outside is clamped so nothing overflows, but silencing it would turn a decoding error
    // into a sprite with pieces missing — visible, unexplainable, and with nothing pointing at the cause.
    const data = splicedStream([{ skip: 3, pixels: [px(1, 1), px(2, 2), px(3, 3)] }]);

    const r = splitSpliced(data, { width: 4, height: 1, tableWidth: 4 });

    expect(r.outOfBounds).toBe(2); // destinations 4 and 5
  });

  test('a stream cut short did not end cleanly', () => {
    const complete = splicedStream([{ skip: 0, pixels: [px(1, 1), px(2, 2)] }]);
    const truncated = complete.subarray(0, complete.length - 4);

    expect(splitSpliced(truncated, { width: 4, height: 1, tableWidth: 4 }).endedCleanly).toBe(false);
  });
});

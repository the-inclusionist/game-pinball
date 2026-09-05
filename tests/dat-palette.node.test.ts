// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readPalette } from '../app/js/dat/palette.js';

/** A raw palette: 256 little-endian DWORDs, which is how the file stores it. */
function rawPalette(colours: number[]): Uint8Array {
  const b = new Uint8Array(1024);
  const dv = new DataView(b.buffer);
  for (let i = 0; i < 256; i++) dv.setUint32(i * 4, colours[i] ?? 0, true);
  return b;
}

describe('palette — entry type 5', () => {
  test('reads 256 colours out of a 1024-byte payload', () => {
    expect(readPalette(rawPalette([])).length).toBe(256);
  });

  test('decomposes the colour in ColorRgba order: A<<24 | R<<16 | G<<8 | B', () => {
    // 0x00204060: alpha 0, red 0x20, green 0x40, blue 0x60.
    const p = readPalette(rawPalette([0x00204060]));

    expect(p.red(0)).toBe(0x20);
    expect(p.green(0)).toBe(0x40);
    expect(p.blue(0)).toBe(0x60);
  });

  test('the alpha comes back ZERO from the file — opacity is not the .DAT’s business', () => {
    // A Windows PALETTEENTRY carries R, G, B and peFlags, and peFlags is 0. Reading that zero as alpha
    // and painting with it draws the whole table transparent, and the symptom only shows up in the
    // render phase, far from here. Pinned by this test: opacity is decided by whoever draws.
    expect(readPalette(rawPalette([0x00204060])).alpha(0)).toBe(0);
  });
});

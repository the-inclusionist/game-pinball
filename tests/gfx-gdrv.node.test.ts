// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { buildDisplayPalette, applyPalette } from '../app/js/gfx/gdrv.js';
import { pack } from '../app/js/gfx/framebuffer.js';

/** A file palette where colour `i` is (i, i+1, i+2). */
const fakePalette = {
  red: (i: number) => i & 0xff,
  green: (i: number) => (i + 1) & 0xff,
  blue: (i: number) => (i + 2) & 0xff,
};

describe('gdrv — the display palette', () => {
  test('index 0 is TRANSPARENT, which is why the transparency test is "colour != 0"', () => {
    expect(buildDisplayPalette(fakePalette)[0]).toBe(0);
  });

  test('indices 1 to 9 are the Windows system palette, hardcoded', () => {
    const p = buildDisplayPalette(fakePalette);

    expect(p[1]).toBe(pack(0x80, 0, 0, 0xff));
    expect(p[7]).toBe(pack(0xc0, 0xc0, 0xc0, 0xff));
    expect(p[9]).toBe(pack(0xa6, 0xca, 0xf0, 0xff));
  });

  test('the file colours (10 to 245) come out OPAQUE — the original alpha 2 is a sentinel', () => {
    // The upstream does `SetAlpha(2)` on those colours. That is not opacity: SDL ignores alpha on that
    // path, and the 2 only has to be NON-ZERO so the `Color != 0` test counts the pixel as drawable.
    // Canvas does NOT ignore alpha: copying the 2 would paint the whole table at 0.8% opacity.
    // Translating the sentinel to 255 keeps the exact semantics and fixes the medium.
    const p = buildDisplayPalette(fakePalette);

    expect(p[10]).toBe(pack(10, 11, 12, 0xff));
    expect(p[245]).toBe(pack(245, 246, 247, 0xff));
  });

  test('indices 246 to 254 are never assigned and stay transparent', () => {
    const p = buildDisplayPalette(fakePalette);

    expect(p[246]).toBe(0);
    expect(p[254]).toBe(0);
  });

  test('index 255 is opaque white', () => {
    expect(buildDisplayPalette(fakePalette)[255]).toBe(pack(255, 255, 255, 255));
  });
});

describe('gdrv — applying the palette', () => {
  test('turns indices into colours, at the size asked for', () => {
    const p = buildDisplayPalette(fakePalette);
    const indices = new Uint8Array([255, 0, 10, 1]);

    const fb = applyPalette(indices, p, 2, 2);

    expect(fb.width).toBe(2);
    expect(fb.pixels[0]).toBe(pack(255, 255, 255, 255));
    expect(fb.pixels[1]).toBe(0);
    expect(fb.pixels[2]).toBe(pack(10, 11, 12, 0xff));
  });
});

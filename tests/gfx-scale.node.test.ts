// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { createFramebuffer, pack } from '../app/js/gfx/framebuffer.js';
import { createZBuffer } from '../app/js/gfx/zbuffer.js';
import { halve, halveNearest, halveDepth } from '../app/js/gfx/scale.js';

const OPAQUE = (r: number, g: number, b: number) => pack(r, g, b, 255);

function fbWith(width: number, height: number, colors: number[]) {
  const fb = createFramebuffer(width, height);
  colors.forEach((c, i) => { fb.pixels[i] = c; });
  return fb;
}

describe('scale — 2x2 box average', () => {
  test('each output pixel is the average of the four inputs', () => {
    const fb = fbWith(2, 2, [OPAQUE(0, 0, 0), OPAQUE(100, 100, 100), OPAQUE(200, 200, 200), OPAQUE(60, 60, 60)]);

    const r = halve(fb);

    expect([r.width, r.height]).toEqual([1, 1]);
    expect(r.pixels[0]).toBe(OPAQUE(90, 90, 90)); // (0+100+200+60)/4
  });

  test('an odd dimension rounds UP and the edge uses whatever is there', () => {
    // 365 becomes 183, not 182: dropping the last column would cut a strip off the table.
    const fb = fbWith(3, 1, [OPAQUE(10, 10, 10), OPAQUE(30, 30, 30), OPAQUE(80, 80, 80)]);

    const r = halve(fb);

    expect(r.width).toBe(2);
    expect(r.pixels[0]).toBe(OPAQUE(20, 20, 20)); // average of 10 and 30
    expect(r.pixels[1]).toBe(OPAQUE(80, 80, 80)); // alone at the edge
  });

  test('a transparent pixel does NOT contaminate its neighbor color', () => {
    // A naive average would add the (0,0,0,0) as black and darken every sprite edge — the classic dark
    // halo of mixing color without weighting by alpha.
    const fb = fbWith(2, 2, [OPAQUE(255, 0, 0), OPAQUE(255, 0, 0), 0, 0]);

    const r = halve(fb);

    expect(r.bytes[0]).toBe(255); // red intact
    expect(r.bytes[1]).toBe(0);
    expect(r.bytes[3]).toBe(128); // alpha is the mean: two opaque out of four
  });

  test('four transparent pixels give transparent, not black', () => {
    expect(halve(createFramebuffer(2, 2)).pixels[0]).toBe(0);
  });
});

describe('scale — nearest neighbor', () => {
  test('samples the top-left pixel of each block, like the original ScaleIndexed', () => {
    const fb = fbWith(2, 2, [OPAQUE(1, 1, 1), OPAQUE(2, 2, 2), OPAQUE(3, 3, 3), OPAQUE(4, 4, 4)]);

    expect(halveNearest(fb).pixels[0]).toBe(OPAQUE(1, 1, 1));
  });
});

describe('scale — depth', () => {
  test('SAMPLES rather than averaging: an average would invent a surface that does not exist', () => {
    // Between a ramp at 100 and the table at 500 there is nothing at 300. An averaged depth would put
    // the ball inside the ramp across half the edge pixels.
    const z = createZBuffer(2, 2);
    z.depths.set([100, 500, 500, 500]);

    const r = halveDepth(z);

    expect(r.depths[0]).toBe(100);
  });
});

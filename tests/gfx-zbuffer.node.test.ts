// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { createFramebuffer, pack } from '../app/js/gfx/framebuffer.js';
import { createZBuffer, fillZ, paint, paintFlat, FAR } from '../app/js/gfx/zbuffer.js';

const COLOUR_A = pack(10, 20, 30, 255);
const COLOUR_B = pack(40, 50, 60, 255);

/** A 1x1 scene/depth pair with the scene already filled. */
function scene(depth: number) {
  const fb = createFramebuffer(1, 1);
  const z = createZBuffer(1, 1);
  fb.pixels[0] = COLOUR_A;
  fillZ(z, depth);
  return { fb, z };
}

describe('zbuffer — paint (a sprite carrying its own depth)', () => {
  test('writes colour AND depth when the source is nearer', () => {
    const d = scene(500);
    const s = scene(100); s.fb.pixels[0] = COLOUR_B;

    paint(d.fb, d.z, s.fb, s.z, { width: 1, height: 1 });

    expect(d.fb.pixels[0]).toBe(COLOUR_B);
    expect(d.z.depths[0]).toBe(100);
  });

  test('writes nothing when the source is further away', () => {
    const d = scene(100);
    const s = scene(500); s.fb.pixels[0] = COLOUR_B;

    paint(d.fb, d.z, s.fb, s.z, { width: 1, height: 1 });

    expect(d.fb.pixels[0]).toBe(COLOUR_A);
    expect(d.z.depths[0]).toBe(100);
  });

  test('on a TIE the source wins, so the last drawn is on top', () => {
    // The original compares `dstZ >= srcZ`. The `=` is not a detail: it decides the order between two
    // sprites at the same depth, and swapping it for `>` would silently invert which one shows.
    const d = scene(300);
    const s = scene(300); s.fb.pixels[0] = COLOUR_B;

    paint(d.fb, d.z, s.fb, s.z, { width: 1, height: 1 });

    expect(d.fb.pixels[0]).toBe(COLOUR_B);
  });
});

describe('zbuffer — paintFlat (a sprite at a single depth, like the ball)', () => {
  test('draws where the scene is further away than the ball', () => {
    const d = scene(500);
    const ball = createFramebuffer(1, 1); ball.pixels[0] = COLOUR_B;

    paintFlat(d.fb, d.z, ball, 100, { width: 1, height: 1 });

    expect(d.fb.pixels[0]).toBe(COLOUR_B);
  });

  test('does NOT change the scene depth — the ball leaves no relief', () => {
    const d = scene(500);
    const ball = createFramebuffer(1, 1); ball.pixels[0] = COLOUR_B;

    paintFlat(d.fb, d.z, ball, 100, { width: 1, height: 1 });

    expect(d.z.depths[0]).toBe(500);
  });

  test('uses a STRICT >: on a tie the ball does not appear', () => {
    // Here the original uses `*zPtr > depth`, not the `>=` of `paint`. The two comparisons differ on
    // purpose, and unifying them would make the ball flicker along the edges of the ramps.
    const d = scene(300);
    const ball = createFramebuffer(1, 1); ball.pixels[0] = COLOUR_B;

    paintFlat(d.fb, d.z, ball, 300, { width: 1, height: 1 });

    expect(d.fb.pixels[0]).toBe(COLOUR_A);
  });

  test('skips a fully transparent source pixel', () => {
    const d = scene(500);
    const ball = createFramebuffer(1, 1); // zero is transparent

    paintFlat(d.fb, d.z, ball, 100, { width: 1, height: 1 });

    expect(d.fb.pixels[0]).toBe(COLOUR_A);
  });
});

describe('zbuffer — shape', () => {
  test('the stride rounds up to a multiple of 4, like the original pad()', () => {
    expect(createZBuffer(365, 2).stride).toBe(368);
    expect(createZBuffer(364, 2).stride).toBe(364);
  });

  test('it starts as FAR away as possible', () => {
    // Starting at zero would put the background in front of everything and nothing would be drawn.
    expect(createZBuffer(2, 1).depths[0]).toBe(FAR);
  });
});

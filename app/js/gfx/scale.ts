// SPDX-License-Identifier: AGPL-3.0-or-later
// gfx/scale — the halving that takes the table from 365x470 to 183x235.
//
// ========================= WHY THERE IS A CHOICE HERE AND NONE IN THE ORIGINAL =========================
// The upstream's `gdrv_bitmap8::ScaleIndexed` is plain nearest neighbor (`px = x / scaleX`, truncated).
// Not by taste: it scales PALETTE INDICES, and the average of two indices is a third index pointing at
// a color unrelated to either. Nearest is the only valid operation there.
//
// We scale AFTER the palette, in RGBA, where an average exists and means something. So the choice is a
// choice again, and it is aesthetic: a box average keeps detail and softens the pixel; nearest keeps
// the hard pixel-art edge and loses the one-pixel highlights on the ramps. Both are implemented, and
// the decision belongs to whoever draws, not to whoever ports.
//
// ========================= AND DEPTH HAS NO CHOICE =========================
// Averaging depth INVENTS surfaces. Between a ramp at 100 and the table at 500 there is nothing at 300,
// and an edge of averaged depths would put the ball inside the ramp across half its pixels. Depth can
// only be sampled.

import { createFramebuffer, pack, type Framebuffer } from './framebuffer.js';
import { createZBuffer, type ZBuffer } from './zbuffer.js';

const half = (n: number): number => Math.ceil(n / 2); // UP: 365 becomes 183, not 182 cutting a strip off

/**
 * A 2x2 box average WEIGHTED BY ALPHA.
 *
 * Summing a transparent pixel's (0,0,0,0) as if it were black darkens every sprite edge — the classic
 * dark halo of mixing color without weighting by alpha. Here color comes only from pixels that have
 * alpha, and alpha itself is the plain mean: a half-transparent block stays half transparent, with the
 * right color.
 */
export function halve(fb: Framebuffer): Framebuffer {
  const out = createFramebuffer(half(fb.width), half(fb.height));

  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      let sumRA = 0, sumGA = 0, sumBA = 0, sumA = 0, count = 0;

      for (let dy = 0; dy < 2; dy++) {
        const sy = y * 2 + dy;
        if (sy >= fb.height) continue;
        for (let dx = 0; dx < 2; dx++) {
          const sx = x * 2 + dx;
          if (sx >= fb.width) continue;
          const i = (sy * fb.width + sx) * 4;
          const a = fb.bytes[i + 3]!;
          sumRA += fb.bytes[i]! * a;
          sumGA += fb.bytes[i + 1]! * a;
          sumBA += fb.bytes[i + 2]! * a;
          sumA += a;
          count++;
        }
      }

      out.pixels[y * out.width + x] = sumA === 0
        ? 0
        : pack(
            Math.round(sumRA / sumA), Math.round(sumGA / sumA), Math.round(sumBA / sumA),
            Math.round(sumA / count),
          );
    }
  }

  return out;
}

/** Nearest neighbor, as the original's `ScaleIndexed`: the top-left sample of each block. */
export function halveNearest(fb: Framebuffer): Framebuffer {
  const out = createFramebuffer(half(fb.width), half(fb.height));
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      out.pixels[y * out.width + x] = fb.pixels[(y * 2) * fb.width + x * 2]!;
    }
  }
  return out;
}

/** Sampling, never averaging — see this module's header. */
export function halveDepth(z: ZBuffer): ZBuffer {
  const out = createZBuffer(half(z.width), half(z.height));
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      out.depths[y * out.stride + x] = z.depths[(y * 2) * z.stride + x * 2]!;
    }
  }
  return out;
}

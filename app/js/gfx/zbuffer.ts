// SPDX-License-Identifier: AGPL-3.0-or-later
// gfx/zbuffer — the scene's depth, and the two ways to paint against it. Port of `zdrv.cpp`.
//
// ========================= THE TWO PAINTS DIFFER ON PURPOSE =========================
// The original has two functions that look like the same thing and are not, and merging them breaks
// the game in two different ways:
//
//   `paint` (zdrv::paint) — for a sprite that HAS its own depth (a ramp, a wall).
//       Compares `destination >= source` and writes BOTH COLOUR AND DEPTH. The sprite carves the
//       scene's relief. The `=` settles ties: on a tie the source wins, so the last drawn is on top.
//
//   `paintFlat` (zdrv::paint_flat) — for a sprite at a single depth (the ball).
//       Compares `destination > depth`, STRICTLY, writes only the COLOUR, and skips transparent pixels.
//       Not writing depth is what lets the ball pass without leaving a trace in the relief; the strict
//       `>` is what stops it flickering along ramp edges, where the depths meet.
//
// ========================= AND THERE ARE TWO STRIDES =========================
// The framebuffer steps by `width`; the z-buffer steps by `stride`, which rounds up to a multiple of 4
// (the original's `pad()`). Using one for the other skews depth against image, and the symptom is the
// ball disappearing in the wrong place — near the right one, and therefore hard to see.

import type { Framebuffer } from './framebuffer.js';

/** As far as possible. Starting at zero would put the background in front of everything. */
export const FAR = 0xffff;

/** `zmap_header_type::pad`: rounds up to a multiple of 4. */
function pad(width: number): number {
  return width & 3 ? width - (width & 3) + 4 : width;
}

export interface ZBuffer {
  readonly width: number;
  readonly height: number;
  /** Step between rows. NOT the width — see this module's header. */
  readonly stride: number;
  readonly depths: Uint16Array;
}

export interface Region {
  readonly width: number;
  readonly height: number;
  readonly dstX?: number;
  readonly dstY?: number;
  readonly srcX?: number;
  readonly srcY?: number;
}

export function createZBuffer(width: number, height: number): ZBuffer {
  const stride = pad(width);
  return { width, height, stride, depths: new Uint16Array(stride * height).fill(FAR) };
}

export function fillZ(z: ZBuffer, value: number): void {
  z.depths.fill(value);
}

/** `zdrv::paint`: the sprite brings its own depth and prints it into the scene. */
export function paint(dst: Framebuffer, dstZ: ZBuffer, src: Framebuffer, srcZ: ZBuffer, a: Region): void {
  const dx = a.dstX ?? 0, dy = a.dstY ?? 0, ox = a.srcX ?? 0, oy = a.srcY ?? 0;

  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const iDst = (dy + y) * dst.width + (dx + x);
      const iDstZ = (dy + y) * dstZ.stride + (dx + x);
      const iSrc = (oy + y) * src.width + (ox + x);
      const iSrcZ = (oy + y) * srcZ.stride + (ox + x);

      const sourceDepth = srcZ.depths[iSrcZ]!;
      if (dstZ.depths[iDstZ]! >= sourceDepth) {
        dst.pixels[iDst] = src.pixels[iSrc]!;
        dstZ.depths[iDstZ] = sourceDepth;
      }
    }
  }
}

/** `zdrv::paint_flat`: the sprite lies all at one depth and prints no relief at all. */
export function paintFlat(dst: Framebuffer, dstZ: ZBuffer, src: Framebuffer, depth: number, a: Region): void {
  const dx = a.dstX ?? 0, dy = a.dstY ?? 0, ox = a.srcX ?? 0, oy = a.srcY ?? 0;

  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const iDst = (dy + y) * dst.width + (dx + x);
      const iDstZ = (dy + y) * dstZ.stride + (dx + x);
      const iSrc = (oy + y) * src.width + (ox + x);

      const colour = src.pixels[iSrc]!;
      // Non-zero `Color` in the original: an all-zero pixel is transparent and is not drawn.
      if (colour !== 0 && dstZ.depths[iDstZ]! > depth) {
        dst.pixels[iDst] = colour;
      }
    }
  }
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// gfx/framebuffer — the compositing target, in the shape `gdrv.cpp` uses: a grid of 32 bits per pixel.
//
// TWO VIEWS ON THE SAME MEMORY, and that is deliberate:
//   · `pixels` (Uint32Array) is what you compose into. A sprite blit moves one word per pixel instead
//     of four bytes, which is what makes a software compositor viable in JavaScript.
//   · `bytes` (Uint8ClampedArray) is what goes straight into `new ImageData(bytes, width)`, no copy.
//
// THE BYTE ORDER IS THE TRAP. Canvas reads `data` as R, G, B, A in that sequence. Packing the 32 bits
// the wrong way swaps red and blue across the whole image — and the result does not look like a defect,
// it looks like a table in different colours. Nobody notices until they compare with the original.
//
// AND WHY THE ORDER IS DETECTED RATHER THAN ASSUMED: on a little-endian machine, the bytes R,G,B,A read
// as one word give `A<<24 | B<<16 | G<<8 | R`; on big-endian, the reverse. Every target platform today
// is little-endian, but writing the constant directly makes the assumption INVISIBLE, and an invisible
// assumption that only breaks on rare hardware is the worst kind. The probe costs one branch at load.

const LITTLE_ENDIAN = (() => {
  const probe = new ArrayBuffer(4);
  new Uint32Array(probe)[0] = 1;
  return new Uint8Array(probe)[0] === 1;
})();

/** Packs a colour into the 32-bit word whose byte reading is R, G, B, A. */
export const pack = LITTLE_ENDIAN
  ? (r: number, g: number, b: number, a: number): number =>
      (((a & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff)) >>> 0
  : (r: number, g: number, b: number, a: number): number =>
      (((r & 0xff) << 24) | ((g & 0xff) << 16) | ((b & 0xff) << 8) | (a & 0xff)) >>> 0;

export interface Framebuffer {
  readonly width: number;
  readonly height: number;
  /** The compositing view. One word per pixel. */
  readonly pixels: Uint32Array;
  /** The SAME memory as bytes, ready for `new ImageData(bytes, width)`. */
  readonly bytes: Uint8ClampedArray;
}

/**
 * Born TRANSPARENT rather than opaque black. Opaque black would hide every pixel never written, so a
 * missing sprite would look like a black sprite — a defect disguised as art. Transparent lets the
 * absence show up as absence.
 */
export function createFramebuffer(width: number, height: number): Framebuffer {
  const buf = new ArrayBuffer(width * height * 4);
  return { width, height, pixels: new Uint32Array(buf), bytes: new Uint8ClampedArray(buf) };
}

/**
 * `gdrv::copy_bitmap`: a straight rectangular copy, no transparency and no depth test.
 *
 * The compositor uses it for the two jobs that must not consult anything: restoring the background
 * over a dirty rectangle, and saving and putting back the pixels beneath a ball. Both need the pixels
 * exactly as they were, including transparent ones.
 */
export function copyBitmap(
  dst: Framebuffer, width: number, height: number, dstX: number, dstY: number,
  src: Framebuffer, srcX: number, srcY: number,
): void {
  for (let y = 0; y < height; y++) {
    const from = (srcY + y) * src.width + srcX;
    const to = (dstY + y) * dst.width + dstX;
    dst.pixels.set(src.pixels.subarray(from, from + width), to);
  }
}

// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { createFramebuffer, pack } from '../app/js/gfx/framebuffer.js';

describe('framebuffer — two views on the same memory', () => {
  test('writing through the 32-bit view shows up in the byte view', () => {
    const fb = createFramebuffer(2, 1);

    fb.pixels[0] = pack(1, 2, 3, 4);

    expect(Array.from(fb.bytes.subarray(0, 4))).toEqual([1, 2, 3, 4]);
  });

  test('the bytes come out in the R, G, B, A order ImageData expects', () => {
    // Canvas reads `data` as RGBA bytes. Packing the 32 bits the wrong way swaps red and blue across
    // the whole image, and the symptom is a table of plausible colours — nobody blinks until they
    // compare it with the original.
    const fb = createFramebuffer(1, 1);

    fb.pixels[0] = pack(0xaa, 0xbb, 0xcc, 0xdd);

    expect(fb.bytes[0]).toBe(0xaa); // R
    expect(fb.bytes[1]).toBe(0xbb); // G
    expect(fb.bytes[2]).toBe(0xcc); // B
    expect(fb.bytes[3]).toBe(0xdd); // A
  });

  test('it is born transparent, not opaque black', () => {
    // Opaque black would hide every pixel never written, and a missing sprite would look like a black
    // sprite. Transparent lets the absence show as absence.
    const fb = createFramebuffer(3, 2);

    expect(Array.from(fb.bytes.subarray(0, 4))).toEqual([0, 0, 0, 0]);
    expect(fb.pixels).toHaveLength(6);
  });
});

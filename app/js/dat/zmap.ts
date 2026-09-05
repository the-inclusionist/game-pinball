// SPDX-License-Identifier: AGPL-3.0-or-later
// dat/zmap — the PARTOUT's 16-bit depth map (entry type 12).
//
// A 14-byte header, per `Doc/.dat file format.txt`:
//   +0  width   WORD
//   +2  height  WORD
//   +4  stride  WORD   (pitch/2 — in 16-bit cells, not in bytes)
//   +6  ?       DWORD  (0)
//   +10 ?       WORD   (0)
//   +12 ?       WORD   (80)
//   +14 depths
//
// THE STRIDE IS IN CELLS, NOT BYTES, and may exceed the width: the surplus is padding at the end of
// each row. Reading row by row with a step of `width` instead of `stride` produces an image that slides
// sideways — the classic mistake of confusing the two.

const OFF = { width: 0, height: 2, stride: 4 } as const;
export const HEADER_SIZE = 14;

export interface ZMap {
  readonly width: number;
  readonly height: number;
  readonly stride: number;
  readonly depths: Uint16Array;
  /** True when the header does not describe the data that followed it. See below. */
  readonly empty: boolean;
  depthAt(x: number, y: number): number;
}

function build(width: number, height: number, stride: number, depths: Uint16Array, empty: boolean): ZMap {
  return {
    width, height, stride, depths, empty,
    depthAt: (x, y) => depths[y * stride + x] ?? 0,
  };
}

/** A z-map that describes nothing. Not an error — see the comment in `readZMap`. */
const EMPTY = build(0, 0, 0, new Uint16Array(0), true);

export function readZMap(payload: Uint8Array): ZMap {
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const width = dv.getUint16(OFF.width, true);
  const height = dv.getUint16(OFF.height, true);
  const stride = dv.getUint16(OFF.stride, true);
  const payloadBytes = payload.byteLength - HEADER_SIZE;

  // THE HEADER MUST EXPLAIN THE PAYLOAD, AND WHEN IT DOES NOT THE ANSWER IS EMPTY — NOT AN EXCEPTION.
  // Groups 497 and 498 of PINBALL.DAT carry a zeroed z-map header with payload behind it; the original
  // (partman.cpp) checks `stride * height * 2 == length` and, when that fails, skips the payload and
  // substitutes a 0x0 z-map. Transcribed literally: that is real 1995 data, and a port that threw there
  // would not load the table at all.
  if (stride * height * 2 !== payloadBytes) return EMPTY;

  const depths = new Uint16Array(stride * height);
  for (let i = 0; i < depths.length; i++) {
    depths[i] = dv.getUint16(HEADER_SIZE + i * 2, true);
  }
  return build(width, height, stride, depths, false);
}

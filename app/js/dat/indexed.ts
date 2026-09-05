// SPDX-License-Identifier: AGPL-3.0-or-later
// dat/indexed — unpacks the 8-bit bitmap's rows into a linear grid, in screen order.
//
// TWO CONVERSIONS IN ONE, and both fail silently when wrong:
//
// 1. THE ROWS ARE BOTTOM-UP. `gdrv::ApplyPalette` walks the source from `Height-1` down to 0 while
//    writing the destination top-down — the Windows DIB convention. Reading them in order delivers the
//    table upside down, and the game still runs: the ball falls upward and nothing throws.
//    (The upstream comment at that loop says "flip horizontally". It is wrong — the flip is vertical.
//    The code is the truth; the comment is the trap.)
//
// 2. THE SOURCE STRIDE IS NOT THE WIDTH. Indexed rows are padded to a multiple of 4 bytes, and the
//    padding is not image. Walking the source with a step of `width` skews the figure by one column per
//    row — the classic staircase of confusing width with stride.

export interface IndexedShape {
  readonly width: number;
  readonly height: number;
  /** Step between rows IN THE SOURCE, in bytes. See `indexedStride` in `dat/bitmap8`. */
  readonly indexedStride: number;
}

/** Returns `width * height` palette indices, already in screen reading order (top row first). */
export function unpackIndexed(data: Uint8Array, shape: IndexedShape): Uint8Array {
  const out = new Uint8Array(shape.width * shape.height);

  for (let y = 0; y < shape.height; y++) {
    const sourceRow = shape.height - 1 - y; // the vertical flip, in one line
    const start = sourceRow * shape.indexedStride;
    for (let x = 0; x < shape.width; x++) {
      out[y * shape.width + x] = data[start + x] ?? 0;
    }
  }

  return out;
}

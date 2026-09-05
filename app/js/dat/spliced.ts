// SPDX-License-Identifier: AGPL-3.0-or-later
// dat/spliced — unpicks the "spliced" bitmap, which stores color AND depth interleaved in one stream.
//
// Port of `GroupData::SplitSplicedBitmap`. The upstream does this AT LOAD TIME and says why in its own
// comment: "Get rid of spliced bitmap early on, to simplify render pipeline". zdrv even asserts that it
// never sees a spliced bitmap. So this module belongs to the data phase, not the render phase.
//
// ========================= THE STREAM =========================
// A sequence of runs, each:
//
//     [skip: int16] [count: uint16] then `count` pixels of [depth: uint16] [index: uint8]
//
// and a NEGATIVE skip ends it.
//
// ========================= THE TRAP: THREE BYTES PER PIXEL =========================
// Depth is 2 bytes and index is 1. The original expresses that with a `char**` aliasing the same
// pointer that reads the 16-bit words, advancing ONE byte per pixel. The effect is that a run of ODD
// length leaves the cursor on an odd address, and the next run's `int16` is read unaligned.
//
// Walking the stream in 16-bit units cannot even represent that state. So the cursor here is in BYTES,
// always. Getting it wrong would show up as the image falling apart from the first sprite with an odd
// count — never at the first pixel, which is where anyone would look.

/** Index 255. The palette defines it as white (`current_palette[255] = White()`). */
export const FILL_INDEX = 0xff;
/** As far as possible. Filling with zero would put the background in front of everything. */
export const FILL_DEPTH = 0xffff;

export interface Dimensions {
  readonly width: number;
  readonly height: number;
  /**
   * The width of the TABLE at the resolution the stream was recorded in
   * (`resolution_array[].TableWidth`). It comes in as a parameter rather than being read from a global
   * table because it is this algorithm's only external dependency, and injected it makes the whole
   * thing testable without standing up the resolution system.
   */
  readonly tableWidth: number;
}

export interface SplitResult {
  readonly indices: Uint8Array;
  readonly depths: Uint16Array;
  /** How many pixels the stream asked to write. */
  readonly pixelsWritten: number;
  /**
   * How many would land outside the destination. They are dropped so nothing overflows, but COUNTED:
   * silencing this would turn a decoding error into a sprite with pieces missing — visible,
   * unexplainable, and with nothing pointing at the cause. Zero throughout PINBALL.DAT; any other
   * number is a defect.
   */
  readonly outOfBounds: number;
  /** True when the stream ended on the negative skip rather than by running out of bytes. */
  readonly endedCleanly: boolean;
}

export function splitSpliced(data: Uint8Array, d: Dimensions): SplitResult {
  const cells = d.width * d.height;
  const indices = new Uint8Array(cells).fill(FILL_INDEX);
  const depths = new Uint16Array(cells).fill(FILL_DEPTH);

  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let cursor = 0; // IN BYTES — see this module's header.
  let destination = 0;
  let pixelsWritten = 0;
  let outOfBounds = 0;
  let endedCleanly = false;

  for (;;) {
    if (cursor + 2 > data.byteLength) break;
    let skip = dv.getInt16(cursor, true); cursor += 2;
    if (skip < 0) { endedCleanly = true; break; }

    // The skip was recorded in terms of the TABLE's width; on a narrower bitmap it has to be
    // re-expressed. It only applies when the skip exceeds this bitmap's width, as the original does.
    if (skip > d.width) skip += d.width - d.tableWidth;

    destination += skip;

    if (cursor + 2 > data.byteLength) break;
    const count = dv.getUint16(cursor, true); cursor += 2;

    for (let i = 0; i < count; i++) {
      if (cursor + 3 > data.byteLength) {
        return { indices, depths, pixelsWritten, outOfBounds, endedCleanly };
      }
      const depth = dv.getUint16(cursor, true); cursor += 2;
      const index = dv.getUint8(cursor); cursor += 1;

      if (destination >= 0 && destination < cells) {
        indices[destination] = index;
        depths[destination] = depth;
        pixelsWritten++;
      } else {
        outOfBounds++;
      }
      destination++;
    }
  }

  return { indices, depths, pixelsWritten, outOfBounds, endedCleanly };
}

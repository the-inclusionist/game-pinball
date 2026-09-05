// SPDX-License-Identifier: AGPL-3.0-or-later
// dat/palette — the PARTOUT's 256-colour palette (entry type 5).
//
// One colour per little-endian DWORD. The bit layout is the upstream's `ColorRgba` (gdrv.h):
//
//     A << 24 | R << 16 | G << 8 | B
//
// which means that IN MEMORY the bytes come out B, G, R, A — and not R, G, B, A, which is the reading
// the name "Rgba" invites. Swapping the two inverts red and blue across the whole table: the purple
// nebula turns teal and nobody works out why until they open a pixel by hand.
//
// THE FILE'S ALPHA IS ZERO and it is not opacity: a Windows PALETTEENTRY carries R, G, B and `peFlags`,
// and `peFlags` is 0. Treating that byte as alpha paints the entire table transparent. Opacity is
// decided by whoever draws, in the render phase, and not here.

const COLOURS = 256;
const BYTES_PER_COLOUR = 4;

export interface Palette {
  readonly length: number;
  red(i: number): number;
  green(i: number): number;
  blue(i: number): number;
  /** The high byte exactly as it came from the file. Zero throughout PINBALL.DAT — see the header. */
  alpha(i: number): number;
}

export function readPalette(payload: Uint8Array): Palette {
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const howMany = Math.min(COLOURS, Math.floor(payload.byteLength / BYTES_PER_COLOUR));
  const colours = new Uint32Array(howMany);
  for (let i = 0; i < howMany; i++) colours[i] = dv.getUint32(i * BYTES_PER_COLOUR, true);

  const channel = (i: number, shift: number): number => ((colours[i] ?? 0) >>> shift) & 0xff;
  return {
    length: howMany,
    red: (i) => channel(i, 16),
    green: (i) => channel(i, 8),
    blue: (i) => channel(i, 0),
    alpha: (i) => channel(i, 24),
  };
}

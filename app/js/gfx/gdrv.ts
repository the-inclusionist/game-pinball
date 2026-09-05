// SPDX-License-Identifier: AGPL-3.0-or-later
// gfx/gdrv — the display palette and turning indices into colours. Port of `gdrv::display_palette`
// and `gdrv::ApplyPalette`.
//
// ========================= THE ONE PLACE WHERE TRANSCRIBING WOULD BE WRONG =========================
// For the file's colours (10 to 245) the original does:
//
//     srcClr.SetAlpha(0xff);  current_palette[index] = srcClr;  current_palette[index].SetAlpha(2);
//
// Alpha TWO. That is not opacity: SDL ignores alpha on that texture path, and the 2 only has to be
// NON-ZERO so the transparency test (`if ((*srcPtr).Color)`) counts the pixel as drawable. It is a
// sentinel wearing a colour channel.
//
// Canvas does NOT ignore alpha. Copying the 2 literally would paint the whole table at 0.8% opacity —
// the port would be "faithful" and the screen empty. Translating the sentinel to 255 preserves the
// exact semantics (zero stays the only transparent value) and fixes the medium. Written down here
// because this is the kind of decision someone later "corrects" back to 2, believing they are being
// faithful.
//
// ========================= THE MAP OF THE 256 INDICES =========================
//   0         transparent (upstream comments it itself: "Color 0: transparent")
//   1 to 9    the Windows system palette, hardcoded
//   10 to 245 from the file, opaque
//   246 to 254 never assigned — they stay at the memset's zero, that is, transparent
//   255       opaque white

import { createFramebuffer, pack, type Framebuffer } from './framebuffer.js';

/** What this module needs from a palette read out of the .DAT. */
export interface FilePalette {
  red(i: number): number;
  green(i: number): number;
  blue(i: number): number;
}

/** The first nine of the Windows system palette, after the transparent index 0. */
const SYSTEM: readonly (readonly [number, number, number])[] = [
  [0x80, 0, 0], [0, 0x80, 0], [0x80, 0x80, 0], [0, 0, 0x80],
  [0x80, 0, 0x80], [0, 0x80, 0x80], [0xc0, 0xc0, 0xc0], [0xc0, 0xdc, 0xc0], [0xa6, 0xca, 0xf0],
];

const FIRST_FROM_FILE = 10;
const PAST_LAST_FROM_FILE = 246;

export function buildDisplayPalette(palette: FilePalette): Uint32Array {
  const out = new Uint32Array(256); // zero is transparent, which is already right for 0 and 246..254

  SYSTEM.forEach(([r, g, b], i) => { out[i + 1] = pack(r, g, b, 0xff); });

  for (let i = FIRST_FROM_FILE; i < PAST_LAST_FROM_FILE; i++) {
    out[i] = pack(palette.red(i), palette.green(i), palette.blue(i), 0xff);
  }

  out[255] = pack(255, 255, 255, 255);
  return out;
}

/** `gdrv::ApplyPalette`, without the vertical flip: that already happened in `dat/indexed`. */
export function applyPalette(indices: Uint8Array, palette: Uint32Array, width: number, height: number): Framebuffer {
  const fb = createFramebuffer(width, height);
  const n = Math.min(indices.length, fb.pixels.length);
  for (let i = 0; i < n; i++) fb.pixels[i] = palette[indices[i]!]!;
  return fb;
}

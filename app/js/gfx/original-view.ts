// SPDX-License-Identifier: AGPL-3.0-or-later
// gfx/original-view — the 1995 playfield as pixels, and the camera that maps table units onto it.
//
// ========================= THE SECOND HALF OF THE DEMONSTRATION MODE =========================
// `table/original` gives the ball somewhere to roll. This gives somebody something to look at: the
// playfield's own 365x470 bitmap, decoded through the archive's own palette, and the projection the
// original uses to put a ball at table coordinate (0, 0) on the right pixel.
//
// ========================= EVERY NUMBER IS IN THE ARCHIVE, INCLUDING THE ONES THAT LOOK DERIVED =========================
// The projection is `camera_info`: twelve matrix floats followed by the focal distance, the depth
// minimum and the depth scaler. `pb::pb_init` reads it exactly that way.
//
// ⚠️ AND THE PROJECTION CENTRE IS AUTHORED, NOT HALF THE BITMAP. `pb_init` sets it to half the table's
// width and height and `TTableLayer` then RECENTRES it from the table group's own record 700. On this
// archive that record says (183, 238) against a 365x470 bitmap — 182.5 and 235 if it were derived. The
// difference in y is three pixels, which is exactly the sort of thing that never announces itself: the
// whole table would sit three pixels high and every collision would still be correct.

import { pack, type Framebuffer } from './framebuffer.js';
import { applyPalette, buildDisplayPalette } from './gdrv.js';
import { readBitmapHeader, HEADER_SIZE } from '../dat/bitmap8.js';
import { unpackIndexed } from '../dat/indexed.js';
import { readPalette } from '../dat/palette.js';
import { GAME_MATRIX, createProjection, type Matrix, type Projection } from '../maths/proj.js';
import { readZMap, type ZMap } from '../dat/zmap.js';
import { EntryType, type Group } from '../dat/partman.js';
import { floatAttribute, groupNamed } from '../dat/attributes.js';

/** `TTableLayer`'s recentre record, per resolution. Zero is the only one this port targets. */
export const PROJECTION_CENTRE_RECORD = 700;

/** The group whose palette the whole game is drawn in. Named for the side panel, used by everything. */
export const PALETTE_GROUP = 'background';
export const CAMERA_GROUP = 'camera_info';
export const TABLE_GROUP = 'table';

function entryOfType(group: Group, type: number): Uint8Array | undefined {
  return group.entries.find((e) => e.type === type && e.data)?.data;
}

/**
 * The playfield, decoded. 365x470 on the shipped archive, which is the largest bitmap in it and the
 * number AdrienTD's independent dump reports.
 */
export function decodePlayfield(groups: readonly Group[]): Framebuffer {
  const table = groupNamed(groups, TABLE_GROUP);
  if (!table) throw new Error('[original-view] the archive has no group called "table"');

  const bitmap = entryOfType(table, EntryType.Bitmap8);
  if (!bitmap) throw new Error('[original-view] the "table" group carries no bitmap');

  // ⚠️ THE PALETTE IS NOT ON THE TABLE'S GROUP. `pb_init` reads it from the group called `background`,
  // which is the side panel — the one thing in the original this port deliberately does not draw. Its
  // palette is still the palette every other bitmap is indexed into.
  const paletteGroup = groupNamed(groups, PALETTE_GROUP);
  const paletteData = paletteGroup && entryOfType(paletteGroup, EntryType.Palette);
  if (!paletteData) throw new Error('[original-view] the archive carries no palette');
  const palette = readPalette(paletteData);

  const header = readBitmapHeader(bitmap);
  const indices = unpackIndexed(bitmap.subarray(HEADER_SIZE), {
    width: header.width,
    height: header.height,
    indexedStride: header.indexedStride ?? header.width,
  });

  // ⚠️ THROUGH `gdrv::display_palette`, NOT STRAIGHT THROUGH THE FILE. Four blocks of the 256 entries
  // are not the file's to decide — 0 transparent, 1 to 9 the Windows system colours, 246 to 254 never
  // assigned, 255 pure white — and this archive exercises exactly one of them: its own entry 255 is
  // (252, 252, 252), the only near-white colour it carries, and 1791 pixels across the table, the ball,
  // every lamp and both flippers' flags are drawn with it. Read from the file they all come out three
  // units dark, which is a difference nobody would ever see and nobody could ever explain.
  return applyPalette(indices, opaque(buildDisplayPalette(palette)), header.width, header.height);
}

/** Alpha alone, in whichever byte this machine keeps it. */
const OPAQUE = pack(0, 0, 0, 255);

/**
 * ⚠️ THE PLAYFIELD IS OPAQUE BY CONSTRUCTION, and `gdrv`'s map is written for SPRITES. There a zero
 * word means "do not draw"; here index 0 is a colour like any other, used 37810 times, and handing the
 * map over unaltered punches that many holes in the table. Every alpha byte in PINBALL.DAT is zero
 * besides — `dat/palette` says so in its own header — so trusting the file would make it invisible
 * outright. Both failures look like a broken decoder and neither reports anything.
 */
function opaque(display: Uint32Array): Uint32Array {
  return display.map((color) => (color | OPAQUE) >>> 0);
}

export interface OriginalCamera {
  readonly projection: Projection;
  /** The twelve floats `camera_info` carries, so a caller can check the depth against row two. */
  readonly matrix: Matrix;
  readonly centre: { readonly x: number; readonly y: number };
  readonly d: number;
}

export interface CameraOptions {
  /**
   * ⚠️ THE HALVING GOES IN THE PROJECTION, NOT IN THE PHYSICS. The table stays in its own float units
   * and only the map onto pixels changes, which is what lets the same collision code drive a picture
   * at any size — decision 5 of the plan, and the reason `proj.ts` exists as a separate thing.
   *
   * Both the focal distance and the centre scale: `toScreen` is `p * (d / z) + centre`, so halving one
   * without the other moves the table off the middle of its own bitmap by a quarter of its width.
   */
  readonly scale?: number;
}

/** `pb::pb_init`'s projection, read from `camera_info` and recentred from the table's record 700. */
export function readCamera(groups: readonly Group[], o: CameraOptions = {}): OriginalCamera {
  const camera = groupNamed(groups, CAMERA_GROUP);
  const floats = camera && entryOfType(camera, EntryType.Float32s);
  if (!floats) throw new Error('[original-view] the archive carries no camera_info');

  const view = new DataView(floats.buffer, floats.byteOffset, floats.byteLength);
  const at = (i: number): number => view.getFloat32(i * 4, true);

  // Twelve matrix values in row-major order, then d, zMin, zScaler. `memcpy` of 4x3 floats, then + 12.
  const matrix = {
    row0: { x: at(0), y: at(1), z: at(2), w: at(3) },
    row1: { x: at(4), y: at(5), z: at(6), w: at(7) },
    row2: { x: at(8), y: at(9), z: at(10), w: at(11) },
  };
  const d = at(12);
  const zMin = at(13);
  const zScaler = at(14);

  const table = groupNamed(groups, TABLE_GROUP);
  const recentre = table && floatAttribute(table, PROJECTION_CENTRE_RECORD);
  if (!recentre || recentre.length < 2) {
    throw new Error('[original-view] the table group does not say where the projection is centred');
  }
  const scale = o.scale ?? 1;
  const centre = { x: recentre[0]! * scale, y: recentre[1]! * scale };
  const scaledD = d * scale;

  return {
    centre,
    d: scaledD,
    matrix,
    projection: createProjection({
      matrix, d: scaledD, centerX: centre.x, centerY: centre.y, zMin, zScaler,
    }),
  };
}

/** The matrix the archive carries, for a test that wants to know it is the one `maths/proj` documents. */
export const DOCUMENTED_MATRIX = GAME_MATRIX;

/**
 * The playfield's own DEPTH MAP, beside its bitmap in the same group, TURNED THE RIGHT WAY UP.
 *
 * ⚠️ THE WHOLE OF THE ORIGINAL'S OCCLUSION IS A COMPARISON AGAINST THIS. One 16-bit number per pixel,
 * the same 365x470 as the picture, saying how far away the thing drawn there is. The ramps stand above
 * the table in it, which is what a ball riding under an arch is drawn behind.
 *
 * ⚠️ AND IT IS STORED BOTTOM-UP. `zdrv::FlipZMapHorizontally` — which despite its name swaps ROWS —
 * mirrors it on load. Read as it lies, the map runs the opposite way from the projection: measured
 * down the middle of the bitmap the stored value RISES from 6434 to 54311 while the depth of the
 * table's own surface FALLS from 51117 to 6455. Flipped, the two agree to within a fraction of a
 * percent everywhere except where something is genuinely standing above the table — which is the only
 * place they are supposed to differ, and the whole reason the map exists.
 */
export function readPlayfieldDepth(groups: readonly Group[]): ZMap | null {
  const table = groupNamed(groups, TABLE_GROUP);
  const entry = table && entryOfType(table, EntryType.ZMap);
  if (!entry) return null;
  const map = readZMap(entry);

  // ⚠️ COPIED A WHOLE STRIDE AT A TIME, PADDING AND ALL. Copying only `width` cells leaves the surplus
  // as zeros, and on this archive nothing reads them — the mutation survives, and is recorded rather
  // than chased. It stops being equivalent the moment anything samples past the picture's last column.
  const flipped = new Uint16Array(map.depths.length);
  for (let y = 0; y < map.height; y++) {
    const from = (map.height - 1 - y) * map.stride;
    flipped.set(map.depths.subarray(from, from + map.stride), y * map.stride);
  }

  return { ...map, depths: flipped };
}

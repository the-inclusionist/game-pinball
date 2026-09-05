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

import { createFramebuffer, pack, type Framebuffer } from './framebuffer.js';
import { readBitmapHeader, HEADER_SIZE } from '../dat/bitmap8.js';
import { unpackIndexed } from '../dat/indexed.js';
import { readPalette } from '../dat/palette.js';
import { GAME_MATRIX, createProjection, type Projection } from '../maths/proj.js';
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

  const frame = createFramebuffer(header.width, header.height);
  for (let i = 0; i < indices.length; i++) {
    const c = indices[i]!;
    // ⚠️ OPAQUE, whatever the file says. Every alpha byte in PINBALL.DAT is zero — `dat/palette` says so
    // in its own header — so trusting it would produce a table that is entirely invisible.
    frame.pixels[i] = pack(palette.red(c), palette.green(c), palette.blue(c), 255);
  }
  return frame;
}

export interface OriginalCamera {
  readonly projection: Projection;
  readonly centre: { readonly x: number; readonly y: number };
  readonly d: number;
}

/** `pb::pb_init`'s projection, read from `camera_info` and recentred from the table's record 700. */
export function readCamera(groups: readonly Group[]): OriginalCamera {
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
  const centre = { x: recentre[0]!, y: recentre[1]! };

  return {
    centre,
    d,
    projection: createProjection({ matrix, d, centerX: centre.x, centerY: centre.y, zMin, zScaler }),
  };
}

/** The matrix the archive carries, for a test that wants to know it is the one `maths/proj` documents. */
export const DOCUMENTED_MATRIX = GAME_MATRIX;

// SPDX-License-Identifier: AGPL-3.0-or-later
// gfx/original-lamps — the table's lamps as pictures, so the game's state can be seen.
//
// Every light on this table already exists as a COMPONENT with an on flag and a frame index; none of
// them had a picture, so nothing the control layer decides has ever been visible. This reads the one
// the archive ships beside each lamp.
//
// ========================= A BITMAP'S POSITION IS IN THE WINDOW, NOT ON THE TABLE =========================
// ⚠️ Every bitmap in `PINBALL.DAT` carries where it goes in the 1995 WINDOW — 600x416, the playfield on
// the left and the side panel on the right — and the playfield's own bitmap sits at (137, 2) in it. So
// a lamp whose header says (313, 390) belongs at (176, 388) on the picture this port draws.
//
// Drawn at the raw number every lamp lands a hundred and thirty-seven pixels to the right of where it
// goes, and forty of the hundred and thirty-nine fall off the picture entirely — which is the only
// reason it would be noticed at all rather than looking like a table whose lamps are simply elsewhere.
//
// ========================= AND INDEX ZERO IS TRANSPARENT HERE =========================
// `decodePlayfield` makes every pixel opaque, correctly: it is the background, and the archive's alpha
// bytes are all zero. A lamp is a SPRITE laid over that background, and `gdrv`'s palette documents
// index zero as the transparent one. Opaque, each lamp paints its own little black rectangle onto the
// table and the picture fills with square holes.

import { createFramebuffer, pack, type Framebuffer } from './framebuffer.js';
import { halve } from './scale.js';
import { readBitmapHeader, HEADER_SIZE } from '../dat/bitmap8.js';
import { unpackIndexed } from '../dat/indexed.js';
import { readPalette } from '../dat/palette.js';
import { EntryType, type Group } from '../dat/partman.js';
import { groupNamed } from '../dat/attributes.js';

/** The group whose bitmap says where the playfield sits in the window. Read, never assumed. */
export const TABLE_ORIGIN_RECORD = 'table';
/** The palette every indexed bitmap in the archive is drawn through. See `gfx/original-view`. */
const PALETTE_GROUP = 'background';
/** `gdrv`: "Color 0: transparent". */
const TRANSPARENT_INDEX = 0;

export interface LampSprite {
  /** Left edge on the playfield, the table's own corner already taken off. */
  readonly x: number;
  readonly y: number;
  /** In the archive's order, which is the order `TLight`'s frame index counts in. */
  readonly frames: readonly Framebuffer[];
}

export interface LampSpriteOptions {
  /** 0.5 for the halved playfield. Positions and pictures scale together — see the tests. */
  readonly scale?: number;
}

function entriesOfType(group: Group, type: number): Uint8Array[] {
  return group.entries
    .filter((entry) => entry.type === type && entry.data)
    .map((entry) => entry.data!);
}

/**
 * Every group whose name begins `lite`, as pictures placed on the playfield.
 *
 * A lamp with no bitmap is skipped rather than given an empty one: a sprite with no pixels is a lamp
 * that can be lit and never seen, which is worse than one that is honestly absent.
 */
export function readLampSprites(
  groups: readonly Group[], o: LampSpriteOptions = {},
): Map<string, LampSprite> {
  const scale = o.scale ?? 1;
  const sprites = new Map<string, LampSprite>();

  const paletteGroup = groupNamed(groups, PALETTE_GROUP);
  const paletteData = paletteGroup && entriesOfType(paletteGroup, EntryType.Palette)[0];
  if (!paletteData) return sprites;
  const palette = readPalette(paletteData);

  const table = groupNamed(groups, TABLE_ORIGIN_RECORD);
  const tableBitmap = table && entriesOfType(table, EntryType.Bitmap8)[0];
  if (!tableBitmap) return sprites;
  const origin = readBitmapHeader(tableBitmap);

  for (const group of groups) {
    if (!group?.name?.startsWith('lite')) continue;
    const bitmaps = entriesOfType(group, EntryType.Bitmap8);
    if (!bitmaps.length) continue;

    const frames: Framebuffer[] = [];
    let x = 0;
    let y = 0;

    for (const bitmap of bitmaps) {
      const header = readBitmapHeader(bitmap);
      const indices = unpackIndexed(bitmap.subarray(HEADER_SIZE), {
        width: header.width,
        height: header.height,
        indexedStride: header.indexedStride ?? header.width,
      });

      const frame = createFramebuffer(header.width, header.height);
      for (let i = 0; i < indices.length; i++) {
        const index = indices[i]!;
        if (index === TRANSPARENT_INDEX) continue;
        frame.pixels[i] = pack(palette.red(index), palette.green(index), palette.blue(index), 255);
      }

      // ⚠️ THE CORNER IS TAKEN OFF EVERY FRAME'S OWN HEADER, and the first frame's is the lamp's.
      // Frames of one lamp share a position on this archive, and taking the first is what the original
      // does — the sprite is moved as a whole.
      if (!frames.length) {
        x = header.x - origin.x;
        y = header.y - origin.y;
      }
      frames.push(scale === 1 ? frame : halve(frame));
    }

    sprites.set(group.name, {
      x: scale === 1 ? x : Math.round(x * scale),
      y: scale === 1 ? y : Math.round(y * scale),
      frames,
    });
  }

  return sprites;
}

/**
 * A lamp painted over the picture, TRANSPARENT PIXELS SKIPPED.
 *
 * ⚠️ `copyBitmap` IS THE WRONG TOOL FOR THIS. It moves whole rows with `set`, which is right for a
 * background and wrong for a sprite: it would stamp the lamp's transparent pixels over the table as
 * well, and every lamp would sit in its own rectangular hole.
 *
 * ⚠️ AND IT CLIPS RATHER THAN TRUSTING THE ARCHIVE. Every lamp on this file lands inside the playfield
 * once the table's corner is taken off, and a lamp that did not would otherwise wrap onto the opposite
 * edge of the picture a row at a time — an image that looks torn rather than misplaced.
 */
export function drawLamp(dst: Framebuffer, sprite: LampSprite, frameIndex = 0): void {
  const src = sprite.frames[Math.max(0, Math.min(frameIndex, sprite.frames.length - 1))];
  if (!src) return;

  for (let y = 0; y < src.height; y++) {
    const dy = sprite.y + y;
    if (dy < 0 || dy >= dst.height) continue;
    const fromRow = y * src.width;
    const toRow = dy * dst.width;
    for (let x = 0; x < src.width; x++) {
      const dx = sprite.x + x;
      if (dx < 0 || dx >= dst.width) continue;
      const pixel = src.pixels[fromRow + x]!;
      if (pixel === 0) continue;
      dst.pixels[toRow + dx] = pixel;
    }
  }
}

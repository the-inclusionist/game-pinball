// SPDX-License-Identifier: AGPL-3.0-or-later
// gfx/original-sprites — the table's own pictures: the lamps, the ball, and anything else the archive
// draws.
//
// Every part of this table already exists as a COMPONENT with state; almost none of them had a picture,
// so nothing the control layer decides has ever been visible. This reads the one the archive ships
// beside each group.
//
// ========================= A COMPONENT'S FRAMES ARE IN THE GROUPS THAT FOLLOW IT =========================
// ⚠️ EVERY NAMED GROUP CARRIES ONE BITMAP, AND THAT IS NOT ALL THE COMPONENT HAS. `TPinballComponent`
// asks `loader::query_visual(groupIndex, i)` for each of its visual states, and the loader walks
// FORWARD: the rest of the frames sit in the ANONYMOUS groups between this one and the next named one.
//
// Read the named group alone and every component has exactly one picture — which is what this module
// did at first. It looks like a table whose parts do not animate, and nothing anywhere errors: the
// flipper has eight poses, a bumper alternates two, `lite2` has three brightnesses, and the ball has
// seven SIZES, nine pixels across to fifteen, because a ball nearer the camera is drawn bigger.
//
// The run stops at the next NAME. Walking past it would give one lamp the pictures of the next, which
// is the right thing drawn in the wrong place — the hardest kind of wrong to see.
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
import { floatAttribute, groupNamed } from '../dat/attributes.js';

/** `VisualZArray`'s source: the table position at which a frame's size is right. Only the ball has it. */
const FRAME_POSITION_RECORD = 501;

/** The group whose bitmap says where the playfield sits in the window. Read, never assumed. */
export const TABLE_ORIGIN_RECORD = 'table';
/** The palette every indexed bitmap in the archive is drawn through. See `gfx/original-view`. */
const PALETTE_GROUP = 'background';
/** `gdrv`: "Color 0: transparent". */
const TRANSPARENT_INDEX = 0;

/**
 * One picture of a component, with ITS OWN corner on the playfield.
 *
 * ⚠️ THE CORNER IS PER FRAME, AND THE FLIPPER IS THE PROOF. A lamp's brightnesses share one place and
 * so do the ball's seven sizes, so a sprite carrying one position for all its frames looks right on
 * both. The flipper's eight poses run from y 378 up to 358 as the pas sweeps, because a rotating
 * shape's bounding box moves with it. Drawn from the first frame's corner the flipper swings in the
 * wrong place by twenty pixels — and it still swings, which is what makes it hard to see.
 */
export interface SpriteFrame extends Framebuffer {
  readonly x: number;
  readonly y: number;
  /**
   * ⚠️ THE POINT AT WHICH THIS FRAME'S SIZE IS RIGHT — record 501, and only the ball has it.
   *
   * `TBall::Repaint` walks `VisualZArray` for the first threshold at or below the ball's own distance
   * to the camera, and the thresholds are the distances to these points. The archive stores them as
   * table positions, (0, y, 0.3), running from the far end of the table to the near one — which is why
   * the ball's pictures run from nine pixels across to fifteen.
   *
   * Null for everything else. A threshold invented for a lamp would pick its brightness by how far
   * away the lamp is.
   */
  readonly at: { readonly x: number; readonly y: number; readonly z: number } | null;
}

export interface LampSprite {
  /** The FIRST frame's corner, which is the sprite's own. Drawing uses each frame's. */
  readonly x: number;
  readonly y: number;
  /** In the archive's order, which is the order a component's frame index counts in. */
  readonly frames: readonly SpriteFrame[];
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
/**
 * One group's picture, placed against the table's own corner.
 *
 * Answers null rather than an empty sprite when the group or its bitmap is absent: something that can
 * be drawn and never seen is worse than something honestly missing, and the caller can then decide —
 * the demonstration falls back to its coloured disc.
 */
export function readSprite(
  groups: readonly Group[], name: string, o: LampSpriteOptions = {},
): LampSprite | null {
  const context = spriteContext(groups);
  if (!context) return null;
  const index = groups.findIndex((group) => group?.name === name);
  return index < 0 ? null : decodeSprite(groups, index, context, o.scale ?? 1);
}

interface SpriteContext {
  readonly palette: ReturnType<typeof readPalette>;
  readonly origin: { x: number; y: number };
}

function spriteContext(groups: readonly Group[]): SpriteContext | null {
  const paletteGroup = groupNamed(groups, PALETTE_GROUP);
  const paletteData = paletteGroup && entriesOfType(paletteGroup, EntryType.Palette)[0];
  if (!paletteData) return null;

  const table = groupNamed(groups, TABLE_ORIGIN_RECORD);
  const tableBitmap = table && entriesOfType(table, EntryType.Bitmap8)[0];
  if (!tableBitmap) return null;
  const header = readBitmapHeader(tableBitmap);

  return { palette: readPalette(paletteData), origin: { x: header.x, y: header.y } };
}

/**
 * The bitmaps of a component: its own group's, then those of every ANONYMOUS group that follows it.
 * See this module's header — the anonymous run belongs to the named group before it.
 */
function framesOf(
  groups: readonly Group[], index: number,
): { bitmap: Uint8Array; at: { x: number; y: number; z: number } | null }[] {
  const positionOf = (group: Group): { x: number; y: number; z: number } | null => {
    const point = floatAttribute(group, FRAME_POSITION_RECORD);
    return point && point.length >= 3 ? { x: point[0]!, y: point[1]!, z: point[2]! } : null;
  };

  const own = groups[index]!;
  const frames = entriesOfType(own, EntryType.Bitmap8)
    .map((bitmap) => ({ bitmap, at: positionOf(own) }));
  for (let next = index + 1; next < groups.length; next++) {
    const group = groups[next];
    if (!group || group.name) break;
    for (const bitmap of entriesOfType(group, EntryType.Bitmap8)) {
      frames.push({ bitmap, at: positionOf(group) });
    }
  }
  return frames;
}

function decodeSprite(
  groups: readonly Group[], index: number, context: SpriteContext, scale: number,
): LampSprite | null {
  const bitmaps = framesOf(groups, index);
  if (!bitmaps.length) return null;

  const frames: SpriteFrame[] = [];
  let x = 0;
  let y = 0;

  for (const { bitmap, at } of bitmaps) {
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
      const { palette } = context;
      frame.pixels[i] = pack(palette.red(index), palette.green(index), palette.blue(index), 255);
    }

    // Every frame's own corner, the table's taken off. The first frame's is also the sprite's.
    const fx = header.x - context.origin.x;
    const fy = header.y - context.origin.y;
    if (!frames.length) { x = fx; y = fy; }

    const image = scale === 1 ? frame : halve(frame);
    frames.push(Object.assign(image, {
      x: scale === 1 ? fx : Math.round(fx * scale),
      y: scale === 1 ? fy : Math.round(fy * scale),
      // ⚠️ NOT SCALED. It is a place on the TABLE, in the table's own units, and the picture getting
      // smaller does not move the ball.
      at,
    }));
  }

  return {
    x: scale === 1 ? x : Math.round(x * scale),
    y: scale === 1 ? y : Math.round(y * scale),
    frames,
  };
}

export function readLampSprites(
  groups: readonly Group[], o: LampSpriteOptions = {},
): Map<string, LampSprite> {
  const scale = o.scale ?? 1;
  const sprites = new Map<string, LampSprite>();
  const context = spriteContext(groups);
  if (!context) return sprites;

  for (let index = 0; index < groups.length; index++) {
    const group = groups[index];
    if (!group?.name?.startsWith('lite')) continue;
    const sprite = decodeSprite(groups, index, context, scale);
    if (sprite) sprites.set(group.name, sprite);
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
  // ⚠️ A NEGATIVE INDEX IS NOT A PICTURE, IT IS THE ABSENCE OF ONE. `SpriteSet(-1)` is how everything
  // in this game hides itself: a popup target that has dropped, a barrier that is not raised, a lane
  // the ball is standing on. Clamping it to zero — which is what the clamp below does to every other
  // out-of-range value — draws the component at its resting picture instead of hiding it, and a target
  // that has been knocked down goes on standing there.
  if (frameIndex < 0) return;
  const src = sprite.frames[Math.max(0, Math.min(frameIndex, sprite.frames.length - 1))];
  if (!src) return;

  for (let y = 0; y < src.height; y++) {
    // ⚠️ THE FRAME'S OWN CORNER, not the sprite's. See `SpriteFrame`.
    const dy = src.y + y;
    if (dy < 0 || dy >= dst.height) continue;
    const fromRow = y * src.width;
    const toRow = dy * dst.width;
    for (let x = 0; x < src.width; x++) {
      const dx = src.x + x;
      if (dx < 0 || dx >= dst.width) continue;
      const pixel = src.pixels[fromRow + x]!;
      if (pixel === 0) continue;
      dst.pixels[toRow + dx] = pixel;
    }
  }
}

/**
 * A sprite drawn about a POINT rather than from a corner, which is what a ball needs.
 *
 * ⚠️ `drawLamp` PLACES BY THE TOP LEFT, and the ball's position is its middle. Drawn as a corner it
 * sits down and to the right by half its own width — about three pixels at half scale, which is half a
 * ball, and reads as the physics being off rather than the drawing.
 */
export function drawSpriteCentred(
  dst: Framebuffer, sprite: LampSprite, cx: number, cy: number, frameIndex = 0,
): void {
  const src = sprite.frames[Math.max(0, Math.min(frameIndex, sprite.frames.length - 1))];
  if (!src) return;
  // The centred draw ignores the frame's recorded corner, because the ball's is (0, 0) — the one
  // position in the file that is not a position.
  const placed = Object.assign(Object.create(Object.getPrototypeOf(src) as object) as object, src, {
    x: Math.round(cx - src.width / 2),
    y: Math.round(cy - src.height / 2),
  }) as SpriteFrame;
  drawLamp(dst, { x: placed.x, y: placed.y, frames: [placed] }, 0);
}

/**
 * The same, but only where the scene behind it is FARTHER AWAY. `zdrv::paint_flat` on a sprite: the
 * whole ball lies at one depth, which is what "flat" means, and it writes no depth of its own —
 * the scene it is drawn over is meant to survive it untouched.
 */
export function drawSpriteCentredBehind(
  dst: Framebuffer,
  scene: { readonly depths: Uint16Array; readonly stride: number },
  sprite: LampSprite, cx: number, cy: number, depth: number, frameIndex = 0,
): void {
  const src = sprite.frames[Math.max(0, Math.min(frameIndex, sprite.frames.length - 1))];
  if (!src) return;
  const left = Math.round(cx - src.width / 2);
  const top = Math.round(cy - src.height / 2);

  for (let y = 0; y < src.height; y++) {
    const dy = top + y;
    if (dy < 0 || dy >= dst.height) continue;
    const fromRow = y * src.width;
    const toRow = dy * dst.width;
    const depthRow = dy * scene.stride;
    for (let x = 0; x < src.width; x++) {
      const dx = left + x;
      if (dx < 0 || dx >= dst.width) continue;
      const pixel = src.pixels[fromRow + x]!;
      if (pixel === 0) continue;
      if ((scene.depths[depthRow + dx] ?? 0) <= depth) continue;
      dst.pixels[toRow + dx] = pixel;
    }
  }
}

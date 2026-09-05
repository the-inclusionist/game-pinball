// SPDX-License-Identifier: AGPL-3.0-or-later
// gfx/render — the sprite compositor. Port of `render.cpp`.
//
// ========================= THE BALLS LIVE OUTSIDE THE SCENE =========================
// There are two lists and they are treated as different kinds of thing:
//
//   · SPRITES are the table. They are composited into a STABLE image with a real z-buffer, and only
//     the rectangles that changed are ever redrawn.
//   · BALLS are transient. Every frame the pixels beneath each ball are SAVED, the ball is drawn on
//     top with `paintFlat`, and next frame those pixels are put back before anything else happens.
//
// That is why zdrv has two paints and why `paintFlat` does not write depth — a fact ported in phase 2
// without knowing what it was for. A ball must not leave a mark in the z-buffer, because the scene it
// is drawn over is meant to survive it untouched.
//
// ========================= A DIRTY RECTANGLE IS THE UNION OF TWO =========================
// `enclosingBox(dirtyRectPrev, bmpRect, dirtyRect)`. Where the sprite WAS and where it IS. Clearing
// only the new position leaves the old pixels on screen, and a moving sprite paints a trail.
//
// ========================= AND CLEARING DESTROYS THE NEIGHBORS =========================
// Restoring the background over a dirty rectangle erases everything that was there, including sprites
// that merely overlap it. So `repaint` redraws not the dirty sprite but EVERY sprite overlapping it,
// each clipped to the dirty rectangle. `buildOccludeList` precomputes who overlaps whom so that this
// is a list walk rather than a search.

import { copyBitmap, type Framebuffer } from './framebuffer.js';
import { fillZ, paint, paintFlat, type ZBuffer } from './zbuffer.js';
import { enclosingBox, rectangleClip, type Rect } from '../maths/rect.js';

export type VisualType = 'sprite' | 'background' | 'ball';

export interface Sprite {
  visualType: VisualType;
  /** The sprite's pixels, or null for a sprite that only punches a hole. */
  bmp: Framebuffer | null;
  zMap: ZBuffer | null;
  zMapOffsetX: number;
  zMapOffsetY: number;
  /** Where the bitmap sits on screen. */
  bmpRect: Rect;
  /** The area used to decide who overlaps whom. Width -1 means "not in the world". */
  boundingRect: Rect;
  dirtyRect: Rect;
  dirtyRectPrev: Rect;
  dirty: boolean;
  /** Only meaningful for balls: their draw order and their depth test. */
  depth: number;
  /** Everyone whose bounding rect meets this one. Null when nobody does. */
  occludedSprites: Sprite[] | null;
  deleted: boolean;
}

export interface RendererOptions {
  readonly width: number;
  readonly height: number;
  readonly screen: Framebuffer;
  readonly zScreen: ZBuffer;
  /** Painted back wherever a dirty rectangle is cleared. Null means clear to transparent. */
  readonly background: Framebuffer | null;
}

export interface Renderer {
  addSprite(sprite: Sprite): void;
  removeSprite(sprite: Sprite): void;
  /** Recomputes who overlaps whom. Called when the set of sprites changes, not per frame. */
  buildOccludeList(): void;
  update(): void;
  readonly sprites: readonly Sprite[];
  readonly balls: readonly Sprite[];
}

export function makeRect(x = 0, y = 0, width = -1, height = 0): Rect {
  return { x, y, width, height };
}

export function createRenderer(o: RendererOptions): Renderer {
  const sprites: Sprite[] = [];
  const balls: Sprite[] = [];
  /** The pixels saved from beneath each ball, one patch per ball. */
  const ballPatches = new Map<Sprite, { fb: Framebuffer; rect: Rect }>();
  const screenRect: Rect = { x: 0, y: 0, width: o.width, height: o.height };

  /** Put back what was underneath each ball, newest first. */
  function unpaintBalls(): void {
    for (let i = balls.length - 1; i >= 0; i--) {
      const ball = balls[i]!;
      const patch = ballPatches.get(ball);
      if (patch && patch.rect.width > 0) {
        copyBitmap(o.screen, patch.rect.width, patch.rect.height, patch.rect.x, patch.rect.y, patch.fb, 0, 0);
      }
      ball.dirtyRectPrev = { ...ball.dirtyRect };
    }
  }

  function paintBalls(): void {
    // Depth order, nearest last. Two balls overlapping must resolve the same way every frame.
    const ordered = [...balls].sort((a, b) => a.depth - b.depth);

    for (const ball of ordered) {
      if (!ball.bmp || !rectangleClip(ball.bmpRect, screenRect, ball.dirtyRect)) {
        ball.dirtyRect.width = -1;
        continue;
      }
      const rect = ball.dirtyRect;

      // Save what is there before covering it.
      const patch = { fb: createPatch(rect.width, rect.height), rect: { ...rect } };
      copyBitmap(patch.fb, rect.width, rect.height, 0, 0, o.screen, rect.x, rect.y);
      ballPatches.set(ball, patch);

      // paintFlat: color only, and only where the scene is further away than this ball.
      paintFlat(o.screen, o.zScreen, ball.bmp, ball.depth, {
        width: rect.width, height: rect.height,
        dstX: rect.x, dstY: rect.y,
        srcX: rect.x - ball.bmpRect.x, srcY: rect.y - ball.bmpRect.y,
      });
    }
  }

  /** Redraw everyone overlapping this sprite's dirty rectangle, clipped to it. */
  function repaint(sprite: Sprite): void {
    if (!sprite.occludedSprites || sprite.visualType === 'ball' || sprite.dirtyRect.width <= 0) return;

    const clip: Rect = makeRect();
    for (const other of sprite.occludedSprites) {
      if (other.deleted || !other.bmp || !other.zMap) continue;
      if (!rectangleClip(other.bmpRect, sprite.dirtyRect, clip)) continue;

      paint(o.screen, o.zScreen, other.bmp, other.zMap, {
        width: clip.width, height: clip.height,
        dstX: clip.x, dstY: clip.y,
        srcX: clip.x - other.bmpRect.x, srcY: clip.y - other.bmpRect.y,
      });
    }
  }

  return {
    get sprites() { return sprites; },
    get balls() { return balls; },

    addSprite(sprite: Sprite): void {
      (sprite.visualType === 'ball' ? balls : sprites).push(sprite);
    },

    removeSprite(sprite: Sprite): void {
      const list = sprite.visualType === 'ball' ? balls : sprites;
      const at = list.indexOf(sprite);
      if (at >= 0) list.splice(at, 1);
      ballPatches.delete(sprite);
    },

    buildOccludeList(): void {
      for (const main of sprites) {
        main.occludedSprites = null;
        if (main.deleted || main.boundingRect.width === -1) continue;

        const overlapping = sprites.filter(
          (other) => !other.deleted && other.boundingRect.width !== -1
            && rectangleClip(main.boundingRect, other.boundingRect),
        );

        // A SPRITE WITH ITS OWN BITMAP AND NOBODY ELSE gets no list — the list always contains the
        // sprite itself, so a size of one means it is alone. Transcribed from the upstream; the
        // consequence is that `repaint` then skips it entirely, and I cannot explain from this file
        // alone why that does not leave a hole. Flagged rather than guessed at.
        if (main.bmp && overlapping.length < 2) continue;
        if (overlapping.length) main.occludedSprites = overlapping;
      }
    },

    update(): void {
      unpaintBalls();

      // 1. Work out each dirty sprite's rectangle and CLEAR it back to the background.
      for (const sprite of sprites) {
        if (!sprite.dirty) continue;

        let clear = false;
        if (sprite.visualType === 'sprite') {
          // WHERE IT WAS AND WHERE IT IS. Clearing only the new position leaves a trail.
          if (sprite.dirtyRectPrev.width > 0) {
            enclosingBox(sprite.dirtyRectPrev, sprite.bmpRect, sprite.dirtyRect);
          } else {
            sprite.dirtyRect = { ...sprite.bmpRect };
          }
          clear = rectangleClip(sprite.dirtyRect, screenRect, sprite.dirtyRect);
          if (!clear) sprite.dirtyRect.width = -1;
        } else if (sprite.visualType === 'background') {
          if (rectangleClip(sprite.bmpRect, screenRect, sprite.dirtyRect)) {
            clear = !sprite.bmp;
          } else {
            sprite.dirtyRect.width = -1;
          }
        }

        if (!clear) continue;
        const r = sprite.dirtyRect;
        fillZ(o.zScreen, 0xffff, { x: r.x, y: r.y, width: r.width, height: r.height });
        if (o.background) {
          copyBitmap(o.screen, r.width, r.height, r.x, r.y, o.background, r.x, r.y);
        } else {
          clearRegion(o.screen, r);
        }
      }

      // 2. Redraw everything that overlapped what we just erased.
      for (const sprite of sprites) {
        if (!sprite.dirty) continue;
        repaint(sprite);
        sprite.dirty = false;
        sprite.dirtyRectPrev = { ...sprite.dirtyRect };
      }

      paintBalls();
    },
  };
}

/* ===================== small helpers ===================== */

function createPatch(width: number, height: number): Framebuffer {
  const buf = new ArrayBuffer(width * height * 4);
  return { width, height, pixels: new Uint32Array(buf), bytes: new Uint8ClampedArray(buf) };
}

function clearRegion(fb: Framebuffer, r: Rect): void {
  for (let y = 0; y < r.height; y++) {
    const start = (r.y + y) * fb.width + r.x;
    fb.pixels.fill(0, start, start + r.width);
  }
}

// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { readGroups, EntryType } from '../app/js/dat/partman.js';
import { readBitmapHeader } from '../app/js/dat/bitmap8.js';
import {
  readLampSprites, readSprite, drawLamp, drawSpriteCentred, TABLE_ORIGIN_RECORD,
} from '../app/js/gfx/original-sprites.js';
import { createFramebuffer, pack } from '../app/js/gfx/framebuffer.js';
import { resource } from './helpers/original-data.js';

/**
 * ⚠️ THE LAMPS ARE DRAWN WHERE THE WINDOW SAYS, NOT WHERE THE PLAYFIELD DOES.
 *
 * Every bitmap in the archive carries its position in the 1995 WINDOW — 600x416, the table on the left
 * and the side panel on the right. The playfield's own bitmap sits at (137, 2) in that window, so a
 * lamp at (313, 390) belongs at (176, 388) on the playfield. Drawn at the raw number, all one hundred
 * and thirty-nine of them land a hundred and thirty-seven pixels to the right of where they go — and
 * forty of them fall off the picture entirely, which is the only reason it would be noticed at all.
 */

const DAT = resource('PINBALL.DAT');
const archive = () => {
  if (!existsSync(DAT)) return null;
  const buf = readFileSync(DAT);
  return readGroups(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
};

describe('the lamps, as pictures', () => {
  test('every lamp in the archive has one, and they are placed against the table’s own corner', () => {
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const lamps = readLampSprites(groups);
    const lite1 = lamps.get('lite1')!;

    expect(lamps.size).toBe(139);
    // `lite1`'s bitmap header says (313, 390) and the table's says (137, 2).
    expect([lite1.x, lite1.y]).toEqual([313 - 137, 390 - 2]);
    expect([lite1.frames[0]!.width, lite1.frames[0]!.height]).toEqual([13, 13]);
  });

  test('⚠️ and every one of them lands ON the playfield once the corner is taken off', () => {
    // Forty of the hundred and thirty-nine have an x past 365 in the window's own numbers. Read
    // absolutely they hang off the right of the picture; read against the table's corner, not one of
    // them does.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const lamps = readLampSprites(groups);

    let beyondRaw = 0;
    for (const [, lamp] of lamps) {
      expect(lamp.x).toBeGreaterThanOrEqual(0);
      expect(lamp.y).toBeGreaterThanOrEqual(0);
      expect(lamp.x + lamp.frames[0]!.width).toBeLessThanOrEqual(365);
      expect(lamp.y + lamp.frames[0]!.height).toBeLessThanOrEqual(470);
      if (lamp.x + lamp.frames[0]!.width + 137 > 365) beyondRaw++;
    }

    expect(beyondRaw, 'and this many would have hung off it').toBe(40);
  });

  test('⚠️ INDEX ZERO IS TRANSPARENT, which the playfield’s own decoder does not do', () => {
    // The background is opaque everywhere by design — `decodePlayfield` says so — because it IS the
    // background. A lamp is a sprite laid over it: with index zero opaque, every lamp paints its own
    // little black rectangle onto the table and the picture fills with square holes.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const lamp = readLampSprites(groups).get('lite1')!;
    const pixels = [...lamp.frames[0]!.pixels];

    // Index zero is the palette's black with no alpha, which packs to a plain zero either way round.
    expect(pixels.includes(0), 'some of it is see-through').toBe(true);
    expect(pixels.some((p) => p !== 0), 'and some of it is the lamp').toBe(true);
  });

  test('⚠️ A COMPONENT’S OTHER FRAMES ARE IN THE UNNAMED GROUPS THAT FOLLOW IT', () => {
    // This is the part I got wrong first, and the file is emphatic about it. `TPinballComponent` asks
    // `loader::query_visual(groupIndex, i)` for every visual state it has, and the loader walks
    // FORWARD from the component's own group: the frames sit in the anonymous groups between it and
    // the next named one.
    //
    // Reading only the named group's own bitmap gives every component frame zero and nothing else —
    // which looks like a table whose parts simply do not animate, and there is no error anywhere.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const lamps = readLampSprites(groups);

    // `lite1` is followed immediately by `lite2`, so it has one picture and no more.
    expect(lamps.get('lite1')!.frames.length).toBe(1);
    // `lite2` is followed by two anonymous groups of its own size.
    expect(lamps.get('lite2')!.frames.length).toBe(3);
    for (const frame of lamps.get('lite2')!.frames) {
      expect([frame.width, frame.height]).toEqual([10, 8]);
    }
  });

  test('⚠️ and the frames stop at the next NAMED group', () => {
    // The anonymous run belongs to the component before it. Walking past the next name would give
    // `lite2` the frames of `lite3` as well, and a lamp would draw a picture from somewhere else on
    // the table — the right thing in the wrong place, which is the hardest kind of wrong to see.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);
    const lamps = readLampSprites(groups);

    const lite2 = lamps.get('lite2')!;
    const lite3 = lamps.get('lite3')!;

    expect(lite2.frames.length).toBe(3);
    expect(lite3.frames.length).toBe(3);
    expect([lite3.frames[0]!.width, lite3.frames[0]!.height], 'and its own size').toEqual([12, 12]);
  });

  test('⚠️ at half scale both the picture and the CORNER it sits at halve', () => {
    // Halving the bitmap and leaving the position is the same defect as halving the projection's
    // centre without its focal distance: everything is the right size and in the wrong place, further
    // out the further from the origin it is.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const full = readLampSprites(groups).get('lite1')!;
    const half = readLampSprites(groups, { scale: 0.5 }).get('lite1')!;

    expect(half.x).toBe(Math.round(full.x / 2));
    expect(half.y).toBe(Math.round(full.y / 2));
    expect(half.frames[0]!.width).toBe(Math.ceil(full.frames[0]!.width / 2));
  });

  test('⚠️ drawing one leaves its TRANSPARENT pixels alone', () => {
    // A lamp is a sprite, not a rectangle. Stamping every pixel puts a little block of the lamp's own
    // background over the table — a hole the shape of the bitmap around a lamp that is otherwise
    // perfectly drawn, which looks like bad art rather than like a missing test.
    const dst = createFramebuffer(4, 1);
    dst.pixels.fill(0xff112233);
    const sprite = {
      x: 1, y: 0,
      frames: [{
        at: null, x: 1, y: 0, width: 2, height: 1,
        pixels: new Uint32Array([0, 0xff445566]), bytes: new Uint8ClampedArray(8),
      }],
    };

    drawLamp(dst, sprite);

    expect([...dst.pixels])
      .toEqual([0xff112233, 0xff112233, 0xff445566, 0xff112233]);
  });

  test('⚠️ MINUS ONE DRAWS NOTHING, which is how everything in this game hides itself', () => {
    // `SpriteSet(-1)`: a popup target that has dropped, a barrier that is not raised, a lane the ball
    // is standing on. Every other out-of-range index is clamped into the list — this one must not be,
    // or a target that has been knocked down goes on standing there.
    const dst = createFramebuffer(2, 1);
    const sprite = {
      x: 0, y: 0,
      frames: [{
        at: null, x: 0, y: 0, width: 2, height: 1,
        pixels: new Uint32Array([0xff445566, 0xff778899]), bytes: new Uint8ClampedArray(8),
      }],
    };

    drawLamp(dst, sprite, -1);

    expect([...dst.pixels], 'nothing at all').toEqual([0, 0]);
    drawLamp(dst, sprite, 99);
    expect([...dst.pixels], 'and anything past the end is still the last picture')
      .toEqual([0xff445566, 0xff778899]);
  });

  test('⚠️ and it CLIPS instead of wrapping onto the far edge', () => {
    // Every lamp on this file lands inside the playfield once the corner is off. One that did not
    // would otherwise reappear on the opposite side of the picture a row at a time, which reads as a
    // torn image rather than as a misplaced lamp.
    const dst = createFramebuffer(3, 2);
    const sprite = {
      x: 2, y: 0,
      frames: [{
        at: null, x: 2, y: 0, width: 2, height: 1,
        pixels: new Uint32Array([0xff445566, 0xff778899]), bytes: new Uint8ClampedArray(8),
      }],
    };

    drawLamp(dst, sprite);

    expect([...dst.pixels], 'the second pixel is off the right edge and is dropped')
      .toEqual([0, 0, 0xff445566, 0, 0, 0]);
  });

  test('⚠️ and the corner comes from the TABLE’S OWN BITMAP, not from a constant', () => {
    // 137 and 2 are this archive's numbers, not the format's. An authored table puts its playfield
    // wherever it likes, and a hardcoded corner would move every lamp on it.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);
    const table = groups.find((g) => g?.name === 'table')!;
    const header = readBitmapHeader(
      table.entries.find((e) => e.type === EntryType.Bitmap8)!.data!,
    );

    expect([header.x, header.y], 'which on this file happen to be').toEqual([137, 2]);
    expect(TABLE_ORIGIN_RECORD, 'and are read, not written down').toBe('table');
  });
});

/**
 * ⚠️ THE BALL HAS A PICTURE TOO, AND IT IS NINE PIXELS ACROSS.
 *
 * The demonstration has drawn a flat coloured disc since it had a ball at all. The archive ships the
 * real one: a 9x9 sprite at (0, 0), the origin standing for "wherever the ball is" rather than for a
 * place on the table — it is the one bitmap in the file whose position is not its position.
 */
/**
 * ⚠️ AND A FRAME HAS ITS OWN CORNER, WHICH THE FLIPPER IS THE PROOF OF.
 *
 * A lamp's three brightnesses sit at one place and so do the ball's seven sizes, so a sprite with one
 * position for all its frames looks right on both. The flipper's eight poses do not: they run from
 * (261, 378) up to (261, 358) as the pas sweeps, because a rotating shape's bounding box moves. Drawn
 * from the first frame's corner the flipper swings in the wrong place by up to twenty pixels — and it
 * still swings, which is what makes it hard to see.
 */
describe('a frame’s own corner', () => {
  test('the flipper’s eight poses are at eight different places', () => {
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const flipper = readSprite(groups, 'a_flip1')!;

    expect(flipper.frames.length).toBe(8);
    const ys = new Set(flipper.frames.map((f) => f.y));
    expect(ys.size, 'and not all at one').toBeGreaterThan(1);
    // The first is the flipper at rest and the last is the flipper up.
    expect(flipper.frames[0]!.y).toBeGreaterThan(flipper.frames[7]!.y);
  });

  test('⚠️ and a lamp’s frames DO share one, which is why one position looked right', () => {
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const lamp = readLampSprites(groups).get('lite2')!;

    expect(new Set(lamp.frames.map((f) => `${f.x},${f.y}`)).size).toBe(1);
  });

  test('⚠️ and the FRAME’S corner is what places it, not the sprite’s', () => {
    // Stated on a fixture rather than on the art: the sprite says (0, 0) and the frame says (2, 1), and
    // the pixel must land where the FRAME says. Measured on the flipper's own pictures this cannot be
    // seen — the poses have different silhouettes, so the topmost lit row moves even when the corner
    // does not, and the mutation survived a test that looked right.
    const dst = createFramebuffer(4, 3);
    const sprite = {
      x: 0, y: 0,
      frames: [{
        at: null, x: 2, y: 1, width: 1, height: 1,
        pixels: new Uint32Array([0xff334455]), bytes: new Uint8ClampedArray(4),
      }],
    };

    drawLamp(dst, sprite, 0);

    expect(dst.pixels[1 * 4 + 2], 'at the frame’s corner').toBe(0xff334455);
    expect(dst.pixels[0], 'and not at the sprite’s').toBe(0);
  });

  test('⚠️ and a frame’s corner scales with the picture', () => {
    // The sprite's own corner scaled and the frames' did not, which is right for every sprite whose
    // frames share one place and wrong for the flipper — its poses would all be drawn at full-size
    // coordinates on a half-size table, off the bottom of the picture.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const full = readSprite(groups, 'a_flip1')!;
    const half = readSprite(groups, 'a_flip1', { scale: 0.5 })!;

    expect(half.frames[7]!.y).toBe(Math.round(full.frames[7]!.y / 2));
    expect(half.frames[0]!.y).toBe(Math.round(full.frames[0]!.y / 2));
    expect(half.frames[7]!.x).toBe(Math.round(full.frames[7]!.x / 2));
    expect(half.frames[0]!.x, 'and a hundred and twenty-four, not two hundred and forty-eight')
      .toBe(Math.round(full.frames[0]!.x / 2));
  });

  test('⚠️ and drawing frame seven puts it where frame seven says, not where frame zero does', () => {
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);
    const flipper = readSprite(groups, 'a_flip1')!;
    const rest = createFramebuffer(365, 470);
    const up = createFramebuffer(365, 470);

    drawLamp(rest, flipper, 0);
    drawLamp(up, flipper, 7);

    const rowsOf = (fb: typeof rest) => {
      const rows = new Set<number>();
      fb.pixels.forEach((pixel, i) => { if (pixel !== 0) rows.add(Math.floor(i / fb.width)); });
      return rows;
    };
    const restRows = [...rowsOf(rest)];
    const upRows = [...rowsOf(up)];

    expect(Math.min(...upRows), 'the raised pose reaches higher up the table')
      .toBeLessThan(Math.min(...restRows));
  });
});

describe('the ball’s own picture', () => {
  test('it is read like any other sprite, and its recorded corner is the origin', () => {
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const ball = readSprite(groups, 'ball')!;

    expect([ball.frames[0]!.width, ball.frames[0]!.height]).toEqual([9, 9]);
    // (0,0) in the window is (-137,-2) against the table's corner: the ball is not AT a place.
    expect([ball.x, ball.y]).toEqual([-137, -2]);
  });

  test('⚠️ its highlight is gdrv’s WHITE, and its index 0 is still a hole', () => {
    // The ball has exactly one pixel of index 255, at (3, 3): the specular dot that makes it a sphere
    // rather than a disc. `gdrv::display_palette` writes pure white over entry 255 without reading the
    // file, and this archive's own entry 255 is (252, 252, 252) — so a decoder that trusts the palette
    // dims the highlight on the ball, on every lamp and on both flippers' flags.
    //
    // The second half is what stops the fix from being a regression: gdrv's index 0 is transparent,
    // and it has to STAY transparent here or the ball comes with a 9x9 black card behind it.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const ball = readSprite(groups, 'ball')!;
    const first = ball.frames[0]!;

    expect(first.pixels[3 * 9 + 3], 'the highlight').toBe(pack(255, 255, 255, 255));
    expect(first.pixels[0], 'and the corner, which is index 0').toBe(0);
  });

  test('⚠️ and each frame carries the POINT at which its size is right, in record 501', () => {
    // `TBall::Repaint` walks `VisualZArray` for the first threshold at or below the ball's own
    // distance, and the thresholds are the distances to these points. The archive stores them as
    // table positions — (0, y, 0.3), the ball's radius above the playfield — running from the far end
    // of the table to the near one, which is why the pictures run from nine pixels to fifteen.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const ball = readSprite(groups, 'ball')!;

    const thresholds = [-13.5, -1.5, 0.3, 7.5, 10.5, 12.5, 13.5];
    ball.frames.forEach((frame, i) => expect(frame.at?.y, `frame ${i}`).toBeCloseTo(thresholds[i]!, 5));
    // ⚠️ AND THEY RUN FROM THE FAR END OF THE TABLE TO THE NEAR ONE, which is the order the loop in
    // `TBall::Repaint` depends on: it takes the FIRST threshold at or below the ball's own distance.
    for (let i = 1; i < ball.frames.length; i++) {
      expect(ball.frames[i]!.at!.y).toBeGreaterThan(ball.frames[i - 1]!.at!.y);
    }
    for (const frame of ball.frames) expect(frame.at?.z).toBeCloseTo(0.3, 6);
  });

  test('⚠️ and a sprite whose frames say nothing about depth answers null for it', () => {
    // Only the ball is drawn by distance. A lamp's frames carry no 501 and must not be given one — a
    // threshold invented for them would pick a brightness by how far away the lamp is.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    for (const frame of readLampSprites(groups).get('lite2')!.frames) {
      expect(frame.at).toBe(null);
    }
  });

  test('⚠️ and its seven frames are SIZES, not poses: the ball is bigger when it is nearer', () => {
    // Nine pixels across up to fifteen, one per step. Every other component's frames are a pose or a
    // brightness; the ball's are perspective, and `TBall::Repaint` picks by depth. This build draws
    // the first, which is the ball at its farthest — stated here rather than left to be discovered.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const ball = readSprite(groups, 'ball')!;

    expect(ball.frames.map((f) => f.width)).toEqual([9, 10, 11, 12, 13, 14, 15]);
    for (const frame of ball.frames) expect(frame.width).toBe(frame.height);
  });

  test('⚠️ and a group that does not exist answers null rather than an empty picture', () => {
    // A sprite with no pixels is something that can be drawn and never seen, which is worse than one
    // that is honestly absent — the caller can decide, and the demonstration falls back to its disc.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    expect(readSprite(groups, 'no_such_group')).toBe(null);
  });

  test('⚠️ drawn CENTRED, because a ball is at a point and a bitmap is at a corner', () => {
    // `drawLamp` places a sprite by its top-left. The ball's position is its middle, so drawing it
    // there puts it down and to the right by half its own width — about three pixels at half scale,
    // which is half a ball and reads as the physics being off rather than the drawing.
    const dst = createFramebuffer(5, 5);
    const sprite = {
      x: 0, y: 0,
      frames: [{
        at: null, x: 0, y: 0, width: 3, height: 3,
        pixels: new Uint32Array([1, 1, 1, 1, 1, 1, 1, 1, 1]),
        bytes: new Uint8ClampedArray(36),
      }],
    };

    drawSpriteCentred(dst, sprite, 2, 2);

    // A three-wide sprite centred on column two covers columns one to three.
    expect([...dst.pixels.subarray(0, 5)], 'the top row is clear').toEqual([0, 0, 0, 0, 0]);
    expect([...dst.pixels.subarray(5, 10)]).toEqual([0, 1, 1, 1, 0]);
  });
});

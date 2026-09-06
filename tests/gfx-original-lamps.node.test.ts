// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { readGroups, EntryType } from '../app/js/dat/partman.js';
import { readBitmapHeader } from '../app/js/dat/bitmap8.js';
import { readLampSprites, drawLamp, TABLE_ORIGIN_RECORD } from '../app/js/gfx/original-lamps.js';
import { createFramebuffer } from '../app/js/gfx/framebuffer.js';

/**
 * ⚠️ THE LAMPS ARE DRAWN WHERE THE WINDOW SAYS, NOT WHERE THE PLAYFIELD DOES.
 *
 * Every bitmap in the archive carries its position in the 1995 WINDOW — 600x416, the table on the left
 * and the side panel on the right. The playfield's own bitmap sits at (137, 2) in that window, so a
 * lamp at (313, 390) belongs at (176, 388) on the playfield. Drawn at the raw number, all one hundred
 * and thirty-nine of them land a hundred and thirty-seven pixels to the right of where they go — and
 * forty of them fall off the picture entirely, which is the only reason it would be noticed at all.
 */

const DAT = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.DAT';
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

  test('⚠️ and on THIS file every lamp has exactly one picture, so the frame index chooses nothing', () => {
    // `TLight` carries a frame index and `setOnFrame` moves it, and the archive gives not one of its
    // hundred and thirty-nine lamps a second bitmap. So the index is real machinery with nothing to
    // choose between here, and the frames are kept as a LIST anyway — in the archive's own order,
    // which is the order the index counts in — because an authored table is where it will matter.
    //
    // Asserting that some lamp has several would have been asserting a wish: I wrote that test first
    // and the file said no.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const lamps = readLampSprites(groups);

    for (const [name, lamp] of lamps) expect(lamp.frames.length, name).toBe(1);
    // And the picture is the group's own first bitmap, at its own size.
    const group = groups.find((g) => g?.name === 'lite25')!;
    const header = readBitmapHeader(
      group.entries.find((e) => e.type === EntryType.Bitmap8)!.data!,
    );
    expect(lamps.get('lite25')!.frames[0]!.width).toBe(header.width);
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
      frames: [{ width: 2, height: 1, pixels: new Uint32Array([0, 0xff445566]), bytes: new Uint8ClampedArray(8) }],
    };

    drawLamp(dst, sprite);

    expect([...dst.pixels])
      .toEqual([0xff112233, 0xff112233, 0xff445566, 0xff112233]);
  });

  test('⚠️ and it CLIPS instead of wrapping onto the far edge', () => {
    // Every lamp on this file lands inside the playfield once the corner is off. One that did not
    // would otherwise reappear on the opposite side of the picture a row at a time, which reads as a
    // torn image rather than as a misplaced lamp.
    const dst = createFramebuffer(3, 2);
    const sprite = {
      x: 2, y: 0,
      frames: [{ width: 2, height: 1, pixels: new Uint32Array([0xff445566, 0xff778899]), bytes: new Uint8ClampedArray(8) }],
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

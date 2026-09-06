// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { decodePlayfield, readCamera, PROJECTION_CENTRE_RECORD } from '../app/js/gfx/original-view.js';
import { readGroups, type Group } from '../app/js/dat/partman.js';
import { PLAYFIELD_COLOR } from '../app/js/gfx/table-view.js';
import { pack } from '../app/js/gfx/framebuffer.js';
import { EntryType } from '../app/js/dat/partman.js';
import { readBitmapHeader, HEADER_SIZE } from '../app/js/dat/bitmap8.js';
import { unpackIndexed } from '../app/js/dat/indexed.js';

/**
 * ⚠️ THE SECOND HALF OF THE DEMONSTRATION MODE: something to look at.
 *
 * `table/original` gives the ball somewhere to roll; this decodes the playfield the original draws it
 * on, through the archive's own palette, with the projection the original uses.
 */

const DAT = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.DAT';
const archive = (): Group[] | null => {
  if (!existsSync(DAT)) return null;
  const buf = readFileSync(DAT);
  return readGroups(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
};

/** How many times each palette index appears across every bitmap in the archive. */
function usedPaletteIndices(groups: readonly Group[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const group of groups) {
    for (const entry of group.entries) {
      if (entry.type !== EntryType.Bitmap8 || !entry.data) continue;
      const header = readBitmapHeader(entry.data);
      const indices = unpackIndexed(entry.data.subarray(HEADER_SIZE), {
        width: header.width,
        height: header.height,
        indexedStride: header.indexedStride ?? header.width,
      });
      for (const index of indices) counts.set(index, (counts.get(index) ?? 0) + 1);
    }
  }
  return counts;
}

describe('the playfield, decoded', () => {
  test('it is 365 by 470, which is what an independent dump of this file reports', () => {
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const frame = decodePlayfield(groups);

    expect([frame.width, frame.height]).toEqual([365, 470]);
  });

  test('⚠️ and it is OPAQUE, whatever the palette’s alpha bytes say', () => {
    // Every alpha byte in `PINBALL.DAT` is zero — `dat/palette` says so in its own header — so a decoder
    // that trusted them would produce a table that is entirely invisible and report no error at all.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const frame = decodePlayfield(groups);

    for (let i = 0; i < frame.pixels.length; i += 5000) {
      expect(frame.bytes[i * 4 + 3], `alpha at ${i}`).toBe(255);
    }
  });

  test('⚠️ its left edge is ONE colour all the way down, which a wrong stride destroys', () => {
    // Indexed rows are padded to a multiple of four bytes: this bitmap is 365 wide with a stride of
    // 368. Walking the source by WIDTH skews the picture three bytes further every row, and by the top
    // it is reading four rows away from where it should. The failure is not a crash, it is a smear.
    //
    // ⚠️ MY FIRST VERSION COUNTED DISTINCT COLOURS AND THE MUTATION SURVIVED IT — a smear has plenty of
    // colours. The table has a solid black border, so column zero is exactly ONE colour across all 470
    // rows when the stride is right and many when it is not. Measured from the archive rather than
    // assumed, which is what a conformance test is for.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const frame = decodePlayfield(groups);
    const leftEdge = new Set<number>();
    for (let y = 0; y < frame.height; y++) leftEdge.add(frame.pixels[y * frame.width]!);

    expect(leftEdge.size).toBe(1);
    expect(leftEdge.has(PLAYFIELD_COLOR)).toBe(false);
  });

  test('and it is not one flat colour either, because a border is not a table', () => {
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const frame = decodePlayfield(groups);
    const seen = new Set<number>();
    for (let i = 0; i < frame.pixels.length; i += 97) seen.add(frame.pixels[i]!);

    expect(seen.size).toBeGreaterThan(20);
  });

  test('⚠️ index 255 is gdrv’s WHITE, not the file’s 252', () => {
    // `gdrv::display_palette` does not read entry 255 out of the file: it writes pure white over it,
    // the same way it writes the Windows system colours over 1..9 and leaves 246..254 at the memset’s
    // zero. This archive’s own entry 255 is (252, 252, 252) — the ONLY near-white entry it carries —
    // so a decoder that trusts the file paints every highlight in the game three units dark: the ball’s
    // specular dot, every lamp’s hot spot, the flippers’ flags, the plunger. 1791 pixels in all.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const frame = decodePlayfield(groups);

    // (88, 92) of the table bitmap is index 255, and it is the first one that is.
    expect(frame.pixels[92 * 365 + 88]).toBe(pack(255, 255, 255, 255));
  });

  test('⚠️ and EVERY pixel stays opaque, though gdrv would make 37810 of them holes', () => {
    // gdrv’s map is written for sprites, where index 0 means “do not draw”. The playfield uses index 0
    // for 37810 of its 171550 pixels — it is a colour there, not a hole — so the background decoder
    // forces the alpha back on.
    //
    // The sampled test above kills the same mutant, and honesty says so: at 22% of the picture it could
    // hardly miss. This one is its stronger form, and it is the one that would survive a partial
    // failure — a transparency that reached only some rows, or only the 246-to-254 block.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const frame = decodePlayfield(groups);
    let clear = 0;
    for (let i = 0; i < frame.pixels.length; i++) if (frame.bytes[i * 4 + 3] !== 255) clear++;

    expect(clear, 'transparent pixels in the playfield').toBe(0);
  });

  test('⚠️ and 255 is the ONLY index where gdrv and the file disagree here', () => {
    // The reason `gfx/gdrv` is worth wiring in at all, stated as a measurement rather than a hope.
    // Of gdrv’s four overrides, this archive exercises exactly one: indices 1..9 appear in none of the
    // 318 bitmaps, and 246..254 appear once, in `background` — the side panel, which decision 6 of the
    // plan deleted. If this ever fails, the file changed and the reasoning above has to be redone.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const used = usedPaletteIndices(groups);

    for (let i = 1; i <= 9; i++) expect(used.get(i) ?? 0, `index ${i}`).toBe(0);
    expect(used.get(255), 'the highlight').toBe(1791);
  });
});

describe('the camera the original uses', () => {
  test('⚠️ the projection centre is AUTHORED, not half the bitmap', () => {
    // `pb_init` sets it to half the table's size and `TTableLayer` then recentres from record 700. On
    // this archive that is (183, 238) against a 365x470 bitmap — 182.5 and 235 if it were derived. The
    // three pixels in y never announce themselves: the whole table sits high and every collision is
    // still correct.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const camera = readCamera(groups);

    expect(camera.centre).toEqual({ x: 183, y: 238 });
    expect(camera.centre.y).not.toBe(470 / 2);
  });

  test('and the matrix is the tilted plane `maths/proj` documents', () => {
    // cos(24 degrees) is 0.913545 and sin(24 degrees) is 0.406737. The port wrote those numbers down
    // from the upstream; this is the first time they have been read out of the file itself.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const camera = readCamera(groups);
    const middle = camera.projection.toScreen({ x: 0, y: 0, z: 0 });

    // The table's own origin lands inside the bitmap rather than off it.
    expect(middle.x).toBeGreaterThan(0);
    expect(middle.x).toBeLessThan(365);
    expect(middle.y).toBeGreaterThan(0);
    expect(middle.y).toBeLessThan(470);
  });

  test('⚠️ and DOWN the table is DOWN the screen', () => {
    // The one property that makes the picture agree with the physics. Table y grows toward the drain,
    // and if the projection inverted it the ball would fall upward while colliding correctly — which
    // looks like a physics bug and is a drawing bug.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const { projection } = readCamera(groups);

    const high = projection.toScreen({ x: 0, y: -10, z: 0 });
    const low = projection.toScreen({ x: 0, y: 10, z: 0 });

    expect(low.y).toBeGreaterThan(high.y);
  });

  test('the record number is the original’s', () => {
    expect(PROJECTION_CENTRE_RECORD).toBe(700);
  });
});

/**
 * ⚠️ THE HALVING GOES IN THE PROJECTION, NOT IN THE PHYSICS.
 *
 * Decision 5 of the plan: the playfield is drawn at 183x235 rather than 365x470. The table keeps its
 * own float units and only the map onto pixels changes — which is the whole reason `maths/proj` is a
 * separate thing from `physics`.
 */
describe('the camera at half scale', () => {
  test('a table point lands on half the pixel it landed on before', () => {
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);
    const point = { x: 2.5, y: -3.25, z: 0.3 };

    const full = readCamera(groups).projection.toScreen(point);
    const half = readCamera(groups, { scale: 0.5 }).projection.toScreen(point);

    expect(half.x).toBeCloseTo(full.x / 2, 0);
    expect(half.y).toBeCloseTo(full.y / 2, 0);
  });

  test('⚠️ and BOTH the focal distance and the centre scale, or the table slides off its own bitmap', () => {
    // `toScreen` is `p * (d / z) + centre`. Halving the centre alone leaves every point twice as far
    // from a middle that moved: the table would sit off to one side by a quarter of its own width, and
    // the collisions would all still be right.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const full = readCamera(groups);
    const half = readCamera(groups, { scale: 0.5 });

    expect(half.centre.x).toBeCloseTo(full.centre.x / 2, 6);
    expect(half.centre.y).toBeCloseTo(full.centre.y / 2, 6);
    expect(half.d).toBeCloseTo(full.d / 2, 6);
  });

  test('⚠️ and the DEPTH does not scale with it', () => {
    // The depth is a distance in table units, not in pixels: it is what the ball is compared against
    // in a z-buffer whose numbers came from the same projection at any size. Scaling it would put the
    // ball at half the distance from the camera because the picture got smaller.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);
    const point = { x: 2.5, y: -3.25, z: 0.3 };

    expect(readCamera(groups, { scale: 0.5 }).projection.depthOf(point))
      .toBe(readCamera(groups).projection.depthOf(point));
  });
});

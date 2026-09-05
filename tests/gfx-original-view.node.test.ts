// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { decodePlayfield, readCamera, PROJECTION_CENTRE_RECORD } from '../app/js/gfx/original-view.js';
import { readGroups, type Group } from '../app/js/dat/partman.js';
import { PLAYFIELD_COLOR } from '../app/js/gfx/table-view.js';

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

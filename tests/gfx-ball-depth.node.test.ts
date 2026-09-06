// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { readGroups } from '../app/js/dat/partman.js';
import { readPlayfieldDepth, readCamera, decodePlayfield } from '../app/js/gfx/original-view.js';
import { fillCircleBehind } from '../app/js/gfx/table-view.js';
import { createFramebuffer } from '../app/js/gfx/framebuffer.js';

/**
 * ⚠️ THE BALL HAS TO GO UNDER THE RAMPS, AND THE ARCHIVE ALREADY SAYS WHERE.
 *
 * The playfield's group carries a 16-bit DEPTH MAP beside its bitmap — one number per pixel, the same
 * 365x470 — and the whole of the original's occlusion is a comparison against it. Until the ramps
 * existed the ball had nothing to go under; now it does, and drawing it flat on top puts it over an
 * arch it is physically beneath.
 */

const DAT = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.DAT';
const archive = () => {
  if (!existsSync(DAT)) return null;
  const buf = readFileSync(DAT);
  return readGroups(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
};

describe('the playfield’s own depth map', () => {
  test('it is the same size as the picture, and its stride is in CELLS', () => {
    // ⚠️ THE STRIDE IS NOT THE WIDTH. It counts 16-bit cells and the surplus is padding at the end of
    // each row; reading with a step of `width` produces an image that slides sideways a little more on
    // every row — which looks like a skewed table rather than like a bug in a loop.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const depth = readPlayfieldDepth(groups)!;
    const picture = decodePlayfield(groups);

    expect(depth.width).toBe(picture.width);
    expect(depth.height).toBe(picture.height);
    expect(depth.stride).toBeGreaterThanOrEqual(depth.width);
    expect(depth.depths.length).toBeGreaterThanOrEqual(depth.stride * depth.height);
  });

  test('⚠️ and it is not flat: the ramps stand above the table', () => {
    // If every cell were the same number there would be nothing to go under, and every test below
    // would pass over a depth map that says nothing.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const { depths } = readPlayfieldDepth(groups)!;
    const seen = new Set<number>();
    for (let i = 0; i < depths.length; i += 97) seen.add(depths[i]!);

    expect(seen.size).toBeGreaterThan(10);
  });
});

describe('the ball drawn behind what is in front of it', () => {
  test('⚠️ SMALLER IS NEARER, which is the direction the whole comparison turns on', () => {
    // `zdrv::paint_flat` writes where `dstZ > depth`. Turn the comparison round and the ball is drawn
    // only where it is hidden — it would vanish on the open table and appear inside the ramps.
    const frame = createFramebuffer(4, 1);
    const depths = new Uint16Array([100, 100, 900, 900]);

    fillCircleBehind(frame, { depths, stride: 4 }, 2, 0.5, 2, 500, 0xff00ff00);

    expect(frame.pixels[0], 'the scene is nearer here: the ball is hidden').toBe(0);
    expect(frame.pixels[1]).toBe(0);
    expect(frame.pixels[2], 'and farther here: the ball shows').toBe(0xff00ff00);
    expect(frame.pixels[3]).toBe(0xff00ff00);
  });

  test('⚠️ the depth map is read by its STRIDE and the picture by its width', () => {
    // The two are different numbers, and a ball drawn against the wrong one drifts a pixel further off
    // with every row down the table.
    const frame = createFramebuffer(2, 2);
    // Stride three, width two: the third cell of each row is padding and must never be read.
    const depths = new Uint16Array([900, 900, 0, 900, 900, 0]);

    fillCircleBehind(frame, { depths, stride: 3 }, 1, 1, 2, 500, 0xff0000ff);

    expect([...frame.pixels], 'every pixel drawn: none of them read the padding')
      .toEqual([0xff0000ff, 0xff0000ff, 0xff0000ff, 0xff0000ff]);
  });
});

describe('⚠️ and the two numbers do not agree, which is why nothing draws against it yet', () => {
  test('the projection counts from the near plane and the shipped map counts the other way', () => {
    // Down the bitmap, the table tilts TOWARD the camera. `depthOf` falls to zero at the bottom —
    // the near plane is `zMin` and the bottom of the table sits just below it — and the shipped depth
    // map rises over the same pixels. Both are clean and monotonic, so neither is noise: they simply
    // count from opposite ends, and `zdrv::paint` keeps the SMALLER value.
    //
    // Something in the original converts the one into the other and this port has not read what. The
    // measurement is here so the next person starts from a number rather than from a suspicion.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);
    const camera = readCamera(groups);
    const map = readPlayfieldDepth(groups)!;
    const sample = (py: number) => {
      const t = camera.projection.toTable({ x: 180, y: py });
      return {
        projected: camera.projection.depthOf({ x: t.x, y: t.y, z: 0 }),
        stored: map.depths[py * map.stride + 180]!,
      };
    };

    const high = sample(60);
    const low = sample(420);

    expect(high.projected, 'the projection: far at the top').toBeGreaterThan(low.projected);
    expect(high.stored, 'the map: small at the top').toBeLessThan(low.stored);
  });
});

describe('how deep the ball is', () => {
  test('⚠️ the depth is ROW TWO of the projection matrix, which is what `z_distance` returns', () => {
    // The same dot product `toScreen` divides by. Taking the ball's own z, or the distance to the
    // camera, gives a number in the wrong units entirely — and the ball would be either always in
    // front of everything or always behind it.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);
    const camera = readCamera(groups);
    const point = { x: 1, y: -2, z: 0.3 };
    const row2 = camera.matrix.row2;

    const expected = camera.projection.normalizeDepth(
      row2.x * point.x + row2.y * point.y + row2.z * point.z + row2.w,
    );

    expect(camera.projection.depthOf(point)).toBe(expected);
  });

  test('⚠️ and a ball high on a ramp is NEARER than one on the open table', () => {
    // Which is the whole reason the ball's z exists. Same spot on the playfield, one of them a ball's
    // radius up in the air: the one in the air must come out with the smaller number.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);
    const camera = readCamera(groups);

    const onTable = camera.projection.depthOf({ x: 0, y: 0, z: 0 });
    const onRamp = camera.projection.depthOf({ x: 0, y: 0, z: 1 });

    expect(onRamp).toBeLessThan(onTable);
  });
});

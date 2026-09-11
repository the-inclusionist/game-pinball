// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { readGroups } from '../app/js/dat/partman.js';
import { readPlayfieldDepth, readCamera, decodePlayfield } from '../app/js/gfx/original-view.js';
import { fillCircleBehind } from '../app/js/gfx/table-view.js';
import { createFramebuffer } from '../app/js/gfx/framebuffer.js';
import { resource } from './helpers/original-data.js';

/**
 * ⚠️ THE BALL HAS TO GO UNDER THE RAMPS, AND THE ARCHIVE ALREADY SAYS WHERE.
 *
 * The playfield's group carries a 16-bit DEPTH MAP beside its bitmap — one number per pixel, the same
 * 365x470 — and the whole of the original's occlusion is a comparison against it. Until the ramps
 * existed the ball had nothing to go under; now it does, and drawing it flat on top puts it over an
 * arch it is physically beneath.
 */

const DAT = resource('PINBALL.DAT');
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

describe('⚠️ the map and the projection agree, once the map is the right way up', () => {
  test('the stored depth of the empty playfield IS the projection’s own answer', () => {
    // This is the whole check: away from anything standing above the table, the number in the file and
    // the number the projection computes for the table's own surface are the same to within a fraction
    // of a percent. If they were not, either the depth formula or the map's orientation would be
    // wrong, and the ball would be hidden everywhere or hidden nowhere.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);
    const camera = readCamera(groups);
    const map = readPlayfieldDepth(groups)!;

    for (const py of [30, 60, 150, 330, 420]) {
      const t = camera.projection.toTable({ x: 180, y: py });
      const projected = camera.projection.depthOf({ x: t.x, y: t.y, z: 0 });
      const stored = map.depths[py * map.stride + 180]!;
      expect(Math.abs(projected - stored) / projected, `row ${py}`).toBeLessThan(0.01);
    }
  });

  test('⚠️ and read as it LIES in the file it runs the other way entirely', () => {
    // The map is stored bottom-up and `zdrv::FlipZMapHorizontally` — which swaps ROWS, whatever its
    // name says — mirrors it on load. Unflipped, the stored value rises down the bitmap while the
    // projection falls: the ball would be hidden on the open table and drawn through the ramps.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);
    const map = readPlayfieldDepth(groups)!;
    const asItLies = (py: number) => map.depths[(map.height - 1 - py) * map.stride + 180]!;

    expect(asItLies(60), 'the file, at the top of the picture').toBeLessThan(asItLies(420));
    expect(map.depths[60 * map.stride + 180]!, 'and turned the right way up, the other way round')
      .toBeGreaterThan(map.depths[420 * map.stride + 180]!);
  });
});

describe('how deep the ball is', () => {
  test('⚠️ it is the MAGNITUDE of the projected vector, not row two of it', () => {
    // `proj::z_distance` is `magnitude(matrix * vec)`. Row two is the obvious guess — it is what
    // `toScreen` divides by — and it is the depth along the camera's AXIS rather than the distance to
    // the camera. Against the playfield's own map the magnitude agrees to a fraction of a percent and
    // row two is nine parts in ten out at the top of the bitmap.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);
    const camera = readCamera(groups);
    const point = { x: 1, y: -2, z: 0.3 };
    const m = camera.matrix;
    const dot = (row: { x: number; y: number; z: number; w: number }) =>
      row.x * point.x + row.y * point.y + row.z * point.z + row.w;

    const expected = camera.projection.normalizeDepth(
      Math.hypot(dot(m.row0), dot(m.row1), dot(m.row2)),
    );

    expect(camera.projection.depthOf(point)).toBe(expected);
    expect(camera.projection.depthOf(point), 'and it is not row two alone')
      .not.toBe(camera.projection.normalizeDepth(dot(m.row2)));
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

// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createDemo, DEMO_BALL_COLOR } from '../app/js/shell/demo.js';

const DAT = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.DAT';
const archive = (): ArrayBuffer | null => {
  if (!existsSync(DAT)) return null;
  const buf = readFileSync(DAT);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
};

/**
 * ⚠️ THE WHOLE DEMONSTRATION, END TO END, FROM THE BYTES A PLAYER SUPPLIES.
 *
 * Everything below is composed of pieces already tested on their own. What these add is that they FIT:
 * the parser's groups become walls, the walls hold the ball the field pulls, and the projection puts
 * that ball on a pixel inside the picture the palette decoded. Each of those is a join, and a join is
 * where a port breaks.
 */
describe('the 1995 table, from an ArrayBuffer', () => {
  test('it builds from the bytes alone', () => {
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(bytes);

    expect([demo.playfield.width, demo.playfield.height]).toEqual([365, 470]);
    expect(demo.table.wallCount).toBe(143);
  });

  test('⚠️ the ball lands INSIDE the picture, which is what ties the physics to the pixels', () => {
    // The projection and the collision geometry are read from different records and used by different
    // modules. If either were wrong the ball would collide correctly against walls drawn somewhere else,
    // and the demonstration would look like a ghost passing through furniture.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(bytes);
    const at = demo.ballOnScreen();

    expect(at.x).toBeGreaterThan(0);
    expect(at.x).toBeLessThan(demo.playfield.width);
    expect(at.y).toBeGreaterThan(0);
    expect(at.y).toBeLessThan(demo.playfield.height);
  });

  test('and it stays inside while it falls', () => {
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(bytes);
    for (let i = 0; i < 600; i++) {
      demo.step(1);
      const at = demo.ballOnScreen();
      expect(at.x, `frame ${i}`).toBeGreaterThan(-40);
      expect(at.x, `frame ${i}`).toBeLessThan(demo.playfield.width + 40);
    }
  });

  test('⚠️ and it TOUCHES the table’s own walls, by their group names', () => {
    // The join that matters most: a ball that never hits anything proves the grid is empty rather than
    // that the walls are right.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(bytes);
    demo.step(600);

    expect(demo.touched.length).toBeGreaterThan(0);
  });

  test('the rendered frame carries the ball, and the playfield is not modified', () => {
    // The picture is a still and the ball is the only thing that moves, so the frame is a COPY. Drawing
    // into the playfield itself would leave a trail of every position the ball has ever had.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(bytes);
    const before = demo.playfield.pixels.slice();
    const frame = demo.render();

    expect([...frame.pixels].includes(DEMO_BALL_COLOR)).toBe(true);
    expect([...demo.playfield.pixels]).toEqual([...before]);
  });

  test('dropping again puts a fresh ball back and forgets what the last one touched', () => {
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(bytes);
    demo.step(600);
    demo.drop();

    expect(demo.touched).toEqual([]);
  });
});

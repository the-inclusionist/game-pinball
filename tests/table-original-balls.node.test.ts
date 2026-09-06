// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { buildOriginalTable, MAX_BALLS } from '../app/js/table/original.js';
import { readGroups } from '../app/js/dat/partman.js';

/**
 * ⚠️ THE TABLE KEEPS A POOL OF BALLS, AND `AddBall` REUSES BEFORE IT MAKES.
 *
 * `TPinballTable::AddBall` walks `BallList` for one that is not active and revives it; only when every
 * ball is in play does it make another, and past twenty it refuses. So the list is the high-water mark
 * of balls simultaneously on the table, not a count of balls ever fed — and a port that made a fresh
 * ball every time would leave the dead ones in the list, where `BallCountInRect` would keep finding
 * them and every sink would wait for room that was never going to appear.
 */

const DAT = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.DAT';
const table = () => {
  if (!existsSync(DAT)) return null;
  const buf = readFileSync(DAT);
  return buildOriginalTable(readGroups(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)));
};

describe('the table\u2019s pool of balls', () => {
  test('the ball on the plunger is IN the pool, which is what lets a sink see it', () => {
    const t = table();
    if (!t) return expect(existsSync(DAT)).toBe(false);

    const ball = t.spawnBall()!;

    expect(t.balls).toContain(ball);
    expect(t.ballCountInRect(ball.position, 0.1)).toBe(1);
  });

  test('⚠️ an inactive ball is REVIVED, not left behind', () => {
    const t = table();
    if (!t) return expect(existsSync(DAT)).toBe(false);
    const first = t.spawnBall()!;
    first.active = false;

    const second = t.addBall({ x: 1, y: 2 })!;

    expect(second, 'the same object, brought back').toBe(first);
    expect(t.balls.length, 'and the pool did not grow').toBe(1);
    expect(second.position).toEqual({ x: 1, y: 2 });
    expect(second.active).toBe(true);
  });

  test('⚠️ a revived ball comes back at REST, and free of whatever was holding it', () => {
    // `AddBall` clears the direction, the speed, the time delta and the collision component. A ball
    // handed back still carrying the speed it drained at would leave its new hole like a shot.
    const t = table();
    if (!t) return expect(existsSync(DAT)).toBe(false);
    const first = t.spawnBall()!;
    first.speed = 12;
    first.direction = { x: 1, y: 1 };
    first.collisionDisabled = true;
    first.component = { fieldEffect: () => {} };
    first.active = false;

    const again = t.addBall({ x: 0, y: 0 })!;

    expect(again.speed).toBe(0);
    expect(again.direction).toEqual({ x: 0, y: 0 });
    expect(again.component).toBe(null);
    expect(again.collisionMask).toBe(1);
    expect(again.collisionDisabled).toBe(false);
  });

  test('a ball is only made when every one in the pool is still in play', () => {
    const t = table();
    if (!t) return expect(existsSync(DAT)).toBe(false);

    const first = t.addBall({ x: 0, y: 0 })!;
    const second = t.addBall({ x: 1, y: 0 })!;

    expect(second).not.toBe(first);
    expect(t.balls.length).toBe(2);
  });

  test('⚠️ and past twenty it refuses rather than growing for ever', () => {
    const t = table();
    if (!t) return expect(existsSync(DAT)).toBe(false);

    for (let i = 0; i < MAX_BALLS; i++) expect(t.addBall({ x: i, y: 0 })).not.toBe(null);

    expect(t.addBall({ x: 0, y: 0 }), 'the twenty-first').toBe(null);
    expect(t.balls.length).toBe(MAX_BALLS);
  });

  test('⚠️ the occupancy test counts only ACTIVE balls', () => {
    // A hole waits for room before giving a ball back. Counting a ball that is no longer on the table
    // makes the room never appear, and the hole holds its ball for the rest of the game.
    const t = table();
    if (!t) return expect(existsSync(DAT)).toBe(false);
    const ball = t.addBall({ x: 5, y: 5 })!;

    expect(t.ballCountInRect({ x: 5, y: 5 }, 0.5)).toBe(1);
    ball.active = false;
    expect(t.ballCountInRect({ x: 5, y: 5 }, 0.5)).toBe(0);
  });

  test('⚠️ and it is a SQUARE around the point, not a circle', () => {
    // `BallCountInRect` builds a rect of `pos ± margin` and tests both axes independently. A corner of
    // that square is a margin and a half from the middle, and the original counts it.
    const t = table();
    if (!t) return expect(existsSync(DAT)).toBe(false);
    t.addBall({ x: 1, y: 1 })!;

    expect(t.ballCountInRect({ x: 0, y: 0 }, 1), 'the far corner, inside the square').toBe(1);
    expect(t.ballCountInRect({ x: 0, y: 0 }, 0.99), 'and just outside it').toBe(0);
    // ⚠️ AND BOTH AXES ARE TESTED. A ball level with the point on x and far away on y is outside;
    // dropping either comparison makes the region an infinite band rather than a square, and every
    // hole on that line would wait for room it could not tell apart from a ball across the table.
    t.addBall({ x: 0, y: 5 });
    expect(t.ballCountInRect({ x: 0, y: 0 }, 1), 'same x, five away on y').toBe(1);
  });
});

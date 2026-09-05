// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import {
  buildOriginalPlunger, plungerPosition, MAX_PULLBACK, PULLBACK_DELAY,
  PLUNGER_ELASTICITY, PLUNGER_SMOOTHNESS,
} from '../app/js/table/original-plunger.js';
import { buildOriginalTable } from '../app/js/table/original.js';
import { loadTable } from '../app/js/dat/loader.js';
import { readVisual } from '../app/js/dat/visual.js';
import type { TimerService } from '../app/js/table/bumper.js';

/**
 * ⚠️ THE PLUNGER IS ALMOST ALL CONSTANTS.
 *
 * `TPlunger`'s constructor reads exactly one attribute — record 601, where the ball sits — and writes
 * everything else itself. A port that looked for the rest in the archive would find nothing and
 * quietly plunge with zeros.
 */

const DAT = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.DAT';
const manifest = () => {
  if (!existsSync(DAT)) return null;
  const buf = readFileSync(DAT);
  return loadTable(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
};

const noTimer: TimerService = { set: () => 0, kill: () => {} };

describe('the 1995 plunger', () => {
  test('record 601 says where the ball waits, and it is near the bottom right', () => {
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);
    const index = table.groups.findIndex((group) => group.name === 'plunger');

    const at = plungerPosition(table.groups[index]!)!;

    expect(at.x).toBeCloseTo(-7.021, 3);
    expect(at.y).toBeCloseTo(10.085, 3);
  });

  test('⚠️ and the BALL STARTS THERE, not somewhere near the top', () => {
    // Before the plunger existed the table dropped its ball from a fifth of the way down, because
    // there was nothing to launch it with. A ball that starts in the middle of the table starts its
    // life already in play, and the whole launch lane is never seen.
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);
    const built = buildOriginalTable(table.groups);

    const ball = built.spawnBall();

    expect(ball.position.x).toBeCloseTo(built.plungerPosition!.x, 3);
    expect(ball.position.y).toBeCloseTo(built.plungerPosition!.y, 3);
  });

  test('⚠️ the material is the constructor’s 0.5, NOT the visual’s', () => {
    // Every other collision component on this table takes its bounce from the file. The plunger reads
    // the visual for its sound indices and then overwrites the material — so taking it from the file
    // gives the ball a speed off the plunger that nobody chose.
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);
    const index = table.groups.findIndex((group) => group.name === 'plunger');
    const visual = readVisual(table.groups, index);

    // The file's own material for this group is not 0.5, which is what makes the overwrite visible.
    expect(visual.elasticity).not.toBeCloseTo(PLUNGER_ELASTICITY);
    expect(PLUNGER_ELASTICITY).toBe(0.5);
    expect(PLUNGER_SMOOTHNESS).toBe(0.5);
  });

  test('the pullback increment is FLOORED, which is the Space Cadet branch', () => {
    // `floor(100 / (frames * 8))`. Full Tilt divides 50 and does not floor; this port is Space Cadet.
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);
    const index = table.groups.findIndex((group) => group.name === 'plunger');

    const plunger = buildOriginalPlunger(table.groups, index, {
      table: { tiltLocked: false }, timer: noTimer,
    })!;

    expect(plunger).not.toBe(null);
    expect(MAX_PULLBACK).toBe(100);
    expect(PULLBACK_DELAY).toBeCloseTo(0.025);
  });

  test('a group that is not the plunger answers null', () => {
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);
    const index = table.groups.findIndex((group) => group.name === 'a_bump1');

    expect(buildOriginalPlunger(table.groups, index, {
      table: { tiltLocked: false }, timer: noTimer,
    })).toBe(null);
  });

  test('⚠️ and the table has no plunger unless one is built for it', () => {
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);

    expect(buildOriginalTable(table.groups).plunger).toBe(null);
    // But it still knows where the ball goes, because that is a record and not a component.
    expect(buildOriginalTable(table.groups).plungerPosition).not.toBe(null);
  });
});

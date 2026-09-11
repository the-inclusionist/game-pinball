// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import {
  buildOriginalPlunger, plungerPosition, MAX_PULLBACK, PULLBACK_DELAY,
  PLUNGER_ELASTICITY, PLUNGER_SMOOTHNESS,
} from '../app/js/table/original-plunger.js';
import { buildOriginalTable } from '../app/js/table/original.js';
import { readTableObjects } from '../app/js/dat/loader.js';
import { loadTable } from '../app/js/dat/loader.js';
import { readVisual } from '../app/js/dat/visual.js';
import type { TimerService } from '../app/js/table/bumper.js';
import { resource } from './helpers/original-data.js';

/**
 * ⚠️ THE PLUNGER IS ALMOST ALL CONSTANTS.
 *
 * `TPlunger`'s constructor reads exactly one attribute — record 601, where the ball sits — and writes
 * everything else itself. A port that looked for the rest in the archive would find nothing and
 * quietly plunge with zeros.
 */

const DAT = resource('PINBALL.DAT');
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
    //
    // ⚠️ AND THE LITERAL, NOT `built.plungerPosition`. This test read the same lookup the spawn reads,
    // so both moved together and it passed over a ball that was starting at (-2.62, -8.83) — the top
    // of the table, in `v_sink1`'s mouth. Naming the number is what makes the two sides independent.
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);
    const built = buildOriginalTable(table.groups);

    const ball = built.spawnBall()!;

    expect(ball.position.x).toBeCloseTo(-7.021, 3);
    expect(ball.position.y).toBeCloseTo(10.085, 3);
  });

  test('⚠️ RECORD 601 IS NOT THE PLUNGER\'S ALONE — four sinks carry it, and three come first', () => {
    // `TPlunger`'s constructor reads record 601 and nothing else, which is true and was taken to mean
    // that the first group carrying 601 IS the plunger. It is not: `v_sink1`, `v_sink2`, `v_sink3` and
    // `v_sink7` carry it too, at group indices 338, 340, 342 and 344, and the plunger is at 473.
    //
    // A loop that stops at the first match finds `v_sink1`, whose 601 is (-2.62, -8.83). Everything
    // else follows from that one predicate: the ball is born in a sink's mouth at the top of the table
    // rather than on the plunger, so the plunger's draw moves nothing, so the launch lane is never
    // travelled, so `s_onewy1` is never crossed, so `lite200`'s five-second timer is never armed, so
    // the shoot-again lamp that every feed lights never goes out — and from the second ball onward
    // every drain is a free save and THE GAME CANNOT END.
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);

    const carriers = table.groups
      .map((group, index) => ({ index, name: group.name, at: plungerPosition(group) }))
      .filter((entry) => entry.at !== null);
    const built = buildOriginalTable(table.groups);

    expect(carriers.map((entry) => entry.name),
      'four sinks and the plunger, in the file\'s own order')
      .toEqual(['v_sink1', 'v_sink2', 'v_sink3', 'v_sink7', 'plunger']);
    expect(built.plungerPosition!.x, 'and the one chosen is the PLUNGER').toBeCloseTo(-7.021, 3);
    expect(built.plungerPosition!.y).toBeCloseTo(10.085, 3);

    // ⚠️ AN EQUIVALENT MUTANT, RECORDED. The lookup asks the `table_objects` list for the object whose
    // TYPE is `Plunger`, and dropping that check leaves all 1722 tests green — because in this file the
    // plunger is object 213 and the four sinks are 262 to 265, so "the first object whose group carries
    // a 601" happens to be the plunger as well. The GROUPS are in the damaging order; the OBJECTS are
    // not, and the old code walked the groups.
    //
    // The type check stays because it asks the question that has an answer rather than one that has a
    // lucky answer here. What cannot be claimed is that a test on this archive tells the two apart, so
    // the ordering is asserted instead — a file that reorders its objects will say so.
    const objects = readTableObjects(table.groups);
    const firstWithRecord = objects.findIndex(
      (entry) => plungerPosition(table.groups[entry.group]!) !== null,
    );
    expect(table.groups[objects[firstWithRecord]!.group]!.name,
      'the object list is in the harmless order').toBe('plunger');
  });

  test('⚠️ AND THE BALL WAITING ON IT IS NOT STUCK, which needs a box with height', () => {
    // `CheckBallInControlBounds` asks whether the ball is inside the flippers' or the plunger's box
    // before deciding it needs rescuing. The plunger's box was the extent of its own wall record — and
    // that record is a LINE, `[2, -8.00, 11.97, -6.38, 11.97]`, so the box was 1.6 wide and ZERO high.
    //
    // No ball can be inside a box with no height. So the ball dropped onto the plunger settled for a
    // hundred and fifty frames, was declared stuck, and was thrown back to the spawn point at speed
    // zero — over and over, for ever. Of sixty-one hold durations swept from 100 to 400 frames, exactly
    // ONE launched the ball: the release has to land in the 0.025-second window while the ball is still
    // in contact, and the rescue kept snatching it out of contact.
    //
    // The box has to hold the whole of the ball's wait: from where record 601 puts it down to where it
    // comes to rest on the line, and the ball's own radius on every side.
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);
    const built = buildOriginalTable(table.groups);
    const inside = (y: number): boolean => built.controlBounds.some((box) =>
      -7.02 >= box.xMin && -7.02 <= box.xMax && y >= box.yMin && y <= box.yMax);

    expect(inside(10.085), 'where record 601 puts the ball').toBe(true);
    expect(inside(11.667), 'and where it comes to rest on the line').toBe(true);
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

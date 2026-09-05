// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import {
  flipperSides, readFlipperGeometry, FLIPPER_PIVOT_RECORD,
} from '../app/js/table/original-flippers.js';
import { buildOriginalTable } from '../app/js/table/original.js';
import { loadTable } from '../app/js/dat/loader.js';
import { floatAttribute } from '../app/js/dat/attributes.js';

/**
 * ⚠️ A FLIPPER IS THREE POINTS AND TWO TIMES, and no angle anywhere.
 *
 * `TFlipper` reads records 800, 801 and 802 as three vectors — pivot, tip at rest, tip extended — and
 * the swing is the angle between the two tips about the pivot. The third component of each vector is a
 * RADIUS: the flipper is a base circle and a tip circle joined by two faces. Read as a height it is
 * meaningless and the flipper collapses to a line.
 */

const DAT = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.DAT';
const manifest = () => {
  if (!existsSync(DAT)) return null;
  const buf = readFileSync(DAT);
  return loadTable(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
};

const groupNamed = (table: NonNullable<ReturnType<typeof manifest>>, name: string) =>
  table.groups.find((group) => group.name === name)!;

describe('the two flippers of the 1995 table', () => {
  test('⚠️ the side is the OBJECT TYPE, and the right one sits at a NEGATIVE x', () => {
    // Guessing the side from the coordinate gets both of them backwards on this table, and a player
    // pressing left would work the wrong flipper.
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);

    const sides = flipperSides(table);

    expect(sides.get('a_flip1')).toBe('left');
    expect(sides.get('a_flip2')).toBe('right');
    expect(floatAttribute(groupNamed(table, 'a_flip2'), FLIPPER_PIVOT_RECORD)![0]).toBeLessThan(0);
    expect(floatAttribute(groupNamed(table, 'a_flip1'), FLIPPER_PIVOT_RECORD)![0]).toBeGreaterThan(0);
  });

  test('⚠️ and the third number of each vector is a RADIUS', () => {
    // Base 0.311 and tip 0.193: a flipper is two circles joined by two faces. Reading them as a Z
    // leaves both radii at zero and the flipper becomes a line the ball slides along.
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);

    const geometry = readFlipperGeometry(
      groupNamed(table, 'a_flip1'), { elasticity: 0.6, smoothness: 0.9 }, 0.3,
    )!;

    expect(geometry.baseRadius).toBeCloseTo(0.311, 3);
    expect(geometry.tipRadius).toBeCloseTo(0.193, 3);
    expect(geometry.baseRadius).toBeGreaterThan(geometry.tipRadius);
  });

  test('the tip travels, and the extend swing is faster than the retract', () => {
    // 0.04 seconds up and 0.08 down: a flipper snaps and falls back. Equal times would take the snap
    // out of the only thing on the table the player controls.
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);

    const geometry = readFlipperGeometry(
      groupNamed(table, 'a_flip2'), { elasticity: 0.6, smoothness: 0.9 }, 0.3,
    )!;

    expect(geometry.tipAtRest.y).not.toBeCloseTo(geometry.tipExtended.y);
    expect(geometry.extendTime).toBeCloseTo(0.04, 3);
    expect(geometry.retractTime).toBeCloseTo(0.08, 3);
    expect(geometry.extendTime).toBeLessThan(geometry.retractTime);
  });

  test('a group that is not a flipper answers null', () => {
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);

    expect(readFlipperGeometry(
      groupNamed(table, 'a_bump1'), { elasticity: 0.6, smoothness: 0.9 }, 0.3,
    )).toBe(null);
  });
});

describe('⚠️ and the table builds them only when it is told which side they are', () => {
  test('without the sides there are no flippers at all', () => {
    // Every test that only cares about walls builds the table this way, and a flipper it never asked
    // for would be a moving obstacle in the middle of its geometry.
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);

    expect(buildOriginalTable(table.groups).flippers).toHaveLength(0);
  });

  test('with them, both are built and answer their own side', () => {
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);
    const sides = flipperSides(table);
    const built = buildOriginalTable(table.groups, { flipperSideFor: (name) => sides.get(name) });

    expect(built.flippers).toHaveLength(2);

    built.setFlippers('left', true);

    const moving = built.flippers.filter((flipper) => flipper.motion === 'extending');
    expect(moving).toHaveLength(1);
  });

  test('⚠️ and they are on the CONTEXT too, because a still flipper is only half the question', () => {
    // The grid answers "the ball moved into the flipper"; the sweep answers "the flipper moved into
    // the ball". Leaving them off the context means a swinging flipper passes straight through a
    // resting ball — the one thing a player does, doing nothing.
    const table = manifest();
    if (!table) return expect(existsSync(DAT)).toBe(false);
    const sides = flipperSides(table);

    const built = buildOriginalTable(table.groups, { flipperSideFor: (name) => sides.get(name) });

    expect(built.context.flippers).toHaveLength(2);
  });
});

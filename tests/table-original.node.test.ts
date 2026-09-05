// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import {
  buildOriginalTable, GRAVITY_DEFAULTS, DEFAULT_DRAG, GRAVITY_RECORD, DRAG_RECORD,
} from '../app/js/table/original.js';
import { floatAttribute, groupNamed } from '../app/js/dat/attributes.js';
import { readGroups, type Group } from '../app/js/dat/partman.js';
import { advanceFrame } from '../app/js/physics/step.js';

/**
 * ⚠️ THE VALIDATION CONFIGURATION, ACTUALLY RUNNING.
 *
 * `dat/` has read the archive since phase 1 and `physics/` has been able to step a ball since phase 3,
 * and the two had never met: the 1995 table existed as conformance numbers and as nothing a ball could
 * be dropped into. This is that join, and it is the demonstration mode the Dev asked for.
 *
 * ⚠️ GEOMETRY FIRST, AND SAYING SO. This builds the table's WALLS and its field. It does not instantiate
 * the forty `T*` components, so nothing scores and no mission runs — that needs the archive's object
 * manifest walked and each component constructed from its own group, which is its own piece. A demo
 * that claimed to be the game would be a worse deliverable than one that says what it is.
 *
 * Every test runs against the REAL `PINBALL.DAT` or says it is absent. The file is Microsoft's and is
 * never distributed; a machine without it cannot run these, which is the shape the licence imposes.
 */

const DAT = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.DAT';
const archive = (): Group[] | null => {
  if (!existsSync(DAT)) return null;
  const buf = readFileSync(DAT);
  return readGroups(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
};

describe('building the 1995 table from its own archive', () => {
  test('it reads more than a hundred walls, because that is what the table has', () => {
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const table = buildOriginalTable(groups);

    expect(table.wallCount).toBeGreaterThan(100);
  });

  test('⚠️ the ball’s radius comes from the DATA, not from a constant here', () => {
    // `TBall` reads float record 500 of the `ball` group and assigns it to the table's
    // `CollisionCompOffset`, which is what every wall is inflated by. Inventing a number here would
    // move every surface in the table by the difference.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const table = buildOriginalTable(groups);

    // ⚠️ THE EXACT VALUE, because "positive and less than one" is satisfied by any plausible invention
    // and a mutation replacing the read with a hard-coded 0.25 survived it. The archive is the oracle
    // in a conformance test; asking it a question it can only answer one way is the whole point.
    expect(table.ballRadius).toBeCloseTo(0.3, 6);
  });

  test('⚠️ and the original’s hard-coded fallbacks are the shipped table’s own numbers', () => {
    // Worth recording rather than assuming: `TTableLayer` falls back to 25 / 0.5 / 1.570796 for gravity
    // and 0.2 for drag, and `PINBALL.DAT` carries exactly those. The fallbacks are not arbitrary — they
    // are the Space Cadet table written down twice — which is why a build that silently used them would
    // look correct on this archive and be wrong on any other.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const table = groupNamed(groups, 'table')!;

    expect(floatAttribute(table, GRAVITY_RECORD)![0]).toBeCloseTo(GRAVITY_DEFAULTS.mult, 5);
    expect(floatAttribute(table, GRAVITY_RECORD)![1]).toBeCloseTo(GRAVITY_DEFAULTS.angleX, 5);
    expect(floatAttribute(table, GRAVITY_RECORD)![2]).toBeCloseTo(GRAVITY_DEFAULTS.angleY, 5);
    expect(floatAttribute(table, DRAG_RECORD)![0]).toBeCloseTo(DEFAULT_DRAG, 5);
  });

  test('and it finds a hundred and forty-three walls in the shipped archive', () => {
    // A number rather than a floor, because this one is conformance: the table has what it has, and a
    // parser that finds a different count has misread something.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    expect(buildOriginalTable(groups).wallCount).toBe(143);
  });

  test('the bounds are the table’s own boundary record', () => {
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const table = buildOriginalTable(groups);

    expect(table.bounds.xMax).toBeGreaterThan(table.bounds.xMin);
    expect(table.bounds.yMax).toBeGreaterThan(table.bounds.yMin);
    // The quadrilateral in the archive is x in [-8, 8] and y in [-14, 15].
    expect(table.bounds.xMin).toBeCloseTo(-8, 3);
    expect(table.bounds.xMax).toBeCloseTo(8, 3);
  });

  test('⚠️ gravity points DOWN the table, and its numbers come from record 305', () => {
    // `GraityDirX = cos(angleY) * sin(angleX) * mult`, and the same with sin for Y. The defaults are
    // the original's own fallback and are used only when the record is absent — which on the real
    // archive it is not, so this checks the computed direction rather than the constants.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const table = buildOriginalTable(groups);
    const force = { x: 0, y: 0 };
    table.context.fieldEffects(
      { direction: { x: 0, y: 0 }, speed: 0 } as never, force,
    );

    // y grows downward in table coordinates too, so down the table is positive.
    expect(force.y).toBeGreaterThan(0);
  });

  test('and the fallback is the original’s, for an archive that omits the record', () => {
    expect(GRAVITY_DEFAULTS).toEqual({ mult: 25, angleX: 0.5, angleY: 1.570796 });
  });
});

describe('⚠️ and the walls actually hold a ball', () => {
  test('a ball dropped in stays inside the table for a thousand frames', () => {
    // The only test that proves the geometry is CONNECTED. A parser that read every wall into the wrong
    // place would still report a hundred walls and still build a grid; a ball leaving the boundary is
    // what says the numbers meant what they say.
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const table = buildOriginalTable(groups);
    const ball = table.spawnBall();

    let escaped = false;
    for (let i = 0; i < 1000 && !escaped; i++) {
      advanceFrame([ball], table.context, 1 / 60);
      const b = table.bounds;
      escaped = ball.position.x < b.xMin - 1 || ball.position.x > b.xMax + 1
        || ball.position.y < b.yMin - 1 || ball.position.y > b.yMax + 1;
    }

    expect(escaped).toBe(false);
  });

  test('and it MOVES, because a ball that never moves proves nothing about walls', () => {
    const groups = archive();
    if (!groups) return expect(existsSync(DAT)).toBe(false);

    const table = buildOriginalTable(groups);
    const ball = table.spawnBall();
    const from = { x: ball.position.x, y: ball.position.y };

    for (let i = 0; i < 300; i++) advanceFrame([ball], table.context, 1 / 60);

    expect(Math.hypot(ball.position.x - from.x, ball.position.y - from.y)).toBeGreaterThan(1);
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
// THE TOP OF THE PLUNGER LANE IS A CURVE, AND A FULL LAUNCH RIDES IT ACROSS THE TABLE.
//
// ⚠️ THE DEV'S WORDS: "o lançador é um túnel que vai retamente pra cima, mas ele deve acabar com uma
// curva (topo deve ser curvado) de modo que uma bola lançada com força total ande por uma curva até a
// parede da esquerda."
//
// The seventh item of a list he wrote, and the oldest one that was still open. `table/cabinet` carries
// the record of why: three shapes were tried, all three broke tables, and then it was MEASURED — the
// arc was right, and what stopped it was that a ball thrown at the left wall had nothing to meet there
// and fell out of the bottom without reaching a paddle. The funnel has since moved (there is a
// fourteen-pixel outlane channel where there used to be a seven-pixel squeeze), and on the fourth
// attempt it holds.
//
// ========================= WHAT IS MEASURED, AND WHY IT IS THE DIRECTION =========================
// ⚠️ NOT "IT REACHES THE LEFT WALL", WHICH THE FIRST DRAFT OF THIS FILE ASSERTED AND WHICH IS NOT A
// FACT ABOUT THE CURVE. Whether the ball gets all the way across depends on what the table has put in
// its way — `low-orbit` meets a bumper at x = 118, `long-climb` an ice block at x = 90, `crater-run`
// nothing until x = 54 — and a gate that demanded the wall would be demanding six tables be emptied.
//
// What the curve itself decides is the DIRECTION the ball leaves in, and that is furniture-free:
//
//     the six cabinet tables    exit (-0.87, 0.49)   more LEFT than down
//     the three fixtures        exit (-0.50, 0.86)   more DOWN than left
//
// ⚠️ AND THOSE THREE ARE THE CONTROL GROUP, WHICH IS WHY THEY ARE IN THIS FILE RATHER THAN EXCUSED
// FROM IT. `wide-arc`, `narrow-tower` and `four-flippers` each hand-write the straight bend they were
// born with — copies made before `table/cabinet` existed — so the same test measures the curve and
// the thing it replaced, in the same run, and the claim cannot pass by accident. They are fixtures
// rather than tables to play, which is the only reason they have not been converted.
import { describe, test, expect } from 'vitest';
import { buildPhysics, FRAME_SECONDS, launchSpeedFor } from '../app/js/table/physics-build.js';
import { advanceFrame } from '../app/js/physics/step.js';
import { CATALOG } from '../app/js/table/catalog.js';
import { cabinet } from '../app/js/table/cabinet.js';
import type { AuthoredTable } from '../app/js/table/authored.js';

/** The arc, by the shape `table/cabinet` gives it — several lines, not one. */
const CABINET_BEND = cabinet({ width: 183, height: 250 }).find((c) => c.name === 'wall.laneReturn')!;

/**
 * Which tables curve and which do not, decided by comparing each table's own bend with the cabinet's
 * rather than by a list of names.
 *
 * ⚠️ A HAND-WRITTEN LIST WOULD ROT THE DAY A FIXTURE WAS CONVERTED, and it would rot green: the
 * converted table would go on being measured as a control and would go on passing, because a curve
 * that is asserted NOT to curve fails loudly and one asserted to curve when it does not is the whole
 * point of the test. The question is "does this table use the cabinet's bend", so it is asked that way.
 */
function curves(table: AuthoredTable): boolean {
  const bend = table.components.find((c) => c.name === 'wall.laneReturn');
  return (bend?.collision?.length ?? 0) === CABINET_BEND.collision!.length;
}

const WITH_BEND = CATALOG.filter((t) => t.components.some((c) => c.name === 'wall.laneReturn'));

/** The direction the ball is travelling the moment it comes off the return bend. */
function exitDirection(table: AuthoredTable): { x: number; y: number } {
  const physics = buildPhysics(table);
  const ball = physics.spawnBall();
  ball.direction = { x: 0, y: -1 };
  ball.speed = launchSpeedFor(table);

  for (let i = 0; i < 900; i++) {
    advanceFrame([ball], physics.context, FRAME_SECONDS);
    for (const hit of physics.takeHits()) {
      if (hit.name === 'wall.laneReturn') return { ...ball.direction };
    }
    if (ball.position.y > table.size.height) break;
  }
  throw new Error(`${table.name}: a full launch never reached the return bend at all`);
}

describe('⚠️ a ball launched at full power comes off the bend travelling ACROSS the table', () => {
  test.each(WITH_BEND.filter(curves).map((t) => [t.name, t] as const))('%s curves', (name, table) => {
    const exit = exitDirection(table);

    expect(Math.abs(exit.x), `${name}: exit (${exit.x.toFixed(2)}, ${exit.y.toFixed(2)})`)
      .toBeGreaterThan(Math.abs(exit.y));
  });

  test.each(WITH_BEND.filter((t) => !curves(t)).map((t) => [t.name, t] as const))(
    '%s still has the straight bend, and goes DOWN — the control',
    (name, table) => {
      // See the header. If this ever passes as a curve, either a fixture was converted (in which case
      // it belongs in the case above) or the test above is measuring something other than the bend.
      const exit = exitDirection(table);

      expect(Math.abs(exit.y), `${name}: exit (${exit.x.toFixed(2)}, ${exit.y.toFixed(2)})`)
        .toBeGreaterThan(Math.abs(exit.x));
    },
  );

  test('⚠️ and the two groups are not the same group', () => {
    // Without this the file passes with every table in one bucket and none in the other, which is what
    // an `each` over an empty list does: silently nothing.
    expect(WITH_BEND.filter(curves).length, 'tables with the curve').toBeGreaterThan(0);
    expect(WITH_BEND.filter((t) => !curves(t)).length, 'tables still straight').toBeGreaterThan(0);
  });
});

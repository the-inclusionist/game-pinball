// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { flipperGeometryOf, buildPhysics } from '../app/js/table/physics-build.js';
import { validateTable } from '../app/js/table/authored.js';
import { CATALOG, LOW_ORBIT } from '../app/js/table/catalog.js';
import type { AuthoredComponent, AuthoredTable } from '../app/js/table/authored.js';

/**
 * ⚠️ AN AUTHORED FLIPPER IS NOT A LINE.
 *
 * Every flipper in the catalogue was a `bounds` and one collision line, which is a flipper-shaped WALL:
 * the ball bounced off it and the player could not move it. A flipper is a body that turns about a
 * pivot, and the original authors it that way — pivot, tip at rest, tip extended, two radii, two times.
 *
 * The one convenience taken over the original's form: the table declares a SWEEP IN DEGREES rather than
 * the extended tip's coordinates. Writing the far end of a rotation out by hand is arithmetic a person
 * gets wrong, and the sign of it is exactly the kind of thing that silently makes a right flipper swing
 * the wrong way. `deriveFlipper` keeps the original's three vectors; this rotates the third one.
 */

const leftFlipper: AuthoredComponent = {
  name: 'flipper.left', kind: 'flipper', role: 'structure',
  bounds: { x: 40, y: 200, width: 30, height: 8 },
  flipper: {
    pivot: { x: 40, y: 200 }, tipAtRest: { x: 68, y: 207 }, sweepDegrees: -55,
    baseRadius: 3, tipRadius: 2, extendTime: 0.08, retractTime: 0.16,
  },
};

describe('a flipper declared as a pivot and a sweep', () => {
  test('⚠️ extending RAISES the tip, which is what the sign of the sweep means', () => {
    // y grows downward, so "up" is a smaller y and the sign that produces it is not guessable from the
    // number. Rather than document a convention nobody can check, the validator refuses a flipper whose
    // sweep lowers its tip — see below — and this is the same claim from the other side.
    const g = flipperGeometryOf(leftFlipper, 3);

    expect(g.tipExtended.y).toBeLessThan(g.tipAtRest.y);
  });

  test('the ball’s radius becomes the collision offset', () => {
    // `table->CollisionCompOffset`. The faces are pushed out by it so the ball can be a point.
    expect(flipperGeometryOf(leftFlipper, 3).collisionOffset).toBe(3);
  });

  test('the tip keeps its distance from the pivot, because a sweep is a rotation', () => {
    const g = flipperGeometryOf(leftFlipper, 3);
    const reach = (p: { x: number; y: number }) => Math.hypot(p.x - g.pivot.x, p.y - g.pivot.y);

    expect(reach(g.tipExtended)).toBeCloseTo(reach(g.tipAtRest), 9);
  });
});

describe('the validator holds the parts a flipper cannot do without', () => {
  const tableWith = (flipper: AuthoredComponent): AuthoredTable => ({
    ...LOW_ORBIT,
    components: [...LOW_ORBIT.components.filter((c) => c.kind !== 'flipper'), flipper],
  });

  test('a flipper with no declaration at all is refused', () => {
    const problems = validateTable(
      tableWith({ ...leftFlipper, flipper: undefined }), { viewHeight: 180 },
    );

    expect(problems.some((p) => p.includes('flipper.left'))).toBe(true);
  });

  test('⚠️ and so is one whose sweep pushes the tip DOWN', () => {
    // The defect this catches cannot be seen by reading the table: a flipper with the sign inverted
    // still validates on every other rule, still draws, still collides, and swings into the floor.
    const problems = validateTable(
      tableWith({ ...leftFlipper, flipper: { ...leftFlipper.flipper!, sweepDegrees: 55 } }),
      { viewHeight: 180 },
    );

    expect(problems.some((p) => p.includes('flipper.left') && p.includes('sweep'))).toBe(true);
  });

  test('every flipper in the catalogue declares one, and every one of them lifts', () => {
    for (const table of CATALOG) {
      for (const c of table.components) {
        if (c.kind !== 'flipper') continue;
        expect(c.flipper, `${table.name}/${c.name}`).toBeDefined();
        expect(flipperGeometryOf(c, table.ballRadius).tipExtended.y)
          .toBeLessThan(c.flipper!.tipAtRest.y);
      }
    }
  });
});

describe('and the physics builds them', () => {
  test('a built table has one live flipper per declared one', () => {
    const physics = buildPhysics(LOW_ORBIT);
    const declared = LOW_ORBIT.components.filter((c) => c.kind === 'flipper');

    expect(physics.flippers).toHaveLength(declared.length);
  });

  test('and they are named, because the control layer dispatches on names', () => {
    const physics = buildPhysics(LOW_ORBIT);

    expect(physics.flipperNamed('flipper.left')).toBeDefined();
  });
});

describe('⚠️ which side a flipper is on is geometry, not its name', () => {
  test('a table with four flippers moves BOTH of a side together', () => {
    // `four-flippers` exists to find the places where "one pair" is assumed, and this is one of them.
    // Reading the side off the name would work here and break on the first table whose flippers are
    // called something else; the pivot's position relative to the table's middle cannot be misspelled.
    const four = CATALOG.find((t) => t.name === 'four-flippers')!;
    const physics = buildPhysics(four);

    physics.setFlippers('left', true);

    const moving = physics.flippers.filter((f) => f.motion === 'extending');
    expect(moving).toHaveLength(2);
  });

  test('and the other side stays down', () => {
    const four = CATALOG.find((t) => t.name === 'four-flippers')!;
    const physics = buildPhysics(four);

    physics.setFlippers('left', true);

    expect(physics.flippers.filter((f) => f.motion === 'still')).toHaveLength(2);
  });

  test('a lone flipper belongs to the side it sits on', () => {
    const bare = CATALOG.find((t) => t.name === 'bare-minimum')!;
    const physics = buildPhysics(bare);

    physics.setFlippers('right', true);
    expect(physics.flippers.every((f) => f.motion === 'still')).toBe(true);

    physics.setFlippers('left', true);
    expect(physics.flippers.some((f) => f.motion === 'extending')).toBe(true);
  });
});

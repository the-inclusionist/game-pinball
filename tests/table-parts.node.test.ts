// SPDX-License-Identifier: AGPL-3.0-or-later
// A LIBRARY OF PARTS, SO THAT NOBODY HAS TO TYPE A WINDING.
//
// ⚠️ THE DEV CHOSE WHO THE EDITOR IS FOR: "a teacher or a child making a table of their own." That
// answer is what makes this module necessary rather than convenient. A component in this game is
// `bounds` plus collision shapes plus a control and a score row, and `table/authored`'s own rule is that
// `(dy, −dx)` decides which SIDE of a line is solid. A child cannot be asked for that, and neither
// should an adult be: this repository's record has the same defect in it four times over.
//
// ========================= WHAT A PART FUNCTION IS FOR =========================
// It takes what a person can see — where the thing is, how big it is, and WHICH WAY IT LOOKS — and
// writes the geometry. `table/cabinet` is already this idea for the shell, and its header says why:
// "the winding of a collision line, which decides which SIDE of it is solid, is something a person gets
// wrong quietly and a machine does not."
//
// ========================= AND IT BAKES IN WHAT THE SURVEYS LEARNT =========================
// ⚠️ AN UP-FACING FACE MADE HERE IS NEVER LEVEL. `tests/no-shelf-holds-a-ball` refuses one anywhere in
// the catalogue because gravity has no component along a horizontal surface — a ball that lands on one
// stays for ever, and nine of them were found the day the ball learnt to roll. A library that could
// still produce one would be handing every future author the same defect.
import { describe, test, expect } from 'vitest';
import {
  bumperAt, targetAt, laneAt, rampFrom, rebounderAt, wallFrom, onewayAt, lampsFor, FACINGS,
  type Facing,
} from '../app/js/table/parts.js';
import { cabinet, CABINET_LAMPS } from '../app/js/table/cabinet.js';
import { validateTable, normalOf, type AuthoredComponent, type AuthoredTable }
  from '../app/js/table/authored.js';

const SIZE = { width: 183, height: 235 };

/** The part on a table that is otherwise the cabinet's, which is what an editor starts an author with. */
function tableWith(parts: AuthoredComponent[]): AuthoredTable {
  return {
    name: 'under-test',
    size: SIZE,
    ballRadius: 3,
    components: [...cabinet(SIZE), ...parts],
    lamps: [...CABINET_LAMPS, ...lampsFor(parts)],
  };
}

/** One of every part, in places a 183×235 table has room for. */
function oneOfEach(): AuthoredComponent[] {
  return [
    bumperAt({ name: 'bumper1', at: { x: 60, y: 60 } }),
    rebounderAt({ name: 'rebounder1', at: { x: 120, y: 60 }, radius: 7 }),
    targetAt({ name: 'target1', at: { x: 60, y: 100 }, length: 16, facing: 'up' }),
    laneAt({ name: 'lane1', box: { x: 100, y: 100, width: 14, height: 20 } }),
    rampFrom({ name: 'ramp1', from: { x: 40, y: 150 }, to: { x: 90, y: 110 } }),
    onewayAt({ name: 'oneway1', at: { x: 120, y: 140 }, length: 20, facing: 'down' }),
    wallFrom({ name: 'wall1', from: { x: 30, y: 170 }, to: { x: 60, y: 190 }, facing: 'up' }),
  ];
}

describe('every part the library makes is a legal component', () => {
  test('⚠️ one of each, on the cabinet, opens', () => {
    /**
     * ⚠️ THE VALIDATOR IS THE ASSERTION AND NOT A SHAPE COMPARISON. A part that declares a score with no
     * control, a lamp its control cannot light, or a struck kind with nothing to strike is refused by
     * `validateTable` with a sentence — and every one of those rules is in that file because a table in
     * this catalogue once broke it. A library that produced any of them would be a faster way to reach
     * the same six defects.
     */
    expect(validateTable(tableWith(oneOfEach()), { viewHeight: 180 })).toEqual([]);
  });

  test('⚠️ and its lamps are the ones the table has to declare', () => {
    // A component naming a lamp the table does not have is refused; an editor cannot ask an author to
    // keep a second list in step by hand, so the library answers it.
    const parts = oneOfEach();
    const named = parts.flatMap((p) => p.lamps ?? []);

    expect([...lampsFor(parts)].sort()).toEqual([...new Set(named)].sort());
  });
});

describe('a face looks the way it was asked to', () => {
  const face = (facing: Facing): { x: number; y: number } => {
    const part = targetAt({ name: 't', at: { x: 90, y: 120 }, length: 16, facing });
    const shape = part.collision![0]!;
    if (shape.kind !== 'line') throw new Error('a target is a face');
    return normalOf(shape);
  };

  test.each(FACINGS)('⚠️ facing %s puts the normal there', (facing) => {
    /**
     * ⚠️ THE WHOLE POINT OF THE LIBRARY, IN ONE ASSERTION. `(dy, −dx)` is not a rule anybody can hold in
     * their head while placing a target, and a face wound backwards is a wall the ball passes through
     * from the side it arrives on — solid only from the side it never comes from.
     *
     * `y` grows downward, so a normal that points UP has a negative y.
     */
    const n = face(facing);
    const want = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[facing];

    // ⚠️ `+ 0` BECAUSE `Math.sign(-0)` IS `-0`, and `toBe` is `Object.is`, which tells the two zeroes
    // apart. A vertical face's normal has a y of exactly minus nothing.
    expect(Math.sign(Math.round(n.x)) + 0, `${facing}: x`).toBe(want.x + 0);
    expect(Math.sign(Math.round(n.y)) + 0, `${facing}: y`).toBe(want.y + 0);
  });
});

describe('⚠️ and a WALL faces the way it was asked to, which the target test did not cover', () => {
  /**
   * ⚠️ FOUND BY MUTATION AND NOT BY READING. Deleting the swap in `wallFrom` — leaving every wall wound
   * the way the author happened to draw it — left this file green, because the facing test above only
   * ever asked a target. A wall is the part where a wrong winding does the most damage: it is the thing
   * that shapes the ball's route, and one solid from the wrong side is a wall the ball goes through.
   */
  const wall = (facing: Facing): { x: number; y: number } => {
    const part = wallFrom({ name: 'w', from: { x: 30, y: 170 }, to: { x: 60, y: 190 }, facing });
    const shape = part.collision![0]!;
    if (shape.kind !== 'line') throw new Error('a wall is a face');
    return normalOf(shape);
  };

  test.each([
    ['up', (n: { y: number }) => n.y < 0],
    ['down', (n: { y: number }) => n.y > 0],
    ['left', (n: { x: number }) => n.x < 0],
    ['right', (n: { x: number }) => n.x > 0],
  ] as const)('facing %s', (facing, holds) => {
    /**
     * ⚠️ A SIGN AND NOT A DIRECTION, because the wall is a DIAGONAL and its normal is diagonal too.
     * Asking a slanted wall to "face up" can only mean "have its solid side above it", and on this line
     * that is the same winding as "face right" — which is correct and is why the assertion is about the
     * axis the author named rather than about the whole vector.
     */
    const n = wall(facing);

    expect(holds(n), `${facing}: normal is (${n.x.toFixed(2)}, ${n.y.toFixed(2)})`).toBe(true);
  });
});

describe('⚠️ a lane is a region and not an obstacle', () => {
  test('it declares no collision at all', () => {
    /**
     * ⚠️ ALSO FOUND BY MUTATION: giving a lane a collision line left this file green. `table/authored`
     * states the rule — "a lane is rolled over, a well swallows" — and half of what an authored table
     * offers is regions rather than obstacles. A lane with a shape is a wall that pays, in the one place
     * an author would never look for one.
     */
    const lane = laneAt({ name: 'lane1', box: { x: 100, y: 100, width: 14, height: 20 } });

    expect(lane.collision, 'a lane has become something the ball bounces off').toBeUndefined();
  });
});

describe('⚠️ and an up-facing face is never level', () => {
  test('a target that looks up sheds the ball', () => {
    /**
     * The lesson `tests/no-shelf-holds-a-ball` records, made unreachable rather than merely refused. A
     * level face that looks up holds a ball for ever — nine of them were in the catalogue — so the
     * library tilts one on the way out and an author cannot draw the defect at all.
     */
    const part = targetAt({ name: 't', at: { x: 90, y: 120 }, length: 16, facing: 'up' });
    const shape = part.collision![0]!;
    if (shape.kind !== 'line') throw new Error('a target is a face');

    expect(Math.abs(shape.to.y - shape.from.y), 'it is flat').toBeGreaterThan(0);
  });

  test('and a face that looks DOWN may be level, because a ceiling holds nothing', () => {
    // The mirror, and it is why the rule is about the winding rather than about the angle: the same
    // horizontal line written the other way round is something the ball is struck by from below.
    const part = onewayAt({ name: 'o', at: { x: 90, y: 120 }, length: 16, facing: 'down' });
    const shape = part.collision![0]!;
    if (shape.kind !== 'line') throw new Error('a oneway is a face');

    expect(shape.to.y - shape.from.y).toBe(0);
  });
});

describe('a part is where it says it is', () => {
  test.each(oneOfEach().map((p) => [p.name, p] as const))('%s: its bounds hold its collision', (name, part) => {
    /**
     * ⚠️ `bounds` IS NOT DECORATION. It is what the renderer fills for a component with no collision, what
     * a lane's trigger is read from, and what the accessibility contract reports as the thing's place —
     * so a part whose box and whose geometry disagree is a thing the sonar points away from.
     */
    for (const shape of part.collision ?? []) {
      const points = shape.kind === 'line'
        ? [shape.from, shape.to]
        : [{ x: shape.at.x - shape.radius, y: shape.at.y - shape.radius },
          { x: shape.at.x + shape.radius, y: shape.at.y + shape.radius }];
      for (const p of points) {
        expect(p.x, `${name}: x`).toBeGreaterThanOrEqual(part.bounds.x);
        expect(p.x).toBeLessThanOrEqual(part.bounds.x + part.bounds.width);
        expect(p.y, `${name}: y`).toBeGreaterThanOrEqual(part.bounds.y);
        expect(p.y).toBeLessThanOrEqual(part.bounds.y + part.bounds.height);
      }
    }
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { deriveFlipper, createFlipper } from '../app/js/physics/flipper.js';

/**
 * ⚠️ `createFlipper` TAKES THE DERIVED NUMBERS, AND NOTHING DERIVED THEM.
 *
 * The port has `TFlipperEdge`'s geometry and its collision response, both tested. What it never had is
 * the CONSTRUCTOR: in the original a flipper is authored as three vectors and two times — a pivot, the
 * tip at rest, the tip fully extended, and how long the swing takes each way — and the constructor
 * turns those into the fourteen values `createFlipper` expects. Without it a flipper could be built
 * only by writing those fourteen out by hand, which is why the ported flipper appears in no table and
 * in nothing but its own test.
 *
 * These assertions come from `TFlipperEdge::TFlipperEdge`, not from what looks reasonable.
 */
describe('a flipper is authored as a pivot, two tip positions and two times', () => {
  // Pivot at the origin, tip at rest along +X, tip extended at 90 degrees to +Y.
  const quarterTurn = {
    pivot: { x: 0, y: 0 }, tipAtRest: { x: 10, y: 0 }, tipExtended: { x: 0, y: 10 },
    baseRadius: 2, tipRadius: 1, extendTime: 0.5, retractTime: 1,
    collisionMult: 1, elasticity: 0.6, smoothness: 0.1, collisionOffset: 0,
  };

  test('angleMax is the SIGNED angle between the two tip positions', () => {
    // `acos(dot)`, negated when the cross product points the other way. The sign is what says which
    // way this flipper turns, and the whole left/right distinction rides on it.
    const d = deriveFlipper(quarterTurn);

    expect(Math.abs(d.angleMax)).toBeCloseTo(Math.PI / 2, 6);
  });

  test('and the mirrored flipper gets the opposite sign', () => {
    const mirrored = deriveFlipper({ ...quarterTurn, tipExtended: { x: 0, y: -10 } });

    expect(Math.sign(mirrored.angleMax)).toBe(-Math.sign(deriveFlipper(quarterTurn).angleMax));
  });

  test('⚠️ speed is an angle over a TIME, because 3DPB authors the swing in seconds', () => {
    // "3DPB and FT have different formats for flipper speed" — the comment is the original's. This is
    // the 3DPB branch, which is the one the Space Cadet data uses: seconds to cross the whole sweep,
    // turned into radians per second by dividing the sweep by the time.
    const d = deriveFlipper(quarterTurn);

    expect(Math.abs(d.extendSpeed)).toBeCloseTo((Math.PI / 2) / 0.5, 6);
    expect(Math.abs(d.retractSpeed)).toBeCloseTo((Math.PI / 2) / 1, 6);
  });

  test('⚠️ exactly one of the two speeds is negative, and which one follows angleMax', () => {
    // The last four lines of the constructor, and they are not decoration: the sign is the direction
    // of travel. `angleMax > 0` negates the retract speed so retracting runs back down toward zero;
    // `angleMax <= 0` negates the extend speed instead. Get it wrong and the flipper extends the way
    // it should retract.
    const positive = deriveFlipper(quarterTurn);
    const negative = deriveFlipper({ ...quarterTurn, tipExtended: { x: 0, y: -10 } });

    expect(positive.angleMax > 0).toBe(true);
    expect(positive.extendSpeed).toBeGreaterThan(0);
    expect(positive.retractSpeed).toBeLessThan(0);

    expect(negative.angleMax < 0).toBe(true);
    expect(negative.extendSpeed).toBeLessThan(0);
    expect(negative.retractSpeed).toBeGreaterThan(0);
  });

  test('the two faces are offset from the axis by the base and tip radii', () => {
    // A2 and B1 sit a base radius either side of the pivot; A1 and B2 a tip radius either side of the
    // tip. That is what gives the flipper thickness, and the thickness is where the ball bounces.
    const d = deriveFlipper(quarterTurn);
    const offsets = [d.a1Src, d.a2Src, d.b1Src, d.b2Src].map((p) => Math.abs(p.y));

    expect(offsets.sort()).toEqual([1, 1, 2, 2]);
  });

  test('and the ball’s radius pushes both of them outward', () => {
    // `table->CollisionCompOffset` in the original: the wall is moved out by the ball's radius so the
    // ball can be treated as a point. Same trick as `offsetLine`, applied at construction here.
    const d = deriveFlipper({ ...quarterTurn, collisionOffset: 3 });
    const offsets = [d.a1Src, d.a2Src, d.b1Src, d.b2Src].map((p) => Math.abs(p.y));

    expect(offsets.sort()).toEqual([4, 4, 5, 5]);
  });

  test('⚠️ a negative angleMax swaps the A and B faces', () => {
    // `if (AngleMax < 0) swap(A1,B1), swap(A2,B2)`. A is always the face that SWEEPS: `flipperCollision`
    // reads `lineA.perpendicular` while extending and `lineB.perpendicular` while retracting, so
    // leaving the swap out would make a right flipper kick with its back.
    const positive = deriveFlipper(quarterTurn);
    const negative = deriveFlipper({ ...quarterTurn, tipExtended: { x: 0, y: -10 } });

    expect(Math.sign(negative.a1Src.y)).toBe(-Math.sign(positive.a1Src.y));
    expect(Math.sign(negative.b1Src.y)).toBe(-Math.sign(positive.b1Src.y));
  });

  test('distanceDiv is the pivot-to-tip reach, which is the kick’s denominator', () => {
    // The kick is `|moveSpeed| * sqrt(distanceSq / distanceDivSq)`: a ball struck at the tip gets the
    // full tangential speed, one struck by the pivot gets almost none. The denominator is the reach,
    // and it includes the tip radius and the ball's offset because that is where the tip's SURFACE is.
    const d = deriveFlipper({ ...quarterTurn, collisionOffset: 3 });

    expect(d.distanceDiv).toBeCloseTo(10 + 1 + 3, 6);
  });

  test('and what comes out builds', () => {
    const f = createFlipper(deriveFlipper(quarterTurn));

    expect(f.currentAngle).toBe(0);
    expect(f.motion).toBe('still');
  });
});

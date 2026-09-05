// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  deriveFlipper, createFlipper, setFlipperMotion, flipperAngleDelta, flipperStepAngle, advanceFlipper,
} from '../app/js/physics/flipper.js';

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

describe('⚠️ the flipper has to MOVE, and moving is a state machine', () => {
  // A quarter turn from +X to +Y: pivot at the origin, ten units of reach.
  const build = () => createFlipper(deriveFlipper({
    pivot: { x: 0, y: 0 }, tipAtRest: { x: 10, y: 0 }, tipExtended: { x: 0, y: 10 },
    baseRadius: 2, tipRadius: 1, extendTime: 0.5, retractTime: 1,
    collisionMult: 1, elasticity: 0.6, smoothness: 0.1, collisionOffset: 0,
  }));

  test('asking it to extend records where it is going and how far that is', () => {
    const f = build();

    setFlipperMotion(f, 'extending');

    expect(f.motion).toBe('extending');
    expect(f.angleDst).toBeCloseTo(f.angleMax, 6);
    expect(f.angleRemainder).toBeCloseTo(Math.abs(f.angleMax), 6);
    expect(f.moveSpeed).toBe(f.extendSpeed);
  });

  test('⚠️ but asking it to extend when it is already out leaves it STILL', () => {
    // `if (AngleRemainder == 0) code = TFlipperNull`. Without it a held button would keep a flipper
    // "moving" at the end of its travel for ever, and `flipperCollision` reads that flag to decide
    // between a kick and a plain bounce — so a fully extended flipper would go on kicking.
    const f = build();
    f.currentAngle = f.angleMax;

    setFlipperMotion(f, 'extending');

    expect(f.motion).toBe('still');
  });

  test('a still flipper turns by nothing, whatever the timestep', () => {
    expect(flipperAngleDelta(build(), 1)).toBe(0);
  });

  test('and a moving one turns by its speed times the time', () => {
    const f = build();
    setFlipperMotion(f, 'extending');

    expect(flipperAngleDelta(f, 0.01)).toBeCloseTo(f.moveSpeed * 0.01, 9);
  });

  test('⚠️ except at the end, where it turns by exactly what is left', () => {
    // Not `min(delta, remainder)` — the original returns `AngleDst - CurrentAngle`, which lands ON the
    // destination rather than near it. A flipper that overshot by a fraction each swing would drift.
    const f = build();
    setFlipperMotion(f, 'extending');

    expect(flipperAngleDelta(f, 10)).toBeCloseTo(f.angleMax - f.currentAngle, 9);
  });

  test('a big swing is split into substeps, and never more than three', () => {
    const f = build();
    setFlipperMotion(f, 'extending');

    const { steps, delta } = flipperStepAngle(f, 10);

    expect(steps).toBeGreaterThan(1);
    expect(steps).toBeLessThanOrEqual(3);
    expect(delta * steps).toBeCloseTo(f.angleMax, 6);
  });

  test('advancing with nothing in the way spends the remainder and arrives exactly', () => {
    const f = build();
    setFlipperMotion(f, 'extending');

    for (let i = 0; i < 200 && f.motion !== 'still'; i++) advanceFlipper(f, 1 / 60, []);

    expect(f.currentAngle).toBeCloseTo(f.angleMax, 9);
    expect(f.motion).toBe('still');
  });

  test('⚠️ and a ball in the way pushes the flipper BACK', () => {
    // `if (collisionFlag) { CurrentAngle -= deltaAngle / (|MoveSpeed| * 5); AngleRemainder += ... }`.
    // The flipper does not sweep through a ball, it loses ground to it. That is what makes a trapped
    // ball sit on a raised flipper instead of being teleported past it, and it is the one place in the
    // whole file where the ball moves the table rather than the other way round.
    const clear = build();
    const blocked = build();
    setFlipperMotion(clear, 'extending');
    setFlipperMotion(blocked, 'extending');

    // Resting on the A face, which is the one that sweeps.
    const ball = { position: { x: 5, y: 1.6 }, direction: { x: 0, y: 0 }, speed: 0 };
    advanceFlipper(clear, 1 / 60, []);
    advanceFlipper(blocked, 1 / 60, [ball]);

    // ⚠️ BELOW ZERO, not merely below `clear`. It started at zero, so "less than the unobstructed one"
    // is satisfied by any small forward motion and a mutation that ADDS the correction instead of
    // subtracting it survives that assertion. Losing ground is the claim, and losing ground means
    // ending up behind where the swing began.
    expect(blocked.currentAngle).toBeLessThan(0);
    expect(clear.currentAngle).toBeGreaterThan(0);
    // And the ground it gave up is added back to what it still owes, so the swing is not shortened.
    expect(blocked.angleRemainder).toBeGreaterThan(Math.abs(blocked.angleMax));
  });

  test('⚠️ but a ball behind it is not, because the back face is running away', () => {
    // The mirror of the rule above, and it falls out of the geometry rather than being coded for: while
    // extending, face B travels AWAY from anything resting against it, so the backward ray never
    // reaches. A flipper that lost ground to a ball behind it would be pushed back by the very ball it
    // is not touching, and a raised flipper would sag whenever a ball sat under it.
    const clear = build();
    const behind = build();
    setFlipperMotion(clear, 'extending');
    setFlipperMotion(behind, 'extending');

    advanceFlipper(clear, 1 / 60, []);
    advanceFlipper(behind, 1 / 60, [{ position: { x: 5, y: -1.6 }, direction: { x: 0, y: 0 }, speed: 0 }]);

    expect(behind.currentAngle).toBeCloseTo(clear.currentAngle, 12);
  });
});

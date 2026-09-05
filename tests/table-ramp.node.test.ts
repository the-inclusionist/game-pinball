// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { createRamp, computeFieldForce, planeBounds, boundsCorrected, type RampPlane, type RampBall, type RampEdge } from '../app/js/table/ramp.js';
import type { Edge } from '../app/js/physics/grid.js';

const RAMP_GROUP = 0b0001;
const WALL1_GROUP = 0b0010;
const WALL2_GROUP = 0b0100;

const bareEdge = (): Edge =>
  ({ active: true, collisionGroup: 0xffff, findCollisionDistance: () => 1, edgeCollision: () => {} });

function makePlane(overrides: Partial<RampPlane> = {}): RampPlane {
  return {
    v1: { x: 0, y: 0 }, v2: { x: 10, y: 0 }, v3: { x: 0, y: 10 },
    ballCollisionOffset: { x: 0.1, y: 0.2, z: 3 },
    gravityAngle1: Math.PI / 6,
    gravityAngle2: 0,
    fieldForce: { x: 0, y: 0 },
    ...overrides,
  };
}

function build(tiltLocked = false) {
  const plane = makePlane();
  const entryLine = bareEdge();
  const wall1Line = bareEdge();
  const wall2Line = bareEdge();
  const played: number[] = [];
  const enters: number[] = [];
  const ramp = createRamp({
    table: { tiltLocked },
    planes: [plane],
    gravityMult: 100,
    ballFieldMult: 0.2,
    ballZOffsetFlag: true,
    collisionGroup: RAMP_GROUP,
    wall1CollisionGroup: WALL1_GROUP,
    wall2CollisionGroup: WALL2_GROUP,
    wall1BallOffset: 5,
    wall2BallOffset: 9,
    entryLine, wall1Line, wall2Line,
    hitSoundId: 1,
    sound: { play: (id) => played.push(id) },
    onEnter: () => enters.push(1),
  });
  const planeEdge: RampEdge = { ...bareEdge(), plane };
  return { ramp, plane, planeEdge, entryLine, wall1Line, wall2Line, played, enters };
}

const ball = (x = 20, y = 30): RampBall => ({
  position: { x, y, z: 0 },
  direction: { x: 1, y: 0 },
  speed: 10,
  radius: 0.25,
  collisionMask: 0xffff,
  collisionFlag: false,
  collisionOffset: { x: 0, y: 0, z: 0 },
  rampFieldForce: { x: 0, y: 0 },
  memory: { record: () => {} },
});

describe('ramp — the ball changes which WORLD it is in', () => {
  test('entering a plane switches the collision mask to the ramp’s group', () => {
    // The collision search filters by `edge.collisionGroup & ray.collisionMask`, so from this instant
    // the ball can only see the ramp's edges. The mask IS the floor it is standing on.
    const { ramp, planeEdge } = build();
    const b = ball();

    ramp.collision(b, { x: 20, y: 30 }, { x: 0, y: 1 }, 1, planeEdge);

    expect(b.collisionMask).toBe(RAMP_GROUP);
    expect(b.collisionFlag).toBe(true);
  });

  test('crossing a boundary line hands the ball to a DIFFERENT world', () => {
    // A line on the playfield is a staircase. Two ramps crossing over each other never see one
    // another's walls, and nothing is moved or rebuilt to make that true.
    const { ramp, planeEdge, wall1Line, wall2Line } = build();
    const b = ball();
    ramp.collision(b, { x: 20, y: 30 }, { x: 0, y: 1 }, 1, planeEdge);

    ramp.collision(b, { x: 20, y: 30 }, { x: 0, y: 1 }, 1, wall1Line as RampEdge);
    expect(b.collisionMask).toBe(WALL1_GROUP);
    expect(b.collisionFlag).toBe(false);

    ramp.collision(b, { x: 20, y: 30 }, { x: 0, y: 1 }, 1, wall2Line as RampEdge);
    expect(b.collisionMask).toBe(WALL2_GROUP);
  });

  test('a ramp edge always passes the ball through', () => {
    const { ramp, planeEdge } = build();
    const b = ball();

    ramp.collision(b, { x: 7, y: 8 }, { x: 0, y: 1 }, 1, planeEdge);

    expect(b.position.x).toBe(7);
    expect(b.direction).toEqual({ x: 1, y: 0 }); // untouched
    expect(b.speed).toBe(10);
  });
});

describe('ramp — the height is a plane equation', () => {
  test('Z comes out of the coefficients, not out of a mesh', () => {
    // z = x*ox + y*oy + radius + oz. There is no interpolation between vertices anywhere.
    const { ramp, planeEdge } = build();
    const b = ball(20, 30);

    ramp.collision(b, { x: 20, y: 30 }, { x: 0, y: 1 }, 1, planeEdge);

    expect(b.position.z).toBeCloseTo(20 * 0.1 + 30 * 0.2 + 0.25 + 3); // 11.25
  });

  test('crossing a boundary pins Z to the wall’s own offset', () => {
    const { ramp, wall1Line } = build();
    const b = ball();

    ramp.collision(b, { x: 20, y: 30 }, { x: 0, y: 1 }, 1, wall1Line as RampEdge);

    expect(b.position.z).toBeCloseTo(0.25 + 5);
  });
});

describe('ramp — each triangle has its own gravity', () => {
  test('the two angles become a vector: steepness and direction', () => {
    // angle1 is how steep, angle2 is which way it falls. Per-triangle gravity is how a ramp curves —
    // the ball is not following a path, it is rolling downhill on whichever triangle it is on.
    const steep = computeFieldForce(makePlane({ gravityAngle1: Math.PI / 2, gravityAngle2: 0 }), 100);
    const shallow = computeFieldForce(makePlane({ gravityAngle1: Math.PI / 12, gravityAngle2: 0 }), 100);

    expect(steep.x).toBeCloseTo(100);
    expect(steep.y).toBeCloseTo(0);
    expect(shallow.x).toBeLessThan(steep.x);
  });

  test('the direction angle turns the vector', () => {
    const sideways = computeFieldForce(makePlane({ gravityAngle1: Math.PI / 2, gravityAngle2: Math.PI / 2 }), 100);

    expect(sideways.x).toBeCloseTo(0);
    expect(sideways.y).toBeCloseTo(100);
  });

  test('entering a plane adopts its gravity', () => {
    const { ramp, plane, planeEdge } = build();
    const b = ball();

    ramp.collision(b, { x: 20, y: 30 }, { x: 0, y: 1 }, 1, planeEdge);

    expect(b.rampFieldForce).toEqual(plane.fieldForce);
  });
});

describe('ramp — the field is gravity minus drag', () => {
  test('a still ball feels only the plane’s gravity', () => {
    const { ramp } = build();
    const b = ball();
    b.speed = 0;
    b.rampFieldForce = { x: 50, y: 0 };
    const out = { x: 0, y: 0 };

    ramp.fieldEffect(b, out);

    expect(out.x).toBeCloseTo(50);
  });

  test('a moving ball is slowed in proportion to its speed', () => {
    // The same shape as the kickout's field, but the fraction is small and it reads as friction.
    const { ramp } = build();
    const b = ball();
    b.speed = 10;
    b.direction = { x: 1, y: 0 };
    b.rampFieldForce = { x: 50, y: 0 };
    const out = { x: 0, y: 0 };

    ramp.fieldEffect(b, out);

    expect(out.x).toBeCloseTo(50 - 10 * 0.2);
  });
});

describe('ramp — the entry line only reports', () => {
  test('it sounds and announces without touching the ball’s world', () => {
    const { ramp, entryLine, played, enters } = build();
    const b = ball();

    ramp.collision(b, { x: 20, y: 30 }, { x: 0, y: 1 }, 1, entryLine as RampEdge);

    expect(played).toEqual([1]);
    expect(enters).toEqual([1]);
    expect(b.collisionMask).toBe(0xffff); // unchanged
  });

  test('a tilted table lets the ball through in silence', () => {
    const { ramp, entryLine, played, enters } = build(true);
    const b = ball();

    ramp.collision(b, { x: 7, y: 8 }, { x: 0, y: 1 }, 1, entryLine as RampEdge);

    expect(played).toEqual([]);
    expect(enters).toEqual([]);
    expect(b.position.x).toBe(7); // it still passed through
  });
});

describe('ramp — the original’s bounding-box defect, transcribed', () => {
  test('three of the four bounds fold against xMin, as upstream marks Sic', () => {
    // The box only decides which grid boxes the ramp's field is registered into, so the defect makes a
    // ramp's gravity reach the wrong area rather than crash anything. Transcribed rather than fixed:
    // correcting it would change which balls feel a ramp's gravity, which is a change to how the table
    // plays that nobody asked for.
    const planes = [makePlane({
      v1: { x: 100, y: 500 }, v2: { x: 110, y: 500 }, v3: { x: 100, y: 520 },
    })];

    const asShipped = planeBounds(planes);
    const asIntended = boundsCorrected(planes);

    expect(asIntended).toEqual({ xMin: 100, yMin: 500, xMax: 110, yMax: 520 });
    // The shipped version folds yMin, xMax and yMax against xMin, which is 100 here.
    expect(asShipped.xMin).toBe(100);
    expect(asShipped.yMin).toBe(100);
    expect(asShipped.yMax).toBe(520);
    expect(asShipped).not.toEqual(asIntended);
  });
});

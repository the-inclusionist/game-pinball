// SPDX-License-Identifier: AGPL-3.0-or-later
// physics/step — advancing one frame of the simulation. Port of `pb::timed_frame`.
//
// It is the heart of the game, and its whole shape answers one question: how to move a fast ball
// without it passing through a thin wall. The original's answer has two layers.
//
//   1. HALF-RADIUS SUBSTEPS. The frame's distance is cut into half-radius pieces, and the ball is
//      tested against the table at each one. A ball never travels more than half a radius unchecked.
//
//   2. A CLAMPED TIMESTEP FOR A SLOW BALL. Below 0.8 speed the frame time is pinned to 0.01. That
//      reads backwards — a slow ball is the one that would need it least — until you see what a slow
//      ball actually is: the one resting against things, which a long frame would shove inside the
//      geometry in a single move.
//
// THE ORDER WITHIN THE FRAME IS DELIBERATE TOO: every force is integrated BEFORE anything moves, and
// only then do the substeps run. Integrating and moving ball by ball would let the second ball feel a
// field the first had already disturbed.

import { NO_COLLISION, normalize2d, type Ray, type Vector2 } from '../maths/maths.js';
import type { EdgeManager } from './grid.js';
import { createCollisionMemory, type CollisionMemory } from './ball.js';
import { flipperStepAngle, flipperSweep, type Flipper } from './flipper.js';
import { throwBall } from './stuck.js';

/** Multipliers derived from the ball's radius, as in `pb::init`. */
const MAX_SPEED_PER_RADIUS = 200;
const RADIUS_FRACTION_PER_STEP = 0.5;
/** Below this the timestep is clamped. */
const SLOW_BALL_SPEED = 0.8;
const SLOW_BALL_MAX_TIME = 0.01;
/** The collision ray's penetration tolerance. */
const RAY_MIN_DISTANCE = 0.002;

/** A sink, a kicker: while it holds the ball, it is the one moving it. */
export interface HoldingComponent {
  fieldEffect(ball: Ball): void;
}

export interface Ball {
  active: boolean;
  /** `TBall::throw_ball` — see `createBall`. */
  throwBall(direction: Vector2, angleMult: number, speedMult1: number, speedMult2: number): void;
  position: Vector2;
  direction: Vector2;
  speed: number;
  radius: number;
  timeDelta: number;
  collisionDisabled: boolean;
  collisionMask: number;
  component: HoldingComponent | null;
  memory: CollisionMemory;

  /* ===================== THE STUCK DETECTOR'S FIELDS ===================== */
  //
  // ⚠️ THEY LIVE ON THE BALL IN THE ORIGINAL TOO. `TBall` carries `HasGroupFlag`, `PrevPosition`,
  // `StuckCounter` and `LastActiveTime`, and `physics/stuck` reads all four. They were left out when
  // the ball was ported because nothing called the detector — which is exactly why nothing did.

  /** `HasGroupFlag`: the ball belongs to a component's group and is not free. */
  inGroup: boolean;
  /** The reference point the detector measures from. Moved only by its idle branch. */
  prevPosition: Vector2;
  stuckCounter: number;
  lastActiveTime: number;
  /** The original's `EdgeCollisionResetFlag` — see the comment in the inner loop. */
  collisionResetFlag: boolean;
}

export interface StepContext {
  grid: EdgeManager;
  /** The sum of forces on the ball (table gravity, ramp fields). Writes into `destination`. */
  fieldEffects(ball: Ball, destination: Vector2): void;
  /**
   * ⚠️ THE FLIPPERS ARE STEPPED INSIDE THIS FRAME, NOT BESIDE IT.
   *
   * `pb::simulate_ball` counts each ball's substeps AND each flipper's in the same pass, takes the
   * larger of the two for the loop, and inside every substep moves the balls first and the flippers
   * second. The interleaving is what lets a fast flipper catch a fast ball: run the two loops one
   * after the other and the ball crosses the swept area in between.
   *
   * Optional because a table under construction may have none, and because every test written before
   * flippers existed passes a context without them.
   */
  flippers?: readonly Flipper[];
  /** Called when a sweeping flipper strikes a ball, so the game can score and sound it. */
  onFlipperHit?: (flipper: Flipper, ball: Ball) => void;
}

export function createBall(
  p: {
    radius: number; position: Vector2; direction: Vector2; speed: number;
    /** Injected so a throw can be made repeatable. `RandFloat` in the original. */
    random?: () => number;
  },
): Ball {
  const ball: Ball = {
    active: true, position: p.position, direction: p.direction, speed: p.speed, radius: p.radius,
    timeDelta: 0, collisionDisabled: false, collisionMask: 1, component: null,
    memory: createCollisionMemory(), collisionResetFlag: false,
    inGroup: false,
    prevPosition: { x: p.position.x, y: p.position.y },
    stuckCounter: 0,
    lastActiveTime: 0,
    /**
     * `TBall::throw_ball`. A METHOD because that is how a holding component reaches it — a kickout
     * calls `heldBall.throwBall(...)` and has no way to reach a free function. The arithmetic stays in
     * `physics/stuck`, which is where the unstuck path already uses it.
     */
    throwBall(direction, angleMult, speedMult1, speedMult2) {
      // ⚠️ AND IT RELEASES THE COMPONENT, which is what `inCollisionComponent = false` means upstream.
      // A ball thrown while still held would be moved by the component on the next frame and the throw
      // would go nowhere.
      ball.component = null;
      throwBall(ball as unknown as Parameters<typeof throwBall>[0],
        direction, angleMult, speedMult1, speedMult2, p.random ?? Math.random);
    },
  };
  return ball;
}

export function advanceFrame(balls: readonly Ball[], ctx: StepContext, timeDelta: number): void {
  const stepOf = new Map<Ball, number>();
  const distanceOf = new Map<Ball, number>();
  let maxStep = -1;

  // ---- PHASE 1: integrate forces and decide how many substeps each ball needs ----
  for (const ball of balls) {
    stepOf.set(ball, -1);
    if (!ball.active) continue;

    ball.timeDelta = timeDelta;
    if (ball.timeDelta > SLOW_BALL_MAX_TIME && ball.speed < SLOW_BALL_SPEED) {
      ball.timeDelta = SLOW_BALL_MAX_TIME;
    }
    ball.collisionDisabled = false;

    if (ball.component) {
      // HELD: the component moves it, and the grid must not touch it. If it did, the ball would climb
      // out of the hole it fell into on its own.
      ball.component.fieldEffect(ball);
      continue;
    }

    const force: Vector2 = { x: 0, y: 0 };
    ctx.fieldEffects(ball, force);
    force.x *= ball.timeDelta;
    force.y *= ball.timeDelta;

    // THE DIRECTION IS DENORMALIZED BACK INTO A VELOCITY, the force is added, and the magnitude of the
    // result becomes the speed again. There is no separate acceleration vector anywhere in the game.
    ball.direction.x *= ball.speed;
    ball.direction.y *= ball.speed;
    ball.direction.x += force.x;
    ball.direction.y += force.y;
    ball.speed = normalize2d(ball.direction);

    const maxSpeed = ball.radius * MAX_SPEED_PER_RADIUS;
    if (ball.speed > maxSpeed) ball.speed = maxSpeed;

    const distance = ball.speed * ball.timeDelta;
    distanceOf.set(ball, distance);

    const halfRadius = ball.radius * RADIUS_FRACTION_PER_STEP;
    const step = Math.ceil(distance / halfRadius) - 1;
    stepOf.set(ball, step);
    if (step > maxStep) maxStep = step;
  }

  // ---- PHASE 1b: and how many the flippers need, into the SAME budget ----
  const flippers = ctx.flippers ?? [];
  const swingOf = new Map<Flipper, { steps: number; delta: number }>();
  for (const flipper of flippers) {
    const swing = flipperStepAngle(flipper, timeDelta);
    swingOf.set(flipper, swing);
    // `- 1` because the original counts steps from zero, exactly as the ball's does above.
    if (swing.steps - 1 > maxStep) maxStep = swing.steps - 1;
  }

  // ---- PHASE 2: the substeps ----
  for (let step = 0; step <= maxStep; step++) {
    for (const ball of balls) {
      const myStep = stepOf.get(ball)!;
      if (ball.collisionDisabled || myStep < step) continue;

      const halfRadius = ball.radius * RADIUS_FRACTION_PER_STEP;
      const totalDistance = distanceOf.get(ball)!;

      for (let traveled = 0; traveled < halfRadius;) {
        // Copies, not references: in the original the ray takes the vectors BY VALUE, and the
        // collision response moves the ball part-way through.
        const ray: Ray = {
          origin: { x: ball.position.x, y: ball.position.y },
          direction: { x: ball.direction.x, y: ball.direction.y },
          // On the LAST substep only the remainder of the distance is left; on the others, a full half
          // radius.
          maxDistance: myStep <= step ? totalDistance - myStep * halfRadius : halfRadius,
          minDistance: RAY_MIN_DISTANCE,
          collisionMask: ball.collisionMask,
        };

        const found = ctx.grid.findCollisionDistance(ray, (e) => ball.memory.alreadyHit(e));

        // THE MEMORY DANCE, transcribed: if some edge registered itself since the last pass, the flag
        // is set and only the flag is cleared; otherwise the whole memory is forgotten and the flag is
        // set again. The effect is that the memory survives while collisions keep happening, and is
        // wiped one pass after the first pass without one.
        if (ball.collisionResetFlag) {
          ball.collisionResetFlag = false;
        } else {
          ball.memory.forget();
          ball.collisionResetFlag = true;
        }

        if (found.distance >= NO_COLLISION) {
          ball.position.x += ray.maxDistance * ray.direction.x;
          ball.position.y += ray.maxDistance * ray.direction.y;
          break;
        }

        found.edge!.edgeCollision(ball, found.distance);
        if (found.distance <= 0 || ball.collisionDisabled) break;
        traveled += found.distance;
      }
    }

    // The balls have moved; now the flippers do, and they see where the balls ended up.
    for (const flipper of flippers) {
      const swing = swingOf.get(flipper)!;
      if (swing.steps - 1 < step) continue;
      flipperSweep(flipper, balls, swing.delta, (ball) => ctx.onFlipperHit?.(flipper, ball as Ball));
    }
  }
}

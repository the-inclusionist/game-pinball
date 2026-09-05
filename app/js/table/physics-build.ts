// SPDX-License-Identifier: AGPL-3.0-or-later
// table/physics-build — turning an authored table into something a ball can be dropped into.
//
// ========================= THE LAST JOIN =========================
// Phases 3 and 4 ported the physics: the edge grid, the ray queries, the substepping, the collision
// response. Phase 8 authored tables that DESCRIBE geometry. Nothing had ever connected the two, so the
// tables were pictures and the physics had nothing to run on.
//
// This is that join, and it is deliberately small: read the `collision` shapes a table declares,
// build the edges the grid wants, and hand back a `StepContext`. No new physics is written here —
// if a ball behaves wrongly on an authored table, the fault is in the table's geometry or in the
// ported physics, and this module is not a third place to look.
//
// ========================= WHICH COMPONENT WAS HIT, AND NOT JUST THAT ONE WAS =========================
// The grid's `Component` is an interface with one method and no identity. That is enough for the
// physics and not enough for the game: `control/dispatch` hands the CALLER to every control function,
// and a bumper that cannot say it is `bumper1` cannot score.
//
// So each edge is given a component that knows its own name and appends to a hit list. The frame reads
// that list, dispatches it, and clears it. Collecting rather than calling straight through is what
// keeps the physics free of the control layer — a ball can be stepped in a test with no score, no
// lamps and no sound.
//
// ========================= GRAVITY IS THE ONLY FIELD, FOR NOW =========================
// `StepContext.fieldEffects` is where the table's forces go. A real table has ramps that pull and
// kickers that push; this has gravity, pointing down the table, because that is what an authored table
// declares today. When a ramp declares a field, it goes here and nowhere else.

import {
  createEdgeManager, placeLineInGrid, placeCircleInGrid, type EdgeManager,
} from '../physics/grid.js';
import { createLine, createCircle, type Component } from '../physics/edges.js';
import { basicCollision, type CollisionResponse } from '../physics/collision.js';
import { createBall, type Ball, type StepContext } from '../physics/step.js';
import type { AuthoredComponent, AuthoredTable } from './authored.js';

/** How a surface answers a ball. One per kind, because a bumper is not a wall. */
export const RESPONSES: Readonly<Record<string, CollisionResponse>> = {
  // A wall gives most of the speed back and nothing more.
  wall: { elasticity: 0.7, smoothness: 0.1, threshold: 1e9, boost: 0 },
  // A bumper ADDS speed above a threshold, which is what makes it ignore a light touch.
  bumper: { elasticity: 0.9, smoothness: 0.1, threshold: 1.0, boost: 1.4 },
  // A flipper is a wall that hits back; the kick itself lives in `physics/flipper`.
  flipper: { elasticity: 0.8, smoothness: 0.05, threshold: 1e9, boost: 0 },
  // Everything else: a soft edge that mostly stops the ball.
  default: { elasticity: 0.5, smoothness: 0.2, threshold: 1e9, boost: 0 },
};

export function responseFor(component: AuthoredComponent): CollisionResponse {
  return RESPONSES[component.kind] ?? RESPONSES.default!;
}

export interface Hit {
  /** The component's name, which is what the control layer dispatches on. */
  readonly name: string;
  /** What `basicCollision` returned: the REBOUND speed, not the speed left over. */
  readonly reboundSpeed: number;
}

/**
 * ⚠️ THE DRAIN IS THE ONE COMPONENT THAT WORKS BY THE BALL NOT HITTING ANYTHING.
 *
 * Every other piece of a table is an edge: the ball arrives, the edge answers. A drain is a HOLE, so
 * it has bounds and no collision at all, and nothing in the physics can report it — the ball simply
 * carries on into the space below the table.
 *
 * Which is exactly what the first run did: launched, bounced off the ceiling, came back down and kept
 * going to y = 4408 on a table 235 tall, at the speed cap, forever. Nothing was wrong with the
 * physics. There was no rule saying where a table ENDS.
 *
 * So this is a position test rather than a collision. And it distinguishes TWO ways of leaving, which
 * a first version did not:
 *
 *   · BELOW the table is a legitimate way to lose. In a pinball anything that gets past the flippers
 *     is gone whether or not it passed through the drain's own rectangle — the bottom of the table IS
 *     the drain, and a narrow drain component only says where the middle of it is.
 *   · Past a SIDE or the top is a hole in the geometry. A table the ball can leave sideways is
 *     unfinished, and calling that a drain would hide it.
 *
 * Running the five tables is what forced the split: `wide-arc` and `narrow-tower` both lost their ball
 * a few pixels to one side of a drain that was too narrow to catch it, and reporting that the same way
 * as a ball escaping through a wall would have made a design question look like a broken table.
 */
export type DrainKind = string | 'below' | 'outside';

export function drainedBy(table: AuthoredTable, ball: { position: { x: number; y: number } }): DrainKind | null {
  const { x, y } = ball.position;

  for (const component of table.components) {
    if (component.kind !== 'drain') continue;
    const b = component.bounds;
    if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) return component.name;
  }

  // Past the flippers: lost, and legitimately so.
  if (y > table.size.height) return 'below';
  // Out of any other side: the table has a hole in it.
  if (y < 0 || x < 0 || x > table.size.width) return 'outside';
  return null;
}

/**
 * ⚠️ HOW HARD THE PLUNGER HAS TO PUSH, WHICH IS NOT A CONSTANT.
 *
 * A fixed launch speed worked on `low-orbit` and failed on `narrow-tower`, and the reason is
 * arithmetic rather than tuning: a ball launched at speed v against gravity g rises `v² / 2g`. At 260
 * against 120 that is 282 pixels, which clears low-orbit's 235-tall lane and falls 75 pixels short of
 * narrow-tower's 420 — so the ball never reached the return bend and came straight back down.
 *
 * The plunger is therefore sized to the TABLE, with a margin so a full launch clearly clears the bend
 * rather than just reaching it. A table twice as tall needs a plunger √2 times stronger, and nothing
 * about that is a matter of taste.
 */
export function launchSpeedFor(table: AuthoredTable, o: PhysicsOptions = {}): number {
  const gravity = o.gravity ?? DEFAULT_GRAVITY;
  return Math.sqrt(2 * gravity * table.size.height) * 1.15;
}

export const DEFAULT_GRAVITY = 120;

export interface TablePhysics {
  readonly grid: EdgeManager;
  readonly context: StepContext;
  /** Hits since the last `takeHits`. Collected, never dispatched from inside the physics. */
  takeHits(): readonly Hit[];
  /** A ball at the plunger, ready to be launched. */
  spawnBall(): Ball;
}

/**
 * ⚠️ HOW LONG A FRAME IS, AND WHY IT IS NOT ONE.
 *
 * `physics/step` measures time in the original's units, not in frames: it pins a slow ball's timestep
 * to 0.01 and calls anything under speed 0.8 slow. Handing it `timeDelta = 1` — the obvious reading of
 * "advance one frame" — makes every frame a hundred times too long for the clamp and the ball crawls:
 * a probe showed speed 0.03 after fifty frames, and the ball had not visibly moved.
 *
 * A frame is a sixtieth, and speeds are therefore large numbers: crossing a 235-pixel table in about
 * two seconds needs roughly two pixels a frame, which is a speed near 120.
 */
export const FRAME_SECONDS = 1 / 60;

export interface PhysicsOptions {
  /**
   * Down the table, in the same units. Chosen for how the ball BEHAVES rather than transcribed: an
   * authored table's gravity is an authoring decision, and the tests below check the behaviour
   * instead of the number.
   */
  readonly gravity?: number;
}

export function buildPhysics(table: AuthoredTable, o: PhysicsOptions = {}): TablePhysics {
  const grid = createEdgeManager(0, 0, table.size.width, table.size.height);
  const gravity = o.gravity ?? DEFAULT_GRAVITY;
  let hits: Hit[] = [];

  for (const component of table.components) {
    if (!component.collision?.length) continue;
    const response = responseFor(component);

    // The component the EDGES point at: it knows its name, and it only records.
    const owner: Component = {
      collision(_ball, position, direction, _distance, _edge) {
        const ball = _ball as Ball;
        const rebound = basicCollision(ball, position, direction, response);
        hits.push({ name: component.name, reboundSpeed: rebound });
      },
    };

    for (const shape of component.collision) {
      if (shape.kind === 'line') {
        placeLineInGrid(grid, createLine({
          component: owner, start: { x: shape.from.x, y: shape.from.y },
          end: { x: shape.to.x, y: shape.to.y },
        }));
      } else {
        placeCircleInGrid(grid, createCircle({
          component: owner, center: { x: shape.at.x, y: shape.at.y }, radius: shape.radius,
        }));
      }
    }
  }

  const plunger = table.components.find((c) => c.kind === 'plunger');

  return {
    grid,
    context: {
      grid,
      fieldEffects(_ball, destination) {
        // Down the table. `y` grows downward, so gravity is positive.
        destination.x = 0;
        destination.y = gravity;
      },
    },
    takeHits() {
      const taken = hits;
      hits = [];
      return taken;
    },
    spawnBall() {
      // In the plunger lane if there is one, at the top otherwise. A table without a plunger cannot
      // pass `validateTable`, so the fallback is only for a table under construction.
      const x = plunger ? plunger.bounds.x + plunger.bounds.width / 2 : table.size.width / 2;
      const y = plunger ? plunger.bounds.y - table.ballRadius * 2 : table.ballRadius * 2;
      return createBall({
        radius: table.ballRadius,
        position: { x, y },
        direction: { x: 0, y: -1 },
        speed: 0,
      });
    },
  };
}

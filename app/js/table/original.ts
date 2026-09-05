// SPDX-License-Identifier: AGPL-3.0-or-later
// table/original — the 1995 table, built from its own archive so a ball can be dropped into it.
//
// ========================= THE VALIDATION CONFIGURATION, ACTUALLY RUNNING =========================
// `dat/` has read the archive since phase 1 and `physics/` has been able to step a ball since phase 3,
// and the two had never met. The 1995 table existed as conformance numbers and as nothing anybody could
// play. This is the join, and it is the demonstration mode the Dev asked for.
//
// ⚠️ GEOMETRY AND THE FIELD, AND SAYING SO OUT LOUD. This builds the table's WALLS and the force on the
// ball. It does not instantiate the forty `T*` components, so nothing scores, no lamp lights and no
// mission runs. That needs the object manifest walked and each component constructed from its own
// group — its own piece of work. A demonstration that claimed to be the game would be a worse thing to
// deliver than one that says what it is.
//
// ========================= EVERY NUMBER COMES FROM THE ARCHIVE =========================
// The ball's radius is float record 500 of the `ball` group, and `TBall` assigns it to the table's
// `CollisionCompOffset` — which is what every wall is inflated by. The gravity is record 305 of the
// `table` group. The bounds are the table's own boundary, record 600 of the same group. Inventing any
// of the three would move every surface in the table by the difference and nothing would report it.
//
// ⚠️ THE FIELD IS NOT ONLY GRAVITY. `TTableLayer::FieldEffect` is gravity MINUS a drag term proportional
// to the ball's own speed, with a random jitter on X. The drag is why the 1995 ball settles instead of
// bouncing for ever, and the jitter is why it does not repeat the same path twice.

import { createEdgeManager, placeLineInGrid, placeCircleInGrid, type EdgeManager } from '../physics/grid.js';
import { installWall } from '../physics/wall.js';
import { basicCollision } from '../physics/collision.js';
import { createBall, type Ball, type StepContext } from '../physics/step.js';
import { EntryType, type Group } from '../dat/partman.js';
import { floatAttribute, groupNamed } from '../dat/attributes.js';

/** `TCollisionComponent`'s wall record. Every group that has one contributes geometry. */
export const WALL_RECORD = 600;
/** `TTableLayer`'s table-angle record: mult, angleX, angleY. */
export const GRAVITY_RECORD = 305;
/** `GraityMult`, the drag coefficient. */
export const DRAG_RECORD = 701;
/** `TBall`'s radius record. */
export const BALL_RADIUS_RECORD = 500;

/** `TTableLayer`'s own fallback, used only when the archive omits record 305. */
export const GRAVITY_DEFAULTS = { mult: 25, angleX: 0.5, angleY: 1.570796 } as const;
/** The original's Full Tilt branch value, and its fallback when record 701 is missing. */
export const DEFAULT_DRAG = 0.2;

export interface Bounds { xMin: number; yMin: number; xMax: number; yMax: number }

export interface OriginalHit {
  readonly group: string;
  readonly reboundSpeed: number;
}

export interface OriginalTable {
  readonly grid: EdgeManager;
  readonly context: StepContext;
  readonly bounds: Bounds;
  readonly ballRadius: number;
  /** How many wall records were installed. A table with none means the archive was not understood. */
  readonly wallCount: number;
  /** The groups that contributed geometry, so a hit can be reported by name. */
  readonly wallGroups: readonly string[];
  spawnBall(): Ball;
}

/** The extent of one wall record, whatever its shape. Used only for the table's own boundary. */
function boundsOfWall(data: readonly number[]): Bounds {
  const shape = Math.floor(data[0]!) - 1;
  const points: { x: number; y: number }[] = [];

  if (shape === 0) {
    const r = data[3]!;
    points.push({ x: data[1]! - r, y: data[2]! - r }, { x: data[1]! + r, y: data[2]! + r });
  } else {
    // A line carries two points; a polygon of n sides carries n + 1, the first repeated at the end.
    const count = shape === 1 ? 2 : shape + 1;
    for (let i = 0; i < count; i++) points.push({ x: data[1 + i * 2]!, y: data[2 + i * 2]! });
  }

  return {
    xMin: Math.min(...points.map((p) => p.x)),
    xMax: Math.max(...points.map((p) => p.x)),
    yMin: Math.min(...points.map((p) => p.y)),
    yMax: Math.max(...points.map((p) => p.y)),
  };
}

export interface OriginalOptions {
  /** Collected rather than dispatched, exactly as `table/physics-build` does for an authored table. */
  readonly onHit?: (hit: OriginalHit) => void;
  /** `RandFloat` in the field effect. Injected so a test can make the table repeat. */
  readonly random?: () => number;
}

export function buildOriginalTable(groups: readonly Group[], o: OriginalOptions = {}): OriginalTable {
  const tableGroup = groupNamed(groups, 'table');
  if (!tableGroup) throw new Error('[original] the archive has no group called "table"');

  const boundary = floatAttribute(tableGroup, WALL_RECORD);
  if (!boundary) throw new Error('[original] the "table" group carries no wall record');
  const bounds = boundsOfWall(boundary);

  const ballGroup = groupNamed(groups, 'ball');
  const radiusRecord = ballGroup && floatAttribute(ballGroup, BALL_RADIUS_RECORD);
  if (!radiusRecord?.length) throw new Error('[original] the archive does not say how big the ball is');
  const ballRadius = radiusRecord[0]!;

  const angle = floatAttribute(tableGroup, GRAVITY_RECORD);
  const mult = angle?.[0] ?? GRAVITY_DEFAULTS.mult;
  const angleX = angle?.[1] ?? GRAVITY_DEFAULTS.angleX;
  const angleY = angle?.[2] ?? GRAVITY_DEFAULTS.angleY;
  const gravityX = Math.cos(angleY) * Math.sin(angleX) * mult;
  const gravityY = Math.sin(angleY) * Math.sin(angleX) * mult;
  const drag = floatAttribute(tableGroup, DRAG_RECORD)?.[0] ?? DEFAULT_DRAG;

  const grid = createEdgeManager(
    bounds.xMin, bounds.yMin, bounds.xMax - bounds.xMin, bounds.yMax - bounds.yMin,
  );
  const random = o.random ?? Math.random;

  let wallCount = 0;
  const wallGroups: string[] = [];

  for (const group of groups) {
    // A group with no float arrays cannot carry geometry, and most of the 541 do not.
    if (!group.entries.some((e) => e.type === EntryType.Float32s)) continue;
    const data = floatAttribute(group, WALL_RECORD);
    if (!data?.length) continue;

    const name = group.name ?? `group-${wallCount}`;
    // The same shape `physics-build` uses: the edge knows who it belongs to and only records.
    const component = {
      collision(ball: unknown, position: { x: number; y: number }, direction: { x: number; y: number }) {
        const rebound = basicCollision(ball as Ball, position, direction, {
          elasticity: 0.7, smoothness: 0.1, threshold: 1e9, boost: 0,
        });
        o.onHit?.({ group: name, reboundSpeed: rebound });
      },
    };

    for (const edge of installWall(data, { component, offset: ballRadius })) {
      if (edge.kind === 'line') placeLineInGrid(grid, edge);
      else placeCircleInGrid(grid, edge);
    }
    wallCount++;
    wallGroups.push(name);
  }

  return {
    grid,
    bounds,
    ballRadius,
    wallCount,
    wallGroups,
    context: {
      grid,
      fieldEffects(ball, destination) {
        // `TTableLayer::FieldEffect`, entire. Gravity minus drag, with the jitter on X only.
        destination.x = gravityX - (0.5 - random() + ball.direction.x) * ball.speed * drag;
        destination.y = gravityY - ball.direction.y * ball.speed * drag;
      },
    },
    spawnBall() {
      // Near the top of the table, which is somewhere a ball can fall from without the plunger this
      // build does not yet have.
      return createBall({
        radius: ballRadius,
        position: {
          x: (bounds.xMin + bounds.xMax) / 2,
          y: bounds.yMin + (bounds.yMax - bounds.yMin) * 0.2,
        },
        direction: { x: 0, y: 1 },
        speed: 0,
      });
    },
  };
}

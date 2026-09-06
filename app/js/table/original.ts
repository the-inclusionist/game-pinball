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

import {
  createEdgeManager, placeLineInGrid, placeCircleInGrid, type EdgeManager, type Edge,
} from '../physics/grid.js';
import { installWall } from '../physics/wall.js';
import {
  createFlipper, deriveFlipper, setFlipperMotion, setControlPoints, distanceToFlipper,
  flipperCollision, type Flipper,
} from '../physics/flipper.js';
import { readFlipperGeometry } from './original-flippers.js';
import { plungerPosition } from './original-plunger.js';
import type { Plunger } from './plunger.js';
import { readVisual } from '../dat/visual.js';
import { basicCollision } from '../physics/collision.js';
import { createBall, type Ball, type StepContext } from '../physics/step.js';

/** `TPinballTable::AddBall` refuses past this many. The original's own literal. */
export const MAX_BALLS = 20;
import type { Vector2 } from '../maths/maths.js';
import type { Component } from '../physics/edges.js';
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
  /**
   * `TableG->GravityDirVectMult`, record 305's first float. Exposed because a RAMP scales every one of
   * its triangles' gravity by it — a ramp built with the wrong multiplier is a ramp with the table's
   * slope and not its own.
   */
  readonly gravityMult: number;
  /** How many wall records were installed. A table with none means the archive was not understood. */
  readonly wallCount: number;
  /** The groups that contributed geometry, so a hit can be reported by name. */
  readonly wallGroups: readonly string[];
  /**
   * ⚠️ THE EDGES ONE GROUP INSTALLED, WHICH IS HOW A GATE IS BUILT AT ALL. `TGate` has no collision
   * override: opening it clears the `active` flag on its own edges and the grid stops looking at them.
   * So a gate is not a component the table can build on its own — it is the table's geometry plus a
   * switch, and the switch has to be handed the very edge objects that went into the grid. A copy
   * would toggle nothing.
   */
  edgesOf(groupName: string): readonly Edge[];
  /**
   * ⚠️ THE FLIPPERS, WHICH ARE IN THE GRID AND SWEPT. The grid answers "the ball moved into the
   * flipper"; the sweep answers "the flipper moved into the ball". A pinball needs both, and a still
   * flipper only ever gets asked the first — which is why they are on the context as well.
   */
  readonly flippers: readonly Flipper[];
  /** Both flippers of one side, by the archive's object type rather than by the sign of x. */
  setFlippers(side: 'left' | 'right', extended: boolean): void;
  /**
   * ⚠️ WHERE THE BALL WAITS, WHICH IS RECORD 601 AND NOT A GUESS. Until the plunger was built this
   * table dropped its ball from near the top, because there was nothing to launch it with.
   */
  readonly plungerPosition: Vector2 | null;
  /** The plunger itself, when the archive has one. Pressed and released by the player. */
  readonly plunger: Plunger | null;
  /**
   * ⚠️ WHERE A MOTIONLESS BALL IS NOT STUCK. `control::CheckBallInControlBounds` asks whether the ball
   * is inside the flippers' or the plunger's box before deciding it needs rescuing — a ball held on a
   * raised flipper or waiting on the plunger is exactly where the player put it, and throwing it back
   * up the table would take the shot away.
   *
   * Derived rather than declared: each flipper's box is its pivot plus its whole reach, and the
   * plunger's is the extent of its own wall record.
   */
  readonly controlBounds: readonly Bounds[];
  /**
   * ⚠️ EVERY BALL THE TABLE HAS EVER MADE, ACTIVE OR NOT. `TPinballTable::BallList`. It is the
   * high-water mark of balls simultaneously in play, not a count of balls fed — because `addBall`
   * revives a dead one before it makes a new one.
   */
  readonly balls: readonly Ball[];
  /**
   * `TPinballTable::AddBall`. Reuses the first inactive ball, resetting it to rest and letting go of
   * whatever was holding it; makes a new one only when every ball is still in play; and past twenty
   * returns null rather than growing for ever, which is the original's own refusal.
   */
  addBall(at: Vector2): Ball | null;
  /**
   * `TPinballTable::BallCountInRect`, the `(position, margin)` overload. ACTIVE balls only, and the
   * region is a SQUARE of `pos ± margin` tested on each axis — not a circle.
   */
  ballCountInRect(at: Vector2, margin: number): number;
  /** A ball on the plunger, THROUGH the pool — see `addBall`. Null when twenty are already in play. */
  spawnBall(): Ball | null;
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
  /**
   * ⚠️ THE COMPONENT THAT OWNS A GROUP'S WALLS, WHEN THERE IS ONE.
   *
   * Without it every wall in the table answers with the same generic bounce — 0.7 elastic, no boost,
   * no threshold — which is what this module did before `dat/visual` existed. A bumper answered like a
   * wall, so it neither kicked nor debounced nor lit, and nothing said so.
   *
   * Returning `undefined` keeps the generic answer, which is right for the table's own boundary and for
   * every part whose component this port does not build yet.
   */
  readonly componentFor?: (groupName: string) => Component | undefined;
  /**
   * ⚠️ A COMPONENT MAY OWN ITS SHAPE, AND ONE DOES. A kickout's mouth is not the circle its wall
   * record draws: `TKickout`'s constructor multiplies that radius by record 306, and for `a_kout1`
   * that record is 0.05 — a twentieth. Installing the drawn circle would swallow the ball from twenty
   * times too far away, and the hole would look like a bug in the physics rather than in the geometry.
   *
   * Returning `undefined` keeps the record exactly as the file has it, which is right for everything
   * else on the table.
   */
  readonly geometryFor?: (groupName: string, data: readonly number[]) => readonly number[] | undefined;
  /**
   * ⚠️ THE FIELDS THAT PULL, WHICH ARE ADDED TO GRAVITY AND DO NOT REPLACE IT.
   * `TEdgeManager::FieldEffects` walks the fields in the ball's box and does `vector_add` for each one
   * that answers — on top of `TTableLayer::FieldEffect`, which is gravity minus drag and nothing else.
   * A kickout that replaced gravity would hold the ball up in mid-air on the way past.
   *
   * A callback rather than a list because a kickout cannot exist before the geometry it switches, and
   * this is read once per ball per frame. The upstream consults only the fields in the ball's own grid
   * box; asking all three and letting each one's radius check decide is the same answer.
   */
  readonly fieldsFor?: () => Iterable<{ fieldEffect(ball: Ball, destination: Vector2): boolean }>;
  /**
   * Which side each flipper group is. Absent means the table is built WITHOUT flippers, which is what
   * every test that only cares about walls wants — see `table/original-flippers` for why the side
   * cannot be guessed from the geometry.
   */
  readonly flipperSideFor?: (groupName: string) => 'left' | 'right' | undefined;
  /** Reported when a sweeping flipper strikes the ball, like any other hit. */
  readonly onFlipperHit?: (groupName: string) => void;
  /**
   * Builds the plunger. Absent leaves the table without one — which every test about walls wants, and
   * which is what this table had until the plunger existed.
   */
  readonly plungerFor?: (groups: readonly Group[], groupIndex: number) => Plunger | null;
  /**
   * ⚠️ GROUPS WHOSE GEOMETRY IS INSTALLED SWITCHED OFF. `TBlocker`'s constructor ends with
   * `ActiveFlag = 0`: the barrier across the drain is not there until a mission puts it there. Any
   * group carrying a wall record is installed active by default, which turns that barrier into a
   * permanent wall in front of the only place a ball can be lost.
   */
  readonly startsInactive?: (groupName: string) => boolean;
  /**
   * ⚠️ GROUPS WHOSE GEOMETRY SOMEBODY ELSE INSTALLS. A one-way gate is TWO lines on the same two
   * points, wound opposite ways and offset by different amounts — one wall record, two edges, and
   * neither of them the one this loop would build. Installing the plain wall as well would put a
   * solid line across a gate the ball is supposed to pass through.
   */
  readonly skipWall?: (groupName: string) => boolean;
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
  /** `TPinballTable::BallList`. See `addBall`: it is a pool, not a history. */
  const balls: Ball[] = [];

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
  const edgesByGroup = new Map<string, Edge[]>();

  for (const group of groups) {
    // A group with no float arrays cannot carry geometry, and most of the 541 do not.
    if (!group.entries.some((e) => e.type === EntryType.Float32s)) continue;
    const raw = floatAttribute(group, WALL_RECORD);
    if (!raw?.length) continue;

    const name = group.name ?? `group-${wallCount}`;
    if (o.skipWall?.(name)) continue;
    const data = o.geometryFor?.(name, raw) ?? raw;
    /**
     * ⚠️ THE OWNER IS LOOKED UP AT COLLISION TIME, NOT AT INSTALL TIME. A kickout cannot exist before
     * the geometry, because it switches the very edges installed here — so asking for it while
     * installing would always answer `undefined` and every hole would bounce like a wall. The cost is
     * a map lookup per collision; the alternative is an ordering nobody can satisfy.
     *
     * The same shape `physics-build` uses: the edge knows who it belongs to and only records.
     */
    const component = {
      collision(ball: unknown, position: { x: number; y: number }, direction: { x: number; y: number },
        distance: number, edge: unknown) {
        const owner = o.componentFor?.(name);
        if (owner) {
          owner.collision(ball, position, direction, distance, edge);
          o.onHit?.({ group: name, reboundSpeed: 0 });
          return;
        }
        const rebound = basicCollision(ball as Ball, position, direction, {
          elasticity: 0.7, smoothness: 0.1, threshold: 1e9, boost: 0,
        });
        o.onHit?.({ group: name, reboundSpeed: rebound });
      },
    };

    const installed: Edge[] = [];
    const active = !o.startsInactive?.(name);
    for (const edge of installWall(data, { component, offset: ballRadius })) {
      edge.active = active;
      if (edge.kind === 'line') placeLineInGrid(grid, edge);
      else placeCircleInGrid(grid, edge);
      installed.push(edge);
    }
    edgesByGroup.set(name, installed);
    wallCount++;
    wallGroups.push(name);
  }

  // ⚠️ A SECOND PASS, BECAUSE A FLIPPER HAS NO WALL RECORD. Its shape is three points and two times —
  // records 800 to 805 — and the loop above only looks at groups carrying record 600. A flipper built
  // in that loop would be a flipper that never existed.
  const flippers: Flipper[] = [];
  const flipperSide = new Map<Flipper, 'left' | 'right'>();
  const flipperName = new Map<Flipper, string>();
  const flipperBounds = new Map<Flipper, Bounds>();

  for (const group of groups) {
    const name = group.name;
    const side = name ? o.flipperSideFor?.(name) : undefined;
    if (!name || !side) continue;

    const visual = readVisual(groups, groups.indexOf(group));
    const geometry = readFlipperGeometry(group, visual, ballRadius);
    if (!geometry) continue;

    const flipper = createFlipper(deriveFlipper(geometry));
    flippers.push(flipper);
    flipperSide.set(flipper, side);
    flipperName.set(flipper, name);

    // Registered as a DISC about the pivot, which is a superset of the sector the flipper can occupy.
    // Registering it at rest would leave it missing from the boxes it swings into.
    const reach = Math.max(geometry.baseRadius, geometry.tipRadius) + ballRadius
      + Math.hypot(geometry.tipAtRest.x - geometry.pivot.x, geometry.tipAtRest.y - geometry.pivot.y);
    flipperBounds.set(flipper, {
      xMin: geometry.pivot.x - reach, xMax: geometry.pivot.x + reach,
      yMin: geometry.pivot.y - reach, yMax: geometry.pivot.y + reach,
    });
    placeCircleInGrid(grid, {
      active: true,
      collisionGroup: 1,
      center: { x: geometry.pivot.x, y: geometry.pivot.y },
      radius: reach,
      findCollisionDistance(ray) {
        // Rebuilt here because the sweep may have turned the flipper since anything last looked at it.
        setControlPoints(flipper, flipper.currentAngle);
        return distanceToFlipper(flipper, ray).distance;
      },
      edgeCollision(ball) {
        flipperCollision(flipper, ball as Ball);
        o.onHit?.({ group: name, reboundSpeed: 0 });
      },
    });
  }

  const controlBounds: Bounds[] = [];
  for (const flipper of flippers) {
    const box = flipperBounds.get(flipper);
    if (box) controlBounds.push(box);
  }

  // The plunger, if the caller builds one. Its own line is already installed by the wall loop above;
  // what is missing without this is the component that pulls back and lets go.
  let plunger: Plunger | null = null;
  let plungerAt: Vector2 | null = null;
  for (let index = 0; index < groups.length; index++) {
    const at = plungerPosition(groups[index]!);
    if (!at) continue;
    plungerAt = at;
    plunger = o.plungerFor?.(groups, index) ?? null;
    // The plunger's own extent, so a ball waiting on it is never mistaken for a stuck one.
    const shape = floatAttribute(groups[index]!, WALL_RECORD);
    if (shape?.length) controlBounds.push(boundsOfWall(shape));
    break;
  }

  return {
    grid,
    bounds,
    controlBounds,
    flippers,
    plunger,
    plungerPosition: plungerAt,
    setFlippers(side, extended) {
      for (const flipper of flippers) {
        if (flipperSide.get(flipper) !== side) continue;
        setFlipperMotion(flipper, extended ? 'extending' : 'retracting');
      }
    },
    ballRadius,
    wallCount,
    wallGroups,
    edgesOf: (groupName) => edgesByGroup.get(groupName) ?? [],
    context: {
      grid,
      flippers,
      onFlipperHit: (flipper) => o.onFlipperHit?.(flipperName.get(flipper) ?? 'flipper'),
      fieldEffects(ball, destination) {
        // `TTableLayer::FieldEffect`, entire. Gravity minus drag, with the jitter on X only.
        destination.x = gravityX - (0.5 - random() + ball.direction.x) * ball.speed * drag;
        destination.y = gravityY - ball.direction.y * ball.speed * drag;

        // ⚠️ AND THEN THE FIELDS THE BALL'S OWN GRID BOX HOLDS, which is where a ramp's gravity comes
        // from. `TEdgeManager::FieldEffects` reads one box and filters by collision group; a flat list
        // of every field on the table would give a ball on one ramp the gravity of the other from
        // across the playfield, because both ramps carry the same group.
        grid.fieldEffects(ball as never, destination);

        // And then every field given as a flat list — see `fieldsFor`.
        const fields = o.fieldsFor?.();
        if (!fields) return;
        // ⚠️ ZEROED BEFORE EACH ONE. A field that answers `false` does not write, and a shared vector
        // would then be added a second time with the previous field's value still in it — two holes
        // near each other would pull twice as hard as either. `TEdgeManager::FieldEffects` declares
        // its vector inside the loop for the same reason.
        //
        // ⚠️ AND THAT MAKES THE GUARD BELOW AN EQUIVALENT MUTANT: with the vector zeroed, adding the
        // answer of a field that declined adds nothing. It stays because it says what `false` means.
        const pull = { x: 0, y: 0 };
        for (const field of fields) {
          pull.x = 0;
          pull.y = 0;
          if (!field.fieldEffect(ball, pull)) continue;
          destination.x += pull.x;
          destination.y += pull.y;
        }
      },
    },
    balls,
    gravityMult: mult,

    addBall(at) {
      const spare = balls.find((ball) => !ball.active);
      if (!spare) {
        if (balls.length >= MAX_BALLS) return null;
        const made = createBall({
          radius: ballRadius,
          position: { x: at.x, y: at.y },
          direction: { x: 0, y: 0 },
          speed: 0,
          ...(o.random ? { random: o.random } : {}),
        });
        balls.push(made);
        return made;
      }

      // ⚠️ BROUGHT BACK AT REST AND LET GO OF. A ball revived still carrying the speed it drained at
      // would leave its new hole like a shot, and one still pointing at its old holding component
      // would be moved by that component instead of by the table.
      spare.active = true;
      spare.position = { x: at.x, y: at.y };
      spare.direction = { x: 0, y: 0 };
      spare.speed = 0;
      spare.timeDelta = 0;
      spare.collisionDisabled = false;
      spare.collisionMask = 1;
      spare.component = null;
      spare.prevPosition = { x: at.x, y: at.y };
      spare.stuckCounter = 0;
      return spare;
    },

    ballCountInRect(at, margin) {
      let count = 0;
      for (const ball of balls) {
        if (!ball.active) continue;
        if (ball.position.x < at.x - margin || ball.position.x > at.x + margin) continue;
        if (ball.position.y < at.y - margin || ball.position.y > at.y + margin) continue;
        count++;
      }
      return count;
    },

    spawnBall() {
      // ⚠️ ON THE PLUNGER, WHERE THE FILE SAYS. Record 601 is `table->PlungerPosition` and it is the
      // only thing `TPlunger`'s constructor reads. Before the plunger existed this dropped the ball
      // near the top of the table, which is a ball that starts its life already in play.
      const at = plungerAt ?? {
        x: (bounds.xMin + bounds.xMax) / 2,
        y: bounds.yMin + (bounds.yMax - bounds.yMin) * 0.2,
      };
      const ball = this.addBall(at);
      // The plunger's ball points DOWN the lane rather than nowhere, which is the one thing it does
      // not share with a ball a sink gives back.
      if (ball) ball.direction = { x: 0, y: 1 };
      return ball;
    },
  };
}

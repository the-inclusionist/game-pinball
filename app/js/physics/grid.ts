// SPDX-License-Identifier: AGPL-3.0-or-later
// physics/grid — the grid of collision boxes. Port of `TEdgeManager` plus the `edges_insert_*` helpers
// from `TTableLayer`.
//
// The problem it solves: the table has hundreds of edges, and testing the ball against all of them
// every frame would be waste. The grid divides the table into boxes, every edge is registered in every
// box it touches, and a search walks only the boxes the ball's ray crosses.
//
// THE GRID IS FIXED AT 10x15, not derived from the table size — it is written that way in the
// original's constructor. A larger table gets LARGER boxes, not more of them, which is why per-query
// cost does not grow with the table. (It grows with edge density per box, which is another matter.)
//
// ========================= THE TRAVERSAL IS ONE, AND UPSTREAM IT IS TWO =========================
// `TEdgeManager::FindCollisionDistance` and `TLine::place_in_grid` walk a segment's boxes with the SAME
// Bresenham loop, copied line for line into both files — including the "not sure why" comment beside
// the one-off bias. Here it exists once. It is the only deduplication this port makes, and it is over
// identical code rather than similar code.

import { NO_COLLISION, type Ray, type Vector2 } from '../maths/maths.js';

export const BOXES_X = 10;
export const BOXES_Y = 15;

export interface Edge {
  active: boolean;
  collisionGroup: number;
  findCollisionDistance(ray: Ray): number;
  /** What the edge DOES when the ball hits it. `TEdgeSegment::EdgeCollision` in the original. */
  edgeCollision(ball: unknown, distance: number): void;
}

/** An edge that is a segment — what the grid needs in order to register it. */
export interface WithSegment extends Edge {
  x0: number; y0: number; x1: number; y1: number;
}

/** An edge that is a circle. */
export interface WithCircle extends Edge {
  center: Vector2;
  radius: number;
}

/**
 * A force a component applies to a ball that is standing in its area. `field_effect_type`.
 *
 * ⚠️ IT IS REGISTERED PER BOX, AND ONLY THE BALL'S OWN BOX IS ASKED. That is what keeps a ramp's
 * gravity to the part of the table the ramp is on: with one flat list of every field, a ball anywhere
 * would feel every ramp at once. The collision group is the second half of the same idea — a free
 * ball's mask is 1 and a ramp's group is 2, so a ball that has not crossed onto the ramp is in another
 * world and feels nothing.
 */
export interface FieldEffect {
  readonly collisionGroup: number;
  /** `*field->ActiveFlag`. Absent means always live. */
  readonly activeFlag?: () => boolean;
  fieldEffect(ball: unknown, destination: Vector2): boolean;
}

/** What `FieldEffects` needs of the ball: where it is and which world it is in. */
export interface FieldBall {
  readonly position: Vector2;
  readonly collisionMask: number;
}

export interface CollisionResult {
  readonly distance: number;
  readonly edge: Edge | null;
}

export interface EdgeManager {
  readonly minX: number;
  readonly minY: number;
  readonly advanceX: number;
  readonly advanceY: number;
  boxX(x: number): number;
  boxY(y: number): number;
  addEdge(x: number, y: number, edge: Edge): void;
  edgesInBox(x: number, y: number): readonly Edge[];
  addField(x: number, y: number, field: FieldEffect): void;
  fieldsInBox(x: number, y: number): readonly FieldEffect[];
  /** `TEdgeManager::FieldEffects`. Adds every field of the ball's own box that its mask can see. */
  fieldEffects(ball: FieldBall, destination: Vector2): void;
  walkBoxes(x0: number, y0: number, x1: number, y1: number, visit: (x: number, y: number) => void): void;
  findCollisionDistance(ray: Ray, alreadyHit?: (e: Edge) => boolean): CollisionResult;
}

const clamp = (v: number, max: number): number => Math.max(0, Math.min(v, max));

export function createEdgeManager(minX: number, minY: number, width: number, height: number): EdgeManager {
  const advanceX = width / BOXES_X;
  const advanceY = height / BOXES_Y;
  const boxes: Edge[][] = Array.from({ length: BOXES_X * BOXES_Y }, () => []);
  const fieldBoxes: FieldEffect[][] = Array.from({ length: BOXES_X * BOXES_Y }, () => []);

  // CLAMPS rather than rejecting: the ball leaves the table in normal play (the drain, the plunger
  // lane), and clamping is what keeps the border edges being tested while it is out there.
  const boxX = (x: number): number => clamp(Math.floor((x - minX) / advanceX), BOXES_X - 1);
  const boxY = (y: number): number => clamp(Math.floor((y - minY) / advanceY), BOXES_Y - 1);

  const addEdge = (x: number, y: number, edge: Edge): void => {
    const list = boxes[x + y * BOXES_X]!;
    if (!list.includes(edge)) list.push(edge);
  };

  const edgesInBox = (x: number, y: number): readonly Edge[] => boxes[x + y * BOXES_X]!;

  const addField = (x: number, y: number, field: FieldEffect): void => {
    const list = fieldBoxes[x + y * BOXES_X]!;
    if (!list.includes(field)) list.push(field);
  };

  const fieldsInBox = (x: number, y: number): readonly FieldEffect[] => fieldBoxes[x + y * BOXES_X]!;

  /**
   * Walks the boxes the segment (x0,y0)-(x1,y1) crosses, visiting each. A transcription of the
   * original's Bresenham loop, one-off bias included — the upstream author noted it as "not sure why",
   * the traversal depends on it, and nobody can justify it.
   */
  function walkBoxes(x0: number, y0: number, x1: number, y1: number, visit: (x: number, y: number) => void): void {
    const bx0 = boxX(x0), by0 = boxY(y0);
    const bx1 = boxX(x1), by1 = boxY(y1);
    const stepX = x0 >= x1 ? -1 : 1;
    const stepY = y0 >= y1 ? -1 : 1;

    if (by0 === by1) {
      for (let ix = bx0; stepX === 1 ? ix <= bx1 : ix >= bx1; ix += stepX) visit(ix, by0);
      return;
    }
    if (bx0 === bx1) {
      for (let iy = by0; stepY === 1 ? iy <= by1 : iy >= by1; iy += stepY) visit(bx0, iy);
      return;
    }

    visit(bx0, by0);

    const dyDx = (y0 - y1) / (x0 - x1);
    const constant = -x0 * dyDx + y0;
    const biasX = stepX === 1 ? 1 : 0;
    const biasY = stepY === 1 ? 1 : 0;

    let ix = bx0, iy = by0;
    while (ix !== bx1 || iy !== by1) {
      const yOfBox = (iy + biasY) * advanceY + minY;
      const yOfLine = ((ix + biasX) * advanceX + minX) * dyDx + constant;

      if (stepY === 1 ? yOfLine >= yOfBox : yOfLine <= yOfBox) {
        iy += stepY;
        if (yOfLine === yOfBox) ix += stepX;
      } else {
        ix += stepX;
      }
      visit(ix, iy);
    }
  }

  function findCollisionDistance(ray: Ray, alreadyHit?: (e: Edge) => boolean): CollisionResult {
    let distance = NO_COLLISION;
    let found: Edge | null = null;

    // The original uses a `ProcessedFlag` on the edge itself plus a 1000-entry array to clear it
    // afterwards. A local Set does the same and leaves no dirty state on an edge if a query aborts —
    // the only liberty taken here, and it is in favor of correctness.
    const processed = new Set<Edge>();

    const testBox = (x: number, y: number): void => {
      if (x < 0 || x >= BOXES_X || y < 0 || y >= BOXES_Y) return;
      const list = boxes[x + y * BOXES_X]!;

      // BACK TO FRONT, as the original's rbegin/rend: the comparison below is a strict `<`, so the
      // order decides which of two edges at equal distance wins.
      for (let i = list.length - 1; i >= 0; i--) {
        const edge = list[i]!;
        if (processed.has(edge)) continue;
        if (!edge.active) continue;
        if ((edge.collisionGroup & ray.collisionMask) === 0) continue;
        if (alreadyHit?.(edge)) continue;

        processed.add(edge);
        const d = edge.findCollisionDistance(ray);
        if (d < distance) { distance = d; found = edge; }
      }
    };

    const x1 = ray.direction.x * ray.maxDistance + ray.origin.x;
    const y1 = ray.direction.y * ray.maxDistance + ray.origin.y;
    walkBoxes(ray.origin.x, ray.origin.y, x1, y1, testBox);

    return { distance, edge: found };
  }

  /**
   * `TEdgeManager::FieldEffects`. The ball's own box, walked BACKWARDS as the original does, and every
   * field whose group the ball's mask carries.
   *
   * ⚠️ THE VECTOR IS ZEROED PER FIELD. A field that answers `false` does not write into it, and a
   * shared vector would then be added a second time still holding the previous field's value — two
   * ramps overlapping would pull twice as hard as either.
   */
  const fieldEffects = (ball: FieldBall, destination: Vector2): void => {
    const list = fieldsInBox(boxX(ball.position.x), boxY(ball.position.y));
    for (let i = list.length - 1; i >= 0; i--) {
      const field = list[i]!;
      if (field.activeFlag && !field.activeFlag()) continue;
      if (!(ball.collisionMask & field.collisionGroup)) continue;
      const pull = { x: 0, y: 0 };
      if (!field.fieldEffect(ball, pull)) continue;
      destination.x += pull.x;
      destination.y += pull.y;
    }
  };

  return {
    minX, minY, advanceX, advanceY, boxX, boxY,
    addEdge, edgesInBox, addField, fieldsInBox, fieldEffects,
    walkBoxes, findCollisionDistance,
  };
}

/** `TLine::place_in_grid`: the line enters every box it crosses. */
export function placeLineInGrid(g: EdgeManager, edge: WithSegment): void {
  g.walkBoxes(edge.x0, edge.y0, edge.x1, edge.y1, (x, y) => g.addEdge(x, y, edge));
}

/**
 * `TTableLayer::edges_insert_circle`: the circle enters the boxes it ACTUALLY touches.
 *
 * The original does the overlap test by hand and exhaustively: center inside the box, then the four
 * corners against the radius, then four rays along the four box edges. Here is the equivalent analytic
 * test — the point of the box closest to the center, and the distance to it. Same answers, including in
 * the one case where a circle test and a bounding-box test disagree: the diagonal box that lies inside
 * the bounding square but outside the circle.
 */
export function placeCircleInGrid(g: EdgeManager, edge: WithCircle): void {
  // The original's margin (`AdvanceX * 0.001`) widens the reach by a hair so tangencies are not missed.
  const radiusWithMargin = edge.radius + g.advanceX * 0.001;
  const radiusSq = radiusWithMargin * radiusWithMargin;

  const minBoxX = g.boxX(edge.center.x - radiusWithMargin);
  const maxBoxX = g.boxX(edge.center.x + radiusWithMargin);
  const minBoxY = g.boxY(edge.center.y - radiusWithMargin);
  const maxBoxY = g.boxY(edge.center.y + radiusWithMargin);

  for (let ix = minBoxX; ix <= maxBoxX; ix++) {
    for (let iy = minBoxY; iy <= maxBoxY; iy++) {
      const left = ix * g.advanceX + g.minX;
      const top = iy * g.advanceY + g.minY;
      const nearestX = Math.max(left, Math.min(edge.center.x, left + g.advanceX));
      const nearestY = Math.max(top, Math.min(edge.center.y, top + g.advanceY));
      const dx = edge.center.x - nearestX;
      const dy = edge.center.y - nearestY;
      if (dx * dx + dy * dy <= radiusSq) g.addEdge(ix, iy, edge);
    }
  }
}

/**
 * `TTableLayer::edges_insert_square`. Registers a field in every box its rectangle touches.
 *
 * ⚠️ THE MARGIN IS A THOUSANDTH OF A BOX, TRUNCATED TO AN INTEGER — so on this table it is ZERO. The
 * original writes `(float)(int)(AdvanceX * 0.001f)`, and with boxes about 1.6 units wide that is
 * `(int)0.0016`. Transcribed as written rather than dropped, because on a table with much larger
 * boxes it would not be zero and the difference would be a row of boxes.
 */
export function insertFieldSquare(
  grid: EdgeManager,
  bounds: { xMin: number; yMin: number; xMax: number; yMax: number },
  field: FieldEffect,
): void {
  const widthMargin = Math.trunc(grid.advanceX * 0.001);
  const heightMargin = Math.trunc(grid.advanceY * 0.001);
  const xMin = bounds.xMin - widthMargin;
  const xMax = bounds.xMax + widthMargin;
  const yMin = bounds.yMin - heightMargin;
  const yMax = bounds.yMax + heightMargin;

  const xMinBox = grid.boxX(xMin);
  const yMinBox = grid.boxY(yMin);
  const xMaxBox = grid.boxX(xMax);
  const yMaxBox = grid.boxY(yMax);

  let boxLeft = xMinBox * grid.advanceX + grid.minX;
  for (let indexX = xMinBox; indexX <= xMaxBox; indexX++) {
    let boxTop = yMinBox * grid.advanceY + grid.minY;
    for (let indexY = yMinBox; indexY <= yMaxBox; indexY++) {
      if (xMax >= boxLeft && xMin <= boxLeft + grid.advanceX
        && yMax >= boxTop && yMin <= boxTop + grid.advanceY) {
        grid.addField(indexX, indexY, field);
      }
      boxTop += grid.advanceY;
    }
    boxLeft += grid.advanceX;
  }
}

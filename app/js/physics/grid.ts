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
  walkBoxes(x0: number, y0: number, x1: number, y1: number, visit: (x: number, y: number) => void): void;
  findCollisionDistance(ray: Ray, alreadyHit?: (e: Edge) => boolean): CollisionResult;
}

const clamp = (v: number, max: number): number => Math.max(0, Math.min(v, max));

export function createEdgeManager(minX: number, minY: number, width: number, height: number): EdgeManager {
  const advanceX = width / BOXES_X;
  const advanceY = height / BOXES_Y;
  const boxes: Edge[][] = Array.from({ length: BOXES_X * BOXES_Y }, () => []);

  // CLAMPS rather than rejecting: the ball leaves the table in normal play (the drain, the plunger
  // lane), and clamping is what keeps the border edges being tested while it is out there.
  const boxX = (x: number): number => clamp(Math.floor((x - minX) / advanceX), BOXES_X - 1);
  const boxY = (y: number): number => clamp(Math.floor((y - minY) / advanceY), BOXES_Y - 1);

  const addEdge = (x: number, y: number, edge: Edge): void => {
    const list = boxes[x + y * BOXES_X]!;
    if (!list.includes(edge)) list.push(edge);
  };

  const edgesInBox = (x: number, y: number): readonly Edge[] => boxes[x + y * BOXES_X]!;

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

  return { minX, minY, advanceX, advanceY, boxX, boxY, addEdge, edgesInBox, walkBoxes, findCollisionDistance };
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

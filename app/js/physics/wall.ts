// SPDX-License-Identifier: AGPL-3.0-or-later
// physics/wall — turns a .DAT float array into collision edges. Port of `TEdgeSegment::install_wall`.
//
// This is the bridge between the data phase and the physics phase: the type 11 entries of PINBALL.DAT
// are float arrays, and this is what reads them as geometry.
//
// ========================= THE FIRST NUMBER IS THE SHAPE =========================
//     floatArr[0] === 1  → a circle: centre (arr[1], arr[2]) and radius arr[3]
//     floatArr[0] === 2  → a line: (arr[1], arr[2]) to (arr[3], arr[4])
//     floatArr[0] === N+1 → a closed polygon of N sides
//
// The original computes `wallType = floor(arr[0]) - 1` and switches on 0 and 1, letting everything else
// fall through to the polygon case with the type value doubling as the side count.
//
// ========================= A POLYGON OF N SIDES CARRIES N+1 POINTS =========================
// The format CLOSES the figure by repeating the first point at the end, and the original relies on it:
// its loop reads `ptr[2]` and `ptr[3]` for the last side, which are only in range because that extra
// point is there. Reading N points instead of N+1 leaves the last side without a destination, and the
// ball escapes through a gap a whole side wide.
//
// ========================= WHY CONVEX CORNERS GET CIRCLES =========================
// Pushing every side outward by the ball's radius OPENS the corners into gaps. A circle at the vertex
// closes them, which is why it only exists when there is an offset — and only where the turn agrees
// with the offset's sign. Pushing INWARD closes the corners instead, so there is nothing to cover.

import { createCircle, createLine, offsetLine, type CircleEdge, type Component, type LineEdge } from './edges.js';

export interface WallOptions {
  component: Component;
  /** Usually the ball's radius. Inflates the wall so the ball can be treated as a point. */
  offset: number;
  active?: boolean;
  collisionGroup?: number;
}

const WALL_CIRCLE = 0;
const WALL_LINE = 1;
/** The original's `offset * 1.001` for corner circles: a hair wider, so no gap survives at the seam. */
const CORNER_SLACK = 1.001;

export function installWall(data: readonly number[], o: WallOptions): (LineEdge | CircleEdge)[] {
  const common = { component: o.component, active: o.active, collisionGroup: o.collisionGroup };
  const edges: (LineEdge | CircleEdge)[] = [];
  const wallType = Math.floor(data[0]!) - 1;

  if (wallType === WALL_CIRCLE) {
    edges.push(createCircle({ ...common, center: { x: data[1]!, y: data[2]! }, radius: o.offset + data[3]! }));
    return edges;
  }

  if (wallType === WALL_LINE) {
    const line = createLine({ ...common, start: { x: data[1]!, y: data[2]! }, end: { x: data[3]!, y: data[4]! } });
    offsetLine(line, o.offset);
    edges.push(line);
    return edges;
  }

  const sides = wallType;
  // The LAST vertex, so the first corner is the one between the closing side and the first.
  let previous = { x: data[2 * sides - 1]!, y: data[2 * sides]! };

  for (let index = 0; index < sides; index++) {
    const at = 1 + 2 * index;
    const current = { x: data[at]!, y: data[at + 1]! };
    // On the last side the "next" vertex wraps to the first, even though the segment itself still runs
    // to the repeated closing point.
    const next = index >= sides - 1
      ? { x: data[1]!, y: data[2]! }
      : { x: data[at + 2]!, y: data[at + 3]! };

    if (o.offset !== 0) {
      const incoming = { x: current.x - previous.x, y: current.y - previous.y };
      const outgoing = { x: next.x - current.x, y: next.y - current.y };
      const turn = incoming.x * outgoing.y - incoming.y * outgoing.x;
      // The turn has to agree with the offset's sign: that is what distinguishes a corner that opens
      // into a gap from one that folds shut.
      if ((turn > 0 && o.offset > 0) || (turn < 0 && o.offset < 0)) {
        edges.push(createCircle({ ...common, center: current, radius: o.offset * CORNER_SLACK }));
      }
    }

    const line = createLine({
      ...common,
      start: { x: data[at]!, y: data[at + 1]! },
      end: { x: data[at + 2]!, y: data[at + 3]! },
    });
    offsetLine(line, o.offset);
    edges.push(line);

    previous = current;
  }

  return edges;
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// physics/edges — the table's two geometric edges. Port of `TLine` and `TCircle`.
//
// ========================= THE DIVISION OF LABOUR =========================
// The edge knows GEOMETRY and nothing else: where it is, how far along the ray it is crossed, and the
// normal at the point of contact. What HAPPENS on impact — bounce, score, sound, light — belongs to
// the owning component, which receives it all ready made through `collision(...)`.
//
// That is why forty components need only two edges: a bumper and a target share a shape and differ
// only in how they react.
//
// ========================= WHY `offsetLine` EXISTS =========================
// The ball has a radius, but the original never tests a circle against a wall: it PUSHES the wall
// outward by the ball's radius and treats the ball as a point. One calculation less per wall, per
// ball, per frame — and the reason `installWall` takes an offset at all.

import {
  lineInit, normalize2d, rayIntersectCircle, rayIntersectLine,
  type Line, type Ray, type Vector2,
} from '../maths/maths.js';
import type { WithCircle, WithSegment } from './grid.js';

/** What the edge calls when the ball hits. `TCollisionComponent::Collision` in the original. */
export interface Component {
  collision(ball: unknown, position: Vector2, direction: Vector2, distance: number, edge: unknown): void;
}

export interface LineEdge extends WithSegment {
  readonly kind: 'line';
  line: Line;
  component: Component;
}

export interface CircleEdge extends WithCircle {
  readonly kind: 'circle';
  component: Component;
}

export interface LineOptions {
  component: Component;
  start: Vector2;
  end: Vector2;
  active?: boolean;
  collisionGroup?: number;
}

export function createLine(o: LineOptions): LineEdge {
  const edge: LineEdge = {
    kind: 'line',
    active: o.active ?? true,
    collisionGroup: o.collisionGroup ?? 0xffff,
    component: o.component,
    x0: o.start.x, y0: o.start.y, x1: o.end.x, y1: o.end.y,
    line: lineInit(o.start.x, o.start.y, o.end.x, o.end.y),

    findCollisionDistance(ray: Ray): number {
      return rayIntersectLine(ray, edge.line);
    },

    // The contact point comes from `line.rayIntersect`, which the preceding query wrote. The original
    // does exactly this: it stores the result on the line itself and reads it back here.
    edgeCollision(ball: unknown, distance: number): void {
      edge.component.collision(ball, edge.line.rayIntersect, edge.line.perpendicular, distance, edge);
    },
  };
  return edge;
}

/** `TLine::Offset`: pushes the line along its own perpendicular and rebuilds it. */
export function offsetLine(edge: LineEdge, offset: number): void {
  const dx = offset * edge.line.perpendicular.x;
  const dy = offset * edge.line.perpendicular.y;
  edge.x0 += dx; edge.y0 += dy;
  edge.x1 += dx; edge.y1 += dy;
  edge.line = lineInit(edge.x0, edge.y0, edge.x1, edge.y1);
}

export interface CircleOptions {
  component: Component;
  center: Vector2;
  radius: number;
  active?: boolean;
  collisionGroup?: number;
}

export function createCircle(o: CircleOptions): CircleEdge {
  const circle = { center: { x: o.center.x, y: o.center.y }, radiusSq: o.radius * o.radius };

  const edge: CircleEdge = {
    kind: 'circle',
    active: o.active ?? true,
    collisionGroup: o.collisionGroup ?? 0xffff,
    component: o.component,
    center: circle.center,
    radius: o.radius,

    findCollisionDistance(ray: Ray): number {
      return rayIntersectCircle(ray, circle);
    },

    /**
     * The circle does NOT keep the contact point between queries: it recomputes it from the ball's
     * position and direction. That is the real difference between it and the line rather than a matter
     * of style — it is what makes it safe when two balls query the same circle in one frame.
     */
    edgeCollision(ball: unknown, distance: number): void {
      const b = ball as { position: Vector2; direction: Vector2 };
      const position = {
        x: distance * b.direction.x + b.position.x,
        y: distance * b.direction.y + b.position.y,
      };
      const direction = { x: position.x - circle.center.x, y: position.y - circle.center.y };
      normalize2d(direction);
      edge.component.collision(ball, position, direction, distance, edge);
    },
  };
  return edge;
}

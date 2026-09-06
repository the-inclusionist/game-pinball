// SPDX-License-Identifier: AGPL-3.0-or-later
// table/mover — a body that travels a declared path and hits the ball on the way.
//
// ========================= WHY THIS EXISTS =========================
// ⚠️ THREE OF THE DEV'S FOUR TABLE THEMES ARE MADE OF IT. "Drones indo de satélite em satélite que
// interagem com a bolinha" on `low-orbit`; "sondas andando em esteiras" on `crater-run`; "sondas que
// interagem com a bolinha indo de meteoro em meteoro" on `ring-belt`.
//
// Everything on a table today is static except the flippers, and the flippers are a transcription of
// `TFlipperEdge` — a body rotating about a pivot between two angles. Nothing in the authored format
// could say "this thing travels from here to there and back", so nothing on a table could move except
// by the player moving it.
//
// ========================= A PATH, NOT A VELOCITY =========================
// A drone that went where its velocity took it would need a rule for the edges of the table, another
// for two of them meeting, and no author could predict where it would be. One that shuttles between
// two DECLARED points needs none of that: the author draws the line it runs along, and the table is
// the same table on every ball.
//
// ========================= AND THE PHASE IS A FUNCTION OF TIME =========================
// ⚠️ COMPUTED FROM THE CLOCK, NOT ACCUMULATED. A body whose position is integrated frame by frame
// drifts differently on a slow machine — which is a table that plays differently on a school laptop,
// and this game is for school laptops. `moverAt` is pure and takes the time; `createMover` keeps a
// clock and asks it.
//
// ========================= AND THE BOX IS THE WHOLE PATH =========================
// ⚠️ `physics/grid` PLACES AN EDGE INTO CELLS ONCE, by its bounding box. A body registered where it
// starts stops existing halfway along its path — which is not a hypothetical: `table/physics-build`
// records the same defect for flippers, where a resting paddle vanished because only its sweep had
// been registered. `bounds` covers everywhere the body can ever be.

import type { Rect } from '../shell/hud.js';

export interface MoverPath {
  readonly from: { readonly x: number; readonly y: number };
  readonly to: { readonly x: number; readonly y: number };
  /** How long ONE leg takes. A full there-and-back is twice this. */
  readonly seconds: number;
  /** It is a disc, because a disc has no orientation to keep track of. */
  readonly radius: number;
}

/**
 * Where the body is at time `t`, in seconds since the table opened.
 *
 * Pure and total: any `t`, including one larger than the game will ever run for, and any path
 * including one of no length.
 */
export function moverAt(path: MoverPath, t: number): { x: number; y: number } {
  const leg = Math.max(path.seconds, Number.EPSILON);
  // A full cycle is out and back. `phase` runs 0..2, and the second half is the first reversed.
  const phase = ((t / leg) % 2 + 2) % 2;
  const along = phase <= 1 ? phase : 2 - phase;
  return {
    x: path.from.x + (path.to.x - path.from.x) * along,
    y: path.from.y + (path.to.y - path.from.y) * along,
  };
}

export interface Mover {
  /** Where it is now. */
  readonly at: { x: number; y: number };
  /** Which way it is going now: a unit vector, or (0,0) on a path of no length. */
  readonly direction: { x: number; y: number };
  /** How fast, in table pixels per second. Nought on a path of no length. */
  readonly speed: number;
  /** Everywhere it can ever be, inflated by its own radius. What the grid is given. */
  readonly bounds: Rect;
  readonly radius: number;
  /** Seconds. The same unit `physics/step` takes, and not frames. */
  advance(seconds: number): void;
}

export function createMover(path: MoverPath): Mover {
  const dx = path.to.x - path.from.x;
  const dy = path.to.y - path.from.y;
  const length = Math.hypot(dx, dy);
  const leg = Math.max(path.seconds, Number.EPSILON);
  const speed = length / leg;
  const unit = length === 0 ? { x: 0, y: 0 } : { x: dx / length, y: dy / length };

  let now = 0;

  return {
    get at() { return moverAt(path, now); },

    get direction() {
      // Out on the first half of the cycle, back on the second. The sign is the whole of it.
      const phase = ((now / leg) % 2 + 2) % 2;
      const outbound = phase <= 1;
      return outbound ? { ...unit } : { x: -unit.x, y: -unit.y };
    },

    get speed() { return speed; },

    /**
     * ⚠️ THE WHOLE PATH, INFLATED BY THE RADIUS. See this module's header: the grid indexes once, so a
     * box that covered only the starting position would be a body that stops existing as soon as it
     * moves.
     */
    get bounds() {
      const left = Math.min(path.from.x, path.to.x) - path.radius;
      const top = Math.min(path.from.y, path.to.y) - path.radius;
      return {
        x: left,
        y: top,
        width: Math.abs(dx) + path.radius * 2,
        height: Math.abs(dy) + path.radius * 2,
      };
    },

    get radius() { return path.radius; },

    advance(seconds: number): void { now += seconds; },
  };
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// table/authored — a table described as data, and the rules it has to satisfy to open.
//
// ========================= WHY A FORMAT AT ALL =========================
// Phases 1 to 7 ported a machine that reads ONE table out of a 1995 archive. Phase 8 has to author a
// different one, with no Microsoft content in it, and the machine has to run both. So the shape of a
// table stops being "whatever `PINBALL.DAT` happens to contain" and becomes something writable.
//
// This is that shape. It is plain data on purpose: an authored table should be reviewable by reading
// it, and a diff of a table should say what changed about the GAME.
//
// ========================= EVERY RULE HERE WAS PAID FOR =========================
// The validator is not a schema check invented from taste. Each rule exists because this port already
// hit the failure it prevents:
//
//   · NAMES MUST BE UNIQUE — `control/links` wires behaviour by name, and a duplicate silently gives
//     one component two behaviours with the last one winning. The score table has a test for exactly
//     this against the 1995 data; an authored table gets the check before it can ever be loaded.
//
//   · A TABLE MUST BE TALLER THAN THE VIEW — otherwise `shell/camera` has zero travel and every one
//     of its numbers is dead. That is not an error in the camera; it is a table that did not need one,
//     and it should say so rather than have the camera silently do nothing.
//
//   · A TABLE MUST HAVE A DRAIN — a table with no drain can never lose a ball, so `control/drain`
//     never runs, the bonus is never cashed in and the game has no end. It is the single component
//     whose absence turns the whole control layer into decoration.
//
//   · A TABLE MUST HAVE A PLUNGER AND AT LEAST ONE FLIPPER — the plunger is where a ball comes from
//     (`control/feed`), and `physics/stuck` refuses to nudge a ball resting inside a flipper's or the
//     plunger's bounds. With neither, "stuck" has no exceptions and a ball held anywhere legitimate
//     would be thrown across the table.
//
//   · EVERY LAMP A COMPONENT NAMES MUST EXIST — the 1995 archive tolerates a missing lamp because a
//     null tag simply does nothing (see `control/simple-components`). For an authored table that is a
//     wiring bug, and this is where it gets caught.
//
//   · COMPONENTS MUST BE INSIDE THE TABLE — a component outside the bounds can never be hit, and
//     nothing anywhere else would ever say so.
//
// ========================= WHAT IS DELIBERATELY NOT HERE =========================
// No art, no sprite names, no colours. A table says what things ARE and where; how they are drawn is
// the renderer's business and how they are named out loud is `i18n/names`'. Keeping them apart is what
// lets the authored table be reviewed for PLAYABILITY without anybody arguing about pixels.

import type { Role } from '@the-inclusionist/engine/core/contract.js';
import type { ComponentKind } from '../i18n/names.js';
import type { Rect } from '../shell/hud.js';
import type { DeclaredBall, DeclaredComponent } from '../shell/declaration.js';
import type { LiveTable } from '../shell/boot.js';

/**
 * ⚠️ A LINE IS ONE-SIDED, AND ITS WINDING DECIDES WHICH SIDE.
 *
 * `maths/lineInit` computes the normal as `(dy, -dx)`, and `rayIntersectLine` refuses a ray arriving
 * at the back. So a line is a wall from one side and thin air from the other, and which one depends
 * entirely on the order the two points are written in:
 *
 *     left to right   →  normal points UP     (a floor)
 *     right to left   →  normal points DOWN   (a ceiling)
 *     top to bottom   →  normal points RIGHT  (a wall on the left of the play)
 *     bottom to top   →  normal points LEFT   (a wall on the right of the play)
 *
 * THE FIRST DRAFT OF EVERY TABLE HERE GOT THIS WRONG. Three of `low-orbit`'s four walls and the test
 * floor were wound backwards, and the symptom was not a wall that felt odd — it was a ball that fell
 * straight through the table and kept going, to y = 1600 on a table 200 tall. `normalOf` and the test
 * that walks every wall exist because reading the winding off a coordinate pair is something a person
 * gets wrong and a machine does not.
 */
export interface AuthoredLine {
  readonly kind: 'line';
  readonly from: { readonly x: number; readonly y: number };
  readonly to: { readonly x: number; readonly y: number };
}

export interface AuthoredCircle {
  readonly kind: 'circle';
  readonly at: { readonly x: number; readonly y: number };
  readonly radius: number;
}

export type AuthoredShape = AuthoredLine | AuthoredCircle;

export interface AuthoredComponent {
  /** Unique. See this module's header for what a duplicate costs. */
  readonly name: string;
  /**
   * ⚠️ DECLARED, not guessed. `i18n/names.kindOf` infers a kind from a `.DAT` group name because that
   * is all the 1995 table offers — `bump1` is a bumper because it starts with `bump`. An authored
   * table says so outright, which is both more honest and strictly better: `outlane.left` is a lane
   * and no prefix rule would ever work that out. The two mechanisms are separate on purpose; neither
   * is a fallback for the other.
   */
  readonly kind: ComponentKind;
  /** What it does TO THE BALL, for the accessibility contract. */
  readonly role: Role;
  readonly bounds: Rect;
  /** The score table this component indexes into. Absent means it is worth nothing. */
  readonly scores?: readonly number[];
  /** The name of a behaviour in the control registry. Absent means it is inert scenery. */
  readonly control?: string;
  readonly collision?: readonly AuthoredShape[];
  /** Lamps this component drives. Every one must be declared by the table. */
  readonly lamps?: readonly string[];
}

export interface AuthoredTable {
  readonly name: string;
  readonly size: { readonly width: number; readonly height: number };
  /** The ball's radius, which is also the unit the narration measures in. */
  readonly ballRadius: number;
  readonly components: readonly AuthoredComponent[];
  /** Every lamp the table has, by name. */
  readonly lamps: readonly string[];
}

export interface ValidationOptions {
  /** The camera's view along the scrolling axis. A table no taller than this needs no camera. */
  readonly viewHeight: number;
}

/**
 * Every problem with a table. EMPTY means it can open — the same contract the engine's
 * `conformanceProblems` uses, and for the same reason: a promise without a check is a comment.
 */
export function validateTable(table: AuthoredTable, o: ValidationOptions): string[] {
  const problems: string[] = [];

  if (!(table.size.width > 0) || !(table.size.height > 0)) {
    problems.push('size: width and height must be positive');
  }
  if (!(table.ballRadius > 0)) {
    problems.push('ballRadius: must be positive — it is the metric the narration uses');
  }
  if (table.size.height <= o.viewHeight) {
    problems.push(`size.height: ${table.size.height} is not taller than the ${o.viewHeight}-pixel view,`
      + ' so the camera has nowhere to travel');
  }

  const seen = new Set<string>();
  for (const component of table.components) {
    if (seen.has(component.name)) {
      problems.push(`${component.name}: declared twice — behaviour is wired by name`);
    }
    seen.add(component.name);

    if (!inside(component.bounds, table)) {
      problems.push(`${component.name}: outside the table, so it can never be hit`);
    }
    for (const lamp of component.lamps ?? []) {
      if (!table.lamps.includes(lamp)) {
        problems.push(`${component.name}: names lamp "${lamp}", which the table does not have`);
      }
    }
    for (const shape of component.collision ?? []) {
      if (!shapeInside(shape, table)) {
        problems.push(`${component.name}: collision shape outside the table`);
      }
    }
  }

  const kinds = new Set(table.components.map((c) => c.kind));
  if (!kinds.has('drain')) {
    problems.push('no drain: a ball could never be lost, so the game would have no end');
  }
  if (!kinds.has('plunger')) {
    problems.push('no plunger: a ball would have nowhere to come from');
  }
  if (!kinds.has('flipper')) {
    problems.push('no flipper: nothing to play with, and a held ball would be treated as stuck');
  }

  const lampNames = new Set(table.lamps);
  if (lampNames.size !== table.lamps.length) {
    problems.push('lamps: a name is declared twice');
  }

  return problems;
}

function inside(bounds: Rect, table: AuthoredTable): boolean {
  return bounds.x >= 0 && bounds.y >= 0
    && bounds.width > 0 && bounds.height > 0
    && bounds.x + bounds.width <= table.size.width
    && bounds.y + bounds.height <= table.size.height;
}

function shapeInside(shape: AuthoredShape, table: AuthoredTable): boolean {
  const within = (x: number, y: number) =>
    x >= 0 && y >= 0 && x <= table.size.width && y <= table.size.height;
  return shape.kind === 'line'
    ? within(shape.from.x, shape.from.y) && within(shape.to.x, shape.to.y)
    : within(shape.at.x - shape.radius, shape.at.y - shape.radius)
      && within(shape.at.x + shape.radius, shape.at.y + shape.radius);
}

/**
 * Which way a line's collidable side faces. `(dy, -dx)`, normalized — the same maths `lineInit` does,
 * exposed so a table can be checked rather than read.
 */
export function normalOf(line: AuthoredLine): { x: number; y: number } {
  const dx = line.to.x - line.from.x;
  const dy = line.to.y - line.from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dy / length, y: -dx / length };
}

/** The components as the accessibility contract sees them: a name, a role and a place. */
export function declaredComponentsOf(table: AuthoredTable): DeclaredComponent[] {
  return table.components.map((c) => ({ name: c.name, role: c.role, bounds: c.bounds }));
}

export interface TableState {
  readonly balls: readonly DeclaredBall[];
  readonly missionTextId: string;
  readonly missionHave: number;
  readonly missionNeed: number;
  readonly missionTargets: readonly string[];
}

/**
 * The authored table as the shell reads it. A live VIEW over the state, for the same reason
 * `shell/boot` builds one over the 1995 table: a snapshot would have the sonar point at where the ball
 * was.
 */
export function toLiveTable(table: AuthoredTable, state: () => TableState): LiveTable {
  const components = declaredComponentsOf(table);
  // The kinds are DECLARED, so nothing downstream has to guess them from a name. A real boot found
  // the outlanes silent because the guesser could not read `outlane.left`; see `LiveTable`.
  const kinds = new Map(table.components.map((c) => [c.name, c.kind]));

  return {
    playfieldWidth: table.size.width,
    playfieldHeight: table.size.height,
    ballRadius: table.ballRadius,
    components,
    kindOfComponent: (name) => kinds.get(name) ?? null,
    get balls() { return state().balls; },
    get missionTextId() { return state().missionTextId; },
    get missionHave() { return state().missionHave; },
    get missionNeed() { return state().missionNeed; },
    get missionTargets() { return state().missionTargets; },
  };
}

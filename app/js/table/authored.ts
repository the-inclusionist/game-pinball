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
import { controlNamed, AUTHORED_CONTROL_NAMES } from '../control/registry.js';

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

/**
 * ⚠️ A FLIPPER IS NOT A LINE, AND DECLARING IT AS ONE MAKES IT A FLIPPER-SHAPED WALL.
 *
 * Every flipper in the catalogue was `bounds` plus one collision line. The ball bounced off it, the
 * picture drew it, the validator passed it, and the player could not move it — which is most of the
 * reason a launched ball on any of the five tables did the same thing every time.
 *
 * The original authors a flipper as three vectors and two times: pivot, tip at rest, tip fully
 * extended, and how long the swing takes each way. `physics/flipper.deriveFlipper` keeps exactly that
 * form. This one takes a SWEEP IN DEGREES instead of the extended tip's coordinates, and the reason is
 * that writing the far end of a rotation out by hand is arithmetic a person gets wrong quietly.
 *
 * ⚠️ AND THE SIGN OF THAT SWEEP IS NOT GUESSABLE, because y grows downward. Rather than write down a
 * convention nobody can check, `validateTable` refuses a flipper whose sweep LOWERS its tip: a flipper
 * swings up. A sign error otherwise passes every rule, draws correctly, collides correctly, and swings
 * into the floor.
 */
export interface AuthoredFlipper {
  readonly pivot: { readonly x: number; readonly y: number };
  readonly tipAtRest: { readonly x: number; readonly y: number };
  /** Signed. Whatever value lifts the tip; the validator holds that it does. */
  readonly sweepDegrees: number;
  readonly baseRadius: number;
  readonly tipRadius: number;
  /** SECONDS for the whole swing, which is the form the 1995 data uses. */
  readonly extendTime: number;
  readonly retractTime: number;
}

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
  /** Required on a `flipper`, meaningless on anything else. See `AuthoredFlipper`. */
  readonly flipper?: AuthoredFlipper;
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
/**
 * ⚠️ THE KINDS THE BALL BOUNCES OFF, AS AGAINST THE KINDS IT ROLLS OVER OR FALLS INTO.
 *
 * This is not a special case with a list attached; it is what the two groups are. A bumper, a target, a
 * ramp, a flipper, a wall are BODIES: the ball arrives and the edge answers, and the physics reports the
 * hit by name. A lane is a stretch of table the ball rolls over. A well, a kicker, a drain and a hole
 * swallow it. A plunger is where it starts. None of those has an edge, and giving one an edge would
 * turn it into a wall.
 *
 * The rule exists because five components in the catalogue were on the wrong side of it and nothing
 * said so: `low-orbit`'s three targets, `narrow-tower`'s summit and `four-flippers`' target.centre each
 * had a score table and a control and no collision at all, so each was a painted rectangle the ball
 * flew through. A five-thousand-frame run of `narrow-tower` met walls and flippers and nothing else,
 * with the summit on screen throughout.
 */
export const STRUCK_KINDS: readonly ComponentKind[] = [
  'bumper', 'target', 'ramp', 'oneway', 'gate', 'flipper', 'rebounder', 'flag', 'blocker', 'wall',
];

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
    // ⚠️ A SCORE TABLE WITH NO CONTROL IS MONEY NOBODY CAN HAND OVER. `scores` is read by `getScoring`
    // and `getScoring` is only ever reached through a control function, so a component that declares
    // one and no control is worth nothing however many points it names. Six were: three lanes on
    // `low-orbit` and three landings on `narrow-tower`, all painted, all lamped, all free.
    if (component.scores?.length && !component.control) {
      problems.push(`${component.name}: declares a score and no control, so nothing can ever pay it`);
    }

    // ⚠️ A CONTROL NAME THE REGISTRY DOES NOT KNOW IS REFUSED, rather than accepted and ignored. Six of
    // the eight names the catalogue used were 1995 controls that need 1995 structures an authored table
    // cannot declare, and one existed nowhere at all. All eight validated, drew, and did nothing.
    if (component.control && !controlNamed(component.control)) {
      problems.push(`${component.name}: names control "${component.control}", which an authored table`
        + ` cannot supply. The ones it can: ${AUTHORED_CONTROL_NAMES.join(', ')}`);
    }
    for (const lamp of component.lamps ?? []) {
      if (!table.lamps.includes(lamp)) {
        problems.push(`${component.name}: names lamp "${lamp}", which the table does not have`);
      }
    }
    if (component.kind === 'flipper') {
      // A flipper's geometry lives in its own declaration, not in `collision`, so the rule below would
      // ask it for the wrong thing.
      if (!component.flipper) {
        problems.push(`${component.name}: a flipper must declare a pivot, a tip and a sweep —`
          + ' without them it is a flipper-shaped wall the player cannot move');
      } else if (!liftsItsTip(component.flipper)) {
        problems.push(`${component.name}: its sweep LOWERS the tip, so the flipper swings into the`
          + ' floor. y grows downward and the sign of the sweep is not guessable; this is that check');
      }
    } else if (STRUCK_KINDS.includes(component.kind) && !component.collision?.length) {
      problems.push(`${component.name}: a ${component.kind} is something the ball STRIKES, and this one`
        + ' declares no collision, so it can never be hit and its score can never fire');
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
/** Where the tip ends up, by rotating it about the pivot. The one place the sweep becomes a position. */
export function extendedTipOf(f: AuthoredFlipper): { x: number; y: number } {
  const angle = (f.sweepDegrees * Math.PI) / 180;
  const sin = Math.sin(angle), cos = Math.cos(angle);
  const dx = f.tipAtRest.x - f.pivot.x;
  const dy = f.tipAtRest.y - f.pivot.y;
  return { x: f.pivot.x + dx * cos - dy * sin, y: f.pivot.y + dx * sin + dy * cos };
}

/** A flipper swings UP. See `AuthoredFlipper` for why this is checked rather than documented. */
function liftsItsTip(f: AuthoredFlipper): boolean {
  return extendedTipOf(f).y < f.tipAtRest.y;
}

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

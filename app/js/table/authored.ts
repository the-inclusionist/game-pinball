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
import type { AuthoredMission } from './missions.js';
import type { MoverPath } from './mover.js';
import type { AuthoredStorm } from './storm.js';
import type { AuthoredSecret } from './secret.js';
// ⚠️ A VALUE IMPORT INTO A MODULE THAT `rollovers` ITSELF IMPORTS, and it is not a cycle: the
// import going the other way is `import type`, which erases. The alternative was a third copy of
// the list, and two copies of a rule is how this repository's last four defects were held open.
import { ROLLOVER_KINDS } from './rollovers.js';
import type { Rect } from '../shell/hud.js';
import type { DeclaredBall, DeclaredComponent } from '../shell/declaration.js';
import type { LiveTable } from '../shell/boot.js';
import { controlNamed, AUTHORED_CONTROL_NAMES, LIGHTING_CONTROLS } from '../control/registry.js';

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
  /**
   * The path this component travels, if it travels one.
   *
   * ⚠️ IT COMPOSES WITH THE KIND RATHER THAN REPLACING IT. A mover is still a bumper, or a target, or
   * a rebounder — the kind decides its colour, its role, its sound and what a hit is worth, and this
   * decides where it is. That is what lets the Dev's three themes be written without three new kinds:
   * a drone going satellite to satellite is a rebounder with a path, and a probe on a conveyor is a
   * bumper with one.
   *
   * ⚠️ AND A MOVER DECLARES NO `collision`. Its body IS the disc `mover.radius` describes, moving; a
   * component that declared both would have a shape that stays behind while the thing moves away.
   */
  readonly mover?: MoverPath;
  /**
   * This component is a SECRET DOOR: solid and drawn until the table opens it, then neither.
   *
   * ⚠️ THE DEV: "um ou dois cenários contendo passagens secretas que se abrem caso na primeira tacada
   * a bola desça." See `table/secret` for why this is a condition on an ordinary blocker rather than a
   * kind of its own — the drop targets already taught the physics and the renderer how to make a shape
   * stop existing, and this is that on a different clock.
   */
  readonly secret?: AuthoredSecret;
  /**
   * The drop-target bank this component belongs to, by name.
   *
   * ⚠️ ONLY MEANINGFUL ON A `target` DRIVEN BY `TargetBankControl`, and the validator says so rather
   * than ignoring it: a bank is a promise made in two places — the table declares the group, each
   * target says which group it is in — and a promise split in two is one that can be made by half.
   */
  readonly bank?: string;
}

/**
 * A bank of drop targets: hit them all and it pays, then stands them up again.
 *
 * The mechanic itself is `table/target-bank`. This is what a TABLE says about one, which is only its
 * name and its prize — who belongs to it is each target's own declaration, so moving a target between
 * banks is a one-line edit where it stands rather than a list to keep in step somewhere else.
 */
export interface AuthoredBank {
  readonly name: string;
  /** Paid once, on the hit that drops the last one standing. */
  readonly award: number;
}

export interface AuthoredTable {
  readonly name: string;
  readonly size: { readonly width: number; readonly height: number };
  /** The ball's radius, which is also the unit the narration measures in. */
  readonly ballRadius: number;
  readonly components: readonly AuthoredComponent[];
  /** Every lamp the table has, by name. */
  readonly lamps: readonly string[];
  /**
   * What the player is asked to do, in order, cycling.
   *
   * ⚠️ OPTIONAL, AND AN ABSENT LIST IS NOT AN EMPTY GAME. `table/objective` still derives something to
   * aim at from the `goal` and `key` roles for a table that declares none, which is what `bare-minimum`
   * needs — it exists to be the floor of the format and giving it a campaign would stop it being that.
   */
  readonly missions?: readonly AuthoredMission[];
  /**
   * Drop-target banks, by name. Absent means the table has none.
   *
   * ⚠️ THE DEV ASKED WHY THE TABLES ARE SO MUCH SIMPLER THAN THE ORIGINAL, and this is one of the
   * answers being paid off: every component the format could describe was a thing the ball touches
   * once and is paid for, with no state outliving the touch. A bank is the first that remembers.
   */
  readonly banks?: readonly AuthoredBank[];
  /**
   * The solar flare that sweeps this table, if one does.
   *
   * ⚠️ IT IS A PROPERTY OF THE TABLE AND NOT OF THE SCENE, though the scene is where it will be SEEN.
   * The flare changes how the ball moves, and a mechanic declared in `gfx/table-palette` would be a
   * physics whose source of truth is a colour file — which is exactly the join this repository keeps
   * getting wrong in the other direction, with capabilities declared in one place and connected in
   * none. The picture reads the table; the table does not read the picture.
   */
  readonly storm?: AuthoredStorm;
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
    // ⚠️ A LAMP IS STATE THE PLAYER READS, so declaring one is a promise of feedback. A component whose
    // control cannot light anything is making a promise no code path can keep — `DrainControl` and
    // `PlungerControl` do nothing at all by design, so a drain that names a lamp names it for nobody.
    if (component.lamps?.length && !LIGHTING_CONTROLS.includes(component.control ?? '')) {
      problems.push(`${component.name}: declares lamps but its control cannot light one`
        + ` — only these can: ${LIGHTING_CONTROLS.join(', ')}`);
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
    } else if (STRUCK_KINDS.includes(component.kind) && !component.collision?.length && !component.mover) {
      // ⚠️ OR A MOVER, WHOSE BODY IS ITS DISC. The rule is that a struck kind must have something the
      // ball can strike, and a travelling body has one — it simply is not a `collision` shape, because
      // a shape sits still while the thing moves away from it. Written as an OR rather than by adding
      // movers to `STRUCK_KINDS`: the list says which KINDS are struck, and a mover is a property a
      // bumper or a rebounder or a target can have.
      problems.push(`${component.name}: a ${component.kind} is something the ball STRIKES, and this one`
        + ' declares neither a collision nor a mover, so it can never be hit and its score can never fire');
    }
    for (const shape of component.collision ?? []) {
      if (!shapeInside(shape, table)) {
        problems.push(`${component.name}: collision shape outside the table`);
      }
    }
  }

  // ⚠️ AND THE OTHER DIRECTION. The rule above stops a component naming a lamp the table does not have;
  // this one stops the table declaring a lamp no component names. `low-orbit` carried three that way —
  // lamp.bonus, lamp.shootAgain, lamp.spare, which are the 1995 drain cascade's lite58, lite200 and
  // lite199, kept when the table was sketched from that one. They were entries in a list and nothing
  // else, and a dead lamp is worse than a missing one because it looks like a feature that is broken.
  const named = new Set(table.components.flatMap((c) => c.lamps ?? []));
  for (const lamp of table.lamps) {
    if (!named.has(lamp)) {
      problems.push(`lamp "${lamp}": declared by the table and named by no component, so nothing can`
        + ' ever turn it on');
    }
  }

  const kinds = new Set(table.components.map((c) => c.kind));
  if (!kinds.has('drain')) {
    problems.push('no drain: a ball could never be lost, so the game would have no end');
  }
  if (!kinds.has('plunger')) {
    problems.push('no plunger: a ball would have nowhere to come from');
  }
  // ⚠️ A TABLE WITH NOTHING TO PURSUE CANNOT BE DESCRIBED TO A PLAYER WHO CANNOT SEE IT. The contract's
  // fifth field is the list of live targets, and it is what makes the sonar work — which is most of the
  // reason this game consumes the engine at all. `goal` and `key` are the contract's own words for what
  // the player is after; a table naming neither leaves blind mode silent over a table full of things.
  //
  // The rule reaches `bare-minimum` too. It is the floor of the FORMAT, so if being describable is part
  // of the format then the example that documents the floor has to show it — the same reason its
  // flipper had to grow a collision. It is still not PLAYABLE, and that is a different axis.
  if (!table.components.some((c) => c.role === 'goal' || c.role === 'key')) {
    problems.push('nothing to pursue: no component has the role "goal" or "key", so the accessibility'
      + ' contract has no targets to report and blind mode would be silent');
  }
  if (!kinds.has('flipper')) {
    problems.push('no flipper: nothing to play with, and a held ball would be treated as stuck');
  }

  const lampNames = new Set(table.lamps);
  if (lampNames.size !== table.lamps.length) {
    problems.push('lamps: a name is declared twice');
  }

  /**
   * ⚠️ A MISSION THAT NAMES NOTHING NEVER COMPLETES, AND NOTHING SAYS WHY.
   *
   * The same failure every other rule in this validator exists for, arriving by a new road: the
   * mission runs, the sonar points at a component that is not on the table, the player hits everything
   * they can find, and the mission stays where it is for ever. It is the exact shape of the defects
   * this port keeps finding — a declaration nothing reaches — so it is refused before the table opens
   * rather than discovered by somebody playing it.
   */
  const placed = new Set(table.components.map((c) => c.name));
  for (const [at, mission] of (table.missions ?? []).entries()) {
    // ⚠️ AND A MISSION WITH NO ACTS IS REFUSED TOO. A mission is a sequence now, and an empty sequence
    // is a mission that is finished the moment it starts — or, depending on where it is read, one that
    // never starts at all. Neither is a thing a table meant to say.
    if (mission.stages.length === 0) {
      problems.push(`mission ${at}: no stages, so there is nothing to do`);
    }
    for (const stage of mission.stages) {
      if (stage.targets.length === 0) {
        problems.push(`mission "${stage.id}": no targets, so it can never be completed`);
      }
      for (const target of stage.targets) {
        if (!placed.has(target)) {
          problems.push(`mission "${stage.id}": names "${target}", which the table does not have`);
          continue;
        }
        /**
         * ⚠️ AND BEING ON THE TABLE IS NOT ENOUGH: IT HAS TO BE ABLE TO REPORT BEING HIT.
         *
         * `low-orbit`'s third mission named three LANES. A lane is a `ROLLOVER_KIND` — the ball passes
         * over it and `table/rollovers` polls for the crossing, because nothing collides to report one
         * — and the frame loop pushed those crossings into the score and not into the mission machine.
         * The mission could never be completed and the campaign stopped there for the rest of the
         * game, in silence: the table validated, the lanes scored, the runner had tests of its own,
         * and the sonar went on pointing at three lanes the player kept crossing.
         *
         * The wiring was the other half and is fixed in `main`. This is the half a TABLE can get
         * wrong: a drain and a plunger are in neither list on purpose, so a mission naming one can
         * never advance, and it is refused here rather than discovered by somebody playing it.
         */
        const kind = table.components.find((c) => c.name === target)!.kind;
        if (!STRUCK_KINDS.includes(kind) && !ROLLOVER_KINDS.includes(kind)) {
          problems.push(`mission "${stage.id}": names "${target}", a ${kind}, which cannot report being hit`);
        }
      }
    }
  }

  /**
   * ⚠️ A BANK IS A PROMISE MADE IN TWO PLACES, so it can be made by half — and half a bank is not an
   * error anywhere. The targets simply never drop, or the award is never paid, and the table looks
   * finished. Every rule below is one of the halves.
   */
  /**
   * ⚠️ A MOVER'S PATH IS A PROMISE ABOUT WHERE IT GOES, and a path that leaves the table is a body the
   * ball meets outside the world. `physics/grid` is built to the table's own extent, so an edge
   * registered past it is placed in no cell at all and simply stops existing — silently, which is the
   * shape this repository keeps paying for.
   */
  for (const component of table.components) {
    if (!component.mover) continue;
    const m = component.mover;
    if (component.collision?.length) {
      // Its body is the disc, moving. A shape as well would be geometry left behind by the thing.
      problems.push(`${component.name}: declares a mover AND a collision; a mover's body is its disc`);
    }
    if (!(m.radius > 0)) problems.push(`${component.name}: a mover needs a radius`);
    if (!(m.seconds > 0)) problems.push(`${component.name}: a mover needs a time for its path`);
    for (const [label, point] of [['from', m.from], ['to', m.to]] as const) {
      const inside = point.x - m.radius >= 0 && point.x + m.radius <= table.size.width
        && point.y - m.radius >= 0 && point.y + m.radius <= table.size.height;
      if (!inside) problems.push(`${component.name}: its mover's "${label}" leaves the table`);
    }
  }

  /**
   * ⚠️ A STORM THE PHYSICS CANNOT MAKE SENSE OF. Each of these produces a table that opens and plays
   * wrong rather than one that refuses: a band of no thickness grips nothing, a sweep of no duration
   * divides by a time that is not there, and a NEGATIVE drag turns `-k·v` into acceleration along the
   * ball's own heading — a field that adds energy every frame the ball is inside it, whose only
   * symptom is "the ball is always at maximum speed on this table" because `physics/step`'s clamp
   * catches what the field produces and nothing points back here.
   */
  if (table.storm) {
    if (!(table.storm.thickness > 0)) {
      problems.push('storm: needs a thickness — a flare of none is a band nothing can be inside');
    }
    if (!(table.storm.seconds > 0)) problems.push('storm: needs a time for its sweep');
    if (!(table.storm.drag > 0)) {
      problems.push('storm: needs a positive drag — a negative one adds energy instead of taking it');
    }
  }

  /**
   * ⚠️ TWO WAYS TO WRITE A SECRET DOOR THAT IS NOT ONE, and both of them validate, draw and play as
   * something the player never notices. A door that opens after nought lost balls was never shut; a
   * door with nothing solid in it is a passage that is always open. The gap IS the component, so a
   * secret with no collision is the drop target's defect wearing the opposite mask — drawn shut and
   * passed through.
   */
  for (const component of table.components) {
    if (!component.secret) continue;
    if (!(component.secret.afterLostBalls > 0)) {
      problems.push(`${component.name}: a secret that opens after ${component.secret.afterLostBalls}`
        + ' lost balls was never shut');
    }
    if (!component.collision?.length) {
      problems.push(`${component.name}: a secret door needs a collision — it is a wall until it opens`);
    }
  }

  const banks = table.banks ?? [];
  const bankNames = new Set(banks.map((b) => b.name));
  for (const component of table.components) {
    if (component.bank === undefined) continue;
    if (component.kind !== 'target') {
      problems.push(`${component.name}: only a target can be in a bank, and this is a ${component.kind}`);
    }
    if (component.control !== 'TargetBankControl') {
      // ⚠️ THE SUBTLEST OF THESE AND THE ONE THAT WOULD HAVE SHIPPED. A bank member driven by the
      // ordinary `TargetControl` pays its own score, never drops, and keeps the bank one short for
      // ever — so the bank is unclearable and every other member looks broken instead.
      problems.push(`${component.name}: is in a bank, so its control must be TargetBankControl`);
    }
    if (!bankNames.has(component.bank)) {
      problems.push(`${component.name}: names bank "${component.bank}", which the table does not declare`);
    }
  }
  for (const bank of banks) {
    const members = table.components.filter((c) => c.bank === bank.name);
    // Two directions of one rule: a bank of one is cleared by its own first hit and pays the prize on
    // contact, and a bank of none can never pay at all. Neither is a thing a table meant to say.
    if (members.length < 2) {
      problems.push(`bank "${bank.name}": has ${members.length} targets and needs at least two`);
    }
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

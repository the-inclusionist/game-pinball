// SPDX-License-Identifier: AGPL-3.0-or-later
// table/parts — the placeable things, each written from what a person can see.
//
// ⚠️ THE DEV, CHOOSING WHO THE TABLE EDITOR IS FOR: "a teacher or a child making a table of their own."
// That answer is what makes this module necessary rather than convenient.
//
// ========================= NOBODY SHOULD HAVE TO TYPE A WINDING =========================
// A component is `bounds` plus collision shapes plus a control and a score row, and `table/authored`'s
// rule is that a line's normal is `(dy, −dx)` — so the ORDER of its two endpoints decides which side of
// it is solid. Get it backwards and you have a wall the ball passes through from the side it arrives on,
// solid only from the side it never comes from. This repository's record has that defect in it four
// times, each found by playing rather than by reading.
//
// So a part function takes where the thing is, how big it is, and WHICH WAY IT LOOKS, and writes the
// geometry. `table/cabinet` is already this idea for the shell and says the same thing in its header:
// "the winding of a collision line is something a person gets wrong quietly and a machine does not."
//
// ========================= AND IT CARRIES WHAT THE SURVEYS LEARNT =========================
// ⚠️ AN UP-FACING FACE MADE HERE IS NEVER LEVEL. Gravity has no component along a horizontal surface, so
// a ball that lands on one has nothing to start it again: nine such shelves were found in the catalogue
// the day friction started being charged against the impact, every one of them holding a ball for ever.
// `tests/no-shelf-holds-a-ball` refuses another; this makes one impossible to draw.
//
// ========================= WHAT IS NOT HERE YET =========================
// Wells, kickers, flags, blockers and movers. They exist in the format and in the catalogue; what they
// do not have yet is a shape simple enough to ask an author for. Named here so that "not yet" is not
// mistaken for "forgotten" — the plan's §8 carries the rest of that list.

import type { AuthoredComponent, AuthoredLine } from './authored.js';

/** Which way a face looks: the side the ball is meant to arrive from. */
export const FACINGS = ['up', 'down', 'left', 'right'] as const;
export type Facing = typeof FACINGS[number];

export interface Point { readonly x: number; readonly y: number }
export interface Box {
  readonly x: number; readonly y: number; readonly width: number; readonly height: number;
}

/**
 * How much an up-facing face falls across its own width.
 *
 * ⚠️ TWO UNITS, WHICH IS THE NINE THE CATALOGUE WAS FIXED WITH. It is about seven degrees on a face
 * sixteen wide — steep enough that a ball rolls off it and shallow enough that the part still reads as
 * the flat thing the picture draws. The bar it has to clear is `tests/no-shelf-holds-a-ball`'s one in
 * twenty, which is three degrees.
 */
const FALL = 2;

/** The lamp a part lights, from its own name. One convention, so an editor need not invent names. */
export const lampFor = (name: string): string => `lamp.${name}`;

/**
 * The lamps a set of parts needs the table to declare.
 *
 * ⚠️ BECAUSE THE VALIDATOR REFUSES A COMPONENT NAMING A LAMP THE TABLE DOES NOT HAVE, and asking an
 * author to keep a second list in step by hand is asking them to hold the thing this module exists to
 * hold for them.
 */
export function lampsFor(parts: readonly AuthoredComponent[]): string[] {
  return [...new Set(parts.flatMap((p) => p.lamps ?? []))];
}

/**
 * A straight face of `length`, centred on `at`, wound so its normal points the way it is asked to.
 *
 * ⚠️ `y` GROWS DOWNWARD, WHICH IS WHY THIS IS A TABLE AND NOT A FORMULA. With `(dy, −dx)`: a line
 * written LEFT TO RIGHT faces up, RIGHT TO LEFT faces down, TOP TO BOTTOM faces right, and BOTTOM TO TOP
 * faces left. Every one of those four is a thing somebody would get wrong half the time.
 */
function faceAt(at: Point, length: number, facing: Facing): AuthoredLine {
  const half = length / 2;
  if (facing === 'up') {
    // ⚠️ AND IT FALLS, so it cannot be a shelf. See `FALL`.
    return { kind: 'line', from: { x: at.x - half, y: at.y - FALL }, to: { x: at.x + half, y: at.y } };
  }
  if (facing === 'down') {
    return { kind: 'line', from: { x: at.x + half, y: at.y }, to: { x: at.x - half, y: at.y } };
  }
  if (facing === 'right') {
    return { kind: 'line', from: { x: at.x, y: at.y - half }, to: { x: at.x, y: at.y + half } };
  }
  return { kind: 'line', from: { x: at.x, y: at.y + half }, to: { x: at.x, y: at.y - half } };
}

/** The smallest box that holds a shape, which is what `bounds` has to be. */
function boxOf(line: AuthoredLine, pad = 0): Box {
  const x = Math.min(line.from.x, line.to.x) - pad;
  const y = Math.min(line.from.y, line.to.y) - pad;
  return {
    x, y,
    width: Math.abs(line.to.x - line.from.x) + pad * 2,
    height: Math.abs(line.to.y - line.from.y) + pad * 2,
  };
}

/**
 * A bumper: a disc that kicks.
 *
 * ⚠️ A CIRCLE HAS NO SIDE TO ARRIVE ON, which is why it takes no facing and why every bumper in the
 * catalogue is one. The ball meets it from wherever it is.
 */
export function bumperAt(o: { name: string; at: Point; radius?: number }): AuthoredComponent {
  const radius = o.radius ?? 9;
  return {
    name: o.name, kind: 'bumper', role: 'structure',
    bounds: { x: o.at.x - radius, y: o.at.y - radius, width: radius * 2, height: radius * 2 },
    scores: [500, 1000, 1500, 2000], control: 'BumperControl', lamps: [lampFor(o.name)],
    collision: [{ kind: 'circle', at: o.at, radius }],
  };
}

/** A rebounder: the same shape, a flat award, and a role that says it is worth aiming at. */
export function rebounderAt(o: { name: string; at: Point; radius?: number }): AuthoredComponent {
  const radius = o.radius ?? 8;
  return {
    name: o.name, kind: 'rebounder', role: 'goal',
    bounds: { x: o.at.x - radius, y: o.at.y - radius, width: radius * 2, height: radius * 2 },
    scores: [3000], control: 'RebounderControl', lamps: [lampFor(o.name)],
    collision: [{ kind: 'circle', at: o.at, radius }],
  };
}

/** A target: a face the ball strikes, from the side it is asked to look. */
export function targetAt(
  o: { name: string; at: Point; length?: number; facing: Facing },
): AuthoredComponent {
  const face = faceAt(o.at, o.length ?? 16, o.facing);
  return {
    name: o.name, kind: 'target', role: 'key',
    bounds: boxOf(face, 2),
    scores: [1500], control: 'TargetControl', lamps: [lampFor(o.name)],
    collision: [face],
  };
}

/**
 * A one-way: a face that stops the ball from one side and lets it through from the other.
 *
 * ⚠️ IT IS THE SAME GEOMETRY AS A TARGET AND A DIFFERENT KIND, which is the whole of what one-way
 * means here: a collision line is ALREADY one-sided, so the mechanic is what the ball is told rather
 * than a second shape. `slipstream`'s vanes are the catalogue's pair.
 */
export function onewayAt(
  o: { name: string; at: Point; length?: number; facing: Facing },
): AuthoredComponent {
  const face = faceAt(o.at, o.length ?? 20, o.facing);
  return {
    name: o.name, kind: 'oneway', role: 'gate',
    bounds: boxOf(face, 2),
    scores: [3000], control: 'LaneControl', lamps: [lampFor(o.name)],
    collision: [face],
  };
}

/**
 * A ramp: a slope the ball rides.
 *
 * ⚠️ IT TAKES TWO POINTS AND NOT A FACING, because a slope's whole description is where it starts and
 * where it ends — and its face is the upper side, always. `wide-arc`'s own note is the rule to place one
 * by: forty-five degrees and no shallower, because "a line that shallow does not deflect a ball, it
 * CATCHES one" — and its ball crept down a seven-degree shelf for four minutes.
 */
export function rampFrom(o: { name: string; from: Point; to: Point }): AuthoredComponent {
  // Wound so the normal points UP the slope's own side, whichever way round the author drew it.
  const [from, to] = o.from.x <= o.to.x ? [o.from, o.to] : [o.to, o.from];
  const line: AuthoredLine = { kind: 'line', from, to };
  return {
    name: o.name, kind: 'ramp', role: 'climb',
    bounds: boxOf(line, 1),
    scores: [8000], control: 'RampControl', lamps: [lampFor(o.name)],
    collision: [line],
  };
}

/**
 * A plain wall: a face with no score and nothing to light.
 *
 * ⚠️ IT IS THE ONE PART WITH NO CONTROL, and that is not an omission. `validateTable` refuses a score
 * with no control and lamps a control cannot light; a wall is the thing that shapes the ball's route
 * without paying for it, and half of what makes a table playable is walls nobody is paid to hit.
 */
export function wallFrom(
  o: { name: string; from: Point; to: Point; facing: Facing },
): AuthoredComponent {
  const dx = o.to.x - o.from.x;
  const dy = o.to.y - o.from.y;
  /**
   * `(dy, −dx)`: swap the ends when the normal would point the other way.
   *
   * ⚠️ AND `up` AND `down` WERE THE WRONG WAY ROUND HERE UNTIL A MUTATION ASKED. The normal's y is
   * `−dx`, so a normal that points UP — negative y, because y grows downward — needs dx POSITIVE, and
   * this table said the opposite. Every wall asked to face up faced down and every one asked to face
   * down faced up, in the module written so that nobody would have to think about this.
   *
   * It survived the first version of the gate because that only ever asked a TARGET, whose four cases
   * are built by a different function. The mutation that deleted this swap left the file green, which
   * is what sent me looking.
   */
  const points = { up: dx, down: -dx, left: -dy, right: dy }[o.facing] > 0
    ? [o.from, o.to] : [o.to, o.from];
  const line: AuthoredLine = { kind: 'line', from: points[0]!, to: points[1]! };
  return {
    name: o.name, kind: 'wall', role: 'structure',
    bounds: boxOf(line, 1),
    collision: [line],
  };
}

/**
 * A lane: a region the ball rolls OVER, with no collision at all.
 *
 * ⚠️ AND THAT IS THE DEFINITION, NOT A SIMPLIFICATION. `table/authored` states it: "a lane is rolled
 * over, a well swallows". Half of what an authored table offers is regions rather than obstacles, and a
 * lane with a collision shape would be a wall that pays.
 */
export function laneAt(o: { name: string; box: Box; hazard?: boolean }): AuthoredComponent {
  return {
    name: o.name, kind: 'lane', role: o.hazard === true ? 'hazard' : 'free',
    bounds: o.box,
    scores: [o.hazard === true ? 2000 : 1500], control: 'LaneControl', lamps: [lampFor(o.name)],
  };
}

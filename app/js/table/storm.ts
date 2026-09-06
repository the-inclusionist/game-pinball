// SPDX-License-Identifier: AGPL-3.0-or-later
// table/storm — a band of the table that travels down it and slows whatever it is passing over.
//
// ========================= WHY THIS EXISTS =========================
// ⚠️ THE DEV'S THEME FOR `ion-storm`, the last of the four and the only one that asked for a mechanic
// nothing in the format could say: "um fundo que varia de preto, marrom, vermelho, amarelo e branco"
// — cycling, and back — together with "o flare deixando a bolinha mais lenta durante sua incidência".
//
// ========================= THE TWO HALVES ARE ONE THING =========================
// Read separately those are an animated backdrop and a slowing field: two mechanics that happen to
// share a table, each needing its own clock, its own authoring and its own explanation.
//
// Read together they are ONE — a bright band sweeping down the playfield. A fixed point of the table
// sees black, then brown, red, yellow, white as the band arrives, and the same colours in reverse as
// it leaves, which is the Dev's cycle exactly with the "e volta" included. And the ball is slowed
// while the band is over it, which is what "durante sua incidência" says. One declaration, one clock,
// and the picture explains the physics to the player without a word of tutorial.
//
// ========================= SO IT IS A BODY TRAVELLING A PATH =========================
// ⚠️ AND THIS REPOSITORY ALREADY HAS ONE. `table/mover` is "position as a function of time along a
// declared out-and-back path", written for the drones and the probes, and a flare is that with two
// differences: it spans the table's width instead of being a disc, and it drags instead of colliding.
// Sharing the arithmetic is not tidiness — it is what stops a second clock existing, and `table/mover`
// records at length why a body whose phase is accumulated rather than computed plays a different
// table on a slow machine.
//
// ========================= AND THE DRAG IS A FORCE =========================
// ⚠️ NOT A SPEED EDIT. `physics/step` integrates `fieldEffects` into the velocity and renormalises;
// a field that reached in and set `ball.speed` would be fighting that integration rather than joining
// it, and the ball would behave differently at 30 frames a second than at 60. A drag force `-k·v`
// integrated the way gravity is gives exponential decay — frame-rate stable, and what a real medium
// does to something moving through it.

import type { MoverPath } from './mover.js';

export interface AuthoredStorm {
  /** How long ONE sweep takes, top of the table to bottom. A full there-and-back is twice this. */
  readonly seconds: number;
  /** How tall the band is, in table pixels. The ball is gripped across this, fading to the edges. */
  readonly thickness: number;
  /**
   * The fraction of its own speed the ball sheds per second at the centre of the band.
   *
   * A coefficient rather than a force, because a force that did not scale with speed would stop a
   * slow ball dead and barely trouble a fast one — the opposite of what a medium does, and the
   * opposite of what the player expects to see.
   */
  readonly drag: number;
}

/**
 * The path the flare travels: straight down the middle of the table and back.
 *
 * The `radius` is the band's half-thickness, which is what `table/mover` would use for a disc's body
 * and is the right number for the same reason here: it is how far from the centre the flare reaches.
 */
export function stormPath(storm: AuthoredStorm, size: { readonly width: number; readonly height: number }): MoverPath {
  return {
    from: { x: size.width / 2, y: 0 },
    to: { x: size.width / 2, y: size.height },
    seconds: storm.seconds,
    radius: storm.thickness / 2,
  };
}

/**
 * How much of the flare's drag applies to a ball at height `y`, from 1 at the centre to 0 at the edge.
 *
 * ⚠️ IT FADES RATHER THAN SWITCHING OFF. A step would make the ball's speed jump at a line nobody
 * drew, and a jump in speed is what a COLLISION looks like — the player would read an invisible wall
 * where the game meant to show a medium. It is also what the picture does: the band is a gradient, so
 * a grip that were a step would disagree with what is on screen at every pixel but two.
 */
export function flareGrip(y: number, centre: number, thickness: number): number {
  const reach = thickness / 2;
  if (reach <= 0) return 0;
  const distance = Math.abs(y - centre);
  if (distance >= reach) return 0;
  return 1 - distance / reach;
}

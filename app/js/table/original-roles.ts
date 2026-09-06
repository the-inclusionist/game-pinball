// SPDX-License-Identifier: AGPL-3.0-or-later
// table/original-roles — what each kind of 1995 component IS, in the engine's vocabulary.
//
// ========================= THIS IS A PROPOSAL, AND IT IS NOT SPOKEN YET =========================
// The engine's declaration carries a ROLE per component — `hazard`, `goal`, `key`, `gate`, `structure`,
// `climb`, `water`, `free` — and that role is what a blind player is TOLD a thing is. The audio guide
// names it, the sonar sorts by it, the high-contrast filters colour by it.
//
// ⚠️ AND IT CANNOT BE DERIVED. The five authored tables assign roles by hand, one component at a time,
// and there is no rule anywhere that turns a kind into a role: `plunger` is `structure` while
// `lane.launch` is `free`, and both are correct for what they are. So a table of eighteen kinds is a
// DECISION about how the 1995 table is described, not a transcription of anything in the archive.
//
// It is written here rather than left in a message so it can be read, argued with and corrected one
// line at a time. Until the Dev approves it, `main.ts` refuses blind mode and the sweep while the
// demonstration is running — a switch that answers wrongly is worse than one that says it cannot
// answer — so nothing below is said to anybody yet.
//
// ========================= THE REASONING, KIND BY KIND =========================
// · `drain` is the only HAZARD. It is the one thing on the table that ends something by being touched.
//
// · `bumper`, `target`, `well`, `hole` and `kicker` are GOALS: the things a player aims AT. They score,
//   they are what a mission counts, and a player asking "what is over there" wants them named first.
//
// · `lane`, `tripwire` and `rollover` are KEYS. Crossing one is progress rather than a prize — the
//   lanes raise the bumpers, the trip lines run the skill shot — which is what `key` means in a
//   contract written for mazes as much as for pinball.
//
// · `gate`, `oneway` and `blocker` are GATES. One-way passage, literally: the word means the same thing
//   in both vocabularies for once.
//
// · `ramp` is CLIMB. It is the one place the ball changes height on this table, which is exactly what
//   the role is for, and `table/ramp` gives its triangles their own gravity for that reason.
//
// · `wall`, `rebounder`, `flipper`, `plunger` and `flag` are STRUCTURE: the shape of the table. The
//   flipper is furniture the player moves and the plunger is furniture that launches, and neither is a
//   place to aim for.
//
// · `lamp` is FREE. A lamp is a light on the playfield with no body: the ball rolls over where it is.
//   Calling it structure would put a wall in the description where there is none.

import type { ComponentKind } from '../i18n/names.js';

/** The engine's own vocabulary, repeated here so this file can be read without opening the contract. */
export type ComponentRole =
  | 'hazard' | 'goal' | 'key' | 'gate' | 'structure' | 'climb' | 'water' | 'free';

/**
 * ⚠️ EVERY KIND HAS AN ENTRY, and a test holds that. A kind that fell through to a default would be
 * described as whatever the default is, silently, which is the failure this whole file exists to
 * avoid — and `COMPONENT_KINDS` is the list the archive's own names are read into.
 */
export const ROLE_OF_KIND: Readonly<Record<ComponentKind, ComponentRole>> = {
  drain: 'hazard',

  bumper: 'goal',
  target: 'goal',
  well: 'goal',
  hole: 'goal',
  kicker: 'goal',

  lane: 'key',
  tripwire: 'key',

  gate: 'gate',
  oneway: 'gate',
  blocker: 'gate',

  ramp: 'climb',

  wall: 'structure',
  rebounder: 'structure',
  flipper: 'structure',
  plunger: 'structure',
  flag: 'structure',

  lamp: 'free',
};

/**
 * The role of a component by its archive name, or null when the name says nothing.
 *
 * ⚠️ NULL RATHER THAN A DEFAULT. `kindOf` returns null for a name it does not recognise — most of the
 * table's geometry is anonymous, and the archive names its components but not its walls — and a
 * component this cannot place must be left out of the declaration rather than described as furniture.
 * The declaration is what a player is told; a guess in it is a lie with a confident voice.
 */
export function roleOfComponent(
  name: string, kindOf: (name: string) => ComponentKind | null,
): ComponentRole | null {
  const kind = kindOf(name);
  return kind === null ? null : ROLE_OF_KIND[kind];
}

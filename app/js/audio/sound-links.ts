// SPDX-License-Identifier: AGPL-3.0-or-later
// audio/sound-links — which component makes which noise, and which noises are load-bearing. Ports of
// `loader::get_sound_id` and the sound records of `loader::query_visual`.
//
// ========================= A SOUND COMPONENT POINTS AT A SOUND GROUP =========================
// A `TSound` is a component like any other, and its group carries an Int16 record `[1100, G]` where G
// is the group index of the sound it plays. `TSound::Play` then hands that index to `play_sound`, which
// looks up the duration. So `soundwave7` is a name in the table, `sound7.wav` is a file, and the
// archive is what joins them — nothing in the code knows either name.
//
// Three other records point at sounds the same way: 1101 for a component's second sound, 304 for a soft
// hit and 406 for a kicker's hard hit. They are read here so that "which files does this table
// actually need" has one answer instead of four.
//
// ⚠️ AND THE ANSWER CANNOT BE FOUND BY LOOKING AT NAMES. Forty-one components in the shipped table
// carry a sound record, and only thirty of them are called `soundwave*`. The plunger has its own, and
// so does the table itself. A scan that trusted the naming would miss eleven of them — and did, in the
// first version of this module's test.
//
// ========================= THE FIRST DECLARED SOUND IS A SENTINEL =========================
// `get_sound_id` starts its search at index ONE, and `play_sound` rejects anything `<= 0`. So sound
// index 0 can never be returned and can never be played — it is a permanent "no sound".
//
// And the real archive proves it: the first group marked 202 is named `...`, which is not a file name
// and never could be. A loader that tried to load every declared sound would report that one as a
// failure forever. It is not a failure; it is the null slot, spelled.
//
// ========================= AND SOME DURATIONS ARE TIMERS =========================
// ⚠️ THIS IS THE LIST THAT MATTERS. `control/wormhole` and `control/hyperspace` hand a sound's
// duration straight to a kickout timer, and `control/table-actions` does the same for multiball. A
// sound whose file is missing carries -1 (see `audio/sound-table`), and -1 means NEVER — so a missing
// file among THESE holds the ball forever, while a missing file anywhere else only makes the game
// quieter.
//
// The distinction is the whole point of this module: "some sounds are missing" is a shrug, and "one of
// the timer sounds is missing" is a stuck game. `strandingRisks` is the question worth asking.

import { EntryType, type Group } from '../dat/partman.js';

/** `visual->SoundIndex4`, the sound a `TSound` component plays. */
export const SOUND_RECORD = 1100;
/** `visual->SoundIndex3`. */
export const SECOND_SOUND_RECORD = 1101;
/** `visual->SoftHitSoundId`. */
export const SOFT_HIT_RECORD = 304;
/** `visual->Kicker.HardHitSoundId`. */
export const KICKER_HIT_RECORD = 406;

const SOUND_RECORDS: readonly number[] = [
  SOUND_RECORD, SECOND_SOUND_RECORD, SOFT_HIT_RECORD, KICKER_HIT_RECORD,
];

/**
 * Sound index 0 is unreachable: `get_sound_id` starts at 1 and `play_sound` rejects `<= 0`. The first
 * declared sound is therefore a null slot, and in the shipped archive it is spelled `...`.
 */
export const NULL_SOUND_INDEX = 0;

export interface SoundLink {
  /** The component's group name, e.g. `soundwave7`. */
  readonly component: string;
  /** The group index of the sound it points at. */
  readonly soundGroup: number;
  /** Which record made the link. */
  readonly record: number;
}

/**
 * ⚠️ The components whose sound DURATION is used as a timer, gathered from the control layer:
 *
 *   · `soundwave7`  — the gravity well holds the ball for exactly its length (`control/wormhole`).
 *   · `soundwave41` — the multiball award runs for its length (`control/table-actions`), and it is the
 *                     first of the hyperspace climax fanfare (`control/hyperspace`).
 *   · `soundwave36`, `soundwave50` — the other two of that fanfare, whose combined length becomes the
 *                     hyperspace kickout's hold.
 *   · `soundwave35`, `soundwave38`, `soundwave39` — the hyperspace ladder sounds, each of which becomes
 *                     that kickout's timer on its own rung.
 *
 * A missing file among these is a stuck ball. A missing file anywhere else is silence.
 */
export const TIMER_SOUND_COMPONENTS: readonly string[] = [
  'soundwave7', 'soundwave41', 'soundwave36', 'soundwave50',
  'soundwave35', 'soundwave38', 'soundwave39',
];

function int16sOf(group: Group): Uint8Array | null {
  for (const entry of group.entries) {
    if (entry.type === EntryType.Int16s && entry.data) return entry.data;
  }
  return null;
}

/** Every `[record, soundGroup]` pair in a group's Int16 array. */
function linksIn(name: string, data: Uint8Array): SoundLink[] {
  const links: SoundLink[] = [];
  for (let i = 0; i + 3 < data.length; i += 2) {
    const record = data[i]! | (data[i + 1]! << 8);
    if (!SOUND_RECORDS.includes(record)) continue;
    links.push({ component: name, soundGroup: data[i + 2]! | (data[i + 3]! << 8), record });
  }
  return links;
}

/** Which component plays which sound group, across the whole table. */
export function findSoundLinks(groups: readonly Group[]): SoundLink[] {
  const links: SoundLink[] = [];
  for (const group of groups) {
    if (!group.name) continue;
    const data = int16sOf(group);
    if (!data) continue;
    links.push(...linksIn(group.name, data));
  }
  return links;
}

export interface StrandingReport {
  /** Components whose sound file is missing: the game is quieter for each of these. */
  readonly silent: readonly string[];
  /**
   * ⚠️ Components whose sound file is missing AND whose duration is used as a timer. Each one of these
   * holds a ball forever. Empty is the only acceptable answer for a table that ships.
   */
  readonly stranding: readonly string[];
}

/**
 * Crosses the links against the files that failed to load. The distinction between the two lists is
 * the difference between a quiet game and a stuck one — see this module's header.
 */
export function strandingRisks(
  links: readonly SoundLink[],
  fileOfGroup: (soundGroup: number) => string | null,
  missingFiles: readonly string[],
): StrandingReport {
  const missing = new Set(missingFiles.map((f) => f.toUpperCase()));
  const silent: string[] = [];

  for (const link of links) {
    const file = fileOfGroup(link.soundGroup);
    if (file === null || !missing.has(file.toUpperCase())) continue;
    if (!silent.includes(link.component)) silent.push(link.component);
  }

  return {
    silent,
    stranding: silent.filter((c) => TIMER_SOUND_COMPONENTS.includes(c)),
  };
}

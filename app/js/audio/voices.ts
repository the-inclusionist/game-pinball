// SPDX-License-Identifier: AGPL-3.0-or-later
// audio/voices — what an authored table sounds like, until somebody decides what it should sound like.
//
// ========================= PHASE 7 IS PORTED AND SILENT, FOR A REASON NO OTHER PHASE HAD =========================
// `audio/sfx` is a MIXER. It allocates channels, steals the oldest voice when they run out, places the
// sound in stereo, and returns the duration that two control functions use as a timer. What it does not
// do is make a noise: `output(voice)` belongs to the host, and there was no host.
//
// And an authored table cannot borrow the original's sounds. The ~60 WAV files are Microsoft's and are
// never distributed — `docs/LICENSES.md` § 3 is the hard rule of this repository. So the sound of an
// authored table has to be GENERATED, which makes it code rather than art, exactly as
// `gfx/table-view`'s eight colours are code rather than art.
//
// ========================= THESE TIMBRES ARE SCAFFOLDING, AND SAY SO =========================
// One voice per component kind, chosen so the table can be HEARD and judged before anybody decides what
// it ought to sound like. That is the same bargain `ROLE_COLORS` struck — "shapes first, art later, and
// on purpose" — and it is open in the same way: when a real voice arrives it replaces a number here and
// no table file changes.
//
// The map goes KIND -> NAME -> VOICE rather than kind -> voice. The indirection is what lets a table
// later name its own sound per component without any of this moving.
//
// ⚠️ A WALL IS DELIBERATELY SILENT. A ball resting against one collides many times a second; the
// original gives each wall a sound id from its own data and an authored table has none, so inventing
// one would turn every long bounce into a rattle. That is a decision, not an omission.
//
// ⚠️ AND NOTHING LASTS A SECOND. A pinball hits things several times a second, and a voice long enough
// to overlap itself turns the table into a drone — after which the mixer's channel stealing starts
// cutting the sounds that matter.

import type { ComponentKind } from '../i18n/names.js';
import type { SoundEntry } from './sfx.js';

/** One generated sound: a short tone that may slide from one pitch to another. */
export interface VoiceSpec {
  /** Hz at the start. */
  readonly frequency: number;
  /** Hz at the end. Equal to `frequency` for a steady tone. */
  readonly endFrequency: number;
  /** Seconds. Also what `sfx.play` returns, which the control layer uses as a timer. */
  readonly duration: number;
  readonly wave: 'sine' | 'square' | 'triangle' | 'sawtooth';
}

export const VOICES: Readonly<Record<string, VoiceSpec>> = {
  // Bright and upward: the sound of being thrown back.
  bumper: { frequency: 660, endFrequency: 990, duration: 0.07, wave: 'square' },
  // A struck thing, with body.
  target: { frequency: 392, endFrequency: 587, duration: 0.1, wave: 'triangle' },
  // A climb. The longest voice on the table, and still a quarter of a second.
  ramp: { frequency: 220, endFrequency: 660, duration: 0.25, wave: 'sine' },
  // A rollover is barely there. It says "counted", not "hit".
  lane: { frequency: 880, endFrequency: 880, duration: 0.05, wave: 'triangle' },
  // Falling in: down, and slower.
  well: { frequency: 440, endFrequency: 110, duration: 0.3, wave: 'sine' },
  // Being spat back out: the well's voice, backwards.
  kicker: { frequency: 110, endFrequency: 440, duration: 0.14, wave: 'square' },
  // A paddle is a click, not a note.
  flipper: { frequency: 180, endFrequency: 140, duration: 0.035, wave: 'square' },
  // Losing the ball. The only voice that goes below the others and stays there.
  drain: { frequency: 200, endFrequency: 70, duration: 0.5, wave: 'sawtooth' },
  // The plunger's release.
  plunger: { frequency: 150, endFrequency: 300, duration: 0.12, wave: 'sawtooth' },
};

/** Kind to voice name. A kind with no entry makes no sound, which a wall does on purpose. */
const NAME_OF_KIND: Readonly<Partial<Record<ComponentKind, string>>> = {
  bumper: 'bumper',
  target: 'target',
  flag: 'target',
  rebounder: 'bumper',
  ramp: 'ramp',
  oneway: 'lane',
  gate: 'lane',
  lane: 'lane',
  hole: 'well',
  well: 'well',
  kicker: 'kicker',
  flipper: 'flipper',
  drain: 'drain',
  plunger: 'plunger',
  blocker: 'target',
};

/**
 * The kinds that make no sound, NAMED rather than left as a gap in the map above. "It is not in the
 * table" and "it is meant to be quiet" look identical from outside, and only one of them is a decision
 * somebody can disagree with.
 */
export const SILENT_KINDS: readonly ComponentKind[] = ['wall', 'lamp'];

export function soundForKind(kind: ComponentKind): string | undefined {
  return NAME_OF_KIND[kind];
}

/**
 * The board's sound list, built from the same place the noise is.
 *
 * ⚠️ `sfx.play` RETURNS THE DURATION whether or not anything is audible, and the control layer schedules
 * on the answer. A board built from a different list than the one that makes the sound would time the
 * game against sounds that do not exist.
 */
export function soundEntriesOf(): SoundEntry[] {
  return Object.entries(VOICES).map(([name, voice]) => ({ name, duration: voice.duration }));
}

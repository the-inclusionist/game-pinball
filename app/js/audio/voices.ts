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

  /* ===================== THE ORIGINAL'S EFFECT ROLES ===================== */
  //
  // See `ORIGINAL_FX`. Pitched so the SHAPE of the event is audible without listening for a melody: a
  // reward rises, a failure falls, and the bigger the award the further it travels.

  // The plainest acknowledgement there is — a component that was struck and did its ordinary thing.
  hit: { frequency: 520, endFrequency: 660, duration: 0.06, wave: 'square' },
  // Down and short. A miss is the only voice here that ends lower than a hit begins.
  miss: { frequency: 300, endFrequency: 180, duration: 0.09, wave: 'triangle' },
  // A bank finished: two steps up, expressed as one long rise.
  complete: { frequency: 440, endFrequency: 880, duration: 0.22, wave: 'triangle' },
  // Taking what was won. Brighter than `complete` and shorter, because it follows it.
  collect: { frequency: 660, endFrequency: 1320, duration: 0.16, wave: 'square' },
  // A rank. The longest and highest voice in the bank, because it is the rarest event in the game.
  promotion: { frequency: 523, endFrequency: 1568, duration: 0.55, wave: 'triangle' },
  // More than one ball. Low and wide, so it does not compete with what the balls are doing.
  multiball: { frequency: 165, endFrequency: 494, duration: 0.4, wave: 'sawtooth' },
  // The end of a very good game.
  highScore: { frequency: 784, endFrequency: 1568, duration: 0.6, wave: 'sine' },
  // One step of the award chain. Deliberately small: it repeats.
  chain: { frequency: 587, endFrequency: 784, duration: 0.1, wave: 'square' },
  // ⚠️ AN EXTRA BALL, WHICH IS THE ONLY THING IN THE GAME THAT GIVES TIME BACK. Two octaves of square
  // wave, above `collect` and below `promotion`: bigger than any single award, smaller than a rank.
  extraBall: { frequency: 392, endFrequency: 1568, duration: 0.45, wave: 'square' },
  // The ball returning after a drain that did not count. Soft on purpose — it is a reprieve, not a win.
  shootAgain: { frequency: 330, endFrequency: 660, duration: 0.3, wave: 'sine' },
  // ⚠️ THE TANK FILLING, WHICH IS A ROLE AND NOT A MISS. `soundwave25` is played in exactly two places
  // in the original, and both of them fill the fuel tank to the top: the bonus lane's unlit branch and
  // the fuel spot set completing. Reading the first of those as a miss — which is what it looks like
  // in isolation, since the lamp was dark — gave it a falling tone for an event that is a reward.
  refuel: { frequency: 294, endFrequency: 587, duration: 0.2, wave: 'triangle' },
  // ⚠️ A SPOT TARGET STRUCK WITH NO MISSION RUNNING. `soundwave52` against `soundwave49D`: the
  // original gives the same three targets two different emitters and picks between them by asking
  // `lite198`. Flat and short, because it is an acknowledgement of something that led nowhere.
  noMission: { frequency: 349, endFrequency: 330, duration: 0.08, wave: 'triangle' },

  // The ramp pays four different ways, and the original branches on three lamps to decide which.
  reflexOnly: { frequency: 349, endFrequency: 523, duration: 0.18, wave: 'triangle' },
  rampAward: { frequency: 262, endFrequency: 784, duration: 0.3, wave: 'sine' },
  mission: { frequency: 392, endFrequency: 1046, duration: 0.45, wave: 'triangle' },
  plain: { frequency: 294, endFrequency: 392, duration: 0.12, wave: 'sine' },
};

/**
 * ⚠️ THE ORIGINAL'S EFFECTS, AS THE CODE ACTUALLY ASKS FOR THEM.
 *
 * The 48 sounds in `PINBALL.DAT` are called `sound1.wav`, `sound2.wav` and so on. The names carry no
 * meaning; the meaning is in which component plays which index, and chasing that through the archive
 * yields `soundwave3 -> sound#3` and no more — a `TSound` is a named emitter and nothing about it says
 * what it is FOR.
 *
 * The ported control layer, though, asks by ROLE at its own call sites: a hit, a miss, a bank
 * completed, an award collected, a promotion, a multiball, a high score, the four ways a ramp can pay,
 * the award chain, the drain. That is the original's effect vocabulary at the level the code uses, and
 * it is the level a substitute has to match. A test reads the control modules and fails if a role is
 * added without a voice, because an unknown name plays nothing and returns zero — silently.
 *
 * ⚠️ AND A ROLE CAN ALSO BE NAMED IN THE CALL ITSELF. `table_add_extra_ball` plays its sound with a
 * literal — `ctx.playSound('extraBall')` — so no `*Sound` field declares it and the option scan above
 * cannot see it. `extraBall` and `shootAgain` were asked for that way from the day they were written
 * and had never made a sound; a second scan, over the literals, is what found them.
 *
 * ⚠️ AND IT MEANS THE WAV FILES ARE NOT NEEDED AT RUN TIME AT ALL. `docs/LICENSES.md` § 3 keeps them out
 * of the repository; this keeps them out of the running game, which is a stronger claim and a better
 * one: the port can be played by somebody who does not own the original.
 */
export const ORIGINAL_FX: readonly string[] = [
  'hit', 'miss', 'complete', 'collect', 'promotion', 'multiball', 'highScore', 'chain',
  'reflexOnly', 'rampAward', 'mission', 'plain', 'drain', 'extraBall', 'shootAgain', 'refuel',
  'noMission',
];

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
 *
 * ⚠️ A TRIPWIRE IS SILENT FOR THE WALL'S REASON, NOT THE LAMP'S. The five `s_trip` components sense the
 * ball passing and stop nothing; the original gives each one a sound id from its own data, and this
 * port has no such data for an authored table. Guessing one would put a click in five places on the
 * playfield where the player can see no reason for it.
 */
export const SILENT_KINDS: readonly ComponentKind[] = ['wall', 'lamp', 'tripwire'];

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

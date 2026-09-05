// SPDX-License-Identifier: AGPL-3.0-or-later
// audio/sfx — the sound board. Ports of `Sound::PlaySound`, `loader::play_sound` and `TSound::Play`.
//
// ========================= A DURATION IS GAME LOGIC HERE, NOT PRESENTATION =========================
// `loader::play_sound` returns the sound's length, and two control functions USE that number as a
// TIMER: the gravity well holds the ball exactly as long as its noise lasts, and the hyperspace
// kickout does the same. The animation is not synchronized to the mechanism — it IS the mechanism's
// clock (see `control/wormhole` and `control/hyperspace`).
//
// ⚠️ WHICH IS WHY THE DURATION IS RETURNED EVEN WHEN THE SOUND DOES NOT PLAY. In the original the
// enabled flag is checked INSIDE `Sound::PlaySound`, while `play_sound` returns `Duration`
// unconditionally. So muting the game does not change how long a ball is held. Move that check one
// level up — the obvious "don't play, don't wait" simplification — and a silent game becomes a
// DIFFERENT game. There is a test whose only job is that.
//
// ========================= AND AN UNKNOWN SOUND IS ZERO, NOT A GUESS =========================
// `if (soundIndex <= 0) return 0.0;`. A sound the table does not have holds the ball for no time at
// all, which releases it immediately. That is the safe failure and it is the original's: a missing
// file makes the game quiet, never stuck.
//
// ========================= THE NEWEST SOUND WINS =========================
// With every channel busy the original halts the OLDEST — by timestamp — and plays the new sound on
// it. Not "drop the new one". In a pinball the newest sound is the one that just happened to the ball,
// and the one being cut off is already most of the way through.
//
// ========================= THE LISTENER SITS AT THE BOTTOM OF THE TABLE =========================
// Positional audio puts the player at `(0.5, 0, 0.5)` — bottom centre, half a table-length back — and
// a sound with no source at `(0.5, 1)`, the top centre. The angle is measured CLOCKWISE FROM NORTH,
// which is what SDL_mixer wants and is not the usual atan2 convention, so it is `atan2(x, y)` rather
// than `atan2(y, x)` and then wrapped into [0, 2pi).

/** What the table knows about one sound, whether or not its file has loaded. */
export interface SoundEntry {
  readonly name: string;
  /** Seconds. The number two control functions use as a timer. */
  readonly duration: number;
}

export interface SoundSource {
  /** Table coordinates normalized to [0, 1]; (0,0) is the bottom left. */
  readonly x: number;
  readonly y: number;
}

/** One playing voice, as the board tracks it. */
export interface Voice {
  readonly channel: number;
  readonly name: string;
  readonly startedAt: number;
  /** Degrees clockwise from north, as SDL_mixer wants. */
  readonly angle: number;
  /** 0 (near) to 255 (far). */
  readonly distance: number;
}

export interface SoundBoardOptions {
  readonly sounds: readonly SoundEntry[];
  /** How many sounds may play at once. */
  readonly channels: number;
  /** The clock the voice stealing compares against. */
  readonly now: () => number;
  /** Where a voice actually goes. Absent in a node test; Web Audio in the browser. */
  readonly output?: (voice: Voice) => void;
  readonly stop?: (channel: number) => void;
  /** Whether stereo placement is computed at all. `options::Options.SoundStereo`. */
  readonly stereo?: boolean;
}

export interface SoundBoard {
  /** Plays it and returns its DURATION — see this module's header for why that is not cosmetic. */
  play(name: string, source?: SoundSource): number;
  /** Silences output. Does NOT change what `play` returns. */
  enabled: boolean;
  readonly voices: readonly Voice[];
}

/** The listener: bottom centre of the table, half a table-length back. */
const LISTENER = { x: 0.5, y: 0, z: 0.5 } as const;
/** A sound with no source is assumed to come from the top centre. */
const UNPLACED = { x: 0.5, y: 1 } as const;

export interface Placement {
  readonly angle: number;
  readonly distance: number;
}

/**
 * Where a sound sits, as SDL_mixer is told it. The angle is clockwise from NORTH, which is why the
 * arguments to `atan2` are the other way round from the usual convention.
 */
export function placeSound(source: SoundSource | undefined): Placement {
  const at = source ?? UNPLACED;
  const dx = at.x - LISTENER.x;
  const dy = at.y - LISTENER.y;
  const dz = 0 - LISTENER.z;

  const radians = (Math.atan2(dx, dy) + Math.PI * 2) % (Math.PI * 2);
  const angle = Math.trunc((radians * 180) / Math.PI);
  // The listener's height counts: a sound at the listener's own spot is still half a table away.
  const distance = Math.min(255, Math.trunc(100 * Math.hypot(dx, dy, dz)));

  return { angle, distance };
}

export function createSoundBoard(o: SoundBoardOptions): SoundBoard {
  const durations = new Map(o.sounds.map((s) => [s.name, s.duration]));
  const voices: Voice[] = [];
  let enabled = true;

  const board: SoundBoard = {
    get enabled() { return enabled; },
    set enabled(value: boolean) { enabled = value; },
    get voices() { return voices; },

    play(name: string, source?: SoundSource): number {
      const duration = durations.get(name);
      // A sound the table does not have holds nothing for no time. The safe failure.
      if (duration === undefined) return 0;

      // ⚠️ The mute check is HERE, below the duration. See this module's header.
      if (enabled) {
        let channel: number;
        if (voices.length >= o.channels) {
          // Every channel busy: the OLDEST loses, and the newest sound takes its place.
          let oldest = 0;
          for (let i = 1; i < voices.length; i++) {
            if (voices[i]!.startedAt < voices[oldest]!.startedAt) oldest = i;
          }
          channel = voices[oldest]!.channel;
          o.stop?.(channel);
          voices.splice(oldest, 1);
        } else {
          const taken = new Set(voices.map((v) => v.channel));
          channel = 0;
          while (taken.has(channel)) channel++;
        }

        const placement = o.stereo === false
          ? { angle: 0, distance: 0 }
          : placeSound(source);

        const voice: Voice = { channel, name, startedAt: o.now(), ...placement };
        voices.push(voice);
        o.output?.(voice);
      }

      return duration;
    },
  };

  return board;
}

/** Frees a channel when its sound ends. The host calls this; nothing here polls. */
export function releaseVoice(board: SoundBoard, channel: number): void {
  const voices = board.voices as Voice[];
  const index = voices.findIndex((v) => v.channel === channel);
  if (index >= 0) voices.splice(index, 1);
}

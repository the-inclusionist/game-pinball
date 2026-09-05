// SPDX-License-Identifier: AGPL-3.0-or-later
// audio/sound-table — which sounds the table declares, and how long each one is. Ports of
// `loader::loadfrom`'s sound scan and `loader::load_sound`'s duration maths.
//
// ========================= THE SOUNDS ARE MARKED IN THE .DAT BY THE NUMBER 202 =========================
// `loadfrom` walks every group and keeps the ones whose 16-bit value field is 202. That is the whole
// registry: a group with a 202 is a sound, its String field is the WAV's file name, and its position in
// the scan is the sound index everything else refers to. There is no sound directory and no manifest.
//
// The cap is sixty-five, and it is a hard array bound in the original — group sixty-six of a modded
// table would be dropped in silence.
//
// ========================= THE DURATION COMES FROM THE WAV, NOT FROM THE .DAT =========================
// Nothing in the archive says how long a sound is. The loader opens the file, reads the header and
// computes it:
//
//     sampleCount = data_size / (channels * bits_per_sample / 8)
//     duration    = sampleCount / sample_rate
//
// And it reads that header as a FIXED STRUCT — one `fread` of `sizeof(WaveHeader)` — so it assumes the
// `data` chunk sits immediately after a sixteen-byte `fmt `. A WAV carrying a `LIST` or `fact` chunk
// would be misread, quietly, into a wrong duration. That is transcribed rather than fixed, and there is
// a conformance test that checks all sixty of the real files actually have that layout: if they do, the
// assumption is safe FOR THIS DATA, which is the only claim either implementation can make.
//
// ========================= ⚠️ AND A MISSING FILE IS NOT ZERO, IT IS MINUS ONE =========================
// `float duration = -1;` before the two attempts at the name, lower case then upper. If neither opens,
// `-1` is what gets stored and what `play_sound` later returns.
//
// Minus one is this game's "never" — the escape chute sink holds a ball with it, the disabled multiplier
// stops its clock with it, easy mode's blocker runs on it. So a sound file that fails to load does not
// merely make the game quiet: it hands `-1` to the gravity well's kickout timer, and THE BALL IS HELD
// FOREVER.
//
// This is the sharpest reason the sound table is loaded at all in a port that could have shipped silent.
// `audio/sfx` returns zero for a sound the table never declared, which is safe; this is the other case
// and it is not safe. `soundsWithMissingFiles` exists so a caller can refuse to start rather than
// discover it with a stuck ball.

import type { Group } from '../dat/partman.js';
import { EntryType } from '../dat/partman.js';

/** A group's 16-bit value field equal to this means the group is a sound. */
export const SOUND_MARKER = 202;

/** `soundListStruct loader::sound_list[65]`. A hard bound, and silently applied. */
export const MAX_SOUNDS = 65;

/** What `load_sound` stores when neither spelling of the file name opens. See this module's header. */
export const MISSING_FILE_DURATION = -1;

export interface SoundGroup {
  /** The index into the `.DAT`'s groups. */
  readonly groupIndex: number;
  /** The WAV's file name, as the archive spells it. */
  readonly fileName: string;
}

function value16Of(group: Group): number | null {
  for (const entry of group.entries) {
    if (entry.type === EntryType.Value16 && entry.value !== undefined) return entry.value;
  }
  return null;
}

function stringOf(group: Group): string | null {
  for (const entry of group.entries) {
    if (entry.type === EntryType.String && entry.data) {
      // The archive stores it NUL-terminated; everything after the first NUL is padding.
      const bytes = entry.data;
      let end = bytes.indexOf(0);
      if (end < 0) end = bytes.length;
      return new TextDecoder('latin1').decode(bytes.subarray(0, end));
    }
  }
  return null;
}

/** Every group the archive marks as a sound, in scan order, capped as the original caps it. */
export function findSoundGroups(groups: readonly Group[]): SoundGroup[] {
  const found: SoundGroup[] = [];
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    const group = groups[groupIndex]!;
    if (value16Of(group) !== SOUND_MARKER) continue;
    if (found.length >= MAX_SOUNDS) break;
    found.push({ groupIndex, fileName: stringOf(group) ?? '' });
  }
  return found;
}

export interface WaveHeader {
  readonly riff: string;
  readonly wave: string;
  readonly channels: number;
  readonly sampleRate: number;
  readonly bitsPerSample: number;
  readonly dataSize: number;
  /** Whether the `data` chunk really is where the fixed read assumes. */
  readonly canonical: boolean;
}

/**
 * The header at the offsets the original's struct assumes. Not a chunk walker — see this module's
 * header for why the difference is recorded rather than removed.
 */
export function readWaveHeader(bytes: Uint8Array): WaveHeader | null {
  if (bytes.length < 44) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));

  return {
    riff: tag(0),
    wave: tag(8),
    channels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true),
    bitsPerSample: view.getUint16(34, true),
    dataSize: view.getUint32(40, true),
    canonical: tag(0) === 'RIFF' && tag(8) === 'WAVE' && tag(12) === 'fmt '
      && view.getUint32(16, true) === 16 && tag(36) === 'data',
  };
}

/** `sampleCount / sample_rate`, with `sampleCount = data_size / (channels * bytes per sample)`. */
export function durationOf(header: WaveHeader): number {
  const bytesPerSample = header.channels * (header.bitsPerSample / 8);
  if (!bytesPerSample || !header.sampleRate) return MISSING_FILE_DURATION;
  return (header.dataSize / bytesPerSample) / header.sampleRate;
}

export interface LoadedSound {
  readonly name: string;
  readonly duration: number;
}

export interface SoundTableResult {
  readonly sounds: readonly LoadedSound[];
  /**
   * ⚠️ The names whose file did not open. Each one carries `-1`, which downstream means NEVER — see
   * this module's header. A caller that ignores this list is choosing to risk a stranded ball.
   */
  readonly missing: readonly string[];
}

/**
 * Builds the table the sound board is handed. `read` returns the file's bytes, or `null` when neither
 * spelling of the name opens — which is exactly the case the original turns into `-1`.
 */
export function buildSoundTable(
  groups: readonly Group[], read: (fileName: string) => Uint8Array | null,
): SoundTableResult {
  const sounds: LoadedSound[] = [];
  const missing: string[] = [];

  for (const group of findSoundGroups(groups)) {
    const bytes = read(group.fileName);
    const header = bytes ? readWaveHeader(bytes) : null;
    if (!header) {
      missing.push(group.fileName);
      sounds.push({ name: group.fileName, duration: MISSING_FILE_DURATION });
      continue;
    }
    sounds.push({ name: group.fileName, duration: durationOf(header) });
  }

  return { sounds, missing };
}

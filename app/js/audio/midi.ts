// SPDX-License-Identifier: AGPL-3.0-or-later
// audio/midi — reading a Standard MIDI File.
//
// ========================= THERE IS ONLY ONE MUSIC TRACK, AND THE OTHER FILE IS A FONT =========================
// The plan said this game has two MIDIs. It has one. `midi::music_init` says so in a comment:
//
//     // 3DPB has only one music track. PINBALL2.MID is a bitmap font, in the same format as PB_MSGFT.bin
//
// And the bytes agree: `PINBALL.MID` opens with `MThd`, while `PINBALL2.MID` opens with `02 00 0f 00`
// and contains no `MThd`, `RIFF` or `MIDS` anywhere. A file named `.MID` that is a font is exactly the
// kind of thing a port discovers by opening the file rather than by trusting the extension, and there
// is a test that keeps it discovered.
//
// ========================= WHICH ALSO REMOVES A WHOLE CONVERSION =========================
// `midi::MdsToMidi` exists because Full Tilt ships its music as RIFF/MIDS — the Windows MIDI Stream
// container — which SDL_mixer cannot play. Space Cadet does not: its one track is already a Standard
// MIDI File. `MdsToMidi` is therefore NOT ported, and this comment is the reason, so that the next
// reader does not go looking for it.
//
// ========================= THE TRAP IN EVERY MIDI PARSER IS RUNNING STATUS =========================
// A MIDI event may omit its status byte, meaning "same as the previous one". A parser that does not
// carry that state reads the first such event's data byte AS a status byte and loses sync — silently,
// for the rest of the track, exactly like a `.DAT` reader that mishandles a fixed-size field. It is the
// same failure mode as `dat/partman`'s type table and it gets the same treatment: transcribed
// deliberately, with a test whose fixture omits the status byte on purpose.
//
// Meta and system-exclusive events (`0xFF`, `0xF0`, `0xF7`) do NOT set running status, and a real file
// puts a meta event between notes often enough that getting that wrong breaks quickly.
//
// ========================= THE SYNTH IS NOT DECIDED HERE =========================
// This module turns bytes into events and stops. What makes a sound out of them — a SoundFont player,
// a hand-written oscillator, or nothing at all — is a dependency decision, and the plan already
// records it as a risk. Keeping the parser separate means the game can ship silent, or gain music
// later, without either choice reaching into the other.

export interface MidiHeader {
  /** 0 single track, 1 several played together, 2 several played in sequence. */
  readonly format: number;
  readonly trackCount: number;
  /** Ticks per quarter note when positive; SMPTE when negative. */
  readonly division: number;
}

export type MidiEvent =
  | { readonly kind: 'note'; readonly tick: number; readonly on: boolean; readonly channel: number;
      readonly note: number; readonly velocity: number }
  | { readonly kind: 'control'; readonly tick: number; readonly channel: number;
      readonly status: number; readonly data: readonly number[] }
  | { readonly kind: 'tempo'; readonly tick: number; readonly microsecondsPerQuarter: number }
  | { readonly kind: 'meta'; readonly tick: number; readonly type: number; readonly data: Uint8Array }
  | { readonly kind: 'sysex'; readonly tick: number; readonly data: Uint8Array };

export interface MidiFile {
  readonly header: MidiHeader;
  readonly tracks: readonly (readonly MidiEvent[])[];
}

const META = 0xff;
const SYSEX = 0xf0;
const SYSEX_END = 0xf7;
const META_TEMPO = 0x51;
const META_END_OF_TRACK = 0x2f;

/** How many data bytes a channel message carries. Program change and channel pressure carry one. */
function dataLengthOf(status: number): number {
  const high = status & 0xf0;
  return high === 0xc0 || high === 0xd0 ? 1 : 2;
}

class Cursor {
  constructor(readonly bytes: Uint8Array, public at = 0) {}

  u8(): number { return this.bytes[this.at++] ?? 0; }

  u16(): number { return (this.u8() << 8) | this.u8(); }

  u32(): number { return ((this.u16() << 16) >>> 0) + this.u16(); }

  tag(): string {
    const text = String.fromCharCode(...this.bytes.subarray(this.at, this.at + 4));
    this.at += 4;
    return text;
  }

  /** A variable-length quantity: seven bits per byte, high bit means "another follows". */
  vlq(): number {
    let value = 0;
    for (let i = 0; i < 4; i++) {
      const byte = this.u8();
      value = (value << 7) | (byte & 0x7f);
      if ((byte & 0x80) === 0) break;
    }
    return value;
  }
}

/** Is this a Standard MIDI File at all? Cheap enough to ask before anything else. */
export function isStandardMidi(bytes: Uint8Array): boolean {
  return bytes.length >= 14 && String.fromCharCode(...bytes.subarray(0, 4)) === 'MThd';
}

function readTrack(cursor: Cursor, length: number): MidiEvent[] {
  const end = cursor.at + length;
  const events: MidiEvent[] = [];
  let tick = 0;
  // ⚠️ Running status. See this module's header.
  let status = 0;

  while (cursor.at < end) {
    tick += cursor.vlq();
    let byte = cursor.u8();

    if (byte < 0x80) {
      // No status byte: reuse the last one, and put this byte back as data.
      cursor.at--;
      byte = status;
    } else if (byte < META && byte !== SYSEX && byte !== SYSEX_END) {
      status = byte;
    }

    if (byte === META) {
      const type = cursor.u8();
      const size = cursor.vlq();
      const data = cursor.bytes.subarray(cursor.at, cursor.at + size);
      cursor.at += size;
      if (type === META_TEMPO && size === 3) {
        events.push({
          kind: 'tempo', tick,
          microsecondsPerQuarter: (data[0]! << 16) | (data[1]! << 8) | data[2]!,
        });
      } else {
        events.push({ kind: 'meta', tick, type, data });
      }
      if (type === META_END_OF_TRACK) break;
      continue;
    }

    if (byte === SYSEX || byte === SYSEX_END) {
      const size = cursor.vlq();
      events.push({ kind: 'sysex', tick, data: cursor.bytes.subarray(cursor.at, cursor.at + size) });
      cursor.at += size;
      continue;
    }

    const channel = byte & 0x0f;
    const high = byte & 0xf0;
    const data: number[] = [];
    for (let i = 0; i < dataLengthOf(byte); i++) data.push(cursor.u8());

    if (high === 0x90 || high === 0x80) {
      const velocity = data[1] ?? 0;
      // A note-on with velocity zero IS a note-off. Every MIDI file relies on it.
      events.push({
        kind: 'note', tick, on: high === 0x90 && velocity > 0,
        channel, note: data[0] ?? 0, velocity,
      });
    } else {
      events.push({ kind: 'control', tick, channel, status: high, data });
    }
  }

  cursor.at = end;
  return events;
}

/** Reads a Standard MIDI File. Returns `null` for anything that is not one — such as a font. */
export function readMidiFile(bytes: Uint8Array): MidiFile | null {
  if (!isStandardMidi(bytes)) return null;

  const cursor = new Cursor(bytes);
  cursor.tag();
  const headerSize = cursor.u32();
  const format = cursor.u16();
  const trackCount = cursor.u16();
  const division = cursor.u16();
  // The header is allowed to be longer than six bytes; the extra is skipped, as the spec says.
  cursor.at = 8 + headerSize;

  const tracks: MidiEvent[][] = [];
  while (cursor.at + 8 <= bytes.length && tracks.length < trackCount) {
    const tag = cursor.tag();
    const length = cursor.u32();
    if (tag !== 'MTrk') {
      // An unknown chunk is skipped rather than fatal, which is what the spec asks for.
      cursor.at += length;
      continue;
    }
    tracks.push(readTrack(cursor, length));
  }

  return { header: { format, trackCount, division }, tracks };
}

/** The first tempo in the file, or the MIDI default of 120 bpm when nothing says otherwise. */
export function tempoOf(file: MidiFile): number {
  for (const track of file.tracks) {
    for (const event of track) {
      if (event.kind === 'tempo') return event.microsecondsPerQuarter;
    }
  }
  return 500000;
}

/** How long the file lasts, in seconds, at its first tempo. */
export function durationOf(file: MidiFile): number {
  const division = file.header.division;
  if (division <= 0) return 0;
  const lastTick = Math.max(0, ...file.tracks.map((t) => t.at(-1)?.tick ?? 0));
  return (lastTick / division) * (tempoOf(file) / 1e6);
}

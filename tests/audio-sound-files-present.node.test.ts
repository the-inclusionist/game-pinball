// SPDX-License-Identifier: AGPL-3.0-or-later
// WHICH OF THE TABLE'S NOISES THIS MACHINE CAN ACTUALLY MAKE.
//
// The archive names the WAV it wants for every noise and holds none of the bytes; the player hands the
// files over through the picker. So "does the sound work" has two halves — the port asking for the
// right names, which `audio/sound-table` covers, and the files being THERE, which nothing had measured.
//
// ⚠️ AND ONE MISSING FILE CAN HOLD A BALL FOR EVER. Seven components use a sound's own duration as a
// kickout timer; a file that is not there reports a duration of -1, which `TTimer` reads as "never", and
// the hole keeps the ball for the rest of the game. `demo.soundReport` exists to say which kind of
// silence a player has bought, and this is the gate that it is the harmless kind.
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createDemo } from '../app/js/shell/demo.js';
import { readGroups } from '../app/js/dat/partman.js';
import { findSoundLinks, TIMER_SOUND_COMPONENTS } from '../app/js/audio/sound-links.js';
import { RESOURCES } from './helpers/original-data.js';

const DIR = RESOURCES;
const DAT = `${DIR}/PINBALL.DAT`;

/**
 * The length of a WAV, from its header. `AudioContext.decodeAudioData` is the port's own reader and it
 * is a browser API; this walks the chunks itself because the question — how long does this hold the
 * ball — has to be answerable without one.
 */
function wavSeconds(bytes: Buffer): number | null {
  if (bytes.length < 44 || bytes.toString('latin1', 0, 4) !== 'RIFF') return null;
  let at = 12;
  let rate = 0;
  let channels = 0;
  let bits = 0;
  let dataLength = 0;
  while (at + 8 <= bytes.length) {
    const id = bytes.toString('latin1', at, at + 4);
    const size = bytes.readUInt32LE(at + 4);
    if (id === 'fmt ') {
      channels = bytes.readUInt16LE(at + 10);
      rate = bytes.readUInt32LE(at + 12);
      bits = bytes.readUInt16LE(at + 22);
    }
    if (id === 'data') dataLength = size;
    // Chunks are padded to an even length, and a reader that forgets that walks off the end.
    at += 8 + size + (size % 2);
  }
  if (!rate || !channels || !bits) return null;
  return dataLength / (rate * channels * (bits / 8));
}

const demoOf = () => {
  if (!existsSync(DAT)) return null;
  const file = readFileSync(DAT);
  return createDemo(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), {
    textFor: (id) => id,
  });
};

describe('the sound files the 1995 table asks for', () => {
  test('⚠️ it asks for 47 of them, and six are not in the extracted set', () => {
    // Measured rather than assumed, and the number is here so a change to the extractor says so.
    // `npm run data:extract` takes its files from the alula package, which carries sixty WAVs; the
    // archive names forty-seven and six of those names are not among them — `sound2`, `sound37`,
    // `sound44`, `sound52`, `sound59`, `sound62`. Nineteen of the sixty are never asked for at all.
    //
    // That is not a defect in this port: a player with their own copy of the game has their own files,
    // and the port asks for what the archive names. It is worth knowing because it decides what a
    // player who extracted from the web build will and will not hear.
    const demo = demoOf();
    if (!demo) return expect(existsSync(DAT)).toBe(false);
    const onDisk = new Set(readdirSync(DIR).map((name) => name.toUpperCase()));

    const declared = [...demo.soundFiles.values()];
    const missing = declared.filter((name) => !onDisk.has(name.toUpperCase()));

    expect(declared).toHaveLength(47);
    expect(new Set(declared).size, 'each file asked for once').toBe(47);
    expect(missing.map((n) => n.toLowerCase()).sort()).toEqual(
      ['sound2.wav', 'sound37.wav', 'sound44.wav', 'sound52.wav', 'sound59.wav', 'sound62.wav'].sort(),
    );
  });

  test('⚠️ AND NOT ONE OF THE MISSING ONES CAN STRAND A BALL', () => {
    // The half that matters. `strandingRisks` walks the components that use a sound's duration as a
    // timer — the seven kickouts and sinks — and reports any whose sound the player did not hand over.
    // A hole waiting on a sound that will never play keeps the ball for the rest of the game, with no
    // error anywhere: the ball simply stops being in the game.
    //
    // With everything this machine has, the list is empty. If it ever is not, the demonstration warns
    // the player in `shell/demo-page` — and this fails first.
    const demo = demoOf();
    if (!demo) return expect(existsSync(DAT)).toBe(false);

    const report = demo.soundReport(readdirSync(DIR));

    expect(report.stranding, 'no hole waits on a sound that will never come').toEqual([]);
    // Four of the six missing files belong to components that merely stay quiet, and the report names
    // them so a player can tell "silent" from "stuck".
    expect(report.silent).toContain('soundwave37');
    expect(report.silent.length, 'named, not counted').toBeGreaterThan(0);
  });

  test('⚠️ AND THE SEVEN HOLDS ARE ALL BETWEEN A SECOND AND THREE', () => {
    // The seven timer components hold the ball for as long as their sound lasts, so the DURATION of
    // those seven files is a gameplay number and not an audio one. Read from the WAV headers rather
    // than from anything the port computes: `soundwave7` 2.39 s, `soundwave41` 0.93, `soundwave36`
    // 3.06, `soundwave50` 1.08, `soundwave35` 1.76, `soundwave38` 1.17, `soundwave39` 2.55.
    //
    // ⚠️ A LONG FILE HERE IS A HOLE THAT KEEPS THE BALL, and it would look like sluggish play rather
    // than like a defect. The bound is generous — a tenth of a second to six, against a set whose
    // longest sound of any kind is 5.02 — and its job is to catch an order of magnitude, not to pin a
    // number the archive chose.
    //
    // ⚠️ AND `soundwave41` IS `SOUND29.WAV`. The group's name and its file's name do not match, which
    // is why the port reads the name out of the group's String field instead of deriving it.
    const demo = demoOf();
    if (!demo) return expect(existsSync(DAT)).toBe(false);
    const groups = readGroups(new Uint8Array(readFileSync(DAT)));
    const onDisk = new Map(readdirSync(DIR).map((name) => [name.toUpperCase(), name]));

    const fileOf = new Map<string, string>();
    for (const link of findSoundLinks(groups)) {
      const file = demo.soundFiles.get(link.soundGroup);
      if (file) fileOf.set(link.component, file);
    }

    for (const component of TIMER_SOUND_COMPONENTS) {
      const wanted = fileOf.get(component);
      expect(wanted, `${component} names a file`).toBeTruthy();
      const real = onDisk.get(wanted!.toUpperCase());
      expect(real, `${component} wants ${wanted}, which is present`).toBeTruthy();

      const seconds = wavSeconds(readFileSync(`${DIR}/${real}`));
      expect(seconds, `${real} parses as a WAV`).not.toBeNull();
      expect(seconds!, `${component} holds the ball for a sensible time`).toBeGreaterThan(0.1);
      expect(seconds!).toBeLessThan(6);
    }
  });

  test('and every file it asks for is a name a filesystem can hold', () => {
    // The picker matches by name, case-insensitively. A declared name with a path separator or a
    // wildcard in it would never match anything a player could hand over, and the archive is old
    // enough that this is worth asking rather than assuming.
    const demo = demoOf();
    if (!demo) return expect(existsSync(DAT)).toBe(false);

    for (const name of demo.soundFiles.values()) {
      expect(name, `${name} is a plain file name`).toMatch(/^[A-Za-z0-9_.-]+\.wav$/i);
    }
  });
});

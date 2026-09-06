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

const DIR = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources';
const DAT = `${DIR}/PINBALL.DAT`;

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

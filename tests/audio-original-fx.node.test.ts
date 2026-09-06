// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VOICES, ORIGINAL_FX, soundEntriesOf } from '../app/js/audio/voices.js';
import { createSoundBoard } from '../app/js/audio/sfx.js';

const CONTROL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../app/js/control');

/**
 * ⚠️ A PROCEDURAL SUBSTITUTE FOR EVERY EFFECT THE ORIGINAL ASKS FOR.
 *
 * The 48 sounds in `PINBALL.DAT` are called `sound1.wav`, `sound2.wav`, and so on: the names carry no
 * meaning at all, and the meaning lives in which component plays which index. Chasing that mapping
 * through the archive gives `soundwave3 -> sound#3` and no more — a `TSound` is a named emitter and
 * nothing about it says what it is FOR.
 *
 * But the ported control layer asks for its sounds BY ROLE, in its own call sites: `hitSound`,
 * `missSound`, `completeSound`, `collectSound`, `promotionSound`, `multiballSound`, `highScoreSound`,
 * the ramp's four, the chain, the drain. That is the original's effect vocabulary expressed at the level
 * the code actually uses, and it is the level a substitute has to match.
 *
 * ⚠️ AND IT MEANS THE WAV FILES ARE NOT NEEDED FOR SOUND AT ALL. `docs/LICENSES.md` § 3 keeps them out
 * of the repository; this keeps them out of the RUNTIME, which is a different and stronger thing.
 */

describe('every role the control layer can ask for has a voice', () => {
  test.each(ORIGINAL_FX.map((name) => [name] as const))('%s', (name) => {
    expect(VOICES[name], name).toBeDefined();
  });

  test('and the mixer knows all of them, so `play` returns a real duration', () => {
    // `sfx.play` answers 0 for a sound the board does not have, and two control functions schedule on
    // that answer. A role with no entry would time the game against a sound of zero length.
    const board = createSoundBoard({ sounds: soundEntriesOf(), channels: 8, now: () => 0 });

    for (const name of ORIGINAL_FX) expect(board.play(name), name).toBeGreaterThan(0);
  });
});

describe('⚠️ and the list is checked against the control layer itself', () => {
  test('every `*Sound` option a control module declares is in ORIGINAL_FX', () => {
    // The roles are OPTIONS passed in by whoever wires the table, not literals, so nothing at run time
    // can enumerate them. Reading the source is the only way to notice that somebody added a role and
    // left it without a voice — which would be silent, because an unknown name plays nothing and
    // returns zero.
    const declared = new Set<string>();
    for (const file of readdirSync(CONTROL_DIR)) {
      if (!file.endsWith('.ts')) continue;
      const source = readFileSync(resolve(CONTROL_DIR, file), 'utf8');
      for (const match of source.matchAll(/readonly (\w*[Ss]ound)\??:/g)) {
        const role = match[1]!;
        // ⚠️ A FIELD BEGINNING WITH `play` IS A CALLBACK, NOT A ROLE. `playSound`, `playCompleteSound`
        // and `playPromotionSound` are functions the caller supplies to make a noise; `hitSound` and
        // the rest are the NAME of the noise to make. My first version listed the two exceptions it had
        // met by name and missed the third, which is what naming exceptions instead of stating the rule
        // always costs.
        if (role.startsWith('play')) continue;
        declared.add(role === 'sound' ? 'hit' : role.replace(/Sound$/, ''));
      }
    }

    expect([...declared].filter((role) => !ORIGINAL_FX.includes(role))).toEqual([]);
  });

  test('⚠️ every LITERAL name passed to `playSound` is a voice too', () => {
    // The option scan above cannot see these: `ctx.playSound('extraBall')` names its sound in the call
    // itself, so no `*Sound` field ever declares it. Both forms end at the same mixer, and both are
    // silent when the name is unknown — `sfx.play` answers zero and nothing reports it. This scan found
    // two roles that had been asked for since they were written and had never made a sound.
    const literals = new Set<string>();
    for (const file of readdirSync(CONTROL_DIR)) {
      if (!file.endsWith('.ts')) continue;
      const source = readFileSync(resolve(CONTROL_DIR, file), 'utf8');
      for (const match of source.matchAll(/playSound\('([^']+)'\)/g)) literals.add(match[1]!);
    }

    expect([...literals].filter((role) => !ORIGINAL_FX.includes(role))).toEqual([]);
  });

  test('⚠️ and the roles asked for by NAME today are exactly these five', () => {
    // An inventory, like `wired.size` in the dispatcher. Every other role is supplied as an option by
    // whoever wires the table, and that wiring does not exist yet — so this list is the honest measure
    // of how much of the effect bank a player can currently hear. It grows as the controls are wired,
    // and it should be updated deliberately rather than relaxed.
    const literals = new Set<string>();
    for (const file of readdirSync(CONTROL_DIR)) {
      if (!file.endsWith('.ts')) continue;
      const source = readFileSync(resolve(CONTROL_DIR, file), 'utf8');
      for (const match of source.matchAll(/playSound\('([^']+)'\)/g)) literals.add(match[1]!);
    }

    // Three until `table_bump_ball_sink_lock` was written. It names both of its own sounds: `ballLocked`
    // for each of the first two balls put away, and `multiball` for the third — the one place in the
    // game where multiball is asked for by something a player did rather than handed in as an option.
    expect([...literals].sort())
      .toEqual(['ballLocked', 'drain', 'extraBall', 'multiball', 'shootAgain']);
  });
});

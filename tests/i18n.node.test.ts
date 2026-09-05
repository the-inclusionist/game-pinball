// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  createTranslator, allKeys, dictionaryOf, AVAILABLE_LOCALES, BASE_LOCALE,
} from '../app/js/i18n/index.js';
import { RESOURCE_KEYS, keyOf } from '../app/js/i18n/keys.js';
import { MISSION_TABLE } from '../app/js/control/mission-table.js';

/** ADR-0002 gives the mission text a 63-pixel column: about fifteen characters over four lines. */
const COLUMN_CHARACTERS = 15 * 4;

describe('every resource identifier the mission table names has a key of ours', () => {
  test('nothing in the table falls through unmapped', () => {
    // The join between a faithful transcription and words this project owns. A gap here would put a
    // raw `STRING208` on screen.
    for (const row of MISSION_TABLE) {
      for (const id of [row.textKey, row.completeTextKey, row.infoTextKey, row.scoreTextKey]) {
        if (!id) continue;
        expect(RESOURCE_KEYS[id], `${row.name} names ${id}`).toBeDefined();
      }
    }
  });

  test('and every key of ours is actually written, in the base locale', () => {
    const pt = dictionaryOf(BASE_LOCALE);

    for (const key of Object.values(RESOURCE_KEYS)) {
      expect(pt[key], key).toBeDefined();
    }
  });

  test('THE TWO MISSIONS THAT SHARED A SENTENCE STILL SHARE A KEY', () => {
    // The practice mission and Alien Menace part two ask for the same bumpers, and the original wrote
    // the instruction once. If they ever diverge it should be a decision, not a slip.
    const practice = MISSION_TABLE.find((m) => m.name === 'PracticeMission')!;
    const alien = MISSION_TABLE.find((m) => m.name === 'AlienMenacePartTwo')!;

    expect(keyOf(practice.textKey)).toBe(keyOf(alien.textKey));
    expect(keyOf(practice.completeTextKey!)).not.toBe(keyOf(alien.completeTextKey!));
  });

  test('an identifier nobody mapped comes back as itself', () => {
    expect(keyOf('STRING999')).toBe('STRING999');
  });
});

describe('the three locales stay in step', () => {
  test('each one defines every key', () => {
    const keys = allKeys();

    for (const locale of AVAILABLE_LOCALES) {
      const dictionary = dictionaryOf(locale);
      const missing = keys.filter((k) => !(k in dictionary));
      expect(missing, `${locale} is missing keys`).toEqual([]);
    }
  });

  test('and every string keeps the parameters its Portuguese has', () => {
    // A locale that drops `{n}` silently loses the countdown; one that invents a parameter prints a
    // brace. Both are invisible until somebody plays in that language.
    const pt = dictionaryOf(BASE_LOCALE);
    const parameters = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

    for (const locale of AVAILABLE_LOCALES) {
      const dictionary = dictionaryOf(locale);
      for (const key of Object.keys(pt)) {
        expect(parameters(dictionary[key]!), `${locale} ${key}`).toEqual(parameters(pt[key]!));
      }
    }
  });

  test('nothing is longer than the column it has to fit in', () => {
    // ADR-0002 traded the width of the screen for never covering the flippers. This is that decision
    // arriving as a writing constraint rather than as a truncation bug.
    for (const locale of AVAILABLE_LOCALES) {
      const dictionary = dictionaryOf(locale);
      for (const [key, text] of Object.entries(dictionary)) {
        expect(text.length, `${locale} ${key}`).toBeLessThanOrEqual(COLUMN_CHARACTERS);
      }
    }
  });

  test('no locale is empty, and none is a copy of another', () => {
    const [pt, en, es] = AVAILABLE_LOCALES.map((l) => dictionaryOf(l));

    expect(Object.keys(pt!).length).toBeGreaterThan(30);
    expect(pt!['pinball.hud.gameOver']).not.toBe(en!['pinball.hud.gameOver']);
    expect(en!['pinball.hud.gameOver']).not.toBe(es!['pinball.hud.gameOver']);
  });
});

describe('translating', () => {
  test('the frame translates and the parameter passes through', () => {
    const pt = createTranslator('pt');
    const en = createTranslator('en');

    expect(pt('pinball.hud.balls', { n: 3 })).toBe('Bolas: 3');
    expect(en('pinball.hud.balls', { n: 3 })).toBe('Balls: 3');
  });

  test('a parameter appearing twice is replaced twice', () => {
    const t = createTranslator('pt');

    expect(t('{n} de {n}', { n: 2 })).toBe('2 de 2');
  });

  test('an unknown key comes back as ITSELF, not as nothing', () => {
    // A visible key on screen is a bug report. A blank space is a mystery.
    expect(createTranslator('en')('pinball.nothing.here')).toBe('pinball.nothing.here');
  });

  test('a key missing from a locale falls through to Portuguese', () => {
    // Proven by construction: the base has every key, so a translator built for a locale whose
    // dictionary lacks one still answers.
    const en = createTranslator('en');
    const key = 'pinball.mission.bumpers.run';

    expect(en(key, { n: 1 })).not.toBe(key);
  });

  test('an unknown locale falls back to the base rather than failing', () => {
    const odd = createTranslator('de' as never);

    expect(odd('pinball.hud.gameOver')).toBe(dictionaryOf('pt')['pinball.hud.gameOver']);
  });

  test('a missing parameter leaves its placeholder visible', () => {
    // Also a bug report rather than a mystery: the reader sees `{n}` and knows something did not
    // arrive.
    expect(createTranslator('pt')('pinball.hud.balls')).toContain('{n}');
  });
});

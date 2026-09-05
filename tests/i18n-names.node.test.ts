// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { kindOf, createNamer, nameTableOf, KIND_PREFIXES, type ComponentKind } from '../app/js/i18n/names.js';
import { AVAILABLE_LOCALES } from '../app/js/i18n/index.js';
import { SCORE_COMPONENTS } from '../app/js/control/score-table.js';
import { SIMPLE_COMPONENTS } from '../app/js/control/simple-components.js';

describe('a component is named by WHAT IT IS', () => {
  test('every bumper is a bumper, whatever its number', () => {
    // 88 scoring components and 145 more in the address book. Naming each would be 233 strings saying
    // "bumper" thirty times.
    expect(kindOf('bump1')).toBe('bumper');
    expect(kindOf('bump7')).toBe('bumper');
    expect(kindOf('target22')).toBe('target');
    expect(kindOf('sink3')).toBe('well');
  });

  test('literoll179 is a LAMP, not a lane', () => {
    // It contains the word roll, and it is still a lamp because `startsWith` reads from the
    // beginning. Worth pinning even though nothing clever protects it: if the matcher ever became a
    // search rather than a prefix, this is the name that would go wrong first.
    expect(kindOf('literoll179')).toBe('lamp');
    expect(kindOf('roll179')).toBe('lane');
    expect(kindOf('lite198')).toBe('lamp');
  });

  test('NO PREFIX IS A PREFIX OF ANOTHER, which is what makes the order free', () => {
    // The property the table actually rests on, asserted instead of asked for in a comment. Adding
    // `flip` beside an existing `f` would break it, and this fails the moment someone does.
    for (const a of KIND_PREFIXES) {
      for (const b of KIND_PREFIXES) {
        if (a === b) continue;
        expect(a.startsWith(b), `"${a}" starts with "${b}"`).toBe(false);
      }
    }
  });

  test('and no prefix is empty, which would claim everything', () => {
    expect(KIND_PREFIXES.every((p) => p.length > 0)).toBe(true);
  });

  test('a name nothing claims is null, which is a legitimate answer', () => {
    expect(kindOf('table')).toBeNull();
    expect(kindOf('')).toBeNull();
  });

  test('most of the real table gets a name', () => {
    // Not all of it: the address book holds sounds and text boxes, which are not places on the table
    // and have nothing to announce. What matters is that the PHYSICAL components are covered.
    const physical = SCORE_COMPONENTS.map((c) => c.name)
      .filter((name) => !name.startsWith('lite') && !name.startsWith('sound'));
    const unnamed = physical.filter((name) => kindOf(name) === null);

    expect(unnamed.length / physical.length).toBeLessThan(0.2);
  });

  test('every lamp in the address book is recognized as a lamp', () => {
    const lamps = SIMPLE_COMPONENTS.filter((name) => name.startsWith('lite'));

    expect(lamps.length).toBeGreaterThan(90);
    expect(lamps.every((name) => kindOf(name) === 'lamp')).toBe(true);
  });

  test('and no sound is mistaken for a place on the table', () => {
    const sounds = SIMPLE_COMPONENTS.filter((name) => name.startsWith('soundwave'));

    expect(sounds.every((name) => kindOf(name) === null)).toBe(true);
  });
});

describe('GENDER, because in Portuguese the frame agrees with the content', () => {
  test('the flipper is feminine and the drain is masculine in pt', () => {
    // "a pá está à frente" against "o ralo está à frente" — one engine sentence, one parameter, and
    // without the gender one of the two comes out wrong.
    const table = nameTableOf('pt');

    expect(table.flipper).toEqual({ text: 'pá', gender: 'f', plural: false });
    expect(table.drain.gender).toBe('m');
  });

  test('English is neutral throughout, which is a fact about the language', () => {
    const table = nameTableOf('en');

    expect(Object.values(table).every((s) => s.gender === 'n')).toBe(true);
  });

  test('Spanish carries its own genders, which are NOT Portuguese’s', () => {
    // `puerta` is feminine where `portão` is masculine. Copying one table into the other would have
    // been invisible and wrong.
    expect(nameTableOf('es').gate.gender).toBe('f');
    expect(nameTableOf('pt').gate.gender).toBe('m');
  });

  test('every locale names every kind', () => {
    const kinds = Object.keys(nameTableOf('pt')) as ComponentKind[];

    for (const locale of AVAILABLE_LOCALES) {
      const table = nameTableOf(locale);
      for (const kind of kinds) {
        expect(table[kind]?.text, `${locale} ${kind}`).toBeTruthy();
      }
    }
  });

  test('and no two kinds share a word inside one locale', () => {
    // A table where "lane" and "ramp" were both called `rampa` would announce the wrong thing and
    // nothing would ever say so.
    for (const locale of AVAILABLE_LOCALES) {
      const words = Object.values(nameTableOf(locale)).map((s) => s.text);
      expect(new Set(words).size, locale).toBe(words.length);
    }
  });
});

describe('the namer, which is what the declaration is handed', () => {
  test('it answers with the speakable for the kind', () => {
    const speak = createNamer('pt');

    expect(speak('bump3')?.text).toBe('para-choque');
    expect(speak('flip1')?.gender).toBe('f');
  });

  test('it answers null for something with no name', () => {
    expect(createNamer('en')('soundwave9')).toBeNull();
  });

  test('an unknown locale still names things, in the base language', () => {
    expect(createNamer('de' as never)('flip1')?.text).toBe('pá');
  });
});

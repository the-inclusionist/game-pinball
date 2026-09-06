// SPDX-License-Identifier: AGPL-3.0-or-later
// AN ENGLISH COMPONENT NAME LEFT SITTING IN A TRANSLATED DICTIONARY.
//
// `es` said "Los bumpers del centro valen más" in two strings while saying `topes` in three others
// and `tope` in `i18n/names`. Three words for one part, one of them not Spanish. Nothing failed: the
// key was present, the `{parameters}` matched, the line fitted the column, and no marker list for
// European Portuguese has any opinion about English.
//
// The words come from `i18n/names`'s ENGLISH table rather than a list written here, so a component
// kind added to that table extends this gate without anybody remembering to.
//
// ⚠️ WHAT THIS CANNOT DO IS CHECK THAT THE RIGHT WORD WAS USED. `pt` called the low-orbit bumpers
// `amortecedores`, which is the word `i18n/names` gives the REBOUNDER — the sonar speaks
// "para-choque" over the same part the mission line called something else. That is not an English
// word and this test is blind to it. The obvious rule that would catch it — a key naming a kind must
// use that kind's word — is false in this dictionary: `pinball.mission.lowOrbit.bumpers2` reads
// "Agora suba a rampa", because the key names the objective group and the text names the next target.
// So that one was found by reading, and stays found by reading.
import { describe, test, expect } from 'vitest';
import { dictionaryOf, AVAILABLE_LOCALES } from '../app/js/i18n/index.js';
import { nameTableOf, COMPONENT_KINDS } from '../app/js/i18n/names.js';

/** The English name of every component kind, singular, as `i18n/names` gives it. */
const ENGLISH_WORDS: readonly string[] = COMPONENT_KINDS.map((kind) => nameTableOf('en')[kind].text);

/**
 * Whole tokens, never substrings: `ramp` must not fire on the Portuguese and Spanish `rampa`, which
 * is what a substring search would do to a third of this list.
 *
 * ⚠️ THE SPLIT KEEPS ACCENTED LETTERS AND THE HYPHEN. Tokenizing on `[^a-z]` would cut `más` into
 * `m` and `s` and `one-way` into two, and fragments are how a whole-token rule quietly becomes a
 * substring one again.
 */
function englishWordsIn(text: string): string[] {
  const tokens = new Set(text.toLowerCase().split(/[^a-zà-öø-ÿ-]+/));
  return ENGLISH_WORDS.filter((word) => tokens.has(word) || tokens.has(`${word}s`));
}

describe('the translated locales carry no English component name', () => {
  test('⚠️ the search can see one, and does not fire on a word that merely starts the same way', () => {
    // Without this the gate is green for ever with no subject — and it earned its place the first
    // time it ran: the boundary expression it replaced was `\b` inside a template literal, which is
    // the BACKSPACE character and not a word boundary, so the search found nothing anywhere.
    expect(englishWordsIn('Los bumpers del centro valen más.')).toEqual(['bumper']);
    expect(englishWordsIn('Maelstrom: suba a rampa.')).toEqual([]);
  });

  test('and no string in pt or es contains one', () => {
    const offenders = AVAILABLE_LOCALES
      .filter((locale) => locale !== 'en')
      .flatMap((locale) => Object.entries(dictionaryOf(locale))
        .flatMap(([key, text]) => englishWordsIn(text).map((w) => `${locale} ${key} — "${w}" in ${text}`)));

    expect(offenders).toEqual([]);
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
// THE BASE LOCALE DRIFTING INTO EUROPEAN PORTUGUESE.
//
// `i18n/pt` is pt-BR — it is the language the game ships in, and it is also the dictionary the other
// two fall back to, so a European word here is read by every player whose locale is missing a key.
//
// The three gates that already exist compare the dictionaries WITH EACH OTHER: same keys
// (`i18n-keys-exist`), same `{parameters}`, same 63-pixel column (`i18n`). None of them can see this,
// because the three locales can be perfectly in step and all three be wrong. What was here when this
// test was written: `Bónus` on one line and `Bônus` twenty lines below it, `ficheiro` three times,
// `poço gravítico`, `sobresselente`, and six `joga outra vez` in the Portuguese imperative rather
// than the Brazilian one. Nothing failed. It reached the screen.
//
// ⚠️ A MARKER LIST IS A FLOOR, NOT A PROOF OF BRAZILIAN-NESS. It catches the words that are spelled
// differently on the two sides of the Atlantic, which is the cheap half of the problem. It cannot see
// the expensive half: pt-PT syntax written with pt-BR spelling — the imperative in the second person
// (`joga`, `escolhe`, `usa`), the infinitive with a clitic (`fazê-lo`), `estar a jogar` for
// `estar jogando`. Those need a reader, and this list does not excuse one. It is here so that the
// SAME mistake cannot come back a second time silently, not so that a new one is impossible.
//
// Nor can it see a MISSPELLED MARKER. A `utilizadr` in the list below would sit green for ever, and no
// test can tell the difference: the first test proves the MATCHER works, not that eleven words are
// spelled right. `utilizador` — the one marker with no instance in the file — was checked by putting
// it into a string and watching this fail. The other ten are a reader's word.
//
// It reads the dictionary rather than the source text of the file, so a failure names the KEY that
// carries the word. The comments in `i18n/pt` are English by this repository's own rule, so there is
// nothing in the file for a source scan to find that a dictionary scan cannot.
import { describe, test, expect } from 'vitest';
import pt from '../app/js/i18n/pt.js';

/**
 * Words that are simply spelled or chosen differently in European Portuguese. Matched case-blind and
 * as substrings, which is what makes `ficheiro` catch `ficheiros` and `Bónus` catch `bónus`.
 *
 * `Bónus` is on the list with its acute accent: the Brazilian `Bônus` has a circumflex, and the two
 * spellings sat twenty lines apart in the same file for as long as it existed.
 */
const EUROPEAN_MARKERS: readonly string[] = [
  'ficheiro', 'ecrã', 'Bónus', 'gravítico', 'sobresselente',
  'rapaz', 'autocarro', 'casa de banho', 'telemóvel', 'comboio', 'utilizador',
];

/** Every marker the text carries, named, so a failure says which word and not only that there is one. */
function markersIn(text: string): string[] {
  const lowered = text.toLowerCase();
  return EUROPEAN_MARKERS.filter((marker) => lowered.includes(marker.toLowerCase()));
}

describe('the base locale is Brazilian Portuguese', () => {
  test('⚠️ the scan can actually see a European word, or it is green for ever with no subject', () => {
    // A blacklist whose matcher is broken passes every file in the world. This is the assertion that
    // makes the one below mean something: a typo in a marker, a reversed `includes`, a lost
    // `toLowerCase` — each of them shows up here rather than as a silent pass.
    expect(markersIn('O ficheiro não sai desta máquina.')).toEqual(['ficheiro']);
    expect(markersIn('Bónus: 5000')).toEqual(['Bónus']);
    expect(markersIn('Bônus: 5000')).toEqual([]);
  });

  test('and no string in i18n/pt carries one', () => {
    const offenders = Object.entries(pt)
      .flatMap(([key, text]) => markersIn(text).map((marker) => `${key} — "${marker}" in ${text}`));

    expect(offenders).toEqual([]);
  });
});

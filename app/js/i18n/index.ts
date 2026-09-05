// SPDX-License-Identifier: AGPL-3.0-or-later
// i18n — the game's own translator.
//
// ========================= WHY NOT THE ENGINE'S =========================
// ⚠️ THE ORIGINAL REASON HAS EXPIRED, AND SAYING SO IS THE POINT OF THIS NOTE.
//
// This module was written because the engine's `t()` read a module-level dictionary that `setLocale`
// replaced, so a consumer could not add its own keys without reaching into engine state. The engine
// has since gained `registerDict(code, entries)` — a consumer can now register a dictionary — and that
// sentence is no longer true of it.
//
// What remains true is the second half: the engine's translator is a GLOBAL, and this one is a VALUE.
// `createTranslator('en')` can be built, used and thrown away inside one test with no global to set
// and nothing to restore afterwards, which is what makes every string in this game testable without a
// browser. That is why it stays.
//
// The two are not exclusive. Registering these dictionaries with the engine as well would let the
// engine's own menus speak this game's words, and it is worth doing when the shell has menus of its
// own to name. Recorded here rather than done silently.
//
// The CONVENTIONS are the engine's, deliberately, so the two behave the same way to a reader: `{name}`
// parameters, a missing key falling through to Portuguese, and an unknown key returning ITSELF rather
// than an empty string — a visible key on screen is a bug report, and a blank space is a mystery.
//
// ========================= THE FRAME TRANSLATES, THE PARAMETER DOES NOT =========================
// `{n}` and `{points}` pass through untouched. That is the engine's rule and it matters here for the
// same reason: a score is a number in every language, and a mission's countdown is the game's state,
// not its prose.

import pt from './pt.js';
import en from './en.js';
import es from './es.js';

export type Locale = 'pt' | 'en' | 'es';

/** Portuguese is the base. A key missing from another locale falls through to it. */
export const BASE_LOCALE: Locale = 'pt';

const DICTIONARIES: Readonly<Record<Locale, Record<string, string>>> = { pt, en, es };

export const AVAILABLE_LOCALES: readonly Locale[] = ['pt', 'en', 'es'];

export type Translate = (key: string, params?: Record<string, string | number>) => string;

/** A translator for one locale. A value, not a global — see this module's header. */
export function createTranslator(locale: Locale): Translate {
  // An unknown locale contributes nothing and the base answers everything. One mechanism, not two:
  // falling back to the base HERE as well would be a second path to the same result, and a mutation
  // that removed it would change nothing.
  const dictionary = DICTIONARIES[locale] ?? {};
  const base = DICTIONARIES[BASE_LOCALE];

  return (key, params) => {
    // An unknown key comes back as itself: visible on screen, and therefore reportable.
    let text = dictionary[key] ?? base[key] ?? key;
    if (params) {
      for (const name of Object.keys(params)) {
        text = text.replaceAll(`{${name}}`, String(params[name]));
      }
    }
    return text;
  };
}

/** Every key any locale defines. Used by the tests that keep the three in step. */
export function allKeys(): readonly string[] {
  const keys = new Set<string>();
  for (const locale of AVAILABLE_LOCALES) {
    for (const key of Object.keys(DICTIONARIES[locale])) keys.add(key);
  }
  return [...keys].sort();
}

export function dictionaryOf(locale: Locale): Readonly<Record<string, string>> {
  return DICTIONARIES[locale];
}

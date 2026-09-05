// SPDX-License-Identifier: AGPL-3.0-or-later
// i18n — the game's own translator.
//
// ========================= WHY NOT THE ENGINE'S =========================
// The engine has `core/i18n`, and this could have used it. It does not, for one reason: the engine's
// `t()` reads a MODULE-LEVEL dictionary that `setLocale` replaces, so a consumer game cannot add its
// own keys to it without reaching into the engine's state, and a node test cannot exercise a locale
// without setting a global. Twenty lines here buy a translator that is a value rather than a global,
// which is what makes every string in this game testable without a browser.
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

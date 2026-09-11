// SPDX-License-Identifier: AGPL-3.0-or-later
// ONE SCREEN, ONE LANGUAGE.
//
// ⚠️ THIS GAME SHIPS THREE DICTIONARIES AND A PLAYER CAN REACH ONE. `bootPinball` is handed the literal
// `'pt'` and there is no `?lang=`, so `en` and `es` — 212 keys each, about 60 kB in the bundle, guarded by
// parity gates that fail if either loses a key — are behind no door at all.
//
// ⚠️ AND THE ENGINE ALREADY CHOSE A LANGUAGE BY THEN. `createGame` runs `initI18n(doc)`, which reads a
// saved preference or `navigator.language` and answers with one of its own locales. Everything the ENGINE
// draws — the accessibility bar now on screen, the pause card, the reach notice — speaks that one; the HUD,
// the table list and the pause menu speak the literal. On a Spanish machine that is two languages on one
// screen, and the engine has met that defect before: five icon labels in English and three still in
// Portuguese, measured in a browser, on one row.
//
// ========================= WHAT THIS FILE IS FOR TODAY =========================
// 📏 THE PLAN SAYS TO MEASURE RATHER THAN PREDICT. Whether the two agree right now depends on what the
// test browser reports for `navigator.language`, and a gate written on a guess about that is a gate that
// passes on this machine and fails on a child's. So this file asks the question out loud, and its answer
// is what §9 is built on.
import { describe, test, expect, beforeAll } from 'vitest';
import { PAGE_MARKUP } from './helpers/page.js';
import { pinLanguage } from './helpers/pin-language.js';
import { bcp47, getLocale } from '@the-inclusionist/engine/core/i18n.js';

interface PinballDebug { locale: string }
const debug = (): PinballDebug => (window as unknown as { __pinball: PinballDebug }).__pinball;

const frames = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r(null)));
};

beforeAll(async () => {
  document.body.innerHTML = PAGE_MARKUP;
  pinLanguage();
  await import('../app/js/standalone.js');
  await frames(10);
});

describe('the two halves of the screen speak the same language', () => {
  test('⚠️ the game takes its locale from the engine, and does not name one of its own', async () => {
    /**
     * ⚠️ THE ENGINE IS THE ONE THAT ASKED THE CHILD'S MACHINE. `initI18n` reads a saved preference first
     * and `navigator.language` second; this game asked nothing and said `'pt'`. Reading the engine's answer
     * is not a courtesy — it is the only way the two halves of one screen can agree, and on the platform of
     * ADR-0117 the language is the SITE's rather than any cartridge's.
     */
    expect(debug().locale, 'the game is speaking a language the engine did not choose')
      .toBe(getLocale());
  });

  test('⚠️ and the document says which language it is in, for everything that is not this game', () => {
    /**
     * `documentElement.lang` is what a screen reader reads the page's own chrome with, what a browser
     * offers a translation from, and what hyphenation and quotation marks follow. A page that speaks one
     * language and declares another is read aloud in the wrong voice — which is the one place this cannot
     * be dismissed as cosmetic, because the child it reaches is the child using the reader.
     */
    /**
     * ⚠️ `bcp47` IS IMPORTED AND NOT TAKEN OFF `window.__i18n`, and the first version of this case did
     * the latter and measured nothing. The engine's default export carries eight functions and `bcp47` is
     * not one of them, so `engine.bcp47` was `undefined`, the fallback compared against the bare `pt`, and
     * the case failed over a tag that was correct. A test reaching into a debug handle for a function it
     * could import is a test that will one day assert about `undefined` and call it a defect.
     */
    expect(document.documentElement.lang, 'the document declares the wrong language')
      .toBe(bcp47(getLocale()));
  });
});

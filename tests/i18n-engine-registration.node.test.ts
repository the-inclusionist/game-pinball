// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ENGINE ACCEPTS THIS GAME'S WORDS, AND THEY CANNOT DISPLACE ITS OWN.
//
// ⚠️ SINCE §9 THE SHELL REGISTERS THESE DICTIONARIES WITH THE ENGINE, so that one screen speaks one
// language: the accessibility bar, the pause card and the reach notice draw from the engine's table, the
// HUD and the table list from this one, and a child reads both at once.
//
// ADR-0139 puts the registration on the SHELL and never on the cartridge — `main.ts` is this game's
// standalone shell today, so the two lines there are the shell doing its job, and they move to
// `src/standalone.ts` when the conversion comes. What this file gates is the part that does not move:
// whether the words themselves are registrable.
//
// ========================= WHAT `registerDict` ACTUALLY ANSWERS =========================
// ⚠️ IT RETURNS THE KEYS IT REFUSED, AND IT REFUSES FOR MARKUP — not for collision, which is what this
// file first assumed. `core/i18n.registerDict` runs `temMarcacao` over every string and drops the ones
// carrying markup, loudly, because "quem escreveu a string tem de saber que ela não entrou. Descartar
// calado faria a chave crua aparecer na tela sem nada explicando, e isso lê-se como defeito da engine."
//
// A refused string is a string a child never sees, in a game that ships three dictionaries and gates them
// for parity. That is worth a test of its own.
import { describe, test, expect } from 'vitest';
import { registerDict } from '@the-inclusionist/engine/core/i18n.js';
import { AVAILABLE_LOCALES, dictionaryOf } from '../app/js/i18n/index.js';

describe('the engine takes this game’s dictionaries', () => {
  test.each(AVAILABLE_LOCALES)('⚠️ %s registers with nothing refused', (code) => {
    /**
     * Every key of every locale reaches the engine's table. A refused one is invisible: the engine warns
     * on a console nobody playing has open, and the child gets the raw key on screen.
     */
    expect(registerDict(code, dictionaryOf(code))).toEqual([]);
  });

  test('⚠️ and every key is under this game’s own prefix, so none can displace an engine string', () => {
    /**
     * ⚠️ THE NAMESPACE IS WHAT MAKES THE MERGE SAFE, and it is cheaper to assert than to detect. The engine
     * registers its own 558 keys under `sr.`, `viz.`, `pause.`, `icon.` and their neighbours; registering
     * a key it already has would overwrite the engine's string with this game's, and the surface that
     * broke would be one of ITS panels — a defect that looks like an engine bug from every angle.
     *
     * 📌 `shell/options` already records the other half of this convention: storage keys use `pinball:`
     * with a COLON so they cannot be mistaken for translation keys, which are `pinball.` with a dot.
     */
    for (const code of AVAILABLE_LOCALES) {
      const stray = Object.keys(dictionaryOf(code)).filter((key) => !key.startsWith('pinball.'));

      expect(stray, `${code} has keys outside this game's namespace`).toEqual([]);
    }
  });

  test('and there are words to register at all, in all three', () => {
    // The scan's own subject. A dictionary that emptied would satisfy both cases above in silence, and
    // this repository has met that shape in three separate ledgers.
    for (const code of AVAILABLE_LOCALES) {
      expect(Object.keys(dictionaryOf(code)).length, `${code} is empty`).toBeGreaterThan(100);
    }
  });
});

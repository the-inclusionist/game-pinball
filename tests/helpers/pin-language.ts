// SPDX-License-Identifier: AGPL-3.0-or-later
// tests/helpers/pin-language — every browser suite boots in ONE known language.
//
// ========================= A SUITE THAT DEPENDS ON THE RUNNER'S LANGUAGE IS NOT A SUITE =========================
// ⚠️ THIS GAME USED TO BE HARD-CODED TO `pt`, AND THAT IS WHAT MADE THE TESTS LOOK STABLE. `tests/
// pause-menu-cabinet` asserts the walk through the pause menu as `['Continuar', 'Cores da mesa',
// 'Acessibilidade visual', 'Cores da mesa']`, and `tests/screens-fit` measures whether the drawn words fit
// inside 320×180. Both are claims about BEHAVIOUR and LAYOUT, and both were written in Portuguese because
// Portuguese was the only language the game could be in.
//
// 📏 THE MOMENT THE GAME TOOK ITS LANGUAGE FROM THE ENGINE (§9), SEVEN CASES TURNED RED IN FIREFOX ALONE —
// the engine reads `navigator.language`, the runner said English, and a suite that had never had to think
// about language started measuring the wrong strings. Not one of those failures was about the game.
//
// ⚠️ AND THE FIX IS NOT TO TRANSLATE THE ASSERTIONS. It is to decide the language, because that is what the
// suite was silently relying on. The i18n dictionaries have parity gates of their own
// (`tests/i18n-*`); these suites are about what happens when a key is pressed, and a key press means the
// same thing in three languages.
//
// 📌 AND IT IS THE ENGINE'S OWN STORE KEY, not a flag of this game's. `core/i18n.pickDefault` reads
// `incl_lang` first and `navigator.language` second, so writing it is exactly what a child choosing a
// language in the engine's panel does — the test arrives at a machine where somebody already chose.

/** The engine's storage key for the chosen language — `platform/storage.KEYS.lang`. */
export const ENGINE_LANG_KEY = 'incl_lang';

/**
 * Decides the language before a suite boots the game.
 *
 * ⚠️ CALL IT BEFORE `import('../app/js/standalone.js')`, not after: the choice is read once, during the
 * engine's `initI18n`, which the SHELL runs — that is the first thing `standalone` does, before it
 * imports a line of the game. Called late it changes nothing and says nothing.
 *
 * 📌 AND THE SUITES BOOT THROUGH THE SHELL FOR THAT REASON, not as a spelling. Importing `main.js`
 * directly is importing a cartridge with no host: no dictionaries registered, so the game draws its own
 * keys, and no language settled.
 */
export function pinLanguage(code = 'pt'): void {
  try {
    localStorage.setItem(ENGINE_LANG_KEY, code);
  } catch {
    // A browser refusing storage is a browser where the engine falls back to `navigator.language`, which
    // is the state this helper exists to avoid — but failing the boot over it would be worse than a
    // suite that reads its own runner. The suites that care assert the language they got.
  }
}

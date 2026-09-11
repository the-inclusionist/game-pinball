// SPDX-License-Identifier: AGPL-3.0-or-later
// standalone — the shell this repository ships, and the half of the work a HOST does.
//
// ========================= WHY THERE ARE TWO SHELLS =========================
// ⚠️ ADR-0140: THIS GAME SHIPS TWO ARTEFACTS FROM ONE SOURCE — a standalone PWA and a cartridge — and
// neither replaces the other. ADR-0139 says what separates them: a cartridge supplies the half of
// `CreateGameOptions` only a game can answer, and WHOEVER HOSTS IT does the rest. This file is the host
// for the standalone page; `the-inclusionist-site` is the host for the platform.
//
// ========================= WHAT A HOST OWES, AND WHY IT IS THIS =========================
// The contract's line: "the host knows these — they describe the page and the device, not the game".
// Registering dictionaries and settling a locale is exactly that. The engine picked the language from a
// saved preference or `navigator.language` before this game ever ran; a cartridge that named one of its
// own would put two languages on one screen, which is what it did until §9 measured it.
//
// ⚠️ AND THE DICTIONARIES ARE THE CARTRIDGE'S, REGISTERED BY THE SHELL. A cartridge never registers its
// own: two of them calling `registerDict` for one locale on one page is two writers on one table, and the
// second one wins in silence. So the words come from `shell/cartridge`, which is the half a cartridge
// EXPORTS, and the call is here, which is the half a host MAKES.
//
// ========================= WHAT IS NOT HERE YET =========================
// 📌 `createGame` IS STILL INSIDE THE CARTRIDGE, which is the next slice and the larger one. Moving it
// means splitting this game's own factory in two — the part that reads the parameters and builds the
// table, which the declaration needs, and the part that runs once there is an engine. Doing that in the
// same commit as this one would mix a mechanical move with a design decision.
import {
  bcp47, initI18n, idiomaPronto, registerDict,
} from '@the-inclusionist/engine/core/i18n.js';
import { AVAILABLE_LOCALES } from './i18n/index.js';
import { cartridgeDicts, cartridgeLocale } from './shell/cartridge.js';

initI18n(document);
for (const code of AVAILABLE_LOCALES) {
  const refused = registerDict(code, cartridgeDicts[code]);
  // A non-empty answer is a key collision with the engine's own 558: one surface would silently start
  // speaking the other's words. Gated in `tests/i18n-engine-registration`; reported here because a console
  // line at boot is what the engine's own `registerDict` promises a writer.
  if (refused.length) console.warn('[pinball] keys the engine refused:', refused);
}

/**
 * ⚠️ THE AWAIT IS NOT OPTIONAL, AND THE MEASUREMENT IS WHY. Every locale but `pt` is a chunk fetched on
 * demand, so `getLocale()` answers `pt` until it lands — chromium and firefox disagreed with each other
 * purely on that timing. `idiomaPronto()` is the engine's own handle, and `boot/create-game` waits on the
 * same one before it writes its icon labels.
 */
await idiomaPronto();

/**
 * WHAT LANGUAGE THIS PAGE IS IN, which is a fact about the PAGE and so belongs to its host.
 *
 * 🔴 IT WENT UNWRITTEN FOR ONE COMMIT AND A BROWSER GATE CAUGHT IT. The line moved out of the cartridge
 * with the rest of the prologue and nothing here replaced it, so `documentElement.lang` stayed at whatever
 * the document was born with — `en` in both test browsers, over a game drawing Portuguese. Nothing on
 * screen looks wrong; what breaks is every reader that believes the attribute, which is a screen reader
 * choosing a voice and a browser offering to translate.
 *
 * ⚠️ AND IT IS THE LOCALE THE GAME ACTUALLY DREW IN, not the engine's raw answer. If a child's machine
 * asks for a language this cartridge does not have, the page is in the base language — saying otherwise
 * would hand a screen reader the wrong voice for words it can see perfectly well.
 */
document.documentElement.lang = bcp47(cartridgeLocale());

/**
 * ⚠️ AND THE CARTRIDGE IS LOADED AFTER, WHICH A STATIC IMPORT COULD NOT DO. `import` is a declaration
 * and declarations are HOISTED: written at the top, the game would run to completion before a word of the
 * registration above it, and the prologue would have moved and stopped working with nothing to see. A
 * dynamic import is a statement, and statements run in order.
 *
 * Gated in `tests/the-shell-does-the-hosts-work`, which refuses a static one by name.
 */
await import('./main.js');

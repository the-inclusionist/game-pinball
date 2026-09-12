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
import { createRng } from '@the-inclusionist/engine/core/rng.js';
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
/**
 * The page's own elements, by the names `app/index.html` gives them.
 *
 * ⚠️ IT THROWS RATHER THAN PASSING `null` ONWARDS. A missing region is a page that cannot show a game
 * at all, and the alternative is a cartridge writing into nothing and a blank screen with no error — the
 * shape `#cvd-filters` already went missing in once, found by booting rather than by reading.
 */
function mustFind(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (!found) throw new Error(`[pinball] the page has no #${id}, so there is nowhere to mount a game`);
  return found;
}

const { createPinball } = await import('./main.js');

/**
 * AND THE HOST DECIDES WHEN A GAME BEGINS.
 *
 * ⚠️ "NOTHING RUNS UNTIL `create(ctx)` IS CALLED. NO SIDE EFFECTS AT MODULE SCOPE" — the contract, and
 * spec D14 underneath it. Until this line the cartridge started itself on import, which works perfectly
 * on a page with one game and is a defect on a page with two: the host would be merging its half of the
 * options into an engine the game had already stopped waiting for.
 *
 * 📌 THE WHOLE SEARCH IS THIS GAME'S, BECAUSE THIS PAGE IS THIS GAME'S. That is a decision a host
 * makes — "what the shell decided this cartridge may read from the address" — and the platform will
 * decide differently, giving each cartridge a namespaced slice of one address. The cartridge does not
 * have to change for that, which is the point of handing it over rather than letting it read.
 */
createPinball({
  params: new URLSearchParams(location.search),
  /**
   * ONE STREAM, BUILT BY THE HOST, BELONGING TO THIS CARTRIDGE AND NOTHING ELSE.
   *
   * ⚠️ `createRng` IS THE HALF OF `core/rng` THE GAMES DID NOT REACH FOR. The other half — `rnd`,
   * `randInt`, `shuffle`, `reseed` — is bound to a module-level stream shared by everyone who imports
   * it, and on a page with two cartridges a `reseed` in one repositions the other's. The engine's own
   * doc says it: «Reposiciona ESTA corrente. Não alcança nenhuma outra».
   *
   * 🔴 AND THE SEED IS THE CLOCK ON PURPOSE, WHICH IS THE OPPOSITE OF WHAT A SEEDED STREAM IS USUALLY
   * FOR. `table/physics-build` spends a paragraph on it: a pinball whose kickouts, wells and holes throw
   * the ball the same way every session is one a player learns to exploit, and that is a worse game. The
   * stream is here so the randomness BELONGS to something a host can isolate — not so it repeats.
   */
  rng: createRng(Date.now()),
  /**
   * ⚠️ THE HOST NAMES THE ELEMENT, AND ON THIS PAGE THERE IS EXACTLY ONE. `app/index.html` carries
   * `#game-region` because the ENGINE binds the keyboard to it by that id — it is not decorative and it
   * is not this cartridge's to choose. The platform will hand each cartridge its own element with a name
   * of its own, and the game will not notice, which is the whole point of handing it over.
   */
  region: mustFind('game-region'),
});

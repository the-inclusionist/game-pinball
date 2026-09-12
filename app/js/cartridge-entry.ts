// SPDX-License-Identifier: AGPL-3.0-or-later
// cartridge-entry — everything a host that INSTALLS this game needs, and nothing else.
//
// ========================= ADR-0140: ONE SOURCE, TWO ARTEFACTS =========================
// ⚠️ THE OTHER ONE IS `standalone.ts`, AND NEITHER REPLACES THE OTHER. That file is a host: it registers
// the dictionaries, settles the language, calls `createGame` once and starts the game, all for a page
// this repository ships. This file is the other side of the same source — the surface a DIFFERENT host
// imports, on a page this repository knows nothing about.
//
// 📌 SO WHAT IS HERE IS RE-EXPORTS AND NOT LOGIC, deliberately. A bundle entry that computed anything
// would be a third place where this game is assembled, and the two that exist already have to agree.
//
// ========================= WHERE THIS DIVERGES FROM `cartridge-contract.md` =========================
// 🔴 THE CONTRACT'S `Cartridge` HAS `declaration` AS A FIELD, AND THIS GAME CANNOT ANSWER THAT.
//
//     export interface Cartridge {
//       readonly slug: string;
//       readonly declaration: GameDeclaration;   // ← a value, with nothing to build it from
//       readonly dicts: …;
//       readonly hooks: CartridgeHooks;
//       create(ctx: GameCtx): GameInstance;
//     }
//
// A pinball's declaration describes the playfield that is actually on screen: its extent, its ball
// radius, the components a sonar sweeps. Which table that is comes from `?table=`, and the locale its
// names are spoken in comes from whatever the host settled — neither of which a module-level constant
// can know.
//
// ⚠️ AND THE CONTRACT KNOWS, WHICH IS WHY THIS IS A DIVERGENCE AND NOT A BREACH. Its own section "the one
// hard problem" says `createGame` runs once while declarations are per-game, and names the way out:
// *"a delegating declaration — a declaration whose every member forwards to the mounted cartridge"*.
// `delegatingCartridge(locale, params, host)` IS that, and its three arguments are exactly the three
// facts a host holds and a cartridge cannot invent.
//
// 📌 So this exports a FACTORY where the contract has a value, and the difference is one line in a host:
// `const { declaration, hooks, publish } = delegatingCartridge(locale, params, host)`. Recorded here and
// in the plan's §B6, to take back to the contract rather than quietly resolve in one repository.

/** The name this cartridge answers to, and the dictionaries a shell registers for it. */
export { CARTRIDGE_SLUG, cartridgeDicts, cartridgeLocale, tableAskedFor } from './shell/cartridge.js';

/**
 * The game-owned half, held before the game exists.
 *
 * ⚠️ A HOST CALLS THIS BEFORE `createGame` AND `publish` AFTERWARDS, in that order. Between the two the
 * hooks answer for a game that is not running — no menu open, no sonar listener, a pause card with
 * nothing to action — which is the safe end of every one of those questions rather than a placeholder.
 */
export { delegatingCartridge } from './shell/cartridge.js';
export type { CartridgeHooks, DelegatingCartridge, LiveCartridge } from './shell/cartridge.js';

/**
 * The way in: `create(ctx)` under this game's own name.
 *
 * ⚠️ IT TAKES THE ENGINE RATHER THAN MAKING ONE. ADR-0139: N calls to `createGame` on one page are N
 * accessibility bars, N screen readers and N keyboard runtimes competing for one document.
 */
export { createPinball } from './main.js';
export type { PinballCtx, PinballInstance } from './main.js';

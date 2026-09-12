// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/cartridge — this game's half of the options, named as the thing a host receives.
//
// ========================= WHAT A CARTRIDGE IS =========================
// ⚠️ ADR-0139: A CARTRIDGE NEVER CALLS `createGame`. It supplies the half of `CreateGameOptions` that only
// a game can answer — every field of which is a callback INTO the game or a statement ABOUT it — and
// whoever hosts it calls `createGame` ONCE and merges the two halves. The reason is not weight: N calls
// mean N accessibility bars, N screen readers and N keyboard runtimes competing for one document.
//
// The split is not this file's proposal. The engine has since drawn the same line inside itself, to give
// `mount()` somewhere to write:
//
//     type MetadeDoJogo = Pick<CreateGameOptions,
//       'declaration' | 'isNavigable' | 'comIndice' | 'naBarraDe' | 'navBar' | 'players' | 'setPhase'
//       | 'sonarPlayers' | 'isBlindMode' | 'preset' | 'declines' | 'getPauseActs' | 'setPauseActor'
//       | 'setTemaDoJogador' | 'setCorrecaoDoJogador'>;
//
// 📌 AND THAT ANSWERS ONE OF THE FOUR QUESTIONS `cartridge-contract.md` SAYS NOT TO INVENT: `declines` is
// the GAME's half. It reads as a statement about what a game does not have, and the engine agrees.
//
// ========================= THE TYPE IS THE ENGINE'S NOW =========================
// 🔴 THIS PARAGRAPH SAID THE OPPOSITE FOR ONE DAY: "`GanchosDoCartucho` lives at engine HEAD and the
// registry answers `8.0.0`, which is older", so the shape was declared here. **9.0.0 published it**, and a
// local copy of a published type is a second description of one fact — the shape this repository has paid
// for on a bumper's rectangle, a HUD inset and a plunger's speed. It is imported.
//
// ⚠️ AND THE SWAP MOVED A FIELD, WHICH IS THE USEFUL PART. `GanchosDoCartucho` is
// `Omit<MetadeDoJogo, 'declaration'>` and `baixarPesados` IS NOT IN IT — the contract puts it on the host
// and the engine agrees. So it stops travelling with the hooks. The DECISION does not change: ADR-0010's
// `false` still stands and `shell/boot` still passes it, because today this repository's own standalone
// shell is the host. When the platform of ADR-0117 becomes the host, the platform answers it.
//
// ========================= WHAT IS NOT HERE YET =========================
// `create(ctx)` and the declaration. `Cartridge.declaration` is a VALUE and this game's is built from a
// live world that does not exist until a table has been chosen from `ctx.params` — so it has to delegate to
// whatever instance is current, which is slice A1 of the plan's §B6. Named here so that "not yet" is not
// read as "forgotten".

import {
  createPinballOptions, createPinballWorld, type BootOptions, type LiveTable,
} from './boot.js';
import { createDeclaration } from './declaration.js';
import { DEFAULT_TABLE, tableNamed } from '../table/catalog.js';
import type { AuthoredTable } from '../table/authored.js';
import type { GanchosDoCartucho } from '@the-inclusionist/engine';
import { getLocale } from '@the-inclusionist/engine/core/i18n.js';
import { AVAILABLE_LOCALES, BASE_LOCALE, dictionaryOf, type Locale } from '../i18n/index.js';

/**
 * THE NAME THIS CARTRIDGE ANSWERS TO.
 *
 * ⚠️ `ADR-0082` §1 MAKES IT THE SAME WORD AS THE REPOSITORY AND THE PACKAGE, AND TODAY ONLY TWO OF THE
 * THREE AGREE. The folder is `game-pinball` and so is the git remote; `package.json` says
 * `@the-inclusionist/game-space-cadet`. The published name is the Dev's to change or keep, and this
 * constant follows the two that already match rather than inventing a third answer.
 */
export const CARTRIDGE_SLUG = 'game-pinball';

/**
 * A DECLARATION THE HOST CAN HOLD BEFORE THIS GAME HAS A TABLE.
 *
 * ========================= THE CIRCLE THIS BREAKS =========================
 * ⚠️ `createGame` TAKES `declaration` AS A VALUE and runs `conformanceProblems` on it once, at boot; so
 * `cartridge-contract.md` makes `Cartridge.declaration` something a host reads BEFORE calling
 * `create(ctx)`. But this game's declaration describes the playfield that is actually on screen, and
 * which table that is comes from `ctx.params` — which the cartridge cannot read until `create(ctx)` has
 * been called. Each requirement is upstream of the other.
 *
 * 📌 THE CONTRACT NAMES THE WAY OUT AND THIS IS IT, VERBATIM: option (a) under "the one hard
 * problem", «a declaration whose every member forwards to the mounted cartridge», which it says works
 * today with no engine change. The engine reached the same shape from the inside for `mount()`
 * (`let cartucho: MetadeDoJogo = o`), and `ADR-0084` is the precedent for a `topology` that is asked
 * rather than fixed.
 *
 * ✅ AND THIS GAME WAS ALREADY BUILT FOR IT WITHOUT KNOWING. `createPinballWorld` returns GETTERS and
 * `createDeclaration` reads them at call time, so nothing handed to the engine is looked at until the
 * engine asks. The delegate below is one more layer of the same idea and not a new mechanism.
 *
 * ========================= WHAT IT ANSWERS BEFORE THERE IS A TABLE =========================
 * ⚠️ AN EMPTY TABLE, AND NEVER A THROW. `createGame` throws on a malformed declaration, and a host
 * that could not boot a cartridge until the cartridge had run would be back inside the circle. So the
 * unpublished state is a real, conformant, EMPTY playfield: no balls, no components, nothing to describe.
 * Measured in `tests/cartridge-declaration-delegates` rather than assumed.
 *
 * ⚠️ AND `publish` MAY BE CALLED MORE THAN ONCE, which is the half that makes it a delegate rather
 * than a copy. This game rebuilds its world when a player picks another table, and the platform's
 * `mount()`/`unmount()` is the same thing at a larger scale. An implementation that read the table once,
 * at publish, would pass every other case and tell a child about the table they played an hour ago.
 *
 * 📌 THE MUTABLE POINTER LIVES IN THIS CLOSURE AND NOT AT MODULE SCOPE, which is spec D14 — module
 * state survives `teardown()` and leaks into the next game. One call gives one host one declaration.
 */
export interface DelegatingDeclaration {
  /** The value a host hands to `createGame`. Stable for the life of the cartridge. */
  readonly declaration: ReturnType<typeof createDeclaration>;
  /** Points it at the world a `create(ctx)` has just built. Idempotent, and repeatable. */
  publish(table: LiveTable): void;
}

/**
 * WHICH TABLE THE ADDRESS ASKS FOR — the one choice this game can make with no engine and no world.
 *
 * ⚠️ IT LIVES HERE BECAUSE TWO CALLERS NEED THE SAME ANSWER. `create(ctx)` builds its world from it,
 * and the DECLARATION handed over before that has to describe the same table — otherwise the engine
 * validates one playfield at boot and narrates another a moment later. Two expressions agreeing by
 * coincidence is the defect this repository has paid for most often.
 */
export function tableAskedFor(params: URLSearchParams): AuthoredTable {
  const requested = params.get('table');
  return (requested && tableNamed(requested)) || DEFAULT_TABLE;
}

/**
 * What the chosen table looks like before a ball exists: its extent, and nothing that moves.
 *
 * 🔴 AND IT IS THE REAL TABLE RATHER THAN A PLACEHOLDER, WHICH A MEASUREMENT DECIDED. The first
 * version seeded an EMPTY one — zero by zero, no components — on the reasoning that nothing is on screen
 * until `create(ctx)` runs. The engine refuses it, in its own words:
 *
 *     topology.size: every extent must be positive
 *     topology.continuous: unit must be positive (it is the metric the narration counts in)
 *
 * ⚠️ AND THE REFUSAL IS RIGHT, WHICH IS THE USEFUL PART. `createGame` runs `conformanceProblems` at
 * boot; a declaration that says «this space is zero wide» is not a space a child can be told about, and
 * an engine that accepted it would have mounted a sonar whose metric divides by nothing. The answer is
 * not to soften the check — it is that the extent was knowable all along. `?table=` is read from the
 * address, and the address is the host's before the game runs.
 *
 * 📌 SO THE ONLY THING MISSING BEFORE `publish` IS WHAT MOVES: no balls, no live mission, no
 * components yet. Those are what `create(ctx)` builds, and they are what the delegate is for.
 */
function tableAtRest(authored: AuthoredTable): LiveTable {
  return {
    playfieldWidth: authored.size.width,
    playfieldHeight: authored.size.height,
    ballRadius: authored.ballRadius,
    balls: [],
    components: [],
    missionTextId: '',
    missionHave: 0,
    missionNeed: 0,
    missionTargets: [],
  };
}

export function delegatingDeclaration(locale: Locale, params: URLSearchParams): DelegatingDeclaration {
  let current: LiveTable = tableAtRest(tableAskedFor(params));

  /**
   * ⚠️ EVERY MEMBER IS A GETTER, INCLUDING THE ONES THAT LOOK CONSTANT. `ballRadius` does not change
   * within a table and DOES change between two of them, and a field copied at construction would be the
   * one that went stale — silently, because a radius that is wrong by a pixel reads as a rounding error
   * rather than as the wrong table.
   */
  const live: LiveTable = {
    get playfieldWidth() { return current.playfieldWidth; },
    get playfieldHeight() { return current.playfieldHeight; },
    get ballRadius() { return current.ballRadius; },
    get balls() { return current.balls; },
    get components() { return current.components; },
    // Forwarded as a function that is always present: `createPinballWorld` treats a null answer as "not
    // declared" and falls back to guessing the kind from the name, which is what an absent one does too.
    kindOfComponent: (name) => current.kindOfComponent?.(name) ?? null,
    get missionTextId() { return current.missionTextId; },
    get missionHave() { return current.missionHave; },
    get missionNeed() { return current.missionNeed; },
    get missionTargets() { return current.missionTargets; },
  };

  return {
    declaration: createDeclaration(createPinballWorld(live, locale)),
    publish(table: LiveTable): void { current = table; },
  };
}

/**
 * WHICH OF THIS CARTRIDGE'S LANGUAGES THE ENGINE'S CHOICE LANDS ON.
 *
 * ⚠️ ONE RULE WITH TWO READERS, AND THAT IS WHY IT IS A FUNCTION RATHER THAN TWO EXPRESSIONS. The
 * cartridge needs it to build its translator and the SHELL needs it to write the page's `lang` — and this
 * repository's recurring defect is exactly the shape the second copy would have: two descriptions of one
 * fact, agreeing until one of them is edited.
 *
 * 📌 THE FALLBACK IS THE WHOLE OF IT. The engine has locales this game has not been translated into,
 * and it chose before this game ran — from a saved preference, or from `navigator.language`. Falling back
 * to the base language is the honest answer: a half-translated screen is worse than a consistent one.
 *
 * ⚠️ AND IT READS THE ENGINE'S MODULE STATE, WHICH IT WILL STOP DOING. The contract hands the
 * translator over in `create(ctx)`; until that slice exists, `getLocale()` is the one place both halves
 * already agree on. It answers the BASE locale until `idiomaPronto()` has settled, so a host calls it
 * after that await and not before.
 */
export function cartridgeLocale(): Locale {
  const chosen = getLocale();
  return (AVAILABLE_LOCALES as readonly string[]).includes(chosen) ? chosen as Locale : BASE_LOCALE;
}

/**
 * THE WORDS, FOR THE SHELL TO REGISTER.
 *
 * ⚠️ A CARTRIDGE NEVER REGISTERS ITS OWN. Two cartridges calling `registerDict` for the same locale on one
 * page is two games writing one table, and the second one wins silently. The shell — this repository's
 * standalone one, or the platform — is the single writer.
 */
export const cartridgeDicts: Readonly<Record<Locale, Record<string, string>>> = Object.freeze(
  Object.fromEntries(AVAILABLE_LOCALES.map((code) => [code, dictionaryOf(code)])),
) as Readonly<Record<Locale, Record<string, string>>>;

/**
 * The fields of `CreateGameOptions` that only this game can answer, minus the declaration.
 *
 * ⚠️ THE ENGINE'S OWN TYPE, published in 9.0.0. Fourteen names, and getting one of them wrong is the
 * defect `tests/cartridge-halves` was written for: a hook the engine does not read is a question the game
 * believes it answered.
 */
export type CartridgeHooks = GanchosDoCartucho;

/**
 * This game's half, built from the same place the boot builds it.
 *
 * ⚠️ IT READS `createPinballOptions` RATHER THAN RESTATING IT, and that is the whole design of this slice.
 * A second description of the game-owned half is how two answers to one question start; `tests/
 * cartridge-halves` asserts they agree while both exist, and slice A2 removes the second by having the
 * standalone shell build its options FROM here.
 *
 * 📌 `baixarPesados` DOES NOT TRAVEL WITH THEM, AND THAT IS THE ENGINE'S RULING RATHER THAN A PREFERENCE.
 * It is absent from `MetadeDoJogo`, so it is the host's. `shell/boot` goes on passing it because this
 * repository's own standalone shell is the host today; ADR-0010's `false` is unchanged.
 */
export function cartridgeHooks(o: BootOptions): CartridgeHooks {
  const options = createPinballOptions(o) as unknown as Record<string, unknown>;
  return {
    isNavigable: options['isNavigable'] as () => boolean,
    setPhase: options['setPhase'] as (p: 'title' | 'playing' | 'paused') => void,
    ...(options['isBlindMode'] ? { isBlindMode: options['isBlindMode'] as () => boolean } : {}),
    ...(options['sonarPlayers']
      ? { sonarPlayers: options['sonarPlayers'] as CartridgeHooks['sonarPlayers'] } : {}),
    preset: options['preset'] as CartridgeHooks['preset'],
    players: options['players'] as CartridgeHooks['players'],
    declines: options['declines'] as CartridgeHooks['declines'],
  };
}

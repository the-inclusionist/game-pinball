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
// ========================= WHY THE TYPES ARE DECLARED HERE =========================
// ⚠️ `GanchosDoCartucho` LIVES AT ENGINE HEAD AND THE REGISTRY ANSWERS `8.0.0`, WHICH IS OLDER. So do
// `mount()` and the four fields §5 added. A consumer can only install what is published, so the shape comes
// from the contract document and nothing here imports a name that is not in the package.
//
// ========================= WHAT IS NOT HERE YET =========================
// `create(ctx)` and the declaration. `Cartridge.declaration` is a VALUE and this game's is built from a
// live world that does not exist until a table has been chosen from `ctx.params` — so it has to delegate to
// whatever instance is current, which is slice A1 of the plan's §B6. Named here so that "not yet" is not
// read as "forgotten".

import { createPinballOptions, type BootOptions } from './boot.js';
import { AVAILABLE_LOCALES, dictionaryOf, type Locale } from '../i18n/index.js';

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
 * THE WORDS, FOR THE SHELL TO REGISTER.
 *
 * ⚠️ A CARTRIDGE NEVER REGISTERS ITS OWN. Two cartridges calling `registerDict` for the same locale on one
 * page is two games writing one table, and the second one wins silently. The shell — this repository's
 * standalone one, or the platform — is the single writer.
 */
export const cartridgeDicts: Readonly<Record<Locale, Record<string, string>>> = Object.freeze(
  Object.fromEntries(AVAILABLE_LOCALES.map((code) => [code, dictionaryOf(code)])),
) as Readonly<Record<Locale, Record<string, string>>>;

/** The fields of `CreateGameOptions` that only this game can answer, minus the declaration. */
export interface CartridgeHooks {
  readonly isNavigable: () => boolean;
  readonly setPhase: (phase: 'title' | 'playing' | 'paused') => void;
  readonly isBlindMode?: () => boolean;
  readonly sonarPlayers?: () => unknown[];
  readonly preset: unknown;
  readonly players: unknown;
  readonly declines: Record<string, boolean>;
  readonly baixarPesados: boolean;
}

/**
 * This game's half, built from the same place the boot builds it.
 *
 * ⚠️ IT READS `createPinballOptions` RATHER THAN RESTATING IT, and that is the whole design of this slice.
 * A second description of the game-owned half is how two answers to one question start; `tests/
 * cartridge-halves` asserts they agree while both exist, and slice A2 removes the second by having the
 * standalone shell build its options FROM here.
 *
 * 📌 `baixarPesados` TRAVELS WITH THEM AND THE CONTRACT PUTS IT ON THE HOST. It is here because the reason
 * for this game's `false` is a fact about this repository — no service worker, nothing that reads that
 * cache (ADR-0010) — and a host that ignores it loses nothing. When the platform of ADR-0117 becomes the
 * host, the platform's answer wins and this field stops travelling.
 */
export function cartridgeHooks(o: BootOptions): CartridgeHooks {
  const options = createPinballOptions(o) as unknown as Record<string, unknown>;
  return {
    isNavigable: options['isNavigable'] as () => boolean,
    setPhase: options['setPhase'] as (p: 'title' | 'playing' | 'paused') => void,
    ...(options['isBlindMode'] ? { isBlindMode: options['isBlindMode'] as () => boolean } : {}),
    ...(options['sonarPlayers'] ? { sonarPlayers: options['sonarPlayers'] as () => unknown[] } : {}),
    preset: options['preset'],
    players: options['players'],
    declines: options['declines'] as Record<string, boolean>,
    baixarPesados: options['baixarPesados'] as boolean,
  };
}

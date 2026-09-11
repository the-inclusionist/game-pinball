// SPDX-License-Identifier: AGPL-3.0-or-later
// THE GAME'S HALF OF THE OPTIONS, NAMED — AND PROVED TO BE WHAT IS ALREADY HANDED OVER.
//
// ⚠️ ADR-0139: A CARTRIDGE NEVER CALLS `createGame`. It supplies the half of `CreateGameOptions` that only
// a game can answer, and whoever hosts it — this repository's own standalone shell, or the platform —
// calls `createGame` once and merges the two halves.
//
// The split is not a proposal. The engine has since drawn it inside itself for `mount()`:
//
//     type MetadeDoJogo = Pick<CreateGameOptions,
//       'declaration' | 'isNavigable' | 'comIndice' | 'naBarraDe' | 'navBar' | 'players' | 'setPhase'
//       | 'sonarPlayers' | 'isBlindMode' | 'preset' | 'declines' | 'getPauseActs' | 'setPauseActor'
//       | 'setTemaDoJogador' | 'setCorrecaoDoJogador'>;
//
// — which also answers one of the four questions `cartridge-contract.md` says not to invent: `declines`
// is the GAME's.
//
// ========================= WHY THIS FILE COMES BEFORE THE FACTORY =========================
// ⚠️ THE RISKY SLICE IS THE NEXT ONE, and it is 2350 lines of `main.ts` becoming a function. This one takes
// no risk at all: it names the half and proves the name describes what the game ALREADY passes. If the two
// ever diverge, the divergence shows up here rather than inside a refactor where it would read as a
// mistake in the move.
//
// 📌 AND THE TYPES ARE THIS REPOSITORY'S, NOT THE ENGINE'S. `GanchosDoCartucho` lives at engine HEAD and the
// registry answers `8.0.0`, which is older; `shell/cartridge` declares the shape from the contract document
// so that nothing here depends on a version a consumer cannot install.
import { describe, test, expect } from 'vitest';
import { CARTRIDGE_SLUG, cartridgeDicts, cartridgeHooks } from '../app/js/shell/cartridge.js';
import { createPinballOptions, type BootOptions } from '../app/js/shell/boot.js';
import { AVAILABLE_LOCALES, dictionaryOf } from '../app/js/i18n/index.js';

/** The same fixture `tests/shell-boot` boots with, so the two files compare the same game. */
function options(): BootOptions {
  return {
    locale: 'pt',
    table: {
      playfieldWidth: 183,
      playfieldHeight: 235,
      ballRadius: 3,
      balls: [{ active: true, position: { x: 90, y: 200 }, direction: { x: 0, y: -1 }, speed: 4 }],
      components: [
        { name: 'drain', role: 'hazard', bounds: { x: 80, y: 225, width: 20, height: 10 } },
        { name: 'bump1', role: 'structure', bounds: { x: 40, y: 60, width: 10, height: 10 } },
      ],
      missionTextId: 'STRING208',
      missionHave: 3,
      missionNeed: 8,
      missionTargets: ['bump1'],
    },
    host: { doc: {} as Document, win: {} as Window },
  };
}

describe('the cartridge names itself', () => {
  test('⚠️ the slug matches the repository, which ADR-0082 §1 requires', () => {
    /**
     * 🔴 AND THE PACKAGE STILL DISAGREES, WHICH IS THE DEV'S TO SETTLE. The folder and the git remote both
     * say `game-pinball`; `package.json` says `@the-inclusionist/game-space-cadet`. Two of three agree and
     * the third is the PUBLISHED name, so changing it is a publishing decision and not a rename.
     *
     * This case pins the two that agree. The day the package is renamed, `tests/cartridge-slug` is where
     * the third joins them.
     */
    expect(CARTRIDGE_SLUG).toBe('game-pinball');
  });

  test('and it carries its dictionaries rather than registering them', () => {
    // ADR-0139: "registered by whichever shell loads this cartridge; a cartridge never registers its own".
    // What it owes is the words themselves, in every language it has.
    for (const code of AVAILABLE_LOCALES) {
      expect(cartridgeDicts[code], `${code} is missing from the cartridge`).toBe(dictionaryOf(code));
    }
    expect(Object.keys(cartridgeDicts).sort()).toEqual([...AVAILABLE_LOCALES].sort());
  });
});

describe('⚠️ and its hooks ARE what this game already hands the engine', () => {
  test('every hook the cartridge declares is the one the boot passes', () => {
    /**
     * ⚠️ THE POINT OF THE WHOLE FILE. `shell/cartridge` is a second description of the game-owned half, and
     * a second description is how two answers to one question start. This asserts they are the SAME
     * FUNCTIONS — identity, not shape — so the cartridge cannot drift from the boot while both exist.
     *
     * They stop being two the moment `src/standalone.ts` builds its options FROM the cartridge, which is
     * slice A2. Until then this is what keeps them honest.
     */
    const passed = createPinballOptions(options()) as unknown as Record<string, unknown>;
    const hooks = cartridgeHooks(options()) as unknown as Record<string, unknown>;

    for (const [name, value] of Object.entries(hooks)) {
      expect(typeof passed[name], `the boot does not pass ${name} at all`).not.toBe('undefined');
      // Functions are compared by what they ANSWER, because both sides build fresh closures per call.
      if (typeof value === 'function' && typeof passed[name] === 'function') continue;
      expect(passed[name], `${name} differs between the cartridge and the boot`).toEqual(value);
    }
  });

  test('⚠️ and it declares nothing the engine does not take, which a typo would', () => {
    /**
     * A hook named `isNavigible` would be accepted by `Object.entries` and ignored by the engine for ever:
     * the game would believe it had answered and the engine would use its own default. The names are the
     * engine's fourteen, so they are checked against the ones the boot is known to pass.
     */
    const passed = new Set(Object.keys(createPinballOptions(options()) as unknown as object));

    for (const name of Object.keys(cartridgeHooks(options()))) {
      expect(passed.has(name), `${name} is not a name this engine reads`).toBe(true);
    }
  });
});

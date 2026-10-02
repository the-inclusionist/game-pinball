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
//
// 🔴 AND `sonarPlayers` HAS SINCE LEFT THAT LIST (engine ADR-0258, note EB). The quote above is 9.0.0's,
// kept as the quote it is; what this game offers is one field shorter, and the case below is what holds
// the removal in place.
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
// 🔴 AND THIS PARAGRAPH SAID THE OPPOSITE UNTIL 9.0.0. It read: «the types are this repository's, not the
// engine's — `GanchosDoCartucho` lives at engine HEAD and the registry answers 8.0.0, which is older». The
// registry answers 9.0.0 now and `shell/cartridge` imports the published type, so a local copy would be a
// second description of one fact. Corrected here rather than left to read as still true.
import { describe, test, expect } from 'vitest';
import {
  CARTRIDGE_SLUG, cartridgeDicts, cartridgeHooks, delegatingCartridge, type LiveCartridge,
} from '../app/js/shell/cartridge.js';
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

  test('🔴 and NOTHING the boot passes is missing from the cartridge, which is the other direction', () => {
    /**
     * 🔴 THE CASE ABOVE COULD NOT SEE A HOOK THAT WAS ABSENT FROM BOTH SIDES OF ITS OWN QUESTION, and
     * two were: `getPauseActs` and `setCorrecaoDoJogador`. It walks the hooks the CARTRIDGE declares and
     * asks whether the boot passes each — so a field the cartridge simply never mentioned was never
     * looked for. Both had been added to the boot by §5 the same week.
     *
     * ⚠️ AND THEY ARE PRECISELY THE TWO THAT REACH A CHILD. `getPauseActs` is what lets the engine's
     * pause card be LEFT — `entrarNaBarra` calls `resume` before handing the directions to the
     * accessibility bar (ADR-0044 item 7). `setCorrecaoDoJogador` is what mounts the 🚥 icon, because
     * `iconesQueAccionam` will not mount one that cannot act. Dropping them would have cost nothing until
     * the shell began building its options from the cartridge, and then it would have cost both, silently.
     *
     * 📌 THE GAME-OWNED HALF IS WHAT IS COMPARED, not everything `createGame` takes: `host`,
     * `baixarPesados` and the declaration are the HOST's, which is what `GanchosDoCartucho` says by
     * omitting them.
     */
    const HOST_OWNED = ['declaration', 'host', 'baixarPesados'];
    const passed = createPinballOptions(options()) as unknown as Record<string, unknown>;
    const hooks = cartridgeHooks(options());

    const missing = Object.keys(passed)
      .filter((name) => !HOST_OWNED.includes(name))
      .filter((name) => !(name in hooks));

    expect(missing, 'the boot hands the engine these and the cartridge does not carry them')
      .toEqual([]);
  });

  test('⚠️ and `baixarPesados` is NOT among them, because it is the host’s', () => {
    /**
     * 🔴 IT WAS, FOR ONE DAY. `shell/cartridge` first declared its own hooks type and put the field in it,
     * on the reasoning that this game's `false` rests on a fact about this repository (ADR-0010). Engine
     * 9.0.0 published `GanchosDoCartucho` and settled it the other way: the field is absent from
     * `MetadeDoJogo`, so it belongs to whoever hosts the cartridge.
     *
     * ⚠️ AND THE DECISION DID NOT MOVE WITH THE FIELD. `shell/boot` still passes `false`, because this
     * repository's own standalone shell is the host today. What changes is who would answer it on the
     * platform of ADR-0117 — and there the answer is the platform's, which is what that record says.
     */
    expect(Object.keys(cartridgeHooks(options()))).not.toContain('baixarPesados');
    expect((createPinballOptions(options()) as unknown as Record<string, unknown>)['baixarPesados'],
      'the boot stopped passing it, which is a different change from this one').toBe(false);
  });

  test('🔴 and `sonarPlayers` is NOT among them either, because the engine stopped reading it', () => {
    /**
     * ⚠️ ADR-0258 (engine), note EB: `CreateGameOptions.sonarPlayers` LEAVES THE TYPE. It fed the sonar's
     * `getPlayers`, which only the engine's continuous guide read — and the guide left the engine for the
     * games that want one (note DZ). A field the engine does not read is a question the game believes it
     * answered.
     *
     * 📏 MEASURED BEFORE REMOVING IT, because the obvious worry was two guides sounding at once: this game
     * grew its own (`app/js/audio/guide.ts`) while still passing the option. Nothing in engine 9's `boot/`
     * or `core/loop` calls `updateGuide`, and this game's frame loop calls only its own — so the option was
     * already inert, and taking it out silences nothing.
     *
     * ⚠️ AND THE PLAYER ITSELF STAYS. `main.ts`'s one reused `sonarPlayer` is what `audio/guide` listens
     * for and what `engine.sonar.sonar(pl)` is rung with; what leaves is handing it to `createGame`.
     */
    /**
     * 🔴 AND IT IS ASKED OF A BOOT THAT SUPPLIES IT, which the first version of this case did not. The
     * minimal `options()` fixture names no `sonarPlayers`, and both builders include the field only when
     * the boot gave them one — so the case passed over two objects that never had it, measuring nothing.
     * The same shape bit this file in September over `isBlindMode`.
     */
    const offering = { ...options(), sonarPlayers: () => [{ i: 0, x: 1, y: 2 }] } as BootOptions;

    expect(Object.keys(cartridgeHooks(offering)), 'the game still offers a field the engine dropped')
      .not.toContain('sonarPlayers');
    expect(Object.keys(createPinballOptions(offering) as unknown as object),
      'the boot still hands it to `createGame`').not.toContain('sonarPlayers');
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

describe('⚠️ and the whole half can be handed over before the game exists', () => {
  /**
   * ⚠️ THE HOOKS HAVE THE SAME CIRCULARITY THE DECLARATION HAD, and it is easy to miss because they
   * look like configuration. `createGame` reads `isNavigable`, `setPhase` and
   * `getPauseActs` as VALUES at boot — and every one of them answers a question only a running game can:
   * is a menu on screen, what are the pause card's actions, where is the sonar's listener.
   *
   * So the same answer applies, and `shell/cartridge.delegatingCartridge` is where both halves meet: one
   * object a host holds from the start, pointed at each live game in turn.
   */
  const live = (over: Partial<LiveCartridge> = {}): LiveCartridge => ({
    table: options().table,
    isNavigable: () => true,
    isBlindMode: () => true,
    setPhase: () => {},
    pauseActs: () => ({ resume: () => {}, quit: () => {} }),
    setCorrection: () => {},
    ...over,
  });

  test('⚠️ published, every hook answers what the live game answers', () => {
    const port = delegatingCartridge('pt', new URLSearchParams(), options().host);
    port.publish(live());

    const hooks = port.hooks as unknown as Record<string, () => unknown>;
    expect(hooks['isNavigable']!(), 'a menu is open and the engine was told there is none').toBe(true);
    expect(hooks['isBlindMode']!(), 'blind mode is on and the engine was told it is off').toBe(true);
    expect(Object.keys((hooks['getPauseActs']!() ?? {}) as object).sort(),
      'the engine pause card has no actions, so entering the bar cannot leave it')
      .toEqual(['quit', 'resume']);
  });

  test('🔴 unpublished, it answers the SAFE end of every question', () => {
    /**
     * 🔴 AND "SAFE" IS A DIRECTION, NOT A PLACEHOLDER, which is the whole of this case. Between
     * `createGame` and `create(ctx)` the engine is mounted and no game is running, and each hook has one
     * answer that costs nothing and one that breaks something:
     *
     *   · `isNavigable` → FALSE. `ui/menu-nav` listens at WINDOW CAPTURE; answering true over a page with
     *     no menu is how this game lost its cabinet keys for a whole release.
     *   · `sonarPlayers` → EMPTY. A listener at a position no ball is near would narrate distances to a
     *     table that is not there yet.
     *   · `getPauseActs` → nothing to action, because a card whose «resume» does nothing is worse than a
     *     card with one item fewer: `entrarNaBarra` calls it to LEAVE, and a no-op leaves it on screen.
     */
    const port = delegatingCartridge('pt', new URLSearchParams(), options().host);

    const hooks = port.hooks as unknown as Record<string, () => unknown>;
    expect(hooks['isNavigable']!(), 'the engine takes the keyboard before a game exists').toBe(false);
    expect(() => hooks['setPhase']!(), 'a hook that throws takes the engine down with it').not.toThrow();
  });

  test('⚠️ and republishing moves every hook, not only the table', () => {
    /**
     * The half that makes it a delegate rather than a copy, asked of the hooks instead of the topology.
     * An implementation that read them once, at publish, would pass both cases above — and on the
     * platform's `unmount()`/`mount()` the engine would go on asking the game that had left.
     */
    const port = delegatingCartridge('pt', new URLSearchParams(), options().host);
    port.publish(live());
    port.publish(live({ isNavigable: () => false, isBlindMode: () => false }));

    const hooks = port.hooks as unknown as Record<string, () => unknown>;
    expect(hooks['isNavigable']!(), 'the engine is still asking the game that left').toBe(false);
  });

  test('⚠️ the delegating half is the SAME SHAPE as the one the boot hands over', () => {
    /**
     * 📌 THE CLAIM `tests/cartridge-halves` EXISTS FOR, ASKED OF THE NEW ROUTE. A delegate that
     * forwarded five of six hooks would pass every case above: the sixth would simply be absent, and an
     * absent hook is not an error — `createGame` defaults it and the game silently loses whatever it
     * bought. So the two key sets are compared, not sampled.
     */
    const port = delegatingCartridge('pt', new URLSearchParams(), options().host);
    port.publish(live());

    /**
     * 📌 COMPARED AGAINST A FULL GAME AND NOT THE MINIMAL FIXTURE. `cartridgeHooks` includes the
     * optional hooks only when the boot was given them, and `options()` above is a table and nothing
     * else — so it produces a SHORTER half than any real boot does. The delegate always forwards
     * everything, because a running game always answers everything. Comparing the two straight would
     * assert that the delegate is as incomplete as the fixture.
     */
    const full: BootOptions = {
      ...options(),
      isBlindMode: () => false,
      menuIsUp: () => false,
      setPhase: () => {},
      pauseActs: () => ({}),
      setCorrection: () => {},
    };

    expect(Object.keys(port.hooks).sort()).toEqual(Object.keys(cartridgeHooks(full)).sort());
  });
});

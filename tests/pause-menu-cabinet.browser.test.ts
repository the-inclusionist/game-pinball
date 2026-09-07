// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PAUSE MENU, DRIVEN BY THE MACHINE, IN A REAL BROWSER.
//
// ⚠️ THE DEV: "O jogo não tem pause com h/enter ainda, para acessar um menu com opções de voltar,
// editar controle, modos de acessibilidade para visão etc."
//
// He was right, and what was wrong took three separate defects to produce. Every one of them is
// invisible to a node test, because every one is about a real key reaching a real element:
//
//   1. ⚠️ THE ENGINE WAS EATING THE KEYS. `ui/menu-nav` attaches a WINDOW-CAPTURE keydown listener
//      whose first act is `if (!ctx.isNavigable()) return;` — and `shell/boot` answered `true` while
//      paused, so the engine consumed Enter, A, D, J, K and H before they reached anything at all.
//      Instrumented: the codes arrived at `window` and never reached `#game-region`. `KeyU` survived,
//      which is why the plunger alone worked and the failure looked arbitrary. What that bought was
//      nothing: this port draws its OWN pause menu, so the engine had nothing on screen to navigate.
//   2. ⚠️ `preventDefault` WAS CANCELLING THE PLATFORM'S OWN BUTTON PRESS. `ownCabinetKeys` cancelled
//      the default of every cabinet key it took, including on a screen that had no handler for it —
//      so `Enter` on a focused "Continuar" was swallowed before the game could toggle the pause AND
//      cancelled before the browser could click the button. It now cancels only what it handles.
//   3. ⚠️ AND THE MENU RE-FOCUSED ITSELF SIXTY TIMES A SECOND. `main`'s frame loop runs
//      `phase === 'paused' ? open() : close()` every frame, deliberately — and `open()` took the
//      focus every time. Measured: focusing the third entry moved the focus and a `focusin` put it
//      straight back on the first within the same frame. Every flipper press, every Tab and every
//      click on another entry was undone before a player could see it.
//
// ========================= AND THIS IS WHY IT IS A BROWSER TEST =========================
// `tests/shell-pause-menu.node.test.ts` drives this menu through a fake and checks far more of it.
// None of the three above is visible there: the first is a listener in another package on the real
// `window`, the second is the browser's own activation behaviour, and the third needs a frame loop
// and a live `document.activeElement`. The node suite was green throughout.
import { describe, test, expect, beforeAll } from 'vitest';
import { userEvent } from 'vitest/browser';

interface PinballDebug { phase: string }
const debug = (): PinballDebug => (window as unknown as { __pinball: PinballDebug }).__pinball;

const frames = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r(null)));
};
const menu = (): HTMLElement => document.getElementById('pinball-pause')!;
const shown = (el: HTMLElement): boolean => getComputedStyle(el).display !== 'none';
const under = (): string => document.activeElement?.textContent?.trim() ?? '';

/** The real sequence a player performs: title, table, launch. */
async function play(): Promise<void> {
  document.querySelector<HTMLElement>('.pinball-title button')?.click();
  await frames(3);
  document.querySelector<HTMLElement>('[data-table]')?.click();
  await frames(5);
  await userEvent.keyboard('{u}');
  await frames(6);
}

/**
 * ⚠️ EVERY TEST HERE PUTS THE GAME BACK IN PLAY FIRST, because the suite shuffles tests as well as
 * files and these four all move the phase. Written in order they passed; shuffled, the third started
 * on a paused game and read the pause menu's own entries as the flipper walk. `vite.config.ts` turned
 * shuffling on for exactly this, and this file was the next thing it caught.
 */
async function playing(): Promise<void> {
  for (let i = 0; i < 3 && debug().phase !== 'playing'; i++) {
    await userEvent.keyboard('{Enter}');
    await frames(4);
  }
  expect(debug().phase, 'could not get the game back into play').toBe('playing');
}

beforeAll(async () => {
  document.body.innerHTML = `
    <main id="game-region" tabindex="-1"></main>
    <div id="sr-status" role="status" aria-live="polite"></div>
    <div id="sr-alert" role="alert" aria-live="assertive"></div>
    <svg id="cvd-filters" width="0" height="0" aria-hidden="true" focusable="false"></svg>
  `;
  await import('../app/js/main.js');
  await frames(10);
  await play();
});

describe('start opens the pause menu and start closes it', () => {
  test.each(['{Enter}', '{h}'])('⚠️ %s pauses, and pressing it again comes back', async (key) => {
    await playing();

    await userEvent.keyboard(key);
    await frames(4);
    expect(debug().phase, `${key} paused it`).toBe('paused');
    expect(shown(menu()), 'and the menu is on screen').toBe(true);
    expect(under(), 'with the cursor on the first entry').toBe('Continuar');

    await userEvent.keyboard(key);
    await frames(4);

    // ⚠️ THE HALF THAT WAS BROKEN. The game paused and could not be un-paused.
    expect(debug().phase, `${key} did not come back`).toBe('playing');
    expect(shown(menu()), 'and the menu is put away').toBe(false);
  });
});

describe('the flippers walk it and the plunger takes an entry', () => {
  test('⚠️ the cursor moves, and stays where it was put', async () => {
    await playing();
    await userEvent.keyboard('{Enter}');
    await frames(4);
    const walk: string[] = [under()];

    for (const key of ['{d}', '{d}', '{a}']) {
      await userEvent.keyboard(key);
      // Several frames on purpose: the loop reopens the menu on every one of them, and the defect
      // this catches is the focus being taken back between two of them.
      await frames(4);
      walk.push(under());
    }

    expect(walk).toEqual(['Continuar', 'Cores da mesa', 'Acessibilidade visual', 'Cores da mesa']);

    // And back out, so the next test starts where this one found the game.
    await userEvent.keyboard('{Enter}');
    await frames(4);
    expect(debug().phase).toBe('playing');
  });

  test('⚠️ and the plunger takes the entry under the cursor', async () => {
    // The palette, which is the entry the Dev asked to be reachable from here rather than from a
    // footer — and the one whose old behaviour resumed the game behind it.
    await playing();
    await userEvent.keyboard('{h}');
    await frames(4);
    await userEvent.keyboard('{d}');
    await frames(3);
    expect(under(), 'the cursor reached the palette entry').toBe('Cores da mesa');

    await userEvent.keyboard('{u}');
    await frames(5);

    expect(shown(document.getElementById('pinball-options')!), 'the palette opened').toBe(true);
    expect(debug().phase, '⚠️ and the game did NOT resume behind it').toBe('paused');
  });
});

describe('⚠️ and the vision correction the plan promised actually reaches the screen', () => {
  /**
   * The plan: "o pinball herda de graça os filtros de daltonismo (`render/cvd-matrices`), o alto
   * contraste, o CRT e o pipeline multi-tela — nada disso precisa ser escrito." It was never
   * collected: `createGame` returns `aplicarFiltroDeVisao` and this port referenced it nowhere, so
   * the six filters went into `<svg id="cvd-filters">` at every boot and nothing ever asked for one.
   *
   * ⚠️ AND THIS IS THE ONLY PLACE THAT CAN ASK. `shell/vision` is pure and its node tests check the
   * catalogue, the CSS strings and the storage. Whether the engine then puts that string on the
   * element the player is looking at is a fact about a real document.
   */
  test('choosing a correction puts a filter on the world, and none takes it off', async () => {
    await playing();
    await userEvent.keyboard('{Enter}');
    await frames(4);
    await userEvent.keyboard('{d}{d}');
    await frames(4);
    expect(under(), 'the cursor reached the vision entry').toBe('Acessibilidade visual');

    await userEvent.keyboard('{u}');
    await frames(4);
    const dialog = document.getElementById('pinball-vision')!;
    expect(shown(dialog), 'the vision dialog opened').toBe(true);

    const choose = (label: string): void => {
      const button = [...dialog.querySelectorAll('button')].find((b) => b.textContent?.includes(label));
      expect(button, `no choice called ${label}`).toBeDefined();
      button!.click();
    };
    const world = document.querySelector<HTMLElement>('#game-region canvas')!.parentElement!;

    choose('deuteranopia');
    await frames(3);
    // ⚠️ THE ENGINE'S OWN url(), NOT A COLOUR THIS GAME COMPUTED. The filter is an SVG matrix the
    // engine installed; this game only names it.
    expect(world.style.filter || document.getElementById('game-region')!.style.filter)
      .toContain('cvd-fix-deuter');

    choose('Sem correção');
    await frames(3);
    expect(world.style.filter || document.getElementById('game-region')!.style.filter)
      .not.toContain('cvd-fix');
  });
});

describe('⚠️ and it FITS, because the screen is 320x180 and nothing here may scroll', () => {
  /**
   * ⚠️ THE DEV REFUSED SCROLLING BY NAME once already: "Cores da mesa deveria estar no menu de pausa,
   * não num rodapé que exige rolagem da tela." A pause menu that has to be scrolled is the same
   * complaint one screen further in — and it is what happened, because entries were added to this
   * list three times without anybody measuring the list.
   *
   * Found by screenshotting the menu at the real size and looking: the seventh entry was clipped by
   * the bottom edge. Every test in this file passed, because they all ask about behaviour and a
   * button that is off the screen still takes the focus and still fires.
   *
   * ⚠️ AND `scrollHeight > clientHeight` IS THE WHOLE QUESTION, which is why this is not a pixel
   * count fitted to seven entries: it stays true when an eighth is added, and it is what "does not
   * scroll" means.
   */
  test('every entry is inside the screen', async () => {
    await playing();
    await userEvent.keyboard('{Enter}');
    await frames(4);

    const root = menu();
    expect(root.scrollHeight, `the menu is ${root.scrollHeight}px in a ${root.clientHeight}px screen`)
      .toBeLessThanOrEqual(root.clientHeight);

    const bottom = root.getBoundingClientRect().bottom;
    const spilled = [...root.querySelectorAll('button')]
      .filter((b) => b.getBoundingClientRect().bottom > bottom + 0.5)
      .map((b) => b.textContent?.trim());

    expect(spilled, 'these entries are past the bottom edge').toEqual([]);

    await userEvent.keyboard('{Enter}');
    await frames(4);
  });
});

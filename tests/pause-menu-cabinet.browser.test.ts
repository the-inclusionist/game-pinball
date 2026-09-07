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

    expect(walk).toEqual(['Continuar', 'Cores da mesa', 'Trocar de mesa', 'Cores da mesa']);

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

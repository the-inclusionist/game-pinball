// SPDX-License-Identifier: AGPL-3.0-or-later
// NOTHING THIS GAME SHOWS MAY BE BIGGER THAN THE SCREEN IT SHOWS IT ON.
//
// ⚠️ DECISION 4 OF THE PLAN, HONOURED TO THE LETTER: "Tela 320x180 — Pilar 5 cumprido ao pé da letra,
// nenhum ADR de exceção é devido." Every menu, dialog and screen in this game is laid out inside that,
// and until this file nothing checked that any of them fitted.
//
// ⚠️ AND THE COST CAME DUE. The pause menu grew from four entries to seven over one session — the
// palette, then the vision correction, then the controls — and came out 194 pixels tall in a
// 180-pixel screen, with "Encerrar partida" clipped by the bottom edge. It was found by taking a
// screenshot and looking, which is how the last four layout defects in this repository were found.
//
// ⚠️ AND EVERY BEHAVIOURAL TEST PASSED THROUGHOUT, which is why this file has to exist separately.
// `tests/pause-menu-cabinet` walks that menu with the cabinet and reads its labels; a button off the
// bottom of the screen still takes the focus, still fires and still reports its text. Nothing about
// how a menu BEHAVES can see where it is.
//
// ⚠️ AND THE DEV HAS REFUSED SCROLLING BY NAME: "Cores da mesa deveria estar no menu de pausa, não
// num rodapé que exige rolagem da tela." So the question is not "how tall is it" — a number fitted to
// today's entries — but "does anything have to be scrolled to be reached", which stays the right
// question when an eighth entry is added.
import { describe, test, expect, beforeAll } from 'vitest';
import { userEvent } from 'vitest/browser';
import { TOPBAR_MARKUP } from './helpers/page.js';
import { pinLanguage } from './helpers/pin-language.js';

interface PinballDebug { backdropLoaded: boolean; phase: string }
const debug = (): PinballDebug => (window as unknown as { __pinball: PinballDebug }).__pinball;

const frames = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r(null)));
};
const region = (): HTMLElement => document.getElementById('game-region')!;

/**
 * Anything laid out past the screen's own edges.
 *
 * ⚠️ MEASURED ON THE BOXES, NOT ON `overflow`. The region clips visually, so a clipped element is
 * invisible and perfectly happy: `getBoundingClientRect` still reports where it was PUT, which is the
 * only way to see something that has been cut off rather than something that chose to be hidden.
 */
function spilling(): string[] {
  const box = region().getBoundingClientRect();
  return [...region().querySelectorAll<HTMLElement>('*')]
    .filter((el) => el.offsetParent !== null)
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.height > 0 && r.width > 0 && (r.bottom > box.bottom + 0.5 || r.right > box.right + 0.5);
    })
    .map((el) => `${el.tagName}.${el.className.split(' ')[0]} "${el.textContent?.trim().slice(0, 18)}"`);
}

beforeAll(async () => {
  document.body.style.margin = '0';
  /**
   * ⚠️ THE REGION IS WHATEVER `fitCanvas` MAKES IT, and every measurement here is relative to it. The
   * markup below asks for 320x180 and does not get it: the Dev made 640x360 a floor — "obrigatório e
   * não negociável" — so `main` overwrites the region's size on boot and this runs at 2x.
   *
   * That changes nothing about the question. Every screen is laid out in container units against the
   * region's own box, so "does anything spill out of the game's rectangle" is the same question at
   * any whole scale — and asking it at the smallest one the game is ever shown at is asking it where
   * it is hardest to satisfy.
   */
  document.body.innerHTML = `${TOPBAR_MARKUP}
    <main id="game-region" tabindex="-1" style="position:relative;width:320px;height:180px;overflow:hidden"></main>
    <div id="sr-status" role="status" aria-live="polite"></div>
    <div id="sr-alert" role="alert" aria-live="assertive"></div>
    <svg id="cvd-filters" width="0" height="0" aria-hidden="true" focusable="false"></svg>
  `;
  pinLanguage();
  await import('../app/js/main.js');
  for (let i = 0; i < 600 && !debug().backdropLoaded; i++) await frames(1);
  await frames(5);
});

describe('every screen fits the 320x180 it is drawn on', () => {
  /**
   * ⚠️ ONE TEST, BECAUSE THE WALK IS ONE WALK. Written as seven, this file passed — and under the
   * suite's own shuffle (`vite.config.ts` turns it on for tests as well as files) the seven ran in
   * whatever order and checked the title screen while the pause menu was up. `CLAUDE.md` records the
   * rule this breaks: "a test that passes in the order it was written has not been tested."
   *
   * Navigating to each screen independently was the alternative and is worse: it would mean seven
   * boots, or seven paths back to a known state, to ask one question that is the same at every step.
   * The assertion names the screen, so a failure is as specific as seven tests would have been.
   */
  test('⚠️ the title, the selector, the table, the pause menu and its three dialogs', async () => {
    const spilled: string[] = [];
    const look = (screen: string): void => {
      for (const what of spilling()) spilled.push(`${screen}: ${what}`);
    };

    look('title');

    document.querySelector<HTMLElement>('.pinball-title button')?.click();
    await frames(4);
    // The one most likely to break next: the catalogue grows, and a table added is a row added.
    look('selector');

    document.querySelector<HTMLElement>('[data-table]')?.click();
    await frames(5);
    // ⚠️ THE NEW SCREEN GETS LOOKED AT, not walked past. Eight number buttons, a heading and a
    // sentence of explanation is the second most crowded screen in this game after the alphabet, and
    // it arrived in the same session as the thumbnails that pushed "Voltar" off the selector.
    look('mission screen');

    document.querySelector<HTMLElement>('[data-times]')?.click();
    await frames(5);
    look('table with the HUD');

    await userEvent.keyboard('{u}');
    await frames(6);
    await userEvent.keyboard('{Enter}');
    await frames(5);
    expect(debug().phase, 'the game paused').toBe('paused');
    // ⚠️ WHERE THIS WAS FOUND: seven entries, 194 pixels, in a 180-pixel screen.
    look('pause menu');

    // ⚠️ `{s}` WALKS AND `{j}` CHOOSES. The Dev took the paddles off the directions and gave
    // them the menus — see `shell/controls.MENU_BINDINGS`. `{u}` is the plunger and nothing else.
    await userEvent.keyboard('{s}');
    await frames(3);
    await userEvent.keyboard('{j}');
    await frames(5);
    look('palette');
    /**
     * ⚠️ CLOSED BY ESCAPE, NOT BY POKING THE ELEMENT. This test first set `hidden = true` directly and
     * left `style.display` at `flex` — the dialog stayed on screen while reporting itself closed, and
     * the walk below then focused an ancestor instead of a menu entry. `close()` keeps the two in
     * step because an inline `display` beats `[hidden]`; nothing else may set one without the other.
     */
    await userEvent.keyboard('{Escape}');
    await frames(4);

    await userEvent.keyboard('{s}{s}');
    await frames(3);
    await userEvent.keyboard('{j}');
    await frames(5);
    look('vision');
    await userEvent.keyboard('{Escape}');
    await frames(4);

    await userEvent.keyboard('{s}{s}{s}');
    await frames(3);
    await userEvent.keyboard('{j}');
    await frames(5);
    // Its rows carry a name AND its keys, so they are the widest thing in the game.
    look('control editor');
    await userEvent.keyboard('{Escape}');
    await frames(4);

    /**
     * ⚠️ AND THE ALPHABET, WHICH IS THIRTY-NINE BUTTONS — by far the most of any screen here, and the
     * one whose layout was already measured once: ten columns came to exactly 180 pixels in a
     * 180-pixel screen, which is a layout that overflows the moment a reader's own type setting is
     * larger than the default. Thirteen columns is three rows. This is what keeps that true.
     *
     * Reached the way a player reaches it: the last entry of the pause menu ends the game, and a
     * score that places is offered the board.
     */
    /**
     * ⚠️ WALKED BY WHAT IS UNDER THE CURSOR, NOT BY COUNTING PRESSES. Counting failed: closing a
     * dialog calls `restoreFocus`, which puts the cursor on the entry that opened it, and the frame
     * loop then reopens the menu and sends the cursor home — so where six presses land depends on
     * which of those two won the frame. Asking is deterministic and says what it wants.
     */
    const under = (): string => document.activeElement?.textContent?.trim() ?? '';
    for (let i = 0; i < 10 && under() !== 'Encerrar partida'; i++) {
      await userEvent.keyboard('{s}');
      await frames(2);
    }
    expect(under(), 'the cursor reached the entry that ends the game').toBe('Encerrar partida');
    await userEvent.keyboard('{j}');
    await frames(6);
    const board = document.getElementById('pinball-high-score')!;
    expect(getComputedStyle(board).display, 'the board was offered').not.toBe('none');
    look('high score alphabet');

    expect(spilled, 'these are laid out past the edge of the screen').toEqual([]);
  });
});

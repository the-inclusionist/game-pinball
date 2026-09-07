// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PAGE AROUND THE GAME, WHICH WAS NEVER STYLED AT ALL.
//
// ⚠️ THE DEV, ON OPENING IT: "Ao entrar no jogo temos laterais brancas horríveis."
//
// Measured in the running page before changing anything: `document.styleSheets.length === 0`. Not a
// missing rule — NO STYLESHEET, this game's own or the engine's. `app/index.html` linked none and
// nothing imported one. Everything visible was either inline-styled by the module that built it, or
// the browser's default.
//
// So what the player got around a 320x180 canvas was:
//
//   · the user agent's white `background` on `html` and `body`, on every side of the game;
//   · the user agent's 8px `margin` on `body`, as a white band above it;
//   · and `#sr-status` — a live region for a SCREEN READER — rendered as ordinary text under the
//     game, reading "Segure para esticar o lançador." to everybody.
//
// ⚠️ THE LAST ONE IS THE WORST AND IS NOT A LOOKS PROBLEM. `sr-status` and `sr-alert` exist so a
// player who cannot see the screen is told what changed. Visible, they are a caption nobody asked
// for; `display: none` would remove them from the accessibility tree and take the announcements away
// from the one person they are for. The clip technique is the only one that does both.
import { describe, test, expect, beforeAll } from 'vitest';

const frames = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r(null)));
};

beforeAll(async () => {
  document.head.innerHTML = '';
  document.body.innerHTML = `
    <main id="game-region" tabindex="-1"></main>
    <div id="sr-status" role="status" aria-live="polite">Pausado</div>
    <div id="sr-alert" role="alert" aria-live="assertive"></div>
    <svg id="cvd-filters" width="0" height="0" aria-hidden="true" focusable="false"></svg>
  `;
  await import('../app/js/main.js');
  await frames(6);
});

const seen = (id: string): CSSStyleDeclaration => getComputedStyle(document.getElementById(id)!);

describe('the page has chrome of its own', () => {
  test('⚠️ there is a stylesheet at all, which there was not', () => {
    // The whole finding in one assertion. Everything below is a consequence of this being zero.
    expect(document.styleSheets.length, 'no stylesheet reached the page').toBeGreaterThan(0);
  });

  test('⚠️ and the page is not white around the game', () => {
    const paper = getComputedStyle(document.body).backgroundColor;

    // Transparent counts as white: it is what the user agent paints under it.
    expect(paper, 'the body is transparent, so the page is white').not.toBe('rgba(0, 0, 0, 0)');
    expect(paper, 'the body is white').not.toBe('rgb(255, 255, 255)');
  });

  test('and there is no white band above it from the default body margin', () => {
    expect(getComputedStyle(document.body).marginTop).toBe('0px');
  });
});

describe('⚠️ the live regions are for a reader, not for the page', () => {
  for (const id of ['sr-status', 'sr-alert']) {
    test(`${id} is out of sight`, () => {
      const box = document.getElementById(id)!.getBoundingClientRect();

      // One pixel square at most: the clip technique's own footprint.
      expect(box.width, `${id} is ${box.width}px wide on screen`).toBeLessThanOrEqual(1);
      expect(box.height, `${id} is ${box.height}px tall on screen`).toBeLessThanOrEqual(1);
    });

    test(`⚠️ but ${id} is still THERE for the reader`, () => {
      /**
       * The half that matters. `display: none` and `visibility: hidden` both hide it from a screen
       * reader too, which would take the announcements away from the only person they are for —
       * and would leave every one of them silently doing nothing, which is this repository's most
       * frequent defect wearing an accessibility hat.
       */
      expect(seen(id).display, `${id} is display:none`).not.toBe('none');
      expect(seen(id).visibility, `${id} is visibility:hidden`).not.toBe('hidden');
      expect(document.getElementById(id)!.hidden, `${id} carries the hidden attribute`).toBe(false);
    });
  }
});

describe('⚠️ and the keyboard does not die when the player clicks the page', () => {
  /**
   * ⚠️ THE DEV: "o START não funciona para pausar e abrir o menu AINDA." Measured in the running
   * game: press START with the region focused and the phase changes; click anywhere on the page
   * first — the dark area around the game — and `document.activeElement` is `BODY`, and START does
   * NOTHING. Not an error, not a warning. The key simply stops working, and stays stopped.
   *
   * `bindPinballControls` binds to `#game-region` and never to `window`, which is the engine's own
   * rule and the right one — a game that binds the whole document steals keys from the page around
   * it. `CLAUDE.md` records the ancestor of this defect from the first time it bit: "a keydown on the
   * body reached nothing. Every key did nothing until the player happened to click the canvas." The
   * fix then was to focus the region when a table starts. Nothing kept it there.
   *
   * ⚠️ AND A CLICK INSIDE THE GAME MUST NOT BE TOUCHED, which is the whole difficulty: the pause
   * menu, the alphabet and the dialogs are real `<button>`s that take the focus when clicked, and a
   * rule that dragged it back to the region would break every one of them.
   */
  const region = (): HTMLElement => document.getElementById('game-region')!;

  test('clicking outside the game hands the keyboard back to it', async () => {
    // ⚠️ BLURRED EXPLICITLY, because that is what the click DID. Measured in the running page:
    // clicking the area around the game leaves `document.activeElement` as `BODY`. A test that only
    // clicks may leave the focus where it was and pass while proving nothing — this one did.
    region().focus();
    region().blur();
    expect(document.activeElement, 'the focus really left the game').not.toBe(region());

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await frames(2);

    expect(document.activeElement, 'the focus is back inside the game').toBe(region());
  });

  test('⚠️ but clicking a control INSIDE the game leaves the focus on it', async () => {
    const button = document.createElement('button');
    button.textContent = 'inside';
    region().appendChild(button);
    button.focus();

    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await frames(2);

    expect(document.activeElement, 'the game stole the focus from its own button').toBe(button);
    button.remove();
  });
});

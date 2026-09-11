// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PAUSE MENU IS REACHABLE WHENEVER A TABLE IS ON THE SCREEN — NOT ONLY WHILE A BALL IS MOVING.
//
// ⚠️ THE DEV: "Troquei de mesa e o menu de pausa já se tornou inacessível."
//
// ========================= WHAT SWITCHING TABLES ACTUALLY DOES =========================
// The pause menu's "Mesas" entry calls `leaveGame()` and shows the selector; picking a table that is
// not the booted one reloads the page with `?table=`, and `main` boots straight onto that table with
// the ball parked on the plunger. So after switching, the player is looking at a table with
// `phase === 'title'` — and `togglePause` read:
//
//     if (phase === 'playing') enterPhase('paused');
//     else if (phase === 'paused') enterPhase('playing');
//
// which is nothing at all in that state. The key was dead until the ball was launched, and the pause
// menu is the ONLY way back to the selector, so the player who had just used it to change tables could
// not use it again.
//
// ⚠️ AND SWITCHING TABLES IS ONLY THE RELIABLE WAY IN. `phase` is `'title'` in three places: before the
// first launch, between balls after a drain, and after the last ball is lost. The last is the worst of
// them — a finished game refuses the plunger by design ("a finished game does not get another ball"),
// so the exit was a page reload.
//
// ========================= WHY RESUMING MAY NOT ASSUME 'playing' =========================
// The obvious fix — pause from any phase, resume to `'playing'` — trades this defect for a worse one.
// `launch` is guarded by `if (phase !== 'playing')`, so a game resumed into `'playing'` with the ball
// still on the plunger refuses the plunger key for ever. Pausing has to remember what it interrupted.
// The walk below presses the plunger after resuming, which is what holds that.
import { describe, test, expect, beforeAll } from 'vitest';
import { userEvent } from 'vitest/browser';
import { PAGE_MARKUP } from './helpers/page.js';
import { pinLanguage } from './helpers/pin-language.js';

interface PinballDebug { backdropLoaded: boolean; phase: string }
const debug = (): PinballDebug => (window as unknown as { __pinball: PinballDebug }).__pinball;

const frames = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r(null)));
};
const region = (): HTMLElement => document.getElementById('game-region')!;
const menu = (): HTMLElement => document.getElementById('pinball-pause')!;
const shown = (el: HTMLElement): boolean => getComputedStyle(el).display !== 'none';

beforeAll(async () => {
  document.body.innerHTML = PAGE_MARKUP;
  pinLanguage();
  await import('../app/js/standalone.js');
  for (let i = 0; i < 600 && !debug().backdropLoaded; i++) await frames(1);
});

describe('pause reaches the menu whenever there is a table to pause', () => {
  /**
   * ⚠️ ONE WALK, FOR THE REASON `tests/screens-fit` IS ONE WALK. The suite shuffles tests as well as
   * files, and each step here is the previous step's state: three tests would each have had to
   * navigate back to a known screen to ask one question that is the same question at every step.
   */
  test('⚠️ on the table before the first launch, and never on the screens before it', async () => {
    // ---- the selector: a key that reaches the game, and a game that is not running ----
    document.querySelector<HTMLElement>('.pinball-title button')?.click();
    await frames(4);
    /**
     * ⚠️ THE FOCUS IS PUT ON THE REGION ON PURPOSE, and without it this assertion could not fail.
     * Clicking the title button leaves the focus on that button; hiding it drops the focus to `body`,
     * where a keydown never reaches a listener on `#game-region`. Pressing Enter then proves only
     * that a key went nowhere. Focused, the key really arrives at `togglePause` and the refusal is
     * `togglePause`'s own.
     */
    region().focus();
    await userEvent.keyboard('{Enter}');
    await frames(4);
    expect(shown(menu()), 'the pause menu opened over the table SELECTOR, where no game is running')
      .toBe(false);

    // ---- the table, ball parked: the state switching tables lands in ----
    document.querySelector<HTMLElement>('[data-table]')?.click();
    await frames(5);
    // ⚠️ AND THE NUMBER, which is the screen the Dev put between the table and the game.
    document.querySelector<HTMLElement>('[data-times]')?.click();
    await frames(6);
    expect(debug().phase, 'the ball should still be waiting on the plunger').toBe('title');

    await userEvent.keyboard('{Enter}');
    await frames(4);
    expect(shown(menu()), 'START did nothing on a table whose ball has not been launched yet'
      + ' — which is exactly where changing tables leaves the player').toBe(true);
    expect(debug().phase, 'and the game says it is paused').toBe('paused');

    // ---- and coming back leaves the plunger working ----
    await userEvent.keyboard('{Enter}');
    await frames(4);
    expect(shown(menu()), 'the menu stayed up after START was pressed again').toBe(false);
    expect(debug().phase, 'resuming put the game into play with the ball still on the plunger,'
      + ' and `launch` refuses to fire while the phase is "playing"').toBe('title');

    await userEvent.keyboard('{u}');
    await frames(6);
    expect(debug().phase, 'the plunger is dead after a pause taken before the launch').toBe('playing');
  });
});

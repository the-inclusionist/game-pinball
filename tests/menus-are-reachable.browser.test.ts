// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ENGINE'S MENU LAYER IS SWITCHED ON, AND THE CABINET STILL REACHES THE TABLE.
//
// ⚠️ `isNavigable: () => false` SWITCHED OFF EVERYTHING THE ENGINE HAS FOR MENUS. `ui/menu-nav` attaches a
// WINDOW-CAPTURE keydown listener whose first act is `if (!ctx.isNavigable()) return;`, so with a constant
// `false` the engine never walked a menu, never closed one with Escape, and never handed the directional to
// the accessibility bar. `shell/choice-dialog` records the visible half of that: it registers itself in the
// engine's escape chain, and Escape did nothing.
//
// ========================= WHY IT WAS OFF, AND WHY IT CAN COME BACK =========================
// 📏 With the predicate true, `menuNavKey` reached `sharedDialogOpen()` — which answered with this game's
// pause menu AT EVERY INSTANT, because four of five screens hid themselves with `display` and the engine
// reads `hidden`. It consumed the key, called `navDialog` on a `display:none` element whose `menuItems()`
// is empty, and did nothing: "the engine consumed Enter, A, D, J, K and H before they reached anything at
// all". §6 fixed that and `tests/engine-sees-our-screens` is what holds it.
//
// ⚠️ AND THE ENGINE'S OWN GUARD IS THE OTHER HALF. `menu-nav` consumes a key ONLY when there is something
// to navigate, so a true predicate over a page with nothing open costs a ball in play exactly nothing.
// This file is what says that out loud rather than trusting it.
//
// ========================= THE TRAP THAT MUST NOT SHIP =========================
// ⚠️ `navPause`'s ROOT-LEVEL "NO" CALLS `ctx.setPhase('playing')`, and `createGame` defaults `setPhase` to
// `() => {}` for a game that declares none. Reopening the predicate without declaring it gives a child a
// menu with NO WAY OUT — reached by exactly the child who most needs one. One line, and the case below is
// what refuses to let it be forgotten.
import { describe, test, expect, beforeAll } from 'vitest';
import { userEvent } from 'vitest/browser';
import { PAGE_MARKUP } from './helpers/page.js';
import { pinLanguage } from './helpers/pin-language.js';

interface PinballDebug {
  phase: string;
  setPhase(next: string): void;
  plungerPull: number;
  engineSeesOpen: HTMLElement | null;
  flippers: readonly { motion: number; angle: number }[];
}
const debug = (): PinballDebug => (window as unknown as { __pinball: PinballDebug }).__pinball;

const frames = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r(null)));
};

const region = (): HTMLElement => document.getElementById('game-region')!;

beforeAll(async () => {
  document.body.innerHTML = PAGE_MARKUP;
  pinLanguage();
  await import('../app/js/main.js');
  await frames(10);
});

describe('⚠️ with nothing open, the cabinet still owns every one of its keys', () => {
  /**
   * ⚠️ THE REGRESSION GATE, AND IT IS THE REASON THE OTHERS ARE ALLOWED TO EXIST. The defect this whole
   * section is reopening was "the engine ate the flippers", and a green suite that never pressed a flipper
   * with the engine listening would be exactly the evidence that was missing the first time.
   *
   * 📏 It cannot be observed red today, because §6 landed first and removed the cause. It is proved by
   * mutation instead, and the mutation is recorded in the commit: put `shell/pause-menu` back to hiding
   * itself with `display` alone, and this file fails — the engine holds a menu that is not there, consumes
   * the key, and the flipper never moves.
   */
  /** Where the paddles are right now, as one comparable reading. */
  const angles = (): number[] => debug().flippers.map((f) => f.angle);

  test.each([
    ['j', 'left'],
    ['7', 'left'],
    ['y', 'left'],
    ['k', 'right'],
    ['8', 'right'],
    ['o', 'right'],
  ])('\u26a0\ufe0f %s still works the %s flipper', async (key, side) => {
    debug().setPhase('playing');
    await frames(3);
    region().focus();

    const resting = angles();
    await userEvent.keyboard(`{${key}>}`);
    await frames(3);
    const pressed = angles();
    await userEvent.keyboard(`{/${key}}`);
    await frames(3);

    /**
     * \u26a0\ufe0f THE ANGLE AND NOT A FLAG, because a flag is what the game believes and the angle is what the
     * physics did. The defect being guarded against is a key that never arrives, and a key that never
     * arrives leaves the paddle exactly where it was.
     */
    expect(pressed, `${key} did not move the ${side} paddle`).not.toEqual(resting);
  });

  test('⚠️ and the plunger still charges, which is the key that survived the original defect', async () => {
    // `KeyU` was the one key that worked while the engine was eating the rest, because `menuKeyIntent`
    // has no intent for it — which is why the failure looked arbitrary rather than total.
    debug().setPhase('playing');
    await frames(2);
    region().focus();

    await userEvent.keyboard('{u>}');
    await frames(6);
    const pulled = debug().plungerPull;
    await userEvent.keyboard('{/u}');

    expect(pulled, 'the plunger did not draw back').toBeGreaterThan(0);
  });
});

describe('⚠️ and Escape closes the palette — whoever it is that closes it', () => {
  test('the palette opens from the pause menu and Escape puts it away', async () => {
    /**
     * 🔴 THIS CASE WAS WRITTEN TO BE RED AND IT WAS GREEN, WHICH CORRECTED THE PLAN.
     *
     * §8 predicted "Escape over the palette closes it — red today", on `shell/choice-dialog`'s own header:
     * it registers in the engine's escape chain with `inEscapeChain: true`, and "pressing Escape over the
     * open dialog did nothing". Measured here: it closes, today, with `isNavigable` still `false`.
     *
     * ⚠️ BECAUSE THE GAME CLOSES IT ITSELF. `choice-dialog.ts:232` binds its own `keydown` and says why in
     * the paragraph above it — "Escape is handled HERE, not by the engine, though this dialog is registered
     * with the engine's chain and should be". The header's sentence is about a ball in play, where the
     * engine's chain does not run; with the dialog OPEN, the game's own listener has always answered.
     *
     * 📌 SO THIS CASE IS NOT EVIDENCE ABOUT THE ENGINE and does not claim to be. It is the REGRESSION gate
     * for the moment the game's listener comes off: a player must go on being able to leave this dialog
     * whoever is holding the key. What §8 actually buys the palette is the directional, the pad, the
     * «N of M» announcement and the accessibility bar — not this.
     */
    debug().setPhase('paused');
    await frames(4);

    /** The pause menu's own entries, in `PAUSE_ENTRIES` order: resume, colours, vision, … */
    const entries = [...document.querySelectorAll<HTMLElement>('#pinball-pause button')];
    entries[1]!.click();
    await frames(4);

    const palette = document.getElementById('pinball-options')!;
    expect(palette.hidden, 'the palette did not open').toBe(false);

    await userEvent.keyboard('{Escape}');
    await frames(3);

    expect(palette.hidden, 'Escape still does nothing').toBe(true);
  });
});

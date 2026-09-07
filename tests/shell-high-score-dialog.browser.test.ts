// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ALPHABET, IN A REAL BROWSER, BECAUSE THE CURSOR IS THE FOCUS.
//
// ⚠️ THE DEV ASKED FOR AN ALPHABET DRIVEN BY THE CABINET: "que o jogador escreva usando os botões do
// controle, não pelo teclado." The design that answers it puts the cursor ON the focus rather than
// beside it, quoting whackwhack's rule that real `<button>`s mean Tab, Enter and Space work because
// the platform makes them work.
//
// ========================= WHICH IS EXACTLY WHAT A FAKE DOM CANNOT CHECK =========================
// `tests/shell-high-score-dialog.node.test.ts` drives the same dialog through a hand-written fake and
// checks far more of it, faster. What that fake cannot model is the claim this design rests on:
//
//   · `document.activeElement` actually being the key under the cursor. The fake counts a `focus()`
//     call, which is satisfied whether or not the element could take focus at all — and `focus()` on
//     something inside a `display: none` subtree does nothing.
//   · Enter and Space activating a `<button>`. Nothing in this module implements that; the PLATFORM
//     does, and "the platform does it" is a claim about somebody else's code that costs one test.
//   · The focus listener writing the cursor back when TAB moves it. That is the line that keeps the
//     cursor and the focus one fact, and a fake that never moves focus by itself cannot exercise it.
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { userEvent } from 'vitest/browser';
import { mountHighScoreDialog, HIGH_SCORE_DIALOG_ID } from '../app/js/shell/high-score-dialog.js';
import { type HighScoreStore } from '../app/js/control/high-score.js';

let host: HTMLElement;

const memory = (): HighScoreStore => {
  const held: Record<string, string> = {};
  return { getItem: (k) => held[k] ?? null, setItem: (k, v) => { held[k] = v; } };
};

function build() {
  const dialog = mountHighScoreDialog({
    doc: document, host, store: memory(), t: (key) => key,
  });
  return { dialog, root: document.getElementById(HIGH_SCORE_DIALOG_ID)! };
}

const keys = (): HTMLButtonElement[] =>
  [...document.getElementById(HIGH_SCORE_DIALOG_ID)!.querySelectorAll('button')];
const cursor = (): HTMLElement => document.activeElement as HTMLElement;
const spelled = (): string =>
  document.querySelector<HTMLElement>('[data-name="true"]')!.textContent ?? '';

beforeEach(() => {
  host = document.createElement('div');
  host.style.position = 'relative';
  host.style.width = '320px';
  host.style.height = '180px';
  document.body.appendChild(host);
});

afterEach(() => {
  host.remove();
});

describe('the alphabet in a real browser', () => {
  test('⚠️ the focus really lands on the first key, which a hidden element cannot take', () => {
    // `offer` unhides the dialog and THEN focuses. Swapping those two lines passes every node test
    // and fails this one, because `focus()` on an element inside `display: none` is a no-op and the
    // player is left holding a cabinet that moves nothing.
    const { dialog } = build();

    dialog.offer(1000);

    expect(cursor().tagName).toBe('BUTTON');
    expect(cursor().textContent).toBe('A');
    expect(cursor().getAttribute('data-cursor')).toBe('true');
  });

  test('the flippers move the real focus, and it wraps', async () => {
    const { dialog } = build();
    dialog.offer(1000);

    await userEvent.keyboard('{d}');
    expect(cursor().textContent, 'the right flipper').toBe('B');

    await userEvent.keyboard('{a}{a}');
    expect(cursor().textContent, 'two back from B, wrapping past A').toBe('✓');
  });

  test('the plunger spells with the key the focus is on', async () => {
    const { dialog } = build();
    dialog.offer(1000);

    await userEvent.keyboard('{u}{d}{u}');

    expect(spelled()).toBe('AB');
  });

  test('⚠️ and Enter and Space on a focused key work, because the platform makes them work', async () => {
    // Nothing in the module implements this. It is the whole argument for these being real `<button>`s
    // instead of painted glyphs, and it is a claim about the platform, so it is checked rather than
    // asserted in a comment.
    const { dialog } = build();
    dialog.offer(1000);

    await userEvent.keyboard('{ }');
    await userEvent.keyboard('{d}');
    // Enter is START on this cabinet and saves, so only Space is tried as a key press here.
    await userEvent.keyboard('{ }');

    expect(spelled()).toBe('AB');
  });

  test('⚠️ Tab moves the focus, and the cursor follows it rather than staying behind', async () => {
    // The line this exists for: a focus listener writes the index back. Without it the cursor and the
    // focus are two answers to "where am I", and the next flipper press jumps the player back across
    // the alphabet to wherever the flippers last left it.
    const { dialog } = build();
    dialog.offer(1000);

    await userEvent.tab();
    await userEvent.tab();
    const afterTabs = cursor().textContent;
    await userEvent.keyboard('{u}');

    expect(afterTabs, 'two tabs from A').toBe('C');
    expect(spelled(), 'and the plunger took what the focus was on').toBe('C');
  });

  test('⚠️ every key is reachable by the platform, not only by the cabinet', async () => {
    // A grid of thirty-nine keys is a grid a mouse and a screen reader have to be able to work
    // through. Nothing here sets `tabindex="-1"`, and this is what says so.
    const { dialog } = build();
    dialog.offer(1000);

    const unreachable = keys().filter((b) => b.tabIndex < 0);

    expect(unreachable.map((b) => b.textContent), 'keys outside the tab order').toEqual([]);
  });
});

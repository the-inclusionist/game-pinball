// SPDX-License-Identifier: AGPL-3.0-or-later
// EDITING THE CONTROLS, WITH A REAL KEY, IN A REAL BROWSER.
//
// ⚠️ `tests/shell-keymap.node.test.ts` drives the rules — what may be edited, what a conflict is, why
// an action is never left with no key — through a fake, faster and in more detail. What it cannot
// make is the one thing this dialog is: A KEY ARRIVING. Everything here is about that.
//
//   · The capture listens at the WINDOW in capture phase, because the engine's `ui/menu-nav` listens
//     there too and this session measured what that costs: a listener that runs first can swallow the
//     very key the player is trying to bind. A settings screen that works for some of the keyboard is
//     worse than none.
//   · `Escape` has to leave capture rather than be bound, or a player who arrives by accident is
//     trapped with a dialog that eats every key they press to get out.
//   · And what is bound has to reach the GAME, which is a different module reading the same table.
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { userEvent } from 'vitest/browser';
import { mountKeymapDialog, KEYMAP_DIALOG_ID, keyLabel } from '../app/js/shell/keymap-dialog.js';
import { DEFAULT_BINDINGS } from '../app/js/shell/controls.js';
import { type BindingTable } from '../app/js/shell/keymap.js';

let host: HTMLElement;

function build() {
  let table: BindingTable = DEFAULT_BINDINGS;
  const dialog = mountKeymapDialog({
    doc: document,
    host,
    overlays: { register: () => {} },
    t: (key) => key,
    keys: window,
    current: () => table,
    onChange: (next) => { table = next; },
  });
  return { dialog, table: () => table, root: document.getElementById(KEYMAP_DIALOG_ID)! };
}

const rows = (): HTMLButtonElement[] =>
  [...document.getElementById(KEYMAP_DIALOG_ID)!.querySelectorAll('button')];
const said = (): string =>
  document.getElementById(KEYMAP_DIALOG_ID)!.querySelector('[aria-live]')?.textContent ?? '';

beforeEach(() => {
  host = document.createElement('div');
  host.style.position = 'relative';
  document.body.appendChild(host);
});
afterEach(() => { host.remove(); });

describe('what a key is called', () => {
  test('a player reads letters, not KeyA', () => {
    expect(keyLabel('KeyA')).toBe('A');
    expect(keyLabel('Digit7')).toBe('7');
    expect(keyLabel('ArrowLeft')).toBe('Left');
    // Anything else keeps the name the platform gives it, which is at least honest.
    expect(keyLabel('Space')).toBe('Space');
  });
});

describe('capturing a key', () => {
  test('⚠️ the key the player presses is the key the action gets', async () => {
    const { dialog, table } = build();
    dialog.open();
    rows()[2]!.click();          // the plunger row
    expect(said(), 'it asked for a key').toBe('pinball.bindings.press');

    await userEvent.keyboard('{ }');

    expect(table().plunger, 'Space is the launch now').toEqual(['Space']);
    expect(said()).toContain('pinball.bindings.taken');
  });

  test('⚠️ and it is taken from whatever else held it, and the player is told which', async () => {
    // Two actions on one key is a key whose meaning depends on which handler runs first, and three
    // separate readers walk this table.
    const { dialog, table } = build();
    dialog.open();
    rows()[2]!.click();

    await userEvent.keyboard('{a}');

    expect(table().plunger).toEqual(['KeyA']);
    expect(table().left, 'A was the left flipper').not.toContain('KeyA');
    expect(said(), 'and it named what lost it').toContain('pinball.bindings.left');
  });

  test('⚠️ Escape leaves capture instead of being bound to anything', async () => {
    // The one key whose meaning cannot have been reassigned, which is what makes it the way out.
    const { dialog, table } = build();
    dialog.open();
    rows()[0]!.click();

    await userEvent.keyboard('{Escape}');

    expect(table(), 'nothing was rebound').toEqual(DEFAULT_BINDINGS);
    expect(said()).toBe('pinball.bindings.hint');
  });

  test('⚠️ a key that is another action’s LAST is refused, and said so', async () => {
    // Not silently kept on both, and not silently taken: a cabinet with no left flipper is a state a
    // player cannot get out of without clearing storage, and they would never know that is what
    // happened. `shell/keymap.rebind` returns the same table, and this is what a player sees.
    const { dialog, table } = build();
    dialog.open();

    // Take A for the plunger, so `left` is down to its last key, J.
    rows()[2]!.click();
    await userEvent.keyboard('{a}');
    // Then try to take J as well.
    rows()[3]!.click();
    await userEvent.keyboard('{j}');

    expect(table().left, 'the left flipper still has a key').toEqual(['KeyJ']);
    expect(said()).toBe('pinball.bindings.refused');
  });

  test('⚠️ and while capturing, the CABINET keys are answers rather than commands', async () => {
    // The flippers walk this list when it is not listening. While it is, pressing one has to bind it —
    // otherwise the two keys a player is most likely to want to move are the two they cannot.
    const { dialog, table } = build();
    dialog.open();
    rows()[3]!.click();          // the pause row

    await userEvent.keyboard('{d}');

    expect(table().pause, 'the right flipper key became pause').toEqual(['KeyD']);
    expect(table().right, 'and stopped being the right flipper').not.toContain('KeyD');
  });

  test('⚠️ and a listener that runs first and swallows the key does not stop it', async () => {
    /**
     * THE CLAIM THIS FILE'S HEADER MAKES, TESTED RATHER THAN ASSERTED. The capture listens at the
     * WINDOW in capture phase because the engine's `ui/menu-nav` listens there too — and this session
     * measured what a listener running first costs: while `isNavigable` was true, Enter, A, D, J, K
     * and H were consumed before they reached anything at all.
     *
     * ⚠️ AND THE FIRST VERSION OF THIS GATE COULD NOT SEE IT. Moving the capture to the bubble phase
     * left all six tests green, because nothing else was listening in a test that boots no game. A
     * competing listener is what makes the phase matter, so the test brings one.
     */
    const { dialog, table } = build();
    const greedy = (event: Event): void => { event.stopPropagation(); event.preventDefault(); };
    window.addEventListener('keydown', greedy, true);
    try {
      dialog.open();
      rows()[2]!.click();

      await userEvent.keyboard('{ }');

      expect(table().plunger, 'the key reached the capture anyway').toEqual(['Space']);
    } finally {
      window.removeEventListener('keydown', greedy, true);
    }
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
// THE FIRST TEST IN THIS REPOSITORY THAT RUNS IN A BROWSER.
//
// The plan's verification section has always asked for `vitest run (node + browser)`. The node half
// grew to seventeen hundred tests; the browser half was deferred to "phase 2, along with the first
// pixel drawn", on the sound argument that a gate configured before the thing it tests is a gate that
// never went red. Phase 2 passed eight phases ago.
//
// ⚠️ AND THE COST CAME DUE TWICE IN ONE SESSION. A menu registered with the engine's Escape chain that
// Escape did not close, and a highlight that widened every wall on the table — both found by opening a
// preview and looking, neither visible to anything automated. This is the half of that gap a machine
// can close.
//
// ========================= WHAT BELONGS HERE, AND WHAT DOES NOT =========================
// Only what a node test CANNOT make. `tests/shell-options-dialog.node.test.ts` drives the same dialog
// through a hand-written fake and checks far more of it, faster, with failures that name one function.
// What that fake cannot model is the browser's own behaviour, and this file is exactly those parts:
//
//   · `focus()` on a HIDDEN element does nothing at all. The fake counted the call and was satisfied,
//     so it would pass whether the dialog is unhidden before the focus or after — and one of those two
//     orders ships a dialog whose Escape key never arrives, because nothing inside it has the focus.
//   · `document.activeElement` after hiding the element the focus was inside.
//   · A real key event, dispatched by the browser, travelling by the real capture and bubble path.
//
// ⚠️ MEASURED, NOT ASSUMED. Swapping the two lines in `open()` so the focus is taken BEFORE the dialog
// is unhidden fails two of the five tests here and passes all fourteen in the node file. That is the
// whole argument for this project existing, in one number against another.
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { userEvent } from 'vitest/browser';
import { mountOptionsDialog, OPTIONS_DIALOG_ID } from '../app/js/shell/options-dialog.js';
import { PALETTE_CHOICES, type PaletteChoice } from '../app/js/shell/options.js';

let host: HTMLElement;
let opener: HTMLButtonElement;

function build(initial: PaletteChoice = 'normal') {
  let current = initial;
  const chosen: PaletteChoice[] = [];
  const dialog = mountOptionsDialog({
    doc: document,
    host,
    overlays: { register: () => {} },
    t: (key) => key,
    current: () => current,
    onChoose: (choice) => { chosen.push(choice); current = choice; },
    restoreFocus: () => opener.focus(),
  });
  const root = () => document.getElementById(OPTIONS_DIALOG_ID)!;
  const choices = () => [...root().querySelectorAll('button')]
    .filter((b) => b.hasAttribute('aria-pressed'));
  return { dialog, root, choices, chosen };
}

beforeEach(() => {
  host = document.createElement('div');
  opener = document.createElement('button');
  opener.textContent = 'open';
  document.body.append(host, opener);
});

afterEach(() => {
  host.remove();
  opener.remove();
});

describe('the palette menu, in a real browser', () => {
  test('⚠️ opening puts the focus on a choice — which only works because it is unhidden FIRST', () => {
    // The order inside `open()` is refresh, unhide, focus. Reverse the last two and this fails while
    // every node assertion goes on passing: `focus()` on a hidden element is a no-op that reports
    // nothing, so the fake's counter still ticks and the dialog still opens. What breaks is the key
    // handler below, because nothing inside the dialog has the focus for a key to arrive at.
    const { dialog, root, choices } = build();

    dialog.open();

    expect(root().hidden).toBe(false);
    expect(document.activeElement).toBe(choices()[0]);
    expect(root().contains(document.activeElement), 'the focus is inside the dialog').toBe(true);
  });

  test('⚠️ and a REAL Escape closes it, which is what the engine’s chain did not do', async () => {
    // Confirmed by hand first: the dialog registers with `SettingsPanelApi` with `inEscapeChain: true`
    // and Escape over the open dialog did nothing, because the engine drives that chain from its own
    // key handling and that does not run while a ball is in play. This is the key press, made by the
    // browser rather than constructed, arriving by the real path.
    const { dialog, root } = build();
    dialog.open();

    await userEvent.keyboard('{Escape}');

    expect(root().hidden).toBe(true);
  });

  test('and the focus goes back to what opened it, rather than nowhere', async () => {
    // Hiding the element the focus is inside leaves `document.activeElement` on the body: the next Tab
    // starts from the top of the page and a screen reader announces all of it again. A node fake
    // cannot see this at all — there is no focus to lose.
    const { dialog } = build();
    opener.focus();
    dialog.open();

    await userEvent.keyboard('{Escape}');

    expect(document.activeElement).toBe(opener);
  });

  test('choosing a palette reports it and moves the mark, by a real click', async () => {
    const { dialog, choices, chosen } = build();
    dialog.open();

    await userEvent.click(choices()[1]!);

    expect(chosen).toEqual([PALETTE_CHOICES[1]]);
    expect(choices().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
  });

  test('⚠️ and a closed dialog is really gone, not merely marked', () => {
    // `hidden` is a property with a stylesheet behind it, and a page that styles `display` on the same
    // element can defeat it without any attribute looking wrong. Layout is the only witness.
    const { dialog, root } = build();

    dialog.open();
    expect(root().getBoundingClientRect().height, 'open, it occupies space').toBeGreaterThan(0);

    dialog.close();
    expect(root().getBoundingClientRect().height, 'closed, it occupies none').toBe(0);
  });
});

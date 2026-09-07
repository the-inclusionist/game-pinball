// SPDX-License-Identifier: AGPL-3.0-or-later
// THE MENU THE DEV ASKED FOR, DRIVEN WITHOUT A BROWSER.
//
// "paleta normal com alternativa CB-Safe ajustavel via menu". `shell/options` holds the decision;
// this is the markup over it, and the reason it can be tested at all is that it builds through
// `document.createElement` and an overlay registry that are both HANDED to it. There is no browser
// project in this repository, so a dialog that reached for the global `document` would be a dialog
// nothing could open.
//
// ⚠️ THE FAKES ARE STRUCTURAL AND CAST, which is the pattern `shell-controls` already uses for its key
// region. The production types are the real `Document` and `HTMLElement` — narrowing them to a
// hand-written interface would let the module drift away from the DOM it actually runs on — so the
// fakes are cast in, and what they implement is exactly what the module is allowed to use.
import { describe, test, expect } from 'vitest';
import { mountOptionsDialog, OPTIONS_DIALOG_ID } from '../app/js/shell/options-dialog.js';
import { PALETTE_CHOICES, PALETTE_LABEL, type PaletteChoice } from '../app/js/shell/options.js';

interface FakeElement {
  tag: string;
  id: string;
  className: string;
  hidden: boolean;
  textContent: string;
  attributes: Record<string, string>;
  children: FakeElement[];
  clicks: (() => void)[];
  keys: ((e: { key: string; preventDefault(): void }) => void)[];
  focused: number;
}

function fakeElement(tag: string): FakeElement {
  const el: FakeElement = {
    tag, id: '', className: '', hidden: false, textContent: '',
    attributes: {}, children: [], clicks: [], keys: [], focused: 0,
  };
  return Object.assign(el, {
    setAttribute(name: string, value: string) { el.attributes[name] = value; },
    appendChild(child: FakeElement) { el.children.push(child); return child; },
    focus() { el.focused++; },
    addEventListener(type: string, fn: never) {
      if (type === 'click') el.clicks.push(fn as () => void);
      if (type === 'keydown') el.keys.push(fn);
    },
  });
}

/** Everything under `root`, so a button can be found without knowing how deep it was nested. */
function descendants(el: FakeElement): FakeElement[] {
  return el.children.flatMap((child) => [child, ...descendants(child)]);
}

function harness(initial: PaletteChoice = 'normal') {
  const created: FakeElement[] = [];
  const doc = { createElement: (tag: string) => { const el = fakeElement(tag); created.push(el); return el; } };
  const host = fakeElement('div');
  const registered = new Map<string, { close: () => void; inEscapeChain: boolean }>();
  let current = initial;
  const chosen: PaletteChoice[] = [];

  let restored = 0;
  const dialog = mountOptionsDialog({
    doc: doc as never,
    host: host as never,
    overlays: { register: (id, entry) => registered.set(id, entry) },
    t: (key: string) => `«${key}»`,
    current: () => current,
    onChoose: (choice) => { chosen.push(choice); current = choice; },
    restoreFocus: () => { restored++; },
  });

  const root = () => host.children[0]!;
  /** The palette buttons: the ones carrying a mark. The close button carries none. */
  const buttons = () => descendants(root())
    .filter((el) => el.tag === 'button' && el.attributes['aria-pressed'] !== undefined);
  const escape = () => {
    for (const fn of root().keys) fn({ key: 'Escape', preventDefault() {} });
  };
  /** Whether a key pressed on the dialog is taken off the game behind it. */
  const swallows = (code: string): boolean => {
    let stopped = false;
    for (const fn of root().keys) {
      fn({ code, key: code, preventDefault() {}, stopPropagation() { stopped = true; } } as never);
    }
    return stopped;
  };
  const closer = () => descendants(root())
    .find((el) => el.tag === 'button' && el.attributes['aria-pressed'] === undefined);
  return {
    swallows,
    dialog, host, registered, chosen, root, buttons, created, escape, closer,
    restored: () => restored,
    setCurrent: (c: PaletteChoice) => { current = c; },
  };
}

describe('the dialog on the page', () => {
  test('⚠️ it goes inside the HOST it was given, never into the document at large', () => {
    // The engine reparents every accessibility overlay into `#game-region` — "nenhuma tela fora do
    // canvas" — and a dialog appended to the body sits outside that scope: outside the Escape chain
    // it registers for, outside the z-stack, and on a projector showing only the game region, off
    // screen entirely.
    const { host } = harness();

    expect(host.children.length, 'exactly one thing was mounted').toBe(1);
    expect(host.children[0]!.id).toBe(OPTIONS_DIALOG_ID);
    expect(host.children[0]!.className, 'the engine finds overlays by this class').toContain('overlay');
  });

  test('and it starts closed, because a menu is not what a player asked to see first', () => {
    const { root } = harness();

    expect(root().hidden).toBe(true);
  });

  test('opening shows it and closing hides it again', () => {
    const { dialog, root } = harness();

    dialog.open();
    expect(root().hidden).toBe(false);

    dialog.close();
    expect(root().hidden).toBe(true);
  });
});

describe('what the engine is told about it', () => {
  test('it REGISTERS, so the shell knows it is there', () => {
    // `SettingsPanelApi.register` is how the engine's shell learns a dialog exists: `closeById` gives
    // the pause menu something to call, and the z-stack and the overlay scope follow from being in the
    // registry.
    //
    // ⚠️ THIS IS NOT WHAT MAKES ESCAPE WORK, and the first version of this comment said it was. The
    // engine drives its Escape chain from its own key handling, which does not run while a ball is in
    // play: booting the built page and pressing Escape over the open dialog did nothing. See the last
    // describe in this file for what actually closes it.
    const { registered } = harness();

    expect([...registered.keys()]).toEqual([OPTIONS_DIALOG_ID]);
    expect(registered.get(OPTIONS_DIALOG_ID)!.inEscapeChain, 'it is in the chain it belongs in')
      .toBe(true);
  });

  test('and the close the engine holds is the one that actually hides it', () => {
    // Registering a `close` that does something else is worse than not registering: Escape reports
    // success and the dialog stays where it is.
    const { dialog, root, registered } = harness();
    dialog.open();

    registered.get(OPTIONS_DIALOG_ID)!.close();

    expect(root().hidden).toBe(true);
  });
});

describe('the choices in it', () => {
  test('every palette has a button, named through the translator', () => {
    const { buttons } = harness();

    expect(buttons().length).toBe(PALETTE_CHOICES.length);
    expect(buttons().map((b) => b.textContent))
      .toEqual(PALETTE_CHOICES.map((c) => `«${PALETTE_LABEL[c]}»`));
  });

  test('pressing one reports that choice, and only that one', () => {
    const { buttons, chosen } = harness();

    buttons()[1]!.clicks[0]!();

    expect(chosen).toEqual([PALETTE_CHOICES[1]]);
  });

  test('⚠️ and the current one is MARKED, so it is knowable without being able to see the colours', () => {
    // The whole point of this dialog is being read by somebody who cannot tell two colours apart.
    // "Which of these is on" answered only by the table's appearance answers nobody here.
    const { dialog, buttons } = harness('normal');
    dialog.open();

    const pressed = buttons().map((b) => b.attributes['aria-pressed']);

    expect(pressed).toEqual(PALETTE_CHOICES.map((c) => String(c === 'normal')));
  });

  test('⚠️ and the mark FOLLOWS the choice, because it is read on opening rather than at mount', () => {
    // The key on `C` changes the palette without this dialog being involved at all. A mark decided
    // once, when the page loaded, would go on claiming the normal palette for the rest of the session
    // — pointing the one player who cannot check for themselves at the wrong answer.
    const { dialog, buttons, setCurrent } = harness('normal');

    setCurrent('cbSafe');
    dialog.open();

    const pressed = buttons().map((b) => b.attributes['aria-pressed']);
    expect(pressed).toEqual(PALETTE_CHOICES.map((c) => String(c === 'cbSafe')));
  });
});

describe('getting back out of it', () => {
  test('⚠️ Escape closes it, because the engine’s chain does NOT reach here', () => {
    // Registering with `SettingsPanelApi` puts this dialog in the engine’s registry, and that is worth
    // doing — `closeById`, the z-stack and focus restoration all follow from it. It is NOT how the
    // dialog gets closed: the engine drives its Escape chain from its own key handling, which does not
    // run while a ball is in play. Confirmed in the browser BEFORE this test was written — the dialog
    // opened over the table and Escape did nothing at all, which is worse than having no dialog.
    const { dialog, root, escape } = harness();
    dialog.open();

    escape();

    expect(root().hidden).toBe(true);
  });

  test('and a key that is not Escape leaves it alone', () => {
    const { dialog, root } = harness();
    dialog.open();

    for (const fn of root().keys) fn({ key: 'a', preventDefault() {} });

    expect(root().hidden).toBe(false);
  });

  test('⚠️ there is also a BUTTON, because Escape is not a key everybody can press', () => {
    // A player using a switch, an on-screen keyboard or a pointer alone may have no Escape at all. A
    // dialog whose only way out is a key is a dialog those players cannot leave.
    const { dialog, root, closer } = harness();
    dialog.open();

    expect(closer(), 'the dialog has a close button').toBeDefined();
    closer()!.clicks[0]!();

    expect(root().hidden).toBe(true);
  });

  test('⚠️ and the focus goes back where it came from, both ways out', () => {
    // Hiding the element the focus is inside leaves the focus nowhere: the next Tab starts at the top
    // of the document and a screen reader announces the whole page again. The caller knows what opened
    // the dialog, so the caller is asked to put it back.
    const { dialog, escape, restored, closer } = harness();

    dialog.open();
    escape();
    expect(restored(), 'Escape restores it').toBe(1);

    dialog.open();
    closer()!.clicks[0]!();
    expect(restored(), 'and so does the button').toBe(2);
  });

  test('opening moves the focus INTO the dialog, or the keys go to the table behind it', () => {
    const { dialog, buttons } = harness();

    dialog.open();

    expect(buttons()[0]!.focused, 'the first choice takes the focus').toBeGreaterThan(0);
  });
});

describe('⚠️ and it owns the cabinet while it is up', () => {
  // The same hole the pause menu had, and this dialog is opened FROM that menu over a PAUSED game:
  // Enter on a palette choice would pick the palette and run `togglePause` on the way past, resuming
  // the table behind the dialog the player is reading. `shell/controls.ownCabinetKeys` holds the
  // measurement; this is the third place that one line was needed, which is why it is a function.
  test('every cabinet key is taken off the game behind it', () => {
    const h = harness();
    h.dialog.open();

    const escaped = ['KeyA', 'KeyJ', 'KeyD', 'KeyK', 'KeyU', 'Enter', 'KeyH']
      .filter((code) => !h.swallows(code));

    expect(escaped, 'these reached the game underneath').toEqual([]);
  });

  test('⚠️ but blind mode, the sonar and the palette key pass through', () => {
    const h = harness();
    h.dialog.open();

    expect(['KeyB', 'KeyS', 'KeyC'].filter((code) => h.swallows(code))).toEqual([]);
  });

  test('and a dialog that is put away owns nothing', () => {
    const h = harness();

    expect(h.swallows('Enter')).toBe(false);
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/keymap-dialog — "press the key you want", one action at a time.
//
// ⚠️ NOT A `shell/choice-dialog`, AND THE DIFFERENCE IS THE POINT. That one offers a short list of
// settings and takes one. This offers a list of ACTIONS and then reads a key that is not on any list
// — the player's answer is whatever they press, so while it is listening every key is DATA rather
// than a command, including the keys that normally drive this dialog.
//
// ========================= WHAT LISTENING MEANS HERE =========================
// ⚠️ WHILE CAPTURING, THIS TAKES THE KEYBOARD AT THE WINDOW, IN CAPTURE, AND GIVES IT BACK. Every
// other screen in this game takes only the four cabinet keys and only off the game — see
// `shell/controls.ownCabinetKeys`. That is not enough here for a reason this session measured the
// hard way: the engine's `ui/menu-nav` listens at the window in capture too, and anything that runs
// before this one can swallow the very key the player is trying to bind. A capture that missed keys
// would be a settings screen that works for some of the keyboard.
//
// ⚠️ AND `Escape` IS NOT BINDABLE, WHICH IS THE WAY OUT. A player who reaches capture by accident, or
// who changes their mind, needs one key whose meaning cannot have been reassigned — and this dialog
// is registered in the engine's Escape chain, so the same key means the same thing here as
// everywhere else in the game.

import { ownCabinetKeys, type PinballAction } from './controls.js';
import {
  EDITABLE_ACTIONS, conflictOf, rebind, type BindingTable,
} from './keymap.js';

export const KEYMAP_DIALOG_ID = 'pinball-keymap';

/** What this module uses of the engine's overlay registry. Narrow, so a test needs one method. */
export interface OverlayRegistry {
  register(id: string, entry: { close: () => void; inEscapeChain: boolean }): void;
}

export interface KeymapDialogOptions {
  readonly doc: Pick<Document, 'createElement'>;
  /** Inside the game region — see `shell/choice-dialog` for why nothing goes on the body. */
  readonly host: Pick<HTMLElement, 'appendChild'>;
  readonly overlays: OverlayRegistry;
  readonly t: (key: string) => string;
  /** ⚠️ A FUNCTION. The table changes while this dialog is open, by this dialog. */
  readonly current: () => BindingTable;
  readonly onChange: (table: BindingTable) => void;
  /** Puts the focus back on whatever opened this. See `shell/choice-dialog`. */
  readonly restoreFocus?: () => void;
  /** Where a keydown is listened for while capturing. The real one is `window`. */
  readonly keys: Pick<Window, 'addEventListener' | 'removeEventListener'>;
}

export interface KeymapDialog {
  open(): void;
  close(): void;
  readonly element: HTMLElement;
}

/** What a key is called on screen. `KeyA` is not a name a player recognises. */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) return code.slice(5);
  return code;
}

export function mountKeymapDialog(o: KeymapDialogOptions): KeymapDialog {
  const root = o.doc.createElement('div');
  root.id = KEYMAP_DIALOG_ID;
  root.className = 'overlay pinball-keymap';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', o.t('pinball.bindings.title'));
  Object.assign(root.style, {
    position: 'absolute', left: '0', top: '0', width: '100%', height: '100%',
    display: 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: '2%', background: '#0e1017', color: '#e8ecf4', textAlign: 'center',
    containerType: 'inline-size', boxSizing: 'border-box', padding: '3% 5%',
  });

  const heading = o.doc.createElement('h2');
  heading.textContent = o.t('pinball.bindings.title');
  Object.assign(heading.style, { fontSize: '5cqw', margin: '0' });
  root.appendChild(heading);

  /**
   * What the dialog is saying right now: the hint, or "press a key", or what a key cost.
   *
   * ⚠️ A LIVE REGION, because everything this dialog does is a change of state with no new element
   * to move the focus to. A player who cannot see it would otherwise press a key and be told nothing
   * at all — including when the key was REFUSED.
   */
  const status = o.doc.createElement('div');
  status.setAttribute('aria-live', 'polite');
  Object.assign(status.style, { fontSize: '3.2cqw', color: '#8a93a6', minHeight: '2.4em' });

  const rows: { action: PinballAction; button: HTMLElement }[] = [];
  let capturing: PinballAction | null = null;
  let cursor = 0;

  const draw = (): void => {
    const table = o.current();
    for (const { action, button } of rows) {
      const keys = table[action].map(keyLabel).join(' · ');
      button.textContent = `${o.t(`pinball.bindings.${action}`)}   ${keys}`;
      button.setAttribute('aria-label', `${o.t(`pinball.bindings.${action}`)}: ${keys}`);
      button.style.background = capturing === action ? '#38414f' : '#1a1e26';
    }
  };

  const moveTo = (index: number): void => {
    cursor = ((index % rows.length) + rows.length) % rows.length;
    rows[cursor]?.button.focus();
  };

  /** Stops listening, whether a key arrived or the player left. */
  let release: (() => void) | null = null;
  const stopCapture = (): void => {
    release?.();
    release = null;
    capturing = null;
    draw();
  };

  const take = (code: string): void => {
    const action = capturing;
    if (action === null) return;
    const before = o.current();
    const loser = conflictOf(before, action, code);
    const after = rebind(before, action, code);

    stopCapture();
    if (after === before) {
      /**
       * ⚠️ REFUSED, AND SAID SO. `rebind` returns the SAME TABLE when taking the key would leave
       * another action with none — a cabinet with no left flipper is a state a player cannot get out
       * of without clearing storage, and they would not know that is what happened. Identity is the
       * contract; see that function.
       */
      status.textContent = o.t('pinball.bindings.refused');
      return;
    }
    o.onChange(after);
    draw();
    status.textContent = loser === null
      ? o.t('pinball.bindings.taken')
      : `${o.t('pinball.bindings.taken')} ${o.t('pinball.bindings.lost')} ${o.t(`pinball.bindings.${loser}`)}`;
  };

  const startCapture = (action: PinballAction): void => {
    capturing = action;
    status.textContent = o.t('pinball.bindings.press');
    draw();

    const onKey = (event: KeyboardEvent): void => {
      // Escape is the way out and is never bindable — see this module's header.
      if (event.code === 'Escape') {
        stopCapture();
        status.textContent = o.t('pinball.bindings.hint');
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      take(event.code);
    };
    o.keys.addEventListener('keydown', onKey, true);
    release = () => { o.keys.removeEventListener('keydown', onKey, true); };
  };

  for (const [i, action] of EDITABLE_ACTIONS.entries()) {
    const button = o.doc.createElement('button');
    button.setAttribute('type', 'button');
    Object.assign(button.style, {
      font: 'inherit', fontSize: '3.2cqw', padding: '1.4% 4%', width: '80%',
      background: '#1a1e26', color: '#e8ecf4', border: '1px solid #8a93a6', cursor: 'pointer',
      display: 'flex', justifyContent: 'space-between', gap: '1em',
    });
    button.addEventListener('click', () => { moveTo(i); startCapture(action); });
    button.addEventListener('focus', () => { if (cursor !== i) moveTo(i); });
    root.appendChild(button);
    rows.push({ action, button });
  }

  root.appendChild(status);

  const close = (): void => {
    stopCapture();
    root.style.display = 'none';
    o.restoreFocus?.();
  };

  /**
   * The cabinet walks the list — but NOT while capturing, because then the flippers are answers.
   *
   * `ownCabinetKeys` reads `isOpen`, so saying "closed" while listening is what hands every key to
   * the capture listener above without a second rule about who owns what.
   */
  ownCabinetKeys(root as unknown as Parameters<typeof ownCabinetKeys>[0], {
    isOpen: () => root.style.display !== 'none' && capturing === null,
    on: {
      left: () => moveTo(cursor - 1),
      right: () => moveTo(cursor + 1),
      plunger: () => { const row = rows[cursor]; if (row) startCapture(row.action); },
      pause: () => close(),
    },
  });

  root.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || capturing !== null) return;
    event.preventDefault();
    close();
  });

  o.overlays.register(KEYMAP_DIALOG_ID, { close, inEscapeChain: true });
  o.host.appendChild(root);

  return {
    element: root,
    close,
    open(): void {
      if (root.style.display === 'flex') return;
      draw();
      status.textContent = o.t('pinball.bindings.hint');
      root.style.display = 'flex';
      moveTo(0);
    },
  };
}

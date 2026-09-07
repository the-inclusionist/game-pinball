// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/options-dialog — the menu the palette is chosen from.
//
// ========================= THE MENU IS THE ENGINE'S, THE CHOICES ARE OURS =========================
// The plan says the shell — menus, options, accessibility — comes from the engine rather than being
// ported from the original's ImGui, and this is what that looks like for a setting the engine cannot
// know about. `createGame` hands back `overlays: SettingsPanelApi`, whose `register(id, entry)` is how
// a dialog joins the shell: `closeById` gives the pause menu something to call, and the z-stack and
// the overlay scope follow from being in the registry. What this module supplies is the one thing the
// engine has no way to offer — the pinball's own palettes, which live inside a pixel buffer the engine
// only ever sees as a finished texture.
//
// ⚠️ WHAT REGISTERING DOES NOT BUY IS ESCAPE. This header used to say the chain closes it. Booting the
// built page and pressing Escape over the open dialog did nothing: the engine drives its chain from
// its own key handling, which does not run while a ball is in play. Escape, a close button and the
// focus return are all handled below, and the registration stays because it is still right.
//
// ⚠️ AND THE ENGINE'S COLOUR-BLINDNESS FILTERS ARE A DIFFERENT THING, not this under another name.
// `render/cvd-matrices` daltonizes the FINISHED FRAME: it redistributes the error in an image after
// the fact. This changes the colours at source, before any of that runs. They compose, and neither
// replaces the other — a filter cannot recover a distinction that was never encoded, and encoding one
// does not help a player who also needs the correction.
//
// ========================= WHY EVERYTHING IS HANDED IN =========================
// `document` and the host element are parameters rather than globals for the same reason
// `shell/options` takes its store: this repository has one Vitest project and it is `node`. A dialog
// that reached for the global would be a dialog nothing could open, which is how a menu ends up
// shipping with a button that reports the wrong choice.
//
// The types are the REAL `Document` and `HTMLElement`, narrowed only by `Pick` where that is honest.
// A hand-written element interface would let this drift away from the DOM it runs on; the tests cast
// their fakes in, which is the same bargain `shell/controls` strikes for its key region.



/**
 * ⚠️ THE ID IS THE HANDLE THE ENGINE KEEPS. `register`, `closeById` and `restoreFocus` all address a
 * dialog by it, so it is exported rather than written twice — once here and once wherever the pause
 * menu wants to open this.
 */
import { ownCabinetKeys } from './controls.js';

/**
 * ⚠️ GENERIC OVER THE CHOICE, BECAUSE THE SECOND ONE ARRIVED. This was `mountOptionsDialog`, bound to
 * `PaletteChoice` in five places out of a hundred and eighty-five lines. The Dev then asked for
 * "modos de acessibilidade para visão", which is the same shape — a short list of mutually exclusive
 * settings, one mark, an Escape, a place in the engine's overlay chain and the cabinet taken off the
 * game — and copying the file would have been this repository's most expensive recurring defect
 * arriving for the sixth time.
 *
 * What is NOT generic is the id: `register`, `closeById` and `restoreFocus` all address a dialog by
 * it, so each caller brings its own and two dialogs cannot collide in the engine's registry.
 */

/** What this module uses of the engine's overlay registry. Narrow, so a test needs one method. */
export interface OverlayRegistry {
  register(id: string, entry: { close: () => void; inEscapeChain: boolean }): void;
}

export interface ChoiceDialogOptions<T extends string> {
  /** The engine's handle for this dialog, and the DOM id. One per dialog. */
  readonly id: string;
  /** The i18n key for the heading. */
  readonly titleKey: string;
  /** The choices, in the order they are offered. */
  readonly choices: readonly T[];
  /** The i18n key for each choice's label. */
  readonly labelOf: Readonly<Record<T, string>>;
  readonly doc: Pick<Document, 'createElement'>;
  /**
   * Where the dialog is mounted, which must be inside the game region.
   *
   * ⚠️ NOT THE DOCUMENT BODY. The engine reparents every accessibility overlay into `#game-region` —
   * "nenhuma tela fora do canvas" — and one appended outside that scope is outside the Escape chain it
   * just registered for, outside the z-stack, and on a screen showing only the game region, invisible.
   */
  readonly host: Pick<HTMLElement, 'appendChild'>;
  readonly overlays: OverlayRegistry;
  readonly t: (key: string) => string;
  /**
   * ⚠️ A FUNCTION, NOT A VALUE. The palette also turns on a key, with this dialog closed and
   * uninvolved, so a choice captured at mount would go on claiming the normal palette for the rest of
   * the session — telling the one player who cannot check for themselves the wrong answer.
   */
  readonly current: () => T;
  readonly onChoose: (choice: T) => void;
  /**
   * Puts the focus back where it was before the dialog opened.
   *
   * ⚠️ HIDING THE ELEMENT THE FOCUS IS INSIDE LEAVES THE FOCUS NOWHERE. The next Tab starts from the
   * top of the document and a screen reader announces the whole page again — for a player who came
   * here to change one setting. The engine's `restoreFocus(id)` does this for panels that opened
   * through `frontOverlay`; this one is opened by a button of the caller's, so the caller is the only
   * thing that knows where to put it back.
   */
  readonly restoreFocus?: () => void;
}

export interface ChoiceDialog {
  /**
   * Whether it is on screen.
   *
   * ⚠️ ASKED BY `main`'s FRAME LOOP, which reopens the pause menu while the phase is `paused` — and
   * the phase is still `paused` while a dialog opened FROM that menu is up. Without this the menu
   * came back on the very next frame, on top of the dialog it had just opened.
   */
  isOpen(): boolean;
  open(): void;
  close(): void;
}

export function mountChoiceDialog<T extends string>(o: ChoiceDialogOptions<T>): ChoiceDialog {
  const root = o.doc.createElement('div');
  root.id = o.id;
  // `overlay` is how the engine's `OVERLAY_SCOPE_SELECTOR` finds it; `dialog` is this port's own.
  root.className = 'overlay pinball-options';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', o.t(o.titleKey));
  // Closed until asked for: a menu is not what a player opened the game to see.
  root.hidden = true;

  /**
   * ⚠️ STYLED HERE, BECAUSE `.overlay` IS A CLASS NOTHING IN THIS GAME DEFINES.
   *
   * The class is real and load-bearing — it is how the engine's `OVERLAY_SCOPE_SELECTOR` finds this
   * dialog — but it carries no LAYOUT here: `app/index.html` links no stylesheet at all, this game's
   * own or the engine's. Measured in the running game, this dialog's box was `320x63 at top 180`,
   * `position: static`, `display: block` — laid out AFTER the canvas, entirely below the screen.
   *
   * ⚠️ SO IT WAS THE DEV'S OWN COMPLAINT, STILL HALF UNFIXED. "Cores da mesa deveria estar no menu de
   * pausa, não num rodapé que exige rolagem da tela." The BUTTON that opened it was moved into the
   * pause menu; the dialog it opens was still a footer under the game, and every test passed because
   * they all ask whether it is `display: none` — and a block below the fold is not.
   *
   * Every other screen in this game already sizes itself inline for the same reason: the pause menu,
   * the high-score alphabet and the control editor all do. This one was the exception because it was
   * written first, against a class that looked like it meant something.
   */
  Object.assign(root.style, {
    position: 'absolute', left: '0', top: '0', width: '100%', height: '100%',
    /**
     * ⚠️ `none` HERE AND `flex` ONLY WHEN OPEN, BECAUSE AN INLINE `display` BEATS `[hidden]`.
     * `hidden` is how this dialog has always opened and closed, and the browser's own rule for it is
     * `display: none` from the user-agent stylesheet — which an inline `display: flex` overrides
     * outright. Written the obvious way, the dialog was permanently visible.
     * `tests/shell-options-dialog.browser` caught it in one run: "a closed dialog is really gone, not
     * merely marked". So the two are kept in step in `open` and `close`, and `hidden` stays because
     * the engine's Escape chain reads it.
     */
    display: 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(14, 16, 23, 0.92)', color: '#e8ecf4', textAlign: 'center',
    // See `shell/pause-menu`: an element is a container for its DESCENDANTS, not for itself, so the
    // padding here is a percentage and the list below carries the `cqh` gap.
    containerType: 'size', boxSizing: 'border-box', padding: '2% 4%',
  });

  const heading = o.doc.createElement('div');
  heading.textContent = o.t(o.titleKey);
  Object.assign(heading.style, { fontSize: '6cqh', margin: '0' });

  /** The column, so one `cqh` is one per cent of the dialog's own height. See `shell/pause-menu`. */
  const column = o.doc.createElement('div');
  Object.assign(column.style, {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2cqh', width: '100%',
  });
  column.appendChild(heading);

  const buttons: { choice: T; element: HTMLElement }[] = [];

  for (const choice of o.choices) {
    const button = o.doc.createElement('button');
    button.textContent = o.t(o.labelOf[choice]);
    /**
     * ⚠️ `aria-pressed`, AND IT IS NOT DECORATION. This dialog exists to be read by somebody who
     * cannot tell two colours apart, so "which of these is on" answered only by how the table looks
     * answers nobody here. The mark is set on every open — see `refresh` — because the key on C can
     * change the palette while this is closed.
     */
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      o.onChoose(choice);
      refresh();
    });
    Object.assign(button.style, {
      font: 'inherit', fontSize: '4.4cqh', padding: '0.9cqh 6%', width: '76%',
      background: '#1a1e26', color: '#e8ecf4', border: '1px solid #8a93a6', cursor: 'pointer',
    });
    column.appendChild(button);
    buttons.push({ choice, element: button });
  }

  function refresh(): void {
    const now = o.current();
    for (const { choice, element } of buttons) {
      element.setAttribute('aria-pressed', String(choice === now));
    }
  }

  /**
   * ⚠️ THE CLOSE BUTTON EXISTS BECAUSE ESCAPE IS NOT A KEY EVERYBODY CAN PRESS. A player on a switch,
   * an on-screen keyboard or a pointer alone may have no Escape at all, and a dialog whose only way
   * out is a key is a dialog those players cannot leave.
   */
  const closeButton = o.doc.createElement('button');
  closeButton.textContent = o.t('pinball.palette.close');
  closeButton.addEventListener('click', () => close());
  Object.assign(closeButton.style, {
    font: 'inherit', fontSize: '4.4cqh', padding: '0.9cqh 6%', width: '76%',
    background: '#1a1e26', color: '#e8ecf4', border: '1px solid #8a93a6', cursor: 'pointer',
  });
  column.appendChild(closeButton);
  root.appendChild(column);

  function close(): void {
    root.hidden = true;
    root.style.display = 'none';
    o.restoreFocus?.();
  }

  /**
   * ⚠️ AND ESCAPE IS HANDLED HERE, NOT BY THE ENGINE, though this dialog is registered with the
   * engine's chain and should be.
   *
   * The registration is worth having: `closeById` gives the pause menu something to call, and the
   * z-stack and the overlay scope follow from being in the registry. It is NOT what dismisses this.
   * The engine drives its Escape chain from its own key handling, which does not run while a ball is
   * in play — booting the built page and pressing Escape over an open dialog did nothing at all.
   * Relying on it would have shipped a menu that opens over the table and will not go away.
   */
  root.setAttribute('tabindex', '-1');
  root.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    close();
  });

  /**
   * ⚠️ THE SAME HOLE THE PAUSE MENU HAD, and this dialog is opened FROM that menu, over a paused game.
   * It lives inside `#game-region` where `bindPinballControls` binds, so Enter on a palette choice
   * would pick the palette and run `togglePause` on the way past — resuming the game behind the
   * dialog the player is reading. See `ownCabinetKeys` for the measurement.
   *
   * ⚠️ AND THIS IS THE THIRD COPY OF A ONE-LINE RULE, which is why the rule is a function. The first
   * two were written a commit apart and the second only existed because the first was noticed.
   */
  ownCabinetKeys(root as unknown as Parameters<typeof ownCabinetKeys>[0], {
    isOpen: () => !root.hidden,
  });

  o.host.appendChild(root);
  // ⚠️ THE REGISTERED CLOSE IS THE ONE THAT HIDES IT. Registering anything else is worse than not
  // registering at all: Escape reports success and the dialog stays exactly where it was.
  o.overlays.register(o.id, { close, inEscapeChain: true });

  return {
    isOpen: () => !root.hidden,
    open() {
      // Read afresh, every time. See `current` above for what a snapshot would say.
      refresh();
      root.hidden = false;
      root.style.display = 'flex';
      // ⚠️ THE FOCUS MOVES IN, or the keydown above never fires and the arrows go on working the
      // flippers behind the dialog. The first choice rather than the dialog itself, so a screen reader
      // reads an option instead of an empty container.
      buttons[0]?.element.focus();
    },
    close,
  };
}

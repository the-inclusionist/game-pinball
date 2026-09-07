// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/pause-menu — the way out of a game.
//
// ========================= WHY THIS EXISTS =========================
// ⚠️ THE DEV: "menu de pausa deve permitir dar quit, voltar à tela inicial e escolher outras mesas."
//
// Pause has existed since the key was bound and it did exactly one thing: stopped the world and wrote
// "Paused" in the HUD's footer. A player who wanted to leave a game had no way out of it — the only
// exits from a table were draining three balls or reloading the page. The engine has no quit of its
// own to borrow (`Engine` is a declaration, overlays, nav, keyboard, sonar and a scene stack), so the
// way out is this game's to build, the same way the palette menu is.
//
// ========================= WHAT "QUIT" CAN MEAN IN A PAGE =========================
// ⚠️ IT CANNOT MEAN CLOSING THE WINDOW. `window.close()` is refused for anything the script did not
// open, so a Quit that tried it would do nothing on most machines — and a menu entry that lies is a
// defect with a label on it.
//
// So the four entries differ in two things, where they land and whether the game COUNTS:
//
//   · CONTINUE — closes the menu, and the game is where it was.
//   · TABLES   — abandons this game and opens the selector.
//   · TITLE    — abandons this game and shows the title screen.
//   · QUIT     — ENDS this game: the score is final, the board is offered if it places, and then the
//                title. It is "I am done", and it is the only exit that records what the player did.
//
// That is the whole reason Quit and Title are not one entry.
//
// ========================= WHY EVERYTHING IS HANDED IN =========================
// The same bargain `shell/options-dialog` and `shell/high-score-dialog` strike: `document` and the
// host are parameters, because this repository's fast project is `node` and a menu that reached for a
// global would be a menu nothing could open. That is how the palette shipped with a button that
// reported the wrong choice, once.

export const PAUSE_MENU_ID = 'pinball-pause';

/**
 * In the order they are shown and in the order a player reaches them.
 *
 * Resume first because it is what most opens of this menu end in, and Quit last because it is the one
 * that cannot be undone.
 */
/**
 * ⚠️ `colours` IS HERE BECAUSE IT WAS A BUTTON UNDER THE CANVAS. The Dev: "Cores da mesa deveria estar
 * no menu de pausa, não num rodapé que exige rolagem da tela." He is right, and the comment that put
 * it there had a reason that expired: it said the ENGINE's pause menu has no entry to add one to,
 * which is true and stopped mattering the day this port grew a pause menu of its own. The button
 * outlived its own justification by the length of one feature.
 *
 * Second, after Resume: it is the setting a player is most likely to have opened this menu for, and
 * the three that follow all end the game or the table.
 */
export const PAUSE_ENTRIES = ['resume', 'colours', 'tables', 'title', 'quit'] as const;

export type PauseEntry = typeof PAUSE_ENTRIES[number];

export interface PauseMenuOptions {
  readonly doc: Pick<Document, 'createElement'>;
  readonly host: Pick<HTMLElement, 'appendChild'>;
  readonly t: (key: string) => string;
  readonly onResume: () => void;
  /** Opens the palette dialog. See `PAUSE_ENTRIES` for why it lives here and not under the canvas. */
  readonly onColours: () => void;
  readonly onTables: () => void;
  readonly onTitle: () => void;
  readonly onQuit: () => void;
}

export interface PauseMenu {
  open(): void;
  /**
   * Puts it away WITHOUT choosing anything.
   *
   * ⚠️ IT CALLS NOTHING, and that is not an omission. The frame loop closes this when the phase leaves
   * `paused` — which happens because the pause key was pressed again, which has already resumed the
   * game. A close that fired `onResume` would resume it twice.
   */
  close(): void;
  /** Puts the focus on the colours entry — see the implementation for why that matters. */
  focusColours(): void;
  readonly element: HTMLElement;
}

export function mountPauseMenu(o: PauseMenuOptions): PauseMenu {
  const root = o.doc.createElement('div');
  root.id = PAUSE_MENU_ID;
  root.className = 'overlay pinball-pause-menu';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', o.t('pinball.pause.heading'));
  Object.assign(root.style, {
    position: 'absolute', left: '0', top: '0', width: '100%', height: '100%',
    display: 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: '3%', background: 'rgba(14, 16, 23, 0.92)', color: '#e8ecf4', textAlign: 'center',
    containerType: 'inline-size', boxSizing: 'border-box', padding: '4%',
  });

  const heading = o.doc.createElement('div');
  /**
   * ⚠️ `heading` AND NOT `title`, BECAUSE THE ENTRIES GENERATE THEIR OWN KEYS. One of them is called
   * `title` — the title SCREEN — so `pinball.pause.title` would have been the heading's key and that
   * entry's label at the same time, and the button would have read "Paused". Caught by a test that
   * asserts the four labels are distinct, which is the only shape of test that could see it: the ones
   * that translate with `t = (key) => key` compare keys and would have agreed with the collision.
   */
  heading.textContent = o.t('pinball.pause.heading');
  Object.assign(heading.style, { fontSize: '5cqw', marginBottom: '2%' });
  root.appendChild(heading);

  const handlers: Readonly<Record<PauseEntry, () => void>> = {
    resume: o.onResume, colours: o.onColours, tables: o.onTables, title: o.onTitle, quit: o.onQuit,
  };

  const buttons: HTMLElement[] = [];
  for (const entry of PAUSE_ENTRIES) {
    const button = o.doc.createElement('button');
    button.textContent = o.t(`pinball.pause.${entry}`);
    Object.assign(button.style, {
      font: 'inherit', fontSize: '3.4cqw', padding: '1.5% 6%', width: '60%',
      background: '#1a1e26', color: '#e8ecf4', border: '1px solid #8a93a6', cursor: 'pointer',
    });
    button.addEventListener('click', () => {
      // Closed FIRST, so a handler that opens another screen is not drawing under this one.
      root.style.display = 'none';
      handlers[entry]();
    });
    root.appendChild(button);
    buttons.push(button);
  }

  o.host.appendChild(root);

  return {
    element: root,
    open(): void {
      root.style.display = 'flex';
      // The first entry, so a player who opened this by accident presses the same key twice and is back.
      buttons[0]?.focus();
    },
    close(): void { root.style.display = 'none'; },
    /**
     * The colours entry, so whatever it opens can hand the focus back to it.
     *
     * ⚠️ HANDING FOCUS BACK IS NOT A COURTESY. Hiding the element the focus is inside leaves the focus
     * nowhere and the next Tab starts at the top of the document — which `main` already records for
     * the button this entry replaced.
     */
    focusColours(): void { buttons[PAUSE_ENTRIES.indexOf('colours')]?.focus(); },
  };
}

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

import { ownCabinetKeys } from './controls.js';

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
export const PAUSE_ENTRIES = ['resume', 'colours', 'vision', 'controls', 'tables', 'title', 'quit'] as const;

export type PauseEntry = typeof PAUSE_ENTRIES[number];

export interface PauseMenuOptions {
  readonly doc: Pick<Document, 'createElement'>;
  readonly host: Pick<HTMLElement, 'appendChild'>;
  readonly t: (key: string) => string;
  readonly onResume: () => void;
  /** Opens the palette dialog. See `PAUSE_ENTRIES` for why it lives here and not under the canvas. */
  readonly onColours: () => void;
  /**
   * Opens the vision dialog — the engine's colour-blindness CORRECTION over the finished picture.
   *
   * ⚠️ A SECOND ENTRY AND NOT A SECOND TAB OF THE FIRST, because the two answer different questions:
   * `colours` changes which colours the table is DRAWN in, and this changes what reaches the eye and
   * leaves the artwork alone. A player might want either, or both — and the palette cannot help with
   * the Dev's photographs, which are not drawn from a palette at all. See `shell/vision`.
   */
  readonly onVision: () => void;
  /**
   * Opens the key-editing dialog — the last of the three the Dev named.
   *
   * ⚠️ IT IS HERE AND NOT IN A SETTINGS SCREEN OF ITS OWN, because a player finds out their keys are
   * wrong while playing, and the pause menu is what a player reaches from there.
   */
  readonly onControls: () => void;
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
  focusEntry(entry: PauseEntry): void;
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
    background: 'rgba(14, 16, 23, 0.92)', color: '#e8ecf4', textAlign: 'center',
    /**
     * ⚠️ `size` AND NOT `inline-size`, WHICH IS WHAT LETS THIS FIT. Container queries only give `cqh`
     * when the container's own HEIGHT is queryable, and everything here was sized in `cqw` —
     * fractions of the WIDTH — on a screen whose constraint is its height. Seven entries came to 194
     * pixels in 180, and the seventh was simply clipped by the bottom edge.
     *
     * Found by screenshotting the menu at the real size and looking. Every behavioural test passed,
     * because a button off the bottom of the screen still takes the focus and still fires.
     *
     * The Dev refused scrolling by name once already: "Cores da mesa deveria estar no menu de pausa,
     * não num rodapé que exige rolagem da tela." A pause menu that has to be scrolled is the same
     * complaint one screen further in.
     *
     * ⚠️ AND THE ROOT'S OWN `padding` IS NOT IN `cqh`, WHICH IS NOT AN INCONSISTENCY. `container-type`
     * makes an element a container for its DESCENDANTS, not for itself: measured, `gap: 1cqh` on THIS
     * element computed to 8.96px — resolved against some outer container at 896px — while `4.4cqh` on
     * a button computed to 6.74px, correctly against this element's own 153px content box. That is
     * why the list lives in a wrapper.
     */
    containerType: 'size', boxSizing: 'border-box', padding: '2% 4%',
  });

  /**
   * The column the entries live in.
   *
   * ⚠️ A WRAPPER PURELY SO THAT `cqh` MEANS WHAT IT SAYS. See the root: an element is not its own
   * container, so a gap written there is measured against something else entirely. Inside this, one
   * `cqh` is one per cent of the menu's own height — which is what "size the list to the screen" has
   * to mean, on a screen whose constraint is its height and not its width.
   */
  const column = o.doc.createElement('div');
  Object.assign(column.style, {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2cqh', width: '100%',
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
  Object.assign(heading.style, { fontSize: '6cqh', margin: '0' });
  column.appendChild(heading);

  const handlers: Readonly<Record<PauseEntry, () => void>> = {
    resume: o.onResume, colours: o.onColours, vision: o.onVision, controls: o.onControls,
    tables: o.onTables, title: o.onTitle, quit: o.onQuit,
  };

  const buttons: HTMLElement[] = [];
  let cursor = 0;

  /** Takes an entry: the menu shuts first, so a handler that opens a screen is not drawing under it. */
  const choose = (entry: PauseEntry): void => {
    root.style.display = 'none';
    handlers[entry]();
  };

  /** Puts the cursor on an entry, wrapping. The cursor IS the focus — see the `focus` listener below. */
  const moveTo = (index: number): void => {
    cursor = ((index % PAUSE_ENTRIES.length) + PAUSE_ENTRIES.length) % PAUSE_ENTRIES.length;
    buttons[cursor]?.focus();
  };

  for (const entry of PAUSE_ENTRIES) {
    const button = o.doc.createElement('button');
    button.textContent = o.t(`pinball.pause.${entry}`);
    Object.assign(button.style, {
      /**
       * ⚠️ IN `cqh`, SO THE LIST SIZES ITSELF TO THE SCREEN'S HEIGHT RATHER THAN ITS WIDTH. At these
       * numbers seven entries leave room to spare, so an eighth fits without this being tuned again —
       * and `tests/pause-menu-cabinet` asks whether it SCROLLS rather than counting pixels, so it
       * would say so if that ever stopped being true.
       */
      font: 'inherit', fontSize: '4.4cqh', padding: '0.9cqh 6%', width: '64%',
      background: '#1a1e26', color: '#e8ecf4', border: '1px solid #8a93a6', cursor: 'pointer',
    });
    button.addEventListener('click', () => choose(entry));
    /**
     * ⚠️ FOCUS WRITES THE CURSOR BACK, so Tab and the flippers cannot disagree about where the player
     * is. The same arrangement as `shell/high-score-dialog`, and for the same reason: a highlight
     * kept beside the focus is two answers to one question.
     */
    button.addEventListener('focus', () => { if (cursor !== buttons.indexOf(button)) moveTo(buttons.indexOf(button)); });
    column.appendChild(button);
    buttons.push(button);
  }

  /**
   * ⚠️ THE CABINET DRIVES THIS MENU, WHICH IS WHAT THE DEV ASKED FOR AND WHAT IT DID NOT DO.
   *
   * His report: "O jogo não tem pause com h/enter ainda, para acessar um menu com opções de voltar,
   * editar controle, modos de acessibilidade para visão etc." Measured in a real browser before
   * changing anything: Enter DID pause and the menu DID open with the focus on "Continuar" — and the
   * second Enter did nothing at all. The game paused and could not be un-paused.
   *
   * ⚠️ AND THE CAUSE WAS MINE, ONE COMMIT OLD. This menu lives inside `#game-region`, where
   * `bindPinballControls` binds, so its keys were bubbling into the game — Enter on "Cores da mesa"
   * resumed the table behind the dialog it opened. The fix took the four cabinet keys off the game,
   * and took them off the BROWSER too: `preventDefault` cancelled the platform's own activation of
   * the focused button, so the press that should have chosen "Continuar" chose nothing.
   *
   * `Continuar` had survived the original bug by an accident of ordering — Chromium's sequence for
   * Enter on a button is keydown, then the click, then keyup, so the pause toggled to playing on the
   * way past and `onResume` set playing again, and `enterPhase` is idempotent. Two wrongs cancelling
   * in the one entry anybody presses, which is why nothing saw it until the keys were fixed.
   *
   * ⚠️ SO THE ANSWER IS NOT TO GO BACK TO LEANING ON THE PLATFORM. It is to make this menu work the
   * way the machine works, which is what the Dev is describing and what `shell/high-score-dialog`
   * already does: the FLIPPERS walk the entries, BUTTON 1 takes the one under the cursor, and START
   * closes the menu — the same key that opened it, which is what a start button on a cabinet means.
   *
   * Space still activates the focused button, because it is not a cabinet key and the platform's own
   * mechanisms are worth keeping: that is whackwhack's rule and this menu is made of real `<button>`s
   * precisely so it holds.
   */
  ownCabinetKeys(root as unknown as Parameters<typeof ownCabinetKeys>[0], {
    isOpen: () => root.style.display !== 'none',
    on: {
      left: () => moveTo(cursor - 1),
      right: () => moveTo(cursor + 1),
      plunger: () => choose(PAUSE_ENTRIES[cursor]!),
      // Start opened this menu, so start closes it. `resume` is the entry that means exactly that.
      pause: () => choose('resume'),
    },
  });

  root.appendChild(column);
  o.host.appendChild(root);

  return {
    element: root,
    /**
     * ⚠️ IDEMPOTENT, AND IT WAS NOT — WHICH IS WHY NOTHING IN THIS MENU EVER MOVED.
     *
     * `main`'s frame loop runs `phase === 'paused' ? open() : close()` EVERY FRAME, on purpose: "the
     * menu follows the phase rather than the key, so every way of pausing opens it". So `open()` is
     * called sixty times a second while the menu is up, and it took the focus every time.
     *
     * Measured: `.focus()` on the third entry moves the focus there and a `focusin` puts it straight
     * back on "Continuar" within the same frame. Every flipper press, every Tab, every click on
     * another entry was being undone before the player could see it — the menu looked frozen, and the
     * only entry reachable was the one the cursor was nailed to.
     *
     * The focus is taken on the TRANSITION, which is what "opening" meant all along.
     */
    open(): void {
      if (root.style.display === 'flex') return;
      root.style.display = 'flex';
      // The first entry, so a player who opened this by accident presses the same key twice and is back.
      moveTo(0);
    },
    close(): void { root.style.display = 'none'; },
    /**
     * The colours entry, so whatever it opens can hand the focus back to it.
     *
     * ⚠️ HANDING FOCUS BACK IS NOT A COURTESY. Hiding the element the focus is inside leaves the focus
     * nowhere and the next Tab starts at the top of the document — which `main` already records for
     * the button this entry replaced.
     */
    focusEntry(entry: PauseEntry): void { moveTo(PAUSE_ENTRIES.indexOf(entry)); },
  };
}

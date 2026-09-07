// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/high-score-dialog — where a finished game gets its name onto the board, spelled on a cabinet.
//
// ========================= WHY THIS HAD TO EXIST =========================
// ⚠️ `control/high-score` WAS READ AND NEVER WRITTEN. It was transcribed from `high_score.cpp`, tested
// down to the checksum and the thirty-one-character cap, shown under the table selector — and nothing
// in the game ever called `scorePosition`, `placeScore` or `writeTable`. Every game ended, the board
// said "nobody has played yet", and it always would.
//
// The module's orphan-ledger entry was retired on the grounds that the title screen READS it. Reading
// is half of a scoreboard. That was my own reasoning and it was wrong: "something imports it" is not
// "the feature works", which is the distinction this port keeps paying to relearn.
//
// ========================= AND WHY IT IS AN ALPHABET AND NOT A TEXT FIELD =========================
// ⚠️ THE DEV: "A tela de melhor pontuação precisa de um alfabeto na tela para que o jogador escreva
// usando os botões do controle, não pelo teclado. Arrume a UI, use o projeto whackwhack como
// referência."
//
// It was an `<input type="text">` and a Save button, which is a form and not a machine. The cabinet
// this port is of has two flippers, a plunger and a start button — `shell/controls.DEFAULT_BINDINGS`
// is the whole of it — and the machine it is a port of asks for your initials with exactly those. A
// player on a gamepad had no way to enter a name at all; a player at a keyboard had to leave the
// cabinet to use one.
//
// So the flippers walk an alphabet, the plunger takes the letter under the cursor, and start saves.
// That is the oldest interaction in pinball and it is the one the controls already describe.
//
// ========================= REAL BUTTONS, WHICH IS WHACKWHACK'S RULE =========================
// From `ui/screens` in that project, and it is the reason this is DOM and not painted into the
// canvas: "At the size this game rasterises, canvas text is illegible, does not scale with the
// reader's own type setting, and is invisible to a screen reader. So these are real headings and real
// `<button>`s, which also means Tab, Enter and Space work because the platform makes them work."
//
// Every key here is a `<button>`. The cabinet is one way to reach them and the platform's own — Tab,
// Enter, Space, a mouse, a touch — keep working beside it, for nothing.
//
// ⚠️ AND THE CURSOR IS THE FOCUS, NOT A SECOND THING BESIDE IT. A highlight kept alongside the focus
// is two answers to "where am I" that come apart the first time somebody presses Tab, and this
// repository has found that shape four times under other names. The index below is the only owner;
// focus is driven from it, and a button that receives focus by any other route writes the index back.
//
// ⚠️ THIRTY-ONE CHARACTERS, ENFORCED HERE AS WELL AS THERE. `placeScore` truncates because
// `high_score.cpp` does. An alphabet that let a player keep pressing would spell a name and then
// silently lose the end of it, which is worse than a key that stops responding.

import {
  scorePosition, placeScore, readTable, writeTable, MAX_NAME, type HighScoreStore,
} from '../control/high-score.js';
import { ownCabinetKeys } from './controls.js';

export const HIGH_SCORE_DIALOG_ID = 'pinball-high-score';

/**
 * What the cursor can be on.
 *
 * ⚠️ THE RUBOUT AND THE DONE ARE IN THE SAME WALK AS THE LETTERS, deliberately. A cabinet has three
 * buttons; a rubout the flippers could not reach would need a fourth, and this port's own `shell/pad`
 * records that `action4` is deliberately absent because the Dev's machine has three.
 */
interface Key {
  /** The character this key spells, or `undefined` for an action. */
  readonly ch?: string;
  readonly act?: 'rub' | 'done';
  /** What is drawn on it. */
  readonly face: string;
  /** What a reader says for it, when the face is not a word. */
  readonly labelKey?: string;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';

/**
 * The keys, in the order the flippers walk them.
 *
 * Letters first because that is what a name is made of, then digits, then the space, then the two
 * actions. A player spelling a short name never reaches the end of the walk; a player who wants the
 * rubout goes left from the start, which is one press.
 */
function keyboard(): Key[] {
  return [
    ...[...LETTERS].map((ch) => ({ ch, face: ch })),
    ...[...DIGITS].map((ch) => ({ ch, face: ch })),
    { ch: ' ', face: '␣', labelKey: 'pinball.highScore.space' },
    { act: 'rub' as const, face: '⌫', labelKey: 'pinball.highScore.rub' },
    { act: 'done' as const, face: '✓', labelKey: 'pinball.highScore.confirm' },
  ];
}

export interface HighScoreDialogOptions {
  readonly doc: Pick<Document, 'createElement'>;
  readonly host: Pick<HTMLElement, 'appendChild'>;
  readonly store: HighScoreStore;
  readonly t: (key: string) => string;
  /** Called once the score is on the board, or once the player has declined to put it there. */
  readonly onDone?: () => void;
}

export interface HighScoreDialog {
  /**
   * Offers the board to a finished game.
   *
   * @returns whether the score placed. A game that did not make the board shows nothing: being told
   * you failed to place is not information a player asked for.
   */
  offer(score: number): boolean;
  readonly element: HTMLElement;
}

export function mountHighScoreDialog(o: HighScoreDialogOptions): HighScoreDialog {
  const el = <T extends HTMLElement>(tag: string): T => o.doc.createElement(tag) as T;

  const root = el('div');
  root.id = HIGH_SCORE_DIALOG_ID;
  root.className = 'overlay pinball-high-score-entry';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', `${HIGH_SCORE_DIALOG_ID}-title`);
  root.setAttribute('aria-describedby', `${HIGH_SCORE_DIALOG_ID}-hint`);
  Object.assign(root.style, {
    position: 'absolute', left: '0', top: '0', width: '100%', height: '100%',
    display: 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: '2.5%', background: '#0e1017', color: '#e8ecf4', textAlign: 'center',
    containerType: 'inline-size', boxSizing: 'border-box', padding: '3% 4%',
  });

  const heading = el('h2');
  heading.id = `${HIGH_SCORE_DIALOG_ID}-title`;
  heading.textContent = o.t('pinball.highScore.title');
  Object.assign(heading.style, { fontSize: '6cqw', margin: '0' });
  root.appendChild(heading);

  const said = el('div');
  Object.assign(said.style, { fontSize: '4cqw', color: '#8a93a6' });
  root.appendChild(said);

  /**
   * The name as it is being spelled.
   *
   * ⚠️ A LIVE REGION, BECAUSE A PLAYER WHO CANNOT SEE THE SCREEN IS STILL SPELLING A NAME. Every
   * plunger press changes this text, and `aria-live="polite"` is what turns that change into
   * something said out loud. Without it the alphabet is operable and silent, which is the same
   * defect as a lamp wired to nothing.
   */
  const typed = el('div');
  typed.setAttribute('data-name', 'true');
  typed.setAttribute('aria-live', 'polite');
  typed.setAttribute('aria-label', o.t('pinball.highScore.name'));
  Object.assign(typed.style, {
    fontSize: '6cqw', minHeight: '1.2em', letterSpacing: '0.08em',
    borderBottom: '2px solid #8a93a6', minWidth: '60%', padding: '0 2%',
  });
  root.appendChild(typed);

  /**
   * ⚠️ THIRTEEN COLUMNS, WHICH IS THREE EXACT ROWS. There are thirty-nine keys — twenty-six letters,
   * ten digits, a space, a rubout and a done — and thirteen divides that with nothing left over, so
   * no row is ragged and no key is a different size from its neighbours.
   *
   * ⚠️ AND IT IS A HEIGHT DECISION BEFORE IT IS A TIDINESS ONE. The screen is 320x180. At ten columns
   * this is four rows, and four rows plus a heading, a score, the name and the hint measured out to
   * 180 pixels EXACTLY — which is a layout that overflows the moment a reader's own type setting is
   * larger than the default. Three rows leave room for that to happen.
   */
  const grid = el('div');
  Object.assign(grid.style, {
    display: 'grid', gridTemplateColumns: 'repeat(13, 1fr)', gap: '0.8cqw', width: '100%',
  });
  root.appendChild(grid);

  const hint = el('div');
  hint.id = `${HIGH_SCORE_DIALOG_ID}-hint`;
  hint.textContent = o.t('pinball.highScore.hint');
  Object.assign(hint.style, { fontSize: '3cqw', color: '#8a93a6' });
  root.appendChild(hint);

  const keys = keyboard();
  const buttons: HTMLElement[] = [];
  let cursor = 0;
  let name = '';
  let pending = 0;

  const showName = (): void => {
    typed.textContent = name;
  };

  /**
   * Puts the cursor somewhere, which means focusing that key.
   *
   * `data-cursor` is the same fact written where CSS can reach it: the focus ring is the browser's and
   * follows the reader's own settings, and this is what draws the cabinet's highlight over it.
   */
  const moveTo = (index: number): void => {
    cursor = ((index % keys.length) + keys.length) % keys.length;
    for (const [i, button] of buttons.entries()) {
      button.setAttribute('data-cursor', i === cursor ? 'true' : 'false');
      button.style.background = i === cursor ? '#38414f' : '#1a1e26';
    }
    buttons[cursor]?.focus();
  };

  const close = (): void => {
    root.style.display = 'none';
    o.onDone?.();
  };

  const record = (): void => {
    const table = readTable(o.store);
    const at = scorePosition(table, pending);
    // ⚠️ THE POSITION IS COMPUTED AGAIN HERE, not carried from `offer`. Between the two, another game
    // on the same browser could have taken the slot — and `placeScore` is happy to be handed a stale
    // index, which would drop somebody else's name.
    if (at >= 0) {
      const trimmed = name.trim();
      writeTable(o.store, placeScore(
        table, { name: trimmed || o.t('pinball.highScore.anonymous'), score: pending }, at,
      ));
    }
    close();
  };

  /** What pressing the key at `index` does. The one place a key's meaning is decided. */
  const activate = (index: number): void => {
    const key = keys[index];
    if (!key) return;
    if (key.act === 'done') { record(); return; }
    if (key.act === 'rub') { name = name.slice(0, -1); showName(); return; }
    // See the header: the cap is the original's, and the key stops rather than spelling into nothing.
    if (key.ch !== undefined && name.length < MAX_NAME) name += key.ch;
    showName();
  };

  for (const [i, key] of keys.entries()) {
    const button = el<HTMLElement>('button');
    button.setAttribute('type', 'button');
    button.textContent = key.face;
    if (key.ch !== undefined) button.setAttribute('data-key', key.ch);
    if (key.act) button.setAttribute('data-act', key.act);
    // A face that is not a word gets one, so a reader says "space" rather than the glyph's name.
    if (key.labelKey) button.setAttribute('aria-label', o.t(key.labelKey));
    Object.assign(button.style, {
      font: 'inherit', fontSize: '3.4cqw', padding: '1cqw 0', background: '#1a1e26',
      color: '#e8ecf4', border: '1px solid #4a5262', cursor: 'pointer', borderRadius: '0.6cqw',
    });
    button.addEventListener('click', () => { moveTo(i); activate(i); });
    /**
     * ⚠️ FOCUS WRITES THE INDEX BACK, which is what keeps the one fact one. Tab, a mouse and a screen
     * reader's own navigation all move focus without going through `moveTo`; without this line the
     * cursor would stay where the flippers last left it and the next flipper press would jump the
     * player back across the alphabet.
     */
    button.addEventListener('focus', () => {
      if (cursor !== i) moveTo(i);
    });
    grid.appendChild(button);
    buttons.push(button);
  }

  /**
   * The cabinet, for as long as this screen is up.
   *
   * ⚠️ `ownCabinetKeys` RATHER THAN A KEYDOWN OF ITS OWN, and the reason is in its own comment: every
   * overlay here lives inside the element `bindPinballControls` binds to, so the keys have to be
   * taken off the game and not merely off the browser. This screen was the first to notice; the pause
   * menu had the same hole and it was live there.
   *
   * ⚠️ START SAVES, AND IT IS NOT THE SAME AS PRESSING THE DONE KEY. A player who has spelled their
   * name should not have to walk the cursor to the end of the alphabet to finish; the machine has a
   * start button and on this screen that is what it is for.
   */
  ownCabinetKeys(root as unknown as Parameters<typeof ownCabinetKeys>[0], {
    isOpen: () => root.style.display !== 'none',
    on: {
      left: () => moveTo(cursor - 1),
      right: () => moveTo(cursor + 1),
      plunger: () => activate(cursor),
      pause: () => record(),
    },
  });

  o.host.appendChild(root);

  return {
    element: root,
    offer(score: number): boolean {
      // ⚠️ ASKED OF THE BOARD, NOT ASSUMED. A score of nought never places — `scorePosition` refuses
      // anything at or below it before looking — so a player who drained three balls without scoring
      // is not asked to sign for it.
      if (scorePosition(readTable(o.store), score) < 0) return false;
      pending = score;
      name = '';
      showName();
      said.textContent = String(score);
      root.style.display = 'flex';
      moveTo(0);
      return true;
    },
  };
}

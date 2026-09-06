// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/high-score-dialog — where a finished game gets its name onto the board.
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
// ========================= THE NAME =========================
// The original asks for one through a dialog, and so does this. A board full of "Jogador 1" is a board
// nobody reads twice, and there is nowhere else in this game a player has ever typed their name.
//
// ⚠️ THIRTY-ONE CHARACTERS, ENFORCED HERE AS WELL AS THERE. `placeScore` truncates because
// `high_score.cpp` does; the input says so too, because a field that silently eats what you typed is
// worse than one that stops you.

import {
  scorePosition, placeScore, readTable, writeTable, MAX_NAME, type HighScoreStore,
} from '../control/high-score.js';

export const HIGH_SCORE_DIALOG_ID = 'pinball-high-score';

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
  const root = o.doc.createElement('div');
  root.id = HIGH_SCORE_DIALOG_ID;
  root.className = 'overlay pinball-high-score-entry';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', o.t('pinball.highScore.title'));
  Object.assign(root.style, {
    position: 'absolute', left: '0', top: '0', width: '100%', height: '100%',
    display: 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: '4%', background: '#0e1017', color: '#e8ecf4', textAlign: 'center',
    containerType: 'inline-size', boxSizing: 'border-box', padding: '4%',
  });

  const heading = o.doc.createElement('div');
  heading.textContent = o.t('pinball.highScore.title');
  Object.assign(heading.style, { fontSize: '6cqw' });
  root.appendChild(heading);

  const said = o.doc.createElement('div');
  Object.assign(said.style, { fontSize: '4cqw', color: '#8a93a6' });
  root.appendChild(said);

  const input = o.doc.createElement('input');
  input.setAttribute('type', 'text');
  // See the header: the cap is the original's, and the field says so rather than eating what you type.
  input.setAttribute('maxlength', String(MAX_NAME));
  input.setAttribute('aria-label', o.t('pinball.highScore.name'));
  Object.assign(input.style, { font: 'inherit', fontSize: '4cqw', width: '70%', textAlign: 'center' });
  root.appendChild(input);

  const confirm = o.doc.createElement('button');
  confirm.textContent = o.t('pinball.highScore.confirm');
  Object.assign(confirm.style, {
    font: 'inherit', fontSize: '4cqw', padding: '2% 6%', background: '#1a1e26',
    color: '#e8ecf4', border: '1px solid #8a93a6', cursor: 'pointer',
  });
  root.appendChild(confirm);

  let pending = 0;

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
      const name = (input.value ?? '').trim();
      writeTable(o.store, placeScore(table, { name: name || o.t('pinball.highScore.anonymous'), score: pending }, at));
    }
    close();
  };

  confirm.addEventListener('click', record);
  // Enter is start on this cabinet, and in a text field it is also "done". Both are true here.
  input.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    record();
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
      input.value = '';
      said.textContent = String(score);
      root.style.display = 'flex';
      input.focus();
      return true;
    },
  };
}

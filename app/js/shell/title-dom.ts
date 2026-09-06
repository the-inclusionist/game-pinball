// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/title-dom — the markup for the first screen and the selector behind it.
//
// Thin on purpose: `shell/title` holds which screen is showing, what the selector offers and what
// choosing does, and every one of those is checked in node. What is left here is the part only a
// browser has — elements, a font, and a click.
//
// ========================= THE FONT IS BUNDLED, NOT FETCHED =========================
// ⚠️ AND THAT IS THE FIRST ASSET THIS REPOSITORY HAS EVER SHIPPED. `docs/LICENSES.md` § 4 said "there
// is no art in this repository: `git ls-files` matches no image, font or audio file at all", and the
// Dev asking for Press Start 2P is what ended that. It is OFL-1.1, the licence sits beside it, and the
// record says so — the two rules in § 4 exist for exactly this moment.
//
// Bundled rather than pulled from Google at boot, for two reasons that both matter more than the 12 KB:
// a game that has to run offline on a school machine cannot depend on a font server, and a request to a
// third party every time a child opens the title screen carries that child's address to them.
//
// ⚠️ AND NOTHING WAITS FOR IT. `document.fonts.add` is fired and not awaited: the stack falls back to
// the same monospace list the HUD uses, so a font that fails to decode costs the LOOK of the title and
// never the title itself. A screen that renders nothing until a download finishes is a screen that
// renders nothing on the machine this game is for.

import fontUrl from '../../assets/fonts/press-start-2p.woff2';
import { TITLE_LINES, TITLE_SUBTITLE, TITLE_BYLINE, type TitleScreen } from './title.js';
import { readTable, EMPTY_SCORE, type HighScoreStore } from '../control/high-score.js';
import { controlLegend } from './control-legend.js';

/** The same fallback the HUD reasons its way to: no download, no wait, no blank screen. */
const FALLBACK = 'ui-monospace, "DejaVu Sans Mono", Menlo, Consolas, monospace';
const FACE = `"Press Start 2P", ${FALLBACK}`;

const SURFACE = '#0e1017';
const INK = '#e8ecf4';
const DIM = '#8a93a6';

export interface TitleDomOptions {
  readonly doc: Pick<Document, 'createElement'>;
  readonly host: Pick<HTMLElement, 'appendChild'>;
  readonly screen: TitleScreen;
  readonly t: (key: string) => string;
  /** Where the high scores live. The selector is the only place they are shown. */
  readonly store: HighScoreStore;
  /** Called after the player picks, so the caller can hide this and start the game. */
  readonly onStarted?: () => void;
}

export interface TitleDom {
  /** Redraws for whatever screen `shell/title` now says is current. */
  refresh(): void;
  readonly element: HTMLElement;
}

function loadFont(): void {
  // Guarded because `FontFace` is absent in a node environment and in older browsers, and neither is
  // a reason for the screen not to draw.
  try {
    if (typeof FontFace === 'undefined' || !document.fonts) return;
    const face = new FontFace('Press Start 2P', `url(${fontUrl}) format("woff2")`);
    void face.load().then((loaded) => document.fonts.add(loaded)).catch(() => {});
  } catch {
    // See the header: the look is optional, the screen is not.
  }
}

export function mountTitle(o: TitleDomOptions): TitleDom {
  loadFont();

  const root = o.doc.createElement('div');
  root.className = 'pinball-title';
  Object.assign(root.style, {
    position: 'absolute', left: '0', top: '0', width: '100%', height: '100%',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: '4%', background: SURFACE, color: INK, fontFamily: FACE, textAlign: 'center',
    containerType: 'inline-size',
    // ⚠️ THE SCREEN IS 320x180 AND THIS MAY NOT MAKE IT TALLER. Without this the buttons pushed
    // `#game-region` down the page and the title sat half outside the canvas it is supposed to cover.
    overflow: 'hidden', boxSizing: 'border-box', padding: '2%',
  });

  const title = o.doc.createElement('button');
  // ⚠️ A BUTTON, NOT A DIV WITH A CLICK ON IT. The whole screen is the control — the Dev's words are
  // "ao clicar nesta tela" — and a div that responds to a pointer responds to nothing else: no Enter,
  // no Space, no focus ring, and nothing for a screen reader to announce as actionable.
  Object.assign(title.style, {
    display: 'flex', flexDirection: 'column', gap: '6%', alignItems: 'center',
    background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer',
    padding: '4%',
  });
  title.setAttribute('aria-label', `${TITLE_LINES.join(' ')} ${TITLE_SUBTITLE}`);

  for (const line of TITLE_LINES) {
    const el = o.doc.createElement('span');
    el.textContent = line;
    // Sized against the container rather than the viewport: the canvas is 320 wide whatever the page
    // is scaled to, and the title has to sit on the same grid as everything else drawn on it.
    // ⚠️ SEVEN GLYPHS OF A FIXED-WIDTH FACE, and Press Start 2P is a full em wide each. At 13cqw
    // "STUDENT" needs 91% of the width before letter-spacing and lost its first letter off the left
    // edge. Nine leaves room for the spacing and for a longer word than either of these.
    Object.assign(el.style, { fontSize: '9cqw', lineHeight: '1.25', letterSpacing: '0.04em' });
    title.appendChild(el);
  }

  const subtitle = o.doc.createElement('span');
  subtitle.textContent = TITLE_SUBTITLE;
  Object.assign(subtitle.style, { fontSize: '5cqw', color: DIM, letterSpacing: '0.25em' });
  title.appendChild(subtitle);

  /**
   * ⚠️ WHO MADE IT, ALIGNED TO THE RIGHT, asked for by name: "adicione a linha «by Prof. José Rocha»
   * abaixo da palavra PINBALL, alinhado à direita".
   *
   * ⚠️ AND `alignSelf`, NOT `textAlign`. The title is a centred flex COLUMN, so each child's box is
   * only as wide as its own text — aligning text inside a box that fits it is aligning nothing, and
   * the first attempt looked centred while the style said `right`. `alignSelf: flex-end` moves the
   * BOX to the block's right edge, which is what a reader sees and what the browser test measures with
   * `getBoundingClientRect` rather than by reading the style back.
   */
  const byline = o.doc.createElement('span');
  byline.className = 'pinball-byline';
  byline.textContent = TITLE_BYLINE;
  Object.assign(byline.style, {
    fontSize: '2.6cqw', color: DIM, alignSelf: 'flex-end', marginTop: '2%',
  });
  title.appendChild(byline);
  title.addEventListener('click', () => { o.screen.advance(); refresh(); });
  root.appendChild(title);

  const select = o.doc.createElement('div');
  select.className = 'pinball-select';
  /**
   * ⚠️ TWO COLUMNS, BECAUSE THE SCREEN IS LANDSCAPE AND THIS WAS A COLUMN DOWN THE MIDDLE OF IT.
   *
   * 320×180 is wider than it is tall, and one 80%-wide stack wasted the width while running out of
   * the height: five table buttons, a scoreboard of five names and a back link already reached the
   * bottom edge, and the controls could not have been added without pushing something off it. What
   * the player CHOOSES goes left; what they READ goes right.
   */
  Object.assign(select.style, {
    display: 'flex', flexDirection: 'row', gap: '4%', alignItems: 'stretch',
    justifyContent: 'center', width: '96%',
  });

  const chooseColumn = o.doc.createElement('div');
  Object.assign(chooseColumn.style, {
    display: 'flex', flexDirection: 'column', gap: '3%', alignItems: 'stretch', flex: '1 1 0',
  });
  const readColumn = o.doc.createElement('div');
  Object.assign(readColumn.style, {
    display: 'flex', flexDirection: 'column', gap: '3%', alignItems: 'stretch', flex: '1 1 0',
    textAlign: 'left',
  });
  // `appendChild` and not `append`: the node fakes implement the one the rest of this file uses, and a
  // column that silently fails to attach is a selector screen with nothing on it.
  select.appendChild(chooseColumn);
  select.appendChild(readColumn);

  for (const table of o.screen.tables) {
    const button = o.doc.createElement('button');
    button.textContent = table;
    button.setAttribute('data-table', table);
    Object.assign(button.style, {
      font: 'inherit', fontSize: '3cqw', padding: '1.5% 3%', width: '100%',
      background: '#1a1e26', color: INK, border: `1px solid ${DIM}`, cursor: 'pointer',
    });
    button.addEventListener('click', () => {
      o.screen.choose(table);
      refresh();
      o.onStarted?.();
    });
    chooseColumn.appendChild(button);
  }

  /**
   * ⚠️ WHAT THE KEYS ARE, WHICH THIS GAME HAS NEVER SAID ANYWHERE A PLAYER LOOKS.
   *
   * The cabinet is the one the Dev specified, it is bound, it is tested and a gamepad drives it — and
   * somebody opening the page was told none of it. They press the arrow keys, which this cabinet does
   * not use, and reach the conclusion the Dev reached twice from the other side of the same silence:
   * "teclado e mouse continuam não funcionando no jogo." The keys were in `docs/README` throughout, and
   * a player is not reading the README.
   *
   * ⚠️ AND THE ROWS ARE READ OUT OF THE BINDINGS. See `shell/control-legend`: a legend that is typed
   * out is right on the day it is typed. This one changes when a key changes.
   */
  const controls = o.doc.createElement('div');
  controls.className = 'pinball-controls';
  Object.assign(controls.style, { fontSize: '2.6cqw', color: DIM, lineHeight: '1.5' });
  const controlsHeading = o.doc.createElement('div');
  controlsHeading.textContent = o.t('pinball.controls.title');
  Object.assign(controlsHeading.style, { color: INK, marginBottom: '2%' });
  controls.appendChild(controlsHeading);
  for (const row of controlLegend()) {
    const line = o.doc.createElement('div');
    Object.assign(line.style, { display: 'flex', justifyContent: 'space-between', gap: '4%' });
    const what = o.doc.createElement('span');
    what.textContent = o.t(row.labelKey);
    const keys = o.doc.createElement('span');
    // ⚠️ EVERY key, not the first one. Two keys per flipper is accessibility rather than convenience —
    // `shell/controls` argues it — and showing one of the pair hides the half that was the point.
    keys.textContent = row.keys.join(' · ');
    Object.assign(keys.style, { color: INK, whiteSpace: 'nowrap' });
    line.appendChild(what);
    line.appendChild(keys);
    controls.appendChild(line);
  }
  readColumn.appendChild(controls);

  /**
   * ⚠️ THE SCOREBOARD IS SHOWN HERE, which is what retires `control/high-score` from the orphan
   * ledger. The original shows it on its own screen from a menu; this game has one screen before the
   * table and it is this, so the five names live under the selector where a player passes them on the
   * way in.
   */
  const scores = o.doc.createElement('div');
  scores.className = 'pinball-high-scores';
  // The same line height as the legend above it: two blocks of small text in one column read as one
  // list when their lines are spaced differently, and the heading was landing on the row under it.
  Object.assign(scores.style, { fontSize: '2.6cqw', color: DIM, marginTop: '2%', lineHeight: '1.5' });
  readColumn.appendChild(scores);

  const back = o.doc.createElement('button');
  back.textContent = o.t('pinball.title.back');
  Object.assign(back.style, {
    font: 'inherit', fontSize: '3cqw', background: 'none', border: 'none', color: DIM,
    cursor: 'pointer', marginTop: '2%',
  });
  back.addEventListener('click', () => { o.screen.back(); refresh(); });
  chooseColumn.appendChild(back);
  root.appendChild(select);

  /**
   * ⚠️ `display`, NOT `hidden`, AND THE DIFFERENCE PUT BOTH SCREENS ON AT ONCE.
   *
   * `hidden` works by a rule in the user-agent stylesheet — `[hidden] { display: none }` — and every
   * element here is laid out with an INLINE `display: flex`. An inline style beats a stylesheet, so
   * setting `hidden` marked the elements and hid nothing: the title, the five table buttons and the
   * back link all drew on top of each other on the first boot after this shipped.
   *
   * Found by opening the page. `tests/shell-options-dialog.browser` already asks this question of the
   * palette dialog — "a closed dialog is really gone, not merely marked", measured with
   * `getBoundingClientRect` — and that dialog passes because it sets no inline `display`. This module
   * had no such test, and the same class of defect walked straight in.
   */
  const show = (el: HTMLElement, visible: boolean, as: string): void => {
    el.style.display = visible ? as : 'none';
  };

  function refresh(): void {
    const at = o.screen.current;
    show(title, at === 'title', 'flex');
    show(select, at === 'select', 'flex');
    // The whole screen steps aside once a game is running: the table is behind it.
    show(root, at !== 'playing', 'flex');

    if (at !== 'select') return;
    // Read every time the selector opens, never cached: a game finished since it was last shown is
    // exactly when this changed.
    scores.textContent = '';
    const heading = o.doc.createElement('div');
    heading.textContent = o.t('pinball.title.highScores');
    Object.assign(heading.style, { color: INK, marginBottom: '2%' });
    scores.appendChild(heading);

    const table = readTable(o.store);
    const played = table.filter((entry) => entry.score > EMPTY_SCORE && entry.name !== '');
    if (played.length === 0) {
      const none = o.doc.createElement('div');
      // An empty scoreboard says so. A blank space says the feature is broken.
      none.textContent = o.t('pinball.title.noScores');
      scores.appendChild(none);
      return;
    }
    for (const entry of played) {
      const row = o.doc.createElement('div');
      Object.assign(row.style, { display: 'flex', justifyContent: 'space-between' });
      const who = o.doc.createElement('span');
      who.textContent = entry.name;
      const what = o.doc.createElement('span');
      what.textContent = String(entry.score);
      row.append?.(who, what);
      scores.appendChild(row);
    }
  }

  refresh();
  o.host.appendChild(root);
  return { refresh, element: root };
}

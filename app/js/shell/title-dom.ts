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
import { backdropUrl } from '../gfx/backdrop.js';
import { screenBackground, PANEL, CHERRY, NEON, UI_INK, UI_DIM } from './screen-art.js';
import type { PinballAction } from './controls.js';

/** The same fallback the HUD reasons its way to: no download, no wait, no blank screen. */
const FALLBACK = 'ui-monospace, "DejaVu Sans Mono", Menlo, Consolas, monospace';
const FACE = `"Press Start 2P", ${FALLBACK}`;

const SURFACE = '#0e1017';
// ⚠️ BUILT FROM `shell/screen-art`'S NUMBERS RATHER THAN WRITTEN OUT. The photograph behind these
// screens is dimmed to a ceiling computed from INK, and the panels are sized to DIM; a second copy of
// either colour here is a copy that can drift away from the one the gate measures against.
const rgb = (c: { r: number; g: number; b: number }): string => `rgb(${c.r}, ${c.g}, ${c.b})`;
const INK = rgb(UI_INK);
const DIM = rgb(UI_DIM);



export interface TitleDomOptions {
  readonly doc: Pick<Document, 'createElement'>;
  readonly host: Pick<HTMLElement, 'appendChild'>;
  readonly screen: TitleScreen;
  readonly t: (key: string) => string;
  /** Where the high scores live. The selector is the only place they are shown. */
  readonly store: HighScoreStore;
  /** Called after the player picks, so the caller can hide this and start the game. */
  readonly onStarted?: () => void;
  /**
   * The cabinet as the player has it now, for the legend on the selector.
   *
   * ⚠️ A FUNCTION AND NOT A VALUE, and absent means the defaults. `controlLegend` has always accepted
   * a table and this module called it with none, so the list was `DEFAULT_BINDINGS` for ever —
   * correct for exactly as long as the keys were a constant, which they stopped being the day the
   * pause menu learned to edit them. A legend that lies is worse than no legend: the player who just
   * moved the launch key is the one who comes here to read it.
   */
  readonly bindings?: () => Readonly<Record<PinballAction, readonly string[]>>;
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
    gap: '4cqw', background: SURFACE, color: INK, fontFamily: FACE, textAlign: 'center',
    /**
     * ⚠️ THE PHOTOGRAPH GOES HERE AND IS SWAPPED IN `refresh`, because this one element is all three
     * screens: the title, the selector and the mission question take turns inside it. `SURFACE` stays
     * as the colour UNDER the picture — a build with no `app/assets/screens/` still has a background,
     * and so does the fraction of a second before the file has decoded.
     */
    backgroundSize: 'cover', backgroundPosition: 'center', imageRendering: 'pixelated',
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
    /**
     * ⚠️ A CHERRY BORDER, AND IT IS DOING TWO JOBS. The Dev asked for it — "Crie uma borda em volta de
     * SPACE STUDENT na cor cereja" — in the same message that took the dimming off the photograph
     * behind it, and the two go together: nothing holds the ground down any more, so the letters hold
     * themselves up. A white face inside a cherry outline reads on a sunrise and on black space alike,
     * because what the eye finds is the EDGE rather than the fill.
     *
     * ⚠️ `paint-order: stroke fill` OR THE BORDER EATS THE LETTER. `-webkit-text-stroke` is centred on
     * the glyph's own outline by default, so half of a 0.4cqw stroke lands INSIDE the letter and a
     * fixed-width face at this size loses most of its counters. Painting the stroke first and the fill
     * over it puts the whole width outside, which is what a border means.
     */
    Object.assign(el.style, {
      fontSize: '9cqw', lineHeight: '1.25', letterSpacing: '0.04em',
      WebkitTextStrokeWidth: '0.42cqw', WebkitTextStrokeColor: CHERRY, paintOrder: 'stroke fill',
    });
    title.appendChild(el);
  }

  const subtitle = o.doc.createElement('span');
  subtitle.textContent = TITLE_SUBTITLE;
  /**
   * ⚠️ CHERRY, WITH NO OUTLINE AND A NEON GLOW, asked for in those words: "pinte pinball na cor
   * cereja, sem contorno. Adicione efeito neon em pinball."
   *
   * ⚠️ AND THE GLOW IS WHAT MAKES IT LEGIBLE, WHICH IS WHY IT IS NOT DECORATION. Cherry sits low in
   * the middle of the lightness range — Y 0.1398 — so on an undimmed photograph there is always some
   * patch it very nearly matches, and a fill that matches its ground is invisible however saturated it
   * is. The halo is a ring of light around every stroke: what the eye finds is the glow against the
   * ground and the letter against the glow, and neither of those is a coincidence of what the
   * photograph is doing there.
   *
   * Three layers, tight to wide. One layer is a blur; three is a tube.
   */
  Object.assign(subtitle.style, {
    fontSize: '5cqw', color: CHERRY, letterSpacing: '0.25em',
    textShadow: `0 0 0.5cqw ${NEON}, 0 0 1.4cqw ${NEON}, 0 0 3cqw ${NEON}`,
  });
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
  /**
   * ⚠️ THE ONE BLOCK ON THIS SCREEN THE DEV DID NOT SPECIFY, AND IT IS THE SMALLEST. SPACE STUDENT has
   * its border and PINBALL its glow; the credit under them is eight pixels of unoutlined text, and the
   * photograph behind it is no longer held down. A stroke at this size would close the counters of a
   * fixed-width face — measured, it turns `Prof.` into a smear — so it takes the other classic
   * treatment instead: a tight dark shadow, which is a ring of dark rather than a ring of colour and
   * costs the letterforms nothing.
   *
   * It is the minimum that keeps a name readable over a sunrise, and it is mine rather than his.
   */
  Object.assign(byline.style, {
    fontSize: '2.6cqw', color: INK, alignSelf: 'flex-end', marginTop: '2%',
    textShadow: '0 0 0.25cqw #000, 0 0 0.6cqw #000',
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

  /**
   * ⚠️ THE GAPS ARE LENGTHS AND NOT PER-CENT, AND THAT IS A BUG FIX RATHER THAN A TIDY-UP.
   *
   * A percentage ROW gap resolves against the container's own height — and this container's height
   * comes from its content, which is a cycle. CSS breaks it by treating the gap as ZERO while it works
   * out how tall the content is, and only then resolving the per-cent against the answer. So the six
   * gaps were free: they cost nothing in the sizing pass and 9.5 pixels each afterwards.
   *
   * Measured, the moment the thumbnails made it matter: the column asked for 279 pixels, laid out
   * 329, and the "Voltar" link finished 10 pixels below the bottom of the game. `tests/screens-fit`
   * is what caught it — the layout had been living on the discrepancy since the two columns were
   * written, with just enough slack that nothing showed.
   *
   * `cqw` is a length against the game's own width, so it counts in the sizing pass and still scales
   * with the screen, which is the property the per-cent was there for.
   */
  const chooseColumn = o.doc.createElement('div');
  Object.assign(chooseColumn.style, {
    display: 'flex', flexDirection: 'column', gap: '1.1cqw', alignItems: 'stretch', flex: '1 1 0',
  });
  const readColumn = o.doc.createElement('div');
  Object.assign(readColumn.style, {
    display: 'flex', flexDirection: 'column', gap: '1.5cqw', alignItems: 'stretch', flex: '1 1 0',
    textAlign: 'left',
  });
  // `appendChild` and not `append`: the node fakes implement the one the rest of this file uses, and a
  // column that silently fails to attach is a selector screen with nothing on it.
  select.appendChild(chooseColumn);
  select.appendChild(readColumn);

  for (const table of o.screen.tables) {
    const button = o.doc.createElement('button');
    button.setAttribute('data-table', table);
    /**
     * ⚠️ A ROW OF PICTURE-THEN-NAME, asked for by the Dev: "eu gostaria de um thumbnail para cada
     * mesa, e não somente os nomes." — "e não somente", so the name stays and the picture joins it.
     * Six dark rectangles with nothing written under them is not something a player can choose from.
     *
     * ⚠️ AND THE VERTICAL PADDING SHRANK TO PAY FOR IT. The picture is now what sets the row's height,
     * so the 1.5% that used to give the text some air is 0.6%: six rows that each grew by the whole
     * height of a thumbnail would have pushed the back link off the bottom of a 180-pixel screen.
     * `tests/screens-fit` is what says whether that arithmetic came out.
     */
    Object.assign(button.style, {
      font: 'inherit', fontSize: '3cqw', padding: '0.6% 3%', width: '100%',
      background: '#1a1e26', color: INK, border: `1px solid ${DIM}`, cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: '4%', textAlign: 'left',
    });

    const url = backdropUrl(table);
    if (url !== undefined) {
      const thumb = o.doc.createElement('img');
      thumb.src = url;
      /**
       * ⚠️ EMPTY `alt`, WHICH IS A DECISION AND NOT AN OMISSION. The button's accessible name is the
       * table's name, which is in the span beside this and is the thing a listener needs. An `alt`
       * here would put a second name on the same control and read it twice; describing the picture
       * instead ("a dark playfield with three wells") is prose no one wrote and no one maintains.
       * The picture is what a SIGHTED player uses to tell the rows apart, and the row is already
       * labelled for everyone else.
       */
      thumb.alt = '';
      /**
       * ⚠️ A SQUARE BOX WITH `contain`, NOT A FIXED HEIGHT WITH A FREE WIDTH. Five of the six
       * playfields are portrait and `ring-belt` is 360x240 landscape; letting each picture take its
       * natural width would give the column six different indents and the names would not line up.
       * Boxed, the art letterboxes inside and every name starts in the same place.
       *
       * ⚠️ AND `pixelated`, for the reason the canvas is: this is pixel art being shown smaller than
       * it was drawn, and smoothing it is the one thing that turns it into a smudge.
       */
      Object.assign(thumb.style, {
        /**
         * ⚠️ 4.2 AND IT WAS 5, AND THE SEVENTH TABLE IS WHY. `factory` joined the selector and pushed
         * it to 178.5 pixels of the 180 it has, against a gate that wants a line to spare. Six rows
         * fitted at five; seven do not, and the thumbnail is the tallest thing in a row.
         *
         * This is the second time this screen has paid for something: the thumbnails themselves cost
         * the panels their padding. What is being spent each time is the height ADR-0002 traded away
         * to keep the flippers uncovered, and there is not much of it left — an eighth table will need
         * a different layout rather than another shave.
         */
        width: '4.2cqw', height: '4.2cqw', objectFit: 'contain', imageRendering: 'pixelated',
        flex: '0 0 auto',
      });
      button.appendChild(thumb);
    }

    const label = o.doc.createElement('span');
    label.textContent = table;
    button.appendChild(label);
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
  /**
   * ⚠️ 1.35 AND NOT 1.5, AND THE CHANGE IS HEADROOM RATHER THAN TASTE. This screen measured 180.0
   * pixels of the 180.5 it has — seven legend rows, a scoreboard, five table buttons and a back link
   * — so it fitted with nothing to spare, and the first thing that touched the page's typography
   * broke it: giving `body` a `font-family` at all pushed it to 182.4.
   *
   * A layout with no headroom is a layout that is correct for one font on one machine. The legend is
   * where the rows are, so the legend is where the room comes from.
   */
  Object.assign(controls.style, {
    fontSize: '2.6cqw', color: DIM, lineHeight: '1.35',
    // See `PANEL`: DIM on the photograph is 1.73:1, and this is what makes it 5:1 again.
    // ⚠️ THE PADDING IS 1% AND NOT 2%, AND THE SELECTOR IS WHY. Two panels at 2% put the screen at
    // 175.8 of the 180 it has, against a gate that wants a line to spare — the same twelve pixels the
    // thumbnails had already spent. A panel needs enough room that the text is not touching its edge;
    // beyond that it is decoration, and this screen has none to give.
    background: PANEL, padding: '1% 3%',
  });
  const controlsHeading = o.doc.createElement('div');
  controlsHeading.textContent = o.t('pinball.controls.title');
  Object.assign(controlsHeading.style, { color: INK, marginBottom: '2%' });
  controls.appendChild(controlsHeading);
  for (const row of controlLegend(o.bindings?.())) {
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
  Object.assign(scores.style, {
    // ⚠️ NO MARGIN ABOVE IT ANY MORE. The two blocks used to need one to read as two lists; now they
    // are two PANELS with the photograph showing in the column's gap between them, which separates
    // them better than white space did and costs the two pixels the screen did not have.
    fontSize: '2.6cqw', color: DIM, lineHeight: '1.35',
    background: PANEL, padding: '1% 3%',
  });
  readColumn.appendChild(scores);

  const back = o.doc.createElement('button');
  back.textContent = o.t('pinball.title.back');
  Object.assign(back.style, {
    font: 'inherit', fontSize: '3cqw', background: PANEL, border: 'none', color: DIM,
    cursor: 'pointer', marginTop: '1%', padding: '0.5% 0',
  });
  back.addEventListener('click', () => { o.screen.back(); refresh(); });
  chooseColumn.appendChild(back);
  root.appendChild(select);

  /**
   * ⚠️ THE MISSION SCREEN, WHICH THE DEV PUT BETWEEN THE TABLE AND THE GAME: "Após escolher a tela, a
   * próxima tela é a da missão principal. o jogador deve escolher um número de 2 a 9."
   *
   * ⚠️ AND IT SAYS WHAT THE NUMBER IS FOR. Eight bare digits is a screen a child has to guess at. The
   * rule is one sentence — hit the comets carrying multiples, a wrong one costs a point — and this is
   * the only place it is ever written down, because a player is not reading the README and the comets
   * themselves carry nothing but numbers.
   */
  const mission = o.doc.createElement('div');
  mission.className = 'pinball-mission';
  Object.assign(mission.style, {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2.5cqw', width: '92%',
  });

  const missionHeading = o.doc.createElement('div');
  missionHeading.textContent = o.t('pinball.comets.choose');
  Object.assign(missionHeading.style, { fontSize: '5cqw', color: INK, letterSpacing: '0.06em' });
  mission.appendChild(missionHeading);

  const missionExplain = o.doc.createElement('div');
  missionExplain.textContent = o.t('pinball.comets.explain');
  Object.assign(missionExplain.style, {
    fontSize: '2.6cqw', color: DIM, lineHeight: '1.4', maxWidth: '84%',
    background: PANEL, padding: '1.5% 3%',
  });
  mission.appendChild(missionExplain);

  /**
   * ⚠️ FOUR ACROSS AND TWO DOWN, not eight in a row. Eight buttons across 320 pixels leaves 34 each
   * before the gaps, and a single digit in a fixed-width face at a size worth pressing needs more than
   * that — the first attempt fitted only by shrinking the numbers to where they were the smallest text
   * on a screen whose whole subject they are.
   */
  const numbers = o.doc.createElement('div');
  Object.assign(numbers.style, {
    display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '2cqw', width: '100%',
  });
  for (const times of o.screen.numbers) {
    const button = o.doc.createElement('button');
    button.textContent = String(times);
    button.setAttribute('data-times', String(times));
    Object.assign(button.style, {
      font: 'inherit', fontSize: '5cqw', padding: '1.4cqw 0', width: '18%',
      background: '#1a1e26', color: INK, border: `1px solid ${DIM}`, cursor: 'pointer',
    });
    button.addEventListener('click', () => {
      o.screen.pick(times);
      refresh();
      o.onStarted?.();
    });
    numbers.appendChild(button);
  }
  mission.appendChild(numbers);

  const missionBack = o.doc.createElement('button');
  missionBack.textContent = o.t('pinball.title.back');
  Object.assign(missionBack.style, {
    font: 'inherit', fontSize: '3cqw', background: PANEL, border: 'none', color: DIM,
    cursor: 'pointer', padding: '1% 3%',
  });
  missionBack.addEventListener('click', () => { o.screen.back(); refresh(); });
  mission.appendChild(missionBack);
  root.appendChild(mission);

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
    /**
     * ⚠️ THE DEV'S RULE, EXACTLY: "Use background.jpg como fundo de todas as telas que não tenham mesa
     * com exceção da primeira tela. Para a tela inicial, use start.jpg como background."
     *
     * `playing` is left with no picture rather than given one, and that is not an omission: the whole
     * of this element is hidden while a game is running, and painting a photograph behind a hidden
     * element is a decode nobody will ever see.
     */
    root.style.backgroundImage = screenBackground(
      at === 'title' ? 'start' : at === 'playing' ? null : 'background',
    );
    show(title, at === 'title', 'flex');
    show(select, at === 'select', 'flex');
    show(mission, at === 'mission', 'flex');
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

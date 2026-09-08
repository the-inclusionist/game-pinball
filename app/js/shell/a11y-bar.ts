// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/a11y-bar — blind mode, the sonar and the table's colours, as icons in the HUD.
//
// ⚠️ THE DEV: "remova modo cego sonar e cores via teclado: eles devem aparecer no hud da mesma forma que
// aparecem no projeto game-platformer."
//
// ========================= AND THAT OVERRULES AN ARGUMENT THIS PROJECT MADE TWICE =========================
// `shell/controls` has said since it was written that these three must be KEYS: "a player who needs blind
// mode is not the player who is going to find it in a settings panel." That reasoning was right about
// the danger and wrong about the alternative — it assumed the other option was a settings panel. It is
// not. It is an icon that is ON SCREEN, all the time, next to the score.
//
// The engine reached the same place first, and by the same road: `ui/pause-icons` records that "desde o
// item 7 do ADR-0044 os ícones vivem no HUD, e um cartão de pausa não contém `.pi-btn` nenhum." The bar
// began in the pause menu there too and was moved out of it.
//
// ========================= THE SAME FORM, WHICH IS WHAT HE ASKED FOR =========================
// `.pi-btn` buttons carrying an emoji and a `data-pi` key, with the `aria-label` carrying the STATE —
// "Modo cego, ligado" — rewritten on every change, exactly as `reflectIconBtn` does there. That is not
// imitation for its own sake: a child who moves between the two games meets the same three things in the
// same shape, and a teacher who has learnt one has learnt both.
//
// ⚠️ THE GLYPH FOR BLIND MODE IS THE ENGINE'S OWN. `PAUSE_ICONS` names it 🦯 under `icon.blind`, and
// taking a different one would be this game calling the same feature something else. The other two have
// no counterpart there — the engine has no table palette and no sonar sweep — so they are ours, and they
// are chosen to be legible at ten pixels rather than to be clever.
import { PAUSE_ICONS } from '@the-inclusionist/engine/ui/pause-icons.js';

/** What a button does and what it reports. */
export interface A11yToggle {
  /** `data-pi`, which is the dispatch key in the platformer too. */
  readonly key: string;
  /** The emoji. */
  readonly glyph: string;
  /** i18n key of the name. */
  readonly labelKey: string;
  /**
   * How the label reports the control.
   *
   * ⚠️ THREE AND NOT A BOOLEAN, because the palette named itself twice. With `stateful: true` the label
   * came out "Cores, Cores para daltonismo": the button's own name, then a state whose name already
   * contains it. A palette's state IS its name — "Cores para daltonismo" says both what the control is
   * and what it is doing — so it takes `named`, which uses the state alone.
   */
  readonly reports: 'onOff' | 'named' | 'action';
}

/**
 * ⚠️ THE SONAR IS AN ACTION AND THE OTHER TWO ARE STATES, which is why `reports` exists rather than
 * every button announcing an on and an off. A sweep happens once; saying "sonar, ligado" after it would
 * describe a mode the game does not have.
 */
export const A11Y_TOGGLES: readonly A11yToggle[] = [
  {
    key: 'blind',
    // The engine's own glyph, read out of its table rather than copied — see this module's header.
    glyph: PAUSE_ICONS.find((i) => i.k === 'blind')?.e ?? '🦯',
    labelKey: 'pinball.controls.blindMode',
    reports: 'onOff',
  },
  { key: 'sonar', glyph: '📡', labelKey: 'pinball.controls.sweep', reports: 'action' },
  { key: 'palette', glyph: '🎨', labelKey: 'pinball.controls.palette', reports: 'named' },
];

export interface A11yBarOptions {
  readonly doc: Pick<Document, 'createElement'>;
  readonly host: Pick<HTMLElement, 'appendChild'>;
  readonly t: (key: string, params?: Record<string, string | number>) => string;
  /**
   * Where the bar sits, in the same per-cent boxes the HUD's blocks use — or ABSENT, which puts it in
   * the normal flow of whatever it is mounted in.
   *
   * ⚠️ ABSENT IS WHAT THE GAME USES NOW, and the corner is kept for a reason it may be needed again.
   * The Dev asked for these icons "no topo desde a primeira tela", and in the HUD's corner they landed
   * straight through the first two rows of the table list — seen in the browser, `low-orbit` with a
   * white stick across its name. Paying for a strip inside the screen was measured and refused: the
   * selector came to 182 pixels of 180, and `tests/screens-fit` exists because it once came to 194.
   *
   * So the bar is page chrome now, above the canvas, which is where `game-platformer` puts the same
   * three controls — and that is the identity the Dev asked this game to share. It costs the game no
   * pixels at all.
   */
  readonly box?: { readonly left: string; readonly top: string; readonly width: string };
  readonly onBlind: () => void;
  readonly onSonar: () => void;
  readonly onPalette: () => void;
  /** Whether blind mode is on right now, for the label. */
  readonly blind: () => boolean;
  /** The name of the palette in force, for the label. */
  readonly palette: () => string;
}

export interface A11yBar {
  readonly element: HTMLElement;
  /** Rewrites the stateful labels. Called whenever one of them may have changed. */
  refresh(): void;
  setVisible(visible: boolean): void;
}

export const A11Y_BAR_ID = 'pinball-a11y';

export function mountA11yBar(o: A11yBarOptions): A11yBar {
  const root = o.doc.createElement('div');
  root.id = A11Y_BAR_ID;
  root.className = 'pinball-a11y';
  Object.assign(root.style, {
    ...(o.box
      ? { position: 'absolute', left: o.box.left, top: o.box.top, width: o.box.width }
      : {}),
    display: 'flex', flexDirection: 'row', gap: '0.4rem', alignItems: 'center',
    // ⚠️ THE POINTER GOES THROUGH THE BAR AND NOT THROUGH THE BUTTONS. The HUD's own container does the
    // same: an overlay that swallowed clicks would make the table unclickable, and clicking the table is
    // how a player puts the focus back on `#game-region`.
    pointerEvents: 'none',
  });

  const buttons = A11Y_TOGGLES.map((toggle) => {
    const button = o.doc.createElement('button');
    button.className = 'pi-btn';
    button.setAttribute('type', 'button');
    button.setAttribute('data-pi', toggle.key);
    button.textContent = toggle.glyph;
    Object.assign(button.style, {
      pointerEvents: 'auto', cursor: 'pointer', border: 'none', padding: '0',
      background: 'rgba(14, 16, 23, 0.72)', color: '#e8ecf4',
      // Sized against the game rather than the page: the HUD is 320 wide whatever the canvas is scaled
      // to, and an icon in the corner has to sit on the same grid as the score beside it.
      ...(o.box
        // Sized against the GAME: the HUD is 320 wide whatever the canvas is scaled to, and an icon in
        // the corner has to sit on the same grid as the score beside it.
        ? { fontSize: '3.4cqw', width: '5cqw', height: '5cqw' }
        /**
         * ⚠️ SIZED AGAINST THE PAGE, AND 44 PIXELS IS NOT A ROUND NUMBER. WCAG 2.2's 2.5.8 asks for a
         * target of at least 24 by 24 and 2.5.5 for 44 by 44; these are the three controls a player who
         * cannot see the screen has to hit, so they take the larger figure and not the minimum.
         */
        : { fontSize: '1.25rem', width: '44px', height: '44px' }),
      lineHeight: '1', borderRadius: '20%',
    });
    button.addEventListener('click', () => {
      if (toggle.key === 'blind') o.onBlind();
      else if (toggle.key === 'sonar') o.onSonar();
      else o.onPalette();
      refresh();
    });
    root.appendChild(button);
    return { toggle, button };
  });

  /**
   * ⚠️ THE LABEL CARRIES THE STATE, which is the whole reason this is not three plain buttons.
   *
   * `reflectIconBtn` in the engine rewrites `aria-label` on every change so a screen reader announcing
   * the control also announces what it is currently doing — "Modo cego, ligado". A button whose name
   * never changes tells a blind player what the control is FOR and never what it is DOING, which on a
   * switch is the half that matters.
   */
  function refresh(): void {
    for (const { toggle, button } of buttons) {
      const name = o.t(toggle.labelKey);
      if (toggle.reports === 'action') button.setAttribute('aria-label', name);
      else if (toggle.reports === 'named') button.setAttribute('aria-label', o.palette());
      else {
        button.setAttribute('aria-label',
          `${name}, ${o.t(o.blind() ? 'pinball.a11y.on' : 'pinball.a11y.off')}`);
      }
    }
  }

  refresh();
  o.host.appendChild(root);

  return {
    element: root,
    refresh,
    setVisible(visible: boolean) { root.style.display = visible ? 'flex' : 'none'; },
  };
}

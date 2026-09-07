// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/hud-view — what the four corner blocks say, and where they go.
//
// ========================= ADR-0002 WAS APPLIED TO ARITHMETIC, NOT TO A SCREEN =========================
// `layoutHud` has computed four rectangles since phase 6 and a test has held that they do not overlap.
// The running game showed none of them: no score, no ball count, no player name, no hint. The record
// was real, the layout was right, and nothing drew it — the fifth time in this port that something
// declared turned out to be inert.
//
// ========================= THE TEXT GOES IN THE DOM, AND THAT IS THE ENGINE'S RULE =========================
// ADR-0010 resolves "AAA text versus a 320x180 screen" as TEXT IN THE DOM, and both halves of that
// matter here. A four-pixel digit cannot meet a size-and-contrast requirement at any zoom the player
// controls; and a number painted into a framebuffer is invisible to a screen reader however sharp it
// is. So the pixels stay the table and the words stay words.
//
// This module is the half that touches no DOM — what the blocks SAY and where they go — because that
// is the half worth testing, and because the engine's own HUD splits the same way (`HudRowView`:
// "tudo que updateGameHud() escreve no DOM, sem tocar no DOM").

import type { HudLayout, HudConfig } from './hud.js';
import type { Translate } from '../i18n/index.js';

export interface HudState {
  readonly score: number;
  readonly ballCount: number;
  readonly playerNumber: number;
  /** The mission or info line. Empty means there is nothing to say. */
  readonly hint: string;
  /**
   * The comet drill: how many mission points, out of how many wins.
   *
   * ⚠️ OPTIONAL, BECAUSE NOT EVERY GAME HAS ONE. The 1995 demonstration runs no comet mission at all,
   * and a "Missão: 0/20" over a table with no comets on it would be the HUD reporting a thing that is
   * not happening — the same fault as the ball count that sat at three while the player could not lose.
   */
  readonly mission?: { readonly have: number; readonly need: number };
}

/** One block: what is shown, and what is heard. They differ, and that difference is the point. */
export interface HudBlockView {
  readonly text: string;
  /** The accessible name. For the score it carries the word the corner has no room for. */
  readonly label: string;
}

export interface HudTextView {
  readonly score: HudBlockView;
  readonly balls: HudBlockView;
  readonly player: HudBlockView;
  readonly mission: HudBlockView;
  readonly hint: HudBlockView;
}

/**
 * ⚠️ GROUPED, because seven digits across sixty-two pixels is a smear.
 *
 * Thin spaces rather than commas or full stops: the separator differs by locale and getting it wrong
 * reads as a decimal point to half the players. A space is the one grouping mark that is wrong nowhere.
 */
export function groupDigits(value: number): string {
  return Math.trunc(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function hudView(state: HudState, t: Translate): HudTextView {
  return {
    // The digits are shown; the WORD is only heard. There is no room for both in a corner, and a bare
    // number read aloud out of nowhere is not information.
    score: { text: groupDigits(state.score), label: t('pinball.hud.score', { n: state.score }) },
    balls: { text: t('pinball.hud.balls', { n: state.ballCount }), label: '' },
    player: { text: t('pinball.hud.player', { n: state.playerNumber }), label: '' },
    // Absent stays empty, for the reason `HudState.mission` gives: no comet mission, nothing to report.
    mission: {
      text: state.mission
        ? t('pinball.hud.mission', { have: state.mission.have, need: state.mission.need })
        : '',
      label: '',
    },
    // Empty stays empty. A dash in the corner is furniture that means nothing and still takes the room.
    hint: { text: state.hint, label: '' },
  };
}

/** A box in per-cent, ready for `style.left` and friends. */
export interface HudBox {
  readonly left: string;
  readonly top: string;
  readonly width: string;
  readonly height: string;
  /**
   * The same box measured from the BOTTOM of the screen, for a block that has to grow upward.
   *
   * ⚠️ THIS EXISTS BECAUSE THE HINT LEFT THE CANVAS. Every block is placed by `top` and given a
   * `min-height` rather than a height — deliberately, so a hint that wraps to a fifth line is
   * readable instead of clipped. But a block anchored by its top grows AWAY from that anchor, and
   * the hint's anchor is the bottom-left corner: the fifth line and every line after it went off the
   * bottom of the game. Measured in the built page at the smallest size it is ever shown: thirty-two
   * pixels of text below the canvas, which is what the Dev reported as "texto no canto inferior
   * esquerdo fora do canvas".
   */
  readonly bottom: string;
}

export type HudPlacement = Record<'score' | 'balls' | 'player' | 'mission' | 'hint', HudBox>;

/**
 * ⚠️ PER-CENT, NOT PIXELS. The canvas is 320x180 and is stretched to whatever width the page gives it,
 * so a block placed at `x = 255px` sits in the middle of the table on every screen but one.
 */
export function hudPlacement(layout: HudLayout, screen: HudConfig): HudPlacement {
  const box = (r: { x: number; y: number; width: number; height: number }): HudBox => ({
    left: `${(r.x / screen.screenWidth) * 100}%`,
    top: `${(r.y / screen.screenHeight) * 100}%`,
    width: `${(r.width / screen.screenWidth) * 100}%`,
    height: `${(r.height / screen.screenHeight) * 100}%`,
    bottom: `${((screen.screenHeight - r.y - r.height) / screen.screenHeight) * 100}%`,
  });

  return {
    score: box(layout.score),
    balls: box(layout.ballCount),
    player: box(layout.playerName),
    mission: box(layout.mission),
    hint: box(layout.hint),
  };
}

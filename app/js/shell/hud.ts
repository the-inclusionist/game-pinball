// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/hud — where the four blocks of information go. Not a port: the original's 203x394 side panel
// does not exist here, and this decides what replaces it.
//
// ========================= THE PANEL IS GONE AND THE CORNERS TAKE OVER =========================
// 3D Pinball keeps everything in one tall column to the right of the table: the Space Cadet artwork,
// the ball number, the player name, the hint and the score. On a 320x180 screen that column would be
// most of the screen, so it was decided that the panel dies and the four things it carried go to the
// corners, as an ordinary HUD does.
//
// ========================= AND NOTHING IS ALLOWED TO COVER THE PLAYFIELD =========================
// That is the rule the whole layout is built from. The halved playfield is 183 wide against a 320
// screen, which leaves 137 pixels; the playfield sits in the middle and the blocks live in the two
// columns either side. Not overlaid, beside.
//
// The reason is specific rather than aesthetic: the playfield fills the screen VERTICALLY, so the
// bottom of the screen is where the flippers are drawn, and a pinball player reads the ball's line off
// the flippers. A HUD bar across the bottom would cover exactly the thing the game is played with.
//
// ⚠️ WHICH IS WHY THE HINT IS NOT WHERE IT WAS ASKED FOR. "The hint goes to the lower part" cannot mean
// a strip across the bottom, for the reason above. It takes the bottom of the LEFT COLUMN instead,
// which is as low as it can go without covering the play. The alternative — trading twelve pixels of
// playfield height for a full-width hint bar — would change the camera's travel from the 55 pixels
// that were specified, so it is not taken here. See ADR-0002.
//
// ========================= 137 IS ODD, SO THE COLUMNS CANNOT MATCH =========================
// One of them gets 69 pixels and the other 68. The choice is arbitrary and therefore written down: the
// wider column is the LEFT one, because three of the four blocks live there and only the score is on
// the right.
//
// ========================= A WIDER TABLE HAS NO COLUMNS AT ALL =========================
// Phase 8 may author a table wider than 320. There is then nowhere beside the playfield to put
// anything, and the layout says so with `overlaying` instead of quietly drawing off the screen. The
// blocks still land inside the screen and still do not collide with each other; they simply sit on top
// of the play, which is a worse layout honestly reported rather than a broken one.

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface HudConfig {
  readonly screenWidth: number;
  readonly screenHeight: number;
  /** The playfield viewport, which is the camera's view — see `shell/camera`. */
  readonly playfieldWidth: number;
  readonly padding: number;
  /** Height of one line of the shipped font, used to size the blocks. */
  readonly lineHeight: number;
  /** Width of one digit, used to check the score box can hold a rolled-over score. */
  readonly digitWidth: number;
  /** How many lines the hint is allowed to wrap to. */
  readonly hintLines: number;
}

export interface HudLayout {
  readonly playfield: Rect;
  readonly playerName: Rect;
  readonly ballCount: Rect;
  /**
   * The comet drill's running total, under the ball count.
   *
   * ⚠️ THE FIFTH BLOCK, AND THE LEFT COLUMN HAD THE ROOM. Mission points are the Dev's — "pontos de
   * missão são separados do ponto de jogo" — so they cannot share the score's corner without saying
   * something false about which number is which. The column below the ball count is empty from there
   * to the hint, which is about twenty lines.
   */
  readonly mission: Rect;
  readonly score: Rect;
  readonly hint: Rect;
  /** True when the playfield leaves no column and the blocks must sit on top of the play. */
  readonly overlaying: boolean;
}

/** What the dead side panel used to carry, plus the comet drill's total. */
export const HUD_BLOCKS = ['playerName', 'ballCount', 'mission', 'score', 'hint'] as const;

export const DEFAULT_HUD: HudConfig = {
  screenWidth: 320,
  screenHeight: 180,
  playfieldWidth: 183,
  padding: 3,
  lineHeight: 7,
  digitWidth: 4,
  hintLines: 4,
};

/** Half-open rectangles: touching edges do not overlap, and an empty rectangle overlaps nothing. */
export function overlaps(a: Rect, b: Rect): boolean {
  if (a.width <= 0 || a.height <= 0 || b.width <= 0 || b.height <= 0) return false;
  return a.x < b.x + b.width && b.x < a.x + a.width
    && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function layoutHud(config: HudConfig): HudLayout {
  const spare = Math.max(0, config.screenWidth - config.playfieldWidth);
  // 137 is odd. The wider half goes left, where three of the four blocks live.
  const leftWidth = Math.ceil(spare / 2);
  const rightWidth = spare - leftWidth;
  const overlaying = spare === 0;

  const playfield: Rect = {
    x: leftWidth,
    y: 0,
    width: Math.min(config.playfieldWidth, config.screenWidth),
    height: config.screenHeight,
  };

  // With no column of its own, a block still has to be legible somewhere; it takes a strip of the
  // screen edge and sits over the play, which `overlaying` reports.
  const columnWidth = (width: number) => Math.max(width - config.padding * 2, config.digitWidth * 10);

  const leftX = config.padding;
  const leftBox = columnWidth(leftWidth);
  const rightBox = columnWidth(rightWidth);
  const rightX = config.screenWidth - config.padding - rightBox;

  const playerName: Rect = {
    x: leftX, y: config.padding, width: leftBox, height: config.lineHeight,
  };
  const ballCount: Rect = {
    x: leftX, y: config.padding + config.lineHeight + 1, width: leftBox, height: config.lineHeight,
  };
  // Straight under the ball count, on the same rhythm: one line plus the same one-pixel gap.
  const mission: Rect = {
    x: leftX, y: config.padding + (config.lineHeight + 1) * 2, width: leftBox,
    height: config.lineHeight,
  };
  const score: Rect = {
    x: rightX, y: config.padding, width: rightBox, height: config.lineHeight,
  };

  const hintHeight = config.lineHeight * config.hintLines;
  const hint: Rect = {
    x: leftX,
    y: config.screenHeight - config.padding - hintHeight,
    width: leftBox,
    height: hintHeight,
  };

  return { playfield, playerName, ballCount, mission, score, hint, overlaying };
}

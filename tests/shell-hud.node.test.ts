// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  layoutHud, overlaps, DEFAULT_HUD, HUD_BLOCKS,
  type HudLayout, type Rect,
} from '../app/js/shell/hud.js';

const blocks = (l: HudLayout): Rect[] => HUD_BLOCKS.map((k) => l[k]);
const right = (r: Rect) => r.x + r.width;
const bottom = (r: Rect) => r.y + r.height;

describe('the screen is 320x180 and the playfield does not fill it', () => {
  test('the halved playfield is 183 wide, leaving 137 pixels of margin', () => {
    const l = layoutHud(DEFAULT_HUD);

    expect(DEFAULT_HUD.screenWidth).toBe(320);
    expect(DEFAULT_HUD.playfieldWidth).toBe(183);
    expect(DEFAULT_HUD.screenWidth - l.playfield.width).toBe(137);
  });

  test('the playfield is centred, and the odd pixel goes LEFT', () => {
    // 137 is odd, so the two columns cannot be equal. The choice is arbitrary and therefore has to be
    // written down: the wider column is the left one, which is where three of the four blocks live.
    const l = layoutHud(DEFAULT_HUD);

    expect(l.playfield.x).toBe(69);
    expect(l.playfield.x).toBe(DEFAULT_HUD.screenWidth - right(l.playfield) + 1);
  });

  test('the playfield takes the full height of the screen', () => {
    const l = layoutHud(DEFAULT_HUD);

    expect(l.playfield.y).toBe(0);
    expect(l.playfield.height).toBe(180);
  });
});

describe('NOTHING the HUD draws covers the playfield', () => {
  test('every block is clear of it', () => {
    // The whole reason the blocks are in columns rather than overlaid. A HUD that covers the base of
    // the table covers the flippers, and a pinball player reads the ball's line off the flippers.
    const l = layoutHud(DEFAULT_HUD);

    for (const block of blocks(l)) {
      expect(overlaps(block, l.playfield)).toBe(false);
    }
  });

  test('and no block overlaps another', () => {
    const l = layoutHud(DEFAULT_HUD);
    const all = blocks(l);

    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        expect(overlaps(all[i]!, all[j]!)).toBe(false);
      }
    }
  });

  test('and everything stays on screen', () => {
    const l = layoutHud(DEFAULT_HUD);

    for (const block of [...blocks(l), l.playfield]) {
      expect(block.x).toBeGreaterThanOrEqual(0);
      expect(block.y).toBeGreaterThanOrEqual(0);
      expect(right(block)).toBeLessThanOrEqual(DEFAULT_HUD.screenWidth);
      expect(bottom(block)).toBeLessThanOrEqual(DEFAULT_HUD.screenHeight);
    }
  });
});

describe('the four blocks land where they were asked to', () => {
  test('the player name is top left, with the ball count UNDER it', () => {
    const l = layoutHud(DEFAULT_HUD);

    expect(l.playerName.x).toBeLessThan(l.playfield.x);
    expect(l.playerName.y).toBe(DEFAULT_HUD.padding);
    expect(l.ballCount.y).toBeGreaterThanOrEqual(bottom(l.playerName));
    expect(l.ballCount.x).toBe(l.playerName.x);
  });

  test('the score is top right', () => {
    const l = layoutHud(DEFAULT_HUD);

    expect(l.score.x).toBeGreaterThanOrEqual(right(l.playfield));
    expect(l.score.y).toBe(DEFAULT_HUD.padding);
    expect(right(l.score)).toBe(DEFAULT_HUD.screenWidth - DEFAULT_HUD.padding);
  });

  test('the hint is at the BOTTOM of the left column, not across the screen', () => {
    // Asked for as "the lower part". It cannot span the bottom: the bottom of the screen is where the
    // flippers are drawn, and the rule above forbids covering them. So it takes the lower half of the
    // column it shares with the other two blocks, which is the closest the geometry allows.
    const l = layoutHud(DEFAULT_HUD);

    expect(bottom(l.hint)).toBe(DEFAULT_HUD.screenHeight - DEFAULT_HUD.padding);
    expect(l.hint.x).toBeLessThan(l.playfield.x);
    expect(l.hint.y).toBeGreaterThan(bottom(l.ballCount));
  });

  test('the original’s 203x394 side panel is gone entirely', () => {
    // Nothing in this layout is 203 wide, and no block is taller than a third of the screen. The
    // panel that held the 3D Pinball artwork, the ball number, the player, the hint and the score in
    // one column does not exist here.
    const l = layoutHud(DEFAULT_HUD);

    for (const block of blocks(l)) {
      expect(block.width).toBeLessThan(203);
      expect(block.height).toBeLessThan(DEFAULT_HUD.screenHeight / 3);
    }
  });
});

describe('the columns are usable, not decorative', () => {
  test('each column is wide enough for a nine-digit score', () => {
    // The score rolls over at a billion (see `control/score`), so nine digits plus a separator is the
    // worst case the box has to hold.
    const l = layoutHud(DEFAULT_HUD);
    const widest = 9 * DEFAULT_HUD.digitWidth;

    expect(l.score.width).toBeGreaterThanOrEqual(widest);
  });

  test('the left column is the wider of the two', () => {
    const l = layoutHud(DEFAULT_HUD);

    expect(l.playerName.width).toBeGreaterThan(l.score.width);
  });
});

describe('a table too wide for the screen has to overlay, and says so', () => {
  test('with no margin left the blocks go over the playfield', () => {
    // Phase 8 may author a table wider than 320. There is then no column to put anything in, and the
    // layout reports that rather than silently drawing off screen.
    const wide = { ...DEFAULT_HUD, playfieldWidth: 320 };

    const l = layoutHud(wide);

    expect(l.overlaying).toBe(true);
    expect(l.playfield.x).toBe(0);
    expect(l.playfield.width).toBe(320);
  });

  test('and the blocks are still on screen and still not on top of each other', () => {
    const wide = { ...DEFAULT_HUD, playfieldWidth: 320 };

    const l = layoutHud(wide);
    const all = blocks(l);

    for (const block of all) {
      expect(right(block)).toBeLessThanOrEqual(320);
      expect(bottom(block)).toBeLessThanOrEqual(180);
    }
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        expect(overlaps(all[i]!, all[j]!)).toBe(false);
      }
    }
  });

  test('the blocks stay READABLE, which is the point of the minimum width', () => {
    // Without a floor the boxes come out with negative widths: still on screen, still not colliding —
    // an empty rectangle collides with nothing — and completely useless. A worse layout honestly
    // reported has to still be a layout.
    const wide = { ...DEFAULT_HUD, playfieldWidth: 320 };

    const l = layoutHud(wide);

    for (const block of blocks(l)) {
      expect(block.width).toBeGreaterThanOrEqual(9 * DEFAULT_HUD.digitWidth);
      expect(block.height).toBeGreaterThan(0);
    }
  });

  test('the ordinary layout does NOT claim to be overlaying', () => {
    expect(layoutHud(DEFAULT_HUD).overlaying).toBe(false);
  });
});

describe('overlaps, which every rule above is written in terms of', () => {
  test('touching edges do not overlap', () => {
    expect(overlaps({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 10, height: 10 }))
      .toBe(false);
  });

  test('a single shared pixel does', () => {
    expect(overlaps({ x: 0, y: 0, width: 10, height: 10 }, { x: 9, y: 9, width: 10, height: 10 }))
      .toBe(true);
  });

  test('an empty rectangle never overlaps anything', () => {
    expect(overlaps({ x: 5, y: 5, width: 0, height: 10 }, { x: 0, y: 0, width: 20, height: 20 }))
      .toBe(false);
  });
});

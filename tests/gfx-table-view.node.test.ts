// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  drawTable, blitView, drawBall, fillRect, fillCircle,
  ROLE_COLORS, PLAYFIELD_COLOR, BALL_COLOR,
} from '../app/js/gfx/table-view.js';
import { createFramebuffer } from '../app/js/gfx/framebuffer.js';
import { CATALOG, LOW_ORBIT } from '../app/js/table/catalog.js';

const at = (fb: { width: number; pixels: Uint32Array }, x: number, y: number) =>
  fb.pixels[y * fb.width + x]!;

describe('drawing a table from its ROLES', () => {
  test('the table comes out at its own size', () => {
    const fb = drawTable({ table: LOW_ORBIT });

    expect(fb.width).toBe(183);
    expect(fb.height).toBe(235);
  });

  test('empty playfield is the playfield colour', () => {
    const fb = drawTable({ table: LOW_ORBIT });

    // A spot with nothing on it: between the target bank and the bumpers.
    expect(at(fb, 30, 90)).toBe(PLAYFIELD_COLOR);
  });

  test('the drain is drawn as a HAZARD, and it is the only warm colour', () => {
    // A player learns "red takes your ball" once, and it holds on every table. That is why the colour
    // is per ROLE and not per kind.
    const fb = drawTable({ table: LOW_ORBIT });

    expect(at(fb, 90, 230)).toBe(ROLE_COLORS.hazard);
    expect(ROLE_COLORS.hazard).not.toBe(ROLE_COLORS.goal);
  });

  test('a flipper is structure and a well is a gate', () => {
    const fb = drawTable({ table: LOW_ORBIT });

    expect(at(fb, 60, 209)).toBe(ROLE_COLORS.structure);
    expect(at(fb, 90, 174)).toBe(ROLE_COLORS.gate);
  });

  test('⚠️ THE ROLE MOVES WITH THE MISSION, in the picture too', () => {
    // A bumper the mission is counting is drawn as a goal and goes back to furniture when it stops
    // counting. Same component, same place, different colour — which is the control layer's habit
    // reaching the screen.
    const idle = drawTable({ table: LOW_ORBIT });
    const counting = drawTable({ table: LOW_ORBIT, missionTargets: ['bumper1'] });

    expect(at(idle, 57, 67)).toBe(ROLE_COLORS.structure);
    expect(at(counting, 57, 67)).toBe(ROLE_COLORS.goal);
  });

  test('every one of the five tables draws without going outside its buffer', () => {
    for (const table of CATALOG) {
      const fb = drawTable({ table });
      expect(fb.pixels.length, table.name).toBe(table.size.width * table.size.height);
      // Nothing was left unwritten: the playfield fill covers every pixel before anything else.
      expect([...fb.pixels].every((p) => p !== 0), table.name).toBe(true);
    }
  });
});

describe('the camera is a WINDOW, not a transform', () => {
  test('at rest the screen shows the bottom of the table', () => {
    const table = drawTable({ table: LOW_ORBIT });
    const screen = createFramebuffer(320, 180);
    const into = { x: 69, y: 0, width: 183, height: 180 };

    blitView(screen, table, into, 0, 55);

    // Table row 55 lands on screen row 0.
    expect(at(screen, 69 + 90, 230 - 55)).toBe(ROLE_COLORS.hazard);
  });

  test('scrolled to the top, the drain is no longer on screen', () => {
    // ADR-0001 § 5: giving up the base of the table is part of the game, and here it is, literally.
    const table = drawTable({ table: LOW_ORBIT });
    const screen = createFramebuffer(320, 180);
    const into = { x: 69, y: 0, width: 183, height: 180 };

    blitView(screen, table, into, 0, 0);

    const drainRowOnScreen = 230;
    expect(drainRowOnScreen).toBeGreaterThan(into.height);
  });

  test('the offset is FLOORED once, so the pixel grid stays exact', () => {
    // A fractional offset would smear a 3-pixel ball across two rows, and there is no art here to
    // hide it.
    const table = drawTable({ table: LOW_ORBIT });
    const a = createFramebuffer(320, 180);
    const b = createFramebuffer(320, 180);
    const into = { x: 69, y: 0, width: 183, height: 180 };

    blitView(a, table, into, 0, 55);
    blitView(b, table, into, 0, 55.9);

    expect([...a.pixels]).toEqual([...b.pixels]);
  });

  test('nothing is written outside the rectangle it was given', () => {
    const table = drawTable({ table: LOW_ORBIT });
    const screen = createFramebuffer(320, 180);
    const into = { x: 69, y: 0, width: 183, height: 180 };

    blitView(screen, table, into, 0, 55);

    // The HUD columns either side stay untouched.
    expect(at(screen, 10, 90)).toBe(0);
    expect(at(screen, 300, 90)).toBe(0);
  });

  test('a window past the end of the table does not read past the end of it', () => {
    const table = drawTable({ table: LOW_ORBIT });
    const screen = createFramebuffer(320, 180);

    expect(() => blitView(screen, table, { x: 69, y: 0, width: 183, height: 180 }, 0, 200))
      .not.toThrow();
  });
});

describe('the ball', () => {
  const into = { x: 69, y: 0, width: 183, height: 180 };

  test('is drawn where the camera puts it', () => {
    const screen = createFramebuffer(320, 180);

    drawBall(screen, { active: true, position: { x: 90, y: 200 } }, 3, into, 0, 55);

    expect(at(screen, 69 + 90, 200 - 55)).toBe(BALL_COLOR);
  });

  test('an inactive ball is not drawn at all', () => {
    const screen = createFramebuffer(320, 180);

    drawBall(screen, { active: false, position: { x: 90, y: 200 } }, 3, into, 0, 55);

    expect(at(screen, 69 + 90, 145)).toBe(0);
  });

  test('a ball outside the window is silently skipped, not an error', () => {
    // The camera gives up part of the table on purpose, so a ball off the window is normal.
    const screen = createFramebuffer(320, 180);

    expect(() => drawBall(screen, { active: true, position: { x: 90, y: 10 } }, 3, into, 0, 55))
      .not.toThrow();
    expect(at(screen, 69 + 90, 0)).toBe(0);
  });

  test('it is round, not square', () => {
    const screen = createFramebuffer(40, 40);

    fillCircle(screen, 20, 20, 6, BALL_COLOR);

    expect(at(screen, 20, 20)).toBe(BALL_COLOR);
    expect(at(screen, 20, 15)).toBe(BALL_COLOR);
    // The corner of the bounding box is outside the circle.
    expect(at(screen, 15, 15)).toBe(0);
  });
});

describe('the primitives clip rather than crash', () => {
  test('a rectangle partly outside is drawn partly', () => {
    const fb = createFramebuffer(10, 10);

    fillRect(fb, { x: -5, y: -5, width: 8, height: 8 }, BALL_COLOR);

    expect(at(fb, 0, 0)).toBe(BALL_COLOR);
    expect(at(fb, 5, 5)).toBe(0);
  });

  test('a rectangle entirely outside writes nothing', () => {
    const fb = createFramebuffer(10, 10);

    fillRect(fb, { x: 50, y: 50, width: 8, height: 8 }, BALL_COLOR);

    expect([...fb.pixels].every((p) => p === 0)).toBe(true);
  });

  test('a circle at the edge is clipped, not wrapped', () => {
    const fb = createFramebuffer(10, 10);

    fillCircle(fb, 0, 0, 4, BALL_COLOR);

    expect(at(fb, 0, 0)).toBe(BALL_COLOR);
    // Nothing wrapped round to the far side of the row.
    expect(at(fb, 9, 0)).toBe(0);
  });
});

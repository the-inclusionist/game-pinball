// SPDX-License-Identifier: AGPL-3.0-or-later
import { leanOf } from '../app/js/table/perspective.js';
import { describe, test, expect } from 'vitest';
import {
  drawTable, blitView, drawBall, drawFlipper, drawMover, fillRect, fillCircle, paletteOf, packRgb,
  ROLE_COLORS, PLAYFIELD_COLOR, BALL_COLOR,
} from '../app/js/gfx/table-view.js';
import { createFramebuffer } from '../app/js/gfx/framebuffer.js';
import { backdropAt } from '../app/js/gfx/table-palette.js';
import { CATALOG, LOW_ORBIT } from '../app/js/table/catalog.js';

const at = (fb: { width: number; pixels: Uint32Array }, x: number, y: number) =>
  fb.pixels[y * fb.width + x]!;

describe('drawing a table from its ROLES', () => {
  test('the table comes out at its own size', () => {
    const fb = drawTable({ table: LOW_ORBIT });

    expect(fb.width).toBe(183);
    expect(fb.height).toBe(235);
  });

  test('⚠️ empty playfield is the colour of the table’s OWN world', () => {
    const fb = drawTable({ table: LOW_ORBIT });

    // This test used to say `PLAYFIELD_COLOR` — one neutral ground for every table — and it was right
    // until the tables were given worlds to stand in. `low-orbit` stands in `sky`, and the ground is
    // where a scene lives: it is most of the pixels on the screen, which is what makes it the colour
    // the table reads as.
    //
    // ⚠️ AND IT IS NOT THE NEUTRAL ONE, asserted rather than assumed. Without this line the test would
    // pass just as well if `sceneOf` returned nothing for every table and all five fell to slate,
    // which is the exact failure the scene map was written without a default to avoid.
    // A spot with nothing on it: between the target bank and the bumpers.
    // ⚠️ THE GROUND AT THAT ROW, not the world's one colour: `sky` is a gradient now — the Earth's
    // atmosphere the Dev asked for — so "the table's own world" is a colour that depends on height.
    const sky = paletteOf(LOW_ORBIT, false);
    const atRow90 = packRgb(backdropAt(sky.bands!, 90 / (LOW_ORBIT.size.height - 1)));
    expect(at(fb, 30, 90)).toBe(atRow90);
    expect(at(fb, 30, 90), 'low-orbit is not on the neutral ground').not.toBe(PLAYFIELD_COLOR);
  });

  test('and the CB-Safe alternative changes what is drawn, without moving the table’s world', () => {
    const normal = drawTable({ table: LOW_ORBIT });
    const safe = drawTable({ table: LOW_ORBIT, cbSafe: true });

    // The ground carries the scene, so switching the palette must not move the player to another
    // planet: same world, different signals on it.
    expect(at(safe, 30, 90), 'the world is unchanged').toBe(at(normal, 30, 90));
    let differing = 0;
    for (let i = 0; i < normal.pixels.length; i++) if (normal.pixels[i] !== safe.pixels[i]) differing++;
    expect(differing, 'something on the table is drawn differently').toBeGreaterThan(0);
  });

  test('the drain is drawn as a HAZARD, and it is the only warm colour', () => {
    // A player learns "red takes your ball" once, and it holds on every table. That is why the colour
    // is per ROLE and not per kind.
    const fb = drawTable({ table: LOW_ORBIT });

    expect(at(fb, 90, 230)).toBe(ROLE_COLORS.hazard);
    expect(ROLE_COLORS.hazard).not.toBe(ROLE_COLORS.goal);
  });

  test('a well is a gate', () => {
    /**
     * ⚠️ READ FROM THE TABLE RATHER THAN FROM A REMEMBERED COORDINATE, and it used to be (90, 174).
     * `well2` moved on 2026-09-06 — the Dev asked for the geometry to be put where his art draws
     * things, and all three wells were sitting on plain sky at 0.15 times the table's median detail
     * while the picture drew a satellite, a node and the ISS higher up.
     *
     * A hard-coded point is a test that has to be edited every time the table it describes is
     * authored, and editing a coordinate to match is indistinguishable from editing it to pass. The
     * claim here was never about (90, 174); it is that a WELL is drawn in the GATE colour.
     */
    const well = LOW_ORBIT.components.find((c) => c.kind === 'well')!;
    const fb = drawTable({ table: LOW_ORBIT });

    expect(at(fb, Math.floor(well.bounds.x + well.bounds.width / 2),
      Math.floor(well.bounds.y + well.bounds.height / 2))).toBe(ROLE_COLORS.gate);
  });

  test('⚠️ and a FLIPPER is not in this picture at all, which is the point of it', () => {
    // It used to be, stroked at its resting angle — and `drawTable` composes the table ONCE per
    // change, so the paddle swung in the physics and the picture showed it at rest for ever. The Dev
    // found it by playing: "As pás não movem!"
    //
    // A flipper now belongs with the ball, in the things drawn AFTER the blit. Leaving the resting
    // stroke here as well would paint a second paddle that never moves underneath the one that does,
    // so its absence is the assertion.
    const fb = drawTable({ table: LOW_ORBIT });

    expect(at(fb, 60, 209), 'nothing is painted where the flipper rests')
      .toBe(packRgb(backdropAt(paletteOf(LOW_ORBIT, false).bands!,
        209 / (LOW_ORBIT.size.height - 1))));
  });

  test('⚠️ and drawFlipper puts it on the SCREEN, at whatever angle it is handed', () => {
    // The live geometry comes from `physics/flipper` — `rotOrigin` and `t1`, the tip already rotated
    // by `currentAngle`. This module takes two ends and knows nothing about how a swing is computed.
    const screen = createFramebuffer(320, 180);
    const into = { x: 69, y: 0, width: 183, height: 180 };

    drawFlipper(screen, { x: 52, y: 26 }, { x: 80, y: 33 }, ROLE_COLORS.structure, into, 0, 0);

    expect(at(screen, 69 + 52, 26), 'the pivot end is drawn').toBe(ROLE_COLORS.structure);
    expect(at(screen, 69 + 80, 33), 'and the tip end').toBe(ROLE_COLORS.structure);
  });

  test('⚠️ and a DIFFERENT angle draws somewhere different, or it is not live at all', () => {
    // The assertion that would fail on a version that drew the resting position whatever it was told.
    const rest = createFramebuffer(320, 180);
    const raised = createFramebuffer(320, 180);
    const into = { x: 69, y: 0, width: 183, height: 180 };

    drawFlipper(rest, { x: 52, y: 26 }, { x: 80, y: 33 }, ROLE_COLORS.structure, into, 0, 0);
    drawFlipper(raised, { x: 52, y: 26 }, { x: 76, y: 12 }, ROLE_COLORS.structure, into, 0, 0);

    let differing = 0;
    for (let i = 0; i < rest.pixels.length; i++) if (rest.pixels[i] !== raised.pixels[i]) differing++;
    expect(differing, 'the two angles are not the same picture').toBeGreaterThan(10);
  });

  test('⚠️ and it never draws outside the playfield window, whatever it is handed', () => {
    // The one thing drawn after the blit is the one thing that could cross the HUD's columns, which is
    // the rule ADR-0002 exists for. A flipper is clipped to `into`, not to the screen.
    const screen = createFramebuffer(320, 180);
    const into = { x: 69, y: 0, width: 183, height: 180 };

    drawFlipper(screen, { x: -400, y: 90 }, { x: 400, y: 90 }, ROLE_COLORS.structure, into, 0, 0);

    for (let x = 0; x < 320; x++) {
      const inside = x >= into.x && x < into.x + into.width;
      if (!inside) expect(at(screen, x, 90), `column ${x} is outside the window`).toBe(0);
    }
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

describe('⚠️ a lit lamp shows on the table', () => {
  // The flippers were one instance of a class: state that changes and is never drawn. Lamps are the
  // other, and worse — every scoring component on every authored table declares one, the control layer
  // lights them constantly, `objectiveOf` decides what is FINISHED by reading them, and `table-view`
  // had no notion of them at all. A player completing a lane saw the score move and the table not.
  //
  // ⚠️ IT IS NOT ART. The Dev asked to continue without art, and this is not that: it is the component
  // drawn in its own colour, brightened by exactly the headroom `SHADE_HEADROOM` already says that
  // colour has. Nothing new is invented to look at — the lit state simply becomes visible.
  const litColour = (name: string) => {
    const lit = drawTable({ table: LOW_ORBIT, litLamps: [name] });
    return lit;
  };

  test('a component whose lamps are all lit is drawn brighter than one whose are not', () => {
    const dark = drawTable({ table: LOW_ORBIT });
    const lit = litColour('lamp.bumper1');

    // `bumper1` is a circle at (57, 67) on `low-orbit`.
    expect(at(lit, 57, 67), 'the lit bumper changed colour').not.toBe(at(dark, 57, 67));
  });

  test('⚠️ and ONLY that component, or lighting one lamp repaints the table', () => {
    const dark = drawTable({ table: LOW_ORBIT });
    const lit = litColour('lamp.bumper1');

    // `bumper2` is a circle at (87, 55) and its lamp is not lit.
    expect(at(lit, 87, 55), 'the unlit bumper is untouched').toBe(at(dark, 87, 55));
  });

  test('⚠️ and a component with TWO lamps needs both, which is what `objectiveOf` means by finished', () => {
    // `table/objective` counts a component done only when every lamp it names is lit — "a component
    // with two lamps is half done after one, and the sonar should still point at it". The picture has
    // to agree with the sonar or they are describing different tables.
    const table = {
      ...LOW_ORBIT,
      components: LOW_ORBIT.components.map((c) => (c.name === 'bumper1'
        ? { ...c, lamps: ['lamp.bumper1', 'lamp.bumper2'] } : c)),
    };
    const half = drawTable({ table, litLamps: ['lamp.bumper1'] });
    const dark = drawTable({ table });

    expect(at(half, 57, 67), 'half-lit is not lit').toBe(at(dark, 57, 67));
  });

  test('and a table drawn with no lamps lit is the table as it always was', () => {
    // The default has to be the old picture exactly, or every painted-pixel count in the repository
    // moves for a feature nobody switched on.
    const withNone = drawTable({ table: LOW_ORBIT, litLamps: [] });
    const without = drawTable({ table: LOW_ORBIT });

    expect([...withNone.pixels]).toEqual([...without.pixels]);
  });
});

/**
 * ⚠️ A DROPPED TARGET HAS TO STOP BEING DRAWN, and this is the half that makes a bank visible.
 *
 * `table/target-bank` decides a target is down and `physics-build.setComponentActive` makes the ball
 * pass over it. If the picture still shows it, the player is looking at a target the ball goes through
 * — which is the same defect as the flippers baked at rest and the lamps that were never drawn, in a
 * new place. Six of those have been found in this port; this is the gate written before the seventh.
 */
describe('⚠️ hiding a component from the picture', () => {
  test('a hidden component paints nothing where it was', () => {
    const target = LOW_ORBIT.components.find((c) => c.name === 'target1')!;
    const shown = drawTable({ table: LOW_ORBIT, missionTargets: [], litLamps: [], cbSafe: false });
    const gone = drawTable({
      table: LOW_ORBIT, missionTargets: [], litLamps: [], cbSafe: false, hidden: ['target1'],
    });

    const box = target.bounds;
    let differing = 0;
    for (let y = box.y; y < box.y + box.height; y++) {
      for (let x = box.x; x < box.x + box.width; x++) {
        if (shown.pixels[y * LOW_ORBIT.size.width + x] !== gone.pixels[y * LOW_ORBIT.size.width + x]) {
          differing++;
        }
      }
    }

    expect(differing, 'the target’s own rectangle changed').toBeGreaterThan(0);
  });

  test('⚠️ and NOTHING ELSE changed, or "hidden" would be a repaint', () => {
    // The control that makes the test above mean something. Any difference anywhere would satisfy a
    // whole-frame comparison, and this port has already rewritten one gate for exactly that reason.
    const target = LOW_ORBIT.components.find((c) => c.name === 'target1')!;
    const shown = drawTable({ table: LOW_ORBIT, missionTargets: [], litLamps: [], cbSafe: false });
    const gone = drawTable({
      table: LOW_ORBIT, missionTargets: [], litLamps: [], cbSafe: false, hidden: ['target1'],
    });

    /**
     * ⚠️ ONE PIXEL WIDER THAN THE DECLARED BOUNDS, and the first version was not — it failed by
     * SIXTEEN pixels, which turned out to be the target's own collision line. A component that
     * declares collision shapes is drawn as those shapes rather than as its rectangle (see
     * `drawTable`), and this target's face sits on `bounds.y + bounds.height`: on the boundary, and so
     * one row outside a half-open box. The drawing is right and the box was.
     */
    /**
     * ⚠️ AND THE SLACK IS THE LEAN'S OWN RUN, NOT A ROUND NUMBER. Since `table/perspective` every table
     * is a trapezium at nine degrees, so a face that used to be one column of pixels now crosses
     * `tan(9°) × its height` of them — and `bounds` is a rectangle placed on the component's middle
     * row, which by construction cannot cover both ends of a leaning line. Measured before this: 13
     * pixels outside a box one wider, all of them the target's own face. The margin is derived from
     * the table's own lean so it stays right if the angle ever changes.
     */
    const b = target.bounds;
    const run = Math.ceil(leanOf(LOW_ORBIT) * b.height) + 1;
    const box = { x: b.x - run, y: b.y - 1, width: b.width + 2 * run, height: b.height + 2 };
    let outside = 0;
    for (let y = 0; y < LOW_ORBIT.size.height; y++) {
      for (let x = 0; x < LOW_ORBIT.size.width; x++) {
        const inBox = x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height;
        if (inBox) continue;
        if (shown.pixels[y * LOW_ORBIT.size.width + x] !== gone.pixels[y * LOW_ORBIT.size.width + x]) {
          outside++;
        }
      }
    }

    expect(outside, 'the rest of the table is untouched').toBe(0);
  });
});

/**
 * ⚠️ A BODY THAT TRAVELS MUST BE DRAWN WHERE IT IS, AND NOT WHERE IT STARTED.
 *
 * `drawTable` composes the table ONCE per change and the camera slides a window over it — which is
 * what makes a software compositor affordable at this size, and what makes it wrong for anything that
 * moves. The flippers were stroked into that composition at their resting angle for weeks and the Dev
 * found it by playing: "as pás não movem!" The plunger followed. A drone is the third body with the
 * same requirement, and this is the gate written BEFORE the third instance rather than after it.
 */
describe('⚠️ a travelling body', () => {
  const path = { from: { x: 40, y: 60 }, to: { x: 90, y: 60 }, seconds: 1, radius: 5 };
  const withDrone = {
    ...LOW_ORBIT,
    components: [...LOW_ORBIT.components, {
      name: 'drone', kind: 'rebounder' as const, role: 'goal' as const,
      bounds: { x: 35, y: 55, width: 60, height: 10 },
      scores: [1000], control: 'RebounderControl', mover: path,
    }],
  };

  test('it is NOT in the static picture, for the reason the flippers are not', () => {
    const without = drawTable({ table: LOW_ORBIT });
    const with_ = drawTable({ table: withDrone });

    let differing = 0;
    for (let i = 0; i < without.pixels.length; i++) {
      if (without.pixels[i] !== with_.pixels[i]) differing++;
    }

    expect(differing, 'the composition is unchanged by a body that moves').toBe(0);
  });

  test('⚠️ and drawing it puts pixels where the body IS', () => {
    const screen = createFramebuffer(320, 180);
    const into = { x: 0, y: 0, width: 320, height: 180 };

    drawMover(screen, { x: 40, y: 60 }, 5, 0x00ff00ff, into, 0, 0);

    expect(screen.pixels[60 * 320 + 40], 'its centre').toBe(0x00ff00ff);
    expect(screen.pixels[60 * 320 + 40 + 4], 'and its edge').toBe(0x00ff00ff);
    expect(screen.pixels[60 * 320 + 40 + 9], 'and nothing beyond it').not.toBe(0x00ff00ff);
  });

  test('⚠️ and it MOVES when the body does, which is the whole point', () => {
    const a = createFramebuffer(320, 180);
    const b = createFramebuffer(320, 180);
    const into = { x: 0, y: 0, width: 320, height: 180 };

    drawMover(a, { x: 40, y: 60 }, 5, 0x00ff00ff, into, 0, 0);
    drawMover(b, { x: 90, y: 60 }, 5, 0x00ff00ff, into, 0, 0);

    expect(a.pixels[60 * 320 + 40]).toBe(0x00ff00ff);
    expect(b.pixels[60 * 320 + 40], 'the first position is empty in the second frame').not.toBe(0x00ff00ff);
    expect(b.pixels[60 * 320 + 90]).toBe(0x00ff00ff);
  });

  test('⚠️ and it is clipped to the WINDOW, not to the screen', () => {
    // The rule ADR-0002 exists for: the HUD's blocks sit outside `into` on every table with columns,
    // and a body drawn across them would be the one thing that draws after the blit painting over the
    // score. `drawFlipper` learnt this; a second body must not learn it again.
    const screen = createFramebuffer(320, 180);
    const into = { x: 100, y: 0, width: 120, height: 180 };

    drawMover(screen, { x: -20, y: 60 }, 6, 0x00ff00ff, into, 0, 0);

    for (let x = 0; x < 100; x++) {
      expect(screen.pixels[60 * 320 + x], `column ${x} is outside the window`).not.toBe(0x00ff00ff);
    }
  });
});

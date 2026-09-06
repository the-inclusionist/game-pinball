// SPDX-License-Identifier: AGPL-3.0-or-later
// THE 1995 TABLE AS THE ACCESSIBILITY LAYER SEES IT.
//
// Until this existed the engine's declaration described the AUTHORED table while the 1995 one was on
// screen, so blind mode and the sweep were refused rather than allowed to give a confident wrong
// answer. This is what makes them answerable: components with roles and rectangles, a ball where the
// player can see it, and the current mission's own targets.
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { readGroups } from '../app/js/dat/partman.js';
import { createDemo } from '../app/js/shell/demo.js';
import { describeComponents, targetsOfMission, demoWorld } from '../app/js/shell/demo-world.js';
import { MISSION_TABLE } from '../app/js/control/mission-table.js';

const DAT = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.DAT';

const archive = () => {
  if (!existsSync(DAT)) return null;
  const buf = readFileSync(DAT);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
};

describe('the components the declaration can describe', () => {
  test('⚠️ every one is inside the picture, or a player is pointed off the table', () => {
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);
    const groups = readGroups(new Uint8Array(bytes));

    const components = describeComponents(groups);

    // ⚠️ EIGHTY-TWO, NOT TWO HUNDRED AND THIRTY, and the difference is the lamps. `roleOfComponent`
    // places 230 of the archive's 291 named groups, but only 82 of those carry a wall record — the rest
    // are `lite*`, which have a position and no body. The Dev's map calls a lamp `free`: the ball rolls
    // over where it is. Putting 139 rectangles that mean "nothing here" into a declaration a sonar
    // sweeps would be noise dressed as coverage, so they are left out.
    //
    // What IS here, by kind: 22 targets, 18 lanes, 9 one-ways, 7 bumpers, 5 kickers, 5 trip wires,
    // 4 wells, 4 rebounders, 2 gates, 2 flags, the ramp, the blocker, the plunger and the drain.
    expect(components.length, 'the table has parts to describe').toBe(82);
    // ⚠️ AND THE DRAIN'S RECORD REACHES PAST THE TABLE — its line runs from x = -10.4 to 10.3 on a
    // table sixteen wide — so this is not a property of the archive, it is one this must not break.
    // The audio guide reads these rectangles as places; one outside the picture is a place nobody can
    // reach and a direction nobody can follow.
    const outside = components.filter((c) =>
      c.bounds.x + c.bounds.width < 0 || c.bounds.x > 183
      || c.bounds.y + c.bounds.height < 0 || c.bounds.y > 235);

    expect(outside.map((c) => c.name), 'components entirely off the picture').toEqual([]);
  });

  test('⚠️ and a name the archive does not explain is LEFT OUT rather than guessed', () => {
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);
    const groups = readGroups(new Uint8Array(bytes));

    const described = new Set(describeComponents(groups).map((c) => c.name));

    // `table` is the playfield bitmap and `background` the side panel: neither is a component, both
    // carry geometry the loop could have taken.
    expect(described.has('table')).toBe(false);
    expect(described.has('background')).toBe(false);
    // And the ones that ARE components are there, with the roles the Dev approved.
    expect(described.has('a_bump1'), 'a bumper').toBe(true);
    expect(described.has('drain'), 'the drain').toBe(true);
  });

  test('the drain is the only hazard on the whole table', () => {
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);
    const groups = readGroups(new Uint8Array(bytes));

    const hazards = describeComponents(groups).filter((c) => c.role === 'hazard');

    expect(hazards.map((c) => c.name)).toEqual(['drain']);
  });
});

describe('the targets the sonar points at', () => {
  test('⚠️ they are the CURRENT mission’s components, not everything on the table', () => {
    // This is the whole reason a blind player can be told where to aim on a 1995 table: the mission
    // machine already knows which components its mission counts hits on, and `lite198`'s message field
    // says which mission is running.
    const skillShot = MISSION_TABLE.find((row) => row.components.length > 0)!;

    const targets = targetsOfMission(skillShot.mission);

    expect(targets).toEqual(skillShot.components);
    expect(targets.length).toBeGreaterThan(0);
  });

  test('and a state that is not a mission has none, which is an honest empty', () => {
    // Mission zero is `WaitingDeployment` and thirty-two is the game-over carousel. Neither counts
    // hits on anything, and answering "everything" would send a player at the whole table.
    expect(targetsOfMission(0)).toEqual([]);
    expect(targetsOfMission(999)).toEqual([]);
  });
});

describe('the demonstration as a live table', () => {
  test('⚠️ the ball is reported where it is DRAWN, not where the physics keeps it', () => {
    // The physics runs in float units from -8 to 8; the declaration is read in the picture's pixels.
    // A guide that spoke table units would describe a table nobody can see.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);
    const demo = createDemo(bytes, { textFor: (id) => id, random: () => 0.5 });
    const world = demoWorld({ demo, groups: readGroups(new Uint8Array(bytes)) });

    const [ball] = world.balls;

    expect(ball!.position.x).toBeGreaterThanOrEqual(0);
    expect(ball!.position.x).toBeLessThanOrEqual(world.playfieldWidth);
    expect(ball!.position.y).toBeGreaterThanOrEqual(0);
    expect(ball!.position.y).toBeLessThanOrEqual(world.playfieldHeight);
    // The table's own float position is nowhere near those numbers, which is the point.
    expect(Math.abs(demo.ball.position.x)).toBeLessThan(10);
  });

  test('⚠️ and it FOLLOWS the ball, because the declaration is read every time it is asked', () => {
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);
    const demo = createDemo(bytes, { textFor: (id) => id, random: () => 0.5 });
    const world = demoWorld({ demo, groups: readGroups(new Uint8Array(bytes)) });
    const before = { ...world.balls[0]!.position };

    demo.plunge(true);
    demo.step(150);
    demo.plunge(false);
    demo.step(30);

    const after = world.balls[0]!.position;
    expect([after.x, after.y], 'a snapshot would still say the first frame')
      .not.toEqual([before.x, before.y]);
  });

  test('the playfield it reports is the picture the player is looking at', () => {
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);
    const demo = createDemo(bytes, { textFor: (id) => id, random: () => 0.5 });

    const world = demoWorld({ demo, groups: readGroups(new Uint8Array(bytes)) });

    expect([world.playfieldWidth, world.playfieldHeight]).toEqual([183, 235]);
    expect(world.ballRadius, 'about three pixels, and never zero').toBeGreaterThanOrEqual(1);
  });
});

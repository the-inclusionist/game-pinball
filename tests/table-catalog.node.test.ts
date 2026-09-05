// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  CATALOG, DEFAULT_TABLE, tableNamed,
  LOW_ORBIT, WIDE_ARC, NARROW_TOWER, FOUR_FLIPPERS, BARE_MINIMUM,
} from '../app/js/table/catalog.js';
import { validateTable, toLiveTable, declaredComponentsOf } from '../app/js/table/authored.js';
import { DEFAULT_CAMERA, createCamera, stepAxis, maxOffsetOf } from '../app/js/shell/camera.js';
import { layoutHud, DEFAULT_HUD } from '../app/js/shell/hud.js';
import { createPinballWorld } from '../app/js/shell/boot.js';
import { kindOf, nameTableOf } from '../app/js/i18n/names.js';

const VIEW = { viewHeight: DEFAULT_CAMERA.viewHeight };
const idle = () => ({
  balls: [], missionTextId: 'STRING151', missionHave: 0, missionNeed: 0, missionTargets: [],
});

describe('all five tables open', () => {
  test('every one of them satisfies the validator', () => {
    for (const table of CATALOG) {
      expect(validateTable(table, VIEW), table.name).toEqual([]);
    }
  });

  test('there are five, with distinct names', () => {
    expect(CATALOG).toHaveLength(5);
    expect(new Set(CATALOG.map((t) => t.name)).size).toBe(5);
  });

  test('the default is the conventional one', () => {
    expect(DEFAULT_TABLE).toBe(LOW_ORBIT);
    expect(tableNamed('wide-arc')).toBe(WIDE_ARC);
    expect(tableNamed('nothing-like-this')).toBeUndefined();
  });

  test('every component is nameable out loud, from its DECLARED kind', () => {
    // ⚠️ AND NOT FROM ITS NAME. `i18n/names.kindOf` guesses the kind from the `.DAT` group name
    // because that is all the 1995 table offers — `bump1` is a bumper because it starts with `bump`.
    // An authored table DECLARES its kind, so guessing would be strictly worse: `outlane.left` is a
    // lane and no prefix rule would ever say so.
    for (const table of CATALOG) {
      for (const component of table.components) {
        expect(nameTableOf('pt')[component.kind]?.text, `${table.name}/${component.name}`).toBeTruthy();
      }
    }
  });

  test('and the guesser is deliberately NOT used on these names', () => {
    // Proof that the two mechanisms are separate rather than one being a fallback for the other: the
    // authored names defeat the prefix table, and it does not matter.
    const guessed = LOW_ORBIT.components.filter((c) => kindOf(c.name) !== null);
    const declared = LOW_ORBIT.components.filter((c) => nameTableOf('pt')[c.kind]);

    expect(guessed.length).toBeLessThan(declared.length);
    expect(declared).toHaveLength(LOW_ORBIT.components.length);
  });
});

describe('low-orbit — the conventional table', () => {
  test('the gap between the flippers is wider than the ball', () => {
    // A gap narrower than the ball is not a tight shot, it is a wall that looks like a gap.
    const left = LOW_ORBIT.components.find((c) => c.name === 'flipper.left')!;
    const right = LOW_ORBIT.components.find((c) => c.name === 'flipper.right')!;

    const gap = right.bounds.x - (left.bounds.x + left.bounds.width);

    expect(gap).toBeGreaterThan(LOW_ORBIT.ballRadius * 2);
  });

  test('and so is each outlane', () => {
    for (const name of ['outlane.left', 'outlane.right']) {
      const lane = LOW_ORBIT.components.find((c) => c.name === name)!;
      expect(lane.bounds.width, name).toBeGreaterThan(LOW_ORBIT.ballRadius * 2);
    }
  });

  test('THE DRAIN IS THE WIDEST WAY TO LOSE, on purpose', () => {
    // Losing the ball down the middle should be the common way to lose it; the outlanes are the
    // unlucky way.
    const drain = LOW_ORBIT.components.find((c) => c.name === 'drain')!;
    const outlane = LOW_ORBIT.components.find((c) => c.name === 'outlane.left')!;

    expect(drain.bounds.width).toBeGreaterThan(outlane.bounds.width);
  });

  test('the drain sits BETWEEN the flippers, so they can guard it', () => {
    const left = LOW_ORBIT.components.find((c) => c.name === 'flipper.left')!;
    const right = LOW_ORBIT.components.find((c) => c.name === 'flipper.right')!;
    const drain = LOW_ORBIT.components.find((c) => c.name === 'drain')!;

    expect(drain.bounds.x).toBeGreaterThanOrEqual(left.bounds.x);
    expect(drain.bounds.x + drain.bounds.width).toBeLessThanOrEqual(right.bounds.x + right.bounds.width);
    expect(drain.bounds.y).toBeGreaterThan(left.bounds.y);
  });

  test('the plunger lane reaches the top, because a ball has to get there', () => {
    const lane = LOW_ORBIT.components.find((c) => c.name === 'lane.launch')!;
    const divider = LOW_ORBIT.components.find((c) => c.name === 'wall.laneDivider')!;

    // The divider stops short of the top; that opening is the only way into the play.
    expect(divider.bounds.y).toBeGreaterThan(lane.bounds.y - 30);
    expect(divider.bounds.y).toBeGreaterThan(0);
  });

  test('it has the three wormhole wells the control layer expects', () => {
    const wells = LOW_ORBIT.components.filter((c) => c.kind === 'well');

    expect(wells).toHaveLength(3);
  });

  test('and a bank of exactly three targets', () => {
    const bank = LOW_ORBIT.components.filter((c) => c.control === 'BoosterTargetControl');

    expect(bank).toHaveLength(3);
  });
});

describe('wide-arc — the table wider than the screen', () => {
  test('it is the only table the HUD has to OVERLAY', () => {
    // The claim ADR-0002 § 5 made about phase 8, met by a real table for the first time.
    for (const table of CATALOG) {
      const hud = layoutHud({ ...DEFAULT_HUD, playfieldWidth: table.size.width });
      expect(hud.overlaying, table.name).toBe(table === WIDE_ARC);
    }
  });

  test('and the only one whose HORIZONTAL axis has anywhere to travel', () => {
    // ADR-0001 § 7 said the axis solver would serve a wider table. Nothing had ever handed it one.
    const horizontal = {
      ...DEFAULT_CAMERA, viewHeight: 320, worldHeight: WIDE_ARC.size.width, anchor: 160,
    };

    expect(maxOffsetOf(horizontal)).toBe(40);

    let state = createCamera(horizontal);
    for (let i = 0; i < 400; i++) state = stepAxis(state, horizontal, 20, 6);

    expect(state.offset).toBeLessThanOrEqual(horizontal.stopTolerance);
  });

  test('every other table fits across the screen with room for the columns', () => {
    for (const table of CATALOG.filter((t) => t !== WIDE_ARC)) {
      expect(table.size.width, table.name).toBeLessThan(DEFAULT_HUD.screenWidth);
    }
  });
});

describe('narrow-tower — where losing the flippers is most extreme', () => {
  test('it has more than four times low-orbit’s camera travel', () => {
    const travel = (height: number) => height - DEFAULT_CAMERA.viewHeight;

    expect(travel(NARROW_TOWER.size.height)).toBe(240);
    expect(travel(LOW_ORBIT.size.height)).toBe(55);
    expect(travel(NARROW_TOWER.size.height)).toBeGreaterThan(travel(LOW_ORBIT.size.height) * 4);
  });

  test('with the ball at the summit the flippers are far off screen', () => {
    // ADR-0001 § 5 says giving them up is part of the game. This is where that costs the most, and
    // having the extreme available is what makes it judgeable before the table is finished.
    const camera = { ...DEFAULT_CAMERA, worldHeight: NARROW_TOWER.size.height };
    const flipper = NARROW_TOWER.components.find((c) => c.name === 'flipper.left')!;

    let state = createCamera(camera);
    for (let i = 0; i < 2000; i++) state = stepAxis(state, camera, 20, 6);

    expect(flipper.bounds.y).toBeGreaterThan(state.offset + camera.viewHeight);
  });

  test('it gives the HUD the widest columns of any table meant to be played', () => {
    // `bare-minimum` is narrower still, at 100, but it is a floor rather than a table. Among the four
    // that are actually laid out, this is the one where the HUD has the most room.
    const playable = CATALOG.filter((t) => t !== BARE_MINIMUM);
    const margins = playable.map((t) => DEFAULT_HUD.screenWidth - t.size.width);

    expect(Math.max(...margins)).toBe(DEFAULT_HUD.screenWidth - NARROW_TOWER.size.width);
    expect(DEFAULT_HUD.screenWidth - NARROW_TOWER.size.width).toBe(200);
  });
});

describe('four-flippers — the table that contradicts an inherited assumption', () => {
  test('two pairs of flippers and TWO drains', () => {
    // Every other table has one pair and one drain, which is what the 1995 table has and therefore
    // the only arrangement any module has ever been asked about.
    expect(FOUR_FLIPPERS.components.filter((c) => c.kind === 'flipper')).toHaveLength(4);
    expect(FOUR_FLIPPERS.components.filter((c) => c.kind === 'drain')).toHaveLength(2);
  });

  test('every other table has exactly one drain', () => {
    for (const table of CATALOG.filter((t) => t !== FOUR_FLIPPERS)) {
      expect(table.components.filter((c) => c.kind === 'drain'), table.name).toHaveLength(1);
    }
  });

  test('the upper drain is above the lower pair, so it is a real second way to lose', () => {
    const upper = FOUR_FLIPPERS.components.find((c) => c.name === 'drain.upper')!;
    const lowerFlipper = FOUR_FLIPPERS.components.find((c) => c.name === 'flipper.lower.left')!;

    expect(upper.bounds.y).toBeLessThan(lowerFlipper.bounds.y);
  });

  test('it has the least camera travel of any table that still needs one', () => {
    const travel = FOUR_FLIPPERS.size.height - DEFAULT_CAMERA.viewHeight;

    expect(travel).toBe(30);
    expect(travel).toBeGreaterThan(0);
  });
});

describe('bare-minimum — the floor of the format', () => {
  test('it has exactly what the rules demand and nothing else', () => {
    expect(BARE_MINIMUM.components).toHaveLength(3);
    expect(BARE_MINIMUM.lamps).toEqual([]);
    expect(BARE_MINIMUM.size.height).toBe(DEFAULT_CAMERA.viewHeight + 1);
  });

  test('⚠️ IT PASSES, AND IT IS NOT PLAYABLE', () => {
    // The finding, not a gap: one flipper cannot cover a drain and there is nothing to score. The
    // validator checks that a table can RUN, not that it is worth running, and only the first of those
    // has a machine answer.
    expect(validateTable(BARE_MINIMUM, VIEW)).toEqual([]);
    expect(BARE_MINIMUM.components.filter((c) => c.kind === 'flipper')).toHaveLength(1);
    expect(BARE_MINIMUM.components.filter((c) => c.scores)).toEqual([]);
  });

  test('removing any one of its three components breaks it', () => {
    // Which is what makes it the floor rather than merely a small table.
    for (const dropped of BARE_MINIMUM.components) {
      const without = {
        ...BARE_MINIMUM,
        components: BARE_MINIMUM.components.filter((c) => c !== dropped),
      };
      expect(validateTable(without, VIEW).length, `without ${dropped.name}`).toBeGreaterThan(0);
    }
  });

  test('and one pixel shorter breaks it too', () => {
    const flat = { ...BARE_MINIMUM, size: { width: 100, height: DEFAULT_CAMERA.viewHeight } };

    expect(validateTable(flat, VIEW).join()).toContain('nowhere to travel');
  });
});

describe('every table can be handed to the shell', () => {
  test('each one becomes a live table the declaration can read', () => {
    for (const table of CATALOG) {
      const live = toLiveTable(table, idle);

      expect(live.playfieldWidth, table.name).toBe(table.size.width);
      expect(live.playfieldHeight, table.name).toBe(table.size.height);
      expect(live.components.length, table.name).toBe(table.components.length);
    }
  });

  test('and the components carry a role the contract understands', () => {
    const roles = new Set(['hazard', 'climb', 'water', 'goal', 'gate', 'key', 'structure', 'free']);

    for (const table of CATALOG) {
      for (const component of declaredComponentsOf(table)) {
        expect(roles.has(component.role), `${table.name}/${component.name}`).toBe(true);
      }
    }
  });

  test('every table has a hazard, so the accessibility layer has something to warn about', () => {
    for (const table of CATALOG) {
      const hazards = table.components.filter((c) => c.role === 'hazard');
      expect(hazards.length, table.name).toBeGreaterThan(0);
    }
  });
});

describe('⚠️ every component of every table is announced, not only the lucky ones', () => {
  test('the declared kind reaches the declaration, so nothing is silent', () => {
    // A real boot found `outlane.left` and `lane.launch` announcing NOTHING, because the world was
    // still guessing kinds from names. The outlane is the one hazard a blind player most needs to
    // hear about, so this walks every component of every table rather than sampling.
    for (const table of CATALOG) {
      const world = createPinballWorld(toLiveTable(table, idle), 'pt');
      for (const component of table.components) {
        expect(world.speak(component.name)?.text, `${table.name}/${component.name}`).toBeTruthy();
      }
    }
  });

  test('and a table that declares no kinds still falls back to guessing', () => {
    // The 1995 table has no declared kinds and must keep working: guessing is the fallback, not the
    // rule it replaced.
    const guessing = { ...toLiveTable(LOW_ORBIT, idle), kindOfComponent: undefined };
    const world = createPinballWorld(guessing, 'pt');

    expect(world.speak('drain')?.text).toBe('ralo');
    expect(world.speak('outlane.left')).toBeNull();
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  CATALOG, DEFAULT_TABLE, tableNamed,
  LOW_ORBIT, WIDE_ARC, NARROW_TOWER, FOUR_FLIPPERS, BARE_MINIMUM,
} from '../app/js/table/catalog.js';
import {
  validateTable, toLiveTable, declaredComponentsOf, normalOf, type AuthoredTable,
} from '../app/js/table/authored.js';
import {
  buildPhysics, drainedBy, launchSpeedFor, FRAME_SECONDS,
} from '../app/js/table/physics-build.js';
import { advanceFrame } from '../app/js/physics/step.js';
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

  test('⚠️ the catalogue grows on purpose, and its size is pinned so it cannot grow by accident', () => {
    // This said FIVE, and the number was the point: the catalogue's own header explains that each of
    // the five reaches a part of the machine no other reaches. The Dev has asked for five more tables
    // meant to be PLAYED, which is a different axis — `ion-storm` is the first of them.
    //
    // The count stays pinned rather than becoming `>= 5`, because a table appearing in the catalogue is
    // a decision: it goes in the selector, it needs a world in the palette, and it has to survive the
    // playability gates. Updating this line is the cheapest possible way to be made to notice.
    expect(CATALOG).toHaveLength(9);
    expect(new Set(CATALOG.map((t) => t.name)).size, 'and no two share a name').toBe(CATALOG.length);
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

  test('it has three wormhole wells, which is a shape borrowed from the 1995 table', () => {
    // ⚠️ THIS USED TO SAY "the control layer expects". It did not: `WormHoleControl` was never wired to
    // an authored table and could not be — it wants three wells that know about each other, and the
    // authored format has no way to say that. Three is a deliberate LAYOUT choice, echoing the table
    // this port descends from, and calling it a requirement claimed a dependency that was not there.
    const wells = LOW_ORBIT.components.filter((c) => c.kind === 'well');

    expect(wells).toHaveLength(3);
  });

  test('and a bank of exactly three targets', () => {
    // Counted by KIND, not by control name. Counting `control === 'BoosterTargetControl'` was counting
    // the wrong thing twice over: the name has been replaced by one an authored table can actually be
    // wired to, and the flag now shares it — so the old count would have said four and meant nothing.
    const bank = LOW_ORBIT.components.filter((c) => c.kind === 'target');

    expect(bank).toHaveLength(3);
  });
});

describe('wide-arc — the table wider than the screen', () => {
  test('⚠️ the HUD overlays exactly the tables that are wider than the screen, and no others', () => {
    // This said `wide-arc` was the ONLY table the HUD has to overlay, and that was the honest claim
    // while it was the only wide one — ADR-0002 § 5 predicted phase 8 would produce such a table and
    // this was it, met for the first time.
    //
    // `ring-belt` is the second and the first meant to be played. So the claim moves from naming ONE
    // TABLE to naming the PROPERTY: overlaying is what being wider than the screen costs, and it should
    // follow from the width and from nothing else. A table that overlaid while fitting, or fitted while
    // overlaying, would be a layout answering a question nobody asked it.
    for (const table of CATALOG) {
      const hud = layoutHud({ ...DEFAULT_HUD, playfieldWidth: table.size.width });
      expect(hud.overlaying, table.name).toBe(table.size.width >= DEFAULT_HUD.screenWidth);
    }
    // And both sides of that happen, or it is a comparison with one answer.
    const widths = CATALOG.map((t) => t.size.width);
    expect(widths.some((w) => w >= DEFAULT_HUD.screenWidth), 'some table overlays').toBe(true);
    expect(widths.some((w) => w < DEFAULT_HUD.screenWidth), 'and some table does not').toBe(true);
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

  test('⚠️ and the tables WIDER than the screen are named, one by one', () => {
    // This said "every other table fits", with `wide-arc` the single exception — and that was true for
    // as long as `wide-arc` was the only table wider than 320. `ring-belt` is the second, and it is the
    // first one MEANT TO BE PLAYED: the fixture exists to give `stepAxis` a horizontal case, and the
    // game table exists to make a player use it.
    //
    // ⚠️ A LIST RATHER THAN A COMPARISON, because being wider than the screen is a DECISION. It costs
    // the HUD its columns — `layoutHud` reports `overlaying` and the blocks move on top of the play,
    // which ADR-0002 allows and does not like — and it costs the player sight of part of the table. A
    // table that acquired that by somebody typing a larger number should stop here.
    const WIDER_THAN_THE_SCREEN = ['wide-arc', 'ring-belt'];

    const wide = CATALOG.filter((t) => t.size.width >= DEFAULT_HUD.screenWidth).map((t) => t.name);

    expect(wide.sort()).toEqual([...WIDER_THAN_THE_SCREEN].sort());
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
    // ⚠️ AMONG THE TABLES THAT HAVE COLUMNS AT ALL. `ring-belt` is 360 wide and has none: its HUD
    // overlays the play, so its "margin" is negative and comparing it here would make the widest
    // columns a fact about arithmetic rather than about layout.
    const playable = CATALOG.filter((t) => t !== BARE_MINIMUM
      && t.size.width < DEFAULT_HUD.screenWidth);
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

/** Launches a ball and reports whether it left through a hole rather than through a drain. */
function leavesThroughAHole(table: AuthoredTable): boolean {
  const physics = buildPhysics(table);
  const ball = physics.spawnBall();
  ball.direction = { x: 0, y: -1 };
  ball.speed = launchSpeedFor(table);

  for (let i = 0; i < 4000; i++) {
    advanceFrame([ball], physics.context, FRAME_SECONDS);
    const drained = drainedBy(table, ball);
    if (drained) return drained === 'outside';
  }
  return false;
}

describe('bare-minimum — the floor of the format', () => {
  test('it has exactly what the rules demand and nothing else', () => {
    // ⚠️ THE FLOOR GREW, TWICE, AND BOTH TIMES BECAUSE A RULE FOUND SOMETHING THE FORMAT REALLY DEMANDS.
    // It was three components and no lamps. Then flippers had to declare geometry, because a flipper
    // the ball goes through is not a flipper. Then a table had to declare SOMETHING TO PURSUE, because
    // the contract's fifth field is what the sonar reads and a table with an empty one cannot be
    // described to a player who cannot see it. A rule does not get to exempt the example that
    // documents it.
    // ⚠️ THIRD TIME: it now has a CEILING, because a launch here ended with `drainedBy` answering
    // `outside` — a hole in the geometry rather than a way to lose, which is a distinction
    // `physics-build` makes on purpose. Holding the ball is not a question of whether a table is fun;
    // it is whether it is a table.
    //
    // One wall and not three. I added three and then measured: removing either SIDE changes nothing,
    // because the ball never travels sideways here. The floor carries what it needs and not what a
    // different table would need.
    expect(BARE_MINIMUM.components).toHaveLength(5);
    expect(BARE_MINIMUM.lamps).toHaveLength(1);
    expect(BARE_MINIMUM.size.height).toBe(DEFAULT_CAMERA.viewHeight + 1);
  });

  test('⚠️ IT PASSES, AND IT IS NOT PLAYABLE', () => {
    // Still the finding, and now on narrower ground: it has something to REACH and no way to reach it.
    // One flipper cannot cover a drain, and `tests/table-playable` holds that the ball never leaves the
    // plunger lane here. Describable and playable are different axes, and only the first has a machine
    // answer — which is exactly what the validator can and cannot do.
    expect(validateTable(BARE_MINIMUM, VIEW)).toEqual([]);
    expect(BARE_MINIMUM.components.filter((c) => c.kind === 'flipper')).toHaveLength(1);
    expect(BARE_MINIMUM.components.filter((c) => c.scores)).toHaveLength(1);
  });

  test('⚠️ removing any one of its NON-WALL components breaks the validator', () => {
    // ⚠️ THIS USED TO SAY "any one of its three", AND THE FLOOR IS NOW DEFINED BY TWO DIFFERENT CHECKS.
    //
    // The validator reads a table's SHAPE, and no rule there demands a wall — a table could be closed
    // some other way, and inventing "must have three walls" would be inventing a rule to fit an example.
    // What actually holds the walls is the SIMULATION: `tests/table-playable` launches a ball and
    // refuses `outside`. Splitting the claim is the honest reading, and pretending one check covers both
    // would have quietly weakened the other.
    const structural = BARE_MINIMUM.components.filter((c) => c.kind !== 'wall');

    for (const dropped of structural) {
      const without = {
        ...BARE_MINIMUM,
        components: BARE_MINIMUM.components.filter((c) => c !== dropped),
      };
      expect(validateTable(without, VIEW).length, `without ${dropped.name}`).toBeGreaterThan(0);
    }
  });

  test('⚠️ and removing the CEILING breaks it the other way — the ball goes out of the top', () => {
    // The half the validator cannot see, and it is worth stating here because "the floor" is this
    // table's whole job and half a floor is a misleading example.
    //
    // My first version of this removed `wall.left` and asserted the ball escaped SIDEWAYS. It does not:
    // it goes straight up the lane and out of the top, and the side walls are never touched at all.
    // The test failed, which is the only reason I measured instead of assuming.
    const without = {
      ...BARE_MINIMUM,
      components: BARE_MINIMUM.components.filter((c) => c.kind !== 'wall'),
    };

    expect(validateTable(without, VIEW)).toEqual([]);
    expect(leavesThroughAHole(without)).toBe(true);
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

describe('⚠️ a line is one-sided, and its winding decides which side', () => {
  test('every wall faces INTO the table, not out of it', () => {
    // `lineInit` makes the normal `(dy, -dx)` and `rayIntersectLine` refuses a ray arriving at the
    // back, so a wall wound the wrong way is not a wall that feels odd — it is thin air. The first
    // draft of these tables got three of low-orbit's four walls backwards, and the symptom was a ball
    // falling straight through to y = 1600 on a table 200 tall.
    const wrong: string[] = [];

    for (const table of CATALOG) {
      const centre = { x: table.size.width / 2, y: table.size.height / 2 };
      for (const component of table.components) {
        if (component.kind !== 'wall') continue;
        for (const shape of component.collision ?? []) {
          if (shape.kind !== 'line') continue;
          const n = normalOf(shape);
          const mid = { x: (shape.from.x + shape.to.x) / 2, y: (shape.from.y + shape.to.y) / 2 };
          const inward = { x: centre.x - mid.x, y: centre.y - mid.y };
          if (n.x * inward.x + n.y * inward.y <= 0) wrong.push(`${table.name}/${component.name}`);
        }
      }
    }

    expect(wrong).toEqual([]);
  });

  test('every flipper faces UP, because a ball arrives from above', () => {
    const wrong: string[] = [];

    for (const table of CATALOG) {
      for (const component of table.components) {
        if (component.kind !== 'flipper') continue;
        for (const shape of component.collision ?? []) {
          if (shape.kind !== 'line') continue;
          if (normalOf(shape).y >= 0) wrong.push(`${table.name}/${component.name}`);
        }
      }
    }

    expect(wrong).toEqual([]);
  });
});

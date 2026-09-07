// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  AUTHORED_TABLES, CATALOG, DEFAULT_TABLE, PLAYABLE_TABLES, tableNamed,
  LOW_ORBIT, WIDE_ARC, NARROW_TOWER, FOUR_FLIPPERS, BARE_MINIMUM,
} from '../app/js/table/catalog.js';
import { cabinet } from '../app/js/table/cabinet.js';
import {
  validateTable, toLiveTable, declaredComponentsOf, normalOf, type AuthoredTable,
} from '../app/js/table/authored.js';
import {
  buildPhysics, drainedBy, launchSpeedFor, launchDirectionFor, FRAME_SECONDS,
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
    // ⚠️ ELEVEN NOW: `factory`, which the Dev asked for by name — "Crie a mesa factory, com base em
    // factory.jpg" — and which is the first here authored straight onto its picture.
    expect(CATALOG).toHaveLength(11);
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

  test('three standing targets against the left wall, and three DROP targets on the right', () => {
    // Counted by KIND, not by control name. Counting `control === 'BoosterTargetControl'` was counting
    // the wrong thing twice over: the name has been replaced by one an authored table can actually be
    // wired to, and the flag now shares it — so the old count would have said four and meant nothing.
    //
    // ⚠️ AND THIS SAID "A BANK OF EXACTLY THREE TARGETS" WHEN THERE WAS NO BANK. Six targets now, and
    // the word means something: three ordinary ones down the left wall, worth more the second time,
    // and three DROP targets on the right that sink when hit and pay together. Counting all six as one
    // number would have gone on passing while the table's most interesting half was untested.
    const standing = LOW_ORBIT.components.filter((c) => c.kind === 'target' && c.bank === undefined);
    const dropping = LOW_ORBIT.components.filter((c) => c.kind === 'target' && c.bank !== undefined);

    expect(standing, 'the left wall').toHaveLength(3);
    expect(dropping, 'the drop bank').toHaveLength(3);
    expect(new Set(dropping.map((c) => c.bank)).size, 'and they are one bank, not three').toBe(1);
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
  // ⚠️ UP THE LANE, WHICH LEANS NINE DEGREES. A plunger fires along its own channel, and on this
  // engine a graze does not glance off a wall — it turns the ball into that wall's normal. See
  // `launchDirectionFor`.
  ball.direction = launchDirectionFor(table);
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
  test('every wall faces somewhere the BALL can be, not out of the table', () => {
    // `lineInit` makes the normal `(dy, -dx)` and `rayIntersectLine` refuses a ray arriving at the
    // back, so a wall wound the wrong way is not a wall that feels odd — it is thin air. The first
    // draft of these tables got three of low-orbit's four walls backwards, and the symptom was a ball
    // falling straight through to y = 1600 on a table 200 tall.
    //
    // ⚠️ THIS USED TO ASK "DOES THE NORMAL POINT AT THE TABLE'S CENTRE", AND THAT WAS A PROXY THAT
    // BROKE THE DAY A WALL HAD PLAY ON BOTH SIDES. `wall.laneDivider` has the playfield on its left
    // and the PLUNGER LANE on its right; it needs a face each way, and the right-hand one points away
    // from the centre by construction. The centre test called it backwards and it is not.
    //
    // The question the proxy was standing in for is this one: is there room for a BALL in front of
    // this face? A wall wound outward answers no — one radius along its normal lands in the frame or
    // outside it — and that is the defect, stated directly instead of approximated.
    const wrong: string[] = [];

    for (const table of CATALOG) {
      const r = table.ballRadius;
      for (const component of table.components) {
        if (component.kind !== 'wall') continue;
        for (const shape of component.collision ?? []) {
          if (shape.kind !== 'line') continue;
          const n = normalOf(shape);
          const length = Math.hypot(n.x, n.y) || 1;
          const front = {
            x: (shape.from.x + shape.to.x) / 2 + (n.x / length) * r,
            y: (shape.from.y + shape.to.y) / 2 + (n.y / length) * r,
          };
          const room = front.x > r && front.x < table.size.width - r
            && front.y > r && front.y < table.size.height - r;
          if (!room) wrong.push(`${table.name}/${component.name}`);
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

describe('⚠️ the camera can reach the bottom of every table', () => {
  // The Dev found this by playing: "crater run está sendo cortada na parte de baixo (mal dá pra
  // enxergar as pás), long climb está mais coartada ainda". `DEFAULT_CAMERA.worldHeight` is 235 —
  // `low-orbit`'s height, right for exactly one table — and `main.ts` never overrode it. So the view's
  // travel was 55 on every table and everything below that line was unreachable: the flippers and the
  // drain, which is the part of a pinball a player reads the ball's line off.
  //
  // ⚠️ NOTHING COULD HAVE CAUGHT IT WHERE IT WAS. `shell-camera` tests the solver against configs it
  // builds itself and every one of them is consistent; the defect was in what `main.ts` HANDED the
  // solver, which no unit sees. This asks the question about the catalogue instead.
  test.each(CATALOG.map((t) => [t.name, t] as const))(
    '%s: the last row of the table can be the last row of the view',
    (_name, table) => {
      const config = { ...DEFAULT_CAMERA, worldHeight: table.size.height };
      const furthest = maxOffsetOf(config);

      expect(config.worldHeight - furthest, 'the top row still visible at full scroll')
        .toBe(config.viewHeight);
      expect(furthest, 'and a taller table scrolls further')
        .toBe(Math.max(0, table.size.height - DEFAULT_CAMERA.viewHeight));
    },
  );

  test('⚠️ and the DEFAULT alone is not enough, which is the whole defect', () => {
    // If this ever comes back false, the default happens to fit every table and the override above
    // stops being load-bearing — at which point somebody will remove it and the next tall table will
    // lose its bottom again in silence.
    const tallerThanTheDefault = CATALOG.filter((t) => t.size.height > DEFAULT_CAMERA.worldHeight);

    expect(tallerThanTheDefault.map((t) => t.name).length,
      'tables the default camera cannot show the bottom of').toBeGreaterThan(0);
  });
});

/**
 * ⚠️ ONE CABINET, AND `low-orbit` WROTE ITS OWN FOR MONTHS.
 *
 * `table/cabinet` exists because five tables needed the same shell and copying it five times would
 * have been five chances to re-make the two defects its header records — a lane with no return bend
 * and flippers with no funnel, each of which made a table unplayable. `low-orbit` is where that shell
 * was PROVED: the module's numbers were extracted from this file. And this file was never converted
 * to use it.
 *
 * So every cabinet change since reached five tables and skipped the sixth. The plunger's own collision
 * face, the two inlanes, the ball-radius offset — each had to be made twice, and the second time was
 * noticed only because some test happened to name `low-orbit`. The Dev caught the word I had been
 * hiding it behind: I had called the table "hand-authored", which reads as "made by a person" and is
 * not what happened. I generated it like the other five and left it out of the refactor.
 *
 * This is the gate that stops the seventh table from doing the same. It asks the question the drift
 * survived: does every playable table have exactly the components `cabinet()` produces, with the
 * geometry `cabinet()` gives them?
 */
/**
 * ⚠️ AND ONE TABLE MAY REPLACE ONE PIECE OF THE SHELL, NAMED HERE, WITH ITS REASON.
 *
 * A ledger like `tests/table-density`'s and `tests/table-reachable`'s, and for the same purpose: the
 * exception is a line somebody had to write rather than a silence. `crater-run` splits the plunger
 * lane divider into three — wall, door, wall — because the Dev asked for "passagens secretas que se
 * abrem caso na primeira tacada a bola desça", and a hole in a wall cannot be expressed by a table
 * that must have the cabinet's wall unchanged.
 *
 * ⚠️ THE PIECES IT PUTS BACK ARE STILL CHECKED, by the rule below rather than by this ledger: together
 * they must cover the same span with the same two faces, so a table cannot use "I have a passage" to
 * quietly lose a wall. That is what the drift gate is for and it is not being switched off.
 */
const SHELL_OVERRIDES: Readonly<Record<string, readonly string[]>> = {
  'crater-run': ['wall.laneDivider'],
};

describe('⚠️ every playable table is built on the one cabinet', () => {
  /**
   * ⚠️ THIS WHOLE BLOCK ASKS ITS QUESTION UPRIGHT, which is why it reads `AUTHORED_TABLES` rather than
   * the catalogue everything else uses. `table/catalog` puts every table through `table/perspective` —
   * nine degrees, the Dev's trapezium — and that transform touches every point above the floor, so a
   * shell built straight out of `cabinet()` differs from every table in the catalogue everywhere.
   * Comparing them there would report "all seven have drifted", which is the opposite of true: they
   * lean together, through one function.
   *
   * Drift is an AUTHORING question — did this file write its own copy of the shell — and it belongs in
   * the space the author typed in. The lean is checked by `tests/table-perspective`, on the tables the
   * game actually plays.
   */
  const upright = (table: AuthoredTable) => AUTHORED_TABLES.find((t) => t.name === table.name)!;
  const shell = (table: AuthoredTable) => new Map(
    cabinet({ width: table.size.width, height: table.size.height }).map((c) => [c.name, c]),
  );

  test('⚠️ a table that replaces part of the shell still walls the same span', () => {
    // The ledger's own gate. `crater-run`'s three divider pieces must between them run from the
    // cabinet's `dividerTop` to the floor with no gap other than the door, and the door must BE a
    // secret — otherwise "I have a passage" is a way to delete a wall.
    for (const [tableName, names] of Object.entries(SHELL_OVERRIDES)) {
      const table = PLAYABLE_TABLES.find((t) => t.name === tableName)!;
      expect(table, `${tableName} is a playable table`).toBeDefined();

      for (const name of names) {
        const original = shell(table).get(name)!;
        // Everything of this table that lives in the replaced component's column.
        const pieces = upright(table).components.filter((c) => c.bounds.x === original.bounds.x
          && c.bounds.width === original.bounds.width);
        const top = Math.min(...pieces.map((c) => c.bounds.y));
        const bottom = Math.max(...pieces.map((c) => c.bounds.y + c.bounds.height));

        expect(top, `${tableName}/${name} starts where the cabinet's does`).toBe(original.bounds.y);
        expect(bottom, `${tableName}/${name} ends where the cabinet's does`)
          .toBe(original.bounds.y + original.bounds.height);
        expect(pieces.filter((c) => c.secret).length, `${tableName}: exactly one of them is a door`)
          .toBe(1);
        // Contiguous: sorted by y, each piece starts where the last one ended.
        const sorted = [...pieces].sort((a, b) => a.bounds.y - b.bounds.y);
        for (let i = 1; i < sorted.length; i++) {
          expect(sorted[i]!.bounds.y, `${tableName}: no gap between the pieces`)
            .toBe(sorted[i - 1]!.bounds.y + sorted[i - 1]!.bounds.height);
        }
      }
    }
  });

  test.each(PLAYABLE_TABLES.map((t) => [t.name, t] as const))('%s has all of it', (_name, table) => {
    const mine = new Map(upright(table).components.map((c) => [c.name, c]));

    for (const name of shell(table).keys()) {
      expect(mine.has(name), `${name} is missing`).toBe(true);
    }
  });

  test.each(PLAYABLE_TABLES.map((t) => [t.name, t] as const))(
    '%s: and its shell is the cabinet’s, not a copy that has drifted', (_name, table) => {
    // ⚠️ THE BOUNDS AND THE COLLISION, COMPARED. A table that declared `flipper.left` at its own
    // coordinates would pass the test above and be exactly the defect this pair exists to catch —
    // `low-orbit`'s flippers sat seven pixels right of the cabinet's for months, because it centred
    // them on the TABLE and the cabinet centres them on the PLAY.
    const mine = new Map(upright(table).components.map((c) => [c.name, c]));

    const excused = new Set(SHELL_OVERRIDES[table.name] ?? []);

    for (const [name, expected] of shell(table)) {
      if (excused.has(name)) continue;
      const actual = mine.get(name)!;
      expect(actual.bounds, `${name} bounds`).toEqual(expected.bounds);
      expect(actual.collision ?? null, `${name} collision`).toEqual(expected.collision ?? null);
    }
  });
});

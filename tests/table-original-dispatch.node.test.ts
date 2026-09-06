// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createOriginalDispatch } from '../app/js/table/original-dispatch.js';
import { buildOriginalComponents } from '../app/js/table/original-components.js';
import { buildOriginalTable } from '../app/js/table/original.js';
import { buildOriginalGates } from '../app/js/table/original-gates.js';
import { buildOriginalKickouts, kickoutGeometry } from '../app/js/table/original-kickouts.js';
import { blockerNames, buildOriginalBlockers } from '../app/js/table/original-blockers.js';
import { buildOriginalSinks } from '../app/js/table/original-sinks.js';
import {
  REENTRY_LANES, LAMP_BINDINGS, FUEL_ROLLOVERS, OUT_LANES, BONUS_LANE, SPOT_TARGET_SETS,
  MEDAL_BANK, MULTIPLIER_BANK, BOOSTER_BANK, TABLE_ACTIONS, GATE_LAMPS, KICKERS, SKILL_SHOT,
  LAUNCH_RAMP, FLAGS, DRAIN, PER_BALL_RESET, WORM_HOLE, DRAIN_BLOCKER, PLUNGER_FEED,
  WORM_HOLE_SINKS, HYPERSPACE, KICKOUTS,
} from '../app/js/control/bindings.js';
import { createScoreState } from '../app/js/control/score.js';
import { BASE_BONUS } from '../app/js/control/drain.js';
import { SCORE_COMPONENTS } from '../app/js/control/score-table.js';
import { ALIEN_MENACE } from '../app/js/control/bindings.js';
import { MISSION_TABLE } from '../app/js/control/mission-table.js';
import { loadTable } from '../app/js/dat/loader.js';
import type { ControlContext } from '../app/js/control/dispatch.js';

/**
 * ⚠️ THE LAST JOIN, AND THE FIRST TIME THE THREE PIECES MEET.
 *
 * `control/lanes` says what a bumper lane DOES; `control/bindings` says which light, group and bumper
 * each control reaches; `table/original-components` builds those from the archive. Each was tested on
 * its own and none of them had ever met the other two.
 */

const DAT = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.DAT';
const manifest = () => {
  if (!existsSync(DAT)) return null;
  const buf = readFileSync(DAT);
  return loadTable(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
};

function wired(
  o: { gates?: boolean; easy?: boolean; drain?: boolean; feed?: boolean; wormHole?: boolean } = {},
) {
  const drainTable = {
    tiltLocked: false, multiballCount: 0, multiballFlag: false, extraBalls: 0, ballCount: 3,
    currentPlayer: 0, playerCount: 1, unlimitedBalls: false,
  };
  const outcomes: string[] = [];
  /** Stubs, because what is under test here is WHO is asked to come back up, not the rising. */
  const poppedUp: string[] = [];
  const popupTargets = new Map(
    ['a_targ1', 'a_targ2', 'a_targ3', 'a_targ4', 'a_targ5', 'a_targ6', 'a_targ7', 'a_targ8', 'a_targ9']
      .map((name) => [name, { popUp: () => poppedUp.push(name) }] as const),
  );
  const table = manifest();
  if (!table) return null;
  const components = buildOriginalComponents(table);
  // The gates need the GEOMETRY, which is a different build — see `table/original-gates`.
  const geometry = (o.gates || o.feed)
    ? buildOriginalTable(table.groups, {
      geometryFor: kickoutGeometry(table),
      startsInactive: (name) => blockerNames(table).has(name),
    })
    : null;
  const gates = geometry ? buildOriginalGates(table, geometry) : undefined;
  const kickouts = geometry
    ? buildOriginalKickouts(table, geometry, { table: { tiltLocked: false }, timer: components.timer })
    : undefined;
  const blockers = geometry
    ? buildOriginalBlockers(table, geometry, { timer: components.timer })
    : undefined;
  /** `table_unlimited_balls` and `TableG->ReflexShotScore`, which no other option carries. */
  const feedTable = { unlimitedBalls: true, reflexShotScore: 0 };
  /**
   * Where a released ball is put. The sinks are real; the TABLE under them is a stand-in, because what
   * is under test is which hole gives the ball back, not the physics of the ball it hands over.
   */
  const born: { x: number; y: number }[] = [];
  const sinks = o.wormHole
    ? buildOriginalSinks(table, {
      table: {
        tiltLocked: false,
        collisionCompOffset: 0.25,
        drainCollision: () => {},
        ballCountInRect: () => 0,
        addBall: (at) => { born.push({ x: at.x, y: at.y }); return { collisionDisabled: false, throwBall: () => {} }; },
      },
      timer: components.timer,
    })
    : undefined;
  const score = createScoreState();
  const shown: string[] = [];
  const sounds: string[] = [];
  const context: ControlContext = {
    score,
    table: { extraBalls: 0, multiballCount: 1, multiballFlag: false, ballCount: 3, tiltLocked: false },
    light: (name) => components.lights.get(name),
    group: () => undefined,
    showInfo: (text) => shown.push(text),
    showMission: (text) => shown.push(text),
    playSound: (name) => sounds.push(name),
    playMusic: () => {},
    missionControl: () => {},
  };
  const dispatch = createOriginalDispatch({
    components, context, popupTargets, ...(gates ? { gates } : {}), ...(kickouts ? { kickouts } : {}),
    ...(o.easy ? { isEasyMode: () => true } : {}),
    ...(o.feed && blockers ? { feed: { table: feedTable, blockers } } : {}),
    ...(sinks ? { sinks } : {}),
    ...(o.drain ? { drain: {
      table: drainTable,
      onOutcome: (outcome: string, over: boolean) => outcomes.push(over ? `${outcome}:over` : outcome),
    } } : {}),
    textFor: (id, params) => (params ? `text:${id}:${JSON.stringify(params)}` : `text:${id}`),
  });
  return {
    components, score, shown, sounds, dispatch, context, geometry, gates, kickouts,
    drainTable, outcomes, poppedUp, blockers, feedTable, sinks, born,
  };
}

/** A ball as a hole meets it: captured, then thrown when the hole's timer runs out. */
const heldBall = (thrown: number[]) => ({
  position: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 1 }, speed: 10,
  collisionDisabled: false, component: null as unknown,
  memory: { record: () => {} },
  throwBall: (_d: unknown, _a: number, speed: number) => thrown.push(speed),
});

describe('a lane crossing reaches the 1995 control function', () => {
  test('the inventory of what runs, which grows deliberately and never quietly', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    expect(w.dispatch.wired.size).toBe(56);
    expect(w.dispatch.wired.has('a_roll3')).toBe(true);
    expect(w.dispatch.wired.has('a_roll9')).toBe(true);
    // ⚠️ THE EXAMPLE OF SOMETHING DECLINED KEEPS MOVING, and that is the point of keeping one: it was
    // `a_bump1`, then `a_targ13`, then `a_flag1`, and all three run now. `v_sink1` is the current one
    // — `WormHoleControl` needs `TSink` components, which this build does not construct.
    expect(w.dispatch.wired.has('v_sink1')).toBe(false);
  });

  test('⚠️ and the two lamp controls with NO EVENT SOURCE are declined, not faked', () => {
    // `ExtraBallLightControl` answers a light's timer expiring and `LaunchRampHoleControl` answers a
    // released ball. This build produces neither, so wiring them would make objects nothing can drive
    // — the exact defect this port has spent its history removing. Their bindings are transcribed and
    // the dispatcher declines them, which is the difference between a gap and a lie.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    expect(w.dispatch.wired.has('lite17')).toBe(false);
    expect(w.dispatch.wired.has('ramp_hole')).toBe(false);
  });

  test('⚠️ the space warp lights the RETURN lanes and scores nothing of its own', () => {
    // One rule spread across two components: the shot is worth something only when the ball later comes
    // down a return lane, and the lamp is the only thing joining them. A control that scored here would
    // pay twice for one shot.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    w.dispatch.hit('a_roll9');

    expect(w.components.lights.get('lite27')!.on).toBe(true);
    expect(w.components.lights.get('lite28')!.on).toBe(true);
  });

  test('⚠️ and its lamps are given IN ORDER, which a set of names cannot carry', () => {
    // `CONTROL_REACHES` is a set: it says lite27 and lite28 are reached and cannot say which is first.
    // `makeSpaceWarpRolloverControl` would accept them reversed without complaint, so the order lives
    // in `LAMP_BINDINGS` and this is what holds it.
    const binding = LAMP_BINDINGS.find((b) => b.control === 'SpaceWarpRolloverControl')!;

    expect(binding.lamps).toEqual(['lite27', 'lite28']);
  });

  test('⚠️ crossing a lane LIGHTS ITS OWN LAMP, which is the binding doing its job', () => {
    // `roll3` lights `lite8` and nothing else. A dispatcher that looked the component up by the control
    // layer's name would score correctly and light nothing — the failure that looks like a lamp bug.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    w.dispatch.hit('a_roll3');

    expect(w.components.lights.get('lite8')!.on).toBe(true);
    expect(w.components.lights.get('lite9')!.on).toBe(false);
  });

  test('and it scores from the 1995 array', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    w.dispatch.hit('a_roll3');

    expect(w.score.curScore).toBeGreaterThan(0);
  });

  test('⚠️ and crossing ALL THREE raises the bumpers, which is what the lanes are for', () => {
    // The whole mechanic, end to end for the first time: three lanes fill a light group, the completed
    // group sends `TBumperIncBmpIndex` to the bumper group, and every bumper in it gets dearer.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    const before = w.components.bumpers.get('a_bump1')!.level;
    for (const lane of REENTRY_LANES.lanes) w.dispatch.hit(lane.component);

    for (const name of w.components.bumperGroups.get('attack_bumpers')!) {
      expect(w.components.bumpers.get(name)!.level, name).toBe(before + 1);
    }
  });

  test('⚠️ and the lane lamps are DARK ONCE THE FLASH ENDS, or the lanes fill exactly once', () => {
    // The property that matters: after a completion the lanes can be filled again. Checked AFTER the
    // flash rather than during it, because a flashing lamp reads `on === false` whatever its persistent
    // state is — asking immediately would pass over a lamp that is about to come back.
    //
    // ⚠️ AND IT DOES NOT DISTINGUISH `turnOff` FROM `resetGroup`, WHICH I TWICE CLAIMED IT WOULD. A
    // mutation to `resetGroup` survives, and it survives because the claim is false here: `flashWhenOn`
    // is "every lit lamp goes dark with a flash first", so they are already dark before either call
    // runs. Recorded in the module rather than chased.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    for (const lane of REENTRY_LANES.lanes) w.dispatch.hit(lane.component);
    w.components.advance(6);

    for (const lane of REENTRY_LANES.lanes) {
      expect(w.components.lights.get(lane.light)!.on, lane.light).toBe(false);
    }
  });

  test('and completing it says so, in the line the binding names', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    for (const lane of REENTRY_LANES.lanes) w.dispatch.hit(lane.component);

    expect(w.shown.some((t) => t.includes(REENTRY_LANES.completeTextId))).toBe(true);
  });

  test('⚠️ a return lane pays MORE when the space warp lit it, which is the rule spanning two parts', () => {
    // Neither component means anything alone. The warp lights lite27 and lite28 and scores nothing; the
    // return lanes collect at score index ONE instead of zero. Nothing in either function says the
    // other exists, which is exactly why the binding table has to.
    const cold = wired();
    const warm = wired();
    if (!cold || !warm) return expect(existsSync(DAT)).toBe(false);

    cold.dispatch.hit('a_roll6');
    warm.dispatch.hit('a_roll9');
    const afterWarp = warm.score.curScore;
    warm.dispatch.hit('a_roll6');

    expect(warm.score.curScore - afterWarp).toBeGreaterThan(cold.score.curScore);
  });

  test('⚠️ and collecting DARKENS both its own lamp and the shared indicator', () => {
    // `lite59` is the warp indicator and either lane clears it. A lane that darkened only its own lamp
    // would leave the indicator on with nothing left to collect.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    w.dispatch.hit('a_roll9');
    w.components.lights.get('lite59')!.turnOn();
    w.dispatch.hit('a_roll6');

    expect(w.components.lights.get('lite27')!.on).toBe(false);
    expect(w.components.lights.get('lite59')!.on).toBe(false);
    // The other lane's lamp is untouched: it is still there to be collected.
    expect(w.components.lights.get('lite28')!.on).toBe(true);
  });

  test('⚠️ the control matches its caller by IDENTITY, so the wired object must be the given one', () => {
    // `makeReturnLaneControl` looks the caller up with `===` against the components it was handed.
    // Registering a second, equal-looking object would make every crossing fall through to the
    // "not mine" branch, which scores nothing and reads as a dead lane.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    w.dispatch.hit('a_roll7');

    expect(w.score.curScore).toBeGreaterThan(0);
  });

  test('a hit on something not wired is quiet rather than a crash', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    expect(() => w.dispatch.hit('v_sink1')).not.toThrow();
    expect(w.score.curScore).toBe(0);
  });
});

describe('⚠️ the six fuel rollovers, which fill one tank between them', () => {
  test('all six are wired, each to its own level', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    for (const lane of FUEL_ROLLOVERS) expect(w.dispatch.wired.has(lane.component), lane.control).toBe(true);
  });

  test('crossing the first one fills the tank to level one and says so', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const tank = w.components.bargraphs.get('fuel_bargraph')!;

    w.dispatch.hit('a_roll179');

    expect(tank.onCount).toBe(1);
    expect(w.shown).toContain('text:STRING145');
    expect(w.score.curScore).toBeGreaterThan(0);
  });

  test('⚠️ a LOWER rollover on a fuller tank blinks its lamp and does NOT drain it', () => {
    // This is the whole point of the threshold. `onCount` is the LEVEL, and the sixth rollover asks
    // whether it is already past eleven — a question a plain light group would answer with the number
    // of lit lamps, which cannot exceed six. Wired that way every rollover would refill for ever and
    // crossing the first one on a full tank would EMPTY it back to a single segment.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const tank = w.components.bargraphs.get('fuel_bargraph')!;
    w.dispatch.hit('a_roll184'); // fill to the top
    expect(tank.onCount).toBe(11);

    w.dispatch.hit('a_roll179'); // the bottom rollover, on a full tank

    expect(tank.onCount, 'the tank is untouched').toBe(11);
    expect(w.components.lights.get('literoll179')!.timedOff, 'its lamp blinks instead').toBe(true);
  });

  test('and it still scores on the crossing that changed nothing', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    w.dispatch.hit('a_roll184');
    const after = w.score.curScore;

    w.dispatch.hit('a_roll179');

    expect(w.score.curScore).toBeGreaterThan(after);
  });
});

describe('⚠️ the two out lanes, where losing the ball can still pay', () => {
  test('both are wired, and they are the same control with different lamps', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    for (const name of OUT_LANES.components) expect(w.dispatch.wired.has(name), name).toBe(true);
  });

  test('with an extra ball waiting it is BANKED and both lamps go out', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    w.components.lights.get('lite17')!.turnOn();

    w.dispatch.hit('a_roll4');

    expect(w.context.table.extraBalls).toBe(1);
    expect(w.components.lights.get('lite17')!.on).toBe(false);
    expect(w.components.lights.get('lite18')!.on).toBe(false);
    expect(w.sounds).toContain('extraBall');
  });

  test('with neither lamp lit it is a miss, and nothing is banked', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    w.dispatch.hit('a_roll4');

    expect(w.context.table.extraBalls).toBe(0);
    expect(w.sounds).toContain('miss');
  });

  test('⚠️ each lane flashes ITS OWN warp pair, armed by the FIRST lamp of that pair', () => {
    // `roll4 == caller` picks `lite30 + lite196`; anything else picks `lite29 + lite195`. The pair is
    // flashed only when the first of the two is lit, so wiring the pair in the other order would make
    // the lane flash on a condition that belongs to the other side of the table.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    w.components.lights.get('lite30')!.turnOn();

    w.dispatch.hit('a_roll8'); // the OTHER lane: its own guard, `lite29`, is dark
    expect(w.components.lights.get('lite30')!.flashing).toBe(false);

    w.dispatch.hit('a_roll4');
    expect(w.components.lights.get('lite30')!.flashing).toBe(true);
    expect(w.components.lights.get('lite196')!.flashing).toBe(true);
  });
});

describe('⚠️ the bonus lane, which fills the tank whether it pays or not', () => {
  test('with the lamp dark it scores, says the refuel line, and fills the tank', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const tank = w.components.bargraphs.get('fuel_bargraph')!;

    w.dispatch.hit(BONUS_LANE.component);

    expect(w.score.curScore).toBeGreaterThan(0);
    expect(w.shown).toContain('text:STRING145');
    expect(tank.onCount).toBe(11);
  });

  test('⚠️ with the lamp LIT it pays the bonus, darkens the lamp, and STILL fills the tank', () => {
    // The refill is outside the branch in the original. Tucking it into the `else` would make a lit
    // lamp cost the player their fuel — a rule inverted by an indentation.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const tank = w.components.bargraphs.get('fuel_bargraph')!;
    w.components.lights.get('lite16')!.turnOn();
    w.score.bonusScore = 25000;

    w.dispatch.hit(BONUS_LANE.component);

    expect(w.score.curScore).toBeGreaterThanOrEqual(25000);
    expect(w.components.lights.get('lite16')!.on).toBe(false);
    expect(tank.onCount).toBe(11);
    expect(w.sounds).toContain('collect');
    expect(w.shown.some((line) => line.startsWith('text:STRING104'))).toBe(true);
  });
});

describe('⚠️ the spot targets: three lamps, and the set is what pays', () => {
  const fuel = SPOT_TARGET_SETS.find((set) => set.control === 'FuelSpotTargetControl')!;

  test('each target lights its OWN lamp and scores on its own', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    w.dispatch.hit(fuel.targets[0]!);

    expect(w.components.lights.get(fuel.lamps[0]!)!.on).toBe(true);
    expect(w.components.lights.get(fuel.lamps[1]!)!.on).toBe(false);
    expect(w.score.curScore).toBeGreaterThan(0);
    expect(w.sounds).toContain('hit');
  });

  test('⚠️ and the THIRD one fills the tank, which is what the set is worth', () => {
    // Two of three is worth its own score and nothing else. The set completing is a separate event and
    // the only one that pays: a transcription that filled the tank on every hit would make the other
    // two targets pointless and the tank permanently full.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const tank = w.components.bargraphs.get('fuel_bargraph')!;

    w.dispatch.hit(fuel.targets[0]!);
    w.dispatch.hit(fuel.targets[1]!);
    expect(tank.onCount, 'two of three is not a set').toBe(0);

    w.dispatch.hit(fuel.targets[2]!);

    expect(tank.onCount).toBe(11);
    expect(w.sounds).toContain('refuel');
    expect(w.shown).toContain('text:STRING145');
  });

  test('⚠️ hitting the SAME target three times does not complete the set', () => {
    // The set is judged by the GROUP'S lit count, not by a counter of hits. Counting hits would let one
    // target pay for all three, which is the difference between a skill shot and a tap.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const tank = w.components.bargraphs.get('fuel_bargraph')!;

    w.dispatch.hit(fuel.targets[0]!);
    w.dispatch.hit(fuel.targets[0]!);
    w.dispatch.hit(fuel.targets[0]!);

    expect(tank.onCount).toBe(0);
  });

  test('⚠️ the two HAZARD sets are declined without gates, and only those two', () => {
    // Their completion disables a gate, and a build with no gates cannot do it. The mission set has a
    // different shape — its sound comes from a lamp — and it runs anyway, because it was given its own
    // control function rather than an approximation of the shared one.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    for (const set of SPOT_TARGET_SETS) {
      const runs = set.completion.kind !== 'disableGate';
      for (const target of set.targets) {
        expect(w.dispatch.wired.has(target), `${set.control}/${target}`).toBe(runs);
      }
    }
  });
});

describe('⚠️ the two popup banks, where the memory is in the TARGETS', () => {
  test('the multiplier bank raises the multiplier only when all three are struck', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    w.dispatch.hit(MULTIPLIER_BANK.targets[0]!);
    w.dispatch.hit(MULTIPLIER_BANK.targets[1]!);
    expect(w.score.scoreMultiplier, 'two of three is not a bank').toBe(0);

    w.dispatch.hit(MULTIPLIER_BANK.targets[2]!);

    expect(w.score.scoreMultiplier).toBe(1);
    expect(w.shown).toContain('text:STRING157');
  });

  test('⚠️ and the SAME target three times is worth one hit, not a bank', () => {
    // The bank sums the targets' own message fields, so a target already struck this round is not
    // struck again. Counting hits instead would let one target pay for all three.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    w.dispatch.hit(MULTIPLIER_BANK.targets[0]!);
    w.dispatch.hit(MULTIPLIER_BANK.targets[0]!);
    w.dispatch.hit(MULTIPLIER_BANK.targets[0]!);

    expect(w.score.scoreMultiplier).toBe(0);
  });

  test('the medal bank lights one medal per round and says which', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const medals = w.components.lightGroups.get(MEDAL_BANK.lightGroup)!;

    for (const target of MEDAL_BANK.targets) w.dispatch.hit(target);

    expect(medals.onCount).toBe(1);
    expect(w.shown).toContain('text:STRING154');
    // ⚠️ AND NOT THE OTHER BANK'S LAMPS. Reading the group through the binding means the test follows
    // the binding wherever it points — a mutation aiming the medals at `top_target_lights` passed
    // until this line, because both sides of the assertion moved together.
    expect(w.components.lightGroups.get('top_target_lights')!.onCount).toBe(0);
    expect(w.components.lightGroups.get('bumper_target_lights')!.onCount).toBe(1);
  });

  test('⚠️ and the THIRD medal is an extra ball rather than a score', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    for (let round = 0; round < 3; round++) {
      for (const target of MEDAL_BANK.targets) w.dispatch.hit(target);
    }

    expect(w.context.table.extraBalls).toBe(1);
    expect(w.shown).toContain('text:STRING156');
  });
});

describe('⚠️ the booster bank, which walks an award chain one rung per round', () => {
  const fill = (w: NonNullable<ReturnType<typeof wired>>) => {
    for (const target of BOOSTER_BANK.targets) w.dispatch.hit(target);
  };

  test('the first round lights the FLAG lamps and says so', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    fill(w);

    // ⚠️ `lit`, NOT `on`. The award lights its lamps with `TLightTurnOnTimed`: the sixty seconds ARE
    // the award, and the persistent flag is never touched. `light_on()` is what a control asks.
    for (const name of TABLE_ACTIONS.lamps.flagLights) {
      expect(w.components.lights.get(name)!.lit, name).toBe(true);
      expect(w.components.lights.get(name)!.on, name).toBe(false);
    }
    expect(w.shown).toContain('text:STRING152');
    expect(w.sounds).toContain('chain');
  });

  test('⚠️ and the SECOND round grants the next rung, because the award lit its own lamp', () => {
    // The chain is a linear search for the first dark lamp and the awards advance it. Nothing counts
    // rounds — which is why an award expiring puts its rung back, rather than being skipped for ever.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    fill(w);
    fill(w);

    expect(w.score.jackpotScoreFlag).toBe(true);
    expect(w.components.lights.get(TABLE_ACTIONS.lamps.jackpot)!.lit).toBe(true);
    expect(w.shown).toContain('text:STRING116');
  });

  test('⚠️ two missions refuse the first rung, and NOTHING takes its place', () => {
    // `lite198`'s message field carries the running mission. During fifteen and twenty-nine the flag
    // lights are refused — no award, no sound — and the bank still completes and still pays. The
    // player cannot tell they were refused except by the silence.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    w.components.lights.get(BOOSTER_BANK.missionLamp)!.messageField = 15;

    fill(w);

    expect(w.components.lights.get('lite61')!.lit).toBe(false);
    expect(w.sounds).not.toContain('chain');
    expect(w.score.curScore).toBeGreaterThan(0);
  });
});

describe('⚠️ the hazard spot sets, whose reward is a wall that stops being one', () => {
  const left = SPOT_TARGET_SETS.find((set) => set.control === 'LeftHazardSpotTargetControl')!;

  test('given gates, all four spot sets run', () => {
    const w = wired({ gates: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);

    for (const set of SPOT_TARGET_SETS) {
      for (const target of set.targets) {
        expect(w.dispatch.wired.has(target), `${set.control}/${target}`).toBe(true);
      }
    }
  });

  test('⚠️ and completing the set OPENS its gate, which is what the reward is', () => {
    // `TGateDisable` clears the active flag: the chute stops being a wall. Two of the three hits are
    // worth their own score and nothing else — it is the set completing that opens the way through.
    const w = wired({ gates: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const gateName = left.completion.kind === 'disableGate' ? left.completion.gate : '';
    const edges = w.geometry!.edgesOf(gateName);
    expect(edges.length).toBeGreaterThan(0);

    w.dispatch.hit(left.targets[0]!);
    w.dispatch.hit(left.targets[1]!);
    expect(edges.every((edge) => edge.active), 'two of three leaves the wall standing').toBe(true);

    w.dispatch.hit(left.targets[2]!);

    expect(edges.some((edge) => edge.active)).toBe(false);
  });

  test('⚠️ and each set opens ITS OWN gate, which needs BOTH sets to say so', () => {
    // Completing one set and checking the other gate is still shut is not enough: pointing the right
    // set at `v_gate1` as well passes that, because the left set is the only one ever completed. The
    // mutation survived until this test finished both.
    const w = wired({ gates: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const right = SPOT_TARGET_SETS.find((set) => set.control === 'RightHazardSpotTargetControl')!;

    for (const target of left.targets) w.dispatch.hit(target);
    expect(w.geometry!.edgesOf('v_gate1').some((edge) => edge.active)).toBe(false);
    expect(w.geometry!.edgesOf('v_gate2').every((edge) => edge.active)).toBe(true);

    for (const target of right.targets) w.dispatch.hit(target);

    expect(w.geometry!.edgesOf('v_gate2').some((edge) => edge.active)).toBe(false);
  });

  test('the mask lamp records which of the three were struck, as BITS', () => {
    // `lite104->MessageField |= 1u`, `|= 2u`, `|= 4u` — a second memory of the same hit, with a
    // different lifetime, which nothing in the control ever clears. The missions read it.
    const w = wired({ gates: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);

    w.dispatch.hit(left.targets[0]!);
    w.dispatch.hit(left.targets[2]!);

    expect(w.components.lights.get(left.maskLamp!)!.messageField).toBe(1 | 4);
  });
});

describe('⚠️ the bumpers and rebounders, which score from their OWN table', () => {
  const bumpers = SCORE_COMPONENTS.filter((row) => row.controlName === 'BumperControl');

  test('all seven bumpers are wired, and a fresh one pays its first score', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    expect(bumpers).toHaveLength(7);

    for (const row of bumpers) expect(w.dispatch.wired.has(row.tag), row.tag).toBe(true);

    w.dispatch.hit('a_bump1');
    expect(w.score.curScore).toBe(500);
  });

  test('⚠️ and the LANES make it worth more, because the level is the score INDEX', () => {
    // `BumperControl` is one line: `AddScore(get_scoring(BmpIndex))`. There is no conditional — the
    // bumper's level indexes its own four-entry table, and nothing in the control advances it. The
    // lanes do. A port that paid a fixed price would lose the whole point of working the lanes.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    w.components.raiseGroup('attack_bumpers');
    w.dispatch.hit('a_bump1');

    expect(w.score.curScore).toBe(1000);
  });

  test('⚠️ and the two bumper groups have different prices, which the archive decides', () => {
    // `attack_bumpers` pays 500 at level zero and `launch_bumpers` 1500. The tables come from
    // `score-table`, one row per component, so a shared table would have made the ramp bumpers cheap.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    w.dispatch.hit('a_bump5');

    expect(w.score.curScore).toBe(1500);
  });

  test('the plain rebounders pay a flat five hundred', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    w.dispatch.hit('v_rebo3');
    w.dispatch.hit('v_rebo4');

    expect(w.score.curScore).toBe(1000);
  });

  test('⚠️ and the FLIPPER rebounders blink a lamp, which is the only reason they are not plain', () => {
    // A tenth of a second on `lite84` and `lite85` — the flash under the flipper that says the ball
    // caught its shoulder. Wiring them as plain rebounders would score identically and look like
    // nothing happened.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    w.dispatch.hit('v_rebo1');

    expect(w.components.lights.get('lite84')!.lit).toBe(true);
    expect(w.components.lights.get('lite85')!.lit).toBe(false);

    w.dispatch.hit('v_rebo2');
    expect(w.components.lights.get('lite85')!.lit).toBe(true);
  });
});

describe('⚠️ the gate lamps, which no collision reaches', () => {
  const left = GATE_LAMPS.find((binding) => binding.gate === 'v_gate1')!;

  test('completing the hazard set opens the chute AND lights its lamps', () => {
    // The reward is a wall that stops being one, and these two lamps are the only place the player is
    // told. Without them the chute opens and it looks exactly like the shot missing.
    const w = wired({ gates: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const set = SPOT_TARGET_SETS.find((s2) => s2.control === 'LeftHazardSpotTargetControl')!;

    for (const target of set.targets) w.dispatch.hit(target);

    // ⚠️ NAMED LITERALLY, not read through the binding. Reading `left.lamps` for both the action and
    // the assertion is a test that follows the binding wherever it points: a mutation aiming the left
    // gate at the right chute's lamps passed, because both sides moved together. Twice before in this
    // file, in the medal group and in the hazard gates.
    expect(w.components.lights.get('lite30')!.lit).toBe(true);
    expect(w.components.lights.get('lite196')!.lit).toBe(true);
    // And the RIGHT chute is untouched: its gate did not open.
    expect(w.components.lights.get('lite29')!.lit).toBe(false);
    expect(w.components.lights.get('lite195')!.lit).toBe(false);
  });

  test('⚠️ and five seconds later ONE of them is still lit', () => {
    // `lite30` flashes and stays LIT — the standing announcement that the outlane is survivable.
    // `lite196` flashes and returns to dark. Both staying lit would leave a lamp that never goes out,
    // and a lamp that never goes out stops meaning anything.
    const w = wired({ gates: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const set = SPOT_TARGET_SETS.find((s2) => s2.control === 'LeftHazardSpotTargetControl')!;
    for (const target of set.targets) w.dispatch.hit(target);

    w.components.advance(6);

    expect(w.components.lights.get(left.lamps[0]!)!.lit, left.lamps[0]).toBe(true);
    expect(w.components.lights.get(left.lamps[1]!)!.lit, left.lamps[1]).toBe(false);
  });

  test('and shutting the gate darkens both', () => {
    const w = wired({ gates: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const set = SPOT_TARGET_SETS.find((s2) => s2.control === 'LeftHazardSpotTargetControl')!;
    for (const target of set.targets) w.dispatch.hit(target);

    // `LeftKickerControl` does this on its timer; nothing wires that yet, so the gate is shut here.
    w.gates!.get('v_gate1')!.shutGate();

    for (const name of left.lamps) expect(w.components.lights.get(name)!.lit, name).toBe(false);
  });

  test('⚠️ and none of this is in `wired`, because no collision reaches it', () => {
    const w = wired({ gates: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);

    expect(w.dispatch.wired.has('v_gate1')).toBe(false);
  });
});

describe('⚠️ the kickback shuts the chute again, which is the other half of the reward', () => {
  const openLeftChute = (w: NonNullable<ReturnType<typeof wired>>) => {
    const set = SPOT_TARGET_SETS.find((s2) => s2.control === 'LeftHazardSpotTargetControl')!;
    for (const target of set.targets) w.dispatch.hit(target);
  };
  /** A ball rolling gently into a surface whose normal points up. */
  const ball = () => ({ position: { x: 0, y: 0 }, direction: { x: 0, y: -1 }, speed: 1 });

  test('both kickbacks are built from the archive', () => {
    const w = wired({ gates: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);

    for (const binding of KICKERS) {
      expect(w.components.kickbacks.get(binding.component), binding.component).toBeDefined();
    }
  });

  test('⚠️ the saver fires, the ball goes, and the chute closes behind it', () => {
    // The whole loop, end to end: three targets open the gate and light the lamps; the ball reaches
    // the kickback; seven tenths of a second later the threshold drops and the next touch throws it
    // out; a tenth of a second after THAT the expiry reaches `LeftKickerControl` and the wall is back.
    const w = wired({ gates: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const kickback = w.components.kickbacks.get('a_kick1')!;
    openLeftChute(w);
    expect(w.gates!.get('v_gate1')!.open).toBe(true);

    kickback.collision(ball(), { x: 0, y: 0 }, { x: 0, y: 1 }, 0, null);
    w.components.advance(0.8); // the saver fires
    const thrown = ball();
    kickback.collision(thrown, { x: 0, y: 0 }, { x: 0, y: 1 }, 0, null);
    expect(thrown.speed, 'the ball is thrown out, not bounced').toBeGreaterThan(50);
    w.components.advance(0.2); // and the expiry reaches the control

    expect(w.gates!.get('v_gate1')!.open).toBe(false);
    expect(w.components.lights.get('lite30')!.lit, 'and the lamps go with it').toBe(false);
    expect(w.components.lights.get('lite196')!.lit).toBe(false);
  });

  test('⚠️ and in EASY MODE the chute stays open, which is the option doing its work', () => {
    // `if (!easyMode)` is the whole difference. The outlane stays survivable for the rest of the ball
    // without one piece of geometry moving.
    const w = wired({ gates: true, easy: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const kickback = w.components.kickbacks.get('a_kick1')!;
    openLeftChute(w);

    kickback.collision(ball(), { x: 0, y: 0 }, { x: 0, y: 1 }, 0, null);
    w.components.advance(0.8);
    kickback.collision(ball(), { x: 0, y: 0 }, { x: 0, y: 1 }, 0, null);
    w.components.advance(0.2);

    expect(w.gates!.get('v_gate1')!.open).toBe(true);
  });
});

describe('⚠️ the skill shot, which pays most for the THIRD lamp', () => {
  const arm = (w: NonNullable<ReturnType<typeof wired>>) => {
    w.components.lights.get(SKILL_SHOT.entry.firstLamp)!.turnOn();
  };

  test('all eight components run: one entry, five gates and two ways out', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    expect(w.dispatch.wired.has(SKILL_SHOT.entry.component)).toBe(true);
    for (const gate of SKILL_SHOT.gates) expect(w.dispatch.wired.has(gate.component), gate.component).toBe(true);
    expect(w.dispatch.wired.has(SKILL_SHOT.collect.component)).toBe(true);
    expect(w.dispatch.wired.has(SKILL_SHOT.lost.component)).toBe(true);
  });

  test('⚠️ the entry ALWAYS arms the ball save, even with the run shut', () => {
    // Two unrelated things at one gate: a five-second save that happens whatever, and — only if the
    // run was already open — starting it over. Folding the save into the condition would take away a
    // reprieve the player gets every single time down that chute.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    w.dispatch.hit(SKILL_SHOT.entry.component);

    expect(w.components.lights.get('lite200')!.lit).toBe(true);
    expect(w.components.lights.get('lite68')!.lit, 'and nothing else happened').toBe(false);
  });

  test('with the run open, the entry restarts it and fills the tank', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const tank = w.components.bargraphs.get('fuel_bargraph')!;
    arm(w);
    w.components.lights.get('lite68')!.turnOn();

    w.dispatch.hit(SKILL_SHOT.entry.component);

    expect(w.components.lights.get('lite67')!.lit, 'back to exactly one lamp').toBe(true);
    expect(w.components.lights.get('lite68')!.lit).toBe(false);
    expect(tank.onCount).toBe(11);
  });

  test('⚠️ the five later gates do NOTHING with the run shut', () => {
    // `lite67` is what "the run is open" means, and every one of them tests it. Without that a ball
    // wandering over a tripwire would light the set for free.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    for (const gate of SKILL_SHOT.gates) w.dispatch.hit(gate.component);

    expect(w.components.lightGroups.get('skill_shot_lights')!.onCount).toBe(0);
  });

  test('⚠️ and the payout PEAKS at three lamps, then falls', () => {
    // `s_onewy4` carries `15000 30000 75000 30000 15000 7500` indexed by the lit count minus one.
    // Running the whole set is worth a tenth of stopping at three, which inverts the only decision the
    // mechanic asks for — and reading the array as "more is better" would never look wrong.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    arm(w);
    w.dispatch.hit(SKILL_SHOT.gates[0]!.component);
    w.dispatch.hit(SKILL_SHOT.gates[1]!.component);
    expect(w.components.lightGroups.get('skill_shot_lights')!.onCount).toBe(3);

    w.dispatch.hit(SKILL_SHOT.collect.component);

    expect(w.score.curScore).toBe(75000);
    expect(w.shown.some((line) => line.startsWith('text:STRING122'))).toBe(true);
  });

  test('and the whole set is worth a tenth of that', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    arm(w);
    for (const gate of SKILL_SHOT.gates) w.dispatch.hit(gate.component);
    expect(w.components.lightGroups.get('skill_shot_lights')!.onCount).toBe(6);

    w.dispatch.hit(SKILL_SHOT.collect.component);

    expect(w.score.curScore).toBe(7500);
  });

  test('⚠️ the OTHER exit throws the run away and pays nothing', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    arm(w);
    w.dispatch.hit(SKILL_SHOT.gates[0]!.component);

    w.dispatch.hit(SKILL_SHOT.lost.component);

    expect(w.components.lightGroups.get('skill_shot_lights')!.onCount).toBe(0);
    expect(w.score.curScore).toBe(0);
  });
});

describe('⚠️ the mission spot set, whose sound is chosen by a LAMP', () => {
  const set = SPOT_TARGET_SETS.find((s2) => s2.control === 'MissionSpotTargetControl')!;

  test('it lights its own lamp and records the hit as a BIT', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    w.dispatch.hit(set.targets[1]!);

    expect(w.components.lights.get('lite102')!.lit).toBe(true);
    expect(w.components.lights.get(set.maskLamp!)!.messageField).toBe(2);
    expect(w.score.curScore).toBeGreaterThan(0);
  });

  test('⚠️ with NO mission running it sounds different, which is the whole reason it is its own', () => {
    // `lite198` dark means no mission. The shared spot factory plays one sound for a hit and another
    // for the set completing; this one asks a lamp and plays the answer, before it knows whether the
    // set completed.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    w.dispatch.hit(set.targets[0]!);

    expect(w.sounds).toEqual(['noMission']);
  });

  test('and with one running it is the ordinary hit', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    w.components.lights.get('lite198')!.turnOn();

    w.dispatch.hit(set.targets[0]!);

    expect(w.sounds).toEqual(['hit']);
  });

  test('⚠️ but a mission lamp mid-FLASH counts as no mission', () => {
    // `!light_on() || FlasherOnFlag`. The flash is how the game says a mission is ending, and the set
    // follows the lamp rather than the state — so `!lit` alone would keep playing the running sound
    // through the whole of that flash.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    w.components.lights.get('lite198')!.turnOn();
    w.components.lights.get('lite198')!.flasherStart();

    w.dispatch.hit(set.targets[0]!);

    expect(w.sounds).toEqual(['noMission']);
  });

  test('⚠️ and completing the set is SILENT, unlike every other spot set', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    w.components.lights.get('lite198')!.turnOn();

    for (const target of set.targets) w.dispatch.hit(target);

    expect(w.sounds).toEqual(['hit', 'hit', 'hit']);
  });
});

describe('⚠️ the bumper groups decay, which is what the lanes are working against', () => {
  test('sixty seconds after a lane raised them, the group takes one level back', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    // The chain: three lanes complete, the group goes up, and the sixty seconds start.
    for (const lane of REENTRY_LANES.lanes) w.dispatch.hit(lane.component);
    const members = w.components.bumperGroups.get(REENTRY_LANES.bumperGroup)!;
    for (const name of members) expect(w.components.bumpers.get(name)!.level, name).toBe(1);

    w.components.advance(59);
    for (const name of members) expect(w.components.bumpers.get(name)!.level, name).toBe(1);

    w.components.advance(2);

    for (const name of members) expect(w.components.bumpers.get(name)!.level, name).toBe(0);
  });

  test('⚠️ and it RESTARTS itself, so the level keeps falling rather than falling once', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const members = w.components.bumperGroups.get(REENTRY_LANES.bumperGroup)!;
    for (const lane of REENTRY_LANES.lanes) w.dispatch.hit(lane.component);
    // ⚠️ THE COMPLETED SET FLASHES FOR FIVE SECONDS, and `makeBumperLaneControl` skips a lamp that is
    // flashing entirely — so the chain cannot be refilled until it stops. Filling it twice in the same
    // instant completes it ONCE, which is the table's own answer to a ball that crosses all three in
    // one pass.
    w.components.advance(6);
    for (const lane of REENTRY_LANES.lanes) w.dispatch.hit(lane.component);
    for (const name of members) expect(w.components.bumpers.get(name)!.level, name).toBe(2);

    w.components.advance(61);
    for (const name of members) expect(w.components.bumpers.get(name)!.level, name).toBe(1);
    w.components.advance(61);

    for (const name of members) expect(w.components.bumpers.get(name)!.level, name).toBe(0);
  });

  test('⚠️ a group already at the bottom stays there rather than going negative', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const members = w.components.bumperGroups.get(REENTRY_LANES.bumperGroup)!;
    for (const lane of REENTRY_LANES.lanes) w.dispatch.hit(lane.component);

    w.components.advance(400);

    for (const name of members) expect(w.components.bumpers.get(name)!.level, name).toBe(0);
  });

  test('⚠️ and filling the lanes again puts the sixty seconds back to the start', () => {
    // This is the whole shape of the mechanic: the level is held by working the lanes, not won once.
    // Without the restart the decay would arrive on its original schedule no matter what the player
    // did, and the lanes would be worth exactly one level each for ever.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const members = w.components.bumperGroups.get(REENTRY_LANES.bumperGroup)!;
    for (const lane of REENTRY_LANES.lanes) w.dispatch.hit(lane.component);

    w.components.advance(50); // past the five-second flash, and well short of the sixty
    for (const lane of REENTRY_LANES.lanes) w.dispatch.hit(lane.component); // level 2, clock restarted
    w.components.advance(50);

    // Fifty more seconds have passed — a hundred in all — and nothing has decayed yet.
    for (const name of members) expect(w.components.bumpers.get(name)!.level, name).toBe(2);
  });

  test('and the OTHER group is untouched by any of it', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    for (const lane of REENTRY_LANES.lanes) w.dispatch.hit(lane.component);

    w.components.advance(61);

    for (const name of w.components.bumperGroups.get('launch_bumpers')!) {
      expect(w.components.bumpers.get(name)!.level, name).toBe(0);
    }
  });
});

describe('⚠️ the multiplier falls again too, and so do the medals', () => {
  const fillMultiplier = (w: NonNullable<ReturnType<typeof wired>>) => {
    for (const target of MULTIPLIER_BANK.targets) w.dispatch.hit(target);
  };

  test('thirty seconds after the bank is filled, the multiplier steps back down', () => {
    // `MultiplierLightGroupControl` on its notify timer: one lamp out, one step off the multiplier,
    // and the clock restarted. Without it a multiplier won once was a multiplier held for ever — the
    // same one-way ratchet the bumper levels had.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    fillMultiplier(w);
    expect(w.score.scoreMultiplier).toBe(1);

    w.components.advance(29);
    expect(w.score.scoreMultiplier).toBe(1);

    w.components.advance(2);

    expect(w.score.scoreMultiplier).toBe(0);
    expect(w.components.lightGroups.get('top_target_lights')!.onCount).toBe(0);
  });

  test('⚠️ and the clock only stops when the last lamp is out', () => {
    // `if (o.group.onCount) restartNotifyTimer(period)` — the group stops asking once it is dark, and
    // a timer that kept running would take the multiplier below zero on a table with no lamps lit.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    fillMultiplier(w);

    w.components.advance(300);

    expect(w.score.scoreMultiplier).toBe(0);
  });

  test('the medals decay on their own thirty seconds', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    for (const target of MEDAL_BANK.targets) w.dispatch.hit(target);
    expect(w.components.lightGroups.get('bumper_target_lights')!.onCount).toBe(1);

    w.components.advance(31);

    expect(w.components.lightGroups.get('bumper_target_lights')!.onCount).toBe(0);
  });

  test('⚠️ and a medal decaying does NOT touch the score multiplier', () => {
    // One line is the whole difference between the two controls, and it belongs to the multiplier.
    //
    // ⚠️ THE MULTIPLIER BANK IS NOT FILLED HERE, ON PURPOSE. Filling both and advancing past thirty
    // seconds runs BOTH clocks, so the multiplier would fall for its own reason and the test would
    // pass whichever control the medals were given — which is exactly what the first version did.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    w.score.scoreMultiplier = 2;
    for (const target of MEDAL_BANK.targets) w.dispatch.hit(target);

    w.components.advance(31);

    expect(w.components.lightGroups.get('bumper_target_lights')!.onCount, 'the medal did decay').toBe(0);
    expect(w.score.scoreMultiplier, 'and took nothing with it').toBe(2);
  });
});

describe('⚠️ an award with a clock ends when the clock does, not when the lamp goes dark', () => {
  const grantBonus = (w: NonNullable<ReturnType<typeof wired>>) => {
    // The booster chain's third rung is `table_set_bonus`, which arms the flag and lights `lite59`
    // for sixty seconds. Two rungs are already granted so the third is the one this completion wins.
    w.components.lights.get('lite61')!.turnOn();
    w.components.lights.get('lite60')!.turnOn();
    for (const target of BOOSTER_BANK.targets) w.dispatch.hit(target);
  };

  test('the bonus flag is armed by the award and CLEARED when the lamp times out', () => {
    // Without `BonusLightControl` the lamp goes dark and the flag stays set, so every score for the
    // rest of the ball keeps piling into a bonus the player has no reason to think is still running.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    grantBonus(w);
    expect(w.score.bonusScoreFlag).toBe(true);
    expect(w.components.lights.get('lite59')!.lit).toBe(true);

    w.components.advance(61);

    expect(w.components.lights.get('lite59')!.lit, 'the lamp is out').toBe(false);
    expect(w.score.bonusScoreFlag, 'and so is the flag').toBe(false);
  });

  test('⚠️ and it holds for the whole sixty seconds, not a moment less', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    grantBonus(w);

    w.components.advance(59);

    expect(w.score.bonusScoreFlag).toBe(true);
  });

  test('the jackpot lamp clears its OWN flag and not the other one', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    // Only the flag-lights rung is granted, so this completion wins the jackpot.
    w.components.lights.get('lite61')!.turnOn();
    for (const target of BOOSTER_BANK.targets) w.dispatch.hit(target);
    expect(w.score.jackpotScoreFlag).toBe(true);
    w.score.bonusScoreFlag = true;

    w.components.advance(61);

    expect(w.score.jackpotScoreFlag).toBe(false);
    expect(w.score.bonusScoreFlag, 'the other flag is not this lamp’s business').toBe(true);
  });

  test('⚠️ the shoot-again lamp flashes ONCE more and then lets go', () => {
    // A latch against its own fade: the first expiry starts a five-second flash and records that it
    // did; the second expiry finds the record and clears it instead of flashing again. Without the
    // latch the lamp re-flashes for ever, five seconds at a time.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    w.dispatch.hit(SKILL_SHOT.entry.component); // lights lite200 for five seconds
    const lamp = w.components.lights.get('lite200')!;

    w.components.advance(6);
    expect(lamp.flashing, 'the fade turns into a flash').toBe(true);
    expect(lamp.messageField).toBe(1);

    w.components.advance(6);

    expect(lamp.flashing).toBe(false);
    expect(lamp.messageField, 'the latch is let go').toBe(0);
  });
});

describe('⚠️ the ramp pays four ways, and only one of them is points', () => {
  test('with no lamp lit it is the ordinary five thousand', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    w.dispatch.hit(LAUNCH_RAMP.component);

    expect(w.score.curScore).toBe(5000);
    expect(w.sounds).toEqual(['plain']);
  });

  test('⚠️ and a LIT lamp REPLACES that score rather than adding to it', () => {
    // The ordinary score lives in the `else`. Paying it first and then the award would make every
    // ramp award worth five thousand more than the table intends — and would look like generosity.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    w.components.lights.get(LAUNCH_RAMP.rampLamp)!.turnOn();

    w.dispatch.hit(LAUNCH_RAMP.component);

    expect(w.score.curScore).toBe(0);
    expect(w.sounds).toEqual(['rampAward']);
  });

  test('the reflex lamp is the only one that pays, and it says how much', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    w.components.lights.get(LAUNCH_RAMP.reflexLamp)!.turnOn();

    w.dispatch.hit(LAUNCH_RAMP.component);

    expect(w.score.curScore).toBe(25000);
    expect(w.shown.some((line) => line.startsWith('text:STRING111'))).toBe(true);
    expect(w.sounds).toEqual(['reflexOnly']);
  });

  test('⚠️ and the mission lamp outranks the other two, whichever else is lit', () => {
    // The three lamps are read as bits 1, 2 and 4, and the branch is on the whole number: anything
    // above three is the mission sound. So `lite56` decides on its own.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    w.components.lights.get(LAUNCH_RAMP.reflexLamp)!.turnOn();
    w.components.lights.get(LAUNCH_RAMP.missionLamp)!.turnOn();

    w.dispatch.hit(LAUNCH_RAMP.component);

    expect(w.sounds).toEqual(['mission']);
  });
});

describe('⚠️ the flags, whose score index IS a lamp', () => {
  test('dark, a flag is worth five hundred', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    w.dispatch.hit(FLAGS.components[0]!);

    expect(w.score.curScore).toBe(500);
  });

  test('⚠️ and lit by the booster bank at the far end of the table, five times that', () => {
    // `get_scoring(lite20->light_on())` — the boolean is the index, with no conditional anywhere. And
    // `lite20` is one of the three lamps `table_set_flag_lights` lights for sixty seconds, which is
    // the booster bank's first rung. Two mechanics, one lamp.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    for (const target of BOOSTER_BANK.targets) w.dispatch.hit(target);
    expect(w.components.lights.get(FLAGS.lamp)!.lit, 'the booster lit it').toBe(true);
    const afterBank = w.score.curScore;

    w.dispatch.hit(FLAGS.components[1]!);

    expect(w.score.curScore - afterBank).toBe(2500);
  });

  test('and sixty seconds later it is worth five hundred again', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    for (const target of BOOSTER_BANK.targets) w.dispatch.hit(target);
    w.components.advance(61);
    const afterBank = w.score.curScore;

    w.dispatch.hit(FLAGS.components[0]!);

    expect(w.score.curScore - afterBank).toBe(500);
  });
});

describe('⚠️ the holes that can let go, and the one that cannot', () => {
  /** A ball object shaped the way a kickout uses one. */
  test('the black hole scores, says what it paid, and schedules its own release', () => {
    // Binding the control is what makes a hole safe to stand in: without it the ball never comes back.
    const w = wired({ gates: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const kickout = w.kickouts!.get('a_kout3')!;
    const thrown: number[] = [];

    kickout.collision(heldBall(thrown), { x: 0, y: 0 }, { x: 0, y: 1 }, 0, null);

    expect(w.score.curScore).toBeGreaterThan(0);
    expect(w.shown.some((line) => line.startsWith('text:STRING181'))).toBe(true);

    w.components.advance(2);

    expect(kickout.captured, 'and the ball came back').toBe(false);
    expect(thrown).toHaveLength(1);
  });

  test('⚠️ the gravity well switches ITSELF off as it pays, and starts off anyway', () => {
    // It is a `Kickout2`: dormant until a mission arms it, and dormant again the moment it pays. So a
    // ball can only ever fall in during the window a mission opened.
    const w = wired({ gates: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const kickout = w.kickouts!.get('a_kout1')!;
    expect(kickout.active, 'dormant to begin with').toBe(false);
    kickout.active = true;
    const thrown: number[] = [];

    kickout.collision(heldBall(thrown), { x: 0, y: 0 }, { x: 0, y: 1 }, 0, null);

    expect(kickout.active, 'and off again as it takes the ball').toBe(false);
    expect(w.components.lights.get('lite62')!.lit).toBe(false);
    expect(w.shown.some((line) => line.startsWith('text:STRING182'))).toBe(true);

    w.components.advance(1);
    expect(thrown).toHaveLength(1);
  });

  test('⚠️ and the hyperspace hole IS bound now, which it was not for most of this port', () => {
    // It was the last hole with no control, and a hole with no control keeps whatever it swallows.
    // `HyperspaceKickOutControl` needed the ladder, the barrier and the gravity well's arming, and all
    // three exist — so all three holes can now be given the ball.
    const w = wired({ gates: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);

    for (const name of ['a_kout1', 'a_kout2', 'a_kout3']) {
      expect(w.kickouts!.get(name)!.control, name).not.toBe(null);
    }
  });
});

describe('⚠️ the end of a ball, which is the only thing that can end a game', () => {
  test('a ball reaching the drain is LOST, and the count falls', () => {
    const w = wired({ drain: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);

    w.dispatch.hit(DRAIN.component);

    expect(w.drainTable.ballCount).toBe(2);
    expect(w.outcomes).toEqual(['ballLost']);
  });

  test('⚠️ but a shoot-again the player is HOLDING gives it back for nothing', () => {
    // The first of the drain's four questions. `lite200` lit means the ball comes back and the count
    // does not move — and the lamp stays lit, because it is relit as it is spent.
    const w = wired({ drain: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    w.components.lights.get(DRAIN.shootAgainLamp)!.turnOn();

    w.dispatch.hit(DRAIN.component);

    expect(w.drainTable.ballCount, 'nothing was spent').toBe(3);
    expect(w.outcomes).toEqual(['shootAgain']);
  });

  test('⚠️ the reset list sweeps what it names and leaves the rest', () => {
    // ⚠️ NOT THE SPARE, and not because it survives: a lit spare is spent by the cascade's SECOND
    // question and the ball is never lost, so the reset list never runs at all. The first version of
    // this test lit it and then asserted about a sweep that had not happened.
    const w = wired({ drain: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    w.components.lights.get('lite16')!.turnOn();

    w.dispatch.hit(DRAIN.component);

    expect(w.outcomes).toEqual(['ballLost']);
    expect(w.components.lights.get('lite16')!.lit, 'swept').toBe(false);
  });

  test('⚠️ and BONUS HOLD spends its lamp to save the accumulator, not the other way round', () => {
    // `lite58` is not in the reset list, and that is not what saves it — the cascade's tail turns it
    // OFF and keeps `bonusScore` instead. What the lamp buys is the number, and it buys it once.
    const w = wired({ drain: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    w.components.lights.get(DRAIN.bonusHoldLamp)!.turnOn();
    w.score.bonusScore = 175000;

    w.dispatch.hit(DRAIN.component);

    expect(w.components.lights.get(DRAIN.bonusHoldLamp)!.lit, 'the lamp is spent').toBe(false);
    expect(w.score.bonusScore, 'and the accumulator is kept').toBe(175000);
  });

  test('and without it the accumulator goes back to the base', () => {
    const w = wired({ drain: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    w.score.bonusScore = 175000;

    w.dispatch.hit(DRAIN.component);

    expect(w.score.bonusScore).toBe(BASE_BONUS);
  });

  test('⚠️ and the fuel tank is emptied, which the light-group loop cannot reach', () => {
    // `fuel_bargraph` is in the reset list but it is not a light group, so the loop over groups finds
    // nothing for it. The original sends it both messages; here that is a negative split index.
    const w = wired({ drain: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const tank = w.components.bargraphs.get('fuel_bargraph')!;
    tank.toggleSplitIndex(11);

    w.dispatch.hit(DRAIN.component);

    expect(tank.onCount).toBe(0);
  });

  test('the last ball of the last player ends the game', () => {
    const w = wired({ drain: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    w.drainTable.ballCount = 1;

    w.dispatch.hit(DRAIN.component);

    expect(w.outcomes).toEqual(['ballLost:over']);
  });

  test('and the drain is DECLINED when no ball count is given', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    expect(w.dispatch.wired.has(DRAIN.component)).toBe(false);
  });

  test('⚠️ the reset list is the archive’s own names, all of them present', () => {
    // Forty lines of `BallDrainControl` transcribed. A name that does not exist in the file would
    // reset nothing and say nothing — which is how a reset list rots.
    const w = wired({ gates: true, drain: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);

    for (const name of PER_BALL_RESET.lamps) {
      expect(w.components.lights.get(name), name).toBeDefined();
    }
    for (const name of PER_BALL_RESET.groups) {
      const known = w.components.lightGroups.has(name) || w.components.bargraphs.has(name);
      expect(known, name).toBe(true);
    }
    for (const name of PER_BALL_RESET.animationsStopped) {
      expect(w.components.lightGroups.has(name), name).toBe(true);
    }
    for (const name of PER_BALL_RESET.bumperGroups) {
      expect(w.components.bumperGroups.has(name), name).toBe(true);
    }
    for (const name of PER_BALL_RESET.gates) {
      expect(w.gates!.has(name), name).toBe(true);
    }
  });
});

describe('⚠️ the mission machine, and the state the table sits in before a ball is in play', () => {
  /** The context the machine needs, which is the control one plus four things only it uses. */
  const missionContext = (w: NonNullable<ReturnType<typeof wired>>, said: string[]) => ({
    ...w.context,
    missionLamp: w.components.lights.get('lite198')!,
    dispatch: (code: string, caller: unknown) =>
      w.dispatch.missions.dispatch(code as never, caller as never, missionContext(w, said) as never),
    missionTextBox: { name: 'mission_text_box', scores: [], control: null },
    showMissionText: (text: string) => said.push(text),
    clearMissionText: () => said.push(''),
  });

  /**
   * ⚠️ ALIEN MENACE IS WON WITHOUT HITTING ANYTHING, which is why it is not a row in `MISSION_TABLE`.
   *
   *     if (bump1 == caller) { if (bump1->BmpIndex) { lite307 off; lite198->MessageField = 20;
   *                                                   MissionControl(ControlMissionComplete); } }
   *
   * It listens for `TBumperSetBmpIndex` — the message a bumper group sends when its LEVEL changes — and
   * its own take-over sets that level back to zero. So the mission is "raise the attack bumpers one
   * level, starting now", and what raises them is filling a lane. Every number here is read from
   * `control.cpp`: the lamp is `lite307`, the line is STRING275 and the mission it hands over to is 20.
   */
  describe('mission 10, Alien Menace', () => {
    test('⚠️ taking over resets the bumper level, so the mission is the NEXT one earned', () => {
      const w = wired({ gates: true, wormHole: true });
      if (!w) return expect(existsSync(DAT)).toBe(false);
      const said: string[] = [];
      const lamp = w.components.lights.get('lite198')!;
      const bump1 = w.components.bumpers.get('a_bump1')!;
      bump1.setLevel(3, 8);
      lamp.messageField = 10;

      w.dispatch.missions.dispatch('ControlMissionComplete', null, missionContext(w, said) as never);

      expect(bump1.level, 'back to zero on take-over').toBe(0);
      expect(said.at(-1), 'and it announces itself').toBe('text:STRING275');
    });

    test('⚠️ FILLING A LANE RAISES THE LEVEL, AND THAT — not a hit — finishes the mission', () => {
      // End to end, because the interesting half is the message nobody was sending. Crossing every
      // lane of a set completes it, the group's level goes up, `TBumper::Message` sends
      // `TBumperSetBmpIndex` with the bumper as caller, and the mission reads `bump1->BmpIndex`.
      // A port that raised the level silently gives a mission that announces itself and can never end.
      const w = wired({ gates: true, wormHole: true });
      if (!w) return expect(existsSync(DAT)).toBe(false);
      const lamp = w.components.lights.get('lite198')!;
      const bump1 = w.components.bumpers.get('a_bump1')!;
      lamp.messageField = ALIEN_MENACE.mission;
      expect(bump1.level, 'the ladder starts at the bottom').toBe(0);

      for (const lane of REENTRY_LANES.lanes) w.dispatch.hit(lane.component);

      expect(bump1.level, 'a full set of lanes is one level').toBe(1);
      // ⚠️ THE LITERAL, NOT `ALIEN_MENACE.nextMission`. Asserting the constant the code reads makes the
      // test move with the table it is supposed to hold still: changing 20 to 1 in `bindings` passed.
      expect(lamp.messageField, 'and the mission hands over to 20').toBe(20);
      expect(ALIEN_MENACE.nextMission, 'which is what the binding says').toBe(20);
    });

    test('⚠️ AN EQUIVALENT MUTANT, RECORDED: the "did the level move" guard cannot fire here', () => {
      // `TBumper::Message` sends `TBumperSetBmpIndex` only inside `if (nextBmp != BmpIndex)`, and this
      // port transcribes that guard. It is unreachable on this table, and I found that out by writing
      // a test that claimed to exercise it and did not: dropping the guard leaves all 140 green.
      //
      // Two reasons, both worth knowing. `BumperLaneControl` has its OWN outer guard —
      // `if (bump1->BmpIndex < 3)` — so a raise is never even attempted at the top of the ladder. And
      // the only other path, the group's sixty-second decay, can only fail to move the level when it
      // is already zero, which the mission reads as "not won" either way.
      //
      // The guard stays because it is the original's, because the decrement leans on it, and because
      // the day something else sets a level it is the thing standing between a mission and a win it
      // did not earn. What cannot be claimed is that a test covers it.
      const w = wired({ gates: true, wormHole: true });
      if (!w) return expect(existsSync(DAT)).toBe(false);
      const bump1 = w.components.bumpers.get('a_bump1')!;

      // The set completes once and then flashes for five seconds, so a second crossing does nothing
      // at all — no raise attempted, no message either way. That is `light->FlasherOnFlag` upstream.
      for (const lane of REENTRY_LANES.lanes) w.dispatch.hit(lane.component);
      const afterFirst = bump1.level;
      for (const lane of REENTRY_LANES.lanes) w.dispatch.hit(lane.component);

      expect(afterFirst).toBe(1);
      expect(bump1.level, 'a flashing set is not a set').toBe(1);
    });
  });

  test('the table starts in mission ZERO, which is a state and not a mission', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    expect(w.dispatch.missions.current).toBe(0);
    expect(w.dispatch.missions.currentName).toBe('WaitingDeployment');
  });

  test('and it says so, until something changes it', () => {
    // -1 seconds is the original's "leave it up". The table announces itself and waits.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const said: string[] = [];

    w.dispatch.missions.dispatch('ControlMissionStarted', null, missionContext(w, said) as never);

    expect(said).toEqual(['text:STRING151']);
  });

  test('⚠️ and crossing a DEPLOYMENT CHUTE moves it on, which nothing else does', () => {
    // The two one-ways at the chute are the same components the skill shot uses for its payout and
    // its loss. Crossing either writes the lamp and re-enters — and the re-entrant call lands on the
    // NEXT mission, not on this one, because the lamp is read every time.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const chute = w.dispatch.wired.has('s_onewy4');
    expect(chute, 'the chute is a wired component').toBe(true);

    w.dispatch.hit('s_onewy4');

    expect(w.dispatch.missions.current, 'on to mission select').toBe(1);
  });

  test('and a bumper does not', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    w.dispatch.hit('a_bump1');

    expect(w.dispatch.missions.current).toBe(0);
  });
});

/** The machine's context, which is the control one plus the four things only a mission uses. */
function missionContextOf(w: NonNullable<ReturnType<typeof wired>>): never {
  const said: string[] = [];
  const context = {
    ...w.context,
    missionLamp: w.components.lights.get('lite198')!,
    dispatch: (code: string, caller: unknown) =>
      w.dispatch.missions.dispatch(code as never, caller as never, context as never),
    missionTextBox: { name: 'mission_text_box', scores: [], control: null },
    showMissionText: (text: string) => said.push(text),
    clearMissionText: () => said.push(''),
  };
  return context as never;
}

describe('⚠️ the eighteen missions that can run without the holes, and the twenty-two with them', () => {
  test('a mission is declined WHOLE when one of its components is missing', () => {
    // `d.components.includes(caller)` — a mission counts hits on its own components, so half a mission
    // would count some of its hits and silently never finish.
    //
    // ⚠️ WITH THE GATES, because the hazard spot sets only run when there are gates to open and their
    // targets are half of the right-hand bank. Asked without them this counts sixteen, and the
    // difference is a configuration rather than a defect.
    const w = wired({ gates: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const tagOf = new Map(SCORE_COMPONENTS.map((row) => [row.name, row.tag]));

    const runnable = MISSION_TABLE.filter((row) =>
      row.components.every((name) => w.dispatch.wired.has(tagOf.get(name) ?? '')));

    expect(runnable).toHaveLength(19);
    expect(MISSION_TABLE).toHaveLength(23);
    // ⚠️ AND THE DISPATCHER AGREES, which is the half that can fail. Reading the table alone counts
    // what COULD run; `missionsRun` is what does, and a mutation wiring a half-resolved mission passed
    // until this line existed.
    //
    // ⚠️ PLUS ONE FOR ALIEN MENACE, which is case 10 of the switch and NOT a row in the table — it has
    // no components to count hits on, because it is won by a bumper LEVEL. So the two numbers stopped
    // being the same number the day it was wired, and the sum is spelled out rather than adjusted.
    expect(w.dispatch.missionsRun.size, 'nineteen rows and one special').toBe(19 + 1);
    expect(w.dispatch.missionsRun.has(ALIEN_MENACE.mission)).toBe(true);
    for (const row of runnable) expect(w.dispatch.missionsRun.has(row.mission), row.name).toBe(true);
    // ⚠️ BUG HUNT USED TO BE THE EXAMPLE HERE and it runs now: `target22` is the wormhole's
    // destination and it is wired. The five still declined need the three sinks and `kickout2`.
    expect(w.dispatch.missionsRun.has(9)).toBe(true);
    expect(w.dispatch.missionsRun.has(22), 'secret red still needs a sink').toBe(false);
  });

  test('⚠️ AND WITH THE HOLES, ALL TWENTY-THREE RUN', () => {
    // The three secret missions and the two Maelstrom parts that were declined all wanted the same
    // thing: a sink they could count hits on. With the wormhole's three wired, one row is left —
    // `MaelstromPartEight`, which needs `kickout2`, the hyperspace hole.
    //
    // ⚠️ AND THE ORDER OF THIS FILE IS PART OF THE ANSWER. A mission's components are looked up in
    // `byName` at the moment the controllers are built, so a component registered after that loop is
    // invisible to it. The wormhole block was written at the end of the factory and the sinks were
    // wired, tested and green while every mission that needed one stayed declined.
    const w = wired({ gates: true, wormHole: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const tagOf = new Map(SCORE_COMPONENTS.map((row) => [row.name, row.tag]));

    expect(w.dispatch.missionsRun.size, 'twenty-three rows and one special').toBe(23 + 1);
    for (const mission of [16, 22, 23, 30, 31]) {
      expect(w.dispatch.missionsRun.has(mission), `mission ${mission}`).toBe(true);
    }
    expect(MISSION_TABLE.filter((row) => !w.dispatch.missionsRun.has(row.mission))).toEqual([]);
    expect(MISSION_TABLE.some((row) => row.mission === ALIEN_MENACE.mission),
      'and it is not one of them').toBe(false);
    // ⚠️ AND THREE CASES OF THE SWITCH ARE NOT ROWS IN THE TABLE: Alien Menace, Time Warp part two and
    // Game Over are their own controllers in `control/mission-specials`.
    //
    // ⚠️ AND THE REASON THEY WERE DECLINED IS GONE. It was "the lamps and strings live past the point
    // where the upstream file can be read in one piece from here" — true of a fetch that truncates,
    // false of `gh api`, which hands over all 4603 lines of `control.cpp`. Alien Menace is wired from
    // the source rather than from a guess; the other two are next, and stay declined until they are.
    expect(w.dispatch.missionsRun.has(10), 'alien menace').toBe(true);
    for (const mission of [24, 32]) {
      expect(w.dispatch.missionsRun.has(mission), `special ${mission}`).toBe(false);
    }
    // And every component every mission names is registered, which is the same claim from the other
    // side: nothing is declined for want of a part any more.
    for (const row of MISSION_TABLE) {
      for (const name of row.components) {
        expect(w.dispatch.wired.has(tagOf.get(name) ?? ''), `${row.name} needs ${name}`).toBe(true);
      }
    }
  });

  test('⚠️ and a mission counts hits on ITS OWN components and ignores the rest', () => {
    // Launch training is three trips up the ramp. A bumper is not a ramp, and a mission that counted
    // any collision would finish itself on the way past.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const lamp = w.components.lights.get('lite198')!;
    const counter = w.components.lights.get('lite56')!;
    lamp.messageField = 3; // LaunchTraining
    w.dispatch.missions.dispatch('ControlMissionComplete', null, missionContextOf(w));
    expect(counter.messageField, 'three ramps to go').toBe(3);

    w.dispatch.hit('a_bump1');
    expect(counter.messageField, 'a bumper is not a ramp').toBe(3);

    w.dispatch.hit('ramp');

    expect(counter.messageField).toBe(2);
    w.dispatch.hit('ramp');

    // ⚠️ AND THE LINE CARRIES THE COUNT. It is re-announced on every qualifying hit, so a text chosen
    // once would leave the same number on the screen for the whole mission. (The first announcement
    // went through the context this test built, not the dispatcher's; these two came through the real
    // path, which is the one that matters.)
    expect(w.shown).toContain('text:STRING211:{"n":2}');
    expect(w.shown).toContain('text:STRING211:{"n":1}');
  });

  test('⚠️ and finishing it moves the lamp on and pays the award', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const lamp = w.components.lights.get('lite198')!;
    lamp.messageField = 3;
    w.dispatch.missions.dispatch('ControlMissionComplete', null, missionContextOf(w));

    w.dispatch.hit('ramp');
    w.dispatch.hit('ramp');
    w.dispatch.hit('ramp');

    expect(lamp.messageField, 'back to mission select').toBe(1);
    expect(w.score.curScore).toBeGreaterThanOrEqual(500000);
  });

  test('and the rank points are kept rather than dropped', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const lamp = w.components.lights.get('lite198')!;
    lamp.messageField = 3;
    w.dispatch.missions.dispatch('ControlMissionComplete', null, missionContextOf(w));

    w.dispatch.hit('ramp');
    w.dispatch.hit('ramp');
    w.dispatch.hit('ramp');

    expect(w.dispatch.rankPoints).toBe(6);
  });
});

describe('⚠️ the rank ladder, which is two circles of lamps and no number anywhere', () => {
  /** Finishes launch training, which is three ramps and six points of rank progress. */
  const finishLaunchTraining = (w: NonNullable<ReturnType<typeof wired>>) => {
    w.components.lights.get('lite198')!.messageField = 3;
    w.dispatch.missions.dispatch('ControlMissionComplete', null, missionContextOf(w));
    w.dispatch.hit('ramp');
    w.dispatch.hit('ramp');
    w.dispatch.hit('ramp');
  };

  test('progress lights the OUTER circle, one lamp per point', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const outer = w.components.lightGroups.get('outer_circle')!;
    expect(outer.onCount).toBe(0);

    finishLaunchTraining(w);

    expect(outer.onCount).toBe(6);
    expect(w.dispatch.rankPoints).toBe(6);
  });

  test('⚠️ and the progress lamp is the BONUS LANE’S, which arms it', () => {
    // `AddRankProgress` turns `lite16` on and `BonusLaneRolloverControl` pays the accumulated bonus
    // when it is lit. One lamp, two mechanics, and neither function mentions the other — so finishing
    // a mission makes the bonus lane worth crossing without anything saying so.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    expect(w.components.lights.get('lite16')!.lit).toBe(false);

    finishLaunchTraining(w);

    expect(w.components.lights.get('lite16')!.lit).toBe(true);
  });

  test('⚠️ filling the outer circle promotes, and the MIDDLE circle’s lit count IS the rank', () => {
    // Nothing stores a rank. The middle circle gains a lamp and that is the whole record of it.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const outer = w.components.lightGroups.get('outer_circle')!;
    const middle = w.components.lightGroups.get('middle_circle')!;

    // Enough missions to fill the outer circle at least once.
    for (let i = 0; i < 6; i++) {
      finishLaunchTraining(w);
      w.components.advance(6);
    }

    expect(middle.onCount).toBeGreaterThan(0);
    expect(outer.lightCount).toBeGreaterThan(0);
    expect(w.shown.some((line) => line.startsWith('text:STRING184'))).toBe(true);
  });
});

describe('⚠️ the wormhole’s destination, a number kept in a lamp’s message field', () => {
  test('striking the target announces it ONCE and lights its lamp', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    w.dispatch.hit(WORM_HOLE.component);

    expect(w.components.lights.get(WORM_HOLE.targetLamp)!.lit).toBe(true);
    expect(w.shown).toContain('text:STRING194');

    const saidOnce = w.shown.filter((line) => line === 'text:STRING194').length;
    w.dispatch.hit(WORM_HOLE.component);
    expect(w.shown.filter((line) => line === 'text:STRING194').length, 'and not again').toBe(saidOnce);
  });

  test('⚠️ and the cycle is one, two, three, one — never zero', () => {
    // Zero means "no destination", so the cycle has to skip it. A plain increment modulo four would
    // send the arrow nowhere every fourth strike, and the mission that reads it would find no target.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const destination = w.components.lights.get(WORM_HOLE.destinationLamp)!;
    const seen: number[] = [];

    for (let i = 0; i < 4; i++) {
      w.dispatch.hit(WORM_HOLE.component);
      seen.push(destination.messageField);
    }

    expect(seen).toEqual([1, 2, 3, 1]);
  });

  test('⚠️ and the destination is written to the whole GROUP, which is how the lamp learns it', () => {
    // `lite4` is one of the three arrow lamps. Advancing sends the new number to every member, and the
    // next read comes back through that same lamp — the cycle uses two doors into one number.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    w.dispatch.hit(WORM_HOLE.component);

    for (const lamp of ['lite2', 'lite3', 'lite4']) {
      expect(w.components.lights.get(lamp)!.messageField, lamp).toBe(1);
      // ⚠️ AND THE ARROW'S FRAME IS `3 - destination`, the same fact drawn. Setting the frame to the
      // destination itself points the arrow the wrong way round and nothing else notices.
      expect(w.components.lights.get(lamp)!.onFrame, `${lamp} frame`).toBe(2);
    }
  });

  test('⚠️ and three missions freeze it, because the wormhole is what they are about', () => {
    // Missions sixteen, twenty-two and twenty-three ARE the wormhole; moving its destination under
    // them would change the target mid-mission.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);
    w.components.lights.get('lite198')!.messageField = 22;

    w.dispatch.hit(WORM_HOLE.component);

    expect(w.components.lights.get(WORM_HOLE.destinationLamp)!.messageField).toBe(0);
  });
});

describe('⚠️ and a bank puts its three targets back up', () => {
  test('completing the multiplier bank asks all three to rise', () => {
    // A struck popup target disables its own edges. Without `TPopupTargetEnable` the bank fills once
    // and never again, because the ball can no longer reach any of its three — and nothing about the
    // score would look wrong, because the score never comes a second time either.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    for (const target of MULTIPLIER_BANK.targets) w.dispatch.hit(target);

    expect(w.poppedUp.sort()).toEqual([...MULTIPLIER_BANK.targets].sort());
  });

  test('and two of three asks nobody', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    w.dispatch.hit(MULTIPLIER_BANK.targets[0]!);
    w.dispatch.hit(MULTIPLIER_BANK.targets[1]!);

    expect(w.poppedUp).toEqual([]);
  });
});

/**
 * ⚠️ PUTTING A BALL BACK INTO PLAY, WHICH IS THE ONLY THING THAT EVER RAISES THE BARRIER.
 *
 * `table/blocker` and `control/feed` had both existed, tested, since their own passes, and nothing had
 * ever made the two meet: no code path anywhere sent `TBlockerEnable`, so `v_bloc1` was a component
 * that could not be reached from a running game.
 */
describe('the ball fed back onto the plunger', () => {
  test('the plunger is declined WHOLE when the feed is not given', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    expect(w.dispatch.plunger).toBe(null);
  });

  test('outside easy mode a fed ball raises nothing', () => {
    const w = wired({ gates: true, feed: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);

    w.dispatch.plunger!.feedBall();

    expect(w.blockers!.get(DRAIN_BLOCKER.component)!.active).toBe(false);
  });

  test('⚠️ in EASY MODE the barrier goes up and lite1 is lit STEADY', () => {
    const w = wired({ gates: true, feed: true, easy: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);

    w.dispatch.plunger!.feedBall();

    expect(w.blockers!.get(DRAIN_BLOCKER.component)!.active).toBe(true);
    expect(w.components.lights.get(DRAIN_BLOCKER.lamp)!.lit).toBe(true);
    // And the geometry the grid holds is what came up, not a flag on a copy.
    expect(w.geometry!.edgesOf(DRAIN_BLOCKER.component).every((edge) => edge.active)).toBe(true);
  });

  test('⚠️ and easy mode gives it NO CLOCK, so it stands for the rest of the ball', () => {
    // -1 never expires. Easy mode does not make the barrier last longer; it removes its countdown.
    const w = wired({ gates: true, feed: true, easy: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    w.dispatch.plunger!.feedBall();

    // ⚠️ IN THE SAME STEPS THE OTHER TEST TAKES. One jump past both deadlines cannot tell the two
    // apart: a timer re-armed inside an `advance` is armed from the NEW now, so the second deadline
    // falls beyond the jump and the barrier is still standing either way. That mutation survived until
    // the clock was moved the way a game moves it.
    w.components.advance(DRAIN_BLOCKER.initialDuration + 1);
    w.components.advance(DRAIN_BLOCKER.extendedDuration + 1);

    expect(w.blockers!.get(DRAIN_BLOCKER.component)!.active).toBe(true);
  });

  test('⚠️ raised OUTSIDE easy mode it is solid, then flashing, then gone', () => {
    // The lamp is the entire countdown: nothing is written on screen, and the player learns that
    // flashing means "about to open" from the one thing that ever happens next.
    const w = wired({ gates: true, feed: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const blocker = w.blockers!.get(DRAIN_BLOCKER.component)!;
    w.dispatch.raiseDrainBlocker!();
    expect(blocker.active, 'solid').toBe(true);

    w.components.advance(DRAIN_BLOCKER.initialDuration + 1);
    expect(blocker.active, 'the first timeout buys an extension, it does not lower it').toBe(true);

    w.components.advance(DRAIN_BLOCKER.extendedDuration + 1);
    expect(blocker.active, 'and the second lowers it').toBe(false);
  });

  test('⚠️ a NEW ball opens both hazard gates and relights the launch chute', () => {
    const w = wired({ gates: true, feed: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    for (const name of PLUNGER_FEED.gates) w.gates!.get(name)!.shutGate();

    w.dispatch.plunger!.startFeedTimer();

    expect(w.components.lights.get(PLUNGER_FEED.firstSkillLamp)!.lit, 'lite67').toBe(true);
    for (const name of PLUNGER_FEED.gates) {
      expect(w.gates!.get(name)!.open, name).toBe(true);
    }
    expect(w.feedTable.reflexShotScore).toBe(25000);
    expect(w.feedTable.unlimitedBalls, 'the cheat dies on the act of feeding').toBe(false);
  });

  test('⚠️ and it refills the TANK\u2019S LAMPS, which is not the same as refilling the tank', () => {
    // `TLightBargraph::Message` handles four codes and forwards the rest to `TLightGroup`, so
    // `TLightResetAndTurnOn` reaches the members and never touches `TimeIndex`. After a drain the tank
    // SHOWS full and COUNTS empty — the original's own behavior, transcribed rather than corrected.
    const w = wired({ gates: true, feed: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const lamps = w.components.bargraphLights.get(PLUNGER_FEED.fuelBargraph)!;
    expect(lamps.length).toBeGreaterThan(0);
    for (const lamp of lamps) lamp.turnOff();

    w.dispatch.plunger!.startFeedTimer();

    expect(lamps.every((lamp) => lamp.lit), 'every lamp lit').toBe(true);
    expect(w.components.bargraphs.get(PLUNGER_FEED.fuelBargraph)!.onCount, 'and the level untouched')
      .toBe(0);
  });

  test('⚠️ a SAVED ball keeps the lot, and only the latch is cleared', () => {
    // `lite200` lit means "this is the same ball continuing": the launch chute, the treks, the fuel,
    // the reflex score and the multiplier are inherited exactly as the ball left them.
    const w = wired({ gates: true, feed: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const shootAgain = w.components.lights.get(PLUNGER_FEED.shootAgainLamp)!;
    shootAgain.turnOn();
    shootAgain.messageField = 7;
    for (const name of PLUNGER_FEED.gates) w.gates!.get(name)!.shutGate();

    w.dispatch.plunger!.startFeedTimer();

    expect(w.feedTable.reflexShotScore, 'not reset').toBe(0);
    for (const name of PLUNGER_FEED.gates) {
      expect(w.gates!.get(name)!.open, `${name} stays as the ball left it`).toBe(false);
    }
    expect(shootAgain.messageField, 'the latch is outside the guard').toBe(0);
  });

  test('⚠️ and the multiplier is switched off THROUGH its own control, which stops its clock', () => {
    // Clearing the number here would pass a test that only asked about the number, and leave the
    // group lit with its thirty-second clock still running: the lamps would then come down one at a
    // time over a multiplier that had already been zero since the ball began.
    const w = wired({ gates: true, feed: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const multiplierLamps = w.components.membersOf(
      w.components.lightGroups.get('top_target_lights')!,
    );
    for (const lamp of multiplierLamps) lamp.turnOn();
    w.score.scoreMultiplier = 4;

    w.dispatch.plunger!.startFeedTimer();

    expect(w.score.scoreMultiplier).toBe(0);
    expect(multiplierLamps.some((lamp) => lamp.lit), 'the group goes dark with it').toBe(false);
  });
});

/**
 * ⚠️ THE WORMHOLE, WHICH IS THREE HOLES AND ONE ARRAY INDEX.
 *
 * Every path through `WormHoleControl` ends the same way — flash the lamps at index `i` and reset SINK
 * `i`'s timer, which is what releases a ball. The whole teleport is the choice of `i`, and the ball
 * comes out of a hole it never went into.
 */
describe('the three holes the ball can travel between', () => {
  test('⚠️ the three wormhole sinks are wired and the escape chute is NOT', () => {
    // `v_sink7` runs no control this build has, and a hole with no control keeps the ball for the rest
    // of the game — so it must not own its collisions either. Same rule as the unbound kickout.
    const w = wired({ wormHole: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);

    for (const name of WORM_HOLE_SINKS.sinks) expect(w.dispatch.wired.has(name), name).toBe(true);
    expect(w.dispatch.wired.has('v_sink7'), 'the escape chute').toBe(false);
  });

  test('with no destination armed the ball comes back out of the hole it went into', () => {
    const w = wired({ wormHole: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);

    w.dispatch.hit('v_sink2');
    w.components.advance(3);

    expect(w.born.length).toBe(1);
    expect(w.born[0]!.x, 'v_sink2’s own exit').toBeCloseTo(3.1718900, 5);
  });

  test('⚠️ with a destination armed and the WRONG hole, the ball leaves from the one the arrows point at', () => {
    // This is the teleport. `lite4`'s message field holds the destination as a ONE-BASED index, and a
    // ball that falls into any other hole is released from that one instead.
    const w = wired({ wormHole: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    w.components.lights.get(WORM_HOLE.destinationLamp)!.messageField = 3;

    w.dispatch.hit('v_sink1');
    w.components.advance(3);

    expect(w.born.length).toBe(1);
    expect(w.born[0]!.x, 'v_sink3’s exit, across the table').toBeCloseTo(-4.7144298, 5);
  });

  test('⚠️ the ARROW at the arrival hole is set to a frame, and the arrival lamp flashes', () => {
    // `WormholeLightArray2[i]` is told frame `2 - i` and then flashed, and the two arrays are
    // different lamps: `lite5/6/7` say where the ball is coming out, `lite4/2/3` are the arrows. Read
    // one list for the other and the arrows never move while the wrong lamps blink.
    const w = wired({ wormHole: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const arrivalLamp = w.components.lights.get(WORM_HOLE_SINKS.arrivalLamps[1]!)!;
    const arrowLamp = w.components.lights.get(WORM_HOLE_SINKS.arrowLamps[1]!)!;

    w.dispatch.hit('v_sink2');

    expect(arrowLamp.onFrame, 'two minus the index').toBe(1);
    expect(arrowLamp.flashing, 'the arrow flashes').toBe(true);
    expect(arrivalLamp.flashing, 'and so does the arrival lamp').toBe(true);
    // And the lamps of the holes the ball is NOT coming out of are left alone.
    expect(w.components.lights.get(WORM_HOLE_SINKS.arrivalLamps[0]!)!.flashing).toBe(false);
  });

  test('⚠️ and the hole holds the ball for the two seconds record 407 gives IT', () => {
    // The hold time comes off the hole the ball fell INTO, and it is what the arrival flash lasts. A
    // fixed zero would give the ball straight back and the flash would be over before it began.
    const w = wired({ wormHole: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);

    w.dispatch.hit('v_sink2');
    w.components.advance(1.5);
    expect(w.born, 'still held').toEqual([]);

    w.components.advance(1);
    expect(w.born.length).toBe(1);
  });

  test('⚠️ and the destination is spent by ANY hit, right or wrong', () => {
    const w = wired({ wormHole: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const destination = w.components.lights.get(WORM_HOLE.destinationLamp)!;
    const targetLamp = w.components.lights.get(WORM_HOLE.targetLamp)!;
    destination.messageField = 3;
    targetLamp.turnOn();

    w.dispatch.hit('v_sink1');

    expect(destination.messageField, 'spent').toBe(0);
    expect(targetLamp.lit, 'and the target’s own lamp goes out with it').toBe(false);
  });

  test('⚠️ the RIGHT hole during multiball LOCKS the ball and gives nothing back', () => {
    // The one path that does not release. The ball stays in the hole, the count comes down by one, and
    // three of these start multiball — see `table_bump_ball_sink_lock`.
    const w = wired({ wormHole: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    w.context.table.multiballFlag = true;
    w.context.table.multiballCount = 1;
    w.components.lights.get(WORM_HOLE.destinationLamp)!.messageField = 1;

    w.dispatch.hit('v_sink1');
    w.components.advance(3);

    expect(w.born, 'nothing came back').toEqual([]);
    expect(w.context.table.multiballCount, 'and the ball is off the table').toBe(0);
    expect(w.score.curScore, 'ten thousand, flat').toBe(10000);
  });

  test('⚠️ and the third lock is what starts multiball, which is the only trigger the game has', () => {
    const w = wired({ wormHole: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    w.context.table.multiballFlag = true;
    const destination = w.components.lights.get(WORM_HOLE.destinationLamp)!;

    for (let lock = 0; lock < 3; lock++) {
      w.context.table.multiballCount = 1;
      destination.messageField = 1;
      w.dispatch.hit('v_sink1');
    }

    // Three balls added on top of the one it was put back to, less the third lock's own step.
    expect(w.context.table.multiballCount).toBe(3);
    w.components.advance(3);
    expect(w.born.length, 'and all three holes give their ball back').toBe(3);
  });
});

/**
 * ⚠️ THE HYPERSPACE LADDER, WHICH IS A ROW OF LAMPS AND NO COUNTER.
 *
 * `HyperspaceKickOutControl` reads the group's lit count, THEN lights one more, then branches on what
 * the count WAS. Each visit is worth more than the last and nothing stores a number; reading it the
 * other way round would skip the bottom rung and start every ball at the jackpot.
 */
describe('the hole that pays more every time', () => {
  test('⚠️ the LADDER IS READ BEFORE IT GROWS: the first visit is a plain score', () => {
    const w = wired({ gates: true, wormHole: true, feed: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    w.score.jackpotScore = 999999;

    w.kickouts!.get(HYPERSPACE.component)!.control!();

    // Index 0 of the hole's own score row, and the jackpot untouched.
    expect(w.score.jackpotScore, 'not collected on the first rung').toBe(999999);
    expect(w.score.curScore).toBeGreaterThan(0);
    expect(w.components.lightGroups.get(HYPERSPACE.lightGroup)!.onCount, 'one rung climbed').toBe(1);
  });

  test('⚠️ the SECOND visit collects the jackpot and drops it to twenty thousand', () => {
    const w = wired({ gates: true, wormHole: true, feed: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const hole = w.kickouts!.get(HYPERSPACE.component)!;
    w.score.jackpotScore = 500000;

    hole.control!();
    hole.control!();

    expect(w.score.jackpotScore, 'taken, and reset to a small number').toBe(20000);
    expect(w.score.curScore).toBeGreaterThanOrEqual(500000);
  });

  test('⚠️ the THIRD raises the barrier across the drain', () => {
    // The hyperspace ladder is the second of the two senders of `TBlockerEnable`, and the only one
    // that is not the plunger's easy-mode line.
    const w = wired({ gates: true, wormHole: true, feed: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const hole = w.kickouts!.get(HYPERSPACE.component)!;

    hole.control!();
    hole.control!();
    hole.control!();

    expect(w.blockers!.get(DRAIN_BLOCKER.component)!.active).toBe(true);
  });

  test('⚠️ and the FIFTH clears the lamps, which is what makes the ladder a cycle', () => {
    const w = wired({ gates: true, wormHole: true, feed: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const hole = w.kickouts!.get(HYPERSPACE.component)!;
    const group = w.components.lightGroups.get(HYPERSPACE.lightGroup)!;

    for (let visit = 0; visit < 5; visit++) hole.control!();

    expect(group.onCount, 'back to nothing, ready to climb again').toBe(0);
    // And the gravity well is armed by the top rung, which is what makes that hole dangerous.
    expect(w.components.lights.get(KICKOUTS[1]!.lamp!)!.flashing).toBe(true);
  });

  test('⚠️ the ladder empties on SIXTY seconds, not the medals’ thirty', () => {
    // Three groups share one decay statement and differ only in the period. Give the ladder the
    // medals' and it drains twice as fast as the file says — a difference that reads as the table
    // being stingy rather than as a wrong number.
    const w = wired({ gates: true, wormHole: true, feed: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const group = w.components.lightGroups.get(HYPERSPACE.lightGroup)!;
    w.kickouts!.get(HYPERSPACE.component)!.control!();
    expect(group.onCount).toBe(1);

    w.components.advance(31);
    expect(group.onCount, 'still lit at thirty-one seconds').toBe(1);

    w.components.advance(30);
    expect(group.onCount, 'and gone at sixty-one').toBe(0);
  });

  test('⚠️ the reflex lamp pays the REFLEX SHOT SCORE, which is the plunger’s number', () => {
    // `TableG->ReflexShotScore` is set to 25000 at the start of every new ball and spent, unmultiplied,
    // by the first bit of the hyperspace flag. A fixed zero pays nothing and lights the same lamp.
    const w = wired({ gates: true, wormHole: true, feed: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    w.feedTable.reflexShotScore = 77000;
    w.components.lights.get(HYPERSPACE.reflexLamp)!.turnOn();

    w.kickouts!.get(HYPERSPACE.component)!.control!();

    expect(w.score.curScore).toBeGreaterThanOrEqual(77000);
    expect(w.shown.some((line) => line.startsWith(`text:${HYPERSPACE.textIds.reflex}`))).toBe(true);
  });

  test('⚠️ and the ball is held exactly as long as the noise it made', () => {
    // `TSound::Play` returns the sound's length and the hole's release timer IS that length. A flat
    // number holds every ball the same time whatever happened, and the fanfare would end long before
    // the ball came back.
    const w = wired({ gates: true, wormHole: true, feed: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);
    const kickout = w.kickouts!.get(HYPERSPACE.component)!;
    const thrown: number[] = [];

    kickout.collision(heldBall(thrown), { x: 0, y: 0 }, { x: 0, y: 1 }, 0, null);

    // `plain`, the first rung's voice, is 0.12 long.
    w.components.advance(0.1);
    expect(thrown, 'still held').toEqual([]);
    w.components.advance(0.05);
    expect(thrown, 'and out again as the sound ends').toHaveLength(1);
  });

  test('⚠️ AND WITH IT, ALL TWENTY-THREE MISSIONS RUN', () => {
    // `MaelstromPartEight` was the last row declined, and it wanted `kickout2` — the hyperspace hole,
    // whose control needed the ladder. Nothing is declined for want of a component any more.
    const w = wired({ gates: true, wormHole: true, feed: true });
    if (!w) return expect(existsSync(DAT)).toBe(false);

    expect(w.dispatch.wired.has(HYPERSPACE.component)).toBe(true);
    expect(w.dispatch.missionsRun.size, 'and Alien Menace on top of the table').toBe(23 + 1);
  });
});

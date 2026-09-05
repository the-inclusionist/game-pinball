// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createOriginalDispatch } from '../app/js/table/original-dispatch.js';
import { buildOriginalComponents } from '../app/js/table/original-components.js';
import { buildOriginalTable } from '../app/js/table/original.js';
import { buildOriginalGates } from '../app/js/table/original-gates.js';
import {
  REENTRY_LANES, LAMP_BINDINGS, FUEL_ROLLOVERS, OUT_LANES, BONUS_LANE, SPOT_TARGET_SETS,
  MEDAL_BANK, MULTIPLIER_BANK, BOOSTER_BANK, TABLE_ACTIONS, GATE_LAMPS, KICKERS, SKILL_SHOT,
} from '../app/js/control/bindings.js';
import { createScoreState } from '../app/js/control/score.js';
import { SCORE_COMPONENTS } from '../app/js/control/score-table.js';
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

function wired(o: { gates?: boolean; easy?: boolean } = {}) {
  const table = manifest();
  if (!table) return null;
  const components = buildOriginalComponents(table);
  // The gates need the GEOMETRY, which is a different build — see `table/original-gates`.
  const geometry = o.gates ? buildOriginalTable(table.groups) : null;
  const gates = geometry ? buildOriginalGates(table, geometry) : undefined;
  const score = createScoreState();
  const shown: string[] = [];
  const sounds: string[] = [];
  const context: ControlContext = {
    score,
    table: { extraBalls: 0, multiballCount: 1, ballCount: 3, tiltLocked: false },
    light: (name) => components.lights.get(name),
    group: () => undefined,
    showInfo: (text) => shown.push(text),
    showMission: (text) => shown.push(text),
    playSound: (name) => sounds.push(name),
    playMusic: () => {},
    missionControl: () => {},
  };
  const dispatch = createOriginalDispatch({
    components, context, ...(gates ? { gates } : {}),
    ...(o.easy ? { isEasyMode: () => true } : {}),
    textFor: (id, params) => (params ? `text:${id}:${JSON.stringify(params)}` : `text:${id}`),
  });
  return { components, score, shown, sounds, dispatch, context, geometry, gates };
}

describe('a lane crossing reaches the 1995 control function', () => {
  test('the inventory of what runs, which grows deliberately and never quietly', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    expect(w.dispatch.wired.size).toBe(52);
    expect(w.dispatch.wired.has('a_roll3')).toBe(true);
    expect(w.dispatch.wired.has('a_roll9')).toBe(true);
    // ⚠️ THE EXAMPLE OF SOMETHING DECLINED KEEPS MOVING, and that is the point of keeping one. It was
    // `a_bump1`, then `a_targ13` when the mission spot set was still transcribed-but-not-run. Both
    // run now. `a_flag1` is the current one: `FlagControl` is written and its component is not built.
    expect(w.dispatch.wired.has('a_flag1')).toBe(false);
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

    expect(() => w.dispatch.hit('a_flag1')).not.toThrow();
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

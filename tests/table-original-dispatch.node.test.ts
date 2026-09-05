// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createOriginalDispatch } from '../app/js/table/original-dispatch.js';
import { buildOriginalComponents } from '../app/js/table/original-components.js';
import {
  REENTRY_LANES, LAMP_BINDINGS, FUEL_ROLLOVERS, OUT_LANES, BONUS_LANE, SPOT_TARGET_SETS,
} from '../app/js/control/bindings.js';
import { createScoreState } from '../app/js/control/score.js';
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

function wired() {
  const table = manifest();
  if (!table) return null;
  const components = buildOriginalComponents(table);
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
    components, context,
    textFor: (id, params) => (params ? `text:${id}:${JSON.stringify(params)}` : `text:${id}`),
  });
  return { components, score, shown, sounds, dispatch, context };
}

describe('a lane crossing reaches the 1995 control function', () => {
  test('the six lanes of the two chains are wired, plus the space warp, and nothing else', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    expect(w.dispatch.wired.size).toBe(21);
    expect(w.dispatch.wired.has('a_roll3')).toBe(true);
    expect(w.dispatch.wired.has('a_roll9')).toBe(true);
    expect(w.dispatch.wired.has('a_bump1')).toBe(false);
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

    expect(() => w.dispatch.hit('a_bump1')).not.toThrow();
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

  test('⚠️ and the other three sets are DECLINED, each for its own stated reason', () => {
    // Two of them disable a gate on completion and this build constructs no gates; the third chooses
    // its sound from a lamp rather than from whether the set completed, which the shared factory
    // cannot express. Their bindings are transcribed and correct — the dispatcher says which it runs.
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    for (const set of SPOT_TARGET_SETS) {
      const runs = set.completion.kind === 'fillTank' && !set.soundFromLamp;
      for (const target of set.targets) {
        expect(w.dispatch.wired.has(target), `${set.control}/${target}`).toBe(runs);
      }
    }
  });
});

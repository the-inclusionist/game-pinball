// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createOriginalDispatch } from '../app/js/table/original-dispatch.js';
import { buildOriginalComponents } from '../app/js/table/original-components.js';
import { REENTRY_LANES, LAMP_BINDINGS, FUEL_ROLLOVERS } from '../app/js/control/bindings.js';
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
  const context: ControlContext = {
    score,
    table: { extraBalls: 0, multiballCount: 1, ballCount: 3, tiltLocked: false },
    light: (name) => components.lights.get(name),
    group: () => undefined,
    showInfo: (text) => shown.push(text),
    showMission: (text) => shown.push(text),
    playSound: () => {},
    playMusic: () => {},
    missionControl: () => {},
  };
  const dispatch = createOriginalDispatch({
    components, context, textFor: (id) => `text:${id}`,
  });
  return { components, score, shown, dispatch };
}

describe('a lane crossing reaches the 1995 control function', () => {
  test('the six lanes of the two chains are wired, plus the space warp, and nothing else', () => {
    const w = wired();
    if (!w) return expect(existsSync(DAT)).toBe(false);

    expect(w.dispatch.wired.size).toBe(15);
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

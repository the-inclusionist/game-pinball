// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  makeSkillShotEntryControl, makeSkillShotGateControl, makeSkillShotCollectControl,
  makeSkillShotLostControl, makeLaunchRampControl, makeLaunchRampHoleControl,
  makeShootAgainLightControl, makeEscapeChuteSinkControl,
  type SkillShotGroup,
} from '../app/js/control/launch.js';
import type { LaneLight, LaneGroup } from '../app/js/control/lanes.js';
import type { ControlContext, ControlledComponent } from '../app/js/control/dispatch.js';
import { createScoreState } from '../app/js/control/score.js';
import { SCORE_ARRAYS } from '../app/js/control/score-table.js';

function fakeLight(on = false): LaneLight & { readonly log: string[] } {
  const log: string[] = [];
  return {
    log,
    get on() { return on; },
    get flashing() { return false; },
    turnOn() { on = true; log.push('on'); },
    turnOff() { on = false; log.push('off'); },
    turnOnTimed(s) { on = true; log.push('onTimed:' + s); },
    turnOffTimed(s) { log.push('offTimed:' + s); },
    flasherStart() { log.push('flash'); },
    flasherStartTimed(s) { log.push('flashTimed:' + s); },
    resetTimed() { log.push('reset'); },
  };
}

function fakeShotGroup(onCount = 0): SkillShotGroup & { readonly log: string[] } {
  const log: string[] = [];
  return {
    log,
    get onCount() { return onCount; },
    resetGroup() { log.push('resetGroup'); },
    resetAndTurnOff() { onCount = 0; log.push('allOff'); },
    flashWhenOn(s) { log.push('flashWhenOn:' + s); },
  };
}

function fakeBargraph(): LaneGroup & { readonly log: string[] } {
  const log: string[] = [];
  return {
    log,
    onCount: 0, lightCount: 12,
    flasherStartTimed(s) { log.push('flashTimed:' + s); },
    turnOff() { log.push('off'); },
    toggleSplitIndex(i) { log.push('split:' + i); },
  };
}

const component = (name: string, scores: readonly number[] = [1000]): ControlledComponent =>
  ({ name, scores, control: null });

function context() {
  const info: { text: string; seconds: number }[] = [];
  const sounds: string[] = [];
  const ctx: ControlContext = {
    score: createScoreState(),
    table: { extraBalls: 0, multiballCount: 0, ballCount: 3, tiltLocked: false },
    light: () => undefined,
    group: () => undefined,
    showInfo: (text, seconds) => info.push({ text, seconds }),
    showMission: () => {},
    playSound: (n) => sounds.push(n),
    playMusic: () => {},
    missionControl: () => {},
  };
  return { ctx, info, sounds };
}

describe('the skill shot is armed by the first gate', () => {
  function build(armed: boolean) {
    const shootAgainLamp = fakeLight();
    const firstLamp = fakeLight(armed);
    const group = fakeShotGroup(3);
    const flashLamps = [fakeLight(), fakeLight()];
    const bargraph = fakeBargraph();
    const control = makeSkillShotEntryControl({
      shootAgainLamp, firstLamp, group, flashLamps, bargraph,
      topSplitIndex: 11, sound: 'chime',
    });
    return { shootAgainLamp, firstLamp, group, flashLamps, bargraph, control, ...context() };
  }

  test('passing it always gives five seconds of free ball', () => {
    // `lite200` is the shoot-again lamp the drain reads. Lighting it TIMED here is a ball save that
    // lasts only while the launch is still going on.
    const b = build(false);

    b.control('ControlCollision', component('gate1'), b.ctx);

    expect(b.shootAgainLamp.log).toEqual(['onTimed:5']);
  });

  test('with the run already armed it STARTS OVER, keeping only the first lamp', () => {
    const b = build(true);

    b.control('ControlCollision', component('gate1'), b.ctx);

    expect(b.group.log).toEqual(['resetGroup', 'allOff']);
    expect(b.firstLamp.on).toBe(true);
    expect(b.bargraph.log).toEqual(['split:11']);
    expect(b.sounds).toEqual(['chime']);
  });

  test('with the run NOT armed only the ball save happens', () => {
    const b = build(false);

    b.control('ControlCollision', component('gate1'), b.ctx);

    expect(b.group.log).toEqual([]);
    expect(b.bargraph.log).toEqual([]);
  });
});

describe('the other five gates are one function', () => {
  function build(armed: boolean) {
    const armLamp = fakeLight(armed);
    const lamp = fakeLight();
    const control = makeSkillShotGateControl({ armLamp, lamp, sound: 'blip' });
    return { armLamp, lamp, control, ...context() };
  }

  test('with the run armed the gate lights its own lamp', () => {
    const b = build(true);

    b.control('ControlCollision', component('gate3'), b.ctx);

    expect(b.lamp.on).toBe(true);
    expect(b.sounds).toEqual(['blip']);
  });

  test('with the run not armed the gate does nothing at all', () => {
    // Which is what makes the skill shot a RUN: gate 1 opens it and the rest only count inside it.
    const b = build(false);

    b.control('ControlCollision', component('gate3'), b.ctx);

    expect(b.lamp.on).toBe(false);
    expect(b.sounds).toEqual([]);
  });

  test('the gate scores nothing — the chute pays, not the gates', () => {
    const b = build(true);

    b.control('ControlCollision', component('gate3'), b.ctx);

    expect(b.ctx.score.curScore).toBe(0);
  });
});

describe('the escape chute is where the skill shot is paid', () => {
  function build(litCount: number, trekGuardLit = false) {
    const group = fakeShotGroup(litCount);
    const trekGuardLamp = fakeLight(trekGuardLit);
    const trekGroups = [fakeShotGroup(2), fakeShotGroup(2)];
    const control = makeSkillShotCollectControl({
      group, trekGuardLamp, trekGroups, sound: 'fanfare',
      scoreText: (points) => 'SKILL SHOT ' + points,
    });
    const chute = component('oneway4', SCORE_ARRAYS.oneway4_score1);
    return { group, trekGuardLamp, trekGroups, chute, control, ...context() };
  }

  test('THE NUMBER OF GATES PASSED IS THE SCORE INDEX', () => {
    const b = build(1);

    b.control('ControlCollision', b.chute, b.ctx);

    expect(b.ctx.score.curScore).toBe(15000);
  });

  test('THREE gates is the peak, and more is worth less', () => {
    // The score array climbs 15000, 30000, 75000 and then falls back to 7500. It is not a "hold it
    // longer" shot: the player is aiming for exactly three gates of plunger strength.
    const three = build(3);
    const six = build(6);

    three.control('ControlCollision', three.chute, three.ctx);
    six.control('ControlCollision', six.chute, six.ctx);

    expect(three.ctx.score.curScore).toBe(75000);
    expect(six.ctx.score.curScore).toBe(7500);
  });

  test('with no gates lit the chute is worth nothing and says nothing', () => {
    const b = build(0);

    b.control('ControlCollision', b.chute, b.ctx);

    expect(b.ctx.score.curScore).toBe(0);
    expect(b.info).toEqual([]);
    expect(b.sounds).toEqual([]);
  });

  test('collecting clears the trek lights, unless the guard lamp is lit', () => {
    const open = build(2, false);
    const guarded = build(2, true);

    open.control('ControlCollision', open.chute, open.ctx);
    guarded.control('ControlCollision', guarded.chute, guarded.ctx);

    expect(open.trekGroups[0]!.log).toEqual(['resetGroup', 'allOff']);
    expect(guarded.trekGroups[0]!.log).toEqual([]);
  });

  test('the lit gates flash to show what was collected', () => {
    const b = build(2);

    b.control('ControlCollision', b.chute, b.ctx);

    expect(b.group.log).toContain('flashWhenOn:1');
  });

  test('the ball reaching the TABLE instead throws the run away', () => {
    // The same launch, two exits. This is the only difference between them.
    const group = fakeShotGroup(3);
    const control = makeSkillShotLostControl({ group });
    const { ctx } = context();

    control('ControlCollision', component('oneway5'), ctx);

    expect(group.log).toEqual(['allOff']);
  });
});

describe('the launch ramp — three lamps, and only one of them pays', () => {
  function build(o: { reflex?: boolean; ramp?: boolean; mission?: boolean } = {}) {
    const reflexLamp = fakeLight(o.reflex ?? false);
    const rampLamp = fakeLight(o.ramp ?? false);
    const missionLamp = fakeLight(o.mission ?? false);
    const control = makeLaunchRampControl({
      reflexLamp, rampLamp, missionLamp,
      reflexScore: () => 25000,
      reflexText: (points) => 'REFLEX ' + points,
      sounds: { reflexOnly: 's21', rampAward: 's23', mission: 's24', plain: 's30' },
    });
    return { reflexLamp, rampLamp, missionLamp, control, ...context() };
  }

  test('with nothing lit it is an ordinary ramp', () => {
    const b = build();

    b.control('ControlCollision', component('ramp', [5000]), b.ctx);

    expect(b.ctx.score.curScore).toBe(5000);
    expect(b.sounds).toEqual(['s30']);
  });

  test('the REFLEX lamp pays its own score, unmultiplied', () => {
    const b = build({ reflex: true });
    b.ctx.score.scoreMultiplier = 4; // x10

    b.control('ControlCollision', component('ramp', [5000]), b.ctx);

    expect(b.ctx.score.curScore).toBe(25000);
    expect(b.info).toEqual([{ text: 'REFLEX 25000', seconds: 2 }]);
    expect(b.sounds).toEqual(['s21']);
  });

  test('a lit lamp REPLACES the ordinary score — the other two pay NOTHING', () => {
    // Worth stating because it looks like a bug: with the ramp lamp lit and the reflex lamp dark the
    // player gets a triumphant noise and zero points. Transcribed as written.
    const b = build({ ramp: true });

    b.control('ControlCollision', component('ramp', [5000]), b.ctx);

    expect(b.ctx.score.curScore).toBe(0);
    expect(b.sounds).toEqual(['s23']);
  });

  test('the MISSION lamp outranks the other two in the noise it makes', () => {
    const missionOnly = build({ mission: true });
    const all = build({ reflex: true, ramp: true, mission: true });

    missionOnly.control('ControlCollision', component('ramp', [5000]), missionOnly.ctx);
    all.control('ControlCollision', component('ramp', [5000]), all.ctx);

    expect(missionOnly.sounds).toEqual(['s24']);
    expect(all.sounds).toEqual(['s24']);
  });

  test('reflex plus ramp is the middle sound, not the reflex one', () => {
    const b = build({ reflex: true, ramp: true });

    b.control('ControlCollision', component('ramp', [5000]), b.ctx);

    expect(b.sounds).toEqual(['s23']);
    expect(b.ctx.score.curScore).toBe(25000);
  });

  test('a ball coming back out of the ramp hole re-lights the reflex lamp', () => {
    const reflexLamp = fakeLight();
    const control = makeLaunchRampHoleControl({ reflexLamp });
    const { ctx } = context();

    control('ControlBallReleased', component('hole'), ctx);

    expect(reflexLamp.log).toEqual(['flashTimed:5']);
  });
});

describe('the shoot-again lamp dies on the SECOND timeout', () => {
  function build() {
    const log: string[] = [];
    const lamp = { messageField: 0, flasherStartTimedThenStayOff: (s: number) => log.push('fade:' + s) };
    return { lamp, log, control: makeShootAgainLightControl({ lamp }), ...context() };
  }

  test('the first timeout starts the five-second fade', () => {
    const b = build();

    b.control('ControlTimerExpired', component('lite200'), b.ctx);

    expect(b.log).toEqual(['fade:5']);
    expect(b.lamp.messageField).toBe(1);
  });

  test('the timeout the FADE ITSELF raises is swallowed', () => {
    // `flasherStartTimedThenStayOff` ends with a timer expiry of its own. Without the field the lamp
    // would restart its own fade forever.
    const b = build();
    b.control('ControlTimerExpired', component('lite200'), b.ctx);

    b.control('ControlTimerExpired', component('lite200'), b.ctx);

    expect(b.log).toEqual(['fade:5']);
    expect(b.lamp.messageField).toBe(0);
  });

  test('and then it can fade again', () => {
    const b = build();
    b.control('ControlTimerExpired', component('lite200'), b.ctx);
    b.control('ControlTimerExpired', component('lite200'), b.ctx);

    b.control('ControlTimerExpired', component('lite200'), b.ctx);

    expect(b.log).toEqual(['fade:5', 'fade:5']);
  });
});

describe('the escape chute sink holds the ball indefinitely', () => {
  test('a collision arms a timer that never expires', () => {
    // `TSinkResetTimer` with -1: the ball waits there until something else releases it.
    const resets: number[] = [];
    const control = makeEscapeChuteSinkControl({ sink: { resetTimer: (s) => resets.push(s) } });
    const { ctx } = context();

    control('ControlCollision', component('sink1'), ctx);

    expect(resets).toEqual([-1]);
  });
});

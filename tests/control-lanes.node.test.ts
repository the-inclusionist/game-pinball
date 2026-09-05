// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  makeBumperLaneControl, makeBumperGroupControl, makeFuelRolloverControl,
  makeOutLaneControl, makeExtraBallLightControl, makeReturnLaneControl,
  makeBonusLaneControl, makeSpaceWarpRolloverControl,
  type LaneLight, type LaneGroup,
} from '../app/js/control/lanes.js';
import type { ControlContext, ControlledComponent } from '../app/js/control/dispatch.js';
import { createScoreState } from '../app/js/control/score.js';

function fakeLight(on = false, flashing = false): LaneLight & { readonly log: string[] } {
  const log: string[] = [];
  return {
    log,
    get on() { return on; },
    get flashing() { return flashing; },
    turnOn() { on = true; log.push('on'); },
    turnOff() { on = false; log.push('off'); },
    turnOnTimed(s) { on = true; log.push('onTimed:' + s); },
    turnOffTimed(s) { log.push('offTimed:' + s); },
    flasherStart() { flashing = true; log.push('flash'); },
    flasherStartTimed(s) { log.push('flashTimed:' + s); },
    resetTimed() { log.push('reset'); },
  };
}

function fakeGroup(onCount: number, lightCount = 3): LaneGroup & { readonly log: string[] } {
  const log: string[] = [];
  return {
    log,
    get onCount() { return onCount; },
    get lightCount() { return lightCount; },
    flasherStartTimed(s) { log.push('flashTimed:' + s); },
    turnOff() { log.push('off'); },
    toggleSplitIndex(i) { log.push('split:' + i); },
  };
}

const component = (name: string, scores: readonly number[] = [1000, 25000]): ControlledComponent =>
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

describe('the bumper lanes — filling a lane set upgrades a bumper', () => {
  function build(o: { on?: boolean; flashing?: boolean; onCount?: number; level?: number; fullTilt?: boolean } = {}) {
    const light = fakeLight(o.on ?? false, o.flashing ?? false);
    const group = fakeGroup(o.onCount ?? 1);
    const bumpers = {
      level: o.level ?? 0,
      incs: 0, restarts: [] as number[],
      incLevel() { this.incs++; },
      restartNotifyTimer(s: number) { this.restarts.push(s); },
    };
    const roll = component('roll3');
    const control = makeBumperLaneControl({
      lightFor: (caller) => (caller === roll ? light : undefined),
      group, bumpers, completeText: 'BUMPERS AT NEXT LEVEL',
      isFullTilt: () => o.fullTilt ?? false,
    });
    return { light, group, bumpers, roll, control, ...context() };
  }

  test('a dark lane lights and scores', () => {
    const b = build({ on: false, onCount: 1 });

    b.control('ControlCollision', b.roll, b.ctx);

    expect(b.light.on).toBe(true);
    expect(b.ctx.score.curScore).toBe(1000);
    expect(b.bumpers.incs).toBe(0);
  });

  test('a lane ALREADY LIT goes back out — hitting it again undoes it', () => {
    // Not a no-op: the Space Cadet lanes toggle, so a stray ball through a lit lane costs progress.
    const b = build({ on: true });

    b.control('ControlCollision', b.roll, b.ctx);

    expect(b.light.on).toBe(false);
    expect(b.ctx.score.curScore).toBe(1000);
  });

  test('in FULL TILT the lane stays lit — the toggle was a bug they fixed', () => {
    const b = build({ on: true, fullTilt: true });

    b.control('ControlCollision', b.roll, b.ctx);

    expect(b.light.on).toBe(true);
  });

  test('a FLASHING lane is untouchable, on or off', () => {
    const b = build({ on: false, flashing: true });

    b.control('ControlCollision', b.roll, b.ctx);

    expect(b.light.on).toBe(false);
    expect(b.ctx.score.curScore).toBe(1000); // still scores, though
  });

  test('the lamp that COMPLETES the group upgrades the bumpers', () => {
    const b = build({ on: false, onCount: 3 });

    b.control('ControlCollision', b.roll, b.ctx);

    expect(b.group.log).toEqual(['flashTimed:5', 'off']);
    expect(b.bumpers.incs).toBe(1);
    expect(b.info).toEqual([{ text: 'BUMPERS AT NEXT LEVEL', seconds: 2 }]);
  });

  test('at level 3 the bumpers stop climbing but the DECAY TIMER is still restarted', () => {
    // Which is the whole reason the timer restart sits outside the level guard: a full set of lanes at
    // the top level buys no upgrade, but it does buy another sixty seconds of keeping the one you have.
    const b = build({ on: false, onCount: 3, level: 3 });

    b.control('ControlCollision', b.roll, b.ctx);

    expect(b.bumpers.incs).toBe(0);
    expect(b.info).toEqual([]);
    expect(b.bumpers.restarts).toEqual([60]);
  });

  test('a component this control does not own is only scored', () => {
    const b = build();

    b.control('ControlCollision', component('roll99'), b.ctx);

    expect(b.light.log).toEqual([]);
    expect(b.ctx.score.curScore).toBe(1000);
  });

  test('anything but a collision is ignored', () => {
    const b = build();

    b.control('ControlTimerExpired', b.roll, b.ctx);

    expect(b.ctx.score.curScore).toBe(0);
  });
});

describe('the bumper group decays on its own', () => {
  test('the notify timer expiring drops one level and arms itself again', () => {
    // The counterpart to the lanes: what they build up, time takes back. The bumpers are worth more
    // only while the player keeps feeding the lanes.
    const bumpers = {
      level: 2, decs: 0, restarts: [] as number[],
      decLevel() { this.decs++; },
      restartNotifyTimer(s: number) { this.restarts.push(s); },
    };
    const control = makeBumperGroupControl({ bumpers });
    const { ctx } = context();

    control('ControlNotifyTimerExpired', component('attack_bump'), ctx);

    expect(bumpers.decs).toBe(1);
    expect(bumpers.restarts).toEqual([60]);
  });

  test('an ordinary collision does not decay anything', () => {
    const bumpers = { level: 2, decs: 0, restarts: [] as number[], decLevel() { this.decs++; }, restartNotifyTimer() {} };
    const control = makeBumperGroupControl({ bumpers });
    const { ctx } = context();

    control('ControlCollision', component('attack_bump'), ctx);

    expect(bumpers.decs).toBe(0);
  });
});

describe('the fuel bargraph — six rollovers, one rule', () => {
  function build(splitIndex: number, onCount: number) {
    const lamp = fakeLight();
    const bargraph = fakeGroup(onCount, 12);
    const control = makeFuelRolloverControl({ lamp, splitIndex, bargraph, refuelText: 'FUEL' });
    return { lamp, bargraph, control, ...context() };
  }

  test('below its own level the rollover FILLS the bargraph up to it', () => {
    const b = build(5, 4);

    b.control('ControlCollision', component('roll10'), b.ctx);

    expect(b.bargraph.log).toEqual(['split:5']);
    expect(b.info).toEqual([{ text: 'FUEL', seconds: 2 }]);
  });

  test('at its own level exactly it still fills — the guard is strictly greater', () => {
    const b = build(5, 5);

    b.control('ControlCollision', component('roll10'), b.ctx);

    expect(b.bargraph.log).toEqual(['split:5']);
  });

  test('above its own level it only blinks its own lamp', () => {
    // The threshold IS the split index. Each of the six rollovers tops the tank up to its own segment
    // and no further, which is why the game needs six of them and not one.
    const b = build(5, 6);

    b.control('ControlCollision', component('roll10'), b.ctx);

    expect(b.bargraph.log).toEqual([]);
    expect(b.lamp.log).toEqual(['offTimed:0.05']);
    expect(b.info).toEqual([]);
  });

  test('either way the hit scores', () => {
    const low = build(5, 4);
    const high = build(5, 9);

    low.control('ControlCollision', component('roll10'), low.ctx);
    high.control('ControlCollision', component('roll10'), high.ctx);

    expect(low.ctx.score.curScore).toBe(1000);
    expect(high.ctx.score.curScore).toBe(1000);
  });
});

describe('the out lanes — where an extra ball is collected', () => {
  function build(o: { lit17?: boolean; lit30?: boolean } = {}) {
    const lite17 = fakeLight(o.lit17 ?? false);
    const lite18 = fakeLight(false);
    const lite30 = fakeLight(o.lit30 ?? false);
    const lite196 = fakeLight(false);
    const roll4 = component('roll4');
    const extraBalls: number[] = [];
    const control = makeOutLaneControl({
      extraBallLamps: [lite17, lite18],
      addExtraBall: (seconds) => extraBalls.push(seconds),
      warpLampsFor: (caller) => (caller === roll4 ? [lite30, lite196] : undefined),
      missSound: 'clunk',
    });
    return { lite17, lite18, lite30, lite196, roll4, extraBalls, control, ...context() };
  }

  test('with the extra-ball lamp lit the ball is BANKED, not returned', () => {
    // `table_add_extra_ball(2)` — the ball is credited for later. The out lane still drains this one.
    const b = build({ lit17: true });

    b.control('ControlCollision', b.roll4, b.ctx);

    expect(b.extraBalls).toEqual([2]);
    expect(b.lite17.on).toBe(false);
    expect(b.lite18.on).toBe(false);
  });

  test('with the lamp dark there is only a noise', () => {
    const b = build();

    b.control('ControlCollision', b.roll4, b.ctx);

    expect(b.extraBalls).toEqual([]);
    expect(b.sounds).toEqual(['clunk']);
  });

  test('a lit warp lamp on this side starts flashing on the way past', () => {
    const b = build({ lit30: true });

    b.control('ControlCollision', b.roll4, b.ctx);

    expect(b.lite30.log).toContain('flash');
    expect(b.lite196.log).toContain('flash');
  });

  test('a dark warp lamp is left alone', () => {
    const b = build({ lit30: false });

    b.control('ControlCollision', b.roll4, b.ctx);

    expect(b.lite196.log).toEqual([]);
  });

  test('the other side has no warp lamps of its own here', () => {
    const b = build({ lit30: true });

    b.control('ControlCollision', component('roll5'), b.ctx);

    expect(b.lite30.log).toEqual([]);
    expect(b.ctx.score.curScore).toBe(1000);
  });
});

describe('the extra-ball lamp expires', () => {
  function build() {
    const lamps = [fakeLight(), fakeLight()];
    const control = makeExtraBallLightControl({ lamps });
    return { lamps, control, ...context() };
  }

  test('lighting it gives the player 55 seconds to collect', () => {
    const b = build();

    b.control('TLightResetAndTurnOn', component('lite17'), b.ctx);

    expect(b.lamps.map((l) => l.log)).toEqual([['onTimed:55'], ['onTimed:55']]);
  });

  test('the timer expiring flashes the lamps out', () => {
    const b = build();
    b.control('TLightResetAndTurnOn', component('lite17'), b.ctx);

    b.control('ControlTimerExpired', component('lite17'), b.ctx);

    expect(b.lamps[0]!.log).toEqual(['onTimed:55', 'flashTimed:5']);
  });

  test('a timer expiring while nothing was armed does nothing', () => {
    // The flag is the whole guard: without it every unrelated light timeout would flash the pair.
    const b = build();

    b.control('ControlTimerExpired', component('lite17'), b.ctx);

    expect(b.lamps[0]!.log).toEqual([]);
  });

  test('the flash happens ONCE per arming', () => {
    const b = build();
    b.control('TLightResetAndTurnOn', component('lite17'), b.ctx);

    b.control('ControlTimerExpired', component('lite17'), b.ctx);
    b.control('ControlTimerExpired', component('lite17'), b.ctx);

    expect(b.lamps[0]!.log).toEqual(['onTimed:55', 'flashTimed:5']);
  });
});

describe('the space warp: lit in one place, collected in another', () => {
  test('the warp rollover lights both return-lane lamps', () => {
    const lite27 = fakeLight();
    const lite28 = fakeLight();
    const control = makeSpaceWarpRolloverControl({ lamps: [lite27, lite28] });
    const { ctx } = context();

    control('ControlCollision', component('roll8'), ctx);

    expect(lite27.on).toBe(true);
    expect(lite28.on).toBe(true);
  });

  function build(lit: boolean) {
    const lite27 = fakeLight(lit);
    const lite59 = fakeLight(true);
    const roll6 = component('roll6', [500, 20000]);
    const control = makeReturnLaneControl({
      lanes: [{ component: roll6, lamp: lite27 }],
      warpLamp: lite59,
    });
    return { lite27, lite59, roll6, control, ...context() };
  }

  test('a return lane with its lamp lit COLLECTS it, and pays the second score', () => {
    const b = build(true);

    b.control('ControlCollision', b.roll6, b.ctx);

    expect(b.ctx.score.curScore).toBe(20000);
    expect(b.lite27.on).toBe(false);
    expect(b.lite59.on).toBe(false);
  });

  test('with the lamp dark it is an ordinary lane', () => {
    const b = build(false);

    b.control('ControlCollision', b.roll6, b.ctx);

    expect(b.ctx.score.curScore).toBe(500);
    expect(b.lite59.on).toBe(true);
  });

  test('a lane this control does not own scores nothing at all', () => {
    // Unlike the bumper lanes, which score any caller. Transcribed, not tidied.
    const b = build(true);

    b.control('ControlCollision', component('roll7'), b.ctx);

    expect(b.ctx.score.curScore).toBe(0);
  });
});

describe('the bonus lane — the OTHER place the bonus pays out', () => {
  function build(lit: boolean) {
    const lite16 = fakeLight(lit);
    const bargraph = fakeGroup(4, 12);
    const control = makeBonusLaneControl({
      lamp: lite16, bargraph, topSplitIndex: 11,
      bonusText: (points) => 'BONUS ' + points,
      missText: 'FUEL',
      collectSound: 'fanfare', missSound: 'blip',
    });
    return { lite16, bargraph, control, ...context() };
  }

  test('with its lamp lit it cashes the bonus in WITHOUT costing a ball', () => {
    // The drain is not the only payout. A lit `lite16` lets the player collect the accumulator mid-ball
    // — and the accumulator is not zeroed, so the drain will pay it again.
    const b = build(true);
    b.ctx.score.bonusScore = 120000;

    b.control('ControlCollision', component('roll13'), b.ctx);

    expect(b.ctx.score.curScore).toBe(120000);
    expect(b.ctx.score.bonusScore).toBe(120000);
    expect(b.lite16.on).toBe(false);
    expect(b.sounds).toEqual(['fanfare']);
  });

  test('the payout is unmultiplied, like every special score', () => {
    const b = build(true);
    b.ctx.score.bonusScore = 120000;
    b.ctx.score.scoreMultiplier = 4; // x10

    b.control('ControlCollision', component('roll13'), b.ctx);

    expect(b.ctx.score.curScore).toBe(120000);
  });

  test('with the lamp dark it is worth its ordinary score', () => {
    const b = build(false);
    b.ctx.score.bonusScore = 120000;

    b.control('ControlCollision', component('roll13'), b.ctx);

    expect(b.ctx.score.curScore).toBe(1000);
    expect(b.sounds).toEqual(['blip']);
  });

  test('either way it fills the fuel tank to the top', () => {
    const lit = build(true);
    const dark = build(false);

    lit.control('ControlCollision', component('roll13'), lit.ctx);
    dark.control('ControlCollision', component('roll13'), dark.ctx);

    expect(lit.bargraph.log).toEqual(['split:11']);
    expect(dark.bargraph.log).toEqual(['split:11']);
  });
});

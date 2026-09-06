// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  makeDecayingLightGroupControl, makeMultiplierLightGroupControl,
  makeAccumulatorLampControl, DECAY_PERIODS,
  type DecayingGroup,
} from '../app/js/control/light-groups.js';
import type { ControlContext, ControlledComponent } from '../app/js/control/dispatch.js';
import { createScoreState, addScore, SCORE_MULTIPLIERS } from '../app/js/control/score.js';

function fakeGroup(onCount = 3): DecayingGroup & { readonly log: string[] } {
  const log: string[] = [];
  return {
    log,
    get onCount() { return onCount; },
    turnOff() { onCount = 0; log.push('turnOff'); },
    groupResetAndTurnOn(period) { log.push('groupOn:' + period); },
    lightsResetAndTurnOn() { log.push('lightsOn'); },
    lightsResetAndTurnOff() { onCount = 0; log.push('lightsOff'); },
    restartNotifyTimer(seconds) { log.push('timer:' + seconds); },
    offsetAnimationBackward() { if (onCount > 0) onCount--; log.push('step'); },
  };
}

const component = (name: string): ControlledComponent => ({ name, scores: [], control: null });

function context() {
  const info: { text: string; seconds: number }[] = [];
  const ctx: ControlContext = {
    score: createScoreState(),
    table: { extraBalls: 0, multiballCount: 0, multiballFlag: false, ballCount: 3, tiltLocked: false },
    light: () => undefined,
    group: () => undefined,
    showInfo: (text, seconds) => info.push({ text, seconds }),
    showMission: () => {},
    playSound: () => {},
    playMusic: () => {},
    missionControl: () => {},
  };
  return { ctx, info };
}

describe('a light group that decays a step at a time', () => {
  function build(onCount = 3) {
    const group = fakeGroup(onCount);
    const control = makeDecayingLightGroupControl({ group, period: DECAY_PERIODS.hyperspace });
    return { group, control, ...context() };
  }

  test('being lit arms the decay timer', () => {
    const b = build();

    b.control('TLightGroupResetAndTurnOn', component('hyper_lights'), b.ctx);

    expect(b.group.log).toEqual(['groupOn:2', 'timer:60']);
  });

  test('each timeout takes ONE lamp back and re-arms', () => {
    // Not a lifetime after which everything goes dark: the group empties one lamp per period, so what
    // the player earned drains away visibly instead of vanishing.
    const b = build(3);

    b.control('ControlNotifyTimerExpired', component('hyper_lights'), b.ctx);

    expect(b.group.log).toEqual(['step', 'timer:60']);
    expect(b.group.onCount).toBe(2);
  });

  test('the timeout that empties the group does NOT re-arm', () => {
    const b = build(1);

    b.control('ControlNotifyTimerExpired', component('hyper_lights'), b.ctx);

    expect(b.group.log).toEqual(['step']);
  });

  test('the animation running out of lamps darkens the group', () => {
    const b = build();

    b.control('TLightGroupNull', component('hyper_lights'), b.ctx);

    expect(b.group.log).toEqual(['turnOff']);
  });

  test('the medal group is the same rule at half the period', () => {
    const group = fakeGroup();
    const control = makeDecayingLightGroupControl({ group, period: DECAY_PERIODS.medal });

    control('TLightGroupResetAndTurnOn', component('medal_lights'), context().ctx);

    expect(group.log).toEqual(['groupOn:2', 'timer:30']);
    expect(DECAY_PERIODS.medal).toBe(30);
    expect(DECAY_PERIODS.hyperspace).toBe(60);
  });

  test('a collision means nothing to a light group', () => {
    const b = build();

    b.control('ControlCollision', component('hyper_lights'), b.ctx);

    expect(b.group.log).toEqual([]);
  });
});

describe('the multiplier decays WITH its lamps', () => {
  function build(onCount = 3) {
    const group = fakeGroup(onCount);
    const control = makeMultiplierLightGroupControl({ group, enableText: 'TEN TIMES' });
    return { group, control, ...context() };
  }

  test('enabling it goes straight to the top and lights every lamp', () => {
    const b = build();

    b.control('ControlEnableMultiplier', component('top_target_lights'), b.ctx);

    expect(b.ctx.score.scoreMultiplier).toBe(4);
    expect(SCORE_MULTIPLIERS[4]).toBe(10);
    expect(b.group.log).toEqual(['lightsOn', 'timer:30']);
    expect(b.info).toEqual([{ text: 'TEN TIMES', seconds: 2 }]);
  });

  test('each timeout steps the NUMBER down as well as the lamps', () => {
    // A fifth instance of the game keeping a number in a row of lights: the multiplier is not a value
    // with a lifetime, it is whatever the lamps currently say.
    const b = build();
    b.control('ControlEnableMultiplier', component('top_target_lights'), b.ctx);

    b.control('ControlNotifyTimerExpired', component('top_target_lights'), b.ctx);

    expect(b.ctx.score.scoreMultiplier).toBe(3);
    expect(b.group.log).toContain('step');
  });

  test('it never steps below x1', () => {
    const b = build(9);

    for (let i = 0; i < 6; i++) b.control('ControlNotifyTimerExpired', component('top_target_lights'), b.ctx);

    expect(b.ctx.score.scoreMultiplier).toBe(0);
    expect(SCORE_MULTIPLIERS[0]).toBe(1);
  });

  test('disabling it stops the timer with a period that can never fire', () => {
    // `-1` is how this game switches a timer off, the same trick the escape chute sink uses to hold a
    // ball forever.
    const b = build();
    b.control('ControlEnableMultiplier', component('top_target_lights'), b.ctx);

    b.control('ControlDisableMultiplier', component('top_target_lights'), b.ctx);

    expect(b.ctx.score.scoreMultiplier).toBe(0);
    expect(b.group.log).toEqual(['lightsOn', 'timer:30', 'lightsOff', 'timer:-1']);
  });

  test('the multiplier really is applied while it lasts', () => {
    const b = build();
    b.control('ControlEnableMultiplier', component('top_target_lights'), b.ctx);

    addScore(b.ctx.score, 1000);

    expect(b.ctx.score.curScore).toBe(10000);
  });
});

describe('the accumulator lamps switch their flag off when they expire', () => {
  test('the jackpot lamp expiring stops the jackpot growing', () => {
    // The flag is what makes every point scored also feed the accumulator; the lamp's own timeout is
    // the only thing that ends it.
    const control = makeAccumulatorLampControl({ flag: 'jackpot' });
    const { ctx } = context();
    ctx.score.jackpotScoreFlag = true;
    ctx.score.bonusScoreFlag = true;

    control('ControlTimerExpired', component('lite60'), ctx);

    expect(ctx.score.jackpotScoreFlag).toBe(false);
    // They are two separate windows on two separate lamps; ending one must not end the other.
    expect(ctx.score.bonusScoreFlag).toBe(true);
  });

  test('the bonus lamp does the same for the bonus', () => {
    const control = makeAccumulatorLampControl({ flag: 'bonus' });
    const { ctx } = context();
    ctx.score.bonusScoreFlag = true;
    ctx.score.jackpotScoreFlag = true;

    control('ControlTimerExpired', component('lite61'), ctx);

    expect(ctx.score.bonusScoreFlag).toBe(false);
    expect(ctx.score.jackpotScoreFlag).toBe(true);
  });

  test('a collision does not end the accumulator', () => {
    const control = makeAccumulatorLampControl({ flag: 'bonus' });
    const { ctx } = context();
    ctx.score.bonusScoreFlag = true;

    control('ControlCollision', component('lite61'), ctx);

    expect(ctx.score.bonusScoreFlag).toBe(true);
  });
});

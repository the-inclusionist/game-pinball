// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  makeTargetBankControl, makeMultiplierBankControl, makeSpotTargetControl,
  makeKickerControl, makeGateLightControl, type FieldComponent,
} from '../app/js/control/controls.js';
import type { ControlContext } from '../app/js/control/dispatch.js';
import { createScoreState, SCORE_MULTIPLIERS } from '../app/js/control/score.js';

const target = (name: string, scores: readonly number[] = [500, 5000]): FieldComponent =>
  ({ name, scores, control: null, messageField: 0 });

function context() {
  const info: { text: string; seconds: number }[] = [];
  const sounds: string[] = [];
  const ctx: ControlContext = {
    score: createScoreState(),
    table: { extraBalls: 0, multiballCount: 1, ballCount: 3, tiltLocked: false },
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

describe('target bank — completion is the members’ fields summing', () => {
  function build() {
    const bank = [target('target1'), target('target2'), target('target3')];
    const poppedUp: string[] = [];
    const completions: number[] = [];
    const control = makeTargetBankControl({
      bank,
      onComplete: () => completions.push(1),
      popUp: (t) => poppedUp.push(t.name),
    });
    return { bank, control, poppedUp, completions, ...context() };
  }

  test('an incomplete bank pays partial credit', () => {
    const { bank, control, ctx, completions } = build();

    control('ControlCollision', bank[0]!, ctx);

    expect(ctx.score.curScore).toBe(500);
    expect(completions).toEqual([]);
  });

  test('the LAST target completes the bank and pays the completion score', () => {
    const { bank, control, ctx, completions } = build();

    bank.forEach((t) => control('ControlCollision', t, ctx));

    expect(completions).toEqual([1]);
    expect(ctx.score.curScore).toBe(500 + 500 + 5000);
  });

  test('hitting the SAME target twice does not count twice', () => {
    // `!caller->MessageField` is the whole guard. Without it three hits on one target would complete a
    // bank of three.
    const { bank, control, ctx, completions } = build();

    control('ControlCollision', bank[0]!, ctx);
    control('ControlCollision', bank[0]!, ctx);
    control('ControlCollision', bank[0]!, ctx);

    expect(completions).toEqual([]);
    expect(ctx.score.curScore).toBe(500);
  });

  test('completing CLEARS every field and sends every target back up', () => {
    // Which answers what the popup target left open: it does not raise itself because the BANK raises
    // it. The piece cannot know the round is over; only the group can.
    const { bank, control, ctx, poppedUp } = build();

    bank.forEach((t) => control('ControlCollision', t, ctx));

    expect(bank.every((t) => t.messageField === 0)).toBe(true);
    expect(poppedUp).toEqual(['target1', 'target2', 'target3']);
  });

  test('after completing, the bank can be filled again', () => {
    const { bank, control, ctx, completions } = build();
    bank.forEach((t) => control('ControlCollision', t, ctx));

    bank.forEach((t) => control('ControlCollision', t, ctx));

    expect(completions).toEqual([1, 1]);
  });
});

describe('multiplier bank — the number of lit lamps IS the multiplier', () => {
  function build(lampCount = 4) {
    const bank = [target('target9', [500, 1500]), target('target8', [500, 1500]), target('target7', [500, 1500])];
    let lit = 0;
    const lightGroup = {
      turnOnNext: () => { if (lit < lampCount) { lit++; return true; } return false; },
      get onCount() { return lit; },
    };
    const control = makeMultiplierBankControl({
      bank, lightGroup, popUp: () => {},
      multiplierTexts: ['DOUBLE', 'TRIPLE', 'QUINTUPLE', 'TEN TIMES'],
    });
    return { bank, control, ...context() };
  }

  test('completing the bank once sets the multiplier to the second entry', () => {
    // A fourth place the game keeps a number in a row of lights rather than a variable.
    const { bank, control, ctx } = build();

    bank.forEach((t) => control('ControlCollision', t, ctx));

    expect(ctx.score.scoreMultiplier).toBe(1);
    expect(SCORE_MULTIPLIERS[1]).toBe(2);
  });

  test('completing it three times climbs to the fourth entry', () => {
    const { bank, control, ctx } = build();

    for (let round = 0; round < 3; round++) bank.forEach((t) => control('ControlCollision', t, ctx));

    expect(ctx.score.scoreMultiplier).toBe(3);
    expect(SCORE_MULTIPLIERS[3]).toBe(5);
  });

  test('past the fourth lamp it stops climbing', () => {
    const { bank, control, ctx } = build();

    for (let round = 0; round < 6; round++) bank.forEach((t) => control('ControlCollision', t, ctx));

    expect(ctx.score.scoreMultiplier).toBe(4); // x10, the top
  });

  test('each step announces itself', () => {
    const { bank, control, ctx, info } = build();

    bank.forEach((t) => control('ControlCollision', t, ctx));

    expect(info).toEqual([{ text: 'DOUBLE', seconds: 2 }]);
  });
});

describe('spot targets — the memory lives in the LAMPS', () => {
  function build() {
    const targets = [target('target10', [750]), target('target11', [750]), target('target12', [750])];
    let lit = 0;
    const lamps = targets.map(() => ({ flasherStartTimedThenStayOn: () => { lit++; } }));
    const group = { get onCount() { return lit; }, flashWhenOn: () => { lit = 0; } };
    const completions: number[] = [];
    const control = makeSpotTargetControl({
      targets, lamps, group,
      onComplete: () => completions.push(1),
      hitSound: 'blip', completeSound: 'fanfare',
    });
    return { targets, control, completions, ...context() };
  }

  test('each target lights its own lamp and scores', () => {
    const { targets, control, ctx, sounds } = build();

    control('ControlCollision', targets[0]!, ctx);

    expect(ctx.score.curScore).toBe(750);
    expect(sounds).toEqual(['blip']);
  });

  test('the group being fully lit completes the set', () => {
    const { targets, control, ctx, completions, sounds } = build();

    targets.forEach((t) => control('ControlCollision', t, ctx));

    expect(completions).toEqual([1]);
    expect(sounds).toEqual(['blip', 'blip', 'fanfare']);
  });

  test('a target that is not part of the set is ignored', () => {
    const { control, ctx } = build();

    control('ControlCollision', target('some_other'), ctx);

    expect(ctx.score.curScore).toBe(0);
  });
});

describe('kickers — the whole control is putting the gate back', () => {
  test('the timer expiring shuts the gate again', () => {
    const shut: number[] = [];
    const control = makeKickerControl({ gate: { shutGate: () => shut.push(1) }, isEasyMode: () => false });
    const { ctx } = context();

    control('ControlTimerExpired', null as never, ctx);

    expect(shut).toEqual([1]);
  });

  test('in EASY MODE the gate is never put back', () => {
    // Which is how the option makes the outlanes forgiving without touching the geometry.
    const shut: number[] = [];
    const control = makeKickerControl({ gate: { shutGate: () => shut.push(1) }, isEasyMode: () => true });
    const { ctx } = context();

    control('ControlTimerExpired', null as never, ctx);

    expect(shut).toEqual([]);
  });

  test('a collision on the kicker itself does nothing', () => {
    const shut: number[] = [];
    const control = makeKickerControl({ gate: { shutGate: () => shut.push(1) }, isEasyMode: () => false });
    const { ctx } = context();

    control('ControlCollision', null as never, ctx);

    expect(shut).toEqual([]);
  });
});

describe('gate lamps — the only place an open outlane is announced', () => {
  test('opening lights the lamps and shutting darkens them', () => {
    const calls: string[] = [];
    const lamp = {
      flasherStartTimedThenStayOn: (s: number) => calls.push(`stayOn:${s}`),
      flasherStartTimed: (s: number) => calls.push(`timed:${s}`),
      turnOff: () => calls.push('off'),
      resetTimed: () => calls.push('reset'),
    };
    const setLights = makeGateLightControl({ lamps: [lamp] });

    setLights(true);
    setLights(false);

    expect(calls).toEqual(['stayOn:5', 'off', 'reset']);
  });
});

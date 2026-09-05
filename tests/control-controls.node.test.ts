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

describe('⚠️ and WHEN the completing score is paid is a rule, not a style', () => {
  test('the hit that raises the multiplier is paid at the OLD one', () => {
    // `MultiplierTargetControl` calls `AddScore(get_scoring(1))` FIRST and raises the multiplier
    // after; `BoosterTargetControl` pays last, after its awards. One line's difference, and since
    // `addScore` multiplies by the current multiplier, paying the completing hit afterwards settles it
    // at the new one — the hit that doubles the table pays double for itself, for ever, and the score
    // is merely generous rather than visibly wrong.
    const bank = [target('target9', [500, 1500]), target('target8', [500, 1500]),
      target('target7', [500, 1500])];
    let lit = 0;
    const lightGroup = {
      turnOnNext: () => { lit++; return true; },
      get onCount() { return lit; },
    };
    const control = makeMultiplierBankControl({
      bank, lightGroup, popUp: () => {}, multiplierTexts: ['DOUBLE'],
    });
    const { ctx } = context();

    bank.forEach((t) => control('ControlCollision', t, ctx));

    // Two partial hits at multiplier index 0, then the completing 1500 — also at index 0.
    expect(ctx.score.scoreMultiplier).toBe(1);
    expect(ctx.score.curScore).toBe(500 + 500 + 1500);
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

  test('the HAZARD variants remember the same hit TWICE, in different places', () => {
    // One bit per target in a lamp's message field, alongside the lamps themselves. The lamps are
    // flashed off when the set completes; the mask is not, and only the mission that reads it ever
    // clears it. Two memories of one event, with different lifetimes — see `control/two-stage`.
    const targets = [target('target16', [750]), target('target17', [750]), target('target18', [750])];
    let lit = 0;
    const maskLamp = { messageField: 0 };
    const control = makeSpotTargetControl({
      targets,
      lamps: targets.map(() => ({ flasherStartTimedThenStayOn: () => { lit++; } })),
      group: { get onCount() { return lit; }, flashWhenOn: () => { lit = 0; } },
      onComplete: () => {},
      hitSound: 'blip', completeSound: 'fanfare',
      maskLamp,
    });
    const { ctx } = context();

    control('ControlCollision', targets[0]!, ctx);
    control('ControlCollision', targets[2]!, ctx);

    expect(maskLamp.messageField).toBe(0b101);
  });

  test('completing the set does NOT clear the mask', () => {
    const targets = [target('target16', [750]), target('target17', [750]), target('target18', [750])];
    let lit = 0;
    const maskLamp = { messageField: 0 };
    const control = makeSpotTargetControl({
      targets,
      lamps: targets.map(() => ({ flasherStartTimedThenStayOn: () => { lit++; } })),
      group: { get onCount() { return lit; }, flashWhenOn: () => { lit = 0; } },
      onComplete: () => {},
      hitSound: 'blip', completeSound: 'fanfare',
      maskLamp,
    });
    const { ctx } = context();

    targets.forEach((t) => control('ControlCollision', t, ctx));

    expect(maskLamp.messageField).toBe(0b111);
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
  const fakeLamp = (calls: string[], tag: string) => ({
    flasherStartTimedThenStayOn: (s: number) => calls.push(`${tag}:stayOn:${s}`),
    flasherStartTimed: (s: number) => calls.push(`${tag}:timed:${s}`),
    turnOff: () => calls.push(`${tag}:off`),
    resetTimed: () => calls.push(`${tag}:reset`),
  });

  test('opening lights the lamp and shutting darkens it', () => {
    const calls: string[] = [];
    const setLights = makeGateLightControl({ lamps: [fakeLamp(calls, 'a')] });

    setLights(true);
    setLights(false);

    expect(calls).toEqual(['a:stayOn:5', 'a:off', 'a:reset']);
  });

  test('⚠️ the SECOND lamp flashes and goes out; only the first one stays lit', () => {
    // `lite30->TLightFlasherStartTimedThenStayOn(5)` and `lite196->TLightFlasherStartTimed(5)`. The
    // first settles LIT — it is the standing announcement that the outlane is survivable — and the
    // second settles back to whatever it was, which is dark. Giving both the staying form leaves the
    // second lit for the rest of the ball, and a lamp that never goes out stops meaning anything.
    //
    // ⚠️ THE TEST ABOVE COULD NOT SEE THIS: it passes ONE lamp, and with one lamp the two forms are
    // indistinguishable. The pair is the whole rule.
    const calls: string[] = [];
    const setLights = makeGateLightControl({ lamps: [fakeLamp(calls, 'a'), fakeLamp(calls, 'b')] });

    setLights(true);

    expect(calls).toEqual(['a:stayOn:5', 'b:timed:5']);
  });

  test('and shutting darkens BOTH, with no flash', () => {
    const calls: string[] = [];
    const setLights = makeGateLightControl({ lamps: [fakeLamp(calls, 'a'), fakeLamp(calls, 'b')] });

    setLights(false);

    expect(calls).toEqual(['a:off', 'a:reset', 'b:off', 'b:reset']);
  });
});

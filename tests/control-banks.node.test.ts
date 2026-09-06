// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  makeBoosterTargetControl, makeMedalTargetControl, makeFlipperLightControl,
  MISSIONS_WITHOUT_FLAG_LIGHTS, type BankTarget, type AwardChainStep,
} from '../app/js/control/banks.js';
import type { LaneLight } from '../app/js/control/lanes.js';
import type { ControlContext } from '../app/js/control/dispatch.js';
import { createScoreState } from '../app/js/control/score.js';

function fakeLight(on = false): LaneLight & { readonly log: string[] } {
  const log: string[] = [];
  return {
    log,
    get lit() { return on; },
    get flashing() { return false; },
    turnOn() { on = true; log.push('on'); },
    turnOff() { on = false; log.push('off'); },
    turnOnTimed(s: number) { on = true; log.push('onTimed:' + s); },
    turnOffTimed(s: number) { log.push('offTimed:' + s); },
    flasherStart() { log.push('flash'); },
    flasherStartTimed(s: number) { log.push('flashTimed:' + s); },
    resetTimed() { log.push('reset'); },
  };
}

const target = (name: string, scores: readonly number[] = [500, 20000, 40000]): BankTarget =>
  ({ name, scores, control: null, messageField: 0 });

function context() {
  const info: { text: string; seconds: number }[] = [];
  const sounds: string[] = [];
  const ctx: ControlContext = {
    score: createScoreState(),
    table: { extraBalls: 0, multiballCount: 0, multiballFlag: false, ballCount: 3, tiltLocked: false },
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

describe('the booster bank walks an award CHAIN, one rung per completion', () => {
  function build(o: { lit?: number; mission?: number } = {}) {
    // The chain is [flag lamp, jackpot lamp, bonus lamp, bonus-hold lamp]; a lit lamp means that
    // award has already been granted, so the bank grants the first DARK one.
    const lamps = [0, 1, 2, 3].map((i) => fakeLight(i < (o.lit ?? 0)));
    const granted: string[] = [];
    const names = ['flagLights', 'jackpot', 'bonus', 'bonusHold'];
    const chain: AwardChainStep[] = lamps.map((lamp, i) => ({
      lamp,
      grant: () => { lamp.turnOn(); granted.push(names[i]!); },
      sound: 'sound' + i,
    }));
    const bank = [target('target1'), target('target2'), target('target3')];
    const poppedUp: string[] = [];
    const control = makeBoosterTargetControl({
      bank, chain,
      popUp: (t) => poppedUp.push(t.name),
      missionLamp: { messageField: o.mission ?? 0 },
    });
    return { lamps, granted, bank, poppedUp, control, ...context() };
  }

  const complete = (b: ReturnType<typeof build>) =>
    b.bank.forEach((t) => b.control('ControlCollision', t, b.ctx));

  test('⚠️ and it pays the completing hit LAST, after the award it just granted', () => {
    // The mirror of the multiplier bank, which pays FIRST — and the difference is observable because
    // an award can arm the bonus accumulator. `table_set_bonus` sets `bonusScoreFlag`, and every score
    // added afterwards is banked into the bonus as well. The original's `AddScore` is the last line of
    // the branch, so the completing twenty thousand IS banked; paying it first would leave the bonus
    // short by exactly that, every time the bank completes. The two partial hits are not banked,
    // because the flag was not armed when they were paid.
    // Its own chain, because the award under test is the one that ARMS the accumulator.
    const { ctx } = context();
    const lamps = [0, 1, 2, 3].map((i) => fakeLight(i < 2)); // flag lights and jackpot already granted
    const chain: AwardChainStep[] = lamps.map((lamp, i) => ({
      lamp,
      grant: () => { lamp.turnOn(); if (i === 2) ctx.score.bonusScoreFlag = true; },
      sound: 'sound' + i,
    }));
    const bank = [target('target1'), target('target2'), target('target3')];
    const control = makeBoosterTargetControl({
      bank, chain, popUp: () => {}, missionLamp: { messageField: 0 },
    });

    bank.forEach((t) => control('ControlCollision', t, ctx));

    expect(ctx.score.bonusScore).toBe(20000);
  });

  test('an incomplete bank only pays partial credit', () => {
    const b = build();

    b.control('ControlCollision', b.bank[0]!, b.ctx);

    expect(b.ctx.score.curScore).toBe(500);
    expect(b.granted).toEqual([]);
  });

  test('the first completion grants the FIRST award in the chain', () => {
    const b = build({ lit: 0 });

    complete(b);

    expect(b.granted).toEqual(['flagLights']);
    expect(b.sounds).toEqual(['sound0']);
  });

  test('each further completion grants the next, because the award lit its own lamp', () => {
    // `table_set_flag_lights` lights lite61, `table_set_jackpot` lights lite60, and so on — every
    // award lights exactly the lamp the next step tests. The nested `if`s are a linear search for the
    // first dark lamp, and the awards themselves are what advance it.
    const b = build({ lit: 0 });

    complete(b);
    complete(b);
    complete(b);

    expect(b.granted).toEqual(['flagLights', 'jackpot', 'bonus']);
  });

  test('a lamp going dark again puts that rung BACK', () => {
    // Three of the four lamps are lit with a sixty-second timer, so the chain is not a ratchet. It
    // slides back as the awards expire, and the bank refills whichever one lapsed.
    const b = build({ lit: 3 });

    b.lamps[1]!.turnOff();
    complete(b);

    expect(b.granted).toEqual(['jackpot']);
  });

  test('with the whole chain lit the completion pays the top score TWICE', () => {
    // `AddScore(get_scoring(1))` inside the deepest branch, and the shared tail adds it again. It
    // reads like a slip and it is observable, so it is transcribed: 20000 + 20000.
    const b = build({ lit: 4 });

    complete(b);

    expect(b.granted).toEqual([]);
    expect(b.ctx.score.curScore).toBe(500 + 500 + 20000 + 20000);
  });

  test('two missions block the first award, and nothing takes its place', () => {
    // No award, no sound — but the bank still completes, the targets still pop up and the completion
    // score is still paid. The player cannot tell they were refused except by the silence.
    for (const mission of MISSIONS_WITHOUT_FLAG_LIGHTS) {
      const b = build({ lit: 0, mission });

      complete(b);

      expect(b.granted).toEqual([]);
      expect(b.sounds).toEqual([]);
      expect(b.ctx.score.curScore).toBe(500 + 500 + 20000);
      expect(b.poppedUp).toHaveLength(3);
    }
  });

  test('the mission block applies ONLY to the first rung', () => {
    const b = build({ lit: 1, mission: MISSIONS_WITHOUT_FLAG_LIGHTS[0]! });

    complete(b);

    expect(b.granted).toEqual(['jackpot']);
  });

  test('completing clears the bank and sends every target back up', () => {
    const b = build();

    complete(b);

    expect(b.bank.every((t) => t.messageField === 0)).toBe(true);
    expect(b.poppedUp).toEqual(['target1', 'target2', 'target3']);
  });
});

describe('the medal bank is a third ladder, counted in lamps', () => {
  function build(lit = 0) {
    let onCount = lit;
    const group = {
      get onCount() { return onCount; },
      lightOneMore() { onCount++; },
    };
    const bank = [target('target4', [750, 25000, 50000]), target('target5', [750, 25000, 50000]),
      target('target6', [750, 25000, 50000])];
    const extraBalls: number[] = [];
    const poppedUp: string[] = [];
    const control = makeMedalTargetControl({
      bank, group,
      addExtraBall: (s) => extraBalls.push(s),
      popUp: (t) => poppedUp.push(t.name),
      texts: ['BRONZE', 'SILVER', 'GOLD'],
    });
    return { group, bank, extraBalls, poppedUp, control, ...context() };
  }

  const complete = (b: ReturnType<typeof build>) =>
    b.bank.forEach((t) => b.control('ControlCollision', t, b.ctx));

  test('the first completion lights one medal and pays the second score', () => {
    // The award is `onCount - 1` AFTER lighting, which is the same "read the row of lamps" trick as
    // the hyperspace ladder, arrived at from the other side.
    const b = build(0);

    complete(b);

    expect(b.ctx.score.curScore).toBe(750 + 750 + 25000);
    expect(b.info).toEqual([{ text: 'BRONZE', seconds: 2 }]);
  });

  test('the second pays the third score', () => {
    const b = build(1);

    complete(b);

    expect(b.ctx.score.curScore).toBe(750 + 750 + 50000);
    expect(b.info).toEqual([{ text: 'SILVER', seconds: 2 }]);
  });

  test('the third and every one after it is an EXTRA BALL and no score at all', () => {
    const third = build(2);
    const fourth = build(5);

    complete(third);
    complete(fourth);

    expect(third.extraBalls).toEqual([4]);
    expect(third.ctx.score.curScore).toBe(750 + 750);
    expect(fourth.extraBalls).toEqual([4]);
  });

  test('an incomplete bank pays partial credit and lights nothing', () => {
    const b = build(0);

    b.control('ControlCollision', b.bank[0]!, b.ctx);

    expect(b.ctx.score.curScore).toBe(750);
    expect(b.group.onCount).toBe(0);
  });

  test('the same target twice does not count twice', () => {
    const b = build(0);

    b.control('ControlCollision', b.bank[0]!, b.ctx);
    b.control('ControlCollision', b.bank[0]!, b.ctx);

    expect(b.ctx.score.curScore).toBe(750);
  });

  test('completing clears the bank and pops the targets up', () => {
    const b = build(0);

    complete(b);

    expect(b.bank.every((t) => t.messageField === 0)).toBe(true);
    expect(b.poppedUp).toEqual(['target4', 'target5', 'target6']);
  });
});

describe('flipping ROTATES the lane lamps', () => {
  test('the left flipper steps both bumper-lane groups backward', () => {
    // Not decoration. The flippers are an input to the lane puzzle: a player who needs the lamp on
    // the other side can flip to move it there, without the ball going anywhere near a lane.
    const steps: string[] = [];
    const groups = [
      { stepForward: () => steps.push('a:fwd'), stepBackward: () => steps.push('a:back') },
      { stepForward: () => steps.push('b:fwd'), stepBackward: () => steps.push('b:back') },
    ];
    const control = makeFlipperLightControl({ groups, direction: 'backward' });
    const { ctx } = context();

    control('TLightTurnOn', target('flip1'), ctx);

    expect(steps).toEqual(['a:back', 'b:back']);
  });

  test('the right flipper steps them the other way', () => {
    const steps: string[] = [];
    const groups = [{ stepForward: () => steps.push('fwd'), stepBackward: () => steps.push('back') }];
    const control = makeFlipperLightControl({ groups, direction: 'forward' });
    const { ctx } = context();

    control('TLightTurnOn', target('flip2'), ctx);

    expect(steps).toEqual(['fwd']);
  });

  test('a COLLISION with a flipper moves nothing — only the flip itself does', () => {
    const steps: string[] = [];
    const groups = [{ stepForward: () => steps.push('fwd'), stepBackward: () => steps.push('back') }];
    const control = makeFlipperLightControl({ groups, direction: 'forward' });
    const { ctx } = context();

    control('ControlCollision', target('flip2'), ctx);

    expect(steps).toEqual([]);
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  makeHyperspaceKickOutControl, awardEverything, JACKPOT_AFTER_COLLECT, AWARD_FLOOR,
  type HyperspaceKickOutOptions, type EverythingAwardOptions,
} from '../app/js/control/hyperspace.js';
import type { LaneLight } from '../app/js/control/lanes.js';
import type { ControlContext, ControlledComponent } from '../app/js/control/dispatch.js';
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

/** The kickout's own scores: index 0 and then 2, 3, 4 for the ladder. Index 1 is never used. */
const KICKOUT_SCORES = [7500, 0, 15000, 30000, 60000];

const component = (name = 'kickout1', scores: readonly number[] = KICKOUT_SCORES): ControlledComponent =>
  ({ name, scores, control: null });

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

function build(o: { lit?: number; reflex?: boolean; second?: boolean; everything?: boolean } = {}) {
  let onCount = o.lit ?? 0;
  const calls: string[] = [];
  const table = { jackpotScore: 250000 };
  const lamps = {
    reflex: fakeLight(o.reflex ?? false),
    second: fakeLight(o.second ?? false),
    everything: fakeLight(o.everything ?? false),
  };
  const kickout = { restarts: [] as number[], restartTimer(s: number) { this.restarts.push(s); } };
  const options: HyperspaceKickOutOptions = {
    lights: { get onCount() { return onCount; }, turnOff() { onCount = 0; calls.push('lightsOff'); } },
    lightOneMore: () => { onCount++; calls.push('lightOneMore'); },
    table,
    reflexScore: () => 25000,
    lamps,
    raiseBlocker: () => calls.push('raiseBlocker'),
    armExtraBallLamp: () => calls.push('armExtraBall'),
    armGravityWell: (points) => calls.push('gravityWell:' + points),
    awardEverything: () => calls.push('everything'),
    kickout,
    texts: {
      plain: (n) => 'HYPERSPACE ' + n,
      jackpot: (n) => 'JACKPOT ' + n,
      blocker: (n) => 'BLOCKER ' + n,
      extraBall: (n) => 'EXTRA BALL ' + n,
      reflex: (n) => 'REFLEX ' + n,
    },
    sounds: {
      reflexOnly: 'reflex', pair: 'pair', fanfare: ['a', 'b', 'c'],
      ladder: { 1: 'l1', 2: 'l2', 3: 'l3', 4: 'l4' }, ladderDefault: 'l0',
    },
    playSound: (name) => { calls.push('sound:' + name); return 2.5; },
  };
  return { options, table, lamps, kickout, calls, control: makeHyperspaceKickOutControl(options), ...context() };
}

describe('the hyperspace ladder is the LAMP COUNT, read before it grows', () => {
  test('the first visit is worth its plain score', () => {
    const b = build({ lit: 0 });

    b.control('ControlCollision', component(), b.ctx);

    expect(b.ctx.score.curScore).toBe(7500);
    expect(b.info[0]).toEqual({ text: 'HYPERSPACE 7500', seconds: 2 });
    expect(b.calls).toContain('lightOneMore');
  });

  test('the second COLLECTS the jackpot and resets it', () => {
    // The accumulator that has been growing all game is spent here, unmultiplied, and immediately
    // dropped to a small starting value. Collecting the jackpot is what makes the next one small.
    const b = build({ lit: 1 });
    b.ctx.score.scoreMultiplier = 4; // x10

    b.control('ControlCollision', component(), b.ctx);

    expect(b.ctx.score.curScore).toBe(250000);
    expect(b.table.jackpotScore).toBe(JACKPOT_AFTER_COLLECT);
    expect(JACKPOT_AFTER_COLLECT).toBe(20000);
  });

  test('the third raises the drain blocker', () => {
    const b = build({ lit: 2 });

    b.control('ControlCollision', component(), b.ctx);

    expect(b.calls).toContain('raiseBlocker');
    expect(b.ctx.score.curScore).toBe(15000);
  });

  test('the fourth arms the extra ball', () => {
    const b = build({ lit: 3 });

    b.control('ControlCollision', component(), b.ctx);

    expect(b.calls).toContain('armExtraBall');
    expect(b.ctx.score.curScore).toBe(30000);
  });

  test('the fifth CLEARS the lamps and arms the gravity well with what it just paid', () => {
    // The ladder restarts, so the reward cycle is renewable — and the score just added is handed to
    // the gravity well to announce, which is the one place a score becomes an argument.
    const b = build({ lit: 4 });

    b.control('ControlCollision', component(), b.ctx);

    expect(b.calls).toContain('lightsOff');
    expect(b.calls).toContain('gravityWell:60000');
  });

  test('the ladder is read BEFORE the lamp is lit', () => {
    // `activeCount` is read first and the group lit second. Reading it the other way round would skip
    // the plain-score rung entirely and start every ball at the jackpot.
    const b = build({ lit: 0 });

    b.control('ControlCollision', component(), b.ctx);

    expect(b.table.jackpotScore).toBe(250000);
    expect(b.ctx.score.curScore).toBe(7500);
  });

  test('anything but a collision is ignored', () => {
    const b = build({ lit: 2 });

    b.control('ControlTimerExpired', component(), b.ctx);

    expect(b.calls).toEqual([]);
  });
});

describe('the three lamps on top of the ladder', () => {
  test('the reflex lamp pays its own score, unmultiplied', () => {
    const b = build({ lit: 0, reflex: true });
    b.ctx.score.scoreMultiplier = 4;

    b.control('ControlCollision', component(), b.ctx);

    expect(b.info.some((i) => i.text === 'REFLEX 25000')).toBe(true);
    expect(b.calls).toContain('sound:reflex');
  });

  test('the reflex lamp alone gets its own sound', () => {
    const b = build({ lit: 0, reflex: true });

    b.control('ControlCollision', component(), b.ctx);

    expect(b.calls.filter((c) => c.startsWith('sound:'))).toEqual(['sound:reflex']);
  });

  test('the second lamp changes only the sound', () => {
    const b = build({ lit: 0, second: true });

    b.control('ControlCollision', component(), b.ctx);

    expect(b.calls.filter((c) => c.startsWith('sound:'))).toEqual(['sound:pair']);
  });

  test('the EVERYTHING lamp fires the whole award and a three-part fanfare', () => {
    const b = build({ lit: 0, everything: true });

    b.control('ControlCollision', component(), b.ctx);

    expect(b.calls).toContain('everything');
    expect(b.calls.filter((c) => c.startsWith('sound:'))).toEqual(['sound:a', 'sound:b', 'sound:c']);
  });

  test('and it is spent: the lamp goes out', () => {
    const b = build({ lit: 0, everything: true });

    b.control('ControlCollision', component(), b.ctx);

    expect(b.lamps.everything.lit).toBe(false);
  });

  test('the fanfare flashes the reflex lamp for LONGER than an ordinary hit', () => {
    // duration + 5 rather than a flat 5, and the ball is held for the sound's own length either way.
    const big = build({ lit: 0, everything: true });
    const ordinary = build({ lit: 0 });

    big.control('ControlCollision', component(), big.ctx);
    ordinary.control('ControlCollision', component(), ordinary.ctx);

    expect(big.lamps.reflex.log).toEqual(['flashTimed:7.5']);
    expect(ordinary.lamps.reflex.log).toEqual(['flashTimed:5']);
    expect(big.kickout.restarts).toEqual([2.5]);
    expect(ordinary.kickout.restarts).toEqual([2.5]);
  });
});

describe('with no lamps lit the sound comes from the ladder', () => {
  test('each rung has its own noise, and the first has the default', () => {
    const heard: string[] = [];
    for (const lit of [0, 1, 2, 3, 4]) {
      const b = build({ lit });
      b.control('ControlCollision', component(), b.ctx);
      heard.push(b.calls.filter((c) => c.startsWith('sound:'))[0]!);
    }

    expect(heard).toEqual(['sound:l0', 'sound:l1', 'sound:l2', 'sound:l3', 'sound:l4']);
  });
});

describe('the everything award, on its own', () => {
  function build(o: { multiball?: boolean; jackpot?: number; bonus?: number } = {}) {
    const calls: string[] = [];
    const table = { jackpotScore: o.jackpot ?? 10000, multiballFlag: o.multiball ?? false };
    const score = createScoreState();
    score.bonusScore = o.bonus ?? 10000;
    const lamps = [fakeLight(), fakeLight()];
    const options: EverythingAwardOptions = {
      table, score, warpLamps: lamps,
      enableMultiplier: () => calls.push('multiplier'),
      lightBumperTargets: () => calls.push('bumperTargets'),
      setJackpot: () => calls.push('setJackpot'),
      setBonus: () => calls.push('setBonus'),
      setFlagLights: () => calls.push('flagLights'),
      setBonusHold: () => calls.push('bonusHold'),
      armExtraBallLamp: () => calls.push('armExtraBall'),
      raiseBlocker: () => calls.push('raiseBlocker'),
      setMultiball: (seconds) => calls.push('multiball:' + seconds),
      multiballSound: () => 3,
      armGravityWell: () => calls.push('gravityWell'),
    };
    return { options, table, score, lamps, calls };
  }

  test('it fires eleven awards in a straight line', () => {
    const b = build();

    awardEverything(b.options);

    expect(b.calls).toEqual([
      'multiplier', 'bumperTargets', 'setJackpot', 'setBonus', 'flagLights', 'bonusHold',
      'armExtraBall', 'raiseBlocker', 'gravityWell',
    ]);
    expect(b.lamps.every((l) => l.lit)).toBe(true);
  });

  test('multiball is started only when the table is already in multiball', () => {
    const off = build({ multiball: false });
    const on = build({ multiball: true });

    awardEverything(off.options);
    awardEverything(on.options);

    expect(off.calls).not.toContain('multiball:3');
    expect(on.calls).toContain('multiball:3');
  });

  test('it puts a FLOOR under the jackpot and the bonus, and does not lower them', () => {
    const low = build({ jackpot: 10000, bonus: 10000 });
    const high = build({ jackpot: 900000, bonus: 900000 });

    awardEverything(low.options);
    awardEverything(high.options);

    expect(low.table.jackpotScore).toBe(AWARD_FLOOR);
    expect(low.score.bonusScore).toBe(AWARD_FLOOR);
    expect(AWARD_FLOOR).toBe(100000);
    expect(high.table.jackpotScore).toBe(900000);
    expect(high.score.bonusScore).toBe(900000);
  });
});

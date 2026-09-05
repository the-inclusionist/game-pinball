// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { createScoreState, addScore, specialAddScore, SCORE_MULTIPLIERS } from '../app/js/control/score.js';
import { addRankProgress, RANK_COUNT } from '../app/js/control/rank.js';
import { createLight, type Light } from '../app/js/table/light.js';
import { createLightGroup } from '../app/js/table/light-group.js';
import type { TimerService } from '../app/js/table/bumper.js';

describe('score — the multipliers', () => {
  test('the multiplier is an INDEX, not a factor', () => {
    const s = createScoreState();
    s.scoreMultiplier = 4; // the fifth entry, which is x10

    expect(addScore(s, 100)).toBe(1000);
    expect(SCORE_MULTIPLIERS[4]).toBe(10);
  });

  test('scoreAdded is a flat bonus that is NOT multiplied', () => {
    // added = scoreAdded + score * multiplier. The flat part sits outside the multiplication.
    const s = createScoreState();
    s.scoreMultiplier = 1; // x2
    s.scoreAdded = 500;

    expect(addScore(s, 100)).toBe(700); // 500 + 200, not (500 + 100) * 2
  });
});

describe('score — the jackpot and the bonus shadow the score', () => {
  test('while its flag is on, the jackpot grows by everything scored', () => {
    // They are not awards a mission hands out: the jackpot grows by playing, and collecting it pays
    // out what the player already earned once.
    const s = createScoreState();
    s.jackpotScoreFlag = true;

    addScore(s, 1000);
    addScore(s, 2500);

    expect(s.jackpotScore).toBe(3500);
  });

  test('the accumulators are clamped', () => {
    const s = createScoreState();
    s.jackpotScoreFlag = true;
    s.bonusScoreFlag = true;

    addScore(s, 9000000);

    expect(s.jackpotScore).toBe(5000000);
    expect(s.bonusScore).toBe(5000000);
  });

  test('with the flags off they do not move', () => {
    const s = createScoreState();

    addScore(s, 1000);

    expect(s.jackpotScore).toBe(0);
    expect(s.bonusScore).toBe(0);
  });

  test('the accumulators take the RAW score, not the multiplied one', () => {
    const s = createScoreState();
    s.jackpotScoreFlag = true;
    s.scoreMultiplier = 4; // x10

    const added = addScore(s, 100);

    expect(added).toBe(1000);
    expect(s.jackpotScore).toBe(100);
  });
});

describe('score — the display wraps at a billion', () => {
  test('past a billion the visible score starts again and the billions go elsewhere', () => {
    // The original used 32-bit integers and 2^31 is only about 2.1e9. JavaScript would not need this,
    // but it is transcribed because it is observable on screen.
    const s = createScoreState();
    s.curScore = 999999999;

    addScore(s, 2);

    expect(s.curScoreE9).toBe(1);
    expect(s.curScore).toBe(1);
  });
});

describe('score — a special score is the RAW value', () => {
  test('the multiplier does not apply to a mission award', () => {
    // Otherwise a x10 multiplier would pay ten times for finishing a mission, which no pinball table
    // does.
    const s = createScoreState();
    s.scoreMultiplier = 4; // x10

    expect(specialAddScore(s, 100)).toBe(100);
  });

  test('a mission award does not feed the accumulators either', () => {
    const s = createScoreState();
    s.jackpotScoreFlag = true;
    s.bonusScoreFlag = true;

    specialAddScore(s, 1000);

    expect(s.jackpotScore).toBe(0);
    expect(s.bonusScore).toBe(0);
  });

  test('and everything is put back afterwards', () => {
    const s = createScoreState();
    s.scoreMultiplier = 3;
    s.jackpotScoreFlag = true;
    s.bonusScoreFlag = true;

    specialAddScore(s, 100);

    expect(s.scoreMultiplier).toBe(3);
    expect(s.jackpotScoreFlag).toBe(true);
    expect(s.bonusScoreFlag).toBe(true);
    // And the very next ordinary score behaves normally again.
    expect(addScore(s, 100)).toBe(500);
  });
});

/* ===================== RANK ===================== */

function fakeTimer() {
  let pending: (() => void)[] = [];
  const timer: TimerService = {
    set: (_s, cb) => { pending.push(cb); return pending.length; },
    kill: () => { pending = []; },
  };
  return { timer, tick: () => { const r = pending; pending = []; r.forEach((cb) => cb()); } };
}

function buildRank(outerSize = 4, middleSize = RANK_COUNT) {
  const t = fakeTimer();
  const make = (n: number): Light[] =>
    Array.from({ length: n }, () => createLight({ timer: t.timer, frameCount: 1, darkDelay: 0.2, litDelay: 0.05 }));

  const outerLights = make(outerSize);
  const middleLights = make(middleSize);
  const outerCircle = createLightGroup({ timer: t.timer, lights: outerLights, defaultPeriod: 1 });
  const middleCircle = createLightGroup({ timer: t.timer, lights: middleLights, defaultPeriod: 1 });
  const progressLight = createLight({ timer: t.timer, frameCount: 1, darkDelay: 0.2, litDelay: 0.05 });

  const messages: string[] = [];
  const sounds: number[] = [];
  const options = {
    outerCircle, middleCircle, progressLight,
    rankNames: ['Cadet', 'Ensign', 'Lieutenant', 'Captain', 'Commander', 'Admiral', 'Fleet Admiral', 'Star Marshal', 'Legend'],
    showMessage: (text: string) => messages.push(text),
    playSound: () => sounds.push(1),
    promotionTemplate: (name: string) => `Promoted to ${name}`,
  };
  return { options, t, outerCircle, middleCircle, progressLight, messages, sounds };
}

describe('rank — there is no rank variable', () => {
  test('the rank IS the count of lit lamps in the middle circle', () => {
    // Nothing stores it, nothing increments it. Asking the player's rank means asking a light group
    // how many of its lamps are on.
    const { options, middleCircle } = buildRank();

    addRankProgress(4, options); // fills the outer circle of 4, earning one rank

    expect(middleCircle.onCount).toBe(1);
    expect(addRankProgress(0, options).rank).toBe(1);
  });

  test('each point of progress lights one lamp in the outer circle', () => {
    const { options, outerCircle } = buildRank(4);

    addRankProgress(2, options);

    expect(outerCircle.onCount).toBe(2);
  });
});

describe('rank — completing the outer circle promotes', () => {
  test('filling it announces the new rank and reports a promotion', () => {
    const { options, messages, sounds } = buildRank(4);

    const result = addRankProgress(4, options);

    expect(result.promoted).toBe(true);
    expect(messages).toEqual(['Promoted to Cadet']);
    expect(sounds).toEqual([1]);
  });

  test('an incomplete circle promotes nothing', () => {
    const { options, messages } = buildRank(4);

    const result = addRankProgress(2, options);

    expect(result.promoted).toBe(false);
    expect(messages).toEqual([]);
  });

  test('at three quarters the middle circle stirs as a warning', () => {
    // A warning made of the same lamps that will record the promotion, so the player learns to read
    // one row instead of two.
    const { options, middleCircle } = buildRank(4);

    addRankProgress(3, options);

    expect(middleCircle.mode).toBe('animateForward');
  });

  test('the ninth promotion is the last one announced', () => {
    const { options, messages, middleCircle } = buildRank(1, RANK_COUNT);
    for (let i = 0; i < RANK_COUNT; i++) addRankProgress(1, options);
    expect(middleCircle.onCount).toBe(RANK_COUNT);
    messages.length = 0;

    const result = addRankProgress(1, options);

    expect(result.promoted).toBe(true); // the outer circle still completed
    expect(messages).toEqual([]);       // but there is no rank left to announce
  });

  test('the guard is the CONSTANT nine, not the middle circle’s own size', () => {
    // The original writes `if (midActiveCount < 9)` against a middle circle that happens to have nine
    // lamps, so the two coincide in the shipped table and the difference is invisible. It stops being
    // invisible the moment somebody builds a row with more: the tenth lamp would light and never be
    // announced. Transcribed as the constant, and pinned here so the coincidence is on the record.
    const { options, messages, middleCircle } = buildRank(1, RANK_COUNT + 3);
    for (let i = 0; i < RANK_COUNT; i++) addRankProgress(1, options);
    messages.length = 0;

    addRankProgress(1, options);

    expect(middleCircle.onCount).toBe(RANK_COUNT); // the extra lamps are never reached
    expect(messages).toEqual([]);
  });
});

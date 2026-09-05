// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  makeMaskedTwoStageMission, makeGatedTwoStageMission,
  MASK_ALL_TARGETS, MASK_STAGE_TWO,
} from '../app/js/control/two-stage.js';
import { createScoreState } from '../app/js/control/score.js';
import type { MissionController } from '../app/js/control/mission.js';
import type { ControlledComponent, MessageCode } from '../app/js/control/dispatch.js';

function stageLamp(on = false) {
  const log: string[] = [];
  return {
    log,
    get on() { return on; },
    turnOn() { on = true; log.push('on'); },
    turnOff() { on = false; log.push('off'); },
    resetTimed() { log.push('reset'); },
    flasherStartTimed(s: number) { log.push('flash:' + s); },
  };
}

const component = (name: string): ControlledComponent => ({ name, scores: [], control: null });

function harness() {
  const shown: { text: string; seconds: number }[] = [];
  const dispatched: MessageCode[] = [];
  const ctx = {
    showMissionText: (text: string, seconds: number) => shown.push({ text, seconds }),
    showInfo: () => {},
    dispatch: (code: MessageCode) => dispatched.push(code),
  };
  return { ctx: ctx as unknown as Parameters<MissionController>[2], shown, dispatched };
}

describe('the masked two-stage mission: three bits and a fourth', () => {
  function build(o: { mask?: number } = {}) {
    const maskLamp = { messageField: o.mask ?? 0 };
    const one = stageLamp();
    const two = stageLamp();
    const stageOne = [component('target16'), component('target17'), component('target18')];
    const stageTwo = [component('sink1'), component('sink2')];
    const missionLamp = { messageField: 8 };
    const score = createScoreState();
    const calls: string[] = [];
    const h = harness();
    const controller = makeMaskedTwoStageMission({
      maskLamp, stageOneLamp: one, stageTwoLamp: two,
      stageOneComponents: stageOne, stageTwoComponents: stageTwo,
      missionLamp, score,
      addRankProgress: () => false,
      award: 1000000, rankPoints: 8,
      texts: { stageOne: 'FIND IT', stageTwo: 'SINK IT', complete: 'DONE', score: (p) => 'SCORED:' + p },
      onTakeOver: () => calls.push('takeOver'),
      onEnterStageTwo: () => calls.push('enterStageTwo'),
    });
    return { maskLamp, one, two, stageOne, stageTwo, missionLamp, score, calls, controller, ...h };
  }

  test('SEVEN is three bits, one per target', () => {
    // `lite104->MessageField |= 1u | 2u | 4u`, written by the hazard spot targets. The mission tests
    // the whole mask at once, so "all three are down" is a single integer comparison.
    expect(MASK_ALL_TARGETS).toBe(0b111);
    expect(MASK_STAGE_TWO).toBe(0b1111);
  });

  test('taking over clears the mask and lights stage one', () => {
    const b = build({ mask: MASK_STAGE_TWO });

    b.controller('ControlMissionComplete', null, b.ctx);

    expect(b.maskLamp.messageField).toBe(0);
    expect(b.one.log).toContain('flash:0');
    expect(b.calls).toContain('takeOver');
  });

  test('stage one announces its own text', () => {
    const b = build({ mask: 0 });

    b.controller('ControlMissionStarted', null, b.ctx);

    expect(b.shown).toEqual([{ text: 'FIND IT', seconds: -1 }]);
  });

  test('a partial mask is not enough — the targets must ALL be down', () => {
    const b = build({ mask: 0b011 });

    b.controller('ControlCollision', b.stageOne[0]!, b.ctx);

    expect(b.maskLamp.messageField).toBe(0b011);
    expect(b.calls).not.toContain('enterStageTwo');
  });

  test('the full mask promotes the mission to stage two', () => {
    // And the promotion is written as 15, which is 7 with a bit no target can set. That is what makes
    // the stage-two test unambiguous.
    const b = build({ mask: MASK_ALL_TARGETS });

    b.controller('ControlCollision', b.stageOne[0]!, b.ctx);

    expect(b.maskLamp.messageField).toBe(MASK_STAGE_TWO);
    expect(b.one.log).toContain('off');
    expect(b.two.log).toContain('flash:0');
    expect(b.calls).toContain('enterStageTwo');
    expect(b.dispatched).toEqual(['ControlMissionStarted']);
  });

  test('once promoted, the announcement changes', () => {
    const b = build({ mask: MASK_STAGE_TWO });

    b.controller('ControlMissionStarted', null, b.ctx);

    expect(b.shown).toEqual([{ text: 'SINK IT', seconds: -1 }]);
  });

  test('the stage-two component finishes it and pays', () => {
    const b = build({ mask: MASK_STAGE_TWO });

    b.controller('ControlCollision', b.stageTwo[1]!, b.ctx);

    expect(b.missionLamp.messageField).toBe(1);
    expect(b.score.curScore).toBe(1000000);
    expect(b.shown[0]).toEqual({ text: 'DONE', seconds: 4 });
    expect(b.two.log).toContain('off');
  });

  test('the stage-two component does NOTHING before the promotion', () => {
    const b = build({ mask: MASK_ALL_TARGETS });

    b.controller('ControlCollision', b.stageTwo[0]!, b.ctx);

    expect(b.missionLamp.messageField).toBe(8);
    expect(b.score.curScore).toBe(0);
  });

  test('a promotion suppresses the score line', () => {
    const maskLamp = { messageField: MASK_STAGE_TWO };
    const sink = component('sink1');
    const h = harness();
    const controller = makeMaskedTwoStageMission({
      maskLamp, stageOneLamp: stageLamp(), stageTwoLamp: stageLamp(),
      stageOneComponents: [], stageTwoComponents: [sink],
      missionLamp: { messageField: 8 }, score: createScoreState(),
      addRankProgress: () => true,
      award: 1000000, rankPoints: 8,
      texts: { stageOne: 'A', stageTwo: 'B', complete: 'DONE', score: (p) => 'SCORED:' + p },
      onTakeOver: () => {},
    });

    controller('ControlCollision', sink, h.ctx);

    expect(h.shown.map((s) => s.text)).toEqual(['DONE']);
  });
});

describe('the gated two-stage mission: the stage is somebody else’s state', () => {
  function build(o: { stageTwo?: boolean; count?: number } = {}) {
    let inStageTwo = o.stageTwo ?? false;
    const stageOne = [component('target1'), component('target2')];
    const stageTwo = [component('kickout2')];
    const one = stageLamp();
    const two = stageLamp();
    const counterLamp = { messageField: 0 };
    const missionLamp = { messageField: 11 };
    const score = createScoreState();
    const h = harness();
    const controller = makeGatedTwoStageMission({
      inStageTwo: () => inStageTwo,
      stageOneLamp: one, stageTwoLamp: two,
      stageOneComponents: stageOne,
      stageTwoComponents: stageTwo,
      counterLamp, count: o.count ?? 1,
      missionLamp, score,
      addRankProgress: () => false,
      award: 750000, rankPoints: 7,
      texts: { stageOne: 'HIT TARGETS', stageTwo: 'RESCUE', complete: 'SAVED', score: (p) => 'SCORED:' + p },
      onTakeOver: () => {},
    });
    return {
      one, two, counterLamp, missionLamp, score, controller, stageOne, stageTwo, ...h,
      promote: () => { inStageTwo = true; },
    };
  }

  test('the announcement is chosen by state this mission does not own', () => {
    // `lite20` is lit by `table_set_flag_lights`, which the BOOSTER BANK grants. So the rescue
    // mission's second stage is unlocked by a target bank on the other side of the table, and the
    // mission only reads the lamp.
    const b = build({ stageTwo: false });

    b.controller('ControlMissionStarted', null, b.ctx);
    b.promote();
    b.controller('ControlMissionStarted', null, b.ctx);

    expect(b.shown.map((s) => s.text)).toEqual(['HIT TARGETS', 'RESCUE']);
  });

  test('the lamps are swapped in the ANNOUNCE branch, and only if needed', () => {
    const b = build({ stageTwo: false });

    b.controller('ControlMissionStarted', null, b.ctx);

    expect(b.one.log).toEqual(['flash:0']);
    expect(b.two.log).toEqual([]);
  });

  test('the OTHER stage’s lamp is darkened only when it is actually lit', () => {
    // Of the two guards around the swap, only this one can ever fire. `light_on()` reports the
    // persistent state and `TLightFlasherStartTimed` does not set it, so the guard before a FLASH is
    // always true and the lamp is re-flashed on every announcement. Transcribed as written; the
    // dead half is documented in the source rather than simplified away.
    const dark = build({ stageTwo: false });
    dark.controller('ControlMissionStarted', null, dark.ctx);
    expect(dark.two.log).toEqual([]);

    const lit = build({ stageTwo: false });
    lit.two.turnOn();
    lit.two.log.length = 0;

    lit.controller('ControlMissionStarted', null, lit.ctx);

    expect(lit.two.log).toEqual(['reset', 'off']);
  });

  test('a stage-one component only RE-ANNOUNCES: it advances nothing', () => {
    const b = build({ stageTwo: false });

    b.controller('ControlCollision', b.stageOne[0]!, b.ctx);

    expect(b.dispatched).toEqual(['ControlMissionStarted']);
    expect(b.missionLamp.messageField).toBe(11);
  });

  test('the stage-two component is inert until the gate opens', () => {
    const b = build({ stageTwo: false });

    b.controller('ControlCollision', b.stageTwo[0]!, b.ctx);

    expect(b.missionLamp.messageField).toBe(11);
    expect(b.score.curScore).toBe(0);
  });

  test('with the gate open it finishes and pays', () => {
    const b = build({ stageTwo: true });

    b.controller('ControlCollision', b.stageTwo[0]!, b.ctx);

    expect(b.missionLamp.messageField).toBe(1);
    expect(b.score.curScore).toBe(750000);
  });

  test('a count greater than one has to be worked through', () => {
    const b = build({ stageTwo: true, count: 3 });
    b.controller('ControlMissionComplete', null, b.ctx);

    b.controller('ControlCollision', b.stageTwo[0]!, b.ctx);
    expect(b.missionLamp.messageField).toBe(11);
    b.controller('ControlCollision', b.stageTwo[0]!, b.ctx);
    expect(b.missionLamp.messageField).toBe(11);
    b.controller('ControlCollision', b.stageTwo[0]!, b.ctx);

    expect(b.missionLamp.messageField).toBe(1);
  });

  test('taking over sets the counter', () => {
    const b = build({ count: 3 });

    b.controller('ControlMissionComplete', null, b.ctx);

    expect(b.counterLamp.messageField).toBe(3);
  });
});

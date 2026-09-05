// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { makeSelectMissionController, MISSION_TABLE, rankBand, type LampWithField } from '../app/js/control/select-mission.js';
import { createMissionMachine, type MissionContext, type MissionCode } from '../app/js/control/mission.js';
import type { ControlledComponent } from '../app/js/control/dispatch.js';
import { createScoreState } from '../app/js/control/score.js';

const component = (name: string): ControlledComponent => ({ name, scores: [], control: null });

function fakeLamp(field = 0, on = false): LampWithField {
  let lit = on;
  return {
    messageField: field,
    turnOn: () => { lit = true; },
    turnOff: () => { lit = false; },
    resetTimed: () => {},
    flasherStart: () => {},
    flasherStartTimedThenStayOn: () => { lit = true; },
    get on() { return lit; },
  };
}

function build(rank: number, fuel = 3) {
  const targets = [component('target13'), component('target14'), component('target15')];
  const ramp = component('ramp');
  const selectionLamp = fakeLamp();
  const missionLamp = fakeLamp(1);
  const secretLamp = fakeLamp();
  const rankGroup = { onCount: rank, animateBackward: () => {}, resetGroup: () => {} };
  const outerCircle = { onCount: 0, animateBackward: () => {}, resetGroup: () => {} };
  const fuelBargraph = { ...component('fuel_bargraph'), onCount: fuel };
  const score = createScoreState();

  const shown: { text: string; seconds: number }[] = [];
  const music: string[] = [];
  const seen: { code: MissionCode; mission: number }[] = [];

  const controller = makeSelectMissionController({
    targets, ramp, selectionLamp, missionLamp: missionLamp as never, secretLamp,
    rankGroup, outerCircle, fuelBargraph,
    missionSelectScores: [0, 75000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    startedText: (p) => `MISSION STARTED ${p}`,
    score,
  });

  // Every mission but 1 just records what it was told; 1 is the controller under test.
  const controllers: Record<number, typeof controller> = {};
  for (let i = 0; i < 19; i++) {
    controllers[i] = ((code) => { seen.push({ code, mission: i }); }) as typeof controller;
  }
  controllers[1] = controller;

  const machine = createMissionMachine({
    missionLamp: missionLamp as never,
    controllers,
    missionTextBox: component('mission_text_box'),
  });

  const ctx: MissionContext = {
    score,
    table: { extraBalls: 0, multiballCount: 1, ballCount: 3, tiltLocked: false },
    light: () => undefined,
    group: () => undefined,
    showInfo: () => {},
    showMission: () => {},
    playSound: () => {},
    playMusic: (t) => music.push(t),
    missionControl: () => {},
    missionLamp: missionLamp as never,
    missionTextBox: component('mission_text_box'),
    dispatch: (code, caller) => machine.dispatch(code, caller, ctx),
    showMissionText: (text, seconds) => shown.push({ text, seconds }),
    clearMissionText: () => {},
  };

  return { machine, ctx, targets, ramp, selectionLamp, missionLamp, secretLamp, shown, music, seen, score };
}

describe('select mission — the same three targets mean different things at different ranks', () => {
  test('the table is a rank band by a target column', () => {
    // Three physical targets and seventeen missions, and the way it gets from one to the other is
    // promotion. The same target keeps meaning something new all game.
    expect(MISSION_TABLE[0]).toEqual([3, 4, 2, 5]);
    expect(MISSION_TABLE[4]).toEqual([15, 16, 17, 18]);
  });

  test('the rank bands are 1, 2-3, 4-5, 6-7 and 8-9', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(rankBand)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });

  test('a rank outside the bands selects nothing', () => {
    // Rank 0 is a player who has been promoted to nothing yet.
    const { machine, ctx, targets, selectionLamp } = build(0);

    machine.dispatch('ControlCollision', targets[0]!, ctx);

    expect(selectionLamp.messageField).toBe(0);
  });

  test('at rank 1, the first target picks mission 3 and the third picks mission 2', () => {
    const first = build(1);
    first.machine.dispatch('ControlCollision', first.targets[0]!, first.ctx);
    expect(first.selectionLamp.messageField).toBe(3);

    const third = build(1);
    third.machine.dispatch('ControlCollision', third.targets[2]!, third.ctx);
    expect(third.selectionLamp.messageField).toBe(2);
  });

  test('the SAME target at rank 5 picks a different mission entirely', () => {
    const { machine, ctx, targets, selectionLamp } = build(5);

    machine.dispatch('ControlCollision', targets[0]!, ctx);

    expect(selectionLamp.messageField).toBe(6);
  });
});

describe('select mission — the secret column', () => {
  test('lamp 101 at seven opens the fourth column, whichever target was hit', () => {
    const { machine, ctx, targets, selectionLamp, secretLamp } = build(1);
    secretLamp.messageField = 7;

    machine.dispatch('ControlCollision', targets[0]!, ctx);

    expect(selectionLamp.messageField).toBe(5); // column 4 at rank 1, not the 3 of column 1
  });

  test('using it consumes it', () => {
    const { machine, ctx, targets, secretLamp } = build(1);
    secretLamp.messageField = 7;

    machine.dispatch('ControlCollision', targets[0]!, ctx);

    expect(secretLamp.messageField).toBe(0);
  });
});

describe('select mission — selecting is not starting', () => {
  test('hitting a target only writes the SELECTION lamp', () => {
    const { machine, ctx, targets, selectionLamp, missionLamp } = build(1);

    machine.dispatch('ControlCollision', targets[0]!, ctx);

    expect(selectionLamp.messageField).toBe(3);
    expect(missionLamp.messageField).toBe(1); // still in selection
  });

  test('the RAMP starts it, by copying one lamp into the other', () => {
    // One lamp holds what you picked, another holds what you are doing, and starting a mission is
    // copying one into the other.
    const { machine, ctx, targets, ramp, missionLamp } = build(1);
    machine.dispatch('ControlCollision', targets[0]!, ctx);

    machine.dispatch('ControlCollision', ramp, ctx);

    expect(missionLamp.messageField).toBe(3);
  });

  test('the ramp does nothing with no mission selected', () => {
    const { machine, ctx, ramp, missionLamp } = build(1);

    machine.dispatch('ControlCollision', ramp, ctx);

    expect(missionLamp.messageField).toBe(1);
  });

  test('the ramp does nothing without fuel', () => {
    const { machine, ctx, targets, ramp, missionLamp } = build(1, 0);
    machine.dispatch('ControlCollision', targets[0]!, ctx);

    machine.dispatch('ControlCollision', ramp, ctx);

    expect(missionLamp.messageField).toBe(1);
  });

  test('starting awards the selection score, unmultiplied, and announces it', () => {
    const { machine, ctx, targets, ramp, shown, music, score } = build(1);
    score.scoreMultiplier = 4; // x10, which a mission award must ignore
    machine.dispatch('ControlCollision', targets[0]!, ctx);

    machine.dispatch('ControlCollision', ramp, ctx);

    // The selection is 3, so the score index is 3 - 2 = 1, which this fixture sets to 75000. With a
    // x10 multiplier in force the award is still exactly 75000: a mission award is the raw value.
    expect(score.curScore).toBe(75000);
    expect(shown[0]!.text).toBe('MISSION STARTED 75000');
    expect(music).toContain('track2');
  });
});

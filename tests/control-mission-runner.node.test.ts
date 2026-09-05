// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { makeMissionController, type MissionDefinition, type MissionLampControl } from '../app/js/control/mission-runner.js';
import { createMissionMachine, type MissionContext, type MissionCode, type MissionController } from '../app/js/control/mission.js';
import type { ControlledComponent } from '../app/js/control/dispatch.js';
import { createScoreState } from '../app/js/control/score.js';
import type { LampWithField } from '../app/js/control/select-mission.js';

const component = (name: string): ControlledComponent => ({ name, scores: [], control: null });

function fakeMissionLamp() {
  const calls: string[] = [];
  const lamp: MissionLampControl = {
    flasherStartTimed: (s) => calls.push(`flash:${s}`),
    turnOff: () => calls.push('turnOff'),
    resetTimed: () => calls.push('resetTimed'),
  };
  return { lamp, calls };
}

function fakeCounter(field = 0): LampWithField {
  return {
    messageField: field,
    turnOn: () => {}, turnOff: () => {}, resetTimed: () => {},
    flasherStart: () => {}, flasherStartTimedThenStayOn: () => {},
    get on() { return true; },
  };
}

function build(overrides: Partial<MissionDefinition> = {}, promoted = false) {
  const bumpers = [component('bump1'), component('bump2')];
  const lamp = fakeMissionLamp();
  const counterLamp = fakeCounter();
  const missionLamp = { messageField: 2 };
  const score = createScoreState();

  const shown: { text: string; seconds: number }[] = [];
  const info: { text: string; seconds: number }[] = [];
  const sounds: number[] = [];
  const rankCalls: number[] = [];
  const seen: { code: MissionCode; mission: number }[] = [];

  const definition: MissionDefinition = {
    name: 'Practice',
    lamps: [lamp.lamp],
    count: 3,
    components: bumpers,
    nextMission: 1,
    text: (n) => `DESTROY ${n} MORE`,
    completeText: 'MISSION COMPLETE',
    award: 500000,
    rankPoints: 6,
    scoreText: (p) => `SCORED ${p}`,
    ...overrides,
  };

  const controller = makeMissionController({
    definition, counterLamp, missionLamp, score,
    addRankProgress: (points) => { rankCalls.push(points); return promoted; },
    playCompleteSound: () => sounds.push(1),
  });

  const controllers: Record<number, MissionController> = {};
  for (let i = 0; i < 32; i++) controllers[i] = (code) => { seen.push({ code, mission: i }); };
  controllers[2] = controller;

  const machine = createMissionMachine({
    missionLamp, controllers, missionTextBox: component('mission_text_box'),
  });

  const ctx: MissionContext = {
    score,
    table: { extraBalls: 0, multiballCount: 1, ballCount: 3, tiltLocked: false },
    light: () => undefined,
    group: () => undefined,
    showInfo: (text, seconds) => info.push({ text, seconds }),
    showMission: () => {},
    playSound: () => {},
    playMusic: () => {},
    missionControl: () => {},
    missionLamp,
    missionTextBox: component('mission_text_box'),
    dispatch: (code, caller) => machine.dispatch(code, caller, ctx),
    showMissionText: (text, seconds) => shown.push({ text, seconds }),
    clearMissionText: () => {},
  };

  return { machine, ctx, bumpers, lamp, counterLamp, missionLamp, score, shown, info, sounds, rankCalls, seen };
}

describe('mission runner — a mission is a countdown in the selection lamp', () => {
  test('taking over sets the counter and flashes the mission’s lamps', () => {
    // lite56 held which mission was picked; now the same field holds how many hits remain. One lamp,
    // two meanings, chosen by which mission is active.
    const { machine, ctx, counterLamp, lamp } = build();

    machine.dispatch('ControlMissionComplete', null, ctx);

    expect(counterLamp.messageField).toBe(3);
    expect(lamp.calls).toEqual(['flash:0']);
  });

  test('the announcement is formatted with the counter, so it counts itself down', () => {
    const { machine, ctx, bumpers, shown } = build();
    machine.dispatch('ControlMissionComplete', null, ctx);

    machine.dispatch('ControlCollision', bumpers[0]!, ctx);
    machine.dispatch('ControlCollision', bumpers[1]!, ctx);

    expect(shown.map((s) => s.text)).toEqual(['DESTROY 3 MORE', 'DESTROY 2 MORE', 'DESTROY 1 MORE']);
  });

  test('the announcement is left up indefinitely', () => {
    const { machine, ctx, shown } = build();

    machine.dispatch('ControlMissionStarted', null, ctx);

    expect(shown[0]!.seconds).toBe(-1);
  });

  test('hitting anything that is not this mission’s business is ignored', () => {
    const { machine, ctx, counterLamp } = build();
    machine.dispatch('ControlMissionComplete', null, ctx);

    machine.dispatch('ControlCollision', component('some_rollover'), ctx);

    expect(counterLamp.messageField).toBe(3);
  });
});

describe('mission runner — completing', () => {
  function complete(built: ReturnType<typeof build>) {
    built.machine.dispatch('ControlMissionComplete', null, built.ctx);
    for (let i = 0; i < 3; i++) built.machine.dispatch('ControlCollision', built.bumpers[0]!, built.ctx);
    return built;
  }

  test('reaching zero switches the lamps off and moves to the next mission', () => {
    const built = complete(build());

    expect(built.missionLamp.messageField).toBe(1);
    expect(built.lamp.calls).toContain('turnOff');
  });

  test('the next mission receives the notification, not this one', () => {
    const built = complete(build());

    expect(built.seen).toContainEqual({ code: 'ControlMissionComplete', mission: 1 });
  });

  test('the award is a mission award: unmultiplied', () => {
    const built = build();
    built.score.scoreMultiplier = 4; // x10
    complete(built);

    expect(built.score.curScore).toBe(500000);
  });

  test('the rank is advanced by the mission’s own points', () => {
    const built = complete(build());

    expect(built.rankCalls).toEqual([6]);
  });

  test('when the rank does NOT advance, the score is announced', () => {
    const built = complete(build({}, false));

    expect(built.shown.map((s) => s.text)).toContain('SCORED 500000');
    expect(built.sounds).toEqual([1]);
  });

  test('when the rank DOES advance, the score message is suppressed', () => {
    // A promotion has its own, more important message, and the two never compete for the text box.
    const built = complete(build({}, true));

    expect(built.shown.map((s) => s.text)).not.toContain('SCORED 500000');
    expect(built.sounds).toEqual([]);
  });
});

describe('mission runner — the shapes that differ', () => {
  test('a mission with no counter completes on the FIRST hit', () => {
    // Several Maelstrom parts are one hit and done, with no countdown in the text.
    const built = build({ count: null, text: () => 'GO TO THE RAMP' });
    built.machine.dispatch('ControlMissionComplete', null, built.ctx);

    built.machine.dispatch('ControlCollision', built.bumpers[0]!, built.ctx);

    expect(built.missionLamp.messageField).toBe(1);
  });

  test('a mission can CHAIN to another instead of returning to selection', () => {
    const built = build({ count: null, nextMission: 29 });
    built.machine.dispatch('ControlMissionComplete', null, built.ctx);

    built.machine.dispatch('ControlCollision', built.bumpers[0]!, built.ctx);

    expect(built.missionLamp.messageField).toBe(29);
    expect(built.seen).toContainEqual({ code: 'ControlMissionComplete', mission: 29 });
  });

  test('a mission with no award announces nothing and scores nothing', () => {
    const built = build({ count: null, award: undefined, completeText: undefined });
    built.machine.dispatch('ControlMissionComplete', null, built.ctx);
    built.shown.length = 0;

    built.machine.dispatch('ControlCollision', built.bumpers[0]!, built.ctx);

    expect(built.score.curScore).toBe(0);
    expect(built.rankCalls).toEqual([]);
  });

  test('a mission with an info line writes to the info box as well', () => {
    const built = build({ count: null, infoText: 'MAELSTROM COMPLETE' });
    built.machine.dispatch('ControlMissionComplete', null, built.ctx);

    built.machine.dispatch('ControlCollision', built.bumpers[0]!, built.ctx);

    expect(built.info).toEqual([{ text: 'MAELSTROM COMPLETE', seconds: 4 }]);
  });
});

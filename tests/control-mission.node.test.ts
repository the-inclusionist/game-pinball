// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  createMissionMachine, makeWaitingDeploymentController, MISSION_NAMES, MISSION_COUNT,
  type MissionContext, type MissionCode, type MissionController,
} from '../app/js/control/mission.js';
import type { ControlledComponent } from '../app/js/control/dispatch.js';
import { createScoreState } from '../app/js/control/score.js';

const component = (name: string): ControlledComponent => ({ name, scores: [], control: null });

function build(controllers: Partial<Record<number, MissionController>> = {}) {
  const missionLamp = { messageField: 0 };
  const missionTextBox = component('mission_text_box');
  const gateA = component('oneway4');
  const gateB = component('oneway10');

  const shown: { text: string; seconds: number }[] = [];
  const cleared: number[] = [];
  const music: string[] = [];
  const seen: { code: MissionCode; mission: number }[] = [];

  // Record every dispatch alongside the mission that was current when it landed.
  const record = (index: number): MissionController => (code) => {
    seen.push({ code, mission: index });
  };
  const wired: Partial<Record<number, MissionController>> = {};
  for (let i = 0; i < MISSION_COUNT; i++) wired[i] = record(i);
  Object.assign(wired, controllers);

  const machine = createMissionMachine({ missionLamp, controllers: wired, missionTextBox });

  const ctx: MissionContext = {
    score: createScoreState(),
    table: { extraBalls: 0, multiballCount: 0, ballCount: 3, tiltLocked: false },
    light: () => undefined,
    group: () => undefined,
    showInfo: () => {},
    showMission: () => {},
    playSound: () => {},
    playMusic: (track) => music.push(track),
    missionControl: () => {},
    missionLamp,
    missionTextBox,
    dispatch: (code, caller) => machine.dispatch(code, caller, ctx),
    showMissionText: (text, seconds) => shown.push({ text, seconds }),
    clearMissionText: () => cleared.push(1),
  };

  return { machine, ctx, missionLamp, missionTextBox, gateA, gateB, shown, cleared, music, seen };
}

describe('mission — the current mission IS a lamp', () => {
  test('the machine reads the mission out of the lamp’s message field', () => {
    // Not a variable, not an enum in a struct: a field on a lamp. Together with the rank living in a
    // light group's lit count, this is a pattern — the state lives in the display.
    const { machine, missionLamp } = build();

    expect(machine.current).toBe(0);
    expect(machine.currentName).toBe('WaitingDeployment');

    missionLamp.messageField = 5;

    expect(machine.currentName).toBe('ScienceMission');
  });

  test('the dispatch picks the controller by that number', () => {
    const { machine, ctx, missionLamp, seen } = build();
    missionLamp.messageField = 9;

    machine.dispatch('ControlCollision', null, ctx);

    expect(seen).toEqual([{ code: 'ControlCollision', mission: 9 }]);
    expect(MISSION_NAMES[9]).toBe('BugHunt');
  });

  test('a mission with no controller yet simply receives nothing', () => {
    const { machine, ctx, missionLamp, seen } = build({ 3: undefined });
    missionLamp.messageField = 3;

    machine.dispatch('ControlCollision', null, ctx);

    expect(seen).toEqual([]);
  });
});

describe('mission — some messages are rewritten before dispatch', () => {
  test('a timer expiring ON THE MISSION TEXT BOX becomes MissionStarted', () => {
    // A mission does not begin when it is chosen. It begins when its announcement has finished being
    // read, and the text box's own timeout is what says so.
    const { machine, ctx, missionTextBox, seen } = build();

    machine.dispatch('ControlTimerExpired', missionTextBox, ctx);

    expect(seen).toEqual([{ code: 'ControlMissionStarted', mission: 0 }]);
  });

  test('a timer expiring on anything ELSE is left alone', () => {
    const { machine, ctx, seen } = build();

    machine.dispatch('ControlTimerExpired', component('fuel_bargraph'), ctx);

    expect(seen).toEqual([{ code: 'ControlTimerExpired', mission: 0 }]);
  });

  test('Resume becomes MissionStarted, which is how a pause resumes cleanly', () => {
    const { machine, ctx, seen } = build();

    machine.dispatch('Resume', null, ctx);

    expect(seen).toEqual([{ code: 'ControlMissionStarted', mission: 0 }]);
  });
});

describe('mission — a transition is: write the lamp, then re-enter', () => {
  test('the notification lands on the NEW controller, not the old one', () => {
    // The re-entrant call re-reads the lamp. Writing the state and announcing it are the same two
    // lines everywhere, and there is no transition table anywhere in the game.
    const { machine, ctx, missionLamp, seen } = build({
      0: (code, _caller, c) => {
        if (code !== 'ControlCollision') return;
        c.missionLamp.messageField = 1;
        c.dispatch('ControlMissionComplete', null);
      },
    });

    machine.dispatch('ControlCollision', null, ctx);

    expect(missionLamp.messageField).toBe(1);
    expect(seen).toEqual([{ code: 'ControlMissionComplete', mission: 1 }]);
  });
});

describe('mission — waiting for deployment', () => {
  function waiting() {
    const built = build();
    const controller = makeWaitingDeploymentController({
      deploymentGates: [built.gateA, built.gateB],
      awaitingText: 'AWAITING DEPLOYMENT',
    });
    const machine = createMissionMachine({
      missionLamp: built.missionLamp,
      controllers: { 0: controller, 1: (code) => built.seen.push({ code, mission: 1 }) },
      missionTextBox: built.missionTextBox,
    });
    const ctx: MissionContext = { ...built.ctx, dispatch: (c, caller) => machine.dispatch(c, caller, ctx) };
    return { ...built, machine, ctx };
  }

  test('it shows one line and leaves it up indefinitely', () => {
    // -1 is the original's "until told otherwise".
    const { machine, ctx, shown } = waiting();

    machine.dispatch('ControlMissionStarted', null, ctx);

    expect(shown).toEqual([{ text: 'AWAITING DEPLOYMENT', seconds: -1 }]);
  });

  test('crossing the deployment chute advances to SelectMission', () => {
    const { machine, ctx, missionLamp, gateA, seen } = waiting();

    machine.dispatch('ControlCollision', gateA, ctx);

    expect(missionLamp.messageField).toBe(1);
    expect(seen).toEqual([{ code: 'ControlMissionComplete', mission: 1 }]);
  });

  test('either gate does it', () => {
    const { machine, ctx, missionLamp, gateB } = waiting();

    machine.dispatch('ControlCollision', gateB, ctx);

    expect(missionLamp.messageField).toBe(1);
  });

  test('a collision with anything else does nothing', () => {
    const { machine, ctx, missionLamp } = waiting();

    machine.dispatch('ControlCollision', component('bumper1'), ctx);

    expect(missionLamp.messageField).toBe(0);
  });

  test('completing clears the text and starts the music', () => {
    const { machine, ctx, cleared, music } = waiting();

    machine.dispatch('ControlMissionComplete', null, ctx);

    expect(cleared).toEqual([1]);
    expect(music).toEqual(['track1']);
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  makeAlienMenaceController, makeWaitingDeploymentController,
  makeTimeWarpPartTwoController, makeGameoverController,
  PHASE_PLAYERS, PHASE_HIGH_SCORES, TIME_WARP_AWARD, TOP_RANK,
} from '../app/js/control/mission-specials.js';
import type { MissionController } from '../app/js/control/mission.js';
import type { ControlledComponent, MessageCode } from '../app/js/control/dispatch.js';
import { createScoreState } from '../app/js/control/score.js';

function stageLamp(on = false) {
  const log: string[] = [];
  return {
    log,
    get on() { return on; },
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

describe('Alien Menace is won without hitting anything', () => {
  function build(level = 0) {
    const bumpers = { level, setLevel(l: number) { this.level = l; } };
    const watched = component('bump1');
    const lamp = stageLamp();
    const trek = {
      log: [] as string[],
      lightsResetAndTurnOff() { this.log.push('off'); },
      offsetAnimationForward(p: number) { this.log.push('fwd:' + p); },
      animationBackward(p: number) { this.log.push('back:' + p); },
    };
    const missionLamp = { messageField: 10 };
    const controller = makeAlienMenaceController({
      bumpers, watched, lamp, trekGroups: [trek],
      text: 'THEY ARE COMING', nextMission: 20, missionLamp,
    });
    return { bumpers, watched, lamp, trek, missionLamp, controller, ...harness() };
  }

  test('taking over puts the bumper level back to zero', () => {
    // Which is what makes the mission "raise them ONE more level, starting now" rather than "have
    // them raised", and it is why a player who already had them high gains nothing from that.
    const b = build(3);

    b.controller('ControlMissionComplete', null, b.ctx);

    expect(b.bumpers.level).toBe(0);
    expect(b.lamp.log).toContain('flash:0');
    expect(b.trek.log).toEqual(['off', 'fwd:0.2', 'back:0.2']);
  });

  test('a COLLISION with the bumper does nothing at all', () => {
    // The mission does not listen for hits. It listens for the bumper group's level message, which
    // only a completed lane set sends.
    const b = build(1);

    b.controller('ControlCollision', b.watched, b.ctx);

    expect(b.missionLamp.messageField).toBe(10);
  });

  test('the level message with a level above zero ends it', () => {
    const b = build(1);

    b.controller('TBumperSetBmpIndex', b.watched, b.ctx);

    expect(b.missionLamp.messageField).toBe(20);
    expect(b.dispatched).toEqual(['ControlMissionComplete']);
    expect(b.lamp.on).toBe(false);
  });

  test('the level message that puts it back to ZERO is ignored', () => {
    // Which is exactly the message the take-over sends itself.
    const b = build(0);

    b.controller('TBumperSetBmpIndex', b.watched, b.ctx);

    expect(b.missionLamp.messageField).toBe(10);
  });

  test('another bumper group’s level does not count', () => {
    const b = build(2);

    b.controller('TBumperSetBmpIndex', component('bump5'), b.ctx);

    expect(b.missionLamp.messageField).toBe(10);
  });
});

describe('waiting for deployment is a held breath, not a mission', () => {
  function build() {
    const exits = [component('oneway4'), component('oneway10')];
    const missionLamp = { messageField: 0 };
    const calls: string[] = [];
    const controller = makeWaitingDeploymentController({
      exits, missionLamp, text: 'PRESS SPACE',
      clearMissionText: () => calls.push('clear'),
      setWaitingFlag: (w) => calls.push('waiting:' + w),
      playMusic: (t) => calls.push('music:' + t),
    });
    return { exits, missionLamp, calls, controller, ...harness() };
  }

  test('the ball leaving the chute ends it', () => {
    const b = build();

    b.controller('ControlCollision', b.exits[1]!, b.ctx);

    expect(b.missionLamp.messageField).toBe(1);
    expect(b.dispatched).toEqual(['ControlMissionComplete']);
  });

  test('anything else on the table is ignored', () => {
    const b = build();

    b.controller('ControlCollision', component('bump1'), b.ctx);

    expect(b.missionLamp.messageField).toBe(0);
  });

  test('handing over clears the text, drops the flag and starts the music', () => {
    const b = build();

    b.controller('ControlMissionComplete', null, b.ctx);

    expect(b.calls).toEqual(['clear', 'waiting:false', 'music:track1']);
  });
});

describe('Time Warp part two, where the rank can go BACKWARDS', () => {
  function build(rank = 4) {
    let onCount = rank;
    const circle = {
      log: [] as string[],
      get onCount() { return onCount; },
      offsetAnimationBackward(p: number) { onCount--; this.log.push('back:' + p); },
      resetAndTurnOn(p: number) { onCount++; this.log.push('up:' + p); },
    };
    const demote = component('kickout2');
    const promote = component('ramp');
    const lamps = [stageLamp()];
    const missionLamp = { messageField: 24 };
    const score = createScoreState();
    let promoted = false;
    const controller = makeTimeWarpPartTwoController({
      rankCircle: circle, demoteComponent: demote, promoteComponent: promote,
      lamps, missionLamp, score,
      addRankProgress: () => promoted,
      rankName: (i) => 'RANK' + i,
      texts: {
        demoteHeadline: 'DEMOTED', promoteHeadline: 'PROMOTED',
        demoted: (r) => 'YOU ARE NOW ' + r,
        promoted: (r) => 'YOU REACHED ' + r,
      },
    });
    return {
      circle, demote, promote, lamps, missionLamp, score, controller, ...harness(),
      setPromoted: (v: boolean) => { promoted = v; },
    };
  }

  test('the kickout DEMOTES and names the rank dropped to', () => {
    // The one place in the game the rank circle runs backwards.
    const b = build(4);

    b.controller('ControlCollision', b.demote, b.ctx);

    expect(b.circle.onCount).toBe(3);
    expect(b.shown.map((s) => s.text)).toEqual(['DEMOTED', 'YOU ARE NOW RANK2']);
  });

  test('it refuses to demote below the first rank', () => {
    const b = build(1);

    b.controller('ControlCollision', b.demote, b.ctx);

    expect(b.circle.onCount).toBe(1);
    expect(b.shown.map((s) => s.text)).toEqual(['DEMOTED']);
  });

  test('the ramp PROMOTES and names the rank reached', () => {
    const b = build(4);

    b.controller('ControlCollision', b.promote, b.ctx);

    expect(b.circle.onCount).toBe(5);
    expect(b.shown.map((s) => s.text)).toEqual(['PROMOTED', 'YOU REACHED RANK4']);
  });

  test('at the top rank it says NOTHING rather than printing rubbish', () => {
    // The original formats its message inside `if (onCount < 9)` and displays it unconditionally, so
    // at the top rank it prints an uninitialised stack buffer. This port shows nothing instead — the
    // one deliberate deviation in this module.
    const b = build(TOP_RANK);

    b.controller('ControlCollision', b.promote, b.ctx);

    expect(b.circle.onCount).toBe(TOP_RANK);
    expect(b.shown.map((s) => s.text)).toEqual(['PROMOTED']);
  });

  test('a promotion from AddRankProgress suppresses the message, as everywhere else', () => {
    const b = build(4);
    b.setPromoted(true);

    b.controller('ControlCollision', b.promote, b.ctx);

    expect(b.shown.map((s) => s.text)).toEqual(['PROMOTED']);
  });

  test('BOTH halves pay the same two million and end the mission', () => {
    const up = build(4);
    const down = build(4);

    up.controller('ControlCollision', up.promote, up.ctx);
    down.controller('ControlCollision', down.demote, down.ctx);

    expect(up.score.curScore).toBe(TIME_WARP_AWARD);
    expect(down.score.curScore).toBe(TIME_WARP_AWARD);
    expect(up.missionLamp.messageField).toBe(1);
    expect(down.missionLamp.messageField).toBe(1);
    expect(down.lamps[0]!.on).toBe(false);
  });

  test('a component that is neither pays nothing', () => {
    const b = build(4);

    b.controller('ControlCollision', component('bump1'), b.ctx);

    expect(b.score.curScore).toBe(0);
    expect(b.missionLamp.messageField).toBe(24);
  });
});

describe('the game-over carousel lives in one integer', () => {
  function build(o: { players?: number[]; playerCount?: number; highs?: number[] } = {}) {
    const state = { messageField: 0 };
    const calls: string[] = [];
    const controller = makeGameoverController({
      state,
      playerScores: o.players ?? [1000, 2000],
      playerCount: o.playerCount ?? 2,
      highScores: o.highs ?? [50, 40, 30, 20, 10],
      goalLights: { lightsResetAndTurnOff: () => calls.push('goalsOff') },
      flippers: [{ gameOver: () => calls.push('flipper') }],
      enterGameOverMode: () => calls.push('mode'),
      playMusic: (t) => calls.push('music:' + t),
      playerText: (place, score) => 'P' + place + ':' + score,
      highScoreText: (place, score) => 'H' + place + ':' + score,
      bannerText: 'GAME OVER',
    });
    const step = () => controller('ControlMissionStarted', null, h.ctx);
    const h = harness();
    return { state, calls, controller, step, ...h };
  }

  test('taking over stops the table and resets the carousel', () => {
    const b = build();
    b.state.messageField = 0x123;

    b.controller('ControlMissionComplete', null, b.ctx);

    expect(b.calls).toEqual(['goalsOff', 'mode', 'flipper', 'music:track1']);
    expect(b.state.messageField).toBe(0);
  });

  test('from zero it shows the banner and arms the player phase', () => {
    const b = build();

    b.step();

    expect(b.shown).toEqual([{ text: 'GAME OVER', seconds: 10 }]);
    expect(b.state.messageField).toBe(PHASE_PLAYERS);
  });

  test('players come out IN ORDER, because 0x100 is a multiple of four', () => {
    const b = build({ players: [1000, 2000, 3000], playerCount: 3 });
    b.step(); // banner

    b.step(); b.step(); b.step();

    expect(b.shown.slice(1).map((s) => s.text)).toEqual(['P1:1000', 'P2:2000', 'P3:3000']);
  });

  test('the last player hands over to the high scores', () => {
    const b = build({ players: [1000, 2000], playerCount: 2 });
    b.step(); b.step(); b.step();

    expect(b.state.messageField).toBe(PHASE_HIGH_SCORES);
  });

  test('but the HIGH SCORES come out scrambled: third, first, fourth, second, fifth', () => {
    // `0x200` is 512 and 512 mod 5 is 2, and the phase bit is never masked off before the modulo. So
    // the carousel enters at index 2 and walks 0, 3, 1, 4. Every place is shown exactly once, in the
    // wrong order. A defect, observable, transcribed.
    const b = build({ players: [1000], playerCount: 1, highs: [50, 40, 30, 20, 10] });
    b.step(); // banner
    b.step(); // player 1, hands over

    b.step(); b.step(); b.step(); b.step(); b.step();

    expect(b.shown.slice(2).map((s) => s.text))
      .toEqual(['H3:30', 'H1:50', 'H4:20', 'H2:40', 'H5:10']);
  });

  test('and after the fifth it starts again at the banner', () => {
    const b = build({ players: [1000], playerCount: 1 });
    for (let i = 0; i < 7; i++) b.step();

    expect(b.state.messageField).toBe(0);

    b.step();

    expect(b.shown.at(-1)).toEqual({ text: 'GAME OVER', seconds: 10 });
  });

  test('an empty high-score table falls straight back to the banner', () => {
    const b = build({ players: [1000], playerCount: 1, highs: [0, 0, 0, 0, 0] });
    b.step(); b.step();

    b.step();

    expect(b.shown.at(-1)).toEqual({ text: 'GAME OVER', seconds: 10 });
  });
});

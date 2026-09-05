// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  makePlungerControl, makeDrainBallBlockerControl, NEW_BALL_REFLEX_SCORE,
  type FeedGroup, type FeedTable,
} from '../app/js/control/feed.js';
import { drainTimerExpired } from '../app/js/control/drain.js';
import type { LaneLight } from '../app/js/control/lanes.js';
import type { ControlContext, ControlledComponent, MessageCode } from '../app/js/control/dispatch.js';
import { createScoreState } from '../app/js/control/score.js';

function fakeLight(on = false): LaneLight & { readonly log: string[]; messageField: number } {
  const log: string[] = [];
  return {
    log, messageField: 7,
    get on() { return on; },
    get flashing() { return false; },
    turnOn() { on = true; log.push('on'); },
    turnOff() { on = false; log.push('off'); },
    turnOnTimed(s) { on = true; log.push('onTimed:' + s); },
    turnOffTimed(s) { log.push('offTimed:' + s); },
    flasherStart() { log.push('flash'); },
    flasherStartTimed(s) { log.push('flashTimed:' + s); },
    resetTimed() { log.push('reset'); },
  };
}

function fakeGroup(onCount = 0): FeedGroup & { readonly log: string[] } {
  const log: string[] = [];
  return {
    log,
    get onCount() { return onCount; },
    lightsResetAndTurnOn() { log.push('allOn'); },
    lightsResetAndTurnOff() { log.push('allOff'); },
    offsetAnimationForward(p) { log.push('fwd:' + p); },
    animationBackward(p) { log.push('back:' + p); },
  };
}

const component = (name: string): ControlledComponent => ({ name, scores: [], control: null });

function context() {
  const info: { text: string; seconds: number }[] = [];
  const missionCodes: MessageCode[] = [];
  const ctx: ControlContext = {
    score: createScoreState(),
    table: { extraBalls: 0, multiballCount: 0, ballCount: 3, tiltLocked: false },
    light: () => undefined,
    group: () => undefined,
    showInfo: (text, seconds) => info.push({ text, seconds }),
    showMission: () => {},
    playSound: () => {},
    playMusic: () => {},
    missionControl: (code) => missionCodes.push(code),
  };
  return { ctx, info, missionCodes };
}

describe('feeding a new ball', () => {
  function build(o: { shootAgain?: boolean; easy?: boolean; blockerActive?: boolean; circleLit?: number } = {}) {
    const shootAgainLamp = fakeLight(o.shootAgain ?? false);
    const firstSkillLamp = fakeLight();
    const skillShotGroup = fakeGroup();
    const trekGroups = [fakeGroup(), fakeGroup()];
    const middleCircle = fakeGroup(o.circleLit ?? 0);
    const fuelBargraph = fakeGroup();
    const gates = [{ disabled: 0, disable() { this.disabled++; } }];
    const table: FeedTable = { unlimitedBalls: true, reflexShotScore: 999 };
    const calls: string[] = [];
    const control = makePlungerControl({
      table, shootAgainLamp, firstSkillLamp, skillShotGroup, trekGroups,
      middleCircle, fuelBargraph, gates,
      isEasyMode: () => o.easy ?? false,
      blocker: { get active() { return o.blockerActive ?? false; }, enable: () => calls.push('blockerEnable') },
      disableMultiplier: () => calls.push('disableMultiplier'),
    });
    return { shootAgainLamp, firstSkillLamp, skillShotGroup, trekGroups, middleCircle, fuelBargraph, gates, table, calls, control, ...context() };
  }

  test('a fed ball tells the mission machine the mission has started', () => {
    const b = build();

    b.control('PlungerFeedBall', component('plunger'), b.ctx);

    expect(b.missionCodes).toEqual(['ControlMissionStarted']);
  });

  test('in EASY MODE feeding a ball raises the drain blocker', () => {
    const b = build({ easy: true });

    b.control('PlungerFeedBall', component('plunger'), b.ctx);

    expect(b.calls).toEqual(['blockerEnable']);
  });

  test('the blocker is not raised twice', () => {
    const b = build({ easy: true, blockerActive: true });

    b.control('PlungerFeedBall', component('plunger'), b.ctx);

    expect(b.calls).toEqual([]);
  });

  test('outside easy mode there is no blocker at all', () => {
    const b = build({ easy: false });

    b.control('PlungerFeedBall', component('plunger'), b.ctx);

    expect(b.calls).toEqual([]);
  });

  test('starting the feed timer always ends the unlimited-balls cheat', () => {
    const b = build();

    b.control('PlungerStartFeedTimer', component('plunger'), b.ctx);

    expect(b.table.unlimitedBalls).toBe(false);
  });

  test('a NEW ball resets the launch, the treks, the fuel and the gates', () => {
    const b = build({ shootAgain: false });

    b.control('PlungerStartFeedTimer', component('plunger'), b.ctx);

    expect(b.skillShotGroup.log).toEqual(['allOff', 'back:0.25']);
    expect(b.firstSkillLamp.on).toBe(true);
    expect(b.trekGroups[0]!.log).toEqual(['allOff', 'fwd:0.2', 'back:0.2']);
    expect(b.fuelBargraph.log).toEqual(['allOn']);
    expect(b.gates[0]!.disabled).toBe(1);
    expect(b.table.reflexShotScore).toBe(NEW_BALL_REFLEX_SCORE);
    expect(b.calls).toEqual(['disableMultiplier']);
  });

  test('a SHOOT-AGAIN ball gets none of it — the table carries on', () => {
    // The shoot-again lamp doubles as "this is the same ball continuing". Everything the player built
    // up in the launch chute, the trek lights, the fuel and the multiplier survives a saved ball, and
    // that single `if` is the only thing saying so.
    const b = build({ shootAgain: true });

    b.control('PlungerStartFeedTimer', component('plunger'), b.ctx);

    expect(b.skillShotGroup.log).toEqual([]);
    expect(b.fuelBargraph.log).toEqual([]);
    expect(b.gates[0]!.disabled).toBe(0);
    expect(b.table.reflexShotScore).toBe(999);
    expect(b.calls).toEqual([]);
  });

  test('but the lamp is disarmed either way', () => {
    // `lite200->MessageField = 0` sits outside the guard: it is the latch that
    // `ShootAgainLightControl` uses, cleared so the next fade can happen.
    const saved = build({ shootAgain: true });
    const fresh = build({ shootAgain: false });

    saved.control('PlungerStartFeedTimer', component('plunger'), saved.ctx);
    fresh.control('PlungerStartFeedTimer', component('plunger'), fresh.ctx);

    expect(saved.shootAgainLamp.messageField).toBe(0);
    expect(fresh.shootAgainLamp.messageField).toBe(0);
  });

  test('a dark rank circle is nudged forward, a lit one left alone', () => {
    const dark = build({ circleLit: 0 });
    const lit = build({ circleLit: 2 });

    dark.control('PlungerStartFeedTimer', component('plunger'), dark.ctx);
    lit.control('PlungerStartFeedTimer', component('plunger'), lit.ctx);

    expect(dark.middleCircle.log).toEqual(['fwd:0']);
    expect(lit.middleCircle.log).toEqual([]);
  });
});

describe('what happens after the ball is gone', () => {
  function build(o: { gameOver?: boolean; highScore?: boolean } = {}) {
    const calls: string[] = [];
    const result = drainTimerExpired({
      spareLamp: { messageField: o.gameOver ? 1 : 0 },
      endGame: () => calls.push('endGame'),
      isHighScore: () => o.highScore ?? false,
      tableLights: { flasherStartTimedThenStayOff: (s) => calls.push('fade:' + s) },
      showMission: (text, seconds) => calls.push('mission:' + text + ':' + seconds),
      highScoreText: 'ENTER YOUR NAME',
      playSound: (n) => calls.push('sound:' + n),
      highScoreSound: 'fanfare',
      startFeedTimer: () => calls.push('feed'),
    });
    return { calls, result };
  }

  test('an ordinary lost ball just feeds the next one', () => {
    const b = build({ gameOver: false });

    expect(b.result).toBe('feedNextBall');
    expect(b.calls).toEqual(['feed']);
  });

  test('the flag the drain left behind is what ends the game', () => {
    // `lite199->MessageField` — set to 1 by the drain on the last ball of the last player. The two
    // halves of `BallDrainControl` talk to each other through a lamp.
    const b = build({ gameOver: true });

    expect(b.result).toBe('gameOver');
    expect(b.calls).toEqual(['endGame']);
  });

  test('a high score also asks for a name, over the whole table flashing', () => {
    const b = build({ gameOver: true, highScore: true });

    expect(b.calls).toEqual(['endGame', 'sound:fanfare', 'fade:3', 'mission:ENTER YOUR NAME:-1']);
  });
});

describe('the drain blocker has two lives', () => {
  function build(easy = false) {
    const lamp = fakeLight();
    const blocker = {
      messageField: 0, log: [] as string[],
      enable(s: number) { this.log.push('enable:' + s); },
      restartTimeout(s: number) { this.log.push('restart:' + s); },
      disable() { this.log.push('disable'); },
    };
    const control = makeDrainBallBlockerControl({
      blocker, lamp, initialDuration: 30, extendedDuration: 10, isEasyMode: () => easy,
    });
    return { lamp, blocker, control, ...context() };
  }

  test('it goes up solid for its initial duration', () => {
    const b = build();

    b.control('TBlockerEnable', component('block1'), b.ctx);

    expect(b.blocker.log).toEqual(['enable:30']);
    expect(b.lamp.log).toEqual(['onTimed:30']);
    expect(b.blocker.messageField).toBe(1);
  });

  test('its time running out buys a FLASHING extension, not the end', () => {
    // Solid then flashing: the lamp is the countdown. The player is told the outlane is about to open
    // again without a word of text anywhere.
    const b = build();
    b.control('TBlockerEnable', component('block1'), b.ctx);

    b.control('ControlTimerExpired', component('block1'), b.ctx);

    expect(b.blocker.log).toEqual(['enable:30', 'restart:10']);
    expect(b.lamp.log).toEqual(['onTimed:30', 'flashTimed:10']);
    expect(b.blocker.messageField).toBe(2);
  });

  test('the SECOND expiry is what lowers it', () => {
    const b = build();
    b.control('TBlockerEnable', component('block1'), b.ctx);
    b.control('ControlTimerExpired', component('block1'), b.ctx);

    b.control('ControlTimerExpired', component('block1'), b.ctx);

    expect(b.blocker.log).toContain('disable');
    expect(b.blocker.messageField).toBe(0);
  });

  test('in EASY MODE it is raised with a duration that never expires', () => {
    // The third place -1 means "never": the escape chute sink, the disabled multiplier timer, and here.
    // Easy mode does not lengthen the blocker — it removes its clock.
    const b = build(true);

    b.control('TBlockerEnable', component('block1'), b.ctx);

    expect(b.blocker.log).toEqual(['enable:-1']);
    expect(b.lamp.log).toEqual(['onTimed:-1']);
  });

  test('a timer expiring before it was ever raised lowers it', () => {
    const b = build();

    b.control('ControlTimerExpired', component('block1'), b.ctx);

    expect(b.blocker.log).toEqual(['disable']);
  });
});

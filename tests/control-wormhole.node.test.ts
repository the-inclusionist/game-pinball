// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  advanceWormHoleDestination, makeWormHoleControl, makeWormHoleDestinationControl,
  makeBlackHoleKickoutControl, makeFlagControl, makeGravityWellKickoutControl,
  MISSIONS_THAT_FREEZE_THE_WORMHOLE,
} from '../app/js/control/wormhole.js';
import type { LaneLight } from '../app/js/control/lanes.js';
import type { ControlContext, ControlledComponent } from '../app/js/control/dispatch.js';
import { createScoreState } from '../app/js/control/score.js';

type TestLight = LaneLight & {
  readonly log: string[];
  setOnFrame(index: number): void;
  flasherStartTimedThenStayOff(seconds: number): void;
  flasherStartTimedThenStayOn(seconds: number): void;
};

function fakeLight(on = false): TestLight {
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
    flasherStartTimedThenStayOff(s: number) { log.push('fadeOff:' + s); },
    flasherStartTimedThenStayOn(s: number) { on = true; log.push('fadeOn:' + s); },
    setOnFrame(i: number) { log.push('frame:' + i); },
    resetTimed() { log.push('reset'); },
  } as never;
}

const component = (name: string, scores: readonly number[] = [1000, 20000, 5000]): ControlledComponent =>
  ({ name, scores, control: null });

function context() {
  const info: { text: string; seconds: number }[] = [];
  const ctx: ControlContext = {
    score: createScoreState(),
    table: { extraBalls: 0, multiballCount: 0, ballCount: 3, tiltLocked: false },
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

describe('the wormhole destination cycles 1, 2, 3 and round again', () => {
  function build(o: { mission?: number; current?: number; lit?: boolean } = {}) {
    const log: string[] = [];
    const destinationLamp = { messageField: o.current ?? 0, lit: o.lit ?? false };
    const arrowLights = {
      // The group writes the field through EVERY member, `lite4` included.
      setMessageField(v: number) { destinationLamp.messageField = v; log.push('field:' + v); },
      setOnFrame(v: number) { log.push('frame:' + v); },
      lightsResetAndTurnOn() { log.push('arrowsOn'); },
    };
    const wormHoleLights = { lightsResetAndTurnOn() { log.push('holesOn'); } };
    const opts = {
      missionLamp: { messageField: o.mission ?? 0 },
      destinationLamp, arrowLights, wormHoleLights,
    };
    return { opts, destinationLamp, log };
  }

  test('forcing it from nothing selects the first sink', () => {
    const b = build({ current: 0 });

    advanceWormHoleDestination(b.opts, true);

    expect(b.destinationLamp.messageField).toBe(1);
  });

  test('the arrow GRAPHIC is the destination counted backwards', () => {
    // `TLightSetOnStateBmpIndex, 3 - val`. The arrow frame and the destination number are the same
    // fact drawn two ways, which is why nothing stores "which way the arrow points".
    const b = build({ current: 1 });

    advanceWormHoleDestination(b.opts, true);

    expect(b.log).toEqual(['field:2', 'frame:1', 'holesOn', 'arrowsOn']);
  });

  test('it wraps from three back to one, never to zero', () => {
    // Zero means "no destination at all", so the cycle must skip it or the wormhole would switch
    // itself off every third advance.
    const b = build({ current: 3 });

    advanceWormHoleDestination(b.opts, true);

    expect(b.destinationLamp.messageField).toBe(1);
  });

  test('UNFORCED, it only advances a cycle that is already running', () => {
    const idle = build({ current: 0 });
    const running = build({ current: 1 });

    advanceWormHoleDestination(idle.opts, false);
    advanceWormHoleDestination(running.opts, false);

    expect(idle.destinationLamp.messageField).toBe(0);
    expect(running.destinationLamp.messageField).toBe(2);
  });

  test('three missions freeze the wormhole entirely', () => {
    expect(MISSIONS_THAT_FREEZE_THE_WORMHOLE).toEqual([16, 22, 23]);

    for (const mission of MISSIONS_THAT_FREEZE_THE_WORMHOLE) {
      const b = build({ mission, current: 1 });
      advanceWormHoleDestination(b.opts, true);
      expect(b.destinationLamp.messageField).toBe(1);
    }
  });

  test('an already-lit lamp is not re-lit', () => {
    const b = build({ current: 1, lit: true });

    advanceWormHoleDestination(b.opts, true);

    expect(b.log).toEqual(['field:2', 'frame:1']);
  });
});

describe('the wormhole sinks move the ball', () => {
  function build(o: { armed?: number; multiball?: boolean; multiballCount?: number } = {}) {
    const sinks = [0, 1, 2].map((i) => ({
      timerTime: 3, resets: [] as number[], index: i,
      resetTimer(s: number) { this.resets.push(s); },
    }));
    const arrivalLamps = [fakeLight(), fakeLight(), fakeLight()];
    const arrowLamps = [fakeLight(), fakeLight(), fakeLight()];
    const destinationLamp = { messageField: o.armed ?? 0 };
    const calls: string[] = [];
    const groups = {
      wormHoleLights: { lightsResetAndTurnOff: () => calls.push('holesOff') },
      arrowLights: { lightsResetAndTurnOff: () => calls.push('arrowsOff') },
    };
    const targetLamp = fakeLight(true);
    const components = [component('sink1'), component('sink2'), component('sink3')];
    const control = makeWormHoleControl({
      sinks, arrivalLamps, arrowLamps, destinationLamp, targetLamp,
      wormHoleLights: groups.wormHoleLights, arrowLights: groups.arrowLights,
      table: { multiballFlag: o.multiball ?? false, multiballCount: o.multiballCount ?? 0 },
      lockBall: () => calls.push('lockBall'),
      setReplay: (s) => calls.push('replay:' + s),
      arrivalText: 'WORMHOLE',
      sinkIndexFor: (caller) => {
        const i = components.indexOf(caller);
        return i < 0 ? undefined : i;
      },
    });
    return { sinks, arrivalLamps, arrowLamps, destinationLamp, targetLamp, components, calls, control, ...context() };
  }

  test('with no destination armed the ball comes back out where it went in', () => {
    const b = build({ armed: 0 });

    b.control('ControlCollision', b.components[1]!, b.ctx);

    expect(b.ctx.score.curScore).toBe(1000);
    expect(b.sinks[1]!.resets).toEqual([3]);
    expect(b.sinks[0]!.resets).toEqual([]);
  });

  test('into the WRONG sink and the ball is carried to the armed one', () => {
    // This is the wormhole itself. The ball enters sink 1 and leaves from sink 3, because the arrows
    // said 3 — one array index is the entire teleport.
    const b = build({ armed: 3 });

    b.control('ControlCollision', b.components[0]!, b.ctx);

    expect(b.sinks[2]!.resets).toEqual([3]);
    expect(b.sinks[0]!.resets).toEqual([]);
    expect(b.ctx.score.curScore).toBe(5000);
  });

  test('into the RIGHT sink and it pays the middle score and a replay', () => {
    const b = build({ armed: 2 });

    b.control('ControlCollision', b.components[1]!, b.ctx);

    expect(b.ctx.score.curScore).toBe(20000);
    expect(b.calls).toContain('replay:4');
    expect(b.sinks[1]!.resets).toEqual([3]);
  });

  test('any hit at all disarms the destination and darkens the lamps', () => {
    const b = build({ armed: 2 });

    b.control('ControlCollision', b.components[0]!, b.ctx);

    expect(b.destinationLamp.messageField).toBe(0);
    expect(b.calls).toContain('holesOff');
    expect(b.calls).toContain('arrowsOff');
    expect(b.targetLamp.lit).toBe(false);
  });

  test('during MULTIBALL the right sink LOCKS a ball instead of paying a replay', () => {
    const b = build({ armed: 2, multiball: true, multiballCount: 1 });

    b.control('ControlCollision', b.components[1]!, b.ctx);

    expect(b.calls).toEqual(['holesOff', 'arrowsOff', 'lockBall']);
    expect(b.ctx.score.curScore).toBe(10000);
  });

  test('and the locked ball is NOT sent anywhere — the sink keeps it', () => {
    // The early `return` skips the whole teleport tail. Every other path ends by resetting a sink's
    // timer, which is what releases the ball; this one deliberately does not.
    const b = build({ armed: 2, multiball: true, multiballCount: 1 });

    b.control('ControlCollision', b.components[1]!, b.ctx);

    expect(b.sinks.every((s) => s.resets.length === 0)).toBe(true);
  });

  test('with more than one ball loose it pays a flat fifty thousand instead', () => {
    const b = build({ armed: 2, multiball: true, multiballCount: 2 });

    b.control('ControlCollision', b.components[1]!, b.ctx);

    expect(b.ctx.score.curScore).toBe(50000);
    expect(b.calls).toContain('replay:4');
    expect(b.sinks[1]!.resets).toEqual([3]);
  });

  test('the arriving sink shows an arrow counted backwards from it', () => {
    const b = build({ armed: 3 });

    b.control('ControlCollision', b.components[0]!, b.ctx);

    expect(b.arrowLamps[2]!.log).toContain('frame:0');
    expect(b.arrivalLamps[2]!.log).toContain('fadeOff:3');
  });

  test('a component that is not a wormhole sink is ignored', () => {
    const b = build();

    b.control('ControlCollision', component('roll1'), b.ctx);

    expect(b.ctx.score.curScore).toBe(0);
  });
});

describe('the small pieces around the wormhole', () => {
  test('the destination target announces itself once and then advances the cycle', () => {
    const targetLamp = fakeLight(false);
    const advanced: boolean[] = [];
    const control = makeWormHoleDestinationControl({
      targetLamp, announceText: 'WORMHOLE OPEN',
      advance: (forced) => advanced.push(forced),
    });
    const { ctx, info } = context();

    control('ControlCollision', component('target1', [3000]), ctx);

    expect(targetLamp.log).toEqual(['fadeOn:3']);
    expect(info).toEqual([{ text: 'WORMHOLE OPEN', seconds: 2 }]);
    expect(ctx.score.curScore).toBe(3000);
    expect(advanced).toEqual([true]);
  });

  test('with the lamp already lit it says nothing but still advances', () => {
    const targetLamp = fakeLight(true);
    const advanced: boolean[] = [];
    const control = makeWormHoleDestinationControl({
      targetLamp, announceText: 'WORMHOLE OPEN', advance: (forced) => advanced.push(forced),
    });
    const { ctx, info } = context();

    control('ControlCollision', component('target1', [3000]), ctx);

    expect(info).toEqual([]);
    expect(advanced).toEqual([true]);
  });

  test('the flag uses a LAMP AS A SCORE INDEX', () => {
    // `get_scoring(lite20->light_on())` — a boolean handed straight to an array index. Two scores in
    // one row and no conditional anywhere.
    const dark = fakeLight(false);
    const lit = fakeLight(true);
    const advanced: boolean[] = [];
    const build = (lamp: LaneLight) => makeFlagControl({ lamp, advance: (f) => advanced.push(f) });
    const a = context();
    const c = context();

    build(dark)('ControlCollision', component('flag1', [750, 7500]), a.ctx);
    build(lit)('ControlCollision', component('flag1', [750, 7500]), c.ctx);

    expect(a.ctx.score.curScore).toBe(750);
    expect(c.ctx.score.curScore).toBe(7500);
  });

  test('a completed spinner loop advances the cycle WITHOUT forcing it', () => {
    // The difference between the two callers of the same function: the target opens the wormhole, the
    // spinner only moves a cycle that is already running.
    const advanced: boolean[] = [];
    const control = makeFlagControl({ lamp: fakeLight(), advance: (f) => advanced.push(f) });
    const { ctx } = context();

    control('ControlSpinnerLoopReset', component('flag1'), ctx);

    expect(advanced).toEqual([false]);
  });

  test('the black hole holds the ball with a timer that never fires', () => {
    const restarts: number[] = [];
    const control = makeBlackHoleKickoutControl({
      kickout: { restartTimer: (s) => restarts.push(s) },
      scoreText: (points) => 'BLACK HOLE ' + points,
    });
    const { ctx, info } = context();

    control('ControlCollision', component('kickout1', [15000]), ctx);

    expect(ctx.score.curScore).toBe(15000);
    expect(info).toEqual([{ text: 'BLACK HOLE 15000', seconds: 2 }]);
    expect(restarts).toEqual([-1]);
  });
});

describe('the gravity well is armed from outside and spends itself on one ball', () => {
  function build() {
    const lamp = fakeLight(true);
    const kickout = {
      active: true, restarts: [] as number[],
      restartTimer(s: number) { this.restarts.push(s); },
    };
    const control = makeGravityWellKickoutControl({
      lamp, kickout, soundDuration: () => 1.5,
      scoreText: (points) => 'GRAVITY WELL ' + points,
      armedText: (points) => 'WORTH ' + points,
      unknownText: 'ARMED',
    });
    return { lamp, kickout, control, ...context() };
  }

  test('collecting it darkens the lamp and DEACTIVATES the kickout', () => {
    const b = build();

    b.control('ControlCollision', component('kickout1', [20000]), b.ctx);

    expect(b.ctx.score.curScore).toBe(20000);
    expect(b.lamp.lit).toBe(false);
    expect(b.kickout.active).toBe(false);
  });

  test('the ball is held exactly as long as the sound plays', () => {
    // `soundwave7->Play(...)` returns its duration, and that duration is the timer. The ball is
    // released the instant the noise ends — the animation IS the timing.
    const b = build();

    b.control('ControlCollision', component('kickout1', [20000]), b.ctx);

    expect(b.kickout.restarts).toEqual([1.5]);
  });

  test('arming it flashes the lamp and switches the kickout back on', () => {
    const b = build();
    b.control('ControlCollision', component('kickout1', [20000]), b.ctx);

    b.control('ControlEnableMultiplier', component('kickout1'), b.ctx);

    expect(b.kickout.active).toBe(true);
    expect(b.lamp.log).toContain('flash');
  });

  test('a reset switches it off', () => {
    const b = build();

    b.control('Reset', component('kickout1'), b.ctx);

    expect(b.kickout.active).toBe(false);
  });
});

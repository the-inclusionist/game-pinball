// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  handler, getScoring, rebounderControl, bumperControl, makeFlipperRebounderControl,
  type ControlContext, type ControlledComponent, type MessageCode, type LightLike,
} from '../app/js/control/dispatch.js';
import { createTableActions } from '../app/js/control/table-actions.js';
import { createScoreState } from '../app/js/control/score.js';

/** A lamp that records what was asked of it. */
function fakeLight() {
  const calls: string[] = [];
  let on = false;
  const light: LightLike = {
    turnOn: () => { on = true; calls.push('turnOn'); },
    turnOnTimed: (s) => { on = true; calls.push(`turnOnTimed:${s}`); },
    resetTimed: () => calls.push('resetTimed'),
    flasherStartTimed: (s) => calls.push(`flasherStartTimed:${s}`),
    get lit() { return on; },
  };
  return { light, calls };
}

function build() {
  const lights = new Map<string, ReturnType<typeof fakeLight>>();
  const missionSaw: { code: MessageCode; name: string }[] = [];
  const info: { text: string; seconds: number }[] = [];
  const mission: { text: string; seconds: number }[] = [];
  const sounds: string[] = [];
  const music: string[] = [];

  const ctx: ControlContext = {
    score: createScoreState(),
    table: { extraBalls: 0, multiballCount: 0, ballCount: 3, tiltLocked: false },
    light: (name) => {
      if (!lights.has(name)) lights.set(name, fakeLight());
      return lights.get(name)!.light;
    },
    group: () => undefined,
    showInfo: (text, seconds) => info.push({ text, seconds }),
    showMission: (text, seconds) => mission.push({ text, seconds }),
    playSound: (name) => sounds.push(name),
    playMusic: (track) => music.push(track),
    missionControl: (code, caller) => missionSaw.push({ code, name: caller.name }),
  };

  return { ctx, lights, missionSaw, info, mission, sounds, music };
}

const component = (overrides: Partial<ControlledComponent> = {}): ControlledComponent => ({
  name: 'thing', scores: [100, 250, 700], control: null, ...overrides,
});

describe('dispatch — every event is dispatched TWICE', () => {
  test('the mission control runs even when the component has no control function', () => {
    // Nothing in the game subscribes to anything. The mission does not register interest in the parts
    // it cares about: it sees the whole table and decides for itself.
    const { ctx, missionSaw } = build();

    handler('ControlCollision', component(), ctx);

    expect(missionSaw).toEqual([{ code: 'ControlCollision', name: 'thing' }]);
  });

  test('the component’s own control runs FIRST, then the mission', () => {
    const { ctx, missionSaw } = build();
    const order: string[] = [];
    const c = component({ control: () => order.push('component') });
    const wrapped: ControlContext = {
      ...ctx,
      missionControl: (code, caller) => { order.push('mission'); missionSaw.push({ code, name: caller.name }); },
    };

    handler('ControlCollision', c, wrapped);

    expect(order).toEqual(['component', 'mission']);
  });

  test('every kind of event goes through, not only collisions', () => {
    const { ctx, missionSaw } = build();

    handler('ControlTimerExpired', component(), ctx);
    handler('Reset', component(), ctx);
    handler('SetTiltLock', component(), ctx);

    expect(missionSaw.map((s) => s.code)).toEqual(['ControlTimerExpired', 'Reset', 'SetTiltLock']);
  });
});

describe('dispatch — the scores are a table, not code', () => {
  test('an index reads the component’s own score array', () => {
    expect(getScoring(component(), 1)).toBe(250);
  });

  test('an index past the end is ZERO and no complaint', () => {
    // The original's own guard, and it is what keeps a component whose level runs ahead of its score
    // array from crashing.
    expect(getScoring(component(), 9)).toBe(0);
    expect(getScoring(component(), -1)).toBe(0);
  });

  test('a rebounder always takes the first entry', () => {
    const { ctx } = build();

    rebounderControl('ControlCollision', component(), ctx);

    expect(ctx.score.curScore).toBe(100);
  });

  test('a rebounder ignores anything that is not a collision', () => {
    const { ctx } = build();

    rebounderControl('ControlTimerExpired', component(), ctx);

    expect(ctx.score.curScore).toBe(0);
  });

  test('a BUMPER takes the entry chosen by its own level', () => {
    // A bumper hit more is worth more, with no conditional anywhere — just a different index into the
    // same table.
    const { ctx } = build();
    const bumper = component({ self: { level: 2 } });

    bumperControl('ControlCollision', bumper, ctx);

    expect(ctx.score.curScore).toBe(700);
  });

  test('a bumper whose level runs past its score array scores nothing', () => {
    const { ctx } = build();

    bumperControl('ControlCollision', component({ self: { level: 9 } }), ctx);

    expect(ctx.score.curScore).toBe(0);
  });

  test('a flipper rebounder scores AND blinks', () => {
    const { ctx, lights } = build();
    const control = makeFlipperRebounderControl('lite84');

    control('ControlCollision', component(), ctx);

    expect(ctx.score.curScore).toBe(100);
    expect(lights.get('lite84')!.calls).toEqual(['turnOnTimed:0.1']);
  });
});

describe('table actions — flag, lamp, message', () => {
  function actions() {
    const built = build();
    const a = createTableActions({
      ctx: built.ctx,
      text: {
        extraBall: 'EXTRA BALL', bonusHeld: 'BONUS HELD', bonusSet: 'BONUS',
        jackpotSet: 'JACKPOT', multiball: 'MULTIBALL', replay: 'REPLAY',
        flagLightsSet: 'FLAGS',
      },
      lamps: {
        bonusHold: 'lite58', bonus: 'lite59', jackpot: 'lite60', replay: 'lite199',
        multiball: ['lite38', 'lite39', 'lite40'],
        flagLights: ['lite20', 'lite19', 'lite61'],
      },
      resetSinkTimers: (s) => built.sounds.push(`sinks:${s}`),
    });
    return { ...built, a };
  }

  test('an extra ball is a counter and an announcement', () => {
    const { a, ctx, info } = actions();

    a.addExtraBall(3);

    expect(ctx.table.extraBalls).toBe(1);
    expect(info).toEqual([{ text: 'EXTRA BALL', seconds: 3 }]);
  });

  test('the bonus sets its flag and THE LAMP IS THE TIMER', () => {
    // Nothing separately counts the sixty seconds down. The lamp going dark is the award expiring, as
    // far as the player can tell.
    const { a, ctx, lights } = actions();

    a.setBonus();

    expect(ctx.score.bonusScoreFlag).toBe(true);
    expect(lights.get('lite59')!.calls).toEqual(['turnOnTimed:60']);
  });

  test('the flag lights are three lamps and NO flag at all', () => {
    // The odd one out among the `table_set_*` helpers: it sets nothing on the table. Whatever the
    // flag lights mean is read off the lamps by whoever cares — `FlagControl` uses one of them as a
    // score index. And `lite61` being one of the three is what walks the booster bank's award chain
    // on; see `control/banks`.
    const { a, lights } = actions();

    a.setFlagLights();

    expect(lights.get('lite20')!.calls).toEqual(['turnOnTimed:60']);
    expect(lights.get('lite19')!.calls).toEqual(['turnOnTimed:60']);
    expect(lights.get('lite61')!.calls).toEqual(['turnOnTimed:60']);
  });

  test('the jackpot is the same three moves with a different flag and lamp', () => {
    const { a, ctx, lights } = actions();

    a.setJackpot();

    expect(ctx.score.jackpotScoreFlag).toBe(true);
    expect(lights.get('lite60')!.calls).toEqual(['turnOnTimed:60']);
  });

  test('multiball adds three balls and flashes all three lamps', () => {
    const { a, ctx, lights, music } = actions();

    a.setMultiball(5);

    expect(ctx.table.multiballCount).toBe(3);
    expect(lights.get('lite38')!.calls).toEqual(['flasherStartTimed:-1']);
    expect(music).toEqual(['track3']);
  });

  test('multiball REFUSES to start while more than one ball is in play', () => {
    // The guard is `<= 1`, so a second trigger during multiball does nothing rather than stacking to
    // six balls.
    const { a, ctx } = actions();
    ctx.table.multiballCount = 3;

    a.setMultiball(5);

    expect(ctx.table.multiballCount).toBe(3);
  });

  test('it does start with exactly one ball in play', () => {
    const { a, ctx } = actions();
    ctx.table.multiballCount = 1;

    a.setMultiball(5);

    expect(ctx.table.multiballCount).toBe(4);
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { createLiveControls } from '../app/js/table/live-controls.js';
import { CATALOG, LOW_ORBIT } from '../app/js/table/catalog.js';

/**
 * ⚠️ THE CONTROL LAYER WAS PORTED IN FULL AND REACHED FROM NOTHING.
 *
 * Thirty-two missions, a hundred and forty-five components, every calibrated number, all tested. And
 * `main.ts` collected the ball's hits into an array of NAMES and never dispatched one: no score, no
 * lamp, no mission, in a game that had been playable for several commits.
 *
 * This is the join. It is small, and it being small is the finding: what was missing was never the
 * behaviour, it was the two lines that hand a hit to it.
 */

const controls = (table = LOW_ORBIT) => createLiveControls(table);

describe('a hit reaches the behaviour the table named', () => {
  test('a bumper scores', () => {
    const live = controls();

    live.hit('bumper1');

    expect(live.score.curScore).toBeGreaterThan(0);
  });

  test('and a hit on nothing at all is quiet', () => {
    // The physics reports edges the table declared, so this should not happen — but a name that
    // reaches no component must not be a crash, because the alternative is a game that dies on a
    // typo in a table file.
    const live = controls();

    expect(() => live.hit('no-such-component')).not.toThrow();
    expect(live.score.curScore).toBe(0);
  });

  test('⚠️ a target is worth MORE the second time, and a lane is not', () => {
    // The difference between the two is the whole reason both entries exist. A target rewards
    // persistence; a lane is a rollover, and a ball crossing it twice in a second is not skill.
    const target = controls();
    target.hit('target1');
    const first = target.score.curScore;
    target.hit('target1');
    const second = target.score.curScore - first;

    const lane = controls();
    lane.hit('lane1');
    const laneFirst = lane.score.curScore;
    lane.hit('lane1');
    const laneSecond = lane.score.curScore - laneFirst;

    expect(second).toBeGreaterThan(first);
    expect(laneSecond).toBe(laneFirst);
  });

  test('a target stops climbing at the end of its own score table', () => {
    // Clamped rather than wrapped: a target that cycled back to its cheapest score on the third hit
    // would pay less for more work, and `getScoring` out of range is silently zero — so wrapping and
    // running off the end both look like a bug in the table.
    const live = controls();
    const target = LOW_ORBIT.components.find((c) => c.name === 'target1')!;

    for (let i = 0; i < 10; i++) live.hit('target1');

    const top = target.scores![target.scores!.length - 1]!;
    expect(live.score.curScore).toBeGreaterThanOrEqual(top * 8);
  });
});

describe('the lamps are the table’s own', () => {
  test('every declared lamp exists and starts dark', () => {
    const live = controls();

    for (const name of LOW_ORBIT.lamps) {
      expect(live.context.light(name), name).toBeDefined();
      expect(live.context.light(name)!.lit, name).toBe(false);
    }
  });

  test('and a component that names one lights it when hit', () => {
    const live = controls();
    const lit = LOW_ORBIT.components.find((c) => c.name === 'target1')!.lamps![0]!;

    live.hit('target1');

    expect(live.context.light(lit)!.lit).toBe(true);
  });

  test('⚠️ a BUMPER lights too, which it did not', () => {
    // Every bumper in the catalogue declared a lamp and none ever lit. In the original a bumper lights
    // ITSELF through `TBumperSetBmpIndex` on the component, and the control function has nothing to do
    // with it; an authored bumper has no component behind it — the control IS the component — so it
    // happens in the wrapper or nowhere, and it was happening nowhere.
    //
    // Written as its own test because a mutation that removed the lighting survived everything else:
    // the validator's new rule only asks whether a control CAN light, not whether it does.
    const live = controls();
    const bumper = LOW_ORBIT.components.find((c) => c.kind === 'bumper' && c.lamps?.length)!;

    live.hit(bumper.name);

    expect(live.context.light(bumper.lamps![0]!)!.lit).toBe(true);
  });

  test('a lamp the table never declared is simply absent', () => {
    // `light()` returns undefined and every control uses `?.`, which is the original's shape too: a
    // missing global lamp there is a null pointer nobody dereferences.
    expect(controls().context.light('lamp.invented')).toBeUndefined();
  });
});

describe('every table in the catalogue can be wired', () => {
  test.each(CATALOG.map((t) => [t.name, t] as const))('%s: builds and dispatches', (_name, table) => {
    const live = createLiveControls(table);

    for (const component of table.components) {
      expect(() => live.hit(component.name)).not.toThrow();
    }
  });
});

/**
 * ⚠️ THE HUD SAID "Bolas: 3" FOR EVER, AND LOSING A BALL COST NOTHING.
 *
 * The count was a constant in a flags object nobody wrote to. A ball drained, the game respawned it, and
 * the player could not lose. Seventh time in this port that something declared turned out to be inert —
 * this one visible in the corner of the screen the whole time.
 *
 * ⚠️ AND `control/drain` IS NOT THE ANSWER HERE. Its four-question cascade is transcribed and correct,
 * and it wants `lite200`, `lite199`, `lite58` and `lite198`, a mission lamp with a message field, a list
 * of per-ball lamps and a list of per-ball components. Those are the 1995 TABLE's, exactly like the
 * control names were, and an authored table has no way to declare them. So the authored ball cycle is
 * the part an authored table can actually mean: count the balls, end the game, and say so.
 */
describe('losing a ball costs a ball', () => {
  test('draining takes one', () => {
    const live = controls();
    const before = live.flags.ballCount;

    live.endBall();

    expect(live.flags.ballCount).toBe(before - 1);
  });

  test('the last one ends the game', () => {
    const live = controls();

    let result = live.endBall();
    while (!result.gameOver) result = live.endBall();

    expect(live.flags.ballCount).toBe(0);
  });

  test('and the count never goes below zero, however many times it is called', () => {
    // The game loop calls this from a POSITION test, and a ball that lands in a drain and is not moved
    // would be reported again on the next frame. Clamping here is cheaper than being sure elsewhere.
    const live = controls();

    for (let i = 0; i < 20; i++) live.endBall();

    expect(live.flags.ballCount).toBe(0);
  });

  test('⚠️ the score survives the ball, because it belongs to the player', () => {
    const live = controls();
    live.hit('bumper1');
    const earned = live.score.curScore;

    live.endBall();

    expect(live.score.curScore).toBe(earned);
  });

  test('⚠️ but the lamps and the targets do NOT', () => {
    // A target that kept its level would open the next ball at its top score, and a lamp lit by the
    // last ball would say the next one had already done the work. In the 1995 table which lamps
    // survive is a hand-written list and the OMISSIONS are the design; an authored table has no such
    // list, so the rule is "everything", declared rather than half-copied.
    const live = controls();
    live.hit('target1');
    live.hit('target1');
    const secondHit = live.score.curScore;

    live.endBall();
    live.hit('target1');

    expect(live.litLamps()).toHaveLength(1);
    expect(live.score.curScore - secondHit).toBe(LOW_ORBIT.components.find((c) => c.name === 'target1')!.scores![0]);
  });
});

describe('⚠️ and the table can be heard', () => {
  const played: { name: string; source?: { x: number; y: number } }[] = [];
  const audible = (table = LOW_ORBIT) => {
    played.length = 0;
    return createLiveControls(table, { playSound: (name, source) => played.push({ name, source }) });
  };

  test('hitting a bumper plays the bumper voice', () => {
    const live = audible();

    live.hit('bumper1');

    expect(played.map((p) => p.name)).toEqual(['bumper']);
  });

  test('⚠️ hitting a wall plays nothing, because a resting ball would rattle', () => {
    const live = audible();

    live.hit('wall.left');

    expect(played).toEqual([]);
  });

  test('⚠️ the sound is placed where the component IS, in the mixer’s own coordinates', () => {
    // `SoundSource` is documented as "normalized to [0,1]; (0,0) is the bottom left", and a table's y
    // grows DOWNWARD. Passing the raw bounds would put every sound off the edge of the field and flip
    // the whole table top to bottom — audible as a sound coming from the wrong end.
    const live = audible();
    const bumper = LOW_ORBIT.components.find((c) => c.name === 'bumper1')!;

    live.hit('bumper1');

    const source = played[0]!.source!;
    expect(source.x).toBeCloseTo((bumper.bounds.x + bumper.bounds.width / 2) / LOW_ORBIT.size.width, 6);
    expect(source.y).toBeCloseTo(
      1 - (bumper.bounds.y + bumper.bounds.height / 2) / LOW_ORBIT.size.height, 6,
    );
  });

  test('and losing the ball has its own voice', () => {
    // The drain never collides — see `physics-build` — so nothing else could ever sound it.
    const live = audible();

    live.endBall();

    expect(played.map((p) => p.name)).toContain('drain');
  });
});

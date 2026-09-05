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
      expect(live.context.light(name)!.on, name).toBe(false);
    }
  });

  test('and a component that names one lights it when hit', () => {
    const live = controls();
    const lit = LOW_ORBIT.components.find((c) => c.name === 'target1')!.lamps![0]!;

    live.hit('target1');

    expect(live.context.light(lit)!.on).toBe(true);
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

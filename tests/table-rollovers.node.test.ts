// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { createRolloverWatch, ROLLOVER_KINDS } from '../app/js/table/rollovers.js';
import { CATALOG, LOW_ORBIT } from '../app/js/table/catalog.js';

/**
 * ⚠️ SEVEN COMPONENTS ARE PAINTED, SCORED, LAMPED — AND THE BALL GOES THROUGH THEM SAYING NOTHING.
 *
 * `low-orbit` has three reentry lanes, three wormhole wells and a kicker; `narrow-tower` has three
 * landings. Each declares a score, a control and often a lamp. None declares collision, and none should:
 * a lane is a stretch of table the ball ROLLS OVER and a well is a hole it falls INTO, and giving either
 * an edge would turn it into a wall. `STRUCK_KINDS` exists precisely to keep that rule.
 *
 * But the physics only ever reports an EDGE being hit, so nothing in the game could ever notice a ball
 * crossing one. Sixth time in this port that something declared turned out to be inert, and the same
 * shape every time: the behaviour was there, the report was not.
 *
 * `drainedBy` already solved this once for the one region that mattered enough to be found — the drain,
 * discovered when a ball was simulated to y = 4408 forever. This is that idea generalised, with the
 * part `drainedBy` does not need: a region has to fire ONCE on entry, not every frame the ball is over
 * it. A lane that scored sixty times a second would out-earn every bumper on the table.
 */

const ball = (x: number, y: number) => ({ position: { x, y } });

describe('a ball crossing a region is reported, once', () => {
  const lane = LOW_ORBIT.components.find((c) => c.name === 'lane1')!;
  const inside = ball(lane.bounds.x + 2, lane.bounds.y + 2);
  const outside = ball(lane.bounds.x - 50, lane.bounds.y - 50);

  test('entering reports it', () => {
    const watch = createRolloverWatch(LOW_ORBIT);

    expect(watch.poll(inside)).toContain('lane1');
  });

  test('⚠️ and staying over it does NOT report it again', () => {
    // A lane fires on a switch, not on presence. At sixty frames a second a lane that scored while the
    // ball sat on it would be worth more than every bumper on the table put together.
    const watch = createRolloverWatch(LOW_ORBIT);

    watch.poll(inside);

    expect(watch.poll(inside)).toEqual([]);
  });

  test('but leaving and coming back does', () => {
    const watch = createRolloverWatch(LOW_ORBIT);

    watch.poll(inside);
    watch.poll(outside);

    expect(watch.poll(inside)).toContain('lane1');
  });

  test('and a ball over nothing reports nothing', () => {
    expect(createRolloverWatch(LOW_ORBIT).poll(outside)).toEqual([]);
  });
});

describe('which components are regions, and which are emphatically not', () => {
  test('a drain is not one, because `drainedBy` owns losing the ball', () => {
    // Two things reporting the same event would score the drain and then lose the ball, or lose it and
    // then score it, depending on the order — and the order would be nobody's decision.
    expect(ROLLOVER_KINDS).not.toContain('drain');
  });

  test('⚠️ nor is a plunger, because the ball STARTS inside one', () => {
    // `spawnBall` puts the ball in the plunger lane. A plunger that was a rollover would fire on the
    // first poll of every ball, before the player had done anything at all.
    expect(ROLLOVER_KINDS).not.toContain('plunger');
  });

  test('a lane, a well, a kicker and a hole are', () => {
    for (const kind of ['lane', 'well', 'kicker', 'hole']) {
      expect(ROLLOVER_KINDS).toContain(kind);
    }
  });

  test('and no kind is both a region and a body', async () => {
    // The two lists partition the table: what the ball bounces off, and what it passes over or into.
    // A kind in both would be a wall that also scores for being crossed.
    const { STRUCK_KINDS } = await import('../app/js/table/authored.js');

    for (const kind of ROLLOVER_KINDS) {
      expect(STRUCK_KINDS, kind).not.toContain(kind);
    }
  });
});

describe('every table can be watched', () => {
  test.each(CATALOG.map((t) => [t.name, t] as const))('%s: a ball at the plunger fires nothing', (_name, table) => {
    // The spawn point. If anything fires here, a component is claiming ground the ball has not crossed.
    const plunger = table.components.find((c) => c.kind === 'plunger')!;
    const watch = createRolloverWatch(table);

    const fired = watch.poll(ball(plunger.bounds.x + 2, plunger.bounds.y + 2));

    expect(fired).toEqual([]);
  });
});

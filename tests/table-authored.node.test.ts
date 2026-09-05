// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  validateTable, declaredComponentsOf, toLiveTable, STRUCK_KINDS,
  type AuthoredTable, type AuthoredComponent, type TableState,
} from '../app/js/table/authored.js';
import { DEFAULT_CAMERA } from '../app/js/shell/camera.js';
import { CATALOG, LOW_ORBIT } from '../app/js/table/catalog.js';

const VIEW = { viewHeight: DEFAULT_CAMERA.viewHeight };

/**
 * A valid component of whatever kind is asked for. The collision is supplied rather than omitted
 * because `STRUCK_KINDS` makes it part of being valid: a bumper the ball goes through is not a
 * bumper, and a fixture that leaves it out is testing a table that could not open.
 */
const piece = (over: Partial<AuthoredComponent> = {}): AuthoredComponent => {
  const base: AuthoredComponent = {
    name: 'thing', kind: 'bumper', role: 'structure',
    bounds: { x: 10, y: 10, width: 8, height: 8 },
    ...over,
  };
  if (base.kind === 'flipper') {
    // A flipper's geometry is its own declaration, not a collision shape. A pivot at the bounds' left
    // edge, a tip at its right, and a sweep that LIFTS — which is the rule the validator holds.
    if (base.flipper) return base;
    const b = base.bounds;
    return {
      ...base,
      flipper: {
        pivot: { x: b.x, y: b.y }, tipAtRest: { x: b.x + b.width, y: b.y + b.height },
        sweepDegrees: -55, baseRadius: 3, tipRadius: 2, extendTime: 0.08, retractTime: 0.16,
      },
    };
  }
  if (!STRUCK_KINDS.includes(base.kind) || base.collision?.length) return base;

  const b = base.bounds;
  return {
    ...base,
    collision: [{
      kind: 'circle',
      at: { x: b.x + b.width / 2, y: b.y + b.height / 2 },
      radius: Math.min(b.width, b.height) / 2,
    }],
  };
};

function table(over: Partial<AuthoredTable> = {}): AuthoredTable {
  return {
    name: 'test table',
    size: { width: 183, height: 235 },
    ballRadius: 3,
    lamps: ['lamp1', 'lamp2'],
    components: [
      piece({ name: 'drain1', kind: 'drain', role: 'hazard', bounds: { x: 80, y: 225, width: 20, height: 8 } }),
      piece({ name: 'plunger1', kind: 'plunger', role: 'structure', bounds: { x: 170, y: 200, width: 8, height: 30 } }),
      piece({ name: 'flipL', kind: 'flipper', role: 'structure', bounds: { x: 50, y: 210, width: 25, height: 6 } }),
      piece({ name: 'bump1', kind: 'bumper', role: 'structure', lamps: ['lamp1'] }),
    ],
    ...over,
  };
}

describe('a table that can open', () => {
  test('the shipped example has no problems', () => {
    expect(validateTable(table(), VIEW)).toEqual([]);
  });

  test('empty means it opens — the same contract the engine uses', () => {
    // A promise without a check is a comment. This is the "or it does not".
    expect(validateTable(table(), VIEW)).toHaveLength(0);
  });
});

describe('every rule here was paid for by a real failure', () => {
  test('a DUPLICATE NAME is refused, because behaviour is wired by name', () => {
    // `control/links` matches on the group name; a duplicate silently gives one component two
    // behaviours with the last one winning. The 1995 score table has a test for exactly this.
    const twice = table({
      components: [...table().components, piece({ name: 'bump1' })],
    });

    expect(validateTable(twice, VIEW).join()).toContain('declared twice');
  });

  test('a table NO TALLER THAN THE VIEW is refused', () => {
    // Not an error in the camera — a table that did not need one. Every number in `shell/camera`
    // would be dead and nothing would say so.
    const flat = table({ size: { width: 183, height: 180 } });

    expect(validateTable(flat, VIEW).join()).toContain('nowhere to travel');
  });

  test('a table with NO DRAIN is refused', () => {
    // The one component whose absence turns the whole control layer into decoration: no drain means
    // no lost ball, so `control/drain` never runs, the bonus is never cashed in and there is no end.
    const endless = table({ components: table().components.filter((c) => c.kind !== 'drain') });

    expect(validateTable(endless, VIEW).join()).toContain('no drain');
  });

  test('a table with no plunger and no flipper is refused, for different reasons', () => {
    const bare = table({
      components: table().components.filter((c) => c.kind === 'drain' || c.kind === 'bumper'),
    });

    const problems = validateTable(bare, VIEW).join();

    expect(problems).toContain('no plunger');
    expect(problems).toContain('no flipper');
  });

  test('and the flipper rule cites what actually breaks', () => {
    // `physics/stuck` refuses to nudge a ball resting inside a flipper's or the plunger's bounds.
    // Without either, "stuck" has no exceptions and a legitimately held ball is thrown across the
    // table.
    const noFlipper = table({ components: table().components.filter((c) => c.kind !== 'flipper') });

    expect(validateTable(noFlipper, VIEW).join()).toContain('treated as stuck');
  });

  test('a lamp a component names but the table does not have is refused', () => {
    // The 1995 archive tolerates it — a null tag does nothing. For an authored table it is a wiring
    // bug, and this is the only place it would ever be caught.
    const dangling = table({
      components: [...table().components, piece({ name: 'x', lamps: ['ghost'] })],
    });

    expect(validateTable(dangling, VIEW).join()).toContain('does not have');
  });

  test('a component OUTSIDE the table is refused', () => {
    const escaped = table({
      components: [...table().components, piece({ name: 'far', bounds: { x: 400, y: 4, width: 4, height: 4 } })],
    });

    expect(validateTable(escaped, VIEW).join()).toContain('never be hit');
  });

  test('a component with no area at all is refused too', () => {
    const flat = table({
      components: [...table().components, piece({ name: 'thin', bounds: { x: 4, y: 4, width: 0, height: 4 } })],
    });

    expect(validateTable(flat, VIEW).join()).toContain('never be hit');
  });

  test('collision geometry outside the table is refused', () => {
    const outside = table({
      components: [...table().components, piece({
        name: 'wallish',
        collision: [{ kind: 'line', from: { x: 5, y: 5 }, to: { x: 900, y: 5 } }],
      })],
    });

    expect(validateTable(outside, VIEW).join()).toContain('collision shape outside');
  });

  test('a circle is judged by its EDGE, not its centre', () => {
    const overhanging = table({
      components: [...table().components, piece({
        name: 'round',
        collision: [{ kind: 'circle', at: { x: 2, y: 30 }, radius: 10 }],
      })],
    });

    expect(validateTable(overhanging, VIEW).join()).toContain('collision shape outside');
  });

  test('a lamp declared twice is refused', () => {
    expect(validateTable(table({ lamps: ['a', 'a'] }), VIEW).join()).toContain('declared twice');
  });

  test('a table with no size and no ball is refused before anything else', () => {
    const nothing = table({ size: { width: 0, height: 0 }, ballRadius: 0 });

    const problems = validateTable(nothing, VIEW).join();

    expect(problems).toContain('must be positive');
    expect(problems).toContain('the metric the narration uses');
  });
});

describe('what the rest of the game reads', () => {
  test('the components come out as the contract wants them', () => {
    const declared = declaredComponentsOf(table());

    expect(declared).toHaveLength(4);
    expect(declared[0]).toEqual({
      name: 'drain1', role: 'hazard', bounds: { x: 80, y: 225, width: 20, height: 8 },
    });
  });

  test('art is NOT part of a table', () => {
    // No sprites, no colours, no z-order. A table says what things are and where; how they are drawn
    // is the renderer's business, and keeping them apart is what lets a table be reviewed for
    // playability without anybody arguing about pixels.
    const keys = new Set(table().components.flatMap((c) => Object.keys(c)));

    expect([...keys].filter((k) => /sprite|color|image|art|z/i.test(k))).toEqual([]);
  });

  test('the live table is a VIEW, so the ball is where it is now', () => {
    let state: TableState = {
      balls: [{ active: true, position: { x: 5, y: 200 }, direction: { x: 0, y: -1 }, speed: 4 }],
      missionTextId: 'STRING151', missionHave: 0, missionNeed: 0, missionTargets: [],
    };
    const live = toLiveTable(table(), () => state);

    expect(live.balls[0]!.position.y).toBe(200);
    state = { ...state, balls: [{ ...state.balls[0]!, position: { x: 5, y: 40 } }] };

    expect(live.balls[0]!.position.y).toBe(40);
  });

  test('and so is the mission', () => {
    let state: TableState = {
      balls: [], missionTextId: 'STRING151', missionHave: 0, missionNeed: 0, missionTargets: [],
    };
    const live = toLiveTable(table(), () => state);

    state = { ...state, missionTextId: 'STRING208', missionHave: 2, missionNeed: 8, missionTargets: ['bump1'] };

    expect(live.missionTextId).toBe('STRING208');
    expect(live.missionNeed - live.missionHave).toBe(6);
    expect(live.missionTargets).toEqual(['bump1']);
  });

  test('the size and the ball radius come straight from the table', () => {
    const live = toLiveTable(table(), () => ({
      balls: [], missionTextId: 'STRING151', missionHave: 0, missionNeed: 0, missionTargets: [],
    }));

    expect(live.playfieldWidth).toBe(183);
    expect(live.playfieldHeight).toBe(235);
    expect(live.ballRadius).toBe(3);
  });
});

describe('⚠️ a thing the ball must STRIKE has to be there to be struck', () => {
  test('a target with no collision is reported, because it can never score', () => {
    // Found by drawing collisions instead of bounds. Five targets across the catalogue were painted
    // rectangles with nothing solid in them: `low-orbit`'s target1..3, `narrow-tower`'s summit,
    // `four-flippers`' target.centre. Each has `scores` and a `control`, and none of them could ever
    // fire, because the physics only ever reports an EDGE being hit.
    //
    // A `narrow-tower` run made the cost visible before the cause was known: five thousand frames, and
    // the ball met walls and flippers and nothing else. The summit was on screen the whole time.
    const table = {
      ...LOW_ORBIT,
      components: LOW_ORBIT.components.map((c) =>
        c.name === 'bumper1' ? { ...c, collision: undefined } : c),
    };

    const problems = validateTable(table, { viewHeight: 180 });

    expect(problems.some((p) => p.includes('bumper1') && p.includes('collision'))).toBe(true);
  });

  test('but a lane, a well and a drain are regions and are right to have none', () => {
    // The distinction is not a special case, it is what the two groups ARE. A bumper is a body the
    // ball bounces off; a lane is a stretch of table the ball rolls OVER, a well is a hole it falls
    // INTO, and giving either one an edge would make it a wall. So the rule is about the kinds that
    // answer a ball, and it must not creep into the kinds that swallow one.
    expect(validateTable(LOW_ORBIT, { viewHeight: 180 })).toEqual([]);
  });

  test('every table in the catalogue satisfies it', () => {
    for (const table of CATALOG) {
      expect(validateTable(table, { viewHeight: 180 })).toEqual([]);
    }
  });
});

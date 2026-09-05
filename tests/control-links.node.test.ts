// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  createComponentRegistry, makeLinks, asControlled,
  type LinkableComponent, type ControlEntry,
} from '../app/js/control/links.js';
import { bumperControl, rebounderControl, getScoring } from '../app/js/control/dispatch.js';

const loaded = (groupName: string | null): LinkableComponent => ({ groupName, control: null, scores: [] });

const BUMP_SCORES = [500, 1000, 2000, 4000];

describe('links — a component from the .DAT is inert until it is wired', () => {
  test('linking attaches BOTH the behaviour and the score array', () => {
    // The table of 88 scoring components is not a lookup the game consults — it is the wiring loom.
    // Run it and the table plays; skip it and the same geometry bounces silently.
    const bump1 = loaded('bump1');
    const registry = createComponentRegistry([bump1]);
    const entries: ControlEntry[] = [{ name: 'bump1', control: bumperControl, scores: BUMP_SCORES }];

    const result = makeLinks(registry, entries);

    expect(bump1.control).toBe(bumperControl);
    expect(bump1.scores).toBe(BUMP_SCORES);
    expect(result.linked).toBe(1);
  });

  test('a component nobody wired stays inert', () => {
    const lonely = loaded('some_wall');
    const registry = createComponentRegistry([lonely]);

    makeLinks(registry, []);

    expect(lonely.control).toBeNull();
    expect(lonely.scores).toEqual([]);
  });
});

describe('links — matching is by .DAT group name', () => {
  test('a tag resolves to the component carrying that name', () => {
    // The names come from the 1995 file itself, which is why a control table can be written against a
    // data file nobody has the source of.
    const lite56 = loaded('lite56');
    const registry = createComponentRegistry([loaded('bump1'), lite56]);

    expect(registry.resolve('lite56')).toBe(lite56);
  });

  test('an unknown name resolves to nothing and does not throw', () => {
    const registry = createComponentRegistry([loaded('bump1')]);

    expect(registry.resolve('bump99')).toBeNull();
  });

  test('a component with no group name is never matched', () => {
    const registry = createComponentRegistry([loaded(null)]);

    expect(registry.resolve('')).toBeNull();
  });
});

describe('links — the scan is cached', () => {
  test('resolving the same name twice scans once', () => {
    // 233 tags over a few hundred components. It is also what makes linking idempotent.
    const registry = createComponentRegistry([loaded('bump1')]);

    registry.resolve('bump1');
    registry.resolve('bump1');

    expect(registry.scanCount).toBe(1);
  });

  test('a MISS is cached too', () => {
    const registry = createComponentRegistry([loaded('bump1')]);

    registry.resolve('nope');
    registry.resolve('nope');

    expect(registry.scanCount).toBe(1);
  });

  test('linking twice does not scan twice', () => {
    const bump1 = loaded('bump1');
    const registry = createComponentRegistry([bump1]);
    const entries: ControlEntry[] = [{ name: 'bump1', control: bumperControl, scores: BUMP_SCORES }];

    makeLinks(registry, entries);
    makeLinks(registry, entries);

    expect(registry.scanCount).toBe(1);
  });
});

describe('links — a name with no component is not an error', () => {
  test('missing names are reported rather than thrown', () => {
    // The control table is written for the full Space Cadet table. A different .DAT — Full Tilt, or an
    // authored one — simply will not have every part, and the original returns null and moves on.
    const registry = createComponentRegistry([loaded('bump1')]);
    const entries: ControlEntry[] = [
      { name: 'bump1', control: bumperControl, scores: BUMP_SCORES },
      { name: 'bump_that_does_not_exist', control: rebounderControl, scores: [1] },
    ];

    const result = makeLinks(registry, entries, ['lite56', 'bump1']);

    expect(result.linked).toBe(1);
    expect(result.missing).toEqual(['bump_that_does_not_exist', 'lite56']);
  });
});

describe('links — score arrays are shared, not copied', () => {
  test('four bumpers of a group point at ONE array', () => {
    // `{BumperControl, 4, control_bump_scores1}` appears four times in the original. A group of bumpers
    // is worth the same by construction rather than by four maintained copies.
    const bumpers = ['bump1', 'bump2', 'bump3', 'bump4'].map(loaded);
    const registry = createComponentRegistry(bumpers);
    const entries: ControlEntry[] = bumpers.map((b) => ({
      name: b.groupName!, control: bumperControl, scores: BUMP_SCORES,
    }));

    makeLinks(registry, entries);

    expect(bumpers.every((b) => b.scores === BUMP_SCORES)).toBe(true);
  });
});

describe('links — the wired component reaches the dispatch layer', () => {
  test('a linked bumper scores by its own level out of the shared array', () => {
    const bump1 = loaded('bump1');
    const registry = createComponentRegistry([bump1]);
    makeLinks(registry, [{ name: 'bump1', control: bumperControl, scores: BUMP_SCORES }]);

    const controlled = asControlled(bump1, { level: 2 });

    expect(controlled.name).toBe('bump1');
    expect(controlled.control).toBe(bumperControl);
    expect(getScoring(controlled, 2)).toBe(2000);
  });
});

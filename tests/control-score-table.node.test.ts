// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { SCORE_COMPONENTS, SCORE_ARRAYS, NO_SCORES } from '../app/js/control/score-table.js';
import { createComponentRegistry, makeLinks, type ControlEntry, type LinkableComponent } from '../app/js/control/links.js';
import { bumperControl, rebounderControl, type ControlFunc } from '../app/js/control/dispatch.js';

describe('score table — the shape the original ships', () => {
  test('there are exactly 88 scoring components', () => {
    expect(SCORE_COMPONENTS).toHaveLength(88);
  });

  test('every row names a .DAT group and a behaviour', () => {
    expect(SCORE_COMPONENTS.every((r) => r.name.length > 0 && r.controlName.length > 0)).toBe(true);
  });

  test('the four bumpers of a group SHARE one array, not four copies', () => {
    const group = SCORE_COMPONENTS.filter((r) => ['bump1', 'bump2', 'bump3', 'bump4'].includes(r.name));

    expect(group).toHaveLength(4);
    expect(group.every((r) => r.scores === SCORE_ARRAYS.bump_scores1)).toBe(true);
  });

  test('the two bumper groups are worth different amounts', () => {
    // bump1-4 climb 500 to 2000; bump5-7 climb 1500 to 4500. Same behaviour, different table.
    expect(SCORE_ARRAYS.bump_scores1).toEqual([500, 1000, 1500, 2000]);
    expect(SCORE_ARRAYS.bump_scores2).toEqual([1500, 2500, 3500, 4500]);
  });

  test('the skill-shot chute pays most at THREE gates', () => {
    // The index is the number of launch-chute gates the ball passed — see `control/launch`. So the
    // peak is one particular plunger strength, and overshooting to six gates is worth a tenth of
    // getting it right.
    expect(SCORE_ARRAYS.oneway4_score1).toEqual([15000, 30000, 75000, 30000, 15000, 7500]);
  });

  test('one kickout level is worth zero on purpose', () => {
    expect(SCORE_ARRAYS.kickout_score1[1]).toBe(0);
  });

  test('27 components carry a behaviour and no scores at all', () => {
    // Flippers, gates, the drain: they do something without being worth anything.
    const unscored = SCORE_COMPONENTS.filter((r) => r.scores === NO_SCORES);

    expect(unscored).toHaveLength(27);
    expect(unscored.map((r) => r.name)).toContain('drain');
  });
});

describe('score table — linking it against a table', () => {
  /** Only two behaviours are registered so far; the rest of the table waits for them. */
  const REGISTRY: Record<string, ControlFunc> = {
    BumperControl: bumperControl,
    RebounderControl: rebounderControl,
  };

  const toEntries = (rows: readonly typeof SCORE_COMPONENTS[number][]): ControlEntry[] =>
    rows.flatMap((r) => {
      const control = REGISTRY[r.controlName];
      return control ? [{ name: r.name, control, scores: r.scores }] : [];
    });

  const loaded = (groupName: string): LinkableComponent => ({ groupName, control: null, scores: [] });

  test('a component whose behaviour is registered gets wired', () => {
    const bump1 = loaded('bump1');
    const registry = createComponentRegistry([bump1]);

    makeLinks(registry, toEntries(SCORE_COMPONENTS));

    expect(bump1.control).toBe(bumperControl);
    expect(bump1.scores).toEqual([500, 1000, 1500, 2000]);
  });

  test('a component whose behaviour is NOT registered yet stays inert', () => {
    // Which is how this table can be complete while the behaviours arrive in batches.
    const ramp = loaded('ramp');
    const registry = createComponentRegistry([ramp]);

    makeLinks(registry, toEntries(SCORE_COMPONENTS));

    expect(ramp.control).toBeNull();
  });

  test('a table missing a component reports it instead of failing', () => {
    const registry = createComponentRegistry([loaded('bump1')]);

    const result = makeLinks(registry, toEntries(SCORE_COMPONENTS));

    expect(result.linked).toBe(1);
    expect(result.missing).toContain('bump2');
  });

  test('all 88 names are distinct', () => {
    // A duplicate would silently give one component two behaviours, last one winning.
    const names = SCORE_COMPONENTS.map((r) => r.name);

    expect(new Set(names).size).toBe(names.length);
  });
});

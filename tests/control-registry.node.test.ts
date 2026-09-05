// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { AUTHORED_CONTROLS, controlNamed } from '../app/js/control/registry.js';
import { validateTable } from '../app/js/table/authored.js';
import { CATALOG, LOW_ORBIT } from '../app/js/table/catalog.js';

/**
 * ⚠️ EVERY TABLE NAMED CONTROLS THAT COULD NEVER BE WIRED, AND NOTHING SAID SO.
 *
 * The five authored tables asked for `BoosterTargetControl`, `WormHoleControl`, `FlagControl`,
 * `LaunchRampControl`, `BlackHoleKickoutControl` and `ReentryLanesRolloverControl`. Of those, the last
 * does not exist anywhere in the project, and the other five are 1995 controls that need 1995
 * STRUCTURES: a target bank, an award chain, lamps named `lite55` and `lite56`, a mission lamp with a
 * message field. An authored table has none of them and no way to declare them.
 *
 * So the names were aspiration. They passed validation, they were drawn, and they were inert — the same
 * shape of defect as the target with no collision and the flipper the player could not move, and the
 * third time in this project that something declared turned out to do nothing.
 *
 * The vocabularies are therefore separate, and that separation was always implied by the plan: the 1995
 * control layer belongs to the 1995 table, which is the validation configuration. An authored table
 * gets controls it can actually satisfy, and `validateTable` refuses a name it cannot wire rather than
 * accepting one and doing nothing.
 */

describe('an authored table may only ask for behaviour that exists', () => {
  test('every control the catalogue names is in the registry', () => {
    for (const table of CATALOG) {
      for (const component of table.components) {
        if (!component.control) continue;
        expect(controlNamed(component.control), `${table.name}/${component.name}`).toBeDefined();
      }
    }
  });

  test('and the validator refuses one that is not', () => {
    const table = {
      ...LOW_ORBIT,
      components: LOW_ORBIT.components.map((c) =>
        c.name === 'bumper1' ? { ...c, control: 'WormHoleControl' } : c),
    };

    const problems = validateTable(table, { viewHeight: 180 });

    expect(problems.some((p) => p.includes('bumper1') && p.includes('WormHoleControl'))).toBe(true);
  });

  test('the registry is not empty and every entry is a function', () => {
    expect(Object.keys(AUTHORED_CONTROLS).length).toBeGreaterThan(0);
    for (const [name, fn] of Object.entries(AUTHORED_CONTROLS)) {
      expect(typeof fn, name).toBe('function');
    }
  });
});

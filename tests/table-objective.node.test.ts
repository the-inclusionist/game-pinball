// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { objectiveOf, PURSUED_ROLES } from '../app/js/table/objective.js';
import { createLiveControls } from '../app/js/table/live-controls.js';
import { CATALOG, LOW_ORBIT } from '../app/js/table/catalog.js';
import { createTranslator, AVAILABLE_LOCALES } from '../app/js/i18n/index.js';
import { keyOf } from '../app/js/i18n/keys.js';
import { validateTable, type AuthoredComponent, type AuthoredTable } from '../app/js/table/authored.js';
import { AUTHORED_OBJECTIVE_ID } from '../app/js/table/objective.js';

/**
 * ⚠️ THE SONAR HAD NOTHING TO POINT AT, AND THAT IS THE PROMISE THE ENGINE IS HERE FOR.
 *
 * The plan says of the contract's fifth field: "targetsOf — os alvos ainda válidos da missão corrente.
 * É o que faz o SONAR funcionar — modo cego num pinball, possível só porque o contrato pergunta
 * topologia e alvos em vez de exigir tiles." That paragraph is most of the reason this game consumes
 * the Inclusionist engine at all.
 *
 * `main.ts` declared `missionTargets: []` and `missionHave: 0, missionNeed: 0`, and nothing ever wrote
 * to them. So `targetsOf()` returned an empty list every frame, `objectiveOf()` returned nought of
 * nought, and blind mode was silence over a table full of things to hit. Eighth time in this port that
 * something declared turned out to be inert, and the one that costs the most.
 *
 * ⚠️ AND THE ANSWER IS NOT A MISSION, because an authored table has none. It is the table's own words:
 * the contract already asks every component for a ROLE, and two of the eight — `goal` and `key` — mean
 * "what the player is trying to reach". So the objective is to finish those, and a target stops being
 * one when it is done.
 */

/**
 * `low-orbit` with one extra pursued component and its lamps. BUILT rather than hunted for: two tests
 * below used to search the catalogue and return early when they found nothing, which made them pass
 * while doing nothing at all — and two mutations survived behind that silence.
 */
function withPursued(component: AuthoredComponent, lamps: readonly string[]): AuthoredTable {
  return {
    ...LOW_ORBIT,
    lamps: [...LOW_ORBIT.lamps, ...lamps],
    components: [
      ...LOW_ORBIT.components.filter((c) => !PURSUED_ROLES.includes(c.role)),
      component,
    ],
  };
}

describe('what the player is trying to reach', () => {
  test('the pursued roles are the contract’s own words for it, not a list invented here', () => {
    expect([...PURSUED_ROLES].sort()).toEqual(['goal', 'key']);
  });

  test('a fresh table offers every goal and key as a target', () => {
    const live = createLiveControls(LOW_ORBIT);
    const pursued = LOW_ORBIT.components.filter((c) => PURSUED_ROLES.includes(c.role));

    const objective = objectiveOf(LOW_ORBIT, live);

    expect(objective.targets).toHaveLength(pursued.length);
    expect(objective.need).toBe(pursued.length);
    expect(objective.have).toBe(0);
  });

  test('⚠️ and one that is DONE stops being a target', () => {
    // Without this the sonar keeps sending a blind player back to something already finished, which is
    // worse than silence: it is a wrong answer delivered confidently.
    const live = createLiveControls(LOW_ORBIT);
    const target = LOW_ORBIT.components.find((c) => c.role === 'key' && c.lamps?.length)!;

    live.hit(target.name);

    const objective = objectiveOf(LOW_ORBIT, live);
    expect(objective.targets).not.toContain(target.name);
    expect(objective.have).toBe(1);
  });

  test('done means EVERY lamp it declared is lit, not one of them', () => {
    // ⚠️ MY FIRST VERSION OF THIS LOOKED FOR A TWO-LAMP COMPONENT IN THE CATALOGUE AND RETURNED EARLY
    // WHEN IT FOUND NONE. No table declares one, so the test did nothing, passed, and let the mutation
    // `every` -> `some` survive. A test that can quietly decline to run is not a test. The fixture is
    // built here instead.
    const table = withPursued({
      name: 'twoLamps', kind: 'target', role: 'goal',
      bounds: { x: 40, y: 40, width: 10, height: 10 },
      scores: [100], control: 'TargetControl', lamps: ['lamp.a', 'lamp.b'],
      collision: [{ kind: 'line', from: { x: 50, y: 50 }, to: { x: 40, y: 50 } }],
    }, ['lamp.a', 'lamp.b']);
    const live = createLiveControls(table);

    // `targetControl` lights all the lamps a component declares, so light just one by hand.
    live.context.light('lamp.a')!.turnOn();

    expect(objectiveOf(table, live).targets).toContain('twoLamps');
    expect(objectiveOf(table, live).have).toBe(0);
  });

  test('⚠️ a pursued component with NO lamp is a target for ever, and that is deliberate', () => {
    // Same fault as above and the same fix: the catalogue has no such component, so hunting for one
    // made the test skip itself and let `return false` -> `return true` survive.
    //
    // The rule: nothing says it is finished, so it never is. Silently dropping it would be a guess;
    // keeping it tells the truth — it is something the player can always go and hit again.
    const table = withPursued({
      name: 'lampless', kind: 'target', role: 'goal',
      bounds: { x: 40, y: 40, width: 10, height: 10 },
      scores: [100], control: 'TargetControl',
      collision: [{ kind: 'line', from: { x: 50, y: 50 }, to: { x: 40, y: 50 } }],
    }, []);
    const live = createLiveControls(table);

    live.hit('lampless');
    live.hit('lampless');

    expect(objectiveOf(table, live).targets).toContain('lampless');
  });
});

describe('⚠️ and a table with nothing to pursue is refused', () => {
  test('the validator says so, because nothing in the catalogue would have exercised it', () => {
    // The rule survived a mutation that disabled it entirely: every table now declares something to
    // pursue, so nothing was left to fail. A rule needs a case that breaks it, not only cases that
    // happen to satisfy it.
    const table = {
      ...LOW_ORBIT,
      components: LOW_ORBIT.components.map((c) =>
        PURSUED_ROLES.includes(c.role) ? { ...c, role: 'structure' as const } : c),
    };

    const problems = validateTable(table, { viewHeight: 180 });

    expect(problems.some((p) => p.includes('pursue'))).toBe(true);
  });
});

describe('every table declares something to pursue', () => {
  test.each(CATALOG.map((t) => [t.name, t] as const))('%s: has at least one', (_name, table) => {
    // A table with no goal and no key is a table the sonar cannot describe and a blind player cannot
    // play. `bare-minimum` included: it is the floor of the FORMAT, and this is part of the format.
    const live = createLiveControls(table);

    expect(objectiveOf(table, live).need).toBeGreaterThan(0);
  });
});

describe('and the objective is speakable in all three languages', () => {
  test('⚠️ the authored id resolves to a real string, not to itself', () => {
    // `keyOf` returns an unknown identifier UNCHANGED and the translator returns an unknown key
    // unchanged, so a wrong id reaches the screen as its own name rather than as an error. `STRING151`
    // was once visible in the running game for precisely that reason, and the fix was a test like this.
    for (const locale of AVAILABLE_LOCALES) {
      const text = createTranslator(locale)(keyOf(AUTHORED_OBJECTIVE_ID), { n: 3 });

      expect(text, locale).not.toBe(AUTHORED_OBJECTIVE_ID);
      expect(text, locale).toContain('3');
    }
  });
});

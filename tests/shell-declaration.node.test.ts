// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { conformanceProblems } from '@the-inclusionist/engine/core/contract.js';
import type { Speakable } from '@the-inclusionist/engine/core/contract.js';
import {
  createDeclaration, headingOf, centerOf,
  type DeclaredComponent, type PinballWorld,
} from '../app/js/shell/declaration.js';

const speak = (text: string): Speakable => ({ text, gender: 'm', plural: false });

const component = (
  name: string, role: DeclaredComponent['role'], x: number, y: number, w = 10, h = 10,
): DeclaredComponent => ({ name, role, bounds: { x, y, width: w, height: h } });

function world(over: Partial<PinballWorld> = {}): PinballWorld {
  return {
    playfield: { width: 183, height: 235 },
    ballRadius: 3,
    balls: [{ active: true, position: { x: 90, y: 200 }, direction: { x: 0, y: -1 }, speed: 4 }],
    components: [
      component('drain', 'hazard', 80, 225, 20, 10),
      component('flip1', 'structure', 60, 210),
      component('bump1', 'structure', 40, 60),
      component('bump2', 'structure', 60, 60),
      component('oneway4', 'gate', 160, 20),
      component('target1', 'key', 20, 100),
    ],
    speak: (name) => (name === 'drain' ? speak('the drain') : speak(name)),
    mission: {
      objective: speak('bumpers'),
      have: 3, need: 8,
      targets: ['bump1', 'bump2'],
    },
    ...over,
  };
}

describe('THE GATE: the engine’s own validator accepts this declaration', () => {
  test('a pinball satisfies the seven fields with nothing left over', () => {
    // The claim the plan makes, checked against the engine's checker rather than against my reading
    // of it. A genre the contract had never seen answers all of it.
    const problems = conformanceProblems(createDeclaration(world()));

    expect(problems).toEqual([]);
  });

  test('and it is the REAL contract, not a copy of it in this repository', () => {
    // If this import ever stops resolving, the check above is checking nothing.
    expect(typeof conformanceProblems).toBe('function');
    expect(conformanceProblems(null)).not.toEqual([]);
  });
});

describe('the topology is the table, and the ruler is the ball', () => {
  test('a continuous space, 183 by 235', () => {
    const d = createDeclaration(world());

    // ⚠️ CALLED, NOT READ. The engine's ADR-0084 made `topology` a function because `game-15puzzle` is
    // 3x3, 4x4 or 5x5 and a memorised topology went stale in silence. A pinball's playfield is one size
    // for the life of the game, so the answer is the same every call — but the contract asks in the
    // shape that suits the game that needed it, and this consumer follows.
    /**
     * ⚠️ `size` AND NOT `width`/`height`, AND TWO FIELDS THAT DID NOT EXIST. The engine moved again on
     * 2026-09-06 — it is linked by `file:` and in active modularisation, which the plan names as a
     * declared risk. `move` and `frame` are new; `shell/declaration` records why a pinball answers
     * 'free' and 'compass' and it is worth reading, because the second one is an accessibility choice
     * and not a default.
     */
    expect(d.topology()).toEqual({
      kind: 'continuous', size: [183, 235], unit: 3, move: 'free', frame: 'compass',
    });
  });

  test('the UNIT is the ball’s radius, which is what makes "two steps away" sayable', () => {
    const d = createDeclaration(world({ ballRadius: 7 }));

    expect(d.topology().kind === 'continuous' && (d.topology() as { unit: number }).unit).toBe(7);
  });

  test('⚠️ and the WORLD is the canvas, which the contract now requires it to name', () => {
    // New with the same engine change, and required rather than defaulted. The engine's own note gives
    // the reason: blindfold chess exists, so a game with no visible space is not one where empathy
    // makes no sense — it is one that asks more of whoever writes it. A default would have let
    // forgetting pass as a decision.
    expect(createDeclaration(world()).world()).toEqual({ kind: 'element', selector: '#game-region' });
  });

  test('the clock owns the tick, because a pinball does not wait', () => {
    expect(createDeclaration(world()).tick).toBe('clock');
  });
});

describe('the ball is the focus', () => {
  test('focus is the ball’s position, with an id per player', () => {
    const focus = createDeclaration(world()).focusOf(1);

    expect(focus?.at).toEqual({ x: 90, y: 200 });
    expect(focus?.id).toBe('ball-1');
  });

  test('a ball climbing the table heads NORTH, because table coordinates grow downward', () => {
    expect(headingOf({ x: 0, y: -1 })).toBe('n');
    expect(headingOf({ x: 0, y: 1 })).toBe('s');
    expect(headingOf({ x: 1, y: 0 })).toBe('e');
    expect(headingOf({ x: -1, y: 0 })).toBe('w');
  });

  test('the diagonals land in the right octants', () => {
    expect(headingOf({ x: 1, y: -1 })).toBe('ne');
    expect(headingOf({ x: -1, y: -1 })).toBe('nw');
    expect(headingOf({ x: 1, y: 1 })).toBe('se');
    expect(headingOf({ x: -1, y: 1 })).toBe('sw');
  });

  test('a nearly-north vector is still north, not a diagonal', () => {
    expect(headingOf({ x: 0.2, y: -1 })).toBe('n');
    expect(headingOf({ x: 0.5, y: -1 })).toBe('ne');
  });

  test('a still ball points nowhere', () => {
    expect(headingOf({ x: 0, y: 0 })).toBe('none');

    const stopped = createDeclaration(world({
      balls: [{ active: true, position: { x: 5, y: 5 }, direction: { x: 1, y: 0 }, speed: 0 }],
    }));

    expect(stopped.focusOf(0)?.heading).toBe('none');
  });

  test('with no ball in play there is no focus at all', () => {
    // `null` is the contract's own answer for "the round has not started".
    const between = createDeclaration(world({ balls: [] }));

    expect(between.focusOf(0)).toBeNull();
  });

  test('an inactive ball does not count as one', () => {
    const drained = createDeclaration(world({
      balls: [{ active: false, position: { x: 5, y: 5 }, direction: { x: 0, y: 1 }, speed: 4 }],
    }));

    expect(drained.focusOf(0)).toBeNull();
  });
});

describe('the role is what a thing does TO THE BALL', () => {
  test('the drain is a hazard and open playfield is free', () => {
    const d = createDeclaration(world());

    expect(d.roleAt({ x: 85, y: 228 })).toBe('hazard');
    expect(d.roleAt({ x: 5, y: 5 })).toBe('free');
  });

  test('THE ROLE MOVES WITH THE MISSION', () => {
    // A bumper is the goal while the mission counts bumpers and furniture the rest of the time. Same
    // component, same position, different answer — which is the control layer's habit of keeping
    // state in what the player can see, arriving in the accessibility contract.
    const counting = createDeclaration(world());
    const notCounting = createDeclaration(world({
      mission: { ...world().mission, targets: ['target1'] },
    }));

    expect(counting.roleAt({ x: 45, y: 65 })).toBe('goal');
    expect(notCounting.roleAt({ x: 45, y: 65 })).toBe('structure');
  });

  test('the mission overrides even a hazard', () => {
    const d = createDeclaration(world({ mission: { ...world().mission, targets: ['drain'] } }));

    expect(d.roleAt({ x: 85, y: 228 })).toBe('goal');
  });

  test('what is drawn on top is what is there', () => {
    const stacked = createDeclaration(world({
      components: [component('under', 'structure', 0, 0, 50, 50), component('over', 'gate', 10, 10)],
    }));

    expect(stacked.roleAt({ x: 15, y: 15 })).toBe('gate');
    expect(stacked.roleAt({ x: 45, y: 45 })).toBe('structure');
  });

  test('bounds are half-open, so a component never claims its neighbor’s first pixel', () => {
    // Written with the neighbor EARLIER in the array on purpose. The search runs last-first, so if
    // `a` were allowed to contain its own far edge it would answer for a point that belongs to `b`,
    // and a closed-bounds test with `a` last would pass by accident.
    const acrossX = createDeclaration(world({
      components: [component('b', 'key', 10, 0, 10, 10), component('a', 'gate', 0, 0, 10, 10)],
    }));
    const acrossY = createDeclaration(world({
      components: [component('b', 'key', 0, 10, 10, 10), component('a', 'gate', 0, 0, 10, 10)],
    }));

    expect(acrossX.roleAt({ x: 9.9, y: 5 })).toBe('gate');
    expect(acrossX.roleAt({ x: 10, y: 5 })).toBe('key');
    expect(acrossY.roleAt({ x: 5, y: 9.9 })).toBe('gate');
    expect(acrossY.roleAt({ x: 5, y: 10 })).toBe('key');
  });
});

describe('names come from i18n, never from this module', () => {
  test('the name of what is under a point is asked for, not built', () => {
    const d = createDeclaration(world());

    expect(d.nameAt({ x: 85, y: 228 })?.text).toBe('the drain');
  });

  test('empty playfield has no name', () => {
    expect(createDeclaration(world()).nameAt({ x: 5, y: 5 })).toBeNull();
  });

  test('a component i18n has no word for is null, not a crash', () => {
    const d = createDeclaration(world({ speak: () => null }));

    expect(d.nameAt({ x: 85, y: 228 })).toBeNull();
  });
});

describe('the objective and the targets are the mission', () => {
  test('the objective counts the mission down', () => {
    expect(createDeclaration(world()).objectiveOf(0)).toEqual({
      name: { text: 'bumpers', gender: 'm', plural: false }, have: 3, need: 8,
    });
  });

  test('THE SONAR WORKS because targetsOf returns where the mission’s targets ARE', () => {
    // The half of field 5 that a counter cannot give. Without positions the engine can compare
    // nothing, and the blind mode of a pinball is exactly "which of the things I still need is
    // nearest, and on which side".
    const targets = createDeclaration(world()).targetsOf(0);

    expect(targets).toEqual([centerOf({ x: 40, y: 60, width: 10, height: 10 }),
      centerOf({ x: 60, y: 60, width: 10, height: 10 })]);
  });

  test('a mission with nothing to point at returns EMPTY, which is legitimate', () => {
    const d = createDeclaration(world({ mission: { ...world().mission, targets: [] } }));

    expect(d.targetsOf(0)).toEqual([]);
    expect(conformanceProblems(d)).toEqual([]);
  });

  test('a target the table does not have is simply not returned', () => {
    const d = createDeclaration(world({ mission: { ...world().mission, targets: ['bump1', 'ghost'] } }));

    expect(d.targetsOf(0)).toHaveLength(1);
  });
});

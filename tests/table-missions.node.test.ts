// SPDX-License-Identifier: AGPL-3.0-or-later
// A MISSION MACHINE FOR A TABLE THAT IS NOT THE 1995 ONE.
//
// ⚠️ THIS REVERSES A DECISION, AND THE DECISION WAS NOT WRONG WHEN IT WAS MADE.
// `table/objective.ts` says, in capitals: "THE ANSWER IS NOT A MISSION — an authored table has none,
// and inventing some to fill the field would be worse than the silence." That was right: the field
// being filled was `targetsOf`, the accessibility contract's, and faking missions to populate it would
// have been a lie told to a blind player.
//
// The Dev has now asked for missions as a GAME feature — "crie uma máquina de missão para cada mesa" —
// which is a different thing from inventing them to fill a contract field. `objective.ts` keeps its
// job for a table that declares none; a table that declares missions gets them. Recorded in ADR-0005
// rather than by editing that file's reasoning, which was sound.
//
// ⚠️ AND IT IS DECLARATIVE, NOT TRANSCRIBED. The 1995 machine is 150 KB of calibrated C++ tied to
// `lite198`'s message field and hand-written argument lists; nothing about it generalises to a table
// somebody authored this morning. This is a small format — targets, an award, an order — that a table
// file can hold, and it says what it is rather than pretending to be the other one.
import { describe, test, expect } from 'vitest';
import { runMissions, type AuthoredMission } from '../app/js/table/missions.js';
import { validateTable } from '../app/js/table/authored.js';
import { CATALOG, LOW_ORBIT } from '../app/js/table/catalog.js';

const MISSIONS: readonly AuthoredMission[] = [
  { id: 'pinball.mission.first', targets: ['a', 'b'], award: 1000 },
  { id: 'pinball.mission.second', targets: ['c'], award: 5000 },
];

describe('a table with missions', () => {
  test('opens on the first one, with everything still to do', () => {
    const run = runMissions(MISSIONS);

    expect(run.current?.id).toBe('pinball.mission.first');
    expect([...run.remaining]).toEqual(['a', 'b']);
  });

  test('hitting a target crosses it off', () => {
    const run = runMissions(MISSIONS);

    run.hit('a');

    expect([...run.remaining]).toEqual(['b']);
  });

  test('⚠️ and hitting it AGAIN does not finish the mission early', () => {
    // The obvious implementation counts hits. A player who rattles one target ten times would then
    // complete a two-target mission without ever finding the second, and the mission would be a
    // counter rather than a route round the table.
    const run = runMissions(MISSIONS);

    run.hit('a');
    run.hit('a');
    run.hit('a');

    expect([...run.remaining]).toEqual(['b']);
    expect(run.current?.id).toBe('pinball.mission.first');
  });

  test('hitting something that is not a target does nothing at all', () => {
    const run = runMissions(MISSIONS);

    const result = run.hit('drain');

    expect(result.completed).toBe(false);
    expect(result.award).toBe(0);
    expect([...run.remaining]).toEqual(['a', 'b']);
  });

  test('⚠️ finishing every target completes it, pays ONCE, and moves on', () => {
    const run = runMissions(MISSIONS);

    run.hit('a');
    const last = run.hit('b');

    expect(last.completed).toBe(true);
    expect(last.award).toBe(1000);
    expect(run.current?.id, 'the next mission is running').toBe('pinball.mission.second');
    expect([...run.remaining]).toEqual(['c']);
  });

  test('and the award is paid on the completing hit, not on the ones before it', () => {
    const run = runMissions(MISSIONS);

    expect(run.hit('a').award).toBe(0);
    expect(run.hit('b').award).toBe(1000);
  });
});

describe('running out of missions', () => {
  test('⚠️ the list WRAPS, because a table should not run out of things to do', () => {
    // A pinball table is played until the ball is lost, not until a story ends. The 1995 game cycles
    // its missions too. Stopping would leave a player with a live ball and nothing the sonar can point
    // at, which is the silence `objective.ts` was written to avoid.
    const run = runMissions(MISSIONS);
    run.hit('a');
    run.hit('b');

    const wrapped = run.hit('c');

    expect(wrapped.completed).toBe(true);
    expect(run.current?.id, 'back to the first').toBe('pinball.mission.first');
    expect([...run.remaining]).toEqual(['a', 'b']);
  });

  test('and the lap counts, so a second time round is not mistaken for the first', () => {
    const run = runMissions(MISSIONS);
    expect(run.lap).toBe(0);

    run.hit('a'); run.hit('b'); run.hit('c');

    expect(run.lap).toBe(1);
  });
});

describe('a table with NO missions', () => {
  test('⚠️ is not an error, and hitting things on it is safe', () => {
    // Four of the five tables in the catalogue have none yet, and `bare-minimum` never will — it
    // exists to be the floor of the format. A machine that threw, or that reported a mission that
    // does not exist, would make "no missions" a state the game cannot be in.
    const run = runMissions([]);

    expect(run.current).toBeNull();
    expect([...run.remaining]).toEqual([]);
    expect(run.hit('anything')).toEqual({ completed: false, award: 0 });
  });
});

describe('starting again', () => {
  test('a new ball does not reset the mission, but a new GAME does', () => {
    // Losing a ball mid-mission and being put back to the start of it would punish the player twice.
    // `reset` is for a new game, and it is the caller that knows which happened.
    const run = runMissions(MISSIONS);
    run.hit('a');

    run.reset();

    expect(run.current?.id).toBe('pinball.mission.first');
    expect([...run.remaining]).toEqual(['a', 'b']);
    expect(run.lap).toBe(0);
  });
});

describe('⚠️ a mission the table cannot satisfy is refused before it opens', () => {
  test('naming a component that does not exist is a problem, not a mystery', () => {
    // The failure this prevents is the one this port keeps finding under other names: the mission
    // runs, the sonar points at something not on the table, the player hits everything they can find,
    // and it never completes. Nothing anywhere would say why.
    const problems = validateTable(
      { ...LOW_ORBIT, missions: [{ id: 'x', targets: ['bumper1', 'atlantis'], award: 1 }] },
      { viewHeight: 180 },
    );

    expect(problems.filter((p) => p.includes('atlantis'))).toHaveLength(1);
  });

  test('and a mission with no targets at all is refused too', () => {
    const problems = validateTable(
      { ...LOW_ORBIT, missions: [{ id: 'x', targets: [], award: 1 }] }, { viewHeight: 180 },
    );

    expect(problems.filter((p) => p.includes('no targets'))).toHaveLength(1);
  });

  test('the shipped tables all pass it, which is what makes the rule worth having', () => {
    for (const table of CATALOG) {
      expect(validateTable(table, { viewHeight: 180 }), table.name).toEqual([]);
    }
  });
});

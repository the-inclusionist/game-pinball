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
  { award: 1000, stages: [{ id: 'pinball.mission.first', targets: ['a', 'b'] }] },
  { award: 5000, stages: [{ id: 'pinball.mission.second', targets: ['c'] }] },
];

describe('a table with missions', () => {
  test('opens on the first one, with everything still to do', () => {
    const run = runMissions(MISSIONS);

    expect(run.stage?.id).toBe('pinball.mission.first');
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
    expect(run.stage?.id).toBe('pinball.mission.first');
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
    expect(run.stage?.id, 'the next mission is running').toBe('pinball.mission.second');
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
    expect(run.stage?.id, 'back to the first').toBe('pinball.mission.first');
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

    expect(run.stage?.id).toBe('pinball.mission.first');
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
      { ...LOW_ORBIT, missions: [{ award: 1, stages: [{ id: 'x', targets: ['bumper1', 'atlantis'] }] }] },
      { viewHeight: 180 },
    );

    expect(problems.filter((p) => p.includes('atlantis'))).toHaveLength(1);
  });

  test('and a mission with no targets at all is refused too', () => {
    const problems = validateTable(
      { ...LOW_ORBIT, missions: [{ award: 1, stages: [{ id: 'x', targets: [] }] }] }, { viewHeight: 180 },
    );

    expect(problems.filter((p) => p.includes('no targets'))).toHaveLength(1);
  });

  test('the shipped tables all pass it, which is what makes the rule worth having', () => {
    for (const table of CATALOG) {
      expect(validateTable(table, { viewHeight: 180 }), table.name).toEqual([]);
    }
  });
});

/**
 * ⚠️ A MISSION IN TWO ACTS, WHICH IS THE SHAPE THE 1995 CAMPAIGN ACTUALLY HAS AND THIS FORMAT DID NOT.
 *
 * The Dev, on the game as a whole: "o resultado são mesas tão simples... o que tem jogável são demos."
 * He is right, and this is one of the places it is measurable. `control/mission-table` runs the Space
 * Cadet's twenty-three, and most of them are staged — the i18n dictionaries have carried the text for
 * years: `strayComet.run` is "Derrube os três alvos da direita", `strayComet.stage2` is "Agora o ejetor
 * da direita", and only then `.done`. Six authored tables had eighteen missions between them and every
 * single one was one act: hit these three things, collect.
 *
 * ⚠️ AND THE 1995 MACHINE STILL IS NOT REUSED, for the reason this file's header already gives: it
 * keeps its progress in `lite56`'s message field and dispatches through argument lists naming groups
 * that exist only in the archive. What is borrowed is the SHAPE — a mission is a sequence of things to
 * do, not a set — and `control/mission-runner`'s own header says as much: "a mission IS a counter, a
 * set of lamps, a set of components that count, and a reward". A stage is that, and a mission is a
 * list of them.
 *
 * ⚠️ ONE WAY TO SAY IT, NOT TWO. There is no `targets` beside `stages`: a one-act mission is a list of
 * one. Keeping both would be the same rule written twice, which is the defect this repository has
 * found in a bumper's rectangle, a HUD inset, a plunger's speed and a licence note.
 */
describe('⚠️ a mission with more than one act', () => {
  const TWO_ACTS: readonly AuthoredMission[] = [
    {
      award: 9000,
      stages: [
        { id: 'pinball.mission.first', targets: ['a', 'b'] },
        { id: 'pinball.mission.second', targets: ['c'] },
      ],
    },
  ];

  test('it opens on the first act and says so', () => {
    const run = runMissions(TWO_ACTS);

    expect(run.stage?.id).toBe('pinball.mission.first');
    expect([...run.remaining]).toEqual(['a', 'b']);
  });

  test('⚠️ finishing the first act does NOT finish the mission, and pays nothing', () => {
    // The whole point. A staged mission that paid out on its first act would be two missions with one
    // reward, and the player would never see the second half.
    const run = runMissions(TWO_ACTS);

    run.hit('a');
    const finishedAct = run.hit('b');

    expect(finishedAct.completed, 'the mission is not over').toBe(false);
    expect(finishedAct.award, 'and nothing is paid yet').toBe(0);
  });

  test('it moves on to the second act, with its own text and its own targets', () => {
    const run = runMissions(TWO_ACTS);

    run.hit('a');
    run.hit('b');

    expect(run.stage?.id).toBe('pinball.mission.second');
    expect([...run.remaining]).toEqual(['c']);
  });

  test('⚠️ and a target from the FIRST act no longer counts', () => {
    // Otherwise a player rattling the same bumper walks through every act of every mission, and the
    // stages are decoration. The set-not-a-count rule above, applied one level up.
    const run = runMissions(TWO_ACTS);
    run.hit('a');
    run.hit('b');

    const stray = run.hit('a');

    expect(stray.completed).toBe(false);
    expect([...run.remaining], 'the second act is untouched').toEqual(['c']);
  });

  test('the LAST act completes the mission and pays the award once', () => {
    const run = runMissions(TWO_ACTS);
    run.hit('a');
    run.hit('b');

    const done = run.hit('c');

    expect(done.completed).toBe(true);
    expect(done.award).toBe(9000);
  });

  test('and the next lap starts at the first act again', () => {
    const run = runMissions(TWO_ACTS);
    run.hit('a');
    run.hit('b');
    run.hit('c');

    expect(run.lap).toBe(1);
    expect(run.stage?.id).toBe('pinball.mission.first');
  });
});

/**
 * ⚠️ AND A MISSION CAN ONLY NAME SOMETHING THAT CAN REPORT BEING HIT.
 *
 * Found by adding stages and then asking how a stage's targets ever get crossed off. `low-orbit`'s
 * third mission is `lane1`, `lane2`, `lane3` — LANES, which are `ROLLOVER_KINDS`: the ball passes over
 * them and `table/rollovers` polls for it, because nothing collides to report a crossing. The frame
 * loop pushed those crossings into the score and NOT into the mission machine, so that mission could
 * never be completed, and the campaign stopped there for the rest of the game.
 *
 * Nothing said so. The mission simply stayed on screen, the sonar went on pointing at three lanes the
 * player kept crossing, and every gate was green: the table validated, the lanes scored, the missions
 * had a runner with tests of its own.
 *
 * Two gates go in, because the defect had two halves. This one is the TABLE's: a mission that names
 * something incapable of reporting a hit is refused before the table opens. The other is the frame
 * loop's, in `tests/shell-boot`, and it is the half this one cannot see.
 */
describe('⚠️ a mission names only what can report a hit', () => {
  test('the shipped tables all pass, which is the point of running it on them', () => {
    for (const table of CATALOG) {
      expect(validateTable(table, { viewHeight: 180 }), table.name).toEqual([]);
    }
  });

  test('⚠️ and a mission aimed at the DRAIN is refused', () => {
    // A drain is in neither list on purpose — `table/rollovers` explains why — so it can never appear
    // in a hit. Naming it is the shape of the defect above, written down where a table author meets it.
    const broken = {
      ...LOW_ORBIT,
      missions: [{ award: 1000, stages: [{ id: 'pinball.mission.first', targets: ['drain'] }] }],
    };

    expect(validateTable(broken, { viewHeight: 180 }).join(' '))
      .toContain('cannot report being hit');
  });

  test('and one aimed at the PLUNGER is refused for the same reason', () => {
    const broken = {
      ...LOW_ORBIT,
      missions: [{ award: 1000, stages: [{ id: 'pinball.mission.first', targets: ['plunger'] }] }],
    };

    expect(validateTable(broken, { viewHeight: 180 }).join(' '))
      .toContain('cannot report being hit');
  });
});

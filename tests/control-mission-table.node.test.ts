// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  MISSION_TABLE, MISSION_CONTROLLERS, MISSIONS_WITH_THEIR_OWN_SHAPE, MAELSTROM_CHAIN,
} from '../app/js/control/mission-table.js';
import { makeMissionController } from '../app/js/control/mission-runner.js';
import type { MissionDefinition } from '../app/js/control/mission-runner.js';
import { createScoreState } from '../app/js/control/score.js';
import type { ControlledComponent, MessageCode } from '../app/js/control/dispatch.js';

describe('the mission switch, transcribed whole', () => {
  test('case 19 is MISSING, because it belongs to Full Tilt', () => {
    // `QuoteController`, commented out upstream. The gap is transcribed rather than closed: closing
    // it would renumber every mission after it.
    expect(MISSION_CONTROLLERS[18]).toBe('Maelstrom');
    expect(MISSION_CONTROLLERS[19]).toBeUndefined();
    expect(MISSION_CONTROLLERS[20]).toBe('AlienMenacePartTwo');
  });

  test('there are thirty-two cases and every name is distinct', () => {
    const names = Object.values(MISSION_CONTROLLERS);

    expect(names).toHaveLength(32);
    expect(new Set(names).size).toBe(names.length);
  });

  test('every mission is either in the table or listed as having its own shape', () => {
    const inTable = new Set(MISSION_TABLE.map((m) => m.mission));
    const apart = new Set(Object.keys(MISSIONS_WITH_THEIR_OWN_SHAPE).map(Number));

    for (const number of Object.keys(MISSION_CONTROLLERS).map(Number)) {
      expect(inTable.has(number) || apart.has(number)).toBe(true);
    }
    // And never both.
    expect([...inTable].filter((n) => apart.has(n))).toEqual([]);
  });

  test('twenty-three of the thirty-two fit the one runner', () => {
    // Which is the claim `control/mission-runner` made, settled by extracting them all.
    expect(MISSION_TABLE).toHaveLength(23);
    expect(Object.keys(MISSIONS_WITH_THEIR_OWN_SHAPE)).toHaveLength(9);
  });
});

describe('what the table says', () => {
  const byNumber = (n: number) => MISSION_TABLE.find((m) => m.mission === n)!;

  test('every next mission is a real one', () => {
    for (const row of MISSION_TABLE) {
      expect(MISSION_CONTROLLERS[row.nextMission]).toBeDefined();
    }
  });

  test('the Maelstrom is EIGHT missions chained end to end', () => {
    // Every other chain is at most two long. This one is the whole table's finale.
    for (let i = 0; i < MAELSTROM_CHAIN.length - 1; i++) {
      expect(byNumber(MAELSTROM_CHAIN[i]!).nextMission).toBe(MAELSTROM_CHAIN[i + 1]);
    }
    expect(byNumber(MAELSTROM_CHAIN.at(-1)!).nextMission).toBe(1);
  });

  test('only the last link of a chain carries a reward', () => {
    for (const number of MAELSTROM_CHAIN.slice(0, -1)) {
      expect(byNumber(number).award).toBeUndefined();
    }
    expect(byNumber(31).award).toBe(5000000);
    expect(byNumber(31).rankPoints).toBe(18);
  });

  test('two missions SHARE their running text', () => {
    // The practice mission and Alien Menace part two ask for the same bumpers, so the original reuses
    // the sentence rather than the controller.
    expect(byNumber(2).textKey).toBe(byNumber(20).textKey);
    expect(byNumber(2).components).toEqual(byNumber(20).components);
    expect(byNumber(2).award).not.toBe(byNumber(20).award);
  });

  test('the cosmic plague asks for seventy-five hits and pays nothing', () => {
    expect(byNumber(15).count).toBe(75);
    expect(byNumber(15).award).toBeUndefined();
    expect(byNumber(15).nextMission).toBe(21);
  });

  test('one row has a count of ZERO, which is not the same as none', () => {
    // `MaelstromPartFour` writes 0 into the counter lamp and then ends on one hit. A `null` count
    // would leave whatever the previous mission left there.
    expect(byNumber(27).count).toBe(0);
    expect(byNumber(28).count).toBeNull();
  });

  test('one mission has no lamps at all', () => {
    expect(byNumber(30).lamps).toEqual([]);
    expect(byNumber(30).components).toEqual(['sink1', 'sink2', 'sink3']);
  });

  test('the last Maelstrom LIGHTS the hyperspace climax lamp for its duration', () => {
    // `lite130` is the lamp `control/hyperspace` hands the whole table over on. The final mission
    // quietly makes the biggest award on the table available while it runs, and nothing says so.
    expect(byNumber(31).litLamps).toEqual(['lite130']);
    expect(MISSION_TABLE.filter((m) => m.litLamps).length).toBe(1);
  });

  test('a rewarded mission always names both the completion and the score line', () => {
    for (const row of MISSION_TABLE) {
      if (row.award === undefined) continue;
      expect(row.scoreTextKey).toBe('STRING179');
      expect(row.completeTextKey ?? row.infoTextKey).toBeDefined();
      expect(row.rankPoints).toBeGreaterThan(0);
    }
  });

  test('rank is NOT a function of the score — the two are tuned separately', () => {
    // Three missions pay 750000. The science mission is worth nine rank points for it, the bug hunt
    // and Alien Menace part two only seven — and nine is also what the 1250000 missions pay. So a
    // mission's contribution to promotion is a separate judgement about difficulty, not a rescaling
    // of its score. Any attempt to derive one from the other would get this wrong.
    const at750k = MISSION_TABLE.filter((m) => m.award === 750000).map((m) => m.rankPoints);
    const at1250k = MISSION_TABLE.filter((m) => m.award === 1250000).map((m) => m.rankPoints);

    expect(at750k.sort()).toEqual([7, 7, 9]);
    expect(at1250k).toEqual([9, 9, 9]);
  });

  test('but the extremes still line up', () => {
    const rewarded = MISSION_TABLE.filter((m) => m.award !== undefined);
    const cheapest = rewarded.reduce((a, b) => (a.award! <= b.award! ? a : b));
    const dearest = rewarded.reduce((a, b) => (a.award! >= b.award! ? a : b));

    expect(cheapest.rankPoints).toBe(6);
    expect(dearest.rankPoints).toBe(18);
  });

  test('no text key is an English sentence', () => {
    // The text belongs to Microsoft; this table carries only the identifiers so i18n can carry our
    // own words.
    const keys = MISSION_TABLE.flatMap((m) =>
      [m.textKey, m.completeTextKey, m.infoTextKey, m.scoreTextKey].filter((k): k is string => !!k));

    expect(keys.every((k) => /^STRING\d+$/.test(k))).toBe(true);
  });
});

describe('a row from the table actually runs', () => {
  function play(rowNumber: number) {
    const row = MISSION_TABLE.find((m) => m.mission === rowNumber)!;
    const lampLog: string[] = [];
    const lamp = () => ({
      flasherStartTimed: (s: number) => lampLog.push('flash:' + s),
      turnOff: () => lampLog.push('off'),
      resetTimed: () => lampLog.push('reset'),
    });
    const components: ControlledComponent[] = row.components.map((name) =>
      ({ name, scores: [], control: null }));
    const definition: MissionDefinition = {
      name: row.name,
      lamps: row.lamps.map(lamp),
      count: row.count,
      components,
      nextMission: row.nextMission,
      text: (remaining) => row.textKey + ':' + remaining,
      ...(row.completeTextKey ? { completeText: row.completeTextKey } : {}),
      ...(row.award !== undefined ? { award: row.award } : {}),
      ...(row.rankPoints !== undefined ? { rankPoints: row.rankPoints } : {}),
      scoreText: (points) => 'SCORED:' + points,
    };
    const counterLamp = {
      messageField: 0,
      turnOn: () => {}, turnOff: () => {}, resetTimed: () => {},
      flasherStart: () => {}, flasherStartTimed: () => {}, flasherStartTimedThenStayOn: () => {},
      get on() { return false; },
    };
    const missionLamp = { messageField: rowNumber };
    const score = createScoreState();
    const shown: string[] = [];
    const dispatched: MessageCode[] = [];
    const controller = makeMissionController({
      definition, counterLamp, missionLamp, score,
      addRankProgress: () => false,
    });
    const ctx = {
      showMissionText: (text: string) => shown.push(text),
      showInfo: () => {},
      dispatch: (code: MessageCode) => dispatched.push(code),
    } as unknown as Parameters<typeof controller>[2];

    return { row, controller, ctx, counterLamp, missionLamp, score, shown, lampLog, components };
  }

  test('the practice mission counts eight bumper hits down and then pays', () => {
    const p = play(2);

    p.controller('ControlMissionComplete', null, p.ctx);
    expect(p.counterLamp.messageField).toBe(8);
    expect(p.shown[0]).toBe('STRING208:8');

    for (let i = 0; i < 8; i++) {
      p.controller('ControlCollision', p.components[i % p.components.length]!, p.ctx);
    }

    expect(p.counterLamp.messageField).toBe(0);
    expect(p.missionLamp.messageField).toBe(1);
    expect(p.score.curScore).toBe(500000);
    expect(p.shown).toContain('STRING209');
  });

  test('a component that is not this mission’s is ignored entirely', () => {
    const p = play(2);
    p.controller('ControlMissionComplete', null, p.ctx);

    p.controller('ControlCollision', { name: 'roll1', scores: [], control: null }, p.ctx);

    expect(p.counterLamp.messageField).toBe(8);
  });

  test('a chained mission ends on ONE hit and hands over without paying', () => {
    const p = play(28); // Maelstrom part five: null count, next 29

    p.controller('ControlMissionComplete', null, p.ctx);
    p.controller('ControlCollision', p.components[0]!, p.ctx);

    expect(p.missionLamp.messageField).toBe(29);
    expect(p.score.curScore).toBe(0);
  });
});

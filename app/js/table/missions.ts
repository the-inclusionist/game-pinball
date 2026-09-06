// SPDX-License-Identifier: AGPL-3.0-or-later
// table/missions — what a player is asked to do on a table nobody wrote in 1995.
//
// ========================= THIS REVERSES A DECISION, AND SAYS SO =========================
// `table/objective.ts` argues, in capitals, that "THE ANSWER IS NOT A MISSION — an authored table has
// none, and inventing some to fill the field would be worse than the silence". That argument was
// right, and it is about a different question: the field being filled was `targetsOf`, the
// accessibility contract's, and faking missions to populate it would have been a lie told to a blind
// player about a table that had nothing to aim at.
//
// The Dev asked for missions as a GAME feature — "crie uma máquina de missão para cada mesa" — and a
// mission a table DECLARES is not an invented one. `objective.ts` keeps its job for a table with none;
// this takes over for a table that has some. Recorded in ADR-0005 rather than by rewriting that file's
// reasoning, which stands.
//
// ========================= AND IT IS NOT THE 1995 MACHINE =========================
// ⚠️ `control/mission-runner` IS NOT REUSED, and that is deliberate rather than lazy. It is a
// transcription of 150 KB of calibrated C++ that keeps its progress in `lite56`'s message field,
// selects with `lite198`, and dispatches through hand-written argument lists naming groups that exist
// only in the archive. None of that generalises to a table authored this morning, and bending it into
// shape would put a second meaning on numbers that were transcribed for one.
//
// This is a small declarative format instead: an ordered list, each with targets and an award. It says
// what it is.

/** One mission, as a table file declares it. */
export interface AuthoredMission {
  /** An i18n key. The text is what the HUD shows while the mission runs. */
  readonly id: string;
  /** Component names. Every one has to be hit — see `hit` for why hits are not counted. */
  readonly targets: readonly string[];
  /** Paid once, on the hit that finishes it. */
  readonly award: number;
}

export interface MissionHit {
  readonly completed: boolean;
  readonly award: number;
}

export interface MissionRunner {
  /** The mission running now, or `null` on a table that declares none. */
  readonly current: AuthoredMission | null;
  /** Its targets that have not been hit yet, in the order the table listed them. */
  readonly remaining: readonly string[];
  /** How many times the list has been round. Zero on the first pass. */
  readonly lap: number;
  hit(component: string): MissionHit;
  /** Back to the first mission. For a new GAME — a lost ball does not undo a mission's progress. */
  reset(): void;
}

export function runMissions(missions: readonly AuthoredMission[]): MissionRunner {
  let index = 0;
  let lap = 0;
  let done = new Set<string>();

  const current = (): AuthoredMission | null => missions[index] ?? null;

  return {
    get current() { return current(); },

    get remaining() {
      const mission = current();
      if (!mission) return [];
      return mission.targets.filter((target) => !done.has(target));
    },

    get lap() { return lap; },

    /**
     * ⚠️ A SET, NOT A COUNT. Counting hits would let a player rattle one target until a two-target
     * mission completed, without ever finding the second — the mission would be a counter rather than
     * a route round the table, and the sonar would go on pointing at something already satisfied.
     */
    hit(component: string): MissionHit {
      const mission = current();
      if (!mission || !mission.targets.includes(component)) return { completed: false, award: 0 };

      done.add(component);
      if (mission.targets.some((target) => !done.has(target))) return { completed: false, award: 0 };

      // ⚠️ AND THE LIST WRAPS. A pinball table is played until the ball is lost, not until a story
      // ends; the 1995 game cycles its missions too. Stopping would leave a live ball with nothing the
      // sonar can point at, which is the silence `objective.ts` exists to avoid.
      done = new Set();
      index += 1;
      if (index >= missions.length) {
        index = 0;
        lap += 1;
      }
      return { completed: true, award: mission.award };
    },

    reset() {
      index = 0;
      lap = 0;
      done = new Set();
    },
  };
}

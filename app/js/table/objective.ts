// SPDX-License-Identifier: AGPL-3.0-or-later
// table/objective — what the player is trying to reach, for a table with no missions.
//
// ========================= THE SONAR HAD NOTHING TO POINT AT =========================
// The plan says of the contract's fifth field: "targetsOf — os alvos ainda válidos da missão corrente.
// É o que faz o SONAR funcionar — modo cego num pinball, possível só porque o contrato pergunta
// topologia e alvos em vez de exigir tiles." That sentence is most of the reason this game consumes the
// Inclusionist engine at all.
//
// `main.ts` declared `missionTargets: []` with `have` and `need` at nought, and nothing ever wrote to
// them. `targetsOf()` returned an empty list every frame and blind mode was silence over a table full
// of things to hit. Eighth time in this port that something declared turned out to be inert, and the
// one that costs the most, because it is the accessibility promise rather than a feature.
//
// ========================= THE ANSWER IS NOT A MISSION =========================
// An authored table has none, and inventing some to fill the field would be worse than the silence.
// The answer is already in the table: the contract asks every component for a ROLE, and two of the
// eight — `goal` and `key` — mean "what the player is trying to reach". So the objective is to finish
// those, and the list is the ones not finished yet.
//
// ⚠️ AND "FINISHED" IS EVERY LAMP LIT, NOT ONE. A component with two lamps is half done after one, and
// the sonar should still point at it. A pursued component with NO lamp stays a target for ever, because
// nothing says it is finished — dropping it would be a guess, and keeping it tells the truth: it is
// something the player can always go and hit.

import type { Role } from '@the-inclusionist/engine/core/contract.js';
import type { AuthoredTable } from './authored.js';
import type { LiveControls } from './live-controls.js';

/**
 * ⚠️ AN i18n KEY USED AS A TEXT ID. `keyOf` maps the STRINGnnn identifiers the 1995 data uses and returns
 * anything else unchanged, so an authored table's id is its own key. Named here rather than written in
 * `main.ts` so a test can hold that it resolves — an unknown key reaches the screen as its own name
 * rather than as an error, which is how `STRING151` was once visible in the running game.
 */
export const AUTHORED_OBJECTIVE_ID = 'pinball.objective.authored';

/** The contract's own words for "what the player is after". Not a list invented here. */
export const PURSUED_ROLES: readonly Role[] = ['goal', 'key'];

export interface TableObjective {
  /** Names, in table order. `shell/declaration` turns them into positions. */
  readonly targets: readonly string[];
  readonly have: number;
  readonly need: number;
}

export function objectiveOf(table: AuthoredTable, live: LiveControls): TableObjective {
  const pursued = table.components.filter((c) => PURSUED_ROLES.includes(c.role));
  const lit = new Set(live.litLamps());

  const done = (component: (typeof pursued)[number]): boolean => {
    const lamps = component.lamps ?? [];
    // No lamp, no way to be finished. See this module's header.
    if (lamps.length === 0) return false;
    return lamps.every((lamp) => lit.has(lamp));
  };

  const remaining = pursued.filter((c) => !done(c));

  return {
    targets: remaining.map((c) => c.name),
    have: pursued.length - remaining.length,
    need: pursued.length,
  };
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// table/bare-minimum — the smallest table the validator will open.
//
// ========================= WHAT THIS ONE IS FOR =========================
// Every rule in `table/authored` says what a table must have. This table has exactly that and nothing
// else: one plunger, one flipper, one drain, a table one pixel taller than the view, and no lamps at
// all. It is the floor of the format, written down.
//
// A floor is worth having as a real table rather than as a fixture for two reasons. It shows what the
// rules ACTUALLY demand — reading the validator tells you the rules, reading this tells you how little
// satisfies them. And when somebody proposes a new rule, this is the table that says what the rule
// costs: if adding it breaks this one, the rule is asking for something the format did not require
// before, and that is a decision rather than a tidy-up.
//
// ⚠️ IT IS NOT PLAYABLE, AND THAT IS THE FINDING. A single flipper cannot cover a drain; there is
// nothing to score; a ball leaving the plunger has one thing to hit. The validator passes it, which
// means the validator checks that a table can RUN, not that it is worth running. Those are different
// questions and only the first one can be answered by a machine.

import type { AuthoredTable } from './authored.js';

export const BARE_MINIMUM: AuthoredTable = {
  name: 'bare-minimum',
  size: { width: 100, height: 181 },
  ballRadius: 3,
  lamps: ['lamp.target'],
  components: [
    { name: 'plunger', kind: 'plunger', role: 'structure', bounds: { x: 86, y: 150, width: 10, height: 28 } },
    // The floor of the format is still a table: a flipper the ball goes through is not a flipper, and
    // the rule that says so does not get to make an exception for the example that demonstrates it.
    { name: 'flipper', kind: 'flipper', role: 'structure', bounds: { x: 30, y: 160, width: 24, height: 6 },
      flipper: {
        pivot: { x: 30, y: 160 }, tipAtRest: { x: 54, y: 166 }, sweepDegrees: -55,
        baseRadius: 3, tipRadius: 2, extendTime: 0.08, retractTime: 0.16,
      } },
    { name: 'drain', kind: 'drain', role: 'hazard', bounds: { x: 40, y: 172, width: 20, height: 8 },
      control: 'DrainControl' },

    // ⚠️ ONE THING TO REACH, because a table with none cannot be described to a player who cannot see
    // it — the contract's fifth field would be empty and blind mode silent. That is part of the FLOOR,
    // so the table that documents the floor has to carry it, exactly as its flipper had to grow a
    // collision. It does not make this table playable: one flipper still cannot cover a drain.
    { name: 'target', kind: 'target', role: 'goal', bounds: { x: 44, y: 20, width: 12, height: 10 },
      scores: [1000], control: 'TargetControl', lamps: ['lamp.target'],
      collision: [{ kind: 'line', from: { x: 56, y: 30 }, to: { x: 44, y: 30 } }] },
  ],
};

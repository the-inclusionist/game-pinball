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
  lamps: [],
  components: [
    { name: 'plunger', kind: 'plunger', role: 'structure', bounds: { x: 86, y: 150, width: 10, height: 28 } },
    { name: 'flipper', kind: 'flipper', role: 'structure', bounds: { x: 30, y: 160, width: 24, height: 6 } },
    { name: 'drain', kind: 'drain', role: 'hazard', bounds: { x: 40, y: 172, width: 20, height: 8 },
      control: 'BallDrainControl' },
  ],
};

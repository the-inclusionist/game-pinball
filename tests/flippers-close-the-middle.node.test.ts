// SPDX-License-Identifier: AGPL-3.0-or-later
// TWO RAISED PADDLES LEAVE A GAP A BALL CANNOT FIT THROUGH — AND DO NOT TOUCH.
//
// ⚠️ THE DEV: "O jogo está com uma chance muito alta de derrota. Aumente o tamanho das pás em todas as
// mesas de forma que uma bolinha não consiga passar por elas caso elas estejam perfeitamente alinhadas
// na horizontal: elas não devem se tocar e o espaço entre elas deve ser menor que uma bolinha."
//
// Two bounds, both his, and they are the whole test: the gap is under a ball and over nothing.
//
// ========================= AND THE HORIZONTAL IS THE NARROWEST POINT =========================
// ⚠️ WORTH DERIVING RATHER THAN ASSUMING, because a paddle sized for the wrong moment is sized for
// nothing. The arm rests a quarter below horizontal and sweeps 55° UP, so it passes THROUGH horizontal
// and finishes 41° above it. The tip's reach toward the middle is `reach · cos(angle)` — largest at
// zero. So the position the Dev named is exactly where the two tips are closest, and a paddle that
// satisfies him there satisfies him everywhere else in the sweep.
//
// This file measures the geometry rather than simulating a shot: whether a ball fits between two points
// is arithmetic, and a survey would answer "it did not happen in sixty balls", which is a different and
// weaker claim.
import { describe, test, expect } from 'vitest';
import { CATALOG } from '../app/js/table/catalog.js';
import type { AuthoredTable, AuthoredComponent } from '../app/js/table/authored.js';

/** The two paddles that face each other across the drain, on tables that have such a pair. */
function facingPair(table: AuthoredTable): [AuthoredComponent, AuthoredComponent] | null {
  const left = table.components.find((c) => c.name === 'flipper.left');
  const right = table.components.find((c) => c.name === 'flipper.right');
  return left?.flipper && right?.flipper ? [left, right] : null;
}

/** How far the tip reaches from its pivot — the paddle's true length, hypotenuse and all. */
const reachOf = (c: AuthoredComponent): number =>
  Math.hypot(c.flipper!.tipAtRest.x - c.flipper!.pivot.x, c.flipper!.tipAtRest.y - c.flipper!.pivot.y);

/**
 * The gap between the two tips with both arms horizontal.
 *
 * The left tip is at `pivot.x + reach` and the right at `pivot.x - reach`, because horizontal is where
 * the whole reach is spent going inward.
 */
function closedGap(table: AuthoredTable): number | null {
  const pair = facingPair(table);
  if (!pair) return null;
  const [left, right] = pair;
  return (right.flipper!.pivot.x - reachOf(right)) - (left.flipper!.pivot.x + reachOf(left));
}

describe.each(CATALOG.map((t) => [t.name, t] as const))('%s', (name, table) => {
  test('⚠️ a ball cannot pass between the raised paddles', () => {
    const gap = closedGap(table);
    if (gap === null) {
      // `bare-minimum` is the floor of the format and carries ONE paddle on purpose. A table with no
      // facing pair has no middle to close, and saying so is better than skipping in silence.
      expect(facingPair(table), `${name} has no facing pair, which is deliberate`).toBeNull();
      return;
    }

    expect(gap, `${name}: the raised paddles leave ${gap.toFixed(1)} and the ball is`
      + ` ${table.ballRadius * 2}`).toBeLessThan(table.ballRadius * 2);
  });

  test('⚠️ and they do not touch each other', () => {
    /**
     * The other half of his sentence — "elas não devem se tocar" — and it is not decoration. Two
     * paddles that meet are a solid floor: the ball can never leave the play through the middle, the
     * drain becomes unreachable except by the outlanes, and a table that cannot lose a ball down the
     * centre is not a pinball table.
     */
    const gap = closedGap(table);
    if (gap === null) return;

    expect(gap, `${name}: the paddles overlap by ${(-gap).toFixed(1)}`).toBeGreaterThan(0);
  });
});

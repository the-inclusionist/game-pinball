// SPDX-License-Identifier: AGPL-3.0-or-later
// table/secret — a door that is not there until the table has taken something from the player.
//
// ========================= WHY THIS EXISTS =========================
// ⚠️ THE DEV, IN TWO MESSAGES:
//   · "com um ou dois cenários contendo passagens secretas que se abrem caso na primeira tacada a
//     bola desça";
//   · "mesas que tenham passagem secreta, que permitam que a bola saia pela lateral baixa ao invés de
//     sair pelo topo."
//
// The second sentence says what the passage IS and the first says when it opens. A plunger lane
// delivers the ball over the whole playfield to the top, and that is the only way in; a secret passage
// is a second mouth low down, letting a ball leave the lane beside the flippers instead.
//
// ========================= A BLOCKER WITH A CONDITION, NOT A NEW KIND =========================
// ⚠️ THE MACHINERY WAS ALREADY HERE, BUILT FOR DROP TARGETS. A target that goes down stops being drawn
// (`gfx/table-view`'s `hidden`) and stops being a wall (`physics-build.setComponentActive`), and
// `table/cabinet` records what it cost to learn that those two must agree: a target drawn but not
// solid is something the player aims at and the ball flies through.
//
// A secret door is exactly that, inverted and on a different clock — solid and drawn until it opens,
// then neither — so nothing new has to be taught to the physics, the renderer or the validator.
//
// ========================= AND THE CONDITION IS COUNTED, NOT TIMED =========================
// "Caso na primeira tacada a bola desça" is a count of balls LOST, which the game loop already keeps.
// A door on a stopwatch would open for a player who was doing well and had simply been playing a
// while, which is the reverse of what he described: this is the table giving something back after it
// has taken.

import type { AuthoredTable } from './authored.js';

export interface AuthoredSecret {
  /**
   * How many balls the player has to have lost before the door opens.
   *
   * One is the Dev's own case — the passage opens if the first shot goes down. Larger numbers are a
   * table's own decision; nought is refused by `validateTable`, because a door that opens after no
   * losses is a wall that was never there.
   */
  readonly afterLostBalls: number;
}

/**
 * The doors that are open right now, by component name.
 *
 * Pure and total, because the game loop asks it every frame: an empty list for a table with no
 * passage at all, which is most of them.
 *
 * ⚠️ AND ONCE OPEN IT STAYS OPEN. The count only rises within a game, so this is monotone by
 * construction rather than by remembering — a door that shut again would be a reward the player
 * cannot plan around, and they have already paid for it once.
 */
export function openSecrets(table: AuthoredTable, lostBalls: number): string[] {
  const open: string[] = [];
  for (const component of table.components) {
    if (!component.secret) continue;
    if (lostBalls >= component.secret.afterLostBalls) open.push(component.name);
  }
  return open;
}

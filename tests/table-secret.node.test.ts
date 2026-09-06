// SPDX-License-Identifier: AGPL-3.0-or-later
// A DOOR THAT IS NOT THERE UNTIL THE TABLE HAS TAKEN SOMETHING FROM YOU.
//
// ⚠️ THE DEV, TWICE, IN TWO DIFFERENT MESSAGES:
//   · "com um ou dois cenários contendo passagens secretas que se abrem caso na primeira tacada a
//     bola desça";
//   · "mesas que tenham passagem secreta, que permitam que a bola saia pela lateral baixa ao invés de
//     sair pelo topo."
//
// The second sentence is what the passage IS and the first is when it opens. A plunger lane delivers
// the ball to the top of the table and that is the only way in; a secret passage is a second mouth,
// low down, that lets a ball leave the lane beside the flippers instead of over the whole playfield.
//
// ========================= WHY IT IS A BLOCKER AND NOT A NEW KIND =========================
// ⚠️ THE MACHINERY WAS ALREADY HERE, BUILT FOR DROP TARGETS. A target that goes down stops being drawn
// (`drawTable`'s `hidden`) and stops being a wall (`physics-build.setComponentActive`), and
// `table/cabinet` records what it cost to learn that those two must agree — a target drawn but not
// solid is something the player aims at and the ball flies through.
//
// A secret door is that, inverted and on a different clock: solid and drawn until it opens, then
// neither. So it is a `blocker` with a condition on it, and nothing new has to be taught to the
// physics, the renderer or the validator.
//
// ========================= AND THE CONDITION IS COUNTED, NOT TIMED =========================
// "Caso na primeira tacada a bola desça" — if the ball goes down on the first shot. That is a count of
// balls LOST, which the game loop already keeps, and not a stopwatch. A door on a timer would open for
// a player who was doing well and had simply been playing a while, which is the opposite of what he
// described: this is the table giving something back after it has taken.
import { describe, test, expect } from 'vitest';
import { openSecrets, type AuthoredSecret } from '../app/js/table/secret.js';
import { validateTable, type AuthoredComponent, type AuthoredTable } from '../app/js/table/authored.js';
import { CRATER_RUN } from '../app/js/table/crater-run.js';
import { buildPhysics, FRAME_SECONDS } from '../app/js/table/physics-build.js';
import { advanceFrame } from '../app/js/physics/step.js';

const SECRET: AuthoredSecret = { afterLostBalls: 1 };

const door = (over: Partial<AuthoredComponent> = {}): AuthoredComponent => ({
  name: 'door', kind: 'blocker', role: 'structure',
  bounds: { x: 60, y: 60, width: 20, height: 4 },
  // ⚠️ LEFT TO RIGHT, so the normal points UP and it catches a ball falling onto it. The first draft
  // wound it right to left, which is a CEILING — and the ball fell straight through a door the test
  // was asserting is shut. `table/authored` has a table of the four windings and the note that the
  // first draft of every table in this repository got one of them wrong; this is the seventh.
  collision: [{ kind: 'line', from: { x: 60, y: 62 }, to: { x: 80, y: 62 } }],
  secret: SECRET,
  ...over,
});

const withDoor = (over: Partial<AuthoredComponent> = {}): AuthoredTable => ({
  ...CRATER_RUN,
  components: [...CRATER_RUN.components, door(over)],
});

describe('when a secret door is open', () => {
  test('at the start of a game it is shut, which is what makes it secret', () => {
    expect(openSecrets(withDoor(), 0)).toEqual([]);
  });

  test('when the first ball has gone down, it opens', () => {
    expect(openSecrets(withDoor(), 1)).toEqual(['door']);
  });

  test('and it stays open for the rest of the game', () => {
    // A door that shut again would be a reward the player cannot plan around, and they have already
    // paid for it once.
    expect(openSecrets(withDoor(), 3)).toEqual(['door']);
  });

  test('a door that wants two balls is not opened by one', () => {
    expect(openSecrets(withDoor({ secret: { afterLostBalls: 2 } }), 1)).toEqual([]);
    expect(openSecrets(withDoor({ secret: { afterLostBalls: 2 } }), 2)).toEqual(['door']);
  });

  test('⚠️ and a table with no secret has none however many balls are lost', () => {
    // The empty list rather than a thrown error: most tables have no passage, and the loop asks every
    // frame.
    expect(openSecrets(CRATER_RUN, 3)).toEqual([]);
  });
});

describe('a secret a table may not declare', () => {
  test('the honest one is legal', () => {
    expect(validateTable(withDoor(), { viewHeight: 180 })).toEqual([]);
  });

  test('⚠️ a door that opens after nought balls is a door that was never shut', () => {
    // It would validate, draw and play as an ordinary wall that is never there — which is a component
    // whose whole purpose is silently absent, and this repository has found six of those.
    expect(validateTable(withDoor({ secret: { afterLostBalls: 0 } }), { viewHeight: 180 }))
      .toEqual(['door: a secret that opens after 0 lost balls was never shut']);
  });

  test('⚠️ and a door with nothing solid in it is a passage that is always open', () => {
    // The gap IS the component. One with no collision is drawn shut and passed through, which is the
    // drop target's defect wearing the opposite mask.
    expect(validateTable(withDoor({ collision: [] }), { viewHeight: 180 }))
      .toContain('door: a secret door needs a collision — it is a wall until it opens');
  });
});

/**
 * ⚠️ AND THE BALL HAS TO NOTICE, which is the half a list of names cannot answer.
 *
 * `physics-build.setComponentActive` is what makes a shape stop being a wall, and it was written for
 * drop targets. This is the join: a door that opens in the model and stays solid in the physics is the
 * same defect as a target drawn after it has dropped, and that one shipped.
 */
describe('⚠️ a door in a real table', () => {
  const shutAndOpen = (active: boolean): boolean => {
    const table = withDoor();
    const physics = buildPhysics(table);
    physics.setComponentActive('door', active);

    const ball = physics.spawnBall();
    ball.position = { x: 70, y: 40 };
    ball.direction = { x: 0, y: 1 };
    ball.speed = 80;

    for (let i = 0; i < 40; i++) {
      advanceFrame([ball], physics.context, FRAME_SECONDS);
      for (const hit of physics.takeHits()) if (hit.name === 'door') return true;
    }
    return false;
  };

  test('shut, the ball bounces off it', () => {
    expect(shutAndOpen(true)).toBe(true);
  });

  test('⚠️ open, the ball goes straight through', () => {
    expect(shutAndOpen(false)).toBe(false);
  });
});

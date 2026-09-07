// SPDX-License-Identifier: AGPL-3.0-or-later
// EVERY TABLE IS A TRAPEZIUM, AND SO IS EVERYTHING STANDING ON IT.
//
// ⚠️ THE DEV: "Deixe todos os túneis inclinados em nove graus transformando todas as mesas em trapézios
// com ângulos internos de 81 graus na base", and then, choosing between the ways of doing it: "Melhor
// caminho: lançador a nove graus em todas as mesas graus equivalentes ao trapézio da mesa original, o
// que faz com que o topo de mesas muito longas como a long-climb sejam bem menores do que de mesas
// baixas como a ring-belt." And after it: "Continue com o redesenho das mesas para dar a impressão de
// profundidade."
//
// ========================= THE ORIGINAL'S OWN NUMBER =========================
// Measured on the 1995 playfield rendered from the Dev's own `PINBALL.DAT`: both side walls lean 9.5°
// from vertical, dx/dy = 0.167, one pixel in six — and the launched ball's climb drifts left at exactly
// that ratio, which is the same fact seen from inside. `table/original-oneways` carries that record.
//
// ========================= AND THE FURNITURE LEANS WITH THE WALLS =========================
// ⚠️ THE OBVIOUS IMPLEMENTATION IS TO SLANT THE FOUR WALLS AND LEAVE THE TABLE ALONE, and it is wrong
// twice. Six to twelve components per table would then stand OUTSIDE their own wall — a bumper in the
// wall, a lane through it — which is a re-authoring of eleven files. And a frame that converges around
// furniture that stays square does not read as depth; it reads as a drawing mistake. A photograph of a
// real table converges everything at once, because that is what a perspective is.
//
// So the lean is one map over every x, in two pieces that meet without a seam: the PLAYFIELD is squeezed
// into what is left between the leaning walls, and the PLUNGER LANE is slid sideways by the same amount
// its outer wall moves. `table/perspective` argues both, and the second is the one worth knowing here:
// a corridor with a mechanical clearance in it cannot be scaled, because the ball is six across and
// does not scale with the picture. Squeezed, the lane becomes a converging wedge and a ball fired up it
// is turned sideways in five bounces.
//
// At the base the map is the identity — the flippers, the drain and the plunger are exactly where they
// were played — and the table opens toward the player from there.
import { describe, test, expect } from 'vitest';
import { CATALOG, PLAYABLE_TABLES } from '../app/js/table/catalog.js';
import { LEAN_DEGREES, leanOf, taper, MIN_TOP_BALLS }
  from '../app/js/table/perspective.js';
import { plungerLaneOf } from '../app/js/table/cabinet.js';
import type { AuthoredTable } from '../app/js/table/authored.js';

/**
 * How wide the PLAYFIELD is at the ceiling — the part left of the plunger lane, which is the part a
 * ball is played on. The lane carries its own width all the way up and is not room to move in.
 */
function playfieldTop(table: AuthoredTable): number {
  return plungerLaneOf(table.size).divider - 2 * leanOf(table) * table.size.height;
}

/** Every point a component puts on the playfield, so a sweep can ask about all of them. */
function pointsOf(table: AuthoredTable): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (const c of table.components) {
    for (const s of c.collision ?? []) {
      if (s.kind === 'line') points.push(s.from, s.to);
      else points.push(s.at);
    }
    if (c.flipper) points.push(c.flipper.pivot, c.flipper.tipAtRest);
    if (c.mover) points.push(c.mover.from, c.mover.to);
  }
  return points;
}

describe('the lean itself', () => {
  test('⚠️ nine degrees, which is the original playfield measured', () => {
    expect(LEAN_DEGREES).toBe(9);
  });

  test.each(PLAYABLE_TABLES.map((t) => [t.name, t] as const))(
    '%s leans the full nine', (_name, table) => {
      /**
       * Every table a player is offered takes the whole angle. The floor below is a rule about
       * geometry, and no playable table is anywhere near it.
       */
      expect(Math.atan(leanOf(table)) * (180 / Math.PI)).toBeCloseTo(LEAN_DEGREES, 6);
    },
  );

  test('⚠️ and the one table where nine degrees is impossible gets the steepest it can take', () => {
    /**
     * ⚠️ `narrow-tower` IS 120 WIDE AND 420 TALL, and at nine degrees the two walls CROSS before they
     * reach the top: 2 × 420 × tan 9° = 133 units of narrowing out of 120. The instruction is not hard
     * there, it is geometrically impossible, and the Dev's own sentence is about `long-climb` and
     * `ring-belt` — tables a player is offered.
     *
     * ⚠️ SO THE RULE HAS A FLOOR RATHER THAN AN EXCEPTION LIST. Nine degrees, or the steepest lean that
     * leaves the top four balls wide, whichever is shallower. It bites on exactly one table today, it
     * is stated once instead of eleven times, and a table authored tomorrow at some other size gets a
     * playable top instead of an inverted one.
     */
    const tower = CATALOG.find((t) => t.name === 'narrow-tower')!;
    const lean = leanOf(tower);
    const top = playfieldTop(tower);

    expect(Math.atan(lean) * (180 / Math.PI), 'it took an angle it cannot take')
      .toBeLessThan(LEAN_DEGREES);
    expect(top, 'the top is narrower than the floor allows')
      .toBeCloseTo(MIN_TOP_BALLS * 2 * tower.ballRadius, 6);
  });

  test.each(CATALOG.map((t) => [t.name, t] as const))(
    '%s keeps a top a ball can get through', (name, table) => {
      const top = playfieldTop(table);

      expect(top, `${name} closes to ${top.toFixed(1)} at the top`)
        .toBeGreaterThanOrEqual(MIN_TOP_BALLS * 2 * table.ballRadius - 1e-9);
    },
  );
});

describe('what the transform does to a table', () => {
  const table = PLAYABLE_TABLES[0]!;
  const flat: AuthoredTable = {
    ...table,
    components: [
      { name: 'probe', kind: 'wall', role: 'structure',
        bounds: { x: 0, y: 0, width: 10, height: 10 },
        collision: [
          { kind: 'line', from: { x: 0, y: table.size.height }, to: { x: 0, y: 0 } },
          { kind: 'line', from: { x: table.size.width, y: table.size.height },
            to: { x: table.size.width, y: 0 } },
        ] },
    ],
  };

  test('⚠️ the base line does not move, because that is where the player is standing', () => {
    /**
     * The flippers, the drain and the plunger's own seat are all within thirty-five of the floor, and
     * they are the numbers this port tuned by playing. A transform that moved them would be a
     * re-tuning of the bottom of every table wearing a coat of perspective.
     */
    const leaned = taper(flat).components[0]!.collision!;

    expect((leaned[0] as { from: { x: number } }).from.x).toBeCloseTo(0, 6);
    expect((leaned[1] as { from: { x: number } }).from.x).toBeCloseTo(table.size.width, 6);
  });

  test('⚠️ and the silhouette leans by exactly the angle asked for', () => {
    const leaned = taper(flat).components[0]!.collision!;
    const left = leaned[0] as { from: { x: number; y: number }; to: { x: number; y: number } };
    const degrees = Math.atan2(left.to.x - left.from.x, left.from.y - left.to.y) * (180 / Math.PI);

    expect(degrees, 'the outer edge is not at nine degrees').toBeCloseTo(LEAN_DEGREES, 6);
  });
});

describe('and nothing is left standing in a wall', () => {
  /**
   * ⚠️ THIS IS THE PROPERTY THAT MAKES THE TRANSFORM WORTH ITS SIZE, and it is worth stating as an
   * inequality rather than as a survey. The playfield is mapped INTO the space between the leaning
   * walls, so a point that started inside the table cannot end outside one: the map sends 0 to the left
   * wall's own inset and the divider to the lane's, and everything between in proportion. Slanting the
   * walls alone would have put six to twelve components per table inside one.
   */
  test.each(CATALOG.map((t) => [t.name, t] as const))(
    '%s keeps every point between its walls', (name, table) => {
      const lean = leanOf(table);
      let worst = { at: '', slack: Infinity };
      for (const p of pointsOf(table)) {
        const inset = lean * (table.size.height - p.y);
        const slack = Math.min(p.x - inset, table.size.width - inset - p.x);
        if (slack < worst.slack) worst = { at: `(${p.x.toFixed(1)},${p.y.toFixed(1)})`, slack };
      }

      expect(worst.slack, `${name}: ${worst.at} sits ${(-worst.slack).toFixed(1)} outside the wall`)
        .toBeGreaterThan(-1e-9);
    },
  );
});

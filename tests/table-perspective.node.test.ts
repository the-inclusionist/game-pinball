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
import { LEAN_DEGREES, leanOf, taper, playfieldTopOf }
  from '../app/js/table/perspective.js';
import { validateTable, type AuthoredTable } from '../app/js/table/authored.js';

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

  test.each(CATALOG.map((t) => [t.name, t] as const))(
    '%s leans the full nine', (_name, table) => {
      /**
       * ⚠️ EVERY TABLE, AND THE FIXTURES USED TO BE EXEMPT. `MIN_TOP_BALLS` capped the lean at whatever
       * left four balls of playfield at the top, which took `narrow-tower` down to 5.1° and
       * `bare-minimum` to 8.6°. The Dev took the cap off — "a inclinação de narrow-tower e bare-minimum
       * devem ser 9 graus TAMBÉM" — and `narrow-tower` was widened from 120 to 180 to be able to take
       * them. A fixture that leans differently from the tables is a fixture measuring a different game.
       */
      expect(Math.atan(leanOf(table)) * (180 / Math.PI)).toBeCloseTo(LEAN_DEGREES, 6);
    },
  );

  test('⚠️ and a table whose walls would cross is refused rather than bent', () => {
    /**
     * What replaced the floor. `narrow-tower` at 120x420 is the case that made it necessary: nine
     * degrees narrows the playfield by 133 units and it has 99, so the left wall ends up right of the
     * right one and every component between them is outside both.
     *
     * ⚠️ THE VALIDATOR SAYS SO INSTEAD OF THE TRANSFORM SILENTLY REDUCING THE ANGLE, which is what the
     * floor did. A table that cannot exist should not open, and it should say why in the same words a
     * person would use to fix it — the width it would need.
     */
    const impossible: AuthoredTable = {
      ...PLAYABLE_TABLES[0]!, name: 'impossible', size: { width: 120, height: 420 },
    };

    expect(playfieldTopOf(impossible), 'the walls do not actually cross at this size')
      .toBeLessThan(0);
    expect(validateTable(impossible, { viewHeight: 180 }).join(' '))
      .toMatch(/leaves no playfield at the top/);
  });

  test.each(CATALOG.map((t) => [t.name, t] as const))(
    '%s can hold a playfield at all', (name, table) => {
      const top = playfieldTopOf(table);

      expect(top, `${name} closes to ${top.toFixed(1)} at the top`).toBeGreaterThan(0);
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

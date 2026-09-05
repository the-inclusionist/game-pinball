// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { createProjection, GAME_MATRIX } from '../app/js/maths/proj.js';

/** Plausible values for one resolution: focal distance and screen centre. */
const proj = () => createProjection({ matrix: GAME_MATRIX, d: 350, centerX: 300, centerY: 208, zMin: 0, zScaler: 100 });

describe('proj — the game matrix', () => {
  test('is a 24-degree rotation, not an arbitrary matrix', () => {
    // -0.913545 and 0.406737 are -cos(24) and sin(24). All of the game's "3D" is the flat table tilted
    // 24 degrees plus the perspective divide; there is no mesh and no real depth anywhere.
    const rad = (24 * Math.PI) / 180;

    expect(GAME_MATRIX.row1.y).toBeCloseTo(-Math.cos(rad), 5);
    expect(GAME_MATRIX.row1.z).toBeCloseTo(Math.sin(rad), 5);
    expect(GAME_MATRIX.row2.y).toBeCloseTo(-Math.sin(rad), 5);
    expect(GAME_MATRIX.row2.z).toBeCloseTo(-Math.cos(rad), 5);
  });
});

describe('proj — table to screen', () => {
  test('the table origin lands on the screen centre', () => {
    const p = proj().toScreen({ x: 0, y: 0, z: 0 });

    expect(p.x).toBe(300); // x0 = 0 projects exactly onto the centre
    expect(typeof p.y).toBe('number');
  });

  test('moving in X moves on screen', () => {
    const a = proj().toScreen({ x: 0, y: 0, z: 0 });
    const b = proj().toScreen({ x: 5, y: 0, z: 0 });

    expect(b.x).toBeGreaterThan(a.x);
  });

  test('the result is an integer TRUNCATED toward zero, not rounded', () => {
    // The original uses `static_cast<int>`, which cuts toward zero. Rounding would move half the
    // sprites by half a pixel — little, and enough that a pixel-for-pixel comparison never closes.
    const p = createProjection({ matrix: GAME_MATRIX, d: 350, centerX: 0.9, centerY: -0.9, zMin: 0, zScaler: 100 });

    const r = p.toScreen({ x: 0, y: 0, z: 0 });

    expect(r.x).toBe(0); // 0.9 truncated is 0
    expect(Number.isInteger(r.y)).toBe(true);
  });
});

describe('proj — screen to table', () => {
  test('unprojecting and projecting back returns the same pixel', () => {
    // The strongest test a projection admits: the round trip. A flipped sign in any term breaks this
    // and breaks almost nothing else.
    const p = proj();

    for (const target of [{ x: 300, y: 208 }, { x: 120, y: 60 }, { x: 480, y: 390 }]) {
      const onTable = p.toTable(target);
      const back = p.toScreen(onTable);

      expect(Math.abs(back.x - target.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.y - target.y)).toBeLessThanOrEqual(1);
    }
  });

  test('always unprojects onto the table plane, z = 0', () => {
    expect(proj().toTable({ x: 200, y: 100 }).z).toBe(0);
  });
});

describe('proj — depth normalisation', () => {
  test('depth below the minimum becomes ZERO, which is nearest', () => {
    const p = createProjection({ matrix: GAME_MATRIX, d: 350, centerX: 0, centerY: 0, zMin: 10, zScaler: 100 });

    expect(p.normalizeDepth(5)).toBe(0);
  });

  test('depth inside the range scales linearly', () => {
    const p = createProjection({ matrix: GAME_MATRIX, d: 350, centerX: 0, centerY: 0, zMin: 10, zScaler: 100 });

    expect(p.normalizeDepth(20)).toBe(1000); // (20 - 10) * 100
  });

  test('above 65535 the value WRAPS rather than saturating', () => {
    // The original's guard compares `depthScaled <= zmax`, but `zmax` was computed in UNSCALED units —
    // different quantities, so the guard almost never fires and the cast to uint16 wraps. A latent
    // defect of the original, not of this port: transcribed and pointed at here, because real table
    // depths never get there and "fixing" it would change behaviour.
    const p = createProjection({ matrix: GAME_MATRIX, d: 350, centerX: 0, centerY: 0, zMin: 0, zScaler: 1 });

    expect(p.normalizeDepth(65536)).toBe(0);
    expect(p.normalizeDepth(65537)).toBe(1);
  });
});

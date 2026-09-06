// SPDX-License-Identifier: AGPL-3.0-or-later
// maths/proj — the table-to-screen projection. Port of `proj.cpp`.
//
// ========================= THE 3D IN 3D PINBALL IS A 24-DEGREE TILT =========================
// The game's matrix, transcribed from the upstream comment, is THE SAME at every resolution:
//
//     1        0          0          0
//     0       -0.913545   0.406737   3.791398
//     0       -0.406737  -0.913545  24.675402
//
// `0.913545` is `cos(24 degrees)` and `0.406737` is `sin(24 degrees)`. There is no mesh and no real
// depth: the table is a plane tilted 24 degrees, the camera sits back 24.675 and up 3.791, and the
// perspective divide does the rest. The apparent relief — ramps, lanes — comes from the z-map, not
// from geometry.
//
// AND BECAUSE THE MATRIX DOES NOT CHANGE WITH RESOLUTION, only `d` (the focal distance) and the screen
// center do. That is why halving the table costs two scalars rather than a rewrite.

export interface Row4 { x: number; y: number; z: number; w: number }
export interface Matrix { row0: Row4; row1: Row4; row2: Row4 }
export interface Vector3 { x: number; y: number; z: number }

export const GAME_MATRIX: Matrix = {
  row0: { x: 1, y: 0, z: 0, w: 0 },
  row1: { x: 0, y: -0.913545, z: 0.406737, w: 3.791398 },
  row2: { x: 0, y: -0.406737, z: -0.913545, w: 24.675402 },
};

/** The original's sentinel coefficient for when the projected Z comes out exactly zero. */
const DEGENERATE_COEFFICIENT = 999999.88;

export interface Projection {
  toScreen(v: Vector3): { x: number; y: number };
  /** Unprojects a pixel back onto the table, ALWAYS on the z = 0 plane. */
  toTable(p: { x: number; y: number }): Vector3;
  normalizeDepth(depth: number): number;
  /**
   * `proj::z_distance` and then `normalizeDepth`, which is how deep a thing is to the z-buffer.
   *
   * ⚠️ IT IS ROW TWO OF THE MATRIX — the same dot product `toScreen` divides by — and NOT the point's
   * own z, nor its distance to the camera. Either of those is a number in the wrong units: the ball
   * would come out always in front of the scene or always behind it, and never sometimes.
   */
  depthOf(v: Vector3): number;
}

export interface ProjectionOptions {
  readonly matrix: Matrix;
  /** Focal distance. Changes per resolution. */
  readonly d: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly zMin: number;
  readonly zScaler: number;
}

function multiply(m: Matrix, v: Vector3): Vector3 {
  return {
    x: v.z * m.row0.z + v.y * m.row0.y + v.x * m.row0.x + m.row0.w,
    y: v.z * m.row1.z + v.y * m.row1.y + v.x * m.row1.x + m.row1.w,
    z: v.z * m.row2.z + v.y * m.row2.y + v.x * m.row2.x + m.row2.w,
  };
}

/** Written and read through a Uint16Array to reproduce the original's `static_cast<uint16_t>` wrap. */
const SIXTEEN_BITS = new Uint16Array(1);

export function createProjection(o: ProjectionOptions): Projection {
  const zMax = 0xffffffff / o.zScaler + o.zMin;

  return {
    toScreen(v: Vector3): { x: number; y: number } {
      const p = multiply(o.matrix, v);
      const coefficient = p.z === 0 ? DEGENERATE_COEFFICIENT : o.d / p.z;
      // TRUNCATES toward zero, as the original's `static_cast<int>`. Rounding would shift half the
      // sprites by half a pixel — small, and enough that no pixel-for-pixel comparison ever closes.
      return {
        x: Math.trunc(p.x * coefficient + o.centerX),
        y: Math.trunc(p.y * coefficient + o.centerY),
      };
    },

    /**
     * The inverse, solved with z0 pinned to 0. The upstream leaves the derivation in its own file:
     *   y0 = (y2 * (A*z0 + G) - B*z0 - F) / (A + B*y2)
     *   x0 =  x2 * (A*z0 - B*y0 + G)
     * with A = matrix[1][1], B = matrix[1][2], F = matrix[1][3], G = matrix[2][3].
     */
    depthOf(v: Vector3): number {
      const row2 = o.matrix.row2;
      return this.normalizeDepth(row2.x * v.x + row2.y * v.y + row2.z * v.z + row2.w);
    },

    toTable(point: { x: number; y: number }): Vector3 {
      const a = o.matrix.row1.y, b = o.matrix.row1.z, f = o.matrix.row1.w, g = o.matrix.row2.w;
      const x2 = (point.x - o.centerX) / o.d;
      const y2 = (point.y - o.centerY) / o.d;
      const z0 = 0;

      const y0 = (y2 * (a * z0 + g) - b * z0 - f) / (a + b * y2);
      const x0 = x2 * (a * z0 - b * y0 + g);
      return { x: x0, y: y0, z: z0 };
    },

    /**
     * Real depth to the z-buffer's 16-bit integer.
     *
     * WARNING: THE ORIGINAL'S GUARD COMPARES MISMATCHED UNITS. It tests `depthScaled <= zmax` while
     * `zmax` was computed in UNSCALED units (`0xffffffff / zScaler + zMin`). So it almost never fires,
     * and the cast to 16 bits WRAPS instead of saturating. That is a latent defect of the original,
     * not of this port. Transcribed and labeled: real table depths never reach there, and "fixing" it
     * would change behavior nobody asked to change.
     */
    normalizeDepth(depth: number): number {
      if (depth < o.zMin) return 0;
      const scaled = (depth - o.zMin) * o.zScaler;
      if (scaled > zMax) return 0xffff;
      SIXTEEN_BITS[0] = scaled;
      return SIXTEEN_BITS[0]!;
    },
  };
}

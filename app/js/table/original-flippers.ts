// SPDX-License-Identifier: AGPL-3.0-or-later
// table/original-flippers — reading the 1995 flippers out of the archive.
//
// ========================= THREE POINTS AND TWO TIMES =========================
// `TFlipper`'s constructor reads records 800, 801 and 802 as three `vector3`s and hands them straight
// to `TFlipperEdge`: the pivot, the tip AT REST and the tip EXTENDED. There is no angle anywhere — the
// swing is the angle between the two tips about the pivot, which is what `physics/flipper.deriveFlipper`
// works out.
//
// ⚠️ AND THE THIRD COMPONENT OF EACH VECTOR IS A RADIUS, NOT A Z. The pivot's is 0.311 and the tips'
// 0.193, which is the flipper drawn as a base circle and a tip circle joined by two faces. Read as a
// height it is meaningless and the flipper collapses to a line.
//
// ⚠️ THE SIDE IS THE OBJECT TYPE, NOT THE SIGN OF X. `a_flip2` is `RightFlipper` and its pivot sits at
// x = -2.489, so on this table's axes the right flipper has a negative x. Guessing the side from the
// coordinate gets both of them backwards, and a player pressing left would work the wrong one.

import { floatAttribute } from '../dat/attributes.js';
import { ObjectType, type Table } from '../dat/loader.js';
import type { Group } from '../dat/partman.js';
import type { FlipperGeometry } from '../physics/flipper.js';

/** The pivot, as `x y radius`. */
export const FLIPPER_PIVOT_RECORD = 800;
/** The tip with the flipper down. */
export const FLIPPER_REST_RECORD = 801;
/** The tip fully extended. */
export const FLIPPER_EXTENDED_RECORD = 802;
/** `collMult`, which scales the speed the moving face gives the ball. */
export const FLIPPER_COLLISION_MULT_RECORD = 803;
/** Seconds for the whole swing, each way. */
export const FLIPPER_EXTEND_TIME_RECORD = 804;
export const FLIPPER_RETRACT_TIME_RECORD = 805;

export interface FlipperMaterial {
  readonly elasticity: number;
  readonly smoothness: number;
}

/**
 * A flipper's geometry, or null when the group is not one. Everything but the material comes from the
 * six records; the material comes from the visual, as `TFlipper` reads it.
 */
export function readFlipperGeometry(
  group: Group, material: FlipperMaterial, collisionOffset: number,
): FlipperGeometry | null {
  const pivot = floatAttribute(group, FLIPPER_PIVOT_RECORD);
  const rest = floatAttribute(group, FLIPPER_REST_RECORD);
  const extended = floatAttribute(group, FLIPPER_EXTENDED_RECORD);
  if (!pivot || !rest || !extended) return null;
  if (pivot.length < 3 || rest.length < 3 || extended.length < 3) return null;

  return {
    pivot: { x: pivot[0]!, y: pivot[1]! },
    baseRadius: pivot[2]!,
    tipAtRest: { x: rest[0]!, y: rest[1]! },
    tipRadius: rest[2]!,
    tipExtended: { x: extended[0]!, y: extended[1]! },
    extendTime: floatAttribute(group, FLIPPER_EXTEND_TIME_RECORD)?.[0] ?? 0.04,
    retractTime: floatAttribute(group, FLIPPER_RETRACT_TIME_RECORD)?.[0] ?? 0.08,
    collisionMult: floatAttribute(group, FLIPPER_COLLISION_MULT_RECORD)?.[0] ?? 1,
    elasticity: material.elasticity,
    smoothness: material.smoothness,
    collisionOffset,
  };
}

/** Which side each flipper is, by the archive's object type. See this module's header. */
export function flipperSides(manifest: Table): Map<string, 'left' | 'right'> {
  const sides = new Map<string, 'left' | 'right'>();
  for (const object of manifest.tableObjects) {
    if (object.type !== ObjectType.LeftFlipper && object.type !== ObjectType.RightFlipper) continue;
    const name = manifest.groups[object.group]?.name;
    if (name) sides.set(name, object.type === ObjectType.LeftFlipper ? 'left' : 'right');
  }
  return sides;
}

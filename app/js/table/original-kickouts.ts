// SPDX-License-Identifier: AGPL-3.0-or-later
// table/original-kickouts — the three holes that swallow the ball and throw it back.
//
// ========================= THE MOUTH IS NOT THE CIRCLE THAT IS DRAWN =========================
// `TKickout`'s constructor takes the circle from the wall record and multiplies its radius by record
// 306 — and in the shipped file that record is 0.9, 0.2 and 0.05. So `a_kout1`'s mouth is a TWENTIETH
// of the circle the table draws. Installing the drawn circle instead would swallow the ball from
// twenty times too far away, and the hole would read as a bug in the collision search rather than in
// the geometry.
//
// That is why this module exports the geometry separately: `table/original` has to install the
// component's circle rather than the file's, and it installs walls before any component exists.
//
// ========================= AND THE FIELD IS A SECOND CIRCLE =========================
// Record 305 is how hard the hole pulls, and the pull reaches the DRAWN radius rather than the mouth.
// So a kickout is two circles: a small one that catches and a large one that leans.
//
// ⚠️ THE FIELD IS BUILT AND NOT YET COMPOSED INTO THE TABLE'S `fieldEffects`. A kickout catches the
// ball on contact today; what is missing is the lean that guides a near miss in. Said here rather
// than left to be discovered from the play.

import { createKickout, type Kickout } from './kickout.js';
import { readVisual } from '../dat/visual.js';
import { floatAttribute } from '../dat/attributes.js';
import { ObjectType, type Table } from '../dat/loader.js';
import type { OriginalTable } from './original.js';
import type { TimerService } from './bumper.js';
import type { TableState } from './collision-component.js';

/** `FieldMult`: how hard the hole pulls toward its centre. */
export const KICKOUT_FIELD_RECORD = 305;
/** The multiplier on the drawn radius that gives the mouth its size. */
export const KICKOUT_MOUTH_RECORD = 306;
/** Four floats; the third is the Z the ball takes while it sits in the hole, outside Full Tilt. */
export const KICKOUT_Z_RECORD = 408;
/** `TimerTime1`, written by the constructor rather than read from the file. */
export const KICKOUT_HOLD_SECONDS = 1.5;
/** `ThrowSpeedMult2 = ThrowBallMult * 0.01`. */
export const THROW_MULT_SCALE = 0.01;

/** Which groups are kickouts, by the archive's name. Both object types count. */
export function kickoutNames(manifest: Table): Set<string> {
  const names = new Set<string>();
  for (const object of manifest.tableObjects) {
    if (object.type !== ObjectType.Kickout && object.type !== ObjectType.Kickout2) continue;
    const name = manifest.groups[object.group]?.name;
    if (name) names.add(name);
  }
  return names;
}

/**
 * The wall record a kickout should be INSTALLED with: the same circle, with the mouth's radius.
 *
 * Handed to `buildOriginalTable` as `geometryFor`, because walls are installed before any component
 * exists and the component's shape has to be right from the first frame.
 */
export function kickoutGeometry(manifest: Table): (name: string, data: readonly number[]) => readonly number[] | undefined {
  const names = kickoutNames(manifest);
  const mouthOf = new Map<string, number>();
  for (const object of manifest.tableObjects) {
    const group = manifest.groups[object.group];
    const name = group?.name;
    if (!group || !name || !names.has(name)) continue;
    const mouth = floatAttribute(group, KICKOUT_MOUTH_RECORD)?.[0];
    if (mouth !== undefined) mouthOf.set(name, mouth);
  }

  return (name, data) => {
    const mouth = mouthOf.get(name);
    // Circles only: `floor(data[0]) - 1 === 0`. A kickout drawn as anything else would be a file this
    // port has not seen, and scaling a polygon by a radius means nothing.
    if (mouth === undefined || Math.floor(data[0]!) - 1 !== 0) return undefined;
    return [data[0]!, data[1]!, data[2]!, data[3]! * mouth];
  };
}

export interface OriginalKickoutOptions {
  readonly table: TableState;
  readonly timer: TimerService;
  readonly sound?: { play(soundId: number, source: unknown): void };
}

export function buildOriginalKickouts(
  manifest: Table, table: OriginalTable, o: OriginalKickoutOptions,
): Map<string, Kickout> {
  const kickouts = new Map<string, Kickout>();

  for (const object of manifest.tableObjects) {
    if (object.type !== ObjectType.Kickout && object.type !== ObjectType.Kickout2) continue;
    const group = manifest.groups[object.group];
    const name = group?.name;
    if (!group || !name) continue;

    const drawn = floatAttribute(group, 600);
    const edges = table.edgesOf(name);
    if (!drawn || drawn.length < 4 || !edges.length) continue;

    const visual = readVisual(manifest.groups, object.group);
    const radius = drawn[3]!;

    kickouts.set(name, createKickout({
      table: o.table,
      timer: o.timer,
      edges,
      center: { x: drawn[1]!, y: drawn[2]! },
      // The FIELD reaches the drawn circle, not the mouth: `RadiusSq = FloatArr[2] * FloatArr[2]`.
      fieldRadiusSq: radius * radius,
      fieldMult: floatAttribute(group, KICKOUT_FIELD_RECORD)?.[0] ?? 0,
      capturedZ: floatAttribute(group, KICKOUT_Z_RECORD)?.[2] ?? 0,
      holdTime: KICKOUT_HOLD_SECONDS,
      throwDirection: visual.kicker.throwBallDirection,
      throwAngleMult: visual.kicker.throwBallAngleMult,
      throwSpeedMult1: visual.kicker.boost,
      throwSpeedMult2: visual.kicker.throwBallMult * THROW_MULT_SCALE,
      captureSoundId: visual.softHitSoundId,
      releaseSoundId: visual.kicker.hardHitSoundId,
      ...(o.sound ? { sound: o.sound } : {}),
    }));
  }

  return kickouts;
}

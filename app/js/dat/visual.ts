// SPDX-License-Identifier: AGPL-3.0-or-later
// dat/visual — a component's physical properties. Port of `loader::query_visual`, `loader::material`,
// `loader::kicker` and `loader::default_vsi`.
//
// ========================= THE NUMBERS EVERY COMPONENT IS MADE OF =========================
// `createBumper` wants an elasticity, a smoothness, a threshold and a boost. `createFlipper` wants a
// collision multiplier. Every `T*` constructor in the original opens with `loader::query_visual`, and
// none of them could be built from the archive until this existed — which is why the demonstration mode
// scores at level zero and lights nothing.
//
// ========================= IT IS A GROUP POINTING AT OTHER GROUPS =========================
// A component's Int16 array is a list of `[record, value]` pairs, and the value is usually a GROUP
// INDEX rather than a number:
//
//   300 -> the MATERIAL group, whose floats carry 301 smoothness, 302 elasticity, 304 soft-hit sound
//   400 -> the KICKER group, whose floats carry 401 threshold, 402 boost, 403 throw multiplier,
//          404 throw direction (THREE floats, not one), 405 throw angle, 406 hard-hit sound
//   304 / 406      -> a sound index directly
//   602            -> a collision group BIT, or-ed in, not assigned
//   1100 / 1101    -> the two sound indices a component plays
//   1500           -> seven shorts to skip, whatever they are
//
// ⚠️ RECORD 404 IS THE ONE THAT BREAKS A NAIVE LOOP. Every other kicker record is a pair; that one is
// four floats. Walking the array two at a time regardless reads the direction's y as a record id, and
// the original guards it with an explicit `if (floorVal != 404)` before advancing.
//
// ⚠️ AND THE COLLISION GROUP IS OR-ED AND THEN DEFAULTED. Several 602 records can appear and each
// contributes a bit; a component with none gets 1 rather than 0, because 0 collides with nothing and
// would make the part invisible to every ball.

import { EntryType, type Group } from './partman.js';

/** `loader::default_vsi`. Every field, including the ones that look like they could be zero. */
export const DEFAULT_VISUAL = {
  collisionGroup: 0,
  smoothness: 0.94999999,
  elasticity: 0.60000002,
  softHitSoundId: 0,
  soundIndex3: 0,
  soundIndex4: 0,
  kicker: {
    threshold: 8.9999999e10,
    boost: 0,
    throwBallMult: 0,
    throwBallAngleMult: 0,
    hardHitSoundId: 0,
    throwBallDirection: { x: 0, y: 0, z: 0 },
  },
} as const;

export interface VisualKicker {
  threshold: number;
  boost: number;
  throwBallMult: number;
  throwBallAngleMult: number;
  hardHitSoundId: number;
  throwBallDirection: { x: number; y: number; z: number };
}

export interface Visual {
  collisionGroup: number;
  smoothness: number;
  elasticity: number;
  softHitSoundId: number;
  soundIndex3: number;
  soundIndex4: number;
  kicker: VisualKicker;
}

function defaults(): Visual {
  return {
    collisionGroup: DEFAULT_VISUAL.collisionGroup,
    smoothness: DEFAULT_VISUAL.smoothness,
    elasticity: DEFAULT_VISUAL.elasticity,
    softHitSoundId: DEFAULT_VISUAL.softHitSoundId,
    soundIndex3: DEFAULT_VISUAL.soundIndex3,
    soundIndex4: DEFAULT_VISUAL.soundIndex4,
    kicker: { ...DEFAULT_VISUAL.kicker, throwBallDirection: { ...DEFAULT_VISUAL.kicker.throwBallDirection } },
  };
}

/** The group's first Int16 array, read whole. NOT the attribute form — there is no record id in front. */
function shortsOf(group: Group): number[] | null {
  const entry = group.entries.find((e) => e.type === EntryType.Int16s && e.data);
  if (!entry?.data) return null;
  const view = new DataView(entry.data.buffer, entry.data.byteOffset, entry.data.byteLength);
  const out: number[] = [];
  for (let at = 0; at + 2 <= view.byteLength; at += 2) out.push(view.getInt16(at, true));
  return out;
}

/** The group's first float array, read whole and likewise without an id. */
function floatsOf(group: Group): number[] | null {
  const entry = group.entries.find((e) => e.type === EntryType.Float32s && e.data);
  if (!entry?.data) return null;
  const view = new DataView(entry.data.buffer, entry.data.byteOffset, entry.data.byteLength);
  const out: number[] = [];
  for (let at = 0; at + 4 <= view.byteLength; at += 4) out.push(view.getFloat32(at, true));
  return out;
}

/** `loader::material`. Smoothness, elasticity and the soft-hit sound, as `[record, value]` pairs. */
export function readMaterial(group: Group, into: Visual): void {
  const floats = floatsOf(group);
  if (!floats) return;

  for (let i = 0; i + 1 < floats.length; i += 2) {
    switch (Math.floor(floats[i]!)) {
      case 301: into.smoothness = floats[i + 1]!; break;
      case 302: into.elasticity = floats[i + 1]!; break;
      case 304: into.softHitSoundId = Math.floor(floats[i + 1]!); break;
      // The original errors here. This stops instead: an unknown record is a file this port has not
      // seen, and refusing to open the whole table over one is worse than reading the rest.
      default: return;
    }
  }
}

/**
 * `loader::kicker`. The threshold and boost every collision component bounces with.
 *
 * ⚠️ RECORD 404 IS FOUR FLOATS, NOT TWO. See this module's header.
 */
export function readKicker(group: Group, into: VisualKicker): void {
  const floats = floatsOf(group);
  if (!floats) return;

  let i = 0;
  while (i < floats.length) {
    const record = Math.floor(floats[i]!);
    switch (record) {
      case 401: into.threshold = floats[i + 1]!; break;
      case 402: into.boost = floats[i + 1]!; break;
      case 403: into.throwBallMult = floats[i + 1]!; break;
      case 404:
        into.throwBallDirection = { x: floats[i + 1]!, y: floats[i + 2]!, z: floats[i + 3]! };
        i += 4;
        continue;
      case 405: into.throwBallAngleMult = floats[i + 1]!; break;
      case 406: into.hardHitSoundId = Math.floor(floats[i + 1]!); break;
      default: return;
    }
    i += 2;
  }
}

/** `loader::query_visual`, for state zero — the only state this port targets. */
export function readVisual(groups: readonly Group[], groupIndex: number): Visual {
  const visual = defaults();
  const group = groups[groupIndex];
  if (!group) return visual;

  const shorts = shortsOf(group);
  if (shorts) {
    let i = 0;
    while (i + 1 < shorts.length) {
      const record = shorts[i]!;
      const value = shorts[i + 1]!;
      switch (record) {
        case 100: break;
        case 300: {
          const material = groups[value];
          if (material) readMaterial(material, visual);
          break;
        }
        case 304: visual.softHitSoundId = value; break;
        case 400: {
          const kicker = groups[value];
          if (kicker) readKicker(kicker, visual.kicker);
          break;
        }
        case 406: visual.kicker.hardHitSoundId = value; break;
        // ⚠️ OR-ED, NOT ASSIGNED. Several can appear and each contributes one bit.
        case 602: visual.collisionGroup |= 1 << value; break;
        case 1100: visual.soundIndex4 = value; break;
        case 1101: visual.soundIndex3 = value; break;
        case 1500: i += 7; continue;
        default: i = shorts.length; continue;
      }
      i += 2;
    }
  }

  // ⚠️ ZERO COLLIDES WITH NOTHING. A component with no 602 record gets 1, not 0, or it would be
  // invisible to every ball on the table while looking perfectly well formed.
  if (!visual.collisionGroup) visual.collisionGroup = 1;
  return visual;
}

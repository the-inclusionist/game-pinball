// SPDX-License-Identifier: AGPL-3.0-or-later
// table/original-sinks — the four holes on the 1995 table that give the ball back.
//
// ⚠️ FOUR, AND ONLY THREE OF THEM ARE THE WORMHOLE. `v_sink1`, `v_sink2` and `v_sink3` are the three
// the teleport chooses between — `WormHoleControl` names two of them because the third is always its
// own caller. `v_sink7` is the escape chute, which no control's reference list mentions at all: it is
// the hole that holds a ball with a negative period, which never expires. Building three because three
// is the number the wormhole needs would leave the escape chute a plain wall.
//
// ========================= EVERY NUMBER A SINK HAS IS IN THE FILE =========================
// `TSink`'s constructor reads exactly three things: record 601 for where the ball reappears, record 407
// for how long the hole holds it, and the KICKER block for how it is thrown back out.
//
// ⚠️ AND TWO OF THE KICKER'S FIELDS ARE USED UNDER OTHER NAMES. `ThrowSpeedMult1` is the kicker's
// BOOST (record 402) and `ThrowSpeedMult2` is its THROW MULTIPLIER (403) divided by a hundred. Reading
// them by the names they carry — the throw multiplier into the first — would throw the ball at five
// hundredths of the speed it should have, and every hole would dribble instead of spitting. Nothing
// about that would look like a defect; the table would just feel dead.
//
// ⚠️ RECORD 601 CARRIES FOUR FLOATS AND ONLY TWO ARE READ. The original takes `[0]` and `[1]` and
// ignores the rest, exactly as `TPlunger` does with its own 601. Transcribed as written.

import { createSink, type Sink, type SinkTable } from './sink.js';
import { readVisual } from '../dat/visual.js';
import { floatAttribute } from '../dat/attributes.js';
import type { TimerService } from './bumper.js';
import type { SoundPlayer } from './collision-component.js';
import { ObjectType, type Table } from '../dat/loader.js';

/** `TSink::BallPosition` — where the swallowed ball comes back. */
const BALL_POSITION_RECORD = 601;
/** `TSink::TimerTime` — two seconds on every hole of the shipped table. */
const HOLD_TIME_RECORD = 407;
/** `ThrowSpeedMult2 = Kicker.ThrowBallMult * 0.01f`. The original's own literal. */
const THROW_MULT_SCALE = 0.01;

export interface OriginalSinkOptions {
  /** The table the hole belongs to: the drain it defers to on tilt, and the balls it counts and makes. */
  readonly table: SinkTable;
  readonly timer: TimerService;
  readonly sound?: SoundPlayer;
  /**
   * `control::handler(ControlCollision, this)` — the hole was fed. What that MEANS is the mission's
   * business: a sink does not schedule its own release, so nothing gives the ball back until a control
   * calls `scheduleRelease`. A hole built without one keeps the ball for the rest of the game.
   */
  readonly onSwallow?: (groupName: string) => void;
}

export function buildOriginalSinks(
  manifest: Table, o: OriginalSinkOptions,
): Map<string, Sink> {
  const sinks = new Map<string, Sink>();

  for (const object of manifest.tableObjects) {
    if (object.type !== ObjectType.Sink) continue;
    const group = manifest.groups[object.group];
    const name = group?.name;
    if (!group || !name) continue;

    const position = floatAttribute(group, BALL_POSITION_RECORD);
    const hold = floatAttribute(group, HOLD_TIME_RECORD);
    // A hole with no exit and no clock is not a hole this port has seen; skipped rather than built
    // holding a ball it could never place.
    if (!position || position.length < 2 || !hold?.length) continue;

    const visual = readVisual(manifest.groups, object.group);
    sinks.set(name, createSink({
      table: o.table,
      timer: o.timer,
      ballPosition: { x: position[0]!, y: position[1]! },
      throwDirection: { x: visual.kicker.throwBallDirection.x, y: visual.kicker.throwBallDirection.y },
      throwAngleMult: visual.kicker.throwBallAngleMult,
      throwSpeedMult1: visual.kicker.boost,
      throwSpeedMult2: visual.kicker.throwBallMult * THROW_MULT_SCALE,
      holdTime: hold[0]!,
      swallowSoundId: visual.soundIndex4,
      releaseSoundId: visual.soundIndex3,
      ...(o.sound ? { sound: o.sound } : {}),
      ...(o.onSwallow ? { onSwallow: () => o.onSwallow!(name) } : {}),
    }));
  }

  return sinks;
}

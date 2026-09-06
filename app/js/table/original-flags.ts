// SPDX-License-Identifier: AGPL-3.0-or-later
// table/original-flags — the two flag spinners of the 1995 table.
//
// ⚠️ TWO LINES ON ONE SEGMENT AND NEITHER IS THE WALL THE TABLE WOULD BUILD. `TFlagSpinner`'s
// constructor passes `createWall = false` and makes both itself: `TLine(start, end)` and then
// `TLine(end, start)`, the second kept as `PrevCollider`. Line collision is one-sided, so the pair
// answers one face each — and that is how the component knows which way the ball crossed.
//
// ⚠️ AND NEITHER IS OFFSET. Every ordinary wall is pushed out by the ball's radius so the ball can be
// treated as a point; these are not, because they are not a surface the ball meets — they are a line
// it goes through, like a lane's boundary.

import { createFlagSpinner, SPINNER_DEFAULTS, type FlagSpinner } from './flag-spinner.js';
import { createLine, type LineEdge } from '../physics/edges.js';
import { placeLineInGrid, type EdgeManager } from '../physics/grid.js';
import { readVisual } from '../dat/visual.js';
import { floatAttribute } from '../dat/attributes.js';
import type { SoundPlayer, TableState } from './collision-component.js';
import type { TimerService } from './bumper.js';
import type { Vector2 } from '../maths/maths.js';
import { ObjectType, type Table } from '../dat/loader.js';
import { WALL_RECORD } from './original.js';

const MAX_SPEED_RECORD = 1200;
const MIN_SPEED_RECORD = 1201;
const SPEED_DECREMENT_RECORD = 1202;
/** `floor(data[0]) - 1 === 1` is a line. A flag drawn as anything else is a file we have not seen. */
const WALL_LINE = 1;

/** The groups the wall loop must NOT install, because the spinner builds its own two lines. */
export function flagNames(manifest: Table): Set<string> {
  const names = new Set<string>();
  for (const object of manifest.tableObjects) {
    if (object.type !== ObjectType.Flag) continue;
    const name = manifest.groups[object.group]?.name;
    if (name) names.add(name);
  }
  return names;
}

export interface InstalledFlag extends FlagSpinner {
  /** The two lines, in the constructor's order. The SECOND is `PrevCollider`. */
  readonly lines: readonly LineEdge[];
  readonly minSpeed: number;
  readonly maxSpeed: number;
  readonly speedDecrement: number;
}

export interface OriginalFlagOptions {
  readonly table: TableState;
  readonly grid: EdgeManager;
  readonly timer: TimerService;
  readonly sound?: SoundPlayer;
  /** Every frame of the spin, by name — the control layer counts them. */
  readonly onSpin?: (groupName: string) => void;
  /** A whole turn, which is a different message. */
  readonly onLoopReset?: (groupName: string) => void;
  /** How many pictures the flag walks around. Read from the archive by the caller that has them. */
  readonly frameCountOf?: (groupName: string) => number | undefined;
  /**
   * ⚠️ WHICH PICTURE THE COMPONENT IS SHOWING. Every one of these has carried a `setSprite` hook since
   * it was ported and no builder forwarded it, so the state each component keeps — a target down, a
   * bumper lit, a barrier up — was invisible. `-1` means "draw nothing", which is what a popup target
   * does when it drops.
   */
  readonly onSprite?: (groupName: string, index: number) => void;
}

/** `TFlagSpinner`'s own eight pictures, when the caller does not say otherwise. */
const DEFAULT_FRAMES = 8;

export function buildOriginalFlags(
  manifest: Table, o: OriginalFlagOptions,
): Map<string, InstalledFlag> {
  const flags = new Map<string, InstalledFlag>();

  for (const object of manifest.tableObjects) {
    if (object.type !== ObjectType.Flag) continue;
    const group = manifest.groups[object.group];
    const name = group?.name;
    if (!group || !name) continue;

    const data = floatAttribute(group, WALL_RECORD);
    if (!data || data.length < 5 || Math.floor(data[0]!) - 1 !== WALL_LINE) continue;

    // `end` first and `start` second, as the constructor reads them.
    const end = { x: data[1]!, y: data[2]! };
    const start = { x: data[3]!, y: data[4]! };

    const visual = readVisual(manifest.groups, object.group);
    const component = { collision: (): void => {} } as {
      collision(ball: unknown, position: Vector2, direction: Vector2, distance: number, edge: unknown): void;
    };
    const line = (from: Vector2, to: Vector2): LineEdge =>
      createLine({ component, start: from, end: to, collisionGroup: visual.collisionGroup });

    const first = line(start, end);
    const previousCollider = line(end, start);

    const spinner = createFlagSpinner({
      table: o.table,
      timer: o.timer,
      frameCount: o.frameCountOf?.(name) ?? DEFAULT_FRAMES,
      minSpeed: floatAttribute(group, MIN_SPEED_RECORD)?.[0] ?? SPINNER_DEFAULTS.minSpeed,
      maxSpeed: floatAttribute(group, MAX_SPEED_RECORD)?.[0] ?? SPINNER_DEFAULTS.maxSpeed,
      speedDecrement:
        floatAttribute(group, SPEED_DECREMENT_RECORD)?.[0] ?? SPINNER_DEFAULTS.speedDecrement,
      previousCollider,
      softHitSoundId: visual.softHitSoundId,
      ...(o.sound ? { sound: o.sound } : {}),
      ...(o.onSpin ? { onSpin: () => o.onSpin!(name) } : {}),
      ...(o.onLoopReset ? { onLoopReset: () => o.onLoopReset!(name) } : {}),
      ...(o.onSprite ? { setSprite: (index: number) => o.onSprite!(name, index) } : {}),
    });

    component.collision = (ball, position, direction, distance, edge) =>
      spinner.collision(ball, position, direction, distance, edge);

    placeLineInGrid(o.grid, first);
    placeLineInGrid(o.grid, previousCollider);

    flags.set(name, Object.assign(spinner, {
      lines: [first, previousCollider],
      minSpeed: floatAttribute(group, MIN_SPEED_RECORD)?.[0] ?? SPINNER_DEFAULTS.minSpeed,
      maxSpeed: floatAttribute(group, MAX_SPEED_RECORD)?.[0] ?? SPINNER_DEFAULTS.maxSpeed,
      speedDecrement:
        floatAttribute(group, SPEED_DECREMENT_RECORD)?.[0] ?? SPINNER_DEFAULTS.speedDecrement,
    }));
  }

  return flags;
}

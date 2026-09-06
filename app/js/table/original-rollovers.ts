// SPDX-License-Identifier: AGPL-3.0-or-later
// table/original-rollovers — the eighteen lanes the ball rolls ACROSS, which the table had been
// building as walls it bounced OFF.
//
// ⚠️ A ROLLOVER IS TWO WALL RECORDS AND NEITHER IS THE ONE THE TABLE WOULD BUILD. `TRollover`'s
// constructor passes `createWall = false` and then calls `build_walls` itself, which installs record
// 600 against `ActiveFlag` — the entry boundary, live from the start — and record 603 against
// `RolloverFlag`, which starts CLEAR. So the way out of the lane does not exist until the ball has
// crossed the way in, and crossing the way out makes it vanish again. The whole "am I on the lane?"
// state is carried by which edges the collision search can see; nothing tests inside against outside.
//
// ⚠️ AND BOTH ARE INSTALLED WITH OFFSET ZERO. Every other wall in this table is pushed out by the
// ball's radius so the ball can be treated as a point; a lane boundary is not, because it is a line
// the ball's CENTRE crosses rather than a surface its skin meets. Offset it and the trip point moves
// half a ball early on the way in and half a ball late on the way out — a lane that scores before the
// ball is on it and holds the state after it has gone.
//
// ⚠️ AND THE SOUND IS THE SOFT-HIT ONE. `loader::play_sound(SoftHitSoundId, ...)` — record 304, the
// same field an ordinary wall uses for a graze. A rollover has no voice of its own.

import { createRollover, type Rollover } from './rollover.js';
import { installWall } from '../physics/wall.js';
import { placeCircleInGrid, placeLineInGrid, type EdgeManager } from '../physics/grid.js';
import type { CircleEdge, LineEdge } from '../physics/edges.js';
import { readVisual } from '../dat/visual.js';
import { floatAttribute } from '../dat/attributes.js';
import type { TimerService } from './bumper.js';
import type { SoundPlayer, TableState } from './collision-component.js';
import { ObjectType, type Table } from '../dat/loader.js';
import { WALL_RECORD } from './original.js';

/** `TRollover::build_walls`'s second attribute: the boundary that only exists from inside the lane. */
const EXIT_RECORD = 603;
/** ⚠️ NOT THE BALL'S RADIUS. See this module's header — a lane boundary is crossed by the centre. */
const ROLLOVER_OFFSET = 0;

type WallEdge = LineEdge | CircleEdge;

/** Both kinds of lane in the shipped file: seventeen ordinary and one green. */
const isRollover = (type: number): boolean =>
  type === ObjectType.Rollover || type === ObjectType.GreenRollover;

/** The groups the wall loop must NOT install, because the rollover installs its own two sets. */
export function rolloverNames(manifest: Table): Set<string> {
  const names = new Set<string>();
  for (const object of manifest.tableObjects) {
    if (!isRollover(object.type)) continue;
    const name = manifest.groups[object.group]?.name;
    if (name) names.add(name);
  }
  return names;
}

export interface OriginalRolloverOptions {
  readonly table: TableState;
  readonly grid: EdgeManager;
  readonly timer: TimerService;
  readonly sound?: SoundPlayer;
  /** Entering the lane. Leaving is silent and tells nobody — see `table/rollover`. */
  readonly onEnter?: (groupName: string) => void;
}

/**
 * A lane, plus the two sets of edges it is made of. Handed out because their IDENTITY is the mechanism:
 * the rollover switches `active` on the very objects the grid holds, and a copy would toggle nothing.
 */
export interface InstalledRollover extends Rollover {
  readonly entryEdges: readonly WallEdge[];
  readonly exitEdges: readonly WallEdge[];
}

function place(grid: EdgeManager, edges: readonly WallEdge[]): void {
  for (const edge of edges) {
    if (edge.kind === 'line') placeLineInGrid(grid, edge);
    else placeCircleInGrid(grid, edge);
  }
}

export function buildOriginalRollovers(
  manifest: Table, o: OriginalRolloverOptions,
): Map<string, InstalledRollover> {
  const rollovers = new Map<string, InstalledRollover>();

  for (const object of manifest.tableObjects) {
    if (!isRollover(object.type)) continue;
    const group = manifest.groups[object.group];
    const name = group?.name;
    if (!group || !name) continue;

    const entry = floatAttribute(group, WALL_RECORD);
    const exit = floatAttribute(group, EXIT_RECORD);
    // A lane with only one boundary is one the ball could enter and never leave; skipped rather than
    // built half-open.
    if (!entry?.length || !exit?.length) continue;

    const visual = readVisual(manifest.groups, object.group);
    // The component is filled in below: the rollover has to exist before anything can answer through
    // it, and the edges have to exist before the rollover can be given them.
    const component = { collision: (): void => {} } as {
      collision(ball: unknown, position: { x: number; y: number },
        direction: { x: number; y: number }, distance: number, edge: unknown): void;
    };

    const entryEdges = installWall([...entry], {
      component, offset: ROLLOVER_OFFSET, collisionGroup: visual.collisionGroup,
    });
    // Born INACTIVE: `RolloverFlag` starts clear, so the way out does not exist until the ball is in.
    //
    // ⚠️ AND A MUTATION THAT INSTALLS IT ACTIVE SURVIVES, because `createRollover` ends its
    // constructor with `reset()`, which clears the flag on these very edges. The flag is kept anyway:
    // it is what the original installs against, and it is what a caller building geometry WITHOUT a
    // rollover would need. Recorded as an equivalent mutant rather than chased with a test that would
    // have to reach between the two calls.
    const exitEdges = installWall([...exit], {
      component, offset: ROLLOVER_OFFSET, active: false, collisionGroup: visual.collisionGroup,
    });

    const rollover = createRollover({
      table: o.table,
      timer: o.timer,
      entryEdges,
      exitEdges,
      enterSoundId: visual.softHitSoundId,
      ...(o.sound ? { sound: o.sound } : {}),
      ...(o.onEnter ? { onEnter: () => o.onEnter!(name) } : {}),
    });

    component.collision = (ball, position, direction, distance, edge) =>
      rollover.collision(ball, position, direction, distance, edge);

    place(o.grid, entryEdges);
    place(o.grid, exitEdges);

    // ⚠️ THE ROLLOVER ITSELF, WITH TWO FIELDS ADDED — NOT A COPY OF IT. `inside` is a GETTER over the
    // live state, and spreading the object into a new one reads it once and freezes the answer: every
    // lane would then report itself permanently empty while the edges behind it toggled correctly.
    rollovers.set(name, Object.assign(rollover, { entryEdges, exitEdges }));
  }

  return rollovers;
}

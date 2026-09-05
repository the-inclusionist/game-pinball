// SPDX-License-Identifier: AGPL-3.0-or-later
// table/original-oneways — the nine gates the ball may cross in one direction.
//
// ⚠️ ONE WALL RECORD, TWO LINES, AND NEITHER IS THE ONE THE TABLE WOULD BUILD. A one-way is the same
// two points wound both ways: the BLOCKING line runs pt2 to pt1 and is offset outward by the ball's
// radius, the PASSING line runs pt1 to pt2 and is offset inward by four fifths of it. Line collision
// is one-sided, so each answers only a ball arriving from its own face.
//
// ⚠️ AND THE FOUR FIFTHS IS NOT DECORATION. The two lines are deliberately not coincident: the passing
// side sits nearer, so a ball arriving at a shallow angle meets the pass before it could reach the
// bounce. Offset them equally and a ball can clip the wrong line and be thrown back through a gate it
// had already crossed.
//
// Installed here rather than by `table/original`, which is told to skip these groups — building the
// plain wall as well would put a solid line across a gate the ball is supposed to go through.

import { createOneway, type Oneway } from './oneway.js';
import type { LineEdge } from '../physics/edges.js';
import { createCollisionComponent, type TableState } from './collision-component.js';
import { installWall } from '../physics/wall.js';
import { placeLineInGrid, type EdgeManager } from '../physics/grid.js';
import { readVisual } from '../dat/visual.js';
import { floatAttribute } from '../dat/attributes.js';
import { ObjectType, type Table } from '../dat/loader.js';
import { WALL_RECORD } from './original.js';

/**
 * A gate, plus the two lines it is made of. The edges are handed out because their IDENTITY is the
 * whole mechanism: the component tells the two faces apart by which object was hit, and the grid holds
 * these very objects. A copy would answer every question and collide with nothing.
 */
export interface InstalledOneway extends Oneway {
  readonly passingEdge: LineEdge;
  readonly blockingEdge: LineEdge;
}

/** How far in the passing line sits, as a fraction of the ball's radius. */
export const PASSING_OFFSET = 0.8;
/** `floor(data[0]) - 1 === 1` is a line. A one-way drawn as anything else is a file we have not seen. */
const WALL_LINE = 1;

export function onewayNames(manifest: Table): Set<string> {
  const names = new Set<string>();
  for (const object of manifest.tableObjects) {
    if (object.type !== ObjectType.OneWay) continue;
    const name = manifest.groups[object.group]?.name;
    if (name) names.add(name);
  }
  return names;
}

export interface OriginalOnewayOptions {
  readonly table: TableState;
  readonly grid: EdgeManager;
  readonly ballRadius: number;
  readonly sound?: { play(soundId: number, ball: unknown): void };
  /** Every crossing, by name. The controls and the missions count them. */
  readonly onPass?: (name: string) => void;
  /** A bounce off the blocked side, which is an ordinary wall hit. */
  readonly onBlocked?: (name: string) => void;
}

export function buildOriginalOneways(
  manifest: Table, o: OriginalOnewayOptions,
): Map<string, InstalledOneway> {
  const oneways = new Map<string, InstalledOneway>();

  for (const object of manifest.tableObjects) {
    if (object.type !== ObjectType.OneWay) continue;
    const group = manifest.groups[object.group];
    const name = group?.name;
    if (!group || !name) continue;

    const data = floatAttribute(group, WALL_RECORD);
    if (!data || data.length < 5 || Math.floor(data[0]!) - 1 !== WALL_LINE) continue;

    const visual = readVisual(manifest.groups, object.group);
    const bounce = createCollisionComponent({
      table: o.table,
      elasticity: visual.elasticity,
      smoothness: visual.smoothness,
      threshold: visual.kicker.threshold,
      boost: visual.kicker.boost,
      hardHitSoundId: visual.kicker.hardHitSoundId,
      softHitSoundId: visual.softHitSoundId,
      ...(o.sound ? { sound: o.sound as never } : {}),
    });

    // The passing line first, because the component is built around it.
    const [passingEdge] = installWall(
      [data[0]!, data[1]!, data[2]!, data[3]!, data[4]!],
      { component: { collision: () => {} }, offset: o.ballRadius * PASSING_OFFSET },
    );
    // And the blocking line on the SAME two points, wound the other way.
    const [blockingEdge] = installWall(
      [data[0]!, data[3]!, data[4]!, data[1]!, data[2]!],
      { component: { collision: () => {} }, offset: o.ballRadius },
    );
    if (passingEdge?.kind !== 'line' || blockingEdge?.kind !== 'line') continue;

    const oneway = createOneway({
      passingEdge,
      bounce,
      table: o.table,
      passSoundId: visual.soundIndex3,
      ...(o.sound ? { sound: o.sound } : {}),
      ...(o.onPass ? { onPass: () => o.onPass!(name) } : {}),
    });

    // Both edges answer through the component, which decides by EDGE IDENTITY which one was hit.
    const component = {
      collision(ball: unknown, position: { x: number; y: number },
        direction: { x: number; y: number }, distance: number, edge: unknown) {
        oneway.collision(ball, position, direction, distance, edge);
        if (edge !== passingEdge) o.onBlocked?.(name);
      },
    };
    passingEdge.component = component;
    blockingEdge.component = component;

    placeLineInGrid(o.grid, passingEdge);
    placeLineInGrid(o.grid, blockingEdge);

    oneways.set(name, { ...oneway, passingEdge, blockingEdge });
  }

  return oneways;
}

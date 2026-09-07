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

// ========================= ⚠️ THE LAUNCH LANE IS *NOT* A DEAD END, AND THIS FILE SAID IT WAS =========================
// Corrected 2026-09-07. What stood here was wrong, and it is left visible rather than deleted because
// the way it was wrong is the useful part.
//
// It said: "A launched ball runs the lane to y = -6.89 and comes back down... the corridor closes at
// roughly y = -7.7. The ball cannot get out of the top... So the ball is MEANT to come back down...
// Nothing here is broken." It argued the point with a real measurement — a 61% pull and a full hundred
// stop at exactly the same height, which is the signature of a geometric stop rather than an energy one
// — and that measurement was correct. The CONCLUSION drawn from it was not.
//
// ⚠️ THE DEV SAID SO, AND THE ARCHIVE'S OWN ARTWORK SETTLES IT: "O original não para no topo, a bola faz
// uma curva se dirigindo à esquerda." Rendered from `game_resources/PINBALL.DAT` and looked at, the top
// right of the 1995 playfield carries a CHANNEL — two parallel curved rails sweeping from the head of
// the plunger lane up and over to the left, with gates across it. The ball is meant to ride it. It is
// the most prominent object in that corner and it had never been looked at.
//
// ⚠️ SO THE BALL STOPPING IS A DEFECT IN THIS PORT, in how those groups are built, and the previous
// note diagnosed it as intent after a night of chasing it. The measurement was right, the reading of it
// was wrong, and "it stops in the same place whatever the power" is exactly as consistent with "we
// built a wall across the channel" as with "the design closes here".
//
// The lesson is the one `CLAUDE.md` already states in another form — "distrust the claim you write
// while writing the test" — and this is its cousin: a measurement that RULES OUT one explanation does
// not establish another. Two candidates fitted the evidence and only one was considered.
//
// ⚠️ AND THE TABLE IS A TRAPEZIUM, WHICH IS THE SAME FACT SEEN FROM OUTSIDE. Measured on the rendered
// playfield, both side walls lean 9.5° from vertical — dx/dy = 0.167, one pixel in six — and the ball's
// own climb drifts left at exactly that ratio. The lane leans because the table leans; that is why the
// ball moves left as it rises, and it is not the curve at the top.
//
// What is still owed: finding which of these groups closes the channel and why. This note is here so
// the next person starts from "it is broken" rather than from "it is by design".
//
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

    // ⚠️ THE BLOCKING LINE TAKES THE RECORD'S OWN ORDER, AND THE PASSING LINE REVERSES IT. `TOneway`'s
    // constructor names the FIRST pair `linePt2` and the SECOND `linePt1`, and then builds
    // `TLine(linePt2, linePt1)` — the file's order — as the wall, and `TLine(linePt1, linePt2)` as the
    // one the ball may cross. This port had the two the other way round, so every one-way on the table
    // blocked the side it should have opened.
    //
    // ⚠️ AND THE PASSING OFFSET IS NEGATIVE. `Offset(-CollisionCompOffset * 0.8f)`: the passing line is
    // pushed INWARD, to the ball's side of the wall, which is what puts it in front of the bounce. With
    // the sign lost it sits behind, and a ball arriving at the open face reaches the wall first.
    const [blockingEdge] = installWall(
      [data[0]!, data[1]!, data[2]!, data[3]!, data[4]!],
      { component: { collision: () => {} }, offset: o.ballRadius },
    );
    const [passingEdge] = installWall(
      [data[0]!, data[3]!, data[4]!, data[1]!, data[2]!],
      { component: { collision: () => {} }, offset: -o.ballRadius * PASSING_OFFSET },
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

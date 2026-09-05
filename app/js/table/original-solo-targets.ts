// SPDX-License-Identifier: AGPL-3.0-or-later
// table/original-solo-targets — the thirteen targets that duck and come straight back.
//
// ⚠️ THE SAME RULE AS THE BUMPER AND THE POPUP TARGET, FOR THE THIRD TIME. `TSoloTarget::Collision`
// bounces the ball and reports nothing unless the rebound beat the threshold — so a graze is a bounce
// and pays nothing. The table's wall wrapper reports every collision, so a solo target reached through
// it alone was paid for a ball rolling past.
//
// That matters here more than anywhere else: these thirteen are the fuel set, the mission set, the two
// hazard sets and the wormhole's destination. Every one of those counts hits towards something.
//
// ⚠️ AND THEY COME BACK BY THEMSELVES. A solo target is down for a tenth of a second and then stands
// again — no bank asks for it, unlike the nine yellow ones. The file tells the two kinds apart by
// colour: popup targets are yellow, solo targets are red.

import { createSoloTarget, type SoloTarget } from './solo-target.js';
import { readVisual } from '../dat/visual.js';
import { ObjectType, type Table } from '../dat/loader.js';
import type { OriginalTable } from './original.js';
import type { TimerService } from './bumper.js';
import type { TableState } from './collision-component.js';

export interface OriginalSoloOptions {
  readonly table: TableState;
  readonly timer: TimerService;
  readonly sound?: { play(soundId: number, source: unknown): void };
  /** `control::handler(ControlCollision, this)` — a HARD hit, which is the only kind that counts. */
  readonly onStruck?: (name: string) => void;
}

export function buildOriginalSoloTargets(
  manifest: Table, table: OriginalTable, o: OriginalSoloOptions,
): Map<string, SoloTarget> {
  const targets = new Map<string, SoloTarget>();

  for (const object of manifest.tableObjects) {
    if (object.type !== ObjectType.RedTarget) continue;
    const group = manifest.groups[object.group];
    const name = group?.name;
    if (!group || !name) continue;

    const edges = table.edgesOf(name);
    if (!edges.length) continue;

    const visual = readVisual(manifest.groups, object.group);
    targets.set(name, createSoloTarget({
      table: o.table,
      timer: o.timer,
      edges,
      elasticity: visual.elasticity,
      smoothness: visual.smoothness,
      threshold: visual.kicker.threshold,
      boost: visual.kicker.boost,
      hardHitSoundId: visual.kicker.hardHitSoundId,
      softHitSoundId: visual.softHitSoundId,
      ...(o.sound ? { sound: o.sound } : {}),
      ...(o.onStruck ? { onHit: () => o.onStruck!(name) } : {}),
    }));
  }

  return targets;
}

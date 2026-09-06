// SPDX-License-Identifier: AGPL-3.0-or-later
// table/original-popup-targets — the nine targets that drop when they are struck.
//
// ⚠️ A POPUP TARGET REPORTS ONLY A HARD HIT, AND DROPS ITSELF BEFORE IT REPORTS. `TPopupTarget::
// Collision` bounces the ball, and only if the rebound beat the threshold does it disable its own
// edges and call `control::handler`. So a graze is a bounce and nothing else — the same rule the
// bumper has, and the same one the wall wrapper cannot see.
//
// ⚠️ AND THE DROP IS WHY THE BANKS WORK AT ALL. Three targets have to be struck to fill a bank, and a
// target that stayed up could be struck three times by one bounce. The control's message field stops
// the SCORE from doubling; the drop is what stops the ball from touching it again in the first place.
//
// The object type is `YellowTarget`: the nine popup targets are yellow and the thirteen solo targets
// are red, which is the file's own way of telling them apart.

import { createPopupTarget, type PopupTarget } from './popup-target.js';
import { readVisual } from '../dat/visual.js';
import { floatAttribute } from '../dat/attributes.js';
import { ObjectType, type Table } from '../dat/loader.js';
import type { OriginalTable } from './original.js';
import type { TimerService } from './bumper.js';
import type { TableState } from './collision-component.js';

/** `TimerTime`: how long after being told to come back it actually rises. A quarter of a second. */
export const POPUP_DELAY_RECORD = 407;

export interface OriginalPopupOptions {
  readonly table: TableState;
  readonly timer: TimerService;
  readonly sound?: { play(soundId: number, source: unknown): void };
  /** `control::handler(ControlCollision, this)` — a HARD hit, which is the only kind that counts. */
  readonly onStruck?: (name: string) => void;
  /**
   * ⚠️ WHICH PICTURE THE COMPONENT IS SHOWING. Every one of these has carried a `setSprite` hook since
   * it was ported and no builder forwarded it, so the state each component keeps — a target down, a
   * bumper lit, a barrier up — was invisible. `-1` means "draw nothing", which is what a popup target
   * does when it drops.
   */
  readonly onSprite?: (groupName: string, index: number) => void;
}

export function buildOriginalPopupTargets(
  manifest: Table, table: OriginalTable, o: OriginalPopupOptions,
): Map<string, PopupTarget> {
  const targets = new Map<string, PopupTarget>();

  for (const object of manifest.tableObjects) {
    if (object.type !== ObjectType.YellowTarget) continue;
    const group = manifest.groups[object.group];
    const name = group?.name;
    if (!group || !name) continue;

    const edges = table.edgesOf(name);
    if (!edges.length) continue;

    const visual = readVisual(manifest.groups, object.group);
    targets.set(name, createPopupTarget({
      table: o.table,
      timer: o.timer,
      edges,
      elasticity: visual.elasticity,
      smoothness: visual.smoothness,
      threshold: visual.kicker.threshold,
      boost: visual.kicker.boost,
      popupDelay: floatAttribute(group, POPUP_DELAY_RECORD)?.[0] ?? 0.25,
      hardHitSoundId: visual.kicker.hardHitSoundId,
      ...(o.sound ? { sound: o.sound } : {}),
      ...(o.onStruck ? { onHit: () => o.onStruck!(name) } : {}),
      ...(o.onSprite ? { setSprite: (index: number) => o.onSprite!(name, index) } : {}),
    }));
  }

  return targets;
}

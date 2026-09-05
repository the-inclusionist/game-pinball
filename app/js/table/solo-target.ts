// SPDX-License-Identifier: AGPL-3.0-or-later
// table/solo-target — a target that drops when struck. Port of `TSoloTarget`.
//
// The simplest scoring part on the table, and it reuses two mechanisms already built rather than
// inventing anything: a HARD hit is `defaultCollision` returning true, and dropping is the gate's
// trick — clear the active flag and the collision search stops seeing the edges. A dropped target is
// not moved out of the way; it is the same geometry nobody looks at for a tenth of a second.
//
// The sprite is `1 - active`: frame 0 standing, frame 1 down. Two frames, and the state is the index.

import type { Vector2 } from '../maths/maths.js';
import type { Edge } from '../physics/grid.js';
import { createCollisionComponent, type SoundPlayer, type TableState } from './collision-component.js';
import type { TimerService } from './bumper.js';
import type { BallState } from '../physics/collision.js';

/** How long the target stays down. The original's literal 0.1. */
const DOWN_SECONDS = 0.1;

export interface SoloTargetOptions {
  readonly table: TableState;
  readonly timer: TimerService;
  readonly edges: readonly Edge[];
  readonly elasticity: number;
  readonly smoothness: number;
  readonly threshold: number;
  readonly boost: number;
  readonly hardHitSoundId?: number;
  readonly softHitSoundId?: number;
  readonly sound?: SoundPlayer;
  readonly setSprite?: (index: number) => void;
  readonly onHit?: () => void;
}

export interface SoloTarget {
  collision(ball: unknown, position: Vector2, direction: Vector2, distance: number, edge: unknown): void;
  reset(): void;
  readonly standing: boolean;
}

export function createSoloTarget(o: SoloTargetOptions): SoloTarget {
  let standing = true;
  let timerId = 0;

  const component = createCollisionComponent({
    table: o.table,
    elasticity: o.elasticity,
    smoothness: o.smoothness,
    threshold: o.threshold,
    boost: o.boost,
    hardHitSoundId: o.hardHitSoundId,
    softHitSoundId: o.softHitSoundId,
    sound: o.sound,
  });

  function setStanding(value: boolean): void {
    standing = value;
    for (const edge of o.edges) edge.active = value;
    o.setSprite?.(value ? 0 : 1);
  }

  const target: SoloTarget = {
    get standing() { return standing; },

    collision(ball, position, direction): void {
      // Only a HARD hit knocks it down. A graze bounces off a standing target and scores nothing.
      if (!component.defaultCollision(ball as BallState, position, direction)) return;

      setStanding(false);
      timerId = o.timer.set(DOWN_SECONDS, () => { setStanding(true); timerId = 0; });
      o.onHit?.();
    },

    reset(): void {
      if (timerId) o.timer.kill(timerId);
      timerId = 0;
      setStanding(true);
    },
  };

  target.reset();
  return target;
}

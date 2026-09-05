// SPDX-License-Identifier: AGPL-3.0-or-later
// table/popup-target — a target that drops and stays down. Port of `TPopupTarget`.
//
// ========================= WHAT SEPARATES IT FROM THE DROP TARGET =========================
// `TSoloTarget` and `TPopupTarget` look almost identical and differ in one thing that changes what they
// are for:
//
//   · the SOLO target knocks itself down and schedules its OWN return a tenth of a second later;
//   · the POPUP target knocks itself down and waits. It comes back only when something sends it
//     `TPopupTargetEnable`, and that something is the mission logic.
//
// So a solo target is scenery that reacts, and a popup target is STATE the game owns. A row of popup
// targets stays down until the mission says the row is finished — which is exactly what a row of
// targets is for, and would be impossible if it raised itself.
//
// ========================= THE SAME FUNCTION RAISES IT, TWO WAYS =========================
// `TimerExpired` plays the sound only `if (timerId)`. The original calls it directly with a zero id
// from Reset, so raising it by reset is SILENT while raising it by timer announces itself. One
// function, and the argument is what says which occasion this is.

import { basicCollision, type BallState } from '../physics/collision.js';
import { NO_COLLISION, type Vector2 } from '../maths/maths.js';
import type { Edge } from '../physics/grid.js';
import type { SoundPlayer, TableState } from './collision-component.js';
import type { TimerService } from './bumper.js';

export interface PopupTargetOptions {
  readonly table: TableState;
  readonly timer: TimerService;
  readonly edges: readonly Edge[];
  readonly elasticity: number;
  readonly smoothness: number;
  readonly threshold: number;
  readonly boost: number;
  /** How long after being told to come back it actually rises. `TimerTime` in the original. */
  readonly popupDelay: number;
  readonly hardHitSoundId?: number;
  readonly popupSoundId?: number;
  readonly sound?: SoundPlayer;
  readonly setSprite?: (index: number) => void;
  readonly onHit?: () => void;
}

export interface PopupTarget {
  collision(ball: unknown, position: Vector2, direction: Vector2, distance: number, edge: unknown): void;
  /** `TPopupTargetEnable`: the mission logic asking for it back. It rises after the delay, with sound. */
  popUp(): void;
  /** Raises it at once and SILENTLY. */
  reset(): void;
  readonly standing: boolean;
}

export function createPopupTarget(o: PopupTargetOptions): PopupTarget {
  let standing = true;
  let timerId = 0;

  function setStanding(value: boolean): void {
    standing = value;
    for (const edge of o.edges) edge.active = value;
    o.setSprite?.(value ? 0 : -1);
  }

  const target: PopupTarget = {
    get standing() { return standing; },

    collision(ball, position, direction): void {
      const b = ball as BallState;

      if (o.table.tiltLocked) {
        basicCollision(b, position, direction,
          { elasticity: o.elasticity, smoothness: o.smoothness, threshold: NO_COLLISION, boost: 0 });
        return;
      }

      const reboundSpeed = basicCollision(b, position, direction,
        { elasticity: o.elasticity, smoothness: o.smoothness, threshold: o.threshold, boost: o.boost });

      if (reboundSpeed <= o.threshold) return;

      if (o.hardHitSoundId !== undefined) o.sound?.play(o.hardHitSoundId, ball);
      setStanding(false);
      o.onHit?.();
    },

    popUp(): void {
      timerId = o.timer.set(o.popupDelay, () => {
        timerId = 0;
        setStanding(true);
        if (o.popupSoundId !== undefined) o.sound?.play(o.popupSoundId, target);
      });
    },

    reset(): void {
      if (timerId) o.timer.kill(timerId);
      timerId = 0;
      setStanding(true); // silent — see this module's header
    },
  };

  target.reset();
  return target;
}

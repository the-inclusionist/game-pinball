// SPDX-License-Identifier: AGPL-3.0-or-later
// table/gate — a gate that opens and shuts. Port of `TGate`.
//
// THE GATE DOES NOT MOVE. It has no `Collision` override at all: opening it simply clears the active
// flag on its edges, and the grid skips inactive edges when it searches. A shut gate is a wall; an open
// gate is the same wall the collision search no longer looks at.
//
// That is why `active` is a flag on the edge rather than a property of the shape: every component that
// appears and disappears — gates, blockers, the ramps that only exist during a mission — is the same
// geometry switched off, and nothing is ever rebuilt mid-game.

import type { Edge } from '../physics/grid.js';

export interface GateOptions {
  readonly edges: readonly Edge[];
  /** Sound when the gate is opened by a message (not on reset). */
  readonly openSoundId?: number;
  readonly shutSoundId?: number;
  readonly sound?: { play(soundId: number, source: unknown): void };
  /** Shows or hides the gate's sprite. -1 is the original's "no sprite". */
  readonly setSprite?: (index: number) => void;
}

export interface Gate {
  readonly open: boolean;
  /** Opens the gate: the edges stop being tested. */
  openGate(): void;
  /** Shuts the gate: the edges collide again. */
  shutGate(): void;
  /** Back to shut, and SILENT — the original plays no sound on reset. */
  reset(): void;
}

export function createGate(o: GateOptions): Gate {
  let open = false;

  const setActive = (active: boolean): void => {
    for (const edge of o.edges) edge.active = active;
  };

  const gate: Gate = {
    get open() { return open; },

    openGate(): void {
      open = true;
      setActive(false);
      o.setSprite?.(-1);
      if (o.shutSoundId !== undefined) o.sound?.play(o.shutSoundId, gate);
    },

    shutGate(): void {
      open = false;
      setActive(true);
      o.setSprite?.(0);
      if (o.openSoundId !== undefined) o.sound?.play(o.openSoundId, gate);
    },

    reset(): void {
      // The original folds Reset and Enable into one branch but only plays the sound for Enable. A
      // reset that announced itself would fire every gate's sound at the start of every ball.
      open = false;
      setActive(true);
      o.setSprite?.(0);
    },
  };

  return gate;
}

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
import { playSoundId, type SoundSink } from './sound-id.js';

export interface GateOptions {
  readonly edges: readonly Edge[];
  /**
   * ⚠️ `SoundIndex3`, RECORD 1101, played when the gate OPENS — which the original writes as
   * `TGateDisable`, because opening a gate is disabling a wall. The two are easy to cross, and a
   * crossed pair is audible and attributable to nothing.
   */
  readonly openSoundId?: number;
  /** `SoundIndex4`, record 1100, played by `TGateEnable` — the wall coming back. */
  readonly shutSoundId?: number;
  readonly sound?: SoundSink;
  /** Shows or hides the gate's sprite. -1 is the original's "no sprite". */
  readonly setSprite?: (index: number) => void;
}

/** The three messages a gate answers, by the original's own names. */
export type GateMessage = 'TGateDisable' | 'TGateEnable' | 'Reset';

export interface Gate {
  readonly open: boolean;
  /**
   * ⚠️ `TGate::Message` ENDS WITH `control::handler(code, this)`, FOR EVERY MESSAGE. The gate's own
   * control function is how the table learns the chute is open — `LeftKickerGateControl` lights the
   * two lamps that are the only place a player is told an outlane is currently survivable.
   *
   * A field rather than an option because a gate is built from the table's geometry and its control
   * is bound later, by the dispatcher. `ControlledComponent.control` is the same shape for the same
   * reason.
   */
  control: ((code: GateMessage) => void) | null;
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
    control: null,

    openGate(): void {
      open = true;
      setActive(false);
      o.setSprite?.(-1);
      playSoundId(o.sound, o.openSoundId, gate);
      gate.control?.('TGateDisable');
    },

    shutGate(): void {
      open = false;
      setActive(true);
      o.setSprite?.(0);
      playSoundId(o.sound, o.shutSoundId, gate);
      gate.control?.('TGateEnable');
    },

    reset(): void {
      // The original folds Reset and Enable into one branch but only plays the sound for Enable. A
      // reset that announced itself would fire every gate's sound at the start of every ball.
      open = false;
      setActive(true);
      o.setSprite?.(0);
      // Reset reaches the control too, silently. The original folds Reset and Enable into one branch
      // and calls the handler for both; only the sound is conditional.
      gate.control?.('Reset');
    },
  };

  return gate;
}

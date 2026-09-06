// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/pad — the cabinet on a gamepad.
//
// ========================= THE ENGINE ALREADY DOES THE HARD PART =========================
// ⚠️ THE DEV ASKED WHETHER THE ENGINE PROVIDES THIS. It does, and the pinball was using none of it.
// `input/gamepad` ships a binding wizard, analog-axis and hat/POV thresholds, `localStorage`
// persistence and `padActions(pad, customMap)`, which turns a raw pad into the engine's action
// vocabulary. `shell/controls` read `event.code` off a keyboard and nothing else, so a controller did
// nothing at all — a capability declared by the platform and never connected, which is the shape of
// half the defects this port has found.
//
// So this module is deliberately thin. It contributes the ONE thing the engine cannot know: which of
// its actions are this game's cabinet. Every reason an analog stick counts as "left" past one
// threshold and not another stays where it was written.
//
// ========================= THE VOCABULARY IS PLATFORMER-SHAPED =========================
// `jump`, `run`, `swap`, `especial` — there is no "left shoulder" among them. That is a constraint and
// not a complaint: on a pad the flippers are driven by the DIRECTIONS, which is exactly how the Dev
// specified the cabinet ("esquerda - move pá da esquerda"), with two face buttons as the alternates
// that buttons 2 and 3 are.
//
//     esquerda → left  or  especial (B)        botão 1 → jump (A)
//     direita  → right or  swap     (Y)        start   → _pause (Start)

import { padActions, type PadActions, type PadLike, type PadMap } from '@the-inclusionist/engine/input/gamepad.js';

export interface CabinetState {
  readonly left: boolean;
  readonly right: boolean;
  readonly launch: boolean;
  readonly pause: boolean;
}

/** The engine's actions, read as this game's controls. Pure, so the mapping is checkable on its own. */
export function cabinetFromPad(actions: PadActions): CabinetState {
  return {
    left: actions.left || actions.especial,
    right: actions.right || actions.swap,
    launch: actions.jump,
    pause: actions._pause === true,
  };
}

export interface PadReaderEvents {
  setFlipper(side: 'left' | 'right', extended: boolean): void;
  launch(): void;
  togglePause(): void;
}

export interface PadReaderOptions {
  /** `navigator.getGamepads` — injected, so a test can supply a pad without a browser. */
  readonly getGamepads: () => readonly (PadLike | null | undefined)[] | null | undefined;
  /** A saved binding for this pad model, when the engine's wizard has captured one. */
  readonly padMapFor?: (id: string) => PadMap | null;
  readonly on: PadReaderEvents;
}

export interface PadReader {
  /** Reads every connected pad once. Call it per frame. */
  poll(): void;
}

export function createPadReader(o: PadReaderOptions): PadReader {
  let was: CabinetState = { left: false, right: false, launch: false, pause: false };

  return {
    poll() {
      const pads = o.getGamepads?.() ?? [];
      // The first pad that is actually there. A disconnected slot is `null`, and browsers keep the
      // slots rather than compacting them.
      const pad = [...pads].find((p): p is PadLike => !!p && Array.isArray(p.buttons));
      const now = pad
        ? cabinetFromPad(padActions(pad, o.padMapFor?.(pad.id) ?? null))
        : { left: false, right: false, launch: false, pause: false };

      /**
       * ⚠️ A FLIPPER IS A STATE AND A LAUNCH IS AN EDGE, and the pad is polled sixty times a second.
       *
       * Reporting the flipper on every frame it is held would call `setFlipper` sixty times — and
       * `setFlipperMotion` on an already-extended flipper leaves it STILL, which is the defect
       * `shell/controls` documents for held keys arriving by a different road. Reporting the launch on
       * every frame would relaunch a ball already in play, or refuse in a loop.
       */
      if (now.left !== was.left) o.on.setFlipper('left', now.left);
      if (now.right !== was.right) o.on.setFlipper('right', now.right);
      if (now.launch && !was.launch) o.on.launch();
      if (now.pause && !was.pause) o.on.togglePause();

      was = now;
    },
  };
}

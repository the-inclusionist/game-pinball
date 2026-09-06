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
// ========================= AND THE DEV'S SCHEME IS THE ENGINE'S OWN DEFAULT =========================
// ⚠️ THIS WAS DISCOVERED, NOT DESIGNED, and it decides the mapping. The Dev specified the cabinet and
// then its keys: a, d, u, j, k. `input/keyboard`'s SOLO DEFAULT is:
//
//     left: KeyA, ArrowLeft    run: KeyU     jump: KeyJ, Space    especial: KeyK
//     right: KeyD, ArrowRight
//
// Action for action, those are the same five. So the cabinet is not being bolted onto a foreign
// vocabulary — it already IS one, and the correspondence is exact:
//
//     esquerda → left       botão 1 (launch)       → run
//     direita  → right      botão 2 (left flipper) → jump
//                           botão 3 (right flipper)→ especial
//                           start                  → _pause  (pad only; see below)
//
// ⚠️ AND THE FIRST VERSION OF THIS FILE GUESSED WRONG. It mapped `jump` to the launch because `jump`
// is the A button and launching felt like the primary action. That put button 1 and button 2 on each
// other's slots, so a player remapping the keyboard through the engine's settings panel would have
// found the pad disagreeing with it. The mapping is one table now, used by both.
//
// ⚠️ `start` WAS NOT IN THE ENGINE'S KEYBOARD VOCABULARY — its `KeyScheme` was left/right/up/down/run/
// jump/swap/especial, with no start — so pause was a binding of this port's own on the keyboard while
// the pad read the engine's `_pause`. That asymmetry is closing; see below.
//
// ========================= AND THE VOCABULARY IS BEING REPLACED UNDER THIS GAME =========================
// ⚠️ THE DEV SAID SO WHILE THE MIGRATION IS STILL AHEAD OF THE ENGINE. ADR-0085 replaces the nine
// platformer actions with FOURTEEN positions, and ADR-0086 names the last four for the hand:
//
//     up · down · left · right
//     action1 · action2 · action3 · action4
//     leftShoulder · leftTrigger · rightShoulder · rightTrigger
//     start · select
//
// The Dev's table gives each one a key and a button: action1 U/X(b2), action2 J/A(b0), action3 K/B(b1),
// action4 I/Y(b3), the shoulders and triggers on 7/Y/8/O and b4–b7, start on H or Enter and b9, select
// on F and b8. It is `input/default-bindings.ts` in the engine, verbatim.
//
// ⚠️ AND NOTHING SPEAKS THEM YET, which both records state in their own consequences: "nothing in the
// running game changes: no transport reads `core/actions.ts`". `input/gamepad.js` still returns
// `jump`/`run`/`especial`/`_pause`; the migration is the engine's issue #103.
//
// So the table below holds BOTH vocabularies, which costs nothing — `cabinetFromPad` asks whether ANY
// action bound to a control is pressed, so a name nobody emits contributes `false` for ever. What it
// buys is that the day #103 lands, this cabinet keeps working instead of going silent. Going silent is
// precisely what it did before this module existed, for precisely this reason.
//
// ⚠️ THE CORRESPONDENCE IS EXACT, AND ADR-0086 §2 IS WHY. The corrected platformer preset is
// action1→run, action2→jump, action3→especial — so the pinball's three buttons are the same three
// physical buttons under either name, and the launch stays on U and X. Nothing a player has learnt
// moves. That is the zero-movement measurement ADR-0086 makes for the platformer, holding here too.
//
// ⚠️ ONE THING THAT DOES MOVE, and it is ADR-0086's own asterisk: `padActions` reads
// `run: b(2) || b(5) || b(7)`, so R1 and R2 launch the ball today and will stop when they become
// `rightShoulder` and `rightTrigger`. That is the engine's line to change and #103's to resolve; this
// game reads the transport rather than second-guessing it, and the loss is named here so it is not
// discovered as a regression.

import { padActions, type PadActions, type PadLike, type PadMap } from '@the-inclusionist/engine/input/gamepad.js';

export interface CabinetState {
  readonly left: boolean;
  readonly right: boolean;
  readonly launch: boolean;
  readonly pause: boolean;
}

/**
 * Which pinball control each of the engine's actions is.
 *
 * ⚠️ ONE TABLE, READ BY BOTH DEVICES. The keyboard reaches it through the engine's remapper
 * (`KeyboardRuntime.actionOf`) and the pad through `padActions`; two copies of "button 1 is the
 * launch" is how a game ends up remapping on one device and not the other.
 */
export const CABINET_OF_ENGINE_ACTION: Readonly<Record<string, 'left' | 'right' | 'plunger' | 'pause'>> = {
  left: 'left',
  right: 'right',

  // ---- The platformer's nine, which is what every transport emits TODAY ----
  // Button 2 and button 3 are the flippers again, which is what the Dev's cabinet says they are.
  jump: 'left',
  especial: 'right',
  // Button 1.
  run: 'plunger',

  // ---- The fourteen positions the engine is moving to. See this module's header ----
  action1: 'plunger',
  action2: 'left',
  action3: 'right',
  /**
   * ⚠️ AND `start` IS AN ACTION NOW, WHICH IT WAS NOT. This module's header used to record that pause
   * was a binding of this port's own on the keyboard because "`start` is not in the engine's keyboard
   * vocabulary" — its `KeyScheme` had no slot for it. ADR-0085 gives it one, and ADR-0086's default
   * puts it on `Enter`, which is the key this cabinet already pauses with. The asymmetry closes.
   */
  start: 'pause',
  // ⚠️ `action4` IS DELIBERATELY ABSENT. The Dev's table has a fourth button (`I` / Y) and a pinball
  // has three. Binding it to something because it is there is how a cabinet grows a control nobody
  // asked for, and a test says so rather than leaving the gap to be read as an omission.
};

/** The engine's actions, read as this game's controls. Pure, so the mapping is checkable on its own. */
export function cabinetFromPad(actions: PadActions): CabinetState {
  const is = (name: string): boolean => actions[name] === true;
  const controls = (control: string): boolean =>
    Object.entries(CABINET_OF_ENGINE_ACTION).some(([action, c]) => c === control && is(action));

  return {
    left: controls('left'),
    right: controls('right'),
    launch: controls('plunger'),
    // ⚠️ TWO ROADS TO ONE CONTROL, AND ONLY ONE OF THEM IS AN ACTION. `_pause` is the engine's
    // private field — a pad's Menu button, read by `padActions` itself — and `start` is the ACTION
    // that ADR-0085 gives the same button once the transports speak the fourteen. The table above
    // carries the action, this line carries the field, and a pad works either way round.
    pause: controls('pause') || actions._pause === true,
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

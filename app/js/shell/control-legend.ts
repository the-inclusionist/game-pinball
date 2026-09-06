// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/control-legend — what the keys are, in a form a screen can show.
//
// ========================= WHY IT EXISTS =========================
// ⚠️ NOTHING IN THIS GAME EVER SAID WHAT THE CONTROLS WERE. The cabinet is the one the Dev specified —
// a direction each way, three buttons and a start — it is bound, tested, and driven by a gamepad as
// well as a keyboard, and a player opening the page was told none of it. They press the arrow keys,
// which this cabinet does not use, and reach the conclusion the Dev reached twice from the other side
// of the same silence: "teclado e mouse continuam não funcionando no jogo."
//
// The keys were in `docs/README` the whole time. A player is not reading the README.
//
// ⚠️ AND THE ACCESSIBILITY KEYS ARE THE HALF THAT MATTERS MOST. `shell/controls` argues for binding
// blind mode to a key at all on the grounds that "a player who needs blind mode is not the player who
// is going to find it in a settings panel" — and B, S and C were then left exactly as findable as if
// they were in one. They are on this list first-class, not in a footnote.
//
// ========================= DERIVED, NEVER TYPED =========================
// The README's ledger of these keys is kept honest by a bidirectional gate, because a list of controls
// that is merely written out is right on the day it is written and wrong afterwards. This is read out
// of `DEFAULT_BINDINGS` for the same reason: rebinding a key changes the screen with nobody
// remembering to, and an action added to the cabinet fails a test until it has a line here.
//
// ========================= THE LABEL IS A KEY, NOT A WORD =========================
// Same rule the engine's `ACT_LABEL` states for itself: a module-level constant is evaluated once at
// import, so text captured here would freeze the language at boot. The caller resolves with `t()`.
//
// ⚠️ AND THE ENGINE'S OWN CONTROLS PANEL IS NOT AN ALTERNATIVE TO THIS. `ui/settings-controls` exports
// a mutable `ACT_LABEL` and relabelling it was the plan — "launch" where a platformer says "jump". The
// panel is never mounted for a consumer: nothing in the engine package calls `initSettingsControls`,
// which the tracer's own application does. Relabelling it would have decorated a screen this game does
// not have, which is the same mistake as a capability that is never connected, pointing the other way.

import { DEFAULT_BINDINGS, type PinballAction } from './controls.js';

/**
 * The reading order, which is the PLAYER'S rather than the object's.
 *
 * Flippers first because that is what a hand reaches for; the plunger next because a ball has to be
 * launched before any of it matters; pause after those. The three accessibility keys come last — they
 * are read once and then remembered, where the flippers are looked up in a hurry.
 *
 * ⚠️ IT IS NOT `Object.keys(DEFAULT_BINDINGS)`. That would be the order the bindings happen to be
 * written in, which is a fact about a source file and not about anybody's hands. A test pins that this
 * list and that object hold the same actions, so the two cannot drift apart.
 */
export const LEGEND_ORDER: readonly PinballAction[] = [
  'left', 'right', 'plunger', 'pause', 'blindMode', 'sweep', 'palette',
];

export interface LegendRow {
  readonly action: PinballAction;
  /** An i18n KEY. See this module's header for why it is not the text. */
  readonly labelKey: string;
  /** Every key bound to the action, in a form somebody can read off a keyboard. */
  readonly keys: readonly string[];
}

/**
 * A physical key code as it is printed on the key.
 *
 * `KeyA` is A; `Enter` is already the word on the key. The prefixes are what `KeyboardEvent.code`
 * carries and what nobody's keyboard is labelled with — a legend reading "KeyA" teaches a player that
 * the game is broken before they have pressed anything.
 *
 * Deliberately not the engine's `keyName`: that one lives behind `ui/settings-controls`, which this
 * game does not mount, and it turns the arrows into a single `↔` glyph — right for a panel listing one
 * row per direction, wrong for a cabinet where left and right are two different flippers.
 */
export function keyLabel(code: string): string {
  return code.replace(/^(Key|Digit)/, '').replace(/^Arrow/, '');
}

/**
 * The legend, in reading order.
 *
 * @param bindings the cabinet to describe. Defaults to the shipped one; taking it as a parameter is
 * what lets a test prove the keys are READ rather than written — hand it a left flipper on Q and the
 * legend says Q.
 */
export function controlLegend(
  bindings: Readonly<Record<PinballAction, readonly string[]>> = DEFAULT_BINDINGS,
): readonly LegendRow[] {
  return LEGEND_ORDER.map((action) => ({
    action,
    labelKey: `pinball.controls.${action}`,
    keys: (bindings[action] ?? []).map(keyLabel),
  }));
}

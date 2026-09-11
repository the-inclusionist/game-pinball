// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/overlay-visibility — a screen is shown or shut in ONE place, because it takes TWO properties.
//
// ========================= THE ENGINE READS A PROPERTY THIS GAME WAS NOT SETTING =========================
// ⚠️ EVERY SCREEN THIS GAME DRAWS CARRIES `class="overlay"` AND LIVES IN `#game-region`, which is exactly
// the scope the engine scans: `ui/settings-panel.topVisibleOverlay` collects `#game-region .overlay` and
// keeps what is NOT `hidden`. Four of this game's five screens hid themselves with `display` alone.
//
// 📏 MEASURED 2026-09-11, in both engines, on the TITLE SCREEN with nothing open: the engine answered
// `#pinball-high-score`. The pause menu and the remap dialog were in the same state behind it. So for the
// whole life of this port the engine believed a menu was open — at the title, in the table list, and with
// a ball in play.
//
// ========================= AND THAT IS THE WOUND THE `isNavigable` FALSE WAS BANDAGING =========================
// ⚠️ `ui/menu-nav` REACHES `sharedDialogOpen()`, CONSUMES THE KEY, AND NAVIGATES WHATEVER IT GOT. With a
// `display:none` element it gets a menu whose `menuItems()` is empty — enabled AND visible is the filter —
// so the key is eaten and nothing moves. That is the measured symptom recorded in
// `tests/pause-menu-cabinet`: "the engine consumed Enter, A, D, J, K and H before they reached anything at
// all". The predicate was set to `false` to stop the bleeding, and the bleeding was this.
//
// ========================= WHY A MODULE FOR TWO LINES =========================
// `shell/choice-dialog` already had it right and had written down why — "an inline `display` beats
// `[hidden]`… so the two are kept in step in `open` and `close`". That knowledge sat in one file while
// three others got it wrong, which is this repository's most expensive shape: one rule, several copies,
// one of them checked. Now there is one home, and `tests/engine-sees-our-screens` is the ledger over all
// five screens rather than a sample of one.

/** How a screen of this game lays itself out when it is up. All five are centred cards. */
const SHOWN = 'flex';

/**
 * Shows or shuts an overlay, in the two properties it takes.
 *
 * ⚠️ BOTH, ALWAYS, AND NEITHER ONE ALONE WORKS. `hidden` is `display: none` from the user-agent
 * stylesheet, and an inline `display: flex` overrides it outright — so `hidden` by itself leaves the
 * screen on top of the game. And `display` by itself leaves the ENGINE believing it is open, which is
 * this module's whole reason for existing.
 */
export function setOverlayVisible(root: HTMLElement, visible: boolean): void {
  root.hidden = !visible;
  root.style.display = visible ? SHOWN : 'none';
}

/**
 * Is this overlay up?
 *
 * ⚠️ IT ASKS `hidden`, WHICH IS THE PROPERTY THE ENGINE ASKS. Reading `style.display` instead — which is
 * what three of these screens did — is a second answer to one question, and two answers to one question
 * is how they came apart in the first place.
 */
export function isOverlayVisible(root: HTMLElement): boolean {
  return !root.hidden;
}

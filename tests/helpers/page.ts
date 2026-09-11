// SPDX-License-Identifier: AGPL-3.0-or-later
// tests/helpers/page — the host markup, written ONCE.
//
// ========================= IT WAS COPIED INTO TWELVE FILES =========================
// ⚠️ EVERY BROWSER SUITE CARRIED ITS OWN COPY, each under the same comment: "the page's own markup, as
// `app/index.html` writes it". They were identical, which is exactly what made the duplication invisible
// — and then engine 8 added one element to the page and TWELVE FIXTURES WENT STALE AT ONCE. Every browser
// suite failed at import, in both engines, because the one thing they all claimed to mirror had moved.
//
// A fixture that claims to be a copy of a file is a claim nothing checks. `tests/shell-boot` now checks
// it: every selector in `REQUIRED_MARKUP` has to appear in `app/index.html` AND in this string.
//
// ⚠️ AND `#title-icons` IS THE ONE THE ENGINE WRITES INTO. `createGame` mounts the first screen's
// accessibility bar there — blind mode, the screen reader, Libras, the autism adjustments, latching.
// Leaving it out of a fixture does not fail quietly: the game refuses to boot without the strip,
// because a strip that arrives late is one the engine has already reported missing.

/**
 * The strip alone, for the two suites whose markup differs ON PURPOSE — `page-chrome` puts text in the
 * live region and `screens-fit` sizes the game region to the smallest scale the game is shown at.
 */
export const TOPBAR_MARKUP = `
    <header class="pinball-topbar">
      <div id="title-icons"></div>
    </header>`;

/** The body of `app/index.html`, as a browser suite has to reproduce it to boot the real entry point. */
export const PAGE_MARKUP = `${TOPBAR_MARKUP}
    <main id="game-region" tabindex="-1"></main>
    <div id="sr-status" role="status" aria-live="polite"></div>
    <div id="sr-alert" role="alert" aria-live="assertive"></div>
    <svg id="cvd-filters" width="0" height="0" aria-hidden="true" focusable="false"></svg>
  `;

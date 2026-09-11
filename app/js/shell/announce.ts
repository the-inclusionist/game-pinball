// SPDX-License-Identifier: AGPL-3.0-or-later
// shell/announce — one place the game says something, and two channels it says it on.
//
// ========================= IT WAS EIGHT `textContent =` AND ONE CHANNEL =========================
// ⚠️ WRITING A LIVE REGION REACHES A CHILD WHO ALREADY HAS A SCREEN READER RUNNING, AND NOBODY ELSE. On a
// school machine with nothing installed it is silence. Since engine 8 the 🗨️ button is on screen, in the
// bar the engine mounts, and it did nothing for a single sentence this game wrote — because
// `engine.tts.narrate`, which speaks through the engine's own mixer with no assistive technology at all,
// had never been called from here.
//
// ⚠️ AND THE DIRECT WRITE SKIPPED THE RE-ANNOUNCE, which is the quieter of the two defects.
// `core/a11y-sr` clears the region, waits a frame, then writes — "o padrão limpar→requestAnimationFrame→
// escrever força o leitor a reanunciar mesmo texto repetido". Assigning a string that is already there
// changes no DOM, so a reader says it once: two identical comet reports in a row were announced once, and
// the second was the one that said the mission had not moved.
//
// ========================= BOTH CHANNELS FIRE, AND THAT IS NOT DOUBLE-SPEAKING =========================
// 📏 MEASURED IN THE ENGINE BEFORE THIS WAS WRITTEN: `narrate` never touches the live region, and `srSay`
// never speaks. They cannot collide by construction, and the engine's own sonar calls both on one line.
//
// ⚠️ THE ONE CASE WHERE A SENTENCE IS HEARD TWICE is a screen reader running AND 🗨️ pressed by hand.
// Screen-reader presence is undetectable in a browser and every scheme that claims otherwise is wrong
// about somebody; `platform/audio-mixer` puts `tts` among the categories BORN OFF, so the voice is silent
// until a child turns it on — with the same icon that turns it off again. That is a child's choice to
// make and unmake, which is the whole reason not to guess on their behalf.
//
// ========================= WHAT DOES NOT COME THROUGH HERE =========================
// ⚠️ ONLY EVENTS. The HUD blocks are deliberately not live — `shell/hud-dom` records the split: a score is
// readable on request and an event is announced. A third caller that is really a status read would turn
// every frame of a pinball into speech.
//
// 📌 AND THE THREE FUNCTIONS ARRIVE BY INJECTION, which is what lets this be tested in the `node` project
// where there is no document and no audio. It is also the shape `ADR-0139`'s `ctx` wants: a cartridge is
// handed what it may use rather than reaching for it.

/** The three ways a sentence can reach a child. Supplied by the shell; see this module's header. */
export interface AnnounceChannels {
  /** `core/a11y-sr.srSay` — the polite live region, plus Libras. */
  readonly srSay: (words: string) => void;
  /** `core/a11y-sr.srAlert` — the assertive one, which interrupts. */
  readonly srAlert: (words: string) => void;
  /** `engine.tts.narrate` — spoken aloud through the mixer, gated by the child's own 🗨️. */
  readonly narrate: (words: string) => void;
}

export interface Announcer {
  /** Something happened. Does not interrupt what the reader is saying. */
  say(words: string): void;
  /**
   * Something happened that cannot wait.
   *
   * ⚠️ THE TWO REGIONS ARE NOT INTERCHANGEABLE. Assertive cuts off whatever is being read: using it for a
   * score would talk over a child continuously, and using the polite one for the end of a game would let
   * the news arrive after it stopped mattering.
   */
  alert(words: string): void;
}

export function createAnnouncer(channels: AnnounceChannels): Announcer {
  /**
   * ⚠️ NOTHING IS ANNOUNCED FOR NOTHING. An empty string clears a live region — which a reader may or may
   * not report — and on the assertive one it would spend an interruption on saying nothing at all.
   */
  const both = (words: string, region: (w: string) => void): void => {
    if (!words) return;
    region(words);
    channels.narrate(words);
  };

  return {
    say: (words) => both(words, channels.srSay),
    alert: (words) => both(words, channels.srAlert),
  };
}

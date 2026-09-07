// SPDX-License-Identifier: AGPL-3.0-or-later
// shims/piper-tts-web — the neural voice this game does not carry, refused where the engine expects it.
//
// ========================= WHY A STUB AND NOT A DEPENDENCY =========================
// ⚠️ `@the-inclusionist/engine@6.36.1` DOES NOT DECLARE `@mintplex-labs/piper-tts-web`. Its
// `platform/tts.js` reaches for it with a dynamic `import(...)`, and the published `package.json`
// lists only `pixi.js` as a peer — so every consumer that installs the engine FROM THE REGISTRY fails
// to build, with `Rolldown failed to resolve import`. It built here for one reason only: until this
// commit the engine was a `file:` symlink into its own working tree, where the package sits in that
// repository's `node_modules` and resolves by accident of layout.
//
// That is a defect in the engine's packaging and its fix belongs in the engine — one line of
// `peerDependenciesMeta` marking the import optional, which is what it already IS in behaviour. It is
// reported rather than patched here: this repository does not write to that one.
//
// ========================= AND WHY REFUSING IS THE CORRECT BEHAVIOUR HERE =========================
// The engine already treats the voice as optional: the `import(...)` carries a `.catch` that sets
// `ttsFailed`, announces `sr.tts.loadFailed` and CARRIES ON in the browser's own voice, which speaks
// the right language. So a module that throws is not a degradation of the engine's design — it is the
// path the engine wrote for exactly this case.
//
// ⚠️ AND THE ALTERNATIVE WAS WEIGHED AND REFUSED. Installing the real package puts a WASM synthesiser
// and its voice model into a game whose plan opens with a precache budget for school machines — the
// same argument that has the music unresolved. A neural voice is a fallback for offline use behind a
// cloud voice that is the primary; spending megabytes on the fallback of a fallback, in the one build
// that most needs to stay small, is the wrong trade to make silently.
//
// If that trade is ever reversed, this file is deleted and the package installed. Nothing else changes.

throw new Error(
  '@mintplex-labs/piper-tts-web is not bundled with this game; the engine falls back to the '
  + "browser's own speech synthesis. See shims/piper-tts-web.ts.",
);

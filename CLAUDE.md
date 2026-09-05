# CLAUDE.md — Space Cadet Pinball (TypeScript port)

## Language — decided 2026-09-05, after getting it wrong

**Artefacts are written in ENGLISH.** Code, identifiers, comments, documentation, commit messages, UI
strings in the source. Portuguese, Spanish and any other language appear **only in i18n dictionaries** —
never in the code that reads them.

This is written down because the first 27 files of this repository were written in Portuguese. The
convention comes from the Inclusionist engine this project consumes, and it was not read before starting.
The cost of the conversion was one working session; the cost of noticing and postponing it was that the
session got bigger. The rule now lives here so the next file does not have to remember the reason.

## What this repository is

The engine of *3D Pinball for Windows — Space Cadet*, ported from the
[k4zmu2a decompilation](https://github.com/k4zmu2a/SpaceCadetPinball) (MIT) to TypeScript, running as a
consumer of the Inclusionist accessibility engine (`SP-the-inclusionist-tracer`, AGPL-3.0-or-later).

Code is **AGPL-3.0-or-later**. No Microsoft asset is ever committed: `game_resources/` is gitignored and
populated locally by `npm run data:extract`.

## How the work is done

- **Transcription, not equivalence.** The physics constants of the Space Cadet are calibrated numbers,
  not logic to improve. Where the original does something that looks like a defect, transcribe it and
  write down why it is not — or, where it genuinely is one, say so in the comment and in the commit.
- **Two deviations are allowed and both must be labelled**: where transcribing would be wrong for the
  medium (the alpha-2 sentinel in `gfx/gdrv`), and where the upstream duplicated identical code (the
  Bresenham traversal in `physics/grid`).
- **TDD, and every gate is born red.** Write the test, watch it fail, then implement. Where a test was
  written before the implementation but the red was never observed, prove the same property by mutation
  and say that is what happened.
- **Comments carry the reasoning, not the mechanics.** Say what fails silently if this line is wrong.

## Toolchain

Vite + TypeScript + Vitest on Node 24. `npm run typecheck` must come out clean — zero errors, no
tolerated debt. `npm run validate` runs typecheck, tests and build.

The preview runs over `dist` after `npm run build`; the Vite dev server does not run in the sandbox.

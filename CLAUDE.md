# CLAUDE.md — Space Cadet Pinball (TypeScript port)

## Language — decided 2026-09-05, after getting it wrong

**Artifacts are written in ENGLISH — en-US spelling.** Code, identifiers, comments, documentation,
commit messages. Portuguese, Spanish and any other language appear **only in i18n dictionaries** —
never in the code that reads them, and never as a literal anywhere else.

`color`, `center`, `behavior`, `license`, `normalize`, `neighbor`. Not the British forms. The reason is
not taste: the point of writing the code in English is that somebody who does not read Portuguese can
work on it, and one project spelling is one less thing for that person to guess. The interface strings
in `i18n/en` follow the same rule.

The game itself ships in **pt-BR, en and es**, and a test fails if any of the three loses a key or a
`{parameter}` the others have.

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
- **Two deviations are allowed and both must be labeled**: where transcribing would be wrong for the
  medium (the alpha-2 sentinel in `gfx/gdrv`), and where the upstream duplicated identical code (the
  Bresenham traversal in `physics/grid`).
- **TDD, and every gate is born red.** Write the test, watch it fail, then implement. Where a test was
  written before the implementation but the red was never observed, prove the same property by mutation
  and say that is what happened.
- **Comments carry the reasoning, not the mechanics.** Say what fails silently if this line is wrong.
- **Look at the output, not only at the assertions.** Every render gate in this repository asked about
  a part — a lamp, a corner, a palette entry, a count of changed pixels — and none asked what the frame
  looks like. Three defects lived in that gap at once: the 1995 side panel painted over a third of the
  playfield, the demonstration's table sitting 69 columns left of where the HUD expected it, and a
  `Framebuffer` built from two buffers whose `bytes` view read zero for every pixel. All three survived
  more than seventeen hundred tests and were found by writing a PNG and opening it.
  `tests/gfx-original-shot` now leaves one on disk per run, for the 1995 table, its screen and each of
  the five authored ones. Reading the page's own words counts as output too: the caveat under the file
  picker described a build from two months earlier.
- **Distrust the claim you write while writing the test.** Four times in one night a test asserted
  something the mutant said it could not see: a bumper's rectangle called square when the projection
  foreshortens it, a "four corners beat two" comparison computed from the same two corners, an inset
  read from the same value the blit used, and a performance bound seventy times too loose to notice a
  sevenfold regression. Run the thing the test is supposed to catch. It is the only cheap way to find
  out, and it has never once agreed with the reasoning.
- **A test that reads by the same link as the code cannot fail.** The specific form this takes here:
  asserting `component.position` against `built.plungerPosition` when both come from the same lookup, or
  `lamp.messageField` against `ALIEN_MENACE.nextMission` when the code sets it from that constant. Name
  the literal on one side. Three of the defects found this week were held in place by a test of this
  shape that had been green for months.

## Toolchain

Vite + TypeScript + Vitest on Node 24. `npm run typecheck` must come out clean — zero errors, no
tolerated debt. `npm run validate` runs typecheck, tests and build.

The preview runs over `dist` after `npm run build`; the Vite dev server does not run in the sandbox.

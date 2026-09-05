<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Licence note

Four bodies of work meet in this repository and **three of them are not ours**. This note says which is
which, what may be committed, and what may never be. It is a record of obligations, not a summary of
`LICENSE`.

## 1 · The code is AGPL-3.0-or-later, and that was decided for us

The first request for this port asked for MIT. It could not be granted, and the reason is mechanical
rather than a matter of taste: this is a **consumer of the Inclusionist engine**, the engine is
AGPL-3.0-or-later, and **copyleft travels in one direction only**. AGPL cannot enter an MIT work; MIT
enters an AGPL work freely. Choosing the engine chose the licence.

Every source file carries `SPDX-License-Identifier: AGPL-3.0-or-later`, and `package.json` declares the
same. AGPL rather than GPL because §13 covers *running* the software as a service: a hosted classroom
server owes its source under AGPL and owes nothing under GPL. That is the engine's ADR-0064, and this
repository inherits the conclusion rather than restating the argument.

**The consequence worth naming out loud:** nothing written here can be sent back to the upstream
decompilation. A physics fix found in this port cannot be offered to `k4zmu2a/SpaceCadetPinball` as a
patch, because the patch would be AGPL and that project is MIT. The gate is not technical and there is
no clever way round it — only the holder of the economic rights can relicense.

## 2 · The upstream decompilation is MIT, and is credited

The port descends from [`k4zmu2a/SpaceCadetPinball`](https://github.com/k4zmu2a/SpaceCadetPinball), a
decompilation of the 1995 game, under the MIT licence. What was taken is **the algorithms, transcribed**:
the edge grid, the collision response, the mission state machine's calibrated numbers. No upstream file
is vendored here. MIT requires that its notice travel with the work, and that is what `docs/CREDITS.md`
is for.

Two further debts are not licences but are debts anyway, and are recorded in the same place: AdrienTD's
`.dat dump.txt`, used as an **external oracle** for the archive parser, and the alula web port, used as
a live visual reference in the browser pane.

## 3 · Microsoft's data is never versioned. This is the hard rule of the repository

`PINBALL.DAT`, the ~60 WAV files and the 2 MIDI files are Microsoft's, and no licence permits us to
redistribute them. They are obtained locally, once, by the person running the project:

```
npm run data:extract
```

They land in `game_resources/`, which is the first entry in `.gitignore`.

**`.gitignore` is a mechanism, not the promise.** The promise is that these files never enter the
history, and `git ls-files` returning no `.dat`, `.wav` or `.mid` is what actually holds it. A rule
enforced only by a convenience file is one `git add -f` away from being broken permanently, because a
commit that carries a binary can be reverted and cannot be un-published.

The validation configuration — the one that reads the original table — therefore only ever runs on a
machine that already has the original game. That is not a limitation to work around. It is the shape the
licence imposes.

## 4 · The art follows the engine's pillar 10, and today there is none

Pillar 10 of the engine's ADR-0010 is blunt: **the art is not ours to licence.** In the engine, the art
was made by a third party who holds the economic rights over it in full; there is no "our art" to place
under AGPL, and extending the AGPL to it voluntarily would give away more than the law asks *and* dispose
of somebody else's right. The separation is legal before it is a preference — Lei 14.063/2020 art. 16
binds the **program**, a program is what Lei 9.609 defines, and art follows Lei 9.610 and belongs to
whoever made it.

Applied here, honestly, as of phase 8:

- **There is no art in this repository.** `git ls-files` matches no image, font or audio file at all.
- What phase 8 draws is not art in that sense. `gfx/table-view.ts` fills rectangles and circles with
  eight colours from `ROLE_COLORS`, computed in code. **That is code**, and it is AGPL like everything
  else around it. Calling it art would invoke a regime over something the regime does not reach.
- The regime binds **from the moment real art arrives** — whether from the engine's artist or from a
  generator. That has not happened, and the source is still an open decision.

Two rules apply the instant the first asset lands, and both come from the engine:

1. The asset carries **its author's licence**, recorded per file, never assumed to be the code's.
2. An asset whose licence forbids redistribution **must never enter the bundle** (engine ADR-0028). A
   build that a school cannot legally receive is not a build.

## 5 · Where each rule applies

| Path | What it is | Under what terms |
|---|---|---|
| `app/`, `tests/`, `scripts/`, `docs/` | this port | AGPL-3.0-or-later |
| `node_modules/@the-inclusionist/engine` | the engine | AGPL-3.0-or-later, third party |
| algorithms in `app/js/physics`, `app/js/control`, `app/js/dat` | transcribed from upstream | MIT upstream, AGPL as transcribed; credited |
| `game_resources/` | Microsoft's data | no redistribution right — **never committed** |
| *(no path yet)* | art | its author's licence, per file, when it exists |

## 6 · If you are adding something

Ask which of the five rows above it belongs to. If the answer is "none of them", that is the moment to
extend this note — before the commit, not after it.

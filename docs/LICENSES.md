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

### 2.1 · What the upstream MIT licence does NOT cover, which matters

The MIT notice on `k4zmu2a/SpaceCadetPinball` is that author's grant of **their own** rights over the
decompiled source they wrote. It says nothing about the rights in the 1995 game those sources describe,
and it cannot: nobody can license out what they do not hold.

The rights in the original are not Microsoft's either, and were never wholly theirs. *Full Tilt! Pinball*
was written by **Cinematronics** and published by **Maxis** in 1995; Microsoft licensed **one table** of
the three for Plus! and for Windows. Cinematronics became Maxis South in 1996 and both were absorbed by
**Electronic Arts** in 1997. So the copyright in the game sits with EA, while Microsoft holds a licence
that — by Microsoft's own repeated account of why the game was never re-released — covered bundling it
inside Windows and Plus! and their successors, and nothing else. Not a standalone release, and not the
source.

⚠️ **So no permission to decompile was ever given, by anybody, and Microsoft is not in a position to
give one.** The upstream README claims none: it names the binaries it was reverse-engineered from
(`pinball.exe` from Windows XP, `CADET.EXE` from *Full Tilt!*) and states that the game resources are
not included.

That the decompilation and its dozens of ports have run for years without a takedown is **not evidence
of permission**. It is what an orphaned right looks like: the party with the copyright has no product
to protect, the party with the brand has a dead licence, and nobody has a commercial reason to spend
money on enforcement. That can change on any day and would not need a reason.

Some jurisdictions do allow decompilation narrowly — EU Software Directive 2009/24/EC article 6 and the
US DMCA §1201(f), both for **interoperability**, and the *Sega v. Accolade* line of cases for the
intermediate copying that reverse engineering requires. None of them is a general permission to
reproduce a work, and a direct decompilation-and-port is a much weaker position than a clean-room
reimplementation would have been.

**What this project actually relies on**, stated plainly rather than assumed:

1. It ships **no asset of the original, ever** — §3 below, enforced by a test over `dist`.
2. It is **non-commercial**, and part of an accessibility engine.
3. The 1995 table is **scaffolding for validation**, not the destination: phase 8 replaces the geometry
   and the art with authored work, after which what remains of the original is the algorithms alone.

None of that is a legal opinion, and none of it is advice — this file is written by the people doing
the work, not by a lawyer. It is here so that whoever inherits the repository inherits the risk
knowingly rather than by surprise.

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

## 4 · The art follows the engine's pillar 10, and what phase 8 draws is code

Pillar 10 of the engine's ADR-0010 is blunt: **the art is not ours to licence.** In the engine, the art
was made by a third party who holds the economic rights over it in full; there is no "our art" to place
under AGPL, and extending the AGPL to it voluntarily would give away more than the law asks *and* dispose
of somebody else's right. The separation is legal before it is a preference — Lei 14.063/2020 art. 16
binds the **program**, a program is what Lei 9.609 defines, and art follows Lei 9.610 and belongs to
whoever made it.

Applied here, honestly, as of phase 8:

- **There is no art in this repository.** `git ls-files` matches no image, font or audio file at all.
- What phase 8 draws is not art in that sense. `gfx/table-view.ts` draws each component as the shape it
  collides with, in colours `gfx/table-palette.ts` computes per role and per world. **That is code**,
  and it is AGPL like everything else around it. Calling it art would invoke a regime over something
  the regime does not reach.
- **The source is no longer an open decision.** Asked on 2026-09-06 who draws the phase-8 art, the Dev
  answered: *"Quem desenha: trabalho seu."* So it is produced inside this work, on the Dev's
  instruction, rather than sourced from a third party.

⚠️ AND THAT CHANGES WHICH PROBLEM PILLAR 10 IS SOLVING HERE. The pillar exists to stop AGPL being
extended over **somebody else's economic rights** — in the engine there is an artist who holds them in
full, and giving them away would dispose of a right that is not the project's to dispose of. With the
drawing produced inside this work there is no such third party to protect, so nothing here is being
taken from anyone by the code's own licence covering it.

That is a statement about **whose rights are at stake**, and deliberately not a claim about who owns
machine-produced output. Whether such output attracts authorship at all is unsettled, and the
uncertainty argues against asserting exclusive rights over it rather than for it — which sits
comfortably with AGPL and would sit badly with a licence that depended on the claim. If the Dev needs
a position stated for an administrative act, that is a question for a lawyer and not for this file.

- The third-party regime still binds **from the moment third-party art arrives** — from the engine's
  artist, from a stock source, from anywhere with a rights holder. That has not happened.

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

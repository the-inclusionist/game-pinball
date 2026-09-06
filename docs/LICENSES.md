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

- ⚠️ **THERE IS ONE ASSET, AS OF 2026-09-06, AND IT IS A FONT.** This line used to read "there is no
  art in this repository: `git ls-files` matches no image, font or audio file at all", and that stopped
  being true the moment the Dev asked for the title screen to be set in **Press Start 2P**.

  It is the first thing here that is not code, so it is the first test of the two rules below, and both
  are satisfied rather than asserted:

  | | |
  |---|---|
  | file | `app/assets/fonts/press-start-2p.woff2` (12 KB) |
  | author | The Press Start 2P Project Authors — cody@zone38.net |
  | licence | **SIL Open Font License 1.1**, copied verbatim beside it as `press-start-2p.OFL.txt` |
  | redistributable | **yes** — the OFL exists to permit exactly this, including inside a bundle |
  | reserved name | "Press Start 2P" — the OFL forbids shipping a MODIFIED font under that name, so it is bundled unmodified |

  It is **bundled, not fetched**. A webfont pulled from Google at boot is a network dependency in a
  game that has to run offline on a school machine, and it is a request to a third party carrying the
  player's address every time a child opens the title screen. Twelve kilobytes is cheaper than either.

- No other asset exists. `git ls-files` still matches no image and no audio file.
- What phase 8 draws is not art in that sense. `gfx/table-view.ts` draws each component as the shape it
  collides with, in colours `gfx/table-palette.ts` computes per role and per world. **That is code**,
  and it is AGPL like everything else around it. Calling it art would invoke a regime over something
  the regime does not reach.
- **The source is no longer an open decision.** Asked on 2026-09-06 who draws the phase-8 art, the Dev
  answered: *"Quem desenha: trabalho seu."* So it is produced inside this work, on the Dev's
  instruction, rather than sourced from a third party.

### 4.1 · The table art is machine-generated, and it is dedicated under CC0 1.0

Decided 2026-09-06, and the decision changed once on a fact the Dev supplied.

He first said he would work on the art himself and chose **CC BY-SA 4.0**, which matched the reason the
engine is AGPL rather than MIT: work that stays open when someone reuses it. Then: *"Opa, calma. Esta
arte foi gerada pelo Gemini! (Nano Banana)."*

⚠️ **THAT IS NOT A DETAIL, IT IS THE WHOLE QUESTION.** A Creative Commons licence operates **on a
copyright**. It grants permissions a rights-holder has and attaches conditions to them; where there is
no copyright there is nothing for it to act on. And a copyright needs a human author — **Lei 9.610/98
art. 11**: *"Autor é a pessoa física criadora de obra literária, artística ou científica."* The United
States Copyright Office has reached the same conclusion for material without human authorship.

So putting CC BY-SA on purely machine-generated images would be asserting a **ShareAlike restriction
over work that may carry no exclusive right at all** — a condition nobody would have standing to
enforce, published in a file whose whole purpose is to state obligations accurately. This repository
does not get to make a claim it cannot back.

**Separately, and much more simply: using it is fine.** Google's terms for Gemini do not claim
ownership of output and permit its use, including commercially. That is a question about *permission*,
and it is routinely conflated with the question about *copyright*. They are not the same question and
only the second one decides what licence can be applied.

**The decision:**

| | |
|---|---|
| files | `low-orbit.png`, `ion-storm.png`, `crater-run.png`, `slipstream.png`, `long-climb.png`, `ring-belt.png` in `app/assets/tables/`, beside their `LICENSE.txt` |
| tool | Google Gemini ("Nano Banana") |
| prompted by | José Rocha |
| when | September 2026 |
| dedication | **CC0 1.0 Universal** |
| copyright claimed | **none** |

CC0 is the instrument that works **whether or not a copyright exists**, which is exactly the state of
uncertainty here: it is a dedication of any rights that may exist, with a permissive fallback licence
built in for the jurisdictions where a dedication is not possible. It asserts nothing that might turn
out to be false. Wikimedia Commons treats purely machine-generated images the same way.

⚠️ **AND CC0 IS NOT WEAKER THAN CC BY-SA HERE, BECAUSE THE STRONGER LICENCE WAS NEVER AVAILABLE.** The
choice was not "share-alike or public domain". It was "claim a right that may not exist, or say plainly
what happened". The second is the only one of the two this file can hold.

**What would change the answer:** substantial human authorship in the *arrangement* — composing,
cutting and rearranging, editing the output, or iterating prompts toward a layout the person designed
— can attract a copyright in that contribution, distinct from the raw output. If that is what happened,
the honest record is CC BY-SA over the arrangement, saying what it covers and what it does not. The Dev
was asked and accepted CC0; if the working method turns out to have been the other one, this section is
where it gets corrected.

**The provenance line travels with the files**, in `app/assets/tables/LICENSE.txt` and in
`art/README.md`, because a dedication with no record of what was dedicated is not much of a record.

⚠️ **AND WHAT IS VERSIONED IS THE DERIVED PICTURE, NOT THE MASTER.** `art/*.jpg` are seven to ten times
the size the game uses — eighteen megabytes for six — and are gitignored with the reason written there.
What ships is each one reduced to its playfield's own size, DIMMED so its brightest pixel sits under
ADR-0007's ceiling, and quantised to 128 colours: 343 KB for the set. The dedication covers those
files, which are the ones in the tree.

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

<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Credits

Three people's work made this port possible and none of it is ours. The obligations behind these
entries are set out in [`LICENSES.md`](LICENSES.md); this file is the attribution itself.

## The decompilation — Andrey Muzychenko (`k4zmu2a/SpaceCadetPinball`)

The physics, the collision response, the edge grid and the mission state machine are **transcribed from**
[`k4zmu2a/SpaceCadetPinball`](https://github.com/k4zmu2a/SpaceCadetPinball), a decompilation of *3D
Pinball for Windows — Space Cadet*. Where this port and the original disagree, the original is right and
this is a bug; the calibrated numbers in `app/js/control/` in particular are transcribed rather than
designed, and none of them is a value to improve.

MIT requires that its notice travel with the work. Reproduced verbatim:

```
MIT License

Copyright (c) 2020-2021 Andrey Muzychenko

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Nothing from this port can go back to it. See [`LICENSES.md` § 1](LICENSES.md) for why.

## The archive dump — AdrienTD

`Doc/.dat dump.txt` in the upstream tree is a full listing of `PINBALL.DAT`: 541 groups, 318 bitmaps,
`table_size 600 416`, largest bitmap 365×470. It was used as the **conformance oracle** for
`app/js/dat/partman.ts`, and the distinction matters more than the convenience: it was produced by
another person with another tool, so when the parser agrees with it, it agrees by independent evidence
rather than because the expected values were generated from the code under test.

`Doc/.dat file format.txt`, from the same source, specifies the format completely. There was no reverse
engineering to do in phase 1, and claiming otherwise would take credit for somebody else's work.

## The web port — alula (`pinball.alula.me`)

Used as a **live visual reference**, held open in the browser pane beside this one during phases 2 and 3
so that a rendered frame could be compared with the original rather than judged by eye. Its packaging of
the original data is also what makes `npm run data:extract` a matter of slicing an `ArrayBuffer` — the
index is in plain text inside the site's own JavaScript.

No code from it is present here.

## The game itself — Microsoft

*3D Pinball for Windows — Space Cadet* (1995), derived from *Full Tilt! Pinball* by Cinematronics and
Maxis. Its data files are Microsoft's and are **never distributed with this project** under any
circumstances; see [`LICENSES.md` § 3](LICENSES.md). This port is not a redistribution of the game and
nothing about it should be read as permission to redistribute one.

## Press Start 2P

The title screen is set in **Press Start 2P** by CodeMan38 (cody@zone38.net), under the
**SIL Open Font License 1.1**. The file is `app/assets/fonts/press-start-2p.woff2` and the licence is
copied verbatim beside it at `app/assets/fonts/press-start-2p.OFL.txt`.

⚠️ The FILE NAME is written out because `tests/licence-note` reads this document for it. That gate used
to check every asset against the string "Press Start 2P", so this entry vouched for anything that might
arrive later — the font was both the subject and the evidence, and six pictures landed without it
noticing. It checks each asset by its own name now, which is what made this line necessary.

The font is bundled unmodified. "Press Start 2P" is a Reserved Font Name under the OFL, which means a
modified copy may not be shipped under that name — so if it is ever subset or patched, it is renamed
first.

## The table art — public domain, no copyright claimed

`app/assets/tables/low-orbit.png`, `ion-storm.png`, `crater-run.png`, `slipstream.png`,
`long-climb.png` and `ring-belt.png` are the six playfields, generated with **Google Gemini
("Nano Banana")**, prompted by **José Rocha**, September 2026.

They are dedicated under **CC0 1.0 Universal** and **no copyright is claimed** over them — because a
Creative Commons licence operates on a copyright and a copyright needs a human author. There is
nothing to attribute in the legal sense and this entry does not pretend otherwise; it records who
made them and how, which is what a credits file is for.

The reasoning is in [`docs/LICENSES.md` §4.1](LICENSES.md) and beside the files in
`app/assets/tables/LICENSE.txt`.

## The screens behind the menus

| | |
|---|---|
| files | `start.png`, `background.png` (in `app/assets/screens/`) |
| supplied by | José Rocha |
| when | September 2026 |
| made by | **not recorded** — see `docs/LICENSES.md` §4.2 |
| terms | **not recorded** — see `app/assets/screens/LICENSE.txt` |

⚠️ These two are the only assets in this repository whose origin is not written down. They are used
because the Dev asked for them by name; what may be done with them by anyone else is a question this
project cannot answer yet, and says so rather than guessing.

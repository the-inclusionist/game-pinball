# Space Cadet Pinball — TypeScript port

The pinball engine of *3D Pinball for Windows — Space Cadet*, ported from the
[k4zmu2a decompilation](https://github.com/k4zmu2a/SpaceCadetPinball) (MIT) to TypeScript, running as a
consumer of the Inclusionist accessibility engine.

## What this is, and what it is not

It is the **engine**: physics, collision, the z-buffer compositor and the mission state machine, transcribed
faithfully. It is **not** a redistribution of the game. No Microsoft asset is vendored here, ever.

The port runs in two configurations:

| | table data | screen | purpose |
|---|---|---|---|
| **validation** | original `PINBALL.DAT`, supplied locally by you | playfield 365x470 halved to 183x235 inside 320x180 | prove the physics matches the original |
| **shipping** | original table authored for 320x180 | authored to fit | the game that ships |

The validation configuration exists for one reason: physics and table are two variables, and changing both
at once leaves no way to isolate a bug.

## Running it

```
npm install
npm run build
npm run preview
```

The preview serves `dist`, and that is deliberate rather than incidental: the Vite dev server does not
come up in the sandbox this was written in, so `npm run build` first is the path that is known to work.

```
npm run validate
```

is the one command that has to pass: `npm run typecheck` (zero errors, no tolerated debt), then every
test, then the build. The tests run in two projects and both are part of it:

| | what it is | when to reach for it |
|---|---|---|
| `npm run test:node` | pure logic — the parser, the physics, the mission machine, and every decision this port deliberately lifted out of an event handler so it could be tested without a browser | almost always: it is faster, and a failure names one function |
| `npm run test:browser` | real Chromium, via Playwright | only what node cannot make: real layout, real focus, real key events |

The split is not a preference. A `focus()` on a hidden element does nothing at all, and no hand-written
fake models that — which is how a dialog ships whose Escape key never arrives.

## Playing it

The controls are a **cabinet**, and the keyboard is one mapping of it:

| control | does |
|---|---|
| left / right | the left and right flippers |
| button 1 | launch the ball |
| button 2 / button 3 | the left and right flippers again |
| start | pause |

| key | what it does |
|---|---|
| `A` / `J` | left flipper |
| `D` / `K` | right flipper |
| `U` | launch the ball — **held**, not pressed: holding draws the plunger back and letting go launches |
| `Enter` / `H` | pause |
| `B` | blind mode |
| `S` | sweep the sonar |
| `C` | switch between the normal and CB-Safe palettes |

Two keys per flipper because one hand is not everybody's: `A`/`D` are a direction pair for one hand and
`J`/`K` a button pair for the other, so a player who cannot reach across a keyboard uses whichever is
nearer and a player using one hand has a full set within it.

The accessibility switches are KEYS rather than menu entries — a player who needs blind mode is not the
player who will find it three screens into a settings panel. The palette also has a menu, because it
was asked for by name.

### Query parameters

| | |
|---|---|
| `?table=<name>` | opens one of the authored tables instead of the default |
| `?demo=original` | the 1995 table, which asks you for `PINBALL.DAT` through a file picker |

⚠️ **`?demo=original` reads the file you hand it and nothing else.** The archive is never fetched, never
bundled and never served — see below.

## Original game data

`PINBALL.DAT`, the ~60 WAV files and the 2 MIDI files are third-party work and are listed in
`.gitignore`. To run the validation configuration you supply them yourself:

```
npm run data:extract
```

## License

Code: **AGPL-3.0-or-later** (see `LICENSE`), and not by preference — the engine this consumes is AGPL, and
copyleft travels one way. The upstream decompilation is MIT.

Art follows its own author's terms, and the tree holds exactly one piece of it: **Press Start 2P** in
`app/assets/fonts`, under the SIL Open Font License 1.1, copied verbatim beside the file. Everything the
tables are drawn with is code — `gfx/table-view` strokes each component as the shape it is — so it is
AGPL like the rest. This paragraph said there was no art here until the font landed and went on saying
it afterwards; a test now reads it against `git ls-files` rather than against anybody's memory.

Both are set out in **[`docs/LICENSES.md`](docs/LICENSES.md)**, with the attribution itself in
[`docs/CREDITS.md`](docs/CREDITS.md). Read the first before adding anything that is not code.

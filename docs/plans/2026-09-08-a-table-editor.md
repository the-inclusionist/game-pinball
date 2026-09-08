# A table editor

> **The Dev, 2026-09-08:** "faça o plano para implementar um criador de mesas onde as dimensões da mesa
> são escolhidas, em seguida uma imagem de fundo é escolhida (ou usamos o fundo completamente preto) para
> então adicionarmos os elementos já existente no jogo por cima para montar a mesa, arrastando e
> soltando."

Three steps, in his order: **size → background → parts**. Everything below is how each of those is made
possible, and the two things that decide whether the result is worth having.

---

## ⚠️ 0 · Both decisions answered, 2026-09-08

> **§0.1 — who is holding the mouse:** *"a teacher or a child making a table of their own."*
>
> **§0.2 — what stops it producing broken tables:** *"você mesmo respondeu: THE EDITOR HAS TO ANSWER ALL
> FIVE WHILE THE AUTHOR IS STILL LOOKING AT THE TABLE."*

So: a feature of the game, not a tool for its author, and the five instruments run live. Everything
below stands as written; the recommendations in §0.1 and §0.2 are decisions now.

**Step 1 landed the same day.** `table/parts.ts` and `tests/table-parts` — and the gate found a defect
in the library on its first mutation run: every wall asked to face UP faced down, and every one asked to
face DOWN faced up, in the module written so that nobody would have to think about windings. It survived
the first version of the gate because that only ever asked a target.

## 0.1 · The two decisions, as they were put

### 0.1 · Who is holding the mouse

Everything else follows from this and it is the Dev's to answer.

| | a tool for the author | a feature of the game |
|---|---|---|
| who uses it | him, to lay out catalogue tables faster than by editing TypeScript | a teacher or a child, making a table of their own |
| where it runs | a dev-only page, not in `dist` | a route in the game, in the bundle |
| what it writes | TypeScript to paste into `app/js/table/` | data the game can open |
| accessibility | the same as any dev tool | **the whole point** — see §5 |
| cost | days | weeks |

**Recommendation: build the second, and get the first for free.** The editor writes DATA either way; a
"copy as TypeScript" button is thirty lines on top of that. Building the dev tool first and the real one
later means building the hard half twice, and the hard half is not the drag — it is the part library and
the live checking, which both versions need identically.

⚠️ **AND THE SECOND IS THE ONE THAT FITS THIS PROJECT.** A game whose every screen argues about blind
players, colour vision and reading faces, shipping an authoring tool only its author can use, would be
the same contradiction `shell/a11y-bar` records being fixed one screen at a time.

### 0.2 · What stops it producing tables that do not work

This is the risk that decides whether the editor is useful or a way to make broken tables quickly. This
repository has a list of defects that a table can have while LOOKING fine, every one of them found by
measuring rather than by reading:

- a collision line wound the wrong way — a wall solid from the side the ball never arrives on
- a funnel that delivers the ball to a paddle's base, where the arm does not move
- a face that looks up and is level, which holds the ball for ever
- a component nothing reaches in sixty balls
- a table where flapping the flippers changes nothing, which is a corridor with paddles in it

⚠️ **THE EDITOR HAS TO ANSWER ALL FIVE WHILE THE AUTHOR IS STILL LOOKING AT THE TABLE.** Every one of
them already has an instrument in `tests/`; what they do not have is a home outside a test file. That
extraction is step 1 of the work and it is the piece that makes this plan worth doing.

---

## 1 · The part library, which is what makes it possible at all

A component in this game is `bounds` plus collision shapes plus a control and a score row. A person
cannot be asked to type a winding — `table/authored`'s own rule is that `(dy, −dx)` decides which side
of a line is solid, and getting it backwards makes a wall the ball passes through.

So `table/parts.ts` (new): every placeable thing as a FUNCTION.

```
placeBumper({ at, radius })        → a circle, a BumperControl, a score row, a lamp
placeTarget({ at, width, facing }) → a face wound to the side it faces, a TargetControl
placeRamp({ from, to })            → a line, a RampControl, wound to face the play
placeLane({ box })                 → no collision at all: a region the ball rolls over
…
```

`facing` is the editor's answer to the winding problem: the author says *which way this thing looks* and
the library writes the geometry. `table/cabinet` is already this idea for the shell, and its header says
why — "the winding of a collision line is something a person gets wrong quietly and a machine does not".

⚠️ **AND THE EXISTING TABLES SHOULD BE MOVED ONTO IT, ONE AT A TIME AND NOT IN THIS PLAN.** A library
the catalogue does not use is a second way of describing a table, and this repository has a note about
what that costs on every file where it has happened.

---

## 2 · A table that comes from data

The catalogue is eleven TypeScript modules. Nothing about `AuthoredTable` needs it to be: it is plain
data, `validateTable` already refuses a bad one, and `buildPhysics` takes it as a value.

- `table/from-json.ts`: parse, validate, and REFUSE with the validator's own messages.
- A custom table opens by name from `localStorage`, exactly as `?table=` opens a catalogue one.
- **The round trip is the gate**: every catalogue table, serialised and parsed back, must be identical
  and must still pass every survey. That proves the format carries everything before anything depends
  on it.

⚠️ **WHAT DOES NOT COME FROM DATA IS THE MISSIONS' TEXT.** A mission's `id` is an i18n key, and a table
a child writes cannot add keys to three dictionaries. v1 gives a custom table the objective
`table/objective` already derives from its roles — which is exactly what `bare-minimum` uses and what
that module was written for.

---

## 3 · The three steps, as screens

### 3.1 · Size

Width and height, in table units, with the constraints that already exist stated as they are typed:
`validateTable` refuses a table no taller than the view, and the camera's travel is `height − 180`.
Presets from the catalogue (183×235, 183×300, 360×240) because a blank number field is not a choice.

The shell arrives with the size: `cabinet(size)` gives walls, the plunger lane and its bend, the
flippers, the funnel and the drain. **A new table is playable before anything is added to it** — that is
what the cabinet is for and it is the difference between an editor and a blank page.

### 3.2 · The background

A file the author picks, or nothing at all — his "ou usamos o fundo completamente preto", which is what
every table already does when its art fails to decode (`gfx/backdrop` answers `null` and the world's own
colours are drawn).

⚠️ **AND AN IMAGE CANNOT BE USED AS IT ARRIVES.** `scripts/import-art.py` reduces a master to the
table's size with a BOX average and then shapes its tones to a CEILING — the brightness above which the
ball no longer clears 3:1 against the art, which is ADR-0007 and `gfx/surround`'s reason for existing. A
photograph dropped in raw is a table where the ball disappears against its own background.

So that shaping is ported to TypeScript and runs in the browser on the chosen file. It is the largest
single piece of work in this plan and it is not optional: the alternative is an editor that produces
tables failing the contrast gates the catalogue is held to.

### 3.3 · The parts

A palette down one side, the table in the middle at an integer scale, an inspector for the selected
part. Drag from the palette to place; drag a placed part to move it.

---

## 4 · Live checking, which is the feature

Everything in `tests/` that measures a table becomes a module the editor can call, and the tests keep
calling the same code:

| instrument | what it tells the author |
|---|---|
| `validateTable` | "this table cannot open: two components are called `bumper1`" |
| `no-shelf-holds-a-ball` | "this face is level and will hold the ball" — **as you draw it** |
| `table-rests` | "twelve launches: one ball never came back, here" |
| `table-playable` | "flapping the flippers changed nothing — the ball never reaches a paddle" |
| `table-reachable` | "sixty balls never touched this target" |

⚠️ **THE SURVEYS TAKE SECONDS, WHICH DECIDES HOW THEY ARE OFFERED.** `table-rests` is twelve launches of
twenty seconds and `table-reachable` is sixty balls; those are a button — "check this table" — and a
progress line, not something that runs on every drag. Only the validator and the shelf scan are instant
enough to run as the author works.

---

## 5 · The editor is keyboard-operable, or it does not ship

WCAG 2.1.1 is not a checkbox here. This is a game whose HUD carries a blind mode, whose palette menu
exists for colour vision, and whose title screen now shows those controls before the game starts.

- Every action has a key: select a part from the palette, place it, move it by one unit or by ten,
  resize it, delete it, and read out what is selected and where it is.
- Drag is the MOUSE AFFORDANCE ON TOP of that, never the only way.
- The selected part's position and size are announced through the same live regions the game uses.

⚠️ **AND A GRID IS AN ACCESSIBILITY FEATURE BEFORE IT IS A CONVENIENCE.** Snapping to whole units means
a keyboard user and a mouse user can place a part in the same place, and it is what makes "move by one"
mean something.

---

## 6 · Where it lives

A second Vite entry — `app/editor.html` — so the game's bundle does not carry it. The precache budget of
a school laptop is a real constraint this repository has already turned a music decision on.

The editor imports from `app/js/table/` and `app/js/gfx/`; nothing in the game imports from the editor.
That direction is the whole of the coupling rule, and a gate can check it by reading imports.

---

## 7 · Order of work

1. **`table/parts.ts`** — the part library, with a gate that every part it makes passes `validateTable`
   and has its winding facing the way it was asked to.
2. **`table/survey.ts`** — the instruments out of `tests/` and into a module. The existing tests call it
   and must not change their claims: same numbers, same failures.
3. **`table/from-json.ts`** — the round trip, gated over the whole catalogue.
4. **The editor page**: size, the cabinet shell, the canvas, and NOTHING else. Playable at the end of
   this step, by opening the custom table in the game.
5. **Placement**: keyboard first, then drag. The keyboard gate is written before the drag exists.
6. **The inspector**: names, scores, kind-specific fields.
7. **The background**: the tone shaping ported, with the ceiling gate the catalogue art is held to.
8. **The checks**: the validator and the shelf scan live, the surveys on a button.
9. **Export**: JSON to a file; "copy as TypeScript" for promoting one into the catalogue.

Steps 1–3 are useful on their own even if the editor is never built, which is deliberate: they are the
refactor this repository has been circling — a part library, the surveys with a home, and a table format
that is data.

---

## 8 · What v1 does not do

Named so that "it does not do it yet" is not confused with "it was forgotten": missions and their i18n
keys, lamp wiring beyond one lamp per part, drop-target BANKS, movers' paths, storms, lights, physics
constants, and sharing a table with anybody else. Every one of those is a table feature that exists in
the format and can be added to the editor later; none of them is needed to lay out a playable table.

## 9 · The risks, in the order they are likely to bite

1. **An editor makes broken tables faster than a person can find out.** Mitigated by §4, and that is why
   the survey extraction is step 2 rather than step 8.
2. **The tone shaping is the biggest unknown.** It is 200 lines of NumPy today. Ported wrong, it is
   invisible: the table looks fine and the ball loses contrast against it. Its gate is the one that
   already exists — `tests/screen-art`'s ceiling — run on the editor's output.
3. **Drag and drop is where accessibility silently dies.** Which is why the keyboard gate is written
   first, at step 5, before there is a drag to fall back on.
4. **The editor is a second product.** It has its own screens, its own state, its own tests. §0.1's
   recommendation is the one that keeps that cost paying for itself rather than doubling it.

# The engine moves to 8.0.0

> **The Dev, 2026-09-11:** "atualizei a engine para a versão 8.0.0. Estude o pacote da engine do
> inclusionista disponível em https://www.npmjs.com/package/@the-inclusionist/engine, se adeque a essa
> versão e passe a usá-la."

This game was the LAST consumer on 6.x. Measured the same day, from each sibling's manifest:

| repository | engine |
|---|---|
| `game-2048` | `8.0.0` |
| `game-chess` | `^8.0.0` |
| `game-soccer` | `^8.0.0` |
| `game-whackwhack` | `8.0.0` |
| `game-platformer` | `^7.0.1` |
| **`game-pinball`** | **`^6.36.1`** |

Two majors in one step, so the work is read from the engine's own `CHANGELOG` rather than guessed, and
every item below names what it is answering.

---

## 1 · What the compiler says, which is almost nothing

⚠️ **ONE ERROR ACROSS THE WHOLE PORT**, and that is the useful measurement: `shell/declaration.ts` is
missing `holdsAtOnce` and `seguraTeclas`. Every other surface this game touches — `core/contract`,
`platform/audio`, `ui/pause-icons`, `input/gamepad`, `render/viz-modes`, `render/cvd-matrices`,
`style.css` — survived two majors unchanged.

That is not luck. `shell/boot` restates the engine's option types at the boundary and `main.ts` imports
`createGame` DIRECTLY so the two are checked against each other, which is what that module's header says
it is for. The narrow seam is what made a two-major jump a one-line compile failure.

### The two fields, and what a pinball answers

- **`holdsAtOnce(): 2`** — both flippers, held together. That is the cradle: a ball held on one paddle
  while the other flips. ⚠️ **AND NOT THREE**, which is the answer the four editable actions (`left`,
  `right`, `plunger`, `pause`) would suggest: the plunger is only ever charged with the ball IN THE LANE,
  and `main.ts:454` spawns multiball's extra balls AT THE CURRENT BALL, never in the lane. So there is no
  state of this game in which the plunger and a flipper must be held at once.
- **`seguraTeclas(): true`** — the plunger is a HELD CHARGE (`shell/plunger`: the longer it is held the
  further the ball goes) and a flipper stays up while its key is down. This is the field that decides
  whether the engine offers latching to a child who cannot keep a key pressed; answering it wrong here
  would take that control away from exactly the player it exists for.

## 2 · The neural voice stops being a throwing stub

⚠️ **THE ENGINE NO LONGER IMPORTS `@mintplex-labs/piper-tts-web` AT ALL.** Measured in the 8.0.0 tree: the
name appears only in JSDoc. ADR-0094 turned it into a door the GAME opens — `carregarVozNeural` — because
the package drags `onnxruntime-web` in as a non-optional peer, 135 MB into every consumer's
`node_modules`, including one that never speaks with it.

So `shims/piper-tts-web.ts` and the two Vite aliases that pointed at it are DELETED. What that file was
saying — "this game does not carry the neural voice" — becomes one declared line:

```
declines: { semVozNeural: true }
```

⚠️ **AND DECLINING IS NOT THE SAME AS STAYING SILENT**, which is why the field exists. The engine measured
its own catalogue on 2026-09-08: three of six games had no neural voice and NOTHING SAID SO. A declined
voice is a decision; an undeclared one is an omission that reaches a child as a menu entry that never
loads.

## 3 · The 285 MB that would have arrived unasked

⚠️ **`baixarPesados` DEFAULTS TO TRUE IN 7.x AND 8.x**, and `createGame` fires it on every boot:
`if (o.baixarPesados !== false)`. It pulls the four neural voice models, the vision runtime and its three
models, and the voice runtime — ~285 MB — into Cache Storage, in the background.

This game passes `baixarPesados: false`, for reasons that are about THIS cartridge and not about the
feature:

1. **NOTHING HERE READS THAT CACHE.** `platform/pesados` writes to a Cache Storage bucket that the
   service worker serves from, and this repository has no service worker and no web manifest. The bytes
   would arrive and never be read.
2. **IT CANNOT SPEAK WITH THE VOICES IT WOULD DOWNLOAD**, by §2's own decision.
3. ⚠️ **AND A BROWSER TEST WOULD FIRE IT.** In Node `caches` is undefined and the download reports
   `falhou` harmlessly; in the Playwright project it is defined, and every suite that boots would pull
   285 MB from a CDN. The engine's own note says so: "um caso que monte o arranque num navegador de
   verdade não pode disparar 241 MB contra o Hugging Face."

📌 **AND IT IS REVERSIBLE IN ONE LINE**, which is the shape to keep it in: the day this game becomes a PWA
or opens the voice door, the reason above stops holding and the flag comes out. ADR-0117 says the bytes
should be the PLATFORM's to pay once per origin — that decision is not this repository's to take.

## 4 · The sonar's scratch field is gone, and the comment about it was the defect

`main.ts` keeps ONE sonar player object alive across frames, and the comment beside it says why: the
engine counted frames on `guideT` and pinged at 48. ⚠️ **BOTH HALVES OF THAT ARE NOW FALSE.** The beep
became a continuous audio graph (`_guia`), `guideT` is gone from the engine entity, and `viz` left
`SonarPlayer` — the sonar stopped knowing what a visual mode is, and asks `visaoComprometida` instead.

⚠️ **THE STABLE-OBJECT REQUIREMENT SURVIVES AND ITS REASON CHANGED**, which is exactly the kind of thing a
stale comment hides: a fresh object each frame now drops the live OSCILLATOR rather than resetting a
counter. Same rule, different mechanism — so the fields go and the note is rewritten to say what is true.

## 4.5 · The item the plan did not have, which the suite found

⚠️ **THE COMPILER SAID ONE THING AND THE BROWSER SAID ANOTHER.** With the five items above done,
`npm run typecheck` was clean and TWELVE BROWSER SUITES FAILED AT ONCE, in both engines, with the same
sentence out of `createGame`:

> *sem barra de acessibilidade na primeira tela: declare `host.a11yBarHost` ou ponha um `#title-icons` no
> documento. Sem ela a criança não alcança modo cego, TTS, alto contraste nem Libras antes de começar*

Engine 8 MOUNTS the first screen's accessibility bar itself, because five of its six games had none at
all and each had been left to remember. 📌 **AND IT IS THE THING THE DEV ASKED FOR IN AUGUST** — "os
botões para acessibilidade no topo desde a primeira tela" — arriving upstream, with four controls this
game never offered: the screen reader, Libras, the autism adjustments and latching.

⚠️ **AND THE BAR WAS READ IN A REAL BROWSER, WHICH CORRECTED THIS PARAGRAPH.** It said SIX and named high
contrast and colour correction among them; the mounted bar has neither. The engine puts those two up only
for a game that hands it a theme writer and a correction writer, and this one keeps its own —
`shell/options`'s palette and `shell/vision`'s dialog. What it does put up, measured: `blind`, `tts`,
`libras`, `tea`, `altmove`, and three greyed as "em construção" (face, eyes, voice).

⚠️ **AND `altmove` IS THERE BECAUSE OF §1.** The engine mounts the latching toggle only where a game
answers `seguraTeclas()` true. The contract field written this morning is visible on the title screen this
afternoon, as a button a child who cannot hold a key can press.

### What it cost, and the one decision inside it

- `app/index.html` carries the strip, and `#title-icons` joins `REQUIRED_MARKUP`. It is HTML rather than a
  `createElement` because the engine wants it at BOOT, and the boot runs fifteen hundred lines above where
  the strip used to be built.
- ⚠️ **BLIND MODE STOPS BEING A PRIVATE VARIABLE.** It was `let blind = false` in `main.ts`; the engine's
  new button writes to `core/state.modoCego`. Two switches for one mode is the defect the engine's own
  record describes from the other side — a reader left on a constant while the writer moved, and a mode
  that turned on once and could not be turned off. So this game reads and writes the engine's state, which
  also means the setting PERSISTS and is shared with every other Inclusionist game on the origin.
- The game's own bar keeps only what the engine has no counterpart for: the sonar sweep and the table
  palette. Its blind button is gone — not because it was dead, but because after the convergence it would
  have been the same control twice, side by side, in the one strip that has to be read at a glance.

### And the duplication it exposed

⚠️ **TWELVE BROWSER SUITES CARRIED THE PAGE'S MARKUP INLINE, each under the same comment: "the page's own
markup, as `app/index.html` writes it".** They were identical, which is what made the duplication
invisible — and then one element was added to the page and all twelve went stale in the same minute. They
are one string now, `tests/helpers/page`, and `tests/shell-boot` checks that every selector in
`REQUIRED_MARKUP` appears in the page AND in the fixture. A fixture that claims to be a copy of a file is
a claim worth checking.

## 5 · What was looked at and deliberately left alone

Named so that "not done" is not read as "not seen":

- **The engine's pause card now mounts unconditionally.** `Declinios.semMenuDePausa` was retired twice and
  reverted once; in 8.0.0 it is gone and the card is mounted at `host.pauseHost ?? #game-region`. It
  arrives HIDDEN and, measured in the engine's own sources, a mounted card eats no keys — only an open one
  owns the keyboard. This game never calls `engine.pausa.mostrar`, so it keeps its own pause menu and
  nothing opens two. ⚠️ **BUT THERE ARE NOW TWO PAUSE SURFACES IN THE SAME REGION**, and which one this
  game should show is the Dev's decision, not a migration's — he has already said the pause must carry the
  game's identity.
- **The two visual axes** (`render/viz-axes`): 7.0.0 made high contrast and colour correction possible AT
  THE SAME TIME, and this game's vision dialog still walks the sixteen single-choice modes. That is a
  feature to gain, not a break to fix — `VIZ_MODES` and `VIZ_FILTER` are still live data and still
  exported.
- **`mapeamentoDoTeclado` / `mapeamentoDoPad`** (ADR-0115): optional, and absent means the engine's factory
  keyboard stands, which is what this game already had. `shell/keymap` owns its own bindings.

## 6 · Order of work

1. The dependency and the lockfile. `tests/engine-dependency` already gates the registry and the integrity
   hash and needs only its prose corrected.
2. The two contract fields. **Born red**: three existing tests fail with the engine's own two sentences.
3. `semVozNeural`, and the shim and both aliases deleted. **Born red**: `pinballDeclines` returns `{}`
   today and a test says "this game declines nothing".
4. `baixarPesados: false`, with a gate on the options object, before any browser suite is run.
5. The sonar player's dead fields and the false comment.
6. ADR-0010 for the two decisions in §2 and §3, and ADR-0009 updated to the version it now records.
7. ⚠️ The accessibility bar of §4.5, which is not on this list because nothing predicted it: it was found
   by running the suite, not by reading the changelog.

**Done 2026-09-11.** `npm run validate` — typecheck, 219 suites, 2797 passing, 1 skipped, and the build —
comes out zero.

⚠️ **AND ONE CONSEQUENCE IS LEFT OPEN ON PURPOSE.** `accessibility.toggleBlindMode` refuses while the
demonstration has nothing to describe (`?demo=original` before the archive is handed over), because the
guide would otherwise describe the AUTHORED table over a blank screen. The engine's own button does not
go through that refusal and cannot be made to. It affects one validation-only mode; it is named here
rather than fixed, because the fix is either a dead button or a warning, and which of those it should be
is the Dev's call.

---

## 7 · The unrelated thing this work uncovered

⚠️ **THE REPOSITORY WAS RENAMED — `SpaceCadetPinball` → `game-pinball` — AND THIRTY-EIGHT TEST FILES STILL
NAME THE OLD ABSOLUTE PATH.** They read the Microsoft data out of
`C:/Users/candi/Claude/SpaceCadetPinball/game_resources/`, which no longer exists, and most of them are
written to SKIP when it is absent — that being the correct behaviour for data that is never versioned.

So they pass. They pass by proving nothing, and some of them assert it out loud:
`expect(existsSync(DAT)).toBe(false)` is now a true statement about a path that could never be true.

That is not part of this migration and it is not left for later either: it is the next commit, and its
gate is that no test names a filesystem path outside this repository.

✅ **DONE, commit `ee0ecb9`.** The location is derived from `import.meta.url` in `tests/helpers/original-data`
and `tests/no-absolute-paths` is the gate. With the archive reachable again the thirty-six suites run for
real and all of them pass — nothing had rotted behind the silence, which is luck and not evidence. One of
them could not finish: "every note is in a range an ear covers" was a loop of four assertions over 14,139
notes, 7.6 seconds against a 5-second default, and it had never been measured because it had been running
over nothing.

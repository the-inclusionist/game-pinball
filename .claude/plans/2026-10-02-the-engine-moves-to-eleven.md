# game-pinball moves to engine 11.0.0

> ⚠️ **WHERE THIS FILE BELONGS.** Plan-mode could only write here. Its home is
> `game-pinball/.claude/plans/2026-10-02-the-engine-moves-to-eleven.md`, copied there before the first
> commit. **Nothing is lost by overwriting this file:** the plan it replaces finished on 2026-09-11 and is
> preserved, pushed, at `game-pinball/docs/plans/2026-09-11-the-engine-is-used-rather-than-installed.md`.

## Context

The pinball is pinned at `^9.0.0`. The registry answers **11.0.0**, so two majors have to be crossed in
one move — `npm i` and the tree stops compiling, because a version bump is atomic.

The two releases are not ordinary majors. 10.0.0 finished ADR-0232: **no module outside the composition
root holds state**, so `core/state`, `core/i18n`, `platform/audio`, `core/a11y-sr`, `input/keyboard` and
`core/rng` stopped exporting bindings and became factories the root builds. 11.0.0 finished the i18n half
of the same record — **a game declares the KEYS of its words** — removed `sonarPlayers`, took the font
library out of the package, and made the engine's own build the CI gate for every cartridge.

The engine measured this repository while writing its migration notes and names our files by line. That is
the inventory below; nothing in it is inferred from a changelog summary.

📌 **AND THE SEPTEMBER WORK PAYS FOR ITSELF HERE.** The cartridge conversion put a seam in front of every
one of these: `shell/announce` takes its three channels by injection, `shell/boot.createPinballOptions` is
the one description of the game-owned half, `delegatingCartridge` already hands the engine a declaration
built before the game exists, and `createRng` was adopted in `f3e7489`. Most of this migration is changing
what feeds a seam, not building one.

## What breaks, measured

### A · The root owns the state (10.0.0 — notes CY, CZ, DA, DB)

| our line | what it imports | becomes |
|---|---|---|
| `app/js/main.ts:93` | `ensureAC, audioCtx, soundOn, volume` ← `platform/audio` | `ctx.engine.audio.*` (same member names) |
| `app/js/main.ts:96` | `srSay, srAlert` ← `core/a11y-sr` | `ctx.engine.say` / `ctx.engine.alert` |
| `app/js/main.ts:111` | `* as engineState` ← `core/state`, reads `modoCego` | `ctx.engine.settings.blindMode` / `.setBlindModeValue()` |
| `tests/accessibility.browser:18` | `ensureAC` | through the engine |
| `tests/the-game-speaks.browser:16` | `audioCat`, writes `audioCat.tts.on` | `engine.audio.audioCat` |
| `tests/shell-cabinet-declaration:30` | `registrarMapeamentoDoTeclado, resetKB` ← `input/keyboard` | `createKeyboardConfig({ store, mapping })` or `factoryWithGame(mapping)` |

⚠️ **Do not build a second audio or a second settings store under `createGame`** — the engine's note says
it twice: a second mixer is deaf to the panels, and a second store reads the stored settings and hears none
of the root's changes.

✅ `core/rng`, `core/entity` (`KeyScheme`), `input/default-bindings` (`KEYBOARD_SOLO`), `input/gamepad`
(`padActions`), `core/contract`, `render/viz-modes`, `render/cvd-matrices` and `core/route` are unaffected.

### B · A game declares the KEYS of its words (11.0.0 — note DN)

The largest piece. `core/i18n` keeps no state: `t`, `registerDict`, `setLocale`, `getLocale`, `initI18n`,
`localeReady` and `loadLocale` are gone.

- `app/js/standalone.ts:26` imports `bcp47, initI18n, idiomaPronto, registerDict` — **the whole prologue
  A2b built goes.** The host no longer registers anything: the game's words travel in
  `CreateGameOptions.dictionaries`, and `cartridgeDicts` (already exported, already proved by
  `tests/cartridge-halves`) is what fills it.
- `app/js/shell/cartridge.ts:46` `getLocale()` → `engine.locale()`; the page's `lang` ← `bcp47(engine.locale())`.
- `shell/preset.ts` — `ActionPreset` is now `{ [position]: { labelKey, shortKey?, hintKey? } }`. The words
  move out of `pinballPreset(t)` into `cartridgeDicts`, and the function stops needing a translator.
- `shell/boot.createPinballWorld(table, locale)` — `nameAt`/`objectiveOf` return RESOLVED words, so they
  must resolve through the **root's** translator (two translators on one page may disagree on the
  language — the reason the engine removed the module-level one). The world takes a `word`/`t` getter that
  reads the published engine, exactly as the table already delegates.
- `BootOptions.locale` and `BootOptions.t` (added in `f5199f4`) collapse into one: the locale CODE is only
  needed by `createNamer`/`nameTableOf`, and both are the game's own.

📌 **The declaration stops needing a locale at all**, which simplifies `delegatingCartridge`: its three
arguments become two (`params`, `host`).

### C · The option and member renames (11.0.0)

| ours (9.0.0) | 11.0.0 | where |
|---|---|---|
| `baixarPesados: false` | `downloadHeavy: false` | `standalone.ts`, `shell/boot` |
| `declines: { semVozNeural: true }` | `declines: { noNeuralVoice: true }` | `shell/boot.pinballDeclines` |
| `setCorrecaoDoJogador` | `setPlayerCorrection` | `shell/boot` |
| `setTemaDoJogador?: never` | `setPlayerTheme?: never` | `shell/boot` (the deliberate absence stays) |
| `GanchosDoCartucho` | **`CartridgeHooks`** | `shell/cartridge` — the engine adopted our own name; the local alias becomes a re-export |
| `engine.aoFalhar` | `engine.onFailure` | `shell/frame-loop` wiring |
| `engine.aplicarFiltroDeVisao` | `engine.applyVisionFilter` | `shell/vision` |
| `engine.pausa.mostrar` | `engine.pause.show` | nothing calls it — §7's migration condition is still untriggered |
| `engine.alcance` | `engine.reach` | §4's gate |
| `engine.sonar.guideCount` | **gone** (note DZ) | `main.ts`'s `__pinball` debug — drop the field and its gate |
| `sonarPlayers: () => [...]` | **gone** (note EB) | stop passing; the sonar takes its player at `engine.sonar.sonar(pl)` |

➕ **`accommodations` is now REQUIRED** — a closed record over eighteen entries. Answered `false` eighteen
times (the Dev, 2026-10-02), which is the engine's own way of saying «this game has no subject here»: a
`false` entry mounts no row. See the study at the end.

✅ **And the engine derives fifteen more from what our declaration already says** (`CONTRACT_KEYED`):
`gameSpeed` ← `tick === 'clock'`, `visionSimulation`/`audioDescription` ← `world().kind === 'element'`,
`blindMode`/`navigationSound` ← a world with a bearing, `virtualPad`/`oneButton`/`inputCooldown`/`macros`
← `needsPointer() === false`, `moveLatch`/`holdLatch` ← `seguraTeclas()` and the preset's positions. Every
one of those is already true of this declaration, so they arrive for nothing.

### D · The sonar reads the screen, and ours is a canvas (note DM)

A declared world with a `<canvas>` in it now gains a line in `problems`: «the sonar cannot read this game's
screen: its world draws on a `<canvas>`…». **Three gates assert `problems` is `[]`** —
`tests/accessibility.browser:271`, `tests/art-reaches-the-screen:126`, `tests/boot.browser:82` — and they
meet it on the bump.

⚠️ **They adopt the line; they do not silence it.** The note's other path — «the game writes its words as
page text in the world» — is not available to a 320×180 framebuffer without redesigning how this game
draws, and `SonarCtx.screenText` is not reachable from a game that lets `createGame` build the sonar. What
a blind child hears does not get worse: the sonar keeps the navigation sentence, which in this game is
driven by the declaration's `nameAt`/`roleAt`/`targetsOf` — the §6/§7 work. **Named in the plan as a
standing limitation, not as a fix.**

### E · The font library left the package (note DW) — small

Press Start 2P is one of the 194 families that left. ✅ **Measured: it costs us almost nothing** — this game
bundles its own `app/assets/fonts/press-start-2p.woff2` and loads it with the `FontFace` API
(`shell/title-dom:109`), never from the engine's package; only the four Atkinson faces are vendored, and
Atkinson stays an engine face.

What changes is that a sanctioned route now exists: `uses: { fonts: ['Press Start 2P'] }` plus
`inclusionist-heavy dist --fonts "Press Start 2P"`. **Worth adopting** for one reason that is not ours
alone — on the platform, six cartridges each bundling their own copy is six copies, and the library serves
it once per delivery (the ADR-0117 argument). The declaration also lets `problems` see the family.

### F · The engine's build becomes the CI gate (note DV) — required

After `npm run build`, the shared CI runs `vite build --mode cartridge` and `npx
inclusionist-check-cartridge`, **with no input to turn them off**. Our CI is red until:

1. `vite.config.ts` is wrapped — `defineGameBuild({ cartridge: 'app/js/cartridge-entry.ts', config: { …the
   app config, as it is… } })`, from `@the-inclusionist/engine/build`;
2. **`vite.lib.config.ts` is deleted** — the second config A3 built is exactly what this replaces, and with
   it the `assetsInlineLimit`/`rollupOptions.input` workaround for Vite's library-mode base64 inlining
   (the engine's build owns that problem now; verify the output is still ~324 kB with the pictures beside
   it, which is what `tests/the-cartridge-can-be-installed` already measures);
3. `app/js/cartridge-entry.ts` gains a **default export** `{ slug, declaration, hooks, create(ctx) }` — the
   checker reads `declaration` and `hooks` from it **at import**, as `createGame` does at boot;
4. `package.json`: `build:lib` → `vite build --mode cartridge`, and `exports["."]` points at
   `./dist-lib/cartridge.js` with `types` `./dist-lib/cartridge.d.ts` — which **closes the `.d.ts`
   exemption** `tests/the-cartridge-can-be-installed` currently carries, because the engine's build emits it.

⚠️ **(3) IS A REAL CONSTRAINT AND IT LANDS ON THE DELEGATE.** `declaration` and `hooks` must exist with no
arguments at import time. `delegatingCartridge(params, host)` therefore becomes the default export's own,
seeded from `tableAskedFor(new URLSearchParams())` → `DEFAULT_TABLE` (a positive extent, which is what
`conformanceProblems` demanded in `5a252ef`), and `create(ctx)` publishes the chosen table as it does now.
That makes the cartridge's declaration module-level — the tension `cartridge-entry.ts`'s header already
records between spec D14 and the contract's own shape. CI now settles it.

## The order

**Phase 0 — before the bump, green on 9.0.0.** Drop `sonarPlayers` from `createPinballOptions` (optional
and already read by nothing), drop `engine.sonar.guideCount` from `__pinball` and its gate, and rename the
local `CartridgeHooks` alias to a re-export. Small, reviewable, and it shrinks the bump.

**Phase 1 — the bump, one commit, because the compiler allows no half.** `^11.0.0` and then, in this
order: §A's six seams (mechanical) → §C's renames (mechanical) → `accommodations` → §B's i18n (the design
work) → §D's three gates. The gate is `npm run validate` at the end, exit zero.

**Phase 2 — the build (§F).** Its own commit: `defineGameBuild`, the default export, `vite.lib.config.ts`
deleted, `package.json`, and `npx inclusionist-check-cartridge` green.

**Phase 3 — the fonts (§E).** Its own commit, smallest: `uses.fonts` and the delivery flag.

📌 **Phase 1 cannot be sliced further and the plan says so rather than pretending.** Every seam in §A and
§C is a compile error the moment `^11.0.0` is installed; there is no state of the tree where half of them
compile. What keeps it reviewable is the order above and the fact that §A and §C are renames with no
decisions in them.

## Files

- `app/js/main.ts` — §A's three imports, §C's member renames, the `__pinball` surface
- `app/js/standalone.ts` — the i18n prologue goes; `dictionaries`, `downloadHeavy`, `accommodations`
- `app/js/shell/boot.ts` — `createPinballOptions` (the one description of the half), `pinballDeclines`,
  `createPinballWorld`'s translator, `BootOptions.locale`/`.t`
- `app/js/shell/cartridge.ts` — `delegatingCartridge` loses `locale`; `CartridgeHooks` re-exported
- `app/js/shell/preset.ts` — words become keys
- `app/js/cartridge-entry.ts` — the default export §F requires
- `app/js/shell/announce.ts` — **unchanged**; only its callers' source of `srSay`/`srAlert` moves
- `vite.config.ts` (wrapped), `vite.lib.config.ts` (deleted), `package.json`
- Tests: `the-shell-does-the-hosts-work` (its ledger of the host's work loses `initI18n`/`registerDict`
  and gains the new shape), `cartridge-halves` (its two-directional ledger is what will catch a dropped
  rename), `one-language`, `i18n-engine-registration`, `shell-cabinet-declaration`, `shell-preset`,
  `shell-boot`, `the-game-speaks`, `accessibility`, `art-reaches-the-screen`, `boot`,
  `the-cartridge-can-be-installed`

## 📊 The eighteen game-keyed accommodations, studied

Answered `false` for now. This is the ficha behind that answer, measured against this game rather than
guessed, so the `false` is a decision and not a blank. An entry answered `false` mounts no row; an entry
answered needs a word in three languages **and** code that honours it, because a control that cannot work
must not be offered (ADR-0106 §5).

**Has the mechanism already — cheapest to offer, if ever**

| entry | the subject in this game | what it would cost |
|---|---|---|
| `hints` | `hintFor` exists and the HUD already has a hint block (`main.ts:537`) | a setting and a read; closest to free |
| `intensity` | the comet drill's three literals: `MAX_COMETS = 3`, `COMET_LIFETIME = 10`, `SPAWN_INTERVAL = 2.6` | one knob over three constants |
| `timingWindow` | two windows: `COMET_LIFETIME` (how long to answer) and the plunger's `MINIMUM_PULL` | a knob each; they are different questions |
| `cameraSway` | the camera follows the ball on ADR-0001's four untuned constants | a knob the camera reads; note `reducedSceneMotion` is GENERAL and already offered |

**Mechanism exists, the answer is a design decision**

| entry | the subject | the catch |
|---|---|---|
| `aimAssist` | `table/plunger` jitters 10 % of the boost «so the same pull never gives the same shot twice» | reducing it IS aim assist — but the jitter is a transcribed 1995 literal, and `CLAUDE.md` says calibrated numbers are not logic to improve |
| `detectionLeniency` | the flipper and bumper hit windows in `physics/collision` | same catch: the geometry is transcription |
| `easyMode` | platform vocabulary (lower gravity, coins on the ground) | **no pinball meaning yet** — it would have to be invented, which is what ADR-0145 warns against |
| `repeatedInput` | tolerance for a repeated press | no mechanism and no obvious subject at the flippers |

**Blocked by the same wall as `setPlayerTheme`**

| entry | why |
|---|---|
| `contrastOutlines` | outlines mean repainting what is drawn, and this game's picture is a 320×180 framebuffer composed by hand — the exact reason `setPlayerTheme` is typed `never` here. Offering it would be the dead button that record refuses |

**No subject in a pinball — nine, and they are `false` permanently, not provisionally**

`wheelchairMode` (platform vocabulary), `reducedCharacterMotion` (no characters), `caneSpacing` (no cane),
`textPace` and `wordHighlight` (no paced or followed reading), `lexicalDifficulty` (the drill's difficulty
is a NUMBER, 2–9, which is `difficulty` and GENERAL), `pieceSets` and `distinguishableSuits` (no pieces, no
suits), `ownerColors` (one player).

📌 **So the real list is four cheap, four design decisions and one wall.** If any of the eighteen is ever
answered, `hints` is the one to answer first: the mechanism, the HUD block and the words already exist.

## What stays the Dev's

1. 🔴 **The slug.** `package.json` says `@the-inclusionist/game-space-cadet`; the folder and the remote say
   `game-pinball`; ADR-0082 §1 makes them one word. §F touches `exports` and still cannot publish.
2. 🔴 **`downloadHeavy`** — ADR-0010's erratum of 2026-09-11 recorded that its first driver expired when the
   service worker landed. The field is now RENAMED as well, so the erratum needs one line either way; the
   decision (leave `false`, or `apenas: [...]` for the vision runtime alone) is still open.
3. 🔴 **The PWA icons** — the brief is beside the empty field in `vite.config.ts`.
4. The four cheap accommodations above, and the four design ones.
5. The five from §12 of the finished plan: `ring-belt`, blind mode in `?demo=original`, ADR-0003, ADR-0004,
   ADR-0001.

## Verification

- `npm run validate` — typecheck, the cartridge build, the app build, the suite. **Exit code**, never
  `N passed`.
- `npx inclusionist-check-cartridge` — §F's gate, which reads the default export at import.
- **A boot over `dist`**, which is still owed from `67a1ec1` and now matters more: the engine's build is new
  to us and the i18n path changed. ⚠️ **Unregister the service worker and clear the caches first** — the
  page is a PWA and a preview serves the old precache with nothing on screen to say so. Read
  `__pinball.problems` (it should now hold exactly the sonar's canvas line and nothing else),
  `documentElement.lang`, and the network log (no off-origin request).
- The three `problems` gates are the measurement of §D; a fourth line appearing there is a real finding.
- ⚠️ **One suite at a time on this machine.**

# The engine is used, rather than installed

> Approved by the Dev on 2026-09-11, after four decisions recorded below. Sections are worked in order;
> a section is finished when `npm run validate` comes out zero and its gates are in the tree.
>
> ⚠️ **AMENDED 2026-09-11, ON THE CARTRIDGE ARCHITECTURE.** The Dev: *"Atualize o plano para que este
> trabalho contemple este material."* Five records and three documents arrived that change WHO calls
> `createGame` and WHERE the loop lives — see **Part B** at the end. Sections 1–7 are unaffected in
> substance and §§3, 9 and 10 change shape; every amendment is written into the section it touches rather
> than only collected at the end, so a reader of one section is not reading a stale one.

## Where this stands, 2026-09-11

| § | What | State |
|---|---|---|
| 1 | The record stops lying | ✅ `323696f` |
| 2 | The licence debt | ✅ `0a6174f` — **the publication blocker is discharged** |
| 3 | The loop says it stopped | ✅ `68da7dc` |
| 4 | The game says what it takes to play it | ✅ `e48090a` |
| 5 | The two engine gaps | ✅ engine half `55b71ce`, released in 9.0.0; consumer half `f5064f1` |
| 6 | What the engine thinks is on screen | ✅ `b784448` |
| 7 | The cabinet becomes a declaration | ✅ `0547271` |
| 8 | The menus become reachable | ✅ `8c6a8b3` + `9c5456f` |
| 9 | One language, chosen | ✅ `461d692` |
| 10 | The game speaks out loud | ✅ `72e82bb` |
| 12 | Left to the Dev | ⏸ ADR-0002 answered `0a6e6c0`; five open, all his |
| B | The cartridge architecture | 🛠 **in progress** — A0, A0.1, A2a, A2b done. **A2c is next and it is A1's work**: measured 2026-09-11, it needs the delegating declaration, not a move |

**Part A is complete.** `npm run validate`: 235 suites, 2891 passing, 1 skipped, build — exit zero.

✅ **AND THE RELEASE CAME: `9.0.0`, ON 2026-09-11.** It carries the four fields §5 added AND ADR-0142's
`mount()`/`unmount()`, which is why it is a major rather than the 8.1.0 §5 asked for. See **B7** for what it
changed here, which is less than a major usually costs.

## Context

`game-pinball` moved to `@the-inclusionist/engine` 8.0.0 today. The migration made the game *compile and
boot* against the new engine; it did not make the game *use* it. Measured across both trees afterwards:

- The engine's entire menu layer is installed and **switched off** by one line — `isNavigable: () => false`
  (`app/js/shell/boot.ts:272`). Escape closes nothing, the accessibility bar cannot be walked with the
  directional, and the engine's pause card sits mounted and dead inside `#game-region`.
- **The engine never speaks for this game.** `engine.tts` is untouched; the game writes `textContent` into
  `#sr-status`, which is silent unless a screen reader is already running — and the 🗨️ button now on
  screen does nothing for any sentence the game writes.
- **The game never says what it takes to play it.** `preset` is undeclared, so the engine's reach notice
  can never fire: a child on a touch-only tablet gets a table and no explanation that nothing moves.
- **Two keyboards.** The engine's remapper runs on its own factory keys; `resetKB()` restores the wrong
  cabinet. The two tables agree only by accident.
- **Three languages ship and one is reachable.** `locale: 'pt'` is hard-coded (`main.ts:621`); ~60 kB of
  `en` and `es` are in the bundle behind no door, guarded by parity gates nobody can reach.
- Two obligations block publication by the README's own words, and four written claims have gone false.

The intended outcome is that every accessibility facility the engine already carries reaches a child
playing this game, and that the records match the tree. **The table editor is out of scope** — it becomes
the game's main feature and gets its own plan next; §11 names what this plan hands it.

## The four decisions taken, 2026-09-11

| # | Question | The Dev's answer |
|---|---|---|
| 1 | Provenance of the four fixture playfields | **"Gemini, como as outras sete"** → they join `docs/LICENSES.md` §4.1 unchanged |
| 2 | Who navigates the game's own menus | **The engine navigates everything** (option 8a below) |
| 3 | Three locales, one reachable | **Follow the engine's locale**, so both halves of the screen speak one language |
| 4 | The two engine gaps | **"Adicione isso no plano para fecharmos como itens do plano, não como issues"** → §5 fixes them IN the engine |

---

## ✅ 1 · The record stops lying — DONE `323696f`

No runtime change. Four claims measurement contradicts, one comment citing a deleted module, one flake.

- `docs/LICENSES.md:109` "THERE IS ONE ASSET… AND IT IS A FONT" and `:128` "`git ls-files` still matches no
  image" — **18 binary assets are tracked** (11 playfields, 2 screens, 5 fonts). They rotted because
  `tests/licence-note` reads `CREDITS.md` and `README.md` and not this file.
- `docs/LICENSES.md:311` — the art row is still `*(no path yet)*`; three asset directories exist.
- `docs/plans/2026-09-11-the-engine-moves-to-eight.md:190-199` reads as open; discharged by `ee0ecb9`.
- `docs/plans/2026-09-07-…:317` still says "OWED" under a section the lean revert withdrew.
- `tests/table-reachable.node.test.ts:210-222` — the `KNOWN_RARE` entry for `probe.belt` justifies itself
  by `table/perspective`, **deleted in `cb28055`**. Re-measure on the straight table; correct or delete.
- `tests/table-secret.node.test.ts` crossed the 5 s default once under load (1.68 s for twelve cases in
  isolation). An explicit per-test budget carrying both measured numbers — **not** a global bump, which
  would hide the next one.

**Gates.** (a) `tests/licence-note` gains an arithmetic assertion: no claim in §4 may name fewer assets
than `git ls-files` holds. Born red on today's tree — run it before the edits. (b) A gate for ADR-0010's
own time bomb: *if a service worker or a web manifest is ever tracked, `baixarPesados: false` fails.* Born
red by mutation (add a fake `manifest.webmanifest` to the tracked set). (c) The flake's budget is proved
by mutation — drop it to 1500 ms, watch the file fail, restore, and say so in the commit.

## ✅ 2 · The licence debt, which blocks publication — DONE `0a6174f`

`README.md:119` makes the missing OFL text a publication blocker.

- **The verbatim OFL-1.1 beside the Atkinson fonts.** `app/public/vendor/fonts/OFL.txt` is a 52-line
  provenance note that declares its own debt. **The body is already in this repository, verbatim**, at
  `app/assets/fonts/press-start-2p.OFL.txt` (92 lines) — no network needed; the two bodies must be
  byte-identical below the reservation line, with Atkinson's copyright line above it.
- **The four fixture playfields.** Per decision #1, `docs/LICENSES.md` §4.4 collapses into §4.1: same
  tool, same regime, and the section says so. `docs/CREDITS.md:101-109` and `README.md:126-129` follow.
- **`app/assets/tables/LICENSE.txt` names 7 of the 11 pictures in its own directory.** The gate matches on
  *directory*, which is why four pictures ship uncovered.

**Gates.** (a) Every asset under a directory-scoped `LICENSE.txt` must be **named inside it** — born red on
the four fixtures. (b) The file beside the Atkinson fonts must carry the OFL's operative clauses, not just
its name — born red today.

## ✅ 3 · The loop says it stopped — DONE `68da7dc`

`main.ts:1333-1338` is a bare `requestAnimationFrame` recursion with no `try`. A throw inside `step()`
stops the frames in silence, and to a child in blind mode a stopped game and a thinking game are the same
thing. `engine.aoFalhar` exists for exactly this and is unwired.

`frame()` gains a `try`/`catch` that calls `shell.engine.aoFalhar(error)` and **does not re-request**.

**Gate.** `tests/loop-crash.browser.test.ts`: inject a `step` that throws once; assert `#sr-alert` carries
the engine's stop announcement, the crash box is in the document, and **no further frame runs**. Born red
trivially — today the throw escapes to `window.onerror` and the frames keep arriving.

## ✅ 4 · The game says what it takes to play it — DONE `e48090a`

`preset` undeclared ⇒ `acoesDoJogo = []` ⇒ `mostrarAvisoDeAlcance` is skipped (`create-game.ts:830`) and
`engine.alcance` is permanently `{ok:false, pedidas:0}` — a value that says "nothing fits" and is shown to
nobody.

New `app/js/shell/preset.ts` naming only the positions this cabinet uses: `action1` (launch), `action2`
and `action3` (the flippers), the shoulders and triggers, `start` (pause). **Not** the directions — the Dev
took those off the paddles — and **not** `action4`, whose absence `shell/pad.ts:136-138` already gates.
`shell/declaration.ts` gains `needsPointer: () => false`, which turns `create-game.ts:825`'s `?? false`
from a default into a statement.

**Gates.** (a) `presetProblems(PINBALL_PRESET)` is `[]` (proved by mutation: blank a label). (b) The preset
and `CABINET_OF_ENGINE_ACTION` (`shell/pad.ts:89`) are the two halves of one fact — assert they agree
**naming the literals on one side**, per CLAUDE.md's "a test that reads by the same link cannot fail".
(c) `engine.alcance.pedidas > 0` after boot — born red today and structurally unable to be anything else.

⚠️ Verify in the browser project that the notice does **not** fire under Playwright before shipping.

## ⏸ 5 · The two engine gaps, closed in the engine — ENGINE HALF DONE `55b71ce`, CONSUMER HALF BLOCKED

*Decision #4. These are additive optional fields; nothing that exists breaks.*

- **`getPauseActs` is not forwardable.** `ui/pause-icons.ts:648` accepts it, `create-game.ts:514-552` does
  not pass it, and `CreateGameOptions` has no field for it — so **every** game booted through `createGame`
  gets a pause card carrying only the three items the engine drives itself. Worse, `entrarNaBarra` calls
  `acts.resume?.()` (`pause-icons.ts:1134`), which is absent, so entering the accessibility quick bar
  leaves the card on screen over the game. **ADR-0044 item 7 is unreachable from any consumer.**
- **`setTemaDoJogador` / `setCorrecaoDoJogador` are not forwardable.** `iconesQueAccionam`
  (`pause-icons.ts:370-383`) mounts the high-contrast and colour-correction icons only for a game that
  supplies those writers; `CreateGameOptions` has no field for either, so **no game booted through
  `createGame` can ever show those two icons.** `game-pinball`'s own comment reads the outcome correctly
  and the cause wrongly: it is not that this game has its own — it is that it *could not* hand one over.

**Work:** three optional fields on `CreateGameOptions`, forwarded into the existing `initPauseIcons` call,
plus `setPauseActor` (hard-coded `() => {}` at `create-game.ts:733`). Then `npm run validate` in the engine,
a **minor** release (8.1.0), and `^8.1.0` here.

⚠️ **ANOTHER SESSION SHARES THAT WORKING TREE.** Commit directly on `main`, never branch, and re-read the
unpushed count in the instant before amending anything. `npm run` eats flags, so a release dry-run needs the
flag before the `--`.

**Gates (in the engine).** A consumer double passing `getPauseActs` gets its own items rendered — born red,
because there is no field to pass. Same shape for the two visual writers: the ⚫ and 👁 icons appear only
when they are supplied, and their absence is asserted when they are not.

**Then, here:** the pinball supplies `getPauseActs` for `resume`/`quit`/`options` so the quick bar can
resume, and supplies the correction writer (it already has one — `engine.aplicarFiltroDeVisao`, used by
`shell/vision.ts`). ⚠️ **The theme writer is deliberately NOT supplied**: high contrast is applied by
repainting textures and this game has no such world — its picture is a 320×180 framebuffer from
`composePicture()`. Writing one is a separate piece of work and is named here so "not yet" is not read as
"forgotten".

## ✅ 6 · The engine gets a truthful answer about what is on screen — DONE `b784448`

*No observable behaviour changes. This exists so that §8 is not a gamble.*

⚠️ **THE PAUSE MENU NEVER SETS `hidden`.** It opens and closes with `root.style.display` alone
(`shell/pause-menu.ts:128, 248, 362, 366`) while carrying `class="overlay"` inside `#game-region`. The
engine's only visibility test is `!o.hidden` (`ui/settings-panel.ts:237`). **So the engine believes this
game has a menu open at every instant of its life, including mid-ball** — and that, not the capture
listener, is the real mechanism of the defect `isNavigable: () => false` was set for: `navDialog` ran
against a `display:none` element whose `menuItems()` is empty, consumed the key and did nothing.

`shell/choice-dialog.ts:142-147` already does it correctly and says why both must move together. The pause
menu gets the same treatment, in one shared helper rather than a third copy.

**Gate.** `tests/engine-sees-our-screens.browser.test.ts`, a ledger over all four overlays (pause, palette,
vision, keymap): closed ⇒ `nav.sharedDialogOpen()` is `null`; open ⇒ it is that element; open ⇒
`nav.menuItems(el).length` equals the buttons the screen reports. **Born red today twice**, for two
different reasons. Run it before touching anything — its red is the evidence §8's premise holds.

## ✅ 7 · The cabinet becomes a declaration — DONE `0547271`

`create-game.ts:702-714` registers **`null`** for both mappings, so `initKB()` builds the **engine's**
factory and `resetKB()` restores the engine's cabinet, not this one. Invisible today only because
`DEFAULT_BINDINGS` (U/J/K/7/Y/8/O/Enter/H) happens to equal `KEYBOARD_SOLO` — and an accident is not an
agreement. The engine's own rule: register **before** `initKB()`, or the first boot uses one factory and the
second another, "a pior espécie de defeito, porque desaparece quando alguém vai ver".

`shell/declaration.ts` gains `mapeamentoDoTeclado` and `mapeamentoDoPad`; `shell/boot.ts` passes `players`.
Nothing about how a key is *read* changes — `main.ts:1583-1586` already bridges through
`engine.keyboard.actionOf` + `CABINET_OF_ENGINE_ACTION`. What changes is who owns the table.

⚠️ **`pinball:keymap` gets a read-once migration into the engine's store rather than being discarded.** A
saved remap belongs to a child who needed one; fifteen lines is cheaper than asking them to do it again.

📌 **MOVED TO §8, ON A DEPENDENCY THIS SECTION DID NOT SEE.** Retiring this game's store means its remap
dialog stops being the one a child reaches and the ENGINE's panel becomes it — and that panel is
unreachable while `isNavigable` answers `false`. Migrating first would leave a child with a store nothing
writes and a screen nothing opens.

⚠️ **AND THERE IS NO CONFUSION TO FIX YET, WHICH IS WHY THE ORDER IS SAFE.** Two stores exist, but exactly
ONE remapper is reachable today — this game's. The «two remappers, one child» defect is CREATED by §8, so it
is §8's to close, in the same commit that opens the door.

📏 **RE-MEASURED AFTER §8 LANDED, AND IT IS STILL NOT OWED.** §8 switched the predicate on and did NOT
close this, which would be a loose end if the premise had changed — so it was checked rather than assumed.
The engine's remap panel lives inside the engine's PAUSE CARD, behind its `options` item; the card is
mounted hidden and **nothing in this game calls `engine.pausa.mostrar`** (`git grep` over `app/js` returns
nothing). A player still cannot reach the engine's remapper, so there is still exactly one, and migrating
the store would move a child's saved keys to a screen they cannot open.

⚠️ **THE CONDITION IS NAMED SO IT CANNOT PASS UNNOTICED:** the day anything in this game opens the
engine's pause card, the migration is owed in that same commit.

⚠️ The sweep and the palette keys stay OUT of the declaration — they are not `KeyScheme` positions, and
inventing a shared-vocabulary slot for one pinball's accessibility keys is the wrong place to put them.

**Gate, proved by mutation because the tables agree by accident.** Register the mapping, run
`initKB()`/`resetKB()`, assert the engine's `kb` equals `DEFAULT_BINDINGS` through
`CABINET_OF_ENGINE_ACTION`. Then change `DEFAULT_BINDINGS.plunger` from `KeyU` to `KeyP`: before the stage
the engine's `kb` does not move, after it `resetKB()` yields `KeyP`. Say in the commit that this is how the
red was obtained. Second gate: `conformanceProblems(declaration)` stays `[]` — a malformed declaration
**throws** at `createGame`.

⚠️ Most entangled cluster in the repository: `shell/controls.ts` is imported by 11 modules and 11 test
files. Any test that needs changing is telling you something.

## ✅ 8 · The menus become reachable — DONE `8c6a8b3` + `9c5456f`

*Decision #2: the engine navigates everything. Last, because §6 and §7 are what make it survivable.*

`isNavigable` stops being a constant and answers what is on screen:

```
isNavigable: () => anEngineSurfaceIsUp() || oneOfOurRegisteredOverlaysIsUp()
```

The engine's guard order already protects the game: `menu-nav.ts:469-481` consumes a key **only if there is
something to navigate**, so a true predicate over a page with nothing open costs nothing. What it used to
cost was §6's permanently-visible pause menu.

⚠️ **`setPhase` MUST BE DECLARED IN THE SAME COMMIT.** `navPause`'s root-level "no" calls
`ctx.setPhase('playing')` (`menu-nav.ts:403`), and `create-game.ts:732` defaults it to `() => {}` because
this game declares none. Reopening the predicate without it gives a child a menu with no way out — reached
by exactly the child who most needs one. One line, not optional.

`ownCabinetKeys` comes off the dialogs the engine now drives. The reward arrives without being written:
Escape actually closes them (the thing `shell/choice-dialog.ts:13-16` records as promised and never
delivered), ring-walking, focus management, the "N of M" announcement, and the pad in menus.

**Prove it on ONE dialog first — the palette, the smallest with the clearest close — ship, then extend.**

**Gates**, all born red today, in the browser project:
1. With nothing open and a ball in play, every cabinet key still reaches the table (J, K, U, 7, Y, 8, O).
   ⚠️ Write it first against a forced `isNavigable: () => true`, watch it fail on §6's defect, then watch
   §6 turn it green. That sequence is the proof and belongs in the commit message.
2. ~~Escape over the palette closes it.~~ 🔴 **MEASURED 2026-09-11 AND THE PREMISE WAS WRONG: IT ALREADY
   CLOSES.** `shell/choice-dialog:232` binds its own `keydown` for Escape and the paragraph above it says
   so — "Escape is handled HERE, not by the engine, though this dialog is registered with the engine's
   chain and should be". The header sentence this prediction was built on ("pressing Escape over the open
   dialog did nothing") is about a ball IN PLAY, where the engine's chain does not run; with the dialog
   open, the game has always answered. So §8 buys the palette the directional, the pad, the «N of M»
   announcement and the accessibility bar — not Escape — and switching the engine on while the game's own
   listener stays would be TWO handlers on one key, which is the thing this section exists to avoid.
3. The engine's pause card opens, is navigable, and is **exitable** — root + "no" returns to play.
4. Both menu systems never own the cabinet at once.

⚠️ `menu-nav.ts:60-81` warns that removing the capture-phase `stopPropagation` lets Escape fall through to a
bubble listener that unpauses with a dialog still open. This game's bubble listener does not bind Escape, so
the trap should not fire — **confirm by pressing the key, not by reading that sentence.**

## ✅ 9 · One language, chosen — DONE `461d692`

*Decision #3.* `locale: 'pt'` is hard-coded and there is no `?lang=`; `en` and `es` ship behind no door.

The game's translator stays a **value** rather than a global — that is what makes every string testable
without a browser, and it is the half of `i18n/index.ts`'s reasoning that has not expired. What changes:
the game registers its dictionaries with the engine (`registerDict`, `core/i18n.ts:43`) and takes its locale
**from** the engine, so the mounted bar, the pause card, the reach notice and the HUD speak one language.

Depends on §8: the engine's language control lives in a panel that is unreachable until the menus are.

**Gates.** (a) `registerDict` returns `[]` for all three locales — a non-empty return is a key collision
between this game's 212 and the engine's 558, and a collision means one surface silently starts speaking the
other's words. Proved by mutation: register a key named `sr.laco.parou`. (b) After boot, the engine's
`getLocale()`, the game's locale and `document.documentElement.lang` agree. Whether this is born red is a
**measurement, not a prediction** — run it first and report the answer.

⚠️ Ordering: registering before `initI18n` may be overwritten; after, the boot-time bar mounts in the
engine's words. `create-game.ts:602` shows the engine's own answer — `idiomaPronto().then(...)`. Use that
handle rather than inventing a second one.

## ✅ 10 · The game speaks out loud — DONE `72e82bb`

*Placed last of the runtime stages because it is the one a player hears, and it wants the rest working.*

Five sites write `textContent` into the live regions (`main.ts:430, 461, 497, 617, 1540`). Two defects, not
one: they are silent without a screen reader, **and** they skip the engine's clear→`rAF`→write pattern
(`core/a11y-sr.ts:14`) that forces a re-announce of repeated text — two identical comet reports in a row are
announced once today.

One seam, `app/js/shell/announce.ts`, replacing all five, taking its three functions by injection so it is
testable in the `node` project:

```
srSay(words)   → live region, Libras, re-announce on repeat
narrate(words) → spoken through the mixer, gated by audioCat.tts.on
```

Both fire, which is the engine's own precedent (`audio-sonar.ts:398`).

⚠️ **Double-speaking is a non-problem by construction and the reasoning belongs in the header.** `narrate`
does not write the live region (`platform/tts.ts:190-192`) and `srSay` does not speak — the two channels
cannot collide. The only way to hear a sentence twice is to run a screen reader **and** deliberately press
🗨️; screen-reader presence is undetectable in a browser and every scheme that claims otherwise is wrong
about somebody. `audio-mixer.ts:49` puts `tts` in `NASCEM_DESLIGADAS`: the voice is off until a child turns
it on, with the same icon that turns it off.

⚠️ Only EVENTS go through this seam. The HUD blocks are deliberately not live; do not let it grow a third
caller that is really a status read.

**Gates.** Node: both channels get the same words; the assertive one goes to `srAlert` and not `srSay`; a
repeated identical sentence reaches the live region **twice**. Browser: with `audioCat.tts.on`, an
announcement increments `engine.tts.narrateCount` (`tts.ts:198` exposes it for exactly this). Born red — the
node gate cannot even be written against today's code, because there is no seam.

## 11 · What this hands the editor plan

- §6 gives it the rule every overlay must follow to be visible to the engine. Getting this wrong in a screen
  with far more buttons is the same defect, larger.
- §7 gives it a cabinet that is a declaration, so an editor screen can ask the engine what a key does.
- §8 decides who navigates menus. **Made once here and inherited, not made twice.**
- §9 gives it one dictionary to register into rather than two to keep in step.
- `table/parts.ts` stays a sanctioned orphan until the editor lands — `tests/no-unsanctioned-orphans:42-53`
  is the line that says somebody wrote a library nobody uses, and the editor is what discharges it.

## ⏸ 12 · Left to the Dev, named rather than assumed — ONE ANSWERED (`0a6e6c0`), FIVE OPEN

None of these blocks a stage above; each is a decision only he can take.

1. **`ring-belt` owes a re-authoring.** `tests/table-reachable.node.test.ts:186-220` — four `KNOWN_RARE`
   entries, all on that table, and the file's own rule is that a ledger that empties is the only kind worth
   keeping. "Re-authoring them is a piece of work on his table and not a constant to turn."
2. **Blind mode in `?demo=original`.** `toggleBlindMode` refuses while the demonstration has nothing to
   describe; the engine's own button does not go through that refusal and cannot be made to. Dead button or
   warning — his call. The shipped strings `pinball.a11y.unavailableInDemo` and `pinball.demo.caveat` are
   the player-visible half of it.
3. **ADR-0003** — an exception the record itself forbids, taken and unratified (`:158-175`). Ratify, or wire
   `makeLinks` and delete the per-kind wiring.
4. **ADR-0004** — the settings menu sits outside the 320×180 screen; the record says this is an open
   question for the Dev rather than a decision taken.
5. **ADR-0002** — the HUD block sizes were derived from a font that did not exist; it landed on 2026-09-07
   and nothing records whether the numbers moved.
6. **ADR-0001** — four camera constants with no principled derivation, tuned for the 1995 playfield. They
   want a session of play on the authored tables.

---

## Verification

Per stage, and none of it is optional:

- `npm run validate` in `game-pinball` (typecheck + vitest node & browser + build) **must exit zero** —
  validated by exit code, never by reading `N passed`.
- For §5, `npm run validate` in `the-inclusionist-engine` before the release, and again here after the bump.
- Every gate either **born red and observed red**, or **proved by mutation with the mutation stated in the
  commit message** — CLAUDE.md's rule, and §§1, 4, 7 and 9 each name which of the two they use.
- **Boot over `dist` in the Browser pane** after `npm run build`, for every stage with a visible surface
  (§4 reach notice, §5 icons, §8 menus, §9 language, §10 voice): read `__pinball.problems` (must be empty),
  read the accessibility tree rather than trusting a screenshot, and check the network log — no CDN request
  may appear, which is `baixarPesados: false` seen rather than assumed.
- §8's regression gate is the one to run by hand as well as in CI: with a ball in play and nothing open,
  press J, K, U, 7, Y, 8, O and watch the flippers and the plunger move.
- Commits directly on `main` in both repositories; another session shares both working trees.

---

# 📋 Part B · The cartridge architecture, folded in — RECORDED, NOT SCHEDULED

> Read on 2026-09-11 at the Dev's instruction: `the-inclusionist-site/docs/{cartridge-brief,
> cartridge-contract,architecture}.md` and **ADR-0117, ADR-0139, ADR-0140, ADR-0141, ADR-0142** in
> `the-inclusionist-docs`. **Those records win wherever this plan disagrees with them.**

## B0 · What changed, in one paragraph

A game stops being a unit of installation. **The site is the PWA** (ADR-0117); a game ships TWO artefacts
from one source (ADR-0140) — a standalone PWA *and* a cartridge — and **a cartridge never calls
`createGame`** (ADR-0139): it exports its `GameDeclaration` and the game-owned half of the options, and
whoever hosts it calls `createGame` once. The engine gains `mount(declaration, hooks)` / `unmount()`
(ADR-0142), and a cartridge draws randomness only from `ctx.rng` (ADR-0141).

## B1 · ⚠️ THE WAIT IS OVER — THE DEV OVERRODE IT ON 2026-09-11

> **The Dev:** *"Não é pra esperar o whackwhack. Continue."*

The brief's ordering advice is his to set aside and he has. What does NOT go away with it is the one thing
the brief said must not be invented and that still has no answer:

🔴 **THE SLUG.** `Cartridge.slug` is required and `ADR-0082` §1 makes it the same word as the repository
and the package. The folder says `game-pinball`, the remote says `game-pinball`, and `package.json` says
`@the-inclusionist/game-space-cadet`. Two of three agree; the third is the published name and changing it
is a publishing decision. **This is the Dev's, and B6 stops at it rather than guessing.**

⚠️ **AND WHAT THE REGISTRY ANSWERS IS 8.0.0, WHICH IS OLDER THAN THE ENGINE'S OWN TREE.** `mount()`,
`GanchosDoCartucho` and the four fields §5 added all live at engine HEAD and none of them is published. So
the conversion targets what a consumer can actually install: the cartridge SHAPE comes from
`cartridge-contract.md`, declared in this repository, and nothing here imports `mount`.

📌 And the engine has already answered one of the contract's four open questions from the inside:
`MetadeDoJogo` puts **`declines` in the game's half**, alongside the four fields §5 added.

## B6 · The conversion, in slices that each leave the suite green

⚠️ **`app/js/main.ts` IS 2350 LINES WITH 24 MODULE-SCOPE `let`, AND WRAPPING IT IN ONE MOVE IS HOW A GREEN
SUITE BREAKS.** Fifteen browser suites boot that file. The slices below are ordered so that every one of
them is separately verifiable, and so that the mechanical risk is taken alone rather than mixed with a
design decision.

| # | Slice | What proves it |
|---|---|---|
| **A0** | `app/js/cartridge.ts` — the identity, the dictionaries and the game-owned HOOKS, as one exported object | a gate that the hooks EQUAL what `createPinballOptions` hands `createGame` today, so the split is proved before anything moves |
| **A1** | The factory: the body of `main.ts` becomes `create(ctx)` returning `{ update, teardown }`, with `main.ts` still calling it at import | the whole existing suite — identical behaviour is the claim, and 232 files are the check |
| **A2a** | ✅ `e3be145` — the seam: `bootPinball(o, engine)` receives the ENGINE instead of the factory that makes one, so the `createGame` call is one named line in the caller rather than buried in the boot | the whole suite, plus `tests/shell-boot` asking the BUILDER for the declaration instead of reading it back out of a fake engine |
| **A2b** | ✅ `b28fb85` — `app/js/standalone.ts` takes the host's half: `initI18n`, `registerDict` over the cartridge's exported dictionaries, `idiomaPronto()` and the page's `lang`. `app/index.html` loads it; the seventeen browser suites boot through it | `tests/the-shell-does-the-hosts-work`, born red five times over. 🔴 And `tests/one-language` caught `documentElement.lang` going unwritten — a regression invisible in source and visible in a browser |
| **A2c** | `createGame` leaves the cartridge entirely, with the loop. 🔴 **MEASURED AND IT IS NOT A MOVE — see below** | the same suite, plus that nothing in `app/js` calls `createGame` any more |
| **A3** | `package.json` — peer + dev dependencies, `exports`, `files`, `private` removed; `vite.config` gains the `lib` target | the lib build produces an ES module that externalises the engine |
| **A4** | `vite-plugin-pwa` on the app build | ⚠️ **§1's GATE FIRES HERE, BY DESIGN** — a tracked service worker with `baixarPesados: false` is refused until ADR-0010 is reopened |

### 🔴 A2c measured, 2026-09-11: the obvious cut does not exist

**The cut was attempted and reverted, and what it found is worth more than the attempt.** The natural
boundary is the line `const shell = bootPinball(…)`: everything above it is what a game can answer alone,
everything below needs an engine. Splitting there into two function scopes produces **forty compile
errors**, because **twenty-three bindings are declared BELOW the cut and referenced ABOVE it**:

```
shell  announce  screen  region  tablePicture  audio  board  backdrop  notThere  laneDepths  live
hint  step  cabinet  enterPhase  accessibility  screens  title  leaveGame  vision  applyVision
highScores  hud
```

Every one of those references is inside a closure that runs long after the body has finished, which is
why the game works and why one scope was the right shape for a single-artefact game. It is also why the
two halves cannot simply become two functions: the upper half's `bootOptions` reads `applyVision`
(declared at 2052) and `enterPhase` (1575), so even the OPTIONS object cannot be built before the body
that follows it has been declared.

⚠️ **AND THE CONTRACT RULES OUT THE WORKAROUND, WHICH IS THE USEFUL HALF OF THE MEASUREMENT.**
`cartridge-contract.md` makes `Cartridge.declaration` a **value the host reads BEFORE `create(ctx)` runs** —
`createGame` takes it and calls `conformanceProblems` on it once. So there is no ordering in which this
game chooses its table first and hands over a finished declaration: the table comes from `ctx.params`,
and `ctx` does not exist until after `createGame`.

📌 **THE CONTRACT ALSO NAMES THE ANSWER, UNDER "the one hard problem".** Option (a): *"a delegating
declaration — a declaration whose every member forwards to the mounted cartridge"*, which it says works
today with no engine change. This plan reached the same shape independently (the note under the slice
table), and this game is already built for it: `createPinballWorld` returns GETTERS, and `ADR-0084` is the
precedent for a `topology` that is recomputed rather than fixed.

**So A2c is A1's work, and the slice table had them in the wrong order.** What it actually takes:

1. a stable `declaration` exported from `shell/cartridge`, forwarding to whichever instance is current;
2. `createPinball` becoming `create(ctx)`: reading `ctx.params` instead of `location.search`, `ctx.rng`
   instead of the five `Math.random` seams, `ctx.region` instead of `#game-region`, and publishing its
   world into the delegate;
3. only then does `createGame` move to the shell, because only then does the shell have a declaration to
   hand it.

⚠️ **AND THE GATE FOR IT IS WRITTEN DOWN RATHER THAN LEFT RED.** `tests/the-shell-does-the-hosts-work`
holds the ledger of the host's work and `createGame(` belongs in it; the file says in a note why it is not
there yet. A gate that stays red for three commits teaches a reader to run the suite with one known
failure, which is how the next real one gets waved through.

📌 **A2 SPLIT IN THREE WHILE IT WAS BEING DONE, AND THE REASON IS THE ROW ABOVE IT.** A2a moved a seam,
A2b moved the language, A2c moves `createGame` — three commits, each separately reversible, where one would
have mixed a mechanical move with a design decision and left no way to tell which half broke the suite.
A2b is the one that proves the value of that: its own regression was a single line that no source-reading
gate could see, and it was caught because the browser suites still ran unchanged around it.

⚠️ **AND A2b MADE ONE MEASUREMENT HONEST THAT WAS ABOUT TO BECOME LOAD-BEARING.**
`tests/no-unsanctioned-orphans` matched only `from '…'`, so a dynamic import counted as nothing. The shell
loads the cartridge with `await import('./main.js')` — it has to, because a static import hoists above the
registration it exists to run first — so `main.ts` would have stayed in the ledger as "imported by nobody"
while being imported on every boot, with the entry underneath reading as verified. The scanner counts
`import(` now, and `shell/cartridge` left the ledger exactly as its own entry had promised.

⚠️ **THE DECLARATION IS THE ONE DESIGN PROBLEM, AND IT IS IN A1.** `Cartridge.declaration` is a value, and
this game's declaration is built from a LIVE world that does not exist until `create(ctx)` has read
`ctx.params` and chosen a table. The answer is the shape this game already uses: `createPinballWorld`
returns GETTERS, so the exported declaration delegates to whatever instance is current — which is also what
the engine did to itself for `mount()` (`let cartucho: MetadeDoJogo = o`). Not invented: copied from the
two places that already solved it.

## B1-old · What the brief said, kept because the reasoning is still worth reading

The brief is explicit, on ADR-0068 §6: one game goes end to end first, that game is **whackwhack**, and
*"if you are not whackwhack, wait for the contract to come back with its holes filled."* The contract
itself lists four things it says must not be invented — including the exact shape of `ctx` and whether
`declines` is host-owned or game-owned, which is a field **this plan already wrote into `ADR-0010`**.

**So Part B is not scheduled work.** It is what §§1–10 must not contradict, plus the inventory that the
conversion will start from. The conversion begins when the Dev says whackwhack has landed.

## B2 · What §§1–7 got right, measured against the contract

Worth stating, because it is most of the plan: **the game-owned half of `CreateGameOptions` is exactly
what §§4, 7 and 8 have been filling in.** `CartridgeHooks` is `isNavigable`, `comIndice`, `naBarraDe`,
`navBar`, `players`, `setPhase`, `sonarPlayers`, `isBlindMode`, `preset` — and `preset` (§4), `players`
(§7), `isNavigable` and `setPhase` (§8) are four of the nine. None of that work is wasted or misplaced;
it moves from an options object into a `hooks` object, unchanged.

§6 is load-bearing in the same way: a cartridge that leaves a node outside its `region` is the defect
`teardown` exists to prevent, and a screen the engine cannot tell is shut is the same class of thing.

## B3 · What Part A has to be corrected about

### §3 — the frame loop belongs to the SHELL

⚠️ **"A cartridge never calls `startLoop`"**, and six cartridges each opening a `requestAnimationFrame`
is six loops fighting over one frame. §3 put the loop into `shell/frame-loop` and wired `engine.aoFalhar`
to it. 📌 **AND THAT IS WHY IT IS A MODULE**: the extraction §3 made for testability is exactly the move
the conversion needs — `startFrames` goes to `src/standalone.ts` and the cartridge exposes `update(dt)`.
The `aoFalhar` wiring stays right where the contract puts it: *"the shell wires it to `srAlert` and to
something visible"*, which is spec D16.

### §9 — a cartridge EXPORTS its dictionaries and never registers them

The contract: `dicts` is *"registered by whichever shell loads this cartridge; a cartridge never registers
its own"*. §9 says the game calls `registerDict` itself. ⚠️ **THAT IS NOW HALF WRONG**: the standalone
shell registers them, the platform registers them, and the game exports them. The locale half of §9 —
taking the language from the engine instead of hard-coding `'pt'` — is unchanged and becomes MORE
necessary: on the platform the language is the site's.

### §10 — unchanged, and the seam is in the right place

`core/a11y-sr` and `core/i18n` are named in the contract as *"what stays a deep import"*, because they
hold no module state. §10's `shell/announce` seam takes its three functions by injection, which is what a
`ctx`-shaped world wants anyway.

### ADR-0010 — its `bad` consequence is coming true on schedule

That record wrote a defect against itself: *"`baixarPesados: false` IS A DEFAULT REFUSED, WHICH IS THE
KIND THAT ROTS QUIETLY. If this game gains a service worker and nobody reopens this record, the flag will
go on refusing a download that by then WOULD have a reader."*

⚠️ **THE BRIEF REQUIRES A SERVICE WORKER**: *"Be a PWA in standalone mode... Adding `vite-plugin-pwa` to
the app build is part of this work."* 📌 **AND §1's GATE WILL FIRE THE DAY IT LANDS**, by construction — it
refuses a tracked `sw.js` or `.webmanifest` while the flag is false. That is the gate working, not a
nuisance, and the record is reopened then rather than edited now.

Two halves to answer at that point, and they are different:
- **Standalone**: a PWA with a service worker HAS a reader for that cache. The flag's reason expires.
- **Cartridge**: the question does not arise — the pinball will not call `createGame`, so `baixarPesados`
  is the platform's field. ADR-0117 §2: *"the platform loads the accessibility stack ONCE."*

⚠️ **AND `declines.semVozNeural` MAY BE ON THE WRONG SIDE OF THE LINE.** The contract lists `declines`
among the four things *"open, and not to be invented"* — host-owned or game-owned is undecided. ADR-0010
put it in the game's hands. If it turns out host-owned, that record needs an erratum, not a reversal: the
DECISION (no neural voice here) stands either way; what moves is who says it.

## B4 · The inventory, measured 2026-09-11

What the conversion will start from, so nobody has to measure it twice:

| Rule | This repository today |
|---|---|
| No module-scope `let` (spec D14) | 🔴 **24 in `app/js/main.ts`** — and `main.ts` is 2300 lines that boot on import |
| A cartridge never calls `createGame` | called through `bootPinball` (`shell/boot.ts`), which becomes `src/standalone.ts` |
| A cartridge never calls `startLoop` / owns no rAF | `startFrames` in `shell/frame-loop` — §3 already made it a module that takes its clock |
| Never import `rnd`/`randInt`/`shuffle`/`reseed` | ✅ **zero imports of `core/rng`** — measured; this game never reached for the shared stream |
| Randomness comes from `ctx.rng` | five modules use `Math.random`, all behind an injectable `random` option: `physics/step`, `physics/stuck`, `control/comet-mission`, `control/power-ups`, `audio/midi-player` |
| A cartridge reads `ctx.params`, not `location.search` | read in `main.ts` only — `?table=`, `?times=`, `?demo=original` |
| Export `dicts` | `app/js/i18n/` is a value-returning translator already; the dictionaries are exported, the REGISTRATION is what moves |
| Two build targets, `peerDependencies`, `exports`, no `private` | none of it yet; `package.json` is `private: true` |
| PWA in standalone mode | no service worker, no manifest — see ADR-0010 above |

## B5 · Two things the brief says about this repository that are now stale

1. ⚠️ **"pinball: it has no git remote at all"** — it has one since 2026-09-11:
   `github.com/the-inclusionist/game-pinball`, private, `main` tracked.
2. ⚠️ **"its slug is undecided — the package says `game-space-cadet`, the folder says `game-pinball`, and
   ADR-0082 §1 makes them the same word."** Still true, and it is now a BLOCKER rather than an untidiness:
   `Cartridge.slug` is a required field and the contract says it *"matches the repository and the package
   name"*. The remote fixed the folder half; the package name is the Dev's to choose, and this plan does
   not choose it.

## B7 · Engine 9.0.0, and what it actually costs this game

> **The Dev, 2026-09-11:** *"a engine teve update para versão 9.0.0. Estude-a. E adicione as adaptações
> necessárias ao plano."*

✅ **THE BUMP IS DONE AND IT COST NOTHING**: `^9.0.0` installed, typecheck clean, 234 suites, 2879 passing,
build — exit zero, with **no source change at all**. Only `package.json` and the lockfile moved.

### The two breaking changes, and why neither reaches here

| Break | Who it reaches | This game |
|---|---|---|
| `Engine` gains two REQUIRED members, `mount(declaration, ganchos?)` and `unmount()` | "anyone implementing `Engine` by hand" | ✅ untouched. `shell/boot`'s `EngineLike` restates only `problems`, so the assignability runs the safe way: the engine must satisfy US, not the other way round |
| `EscritoresVisuais.seguraTeclas` and `PauseIconsCtx.seguraTeclas` become `() => boolean` | "a consumer that builds a pause-icons context by hand" | ✅ untouched — this game never calls `initPauseIcons` |

📌 **AND THAT NARROW SEAM IS THE SAME ONE §1 MEASURED.** Two majors ago the whole 6→8 jump cost one compile
error, for the reason `shell/boot`'s header gives: the engine's option types are restated at the boundary
and `main.ts` imports `createGame` directly, so the two are checked against each other. A third major has
now cost zero.

### What 9.0.0 UNBLOCKS

1. ⚠️ **§5's CONSUMER HALF STOPS BEING BLOCKED.** `getPauseActs`, `setPauseActor`, `setTemaDoJogador` and
   `setCorrecaoDoJogador` are in the published package — verified in `dist-pkg`, not assumed from a
   changelog. So this game can now:
   - supply `getPauseActs` for `resume`/`quit`, which is what lets `entrarNaBarra` leave the engine's card
     before handing the directions to the accessibility bar (ADR-0044 item 7, unreachable until now);
   - supply `setCorrecaoDoJogador`, which mounts the 🚥 icon — this game already HAS a correction writer
     (`engine.aplicarFiltroDeVisao`, used by `shell/vision`);
   - ⚠️ and still NOT supply `setTemaDoJogador`, deliberately: high contrast is applied by repainting
     textures and this game's picture is a 320×180 framebuffer. The ⚫ icon stays absent because the game
     cannot honour it, which is the rule working.

2. 📌 **`GanchosDoCartucho` IS PUBLISHED, WHICH MAKES ONE OF MY OWN NOTES STALE.** `shell/cartridge` declares
   `CartridgeHooks` locally and says why: *"`GanchosDoCartucho` lives at engine HEAD and the registry
   answers `8.0.0`, which is older."* It does not any more. The local type becomes a second description of
   a published one — the exact shape this repository keeps paying for — so slice **A0.1** replaces it with
   the import, and `tests/cartridge-halves` is what proves the swap changed nothing.

3. **`mount()`/`unmount()` exist for the HOST, and this repository is not one.** A cartridge never calls
   either; the standalone shell of slice A2 calls `createGame` once and does not swap cartridges. They are
   named here so the next reader does not go looking for a use.

### Revised order

`A0.1` ✅ `36a4962` (the published hooks type) → `§5-consumer` ✅ `f5064f1` (the two writers and the
pause acts) → `A2a` ✅ `e3be145` → `A2b` ✅ `b28fb85` → **`A2c`** (`createGame` leaves the cartridge) →
`A3` → `A4`. §5's consumer half jumps the queue because it is small, it was already designed, and it is
the one piece that reaches a child directly: it is what puts the colour-correction icon on the bar.

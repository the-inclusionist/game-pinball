# The ball rolls, and the picture leans

Two changes the Dev decided on 2026-09-07, planned together because the second is only worth looking at
once the first has stopped the ball freezing in place.

> **A.** "Aplicar o atrito por impacto e reautorar as mesas — a bola rola e desce ladeiras; em troca,
> slipstream, ring-belt, factory e crater-run precisam ter os bolsos fechados."
>
> **B.** "O caminho certo é uma camada viva: desenhar essas seis coisas numa segunda framebuffer em
> coordenadas de mesa, compor com tablePicture, e aí aplicar a homografia uma vez na janela de 320×180."

They are independent: A is physics and table authoring, B is the renderer. A goes first, because every
measurement B needs is taken by playing.

---

## Part A — the ball rolls

### A0 · The diagnosis, in one paragraph

`physics/collision` transcribes `TBall::Collision`: `v' = smoothness · v_tangential + elasticity ·
v_normal`. A wall's smoothness is 0.1, so **nine tenths of the along-surface speed is destroyed by a
touch** — survivable for a ball that bounces off a wall once, fatal for a ball RESTING on one, because a
resting ball collides every frame. Sixty times a second. The steady state on a 30° slope is 0.43 units a
second, which is the Dev's screenshot of `ring-belt`: "a bolinha simplesmente congelou-se embaixo ao
invés de rolar pela ladeira."

The model is what is wrong, not the number. Friction is proportional to the NORMAL IMPULSE — a hard
perpendicular hit presses the ball into the surface and scrubs its sideways speed; a ball sitting still
presses on it with almost nothing. Reading `1 − smoothness` as that coefficient and multiplying it by
the impact **agrees with the transcription exactly at 45°**, differs invisibly on steeper hits, and lets
go only where the old model was wrong: a graze, and a slide.

### A1 · Land the model

Written and measured already; saved as `friction-and-roll.patch` with its gate.

| file | change |
|---|---|
| `physics/collision` | `CollisionResponse.frictionByImpact?: boolean`, and the branch that uses it |
| `table/physics-build` | every entry of `RESPONSES` opts in — the constants do not move |
| `tests/a-ball-rolls-downhill` | new gate, born red: the ball moved 8.3 units of a frictionless 30 |

⚠️ **The 1995 table does not opt in.** It is a transcription being validated against the Dev's own
archive, and its elasticity and smoothness come out of `PINBALL.DAT`. This is the third labelled
deviation and it applies to our tables only.

### A2 · The instrument: a resting survey

The re-authoring is finite only if something can say when it is finished. `tests/table-rests` (new)
launches twelve balls per table at powers from 55% to 100%, flaps the flippers every 24 frames like a
player who never stops, runs twenty seconds, and reports **where a ball is still standing at the end**.

Each resting place is one of:

- **the plunger** — a weak launch fell back into the lane and is waiting to be fired again. Legitimate,
  and it is what the launcher is for.
- **cradled on a raised flipper** — legitimate; it is what a real player does on purpose.
- **anything else is a pocket**, and it is the list this part of the work burns down.

The survey replaces guessing with a number that goes to zero. It is also the regression gate: a table
edited later cannot quietly grow a new pocket.

### A3 · What the survey says today

Measured with the patch applied, on the leaning tables at `25327c8`:

| table | drained | resting on the plunger | pockets |
|---|---|---|---|
| low-orbit | 3/12 | 7 | 1 — `(60,88)` between `drone.high` and the drop bank |
| ion-storm | 2/12 | 6 | 4 — the divider at `(140,132)`, `guide.right` twice, `wall.left`/`shelf.west2` |
| crater-run | 4/12 | 6 | 2 — `(140,140)` at the divider, `(96,76)` on `ramp.right` |
| long-climb | 3/12 | 6 | 3 — `inlane.right`, `guide.right`/`ramp`, and one in open air at `(56,140)` |
| ring-belt | 1/12 | 6 | 5 — `edge.east`, both guides, the left flipper's crook, one in open air |
| slipstream | 3/12 | 6 | 3 — `meteor` twice, `guide.right`/`probe.voyager` |
| factory | 5/12 | 6 | 1 — `(40,208)` on the `ramp` |
| wide-arc | 0/12 | 0 | 12 — a fixture with almost no furniture; the guides hold most of them |
| narrow-tower | 0/12 | 0 | 12 — same, and it is 420 tall |
| four-flippers | 12/12 | — | none |
| bare-minimum | 12/12 | — | none |

⚠️ **HALF OF EVERY TABLE'S BALLS ARE RESTING ON THE PLUNGER, AND THAT IS THE LAUNCHER WORKING.** It is
the single most important line in this table and it is not a defect: a launch that does not clear the
lane comes back down and lands on the rod, exactly as `table/cabinet`'s plunger face was written to make
it. The survey has no player pressing the key, so it stays there.

That reframes most of Part A's supposed damage. Of the twelve gates that went red, the majority are
gates that assume a ball is never at rest — written when nothing could rest anywhere, because everything
crept. They need a player, not a table edit.

⚠️ **AND TWO BALLS ARE RESTING IN OPEN AIR**, on `long-climb` and `ring-belt`, with no component within
eight units. That is either a resting place on a collision line whose `bounds` is somewhere else — which
is legal and only means the survey's naming is thin — or a ball at rest in mid-air, which would be a
physics defect and would be the most important thing in this document. It is checked first, in A4.

### A4 · The work, in order

1. **The two mid-air rests.** Explain them before touching anything else. If a ball can rest on
   nothing, no amount of table authoring will help and this plan changes.
2. **The cabinet's bottom assembly.** `guide.left`, `guide.right`, `inlane.*` and the flipper pivots
   account for the largest share of pockets and they are ONE FILE — the crook where a guide meets a
   pivot appears on every table in the catalogue. Fix it there and eleven tables improve at once.
3. **The gates that need a player, not an edit.** `tests/table-playable`'s survey presses the plunger
   again when the ball comes to rest on it, the way `main` does; `table-secret` and `table-reachable`
   follow.
4. **The per-table pockets that remain**, one commit per table, each naming the two components whose
   corner held the ball and the measurement before and after.
5. **`bare-minimum` gets its side walls back.** Its own comment removed them on a measurement — "the
   ball never travels sideways on this table" — that expired twice over: the plunger now fires along a
   lane that leans, and a wall keeps the speed along it. Measured: the ball left the table at x = 100.8
   of a table 100 wide, and `drainedBy` answered `outside`.
6. **Nine degrees on the two fixtures as well, and the floor is replaced by a refusal.** The Dev:
   "a inclinação de narrow-tower e bare-minimum devem ser 9 graus TAMBÉM."
   - `bare-minimum` takes them as it is: 100×181 leaves a top playfield of 21.7, which is 3.6 balls.
   - `narrow-tower` cannot at 120×420 — it needs `width ≥ 45 + 0.3168 × height` = 178 and has 120, so
     the walls cross 58 units before the top. **It becomes 180×420**, the Dev's choice between widening
     and shortening: "o propósito dela é altura extrema", and shortening is what throws that away.
   - `MIN_TOP_BALLS` goes. In its place `validateTable` REFUSES a table whose walls would cross, which
     is the same protection without an arbitrary number inside it: a table that cannot exist is a
     table that must not open, and one that is merely tight is the author's business.

### A5 · The twelve gates

Each is red for a stated reason and each must go green for a stated reason. None of them may go green by
weakening its claim.

| gate | why it is red | what it becomes |
|---|---|---|
| `table-playable` — eventually lost ×3 | the ball rests on the plunger and waits | the survey re-launches, like a player |
| `table-playable` — flapping changes the life ×4 | both runs end with the ball parked in the same place | same fix; a parked ball is the same in both runs by definition |
| `table-reachable` — ring-belt | a component the ball no longer reaches | measure after the pockets close; ledger only if it survives |
| `table-secret` — crater-run's passage | the route changed | re-measure; the passage is geometry, not luck |
| `table-physics-build` — eventually drained | one launch, no player | re-launch, as above |
| `table-catalog` — bare-minimum's contents | it has two more walls | the list is updated with A4.5's reason |
| `table-view-honesty` — painted area | the walls paint pixels | golden updated, one line per table |

---

## Part B — the false perspective

### B0 · What the Dev asked for

Two images: the table straight on, and the same table as a quadrilateral — bottom edge wide, top edge
narrower, the whole plane tilted back. "Estou falando de criar uma falsa perspectiva superior." And,
when I offered one instead of the other: **"Eu quero os dois!"** — the geometry leaning nine degrees so
that a launch curves left instead of bouncing off the ceiling, AND the picture leaning so the game looks
like a table seen from where a player stands.

### B0.1 · The horizontal half landed early, because the mismatch was visible

⚠️ **THE DEV SAW IT BEFORE ANY OF THIS WAS BUILT: "Você deformou os artefatos que compõe a mesa mas não
deformou a arte?"** The geometry had leaned nine degrees a commit earlier and the backdrop was still
being blitted upright — the walls converging over a picture that did not, by 47 units at the top of
`factory`.

So `gfx/backdrop.leanPicture` puts the bitmap through the INVERSE of `taperMap` as it is decoded: one
resample per table, nearest, at load. It is not the homography this part is about and it does not
replace it — what it does is stop the two halves of the same table disagreeing while the rest is built.

What is left for B2–B5 is everything the horizontal lean cannot do on its own: the VERTICAL
foreshortening a camera tilt implies, the ball shrinking with it, and the live layer that lets both
reach the six things drawn per frame.

### B1 · Why it is not one line today

`main`'s frame loop composes the table ONCE PER CHANGE into `tablePicture`, then blits a window of it:

```
blitView(screen, tablePicture, hud.playfield, cameraX.offset, camera.offset)
```

and then draws **six things per frame straight onto the screen**, each in screen coordinates:

| what | call | why it is not in `tablePicture` |
|---|---|---|
| the plunger | `drawLitRect` | it slides down its lane as the player charges |
| the flippers | `drawFlipper` ×n | they swing |
| the movers | `drawMover` ×n | they travel |
| the comets | `drawComet` ×n | they fall |
| the capsules | `drawCapsule` ×n | they fall |
| the ball | `drawBall` ×n | it is the ball |

Warping only `tablePicture` would leave all six travelling in straight lines across a leaning table.
Warping each of them where it is drawn means warping SHAPES — a stroked line, a disc — not positions,
and doing it six times.

### B2 · The live layer

One more framebuffer the size of the table, cleared each frame, into which those six are drawn **in
table coordinates**. `tablePicture` and the live layer compose; the composite is warped once.

⚠️ **It is also the fix for a defect this repository has hit four times** — "the flippers were stroked
in at their resting angle for weeks, the plunger never slid, the lamps never reached a pixel." Those all
came from the split between a picture composed on change and things drawn per frame. After this there is
one place a table's picture is assembled and one coordinate system it is assembled in.

### B3 · The homography

`gfx/perspective`: a fixed quadrilateral in screen space, and for each destination pixel the inverse map
back to the composite, sampled NEAREST.

- Nearest, not bilinear, and `gfx/scale` already argues this exact choice for this exact art: "nearest
  keeps the hard pixel-art edge." A smoothed warp would blur the one-pixel highlights the tables are
  drawn with.
- Per destination pixel rather than per source pixel, because a forward map leaves holes.
- The quad is four corners; everything else is one 3×3 matrix and a divide.

### B4 · The camera

The window is 320×180 of a table that may be 420 tall, and the camera scrolls it. The quad stays FIXED
in screen space — it is the cabinet's glass, and glass does not move — and the camera decides which rows
of the composite the inverse map lands on. A quad that moved with the camera would be a table that
changes shape while the player watches the ball.

### B5 · There is no number to choose, and that was the correction

⚠️ **I OFFERED THE DEV A `topScale` AND A CHOICE BETWEEN "the heights change" AND "the heights do not",
AND BOTH WERE WRONG.** His answer: *"Não faz sentido. O que pedi para fazer é simular um deslocamento da
câmera do zênite para a direção do horizonte de modo a formar um trapézio cujos ângulos internos da base
sejam de 81 graus."*

A camera tilting from the zenith toward the horizon FORESHORTENS THE FAR END. A transform that narrows
the top without shortening it is a shear, not a camera — and a second taper chosen by hand on top of the
geometry's nine degrees is a second camera, which is not a thing a photograph can contain.

So the whole of Part B has one degree of freedom and the nine degrees already spent it:

```
k        = topWidth / baseWidth          fixed by the 81° base angles
height   = h · k · ln(1/k) / (1 − k)     the image of a rectangle, not a choice
ballSize = 6 · (width at its row) / (width at the base)
```

⚠️ **AND THE BALL SHRINKS WITH IT, WHICH THE DEV ASKED FOR IN THOSE WORDS**: "a bolinha também deve
encolher conforme chega ao topo, tendo a mesma proporção no topo em relação à largura quando está no topo
que em relação à base quando está na base." Everything standing on the table obeys the same projection —
the ball, the comets, the capsules, the movers' discs. Anything with a radius the taper did not already
reach is scaled by the local width, in the live layer, before the warp.

What the projection does to the catalogue, measured against a 180-tall view:

| table | k | drawn height | camera travel |
|---|---:|---:|---:|
| low-orbit | 0.593 | 179 | **fits whole** |
| slipstream | 0.576 | 184 | 4 |
| ion-storm | 0.567 | 186 | 6 |
| crater-run | 0.550 | 190 | 10 |
| long-climb | 0.481 | 204 | 24 |
| factory | 0.474 | 205 | 25 |
| ring-belt | 0.789 | 213 | 33 |
| wide-arc | 0.754 | 242 | 62 |
| four-flippers | 0.668 | 170 | **fits whole** |
| bare-minimum | 0.427 | 115 | **fits whole** |
| narrow-tower | 0.261 | 199 | 19 |

⚠️ **THIS AMENDS ADR-0001 AND THE RECORD IS OWED.** "A câmera segue a bola e perder as pás de vista faz
parte do jogo" was decided against a `low-orbit` that scrolled 55 pixels. Under a real camera it scrolls
none: five of the eleven tables fit on the screen entirely, and the fixture that exists to give the
camera 240 pixels of travel gives it 19. The camera is not removed and nothing about it is rewritten —
it simply has less to do, and that is a consequence of a later decision rather than a reversal of an
earlier one. The ADR gets an amendment saying so, in the same commit as the warp.

### B5.1 · What the shrinking ball costs, stated before it is built

The physics ball is SIX ACROSS EVERYWHERE and must be: every gap in every table is authored against that
number, and the lane's clearance is why the lane slides instead of being squeezed. Drawing it smaller
near the top means the picture and the physics disagree about where its edge is.

Measured: at the top of `long-climb`, the widest disagreement in the catalogue, the drawn ball is 2.9
across against a collision that is 6 — so at the instant it bounces there is a gap of about 1.6 units,
A QUARTER OF A BALL, between the picture and the wall it hit.

⚠️ **THE COHERENT ALTERNATIVE IS TO TAPER THE COLLISION RADIUS TOO**, and it is not being taken now. A
ball whose radius shrinks with the field keeps every gap the same number of ball-widths at every height —
it would have prevented the pockets this plan's Part A exists to close, and it would let the lane taper
like everything else. It is also deep: `physics/wall` bakes the radius into every edge at build time
through `offsetLine`, so a height-dependent radius changes how the grid is built, how flippers are
derived and how the drain is tested. It is named here so that the quarter-ball gap, when the Dev sees
it, is a known price and not a surprise.

### B6 · The corners the warp leaves empty

A trapezium in a rectangular window leaves two triangles beside the top. They are the cabinet, not a
hole: `gfx/backdrop` already paints what is behind a table, and the plan is to let it, rather than to
stretch the art into them.

### B7 · What it costs

57,600 destination pixels per frame, each a matrix multiply, a divide and one sample. There is a gate —
`tests/perf-frame-budget` — and the number goes in the commit either way. If it does not fit, the
fallback is stated now rather than improvised later: precompute the inverse map ONCE per camera offset
into an index table, which turns the per-pixel work into one array read.

### B8 · Accessibility, which the warp must not quietly cost

- **Blind mode and the sonar read the MODEL, not the picture.** `contract.focusOf` and `targetsOf` come
  from the physics, so a warped picture changes nothing a screen reader or the sonar says. Worth
  stating because it is the reason this is safe to do at all.
- **The colour filters run after us.** The engine applies CVD matrices and high contrast to the finished
  canvas; the warp happens inside our framebuffer, upstream of all of it.
- **Contrast survives a nearest resample exactly** — the pixels are the same pixels — but SIZE does not,
  which is B5's four-pixel floor.
- **No new motion.** The quad is fixed; nothing about the warp animates, so `prefers-reduced-motion` has
  nothing to answer for.

---

## Order, and what could go wrong

1. A1 — land the friction model (the patch and its gate).
2. A2 — the resting survey, which is the instrument for everything after it.
3. A4.1 — explain the two mid-air rests. **If a ball can rest on nothing, stop and re-plan.**
4. A4.2 — the cabinet's bottom assembly.
5. A4.3 — the gates that need a player.
6. A4.4/A4.5 — the per-table pockets, one commit each; `bare-minimum`'s walls.
7. B2 — the live layer, with the six draw calls moved into it. Green before the warp exists.
8. B3–B4 — the warp, behind the constant, at 1.0 first: **the picture must be pixel-identical at
   topScale 1.0**, which is the gate that proves the resample is not lying before anything leans.
9. B5 — turn the projection on, at the angle the geometry already fixed, and look at it.

**The risk that is worth naming now:** step 8's identity check is the whole safety of Part B. A resample
that is a fraction of a pixel off at 1.0 will be a fraction off everywhere, and every render gate in
this repository compares pixels. If it cannot be made exact at 1.0, the warp needs a different sampling
rule and that is a design change, not a tuning one.

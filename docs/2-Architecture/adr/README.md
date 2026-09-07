# Architecture decision records — `@the-inclusionist/game-space-cadet`

This repository keeps its own records, numbered from `ADR-0001` in its own space. That is the
application of **ADR-0068** in the engine repository (`SP-the-inclusionist-tracer`): one repository per
game, because a game is the unit that gets adopted, refused, licensed and blamed. A record about how
*this* game plays belongs where the game lives, not in the engine's ledger.

Numbers here do **not** correspond to numbers there. When a record in this folder depends on one of the
engine's, it names it in full — `ADR-0068 (engine)` — so a reader can tell the two ledgers apart.

The format is the engine's, so that the two read the same way: YAML, `metadata` first, then the
question, the drivers, the options that were weighed, the decision, and its consequences. Under
**ADR-0057 (engine)** a record changes by supersession, and an erratum is the only edit in place.

| Record | Title |
|---|---|
| [ADR-0001](ADR-0001-the-camera-follows-the-ball-and-the-flippers-are-given-up.yaml) | The camera follows the ball, and losing the flippers is part of the game |
| [ADR-0002](ADR-0002-the-side-panel-dies-and-the-corners-take-over.yaml) | The side panel dies, the corners take over, and nothing covers the play |
| [ADR-0003](ADR-0003-the-table-is-implemented-twice-and-that-is-the-design.yaml) | The table is implemented twice on purpose, and finding both is not finding a duplicate |
| [ADR-0004](ADR-0004-the-worlds-are-told-apart-by-lightness-and-the-gate-gives-up-blue.yaml) | The five worlds share an order rather than a colour, and the CB-Safe palette buys separability with the gate's blue |
| [ADR-0005](ADR-0005-an-authored-table-declares-its-own-missions.yaml) | An authored table declares its own missions, and the 1995 machine is not bent into serving them |
| [ADR-0006](ADR-0006-the-1995-playfield-is-the-density-bar-and-shortfalls-are-named.yaml) | The 1995 playfield is the density bar, and a table below it is named with what it measures |
| [ADR-0007](ADR-0007-the-ground-may-be-lit-to-a-ceiling-and-the-flare-is-the-one-exception.yaml) | The ground may be lit, up to a measured ceiling, and the flare is the one place the rule is broken on purpose |
| [ADR-0008](ADR-0008-contrast-is-measured-at-the-boundary-not-over-the-picture.yaml) | Contrast is a property of a boundary, so the shadow goes around each component and the pictures come back up |

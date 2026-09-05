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

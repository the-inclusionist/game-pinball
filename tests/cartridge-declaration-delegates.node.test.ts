// SPDX-License-Identifier: AGPL-3.0-or-later
// ONE DECLARATION, HANDED OVER BEFORE THERE IS A TABLE TO DESCRIBE.
//
// ========================= THE KNOT THIS UNTIES =========================
// ⚠️ `createGame` TAKES `declaration` AS A VALUE and calls `conformanceProblems` on it once, at boot.
// `cartridge-contract.md` therefore makes `Cartridge.declaration` a value a host reads BEFORE it calls
// `create(ctx)`. And this game's declaration describes the playfield that is actually on screen — which
// comes from `ctx.params`, which the cartridge cannot read until `create(ctx)` has been called.
//
// So the two requirements are circular, and the plan's §B6 records measuring exactly how badly: cutting
// `main.ts` at the line where the engine is first needed produces forty compile errors, because
// twenty-three bindings are declared below that line and read above it.
//
// 📌 THE CONTRACT NAMES THE WAY OUT ITSELF, under "the one hard problem": option (a), *"a delegating
// declaration — a declaration whose every member forwards to the mounted cartridge"*, which it says works
// today with no engine change. This game was already built for it without knowing: `createPinballWorld`
// returns GETTERS, so nothing it hands the engine is read until the engine asks.
//
// ========================= WHAT THIS FILE IS FOR, AND WHAT IT IS NOT =========================
// This is the design taken on its own, before anything is rewired — the same shape slice A0 used, where
// the cartridge's hooks were proved equal to what the boot already handed over before a line moved.
//
// So the claim is narrow and it is the one that matters: a declaration built with NO table, and handed a
// table afterwards, answers exactly what a declaration built FROM that table answers. If that is not
// true, the conversion cannot use this route and the plan has to say so.
import { describe, test, expect } from 'vitest';
import { conformanceProblems } from '@the-inclusionist/engine/core/contract.js';
import { createPinballOptions, type BootOptions, type LiveTable } from '../app/js/shell/boot.js';
import type { LiveCartridge } from '../app/js/shell/cartridge.js';
import { delegatingCartridge } from '../app/js/shell/cartridge.js';

function table(over: Partial<LiveTable> = {}): LiveTable {
  return {
    playfieldWidth: 183,
    playfieldHeight: 235,
    ballRadius: 3,
    balls: [{ active: true, position: { x: 90, y: 200 }, direction: { x: 0, y: -1 }, speed: 4 }],
    components: [
      { name: 'drain', role: 'hazard', bounds: { x: 80, y: 225, width: 20, height: 10 } },
      { name: 'bump1', role: 'structure', bounds: { x: 40, y: 60, width: 10, height: 10 } },
    ],
    missionTextId: 'STRING208',
    missionHave: 3,
    missionNeed: 8,
    missionTargets: ['bump1'],
    ...over,
  };
}

/**
 * The playfield's extent, narrowed out of the union.
 *
 * `Topology` is `grid | continuous | hotspots` and only the first two have a `size` — a pinball is
 * `continuous`, and asserting that here means a declaration that quietly became a list of hotspots fails
 * on the narrowing rather than on a missing property.
 */
function sizeOf(port: { declaration: { topology(): { kind: string } } }): readonly number[] {
  const topology = port.declaration.topology();
  if (topology.kind !== 'continuous') throw new Error(`a pinball is not ${topology.kind}`);
  return (topology as unknown as { size: readonly number[] }).size;
}

const HOST = { doc: {} as Document, win: {} as Window };

/**
 * A published game that is nothing but its table.
 *
 * ⚠️ THE HOOKS ARE THE OTHER HALF AND THEY ARE `tests/cartridge-halves`'s, DELIBERATELY. This file
 * asks one question — does a declaration handed over early say what a declaration built late says — and
 * answering it needs a table and nothing else. Stubbing the hooks here as well would put the same claim
 * in two files, and the one that is not read is the one that rots.
 */
const asLive = (t: LiveTable): LiveCartridge => ({
  table: t,
  isNavigable: () => false,
  isBlindMode: () => false,
  setPhase: () => {},
  pauseActs: () => ({}),
  setCorrection: () => {},
});

const options = (over: Partial<BootOptions> = {}): BootOptions => ({
  locale: 'pt', table: table(), host: { doc: {} as Document, win: {} as Window }, ...over,
});

describe('a declaration can be handed over before the table exists', () => {
  test('⚠️ published, it says exactly what a declaration built from that table says', () => {
    /**
     * The whole design in one assertion. The engine reads a game through this object and nothing else:
     * if the delegating one answers differently, then a child gets an accessibility model of a table
     * that is not the one on screen — which is worse than no model, because it is believable.
     */
    const direct = createPinballOptions(options()).declaration;

    const port = delegatingCartridge('pt', new URLSearchParams(), HOST);
    port.publish(asLive(table()));

    expect(port.declaration.topology()).toEqual(direct.topology());
  });

  test('⚠️ and the pieces the engine asks for one at a time agree too', () => {
    /**
     * 📌 `topology()` IS NOT THE WHOLE OBJECT, and asserting only it would leave the rest unmeasured —
     * the engine reads the ball, the components and the mission through their own members, at moments of
     * its own choosing. A delegate that forwarded one and not the others would pass the case above.
     */
    const direct = createPinballOptions(options()).declaration;

    const port = delegatingCartridge('pt', new URLSearchParams(), HOST);
    port.publish(asLive(table()));

    const at = { x: 90, y: 230 };
    expect(port.declaration.tick).toBe(direct.tick);
    expect(port.declaration.roleAt(at)).toEqual(direct.roleAt(at));
    expect(port.declaration.nameAt(at)).toEqual(direct.nameAt(at));
    expect(port.declaration.objectiveOf(0)).toEqual(direct.objectiveOf(0));
    expect(port.declaration.targetsOf(0)).toEqual(direct.targetsOf(0));
  });

  test('⚠️ handed a DIFFERENT table, it changes its answer', () => {
    /**
     * ⚠️ THIS IS THE HALF THAT MAKES IT A DELEGATE RATHER THAN A COPY. An implementation that read the
     * table ONCE, at publish, would pass both cases above and fail here — and the failure would arrive
     * as a child being told about the table they were playing an hour ago.
     *
     * It is not hypothetical: this game rebuilds its world when a player picks another table, and the
     * platform's `mount()`/`unmount()` is the same thing at a larger scale.
     */
    const port = delegatingCartridge('pt', new URLSearchParams(), HOST);
    port.publish(asLive(table()));
    const before = sizeOf(port);

    port.publish(asLive(table({ playfieldWidth: 360, playfieldHeight: 300 })));

    expect(sizeOf(port), 'the declaration is a snapshot, not a view').not.toEqual(before);
    expect(sizeOf(port)).toEqual([360, 300]);
  });

  test('⚠️ unpublished, it already describes the table the ADDRESS asked for', () => {
    /**
     * 🔴 IT USED TO ANSWER AN EMPTY TABLE, AND THE ENGINE REFUSED IT. This case asserted zero by zero
     * on the reasoning that nothing is on screen until `create(ctx)` runs. `conformanceProblems` — asked
     * rather than paraphrased — came back with two:
     *
     *     topology.size: every extent must be positive
     *     topology.continuous: unit must be positive (it is the metric the narration counts in)
     *
     * ⚠️ AND THE REFUSAL WAS RIGHT. A space zero wide is not a space a child can be told about, and an
     * engine that accepted one would mount a sonar whose metric divides by nothing. The answer was not to
     * soften the check: it was that the extent had been knowable all along. `?table=` lives in the
     * ADDRESS, and the address is the host's before a game runs.
     *
     * 📌 SO THE ONLY THING MISSING BEFORE `publish` IS WHAT MOVES — no balls, no live mission, no
     * components. Which is exactly what `create(ctx)` builds, and what the delegate exists to swap in.
     */
    const chosen = delegatingCartridge('pt', new URLSearchParams('table=wide-arc'), HOST);
    const fallback = delegatingCartridge('pt', new URLSearchParams(), HOST);

    expect(sizeOf(chosen), 'the address named a table and the declaration did not follow it')
      .not.toEqual(sizeOf(fallback));
    expect(sizeOf(chosen).every((n) => n > 0), 'an extent the engine will refuse').toBe(true);
    expect(chosen.declaration.roleAt({ x: 0, y: 0 }), 'it should answer rather than throw')
      .toBeDefined();
  });

  test('📏 and the ENGINE accepts it unpublished, which is what decides the route', () => {
    /**
     * 📏 THE MEASUREMENT THE WHOLE DESIGN RESTS ON, and the one worth being wrong about early.
     * `createGame` runs `conformanceProblems` on the declaration ONCE, at boot — before `create(ctx)` has
     * chosen a table. If the engine refuses an empty one, a host cannot build an engine until the
     * cartridge has run, and the cartridge cannot run until there is an engine: the circle closes again
     * and the conversion needs a different route.
     *
     * ⚠️ AND IT IS ASKED OF THE ENGINE'S OWN FUNCTION, not of a reading of its rules. That is the
     * difference between this case and a paraphrase: `conformanceProblems` is what `createGame` actually
     * calls, and a borrowed guarantee is a claim about somebody else's code.
     */
    const port = delegatingCartridge('pt', new URLSearchParams(), HOST);

    expect(conformanceProblems(port.declaration),
      'the engine refuses this declaration, so it cannot be handed over before a table is live')
      .toEqual([]);
  });
});

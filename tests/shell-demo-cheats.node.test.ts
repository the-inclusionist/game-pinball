// SPDX-License-Identifier: AGPL-3.0-or-later
// THE BACK DOOR, REACHED FROM THE KEYBOARD FOR THE FIRST TIME.
//
// `control/cheats` was written and tested in phase 5 and imported by nothing since: an eleven-character
// rolling buffer and seven codes, connected to no keys and no table. This is the wiring, checked
// against the real archive — every code has to move something a player can see, or it is decoration.
//
// ⚠️ AND `easy mode` IS TWO GATES BY NAME. The upstream's branch is
//     DrainBallBlockerControl(TBlockerEnable, block1);
//     gate1->Message(TGateDisable, 0.0);  gate2->Message(TGateDisable, 0.0);
// with `control_gate1_tag = {"v_gate1"}` and `control_gate2_tag = {"v_gate2"}`.
//
// I wrote this test expecting nine gates and seven of them to stay shut, on the strength of a comment
// in `shell/demo` that says "nine gates, all shut". That comment is about the nine ONE-WAYS that were
// being installed as walls, not about gates: the archive declares exactly TWO gates and they are the
// two the cheat names. So the assertion below is the one the file supports — both gates, both open —
// and the by-name rule survives for phase 8, where an authored table may have gates easy mode must
// leave alone.
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createDemo } from '../app/js/shell/demo.js';
import { CHEAT_GATES } from '../app/js/control/bindings.js';
import { resource } from './helpers/original-data.js';

const DAT = resource('PINBALL.DAT');
const build = () => {
  if (!existsSync(DAT)) return null;
  const buf = readFileSync(DAT);
  return createDemo(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), {
    textFor: (id) => id,
  });
};

/** One character at a time, which is the only way the buffer takes them. */
const type = (demo: ReturnType<typeof createDemo>, text: string): boolean => {
  let fired = false;
  for (const character of text) fired = demo.typeCheat(character) || fired;
  return fired;
};

describe('the back door', () => {
  test('⚠️ nonsense before a code does not stop it — the buffer is a suffix match', () => {
    const demo = build();
    if (!demo) return expect(existsSync(DAT)).toBe(false);

    expect(type(demo, 'qqqqqqqqqqqqqqbmax'), 'typed after fourteen wrong characters').toBe(true);
    expect(demo.unlimitedBalls).toBe(true);
  });

  test('`bmax` turns unlimited balls on and off again', () => {
    const demo = build();
    if (!demo) return expect(existsSync(DAT)).toBe(false);

    type(demo, 'bmax');
    expect(demo.unlimitedBalls).toBe(true);
    type(demo, 'bmax');
    expect(demo.unlimitedBalls).toBe(false);
  });

  test('`hidden test` toggles cheat mode, and a wrong spelling does nothing', () => {
    const demo = build();
    if (!demo) return expect(existsSync(DAT)).toBe(false);

    // ⚠️ THE CASE IS NOT FOLDED. The original compares raw characters against a lowercase literal.
    expect(type(demo, 'HIDDEN TEST'), 'in capitals').toBe(false);
    expect(demo.cheatMode).toBe(false);

    expect(type(demo, 'hidden test')).toBe(true);
    expect(demo.cheatMode).toBe(true);
  });

  test('⚠️ and the tab spelling opens it too, which is why `characterOf` maps Tab', () => {
    const demo = build();
    if (!demo) return expect(existsSync(DAT)).toBe(false);

    expect(type(demo, 'hidden\ttest')).toBe(true);
    expect(demo.cheatMode).toBe(true);
  });

  test('`1max` adds an extra ball', () => {
    const demo = build();
    if (!demo) return expect(existsSync(DAT)).toBe(false);
    const before = demo.extraBalls;

    type(demo, '1max');

    expect(demo.extraBalls).toBe(before + 1);
  });

  test('`rmax` lights the next lamp of the rank circle', () => {
    const demo = build();
    if (!demo) return expect(existsSync(DAT)).toBe(false);
    const circle = demo.components.lightGroups.get('middle_circle')!;
    const before = circle.onCount;

    type(demo, 'rmax');

    expect(circle.onCount, 'the middle circle IS the rank').toBe(before + 1);
  });

  test('`gmax` arms the gravity well, which is its lamp and its kickout together', () => {
    const demo = build();
    if (!demo) return expect(existsSync(DAT)).toBe(false);
    const lamp = demo.components.lights.get('lite62')!;
    expect(lamp.lit, 'dark until armed').toBe(false);

    type(demo, 'gmax');

    expect(lamp.lit, '`flasherStart` counts as lit — see `light_on()`').toBe(true);
  });

  test('⚠️ `easy mode` opens the gates it NAMES, which here is both of them', () => {
    const demo = build();
    if (!demo) return expect(existsSync(DAT)).toBe(false);
    expect([...demo.gates.keys()].sort(), 'the archive declares two').toEqual(['v_gate1', 'v_gate2']);
    for (const gate of demo.gates.values()) expect(gate.open, 'shut until the cheat').toBe(false);

    type(demo, 'easy mode');

    expect(demo.easyMode).toBe(true);
    expect(demo.gates.get('v_gate1')!.open, 'v_gate1').toBe(true);
    expect(demo.gates.get('v_gate2')!.open, 'v_gate2').toBe(true);
  });

  test('⚠️ AN EQUIVALENT MUTANT, RECORDED: "open every gate" cannot be told apart here', () => {
    // `disableGates` opens the gates `CHEAT_GATES` names. Replacing that with "open all of them"
    // changes nothing on this archive, because the two gates it declares ARE the two named — no test
    // over PINBALL.DAT can kill that mutant, and pretending otherwise would be a gate that only looks
    // like one. What is asserted instead is the constant, which is the thing transcribed from
    // `control_gate1_tag` and `control_gate2_tag`; the behavioural difference first becomes visible on
    // an authored table with a third gate, which is phase 8's problem and phase 8's test.
    expect([...CHEAT_GATES].sort()).toEqual(['v_gate1', 'v_gate2']);
  });

  test('⚠️ and switching easy mode OFF does not drop the barrier under a ball in flight', () => {
    // `DrainBallBlockerControl(ControlTimerExpired, block1)`, not a disable. A blocker in its first
    // phase answers a timeout by starting its flashing extension, so the player gets the usual warning
    // instead of the drain opening beneath them. Reusing the timeout is the entire difference.
    const demo = build();
    if (!demo) return expect(existsSync(DAT)).toBe(false);

    type(demo, 'easy mode');
    expect(demo.easyMode).toBe(true);
    type(demo, 'easy mode');

    expect(demo.easyMode).toBe(false);
  });

  test('⚠️ every code marks the game, and nothing else does', () => {
    const demo = build();
    if (!demo) return expect(existsSync(DAT)).toBe(false);

    expect(demo.cheatsUsed, 'an untouched game').toBe(false);
    type(demo, 'the player types a sentence');
    expect(demo.cheatsUsed, 'and prose is not a cheat').toBe(false);

    type(demo, 'rmax');

    expect(demo.cheatsUsed).toBe(true);
  });
});

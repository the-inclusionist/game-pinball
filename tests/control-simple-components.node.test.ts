// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { readGroups } from '../app/js/dat/partman.js';

const DAT = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.DAT';
import {
  SIMPLE_COMPONENTS, SIMPLE_LIGHTS, SIMPLE_LIGHT_GROUPS, SIMPLE_SOUNDS, SIMPLE_TEXT_BOXES, SIMPLE_TAGS,
  resolveSimpleComponents,
} from '../app/js/control/simple-components.js';
import { SCORE_COMPONENTS } from '../app/js/control/score-table.js';

describe('the address book, as the original ships it', () => {
  test('there are exactly 145 names', () => {
    expect(SIMPLE_COMPONENTS).toHaveLength(145);
  });

  test('no name appears twice', () => {
    expect(new Set(SIMPLE_COMPONENTS).size).toBe(145);
  });

  test('every one of them is a lamp, a lamp group, a sound or a text box', () => {
    // The finding of this module. All 145, with nothing left over.
    const byKind = [...SIMPLE_LIGHTS, ...SIMPLE_LIGHT_GROUPS, ...SIMPLE_SOUNDS, ...SIMPLE_TEXT_BOXES];

    expect(byKind).toHaveLength(145);
    expect(new Set(byKind)).toEqual(new Set(SIMPLE_COMPONENTS));
  });

  test('and the split is 95 lamps, 15 groups, 33 sounds, 2 text boxes', () => {
    expect(SIMPLE_LIGHTS).toHaveLength(95);
    expect(SIMPLE_LIGHT_GROUPS).toHaveLength(15);
    expect(SIMPLE_SOUNDS).toHaveLength(33);
    expect(SIMPLE_TEXT_BOXES).toHaveLength(2);
  });

  test('NOT ONE mechanism is reachable by name', () => {
    // Every entry is named as a lamp, a group of lamps, a sound or a text box — never as a ball,
    // wall, flipper, bumper, target, sink, gate or kickout. Some GROUPS are named after the
    // mechanism they sit on (`ramp_tgt_lights`), which is the exception that shows the rule: it is
    // the lights of the ramp targets, not the ramp.
    const displayShaped = /^(lite|soundwave)|(lights|circle|bargraph|text_box)$/;

    expect(SIMPLE_COMPONENTS.filter((n) => !displayShaped.test(n))).toEqual([]);
  });

  test('the two tables are disjoint: a name has a behavior OR an address, never both', () => {
    // `make_links` runs two passes over two arrays. Nothing is in both, because the second pass
    // attaches no behavior and would have nothing to add.
    const scored = new Set(SCORE_COMPONENTS.map((r) => r.name));

    expect(SIMPLE_COMPONENTS.filter((n) => scored.has(n))).toEqual([]);
  });

  test('a lamp that DOES something is in the other table', () => {
    // This is the rule that decides which of the two arrays a lamp lands in. `lite200`, `lite17`,
    // `lite59` and `lite60` all carry a behavior — the shoot-again fade, the extra-ball expiry, the
    // bonus and jackpot windows closing — so they are score components with a control and no score.
    // Every lamp that is only read or written is here instead.
    const withBehavior = ['lite200', 'lite17', 'lite59', 'lite60'];
    const scored = new Map(SCORE_COMPONENTS.map((r) => [r.name, r.controlName]));

    for (const name of withBehavior) {
      expect(SIMPLE_COMPONENTS).not.toContain(name);
      expect(scored.get(name)).toBeDefined();
    }
  });

  test('and the lamps the rest of this port only reads or writes are here', () => {
    // The spare lamp, the mission lamp, the wormhole destination, the hyperspace climax, the bonus
    // hold, the mission counter.
    for (const name of ['lite199', 'lite198', 'lite4', 'lite130', 'lite58', 'lite56', 'lite18']) {
      expect(SIMPLE_COMPONENTS).toContain(name);
    }
  });

  test('the light groups are the ones the control modules drive', () => {
    for (const name of ['fuel_bargraph', 'middle_circle', 'outer_circle', 'skill_shot_lights',
      'l_trek_lights', 'r_trek_lights', 'bmpr_inc_lights', 'ramp_bmpr_inc_lights']) {
      expect(SIMPLE_LIGHT_GROUPS).toContain(name);
    }
  });
});

describe('resolving the address book against a table', () => {
  test('a table that provides everything resolves cleanly', () => {
    const result = resolveSimpleComponents(SIMPLE_COMPONENTS, () => ({}));

    expect(result.resolved).toBe(145);
    expect(result.missing).toEqual([]);
  });

  test('a missing name is REPORTED, where the original silently left it null', () => {
    // Harmless in the original — every use of a null tag does nothing. For an authored table it is a
    // wiring bug, so it is worth knowing about.
    const table = new Set(SIMPLE_COMPONENTS.filter((n) => n !== 'lite198'));

    const result = resolveSimpleComponents(SIMPLE_COMPONENTS, (n) => (table.has(n) ? {} : undefined));

    expect(result.resolved).toBe(144);
    expect(result.missing).toEqual(['lite198']);
  });

  test('a name resolving to null counts as missing, not as found', () => {
    const result = resolveSimpleComponents(['lite8'], () => null);

    expect(result.missing).toEqual(['lite8']);
  });
});

describe('⚠️ and each of them says which group in the archive it is', () => {
  test('every simple component has a tag', () => {
    for (const name of SIMPLE_COMPONENTS) {
      expect(SIMPLE_TAGS[name], name).toBeTruthy();
    }
  });

  test('⚠️ most tags ARE the name, and eight are not — which is why they are written down', () => {
    // The opposite balance from `score-table`, where eighty of eighty-nine differ. Lights were never
    // renamed between the archive and the control layer, so `lite8` is `lite8`. Leaving the map out
    // would have worked for a hundred and thirty-seven components and quietly failed for eight, which
    // is the worst kind of nearly-right.
    const differ = SIMPLE_COMPONENTS.filter((name) => SIMPLE_TAGS[name] !== name);

    expect(differ).toHaveLength(8);
  });

  test('⚠️ and those eight are PAIRS pointing at one emitter, which is not a mistake', () => {
    // `soundwave50_1` and `soundwave50_2` are two components linked to the same `soundwave50` group.
    // The original does that on purpose: one sound, two things that can trigger it. A map keyed by tag
    // would silently lose one of each pair, so the list stays keyed by NAME.
    const differ = SIMPLE_COMPONENTS.filter((name) => SIMPLE_TAGS[name] !== name);
    const tags = differ.map((name) => SIMPLE_TAGS[name]!);

    expect(new Set(tags).size).toBeLessThan(differ.length);
    for (const name of differ) expect(name).toMatch(/^soundwave\d+_[12]$/);
  });

  test('every tag names a group that is really in PINBALL.DAT', () => {
    if (!existsSync(DAT)) return expect(existsSync(DAT)).toBe(false);
    const buf = readFileSync(DAT);
    const groups = readGroups(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
    const names = new Set(groups.map((g) => g.name).filter(Boolean));

    const absent = SIMPLE_COMPONENTS.filter((n) => !names.has(SIMPLE_TAGS[n]!));

    expect(absent).toEqual([]);
  });
});

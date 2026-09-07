// SPDX-License-Identifier: AGPL-3.0-or-later
// THE COLOUR-BLINDNESS CORRECTION, WHICH THE PLAN PROMISED AND NOTHING COLLECTED.
//
// ⚠️ FROM THE PLAN: "o pinball herda de graça os filtros de daltonismo (`render/cvd-matrices`), o alto
// contraste, o CRT e o pipeline multi-tela — nada disso precisa ser escrito." Measured before writing
// any of this: `createGame` returns `aplicarFiltroDeVisao` and `cvdFilters`, and this port referenced
// NEITHER. The six filters went into `<svg id="cvd-filters">` at every boot — `problems` is empty, so
// the host was found — and nothing ever asked for one.
//
// The Dev found the hole from the other side: "modos de acessibilidade para visão".
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  VISION_CHOICES, VISION_LABEL, NO_VISION, visionFilter, readVision, writeVision,
  VISION_STORAGE_KEY, type Store,
} from '../app/js/shell/vision.js';
import { VIZ_MODES } from '@the-inclusionist/engine/render/viz-modes.js';

const memory = (): Store & { held: Record<string, string> } => {
  const held: Record<string, string> = {};
  return { held, getItem: (k) => held[k] ?? null, setItem: (k, v) => { held[k] = v; } };
};

describe('what is offered', () => {
  test('none, and the three corrections the engine installs', () => {
    expect(VISION_CHOICES).toEqual([NO_VISION, 'fix-protan', 'fix-deuter', 'fix-tritan']);
  });

  test('⚠️ and NOT the simulations, which serve the opposite audience', () => {
    /**
     * The engine's own catalogue separates them, and its source records why as the Dev's decision on
     * issue #60: the corrections belong to a visual accessibility menu and the simulations to an
     * EMPATHY one, because one is for somebody who wants to feel what colour blindness is like and
     * the other for somebody who has it. They sat in the wrong menu there for years.
     *
     * ⚠️ AND THIS READS THE ENGINE'S OWN FLAG rather than matching on the `sim-` prefix, because a
     * prefix is a naming convention and `sim` is the fact.
     */
    const simulations = VIZ_MODES.filter((m) => m.sim === true).map((m) => m.key);

    expect(simulations.length, 'the engine does carry simulations').toBeGreaterThan(0);
    expect(VISION_CHOICES.filter((c) => simulations.includes(c))).toEqual([]);
  });

  test('⚠️ the list is DERIVED from the engine, not written out here', () => {
    // A hand-written list of three keys is a list that goes stale the day the engine adds a fourth
    // correction — silently, because a missing entry in a menu looks exactly like a menu.
    const source = readFileSync('app/js/shell/vision.ts', 'utf8');

    expect(source, 'the corrections are imported').toMatch(/VIZ_CORRECTIONS/);
    for (const key of ['fix-protan', 'fix-deuter', 'fix-tritan']) {
      expect(source, `${key} is written out by hand`).not.toContain(`'${key}'`);
    }
  });

  test('every choice has a label key of this game’s own', () => {
    // Not the engine's `nome`, which is a key into the ENGINE's dictionary: this game ships pt-BR, en
    // and es and a test fails if any of the three loses a key. Borrowing another package's i18n would
    // put half of one screen outside that guarantee.
    for (const choice of VISION_CHOICES) {
      expect(VISION_LABEL[choice], choice).toBe(`pinball.vision.${choice}`);
    }
  });
});

describe('the filter it asks the engine for', () => {
  test('none is no filter at all, not a filter that does nothing', () => {
    // `filter: ''` removes the property. A `url(#…)` that resolves to identity still costs a
    // compositing layer on every frame, on the machines this game is for.
    expect(visionFilter(NO_VISION)).toBe('');
  });

  test('each correction is the engine’s own url()', () => {
    expect(visionFilter('fix-protan')).toBe('url(#cvd-fix-protan)');
    expect(visionFilter('fix-deuter')).toBe('url(#cvd-fix-deuter)');
    expect(visionFilter('fix-tritan')).toBe('url(#cvd-fix-tritan)');
  });

  test('⚠️ and a key nobody knows is no filter rather than a crash', () => {
    // What is stored survives a version of this game that offered a mode a later one does not.
    expect(visionFilter('fix-nothing')).toBe('');
  });
});

describe('remembering it', () => {
  test('what was chosen comes back', () => {
    const store = memory();
    writeVision(store, 'fix-deuter');

    expect(readVision(store)).toBe('fix-deuter');
    expect(store.held[VISION_STORAGE_KEY]).toBe('fix-deuter');
  });

  test('nothing stored is none', () => {
    expect(readVision(memory())).toBe(NO_VISION);
  });

  test('⚠️ and a stored value nobody recognises is none, not an exception at boot', () => {
    const store = memory();
    store.held[VISION_STORAGE_KEY] = 'sim-protan';

    // A simulation is exactly the value a previous version might have written, and it is the one
    // value that must never come back: it would hand a player the disability instead of the fix.
    expect(readVision(store)).toBe(NO_VISION);
  });

  test('⚠️ and a store that refuses does not stop the game starting', () => {
    // Private windows, and browsers set to block site data. `shell/options` takes the same care.
    const refuses: Store = {
      getItem() { throw new Error('denied'); },
      setItem() { throw new Error('denied'); },
    };

    expect(readVision(refuses)).toBe(NO_VISION);
    expect(() => writeVision(refuses, 'fix-protan')).not.toThrow();
  });
});

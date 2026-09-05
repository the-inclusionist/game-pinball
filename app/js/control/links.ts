// SPDX-License-Identifier: AGPL-3.0-or-later
// control/links — binding the table's components to their behavior. Port of `control::make_links`
// and `control::make_component_link`.
//
// ========================= A COMPONENT FROM THE .DAT IS INERT =========================
// `loader` builds components out of the file's groups. None of them does anything: a bumper knows how
// to bounce a ball and light up, and nothing about scoring. What makes it part of a GAME is this step,
// where the control table attaches a behavior and a score array to it:
//
//     linkedComp->Control = &score_component.Control;
//
// So the table of 88 scoring components is not a lookup the game consults — it is the wiring loom. Run
// it and the table plays; skip it and the same geometry sits there bouncing silently.
//
// ========================= THE MATCH IS BY GROUP NAME =========================
// A tag carries a string, and linking is a scan for the component whose group name equals it. The names
// come from the .DAT itself, so the C++ and the 1995 data file agree on identifiers like `bump1` and
// `lite56` — which is why the control table can be written against a file nobody has the source of.
//
// The scan is cached on the tag: a tag that already holds a component returns it without looking again.
// With 233 tags over a few hundred components that matters, and it is also what makes linking
// idempotent.
//
// ========================= AND SCORE ARRAYS ARE SHARED =========================
// `{BumperControl, 4, control_bump_scores1}` appears four times, once per bumper of that group. The
// array is shared, not copied, so a group of bumpers is worth the same by construction rather than by
// four maintained copies.

import type { ControlFunc, ControlledComponent } from './dispatch.js';

/** What the control table says about one component. */
export interface ControlEntry {
  /** The .DAT group name to bind to. */
  readonly name: string;
  readonly control: ControlFunc;
  /** Shared between components of the same kind — see this module's header. */
  readonly scores: readonly number[];
}

/** A component as it comes out of the loader: named, and inert. */
export interface LinkableComponent {
  readonly groupName: string | null;
  control: ControlFunc | null;
  scores: readonly number[];
}

export interface ComponentRegistry {
  /** Resolves a name to a component, caching the answer. Unknown names resolve to null. */
  resolve(name: string): LinkableComponent | null;
  /** How many times the component list was actually scanned. For proving the cache works. */
  readonly scanCount: number;
}

export function createComponentRegistry(components: readonly LinkableComponent[]): ComponentRegistry {
  const cache = new Map<string, LinkableComponent | null>();
  let scanCount = 0;

  return {
    get scanCount() { return scanCount; },

    resolve(name: string): LinkableComponent | null {
      const cached = cache.get(name);
      if (cached !== undefined) return cached;

      scanCount++;
      const found = components.find((c) => c.groupName === name) ?? null;
      cache.set(name, found);
      return found;
    },
  };
}

export interface LinkResult {
  /** How many entries found their component. */
  readonly linked: number;
  /** The names in the control table that no component answered to. */
  readonly missing: readonly string[];
}

/**
 * `control::make_links`. Attaches every control entry to its component, and resolves the simple names
 * so they are cached for later lookups.
 *
 * A NAME WITH NO COMPONENT IS NOT AN ERROR. The control table is written for the full Space Cadet
 * table, and a different .DAT — Full Tilt, or an authored one — simply will not have every part. The
 * original returns null and moves on; this returns the list of misses so a caller can decide whether
 * silence is acceptable, which is the one thing added here.
 */
export function makeLinks(
  registry: ComponentRegistry,
  scoreEntries: readonly ControlEntry[],
  simpleNames: readonly string[] = [],
): LinkResult {
  const missing: string[] = [];
  let linked = 0;

  for (const entry of scoreEntries) {
    const component = registry.resolve(entry.name);
    if (!component) { missing.push(entry.name); continue; }
    component.control = entry.control;
    component.scores = entry.scores;
    linked++;
  }

  for (const name of simpleNames) {
    if (!registry.resolve(name)) missing.push(name);
  }

  return { linked, missing };
}

/** Adapts a linked component to what the dispatch layer expects. */
export function asControlled(component: LinkableComponent, self?: unknown): ControlledComponent {
  return {
    name: component.groupName ?? '',
    scores: component.scores,
    control: component.control,
    self,
  };
}

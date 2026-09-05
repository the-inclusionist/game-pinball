// SPDX-License-Identifier: AGPL-3.0-or-later
// table/original-dispatch — running the 1995 control functions against the 1995 components.
//
// ========================= THE LAST JOIN =========================
// `control/lanes` says what a bumper lane DOES. `control/bindings` says WHICH light, group and bumper
// each control reaches. `table/original-components` builds those from the archive. Each of the three
// was tested on its own and none of them had ever met the other two.
//
// This is where they do, and it is deliberately narrow: the two bumper-lane chains, because those are
// the ones whose bindings carry ROLES — which lane lights which lamp — and a role is what a control
// function's options actually want. The other forty-six controls know which name is which from their
// own bodies, and wiring them is the same work again with a different option shape each time.
//
// ⚠️ SO THIS SAYS WHAT IT COVERS. Two chains out of fifty-seven controls, and the rest still do
// nothing. A dispatcher that quietly ran what it could and dropped the rest would be indistinguishable
// from a broken one.
//
// ========================= AN ADAPTER, AND ONE CLAIM I MADE TWICE AND WITHDREW =========================
// `LaneGroup.turnOff()` is a group-wide `TLightTurnOff`, which means every member off, and the port's
// `resetGroup` is a different thing — it sends `resetTimed`, cancelling the timed override and
// returning each lamp to its persistent state. So `turnOff` is written as every member off, because
// that is what the message means.
//
// ⚠️ I TWICE WROTE THAT THE ALTERNATIVE WOULD LEAVE THE LANE LAMPS LIT, and twice a mutation survived
// the test meant to prove it. It survives because the claim is false ON THIS PATH: `flashWhenOn` is
// documented in `table/light-group` as "every lit lamp goes dark with a flash first", so the lamps are
// already dark before either call runs and the original's following `TLightTurnOff` is belt-and-braces.
// Recorded as an EQUIVALENT MUTANT rather than chased with a stronger-sounding comment — and `turnOff`
// still means every member off, because the day something calls it without a flash in front, the
// difference is real.

import { makeBumperLaneControl, type LaneGroup, type LaneLight } from '../control/lanes.js';
import { BUMPER_LANE_BINDINGS, type BumperLaneBinding } from '../control/bindings.js';
import { handler, type ControlContext, type ControlledComponent } from '../control/dispatch.js';
import { SCORE_COMPONENTS } from '../control/score-table.js';
import type { OriginalComponents } from './original-components.js';

export interface OriginalDispatchOptions {
  readonly components: OriginalComponents;
  readonly context: ControlContext;
  /** `pb::FullTiltMode`. False for Space Cadet, which is the only table this port targets. */
  readonly isFullTilt?: () => boolean;
  /** The line a completed chain shows, already translated. */
  readonly textFor: (resourceId: string) => string;
}

export interface OriginalDispatch {
  /** A collision on the component with this archive name. Silent for anything not wired. */
  hit(groupName: string): void;
  /** Which archive names this dispatcher will actually act on. */
  readonly wired: ReadonlySet<string>;
}

/** Every member of a light group turned off, which is what a group-wide `TLightTurnOff` means. */
function groupAdapter(components: OriginalComponents, name: string): LaneGroup | null {
  const group = components.lightGroups.get(name);
  if (!group) return null;
  const members = components.membersOf(group);

  return {
    get onCount() { return group.onCount; },
    get lightCount() { return group.lightCount; },
    flasherStartTimed: (seconds) => group.flashWhenOn(seconds),
    // Every member off, which is what `TLightTurnOff` means. See the header for the claim I withdrew.
    turnOff: () => { for (const light of members) light.turnOff(); },
    toggleSplitIndex: (index) => group.toggleSplitIndex(index),
  };
}

function bumperAdapter(
  components: OriginalComponents, binding: BumperLaneBinding,
): { level: number; incLevel(): void; restartNotifyTimer(seconds: number): void } {
  return {
    // ⚠️ THE LEVEL IS READ OFF ONE NAMED BUMPER, as the original does: `bump1->BmpIndex`. They rise
    // together, so any member would answer the same — but transcribing it as "the highest in the group"
    // would be a different rule the day one is raised alone.
    get level() { return components.bumpers.get(binding.guardBumper)?.level ?? 0; },
    incLevel: () => components.raiseGroup(binding.bumperGroup),
    // The sixty-second decay timer belongs to the group component, which this build does not construct.
    restartNotifyTimer: () => {},
  };
}

export function createOriginalDispatch(o: OriginalDispatchOptions): OriginalDispatch {
  const byName = new Map<string, ControlledComponent>();
  const controls = new Map<string, (component: ControlledComponent) => void>();
  const scoreRows = new Map(SCORE_COMPONENTS.map((row) => [row.tag, row]));

  for (const binding of BUMPER_LANE_BINDINGS) {
    const group = groupAdapter(o.components, binding.lightGroup);
    // A binding whose group is missing from this archive is skipped rather than faked. Nothing in the
    // shipped file hits this; a modified table might.
    if (!group) continue;

    const lightOf = new Map<string, LaneLight | undefined>(
      binding.lanes.map((lane) => [lane.component, o.components.lights.get(lane.light)]),
    );

    const control = makeBumperLaneControl({
      lightFor: (caller) => lightOf.get(caller.name),
      group,
      bumpers: bumperAdapter(o.components, binding),
      completeText: o.textFor(binding.completeTextId),
      isFullTilt: o.isFullTilt ?? (() => false),
    });

    for (const lane of binding.lanes) {
      const row = scoreRows.get(lane.component);
      byName.set(lane.component, {
        // ⚠️ THE ARCHIVE'S NAME, because `lightFor` looks the caller up by it and a collision reports
        // it. Using the control layer's `roll3` here would light nothing and score correctly, which is
        // the failure that looks like a lamp bug.
        name: lane.component,
        scores: row?.scores ?? [],
        control: null,
      });
      controls.set(lane.component, (component) => control('ControlCollision', component, o.context));
    }
  }

  return {
    wired: new Set(byName.keys()),
    hit(groupName) {
      const component = byName.get(groupName);
      const control = controls.get(groupName);
      if (!component || !control) return;
      // `handler` runs the control and then the mission machine, in that order, always. The mission
      // machine is the context's, and for this build it does nothing.
      component.control = (_code, caller) => control(caller);
      handler('ControlCollision', component, o.context);
    },
  };
}

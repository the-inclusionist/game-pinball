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

import {
  makeBumperLaneControl, makeSpaceWarpRolloverControl, makeReturnLaneControl,
  makeFuelRolloverControl, type LaneGroup, type LaneLight,
} from '../control/lanes.js';
import {
  BUMPER_LANE_BINDINGS, LAMP_BINDINGS, RETURN_LANES, FUEL_ROLLOVERS, FUEL_BARGRAPH,
  FUEL_REFUEL_TEXT_ID, type BumperLaneBinding,
} from '../control/bindings.js';
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

  // ⚠️ TWO GUARDS THAT SAY DIFFERENT THINGS AND TODAY DECIDE THE SAME.
  //
  // The FIRST is the rule: only controls a collision can reach are wired, because
  // `ExtraBallLightControl` answers a light's timer and `LaunchRampHoleControl` answers a released
  // ball, and this build produces neither event. Wiring them would make objects nothing can drive.
  //
  // The SECOND is the inventory: which factory has been written here. With one written, the two
  // guards exclude exactly the same bindings — so removing the first changes nothing and a mutation
  // that removes it SURVIVES. Recorded rather than contrived around: the rule keeps its place because
  // it is the rule, and the second factory is what will separate them.
  for (const binding of LAMP_BINDINGS) {
    if (binding.onMessage !== 'ControlCollision') continue;
    if (binding.control !== 'SpaceWarpRolloverControl') continue;

    const lamps = binding.lamps
      .map((name) => o.components.lights.get(name))
      .filter((light): light is NonNullable<typeof light> => Boolean(light));
    if (lamps.length !== binding.lamps.length) continue;

    const control = makeSpaceWarpRolloverControl({ lamps: lamps as unknown as LaneLight[] });
    const row = scoreRows.get(binding.component);
    byName.set(binding.component, {
      name: binding.component,
      scores: row?.scores ?? [],
      control: null,
    });
    controls.set(binding.component, (component) => control('ControlCollision', component, o.context));
  }

  // ⚠️ THE RETURN LANES, WHICH COLLECT WHAT THE SPACE WARP LIT. `makeReturnLaneControl` matches the
  // caller by IDENTITY against the components it was given, not by name — so the very objects put in
  // `byName` have to be the ones handed to the factory. Building a second set here would make every
  // crossing fall through to the "not mine" branch, which scores nothing and looks like a dead lane.
  {
    const warpLamp = o.components.lights.get(RETURN_LANES.warpLamp);
    const lanes = RETURN_LANES.lanes
      .map((lane) => {
        const lamp = o.components.lights.get(lane.lamp);
        const row = scoreRows.get(lane.component);
        if (!lamp) return null;
        const component: ControlledComponent = {
          name: lane.component, scores: row?.scores ?? [], control: null,
        };
        return { component, lamp: lamp as unknown as LaneLight };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    if (warpLamp && lanes.length === RETURN_LANES.lanes.length) {
      const control = makeReturnLaneControl({
        lanes, warpLamp: warpLamp as unknown as LaneLight,
      });
      for (const lane of lanes) {
        byName.set(lane.component.name, lane.component);
        controls.set(lane.component.name, (component) => control('ControlCollision', component, o.context));
      }
    }
  }

  // ⚠️ THE SIX FUEL ROLLOVERS, WHOSE THRESHOLD ONLY MEANS ANYTHING AGAINST THE TANK ITSELF. Each asks
  // whether the level is already past its own — one, three, five, seven, nine, eleven — and the sixth
  // therefore asks about ELEVEN with six lamps on the table. That question is answerable only because
  // `table/light-bargraph` counts in half-lamps; handed a plain light group it would be false for ever
  // and every rollover would refill, so crossing the bottom one on a full tank would empty it.
  {
    const tank = o.components.bargraphs.get(FUEL_BARGRAPH);
    if (tank) {
      const refuelText = o.textFor(FUEL_REFUEL_TEXT_ID);
      for (const lane of FUEL_ROLLOVERS) {
        const lamp = o.components.lights.get(lane.lamp);
        if (!lamp) continue;

        const control = makeFuelRolloverControl({
          lamp: lamp as unknown as LaneLight,
          splitIndex: lane.splitIndex,
          bargraph: tank,
          refuelText,
        });
        const row = scoreRows.get(lane.component);
        byName.set(lane.component, { name: lane.component, scores: row?.scores ?? [], control: null });
        controls.set(lane.component, (component) => control('ControlCollision', component, o.context));
      }
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

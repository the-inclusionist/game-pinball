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
  makeBumperLaneControl, makeBumperGroupControl, makeSpaceWarpRolloverControl, makeReturnLaneControl,
  makeFuelRolloverControl, makeOutLaneControl, makeBonusLaneControl,
  type LaneGroup, type LaneLight,
} from '../control/lanes.js';
import {
  makeSpotTargetControl, makeMissionSpotTargetControl, makeMultiplierBankControl,
  makeGateLightControl, makeKickerControl, type FieldComponent,
} from '../control/controls.js';
import { makeMedalTargetControl, makeBoosterTargetControl, type AwardChainStep } from '../control/banks.js';
import {
  makeDecayingLightGroupControl, makeMultiplierLightGroupControl, makeAccumulatorLampControl,
  DECAY_PERIODS, type DecayingGroup,
} from '../control/light-groups.js';
import {
  makeSkillShotEntryControl, makeSkillShotGateControl, makeSkillShotCollectControl,
  makeSkillShotLostControl, makeShootAgainLightControl, type SkillShotGroup,
} from '../control/launch.js';
import {
  BUMPER_LANE_BINDINGS, LAMP_BINDINGS, RETURN_LANES, FUEL_ROLLOVERS, FUEL_BARGRAPH,
  FUEL_REFUEL_TEXT_ID, OUT_LANES, BONUS_LANE, SPOT_TARGET_SETS, MEDAL_BANK, MULTIPLIER_BANK,
  BOOSTER_BANK, TABLE_ACTIONS, FLIPPER_REBOUNDERS, GATE_LAMPS, KICKERS, SKILL_SHOT,
  type BumperLaneBinding,
} from '../control/bindings.js';
import { addExtraBall, createTableActions } from '../control/table-actions.js';
import {
  handler, bumperControl, rebounderControl, makeFlipperRebounderControl,
  type ControlContext, type ControlledComponent, type MessageCode,
} from '../control/dispatch.js';
import { SCORE_COMPONENTS } from '../control/score-table.js';
import type { OriginalComponents } from './original-components.js';
import type { Gate } from './gate.js';

export interface OriginalDispatchOptions {
  readonly components: OriginalComponents;
  /**
   * ⚠️ THE GATES, WHICH ARE NOT COMPONENTS OF THE COMPONENT BUILDER. A gate is the table's geometry
   * plus a switch, so it can only exist once the geometry does — see `table/original-gates`. Absent
   * means the two hazard spot sets are declined rather than run with their completion missing.
   */
  readonly gates?: ReadonlyMap<string, Gate>;
  readonly context: ControlContext;
  /** `pb::FullTiltMode`. False for Space Cadet, which is the only table this port targets. */
  readonly isFullTilt?: () => boolean;
  /** The option that leaves an outlane open for the rest of the ball. False unless a game says so. */
  readonly isEasyMode?: () => boolean;
  /**
   * The line a control shows, already translated. `params` is for the ones that carry a number —
   * `STRING104` names the bonus it just paid, and a translator is the only thing that can put it in.
   */
  readonly textFor: (resourceId: string, params?: Record<string, string | number>) => string;
}

export interface OriginalDispatch {
  /** A collision on the component with this archive name. Silent for anything not wired. */
  hit(groupName: string): void;
  /** Which archive names this dispatcher will actually act on. */
  readonly wired: ReadonlySet<string>;
}

/**
 * `TLightResetAndTurnOff` sent to a GROUP, which the original's default branch forwards to every
 * member, last to first. `LightGroup` has no such method because it is not a group operation at all —
 * it is one message reaching each lamp.
 */
function skillShotAdapter(components: OriginalComponents, name: string): SkillShotGroup | null {
  const group = components.lightGroups.get(name);
  if (!group) return null;
  const members = components.membersOf(group);

  return {
    get onCount() { return group.onCount; },
    resetGroup: () => group.resetGroup(),
    resetAndTurnOff: () => {
      for (let i = members.length - 1; i >= 0; i--) {
        members[i]!.resetTimed();
        members[i]!.turnOff();
      }
    },
    flashWhenOn: (seconds) => group.flashWhenOn(seconds),
  };
}

/**
 * A light group as its DECAY control drives it. Four of the seven methods are messages the original
 * sends to the group and the port's `LightGroup` does not have, because they are not group operations
 * at all — the default branch forwards them to every member, last to first.
 */
function decayingAdapter(
  components: OriginalComponents, name: string,
  restartNotifyTimer: (seconds: number) => void,
): DecayingGroup | null {
  const group = components.lightGroups.get(name);
  if (!group) return null;
  const members = components.membersOf(group);
  const eachLamp = (run: (light: (typeof members)[number]) => void): void => {
    for (let i = members.length - 1; i >= 0; i--) run(members[i]!);
  };

  return {
    get onCount() { return group.onCount; },
    turnOff: () => eachLamp((light) => light.turnOff()),
    groupResetAndTurnOn: (period) => { group.groupResetAndTurnOn(period); },
    lightsResetAndTurnOn: () => eachLamp((light) => { light.resetTimed(); light.turnOn(); }),
    lightsResetAndTurnOff: () => eachLamp((light) => { light.resetTimed(); light.turnOff(); }),
    restartNotifyTimer,
    // `TLightGroupOffsetAnimationBackward`: the LAST lit lamp goes out, animation kept running.
    offsetAnimationBackward: () => { group.turnOffNext(); },
  };
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
  restartNotifyTimer: (seconds: number) => void,
): { level: number; incLevel(): void; restartNotifyTimer(seconds: number): void } {
  return {
    // ⚠️ THE LEVEL IS READ OFF ONE NAMED BUMPER, as the original does: `bump1->BmpIndex`. They rise
    // together, so any member would answer the same — but transcribing it as "the highest in the group"
    // would be a different rule the day one is raised alone.
    get level() { return components.bumpers.get(binding.guardBumper)?.level ?? 0; },
    incLevel: () => components.raiseGroup(binding.bumperGroup),
    // ⚠️ AND THIS IS THE OTHER HALF OF THE MECHANIC. Filling the lanes restarts the sixty seconds, so
    // a player who keeps working them holds the level; one who stops watches it fall. It was a no-op
    // until the group's own control existed to be restarted.
    restartNotifyTimer,
  };
}

export function createOriginalDispatch(o: OriginalDispatchOptions): OriginalDispatch {
  const byName = new Map<string, ControlledComponent>();
  const controls = new Map<string, (component: ControlledComponent) => void>();
  const scoreRows = new Map(SCORE_COMPONENTS.map((row) => [row.tag, row]));

  // ⚠️ THE BUMPER GROUPS' OWN DECAY, WHICH THE LANES ARE WORKING AGAINST. Every sixty seconds the
  // group takes one level back and restarts itself, so the level is not a ratchet: a player who stops
  // filling lanes watches the bumpers get cheaper. No collision reaches this — it is the group's
  // notify timer talking to its own control function.
  //
  // Built before the lane chains because a lane crossing RESTARTS this timer, and the adapter it
  // hands the lane control has to be able to.
  const restartGroupNotify = new Map<string, (seconds: number) => void>();
  for (const name of o.components.bumperGroups.keys()) {
    const caller: ControlledComponent = { name, scores: [], control: null };
    let restart: (seconds: number) => void = () => {};
    const control = makeBumperGroupControl({
      bumpers: {
        decLevel: () => o.components.lowerGroup(name),
        restartNotifyTimer: (seconds) => restart(seconds),
      },
    });
    restart = (seconds) => o.components.restartGroupTimer(
      name, seconds, () => control('ControlNotifyTimerExpired', caller, o.context),
    );
    restartGroupNotify.set(name, restart);
  }

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
      bumpers: bumperAdapter(
        o.components, binding, restartGroupNotify.get(binding.bumperGroup) ?? (() => {}),
      ),
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

  // ⚠️ THE TWO OUT LANES, WHICH RUN THE SAME CONTROL AND BRANCH ON WHO CALLED IT. `roll4 == caller`
  // takes `lite30 + lite196` and everything else takes `lite29 + lite195`, so the two lanes share one
  // function and differ only in a lookup. Losing the ball here banks an extra ball when either of
  // `lite17`/`lite18` is lit — the ball still drains, which is what makes an out lane worth something.
  {
    const extraBallLamps = OUT_LANES.extraBallLamps
      .map((name) => o.components.lights.get(name))
      .filter((light): light is NonNullable<typeof light> => Boolean(light));

    const warpOf = new Map<string, LaneLight[]>();
    for (const [component, names] of Object.entries(OUT_LANES.warpLamps)) {
      const lamps = names
        .map((name) => o.components.lights.get(name))
        .filter((light): light is NonNullable<typeof light> => Boolean(light));
      if (lamps.length === names.length) warpOf.set(component, lamps as unknown as LaneLight[]);
    }

    if (extraBallLamps.length === OUT_LANES.extraBallLamps.length) {
      // ⚠️ THE SAME `addExtraBall` THE TABLE ACTIONS USE, not a copy of it. It is three lines — a
      // counter, a sound and a line — and two copies of three lines is exactly how a counter and its
      // announcement drift apart without either looking wrong.
      const extraBallText = o.textFor(OUT_LANES.extraBallTextId);
      const control = makeOutLaneControl({
        extraBallLamps: extraBallLamps as unknown as LaneLight[],
        addExtraBall: (seconds) => addExtraBall(o.context, extraBallText, seconds),
        warpLampsFor: (caller) => warpOf.get(caller.name),
        missSound: OUT_LANES.missSound,
      });

      for (const name of OUT_LANES.components) {
        const row = scoreRows.get(name);
        byName.set(name, { name, scores: row?.scores ?? [], control: null });
        controls.set(name, (component) => control('ControlCollision', component, o.context));
      }
    }
  }

  // ⚠️ THE BONUS LANE, WHICH FILLS THE TANK EITHER WAY. The refill sits outside the branch in the
  // original: collecting the bonus and missing it both end with the tank at eleven. Reading it as part
  // of the `else` would make a lit lamp COST the player their fuel — a rule inverted by an indentation.
  {
    const lamp = o.components.lights.get(BONUS_LANE.lamp);
    const tank = o.components.bargraphs.get(FUEL_BARGRAPH);
    if (lamp && tank) {
      const control = makeBonusLaneControl({
        lamp: lamp as unknown as LaneLight,
        bargraph: tank,
        topSplitIndex: BONUS_LANE.topSplitIndex,
        bonusText: (points) => o.textFor(BONUS_LANE.bonusTextId, { points }),
        missText: o.textFor(BONUS_LANE.missTextId),
        collectSound: BONUS_LANE.collectSound,
        missSound: BONUS_LANE.missSound,
      });
      const row = scoreRows.get(BONUS_LANE.component);
      byName.set(BONUS_LANE.component, {
        name: BONUS_LANE.component, scores: row?.scores ?? [], control: null,
      });
      controls.set(BONUS_LANE.component,
        (component) => control('ControlCollision', component, o.context));
    }
  }

  // ⚠️ THE SPOT TARGET SETS, OF WHICH ONE RUNS. `makeSpotTargetControl` matches its caller by IDENTITY
  // against the components it was given — the same rule as the return lanes — so the objects put in
  // `byName` have to be the ones handed to the factory.
  //
  // The other three are declined and the binding says why: two disable a gate on completion and this
  // build constructs no `TGate`, and the mission set chooses its sound from a lamp before it knows
  // whether the set completed. Approximating either would be a table that plays differently.
  //
  // ⚠️ AND THE TWO HALVES OF THAT GUARD DECIDE THE SAME THING TODAY. The mission set is excluded by its
  // completion being `none` before `soundFromLamp` is ever read, so dropping the second half changes
  // nothing and a mutation that drops it SURVIVES. Recorded rather than contrived around: they are two
  // different reasons a set cannot run, and the day a gate exists the first half stops covering the
  // second. This is the same shape as the pair of guards over `LAMP_BINDINGS` above.
  // ⚠️ AND THE MISSION SET, WHICH RUNS ITS OWN FUNCTION. Its sound comes from `lite198` rather than
  // from whether the set completed, and its completion is silent — see `makeMissionSpotTargetControl`.
  // It is registered here rather than bent into the loop below, because approximating it would be a
  // table that sounds the same whether or not a mission is running.
  for (const set of SPOT_TARGET_SETS) {
    if (!set.soundFromLamp || !set.maskLamp || !set.noMissionSound) continue;

    const group = o.components.lightGroups.get(set.lightGroup);
    const maskLamp = o.components.lights.get(set.maskLamp);
    const missionLamp = o.components.lights.get(set.soundFromLamp);
    const lamps = set.lamps
      .map((name) => o.components.lights.get(name))
      .filter((light): light is NonNullable<typeof light> => Boolean(light));
    if (!group || !maskLamp || !missionLamp || lamps.length !== set.lamps.length) continue;

    const targets: ControlledComponent[] = set.targets.map((name) => {
      const row = scoreRows.get(name);
      return { name, scores: row?.scores ?? [], control: null };
    });

    const control = makeMissionSpotTargetControl({
      targets, lamps, group, maskLamp, missionLamp,
      noMissionSound: set.noMissionSound,
      hitSound: set.hitSound,
    });

    for (const target of targets) {
      byName.set(target.name, target);
      controls.set(target.name, (component) => control('ControlCollision', component, o.context));
    }
  }

  for (const set of SPOT_TARGET_SETS) {
    if (set.soundFromLamp) continue;

    const group = o.components.lightGroups.get(set.lightGroup);
    const lamps = set.lamps
      .map((name) => o.components.lights.get(name))
      .filter((light): light is NonNullable<typeof light> => Boolean(light));
    if (!group || lamps.length !== set.lamps.length) continue;

    // What the set DOES when it completes, or nothing to wire it to.
    let onComplete: ((ctx: ControlContext) => void) | null = null;
    if (set.completion.kind === 'fillTank') {
      const tank = o.components.bargraphs.get(FUEL_BARGRAPH);
      const completion = set.completion;
      const completionText = o.textFor(completion.textId);
      if (tank) {
        onComplete = (ctx) => {
          tank.toggleSplitIndex(completion.splitIndex);
          ctx.showInfo(completionText, 2);
        };
      }
    } else if (set.completion.kind === 'disableGate') {
      // ⚠️ `TGateDisable` OPENS THE GATE. Clearing a gate's active flag is opening a way through, and
      // the hazard set's reward is precisely that the chute stops being a wall.
      const gate = o.gates?.get(set.completion.gate);
      if (gate) onComplete = () => gate.openGate();
    }
    if (!onComplete) continue;

    const targets: ControlledComponent[] = set.targets.map((name) => {
      const row = scoreRows.get(name);
      return { name, scores: row?.scores ?? [], control: null };
    });

    const control = makeSpotTargetControl({
      targets,
      lamps,
      group,
      onComplete,
      hitSound: set.hitSound,
      completeSound: set.completeSound,
      ...(set.maskLamp ? { maskLamp: o.components.lights.get(set.maskLamp)! } : {}),
    });

    for (const target of targets) {
      byName.set(target.name, target);
      controls.set(target.name, (component) => control('ControlCollision', component, o.context));
    }
  }

  // ⚠️ THE TWO DECAYING LIGHT GROUPS, WHICH ARE THE OTHER HALF OF BOTH BANKS. Winning a rung starts a
  // thirty-second clock; when it runs out the last lit lamp goes out and the clock restarts, until the
  // group is dark. For the multiplier that also takes the score multiplier down a step — so a
  // multiplier, like a bumper level, is held rather than won.
  //
  // ⚠️ AND THE BANK MUST DRIVE THE GROUP THROUGH ITS CONTROL, not around it. The original writes
  // `MultiplierLightGroupControl(TLightGroupResetAndTurnOn, top_target_lights)` — a control function
  // calling another control function — and that call is what starts the clock. Lighting the lamp
  // directly leaves the group lit for ever, which is what this port did until now.
  const groupControlFor = (name: string, text?: string): ((code: MessageCode) => void) | null => {
    let restart: (seconds: number) => void = () => {};
    const group = decayingAdapter(o.components, name, (seconds) => restart(seconds));
    if (!group) return null;
    const caller: ControlledComponent = { name, scores: [], control: null };
    const control = text !== undefined
      ? makeMultiplierLightGroupControl({ group, enableText: text })
      : makeDecayingLightGroupControl({ group, period: DECAY_PERIODS.medal });
    restart = (seconds) => o.components.restartGroupTimer(
      name, seconds, () => control('ControlNotifyTimerExpired', caller, o.context),
    );
    return (code) => control(code, caller, o.context);
  };

  const medalGroup = groupControlFor(MEDAL_BANK.lightGroup);
  const multiplierGroup = groupControlFor(
    MULTIPLIER_BANK.lightGroup, o.textFor(MULTIPLIER_BANK.textIds[3]!),
  );

  // ⚠️ THE TWO POPUP BANKS. Their memory lives in the TARGETS' message fields, so the objects handed
  // to the factory are the ones that have to be registered — a second set would give every hit a fresh
  // zero and the bank would never reach three.
  //
  // ⚠️ AND `popUp` DOES NOTHING HERE, WHICH IS HONEST RATHER THAN MISSING. `TPopupTargetEnable` sends a
  // struck target physically back up, and this build constructs no `TPopupTarget`: the archive's
  // targets are static geometry that never dropped in the first place. The SCORING rule is unaffected,
  // because it is the message field and not the geometry that stops a struck target paying twice —
  // what is missing is the target sinking out of the ball's way, which is animation and collision.
  const bankOf = (binding: { readonly targets: readonly string[] }): FieldComponent[] =>
    binding.targets.map((name) => {
    const row = scoreRows.get(name);
    return { name, scores: row?.scores ?? [], control: null, messageField: 0 };
  });

  {
    const group = o.components.lightGroups.get(MULTIPLIER_BANK.lightGroup);
    if (group) {
      const bank = bankOf(MULTIPLIER_BANK);
      const control = makeMultiplierBankControl({
        bank,
        lightGroup: {
          get onCount() { return group.onCount; },
          // Through the group's own control, which is what starts the thirty seconds.
          turnOnNext: () => { multiplierGroup?.('TLightGroupResetAndTurnOn'); return true; },
        },
        popUp: () => {},
        multiplierTexts: MULTIPLIER_BANK.textIds.map((id) => o.textFor(id)),
      });
      for (const target of bank) {
        byName.set(target.name, target);
        controls.set(target.name, (component) => control('ControlCollision', component, o.context));
      }
    }
  }

  {
    const group = o.components.lightGroups.get(MEDAL_BANK.lightGroup);
    if (group) {
      const bank = bankOf(MEDAL_BANK);
      const extraBallText = o.textFor(OUT_LANES.extraBallTextId);
      const control = makeMedalTargetControl({
        bank,
        group: {
          get onCount() { return group.onCount; },
          lightOneMore: () => { medalGroup?.('TLightGroupResetAndTurnOn'); },
        },
        addExtraBall: (seconds) => addExtraBall(o.context, extraBallText, seconds),
        popUp: () => {},
        texts: MEDAL_BANK.textIds.map((id) => o.textFor(id)),
      });
      for (const target of bank) {
        byName.set(target.name, target);
        controls.set(target.name, (component) => control('ControlCollision', component, o.context));
      }
    }
  }

  // ⚠️ THE BOOSTER BANK, WHICH REACHES THE TABLE-LEVEL AWARDS. `control/table-actions` is the single
  // implementation of all of them — a flag, a lamp and a line — and it is built here rather than having
  // four of its rules copied into the chain's grants. Three of its seven actions have no caller yet:
  // multiball and replay belong to the missions, which this build does not run.
  {
    const actions = createTableActions({
      ctx: o.context,
      text: {
        extraBall: o.textFor(TABLE_ACTIONS.textIds.extraBall),
        bonusHeld: o.textFor(TABLE_ACTIONS.textIds.bonusHeld),
        bonusSet: o.textFor(TABLE_ACTIONS.textIds.bonusSet),
        jackpotSet: o.textFor(TABLE_ACTIONS.textIds.jackpotSet),
        multiball: o.textFor(TABLE_ACTIONS.textIds.multiball),
        flagLightsSet: o.textFor(TABLE_ACTIONS.textIds.flagLightsSet),
        replay: o.textFor(TABLE_ACTIONS.textIds.replay),
      },
      lamps: {
        bonusHold: TABLE_ACTIONS.lamps.bonusHold,
        bonus: TABLE_ACTIONS.lamps.bonus,
        jackpot: TABLE_ACTIONS.lamps.jackpot,
        replay: TABLE_ACTIONS.lamps.replay,
        multiball: TABLE_ACTIONS.lamps.multiball,
        flagLights: TABLE_ACTIONS.lamps.flagLights,
      },
    });

    const grantOf: Readonly<Record<string, () => void>> = {
      flagLights: () => actions.setFlagLights(),
      jackpot: () => actions.setJackpot(),
      bonus: () => actions.setBonus(),
      bonusHold: () => actions.setBonusHold(),
    };

    const missionLamp = o.components.lights.get(BOOSTER_BANK.missionLamp);
    const chain: AwardChainStep[] = [];
    for (const step of BOOSTER_BANK.chain) {
      const lamp = o.components.lights.get(step.lamp);
      const grant = grantOf[step.award];
      if (!lamp || !grant) continue;
      chain.push({ lamp: lamp as unknown as LaneLight, grant, sound: step.sound });
    }

    if (missionLamp && chain.length === BOOSTER_BANK.chain.length) {
      const bank = bankOf(BOOSTER_BANK);
      const control = makeBoosterTargetControl({
        bank, chain, popUp: () => {}, missionLamp,
      });
      for (const target of bank) {
        byName.set(target.name, target);
        controls.set(target.name, (component) => control('ControlCollision', component, o.context));
      }
    }
  }

  // ⚠️ THE COMPONENTS THAT SCORE FROM THEIR OWN TABLE AND REACH NOTHING ELSE. `BumperControl` is one
  // line — `AddScore(get_scoring(BmpIndex))` — and `RebounderControl` is the same with a fixed index.
  // Neither needs a binding, because the score table already says which component runs which control;
  // reading it here rather than repeating the seven bumper names is one list instead of two.
  //
  // ⚠️ AND THE BUMPER'S `self` IS THE BUMPER. The level is the score INDEX and nothing in the control
  // advances it — the lanes do. Registering these without `self` would pay every bumper its first
  // price for ever, which looks like the table being stingy rather than like a missing reference.
  //
  // ⚠️ THE TWO CONTROLS ARE INDISTINGUISHABLE ON A REBOUNDER, and a mutation running `bumperControl`
  // for a rebounder SURVIVES. It has to: a rebounder carries no `self`, so the level reads zero and
  // `getScoring(caller, 0)` is exactly what `rebounderControl` does. Recorded as an equivalent mutant
  // rather than chased — they are two functions in the original and stay two here, because the day a
  // rebounder gains a level the difference is real.
  for (const row of SCORE_COMPONENTS) {
    if (row.controlName === 'BumperControl') {
      const bumper = o.components.bumpers.get(row.tag);
      if (!bumper) continue;
      byName.set(row.tag, { name: row.tag, scores: row.scores, control: null, self: bumper });
      controls.set(row.tag, (component) => bumperControl('ControlCollision', component, o.context));
    } else if (row.controlName === 'RebounderControl') {
      byName.set(row.tag, { name: row.tag, scores: row.scores, control: null });
      controls.set(row.tag, (component) => rebounderControl('ControlCollision', component, o.context));
    }
  }

  for (const binding of FLIPPER_REBOUNDERS) {
    if (!o.components.lights.has(binding.lamp)) continue;
    const row = scoreRows.get(binding.component);
    const control = makeFlipperRebounderControl(binding.lamp);
    byName.set(binding.component, {
      name: binding.component, scores: row?.scores ?? [], control: null,
    });
    controls.set(binding.component,
      (component) => control('ControlCollision', component, o.context));
  }

  // ⚠️ THE GATE LAMPS, WHICH NO COLLISION REACHES. `TGate::Message` ends with `control::handler(code,
  // this)`, so the gate tells its own control function every time it opens or shuts — and that is the
  // only way the two lamps ever come on. They are not in `wired`, because `wired` is what a COLLISION
  // can reach and nothing about these is a collision.
  //
  // Without this the hazard spot sets open a chute and the player is told nothing: the reward happens
  // and looks exactly like the shot missing.
  for (const binding of GATE_LAMPS) {
    const gate = o.gates?.get(binding.gate);
    const lamps = binding.lamps
      .map((name) => o.components.lights.get(name))
      .filter((light): light is NonNullable<typeof light> => Boolean(light));
    if (!gate || lamps.length !== binding.lamps.length) continue;

    const setLights = makeGateLightControl({ lamps });
    gate.control = (code) => {
      if (code === 'TGateDisable') setLights(true);
      else if (code === 'TGateEnable') setLights(false);
    };
  }

  // ⚠️ AND WHAT SHUTS THE CHUTE AGAIN, which no collision reaches either. The kickback's timer is the
  // clock: a tenth of a second after it has thrown the ball back out, `ControlTimerExpired` arrives
  // here and the gate goes back. Without this the hazard set's reward is permanent, which is a
  // different game — and in EASY MODE it deliberately is, because the control declines to shut it.
  for (const binding of KICKERS) {
    const kickback = o.components.kickbacks.get(binding.component);
    const gate = o.gates?.get(binding.gate);
    if (!kickback || !gate) continue;

    const control = makeKickerControl({ gate, isEasyMode: o.isEasyMode ?? (() => false) });
    const caller: ControlledComponent = { name: binding.component, scores: [], control: null };
    kickback.control = () => control('ControlTimerExpired', caller, o.context);
  }

  // ⚠️ THE SKILL SHOT, WHOSE PAYOUT FALLS AFTER THE THIRD LAMP. One entry, five tripwires and two
  // ways out; `lite67` being lit is what "the run is open" means, and every later gate tests it.
  {
    const group = skillShotAdapter(o.components, SKILL_SHOT.lightGroup);
    const firstLamp = o.components.lights.get(SKILL_SHOT.entry.firstLamp);
    const shootAgainLamp = o.components.lights.get(SKILL_SHOT.entry.shootAgainLamp);
    const tank = o.components.bargraphs.get(FUEL_BARGRAPH);
    const flashLamps = SKILL_SHOT.entry.flashLamps
      .map((name) => o.components.lights.get(name))
      .filter((light): light is NonNullable<typeof light> => Boolean(light));

    const register = (name: string, control: ReturnType<typeof makeSkillShotGateControl>): void => {
      const row = scoreRows.get(name);
      byName.set(name, { name, scores: row?.scores ?? [], control: null });
      controls.set(name, (component) => control('ControlCollision', component, o.context));
    };

    if (group && firstLamp && shootAgainLamp && tank
      && flashLamps.length === SKILL_SHOT.entry.flashLamps.length) {
      register(SKILL_SHOT.entry.component, makeSkillShotEntryControl({
        shootAgainLamp: shootAgainLamp as unknown as LaneLight,
        firstLamp: firstLamp as unknown as LaneLight,
        group,
        flashLamps: flashLamps as unknown as LaneLight[],
        bargraph: tank,
        topSplitIndex: SKILL_SHOT.entry.topSplitIndex,
        sound: SKILL_SHOT.sound,
      }));

      for (const gate of SKILL_SHOT.gates) {
        const lamp = o.components.lights.get(gate.lamp);
        if (!lamp) continue;
        register(gate.component, makeSkillShotGateControl({
          armLamp: firstLamp as unknown as LaneLight,
          lamp: lamp as unknown as LaneLight,
          sound: SKILL_SHOT.sound,
        }));
      }

      const trekGuardLamp = o.components.lights.get(SKILL_SHOT.collect.trekGuardLamp);
      const trekGroups = SKILL_SHOT.collect.trekGroups
        .map((name) => skillShotAdapter(o.components, name))
        .filter((adapter): adapter is SkillShotGroup => adapter !== null);

      if (trekGuardLamp && trekGroups.length === SKILL_SHOT.collect.trekGroups.length) {
        register(SKILL_SHOT.collect.component, makeSkillShotCollectControl({
          group,
          trekGuardLamp: trekGuardLamp as unknown as LaneLight,
          trekGroups,
          sound: SKILL_SHOT.sound,
          scoreText: (points) => o.textFor(SKILL_SHOT.collect.textId, { points }),
        }));
      }

      register(SKILL_SHOT.lost.component, makeSkillShotLostControl({ group }));
    }
  }

  // ⚠️ THE LAMPS WHOSE OWN CLOCK RUNS THEIR CONTROL. A lamp lit with `TLightTurnOnTimed` is an award
  // with a clock, and the lamp going dark is only what the player SEES — clearing the flag is what
  // ends it. `lite59` and `lite60` were being lit by the booster chain and their flags were never
  // cleared, so the bonus went on accumulating for the rest of the ball.
  //
  // None of this is in `wired`: no collision reaches a lamp's timer.
  for (const binding of LAMP_BINDINGS) {
    if (binding.onMessage !== 'ControlTimerExpired') continue;
    const lamp = o.components.lights.get(binding.component);
    if (!lamp) continue;

    const caller: ControlledComponent = { name: binding.component, scores: [], control: null };
    const control = binding.accumulator
      ? makeAccumulatorLampControl({ flag: binding.accumulator })
      : makeShootAgainLightControl({ lamp });
    lamp.control = () => control('ControlTimerExpired', caller, o.context);
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

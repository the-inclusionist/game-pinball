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
  makeFuelRolloverControl, makeOutLaneControl, makeBonusLaneControl,
  type LaneGroup, type LaneLight,
} from '../control/lanes.js';
import {
  makeSpotTargetControl, makeMultiplierBankControl, makeGateLightControl, type FieldComponent,
} from '../control/controls.js';
import { makeMedalTargetControl, makeBoosterTargetControl, type AwardChainStep } from '../control/banks.js';
import {
  BUMPER_LANE_BINDINGS, LAMP_BINDINGS, RETURN_LANES, FUEL_ROLLOVERS, FUEL_BARGRAPH,
  FUEL_REFUEL_TEXT_ID, OUT_LANES, BONUS_LANE, SPOT_TARGET_SETS, MEDAL_BANK, MULTIPLIER_BANK,
  BOOSTER_BANK, TABLE_ACTIONS, FLIPPER_REBOUNDERS, GATE_LAMPS, type BumperLaneBinding,
} from '../control/bindings.js';
import { addExtraBall, createTableActions } from '../control/table-actions.js';
import {
  handler, bumperControl, rebounderControl, makeFlipperRebounderControl,
  type ControlContext, type ControlledComponent,
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
        lightGroup: group,
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
        group: { get onCount() { return group.onCount; }, lightOneMore: () => { group.turnOnNext(); } },
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

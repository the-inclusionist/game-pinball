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
  makeFuelRolloverControl, makeOutLaneControl, makeBonusLaneControl, makeExtraBallLightControl,
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
  makeSkillShotLostControl, makeShootAgainLightControl, makeLaunchRampControl,
  type SkillShotGroup,
} from '../control/launch.js';
import {
  BUMPER_LANE_BINDINGS, LAMP_BINDINGS, RETURN_LANES, FUEL_ROLLOVERS, FUEL_BARGRAPH,
  FUEL_REFUEL_TEXT_ID, OUT_LANES, BONUS_LANE, SPOT_TARGET_SETS, MEDAL_BANK, MULTIPLIER_BANK,
  BOOSTER_BANK, TABLE_ACTIONS, FLIPPER_REBOUNDERS, GATE_LAMPS, KICKERS, SKILL_SHOT,
  LAUNCH_RAMP, FLAGS, KICKOUTS, DRAIN, PER_BALL_RESET, MISSIONS, RANK, WORM_HOLE,
  DRAIN_BLOCKER, PLUNGER_FEED, WORM_HOLE_SINKS, HYPERSPACE, CHEAT_GATES, ALIEN_MENACE,
  TIME_WARP_PART_TWO, GAME_OVER,
  type BumperLaneBinding,
} from '../control/bindings.js';
import { addExtraBall, createTableActions } from '../control/table-actions.js';
import { makeHyperspaceKickOutControl, awardEverything } from '../control/hyperspace.js';
import { VOICES } from '../audio/voices.js';
import {
  makeFlagControl, makeBlackHoleKickoutControl, makeGravityWellKickoutControl,
  makeWormHoleDestinationControl, advanceWormHoleDestination, makeWormHoleControl,
  announceGravityWell,
  type AdvanceOptions, type ArrowLamp, type WormholeSink, type GravityWellOptions,
} from '../control/wormhole.js';
import { drainBall, type DrainTable } from '../control/drain.js';
import {
  createMissionMachine, makeWaitingDeploymentController, type MissionMachine,
  type MissionContext, type MissionController,
} from '../control/mission.js';
import { makeMissionController } from '../control/mission-runner.js';
import { MISSION_TABLE } from '../control/mission-table.js';
import { addRankProgress as advanceRank } from '../control/rank.js';
import { cheatBumpRank } from '../control/cheats.js';
import {
  makeAlienMenaceController, makeTimeWarpPartTwoController, makeGameoverController,
} from '../control/mission-specials.js';
import {
  makePlungerControl, makeDrainBallBlockerControl, NEW_BALL_REFLEX_SCORE,
  type FeedGroup, type FeedTable,
} from '../control/feed.js';
import {
  handler, bumperControl, rebounderControl, makeFlipperRebounderControl,
  type ControlContext, type ControlledComponent, type MessageCode,
} from '../control/dispatch.js';
import { SCORE_COMPONENTS } from '../control/score-table.js';
import type { OriginalComponents } from './original-components.js';
import type { Gate } from './gate.js';
import type { Kickout } from './kickout.js';
import type { Blocker } from './blocker.js';
import type { Sink } from './sink.js';

export interface OriginalDispatchOptions {
  readonly components: OriginalComponents;
  /**
   * ⚠️ THE END OF A BALL, WHICH IS THE ONLY THING THAT CAN END A GAME. Absent leaves the drain paying
   * its flat score and nothing else — a ball that reaches the bottom and simply stays there.
   */
  readonly drain?: {
    /** Players, balls and the cheat. `ControlContext.table` carries only what a control needs. */
    readonly table: DrainTable;
    /** What the demonstration does with the outcome: feed another ball, or stop. */
    readonly onOutcome: (outcome: 'returned' | 'shootAgain' | 'spareSpent' | 'multiballContinues'
      | 'ballLost', gameOver: boolean) => void;
  };
  /**
   * ⚠️ THE HOLES, WHICH DO NOT RELEASE THEMSELVES. A kickout captures the ball and waits for its
   * control to call `restartTimer`; a hole whose control is not bound here keeps the ball for the rest
   * of the game. Absent means the caller must not let them own their collisions either.
   */
  readonly kickouts?: ReadonlyMap<string, Kickout>;
  /**
   * ⚠️ THE NINE POPUP TARGETS, WHICH A BANK PUTS BACK UP. `TPopupTargetEnable` is what the three banks
   * send when they complete, and a struck target disables its own edges — so without this a bank fills
   * once and never again, because the ball can no longer reach any of its three.
   */
  readonly popupTargets?: ReadonlyMap<string, { popUp(): void }>;
  /**
   * ⚠️ THE GATES, WHICH ARE NOT COMPONENTS OF THE COMPONENT BUILDER. A gate is the table's geometry
   * plus a switch, so it can only exist once the geometry does — see `table/original-gates`. Absent
   * means the two hazard spot sets are declined rather than run with their completion missing.
   */
  readonly gates?: ReadonlyMap<string, Gate>;
  /**
   * ⚠️ THE HOLES THAT GIVE THE BALL BACK, AND ONLY THE WORMHOLE'S THREE. A sink does not release
   * itself: it swallows the ball and waits for a control to reset its timer. `v_sink7` — the escape
   * chute — runs no control this build has, so a caller must not let it own its collisions either.
   */
  readonly sinks?: ReadonlyMap<string, Sink>;
  /**
   * ⚠️ WHAT PUTS A BALL BACK INTO PLAY, AND THE ONLY THING THAT EVER RAISES THE BARRIER. `v_bloc1` is
   * built by `table/original-blockers` and reached from exactly one place in the whole game:
   * `PlungerControl`'s easy-mode line. Absent, the plunger is declined whole and the blocker is a
   * component no running game can touch — which is what it was until this option existed.
   */
  readonly feed?: {
    /** `table_unlimited_balls` and `TableG->ReflexShotScore`, which `ControlContext` does not carry. */
    readonly table: FeedTable;
    readonly blockers: ReadonlyMap<string, Blocker>;
  };
  /**
   * ⚠️ WHAT THE END OF A GAME DOES BESIDES STOPPING, and none of it belongs to the dispatcher.
   * `GameoverController` turns the goal lights off, changes the table's mode, sends both flippers
   * `GameOver` and starts track one. `control/drain` has been handing the lamp over to mission 32 for
   * several passes with nothing behind it — the lamp said 32 and the machine found no controller — so
   * absent, this is declined and the caller keeps a game that stops without ever saying so.
   */
  readonly gameOver?: {
    /** `flip1` and `flip2`. `TFlipper::Message(GameOver)` is what stops them answering. */
    readonly flippers: readonly { gameOver(): void }[];
    /** `pb::mode_change(GameModes::GameOver)`. */
    readonly enterMode: () => void;
    /**
     * `high_score::highscore_table`. This port has no high-score table, so the default is empty and the
     * second carousel shows nothing — which is exactly what the original does with an empty table, and
     * is stated here rather than discovered by somebody watching the banner repeat.
     */
    readonly highScores?: () => readonly number[];
  };
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

/** `soundwave7`'s length, which is how long the gravity well holds the ball. */
export const GRAVITY_WELL_HOLD_SECONDS = 0.3;

export interface OriginalDispatch {
  /**
   * ⚠️ THE MISSION MACHINE, WHICH IS WHAT `ControlContext.missionControl` HAS TO REACH. `handler` runs
   * the component's control and THEN the mission machine, on every event — so a caller that builds
   * this dispatcher has to route its context's `missionControl` back here, or every mission message
   * lands in an empty function.
   */
  readonly missions: MissionMachine;
  /** What the missions have earned towards a rank. See the note where it is counted. */
  readonly rankPoints: number;
  /**
   * ⚠️ WHICH MISSIONS CAN ACTUALLY RUN, by number. A mission whose components are not all wired is
   * declined WHOLE — half a mission would count some of its hits and never finish — and this is the
   * inventory of that decision, in the shape every other one in this file takes.
   */
  readonly missionsRun: ReadonlySet<number>;
  /** A collision on the component with this archive name. Silent for anything not wired. */
  hit(groupName: string): void;
  /** Which archive names this dispatcher will actually act on. */
  readonly wired: ReadonlySet<string>;
  /**
   * `PlungerControl`'s two messages, which are sent at different moments: `PlungerFeedBall` when the
   * ball arrives on the plunger, `PlungerStartFeedTimer` when the feed begins. Null when the feed was
   * not given — declined whole rather than half-run.
   */
  readonly plunger: { feedBall(): void; startFeedTimer(): void } | null;
  /**
   * `DrainBallBlockerControl(TBlockerEnable)`, exposed because the plunger is not its only sender: in
   * the original a hyperspace award raises the barrier too, and that control is not wired yet.
   */
  raiseDrainBlocker?(): void;
  /**
   * ⚠️ THE BACK DOOR'S HANDS. `control/cheats` holds the buffer and the codes and knows nothing about
   * this table; these are the five things only the dispatcher can do, and each is the message the
   * upstream's branch sends rather than an effect written to look like it. A piece that was never
   * wired answers with nothing rather than with something approximate — the same rule every declined
   * block in this file follows.
   */
  readonly cheats: DispatchCheats;
}

/** What `CheatActions` needs from the control layer. The rest are flags and belong to the caller. */
export interface DispatchCheats {
  /** `GravityWellKickoutControl(ControlEnableMultiplier, nullptr)`. */
  armGravityWell(): void;
  addExtraBall(seconds: number): void;
  bumpRank(): void;
  /** `DrainBallBlockerControl(TBlockerEnable, block1)`. */
  raiseBlocker(): void;
  /** `DrainBallBlockerControl(ControlTimerExpired, block1)` — see `control/cheats`' header. */
  expireBlocker(): void;
  /** `gate1->Message(TGateDisable)` and `gate2->Message(TGateDisable)`, and no other gate. */
  disableGates(): void;
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

/**
 * A light group as `PlungerControl` drives it.
 *
 * ⚠️ `TLightGroupOffsetAnimationForward` IS NOT `stepForward`. The original's case lights the next DARK
 * lamp — `next_light_up`, one lamp on — and only then restarts the animation; it does not rotate the
 * persistent state around the ring. It is the exact twin of the decay control's
 * `TLightGroupOffsetAnimationBackward`, and its `value` is unused there as it is here.
 */
function feedAdapter(components: OriginalComponents, name: string): FeedGroup | null {
  const group = components.lightGroups.get(name);
  if (!group) return null;
  const members = components.membersOf(group);
  const eachLamp = (run: (light: (typeof members)[number]) => void): void => {
    for (let i = members.length - 1; i >= 0; i--) run(members[i]!);
  };

  return {
    get onCount() { return group.onCount; },
    lightsResetAndTurnOn: () => eachLamp((light) => { light.resetTimed(); light.turnOn(); }),
    lightsResetAndTurnOff: () => eachLamp((light) => { light.resetTimed(); light.turnOff(); }),
    offsetAnimationForward: () => { group.turnOnNext(); },
    animationBackward: (period) => group.animateBackward(period),
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

/** One named member's level, which is what the original reads: `bump1->BmpIndex`. */
function levelOfGroup(components: OriginalComponents, groupName: string): number {
  const first = components.bumperGroups.get(groupName)?.[0];
  if (first === undefined) return 0;
  return components.bumpers.get(first)?.level ?? 0;
}

function bumperAdapter(
  components: OriginalComponents, binding: BumperLaneBinding,
  restartNotifyTimer: (seconds: number) => void,
  announceLevel: () => void,
): { level: number; incLevel(): void; restartNotifyTimer(seconds: number): void } {
  return {
    // ⚠️ THE LEVEL IS READ OFF ONE NAMED BUMPER, as the original does: `bump1->BmpIndex`. They rise
    // together, so any member would answer the same — but transcribing it as "the highest in the group"
    // would be a different rule the day one is raised alone.
    get level() { return components.bumpers.get(binding.guardBumper)?.level ?? 0; },
    incLevel: () => {
      const before = components.bumpers.get(binding.guardBumper)?.level ?? 0;
      components.raiseGroup(binding.bumperGroup);
      // Only a level that MOVED speaks — `if (nextBmp != BmpIndex)`. At the top of the ladder the
      // group clamps and the mission must not be handed a win it did not earn.
      if ((components.bumpers.get(binding.guardBumper)?.level ?? 0) !== before) announceLevel();
    },
    // ⚠️ AND THIS IS THE OTHER HALF OF THE MECHANIC. Filling the lanes restarts the sixty seconds, so
    // a player who keeps working them holds the level; one who stops watches it fall. It was a no-op
    // until the group's own control existed to be restarted.
    restartNotifyTimer,
  };
}

export function createOriginalDispatch(o: OriginalDispatchOptions): OriginalDispatch {
  /**
   * ⚠️ THE DISPATCHER OWNS `missionControl`, AND THE CALLER MUST NOT. `handler` runs a component's
   * control and then the mission machine, on every event — and the machine lives in here. A caller
   * that had to route its own context back into this object would be wiring a loop it cannot see, and
   * a caller that forgot would get a table with no state at all beyond its lamps, silently.
   *
   * The machine does not exist yet at this point, so the reference is filled in at the end. Nothing
   * can dispatch before then: the first message comes from a collision.
   */
  let missions: MissionMachine | null = null;
  /** Rank progress earned by missions, which is also what the outer circle is showing. */
  let rankPoints = 0;
  const missionTextBox: ControlledComponent = { name: MISSIONS.textBox, scores: [], control: null };
  const ctx: ControlContext = {
    ...o.context,
    missionControl: (code, caller) => missionCtx && missions?.dispatch(code, caller, missionCtx),
  };

  /**
   * The machine's context: the control one plus the four things only a mission uses. Built once, and
   * handed to every dispatch INCLUDING the re-entrant ones — a controller that transitions announces
   * itself through this, and a fresh object each time would be a different `missionTextBox` and the
   * rewrite that turns its timeout into `ControlMissionStarted` would stop matching.
   */
  const missionCtx: MissionContext = {
    ...ctx,
    missionLamp: o.components.lights.get(MISSIONS.lamp) ?? { messageField: 0 },
    dispatch: (code, caller) => missions?.dispatch(code, caller, missionCtx),
    missionTextBox,
    // The mission line is its own block of the screen — see ADR-0002.
    showMissionText: (text, seconds) => ctx.showMission(text, seconds),
    clearMissionText: () => ctx.showMission('', 0),
  };

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
  /**
   * ⚠️ THE MESSAGE THAT WINS ALIEN MENACE, AND NOTHING WAS SENDING IT. `TBumper::Message` ends its
   * `TBumperSetBmpIndex` case with `control::handler(TBumperSetBmpIndex, this)` — but only inside
   * `if (nextBmp != BmpIndex)`, so a level that does not move says nothing. Both the increment and the
   * decrement route through that case, which is why a DECREMENT that leaves the level above zero also
   * finishes the mission: the controller asks `if (bump1->BmpIndex)` and not "did it go up".
   *
   * ⚠️ AND IT IS SENT FROM HERE RATHER THAN FROM `table/bumper`. The original puts it in the component;
   * this port has exactly two places where a level moves — the lane chain's `incLevel` and the group's
   * own sixty-second decay — and putting it in both keeps the component free of the control layer. The
   * difference is a level changed by some third path, of which this port has none, and this comment is
   * where whoever adds one will find out that they have to send it.
   */
  const announceBumperLevel = (groupName: string): void => {
    for (const member of o.components.bumperGroups.get(groupName) ?? []) {
      const component = byName.get(member);
      if (component) handler('TBumperSetBmpIndex', component, ctx);
    }
  };

  const restartGroupNotify = new Map<string, (seconds: number) => void>();
  for (const name of o.components.bumperGroups.keys()) {
    const caller: ControlledComponent = { name, scores: [], control: null };
    let restart: (seconds: number) => void = () => {};
    const control = makeBumperGroupControl({
      bumpers: {
        decLevel: () => {
          const before = levelOfGroup(o.components, name);
          o.components.lowerGroup(name);
          if (levelOfGroup(o.components, name) !== before) announceBumperLevel(name);
        },
        restartNotifyTimer: (seconds) => restart(seconds),
      },
    });
    restart = (seconds) => o.components.restartGroupTimer(
      name, seconds, () => control('ControlNotifyTimerExpired', caller, ctx),
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
        () => announceBumperLevel(binding.bumperGroup),
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
      controls.set(lane.component, (component) => control('ControlCollision', component, ctx));
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
    controls.set(binding.component, (component) => control('ControlCollision', component, ctx));
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
        controls.set(lane.component.name, (component) => control('ControlCollision', component, ctx));
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
        controls.set(lane.component, (component) => control('ControlCollision', component, ctx));
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
        addExtraBall: (seconds) => addExtraBall(ctx, extraBallText, seconds),
        warpLampsFor: (caller) => warpOf.get(caller.name),
        missSound: OUT_LANES.missSound,
      });

      for (const name of OUT_LANES.components) {
        const row = scoreRows.get(name);
        byName.set(name, { name, scores: row?.scores ?? [], control: null });
        controls.set(name, (component) => control('ControlCollision', component, ctx));
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
        (component) => control('ControlCollision', component, ctx));
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
      controls.set(target.name, (component) => control('ControlCollision', component, ctx));
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
      controls.set(target.name, (component) => control('ControlCollision', component, ctx));
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
  const groupControlFor = (
    name: string, text?: string, period: number = DECAY_PERIODS.medal,
  ): ((code: MessageCode) => void) | null => {
    let restart: (seconds: number) => void = () => {};
    const group = decayingAdapter(o.components, name, (seconds) => restart(seconds));
    if (!group) return null;
    const caller: ControlledComponent = { name, scores: [], control: null };
    const control = text !== undefined
      ? makeMultiplierLightGroupControl({ group, enableText: text })
      : makeDecayingLightGroupControl({ group, period });
    restart = (seconds) => o.components.restartGroupTimer(
      name, seconds, () => control('ControlNotifyTimerExpired', caller, ctx),
    );
    return (code) => control(code, caller, ctx);
  };

  /**
   * ⚠️ `TSound::Play` RETURNS THE SOUND'S LENGTH, AND THE BALL IS HELD EXACTLY THAT LONG. Upstream the
   * hole's release timer is the noise's own duration; this port's effects are its own, so the length
   * is the one `audio/voices` gives that role. A flat number here would hold every ball the same time
   * and the fanfare would end long before the ball came back.
   */
  const playVoice = (name: string): number => {
    ctx.playSound(name);
    return VOICES[name]?.duration ?? 0;
  };

  const medalGroup = groupControlFor(MEDAL_BANK.lightGroup);
  // ⚠️ SIXTY SECONDS, NOT THIRTY. The three groups that decay share one statement and differ only in
  // the period; giving the hyperspace ladder the medals' would empty it twice as fast as the file says.
  const hyperspaceGroup = groupControlFor(
    HYPERSPACE.lightGroup, undefined, DECAY_PERIODS.hyperspace,
  );
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
        popUp: (target) => o.popupTargets?.get(target.name)?.popUp(),
        multiplierTexts: MULTIPLIER_BANK.textIds.map((id) => o.textFor(id)),
      });
      for (const target of bank) {
        byName.set(target.name, target);
        controls.set(target.name, (component) => control('ControlCollision', component, ctx));
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
        addExtraBall: (seconds) => addExtraBall(ctx, extraBallText, seconds),
        popUp: (target) => o.popupTargets?.get(target.name)?.popUp(),
        texts: MEDAL_BANK.textIds.map((id) => o.textFor(id)),
      });
      for (const target of bank) {
        byName.set(target.name, target);
        controls.set(target.name, (component) => control('ControlCollision', component, ctx));
      }
    }
  }

  // Declared here because `control/table-actions` needs to reach the plunger — a locked ball is
  // answered by sending another one out — and the plunger is built at the end, once the feed is known.
  let plunger: OriginalDispatch['plunger'] = null;
  // ⚠️ AND THE BARRIER'S ARMING, WHICH HAS TWO SENDERS. The plunger's easy-mode line is one; the
  // hyperspace ladder's third rung is the other, and it runs long before the feed block below.
  let raiseDrainBlocker: (() => void) | undefined;
  /** The blocker's own timeout, which is what switching easy mode OFF sends it. */
  let expireDrainBlocker: (() => void) | undefined;
  /** `ControlEnableMultiplier` on the gravity well with NO caller — see `cheats.armGravityWell`. */
  let armWellForCheat: (() => void) | undefined;

  // ⚠️ THE BOOSTER BANK, WHICH REACHES THE TABLE-LEVEL AWARDS. `control/table-actions` is the single
  // implementation of all of them — a flag, a lamp and a line — and it is built here rather than having
  // four of its rules copied into the chain's grants. Three of its seven actions have no caller yet:
  // multiball and replay belong to the missions, which this build does not run.
  const actions = createTableActions({
      ctx: ctx,
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
      // ⚠️ AND MULTIBALL IS THE THREE LOCKED BALLS COMING BACK. `table_set_multiball` resets all three
      // wormhole sinks' timers, which is what releases what the locks put away — without this the
      // count would go up by three and no ball would appear.
      resetSinkTimers: (seconds) => {
        for (const name of WORM_HOLE_SINKS.sinks) o.sinks?.get(name)?.scheduleRelease(seconds);
      },
      // ⚠️ `PlungerRelaunchBall`, WHICH THIS BUILD SPELLS AS A FEED. The original arms the plunger's own
      // timer and feeds a ball when it expires; here the two messages already arrive together — see
      // `shell/demo`. Absent when the feed is not wired, and then a locked ball is simply not replaced.
      relaunchBall: () => plunger?.feedBall(),
      lockedText: o.textFor(WORM_HOLE_SINKS.ballLockedTextId),
    });

  {
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
        bank, chain, popUp: (target) => o.popupTargets?.get(target.name)?.popUp(), missionLamp,
      });
      for (const target of bank) {
        byName.set(target.name, target);
        controls.set(target.name, (component) => control('ControlCollision', component, ctx));
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
      controls.set(row.tag, (component) => bumperControl('ControlCollision', component, ctx));
    } else if (row.controlName === 'RebounderControl') {
      byName.set(row.tag, { name: row.tag, scores: row.scores, control: null });
      controls.set(row.tag, (component) => rebounderControl('ControlCollision', component, ctx));
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
      (component) => control('ControlCollision', component, ctx));
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
    kickback.control = () => control('ControlTimerExpired', caller, ctx);
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
      controls.set(name, (component) => control('ControlCollision', component, ctx));
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
    lamp.control = () => control('ControlTimerExpired', caller, ctx);
  }

  // ⚠️ THE RAMP, WHOSE ORDINARY SCORE LIVES IN THE `else`. Any of the three lamps lit REPLACES the
  // five thousand — and only the reflex lamp pays anything in its place; the other two change the
  // SOUND, because they are the mission logic saying the ramp mattered and the mission is what pays.
  {
    const reflexLamp = o.components.lights.get(LAUNCH_RAMP.reflexLamp);
    const rampLamp = o.components.lights.get(LAUNCH_RAMP.rampLamp);
    const missionLamp = o.components.lights.get(LAUNCH_RAMP.missionLamp);

    if (reflexLamp && rampLamp && missionLamp) {
      const control = makeLaunchRampControl({
        reflexLamp: reflexLamp as unknown as LaneLight,
        rampLamp: rampLamp as unknown as LaneLight,
        missionLamp: missionLamp as unknown as LaneLight,
        // ⚠️ THE VALUE A NEW BALL STARTS WITH, and it stays there. `ReflexShotScore` is raised by the
        // missions, which this build does not run — so the reflex shot pays its opening price all
        // game. Reading it from a table field that nothing writes would have looked the same and said
        // less.
        reflexScore: () => NEW_BALL_REFLEX_SCORE,
        reflexText: (points) => o.textFor(LAUNCH_RAMP.textId, { points }),
        sounds: LAUNCH_RAMP.sounds,
      });
      const row = scoreRows.get(LAUNCH_RAMP.component);
      byName.set(LAUNCH_RAMP.component, {
        name: LAUNCH_RAMP.component, scores: row?.scores ?? [], control: null,
      });
      controls.set(LAUNCH_RAMP.component,
        (component) => control('ControlCollision', component, ctx));
    }
  }

  // ⚠️ THE WORMHOLE'S DESTINATION, WHICH IS A NUMBER KEPT IN A LAMP'S MESSAGE FIELD. `lite4` holds it
  // and is itself one of the arrow lamps, so advancing writes the next destination to the whole group
  // and reads it back through the same lamp. The arrow's sprite is `3 - destination`: the same fact
  // drawn, with nothing mapping between them.
  //
  // Built before the flags, because a flag's other branch advances the same cycle.
  let advance: (forced: boolean) => void = () => {};
  {
    const targetLamp = o.components.lights.get(WORM_HOLE.targetLamp);
    const destinationLamp = o.components.lights.get(WORM_HOLE.destinationLamp);
    const arrowGroup = o.components.lightGroups.get(WORM_HOLE.arrowLights);
    const holeGroup = o.components.lightGroups.get(WORM_HOLE.wormHoleLights);

    if (targetLamp && destinationLamp && arrowGroup && holeGroup) {
      const eachOf = (group: NonNullable<typeof arrowGroup>) => o.components.membersOf(group);
      const options: AdvanceOptions = {
        missionLamp: o.components.lights.get(MISSIONS.lamp) ?? { messageField: 0 },
        destinationLamp,
        arrowLights: {
          // Group messages, forwarded to every member — which is how `lite4` learns its own new value.
          setMessageField: (value) => { for (const lamp of eachOf(arrowGroup)) lamp.messageField = value; },
          setOnFrame: (value) => { for (const lamp of eachOf(arrowGroup)) lamp.setOnFrame(value); },
          lightsResetAndTurnOn: () => {
            for (const lamp of eachOf(arrowGroup)) { lamp.resetTimed(); lamp.turnOn(); }
          },
        },
        wormHoleLights: {
          lightsResetAndTurnOn: () => {
            for (const lamp of eachOf(holeGroup)) { lamp.resetTimed(); lamp.turnOn(); }
          },
        },
      };
      advance = (forced) => advanceWormHoleDestination(options, forced);

      const control = makeWormHoleDestinationControl({
        targetLamp: targetLamp as unknown as LaneLight & {
          flasherStartTimedThenStayOn(seconds: number): void;
        },
        announceText: o.textFor(WORM_HOLE.announceTextId),
        advance,
      });
      const row = scoreRows.get(WORM_HOLE.component);
      byName.set(WORM_HOLE.component, {
        name: WORM_HOLE.component, scores: row?.scores ?? [], control: null,
      });
      controls.set(WORM_HOLE.component,
        (component) => control('ControlCollision', component, ctx));
    }
  }

  // ⚠️ THE FLAGS, WHOSE SCORE INDEX IS A LAMP. `get_scoring(lite20->light_on())` — the boolean is the
  // index, with no conditional anywhere. `lite20` is one of the three the booster bank's first rung
  // lights for sixty seconds, so a flag is worth five hundred or two thousand five hundred depending
  // on work done at the other end of the table.
  {
    const lamp = o.components.lights.get(FLAGS.lamp);
    if (lamp) {
      const control = makeFlagControl({
        lamp: lamp as unknown as LaneLight,
        // ⚠️ THE FLAG'S OTHER BRANCH MOVES THE WORMHOLE'S CYCLE, unforced — a spinner loop nudges a
        // cycle that is already running rather than starting one. Nothing in this build sends
        // `ControlSpinnerLoopReset`, so the dispatcher only ever passes a collision; the reference is
        // real so that the day something does, it lands where it should.
        advance,
      });
      for (const name of FLAGS.components) {
        const row = scoreRows.get(name);
        byName.set(name, { name, scores: row?.scores ?? [], control: null });
        controls.set(name, (component) => control('ControlCollision', component, ctx));
      }
    }
  }

  // ⚠️ THE TWO HOLES THAT CAN LET GO. Each scores, says what it paid, and schedules its own release —
  // the black hole with the component's default hold, the gravity well with the length of the sound
  // that plays over it. Binding the control is what makes the hole safe to stand in.
  //
  // The gravity well also SWITCHES ITSELF OFF as it takes the ball, which is why it is a `Kickout2`:
  // it is dormant until a mission arms it and goes back to dormant the moment it pays.
  //
  // ⚠️ AND THE GRAVITY WELL'S ARMING LEAVES THIS LOOP, because the hyperspace ladder is what arms it:
  // the top rung hands the well the score it just paid, and in the original that arrives as an integer
  // cast to a component pointer. Captured here rather than rebuilt there, so both callers drive the
  // same control object.
  let armGravityWell: ((points: number) => void) | undefined;
  for (const binding of KICKOUTS) {
    const kickout = o.kickouts?.get(binding.component);
    if (!kickout) continue;

    const row = scoreRows.get(binding.component);
    const caller: ControlledComponent = {
      name: binding.component, scores: row?.scores ?? [], control: null,
    };

    let control: ReturnType<typeof makeBlackHoleKickoutControl>;
    if (binding.lamp && binding.armedTextId && binding.unknownTextId) {
      const lamp = o.components.lights.get(binding.lamp);
      if (!lamp) continue;
      const wellOptions: GravityWellOptions = {
        lamp: lamp as unknown as LaneLight,
        kickout,
        // ⚠️ THE HOLD IS THE SOUND'S OWN LENGTH — `soundwave7->Play` returns it upstream. This port's
        // effects are its own, so the length is the one `audio/voices` gives that role. Nothing plays
        // it yet: the control asks for the duration and not for the sound.
        soundDuration: () => GRAVITY_WELL_HOLD_SECONDS,
        scoreText: (points) => o.textFor(binding.textId, { points }),
        armedText: (points) => o.textFor(binding.armedTextId!, { points }),
        unknownText: o.textFor(binding.unknownTextId),
      };
      const wellControl = makeGravityWellKickoutControl(wellOptions);
      control = wellControl;
      // ⚠️ THE CHEAT ARMS IT WITH NO CALLER AT ALL. `GravityWellKickoutControl(..., nullptr)` is what
      // `gmax` sends, so nothing is scored and nothing is announced — the well simply becomes armed.
      // The null is passed rather than the real caller so that a future branch which starts reading
      // the caller fails loudly here instead of quietly reading a component the original never gave it.
      armWellForCheat = () => wellControl('ControlEnableMultiplier', null as unknown as ControlledComponent, ctx);
      armGravityWell = (points: number) => {
        wellControl('ControlEnableMultiplier', caller, ctx);
        announceGravityWell(wellOptions, points, (text, seconds) => ctx.showInfo(text, seconds));
      };
    } else {
      control = makeBlackHoleKickoutControl({
        kickout,
        scoreText: (points) => o.textFor(binding.textId, { points }),
      });
    }

    kickout.control = () => control('ControlCollision', caller, ctx);
  }

  // ⚠️ THE HYPERSPACE LADDER, WHICH IS A ROW OF LAMPS AND NO COUNTER. Read the lit count, light one
  // more, then branch on what the count WAS: each visit is worth more than the last and nothing stores
  // a number. Reading it the other way round skips the bottom rung and starts every ball at the
  // jackpot — and nothing about that reads as a defect, only as a generous table.
  //
  // ⚠️ AND THIS IS THE SECOND FACTORY THE LAMP BINDINGS WERE WAITING FOR. `ExtraBallLightControl`
  // answers `TLightResetAndTurnOn` and no collision, so it was written and left unwired because
  // nothing produced that message. The ladder's fourth rung produces it, and so does the climax.
  {
    const group = o.components.lightGroups.get(HYPERSPACE.lightGroup);
    const members = group ? o.components.membersOf(group) : [];
    const kickout = o.kickouts?.get(HYPERSPACE.component);
    const reflex = o.components.lights.get(HYPERSPACE.reflexLamp);
    const second = o.components.lights.get(HYPERSPACE.secondLamp);
    const everything = o.components.lights.get(HYPERSPACE.everythingLamp);
    const warpLamps = HYPERSPACE.warpLamps
      .map((name) => o.components.lights.get(name))
      .filter((lamp): lamp is NonNullable<typeof lamp> => Boolean(lamp));
    const bumperTargets = feedAdapter(o.components, HYPERSPACE.bumperTargetLights);
    const extraBallBinding = LAMP_BINDINGS.find((b) => b.control === 'ExtraBallLightControl');
    const extraBallLamps = (extraBallBinding?.lamps ?? [])
      .map((name) => o.components.lights.get(name))
      .filter((lamp): lamp is NonNullable<typeof lamp> => Boolean(lamp));

    if (group && hyperspaceGroup && kickout && reflex && second && everything && bumperTargets
      && armGravityWell && multiplierGroup && extraBallBinding
      && warpLamps.length === HYPERSPACE.warpLamps.length
      && extraBallLamps.length === extraBallBinding.lamps.length) {
      const extraBallCaller: ControlledComponent = {
        name: extraBallBinding.component, scores: [], control: null,
      };
      const extraBallControl = makeExtraBallLightControl({
        lamps: extraBallLamps as unknown as LaneLight[],
      });
      const armExtraBallLamp = (): void =>
        extraBallControl('TLightResetAndTurnOn', extraBallCaller, ctx);
      byName.set(extraBallBinding.component, extraBallCaller);

      const caller: ControlledComponent = {
        name: HYPERSPACE.component, scores: scoreRows.get(HYPERSPACE.component)?.scores ?? [],
        control: null,
      };
      const armWell = armGravityWell;
      const control = makeHyperspaceKickOutControl({
        lights: {
          get onCount() { return group.onCount; },
          // `TLightTurnOff` sent to the group: every member off, which is what restarts the ladder.
          turnOff: () => { for (let i = members.length - 1; i >= 0; i--) members[i]!.turnOff(); },
        },
        // Through the group's OWN control, which is what arms the sixty-second decay.
        lightOneMore: () => hyperspaceGroup('TLightGroupResetAndTurnOn'),
        table: ctx.score,
        reflexScore: () => o.feed?.table.reflexShotScore ?? 0,
        lamps: {
          reflex: reflex as unknown as LaneLight,
          second: second as unknown as LaneLight,
          everything: everything as unknown as LaneLight,
        },
        raiseBlocker: () => raiseDrainBlocker?.(),
        armExtraBallLamp,
        armGravityWell: (points) => armWell(points),
        awardEverything: () => awardEverything({
          table: { get jackpotScore() { return ctx.score.jackpotScore; },
            set jackpotScore(value: number) { ctx.score.jackpotScore = value; },
            get multiballFlag() { return ctx.table.multiballFlag; } },
          score: ctx.score,
          warpLamps: warpLamps as unknown as LaneLight[],
          enableMultiplier: () => multiplierGroup('ControlEnableMultiplier'),
          lightBumperTargets: () => bumperTargets.lightsResetAndTurnOn(),
          setJackpot: () => actions.setJackpot(),
          setBonus: () => actions.setBonus(),
          setFlagLights: () => actions.setFlagLights(),
          setBonusHold: () => actions.setBonusHold(),
          armExtraBallLamp,
          raiseBlocker: () => raiseDrainBlocker?.(),
          setMultiball: (seconds) => actions.setMultiball(seconds),
          multiballSound: () => playVoice(HYPERSPACE.sounds.fanfare[0]!),
          armGravityWell: () => armWell(0),
        }),
        kickout,
        texts: {
          plain: (points) => o.textFor(HYPERSPACE.textIds.plain, { points }),
          jackpot: (points) => o.textFor(HYPERSPACE.textIds.jackpot, { points }),
          blocker: (points) => o.textFor(HYPERSPACE.textIds.blocker, { points }),
          extraBall: (points) => o.textFor(HYPERSPACE.textIds.extraBall, { points }),
          reflex: (points) => o.textFor(HYPERSPACE.textIds.reflex, { points }),
        },
        sounds: HYPERSPACE.sounds,
        playSound: playVoice,
      });

      byName.set(HYPERSPACE.component, caller);
      controls.set(HYPERSPACE.component, (component) => control('ControlCollision', component, ctx));
      kickout.control = () => control('ControlCollision', caller, ctx);
    }
  }

  // ⚠️ THE DRAIN, WHICH IS THE ONLY COMPONENT THAT CAN END A GAME. Four questions in order — is the
  // player holding a shoot again, is there a spare to spend, are other balls still out there, and only
  // then is the ball gone — and the reset list is applied at the end of the fourth.
  //
  // ⚠️ WHAT THE RESET LIST LEAVES ALONE IS THE POINT OF IT. `lite58`, `lite199` and `lite200` are not
  // in it, so bonus hold, a spare and a held shoot-again all outlive the ball. See `PER_BALL_RESET`.
  if (o.drain) {
    const lampNamed = (name: string) => o.components.lights.get(name);
    const shootAgainLamp = lampNamed(DRAIN.shootAgainLamp);
    const spareLamp = lampNamed(DRAIN.spareLamp);
    const bonusHoldLamp = lampNamed(DRAIN.bonusHoldLamp);
    const missionLamp = lampNamed(DRAIN.missionLamp);

    if (shootAgainLamp && spareLamp && bonusHoldLamp && missionLamp) {
      const drainState = o.drain;
      // Every lamp the list names, plus every member of every group it names — `TLightResetAndTurnOff`
      // on a group is forwarded to its members, one at a time.
      const perBallLamps = [
        ...PER_BALL_RESET.lamps
          .map(lampNamed)
          .filter((lamp): lamp is NonNullable<typeof lamp> => Boolean(lamp)),
        ...PER_BALL_RESET.groups.flatMap((name) => {
          const group = o.components.lightGroups.get(name);
          return group ? o.components.membersOf(group) : [];
        }),
      ];

      const perBallComponents: { reset(): void }[] = [
        // ⚠️ THE TANK IS NOT A LIGHT GROUP, so the loop above cannot reach its lamps. The original
        // sends it BOTH messages — every lamp off, then `Reset` — and a negative split index is how
        // `TLightBargraph` empties itself: it turns every member off and puts the level back to zero.
        ...PER_BALL_RESET.groups
          .map((name) => o.components.bargraphs.get(name))
          .filter((tank): tank is NonNullable<typeof tank> => Boolean(tank))
          .map((tank) => ({ reset: () => { tank.toggleSplitIndex(-1); tank.reset(); } })),
        // ⚠️ THE ANIMATION ONLY. `outer_circle` and `middle_circle` are the two groups whose LAMPS
        // survive a ball — the rank a player has reached is not undone by losing one.
        ...PER_BALL_RESET.animationsStopped
          .map((name) => o.components.lightGroups.get(name))
          .filter((group): group is NonNullable<typeof group> => Boolean(group))
          .map((group) => ({ reset: () => group.resetGroup() })),
        ...PER_BALL_RESET.messageFieldsCleared
          .map(lampNamed)
          .filter((lamp): lamp is NonNullable<typeof lamp> => Boolean(lamp))
          .map((lamp) => ({ reset: () => { lamp.messageField = 0; } })),
        ...PER_BALL_RESET.bumperGroups.map((name) => ({
          reset: () => {
            for (const member of o.components.bumperGroups.get(name) ?? []) {
              o.components.bumpers.get(member)?.reset();
            }
          },
        })),
        ...PER_BALL_RESET.gates
          .map((name) => o.gates?.get(name))
          .filter((gate): gate is NonNullable<typeof gate> => Boolean(gate))
          .map((gate) => ({ reset: () => gate.reset() })),
      ];

      const caller: ControlledComponent = {
        name: DRAIN.component, scores: scoreRows.get(DRAIN.component)?.scores ?? [], control: null,
      };

      byName.set(DRAIN.component, caller);
      controls.set(DRAIN.component, () => {
        const result = drainBall({
          table: drainState.table,
          score: ctx.score,
          shootAgainLamp, spareLamp, bonusHoldLamp, missionLamp,
          perBallLamps,
          perBallComponents,
          // The mission machine is not run here, so the two mission numbers are the ones it would be
          // told — kept because they are what the original writes into `lite198`.
          missionOnGameOver: 32,
          missionOnNextBall: 0,
          showInfo: (text, seconds) => ctx.showInfo(text, seconds),
          playSound: (name) => ctx.playSound(name),
          playMusic: (track) => ctx.playMusic(track),
          bonusText: (points) => o.textFor(DRAIN.bonusTextId, { points }),
          heldShootAgainText: o.textFor(DRAIN.heldTextId),
          spareSpentText: o.textFor(DRAIN.spareSpentTextId),
          extraBallText: (player) => o.textFor(
            DRAIN.extraBallTextIds[Math.min(player, DRAIN.extraBallTextIds.length - 1)]!,
          ),
          returnBall: () => drainState.onOutcome('returned', false),
          switchToNextPlayer: () => {},
          dispatchMissionComplete: () => {},
          clearTiltLock: () => { drainState.table.tiltLocked = false; },
        });
        drainState.onOutcome(result.outcome, result.gameOver);
      });
    }
  }

  // ⚠️ THE WORMHOLE, WHICH IS THREE HOLES AND ONE ARRAY INDEX. Every path through `WormHoleControl`
  // ends by flashing the lamps at index `i` and resetting SINK `i`'s timer — so the ball comes out of a
  // hole it never went into, and the whole teleport is the choice of `i`.
  //
  // ⚠️ AND THE HOLD TIME COMES OFF THE HOLE THE BALL FELL INTO, not the one it leaves from. The arrival
  // flash lasts exactly as long as that hole would have held the ball, so the lamp going out and the
  // ball appearing are one event as far as the player can tell.
  if (o.sinks) {
    const wormSinks: WormholeSink[] = [];
    for (const name of WORM_HOLE_SINKS.sinks) {
      const sink = o.sinks.get(name);
      if (!sink) break;
      wormSinks.push({ timerTime: sink.holdTime, resetTimer: (seconds) => sink.scheduleRelease(seconds) });
    }
    const arrivalLamps = WORM_HOLE_SINKS.arrivalLamps
      .map((name) => o.components.lights.get(name))
      .filter((lamp): lamp is NonNullable<typeof lamp> => Boolean(lamp));
    const arrowLamps = WORM_HOLE_SINKS.arrowLamps
      .map((name) => o.components.lights.get(name))
      .filter((lamp): lamp is NonNullable<typeof lamp> => Boolean(lamp));
    const destinationLamp = o.components.lights.get(WORM_HOLE.destinationLamp);
    const targetLamp = o.components.lights.get(WORM_HOLE.targetLamp);
    // `TLightResetAndTurnOff` sent to a group, which is one message reaching every member —
    // `feedAdapter` already spells that out, and it is all the wormhole asks of these two.
    const wormHoleLights = feedAdapter(o.components, WORM_HOLE.wormHoleLights);
    const arrowLights = feedAdapter(o.components, WORM_HOLE.arrowLights);

    if (wormSinks.length === WORM_HOLE_SINKS.sinks.length
      && arrivalLamps.length === WORM_HOLE_SINKS.arrivalLamps.length
      && arrowLamps.length === WORM_HOLE_SINKS.arrowLamps.length
      && destinationLamp && targetLamp && wormHoleLights && arrowLights) {
      const callers = WORM_HOLE_SINKS.sinks.map((name): ControlledComponent => ({
        name, scores: scoreRows.get(name)?.scores ?? [], control: null,
      }));
      const control = makeWormHoleControl({
        sinks: wormSinks,
        arrivalLamps,
        arrowLamps: arrowLamps as unknown as ArrowLamp[],
        destinationLamp,
        targetLamp: targetLamp as unknown as LaneLight,
        wormHoleLights,
        arrowLights,
        table: ctx.table,
        lockBall: () => actions.bumpBallSinkLock(),
        setReplay: (seconds) => actions.setReplay(seconds),
        arrivalText: o.textFor(WORM_HOLE_SINKS.arrivalTextId),
        // ⚠️ BY IDENTITY, NOT BY NAME. The control asks which of the three the caller IS, and the
        // objects it is given are the ones registered below — a lookup by name would work until two
        // holes were ever registered from different tables.
        sinkIndexFor: (caller) => {
          const index = callers.indexOf(caller);
          return index < 0 ? undefined : index;
        },
      });

      for (const caller of callers) {
        byName.set(caller.name, caller);
        controls.set(caller.name, (component) => control('ControlCollision', component, ctx));
      }
    }
  }

  // ⚠️ MISSION ZERO IS A STATE, NOT A MISSION. The table sits in "awaiting deployment" until the ball
  // crosses one of the two deployment chutes — the same two one-ways the skill shot uses for its
  // payout and its loss, which is why they are looked up rather than bound again.
  //
  // ⚠️ AND THE TEXT BOX IS A COMPONENT. A mission begins when its announcement has finished being
  // read, so the box's own timeout is what sends `ControlMissionStarted`. Nothing times it in this
  // build, which is exactly why it is a component and not a string: the day something does, the
  // machine already knows what to do with it.
  // ⚠️ THE TWENTY-THREE MISSIONS, OF WHICH SIXTEEN CAN RUN. A mission counts hits on ITS OWN
  // components — `d.components.includes(caller)` — so the objects here have to be the very ones the
  // dispatcher registered. A row naming a component this build does not wire is declined whole: half
  // a mission would count some of its hits and silently never finish.
  //
  // The seven declined need `target22`, the three sinks and `kickout2`: the wormhole, the escape
  // chute and the hyperspace, which are on ADR-0003's list of work rather than of decisions.
  // ⚠️ THE RANK LADDER, WHICH IS TWO CIRCLES OF LAMPS AND NOTHING ELSE. Progress lights the outer
  // circle one lamp at a time; when it fills it flashes away and the middle circle gains one — and the
  // middle circle's lit count IS the rank. Nothing stores a number.
  //
  // ⚠️ AND ITS PROGRESS LAMP IS THE BONUS LANE'S. `AddRankProgress` turns `lite16` on and
  // `BonusLaneRolloverControl` pays the accumulated bonus when it is lit, so earning rank progress
  // ARMS THE BONUS LANE — one lamp, two mechanics, and neither function mentions the other.
  const outerCircle = o.components.lightGroups.get(RANK.outerCircle);
  const middleCircle = o.components.lightGroups.get(RANK.middleCircle);
  const progressLamp = o.components.lights.get(RANK.progressLamp);
  const rankNames = RANK.nameTextIds.map((id) => o.textFor(id));

  const earnRank = (points: number): boolean => {
    rankPoints += points;
    if (!outerCircle || !middleCircle || !progressLamp) return false;
    return advanceRank(points, {
      outerCircle,
      middleCircle,
      progressLight: progressLamp,
      rankNames,
      showMessage: (text, seconds) => ctx.showMission(text, seconds),
      promotionTemplate: (rankName) => o.textFor(RANK.promotionTextId, { rank: rankName }),
    }).promoted;
  };

  /**
   * `cheat_bump_rank`, which is a promotion without the progress that earns one. The rank is read
   * BEFORE the lamp is lit, so the line names the rank whose lamp is being turned on.
   */
  const bumpRankByCheat = (): void => {
    if (!middleCircle) return;
    const circle = middleCircle;
    cheatBumpRank({
      middleCircle: {
        // `TLightGroup::Message(TLightResetAndTurnOn)` under this port's name for it.
        get onCount() { return circle.onCount; },
        resetAndTurnOn: (period: number) => { circle.groupResetAndTurnOn(period); },
      },
      rankText: (index: number) => o.textFor(RANK.promotionTextId, { rank: rankNames[index] ?? '' }),
      showMission: (text: string, seconds: number) => ctx.showMission(text, seconds),
      playSound: (name: string) => ctx.playSound(name),
      // The role `audio/voices` gives a promotion. The upstream plays a WAV this repository never holds.
      promotionSound: 'promotion',
    });
  };

  const missionLamp = o.components.lights.get(MISSIONS.lamp);
  const counterLamp = o.components.lights.get(MISSIONS.counterLamp);
  const tagOf = new Map(SCORE_COMPONENTS.map((row) => [row.name, row.tag]));
  const controllers: Partial<Record<number, MissionController>> = {};

  if (missionLamp && counterLamp) {
    for (const row of MISSION_TABLE) {
      const components = row.components
        .map((name) => byName.get(tagOf.get(name) ?? ''))
        .filter((component): component is ControlledComponent => Boolean(component));
      if (components.length !== row.components.length) continue;

      const lamps = row.lamps
        .map((name) => o.components.lights.get(name))
        .filter((lamp): lamp is NonNullable<typeof lamp> => Boolean(lamp));
      if (lamps.length !== row.lamps.length) continue;

      controllers[row.mission] = makeMissionController({
        definition: {
          name: row.name,
          lamps,
          components,
          count: row.count,
          nextMission: row.nextMission,
          // ⚠️ THE COUNTDOWN IS IN THE LINE. `{n} to go` is re-announced on every qualifying hit, so
          // the text is a function of the counter rather than a string chosen once.
          text: (remaining) => o.textFor(row.textKey, { n: remaining }),
          ...(row.completeTextKey ? { completeText: o.textFor(row.completeTextKey) } : {}),
          ...(row.infoTextKey ? { infoText: o.textFor(row.infoTextKey) } : {}),
          ...(row.award !== undefined ? { award: row.award } : {}),
          ...(row.rankPoints !== undefined ? { rankPoints: row.rankPoints } : {}),
          ...(row.scoreTextKey
            ? { scoreText: (points: number) => o.textFor(row.scoreTextKey!, { points }) }
            : {}),
        },
        counterLamp,
        missionLamp,
        score: ctx.score,
        // A promotion suppresses the mission's own score line, which is why this answers a boolean.
        addRankProgress: earnRank,
      });
    }
  }

  // ⚠️ THREE CASES OF THE MISSION SWITCH ARE NOT ROWS IN `MISSION_TABLE`. `control/mission-specials`
  // holds `AlienMenaceController` (10), `TimeWarpPartTwoController` (24) and `GameoverController` (32).
  //
  // ⚠️ AND THE REASON THEY WERE ALL DECLINED IS GONE. It stood here for several passes and it said the
  // NAMES were missing: "these three functions sit past the point where the upstream file can be read
  // in one piece from here". That was true of a fetch that truncates a 150 KB file and false of
  // `gh api`, which hands over all 4603 lines of `control.cpp`. Ten is wired below, from the source.
  //
  // All three are wired below, from the source. Thirty-two takes an option, because the end of a game
  // touches things the dispatcher does not own — the flippers and the table's mode — and a caller that
  // does not hand them over gets it declined whole rather than half-run.
  /**
   * ⚠️ CASE 10 OF THE MISSION SWITCH, WHICH IS NOT A ROW IN THE TABLE. Alien Menace listens for a
   * bumper LEVEL and for nothing else — no collision, no lane, no target — so it is built here rather
   * than in the loop over `MISSION_TABLE`, and it is declined whole if any of its parts is missing,
   * like every other block in this file.
   */
  {
    const watched = byName.get(ALIEN_MENACE.watched);
    const alienLamp = o.components.lights.get(ALIEN_MENACE.lamp);
    const trekGroups = ALIEN_MENACE.trekGroups
      .map((name) => feedAdapter(o.components, name))
      .filter((group): group is FeedGroup => Boolean(group));

    if (watched && alienLamp && missionLamp
      && trekGroups.length === ALIEN_MENACE.trekGroups.length) {
      controllers[ALIEN_MENACE.mission] = makeAlienMenaceController({
        bumpers: {
          get level() { return levelOfGroup(o.components, ALIEN_MENACE.bumperGroup); },
          // `attack_bump->Message(TBumperSetBmpIndex, 0.0)`, which is the group primitive and not a
          // Reset: a reset would clear the bumper's timers and message field as well.
          setLevel: (level: number) => o.components.setGroupLevel(ALIEN_MENACE.bumperGroup, level),
        },
        watched,
        lamp: alienLamp,
        trekGroups,
        text: o.textFor(ALIEN_MENACE.textId),
        nextMission: ALIEN_MENACE.nextMission,
        missionLamp,
      });
    }
  }

  /**
   * ⚠️ CASE 24, WHICH IS ALSO NOT A ROW IN THE TABLE. Time Warp part two ends on a collision with one
   * of two components pointing opposite ways — the hyperspace hole takes a rank away, the ramp gives
   * one — and both pay two million. It needs the rank circle, which means it needs the same three
   * lamps `earnRank` does; without them it is declined whole, like everything else here.
   */
  {
    const demote = byName.get(TIME_WARP_PART_TWO.demote);
    const promote = byName.get(TIME_WARP_PART_TWO.promote);
    const warpLamps = TIME_WARP_PART_TWO.lamps
      .map((name) => o.components.lights.get(name))
      .filter((lamp): lamp is NonNullable<typeof lamp> => Boolean(lamp));

    if (demote && promote && middleCircle && missionLamp
      && warpLamps.length === TIME_WARP_PART_TWO.lamps.length) {
      const circle = middleCircle;
      controllers[TIME_WARP_PART_TWO.mission] = makeTimeWarpPartTwoController({
        rankCircle: {
          get onCount() { return circle.onCount; },
          // `TLightGroupOffsetAnimationBackward` and `TLightGroupResetAndTurnOn`, under this port's
          // names for them — the same pair `gfx`-side callers use to walk a group one lamp at a time.
          offsetAnimationBackward: () => { circle.turnOffNext(); },
          resetAndTurnOn: (period: number) => { circle.groupResetAndTurnOn(period); },
        },
        demoteComponent: demote,
        promoteComponent: promote,
        lamps: warpLamps,
        missionLamp,
        score: ctx.score,
        addRankProgress: earnRank,
        rankName: (index: number) => rankNames[index] ?? '',
        texts: {
          mission: o.textFor(TIME_WARP_PART_TWO.textId),
          demoteHeadline: o.textFor(TIME_WARP_PART_TWO.demoteHeadlineId),
          promoteHeadline: o.textFor(TIME_WARP_PART_TWO.promoteHeadlineId),
          demoted: (rank: string) => o.textFor(TIME_WARP_PART_TWO.demotedTextId, { rank }),
          promoted: (rank: string) => o.textFor(TIME_WARP_PART_TWO.promotedTextId, { rank }),
        },
        // `soundwave10->Play`, whose WAV this repository never holds. The role is the promotion's.
        playPromotionSound: () => ctx.playSound('promotion'),
      });
    }
  }

  /**
   * ⚠️ CASE 32, WHOSE STATE IS A TEXT BOX'S MESSAGE FIELD. `GameoverController` keeps the whole
   * carousel in `mission_text_box->MessageField` as a tagged union — 0x100 players, 0x200 high scores,
   * the low bits the cursor — and each step is driven by THE PREVIOUS LINE EXPIRING. There is no timer
   * and no index variable anywhere in it.
   *
   * ⚠️ AND THIS PORT HAS NO TEXT BOX COMPONENT. `mission_text_box` is a name in the address book and
   * nothing reads its message field but this, so the field lives here, next to the only thing that
   * uses it. Give the port a real text box and this is the line that moves.
   */
  if (o.gameOver && missionLamp) {
    const goalLights = feedAdapter(o.components, GAME_OVER.goalLights);
    if (goalLights) {
      const textBoxState = { messageField: 0 };
      const gameOverOptions = o.gameOver;
      controllers[GAME_OVER.mission] = makeGameoverController({
        state: textBoxState,
        // One player, one score. The original carries four and picks by `CurrentPlayer`.
        get playerScores() { return [ctx.score.curScore]; },
        get playerCount() { return o.drain?.table.playerCount ?? 1; },
        get highScores() { return gameOverOptions.highScores?.() ?? []; },
        goalLights,
        flippers: gameOverOptions.flippers,
        enterGameOverMode: gameOverOptions.enterMode,
        playMusic: (track: string) => ctx.playMusic(track),
        playerText: (place, score) => {
          const id = GAME_OVER.playerTextIds[place - 1];
          return id === undefined ? null : o.textFor(id, { score });
        },
        highScoreText: (place, score) => {
          const id = GAME_OVER.highScoreTextIds[place - 1];
          return id === undefined ? null : o.textFor(id, { score });
        },
        bannerText: o.textFor(GAME_OVER.bannerTextId),
      });
    }
  }

  missions = createMissionMachine({
    missionLamp: missionLamp ?? { messageField: 0 },
    missionTextBox,
    controllers: {
      ...controllers,
      0: makeWaitingDeploymentController({
        deploymentGates: MISSIONS.deploymentGates
          .map((name) => byName.get(name))
          .filter((component): component is ControlledComponent => Boolean(component)),
        awaitingText: o.textFor(MISSIONS.awaitingTextId),
      }),
    },
  });

  // ⚠️ THE BALL PUT BACK INTO PLAY, AND THE BARRIER THAT NOTHING COULD RAISE. `table/blocker` and
  // `control/feed` were both written and tested in their own passes and had never met: no path in this
  // port sent `TBlockerEnable`, so `v_bloc1` was a component no running game could reach.
  //
  // ⚠️ AND `top_target_lights` IS A CALLER HERE, NOT A TARGET. The original's line is
  // `MultiplierLightGroupControl(ControlDisableMultiplier, top_target_lights)` — one control function
  // calling another — so the multiplier is switched off THROUGH its own control, which is what stops
  // its thirty-second clock. Clearing the number directly would leave the clock running and the lamps
  // coming down one at a time over a multiplier that was already zero.
  if (o.feed) {
    const isEasyMode = o.isEasyMode ?? (() => false);
    const blocker = o.feed.blockers.get(DRAIN_BLOCKER.component);
    const blockerLamp = o.components.lights.get(DRAIN_BLOCKER.lamp);
    const shootAgainLamp = o.components.lights.get(PLUNGER_FEED.shootAgainLamp);
    const firstSkillLamp = o.components.lights.get(PLUNGER_FEED.firstSkillLamp);
    const skillShotGroup = feedAdapter(o.components, PLUNGER_FEED.skillShotGroup);
    const middleCircleFeed = feedAdapter(o.components, PLUNGER_FEED.middleCircle);
    const trekGroups = PLUNGER_FEED.trekGroups
      .map((name) => feedAdapter(o.components, name))
      .filter((group): group is FeedGroup => Boolean(group));
    const tankLamps = o.components.bargraphLights.get(PLUNGER_FEED.fuelBargraph);
    const feedGates = PLUNGER_FEED.gates
      .map((name) => o.gates?.get(name))
      .filter((gate): gate is Gate => Boolean(gate));

    if (blocker && blockerLamp && shootAgainLamp && firstSkillLamp && skillShotGroup
      && middleCircleFeed && tankLamps
      && trekGroups.length === PLUNGER_FEED.trekGroups.length
      && feedGates.length === PLUNGER_FEED.gates.length) {
      // `TBlocker::MessageField` — 0 not raised, 1 solid, 2 flashing. It is the only thing that tells
      // the two timeouts apart, and it lives on the component in the original.
      const blockerState = {
        messageField: 0,
        enable: (duration: number) => blocker.enable(duration),
        restartTimeout: (duration: number) => blocker.restartTimeout(duration),
        disable: () => blocker.disable(),
      };
      const blockerCaller: ControlledComponent = {
        name: DRAIN_BLOCKER.component, scores: [], control: null,
      };
      const blockerControl = makeDrainBallBlockerControl({
        blocker: blockerState,
        lamp: blockerLamp,
        initialDuration: DRAIN_BLOCKER.initialDuration,
        extendedDuration: DRAIN_BLOCKER.extendedDuration,
        isEasyMode,
      });
      // The deadline running out is a message to control, and the control is what decides what it
      // meant. Bound here because the blocker was built from the archive before this existed.
      blocker.control = () => blockerControl('ControlTimerExpired', blockerCaller, ctx);
      byName.set(DRAIN_BLOCKER.component, blockerCaller);
      raiseDrainBlocker = () => blockerControl('TBlockerEnable', blockerCaller, ctx);
      expireDrainBlocker = () => blockerControl('ControlTimerExpired', blockerCaller, ctx);

      const plungerCaller: ControlledComponent = {
        name: PLUNGER_FEED.component, scores: [], control: null,
      };
      const plungerControl = makePlungerControl({
        table: o.feed.table,
        shootAgainLamp,
        firstSkillLamp,
        skillShotGroup,
        trekGroups,
        middleCircle: middleCircleFeed,
        // ⚠️ THE TANK IS SENT THE LAMPS' MESSAGE AND NOT ITS OWN. `TLightBargraph::Message` handles
        // four codes and forwards the rest to `TLightGroup`, so `TLightResetAndTurnOn` reaches the
        // members and never touches `TimeIndex`: after a drain the tank SHOWS full and COUNTS empty,
        // and the six fuel rollovers read the count. Transcribed as written — it is the original's
        // behavior, and inventing a `toggleSplitIndex` here would be improving the game rather than
        // porting it.
        fuelBargraph: {
          get onCount() { return 0; },
          lightsResetAndTurnOn: () => {
            for (let i = tankLamps.length - 1; i >= 0; i--) {
              tankLamps[i]!.resetTimed();
              tankLamps[i]!.turnOn();
            }
          },
          lightsResetAndTurnOff: () => {},
          offsetAnimationForward: () => {},
          animationBackward: () => {},
        },
        // `TGateDisable` OPENS a gate: disabling a wall is opening a way through.
        gates: feedGates.map((gate) => ({ disable: () => gate.openGate() })),
        isEasyMode,
        blocker: {
          get active() { return blocker.active; },
          enable: () => blockerControl('TBlockerEnable', blockerCaller, ctx),
        },
        disableMultiplier: () => multiplierGroup?.('ControlDisableMultiplier'),
      });
      plungerCaller.control = plungerControl;
      byName.set(PLUNGER_FEED.component, plungerCaller);
      plunger = {
        feedBall: () => handler('PlungerFeedBall', plungerCaller, ctx),
        startFeedTimer: () => handler('PlungerStartFeedTimer', plungerCaller, ctx),
      };
    }
  }

  return {
    missions,
    plunger,
    ...(raiseDrainBlocker ? { raiseDrainBlocker } : {}),
    cheats: {
      armGravityWell: () => armWellForCheat?.(),
      addExtraBall: (seconds) => addExtraBall(ctx, o.textFor(OUT_LANES.extraBallTextId), seconds),
      bumpRank: () => bumpRankByCheat(),
      raiseBlocker: () => raiseDrainBlocker?.(),
      expireBlocker: () => expireDrainBlocker?.(),
      disableGates: () => {
        for (const name of CHEAT_GATES) o.gates?.get(name)?.openGate();
      },
    },
    get rankPoints() { return rankPoints; },
    missionsRun: new Set(Object.keys(controllers).map(Number)),
    wired: new Set(byName.keys()),
    hit(groupName) {
      const component = byName.get(groupName);
      const control = controls.get(groupName);
      if (!component || !control) return;
      // `handler` runs the control and then the mission machine, in that order, always. The mission
      // machine is the context's, and for this build it does nothing.
      component.control = (_code, caller) => control(caller);
      handler('ControlCollision', component, ctx);
    },
  };
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// table/original-components — the 1995 table's own components, built from its archive.
//
// ========================= THE `T*` PORTS, REACHED FROM DATA FOR THE FIRST TIME =========================
// `table/bumper` and `table/light` have been transcribed and tested since phase 4 and built from
// nothing but fixtures. `dat/visual` was the blocker: a bumper needs an elasticity, a threshold and a
// boost, and until something could read those out of the file the components could only be invented —
// and inventing them moves the behaviour of every part of the table.
//
// This builds the two that change what a player sees. The seven BUMPERS carry their own level, which is
// where their price comes from: `bumperControl` indexes the score array by that level and does not
// advance it, so without the component the demonstration pays level zero for ever. The hundred and
// forty LIGHTS are what the control layer turns on.
//
// ⚠️ A BUMPER DOES NOT RAISE ITSELF, AND THAT IS THE INTERESTING PART. `BumperControl` reads
// `BmpIndex` and scores; nothing in it advances the level. The LANES do: hitting a bumper lane sends
// `TBumperIncBmpIndex` to the bumper GROUP, which forwards it to every bumper in it. So working the
// bumpers up is a different act from cashing them in, and a port that made a bumper promote itself
// would have collapsed two mechanics into one and made the lanes pointless.
//
// `raise` below is that message. `fire` is the collision.
//
// ⚠️ WHAT IS NOT HERE, AND WHY. The other thirty-odd component kinds need their control functions to be
// wired, and only nine of the eighty-nine rows in `score-table` use a control this project can supply
// arguments for. Building the rest would produce objects nothing can drive — which is the exact defect
// this port has spent its whole history removing.
//
// ========================= EIGHT STATES IS FOUR LEVELS =========================
// `query_visual_states` reads the second short of a `[100, n]` pair. `a_bump1` says eight, and the
// frames come in PAIRS — `2 * level` idle and `2 * level + 1` lit — so eight states is four levels.
// Reading eight as the level count makes a bumper reach its top price in half the hits.

import { createBumper, type Bumper, type TimerService } from './bumper.js';
import { createLight, type Light } from './light.js';
import { createLightGroup, type LightGroup } from './light-group.js';
import { createLightBargraph, type LightBargraph } from './light-bargraph.js';
import { createKickback, type Kickback } from './kickback.js';
import { readVisual } from '../dat/visual.js';
import { floatAttribute, int16Attribute } from '../dat/attributes.js';
import { EntryType, type Group } from '../dat/partman.js';
import { ObjectType, type Table } from '../dat/loader.js';

/** `TBumper`'s lit time. Read with the attribute reader, because that is how `TBumper` reads it. */
export const BUMPER_TIMER_RECORD = 407;
/** `TLight`'s two flash delays: dark then lit. */
export const LIGHT_DARK_RECORD = 900;
export const LIGHT_LIT_RECORD = 901;
/** `TLightGroup`'s `Timer1TimeDefault`: the period every timed command falls back to. */
export const GROUP_PERIOD_RECORD = 903;
/** The group indices of a light group's members. Read with the ATTRIBUTE form, id included. */
export const GROUP_MEMBERS_RECORD = 1027;
/** `TLightBargraph`'s decay times: one per LEVEL, so twice the lamp count of them. */
export const BARGRAPH_TIMES_RECORD = 904;

/** `loader::query_visual_states`. One unless the group opens with a `[100, n]` pair. */
export function visualStatesOf(groups: readonly Group[], groupIndex: number): number {
  const group = groups[groupIndex];
  const entry = group?.entries.find((e) => e.type === EntryType.Int16s && e.data);
  if (!entry?.data || entry.data.byteLength < 4) return 1;

  const view = new DataView(entry.data.buffer, entry.data.byteOffset, entry.data.byteLength);
  if (view.getInt16(0, true) !== 100) return 1;
  return view.getInt16(2, true);
}

export interface OriginalComponents {
  /** By the archive's own group name, which is what a collision reports. */
  readonly bumpers: ReadonlyMap<string, Bumper>;
  /** By name too, which for lights is also the control layer's name — see `SIMPLE_TAGS`. */
  readonly lights: ReadonlyMap<string, Light>;
  /**
   * ⚠️ THE GROUPS THE LANES ACTUALLY WATCH. `BumperLaneControl` asks a group "are all of you on yet",
   * and that question is the whole mechanic: the lanes are worth something because filling them raises
   * the bumpers. Its members are the SAME `Light` objects as in `lights` — a group holding copies would
   * count its own lights on while the table's stayed dark, and nothing that looks at counts would
   * notice.
   */
  readonly lightGroups: ReadonlyMap<string, LightGroup>;
  /** The fuel tank, kept apart from the light groups — see `table/light-bargraph`. */
  readonly bargraphs: ReadonlyMap<string, LightBargraph>;
  /**
   * ⚠️ ITS LAMPS, WHICH `membersOf` CANNOT REACH. A bargraph is not a light group and is not in
   * `lightGroups`, so a caller holding only the tank has no way to send its members a message — and
   * the original sends them several, `TLightResetAndTurnOn` among them.
   */
  readonly bargraphLights: ReadonlyMap<string, readonly Light[]>;
  /**
   * ⚠️ THE TWO OUTLANE SAVERS, WHICH THE BALL HAS TO REACH. A kickback is a collision component, so
   * unlike a lamp it means nothing until `table/original` hands its group's walls to it — see
   * `componentFor`. Built here because everything it needs is records; wired to the geometry there.
   */
  readonly kickbacks: ReadonlyMap<string, Kickback>;
  /** The lights a group holds, so a caller can check identity rather than assume it. */
  membersOf(group: LightGroup): readonly Light[];
  /** `Timer1TimeDefault`, from record 903. */
  periodOf(name: string): number;
  /** The threshold a bumper was built with, so a caller can see it is not `default_vsi`'s 9e10. */
  thresholdOf(name: string): number;
  /** Drives every component's timers. Seconds. */
  advance(seconds: number): void;
  /**
   * The clock every component here was built with. Exposed so a component that can only be built
   * AFTER the geometry — a gate, a kickout — shares it rather than starting a second one that
   * `advance` would never move.
   */
  readonly timer: TimerService;
  /** A hit on a bumper, at the speed that guarantees it fires. For tests and for the demo's dispatch. */
  fire(name: string): void;
  /** `TBumperIncBmpIndex`: what a bumper LANE sends. See this module's header for why it is separate. */
  raise(name: string): void;
  /**
   * ⚠️ THE BUMPER GROUPS, WHICH ARE WHAT A LANE ACTUALLY RAISES. `attack_bumpers` holds a_bump1 to
   * a_bump4 and `launch_bumpers` holds a_bump5 to a_bump7; a lane sends `TBumperIncBmpIndex` to the
   * GROUP and it reaches every member. Raising one bumper would make three of them cheaper than the
   * table intends and nothing would say so.
   */
  readonly bumperGroups: ReadonlyMap<string, readonly string[]>;
  /** Raises every bumper in a group, which is the message a lane sends. */
  raiseGroup(groupName: string): void;
  /**
   * ⚠️ `TBumperDecBmpIndex`, WHICH IS WHAT THE LANES ARE WORKING AGAINST. Every sixty seconds the
   * group takes one level back, so a player who stops filling lanes watches the bumpers get cheaper.
   * Without it the level only ever rises and the whole mechanic becomes a one-way ratchet.
   */
  lowerGroup(groupName: string): void;
  /**
   * `TBumperGroup::Message(TBumperSetBmpIndex, level)` — the level SET rather than nudged. The take-over
   * of Alien Menace is the only sender, and it sends zero. Kept apart from `reset`, which also clears
   * the bumper's timers and its message field.
   */
  setGroupLevel(groupName: string, level: number): void;
  /**
   * `TComponentGroupResetNotifyTimer`. The callback is the group's own control function, passed in
   * each time because the component builder is made before the dispatcher that binds it.
   */
  restartGroupTimer(groupName: string, seconds: number, run: () => void): void;
}

export interface OriginalComponentOptions {
  /** Tilt stops every collision component answering. False unless a game says otherwise. */
  readonly tiltLocked?: () => boolean;
  readonly onBumperFired?: (name: string) => void;
  /**
   * ⚠️ WHICH PICTURE THE COMPONENT IS SHOWING. Every one of these has carried a `setSprite` hook since
   * it was ported and no builder forwarded it, so the state each component keeps — a target down, a
   * bumper lit, a barrier up — was invisible. `-1` means "draw nothing", which is what a popup target
   * does when it drops.
   */
  readonly onSprite?: (groupName: string, index: number) => void;
}

export function buildOriginalComponents(
  table: Table, o: OriginalComponentOptions = {},
): OriginalComponents {
  const groups = table.groups;

  // One clock for every component, moved only by `advance`. The game's own timers stay out of this.
  let now = 0;
  let nextTimer = 1;
  const pending = new Map<number, { at: number; run: () => void }>();
  const timer: TimerService = {
    set(seconds, callback) {
      const id = nextTimer++;
      pending.set(id, { at: now + seconds, run: callback });
      return id;
    },
    kill(id) { pending.delete(id); },
  };

  const tableState = { get tiltLocked() { return o.tiltLocked?.() ?? false; } };

  const bumpers = new Map<string, Bumper>();
  const lights = new Map<string, Light>();
  const thresholds = new Map<string, number>();
  const lightGroups = new Map<string, LightGroup>();
  const bargraphs = new Map<string, LightBargraph>();
  const bargraphLights = new Map<string, readonly Light[]>();
  const kickbacks = new Map<string, Kickback>();
  const groupMembers = new Map<LightGroup, Light[]>();
  const periods = new Map<string, number>();
  const bumperGroups = new Map<string, readonly string[]>();
  const groupTimers = new Map<string, number>();
  /** How many frames each bumper has, because `setLevel` takes it on every call and clamps with it. */
  const frameCounts = new Map<string, number>();

  for (const object of table.tableObjects) {
    const group = groups[object.group];
    const name = group?.name;
    if (!name) continue;

    if (object.type === ObjectType.Bumper) {
      const visual = readVisual(groups, object.group);
      const litTime = floatAttribute(group, BUMPER_TIMER_RECORD)?.[0] ?? 0.1;
      const states = visualStatesOf(groups, object.group);

      const bumper = createBumper({
        table: tableState,
        elasticity: visual.elasticity,
        smoothness: visual.smoothness,
        threshold: visual.kicker.threshold,
        boost: visual.kicker.boost,
        litTime,
        timer,
        hardHitSoundId: visual.kicker.hardHitSoundId,
        softHitSoundId: visual.softHitSoundId,
        ...(o.onBumperFired ? { onFire: () => o.onBumperFired!(name) } : {}),
        ...(o.onSprite ? { setSprite: (index: number) => o.onSprite!(name, index) } : {}),
      });
      bumpers.set(name, bumper);
      frameCounts.set(name, states);
      thresholds.set(name, visual.kicker.threshold);
      continue;
    }

    if (object.type === ObjectType.Kicker) {
      // ⚠️ THE THRESHOLD IS NOT THE ARCHIVE'S. `TKickback`'s constructor writes a billion over
      // whatever record 401 said, and then moves it — see `table/kickback`. So the visual is read for
      // the bounce and the boost, and the threshold is the component's own.
      const visual = readVisual(groups, object.group);
      kickbacks.set(name, createKickback({
        table: tableState,
        elasticity: visual.elasticity,
        smoothness: visual.smoothness,
        boost: visual.kicker.boost,
        hardHitSoundId: visual.kicker.hardHitSoundId,
        timer,
      }));
      continue;
    }

    if (object.type === ObjectType.Light) {
      lights.set(name, createLight({
        timer,
        frameCount: visualStatesOf(groups, object.group),
        darkDelay: floatAttribute(group, LIGHT_DARK_RECORD)?.[0] ?? 0,
        litDelay: floatAttribute(group, LIGHT_LIT_RECORD)?.[0] ?? 0,
      }));
    }
  }

  // ⚠️ SECOND PASS, BECAUSE A GROUP NAMES LIGHTS. The manifest does not promise that every member is
  // listed before the group that holds it, and building a group against a half-filled map would give it
  // however many members happened to exist yet — a count that is wrong and never zero, which is the
  // hardest kind to notice.
  for (const object of table.tableObjects) {
    if (object.type !== ObjectType.Lights) continue;
    const group = groups[object.group];
    const name = group?.name;
    if (!group || !name) continue;

    const memberIndices = int16Attribute(group, GROUP_MEMBERS_RECORD) ?? [];
    const members = memberIndices
      .map((at) => groups[at]?.name)
      .map((memberName) => (memberName ? lights.get(memberName) : undefined))
      .filter((light): light is Light => Boolean(light));

    const period = floatAttribute(group, GROUP_PERIOD_RECORD)?.[0] ?? 0;
    const built = createLightGroup({ timer, lights: members, defaultPeriod: period });
    lightGroups.set(name, built);
    groupMembers.set(built, members);
    periods.set(name, period);
  }

  // ⚠️ THE FUEL TANK, WHICH IS OBJECT TYPE 1030 AND NOT 1026. `TLightBargraph` derives from
  // `TLightGroup` and is built from the same two records, so the pass looks like the one above it. What
  // differs is the answer it gives: `TLightGroupGetOnCount` returns its LEVEL, and the fuel rollovers
  // compare that against eleven with six lamps on the table. Building it as a light group would make
  // every one of those comparisons false for ever, which is why it is kept in a map of its own.
  //
  // ⚠️ AND ITS TWO ANNOUNCEMENTS HAVE NO LISTENER IN THIS BUILD. Draining a level sends
  // `ControlTimerExpired` and reaching empty sends `TLightGroupCountdownEnded`; both belong to the
  // mission machine, which this demonstration does not run. The tank still drains — that is the part a
  // player feels — and the events are left unbound rather than pointed at a handler that ignores them.
  for (const object of table.tableObjects) {
    if (object.type !== ObjectType.FuelBargraph) continue;
    const group = groups[object.group];
    const name = group?.name;
    if (!group || !name) continue;

    const members = (int16Attribute(group, GROUP_MEMBERS_RECORD) ?? [])
      .map((at) => groups[at]?.name)
      .map((memberName) => (memberName ? lights.get(memberName) : undefined))
      .filter((light): light is Light => Boolean(light));

    const underlying = createLightGroup({
      timer, lights: members, defaultPeriod: floatAttribute(group, GROUP_PERIOD_RECORD)?.[0] ?? 0,
    });
    bargraphLights.set(name, members);
    bargraphs.set(name, createLightBargraph({
      timer, group: underlying, lights: members,
      times: floatAttribute(group, BARGRAPH_TIMES_RECORD) ?? [],
    }));
  }

  // The bumper groups, in the same second pass and for the same reason as the light groups.
  for (const object of table.tableObjects) {
    if (object.type !== ObjectType.BumperList) continue;
    const group = groups[object.group];
    const name = group?.name;
    if (!group || !name) continue;

    const members = (int16Attribute(group, GROUP_MEMBERS_RECORD) ?? [])
      .map((at) => groups[at]?.name)
      .filter((memberName): memberName is string => Boolean(memberName) && bumpers.has(memberName!));
    bumperGroups.set(name, members);
  }

  return {
    bumpers,
    lights,
    lightGroups,
    bargraphs,
    bargraphLights,
    kickbacks,
    bumperGroups,
    timer,
    membersOf: (group) => groupMembers.get(group) ?? [],
    periodOf: (name) => periods.get(name) ?? 0,
    thresholdOf: (name) => thresholds.get(name) ?? Number.POSITIVE_INFINITY,

    advance(seconds) {
      now += seconds;
      for (const [id, entry] of [...pending]) {
        if (entry.at > now) continue;
        pending.delete(id);
        entry.run();
      }
    },

    raise(name) {
      const bumper = bumpers.get(name);
      if (!bumper) return;
      bumper.setLevel(bumper.level + 1, frameCounts.get(name) ?? 1);
    },

    raiseGroup(groupName) {
      for (const member of bumperGroups.get(groupName) ?? []) {
        const bumper = bumpers.get(member);
        if (bumper) bumper.setLevel(bumper.level + 1, frameCounts.get(member) ?? 1);
      }
    },

    setGroupLevel(groupName, level) {
      for (const member of bumperGroups.get(groupName) ?? []) {
        bumpers.get(member)?.setLevel(level, frameCounts.get(member) ?? 1);
      }
    },

    lowerGroup(groupName) {
      for (const member of bumperGroups.get(groupName) ?? []) {
        const bumper = bumpers.get(member);
        // `setLevel` floors at zero, so a group already at the bottom simply stays there.
        if (bumper) bumper.setLevel(bumper.level - 1, frameCounts.get(member) ?? 1);
      }
    },

    restartGroupTimer(groupName, seconds, run) {
      const running = groupTimers.get(groupName);
      if (running) timer.kill(running);
      groupTimers.delete(groupName);
      if (seconds <= 0) return;
      groupTimers.set(groupName, timer.set(seconds, () => {
        groupTimers.delete(groupName);
        run();
      }));
    },

    fire(name) {
      const bumper = bumpers.get(name);
      if (!bumper) return;
      // A ball fast enough to clear any threshold. The demo's own collisions go through the grid; this
      // is the seam a test and a dispatcher use to say "this one was struck".
      const ball = { position: { x: 0, y: 0 }, direction: { x: 0, y: 1 }, speed: 1000 };
      bumper.collision(ball, { x: 0, y: 0 }, { x: 0, y: -1 }, 0, null);
    },
  };
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// control/mission-table — which mission is which, and what each one asks for.
//
// ========================= THE MISSION NUMBER IS A SWITCH, NOT A STATE MACHINE =========================
// `MissionControl` is one `switch (lite198->MessageField)` over thirty-three cases, each calling one
// controller. There is no mission object, no registry and no transition table: a mission ENDS by
// writing the next number into that lamp's message field and re-dispatching, and the switch does the
// rest. Which is why the "next mission" of every controller is just a number in this table.
//
// Case 19 is missing from the original's switch — it is `QuoteController`, commented out because it
// belongs to Full Tilt. The gap is transcribed rather than closed, because closing it would renumber
// everything after it.
//
// ========================= TWENTY-THREE OF THEM ARE THE SAME FORTY LINES =========================
// `control/mission-runner` argued that the mission controllers are one function repeated. Extracting
// them mechanically settles it: of the thirty-three cases, TWENTY-THREE fit the runner exactly, and
// what differs between them is only what is written below — some lamps, a count, a set of components,
// a next number, some text keys and a reward.
//
// The ten that do not fit each do something the shape cannot express, and are ported separately: the
// two that are not missions at all (waiting for deployment, game over), mission selection, and seven
// with real branching. `TimeWarpPartTwoController` is the clearest of those — its two qualifying
// components have OPPOSITE effects, one demoting the player's rank and the other promoting it.
//
// ========================= THE TEXT IS A KEY, NEVER A STRING =========================
// Every announcement here is a resource identifier from the original, not the English behind it. That
// text is Microsoft's; this repository carries the keys so that the i18n dictionaries can carry our
// own words in pt-BR, en and es. `STRING179` is the shared "you scored N" line, which is why nearly
// every rewarded mission names it.
//
// Two missions share `STRING208`, their running text: the practice mission and Alien Menace part two
// both ask for the same bumpers, so the original reuses the sentence rather than the controller.
//
// ========================= AND THE LAST MAELSTROM ARMS THE HYPERSPACE CLIMAX =========================
// `MaelstromPartEightController` turns `lite130` ON while it runs — not flashing, lit — and off again
// when it ends. `lite130` is the lamp `control/hyperspace` calls the climax: the branch that hands the
// player the multiplier, the jackpot, the bonus, the extra ball and the rest at once. So the final
// Maelstrom mission quietly makes the biggest award on the table available for its duration, and
// nothing says so.

/** `MissionControl`'s switch, in full. Case 19 is Full Tilt's `QuoteController` and does not exist. */
export const MISSION_CONTROLLERS: Readonly<Record<number, string>> = {
  0: 'WaitingDeployment', 1: 'SelectMission', 2: 'PracticeMission', 3: 'LaunchTraining',
  4: 'ReentryTraining', 5: 'ScienceMission', 6: 'StrayComet', 7: 'BlackHoleThreat',
  8: 'SpaceRadiation', 9: 'BugHunt', 10: 'AlienMenace', 11: 'RescueMission',
  12: 'Satellite', 13: 'Reconnaissance', 14: 'DoomsdayMachine', 15: 'CosmicPlague',
  16: 'SecretMissionYellow', 17: 'TimeWarp', 18: 'Maelstrom',
  20: 'AlienMenacePartTwo', 21: 'CosmicPlaguePartTwo', 22: 'SecretMissionRed',
  23: 'SecretMissionGreen', 24: 'TimeWarpPartTwo', 25: 'MaelstromPartTwo',
  26: 'MaelstromPartThree', 27: 'MaelstromPartFour', 28: 'MaelstromPartFive',
  29: 'MaelstromPartSix', 30: 'MaelstromPartSeven', 31: 'MaelstromPartEight',
  32: 'Gameover',
};

/** The ten that do not fit `makeMissionController`, with the reason. */
export const MISSIONS_WITH_THEIR_OWN_SHAPE: Readonly<Record<number, string>> = {
  0: 'not a mission: waits for the ball to be deployed',
  1: 'mission selection, ported in control/select-mission',
  6: 'two stages in one controller, gated on a lamp',
  7: 'two stages in one controller, gated on a lamp',
  8: 'two stages in one controller, gated on a lamp',
  10: 'chains into part two without a reward, and re-announces differently',
  11: 'two stages in one controller, gated on a lamp',
  24: 'its two components have OPPOSITE effects: one demotes the rank, one promotes it',
  32: 'not a mission: the game-over sequence',
};

export interface MissionRow {
  /** The value of `lite198->MessageField` that selects it. */
  readonly mission: number;
  readonly name: string;
  /** Flashed for as long as the mission runs. `TLightFlasherStartTimed(0)`. */
  readonly lamps: readonly string[];
  /** Turned ON rather than flashed, and off again at the end. */
  readonly litLamps?: readonly string[];
  /**
   * Qualifying hits needed. `null` means the field is not touched and one hit ends it; `0` means the
   * field IS written (with zero) and one hit still ends it — `MaelstromPartFour` does exactly that.
   */
  readonly count: number | null;
  readonly components: readonly string[];
  readonly nextMission: number;
  /** Resource keys, never text. See this module's header. */
  readonly textKey: string;
  readonly completeTextKey?: string;
  readonly infoTextKey?: string;
  readonly scoreTextKey?: string;
  readonly award?: number;
  readonly rankPoints?: number;
}

const BUMPERS = ['bump1', 'bump2', 'bump3', 'bump4'] as const;
const LEFT_TARGETS = ['target1', 'target2', 'target3', 'target6', 'target5', 'target4',
  'target9', 'target8', 'target7'] as const;
const RIGHT_TARGETS = ['target10', 'target11', 'target12', 'target13', 'target14', 'target15',
  'target16', 'target17', 'target18', 'target19', 'target20', 'target21', 'target22'] as const;
const ROLLOVERS = ['roll3', 'roll2', 'roll1', 'roll112', 'roll111', 'roll110',
  'roll4', 'roll8', 'roll6', 'roll7', 'roll5'] as const;
/** The shared "you scored N" line. */
const SCORED = 'STRING179';

export const MISSION_TABLE: readonly MissionRow[] = [
  {
    mission: 2, name: 'PracticeMission', lamps: ['lite308', 'lite311'],
    count: 8, components: [...BUMPERS], nextMission: 1,
    textKey: 'STRING208', completeTextKey: 'STRING209', scoreTextKey: SCORED,
    award: 500000, rankPoints: 6,
  },
  {
    mission: 3, name: 'LaunchTraining', lamps: ['lite317'],
    count: 3, components: ['ramp'], nextMission: 1,
    textKey: 'STRING211', completeTextKey: 'STRING212', scoreTextKey: SCORED,
    award: 500000, rankPoints: 6,
  },
  {
    mission: 4, name: 'ReentryTraining', lamps: ['lite307'],
    count: 3, components: ['roll3', 'roll2', 'roll1'], nextMission: 1,
    textKey: 'STRING213', completeTextKey: 'STRING214', scoreTextKey: SCORED,
    award: 500000, rankPoints: 6,
  },
  {
    mission: 5, name: 'ScienceMission', lamps: ['lite303', 'lite309', 'lite315'],
    count: 9, components: [...LEFT_TARGETS], nextMission: 1,
    textKey: 'STRING215', completeTextKey: 'STRING216', scoreTextKey: SCORED,
    award: 750000, rankPoints: 9,
  },
  {
    mission: 9, name: 'BugHunt',
    lamps: ['lite306', 'lite308', 'lite310', 'lite313', 'lite319'],
    count: 15, components: [...LEFT_TARGETS, ...RIGHT_TARGETS], nextMission: 1,
    textKey: 'STRING226', completeTextKey: 'STRING227', scoreTextKey: SCORED,
    award: 750000, rankPoints: 7,
  },
  {
    mission: 12, name: 'Satellite', lamps: ['lite308'],
    count: 3, components: ['bump4'], nextMission: 1,
    textKey: 'STRING233', completeTextKey: 'STRING234', scoreTextKey: SCORED,
    award: 1250000, rankPoints: 9,
  },
  {
    mission: 13, name: 'Reconnaissance',
    lamps: ['lite301', 'lite302', 'lite307', 'lite316', 'lite320', 'lite321'],
    count: 15, components: [...ROLLOVERS], nextMission: 1,
    textKey: 'STRING235', completeTextKey: 'STRING237', scoreTextKey: SCORED,
    award: 1250000, rankPoints: 9,
  },
  {
    mission: 14, name: 'DoomsdayMachine', lamps: ['lite301', 'lite320'],
    count: 3, components: ['roll4', 'roll8'], nextMission: 1,
    textKey: 'STRING238', completeTextKey: 'STRING239', scoreTextKey: SCORED,
    award: 1250000, rankPoints: 9,
  },
  // Seventy-five hits on the two flags, and no reward at all — it only opens part two.
  {
    mission: 15, name: 'CosmicPlague', lamps: ['lite305', 'lite312'],
    count: 75, components: ['flag1', 'flag2'], nextMission: 21,
    textKey: 'STRING240',
  },
  {
    mission: 16, name: 'SecretMissionYellow', lamps: ['lite3'],
    count: null, components: ['sink3'], nextMission: 22,
    textKey: 'STRING243',
  },
  {
    mission: 17, name: 'TimeWarp', lamps: ['lite300', 'lite322'],
    count: 25, components: ['rebo1', 'rebo2', 'rebo3', 'rebo4'], nextMission: 24,
    textKey: 'STRING247',
  },
  {
    mission: 18, name: 'Maelstrom', lamps: ['lite303', 'lite309', 'lite315'],
    count: 3, components: [...LEFT_TARGETS], nextMission: 25,
    textKey: 'STRING249',
  },
  // Shares STRING208 with the practice mission: same bumpers, same sentence.
  {
    mission: 20, name: 'AlienMenacePartTwo', lamps: ['lite308', 'lite311'],
    count: 8, components: [...BUMPERS], nextMission: 1,
    textKey: 'STRING208', completeTextKey: 'STRING231', scoreTextKey: SCORED,
    award: 750000, rankPoints: 7,
  },
  {
    mission: 21, name: 'CosmicPlaguePartTwo', lamps: ['lite310'],
    count: null, components: ['roll9'], nextMission: 1,
    textKey: 'STRING241', completeTextKey: 'STRING242', scoreTextKey: SCORED,
    award: 1750000, rankPoints: 11,
  },
  {
    mission: 22, name: 'SecretMissionRed', lamps: ['lite4'],
    count: null, components: ['sink1'], nextMission: 23,
    textKey: 'STRING244',
  },
  {
    mission: 23, name: 'SecretMissionGreen', lamps: ['lite2'],
    count: null, components: ['sink2'], nextMission: 1,
    textKey: 'STRING245', completeTextKey: 'STRING246', scoreTextKey: SCORED,
    award: 1500000, rankPoints: 10,
  },
  {
    mission: 25, name: 'MaelstromPartTwo',
    lamps: ['lite306', 'lite308', 'lite310', 'lite313', 'lite319'],
    count: 3, components: [...RIGHT_TARGETS], nextMission: 26,
    textKey: 'STRING250',
  },
  {
    mission: 26, name: 'MaelstromPartThree',
    lamps: ['lite301', 'lite302', 'lite307', 'lite316', 'lite320', 'lite321'],
    count: 5, components: [...ROLLOVERS], nextMission: 27,
    textKey: 'STRING251',
  },
  // The only row with a count of ZERO: the field is written, but one hit still ends it.
  {
    mission: 27, name: 'MaelstromPartFour', lamps: ['lite318'],
    count: 0, components: ['roll184'], nextMission: 28,
    textKey: 'STRING252',
  },
  {
    mission: 28, name: 'MaelstromPartFive', lamps: ['lite317'],
    count: null, components: ['ramp'], nextMission: 29,
    textKey: 'STRING253',
  },
  {
    mission: 29, name: 'MaelstromPartSix', lamps: ['lite305', 'lite312'],
    count: null, components: ['flag1', 'flag2'], nextMission: 30,
    textKey: 'STRING254',
  },
  // No lamps at all: the three wormhole sinks are the target and they light themselves.
  {
    mission: 30, name: 'MaelstromPartSeven', lamps: [],
    count: null, components: ['sink1', 'sink2', 'sink3'], nextMission: 31,
    textKey: 'STRING255',
  },
  // `lite130` is the hyperspace climax lamp. See this module's header.
  {
    mission: 31, name: 'MaelstromPartEight', lamps: ['lite304'], litLamps: ['lite130'],
    count: null, components: ['kickout2'], nextMission: 1,
    textKey: 'STRING256', infoTextKey: 'STRING149', scoreTextKey: SCORED,
    award: 5000000, rankPoints: 18,
  },
];

/** The Maelstrom is eight missions chained end to end; every other chain is at most two long. */
export const MAELSTROM_CHAIN: readonly number[] = [18, 25, 26, 27, 28, 29, 30, 31];

/**
 * The RUNNING text of every mission, including the nine that do not fit the runner.
 *
 * ⚠️ THIS EXISTS BECAUSE A REAL BOOT PUT `STRING151` ON THE SCREEN. `shell/boot` resolves whatever
 * `missionTextId` the table hands it, and the i18n key map had only the ids `MISSION_TABLE` names — so
 * the nine missions with their own shape had none, and the very first one the game shows is one of
 * them. The unknown-key-returns-itself rule made it visible rather than blank, which is what it is
 * for; this table is what stops it happening again, and a test walks every mission number in
 * `MISSION_CONTROLLERS` against it.
 *
 * The two-stage missions name their FIRST-stage text here. The second stage's is chosen at runtime by
 * the controller, which is the only thing that knows which stage it is in.
 */
export const MISSION_TEXT_IDS: Readonly<Record<number, string>> = {
  0: 'STRING151', // waiting for deployment — the first thing the game ever says
  1: 'STRING178', // mission selection
  2: 'STRING208', 3: 'STRING211', 4: 'STRING213', 5: 'STRING215',
  6: 'STRING218', // stray comet, stage one
  7: 'STRING223', // black hole threat, stage one
  8: 'STRING276', // space radiation, stage one
  9: 'STRING226',
  10: 'STRING275', // alien menace
  11: 'STRING228', // rescue mission, stage one
  12: 'STRING233', 13: 'STRING235', 14: 'STRING238', 15: 'STRING240',
  16: 'STRING243', 17: 'STRING247', 18: 'STRING249',
  20: 'STRING208', 21: 'STRING241', 22: 'STRING244', 23: 'STRING245',
  24: 'STRING248', // time warp part two
  25: 'STRING250', 26: 'STRING251', 27: 'STRING252', 28: 'STRING253',
  29: 'STRING254', 30: 'STRING255', 31: 'STRING256',
  32: 'STRING272', // game over
};

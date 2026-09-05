// SPDX-License-Identifier: AGPL-3.0-or-later
// control/bindings — which component each control function reaches for, transcribed from `control.cpp`.
//
// ========================= THE LAST THING BETWEEN A PORT AND A GAME =========================
// `control/score-table` says WHICH control function each component runs. `control/lanes` and its
// neighbours say what those functions DO. Neither says which light, which group, which bumper — and in
// the original that is not in a table at all. It is in the function bodies, as named globals:
//
//     if (roll3 == caller)      light = lite8;
//     else if (roll2 == caller) light = lite9;
//     else                      light = lite10;
//
// So the bindings are data trapped in code, and getting them out is a transcription of its own. This
// file is where it goes, one control at a time, with the archive's own names.
//
// ⚠️ THE NAMES HERE ARE TAGS, NOT VARIABLES. `attack_bump` is what `control.cpp` calls it and
// `attack_bumpers` is what the file calls it; `roll3` is `a_roll3`. Everything in this file is the
// second kind, because the second kind is what a collision reports.
//
// ⚠️ AND IT IS PARTIAL, DELIBERATELY. One chain is transcribed and the rest are not. A half-filled
// table that pretended to be whole would be worse than a small one that says where it stops — and the
// count below is checked by a test, so growing it is a decision somebody makes rather than a drift.

/** One rollover lane's contribution: the light it turns on. */
export interface LaneLightBinding {
  /** The archive's name for the rollover. */
  readonly component: string;
  /** The archive's name for the light it lights. */
  readonly light: string;
}

export interface BumperLaneBinding {
  /** The control function in `score-table`'s `controlName`. */
  readonly control: string;
  /** Which light each lane turns on. */
  readonly lanes: readonly LaneLightBinding[];
  /** The light group the control asks "are all of you on yet". */
  readonly lightGroup: string;
  /** The bumper group it raises when the answer is yes. */
  readonly bumperGroup: string;
  /**
   * ⚠️ THE GUARD IS ON ONE NAMED BUMPER, NOT ON THE GROUP. `if (bump1->BmpIndex < 3)` — the original
   * asks the FIRST bumper and raises all four. Since they rise together the question is the same for
   * any of them, but transcribing it as "if any member is below 3" would be a different rule the day a
   * bumper is raised on its own.
   */
  readonly guardBumper: string;
  readonly guardBelowLevel: number;
  /** The resource id of the line shown when the lanes complete. */
  readonly completeTextId: string;
}

/**
 * `control::ReentryLanesRolloverControl`, transcribed whole.
 *
 * Verified against the archive rather than assumed: `bmpr_inc_lights` really holds lite8, lite9 and
 * lite10, and `attack_bumpers` really holds a_bump1 to a_bump4. The data agrees with the code, which is
 * the only reason to believe either.
 */
export const REENTRY_LANES: BumperLaneBinding = {
  control: 'ReentryLanesRolloverControl',
  lanes: [
    { component: 'a_roll3', light: 'lite8' },
    { component: 'a_roll2', light: 'lite9' },
    // The original's `else`: anything that is not roll3 or roll2 gets lite10, and roll1 is what that is.
    { component: 'a_roll1', light: 'lite10' },
  ],
  lightGroup: 'bmpr_inc_lights',
  bumperGroup: 'attack_bumpers',
  guardBumper: 'a_bump1',
  guardBelowLevel: 3,
  completeTextId: 'STRING106',
};

/**
 * `control::LaunchLanesRolloverControl`, the reentry lanes' twin.
 *
 * ⚠️ THE SAME SHAPE AND EVERY NAME DIFFERENT, which is exactly why it is written out rather than
 * derived. Three lanes, a light group, a bumper group, a guard on one named bumper, a line of text —
 * and not one of the six names is shared with the chain above. A rule that "the second lane set works
 * like the first" would be true about the structure and wrong about every value in it.
 *
 * The third lane is the original's `else`: anything that is not roll112 or roll111, which is roll110.
 */
export const LAUNCH_LANES: BumperLaneBinding = {
  control: 'LaunchLanesRolloverControl',
  lanes: [
    { component: 'a_roll112', light: 'lite171' },
    { component: 'a_roll111', light: 'lite170' },
    { component: 'a_roll110', light: 'lite169' },
  ],
  lightGroup: 'ramp_bmpr_inc_lights',
  bumperGroup: 'launch_bumpers',
  guardBumper: 'a_bump5',
  guardBelowLevel: 3,
  completeTextId: 'STRING107',
};

/** Every chain transcribed so far. The test that counts them is how the next one gets noticed. */
export const BUMPER_LANE_BINDINGS: readonly BumperLaneBinding[] = [REENTRY_LANES, LAUNCH_LANES];

/**
 * `control::ReturnLaneRolloverControl`, and the other half of a rule that spans two components.
 *
 * ⚠️ THE SPACE WARP LIGHTS THESE LAMPS AND SCORES NOTHING; the return lanes are where the shot is
 * collected, at score index ONE instead of index zero. Neither component means anything alone, and the
 * lamp is the only thing joining them — which is exactly why a binding table is needed at all: nothing
 * in either function says the other exists.
 */
export interface ReturnLaneBinding {
  readonly control: string;
  /** Each lane and the lamp the space warp lit for it. */
  readonly lanes: readonly { readonly component: string; readonly lamp: string }[];
  /** The shared warp indicator, darkened by whichever lane collects. */
  readonly warpLamp: string;
}

export const RETURN_LANES: ReturnLaneBinding = {
  control: 'ReturnLaneRolloverControl',
  lanes: [
    { component: 'a_roll6', lamp: 'lite27' },
    { component: 'a_roll7', lamp: 'lite28' },
  ],
  warpLamp: 'lite59',
};

/**
 * `control::FuelRollover1Control` to `FuelRollover6Control`: six rollovers that fill one tank.
 *
 * ⚠️ THE THRESHOLD AND THE FILL ARE THE SAME NUMBER, AND IT IS A LEVEL, NOT A LAMP. Each rollover asks
 * whether the tank is already past its own level and, if not, fills to exactly that level. Six lamps
 * make TWELVE levels — see `table/light-bargraph` — so the numbers run 1, 3, 5, 7, 9, 11 and every one
 * of them is odd: a rollover always leaves a solid lamp, never a flashing half.
 *
 * ⚠️ AND THE ROLLOVER'S OWN LAMP IS A SEGMENT OF THE TANK. `literoll179` is both the lamp blinked when
 * the tank is already fuller and the first bar of the bargraph, so a rollover that arrives too late
 * blinks the very segment it would have lit. That is the table telling the player where the shot went.
 */
export interface FuelRolloverBinding {
  readonly control: string;
  readonly component: string;
  /** Blinked for a twentieth of a second when the tank is already past this level. */
  readonly lamp: string;
  /** Both the threshold and the fill. See above. */
  readonly splitIndex: number;
}

/** The tank every one of them fills, by the archive's name. */
export const FUEL_BARGRAPH = 'fuel_bargraph';
/** The line shown on a successful refuel, the same one for all six. */
export const FUEL_REFUEL_TEXT_ID = 'STRING145';

export const FUEL_ROLLOVERS: readonly FuelRolloverBinding[] = [
  { control: 'FuelRollover1Control', component: 'a_roll179', lamp: 'literoll179', splitIndex: 1 },
  { control: 'FuelRollover2Control', component: 'a_roll180', lamp: 'literoll180', splitIndex: 3 },
  { control: 'FuelRollover3Control', component: 'a_roll181', lamp: 'literoll181', splitIndex: 5 },
  { control: 'FuelRollover4Control', component: 'a_roll182', lamp: 'literoll182', splitIndex: 7 },
  { control: 'FuelRollover5Control', component: 'a_roll183', lamp: 'literoll183', splitIndex: 9 },
  { control: 'FuelRollover6Control', component: 'a_roll184', lamp: 'literoll184', splitIndex: 11 },
];

/**
 * `control::OutLaneRolloverControl`, run by BOTH out lanes — `a_roll4` and `a_roll8`.
 *
 * ⚠️ THE FUNCTION BRANCHES ON WHICH ONE CALLED IT, and the original writes that as `roll4 == caller`
 * with everything else in the `else`. Transcribed as a table it is two entries, and the FIRST lamp of
 * each pair is the one whose lit state arms it: `lite30` arms `lite30 + lite196`, `lite29` arms
 * `lite29 + lite195`. Storing the pair in the other order would flash on the wrong condition.
 *
 * ⚠️ AND LOSING THE BALL HERE IS WHERE AN EXTRA BALL IS COLLECTED. `lite17` or `lite18` lit turns the
 * loss into a grant — the ball still drains, and one is banked. That is the whole reason an out lane
 * is not simply a drain.
 */
export interface OutLaneBinding {
  readonly control: string;
  /** Both lanes, by the archive's name. */
  readonly components: readonly string[];
  /** `lite17` and `lite18`. Either lit means an extra ball is waiting. */
  readonly extraBallLamps: readonly string[];
  /** Per lane, the warp pair it flashes. The first is the one that has to be lit. */
  readonly warpLamps: Readonly<Record<string, readonly string[]>>;
  readonly missSound: string;
  /** `table_add_extra_ball`'s own line. */
  readonly extraBallTextId: string;
}

export const OUT_LANES: OutLaneBinding = {
  control: 'OutLaneRolloverControl',
  components: ['a_roll4', 'a_roll8'],
  extraBallLamps: ['lite17', 'lite18'],
  warpLamps: {
    a_roll4: ['lite30', 'lite196'],
    a_roll8: ['lite29', 'lite195'],
  },
  missSound: 'miss',
  extraBallTextId: 'STRING110',
};

/**
 * `control::BonusLaneRolloverControl`, run by `a_roll5`.
 *
 * ⚠️ IT FILLS THE TANK EITHER WAY, and that is outside the branch in the original. Collecting the bonus
 * and missing it both end with `TLightGroupToggleSplitIndex 11` — so the lane is worth crossing even
 * when the lamp is dark, and a transcription that tucked the refill into the `else` would have made a
 * lit lamp cost the player their fuel.
 *
 * ⚠️ AND THE MISS BRANCH SHOWS THE REFUEL LINE, the same `STRING145` the six fuel rollovers show. The
 * consolation for crossing an unlit bonus lane is a full tank, and the game says so in those words.
 */
export interface BonusLaneBinding {
  readonly control: string;
  readonly component: string;
  /** `lite16`. Lit, the lane pays the accumulated bonus instead of its own score. */
  readonly lamp: string;
  /** The level the tank is filled to, which is the top of it. */
  readonly topSplitIndex: number;
  /** `STRING104`, which carries the amount paid. */
  readonly bonusTextId: string;
  /** `STRING145` — the refuel line, shared with the fuel rollovers. */
  readonly missTextId: string;
  readonly collectSound: string;
  readonly missSound: string;
}

export const BONUS_LANE: BonusLaneBinding = {
  control: 'BonusLaneRolloverControl',
  component: 'a_roll5',
  lamp: 'lite16',
  topSplitIndex: 11,
  bonusTextId: 'STRING104',
  missTextId: FUEL_REFUEL_TEXT_ID,
  collectSound: 'collect',
  // ⚠️ NOT A MISS. The unlit branch plays `soundwave25`, and the original plays that emitter in exactly
  // two places — here and where the fuel spot set completes — both of which fill the tank to the top.
  // It is the refuel sound. Read in isolation this branch looks like a failure, because the lamp was
  // dark, and it was wired with a falling tone for what is actually the consolation being paid.
  missSound: 'refuel',
};

/**
 * The four SPOT TARGET sets: `FuelSpotTargetControl` and its three siblings.
 *
 * ⚠️ THE MEMORY IS IN THE LAMPS, NOT IN THE TARGETS. Each target owns one lamp; hitting it lights that
 * lamp and scores on its own, and the SET completing is judged by the group's lit count. So hitting one
 * target three times is worth three hits and no set — which is the difference between a skill shot and
 * a tap, and it falls out of reading the group rather than counting.
 *
 * ⚠️ AND THREE OF THE FOUR ARE TRANSCRIBED BUT NOT RUN. The two hazard sets disable a gate when they
 * complete, and this build constructs no `TGate` — a gate needs the table's edges, which live in
 * `table/original` and not in `table/original-components`. The mission set chooses its sound from
 * whether `lite198` is lit, BEFORE it knows whether the set completed, and plays none at all on the
 * completion — a different rule that `makeSpotTargetControl` cannot express and should not be bent to.
 * The transcription is done and correct either way; the dispatcher says which it runs.
 */
export type SpotCompletion =
  | { readonly kind: 'fillTank'; readonly splitIndex: number; readonly textId: string }
  | { readonly kind: 'disableGate'; readonly gate: string }
  /** The mission set's completion flashes the group off and does nothing else. */
  | { readonly kind: 'none' };

export interface SpotTargetBinding {
  readonly control: string;
  /** The three targets, in the order the original's `if` chain tests them. */
  readonly targets: readonly string[];
  /** One lamp per target, same order. */
  readonly lamps: readonly string[];
  /** Completion is judged by this group's lit count. All four hold exactly three lamps. */
  readonly lightGroup: string;
  /**
   * ⚠️ THE SECOND MEMORY OF THE SAME HIT. `lite104->MessageField |= 1u` records which of the three
   * were struck as BITS in the first lamp, and nothing in the control ever clears it — the missions
   * read that mask. The fuel set is the only one without it.
   */
  readonly maskLamp?: string;
  readonly hitSound: string;
  readonly completeSound: string;
  readonly completion: SpotCompletion;
  /**
   * The mission set alone picks its sound from a LAMP rather than from the outcome. Present here means
   * the shared factory does not fit, and the dispatcher declines rather than approximating.
   */
  readonly soundFromLamp?: string;
}

export const SPOT_TARGET_SETS: readonly SpotTargetBinding[] = [
  {
    control: 'FuelSpotTargetControl',
    targets: ['a_targ10', 'a_targ11', 'a_targ12'],
    lamps: ['lite70', 'lite71', 'lite72'],
    lightGroup: 'top_circle_tgt_lights',
    hitSound: 'hit',
    // `soundwave25`, which the original plays in exactly two places and both fill the tank.
    completeSound: 'refuel',
    completion: { kind: 'fillTank', splitIndex: 11, textId: FUEL_REFUEL_TEXT_ID },
  },
  {
    control: 'MissionSpotTargetControl',
    targets: ['a_targ13', 'a_targ14', 'a_targ15'],
    lamps: ['lite101', 'lite102', 'lite103'],
    lightGroup: 'ramp_tgt_lights',
    maskLamp: 'lite101',
    hitSound: 'hit',
    completeSound: 'complete',
    completion: { kind: 'none' },
    soundFromLamp: 'lite198',
  },
  {
    control: 'LeftHazardSpotTargetControl',
    targets: ['a_targ16', 'a_targ17', 'a_targ18'],
    lamps: ['lite104', 'lite105', 'lite106'],
    lightGroup: 'lchute_tgt_lights',
    maskLamp: 'lite104',
    hitSound: 'hit',
    completeSound: 'complete',
    completion: { kind: 'disableGate', gate: 'v_gate1' },
  },
  {
    control: 'RightHazardSpotTargetControl',
    targets: ['a_targ19', 'a_targ20', 'a_targ21'],
    lamps: ['lite107', 'lite108', 'lite109'],
    lightGroup: 'bpr_solotgt_lights',
    maskLamp: 'lite107',
    hitSound: 'hit',
    completeSound: 'complete',
    completion: { kind: 'disableGate', gate: 'v_gate2' },
  },
];

/**
 * The POPUP TARGET BANKS: three targets that must all be struck before anything is paid.
 *
 * ⚠️ THE MEMORY IS IN THE TARGETS, NOT IN THE LAMPS — the opposite of the spot sets. Each target's
 * `MessageField` records that it was struck this round, the bank completes when the three sum to
 * three, and completing clears all three and sends them back up. So the same target twice is worth
 * one hit, and the lamps are the RECORD of how many rounds have been won rather than of this round.
 *
 * ⚠️ AND THE ARCHIVE SPELLS IT `bumper_target_lights` WHILE THE CODE CALLS IT `bumber_`. The variable
 * is misspelled upstream and the file is not; binding by the variable's spelling finds nothing, which
 * is the same shape of failure as every other name in this table.
 */
export interface TargetBankBinding {
  readonly control: string;
  /** The three targets, in the order the original sums them. */
  readonly targets: readonly string[];
  /** The lamps that count COMPLETIONS. One more is lit each time the bank is filled. */
  readonly lightGroup: string;
  /** One line per rung; the last is reused for every rung past it. */
  readonly textIds: readonly string[];
}

export const MEDAL_BANK: TargetBankBinding = {
  control: 'MedalTargetControl',
  targets: ['a_targ4', 'a_targ5', 'a_targ6'],
  lightGroup: 'bumper_target_lights',
  textIds: ['STRING154', 'STRING155', 'STRING156'],
};

export const MULTIPLIER_BANK: TargetBankBinding = {
  control: 'MultiplierTargetControl',
  targets: ['a_targ7', 'a_targ8', 'a_targ9'],
  lightGroup: 'top_target_lights',
  // ⚠️ 2, 3, 5, 10 — `SCORE_MULTIPLIERS` is `[1, 2, 3, 5, 10]` and the lit count indexes it.
  textIds: ['STRING157', 'STRING158', 'STRING159', 'STRING160'],
};

/**
 * `control::table_set_*` — the table-level awards, which several controls reach through.
 *
 * ⚠️ THE LAMP IS THE TIMER. `table_set_bonus` lights `lite59` for sixty seconds and sets a flag;
 * nothing separately counts those sixty seconds down. The lamp going dark IS the award expiring, as
 * far as the player is concerned — see `control/table-actions`.
 */
export const TABLE_ACTIONS = {
  lamps: {
    /** `table_set_bonus_hold`, and the fourth rung of the booster chain. */
    bonusHold: 'lite58',
    bonus: 'lite59',
    jackpot: 'lite60',
    replay: 'lite199',
    multiball: ['lite38', 'lite39', 'lite40'],
    /** All three timed together by `table_set_flag_lights`; `lite61` is the one the chain tests. */
    flagLights: ['lite20', 'lite19', 'lite61'],
  },
  textIds: {
    extraBall: 'STRING110',
    bonusHeld: 'STRING153',
    bonusSet: 'STRING105',
    jackpotSet: 'STRING116',
    multiball: 'STRING117',
    flagLightsSet: 'STRING152',
    replay: 'STRING101',
  },
} as const;

/**
 * `control::BoosterTargetControl`: the third popup bank, and the one that pays an award CHAIN.
 *
 * ⚠️ EACH AWARD LIGHTS THE LAMP THE NEXT RUNG TESTS. The original is four nested `if`s over
 * `lite61 → lite60 → lite59 → lite58`, which is a linear search for the first DARK lamp — and the
 * awards themselves are what advance it. Three of the four lamps are lit on a sixty-second timer, so
 * the chain is not a ratchet: it slides back as awards expire and the bank refills whichever lapsed.
 *
 * ⚠️ AND THE ORIGINAL GIVES EACH RUNG ITS OWN EMITTER — `soundwave47`, `45`, `46`, `48`. This port has
 * one `chain` voice for all four, which is a SIMPLIFICATION and not a transcription: a player hears
 * that an award was granted but not which. `audio/voices` says its timbres are scaffolding, and this is
 * one of the places where the real sound set will have something to say.
 */
export interface BoosterChainStep {
  /** Lit means this award has already been granted. */
  readonly lamp: string;
  readonly award: 'flagLights' | 'jackpot' | 'bonus' | 'bonusHold';
  readonly sound: string;
}

export interface BoosterBankBinding {
  readonly control: string;
  readonly targets: readonly string[];
  /** In the order the original tests them: the first DARK one is granted. */
  readonly chain: readonly BoosterChainStep[];
  /** `lite198`, whose message field carries the running mission's number. */
  readonly missionLamp: string;
}

export const BOOSTER_BANK: BoosterBankBinding = {
  control: 'BoosterTargetControl',
  targets: ['a_targ1', 'a_targ2', 'a_targ3'],
  chain: [
    { lamp: 'lite61', award: 'flagLights', sound: 'chain' },
    { lamp: 'lite60', award: 'jackpot', sound: 'chain' },
    { lamp: 'lite59', award: 'bonus', sound: 'chain' },
    { lamp: 'lite58', award: 'bonusHold', sound: 'chain' },
  ],
  missionLamp: 'lite198',
};

/**
 * THE SKILL SHOT: one entry, five gates, and two ways out.
 *
 * ⚠️ IT PAYS MOST FOR THE THIRD LAMP, NOT THE SIXTH. `s_onewy4` carries
 * `15000 30000 75000 30000 15000 7500`, indexed by the lit count minus one — so running the whole set
 * is worth a TENTH of stopping at three. Reading that array as "more is better" and paying the last
 * entry would invert the only decision the mechanic asks the player to make.
 *
 * ⚠️ AND `lite67` IS WHAT "THE RUN IS OPEN" MEANS. All five later gates test it and do nothing without
 * it; the entry both restarts the run and, unconditionally, gives a five-second ball save. Those two
 * jobs share a gate and are otherwise unrelated.
 */
export interface SkillShotBinding {
  /** `s_onewy1`: restarts the run, and always arms the ball save. */
  readonly entry: {
    readonly control: string;
    readonly component: string;
    /** `lite200`, lit for five seconds whatever else happens. */
    readonly shootAgainLamp: string;
    /** `lite67`. Its being lit is the whole condition. */
    readonly firstLamp: string;
    /** `lite54` and `lite25`, flashed to advertise that the run has restarted. */
    readonly flashLamps: readonly string[];
    readonly topSplitIndex: number;
  };
  /** The five tripwires, each with the one lamp it lights. */
  readonly gates: readonly { readonly control: string; readonly component: string; readonly lamp: string }[];
  readonly lightGroup: string;
  /** `s_onewy4`: the payout, indexed by how many lamps are lit. */
  readonly collect: {
    readonly control: string;
    readonly component: string;
    /** `lite56`. Lit, it protects the trek lights from being cleared. */
    readonly trekGuardLamp: string;
    readonly trekGroups: readonly string[];
    readonly textId: string;
  };
  /** `s_onewy10`: the other exit, which throws the run away and pays nothing. */
  readonly lost: { readonly control: string; readonly component: string };
  readonly sound: string;
}

export const SKILL_SHOT: SkillShotBinding = {
  entry: {
    control: 'SkillShotGate1Control',
    component: 's_onewy1',
    shootAgainLamp: 'lite200',
    firstLamp: 'lite67',
    flashLamps: ['lite54', 'lite25'],
    topSplitIndex: 11,
  },
  gates: [
    { control: 'SkillShotGate2Control', component: 's_trip1', lamp: 'lite68' },
    { control: 'SkillShotGate3Control', component: 's_trip2', lamp: 'lite69' },
    { control: 'SkillShotGate4Control', component: 's_trip3', lamp: 'lite131' },
    { control: 'SkillShotGate5Control', component: 's_trip4', lamp: 'lite132' },
    { control: 'SkillShotGate6Control', component: 's_trip5', lamp: 'lite133' },
  ],
  lightGroup: 'skill_shot_lights',
  collect: {
    control: 'DeploymentChuteToEscapeChuteOneWayControl',
    component: 's_onewy4',
    trekGuardLamp: 'lite56',
    trekGroups: ['l_trek_lights', 'r_trek_lights'],
    textId: 'STRING122',
  },
  lost: { control: 'DeploymentChuteToTableOneWayControl', component: 's_onewy10' },
  sound: 'chain',
};

/**
 * `LeftKickerControl` and `RightKickerControl`: what SHUTS the chute again.
 *
 * ⚠️ THE KICKBACK IS THE CLOCK. Neither control answers a collision — they answer the kickback's own
 * `ControlTimerExpired`, which arrives a tenth of a second after it has thrown the ball back out. So
 * the chute stays open exactly as long as it takes the saver to do its work, and nothing counts down
 * anywhere.
 *
 * ⚠️ AND IN EASY MODE IT NEVER SHUTS. `if (!easyMode)` is the whole difference: the outlane stays open
 * for the rest of the ball. That is the option making the table forgiving without touching a single
 * piece of geometry.
 */
export interface KickerBinding {
  readonly control: string;
  /** The kickback whose timer runs the control, by the archive's name. */
  readonly component: string;
  /** The gate it puts back. */
  readonly gate: string;
}

export const KICKERS: readonly KickerBinding[] = [
  { control: 'LeftKickerControl', component: 'a_kick1', gate: 'v_gate1' },
  { control: 'RightKickerControl', component: 'a_kick2', gate: 'v_gate2' },
];

/**
 * `LeftKickerGateControl` and `RightKickerGateControl`: the lamps a gate lights when it opens.
 *
 * ⚠️ THESE ANSWER A GATE MESSAGE, NOT A COLLISION. `TGate::Message` ends with
 * `control::handler(code, this)`, so the gate itself tells its control function every time it opens or
 * shuts — which is how the two lamps come on. Nothing the ball touches runs these.
 *
 * ⚠️ AND THEY ARE THE SAME LAMPS THE OUT LANES FLASH. `lite30 + lite196` belong to the left chute:
 * the gate opening lights them, and a ball going out of that lane flashes them again. One pair, two
 * controls, and the pair's ORDER matters in both — the first lamp is the one that stays lit and the
 * one whose lit state arms the out lane.
 */
export interface GateLampBinding {
  readonly control: string;
  /** The gate, by the archive's name. */
  readonly gate: string;
  /** The first stays lit while the gate is open; the rest flash and go out. */
  readonly lamps: readonly string[];
}

export const GATE_LAMPS: readonly GateLampBinding[] = [
  { control: 'LeftKickerGateControl', gate: 'v_gate1', lamps: ['lite30', 'lite196'] },
  { control: 'RightKickerGateControl', gate: 'v_gate2', lamps: ['lite29', 'lite195'] },
];

/**
 * `FlipperRebounderControl1` and `2`: a rebounder that blinks a lamp.
 *
 * ⚠️ THE BLINK IS THE ONLY REASON THESE ARE NOT `RebounderControl`. A tenth of a second on `lite84` or
 * `lite85` — the flash under the flipper that says the ball caught its shoulder. Wiring them as plain
 * rebounders would score identically and look like nothing had happened, which is why they need a
 * binding at all: everything else about them is in the score table already.
 */
export interface FlipperRebounderBinding {
  readonly control: string;
  readonly component: string;
  readonly lamp: string;
}

export const FLIPPER_REBOUNDERS: readonly FlipperRebounderBinding[] = [
  { control: 'FlipperRebounderControl1', component: 'v_rebo1', lamp: 'lite84' },
  { control: 'FlipperRebounderControl2', component: 'v_rebo2', lamp: 'lite85' },
];

/**
 * ⚠️ A CONTROL WHOSE WHOLE BINDING IS A LIST OF LAMPS, IN ORDER.
 *
 * Some control functions reach for nothing but lights, and their factories take exactly that. Those
 * need no shape of their own beyond the ORDER, which `CONTROL_REACHES` cannot carry because it is a
 * set of names rather than a sequence — `makeSpaceWarpRolloverControl` wants `[lite27, lite28]` and
 * would take `[lite28, lite27]` without complaint.
 *
 * ⚠️ AND ONLY ONE OF THEM IS WIRED, BECAUSE ONLY ONE ANSWERS A COLLISION. `ExtraBallLightControl`
 * responds to `TLightResetAndTurnOn` and to a light's timer expiring; `LaunchRampHoleControl` responds
 * to `ControlBallReleased`. The demonstration produces neither event, so wiring them would create
 * objects nothing can drive — the exact defect this port has spent its history removing. They are
 * listed here because the transcription is done and correct; the dispatcher says which it runs.
 */
export interface LampBinding {
  readonly control: string;
  /** The component that runs it, by the archive's name. */
  readonly component: string;
  /** The lamps, IN THE ORDER the control function expects them. */
  readonly lamps: readonly string[];
  /** Which message the control answers. Only `ControlCollision` has a source in this build. */
  readonly onMessage: 'ControlCollision' | 'ControlBallReleased' | 'TLightResetAndTurnOn';
}

export const LAMP_BINDINGS: readonly LampBinding[] = [
  { control: 'SpaceWarpRolloverControl', component: 'a_roll9', lamps: ['lite27', 'lite28'],
    onMessage: 'ControlCollision' },
  { control: 'ExtraBallLightControl', component: 'lite17', lamps: ['lite17', 'lite18'],
    onMessage: 'TLightResetAndTurnOn' },
  { control: 'LaunchRampHoleControl', component: 'ramp_hole', lamps: ['lite54'],
    onMessage: 'ControlBallReleased' },
];

/**
 * ⚠️ WHICH COMPONENTS EACH CONTROL REACHES FOR, and nothing about what it does with them.
 *
 * That division is the whole reason this table can exist at all. `control/lanes` and its neighbours
 * already say what every function DOES — they were transcribed in phase 5 and tested. What they take as
 * options is WHICH light, WHICH group, WHICH gate, and in the original that is not a table: it is named
 * globals inside each function body. So the only thing missing was the names, and names are data.
 *
 * Every entry is the set of tagged components named inside that function in `control.cpp`, with the
 * ARCHIVE's name rather than the variable's — `attack_bump` is `attack_bumpers`, `roll3` is `a_roll3`.
 * A test holds that every one of the 288 references names a group that is really in `PINBALL.DAT`,
 * which is what would catch a transcription that reads perfectly and addresses nothing.
 *
 * ⚠️ IT SAYS WHAT IS REACHED, NOT IN WHAT ROLE. `SpaceWarpRolloverControl` reaches lite27 and lite28
 * and this does not say which is which — it does not have to, because that function names them itself.
 * The two lane chains above DO need roles, and that is why they keep a richer type instead of being
 * folded in here. A table that flattened them would have lost which lane lights which lamp.
 */
export const CONTROL_REACHES: Readonly<Record<string, readonly string[]>> = {
  BallDrainControl: [
    'a_targ1', 'a_targ2', 'a_targ3', 'a_targ4', 'a_targ5', 'a_targ6', 'a_targ7', 'a_targ8',
    'a_targ9', 'attack_bumpers', 'bmpr_inc_lights', 'bpr_solotgt_lights', 'bsink_arrow_lights',
    'bumper_target_lights', 'drain', 'fuel_bargraph', 'hyperspace_lights', 'info_text_box',
    'l_trek_lights', 'launch_bumpers', 'lchute_tgt_lights', 'lite1', 'lite101', 'lite102',
    'lite103', 'lite110', 'lite130', 'lite16', 'lite17', 'lite18', 'lite19', 'lite195',
    'lite196', 'lite198', 'lite199', 'lite20', 'lite200', 'lite25', 'lite26', 'lite27',
    'lite28', 'lite29', 'lite30', 'lite38', 'lite39', 'lite4', 'lite40', 'lite54', 'lite55',
    'lite56', 'lite58', 'lite59', 'lite60', 'lite61', 'lite62', 'lite77', 'middle_circle',
    'mission_text_box', 'outer_circle', 'plunger', 'r_trek_lights', 'ramp_bmpr_inc_lights',
    'ramp_tgt_lights', 'skill_shot_lights', 'soundwave27', 'soundwave3', 'soundwave59',
    'top_circle_tgt_lights', 'top_target_lights', 'v_bloc1', 'v_gate1', 'v_gate2', 'v_sink3',
    'worm_hole_lights'
  ],
  BlackHoleKickoutControl: ['info_text_box'],
  BonusLaneRolloverControl: ['fuel_bargraph', 'info_text_box', 'lite16', 'soundwave25', 'soundwave50'],
  BoosterTargetControl: [
    'a_targ1', 'a_targ2', 'a_targ3', 'lite198', 'lite58', 'lite59', 'lite60', 'lite61',
    'soundwave45', 'soundwave46', 'soundwave47', 'soundwave48'
  ],
  DeploymentChuteToEscapeChuteOneWayControl: [
    'info_text_box', 'l_trek_lights', 'lite56', 'r_trek_lights', 'skill_shot_lights',
    'soundwave3'
  ],
  DeploymentChuteToTableOneWayControl: ['skill_shot_lights'],
  DrainBallBlockerControl: ['lite1'],
  ExtraBallLightControl: ['lite17', 'lite18'],
  FlagControl: ['lite20'],
  FlipperRebounderControl1: ['lite84'],
  FlipperRebounderControl2: ['lite85'],
  FuelRollover1Control: ['fuel_bargraph', 'info_text_box', 'literoll179'],
  FuelRollover2Control: ['fuel_bargraph', 'info_text_box', 'literoll180'],
  FuelRollover3Control: ['fuel_bargraph', 'info_text_box', 'literoll181'],
  FuelRollover4Control: ['fuel_bargraph', 'info_text_box', 'literoll182'],
  FuelRollover5Control: ['fuel_bargraph', 'info_text_box', 'literoll183'],
  FuelRollover6Control: ['fuel_bargraph', 'info_text_box', 'literoll184'],
  FuelSpotTargetControl: [
    'a_targ10', 'a_targ11', 'fuel_bargraph', 'info_text_box', 'lite70', 'lite71', 'lite72',
    'soundwave25', 'top_circle_tgt_lights'
  ],
  GravityWellKickoutControl: ['a_kout1', 'info_text_box', 'lite62', 'soundwave7'],
  HyperspaceKickOutControl: [
    'bumper_target_lights', 'hyperspace_lights', 'info_text_box', 'lite130', 'lite24',
    'lite25', 'lite26', 'lite27', 'lite28', 'soundwave21', 'soundwave35', 'soundwave36',
    'soundwave38', 'soundwave39', 'soundwave40', 'soundwave41', 'soundwave50',
    'top_target_lights', 'v_bloc1'
  ],
  LaunchLanesRolloverControl: [
    'a_bump5', 'a_roll111', 'a_roll112', 'info_text_box', 'launch_bumpers', 'lite169',
    'lite170', 'lite171', 'ramp_bmpr_inc_lights'
  ],
  LaunchRampControl: [
    'info_text_box', 'lite198', 'lite54', 'lite55', 'lite56', 'soundwave21', 'soundwave23',
    'soundwave24', 'soundwave30'
  ],
  LaunchRampHoleControl: ['lite54'],
  LeftFlipperControl: ['bmpr_inc_lights', 'ramp_bmpr_inc_lights'],
  LeftHazardSpotTargetControl: [
    'a_targ16', 'a_targ17', 'lchute_tgt_lights', 'lite104', 'lite105', 'lite106',
    'soundwave14', 'v_gate1'
  ],
  LeftKickerControl: ['v_gate1'],
  LeftKickerGateControl: ['lite196', 'lite30'],
  MedalTargetControl: ['a_targ4', 'a_targ5', 'a_targ6', 'bumper_target_lights', 'info_text_box'],
  MissionSpotTargetControl: [
    'a_targ13', 'a_targ14', 'lite101', 'lite102', 'lite103', 'lite198', 'ramp_tgt_lights',
    'soundwave52'
  ],
  MultiplierLightGroupControl: ['info_text_box'],
  MultiplierTargetControl: ['a_targ7', 'a_targ8', 'a_targ9', 'info_text_box', 'top_target_lights'],
  OutLaneRolloverControl: ['a_roll4', 'lite17', 'lite18', 'lite195', 'lite196', 'lite29', 'lite30', 'soundwave26'],
  PlungerControl: [
    'fuel_bargraph', 'l_trek_lights', 'lite200', 'lite67', 'middle_circle', 'r_trek_lights',
    'skill_shot_lights', 'top_target_lights', 'v_bloc1', 'v_gate1', 'v_gate2'
  ],
  ReentryLanesRolloverControl: [
    'a_bump1', 'a_roll2', 'a_roll3', 'attack_bumpers', 'bmpr_inc_lights', 'info_text_box',
    'l_trek_lights', 'lite10', 'lite56', 'lite8', 'lite9', 'r_trek_lights'
  ],
  ReturnLaneRolloverControl: ['a_roll6', 'a_roll7', 'lite27', 'lite28', 'lite59'],
  RightFlipperControl: ['bmpr_inc_lights', 'ramp_bmpr_inc_lights'],
  RightHazardSpotTargetControl: [
    'a_targ19', 'a_targ20', 'bpr_solotgt_lights', 'lite107', 'lite108', 'lite109',
    'soundwave14', 'v_gate2'
  ],
  RightKickerControl: ['v_gate2'],
  RightKickerGateControl: ['lite195', 'lite29'],
  SkillShotGate1Control: ['fuel_bargraph', 'lite200', 'lite25', 'lite54', 'lite67', 'skill_shot_lights', 'soundwave14'],
  SkillShotGate2Control: ['lite67', 'lite68', 'soundwave14'],
  SkillShotGate3Control: ['lite67', 'lite69', 'soundwave14'],
  SkillShotGate4Control: ['lite131', 'lite67', 'soundwave14'],
  SkillShotGate5Control: ['lite132', 'lite67', 'soundwave14'],
  SkillShotGate6Control: ['lite133', 'lite67', 'soundwave14'],
  SpaceWarpRolloverControl: ['lite27', 'lite28'],
  WormHoleControl: [
    'bsink_arrow_lights', 'info_text_box', 'lite110', 'lite4', 'v_sink1', 'v_sink2',
    'worm_hole_lights'
  ],
  WormHoleDestinationControl: ['info_text_box', 'lite110'],
};

/**
 * ⚠️ THE CONTROLS THAT REACH NO NAMED COMPONENT AT ALL — nine, not the two I first wrote.
 *
 * Measured rather than assumed, by reading every function body in `control.cpp` and asking which tagged
 * globals it mentions. `BumperControl` and `RebounderControl` pay from the caller's own score array;
 * `JackpotLightControl` and `BonusLightControl` clear a flag on the table; `ShootAgainLightControl`
 * messages only the caller. None of them needs a binding, which is not the same as lacking one — and
 * calling seven of them "not done yet" overstated the remaining work by that much.
 */
export const SELF_CONTAINED_CONTROLS: readonly string[] = [
  'BonusLightControl',
  'BumperControl',
  'BumperGroupControl',
  'EscapeChuteSinkControl',
  'HyperspaceLightGroupControl',
  'JackpotLightControl',
  'MedalLightGroupControl',
  'RebounderControl',
  'ShootAgainLightControl',
];

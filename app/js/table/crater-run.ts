// SPDX-License-Identifier: AGPL-3.0-or-later
// table/crater-run — the precision table.
//
// ========================= THE THIRD SHAPE OF PLAY =========================
// `low-orbit` is open and forgiving: bumpers at the top, targets down one side, plenty of room to
// recover. `ion-storm` is busy and chaotic: a cluster in the middle that every route crosses and
// scatters the ball off. Neither asks the player to AIM.
//
// This one does. Its centre is a bank of five drop targets in a tight row, and the two ramps that
// flank it are narrow enough that a loose shot goes between them into the bumper pair rather than up.
// Missing is cheap here — the ball comes back down the middle, which is the safest place on any of
// these tables — so the table is difficult without being punishing, which is the trade a precision
// table has to make or it is simply unfair.
//
// ⚠️ AND ITS TARGETS ARE A ROW, NOT A SCATTER, ON PURPOSE. Five targets in a line can be cleared with
// one well-aimed ball that rattles along them; five scattered around the table would be five separate
// shots and a mission nobody finishes. The row is what makes the precision rewarding rather than
// merely demanded.
//
// The cabinet is `table/cabinet`'s — see that module for the two defects it exists to stop anybody
// re-making.

import type { AuthoredTable } from './authored.js';
import { cabinet, CABINET_LAMPS } from './cabinet.js';

const WALL = 'structure' as const;
const BALL_RADIUS = 3;

const WIDTH = 183;
const HEIGHT = 260;

/** The name every member of the bank points at, and the table declares once. */
const BANK_NAME = 'bank.crater';

/** The cabinet's own arithmetic, repeated here because this table splits the divider. */
const DIVIDER = WIDTH - 21;
/** The secret passage's mouth, well above the funnel guide's top at y = 193. */
const PASSAGE_TOP = 160;
const PASSAGE_BOTTOM = 176;

/**
 * Five DROP targets in a row across the middle, 20 apart: a rattling ball can take more than one.
 *
 * ⚠️ AND THEY WERE FIVE ORDINARY TARGETS UNTIL NOW, WHICH IS WHAT THE DEV WAS POINTING AT.
 * `pinball.mission.craterRun.bank` has read "derrube o banco de alvos" since the day this table was
 * written, and the five behaved as five unrelated targets: each paid again every time the ball came
 * back, none of them ever went down, and the mission was cleared by rattling the nearest one five
 * times. The word "bank" was in the constant's name, in the mission text and in the comment, and
 * nowhere in the behaviour.
 *
 * A drop target sinks when it is hit — the ball then passes over where it was — and the bank pays and
 * stands them all up when the last one falls. That is the difference between a route and a rattle.
 */
const BANK = [42, 62, 82, 102, 122].map((x, i) => ({
  name: `crater${i + 1}`,
  kind: 'target' as const,
  role: 'key' as const,
  bounds: { x, y: 120, width: 12, height: 14 },
  scores: [2000],
  control: 'TargetBankControl',
  bank: BANK_NAME,
  lamps: [`lamp.crater${i + 1}`],
  /**
   * ⚠️ SLOPED, AND THEY WERE FLAT. Left to right the normal points UP, so each of these is a FLOOR —
   * and five floors side by side across the middle of a table are a LEDGE. Measured: `crater-run` held
   * FIFTY-TWO PER CENT of all ball-time in the one band at y 120-139, so almost nothing below it was
   * ever reached, and `probe.low` beneath them was met by none of sixty balls.
   *
   * ⚠️ AND THE STUCK DETECTOR DOES NOT SAVE IT, which is why this had to be fixed here. It fires on a
   * ball that is STILL; a ball on a flat ledge is ROLLING, along the row, hitting each target in turn.
   * The histogram is identical with the detector running and without it.
   *
   * Four pixels of drop over twelve — about eighteen degrees — so a ball that lands rolls off the
   * right-hand end instead of living there. `docs/2-Architecture/adr/ADR-0006` already records "an
   * up-facing horizontal face is a shelf the ball rests on"; this is the first time the rule has been
   * caught applying to a row of targets rather than to one.
   */
  collision: [{ kind: 'line' as const, from: { x, y: 130 }, to: { x: x + 12, y: 134 } }],
}));

export const CRATER_RUN: AuthoredTable = {
  name: 'crater-run',
  size: { width: WIDTH, height: HEIGHT },
  ballRadius: BALL_RADIUS,

  /**
   * ⚠️ THE PRIZE IS BIGGER THAN THE FIVE TARGETS TOGETHER — 10000 against 5 x 2000 — because clearing
   * a bank is a different achievement from hitting five things. Five separate targets are five lucky
   * bounces; a cleared bank means every one of them was still standing when you found it.
   */
  banks: [
    { name: BANK_NAME, award: 10000 },
    // Half the prize of the five in the middle, for half the work and a shot that is easier to line up.
    { name: 'bank.west', award: 5000 },
    { name: 'bank.east', award: 5000 },
  ],

  missions: [
    // The bank first, because it is the table's whole idea and a player should meet it immediately.
    { award: 15000, stages: [{ id: 'pinball.mission.craterRun.bank', targets: BANK.map((t) => t.name) }] },
    // Then the two ramps, which are the shots the bank teaches you to make.
    { award: 20000, stages: [{ id: 'pinball.mission.craterRun.ramps', targets: ['ramp.left', 'ramp.right'] }] },
    // Then the rim, at the top, reached only by keeping the ball alive up there.
    { award: 30000, stages: [{ id: 'pinball.mission.craterRun.rim', targets: ['rim1', 'rim2'] }] },
  ],

  /**
   * ⚠️ THE RAILS UNDER THE MINE, LIT BY THE PROBES THAT RUN ON THEM. The Dev's theme: "trilhos sob uma
   * mina branca e sombras pretas", and his art has them glowing green.
   *
   * Both are wired to a lamp, which is what makes them a lighting FEATURE and not scenery: the rails
   * are dark until a probe has been struck, so the table lights its own workings by being played.
   */
  lights: [
    { at: { x: 60, y: 158 }, radius: 46, role: 'key', intensity: 0.27, lamp: 'lamp.probeLow' },
    { at: { x: 120, y: 112 }, radius: 46, role: 'key', intensity: 0.29, lamp: 'lamp.probeHigh' },
    // Earth over the rim, cold and always on.
    { at: { x: 150, y: 24 }, radius: 44, role: 'gate', intensity: 0.4 },
  ],

  components: [
    // ⚠️ THE DIVIDER IS THIS TABLE'S OWN, because it has a hole in it. Everything else in the shell
    // is the cabinet's; see the passage below for why this one is not.
    ...cabinet({ width: WIDTH, height: HEIGHT }).filter((c) => c.name !== 'wall.laneDivider'),

    /* ===================== THE SECRET PASSAGE =====================
     *
     * ⚠️ THE DEV, IN TWO SENTENCES: "um ou dois cenários contendo passagens secretas que se abrem caso
     * na primeira tacada a bola desça", and "mesas que tenham passagem secreta, que permitam que a
     * bola saia pela lateral baixa ao invés de sair pelo topo."
     *
     * The plunger lane delivers the ball over the whole playfield to the top and that is the only way
     * in. This is a second mouth, sixteen pixels of it, two-thirds of the way down the divider — a
     * ball with sideways speed in the lane leaves into the play ABOVE the funnel, which is thirty
     * pixels of table rather than the two hundred and sixty the long way round.
     *
     * ⚠️ AND IT IS SIXTY PIXELS ABOVE THE GUIDE'S TOP ON PURPOSE. Lower than y = 193 the far side of
     * the divider is the right OUTLANE channel, so a passage there would not be a way into the play,
     * it would be a way into the gutter — a secret that costs the ball is a punishment dressed as a
     * reward.
     *
     * The divider is split into three because of it: the wall above, the wall below, and the door
     * between them. Each keeps BOTH faces — the fix that made this possible at all.
     */
    { name: 'wall.laneDivider', kind: 'wall', role: WALL,
      bounds: { x: DIVIDER, y: 34, width: 4, height: PASSAGE_TOP - 34 },
      collision: [
        { kind: 'line', from: { x: DIVIDER, y: PASSAGE_TOP }, to: { x: DIVIDER, y: 34 } },
        { kind: 'line', from: { x: DIVIDER + 4, y: 34 }, to: { x: DIVIDER + 4, y: PASSAGE_TOP } },
      ] },
    { name: 'wall.laneDividerLow', kind: 'wall', role: WALL,
      bounds: { x: DIVIDER, y: PASSAGE_BOTTOM, width: 4, height: HEIGHT - PASSAGE_BOTTOM },
      collision: [
        { kind: 'line', from: { x: DIVIDER, y: HEIGHT }, to: { x: DIVIDER, y: PASSAGE_BOTTOM } },
        { kind: 'line', from: { x: DIVIDER + 4, y: PASSAGE_BOTTOM }, to: { x: DIVIDER + 4, y: HEIGHT } },
      ] },
    { name: 'passage.crater', kind: 'blocker', role: 'gate',
      bounds: { x: DIVIDER, y: PASSAGE_TOP, width: 4, height: PASSAGE_BOTTOM - PASSAGE_TOP },
      // One lost ball, which is his "na primeira tacada a bola desça" exactly.
      secret: { afterLostBalls: 1 },
      collision: [
        { kind: 'line', from: { x: DIVIDER, y: PASSAGE_BOTTOM }, to: { x: DIVIDER, y: PASSAGE_TOP } },
        { kind: 'line', from: { x: DIVIDER + 4, y: PASSAGE_TOP }, to: { x: DIVIDER + 4, y: PASSAGE_BOTTOM } },
      ] },

    /* ===================== THE BANK: FIVE IN A ROW ===================== */
    ...BANK,

    /* ===================== THE TWO RAMPS THAT FLANK IT ===================== */
    // ⚠️ NARROW, AND THAT IS THE DIFFICULTY. A loose shot passes between them and meets the bumper
    // pair below the rim instead of climbing — which costs the shot and not the ball.
    { name: 'ramp.left', kind: 'ramp', role: 'climb', bounds: { x: 26, y: 52, width: 34, height: 52 },
      scores: [7000], control: 'RampControl', lamps: ['lamp.rampLeft'],
      collision: [{ kind: 'line', from: { x: 26, y: 104 }, to: { x: 60, y: 52 } }] },
    { name: 'ramp.right', kind: 'ramp', role: 'climb', bounds: { x: 106, y: 52, width: 34, height: 52 },
      scores: [7000], control: 'RampControl', lamps: ['lamp.rampRight'],
      collision: [{ kind: 'line', from: { x: 140, y: 104 }, to: { x: 106, y: 52 } }] },

    /* ===================== THE PAIR THAT PUNISHES A LOOSE SHOT ===================== */
    // Between the ramps, so the ball that failed to climb comes back through them.
    { name: 'rubble1', kind: 'bumper', role: WALL, bounds: { x: 74, y: 62, width: 16, height: 16 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl', lamps: ['lamp.rubble1'],
      collision: [{ kind: 'circle', at: { x: 82, y: 70 }, radius: 8 }] },
    { name: 'rubble2', kind: 'bumper', role: WALL, bounds: { x: 92, y: 84, width: 16, height: 16 },
      scores: [500, 1000, 1500, 2000], control: 'BumperControl', lamps: ['lamp.rubble2'],
      collision: [{ kind: 'circle', at: { x: 100, y: 92 }, radius: 8 }] },

    /* ===================== THE SCREE: FILLING THE FALL ===================== */
    // ⚠️ ADDED AFTER LOOKING AT THE PICTURE, not after a test failed. The table passed every gate with
    // fifty pixels of nothing between the bank and the funnel — a fall with no decision in it, which
    // is the difference between a table that is difficult and one that is merely tall. `low-orbit` has
    // furniture in the same band and that is why it reads as a table rather than as a corridor.
    //
    // On the flanks rather than the middle, so they reward a ball the player has KEPT to one side.
    { name: 'scree.left', kind: 'lane', role: 'key', bounds: { x: 26, y: 156, width: 12, height: 16 },
      scores: [2500], control: 'LaneControl', lamps: ['lamp.screeLeft'] },
    { name: 'scree.right', kind: 'lane', role: 'key', bounds: { x: 126, y: 156, width: 12, height: 16 },
      scores: [2500], control: 'LaneControl', lamps: ['lamp.screeRight'] },

    /* ===================== THE TWO SHELVES, ONE ON EACH FLANK ===================== */
    //
    // ⚠️ TWO MORE BANKS, AND THEY ARE PAIRS RATHER THAN ROWS ON PURPOSE. The five in the middle are
    // this table's whole idea — a line the ball can rattle along — so repeating that shape on the
    // flanks would be the same shot three times. A PAIR is a different demand: two targets stacked
    // against a wall, reached only by a ball the player has kept to one side, and a bank of two is
    // cleared or it is not.
    //
    // Added while authoring this table up to the 1995 playfield's density — see `tests/table-density`,
    // where the Dev's "mesas tão simples" is a number. It measured 3.36 against the archive's 5.25.
    //
    // Windings: the west pair faces RIGHT and the east pair faces LEFT, each toward the middle where
    // the ball is. `(dy, -dx)`, so a face running downward points +x and one running upward points -x.
    { name: 'shelf.west1', kind: 'target', role: 'key', bounds: { x: 14, y: 112, width: 12, height: 12 },
      scores: [2000], control: 'TargetBankControl', bank: 'bank.west', lamps: ['lamp.shelfWest1'],
      collision: [{ kind: 'line', from: { x: 26, y: 112 }, to: { x: 26, y: 124 } }] },
    /**
     * ⚠️ THE LEAD-IN ABOVE THE LEFT OUTLANE, AND THIS TABLE NEEDED IT THE DAY THE BALL LEARNT TO ROLL.
     *
     * `physics/collision` charges friction against the impact now, so a ball slides along a wall instead
     * of being stopped by it. Traced on the full launch: it came off `shelf.west2` at (34,143) and ran
     * down the left wall — (22,157), (16,175), (10,201) — into the top of the outlane, and was lost at
     * x = 12, THIRTY UNITS wide of the left pivot. A run flapping the flippers came out identical to a
     * quiet one, which is `tests/table-playable`'s definition of a table the player watches rather than
     * plays.
     *
     * ⚠️ AND IT IS SHORT ON PURPOSE, ENDING AT y = 186. Seven units above the outlane's mouth, so a
     * ball hugging the wall is turned back into the funnel and a ball arriving from the middle still has
     * the channel below it to fall into. Sealing the top was tried in `table/cabinet` for every table at
     * once and cost eight gates: an outlane nothing can reach is the defect that ledger already records
     * twelve of.
     *
     * ⚠️ AND IT STARTED FOURTEEN UNITS HIGHER, WHICH `tests/table-secret` CAUGHT. At y = 160 it turned
     * enough of the population away from the passage that crossings fell from sixteen of sixty to
     * FOURTEEN, under that gate's bar of fifteen. The lower line catches the ball this was written for
     * and leaves the rest of the table's traffic alone — measured, not reasoned.
     */
    { name: 'lead.west', kind: 'wall', role: WALL, bounds: { x: 4, y: 172, width: 14, height: 14 },
      collision: [{ kind: 'line', from: { x: 4, y: 172 }, to: { x: 18, y: 186 } }] },

    { name: 'shelf.west2', kind: 'target', role: 'key', bounds: { x: 14, y: 130, width: 12, height: 12 },
      scores: [2000], control: 'TargetBankControl', bank: 'bank.west', lamps: ['lamp.shelfWest2'],
      collision: [{ kind: 'line', from: { x: 26, y: 130 }, to: { x: 26, y: 142 } }] },
    { name: 'shelf.east1', kind: 'target', role: 'key', bounds: { x: 145, y: 112, width: 12, height: 12 },
      scores: [2000], control: 'TargetBankControl', bank: 'bank.east', lamps: ['lamp.shelfEast1'],
      collision: [{ kind: 'line', from: { x: 145, y: 124 }, to: { x: 145, y: 112 } }] },
    { name: 'shelf.east2', kind: 'target', role: 'key', bounds: { x: 145, y: 130, width: 12, height: 12 },
      scores: [2000], control: 'TargetBankControl', bank: 'bank.east', lamps: ['lamp.shelfEast2'],
      collision: [{ kind: 'line', from: { x: 145, y: 142 }, to: { x: 145, y: 130 } }] },

    /* ===================== THE REENTRY ROW ===================== */
    //
    // Three rollovers between the two rim lanes, across the head of the table: the ball entering from
    // the return bend crosses them on its way in, so the first thing every launch does is score
    // something. `low-orbit` has had this since it was written and this table did not.
    { name: 'crest1', kind: 'lane', role: 'free', bounds: { x: 58, y: 16, width: 12, height: 14 },
      scores: [1200], control: 'LaneControl', lamps: ['lamp.crest1'] },
    { name: 'crest2', kind: 'lane', role: 'free', bounds: { x: 76, y: 16, width: 12, height: 14 },
      scores: [1200], control: 'LaneControl', lamps: ['lamp.crest2'] },
    { name: 'crest3', kind: 'lane', role: 'free', bounds: { x: 94, y: 16, width: 12, height: 14 },
      scores: [1200], control: 'LaneControl', lamps: ['lamp.crest3'] },

    /* ===================== THE PROBES, ON THEIR CONVEYORS ===================== */
    //
    // ⚠️ THE DEV'S THEME FOR THIS TABLE: "sondas andando em esteiras que interagem com a bolinha." A
    // conveyor is a straight run, which is what a `mover` is — so a probe is a rebounder with a path,
    // and no new kind was needed for it.
    //
    // Two of them, at the two heights this table had nothing at: one under the crater bank where a
    // ball that cleared the row comes down, and one low across the approach to the funnel. Both run
    // HORIZONTALLY, because a conveyor does, and because a body crossing the ball's fall is met more
    // often than one travelling with it.
    //
    // ⚠️ AND THEY ARE CLEAR OF EVERYTHING. The upper one spans y 105 to 115 against a bank at 120 and
    // ramps ending at 104; the lower one sits above the funnel's own top at 193. A mover declares no
    // collision — its body is its disc — so the validator cannot check overlap for it the way it can
    // for a shape, and the arithmetic is written here instead.
    { name: 'probe.high', kind: 'rebounder', role: 'goal',
      bounds: { x: 35, y: 105, width: 102, height: 10 },
      scores: [3500], control: 'RebounderControl', lamps: ['lamp.probeHigh'],
      mover: { from: { x: 40, y: 110 }, to: { x: 132, y: 110 }, seconds: 2.8, radius: 5 } },
    { name: 'probe.low', kind: 'rebounder', role: 'goal',
      bounds: { x: 34, y: 144, width: 62, height: 30 },
      scores: [3500], control: 'RebounderControl', lamps: ['lamp.probeLow'],
      // ⚠️ SHORTER AND QUICKER THAN ITS FIRST PATH, which was 96 pixels in 2.2 seconds and met nothing
      // in sixty balls. A long slow body is somewhere the ball is not, almost always.
      //
      // ⚠️ AND A THIRD PATH, WHEN THE PLUNGER LANE GAINED ITS CURVE. The launch now sweeps across the
      // top of the table instead of coming straight back down, and sixty balls stopped meeting this
      // probe where they used to. Ball-time in twenty-pixel cells put the traffic further LEFT than it
      // was: the band y 180-199 reads 0.8% at x 20-39 and 0.8% at 40-59 against 0.5% where the old
      // path sat.
      //
      // ⚠️ BUT MOVING IT WAS NOT ENOUGH, AND WHAT FIXED IT IS A RULE NOTHING HERE HAD WRITTEN DOWN:
      // THE SAME PATH IN THE SAME PLACE IS MET OR NOT DEPENDING ON HOW FAST IT IS RUN. Forty pixels at
      // y 182 failed at 1.4 seconds and passed at 0.6. A shuttle occupies the same FRACTION of its own
      // path whatever its speed — that is geometry — but a faster one makes more independent passes,
      // and the ball's visits to any square of a table are brief and uncorrelated. Slow is not "the
      // same chance, later"; it is fewer chances.
      //
      // ⚠️ AND A FOURTH PATH, WHEN THE CRATER LEDGE WAS FIXED. Sloping those five faces released half
      // the table's ball-time back into the rest of it, which moved the traffic everywhere at once —
      // this probe was reached again WITHOUT being touched, and then lost again when the secret
      // passage opened a second way into the play. Four candidates were run against reachability, the
      // flipper's force and playability together; this diagonal through the middle band passed all
      // three, as did two others, and it is the one that stays inside the region the probe's own
      // mission text describes.
      mover: { from: { x: 40, y: 150 }, to: { x: 90, y: 168 }, seconds: 0.7, radius: 5 } },

    /* ===================== THE RIM ===================== */
    { name: 'rim1', kind: 'lane', role: 'goal', bounds: { x: 40, y: 16, width: 12, height: 14 },
      scores: [4000], control: 'LaneControl', lamps: ['lamp.rim1'] },
    { name: 'rim2', kind: 'lane', role: 'goal', bounds: { x: 108, y: 16, width: 12, height: 14 },
      scores: [4000], control: 'LaneControl', lamps: ['lamp.rim2'] },
  ],

  lamps: [
    ...CABINET_LAMPS,
    ...BANK.flatMap((t) => t.lamps),
    'lamp.rampLeft', 'lamp.rampRight', 'lamp.screeLeft', 'lamp.screeRight', 'lamp.rubble1', 'lamp.rubble2', 'lamp.rim1', 'lamp.rim2',
    'lamp.shelfWest1', 'lamp.shelfWest2', 'lamp.shelfEast1', 'lamp.shelfEast2',
    'lamp.crest1', 'lamp.crest2', 'lamp.crest3',
    'lamp.probeHigh', 'lamp.probeLow',
  ],
};

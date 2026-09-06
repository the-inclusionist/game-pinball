// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createDemo, hintFor, DEMO_BALLS } from '../app/js/shell/demo.js';
import { SCORE_COMPONENTS } from '../app/js/control/score-table.js';
import { findSoundGroups } from '../app/js/audio/sound-table.js';
import { readGroups } from '../app/js/dat/partman.js';
import { VOICES, SILENT_KINDS, soundForKind } from '../app/js/audio/voices.js';
import { kindOf, COMPONENT_KINDS } from '../app/js/i18n/names.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * ⚠️ A SEEDED SOURCE, BECAUSE THE TABLE'S GRAVITY CARRIES A JITTER. `TTableLayer::FieldEffect` puts a
 * random term on X, so two balls never take the same path — right for a player, wrong for a test that
 * asks whether the ball reached a bumper in nine hundred frames. Left to `Math.random` those tests ask
 * about a DIFFERENT path every run and fail when the dice say so; one did, once, and could not be
 * reproduced in seven runs afterwards.
 *
 * Mulberry32, small enough to read and stable across platforms.
 */
function seeded(seed = 0x9e3779b9): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * How many pixels of the frame the BALL is responsible for, found by moving it.
 *
 * ⚠️ THE BALL IS THE ARCHIVE'S OWN SPRITE AND NOT A COLOUR THIS FILE PICKED, so it cannot be looked
 * for by value any more. Two renders that differ only in where the ball is differ only in the ball —
 * every lamp, and the whole playfield, are identical in both.
 */
function ballPixels(
  demo: ReturnType<typeof createDemo>,
  at?: { x: number; y: number },
  z?: number,
): number {
  const position = demo.ball.position as { x: number; y: number; z?: number };
  if (at) { position.x = at.x; position.y = at.y; }
  if (z !== undefined) position.z = z;
  const here = [...demo.render().pixels];

  const keep = { x: position.x, y: position.y };
  // The far top-left corner of the table, where the ball is off the picture entirely.
  position.x = -100;
  position.y = -100;
  const without = [...demo.render().pixels];
  position.x = keep.x;
  position.y = keep.y;

  return here.filter((pixel, i) => pixel !== without[i]).length;
}

/** The distinct colours the ball is responsible for, found the same way. */
function ballColours(demo: ReturnType<typeof createDemo>): Set<number> {
  const position = demo.ball.position as { x: number; y: number };
  const here = [...demo.render().pixels];
  const keep = { x: position.x, y: position.y };
  position.x = -100;
  position.y = -100;
  const without = [...demo.render().pixels];
  position.x = keep.x;
  position.y = keep.y;

  const colours = new Set<number>();
  here.forEach((pixel, i) => { if (pixel !== without[i]) colours.add(pixel); });
  return colours;
}

/** How many PIXEL ROWS the ball covers, found the same way as `ballPixels`. */
function ballRows(demo: ReturnType<typeof createDemo>, at: { x: number; y: number }): number {
  const position = demo.ball.position;
  position.x = at.x;
  position.y = at.y;
  const here = [...demo.render().pixels];
  position.x = -100;
  position.y = -100;
  const without = [...demo.render().pixels];
  position.x = at.x;
  position.y = at.y;

  const width = demo.playfield.width;
  const rows = new Set<number>();
  here.forEach((pixel, i) => { if (pixel !== without[i]) rows.add(Math.floor(i / width)); });
  return rows.size;
}

const DAT = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.DAT';
const archive = (): ArrayBuffer | null => {
  if (!existsSync(DAT)) return null;
  const buf = readFileSync(DAT);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
};

/**
 * ⚠️ THE WHOLE DEMONSTRATION, END TO END, FROM THE BYTES A PLAYER SUPPLIES.
 *
 * Everything below is composed of pieces already tested on their own. What these add is that they FIT:
 * the parser's groups become walls, the walls hold the ball the field pulls, and the projection puts
 * that ball on a pixel inside the picture the palette decoded. Each of those is a join, and a join is
 * where a port breaks.
 */
describe('the 1995 table, from an ArrayBuffer', () => {
  test('it builds from the bytes alone', () => {
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(bytes, { random: seeded() });

    // ⚠️ 183x235, WHICH IS THE ARCHIVE'S 365x470 HALVED. Decision 5 of the plan: the playfield is
    // drawn at half size, which is what leaves room for the HUD beside it on a 320x180 screen. The
    // halving lives in the PROJECTION and in the two bitmaps; not one line of physics knows about it,
    // and the table keeps its own float units throughout. Rounding is UP — 365/2 is 182.5, and 182
    // would cut a strip off the right of the table.
    expect([demo.playfield.width, demo.playfield.height]).toEqual([183, 235]);
    // ⚠️ ONE HUNDRED AND FOURTEEN, AND IT WAS A HUNDRED AND FORTY-THREE. Twenty-nine groups build
    // their own geometry and none of them wants the plain wall this count is of:
    //
    //   · the NINE one-ways — two lines on the same two points, wound opposite ways, so that the ball
    //     can cross from one side only. The plain wall put a solid line across every gate.
    //   · the EIGHTEEN lanes — one polygon wound both ways, the second half live only while the ball
    //     is on the lane. The plain wall made every lane something the ball bounced off.
    //   · the TWO flags, which are spinners: one segment wound both ways, and the ball goes through.
    //     The plain wall made `a_flag1` a shelf the ball came to rest on and never left.
    expect(demo.table.wallCount).toBe(114);
  });

  test('⚠️ the ball lands INSIDE the picture, which is what ties the physics to the pixels', () => {
    // The projection and the collision geometry are read from different records and used by different
    // modules. If either were wrong the ball would collide correctly against walls drawn somewhere else,
    // and the demonstration would look like a ghost passing through furniture.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(bytes, { random: seeded() });
    const at = demo.ballOnScreen();

    expect(at.x).toBeGreaterThan(0);
    expect(at.x).toBeLessThan(demo.playfield.width);
    expect(at.y).toBeGreaterThan(0);
    expect(at.y).toBeLessThan(demo.playfield.height);
  });

  test('and it stays inside while it falls', () => {
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(bytes, { random: seeded() });
    for (let i = 0; i < 600; i++) {
      demo.step(1);
      const at = demo.ballOnScreen();
      expect(at.x, `frame ${i}`).toBeGreaterThan(-40);
      expect(at.x, `frame ${i}`).toBeLessThan(demo.playfield.width + 40);
    }
  });

  test('⚠️ and it TOUCHES the table’s own walls, by their group names', () => {
    // The join that matters most: a ball that never hits anything proves the grid is empty rather than
    // that the walls are right.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(bytes, { random: seeded() });
    demo.step(600);

    expect(demo.touched.length).toBeGreaterThan(0);
  });

  test('the rendered frame carries the ball, and the playfield is not modified', () => {
    // The picture is a still and the ball is the only thing that moves, so the frame is a COPY. Drawing
    // into the playfield itself would leave a trail of every position the ball has ever had.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(bytes, { random: seeded() });
    const before = demo.playfield.pixels.slice();

    // ⚠️ THE BALL IS THE ARCHIVE'S OWN NINE-PIXEL SPRITE NOW, not a colour this file chose, so it is
    // found by MOVING it: whatever changes between two renders that differ only in the ball's position
    // is the ball. Every lamp is identical in both.
    const moved = ballPixels(demo);

    expect(moved, 'the ball is somewhere in the picture').toBeGreaterThan(0);
    expect([...demo.playfield.pixels]).toEqual([...before]);

    // ⚠️ AND IT IS SHADED, which is how a sprite is told from the flat disc this used to draw. The
    // archive's ball is nine pixels across with a highlight on it; one colour would mean the fallback
    // ran, and the fallback is only for an archive that has no picture at all.
    expect(ballColours(demo).size, 'more than one colour').toBeGreaterThan(1);
  });

  test('⚠️ and it SCORES, from the 1995 table’s own arrays', () => {
    // The join the tag made possible. Until `score-table` carried the archive's name for each
    // component, this map was empty for eighty of its eighty-nine rows and the demonstration could say
    // what the ball had hit while paying nothing for any of it.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(bytes, { random: seeded() });
    demo.step(900);

    expect(demo.scored.length).toBeGreaterThan(0);
    expect(demo.score.curScore).toBeGreaterThan(0);
  });

  test('and what it scores on is a component the control layer knows by name', () => {
    // Not the archive's name. `a_bump1` is what the file calls it; `bump1` is what `control::` calls it,
    // and the score arrays are indexed by the second.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(bytes, { random: seeded() });
    demo.step(900);

    for (const name of demo.scored) {
      expect(SCORE_COMPONENTS.some((row) => row.name === name), name).toBe(true);
    }
  });

  test('⚠️ the table’s own bumpers answer the ball, not a generic wall', () => {
    // Before this, every wall in the table bounced the same way — 0.7 elastic, no boost, no threshold —
    // so a bumper neither kicked nor debounced nor lit, and no test could tell because a bounce is a
    // bounce. A bumper that LIGHTS has answered as a bumper.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(bytes, { random: seeded() });
    expect(demo.components.bumpers.size).toBe(7);

    demo.step(900);

    // The ball reaches at least one of them in a ball's life on this table.
    expect(demo.touched.some((name) => demo.components.bumpers.has(name))).toBe(true);
  });

  test('dropping again puts a fresh ball back and forgets what the last one touched', () => {
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(bytes, { random: seeded() });
    demo.step(600);
    demo.drop();

    expect(demo.touched).toEqual([]);
    expect(demo.scored).toEqual([]);
  });
});

describe('⚠️ and the seventy wired components run their 1995 control function', () => {
  test('the demo says which they are', () => {
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(bytes, { random: seeded() });

    // Sixty-three until the feed was wired. Two of the five new ones are not collisions at all:
    // `plunger` runs `PlungerControl` when a ball is put back into play, and `v_bloc1` runs
    // `DrainBallBlockerControl` when the barrier's own deadline runs out. The other three are the
    // wormhole's holes.
    expect(demo.wired.size).toBe(70);
    // ⚠️ AND `lite17` IS HERE WITHOUT A COLLISION BEHIND IT. `ExtraBallLightControl` answers
    // `TLightResetAndTurnOn` and no hit at all; it was written and left unwired because nothing
    // produced that message. The hyperspace ladder's fourth rung does, and so does its climax.
    expect(demo.wired.has('a_kout2'), 'the hyperspace hole').toBe(true);
    expect(demo.wired.has('lite17'), 'the extra-ball pair').toBe(true);
    expect(demo.wired.has('plunger')).toBe(true);
    expect(demo.wired.has('v_bloc1')).toBe(true);
    for (const name of ['v_sink1', 'v_sink2', 'v_sink3']) {
      expect(demo.wired.has(name), name).toBe(true);
    }
    // ⚠️ AND THE ESCAPE CHUTE IS NOT AMONG THEM. It runs no control this build has, and a hole with no
    // control keeps the ball for the rest of the game.
    expect(demo.wired.has('v_sink7'), 'the escape chute').toBe(false);
  });

  test('⚠️ and no wired component is ALSO paid flat, over a whole ball', () => {
    // The two paths are exclusive on purpose. A component the dispatcher handles scores inside its own
    // control function, so paying it here as well would double every lane crossing — and doubling looks
    // like generous scoring rather than a bug.
    //
    // ⚠️ MY FIRST VERSION OF THIS TEST ASSERTED THINGS THAT WERE ALREADY TRUE and distinguished nothing.
    // The invariant needed to be visible, so the demo reports what it paid flat and this compares the
    // two lists over a real ball rather than trusting an early return nobody can observe.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(bytes, { random: seeded() });
    demo.step(1800);

    expect(demo.paidFlat.filter((name) => demo.wired.has(name))).toEqual([]);
  });
});

describe('⚠️ and the demonstration can be HEARD, which it could not be at all', () => {
  test('a ball crossing the table makes sounds, and every one is a real voice', () => {
    // `playSound` was `() => {}`. Three wired controls ask for a noise — the out lanes for a miss, the
    // bonus lane for a collect, an extra ball for its own fanfare — and every one of them went into
    // that empty function. So did every ordinary collision, which the original sounds from each
    // component's own data.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const heard: string[] = [];
    const demo = createDemo(bytes, { onSound: (name) => heard.push(name), random: seeded() });
    demo.step(900);

    expect(heard.length).toBeGreaterThan(0);
    for (const name of heard) expect(VOICES[name], name).toBeDefined();
  });

  test('⚠️ and the table’s ANONYMOUS geometry makes none, which is most of what is touched', () => {
    // The archive names its components and does NOT name its walls: the ball spends a ball's life
    // colliding with `group-1`, and a resting ball hits the same one many times a second. So the bulk
    // of the collisions carry no kind at all and are silent for that reason — the `wall` entry in the
    // prefix table serves the authored table, not this one. Playing a sound per COLLISION rather than
    // per kind would turn every rest into a rattle.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const heard: string[] = [];
    const demo = createDemo(bytes, { onSound: (name) => heard.push(name), random: seeded() });
    demo.step(900);

    const audible = demo.touched.filter((name) => {
      const kind = kindOf(name);
      return kind !== null && !SILENT_KINDS.includes(kind);
    });

    // The unnamed geometry IS reached — the run would prove nothing otherwise. How much of it depends
    // on the run: the table's gravity carries an X jitter, so two balls never take the same path.
    expect(demo.touched.some((name) => kindOf(name) === null)).toBe(true);

    // ⚠️ COUNTING ONLY THE KIND VOICES. A wired control can add one of its own on the same collision —
    // an out lane's miss, the bonus lane's collect — and an exact count over EVERY sound would then
    // fail on the runs where the ball happens to reach one. Which runs those are is decided by the
    // gravity jitter, so the test would have been flaky in a way that looks like a real bug.
    // ⚠️ `drain` IS PLAYED BY BOTH STREAMS AND IS EXCLUDED FROM BOTH SIDES. It is the voice of the
    // drain COMPONENT and the sound `BallDrainControl` asks for by name when a ball is lost, so once
    // the drain was wired a lost ball added a sound with no touch behind it and this count went one
    // over. Every other kind voice belongs to exactly one stream.
    const kindVoices = new Set(
      COMPONENT_KINDS.map((kind) => soundForKind(kind))
        .filter((name): name is string => Boolean(name) && name !== 'drain'),
    );
    const audibleNotDrained = audible.filter((name) => kindOf(name) !== 'drain');
    expect(heard.filter((name) => kindVoices.has(name))).toHaveLength(audibleNotDrained.length);
  });
});

describe('⚠️ and a control that names its own sound reaches the same output', () => {
  test('`playSound` is routed to `onSound`, not swallowed', () => {
    // ⚠️ READ FROM THE SOURCE, BECAUSE THE BALL DECIDES WHETHER THIS RUNS. Only three of the eighteen
    // wired controls name a sound — the two out lanes and the bonus lane — and whether a ball reaches
    // one in nine hundred frames is up to the gravity jitter. A behavioural test would pass for the
    // wrong reason most runs and fail for the right one occasionally.
    //
    // The regression this forbids is exact and was the state of the file until now: `playSound: () =>
    // {}`, an empty function that made three controls silent without anything to notice.
    const source = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../app/js/shell/demo.ts'), 'utf8',
    );

    expect(source).toMatch(/playSound:\s*\(name\)\s*=>\s*o\.onSound\?\.\(name\)/);
  });
});


describe('⚠️ and a hole that cannot let go is never given the ball', () => {
  test('the demonstration installs only the kickouts whose control is bound', () => {
    // ⚠️ READ FROM THE SOURCE, and the reason is the same one that made the sound gate a source gate:
    // the ball has to FIND the hole for the difference to show, and which hole a ball finds in nine
    // hundred frames is up to the gravity jitter. A mutation handing every kickout to `componentFor`
    // passed four runs of a behavioural test before this replaced it.
    //
    // The regression it forbids is exact: a kickout does not release itself, so an unbound hole keeps
    // the ball for the rest of the game — no drain, no score, no stuck-ball, the ball simply stops
    // existing.
    const source = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../app/js/shell/demo.ts'), 'utf8',
    );

    expect(source).toMatch(/kickouts\.get\(name\)\?\.control \? kickouts\.get\(name\) : undefined/);
  });
});

describe('⚠️ and the player can work the 1995 flippers', () => {
  test('the demonstration builds both, and one side moves on its own', () => {
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(bytes, { random: seeded() });
    demo.setFlippers('left', true);
    demo.step(1);

    const moving = demo.table.flippers.filter((flipper) => flipper.motion !== 'still');
    expect(demo.table.flippers).toHaveLength(2);
    expect(moving, 'the other side is untouched').toHaveLength(1);
  });

  test('⚠️ and a flipper SWINGS, which is the half the grid cannot answer', () => {
    // The grid answers "the ball moved into the flipper"; the sweep answers "the flipper moved into
    // the ball". A flipper missing from the context passes straight through a resting ball — the one
    // thing a player does, doing nothing.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(bytes, { random: seeded() });
    const before = demo.table.flippers[0]!.currentAngle;
    demo.setFlippers('left', true);
    demo.step(3);

    expect(demo.table.flippers[0]!.currentAngle).not.toBeCloseTo(before);
  });
});

describe('⚠️ and a ball can be lost, which the demonstration counts', () => {
  test('it starts with three and the count is what the HUD reads', () => {
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(bytes, { random: seeded() });

    expect(demo.ballsLeft).toBe(DEMO_BALLS);
    expect(demo.gameOver).toBe(false);
  });

  test('⚠️ every part of the table reports the sound the ARCHIVE gives it, by index', () => {
    // Twelve builders have taken a sound player since they were written and the demonstration handed
    // one to none of them, so every archive-indexed noise on this table was silent: the gates, the
    // holes, the lanes, the trip lines, the flags, the ramps, the one-ways, the targets, the barrier
    // and the plunger. What could be heard was the ROLE voices this port synthesises, chosen by the
    // kind of a component's name — which is a different thing and covers a different set.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);
    const heard: number[] = [];
    const demo = createDemo(bytes, { random: seeded(6), onSoundId: (id) => heard.push(id) });
    demo.plunge(true);
    demo.step(45);
    demo.plunge(false);
    demo.step(1800);

    expect(heard.length, 'something was heard').toBeGreaterThan(0);
    // ⚠️ AND ZERO IS NEVER ONE OF THEM. `play_sound` rejects anything at or below zero, and the first
    // group the archive marks as a sound is a sentinel that is not a file at all.
    for (const id of heard) expect(id).toBeGreaterThan(0);
  });

  test('⚠️ and EVERY builder that can make a noise is given the player', () => {
    // An inventory rather than a run: a seeded minute crosses some of the table and not all of it, so
    // a builder left silent is invisible to any test that waits for the ball to reach it. This reads
    // the wiring instead — the same shape as the scan that found two sound roles nothing was asking
    // for. Twelve builders take a sound player, and for months the demonstration passed none.
    const source = readFileSync(resolve(dirname(DAT), '../app/js/shell/demo.ts'), 'utf8');
    const builders = [
      'buildOriginalGates', 'buildOriginalFlags', 'buildOriginalRollovers', 'buildOriginalRamps',
      'buildOriginalSinks', 'buildOriginalOneways', 'buildOriginalBlockers', 'buildOriginalKickouts',
      'buildOriginalPopupTargets', 'buildOriginalSoloTargets', 'buildOriginalTripwires',
    ];

    for (const builder of builders) {
      const at = source.indexOf(`${builder}(manifest`);
      expect(at, `${builder} is called`).toBeGreaterThan(0);
      const call = source.slice(at, at + 400);
      expect(call.includes('sound: archiveSound'), `${builder} is given the sound player`).toBe(true);
    }
  });

  test('⚠️ and every index it reports names a GROUP the archive marks as a sound', () => {
    // ⚠️ IT IS A GROUP INDEX, NOT A POSITION IN THE LIST OF SOUNDS. The record a component carries is
    // `[1100, G]` where G is the index of a group in the `.DAT`, and that group's String field is the
    // WAV's file name. Reading it as a position among the forty-eight declared sounds is off by
    // everything: this table asks for group 56, and there is no forty-eighth sound to be had.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);
    const heard = new Set<number>();
    const demo = createDemo(bytes, { random: seeded(6), onSoundId: (id) => heard.add(id) });
    demo.plunge(true);
    demo.step(45);
    demo.plunge(false);
    demo.step(1800);

    const sounds = findSoundGroups(readGroups(new Uint8Array(bytes)));
    const byGroup = new Map(sounds.map((sound) => [sound.groupIndex, sound.fileName]));

    expect(heard.size, 'several different noises').toBeGreaterThan(1);
    for (const id of heard) {
      expect(byGroup.has(id), `sound group ${id}`).toBe(true);
      expect(byGroup.get(id), `sound group ${id} names a file`).toMatch(/\.wav$/i);
    }
  });

  test('⚠️ AND IT DOES NOT PARK IN THE MIDDLE OF THE TABLE', () => {
    // Reported by the player as "the ball gets caught at some points", and it was: the gravity well
    // sits at (0, 6) with a reach of three and a half units — the middle of the playfield — and its
    // field pulled even while the well was dormant. Every ball that crossed the centre was dragged in
    // and left drifting at a fifth of a unit a second, for the rest of the game. No error, no
    // collision, no drain.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);
    const demo = createDemo(bytes, { random: seeded(2) });
    demo.plunge(true);
    demo.step(45);
    demo.plunge(false);

    let slowSeconds = 0;
    for (let second = 0; second < 30; second++) {
      const before = { x: demo.ball.position.x, y: demo.ball.position.y };
      demo.step(60);
      const moved = Math.hypot(demo.ball.position.x - before.x, demo.ball.position.y - before.y);
      if (moved < 0.3) slowSeconds++;
    }

    expect(slowSeconds, 'seconds spent going nowhere').toBeLessThan(10);
  });

  test('⚠️ and a ball left alone does not rattle at the bottom for ever', () => {
    // ⚠️ THE LOSS ITSELF IS TESTED ON THE DISPATCHER, not here: driving a ball into the drain from the
    // plunger is not something a seed can be trusted to do, and a test that stepped four thousand
    // frames and hoped would be asking about one journey again.
    //
    // What IS testable here is the thing that makes the loss reachable at all. Before the stuck watch
    // was wired the ball came to rest near the bottom and hit the same surface seven times a frame,
    // for ever — twenty thousand collisions in six hundred frames, a game that could never end.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(bytes, { random: seeded() });
    demo.step(1200);
    const before = demo.touched.length;

    demo.step(600);

    // A ball in play touches things; a ball rattling in a corner touches thousands.
    expect(demo.touched.length - before).toBeLessThan(600);
  });

  test('⚠️ and feeding a ball does not leave the old one on the table', () => {
    // `addBall` revives an inactive ball before it makes a new one, so the pool is the high-water mark
    // of balls in play. A demonstration that abandoned its ball without deactivating it would grow the
    // pool by one every feed, and every abandoned ball would go on being moved — rattling in whatever
    // corner it was left in, touching things, for the rest of the game.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);
    const demo = createDemo(bytes, { random: seeded() });

    demo.drop();
    demo.drop();
    demo.drop();

    expect(demo.table.balls.length).toBe(1);
    expect(demo.table.balls.filter((b) => b.active).length).toBe(1);
  });

  test('⚠️ the ball ROLLS ACROSS the launch lanes, and each crossing is scored once', () => {
    // Eighteen lanes were installed as plain walls until now, so the ball BOUNCED off every one of
    // them. Six hundred frames of the default run cross two of the launch lanes three times between
    // them — and the crossings are paid by `ReentryLanesRolloverControl`, never flat, because the
    // lane's own edges carry its component and the wall wrapper never sees them at all.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);
    const demo = createDemo(bytes, { random: seeded() });

    demo.step(600);

    const crossed = demo.touched.filter((name) => name.startsWith('a_roll'));
    expect([...new Set(crossed)].sort()).toEqual(['a_roll1', 'a_roll2']);
    expect(demo.paidFlat.filter((name) => name.startsWith('a_roll')), 'never flat').toEqual([]);
    expect(demo.scored.filter((name) => name.startsWith('roll')).length).toBe(crossed.length);
  });

  test('⚠️ the ball is drawn BIGGER when it is nearer, which is the only perspective here', () => {
    // Seven pictures, nine pixels across to fifteen, each carrying the table position at which its
    // size is right. `TBall::Repaint` takes the first whose distance is at or below the ball's own —
    // so the ball grows as it comes down the table, and that is the whole of the depth this port draws.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);
    const demo = createDemo(bytes, { random: seeded() });

    // ⚠️ ASKED OF THE CHOICE, NOT OF THE PIXELS. The ball is nine across on a busy table, so counting
    // changed pixels answers how many of them happened to differ from the picture underneath — which
    // passes whichever frame is drawn. Three mutations survived that test before this one replaced it.
    const position = demo.ball.position;
    const frameAt = (y: number): number => { position.x = 0; position.y = y; return demo.ballFrame; };

    // The thresholds are at y = -13.5, -1.5, 0.3, 7.5, 10.5, 12.5 and 13.5.
    expect(frameAt(-14), 'past the far threshold: the smallest picture').toBe(0);
    expect(frameAt(14), 'past the near one: the largest').toBe(6);
    // And it never goes backwards on the way down the table.
    let previous = -1;
    for (let y = -14; y <= 14; y += 0.5) {
      const frame = frameAt(y);
      expect(frame, `at y ${y}`).toBeGreaterThanOrEqual(previous);
      previous = frame;
    }
    // ⚠️ AND THE PICTURE THAT IS DRAWN IS THE ONE THAT WAS CHOSEN. Rows rather than pixels: a whole
    // row of the ball would have to match the table underneath to disappear, where single pixels do it
    // often enough that counting them answers noise.
    // ⚠️ AND NOT AGAINST THE FAR END OF THE TABLE, where the ball is hidden under scenery and covers
    // no rows at all: anything beats nothing, and the mutation that always draws the smallest picture
    // survived that comparison. y = -8 is the ball in the open at the top; y = 13 is the near end.
    expect(ballRows(demo, { x: 0, y: 13 }), 'the near picture is taller')
      .toBeGreaterThan(ballRows(demo, { x: 0, y: -8 }));
  });

  test('⚠️ the PAS are drawn, and raising one changes the picture', () => {
    // Eight poses each, and `TFlipper::UpdateSprite` picks by `currentAngle / angleMax`. The player has
    // been moving these since the flippers were built and has never seen them.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);
    const demo = createDemo(bytes, { random: seeded() });

    const down = [...demo.render().pixels];
    demo.setFlippers('left', true);
    demo.step(20);
    const up = [...demo.render().pixels];

    expect(up).not.toEqual(down);
    // And the raised pose reaches HIGHER up the table than the resting one: the topmost row that
    // differs between the two belongs to the flipper that moved.
    const changed = up.map((pixel, i) => (pixel !== down[i] ? i : -1)).filter((i) => i >= 0);
    expect(changed.length, 'a flipper’s worth of pixels').toBeGreaterThan(20);
  });

  test('⚠️ a lit lamp is DRAWN, which is the first time this table has shown its own state', () => {
    // Every light has been a component with an on flag since the component pass and none of them had
    // a picture: the missions, the ranks, the bumper levels and the fuel all happened in silence.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);
    const demo = createDemo(bytes, { random: seeded() });
    const lamp = demo.components.lights.get('lite1')!;

    lamp.turnOff();
    const dark = [...demo.render().pixels];
    lamp.turnOn();
    const lit = [...demo.render().pixels];

    expect(lit).not.toEqual(dark);
    // And what changed is a lamp's worth of pixels, not the whole picture.
    const changed = lit.filter((pixel, i) => pixel !== dark[i]).length;
    expect(changed).toBeGreaterThan(0);
    expect(changed).toBeLessThan(80);
  });

  test('⚠️ and LIT means `light_on()`, which is three flags and not the persistent one', () => {
    // An award lights its lamp with `TLightTurnOnTimed`, which sets the TOGGLED flag; a lamp mid-flash
    // sets the FLASHER one. Asking the persistent flag alone leaves every timed award dark on screen
    // while the control layer believes it is showing.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);
    const demo = createDemo(bytes, { random: seeded() });
    const lamp = demo.components.lights.get('lite1')!;
    lamp.turnOff();
    const dark = [...demo.render().pixels];

    lamp.turnOnTimed(5);

    expect(lamp.on, 'the persistent flag is still down').toBe(false);
    expect(lamp.lit, 'and the lamp is lit all the same').toBe(true);
    expect([...demo.render().pixels]).not.toEqual(dark);
  });

  test('⚠️ the ball is drawn BEHIND what the table has standing above it', () => {
    // Now that the ramps exist there is something to go under, and the playfield's own depth map is
    // what says where. At (3.27, -12.45) the map holds 52979 and a ball resting on the table there is
    // 59637 away — the scene is nearer, so no pixel of the ball may be painted. Down on the open
    // playfield the comparison goes the other way and the whole ball shows.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);
    const demo = createDemo(bytes, { random: seeded() });

    expect(ballPixels(demo, { x: 3.271, y: -12.453 }), 'under the arch').toBe(0);
    expect(ballPixels(demo, { x: 0.16, y: 9.4 }), 'out on the open table').toBeGreaterThan(0);
  });

  test('⚠️ and it is the BALL’S OWN Z that decides, which is what a ramp writes', () => {
    // Same spot on the playfield, twice. Resting on the table the ball is behind what is drawn there
    // and no pixel of it is painted; lifted a unit into the air — which is what a ramp's plane
    // equation does to a ball crossing onto it — it clears the same scenery and shows. Using the
    // ball's radius always would draw a ball riding a ramp at the height of one on the floor, and it
    // would vanish under the very arch it is on top of.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);
    const demo = createDemo(bytes, { random: seeded() });
    const position = demo.ball.position as { x: number; y: number; z?: number };
    position.x = 3.271;
    position.y = -12.453;

    position.z = demo.table.ballRadius;
    expect(ballPixels(demo, { x: 3.271, y: -12.453 }, demo.table.ballRadius), 'on the floor').toBe(0);
    expect(ballPixels(demo, { x: 3.271, y: -12.453 }, 1), 'and a unit up').toBeGreaterThan(0);
  });

  test('⚠️ the two ramps exist, and a ball that climbs one feels ITS gravity', () => {
    // Neither ramp carries a wall record, so until they were built the ball could not ride either.
    // The field goes into the grid over the ramp's own boxes: this crosses a triangle edge — which is
    // what puts the ball in the ramp's world — and then asks the table what the ball feels.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);
    const demo = createDemo(bytes, { random: seeded() });
    expect([...demo.ramps.keys()].sort()).toEqual(['ramp', 's_ramp9']);

    const ramp = demo.ramps.get('s_ramp9') as unknown as {
      planes: { v1: { x: number; y: number } }[];
      planeEdges: { component: { collision(b: unknown, p: unknown, d: unknown, n: number, e: unknown): void } }[];
    };
    const at = ramp.planes[0]!.v1;
    const ball = {
      position: { x: at.x, y: at.y, z: 0 },
      // ⚠️ ALONG Y, ON PURPOSE. The table's own gravity carries a random jitter on X — `0.5 - random()`
      // — so two calls never agree there, and the difference between them would be noise rather than
      // the ramp. Y has no jitter, so what is left between the two answers is exactly the ramp.
      direction: { x: 0, y: 1 }, speed: 5, radius: demo.table.ballRadius,
      collisionMask: 1, collisionFlag: false,
      collisionOffset: { x: 0, y: 0, z: 0 }, rampFieldForce: { x: 0, y: 0 },
      memory: { record: () => {} },
    };
    const edge = ramp.planeEdges[0]!;
    edge.component.collision(ball, { x: at.x, y: at.y }, { x: 0, y: 1 }, 0, edge);
    expect(ball.collisionMask, 'in the ramp’s world').toBe(2);

    const free = { ...ball, collisionMask: 1, direction: { x: 0, y: 1 }, speed: 5 };
    const onRamp = { x: 0, y: 0 };
    const offRamp = { x: 0, y: 0 };
    demo.table.context.fieldEffects(ball as never, onRamp);
    demo.table.context.fieldEffects(free as never, offRamp);

    // The short ramp's first triangle is flat, so what the ball feels on it is the ramp's own drag on
    // top of the table's gravity — a fifth of its speed, against its heading.
    expect(onRamp.y - offRamp.y).toBeCloseTo(-1 * 5 * 0.2, 6);
  });

  test('⚠️ and a ramp’s triangles are scaled by the TABLE’S gravity, not by one', () => {
    // `plane.FieldForce = (cos a2, sin a2) * sin(a1) * TableG->GravityDirVectMult`. The direction part
    // is a unit vector, so the length of a triangle's gravity is `sin(steepness) * the table's own
    // multiplier` — build the ramps with a flat 1 and every slope on the table is wrong by that
    // factor, in a way that reads as the ramps being oddly gentle.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);
    const demo = createDemo(bytes, { random: seeded() });
    const ramp = demo.ramps.get('ramp') as unknown as {
      planes: { gravityAngle1: number; fieldForce: { x: number; y: number } }[];
    };
    const plane = ramp.planes[0]!;

    const length = Math.hypot(plane.fieldForce.x, plane.fieldForce.y);

    expect(length).toBeCloseTo(Math.abs(Math.sin(plane.gravityAngle1)) * demo.table.gravityMult, 9);
    expect(demo.table.gravityMult, 'and the table’s own is not one').not.toBeCloseTo(1, 3);
  });

  test('⚠️ and the five trip lines own theirs, which is what stops them being walls', () => {
    // Nothing in a six-hundred-frame run reaches them: the trip lines are up the launch chute and the
    // ball only gets there on a strong plunge. So this asks the wiring directly, the way the holes'
    // ownership is asked — the alternative is a test that passes whether or not they are wired.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);
    const demo = createDemo(bytes, { random: seeded() });

    expect([...demo.tripwires.keys()].sort())
      .toEqual(['s_trip1', 's_trip2', 's_trip3', 's_trip4', 's_trip5']);

    // ⚠️ AND THE EDGE THE GRID HOLDS ANSWERS THROUGH THE WIRE, which is the half that can fail: the
    // map existing proves nothing if the wall loop never asks it. Drive the edge and the ball must
    // come out the other side with the speed it went in with.
    const edge = demo.table.edgesOf('s_trip1')[0] as unknown as {
      component: { collision(b: unknown, p: unknown, d: unknown, n: number, e: unknown): void };
    };
    const ball = {
      position: { x: 0, y: 0 }, direction: { x: 0, y: -1 }, speed: 9,
      memory: { record: () => {} },
    };

    edge.component.collision(ball, { x: 1, y: 2 }, { x: 0, y: 1 }, 0, edge);

    expect(ball.speed, 'across, not off').toBe(9);
    expect(ball.position).toEqual({ x: 1, y: 2 });
  });

  test('⚠️ only the three holes the wormhole runs own their collisions', () => {
    // A sink with no control swallows the ball and never gives it back: it does not drain, does not
    // score and does not count as lost — the ball stops existing. So the escape chute, whose
    // `EscapeChuteSinkControl` this build does not have, must stay plain geometry the ball bounces off.
    // Same rule as the unbound kickout.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);
    const demo = createDemo(bytes, { random: seeded() });

    expect([...demo.sinks.keys()].sort()).toEqual(['v_sink1', 'v_sink2', 'v_sink3']);
  });

  test('⚠️ a ball that reaches a wormhole hole is SWALLOWED and given back, once', () => {
    // The one seed in twelve whose ball finds `v_sink2` on its own. Two touches over two thousand
    // frames: swallowed, thrown back out two seconds later, and it falls in again much later.
    //
    // ⚠️ AND THE POOL DOES NOT GROW, which is the whole of what `TBall::Disable` clearing
    // `CollisionDisabledFlag` buys. Without it the swallowed ball went on being tested against the
    // geometry for the rest of the frame and fell into the same hole seventy-two times, each swallow
    // scheduling another release: the pool reached nineteen balls and nothing errored.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);
    const demo = createDemo(bytes, { random: seeded(9) });

    demo.plunge(true);
    demo.step(60);
    demo.plunge(false);
    demo.step(2000);

    expect(demo.touched.filter((name) => name === 'v_sink2').length).toBe(2);
    expect(demo.table.balls.length, 'one ball, in and out of the hole').toBe(1);
    // ⚠️ AND THE HOLE IS PAID BY ITS OWN CONTROL, never flat: `TSink::Collision` calls
    // `control::handler` itself, so paying it through the wall wrapper as well would double it.
    expect(demo.paidFlat).not.toContain('v_sink2');
    // `WormHoleControl`, under the score table's own name for the hole.
    expect(demo.scored).toContain('sink2');
  });

  test('⚠️ and EVERY ball in the pool is moved, not the one the demonstration watches', () => {
    // Nothing gives a second ball back yet — the sinks are built and not wired — so this is what
    // stands between the pool existing and multiball working. A second ball advanced by nobody would
    // hang in the air exactly where it was born.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);
    const demo = createDemo(bytes, { random: seeded() });
    const second = demo.table.addBall({ x: 0, y: 0 })!;
    const startedAt = { x: second.position.x, y: second.position.y };

    demo.step(30);

    expect(second.position, 'gravity reached it').not.toEqual(startedAt);
  });
});

describe('⚠️ a bumper scores when it FIRES, not when it is grazed', () => {
  test('the ball touches bumpers more often than it is paid for them', () => {
    // `TBumper::Collision` calls `control::handler` only when `DefaultCollision` says the hit was hard
    // — a graze bounces and pays nothing. The table's wall wrapper reported EVERY collision to the
    // dispatcher, so a ball rolling along a bumper was paid for each frame of the roll.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(bytes, { random: seeded() });
    demo.step(1800);

    const bumperTouches = demo.touched.filter((name) => demo.components.bumpers.has(name)).length;
    const bumperScores = demo.scored.filter((name) => /^bump/.test(name)).length;

    expect(bumperTouches, 'the ball did reach a bumper').toBeGreaterThan(0);
    expect(bumperScores).toBeLessThan(bumperTouches);
  });
});

describe('⚠️ and a target is never paid TWICE for one hit', () => {
  test('the payments for targets never outnumber the touches on them', () => {
    // Three kinds of component decide for themselves whether a hit counts — the bumper, the popup
    // target and the solo target — and each reports through its own hook. The table's wall wrapper
    // reports every collision as well, so a component left in BOTH paths is paid twice for one hard
    // hit and once for every graze. Equal counts are the healthy case; more payments than touches is
    // the double.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(bytes, { random: seeded() });
    demo.step(1800);

    const touches = demo.touched.filter((name) => /^a_targ/.test(name)).length;
    const payments = demo.scored.filter((name) => /^target/.test(name)).length;

    expect(touches, 'the ball did reach a target').toBeGreaterThan(0);
    expect(payments).toBeLessThanOrEqual(touches);
  });
});

/**
 * ⚠️ THE TABLE HAS TWO TEXT BOXES AND THE SCREEN HAS ONE FOOTER.
 *
 * `info_text_box` carries transient news — what an award just paid — and `mission_text_box` carries the
 * standing state, shown until something replaces it. The footer was empty on purpose, with a comment
 * saying the mission machine does not run on this table; it has run for a while, and the comment was
 * keeping the screen wrong long after the code was right.
 */
describe('the one line the footer shows', () => {
  const demo = (info: string, missionText: string, gameOver = false) => ({ info, missionText, gameOver });

  test('the news wins while there is any', () => {
    expect(hintFor(demo('BONUS 50000', 'SECRET MISSION RED'), 'OVER')).toBe('BONUS 50000');
  });

  test('and the mission is what is left when there is none', () => {
    expect(hintFor(demo('', 'SECRET MISSION RED'), 'OVER')).toBe('SECRET MISSION RED');
  });

  test('⚠️ and the end of the game says so over both of them', () => {
    // A player whose last ball is gone needs to know that before they need to know what the mission
    // was — and the mission line stays up for ever, so it would otherwise be the last thing said.
    expect(hintFor(demo('BONUS 50000', 'SECRET MISSION RED', true), 'OVER')).toBe('OVER');
  });

  test('and nothing at all when the table has said nothing', () => {
    expect(hintFor(demo('', ''), 'OVER')).toBe('');
  });
});

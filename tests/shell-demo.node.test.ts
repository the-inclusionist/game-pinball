// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createDemo, DEMO_BALL_COLOR, DEMO_BALLS } from '../app/js/shell/demo.js';
import { SCORE_COMPONENTS } from '../app/js/control/score-table.js';
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

    expect([demo.playfield.width, demo.playfield.height]).toEqual([365, 470]);
    // ⚠️ ONE HUNDRED AND SIXTEEN, AND IT WAS A HUNDRED AND FORTY-THREE. Twenty-seven groups build
    // their own geometry and none of them wants the plain wall this count is of:
    //
    //   · the NINE one-ways — two lines on the same two points, wound opposite ways, so that the ball
    //     can cross from one side only. The plain wall put a solid line across every gate.
    //   · the EIGHTEEN lanes — one polygon wound both ways, the second half live only while the ball
    //     is on the lane. The plain wall made every lane something the ball bounced off.
    expect(demo.table.wallCount).toBe(116);
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
    const frame = demo.render();

    expect([...frame.pixels].includes(DEMO_BALL_COLOR)).toBe(true);
    expect([...demo.playfield.pixels]).toEqual([...before]);
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

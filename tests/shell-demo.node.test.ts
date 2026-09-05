// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createDemo, DEMO_BALL_COLOR } from '../app/js/shell/demo.js';
import { SCORE_COMPONENTS } from '../app/js/control/score-table.js';
import { VOICES, SILENT_KINDS, soundForKind } from '../app/js/audio/voices.js';
import { kindOf, COMPONENT_KINDS } from '../app/js/i18n/names.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

    const demo = createDemo(bytes);

    expect([demo.playfield.width, demo.playfield.height]).toEqual([365, 470]);
    expect(demo.table.wallCount).toBe(143);
  });

  test('⚠️ the ball lands INSIDE the picture, which is what ties the physics to the pixels', () => {
    // The projection and the collision geometry are read from different records and used by different
    // modules. If either were wrong the ball would collide correctly against walls drawn somewhere else,
    // and the demonstration would look like a ghost passing through furniture.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(bytes);
    const at = demo.ballOnScreen();

    expect(at.x).toBeGreaterThan(0);
    expect(at.x).toBeLessThan(demo.playfield.width);
    expect(at.y).toBeGreaterThan(0);
    expect(at.y).toBeLessThan(demo.playfield.height);
  });

  test('and it stays inside while it falls', () => {
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(bytes);
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

    const demo = createDemo(bytes);
    demo.step(600);

    expect(demo.touched.length).toBeGreaterThan(0);
  });

  test('the rendered frame carries the ball, and the playfield is not modified', () => {
    // The picture is a still and the ball is the only thing that moves, so the frame is a COPY. Drawing
    // into the playfield itself would leave a trail of every position the ball has ever had.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(bytes);
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

    const demo = createDemo(bytes);
    demo.step(900);

    expect(demo.scored.length).toBeGreaterThan(0);
    expect(demo.score.curScore).toBeGreaterThan(0);
  });

  test('and what it scores on is a component the control layer knows by name', () => {
    // Not the archive's name. `a_bump1` is what the file calls it; `bump1` is what `control::` calls it,
    // and the score arrays are indexed by the second.
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(bytes);
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

    const demo = createDemo(bytes);
    expect(demo.components.bumpers.size).toBe(7);

    demo.step(900);

    // The ball reaches at least one of them in a ball's life on this table.
    expect(demo.touched.some((name) => demo.components.bumpers.has(name))).toBe(true);
  });

  test('dropping again puts a fresh ball back and forgets what the last one touched', () => {
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(bytes);
    demo.step(600);
    demo.drop();

    expect(demo.touched).toEqual([]);
    expect(demo.scored).toEqual([]);
  });
});

describe('⚠️ and the sixty-one wired components run their 1995 control function', () => {
  test('the demo says which they are', () => {
    const bytes = archive();
    if (!bytes) return expect(existsSync(DAT)).toBe(false);

    const demo = createDemo(bytes);

    expect(demo.wired.size).toBe(61);
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

    const demo = createDemo(bytes);
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
    const demo = createDemo(bytes, { onSound: (name) => heard.push(name) });
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
    const demo = createDemo(bytes, { onSound: (name) => heard.push(name) });
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
    const kindVoices = new Set(
      COMPONENT_KINDS.map((kind) => soundForKind(kind)).filter((name): name is string => Boolean(name)),
    );
    expect(heard.filter((name) => kindVoices.has(name))).toHaveLength(audible.length);
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

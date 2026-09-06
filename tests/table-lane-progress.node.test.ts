// SPDX-License-Identifier: AGPL-3.0-or-later
// LIGHTS THAT COME ON AS THE BALL GOES DOWN THE SIDE LANE.
//
// ⚠️ THE DEV, ASKED HOW OFTEN A BALL SHOULD GO DOWN AN OUTLANE: "Sempre que ela não for lançada com
// força suficiente para sair, ela deve descer, e deve haver luzes que vão acendendo conforme ela sai
// da pista lateral."
//
// The lane itself became real in the commit before this one — the channel between the wall and the
// funnel guide, which the ball can now enter on both sides. This is the second half of his sentence:
// the lane lights up behind the ball as it goes down.
//
// ========================= WHY IT IS A HIGH-WATER MARK AND NOT A POSITION =========================
// ⚠️ "VÃO ACENDENDO" IS AN ACCUMULATION. Lights that were simply "wherever the ball is" would go out
// behind it, which is a torch rather than a lane lighting up — and a ball that bounces back up the
// channel would UNLIGHT what it had already passed, which is a table taking something back.
//
// So the depth is the deepest the ball has been in that lane on this ball, and it survives the ball
// leaving the lane. It is cleared when the ball is lost, because the next ball gets a fresh lane.
//
// ========================= AND IT IS NOT A LAMP =========================
// ⚠️ A LAMP IS SOMETHING THE CONTROL LAYER OWNS AND A MISSION CAN READ. `laneControl` lights every lamp
// a lane declares the moment the ball touches it, which is exactly right for "this lane was crossed"
// and exactly wrong for a chase — four lamps would all come on at once. `table/objective` reads lamps
// to decide what is FINISHED, so a lane that declared four would tell the sonar it was three-quarters
// done with a ball halfway down it.
//
// The chase is a fact about where the ball is, like `drainedBy` and `inPlungerLane`, and it is kept
// where those are: a position test the game loop owns.
import { describe, test, expect } from 'vitest';
import { createLaneProgress, laneDepth, LANE_SEGMENTS } from '../app/js/table/lane-progress.js';
import { ION_STORM } from '../app/js/table/ion-storm.js';

const TALL = { x: 4, y: 100, width: 14, height: 60 };
const WIDE = { x: 20, y: 40, width: 60, height: 14 };

describe('how far down a lane the ball is', () => {
  test('outside it, not at all', () => {
    expect(laneDepth(TALL, { x: 11, y: 40 })).toBeNull();
    expect(laneDepth(TALL, { x: 40, y: 130 })).toBeNull();
  });

  test('at its mouth, nothing yet', () => {
    expect(laneDepth(TALL, { x: 11, y: 100 })).toBe(0);
  });

  test('halfway down, half', () => {
    expect(laneDepth(TALL, { x: 11, y: 130 })).toBeCloseTo(0.5, 6);
  });

  test('at its far end, all of it', () => {
    expect(laneDepth(TALL, { x: 11, y: 160 })).toBe(1);
  });

  test('⚠️ and a WIDE lane is measured along its width, because that is its long axis', () => {
    // The same rule the rails are drawn by — see `gfx/table-view`. A lane measured down its short side
    // would fill up in the first pixel and the chase would be a single flash.
    expect(laneDepth(WIDE, { x: 50, y: 47 })).toBeCloseTo(0.5, 6);
  });
});

describe('⚠️ the mark is the DEEPEST it has been, not where it is', () => {
  const table = ION_STORM;
  const lane = table.components.find((c) => c.name === 'outlane.left')!.bounds;
  const atDepth = (t: number) => ({ x: lane.x + lane.width / 2, y: lane.y + lane.height * t });

  /**
   * Three segments of five lit, from a ball sitting in the MIDDLE of the fourth.
   *
   * ⚠️ AND NOT ON THE BOUNDARY, which the first draft used and which failed. `atDepth` multiplies the
   * lane's height by the fraction and the module divides it back out, so 0.6 returns as 0.5999999999
   * and floors to two segments rather than three. That is not a defect to fix — a boundary is a
   * boundary — but a test standing on one is measuring the arithmetic instead of the behaviour.
   */
  const THREE_LIT = 0.7;
  const THREE = 3 / LANE_SEGMENTS;

  test('it rises with the ball', () => {
    const progress = createLaneProgress(table);

    progress.advance(atDepth(THREE_LIT));

    expect(progress.depthOf('outlane.left')).toBe(THREE);
  });

  test('⚠️ and it does NOT fall when the ball comes back up', () => {
    // A ball that rattles up the channel would put out the lights it had already lit. "Vão acendendo"
    // is an accumulation; this is the assertion that says so.
    const progress = createLaneProgress(table);

    progress.advance(atDepth(THREE_LIT));
    progress.advance(atDepth(0.3));

    expect(progress.depthOf('outlane.left')).toBe(THREE);
  });

  test('and it stays lit once the ball has left the lane entirely', () => {
    const progress = createLaneProgress(table);

    progress.advance(atDepth(THREE_LIT));
    progress.advance({ x: 90, y: 40 });

    expect(progress.depthOf('outlane.left')).toBe(THREE);
  });

  test('a lane the ball has never entered is dark', () => {
    const progress = createLaneProgress(table);

    progress.advance(atDepth(THREE_LIT));

    expect(progress.depthOf('outlane.right')).toBe(0);
  });

  test('⚠️ and the next ball gets a fresh lane', () => {
    const progress = createLaneProgress(table);

    progress.advance(atDepth(THREE_LIT));
    progress.reset();

    expect(progress.depthOf('outlane.left')).toBe(0);
  });

  test('⚠️ only LANES are tracked, because only a lane is a stretch the ball travels', () => {
    // A bumper is a body: "how far into it the ball has got" is a question about a collision, and the
    // answer would be a chase of lights across a solid object.
    const progress = createLaneProgress(table);
    const bumper = table.components.find((c) => c.name === 'storm1')!.bounds;

    progress.advance({ x: bumper.x + bumper.width / 2, y: bumper.y + bumper.height / 2 });

    expect(progress.depthOf('storm1')).toBe(0);
  });
});

describe('the segments the depth is shown in', () => {
  test('⚠️ the mark is QUANTISED, so a light is on or off and never half on', () => {
    // The picture is composed once per change and the chase is a fifth answer to "what has changed".
    // A continuous depth would recompose the whole table on every frame the ball spends in a lane; a
    // segment index changes a handful of times per trip. It is also what makes them read as LIGHTS
    // rather than as a bar filling up.
    const table = ION_STORM;
    const lane = table.components.find((c) => c.name === 'outlane.left')!.bounds;
    const progress = createLaneProgress(table);

    progress.advance({ x: lane.x + 7, y: lane.y + lane.height * 0.44 });

    expect(progress.depthOf('outlane.left'))
      .toBe(Math.floor(0.44 * LANE_SEGMENTS) / LANE_SEGMENTS);
  });
});

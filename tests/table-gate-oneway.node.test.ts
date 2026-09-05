// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { createGate } from '../app/js/table/gate.js';
import { createOneway, type BallWithMemory } from '../app/js/table/oneway.js';
import { createCollisionComponent } from '../app/js/table/collision-component.js';
import { createEdgeManager, type Edge } from '../app/js/physics/grid.js';
import { createLine } from '../app/js/physics/edges.js';
import { NO_COLLISION, type Ray } from '../app/js/maths/maths.js';

const ray = (ox: number, oy: number, dx: number, dy: number, max = 100): Ray =>
  ({ origin: { x: ox, y: oy }, direction: { x: dx, y: dy }, maxDistance: max, minDistance: 0.002, collisionMask: 0xffff });

const noComponent = { collision: () => {} };

describe('gate — it does not move, it switches off', () => {
  test('a shut gate collides', () => {
    const g = createEdgeManager(0, 0, 100, 150);
    const line = createLine({ component: noComponent, start: { x: 95, y: 30 }, end: { x: 5, y: 30 } });
    g.addEdge(g.boxX(50), g.boxY(30), line);
    const gate = createGate({ edges: [line] });
    gate.reset();

    expect(g.findCollisionDistance(ray(50, 35, 0, -1, 10)).edge).toBe(line);
  });

  test('an open gate is INVISIBLE to the collision search, not moved out of the way', () => {
    // Opening clears the edge's active flag; the grid skips inactive edges. Nothing is rebuilt, and the
    // geometry never changes — which is what lets every appearing and disappearing part of the table
    // share one mechanism.
    const g = createEdgeManager(0, 0, 100, 150);
    const line = createLine({ component: noComponent, start: { x: 95, y: 30 }, end: { x: 5, y: 30 } });
    g.addEdge(g.boxX(50), g.boxY(30), line);
    const gate = createGate({ edges: [line] });

    gate.openGate();

    expect(g.findCollisionDistance(ray(50, 35, 0, -1, 10)).distance).toBe(NO_COLLISION);
    expect(line.x0).toBe(95); // the geometry did not move
  });

  test('shutting it again brings the wall back', () => {
    const g = createEdgeManager(0, 0, 100, 150);
    const line = createLine({ component: noComponent, start: { x: 95, y: 30 }, end: { x: 5, y: 30 } });
    g.addEdge(g.boxX(50), g.boxY(30), line);
    const gate = createGate({ edges: [line] });
    gate.openGate();

    gate.shutGate();

    expect(g.findCollisionDistance(ray(50, 35, 0, -1, 10)).edge).toBe(line);
  });

  test('reset shuts it SILENTLY — the original plays no sound on reset', () => {
    // A reset that announced itself would fire every gate's sound at the start of every ball.
    const played: number[] = [];
    const gate = createGate({ edges: [], openSoundId: 1, shutSoundId: 2, sound: { play: (id) => played.push(id) } });

    gate.reset();

    expect(played).toEqual([]);
  });

  test('opening and shutting by message do play their sounds', () => {
    const played: number[] = [];
    const gate = createGate({ edges: [], openSoundId: 1, shutSoundId: 2, sound: { play: (id) => played.push(id) } });

    gate.openGate();
    gate.shutGate();

    expect(played).toEqual([2, 1]);
  });
});

describe('oneway — passing through is not a collision', () => {
  const recorded: Edge[] = [];
  const passingEdge: Edge = {
    active: true, collisionGroup: 0xffff, findCollisionDistance: () => 1, edgeCollision: () => {},
  };
  const otherEdge: Edge = {
    active: true, collisionGroup: 0xffff, findCollisionDistance: () => 1, edgeCollision: () => {},
  };

  function build(tiltLocked = false) {
    recorded.length = 0;
    const played: number[] = [];
    const passes: number[] = [];
    const table = { tiltLocked };
    const oneway = createOneway({
      passingEdge,
      bounce: createCollisionComponent({ table, elasticity: 1, smoothness: 1, threshold: 5, boost: 0 }),
      table,
      passSoundId: 3,
      sound: { play: (id) => played.push(id) },
      onPass: () => passes.push(1),
    });
    const ball: BallWithMemory = {
      position: { x: 0, y: 0 }, direction: { x: 0, y: -1 }, speed: 10,
      memory: { record: (e) => { recorded.push(e); } },
    };
    return { oneway, ball, played, passes };
  }

  test('the ball crosses the passing edge with its direction and speed untouched', () => {
    const { oneway, ball } = build();

    oneway.collision(ball, { x: 5, y: 3 }, { x: 0, y: 1 }, 2, passingEdge);

    expect(ball.direction).toEqual({ x: 0, y: -1 }); // still heading down
    expect(ball.speed).toBe(10);
    expect(ball.position).toEqual({ x: 5, y: 3 }); // moved to the contact point
  });

  test('the crossed edge is marked so the same frame does not meet it twice', () => {
    // Without the mark the ball, now sitting exactly on the line, meets it again within the frame and
    // passes through twice — which would count the crossing twice as well.
    const { oneway, ball } = build();

    oneway.collision(ball, { x: 5, y: 3 }, { x: 0, y: 1 }, 2, passingEdge);

    expect(recorded).toEqual([passingEdge]);
  });

  test('crossing plays its sound and reports the pass', () => {
    const { oneway, ball, played, passes } = build();

    oneway.collision(ball, { x: 5, y: 3 }, { x: 0, y: 1 }, 2, passingEdge);

    expect(played).toEqual([3]);
    expect(passes).toEqual([1]);
  });

  test('any OTHER edge bounces normally', () => {
    const { oneway, ball } = build();

    oneway.collision(ball, { x: 5, y: 3 }, { x: 0, y: 1 }, 2, otherEdge);

    expect(ball.direction.y).toBeCloseTo(1); // reversed
  });

  test('a TILTED table still lets the ball through — it just stops answering', () => {
    // The pass is geometry; the sound and the score are the table reacting, and a tilted table has
    // stopped reacting. Blocking the pass on tilt would trap the ball behind a gate it had earned.
    const { oneway, ball, played, passes } = build(true);

    oneway.collision(ball, { x: 5, y: 3 }, { x: 0, y: 1 }, 2, passingEdge);

    expect(ball.position).toEqual({ x: 5, y: 3 });
    expect(played).toEqual([]);
    expect(passes).toEqual([]);
  });
});

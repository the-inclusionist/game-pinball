// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { createRenderer, makeRect, type Sprite } from '../app/js/gfx/render.js';
import { createFramebuffer, pack, type Framebuffer } from '../app/js/gfx/framebuffer.js';
import { createZBuffer, FAR } from '../app/js/gfx/zbuffer.js';
import { rectangleClip, enclosingBox } from '../app/js/maths/rect.js';

const RED = pack(255, 0, 0, 255);
const GREEN = pack(0, 255, 0, 255);
const BACKGROUND = pack(20, 20, 20, 255);

/** A framebuffer filled with one color. */
function filled(width: number, height: number, color: number): Framebuffer {
  const fb = createFramebuffer(width, height);
  fb.pixels.fill(color);
  return fb;
}

/** A z-buffer filled with one depth. */
function zFilled(width: number, height: number, depth: number) {
  const z = createZBuffer(width, height);
  z.depths.fill(depth);
  return z;
}

function makeSprite(overrides: Partial<Sprite> = {}): Sprite {
  return {
    visualType: 'sprite',
    bmp: null, zMap: null, zMapOffsetX: 0, zMapOffsetY: 0,
    bmpRect: makeRect(0, 0, 1, 1),
    boundingRect: makeRect(0, 0, 1, 1),
    dirtyRect: makeRect(),
    dirtyRectPrev: makeRect(),
    dirty: false,
    depth: 0,
    occludedSprites: null,
    deleted: false,
    ...overrides,
  };
}

function build(width = 8, height = 8) {
  const screen = createFramebuffer(width, height);
  const zScreen = createZBuffer(width, height);
  const background = filled(width, height, BACKGROUND);
  const renderer = createRenderer({ width, height, screen, zScreen, background });
  return { renderer, screen, zScreen, background };
}

const at = (fb: Framebuffer, x: number, y: number) => fb.pixels[y * fb.width + x];

describe('rect — the two operations the compositor is built on', () => {
  test('clipping returns the intersection', () => {
    const out = makeRect();

    expect(rectangleClip({ x: 0, y: 0, width: 4, height: 4 }, { x: 2, y: 2, width: 4, height: 4 }, out)).toBe(true);
    expect(out).toEqual({ x: 2, y: 2, width: 2, height: 2 });
  });

  test('rectangles that do not meet report false and leave the output alone', () => {
    const out = makeRect(9, 9, 9, 9);

    expect(rectangleClip({ x: 0, y: 0, width: 2, height: 2 }, { x: 5, y: 5, width: 2, height: 2 }, out)).toBe(false);
    expect(out).toEqual({ x: 9, y: 9, width: 9, height: 9 });
  });

  test('the enclosing box covers both', () => {
    const out = makeRect();

    enclosingBox({ x: 0, y: 0, width: 2, height: 2 }, { x: 4, y: 4, width: 2, height: 2 }, out);

    expect(out).toEqual({ x: 0, y: 0, width: 6, height: 6 });
  });
});

describe('render — a dirty rectangle is the union of where it WAS and where it IS', () => {
  test('a sprite that moved clears both positions, leaving no trail', () => {
    // Clearing only the new position leaves the old pixels on screen and a moving sprite paints a
    // trail behind it.
    const { renderer, screen } = build();
    screen.pixels.fill(RED); // pretend the whole screen is dirty paint

    const sprite = makeSprite({
      bmpRect: makeRect(4, 0, 2, 2),
      dirtyRectPrev: makeRect(0, 0, 2, 2), // it used to be here
      dirty: true,
    });
    renderer.addSprite(sprite);

    renderer.update();

    expect(at(screen, 0, 0)).toBe(BACKGROUND); // the old position was cleared
    expect(at(screen, 5, 1)).toBe(BACKGROUND); // and so was the new one
  });

  test('clearing also resets the depth to FAR', () => {
    // Otherwise the erased area would keep the depth of whatever used to be there, and the next sprite
    // drawn into it would be judged against a surface that is gone.
    const { renderer, zScreen } = build();
    zScreen.depths.fill(100);
    const sprite = makeSprite({ bmpRect: makeRect(0, 0, 4, 4), dirty: true });
    renderer.addSprite(sprite);

    renderer.update();

    expect(zScreen.depths[0]).toBe(FAR);
  });
});

describe('render — clearing destroys the neighbors, so repaint redraws them', () => {
  test('a sprite overlapping the dirty rectangle is redrawn', () => {
    // Restoring the background erases everything that was there, including sprites that merely overlap.
    // That is the whole reason the occlusion list exists.
    const { renderer, screen } = build();

    const neighbor = makeSprite({
      bmp: filled(4, 4, GREEN),
      zMap: zFilled(4, 4, 10),
      bmpRect: makeRect(0, 0, 4, 4),
      boundingRect: makeRect(0, 0, 4, 4),
    });
    const mover = makeSprite({
      bmp: filled(2, 2, RED),
      zMap: zFilled(2, 2, 20),
      bmpRect: makeRect(2, 2, 2, 2),
      boundingRect: makeRect(2, 2, 2, 2),
      dirty: true,
    });
    renderer.addSprite(neighbor);
    renderer.addSprite(mover);
    renderer.buildOccludeList();

    renderer.update();

    // The neighbor's green survives inside the erased rectangle, because repaint put it back.
    expect(at(screen, 2, 2)).toBe(GREEN);
  });

  test('a lone sprite with a bitmap gets no occlusion list', () => {
    // Transcribed from the upstream: the list always contains the sprite itself, so a size of one means
    // it is alone, and the upstream drops the list in that case.
    const { renderer } = build();
    const lonely = makeSprite({ bmp: filled(2, 2, RED), boundingRect: makeRect(0, 0, 2, 2) });
    renderer.addSprite(lonely);

    renderer.buildOccludeList();

    expect(lonely.occludedSprites).toBeNull();
  });

  test('a sprite with NO bitmap keeps its list even when alone', () => {
    // A sprite without pixels is a pure hole puncher: it clears its rectangle so the neighbors redraw.
    const { renderer } = build();
    const puncher = makeSprite({ bmp: null, boundingRect: makeRect(0, 0, 2, 2) });
    renderer.addSprite(puncher);

    renderer.buildOccludeList();

    expect(puncher.occludedSprites).toHaveLength(1);
  });
});

describe('render — balls live outside the scene', () => {
  test('a ball is drawn over the scene and the pixels beneath it are saved', () => {
    const { renderer, screen, zScreen } = build();
    screen.pixels.fill(GREEN);
    zScreen.depths.fill(500);

    const ball = makeSprite({
      visualType: 'ball',
      bmp: filled(2, 2, RED),
      bmpRect: makeRect(1, 1, 2, 2),
      depth: 100,
    });
    renderer.addSprite(ball);

    renderer.update();

    expect(at(screen, 1, 1)).toBe(RED);
  });

  test('the next frame puts back what was underneath, so the ball leaves no mark', () => {
    // The scene is a stable image; balls are transient overlays. Restoring first is what lets the
    // expensive part of the frame be skipped whenever nothing else changed.
    const { renderer, screen, zScreen } = build();
    screen.pixels.fill(GREEN);
    zScreen.depths.fill(500);
    const ball = makeSprite({
      visualType: 'ball', bmp: filled(2, 2, RED), bmpRect: makeRect(1, 1, 2, 2), depth: 100,
    });
    renderer.addSprite(ball);
    renderer.update();

    // It moves away, and the frame runs again.
    ball.bmpRect = makeRect(5, 5, 2, 2);
    renderer.update();

    expect(at(screen, 1, 1)).toBe(GREEN); // the old position is clean again
    expect(at(screen, 5, 5)).toBe(RED);
  });

  test('a ball NEVER writes into the z-buffer', () => {
    // paintFlat writes color only. A ball that carved the depth buffer would leave a hole in the scene
    // it is meant to pass over.
    const { renderer, screen, zScreen } = build();
    screen.pixels.fill(GREEN);
    zScreen.depths.fill(500);
    const ball = makeSprite({
      visualType: 'ball', bmp: filled(2, 2, RED), bmpRect: makeRect(1, 1, 2, 2), depth: 100,
    });
    renderer.addSprite(ball);

    renderer.update();

    expect(zScreen.depths[zScreen.stride + 1]).toBe(500);
  });

  test('a ball behind the scene is not drawn at all', () => {
    const { renderer, screen, zScreen } = build();
    screen.pixels.fill(GREEN);
    zScreen.depths.fill(50); // the scene is nearer than the ball
    const ball = makeSprite({
      visualType: 'ball', bmp: filled(2, 2, RED), bmpRect: makeRect(1, 1, 2, 2), depth: 100,
    });
    renderer.addSprite(ball);

    renderer.update();

    expect(at(screen, 1, 1)).toBe(GREEN);
  });

  test('balls are painted in ascending depth order, so the LAST painted wins', () => {
    const { renderer, screen, zScreen } = build();
    screen.pixels.fill(BACKGROUND);
    zScreen.depths.fill(900);

    const far = makeSprite({ visualType: 'ball', bmp: filled(2, 2, GREEN), bmpRect: makeRect(1, 1, 2, 2), depth: 300 });
    const near = makeSprite({ visualType: 'ball', bmp: filled(2, 2, RED), bmpRect: makeRect(1, 1, 2, 2), depth: 100 });
    renderer.addSprite(far);   // added in the wrong order on purpose
    renderer.addSprite(near);

    renderer.update();

    // Sorted ascending and painted in that order, so the LARGER depth lands last and wins. Which reads
    // backwards for layering, and is what the original does. The ordering's load-bearing job is the
    // save/restore stack: unpaint walks the list in reverse, so the last patch saved is the first put
    // back. Transcribed for that reason rather than for the visual one.
    expect(at(screen, 1, 1)).toBe(GREEN);
  });
});

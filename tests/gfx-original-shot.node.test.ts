// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PICTURE, WRITTEN TO DISK SO SOMEBODY CAN LOOK AT IT.
//
// ⚠️ NOTHING IN THIS PROJECT HAD EVER LOOKED AT A FRAME. Every gate on the render asks about a lamp, a
// corner, a palette entry, a count of changed pixels — and the 1995 side panel was being painted over
// the right-hand third of the playfield the whole time, because none of them asks what the frame LOOKS
// LIKE. It was found by writing a PNG by hand at four in the morning and opening it.
//
// So the improvisation becomes a tool. Every `npm test` leaves `shots/demo-original-live.png` on disk,
// at three times size because 183x235 is small, and anyone who wonders what the port draws can open it.
// `shots/` is gitignored — it is a verification artefact, and the frame is the archive's art.
//
// ========================= THE SIDE-BY-SIDE, DONE ON 2026-09-06 =========================
// The plan's verification asks for "comparação lado a lado com o pinball.alula.me, aberto no painel
// como referência viva". It had never been done in this repository's sessions, so it was: the
// reference opened in the browser panel next to `shots/demo-original-screen.png`.
//
// WHAT MATCHED, item by item: the purple ramp down the left, the bumper cluster and its white-and-red
// caps, the yellow target bank, the wormhole ring with its collar of orange and blue lamps, the launch
// lane on the right, the flippers, and the palette throughout. The port draws the 1995 table.
//
// WHAT DIFFERED, and both were decided rather than found: there is no side panel, because ADR-0002
// killed it, and the view is 180 tall over a 235-tall table, because ADR-0001 gave the camera travel.
//
// ⚠️ AND WHAT THIS COMPARISON CANNOT RESOLVE, said rather than left for somebody to assume. Two
// screenshots at different scales, of different scenes, read by eye: it can tell a missing sprite from
// a present one and a wrong palette from a right one. It cannot tell a pixel out of place, a sprite one
// row high, or a z-order that differs only where two things overlap. It is not a gate and it is not
// repeatable — nothing here fetches that site, which would also mean fetching Microsoft's data from a
// third party — so it is written down as an observation with a date on it.
//
// ⚠️ AND THE ASSERTIONS HERE ARE DELIBERATELY WEAK. A picture cannot be asserted into correctness, and
// pretending otherwise with a hash would give a test that fails for every legitimate change and says
// nothing about any of them. What is checked is that the frame is a PICTURE — full, opaque, and made of
// many colours — which is what distinguishes it from the blank, the flat and the half-drawn. The
// specific claims about what is drawn live in `shell-demo`, where they can name what they mean.
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { createDemo } from '../app/js/shell/demo.js';
import { createFramebuffer } from '../app/js/gfx/framebuffer.js';
import { drawDemoInto } from '../app/js/shell/demo-page.js';
import { layoutHud, DEFAULT_HUD } from '../app/js/shell/hud.js';
import { drawTable, blitView } from '../app/js/gfx/table-view.js';
import { CATALOG } from '../app/js/table/catalog.js';

const DAT = 'C:/Users/candi/Claude/SpaceCadetPinball/game_resources/PINBALL.DAT';
const MAGNIFY = 3;

const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** A PNG, by hand. Colour type 6 (RGBA), one filter byte of zero per row, deflate from `node:zlib`. */
function png(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = 8;
  header[9] = 6;
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', new Uint8Array(deflateSync(Buffer.from(raw)))),
    chunk('IEND', new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
}

/** Nearest neighbour, so the pixel grid stays exact — the same rule `gfx/table-view` renders under. */
function magnify(rgba: Uint8Array, width: number, height: number, by: number): Uint8Array {
  const out = new Uint8Array(width * by * height * by * 4);
  for (let y = 0; y < height * by; y++) {
    for (let x = 0; x < width * by; x++) {
      const from = (Math.floor(y / by) * width + Math.floor(x / by)) * 4;
      const to = (y * width * by + x) * 4;
      out.set(rgba.subarray(from, from + 4), to);
    }
  }
  return out;
}

describe('the frame the demonstration draws', () => {
  test('⚠️ it is a PICTURE — and it is on disk, at shots/demo-original-live.png', () => {
    if (!existsSync(DAT)) return expect(existsSync(DAT)).toBe(false);
    const file = readFileSync(DAT);
    const bytes = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    const demo = createDemo(bytes, { textFor: (id) => id, random: () => 0.5 });

    // A ball in play, so the flippers, the lamps and the ball are all in the shot.
    demo.plunge(true);
    demo.step(150);
    demo.plunge(false);
    demo.step(400);

    const frame = demo.render();
    mkdirSync('shots', { recursive: true });
    writeFileSync(
      'shots/demo-original-live.png',
      png(frame.width * MAGNIFY, frame.height * MAGNIFY,
        magnify(new Uint8Array(frame.bytes.buffer, frame.bytes.byteOffset, frame.bytes.length),
          frame.width, frame.height, MAGNIFY)),
    );

    const colours = new Set<number>();
    let opaque = 0;
    for (let i = 0; i < frame.pixels.length; i++) {
      colours.add(frame.pixels[i]!);
      if (frame.bytes[i * 4 + 3] === 255) opaque++;
    }

    expect([frame.width, frame.height], 'the halved playfield').toEqual([183, 235]);
    // A blank frame has one colour; a flat fill has two; the 1995 table has thousands.
    expect(colours.size, 'many colours, which is what a picture is').toBeGreaterThan(500);
    // ⚠️ AND ALMOST ALL OF IT OPAQUE. The playfield is forced opaque on decode; what is not are the
    // corners of the sprites drawn over it, which are transparent on purpose.
    expect(opaque / frame.pixels.length, 'the table is not full of holes').toBeGreaterThan(0.95);
  });

  test('⚠️ and the SCREEN the player sees, which is a window onto it', () => {
    // 320x180, the whole of decision 4, with the camera's window onto a 183x235 table. Written beside
    // the table shot because the two answer different questions: whether the table is drawn, and
    // whether the right part of it reaches the screen.
    if (!existsSync(DAT)) return expect(existsSync(DAT)).toBe(false);
    const file = readFileSync(DAT);
    const bytes = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    const demo = createDemo(bytes, { textFor: (id) => id, random: () => 0.5 });
    demo.plunge(true);
    demo.step(150);
    demo.plunge(false);
    demo.step(400);

    const picture = demo.render();
    const screen = createFramebuffer(320, 180);
    // ⚠️ THE HUD'S OWN RECT, not the whole screen. `layoutHud` puts a 183-wide playfield at x = 69 and
    // lays the four blocks out either side; the demonstration used to blit at x = 0, so the table sat
    // 69 columns left of where the HUD expected it — the player name over the table's edge, the score
    // in the empty 137 columns. Found by looking at this very shot.
    const layout = layoutHud({ ...DEFAULT_HUD, playfieldWidth: picture.width });
    drawDemoInto(screen, picture, demo.ballOnScreen(), layout.playfield);

    writeFileSync(
      'shots/demo-original-screen.png',
      png(screen.width * MAGNIFY, screen.height * MAGNIFY,
        magnify(new Uint8Array(screen.bytes.buffer, screen.bytes.byteOffset, screen.bytes.length),
          screen.width, screen.height, MAGNIFY)),
    );

    // ⚠️ THE TABLE IS NARROWER THAN THE SCREEN, so 137 columns of it are never table. That is not a
    // defect: it is where ADR-0002 puts the four HUD blocks, as DOM text rather than pixels.
    let drawn = 0;
    for (let y = 0; y < screen.height; y++) {
      for (let x = 0; x < layout.playfield.width; x++) {
        if (screen.pixels[y * screen.width + layout.playfield.x + x] !== 0) drawn++;
      }
    }
    expect(drawn / (screen.height * layout.playfield.width), 'the window is full of table')
      .toBeGreaterThan(0.95);

    // ⚠️ AND THE COLUMNS THE HUD OWNS ARE LEFT ALONE. 137 of the 320 are not table, which is where
    // ADR-0002 puts the four blocks — as DOM text over a canvas that leaves them clear.
    let leftEdge = 0;
    for (let y = 0; y < screen.height; y++) {
      for (let x = 0; x < layout.playfield.x; x++) if (screen.pixels[y * screen.width + x] !== 0) leftEdge++;
    }
    expect(layout.playfield.x, 'the table is inset, not flush left').toBeGreaterThan(0);
    expect(leftEdge, 'and nothing is drawn in the HUD column beside it').toBe(0);
  });
});

describe('the frames the AUTHORED tables draw', () => {
  // ⚠️ ONE SHOT PER TABLE, because the catalogue is where phase 8 lives and nobody had looked at any of
  // them either. The 1995 table hid a side panel over a third of its playfield and a table 69 columns
  // out of place; there is no reason to believe five tables drawn from scratch are in better shape just
  // because their geometry validates.
  test.each(CATALOG.map((table) => [table.name, table] as const))(
    '%s: composed onto the screen, and written to shots/',
    (name, table) => {
      const picture = drawTable({ table });
      const screen = createFramebuffer(320, 180);
      const layout = layoutHud({ ...DEFAULT_HUD, playfieldWidth: table.size.width });
      // The camera starts at the far end of its travel — on the flippers — which is what a player sees
      // when the table opens. `shell/camera` says so; this is that state, drawn.
      const offsetY = Math.max(0, table.size.height - layout.playfield.height);
      const offsetX = Math.max(0, table.size.width - layout.playfield.width);
      blitView(screen, picture, layout.playfield, offsetX, offsetY);

      mkdirSync('shots', { recursive: true });
      writeFileSync(
        `shots/authored-${name}.png`,
        png(screen.width * MAGNIFY, screen.height * MAGNIFY,
          magnify(new Uint8Array(screen.bytes.buffer, screen.bytes.byteOffset, screen.bytes.length),
            screen.width, screen.height, MAGNIFY)),
      );

      // ⚠️ AND THE SAME TABLE IN THE OTHER PALETTE, because a mode nobody has looked at is a mode
      // nobody has checked. `tests/gfx-table-palette` proves the CB-Safe colours stay apart under
      // three simulations; it cannot tell whether the result is a table a person would want to look
      // at. That question only has an answer on disk.
      const safePicture = drawTable({ table, cbSafe: true });
      const safeScreen = createFramebuffer(320, 180);
      blitView(safeScreen, safePicture, layout.playfield, offsetX, offsetY);
      writeFileSync(
        `shots/authored-${name}-cb-safe.png`,
        png(safeScreen.width * MAGNIFY, safeScreen.height * MAGNIFY,
          magnify(new Uint8Array(safeScreen.bytes.buffer, safeScreen.bytes.byteOffset,
            safeScreen.bytes.length), safeScreen.width, safeScreen.height, MAGNIFY)),
      );

      // The same weak-on-purpose claims as the 1995 shot: that this is a picture in the right place.
      let drawn = 0;
      for (let y = 0; y < layout.playfield.height; y++) {
        for (let x = 0; x < layout.playfield.width; x++) {
          if (screen.pixels[y * screen.width + layout.playfield.x + x] !== 0) drawn++;
        }
      }
      expect(drawn / (layout.playfield.height * layout.playfield.width), `${name} fills its window`)
        .toBeGreaterThan(0.95);

      // ⚠️ THE INSET IS ASSERTED BEFORE IT IS USED, or the loop below reads by the same link the blit
      // did and passes over a table drawn flush left. Half the width the table does not use, rounded
      // up, and zero when the table is at least as wide as the screen.
      const spare = Math.max(0, screen.width - table.size.width);
      expect(layout.playfield.x, `${name} is inset by half of what it does not use`)
        .toBe(Math.ceil(spare / 2));

      let outside = 0;
      for (let y = 0; y < screen.height; y++) {
        for (let x = 0; x < layout.playfield.x; x++) {
          if (screen.pixels[y * screen.width + x] !== 0) outside++;
        }
      }
      expect(outside, `${name} leaves the HUD column clear`).toBe(0);
    },
  );
});

/**
 * ⚠️ AND THE FLARE, WHICH NO SHOT ABOVE CAN SHOW.
 *
 * Every picture in this file is composed with the table at rest, and `ion-storm`'s storm is the first
 * thing on any of them that exists only while the clock is running. A shot of the calm table is a
 * shot of the one moment the feature is not there — which is precisely the arrangement this file was
 * written to stop, where 1,700 tests were green over a side panel covering a third of the playfield.
 *
 * Five phases of one sweep, stacked, so the Dev's list is readable down the sheet: preto, marrom,
 * vermelho, amarelo, branco.
 */
describe('the flare on `ion-storm`', () => {
  test('⚠️ it is a PICTURE that changes with the sweep, at shots/authored-ion-storm-flare.png', () => {
    const table = CATALOG.find((t) => t.name === 'ion-storm')!;
    const layout = layoutHud({ ...DEFAULT_HUD, playfieldWidth: table.size.width });
    const phases = [0.1, 0.3, 0.5, 0.7, 0.9].map((f) => Math.round(f * table.size.height));

    const sheet = createFramebuffer(320, 180 * phases.length);
    const seen = new Set<number>();
    phases.forEach((flareAt, i) => {
      const screen = createFramebuffer(320, 180);
      // Centred on the flare, so each strip shows the band rather than wherever the camera rests.
      const offsetY = Math.max(0, Math.min(table.size.height - layout.playfield.height,
        flareAt - layout.playfield.height / 2));
      blitView(screen, drawTable({ table, flareAt }), layout.playfield,
        Math.max(0, table.size.width - layout.playfield.width), offsetY);
      sheet.pixels.set(screen.pixels, i * 320 * 180);
      for (const p of screen.pixels) seen.add(p);
    });

    mkdirSync('shots', { recursive: true });
    writeFileSync(
      'shots/authored-ion-storm-flare.png',
      png(sheet.width * MAGNIFY, sheet.height * MAGNIFY,
        magnify(new Uint8Array(sheet.bytes.buffer, sheet.bytes.byteOffset, sheet.bytes.length),
          sheet.width, sheet.height, MAGNIFY)),
    );

    // ⚠️ THE FIVE STRIPS ARE FIVE DIFFERENT PICTURES, which is the claim a stacked sheet can make and
    // a single shot cannot. A flare that never moved — an unadvanced clock, a `flareAt` dropped on the
    // way through `main` — would give five identical strips and a file that looks perfectly fine.
    const strip = (i: number): string => sheet.pixels.slice(i * 320 * 180, (i + 1) * 320 * 180).join();
    const strips = new Set(phases.map((_, i) => strip(i)));
    expect(strips.size, 'each phase of the sweep draws a different table').toBe(phases.length);
    expect(seen.size, 'and the sheet is made of many colours').toBeGreaterThan(20);
  });
});

/**
 * ⚠️ AND THE WHOLE PLAYFIELD, AT ITS OWN SIZE, BECAUSE THE DEV IS PAINTING OVER IT.
 *
 * "Me dê as medidas em pixels de cada uma destas mesas e um print delas, vou trabalhar na arte delas."
 * Every other shot in this file is what the SCREEN shows — 320×180 with the camera parked where a ball
 * starts, which on `long-climb` is two-fifths of the table. Art is authored against the playfield, so
 * the playfield is what has to be on disk.
 *
 * ⚠️ AND IT IS A TEST RATHER THAN A SCRIPT I RAN ONCE. The first set was generated by hand and was
 * stale within the hour — the plunger lane grew a curved top and every table changed. A sheet that
 * regenerates with `npm test` cannot describe a table that no longer exists.
 */
describe('the playfields, for painting over', () => {
  test.each(CATALOG.map((table) => [table.name, table] as const))(
    '%s: written to shots/playfield/ at 1x and 4x',
    (name, table) => {
      const fb = drawTable({ table });
      const bytes = new Uint8Array(fb.bytes.buffer, fb.bytes.byteOffset, fb.bytes.length);

      mkdirSync('shots/playfield', { recursive: true });
      writeFileSync(`shots/playfield/${name}.png`, png(fb.width, fb.height, bytes));
      writeFileSync(`shots/playfield/${name}@4x.png`,
        png(fb.width * 4, fb.height * 4, magnify(bytes, fb.width, fb.height, 4)));

      // The sheet is the table and nothing else: no HUD margin, no camera, no window.
      expect([fb.width, fb.height], `${name} is the playfield's own size`)
        .toEqual([table.size.width, table.size.height]);
    },
  );
});

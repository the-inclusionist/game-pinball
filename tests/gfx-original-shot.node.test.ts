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
// ⚠️ AND THE ASSERTIONS HERE ARE DELIBERATELY WEAK. A picture cannot be asserted into correctness, and
// pretending otherwise with a hash would give a test that fails for every legitimate change and says
// nothing about any of them. What is checked is that the frame is a PICTURE — full, opaque, and made of
// many colours — which is what distinguishes it from the blank, the flat and the half-drawn. The
// specific claims about what is drawn live in `shell-demo`, where they can name what they mean.
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { createDemo } from '../app/js/shell/demo.js';

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
});

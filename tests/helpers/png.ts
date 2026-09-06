// SPDX-License-Identifier: AGPL-3.0-or-later
// tests/helpers/png — a minimal PNG writer, so the visual gate has an artefact somebody can LOOK at.
//
// It exists because the alternative was comparing numbers over a buffer and calling that visual
// verification. A PNG on disk can be checked by a human, and it is the only way the plan's "compare
// against pinball.alula.me" stops being a figure of speech.
//
// 8-bit RGBA, no filtering (a zero byte per row), Node's own deflate. It is not optimized and does not
// need to be: it is test tooling, not game code.
import { deflateSync, inflateSync } from 'node:zlib';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length, 0);
  header.write(type, 4, 'latin1');
  const body = Buffer.concat([header.subarray(4), Buffer.from(data)]);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([header.subarray(0, 4), body, tail]);
}

/** Bytes of an RGBA PNG built from `width * height * 4` bytes. */
export function buildPng(bytes: Uint8ClampedArray, width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bits per channel
  ihdr[9] = 6;  // RGBA
  // 10, 11, 12 = compression, filter, interlace: all zero

  // One row at a time, each prefixed with filter byte 0 ("none").
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const destination = y * (1 + width * 4);
    raw[destination] = 0;
    Buffer.from(bytes.buffer, bytes.byteOffset + y * width * 4, width * 4).copy(raw, destination + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

/**
 * ⚠️ AND A READER, BECAUSE THE ART CAME BACK. `app/assets/tables/*.png` are the Dev's playfields,
 * reduced and dimmed, and authoring geometry ON TOP of them means a test has to be able to look at
 * them. Node has no image decoder and the browser's is not available here.
 *
 * Handles what those files actually are — 8-bit palette or truecolour, all five row filters — and
 * nothing else. It is test tooling for six known files, not a decoder.
 */
export function readPng(bytes: Buffer): { width: number; height: number; pixels: Uint32Array } {
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const colourType = bytes[25]!;

  const parts: Buffer[] = [];
  let palette: Buffer | null = null;
  for (let at = 8; at < bytes.length;) {
    const length = bytes.readUInt32BE(at);
    const type = bytes.toString('ascii', at + 4, at + 8);
    if (type === 'IDAT') parts.push(bytes.subarray(at + 8, at + 8 + length));
    if (type === 'PLTE') palette = bytes.subarray(at + 8, at + 8 + length);
    at += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(parts));
  const perPixel = colourType === 3 ? 1 : colourType === 2 ? 3 : 4;
  const stride = width * perPixel;
  const out = new Uint8Array(width * height * 4);
  const line = new Uint8Array(stride);
  const above = new Uint8Array(stride);
  let read = 0;

  for (let y = 0; y < height; y++) {
    const filter = raw[read++]!;
    for (let x = 0; x < stride; x++) {
      const here = raw[read + x]!;
      const left = x >= perPixel ? line[x - perPixel]! : 0;
      const up = above[x]!;
      const upLeft = x >= perPixel ? above[x - perPixel]! : 0;
      let value = here;
      if (filter === 1) value = here + left;
      else if (filter === 2) value = here + up;
      else if (filter === 3) value = here + ((left + up) >> 1);
      else if (filter === 4) {
        // Paeth: whichever of the three neighbours the linear prediction is nearest to.
        const guess = left + up - upLeft;
        const dl = Math.abs(guess - left);
        const du = Math.abs(guess - up);
        const dul = Math.abs(guess - upLeft);
        value = here + (dl <= du && dl <= dul ? left : du <= dul ? up : upLeft);
      }
      line[x] = value & 0xff;
    }
    read += stride;

    for (let x = 0; x < width; x++) {
      const to = (y * width + x) * 4;
      if (colourType === 3) {
        const index = line[x]! * 3;
        out[to] = palette![index]!;
        out[to + 1] = palette![index + 1]!;
        out[to + 2] = palette![index + 2]!;
      } else {
        out[to] = line[x * perPixel]!;
        out[to + 1] = line[x * perPixel + 1]!;
        out[to + 2] = line[x * perPixel + 2]!;
      }
      out[to + 3] = 255;
    }
    above.set(line);
  }

  return { width, height, pixels: new Uint32Array(out.buffer) };
}

/**
 * Nearest neighbour, so the pixel grid stays exact — the same rule `gfx/table-view` renders under.
 *
 * ⚠️ HERE BECAUSE IT WAS IN TWO TEST FILES AND THE WRITER WAS IN THREE. `tests/gfx-original-shot` kept
 * its own `crc32`, `chunk`, `png` and `magnify` while this module sat beside it — a hundred lines of
 * PNG encoder written twice, in a repository whose comments warn about exactly that in five other
 * places. Nothing had gone wrong with it yet, which is the only reason it survived: a duplicate that
 * has not drifted looks like no duplicate at all.
 */
export function magnify(
  bytes: Uint8Array | Uint8ClampedArray, width: number, height: number, by: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * by * height * by * 4);
  for (let y = 0; y < height * by; y++) {
    for (let x = 0; x < width * by; x++) {
      const from = (Math.floor(y / by) * width + Math.floor(x / by)) * 4;
      out.set(bytes.subarray(from, from + 4), (y * width * by + x) * 4);
    }
  }
  return out;
}

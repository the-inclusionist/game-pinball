// SPDX-License-Identifier: AGPL-3.0-or-later
// tests/helpers/png — a minimal PNG writer, so the visual gate has an artefact somebody can LOOK at.
//
// It exists because the alternative was comparing numbers over a buffer and calling that visual
// verification. A PNG on disk can be checked by a human, and it is the only way the plan's "compare
// against pinball.alula.me" stops being a figure of speech.
//
// 8-bit RGBA, no filtering (a zero byte per row), Node's own deflate. It is not optimized and does not
// need to be: it is test tooling, not game code.
import { deflateSync } from 'node:zlib';

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

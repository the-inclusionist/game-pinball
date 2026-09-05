// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { zmap16 } from './helpers/partout.js';
import { readZMap } from '../app/js/dat/zmap.js';

describe('zmap — 16-bit depth', () => {
  test('reads dimensions and depths', () => {
    const payload = zmap16({ width: 2, height: 2, depths: new Uint16Array([10, 20, 30, 40]) });

    const z = readZMap(payload);

    expect(z.width).toBe(2);
    expect(z.height).toBe(2);
    expect(z.depths).toEqual(new Uint16Array([10, 20, 30, 40]));
  });

  test('the stride may exceed the width, and the surplus is not part of the row', () => {
    // Stride 3 with width 2: each row carries one padding cell at the end.
    const payload = zmap16({ width: 2, height: 2, stride: 3, depths: new Uint16Array([1, 2, 99, 3, 4, 99]) });

    const z = readZMap(payload);

    expect(z.stride).toBe(3);
    expect(z.depthAt(0, 1)).toBe(3); // first column of the second row: skips the padding
    expect(z.depthAt(1, 1)).toBe(4);
  });

  test('a zeroed header becomes an EMPTY z-map rather than throwing', () => {
    // Groups 497 and 498 of PINBALL.DAT carry a zeroed z-map header, and the original skips them. A
    // reader trusting the header would try to allocate 0 cells and read N bytes, or worse, the reverse.
    const payload = new Uint8Array(14 + 8); // all-zero header, with payload behind it

    const z = readZMap(payload);

    expect(z.empty).toBe(true);
    expect(z.depths).toHaveLength(0);
  });
});

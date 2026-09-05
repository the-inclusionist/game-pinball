// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { bitmap8, FLAG_BITMAP } from './helpers/partout.js';
import { lerCabecalhoDeBitmap } from '../app/js/dat/bitmap8.js';

describe('bitmap8 — cabecalho', () => {
  test('le dimensoes, posicao e tamanho dos dados', () => {
    const payload = bitmap8({ largura: 365, altura: 470, x: 12, y: 34, dados: new Uint8Array(7) });

    const c = lerCabecalhoDeBitmap(payload);

    expect(c.largura).toBe(365);
    expect(c.altura).toBe(470);
    expect(c.x).toBe(12);
    expect(c.y).toBe(34);
    expect(c.tamanhoDosDados).toBe(7);
  });

  test('resolucao -1 significa "vale em todas as resolucoes"', () => {
    const payload = bitmap8({ resolucao: -1, largura: 1, altura: 1, dados: new Uint8Array(1) });

    expect(lerCabecalhoDeBitmap(payload).resolucao).toBe(-1);
  });

  test('separa os tres bits de flag em vez de devolver o byte cru', () => {
    const payload = bitmap8({
      largura: 1, altura: 1, dados: new Uint8Array(1),
      flags: FLAG_BITMAP.dib | FLAG_BITMAP.spliced,
    });

    const c = lerCabecalhoDeBitmap(payload);

    expect(c.ehDib).toBe(true);
    expect(c.ehSpliced).toBe(true);
    expect(c.alinhadoBruto).toBe(false);
  });
});

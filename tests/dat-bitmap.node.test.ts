// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { bitmap8, FLAG_BITMAP } from './helpers/partout.js';
import { lerCabecalhoDeBitmap, TipoDeBitmap } from '../app/js/dat/bitmap8.js';

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
    expect(c.brutoDesalinhado).toBe(false);
  });
});

describe('bitmap8 — tipo derivado dos flags', () => {
  // A precedencia e do gdrv.cpp e NAO e comutativa: Spliced e testado primeiro, depois Dib, e o resto
  // cai em Raw. Um leitor que testasse Dib antes classificaria errado todo bitmap com os dois bits.
  test('spliced vence dib quando os dois bits estao ligados', () => {
    const p = bitmap8({ largura: 4, altura: 1, dados: new Uint8Array(4), flags: FLAG_BITMAP.dib | FLAG_BITMAP.spliced });

    expect(lerCabecalhoDeBitmap(p).tipo).toBe(TipoDeBitmap.Spliced);
  });

  test('sem spliced, o bit de dib decide', () => {
    const p = bitmap8({ largura: 4, altura: 1, dados: new Uint8Array(4), flags: FLAG_BITMAP.dib });

    expect(lerCabecalhoDeBitmap(p).tipo).toBe(TipoDeBitmap.Dib);
  });

  test('sem bit nenhum, e bitmap cru', () => {
    const p = bitmap8({ largura: 4, altura: 1, dados: new Uint8Array(4), flags: 0 });

    expect(lerCabecalhoDeBitmap(p).tipo).toBe(TipoDeBitmap.Bruto);
  });
});

describe('bitmap8 — stride indexado', () => {
  // As linhas do bitmap INDEXADO (8bpp) sao preenchidas ate um multiplo de 4 bytes; o buffer de destino
  // em cor, nao. Sao dois strides diferentes no mesmo objeto, e confundi-los inclina a imagem.
  test('largura nao multipla de 4 sobe ao proximo multiplo', () => {
    const p = bitmap8({ largura: 365, altura: 2, dados: new Uint8Array(368 * 2), flags: FLAG_BITMAP.brutoDesalinhado });

    expect(lerCabecalhoDeBitmap(p).strideIndexado).toBe(368);
  });

  test('largura ja multipla de 4 mantem o stride igual a largura', () => {
    const p = bitmap8({ largura: 364, altura: 1, dados: new Uint8Array(364) });

    expect(lerCabecalhoDeBitmap(p).strideIndexado).toBe(364);
  });

  test('o spliced nao tem linhas, entao nao tem stride indexado', () => {
    const p = bitmap8({ largura: 365, altura: 470, dados: new Uint8Array(7), flags: FLAG_BITMAP.spliced });

    expect(lerCabecalhoDeBitmap(p).strideIndexado).toBeNull();
  });
});

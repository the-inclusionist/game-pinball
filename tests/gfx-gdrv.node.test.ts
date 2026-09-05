// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { montarPaletaDeExibicao, aplicarPaleta } from '../app/js/gfx/gdrv.js';
import { empacotar } from '../app/js/gfx/framebuffer.js';

/** Uma paleta de arquivo em que a cor `i` vale (i, i+1, i+2). */
const paletaFalsa = {
  length: 256,
  vermelho: (i: number) => i & 0xff,
  verde: (i: number) => (i + 1) & 0xff,
  azul: (i: number) => (i + 2) & 0xff,
  alfa: () => 0,
};

describe('gdrv — a paleta de exibicao', () => {
  test('o indice 0 e TRANSPARENTE, e e por isso que o teste de transparencia e "cor != 0"', () => {
    expect(montarPaletaDeExibicao(paletaFalsa)[0]).toBe(0);
  });

  test('os indices 1 a 9 sao a paleta de sistema do Windows, fixa no codigo', () => {
    const p = montarPaletaDeExibicao(paletaFalsa);

    expect(p[1]).toBe(empacotar(0x80, 0, 0, 0xff));
    expect(p[7]).toBe(empacotar(0xc0, 0xc0, 0xc0, 0xff));
    expect(p[9]).toBe(empacotar(0xa6, 0xca, 0xf0, 0xff));
  });

  test('as cores do arquivo (10 a 245) saem OPACAS — o alfa 2 do original e sentinela', () => {
    // O upstream faz `SetAlpha(2)` nessas cores. Nao e opacidade: o SDL ignora o alfa naquele caminho,
    // e o 2 so precisa ser NAO-ZERO para o teste `Color != 0` classificar o pixel como desenhavel.
    // O canvas NAO ignora o alfa: copiar o 2 pintaria a mesa inteira a 0,8% de opacidade.
    // Traduzir o sentinela para 255 preserva a semantica exata e corrige o meio.
    const p = montarPaletaDeExibicao(paletaFalsa);

    expect(p[10]).toBe(empacotar(10, 11, 12, 0xff));
    expect(p[245]).toBe(empacotar(245, 246, 247, 0xff));
  });

  test('os indices 246 a 254 nunca sao atribuidos e ficam transparentes', () => {
    const p = montarPaletaDeExibicao(paletaFalsa);

    expect(p[246]).toBe(0);
    expect(p[254]).toBe(0);
  });

  test('o indice 255 e branco opaco', () => {
    expect(montarPaletaDeExibicao(paletaFalsa)[255]).toBe(empacotar(255, 255, 255, 255));
  });
});

describe('gdrv — aplicar a paleta', () => {
  test('converte indices em cores, do tamanho pedido', () => {
    const p = montarPaletaDeExibicao(paletaFalsa);
    const indices = new Uint8Array([255, 0, 10, 1]);

    const fb = aplicarPaleta(indices, p, 2, 2);

    expect(fb.largura).toBe(2);
    expect(fb.pixels[0]).toBe(empacotar(255, 255, 255, 255));
    expect(fb.pixels[1]).toBe(0);
    expect(fb.pixels[2]).toBe(empacotar(10, 11, 12, 0xff));
  });
});

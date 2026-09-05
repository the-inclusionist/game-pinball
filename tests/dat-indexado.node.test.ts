// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { desempacotarIndexado } from '../app/js/dat/indexado.js';

describe('indexado — desempacotamento das linhas', () => {
  test('inverte as linhas: a ULTIMA do arquivo e a primeira da imagem', () => {
    // O gdrv::ApplyPalette percorre a origem de Height-1 ate 0 escrevendo o destino de cima para baixo.
    // E a convencao DIB do Windows. Ler na ordem direta produz a mesa de cabeca para baixo — e o
    // comentario do proprio upstream ali diz "flip horizontally", que esta errado: a inversao e vertical.
    const dados = new Uint8Array([
      10, 11, // linha de baixo na imagem
      20, 21, // linha de cima na imagem
    ]);

    const r = desempacotarIndexado(dados, { largura: 2, altura: 2, strideIndexado: 2 });

    expect(Array.from(r)).toEqual([20, 21, 10, 11]);
  });

  test('le com o stride indexado e descarta o preenchimento de fim de linha', () => {
    // Largura 3 sobe o stride para 4: cada linha tem um byte de preenchimento que nao e imagem.
    const dados = new Uint8Array([
      1, 2, 3, 0xee,
      4, 5, 6, 0xee,
    ]);

    const r = desempacotarIndexado(dados, { largura: 3, altura: 2, strideIndexado: 4 });

    expect(Array.from(r)).toEqual([4, 5, 6, 1, 2, 3]);
  });

  test('o resultado tem exatamente largura x altura celulas', () => {
    const r = desempacotarIndexado(new Uint8Array(4 * 5), { largura: 3, altura: 5, strideIndexado: 4 });

    expect(r).toHaveLength(15);
  });
});

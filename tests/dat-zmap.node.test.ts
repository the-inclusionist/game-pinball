// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { zmap16 } from './helpers/partout.js';
import { lerZMap } from '../app/js/dat/zmap.js';

describe('zmap — profundidade de 16 bits', () => {
  test('le dimensoes e profundidades', () => {
    const payload = zmap16({ largura: 2, altura: 2, dados: new Uint16Array([10, 20, 30, 40]) });

    const z = lerZMap(payload);

    expect(z.largura).toBe(2);
    expect(z.altura).toBe(2);
    expect(z.profundidades).toEqual(new Uint16Array([10, 20, 30, 40]));
  });

  test('o stride pode ser maior que a largura, e as sobras nao entram na leitura por linha', () => {
    // stride 3 com largura 2: cada linha tem uma celula de preenchimento no fim.
    const payload = zmap16({ largura: 2, altura: 2, stride: 3, dados: new Uint16Array([1, 2, 99, 3, 4, 99]) });

    const z = lerZMap(payload);

    expect(z.stride).toBe(3);
    expect(z.profundidadeEm(0, 1)).toBe(3); // primeira coluna da segunda linha: pula o preenchimento
    expect(z.profundidadeEm(1, 1)).toBe(4);
  });

  test('cabecalho zerado vira z-map VAZIO em vez de estourar', () => {
    // Os grupos 497 e 498 do PINBALL.DAT tem o cabecalho de z-map zerado, e o original os pula.
    // Um leitor que confiasse no cabecalho tentaria alocar 0 celulas e ler N bytes, ou pior, o inverso.
    const payload = new Uint8Array(14 + 8); // cabecalho todo zero, mas com carga atras dele

    const z = lerZMap(payload);

    expect(z.vazio).toBe(true);
    expect(z.profundidades).toHaveLength(0);
  });
});

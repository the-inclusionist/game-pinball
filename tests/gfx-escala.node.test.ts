// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { criarFramebuffer, empacotar } from '../app/js/gfx/framebuffer.js';
import { criarZBuffer } from '../app/js/gfx/zbuffer.js';
import { reduzirPelaMetade, reduzirPelaMetadeVizinho, reduzirProfundidadePelaMetade } from '../app/js/gfx/escala.js';

const OPACO = (r: number, g: number, b: number) => empacotar(r, g, b, 255);

function fbCom(largura: number, altura: number, cores: number[]) {
  const fb = criarFramebuffer(largura, altura);
  cores.forEach((c, i) => { fb.pixels[i] = c; });
  return fb;
}

describe('escala — media de caixa (2x2)', () => {
  test('cada pixel de saida e a media dos quatro de entrada', () => {
    const fb = fbCom(2, 2, [OPACO(0, 0, 0), OPACO(100, 100, 100), OPACO(200, 200, 200), OPACO(60, 60, 60)]);

    const r = reduzirPelaMetade(fb);

    expect([r.largura, r.altura]).toEqual([1, 1]);
    expect(r.pixels[0]).toBe(OPACO(90, 90, 90)); // (0+100+200+60)/4
  });

  test('dimensao impar arredonda para CIMA e a borda usa o que houver', () => {
    // 365 vira 183, nao 182: descartar a ultima coluna cortaria uma tira da mesa.
    const fb = fbCom(3, 1, [OPACO(10, 10, 10), OPACO(30, 30, 30), OPACO(80, 80, 80)]);

    const r = reduzirPelaMetade(fb);

    expect(r.largura).toBe(2);
    expect(r.pixels[0]).toBe(OPACO(20, 20, 20)); // media de 10 e 30
    expect(r.pixels[1]).toBe(OPACO(80, 80, 80)); // sozinho na borda
  });

  test('pixel transparente NAO contamina a cor do vizinho', () => {
    // Uma media ingenua somaria o (0,0,0,0) como preto e escureceria toda borda de sprite — o classico
    // halo escuro de quem mistura cor sem pesar pelo alfa.
    const fb = fbCom(2, 2, [OPACO(255, 0, 0), OPACO(255, 0, 0), 0, 0]);

    const r = reduzirPelaMetade(fb);

    expect(r.bytes[0]).toBe(255); // vermelho intacto
    expect(r.bytes[1]).toBe(0);
    expect(r.bytes[3]).toBe(128); // alfa e a media: dois opacos em quatro
  });

  test('quatro transparentes dao transparente, e nao preto', () => {
    expect(reduzirPelaMetade(criarFramebuffer(2, 2)).pixels[0]).toBe(0);
  });
});

describe('escala — vizinho mais proximo', () => {
  test('amostra o pixel de cima-a-esquerda de cada bloco, como o ScaleIndexed do original', () => {
    const fb = fbCom(2, 2, [OPACO(1, 1, 1), OPACO(2, 2, 2), OPACO(3, 3, 3), OPACO(4, 4, 4)]);

    expect(reduzirPelaMetadeVizinho(fb).pixels[0]).toBe(OPACO(1, 1, 1));
  });
});

describe('escala — profundidade', () => {
  test('AMOSTRA e nao faz media: a media inventaria uma superficie que nao existe', () => {
    // Entre uma rampa a 100 e o tampo a 500 nao ha nada a 300. Uma profundidade media poria a bola
    // dentro da rampa em metade dos pixels da borda.
    const z = criarZBuffer(2, 2);
    z.profundidades.set([100, 500, 500, 500]);

    const r = reduzirProfundidadePelaMetade(z);

    expect(r.profundidades[0]).toBe(100);
  });
});

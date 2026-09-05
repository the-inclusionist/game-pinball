// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { criarFramebuffer, empacotar } from '../app/js/gfx/framebuffer.js';
import { criarZBuffer, preencherZ, pintar, pintarPlano, LONGE } from '../app/js/gfx/zbuffer.js';

const COR_A = empacotar(10, 20, 30, 255);
const COR_B = empacotar(40, 50, 60, 255);

/** Um par cena/profundidade de 1x1, com a cena ja preenchida. */
function cena(profundidade: number) {
  const fb = criarFramebuffer(1, 1);
  const z = criarZBuffer(1, 1);
  fb.pixels[0] = COR_A;
  preencherZ(z, profundidade);
  return { fb, z };
}

describe('zbuffer — pintar (sprite com profundidade propria)', () => {
  test('escreve cor E profundidade quando a origem esta mais perto', () => {
    const d = cena(500);
    const o = cena(100); o.fb.pixels[0] = COR_B;

    pintar(d.fb, d.z, o.fb, o.z, { largura: 1, altura: 1 });

    expect(d.fb.pixels[0]).toBe(COR_B);
    expect(d.z.profundidades[0]).toBe(100);
  });

  test('nao escreve nada quando a origem esta mais longe', () => {
    const d = cena(100);
    const o = cena(500); o.fb.pixels[0] = COR_B;

    pintar(d.fb, d.z, o.fb, o.z, { largura: 1, altura: 1 });

    expect(d.fb.pixels[0]).toBe(COR_A);
    expect(d.z.profundidades[0]).toBe(100);
  });

  test('no EMPATE a origem vence, entao o ultimo desenhado fica por cima', () => {
    // O original compara `dstZ >= srcZ`. O `=` nao e detalhe: e o que decide a ordem entre dois sprites
    // na mesma profundidade, e trocar por `>` inverteria silenciosamente quem aparece.
    const d = cena(300);
    const o = cena(300); o.fb.pixels[0] = COR_B;

    pintar(d.fb, d.z, o.fb, o.z, { largura: 1, altura: 1 });

    expect(d.fb.pixels[0]).toBe(COR_B);
  });
});

describe('zbuffer — pintarPlano (sprite a uma profundidade so, como a bola)', () => {
  test('desenha onde a cena esta mais longe que a bola', () => {
    const d = cena(500);
    const bola = criarFramebuffer(1, 1); bola.pixels[0] = COR_B;

    pintarPlano(d.fb, d.z, bola, 100, { largura: 1, altura: 1 });

    expect(d.fb.pixels[0]).toBe(COR_B);
  });

  test('NAO altera a profundidade da cena — a bola nao deixa relevo', () => {
    const d = cena(500);
    const bola = criarFramebuffer(1, 1); bola.pixels[0] = COR_B;

    pintarPlano(d.fb, d.z, bola, 100, { largura: 1, altura: 1 });

    expect(d.z.profundidades[0]).toBe(500);
  });

  test('usa > ESTRITO: no empate a bola nao aparece', () => {
    // Aqui o original usa `*zPtr > depth`, e nao `>=` como em `pintar`. As duas comparacoes diferem de
    // proposito, e uniformiza-las faria a bola piscar nas bordas das rampas.
    const d = cena(300);
    const bola = criarFramebuffer(1, 1); bola.pixels[0] = COR_B;

    pintarPlano(d.fb, d.z, bola, 300, { largura: 1, altura: 1 });

    expect(d.fb.pixels[0]).toBe(COR_A);
  });

  test('pula pixel de origem totalmente transparente', () => {
    const d = cena(500);
    const bola = criarFramebuffer(1, 1); // zero = transparente

    pintarPlano(d.fb, d.z, bola, 100, { largura: 1, altura: 1 });

    expect(d.fb.pixels[0]).toBe(COR_A);
  });
});

describe('zbuffer — forma', () => {
  test('o stride sobe ao proximo multiplo de 4, como o pad() do original', () => {
    expect(criarZBuffer(365, 2).stride).toBe(368);
    expect(criarZBuffer(364, 2).stride).toBe(364);
  });

  test('nasce no mais LONGE possivel', () => {
    // Nascer em zero poria o fundo na frente de tudo e nada seria desenhado.
    expect(criarZBuffer(2, 1).profundidades[0]).toBe(LONGE);
  });
});

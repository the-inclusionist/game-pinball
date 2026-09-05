// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { colisaoBasica, type EstadoDaBola } from '../app/js/physics/colisao.js';

const bola = (dx: number, dy: number, velocidade: number): EstadoDaBola =>
  ({ posicao: { x: 0, y: 0 }, direcao: { x: dx, y: dy }, velocidade });

/** Sem impulso: limiar inatingivel isola o quique do empurrao do bumper. */
const SEM_IMPULSO = { limiar: 1e9, impulso: 0 };

describe('colisao basica — o empurrao anti-grude', () => {
  test('a bola e reposicionada 0,0005 ALEM do ponto de contato', () => {
    // Sem esse deslocamento a bola fica exatamente sobre a superficie, o proximo quadro a detecta em
    // colisao de novo, e ela gruda vibrando. E o mesmo truque de todo motor 2D, e o original o faz aqui.
    const b = bola(0, -1, 10);

    colisaoBasica(b, { x: 10, y: 10 }, { x: 0, y: 1 }, { elasticidade: 1, suavidade: 1, ...SEM_IMPULSO });

    expect(b.posicao.x).toBeCloseTo(10);
    expect(b.posicao.y).toBeCloseTo(10.0005);
  });
});

describe('colisao basica — o quique', () => {
  test('elasticidade 1 inverte a direcao e conserva a velocidade', () => {
    const b = bola(0, -1, 10);

    colisaoBasica(b, { x: 0, y: 0 }, { x: 0, y: 1 }, { elasticidade: 1, suavidade: 1, ...SEM_IMPULSO });

    expect(b.direcao.y).toBeCloseTo(1);
    expect(b.velocidade).toBeCloseTo(10);
  });

  test('elasticidade 0,5 inverte a direcao e tira metade da velocidade', () => {
    const b = bola(0, -1, 10);

    const perdida = colisaoBasica(b, { x: 0, y: 0 }, { x: 0, y: 1 }, { elasticidade: 0.5, suavidade: 1, ...SEM_IMPULSO });

    expect(b.direcao.y).toBeCloseTo(1);
    expect(b.velocidade).toBeCloseTo(5);
    expect(perdida).toBeCloseTo(10); // o retorno e a velocidade DO REBOTE, nao a que sobrou
  });

  test('bola que ja se AFASTA nao muda de direcao, mas ainda perde velocidade', () => {
    // A projecao negativa significa "os dois vetores apontam para o mesmo lado". O original toma o
    // modulo e segue: a direcao fica, a perda de energia acontece. Ignorar o caso deixaria a bola
    // ganhar energia ao raspar uma superficie de onde ja estava saindo.
    const b = bola(0, 1, 10);

    colisaoBasica(b, { x: 0, y: 0 }, { x: 0, y: 1 }, { elasticidade: 0.5, suavidade: 1, ...SEM_IMPULSO });

    expect(b.direcao.y).toBeCloseTo(1);
    expect(b.velocidade).toBeCloseTo(5);
  });
});

describe('colisao basica — o impulso do bumper', () => {
  test('acima do limiar, o impulso ACELERA a bola', () => {
    const b = bola(0, -1, 10);

    colisaoBasica(b, { x: 0, y: 0 }, { x: 0, y: 1 }, { elasticidade: 1, suavidade: 1, limiar: 1, impulso: 20 });

    expect(b.velocidade).toBeCloseTo(30); // 10 de volta + 20 de impulso
    expect(b.direcao.y).toBeCloseTo(1);
  });

  test('abaixo do limiar, o impulso nao entra — e por isso que um bumper so responde a batida forte', () => {
    const b = bola(0, -1, 10);

    colisaoBasica(b, { x: 0, y: 0 }, { x: 0, y: 1 }, { elasticidade: 1, suavidade: 1, limiar: 100, impulso: 20 });

    expect(b.velocidade).toBeCloseTo(10);
  });
});

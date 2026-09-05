// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import {
  SEM_COLISAO, produtoVetorial, produtoEscalar, normalizar2d,
  raioIntersectaCirculo, iniciarLinha, raioIntersectaLinha,
} from '../app/js/maths/maths.js';

const raio = (ox: number, oy: number, dx: number, dy: number, max = 100, min = 0) =>
  ({ origem: { x: ox, y: oy }, direcao: { x: dx, y: dy }, distanciaMaxima: max, distanciaMinima: min, mascaraDeColisao: 0 });

describe('maths — vetores', () => {
  test('o produto vetorial 2D e X1*Y2 - Y1*X2, e o sinal e o que diz de que lado', () => {
    expect(produtoVetorial({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(1);
    expect(produtoVetorial({ x: 0, y: 1 }, { x: 1, y: 0 })).toBe(-1);
  });

  test('normalizar devolve a magnitude ANTERIOR e deixa o vetor unitario', () => {
    const v = { x: 3, y: 4 };

    expect(normalizar2d(v)).toBe(5);
    expect(v).toEqual({ x: 0.6, y: 0.8 });
  });

  test('normalizar um vetor nulo nao divide por zero', () => {
    const v = { x: 0, y: 0 };

    expect(normalizar2d(v)).toBe(0);
    expect(v).toEqual({ x: 0, y: 0 });
  });

  test('produto escalar', () => {
    expect(produtoEscalar({ x: 2, y: 3 }, { x: 4, y: 5 })).toBe(23);
  });
});

describe('maths — raio contra circulo', () => {
  const circulo = (cx: number, cy: number, r: number) => ({ centro: { x: cx, y: cy }, raioAoQuadrado: r * r });

  test('acerta na PRIMEIRA interseccao, nao na segunda', () => {
    // Circulo de raio 2 em (5,0), raio partindo da origem: entra em x=3 e sai em x=7.
    expect(raioIntersectaCirculo(raio(0, 0, 1, 0), circulo(5, 0, 2))).toBeCloseTo(3);
  });

  test('apontando para o lado contrario, nao acerta', () => {
    expect(raioIntersectaCirculo(raio(0, 0, -1, 0), circulo(5, 0, 2))).toBe(SEM_COLISAO);
  });

  test('passando ao lado, nao acerta', () => {
    expect(raioIntersectaCirculo(raio(0, 0, 1, 0), circulo(5, 5, 1))).toBe(SEM_COLISAO);
  });

  test('origem DENTRO do circulo devolve distancia NEGATIVA — e como a bola e empurrada para fora', () => {
    // Sem isto, uma bola que ja penetrou o circulo nunca sairia: a distancia positiva mais proxima
    // esta atras dela. O sinal negativo e a instrucao de recuar.
    expect(raioIntersectaCirculo(raio(0, 0, 1, 0), circulo(0, 0, 2))).toBeCloseTo(-2);
  });

  test('dentro do circulo mas AFASTANDO-SE do centro, nao acerta', () => {
    // O `Tca < 0` corta antes do teste de "esta dentro". E deliberado no original: quem ja esta saindo
    // nao e empurrado de novo.
    expect(raioIntersectaCirculo(raio(1, 0, 1, 0), circulo(0, 0, 2))).toBe(SEM_COLISAO);
  });

  test('acerto alem da distancia maxima nao conta', () => {
    expect(raioIntersectaCirculo(raio(0, 0, 1, 0), circulo(5, 0, 2), )).toBeCloseTo(3);
    expect(raioIntersectaCirculo(raio(0, 0, 1, 0, 2), circulo(5, 0, 2))).toBe(SEM_COLISAO);
  });
});

describe('maths — iniciar linha', () => {
  test('a perpendicular e a HORARIA da direcao', () => {
    const l = iniciarLinha(0, 0, 10, 0);

    expect(l.direcao).toEqual({ x: 1, y: 0 });
    expect(l.perpendicular).toEqual({ x: 0, y: -1 });
  });

  test('linha quase vertical zera a direcao em X e passa a medir o segmento em Y', () => {
    // Sem esse encaixe no zero, o teste `direcao.x !== 0` la em `raioIntersectaLinha` usaria a
    // coordenada X de uma linha vertical — em que todo ponto tem o mesmo X — e o segmento inteiro
    // viraria um ponto. A colisao passaria a valer em qualquer altura.
    const l = iniciarLinha(3, 0, 3, 10);

    expect(l.direcao.x).toBe(0);
    expect([l.coordMin, l.coordMax]).toEqual([0, 10]);
  });

  test('linha horizontal mede o segmento em X', () => {
    const l = iniciarLinha(10, 0, 0, 0);

    expect([l.coordMin, l.coordMax]).toEqual([0, 10]);
  });
});

describe('maths — raio contra linha', () => {
  // Linha de (10,0) a (0,0): direcao (-1,0). O sentido em que ela foi DECLARADA decide qual face colide.
  const parede = () => iniciarLinha(10, 0, 0, 0);

  test('acerta vindo da face de colisao', () => {
    const l = parede();

    expect(raioIntersectaLinha(raio(5, 5, 0, -1), l)).toBeCloseTo(5);
    expect(l.interseccao.x).toBeCloseTo(5);
    expect(l.interseccao.y).toBeCloseTo(0);
  });

  test('vindo da face de TRAS, atravessa — a linha e de um lado so', () => {
    // Nao e defeito: e o que permite ao original usar linhas como portoes de mao unica, e o que
    // impede a bola de ficar presa quando penetra uma parede por um quadro.
    expect(raioIntersectaLinha(raio(5, -5, 0, 1), parede())).toBe(SEM_COLISAO);
  });

  test('a interseccao fora do SEGMENTO nao conta', () => {
    // Passa pela reta infinita em x=15, mas o segmento vai so de 0 a 10.
    expect(raioIntersectaLinha(raio(15, 5, 0, -1), parede())).toBe(SEM_COLISAO);
  });

  test('acerto alem da distancia maxima nao conta', () => {
    expect(raioIntersectaLinha(raio(5, 5, 0, -1, 2), parede())).toBe(SEM_COLISAO);
  });

  test('a distancia minima permite acerto ligeiramente NEGATIVO — a tolerancia de penetracao', () => {
    // Bola meio pixel abaixo da parede: sem a tolerancia ela cairia atraves.
    expect(raioIntersectaLinha(raio(5, -0.1, 0, -1, 100, 1), parede())).toBeCloseTo(-0.1);
  });
});

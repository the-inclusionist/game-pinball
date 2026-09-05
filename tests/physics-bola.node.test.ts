// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { criarMemoriaDeColisoes, LIMITE_DE_COLISOES } from '../app/js/physics/bola.js';
import type { Aresta } from '../app/js/physics/grade.js';

const aresta = (n: number): Aresta =>
  ({ ativa: true, grupoDeColisao: 0xffff, distanciaDeColisao: () => n, aoColidir: () => {} });

describe('bola — memoria de arestas ja atingidas no quadro', () => {
  test('lembra o que atingiu', () => {
    const m = criarMemoriaDeColisoes();
    const a = aresta(1);

    expect(m.jaAtingiu(a)).toBe(false);
    m.registrar(a);
    expect(m.jaAtingiu(a)).toBe(true);
  });

  test('guarda ate dezesseis', () => {
    const m = criarMemoriaDeColisoes();
    const arestas = Array.from({ length: LIMITE_DE_COLISOES }, (_, i) => aresta(i));

    arestas.forEach((a) => m.registrar(a));

    expect(arestas.every((a) => m.jaAtingiu(a))).toBe(true);
  });

  test('na decima setima, DESCARTA as oito mais antigas e recomeca em nove', () => {
    // Nao e um anel circular comum: o original copia as oito de cima para baixo, poe a nova no indice
    // 8 e zera a contagem em 9. O efeito e uma memoria que ESQUECE METADE de uma vez, em vez de
    // esquecer a mais antiga a cada nova. Transcrito porque a fisica depende de quanto ela lembra:
    // esquecer cedo demais deixa a bola bater duas vezes na mesma aresta no mesmo quadro.
    const m = criarMemoriaDeColisoes();
    const arestas = Array.from({ length: 17 }, (_, i) => aresta(i));

    arestas.forEach((a) => m.registrar(a));

    // As oito primeiras foram embora.
    expect(arestas.slice(0, 8).some((a) => m.jaAtingiu(a))).toBe(false);
    // As oito seguintes ficaram, e a decima setima entrou.
    expect(arestas.slice(8, 16).every((a) => m.jaAtingiu(a))).toBe(true);
    expect(m.jaAtingiu(arestas[16]!)).toBe(true);
  });

  test('esquecer limpa tudo', () => {
    const m = criarMemoriaDeColisoes();
    const a = aresta(1);
    m.registrar(a);

    m.esquecer();

    expect(m.jaAtingiu(a)).toBe(false);
  });
});

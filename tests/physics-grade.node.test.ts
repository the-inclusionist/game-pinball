// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { criarGerenciadorDeArestas, CAIXAS_X, CAIXAS_Y, type Aresta } from '../app/js/physics/grade.js';
import { SEM_COLISAO, type Raio } from '../app/js/maths/maths.js';

/** Uma aresta de mentira que devolve distancia fixa e CONTA quantas vezes foi consultada. */
function arestaFalsa(distancia: number, opcoes: Partial<Aresta> = {}) {
  let consultas = 0;
  const a: Aresta = {
    ativa: true,
    grupoDeColisao: 0xffff,
    distanciaDeColisao: () => { consultas++; return distancia; },
    ...opcoes,
  };
  return { a, consultas: () => consultas };
}

const raio = (ox: number, oy: number, dx: number, dy: number, max = 100): Raio =>
  ({ origem: { x: ox, y: oy }, direcao: { x: dx, y: dy }, distanciaMaxima: max, distanciaMinima: 0, mascaraDeColisao: 0xffff });

/** Mesa de 100x150 na origem: cada caixa fica com 10x10. */
const grade = () => criarGerenciadorDeArestas(0, 0, 100, 150);

describe('grade — geometria', () => {
  test('a grade e FIXA em 10x15 caixas, e nao derivada do tamanho da mesa', () => {
    // Vale para qualquer mesa: o original fixa 10 e 15 no construtor. Uma mesa maior ganha caixas
    // maiores, nao mais caixas — e e por isso que o custo por consulta nao cresce com a mesa.
    expect([CAIXAS_X, CAIXAS_Y]).toEqual([10, 15]);
    const g = grade();
    expect([g.avancoX, g.avancoY]).toEqual([10, 10]);
  });

  test('mapeia coordenada para caixa por piso', () => {
    const g = grade();

    expect(g.caixaX(0)).toBe(0);
    expect(g.caixaX(9.99)).toBe(0);
    expect(g.caixaX(10)).toBe(1);
    expect(g.caixaY(145)).toBe(14);
  });

  test('coordenada FORA da mesa e presa na caixa de borda, e nao rejeitada', () => {
    // A bola sai da mesa em situacoes normais (o dreno, a calha do plunger). Prender em vez de recusar
    // e o que faz as arestas de borda continuarem sendo testadas quando ela esta la fora.
    const g = grade();

    expect(g.caixaX(-500)).toBe(0);
    expect(g.caixaX(99999)).toBe(9);
    expect(g.caixaY(-1)).toBe(0);
    expect(g.caixaY(99999)).toBe(14);
  });
});

describe('grade — busca de colisao', () => {
  test('encontra a aresta da caixa em que o raio esta', () => {
    const g = grade();
    const { a } = arestaFalsa(7);
    g.adicionarAresta(0, 0, a);

    const r = g.encontrarDistanciaDeColisao(raio(5, 5, 1, 0, 3));

    expect(r.distancia).toBe(7);
    expect(r.aresta).toBe(a);
  });

  test('a aresta MAIS PROXIMA vence, mesmo estando numa caixa posterior', () => {
    const g = grade();
    const longe = arestaFalsa(40);
    const perto = arestaFalsa(12);
    g.adicionarAresta(0, 0, longe.a);
    g.adicionarAresta(1, 0, perto.a);

    expect(g.encontrarDistanciaDeColisao(raio(5, 5, 1, 0, 50)).aresta).toBe(perto.a);
  });

  test('uma aresta que ocupa DUAS caixas e consultada UMA vez', () => {
    // Uma parede longa e registrada em toda caixa que ela atravessa. Sem a marca de "ja processada",
    // um raio que cruzasse tres caixas pagaria tres vezes pela mesma parede — e o custo cresceria com
    // o comprimento da parede, que e exatamente o que a grade existe para evitar.
    const g = grade();
    const { a, consultas } = arestaFalsa(40);
    g.adicionarAresta(0, 0, a);
    g.adicionarAresta(1, 0, a);
    g.adicionarAresta(2, 0, a);

    g.encontrarDistanciaDeColisao(raio(5, 5, 1, 0, 50));

    expect(consultas()).toBe(1);
  });

  test('a marca de processada NAO sobrevive a consulta seguinte', () => {
    // Ela e limpa no fim de cada busca. Se vazasse, a aresta ficaria invisivel para sempre depois do
    // primeiro quadro — e o sintoma seria a bola atravessando uma parede que ja funcionou.
    const g = grade();
    const { a, consultas } = arestaFalsa(7);
    g.adicionarAresta(0, 0, a);

    g.encontrarDistanciaDeColisao(raio(5, 5, 1, 0, 3));
    g.encontrarDistanciaDeColisao(raio(5, 5, 1, 0, 3));

    expect(consultas()).toBe(2);
  });

  test('aresta INATIVA nao e consultada', () => {
    const g = grade();
    const { a, consultas } = arestaFalsa(7, { ativa: false });
    g.adicionarAresta(0, 0, a);

    expect(g.encontrarDistanciaDeColisao(raio(5, 5, 1, 0, 3)).distancia).toBe(SEM_COLISAO);
    expect(consultas()).toBe(0);
  });

  test('aresta de outro grupo de colisao nao e consultada', () => {
    const g = grade();
    const { a, consultas } = arestaFalsa(7, { grupoDeColisao: 0b0010 });
    g.adicionarAresta(0, 0, a);

    const r = { ...raio(5, 5, 1, 0, 3), mascaraDeColisao: 0b0001 };
    expect(g.encontrarDistanciaDeColisao(r).distancia).toBe(SEM_COLISAO);
    expect(consultas()).toBe(0);
  });

  test('aresta ja atingida neste quadro nao e consultada de novo', () => {
    const g = grade();
    const { a, consultas } = arestaFalsa(7);
    g.adicionarAresta(0, 0, a);

    g.encontrarDistanciaDeColisao(raio(5, 5, 1, 0, 3), (aresta) => aresta === a);

    expect(consultas()).toBe(0);
  });

  test('um raio diagonal visita as caixas que ele de fato atravessa', () => {
    const g = grade();
    const naDiagonal = arestaFalsa(99);
    const foraDoCaminho = arestaFalsa(1);
    g.adicionarAresta(2, 2, naDiagonal.a);
    g.adicionarAresta(9, 0, foraDoCaminho.a);

    // De (5,5) a (35,35): passa pelas caixas (0,0), (1,1), (2,2)... e nunca por (9,0).
    const d = Math.SQRT1_2;
    g.encontrarDistanciaDeColisao(raio(5, 5, d, d, 45));

    expect(naDiagonal.consultas()).toBe(1);
    expect(foraDoCaminho.consultas()).toBe(0);
  });
});

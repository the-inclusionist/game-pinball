// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { criarLinha, criarCirculo, deslocarLinha, type Componente } from '../app/js/physics/arestas.js';
import { criarGerenciadorDeArestas, registrarLinha, registrarCirculo, type Aresta } from '../app/js/physics/grade.js';
import { SEM_COLISAO, type Raio, type Vetor2 } from '../app/js/maths/maths.js';

const raio = (ox: number, oy: number, dx: number, dy: number, max = 100): Raio =>
  ({ origem: { x: ox, y: oy }, direcao: { x: dx, y: dy }, distanciaMaxima: max, distanciaMinima: 0.002, mascaraDeColisao: 0xffff });

/** Um componente que so anota o que recebeu. */
function espia() {
  const recebido: { posicao: Vetor2; direcao: Vetor2; distancia: number }[] = [];
  const c: Componente = {
    colisao: (_bola, posicao, direcao, distancia) => {
      recebido.push({ posicao: { ...posicao }, direcao: { ...direcao }, distancia });
    },
  };
  return { c, recebido };
}

const bolaQualquer = { posicao: { x: 0, y: 0 }, direcao: { x: 0, y: -1 }, velocidade: 1 };

describe('arestas — linha', () => {
  test('devolve a distancia do raio ao segmento', () => {
    const l = criarLinha({ componente: espia().c, inicio: { x: 10, y: 0 }, fim: { x: 0, y: 0 } });

    expect(l.distanciaDeColisao(raio(5, 5, 0, -1))).toBeCloseTo(5);
  });

  test('ao colidir, entrega ao componente o ponto de contato e a PERPENDICULAR', () => {
    const { c, recebido } = espia();
    const l = criarLinha({ componente: c, inicio: { x: 10, y: 0 }, fim: { x: 0, y: 0 } });
    l.distanciaDeColisao(raio(5, 5, 0, -1)); // preenche a interseccao, como no original

    l.aoColidir(bolaQualquer, 5);

    expect(recebido[0]!.posicao).toEqual({ x: 5, y: 0 });
    expect(recebido[0]!.direcao.y).toBeCloseTo(1); // normal para cima
    expect(recebido[0]!.distancia).toBe(5);
  });

  test('deslocar move a linha ao longo da PROPRIA perpendicular', () => {
    // E assim que uma parede e inflada pelo raio da bola: em vez de testar a bola como um circulo, o
    // original empurra a parede para fora e trata a bola como um ponto. Uma conta a menos por quadro,
    // por parede, por bola.
    const l = criarLinha({ componente: espia().c, inicio: { x: 10, y: 0 }, fim: { x: 0, y: 0 } });

    deslocarLinha(l, 2);

    // A perpendicular horaria de (-1,0) e (0,1): a linha sobe 2.
    expect(l.distanciaDeColisao(raio(5, 5, 0, -1))).toBeCloseTo(3);
  });
});

describe('arestas — circulo', () => {
  test('devolve a distancia do raio ao circulo', () => {
    const c = criarCirculo({ componente: espia().c, centro: { x: 5, y: 0 }, raio: 2 });

    expect(c.distanciaDeColisao(raio(0, 0, 1, 0))).toBeCloseTo(3);
  });

  test('ao colidir, entrega a normal RADIAL saindo do centro', () => {
    const { c, recebido } = espia();
    const circulo = criarCirculo({ componente: c, centro: { x: 5, y: 0 }, raio: 2 });
    const bola = { posicao: { x: 0, y: 0 }, direcao: { x: 1, y: 0 }, velocidade: 1 };

    circulo.aoColidir(bola, 3);

    expect(recebido[0]!.posicao).toEqual({ x: 3, y: 0 });
    expect(recebido[0]!.direcao.x).toBeCloseTo(-1); // do centro (5,0) para o contato (3,0)
  });
});

describe('grade — registro de arestas', () => {
  /** Quantas caixas contem esta aresta. */
  function caixasCom(g: ReturnType<typeof criarGerenciadorDeArestas>, a: Aresta): number {
    let n = 0;
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 15; y++) {
        if (g.arestasDaCaixa(x, y).includes(a)) n++;
      }
    }
    return n;
  }

  test('uma linha e registrada em TODAS as caixas que atravessa', () => {
    // Se ficasse so na caixa da ponta, a bola atravessaria a parede no meio dela.
    const g = criarGerenciadorDeArestas(0, 0, 100, 150); // caixas de 10x10
    const l = criarLinha({ componente: espia().c, inicio: { x: 5, y: 5 }, fim: { x: 95, y: 5 } });

    registrarLinha(g, l);

    expect(caixasCom(g, l)).toBe(10);
  });

  test('um circulo e registrado nas caixas que ele de fato toca', () => {
    const g = criarGerenciadorDeArestas(0, 0, 100, 150);
    const c = criarCirculo({ componente: espia().c, centro: { x: 15, y: 15 }, raio: 3 });

    registrarCirculo(g, c);

    // Raio 3 em torno de (15,15): fica inteiro dentro da caixa (1,1).
    expect(g.arestasDaCaixa(1, 1)).toContain(c);
    expect(g.arestasDaCaixa(0, 0)).not.toContain(c);
  });

  test('um circulo grande cobre as caixas vizinhas', () => {
    const g = criarGerenciadorDeArestas(0, 0, 100, 150);
    const c = criarCirculo({ componente: espia().c, centro: { x: 15, y: 15 }, raio: 8 });

    registrarCirculo(g, c);

    expect(g.arestasDaCaixa(0, 1)).toContain(c);
    expect(g.arestasDaCaixa(2, 1)).toContain(c);
  });

  test('a caixa DIAGONAL NAO entra, mesmo estando no quadrado envolvente', () => {
    // O caso que separa um teste de circulo de verdade de um teste de retangulo envolvente — e o unico
    // em que os dois discordam. Caixas de 10x10, centro em (18,18), raio 2,2:
    //   · o quadrado envolvente vai de 15,8 a 20,2, entao alcanca as caixas 1 e 2 nos dois eixos;
    //   · a caixa (2,1) dista 2 do centro (pela aresta x=20) e ENTRA;
    //   · a caixa (2,2) so encosta pelo canto (20,20), que dista 2,83 — e FICA DE FORA.
    // A primeira versao deste teste usava centro (17,17) e raio 2, cujo quadrado envolvente cabe
    // inteiro numa caixa so: a caixa diagonal nunca era sequer visitada, e o teste passava mesmo com o
    // teste de distancia removido. Foi a mutacao que mostrou isso, nao a leitura.
    const g = criarGerenciadorDeArestas(0, 0, 100, 150);
    const c = criarCirculo({ componente: espia().c, centro: { x: 18, y: 18 }, raio: 2.2 });

    registrarCirculo(g, c);

    expect(g.arestasDaCaixa(1, 1)).toContain(c);
    expect(g.arestasDaCaixa(2, 1)).toContain(c);
    expect(g.arestasDaCaixa(1, 2)).toContain(c);
    expect(g.arestasDaCaixa(2, 2)).not.toContain(c);
  });

  test('aresta registrada e encontrada pela busca de colisao', () => {
    const g = criarGerenciadorDeArestas(0, 0, 100, 150);
    const l = criarLinha({ componente: espia().c, inicio: { x: 95, y: 30 }, fim: { x: 5, y: 30 } });
    registrarLinha(g, l);

    const r = g.encontrarDistanciaDeColisao(raio(50, 35, 0, -1, 10));

    expect(r.aresta).toBe(l);
    expect(r.distancia).toBeCloseTo(5);
    expect(r.distancia).not.toBe(SEM_COLISAO);
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { avancarQuadro, criarBola, type Bola, type ContextoDoPasso } from '../app/js/physics/passo.js';
import { criarGerenciadorDeArestas, type Aresta } from '../app/js/physics/grade.js';
import { SEM_COLISAO } from '../app/js/maths/maths.js';

const RAIO = 0.25; // meio raio = 0,125; velocidade maxima = 50

function contexto(forca: { x: number; y: number } = { x: 0, y: 0 }): ContextoDoPasso {
  return {
    grade: criarGerenciadorDeArestas(0, 0, 100, 150),
    efeitosDeCampo: (_b, destino) => { destino.x = forca.x; destino.y = forca.y; },
  };
}

const bolaEm = (x: number, y: number, dx: number, dy: number, velocidade: number): Bola =>
  criarBola({ raio: RAIO, posicao: { x, y }, direcao: { x: dx, y: dy }, velocidade });

describe('passo — preparo do quadro', () => {
  test('bola LENTA tem o passo de tempo preso em 0,01', () => {
    // Abaixo de 0,8 de velocidade o original recorta o tempo. E o que impede uma bola quase parada de
    // atravessar uma aresta num unico salto grande quando o quadro demora.
    const b = bolaEm(50, 50, 1, 0, 0.5);

    avancarQuadro([b], contexto(), 0.1);

    expect(b.deltaDeTempo).toBe(0.01);
  });

  test('bola RAPIDA usa o tempo do quadro inteiro', () => {
    const b = bolaEm(50, 50, 1, 0, 5);

    avancarQuadro([b], contexto(), 0.02);

    expect(b.deltaDeTempo).toBe(0.02);
  });

  test('a velocidade e limitada a raio x 200', () => {
    const b = bolaEm(50, 50, 1, 0, 9999);

    avancarQuadro([b], contexto(), 0.001);

    expect(b.velocidade).toBe(RAIO * 200);
  });

  test('bola inativa nao se move', () => {
    const b = bolaEm(50, 50, 1, 0, 5);
    b.ativa = false;

    avancarQuadro([b], contexto(), 0.02);

    expect(b.posicao.x).toBe(50);
  });
});

describe('passo — integracao das forcas', () => {
  test('a forca de campo ACELERA a bola, escalada pelo tempo', () => {
    // A direcao e desnormalizada para virar velocidade, a forca e somada, e a magnitude do resultado
    // vira a nova velocidade. E assim que a gravidade entra: sem vetor de aceleracao separado.
    const b = bolaEm(50, 50, 1, 0, 10);

    avancarQuadro([b], contexto({ x: 100, y: 0 }), 0.01);

    expect(b.velocidade).toBeCloseTo(11); // 10 + 100 * 0,01
  });

  test('forca perpendicular VIRA a bola', () => {
    const b = bolaEm(50, 50, 1, 0, 10);

    avancarQuadro([b], contexto({ x: 0, y: 1000 }), 0.01);

    expect(b.direcao.y).toBeGreaterThan(0.5);
  });
});

describe('passo — movimento e colisao', () => {
  test('sem colisao, a bola avanca velocidade x tempo', () => {
    const b = bolaEm(50, 50, 1, 0, 1);

    avancarQuadro([b], contexto(), 0.01);

    expect(b.posicao.x).toBeCloseTo(50.01);
  });

  test('a aresta e avisada com a distancia ate ela', () => {
    const ctx = contexto();
    let avisada: number | null = null;
    const parede: Aresta = {
      ativa: true, grupoDeColisao: 0xffff,
      distanciaDeColisao: () => 0.05,
      aoColidir: (_b, distancia) => { avisada = distancia; },
    };
    ctx.grade.adicionarAresta(ctx.grade.caixaX(50), ctx.grade.caixaY(50), parede);

    avancarQuadro([bolaEm(50, 50, 1, 0, 10)], ctx, 0.01);

    expect(avisada).toBeCloseTo(0.05);
  });

  test('bola presa num componente nao e integrada pela grade', () => {
    // Quando a bola esta dentro de um sink ou de um kicker, quem a move e o componente. A grade nao
    // deve toca-la: se tocasse, a bola sairia sozinha de dentro do buraco.
    const ctx = contexto({ x: 1000, y: 0 });
    const b = bolaEm(50, 50, 1, 0, 10);
    let chamado = false;
    b.componente = { efeitoDeCampo: () => { chamado = true; } };

    avancarQuadro([b], ctx, 0.01);

    expect(chamado).toBe(true);
    expect(b.posicao.x).toBe(50);
    expect(b.velocidade).toBe(10);
  });
});

describe('passo — subpassos', () => {
  /** Conta quantas vezes a mesa foi consultada num quadro. */
  function contarConsultas(velocidade: number, deltaDeTempo: number): number {
    const ctx = contexto();
    let consultas = 0;
    const espia: Aresta = {
      ativa: true, grupoDeColisao: 0xffff,
      distanciaDeColisao: () => { consultas++; return SEM_COLISAO; },
      aoColidir: () => {},
    };
    for (let cx = 0; cx < 10; cx++) ctx.grade.adicionarAresta(cx, ctx.grade.caixaY(50), espia);
    avancarQuadro([bolaEm(5, 50, 1, 0, velocidade)], ctx, deltaDeTempo);
    return consultas;
  }

  test('a mesa e consultada uma vez por MEIO RAIO percorrido', () => {
    // A bola nunca anda mais que meio raio sem ser testada: e o que impede um projetil rapido de
    // atravessar uma parede fina entre dois quadros. Velocidade 20 por 0,01 = 0,2 de distancia;
    // 0,2 / 0,125 sao dois passos.
    expect(contarConsultas(20, 0.01)).toBe(2);
  });

  test('o TETO DE VELOCIDADE tambem limita o numero de subpassos', () => {
    // Pedir 9999 nao gera 9999 de distancia: a velocidade e presa em raio x 200 = 50, a distancia vira
    // 0,5, e sao quatro passos. E o teto que impede o custo por quadro de crescer sem limite — e foi
    // esta conta que eu errei ao escrever o teste antes de olhar para o valor.
    expect(contarConsultas(9999, 0.01)).toBe(4);
  });
});

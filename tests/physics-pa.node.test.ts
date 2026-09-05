// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { girarPonto, girarVetor, criarPa, atualizarPontosDeControle, distanciaAtePa, colisaoComPa, type Pa } from '../app/js/physics/pa.js';
import { SEM_COLISAO, type Raio } from '../app/js/maths/maths.js';
import type { EstadoDaBola } from '../app/js/physics/colisao.js';

const raio = (ox: number, oy: number, dx: number, dy: number, max = 100): Raio =>
  ({ origem: { x: ox, y: oy }, direcao: { x: dx, y: dy }, distanciaMaxima: max, distanciaMinima: 0.002, mascaraDeColisao: 0xffff });

/**
 * Uma pa horizontal apontando para +X: pivo em (0,0), ponta em (10,0).
 * A face A e a de cima (y = +1) e a face B a de baixo (y = -1).
 *
 * O SENTIDO EM QUE CADA FACE E DECLARADA IMPORTA: a colisao com linha e de um lado so, e a face de
 * cima so colide com quem vem de cima se for declarada de +X para -X. Escrever na ordem intuitiva
 * (0,1) -> (10,1) faz a bola atravessar a pa por cima e bater na face de baixo, 2 unidades adiante.
 * Foi exatamente o que este teste apanhou na primeira vez que rodou.
 */
function paDeTeste(sobrescreve: Partial<Pa> = {}): Pa {
  const pa = criarPa({
    origemDeRotacao: { x: 0, y: 0 },
    a1Fonte: { x: 10, y: 1 }, a2Fonte: { x: 0, y: 1 },
    b1Fonte: { x: 0, y: -1 }, b2Fonte: { x: 10, y: -1 },
    t1Fonte: { x: 10, y: 0 },
    raioBase: 1, raioPonta: 1,
    anguloMaximo: 1, velocidadeDeExtensao: 10, velocidadeDeRecolhimento: -10,
    multiplicadorDeColisao: 1, elasticidade: 1, suavidade: 1,
    divisorDeDistancia: 10,
  });
  Object.assign(pa, sobrescreve);
  atualizarPontosDeControle(pa, pa.anguloAtual);
  return pa;
}

const bola = (dx: number, dy: number, velocidade: number): EstadoDaBola =>
  ({ posicao: { x: 0, y: 0 }, direcao: { x: dx, y: dy }, velocidade });

describe('pa — rotacao', () => {
  test('girar 90 graus em torno da origem leva (1,0) para (0,1)', () => {
    const p = { x: 1, y: 0 };

    girarPonto(p, 1, 0, { x: 0, y: 0 });

    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(1);
  });

  test('gira em torno da origem DADA, e nao da origem do mundo', () => {
    const p = { x: 6, y: 5 };

    girarPonto(p, 1, 0, { x: 5, y: 5 });

    expect(p.x).toBeCloseTo(5);
    expect(p.y).toBeCloseTo(6);
  });

  test('girarVetor gira de verdade — o do original traca um OITO', () => {
    // O upstream calcula o Y usando o X JA SOBRESCRITO. Ele mesmo documenta o defeito e observa que so
    // nao quebra porque o angulo e sempre zero onde e chamado. Aqui vai correto: nao pode mudar o
    // comportamento atual (angulo zero da identidade nos dois), e a mesa autoral da fase 8 pode
    // precisar de angulo de verdade.
    const v = { x: 1, y: 0 };

    girarVetor(v, Math.PI / 2);

    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(1); // com o defeito do original daria 0
  });
});

describe('pa — as quatro pecas de colisao', () => {
  test('a face de cima devolve a perpendicular da LINHA', () => {
    const pa = paDeTeste();

    const r = distanciaAtePa(pa, raio(5, 5, 0, -1));

    expect(r.distancia).toBeCloseTo(4);
    expect(Math.abs(r.direcao.y)).toBeCloseTo(1); // normal vertical
    expect(r.direcao.x).toBeCloseTo(0);
  });

  test('a PONTA devolve a normal RADIAL, saindo do centro do circulo da ponta', () => {
    // Vindo de +X direto para a ponta em (10,0) com raio 1: acerta em x=11 e a normal aponta para +X.
    const pa = paDeTeste();

    const r = distanciaAtePa(pa, raio(20, 0, -1, 0));

    expect(r.distancia).toBeCloseTo(9);
    expect(r.direcao.x).toBeCloseTo(1);
    expect(r.direcao.y).toBeCloseTo(0);
  });

  test('quando nada e atingido, devolve SEM_COLISAO', () => {
    const pa = paDeTeste();

    expect(distanciaAtePa(pa, raio(0, 50, 0, 1)).distancia).toBe(SEM_COLISAO);
  });
});

describe('pa — o quique', () => {
  test('pa PARADA quica sem impulso nenhum', () => {
    const pa = paDeTeste({ bandeira: 'parada' });
    const b = bola(0, -1, 10);
    distanciaAtePa(pa, raio(5, 5, 0, -1));

    colisaoComPa(pa, b);

    expect(b.velocidade).toBeCloseTo(10);
  });

  test('bater com a PONTA manda a bola muito mais longe que bater no PIVO', () => {
    // O coracao da pa, e sai de uma linha: `v21 = |velocidade| * sqrt(dist2 / divisor2)`. A velocidade
    // tangencial cresce com o raio, entao o impulso cresce com a distancia ao pivo. Sem isso a pa
    // seria uma parede que se mexe.
    const naPonta = paDeTeste({ bandeira: 'estendendo', velocidadeDeMovimento: 10 });
    const bPonta = bola(0, -1, 10);
    distanciaAtePa(naPonta, raio(9, 5, 0, -1));
    colisaoComPa(naPonta, bPonta);

    const noPivo = paDeTeste({ bandeira: 'estendendo', velocidadeDeMovimento: 10 });
    const bPivo = bola(0, -1, 10);
    distanciaAtePa(noPivo, raio(2, 5, 0, -1));
    colisaoComPa(noPivo, bPivo);

    expect(bPonta.velocidade).toBeGreaterThan(bPivo.velocidade);
  });

  test('atingida POR TRAS, a pa cede: a elasticidade cai com a distancia ao pivo', () => {
    // A face B e a de tras enquanto a pa estende. Longe do pivo ela devolve MENOS energia — e o que
    // impede a bola de ser cuspida quando bate no lado errado da pa em movimento.
    const perto = paDeTeste({ bandeira: 'estendendo', velocidadeDeMovimento: 10 });
    const bPerto = bola(0, 1, 10);
    distanciaAtePa(perto, raio(2, -5, 0, 1));
    colisaoComPa(perto, bPerto);

    const longe = paDeTeste({ bandeira: 'estendendo', velocidadeDeMovimento: 10 });
    const bLonge = bola(0, 1, 10);
    distanciaAtePa(longe, raio(9, -5, 0, 1));
    colisaoComPa(longe, bLonge);

    expect(bLonge.velocidade).toBeLessThan(bPerto.velocidade);
  });
});

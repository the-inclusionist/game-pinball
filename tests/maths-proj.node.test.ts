// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, test, expect } from 'vitest';
import { criarProjecao, MATRIZ_DO_JOGO } from '../app/js/maths/proj.js';

/** Valores plausiveis de uma resolucao: distancia focal e centro da tela. */
const proj = () => criarProjecao({ matriz: MATRIZ_DO_JOGO, d: 350, centroX: 300, centroY: 208, zMin: 0, zEscala: 100 });

describe('proj — a matriz do jogo', () => {
  test('e uma rotacao de 24 graus, e nao uma matriz arbitraria', () => {
    // -0,913545 e 0,406737 sao -cos(24) e sen(24). Todo o "3D" do jogo e a mesa plana inclinada 24
    // graus mais a divisao perspectiva; nao ha malha nem profundidade real em lugar nenhum.
    const rad = (24 * Math.PI) / 180;

    expect(MATRIZ_DO_JOGO.linha1.y).toBeCloseTo(-Math.cos(rad), 5);
    expect(MATRIZ_DO_JOGO.linha1.z).toBeCloseTo(Math.sin(rad), 5);
    expect(MATRIZ_DO_JOGO.linha2.y).toBeCloseTo(-Math.sin(rad), 5);
    expect(MATRIZ_DO_JOGO.linha2.z).toBeCloseTo(-Math.cos(rad), 5);
  });
});

describe('proj — mesa para tela', () => {
  test('a origem da mesa cai perto do centro da tela', () => {
    const p = proj().paraTela({ x: 0, y: 0, z: 0 });

    expect(p.x).toBe(300); // x0 = 0 projeta exatamente no centro
    expect(typeof p.y).toBe('number');
  });

  test('mover em X move na tela, e o centro desloca tudo', () => {
    const a = proj().paraTela({ x: 0, y: 0, z: 0 });
    const b = proj().paraTela({ x: 5, y: 0, z: 0 });

    expect(b.x).toBeGreaterThan(a.x);
  });

  test('o resultado e inteiro e TRUNCADO na direcao do zero, nao arredondado', () => {
    // O original faz `static_cast<int>`, que corta para o zero. Arredondar mudaria a posicao de meio
    // pixel em metade dos sprites — pouco, e o suficiente para uma comparacao pixel a pixel nunca fechar.
    const p = criarProjecao({ matriz: MATRIZ_DO_JOGO, d: 350, centroX: 0.9, centroY: -0.9, zMin: 0, zEscala: 100 });

    const r = p.paraTela({ x: 0, y: 0, z: 0 });

    expect(r.x).toBe(0);   // 0,9 truncado = 0
    expect(Number.isInteger(r.y)).toBe(true);
  });
});

describe('proj — tela para mesa', () => {
  test('desprojetar e projetar de volta devolve o mesmo pixel', () => {
    // O teste mais forte que existe para uma projecao: o caminho de ida e volta. Um sinal trocado em
    // qualquer termo quebra isto, e nao quebra quase mais nada.
    const p = proj();

    for (const alvo of [{ x: 300, y: 208 }, { x: 120, y: 60 }, { x: 480, y: 390 }]) {
      const naMesa = p.paraMesa(alvo);
      const devolta = p.paraTela(naMesa);

      expect(Math.abs(devolta.x - alvo.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(devolta.y - alvo.y)).toBeLessThanOrEqual(1);
    }
  });

  test('desprojeta sempre no plano da mesa, z = 0', () => {
    expect(proj().paraMesa({ x: 200, y: 100 }).z).toBe(0);
  });
});

describe('proj — normalizacao de profundidade', () => {
  test('profundidade abaixo do minimo vira ZERO, que e o mais perto', () => {
    const p = criarProjecao({ matriz: MATRIZ_DO_JOGO, d: 350, centroX: 0, centroY: 0, zMin: 10, zEscala: 100 });

    expect(p.normalizarProfundidade(5)).toBe(0);
  });

  test('profundidade dentro da faixa escala linearmente', () => {
    const p = criarProjecao({ matriz: MATRIZ_DO_JOGO, d: 350, centroX: 0, centroY: 0, zMin: 10, zEscala: 100 });

    expect(p.normalizarProfundidade(20)).toBe(1000); // (20 - 10) * 100
  });

  test('acima de 65535 o valor DA A VOLTA, e nao satura', () => {
    // A guarda do original compara `depthScaled <= zmax`, mas `zmax` foi calculado em unidades NAO
    // escaladas — sao grandezas diferentes, entao a guarda quase nunca dispara e o cast para uint16
    // envolve. E defeito latente do original, nao deste port: fica transcrito e apontado aqui, porque
    // as profundidades reais da mesa nunca chegam la e "consertar" mudaria o comportamento.
    const p = criarProjecao({ matriz: MATRIZ_DO_JOGO, d: 350, centroX: 0, centroY: 0, zMin: 0, zEscala: 1 });

    expect(p.normalizarProfundidade(65536)).toBe(0);
    expect(p.normalizarProfundidade(65537)).toBe(1);
  });
});

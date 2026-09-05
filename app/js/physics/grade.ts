// SPDX-License-Identifier: AGPL-3.0-or-later
// physics/grade — a grade de caixas de colisao. Port de `TEdgeManager`.
//
// O problema que ela resolve: a mesa tem centenas de arestas, e testar a bola contra todas a cada
// quadro seria desperdicio. A grade divide a mesa em caixas, cada aresta e registrada em toda caixa
// que ela toca, e a busca percorre so as caixas que o raio da bola atravessa.
//
// A GRADE E FIXA EM 10x15, e nao derivada do tamanho da mesa — esta assim no construtor do original.
// Uma mesa maior ganha caixas MAIORES, nao mais caixas, e e por isso que o custo por consulta nao
// cresce com a mesa. (Cresce com a densidade de arestas por caixa, que e outra conversa.)

import { SEM_COLISAO, type Raio } from '../maths/maths.js';

export const CAIXAS_X = 10;
export const CAIXAS_Y = 15;

export interface Aresta {
  ativa: boolean;
  grupoDeColisao: number;
  distanciaDeColisao(raio: Raio): number;
  /** O que a aresta FAZ quando a bola a atinge. `TEdgeSegment::EdgeCollision` no original. */
  aoColidir(bola: unknown, distancia: number): void;
}

export interface Resultado {
  readonly distancia: number;
  readonly aresta: Aresta | null;
}

export interface GerenciadorDeArestas {
  readonly avancoX: number;
  readonly avancoY: number;
  caixaX(x: number): number;
  caixaY(y: number): number;
  adicionarAresta(x: number, y: number, aresta: Aresta): void;
  encontrarDistanciaDeColisao(raio: Raio, jaAtingida?: (a: Aresta) => boolean): Resultado;
}

const prender = (v: number, maximo: number): number => Math.max(0, Math.min(v, maximo));

export function criarGerenciadorDeArestas(xMin: number, yMin: number, largura: number, altura: number): GerenciadorDeArestas {
  const avancoX = largura / CAIXAS_X;
  const avancoY = altura / CAIXAS_Y;
  const caixas: Aresta[][] = Array.from({ length: CAIXAS_X * CAIXAS_Y }, () => []);

  // PRENDE em vez de recusar: a bola sai da mesa em situacoes normais (o dreno, a calha do plunger),
  // e prender e o que mantem as arestas de borda sendo testadas quando ela esta la fora.
  const caixaX = (x: number): number => prender(Math.floor((x - xMin) / avancoX), CAIXAS_X - 1);
  const caixaY = (y: number): number => prender(Math.floor((y - yMin) / avancoY), CAIXAS_Y - 1);

  const adicionarAresta = (x: number, y: number, aresta: Aresta): void => {
    caixas[x + y * CAIXAS_X]!.push(aresta);
  };

  function encontrarDistanciaDeColisao(raio: Raio, jaAtingida?: (a: Aresta) => boolean): Resultado {
    let distancia = SEM_COLISAO;
    let achada: Aresta | null = null;

    // O original usa um `ProcessedFlag` na propria aresta e um vetor de 1000 posicoes para depois
    // limpa-lo. Um Set local faz o mesmo e nao deixa estado sujo numa aresta se a busca abortar —
    // que e a unica liberdade tomada aqui, e e a favor da correcao.
    const processadas = new Set<Aresta>();

    const testarCaixa = (x: number, y: number): void => {
      if (x < 0 || x >= CAIXAS_X || y < 0 || y >= CAIXAS_Y) return;
      const lista = caixas[x + y * CAIXAS_X]!;

      // DE TRAS PARA A FRENTE, como o `rbegin/rend` do original: com o `<` estrito no desempate abaixo,
      // a ordem decide quem vence quando duas arestas estao a mesma distancia.
      for (let i = lista.length - 1; i >= 0; i--) {
        const aresta = lista[i]!;
        if (processadas.has(aresta)) continue;
        if (!aresta.ativa) continue;
        if ((aresta.grupoDeColisao & raio.mascaraDeColisao) === 0) continue;
        if (jaAtingida?.(aresta)) continue;

        processadas.add(aresta);
        const d = aresta.distanciaDeColisao(raio);
        if (d < distancia) { distancia = d; achada = aresta; }
      }
    };

    const x0 = raio.origem.x;
    const y0 = raio.origem.y;
    const x1 = raio.direcao.x * raio.distanciaMaxima + raio.origem.x;
    const y1 = raio.direcao.y * raio.distanciaMaxima + raio.origem.y;

    const cx0 = caixaX(x0), cy0 = caixaY(y0);
    const cx1 = caixaX(x1), cy1 = caixaY(y1);
    const passoX = x0 >= x1 ? -1 : 1;
    const passoY = y0 >= y1 ? -1 : 1;

    if (cy0 === cy1) {
      for (let ix = cx0; passoX === 1 ? ix <= cx1 : ix >= cx1; ix += passoX) testarCaixa(ix, cy0);
    } else if (cx0 === cx1) {
      for (let iy = cy0; passoY === 1 ? iy <= cy1 : iy >= cy1; iy += passoY) testarCaixa(cx0, iy);
    } else {
      testarCaixa(cx0, cy0);

      // Travessia tipo Bresenham: y = dyDx * (x - x0) + y0.
      const dyDx = (y0 - y1) / (x0 - x1);
      const constante = -x0 * dyDx + y0;
      // O DESVIO DE UM: o proprio autor do upstream escreveu ao lado "not sure why". Transcrito como
      // esta, porque o comportamento da travessia depende dele e ninguem sabe justifica-lo.
      const desvioX = passoX === 1 ? 1 : 0;
      const desvioY = passoY === 1 ? 1 : 0;

      let ix = cx0, iy = cy0;
      while (ix !== cx1 || iy !== cy1) {
        const yDaCaixa = (iy + desvioY) * avancoY + yMin;
        const yDaReta = ((ix + desvioX) * avancoX + xMin) * dyDx + constante;

        if (passoY === 1 ? yDaReta >= yDaCaixa : yDaReta <= yDaCaixa) {
          iy += passoY;
          if (yDaReta === yDaCaixa) ix += passoX;
        } else {
          ix += passoX;
        }
        testarCaixa(ix, iy);
      }
    }

    return { distancia, aresta: achada };
  }

  return { avancoX, avancoY, caixaX, caixaY, adicionarAresta, encontrarDistanciaDeColisao };
}

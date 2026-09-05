// SPDX-License-Identifier: AGPL-3.0-or-later
// physics/grade — a grade de caixas de colisao. Port de `TEdgeManager` + os `edges_insert_*` de
// `TTableLayer`.
//
// O problema que ela resolve: a mesa tem centenas de arestas, e testar a bola contra todas a cada
// quadro seria desperdicio. A grade divide a mesa em caixas, cada aresta e registrada em toda caixa
// que ela toca, e a busca percorre so as caixas que o raio da bola atravessa.
//
// A GRADE E FIXA EM 10x15, e nao derivada do tamanho da mesa — esta assim no construtor do original.
// Uma mesa maior ganha caixas MAIORES, nao mais caixas, e e por isso que o custo por consulta nao
// cresce com a mesa. (Cresce com a densidade de arestas por caixa, que e outra conversa.)
//
// ========================= A TRAVESSIA E UMA SO, E NO UPSTREAM SAO DUAS =========================
// O `TEdgeManager::FindCollisionDistance` e o `TLine::place_in_grid` percorrem as caixas de um segmento
// com o MESMO algoritmo de Bresenham, copiado linha a linha nos dois arquivos — inclusive o comentario
// "not sure why" do desvio de um. Aqui ele existe uma vez. E a unica deduplicacao que este port faz, e
// e sobre codigo identico, nao sobre codigo parecido.

import { SEM_COLISAO, type Raio, type Vetor2 } from '../maths/maths.js';

export const CAIXAS_X = 10;
export const CAIXAS_Y = 15;

export interface Aresta {
  ativa: boolean;
  grupoDeColisao: number;
  distanciaDeColisao(raio: Raio): number;
  /** O que a aresta FAZ quando a bola a atinge. `TEdgeSegment::EdgeCollision` no original. */
  aoColidir(bola: unknown, distancia: number): void;
}

/** Uma aresta que e um segmento — o que a grade precisa saber para registra-la. */
export interface ComSegmento extends Aresta {
  x0: number; y0: number; x1: number; y1: number;
}

/** Uma aresta que e um circulo. */
export interface ComCirculo extends Aresta {
  centro: Vetor2;
  raio: number;
}

export interface Resultado {
  readonly distancia: number;
  readonly aresta: Aresta | null;
}

export interface GerenciadorDeArestas {
  readonly minX: number;
  readonly minY: number;
  readonly avancoX: number;
  readonly avancoY: number;
  caixaX(x: number): number;
  caixaY(y: number): number;
  adicionarAresta(x: number, y: number, aresta: Aresta): void;
  arestasDaCaixa(x: number, y: number): readonly Aresta[];
  percorrerCaixas(x0: number, y0: number, x1: number, y1: number, visitar: (x: number, y: number) => void): void;
  encontrarDistanciaDeColisao(raio: Raio, jaAtingida?: (a: Aresta) => boolean): Resultado;
}

const prender = (v: number, maximo: number): number => Math.max(0, Math.min(v, maximo));

export function criarGerenciadorDeArestas(minX: number, minY: number, largura: number, altura: number): GerenciadorDeArestas {
  const avancoX = largura / CAIXAS_X;
  const avancoY = altura / CAIXAS_Y;
  const caixas: Aresta[][] = Array.from({ length: CAIXAS_X * CAIXAS_Y }, () => []);

  // PRENDE em vez de recusar: a bola sai da mesa em situacoes normais (o dreno, a calha do plunger),
  // e prender e o que mantem as arestas de borda sendo testadas quando ela esta la fora.
  const caixaX = (x: number): number => prender(Math.floor((x - minX) / avancoX), CAIXAS_X - 1);
  const caixaY = (y: number): number => prender(Math.floor((y - minY) / avancoY), CAIXAS_Y - 1);

  const adicionarAresta = (x: number, y: number, aresta: Aresta): void => {
    const lista = caixas[x + y * CAIXAS_X]!;
    if (!lista.includes(aresta)) lista.push(aresta);
  };

  const arestasDaCaixa = (x: number, y: number): readonly Aresta[] => caixas[x + y * CAIXAS_X]!;

  /**
   * Percorre as caixas que o segmento (x0,y0)-(x1,y1) atravessa, visitando cada uma. Transcricao do
   * laco de Bresenham do original, inclusive o desvio de um que o proprio autor do upstream anotou
   * como "not sure why" — o comportamento depende dele e ninguem sabe justifica-lo.
   */
  function percorrerCaixas(x0: number, y0: number, x1: number, y1: number, visitar: (x: number, y: number) => void): void {
    const cx0 = caixaX(x0), cy0 = caixaY(y0);
    const cx1 = caixaX(x1), cy1 = caixaY(y1);
    const passoX = x0 >= x1 ? -1 : 1;
    const passoY = y0 >= y1 ? -1 : 1;

    if (cy0 === cy1) {
      for (let ix = cx0; passoX === 1 ? ix <= cx1 : ix >= cx1; ix += passoX) visitar(ix, cy0);
      return;
    }
    if (cx0 === cx1) {
      for (let iy = cy0; passoY === 1 ? iy <= cy1 : iy >= cy1; iy += passoY) visitar(cx0, iy);
      return;
    }

    visitar(cx0, cy0);

    const dyDx = (y0 - y1) / (x0 - x1);
    const constante = -x0 * dyDx + y0;
    const desvioX = passoX === 1 ? 1 : 0;
    const desvioY = passoY === 1 ? 1 : 0;

    let ix = cx0, iy = cy0;
    while (ix !== cx1 || iy !== cy1) {
      const yDaCaixa = (iy + desvioY) * avancoY + minY;
      const yDaReta = ((ix + desvioX) * avancoX + minX) * dyDx + constante;

      if (passoY === 1 ? yDaReta >= yDaCaixa : yDaReta <= yDaCaixa) {
        iy += passoY;
        if (yDaReta === yDaCaixa) ix += passoX;
      } else {
        ix += passoX;
      }
      visitar(ix, iy);
    }
  }

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

    const x1 = raio.direcao.x * raio.distanciaMaxima + raio.origem.x;
    const y1 = raio.direcao.y * raio.distanciaMaxima + raio.origem.y;
    percorrerCaixas(raio.origem.x, raio.origem.y, x1, y1, testarCaixa);

    return { distancia, aresta: achada };
  }

  return {
    minX, minY, avancoX, avancoY,
    caixaX, caixaY, adicionarAresta, arestasDaCaixa, percorrerCaixas, encontrarDistanciaDeColisao,
  };
}

/** `TLine::place_in_grid`: a linha entra em toda caixa que atravessa. */
export function registrarLinha(g: GerenciadorDeArestas, aresta: ComSegmento): void {
  g.percorrerCaixas(aresta.x0, aresta.y0, aresta.x1, aresta.y1, (x, y) => g.adicionarAresta(x, y, aresta));
}

/**
 * `TTableLayer::edges_insert_circle`: o circulo entra nas caixas que ele DE FATO toca.
 *
 * O original faz o teste de sobreposicao a mao e exaustivamente: centro dentro da caixa, depois os
 * quatro cantos dentro do raio, depois quatro raios percorrendo as quatro arestas da caixa. Aqui vai o
 * teste analitico equivalente — o ponto da caixa mais proximo do centro, e a distancia ate ele. Sao as
 * mesmas respostas, inclusive no caso que separa um teste de circulo de um teste de retangulo: a caixa
 * diagonal que esta dentro do quadrado envolvente e fora do circulo.
 */
export function registrarCirculo(g: GerenciadorDeArestas, aresta: ComCirculo): void {
  // A margem do original (`AdvanceX * 0.001`) alarga o alcance por um fio para nao perder tangencias.
  const raioComMargem = aresta.raio + g.avancoX * 0.001;
  const raioAoQuadrado = raioComMargem * raioComMargem;

  const xMinCaixa = g.caixaX(aresta.centro.x - raioComMargem);
  const xMaxCaixa = g.caixaX(aresta.centro.x + raioComMargem);
  const yMinCaixa = g.caixaY(aresta.centro.y - raioComMargem);
  const yMaxCaixa = g.caixaY(aresta.centro.y + raioComMargem);

  for (let ix = xMinCaixa; ix <= xMaxCaixa; ix++) {
    for (let iy = yMinCaixa; iy <= yMaxCaixa; iy++) {
      const esquerda = ix * g.avancoX + g.minX;
      const topo = iy * g.avancoY + g.minY;
      const maisProximoX = Math.max(esquerda, Math.min(aresta.centro.x, esquerda + g.avancoX));
      const maisProximoY = Math.max(topo, Math.min(aresta.centro.y, topo + g.avancoY));
      const dx = aresta.centro.x - maisProximoX;
      const dy = aresta.centro.y - maisProximoY;
      if (dx * dx + dy * dy <= raioAoQuadrado) g.adicionarAresta(ix, iy, aresta);
    }
  }
}

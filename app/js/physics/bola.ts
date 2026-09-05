// SPDX-License-Identifier: AGPL-3.0-or-later
// physics/bola — a memoria de arestas que a bola ja atingiu. Port de `TBall::not_again`/`already_hit`.
//
// POR QUE ELA EXISTE: num mesmo quadro a bola pode ser testada varias vezes contra a mesma aresta
// (a resposta de colisao move a bola e a simulacao continua com o tempo que sobrou). Sem memoria, uma
// parede seria batida duas vezes no mesmo quadro e a bola sairia com o dobro do impulso.
//
// E O DESCARTE E ESTRANHO DE PROPOSITO. Nao e um anel circular: ao encher as dezesseis posicoes, o
// original copia as OITO DE CIMA para a base, poe a nova no indice 8 e zera a contagem em 9. Isto e,
// esquece METADE de uma vez, em vez de esquecer a mais antiga a cada nova.
//
// Transcrito como esta porque a fisica depende de QUANTO ela lembra: esquecer cedo demais devolve o
// quique duplo que ela existe para impedir, e lembrar demais faz a bola atravessar uma aresta que ja
// bateu num quique anterior legitimo.

import type { Aresta } from './grade.js';

export const LIMITE_DE_COLISOES = 16;
const QUANTAS_SOBREVIVEM = 8;

export interface MemoriaDeColisoes {
  registrar(aresta: Aresta): void;
  jaAtingiu(aresta: Aresta): boolean;
  /** Chamado a cada quadro novo. */
  esquecer(): void;
}

export function criarMemoriaDeColisoes(): MemoriaDeColisoes {
  const colisoes: (Aresta | null)[] = new Array(LIMITE_DE_COLISOES).fill(null);
  let quantas = 0;

  return {
    registrar(aresta: Aresta): void {
      if (quantas < LIMITE_DE_COLISOES) {
        colisoes[quantas] = aresta;
        quantas++;
        return;
      }
      // O descarte pela metade — ver o cabecalho.
      for (let i = 0; i < QUANTAS_SOBREVIVEM; i++) colisoes[i] = colisoes[i + QUANTAS_SOBREVIVEM]!;
      colisoes[QUANTAS_SOBREVIVEM] = aresta;
      quantas = QUANTAS_SOBREVIVEM + 1;
    },

    jaAtingiu(aresta: Aresta): boolean {
      // Varredura linear, como no original: sao no maximo dezesseis, e um Set custaria mais em alocacao
      // do que economiza em comparacao.
      for (let i = 0; i < quantas; i++) if (colisoes[i] === aresta) return true;
      return false;
    },

    esquecer(): void {
      quantas = 0;
    },
  };
}

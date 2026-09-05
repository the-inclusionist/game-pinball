// SPDX-License-Identifier: AGPL-3.0-or-later
// physics/colisao — a resposta de colisao. Port de `maths::basic_collision`.
//
// Uma funcao so, e dela saem TRES comportamentos que parecem separados no jogo: o quique numa parede,
// a perda de energia ao raspar, e o empurrao do bumper. Sao os mesmos dez calculos com parametros
// diferentes, e e por isso que ela vale transcricao literal em vez de tres funcoes "mais claras".
//
// Vive em `physics/` e nao em `maths/` porque muda o estado de uma bola. No upstream ela esta em
// `maths.cpp`, junto das funcoes puras; separa-las e a unica liberdade que este modulo toma.

import { normalizar2d, produtoEscalar, type Vetor2 } from '../maths/maths.js';

export interface EstadoDaBola {
  posicao: Vetor2;
  direcao: Vetor2;
  velocidade: number;
}

export interface Resposta {
  /** 1 = quique perfeito; 0 = a bola morre na superficie. */
  readonly elasticidade: number;
  readonly suavidade: number;
  /** Velocidade de rebote a partir da qual o impulso entra. E o que faz um bumper ignorar toque leve. */
  readonly limiar: number;
  readonly impulso: number;
}

/** Desloca a bola alem do contato para ela nao ser detectada em colisao no quadro seguinte. */
const AFASTAMENTO = 0.0005;

/**
 * Aplica a colisao e devolve a VELOCIDADE DO REBOTE (nao a que sobrou) — o original usa esse retorno
 * para decidir som, pontuacao e se o alvo foi "acertado com forca".
 *
 * `direcao` e a normal da superficie apontando para fora dela, na direcao da bola.
 */
export function colisaoBasica(bola: EstadoDaBola, proximaPosicao: Vetor2, direcao: Vetor2, r: Resposta): number {
  bola.posicao.x = proximaPosicao.x + direcao.x * AFASTAMENTO;
  bola.posicao.y = proximaPosicao.y + direcao.y * AFASTAMENTO;

  // Projecao da direcao da bola sobre a normal do rebote.
  let projecao = -produtoEscalar(direcao, bola.direcao);

  if (projecao < 0) {
    // NEGATIVA quer dizer que os dois vetores apontam para o mesmo lado: a bola JA esta se afastando.
    // Nao ha o que refletir, mas o modulo continua servindo para a perda de energia abaixo. Ignorar
    // este caso deixaria a bola GANHAR energia ao raspar uma superficie de onde ja estava saindo.
    projecao = -projecao;
  } else {
    const dx = projecao * direcao.x;
    const dy = projecao * direcao.y;
    bola.direcao.x = (dx + bola.direcao.x) * r.suavidade + dx * r.elasticidade;
    bola.direcao.y = (dy + bola.direcao.y) * r.suavidade + dy * r.elasticidade;
    normalizar2d(bola.direcao);
  }

  const velocidadeDoRebote = projecao * bola.velocidade;
  bola.velocidade -= (1 - r.elasticidade) * velocidadeDoRebote;

  if (velocidadeDoRebote >= r.limiar) {
    // O IMPULSO NAO E "MAIS ELASTICIDADE": ele soma um vetor de modulo fixo na normal, e a velocidade
    // passa a ser a magnitude do resultado. E isso que faz um bumper devolver mais energia do que
    // recebeu, sem que a elasticidade precise passar de 1 em lugar nenhum.
    bola.direcao.x = bola.velocidade * bola.direcao.x + direcao.x * r.impulso;
    bola.direcao.y = bola.velocidade * bola.direcao.y + direcao.y * r.impulso;
    bola.velocidade = normalizar2d(bola.direcao);
  }

  return velocidadeDoRebote;
}

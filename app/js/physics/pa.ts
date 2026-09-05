// SPDX-License-Identifier: AGPL-3.0-or-later
// physics/pa — a colisao com a pa (flipper). Port de `TFlipperEdge` + `maths::distance_to_flipper`.
//
// ========================= A PA TEM QUATRO PECAS, NAO UMA =========================
// Duas LINHAS (as faces achatadas, A em cima e B embaixo) e dois CIRCULOS (o pivo e a ponta). A mais
// proxima vence, e a normal do quique depende de qual foi: a perpendicular da linha, ou a radial
// saindo do centro do circulo. E isso que faz a bola escorregar pela face e quicar redonda na ponta.
//
// ========================= O IMPULSO CRESCE COM A DISTANCIA AO PIVO =========================
//     v21 = |velocidadeDeMovimento| * sqrt(distanciaAoQuadrado / divisorAoQuadrado)
// que e a velocidade TANGENCIAL da pa naquele raio. Bater com a ponta manda a bola longe; bater junto
// do pivo quase nao a move. Sai de uma linha, e sem ela a pa seria so uma parede que se mexe.
//
// E ao ser atingida POR TRAS a elasticidade CAI com a mesma distancia: a pa cede na ponta. E o que
// impede a bola de ser cuspida quando bate no lado errado de uma pa em movimento.

import {
  SEM_COLISAO, iniciarLinha, normalizar2d, produtoEscalar, produtoVetorial,
  raioIntersectaCirculo, raioIntersectaLinha, type Circulo, type Linha, type Raio, type Vetor2,
} from '../maths/maths.js';
import { colisaoBasica, type EstadoDaBola } from './colisao.js';

/** Gira um ponto em torno de `origem`, com o seno e o cosseno ja calculados. */
export function girarPonto(ponto: Vetor2, sen: number, cos: number, origem: Vetor2): void {
  const dx = ponto.x - origem.x;
  const dy = ponto.y - origem.y;
  ponto.x = dx * cos - dy * sen + origem.x;
  ponto.y = dx * sen + dy * cos + origem.y;
}

/**
 * Gira um vetor. CORRIGIDO em relacao ao original, deliberadamente.
 *
 * O `maths::RotateVector` do upstream calcula o Y usando o X que acabou de sobrescrever, e por isso
 * traca um oito em vez de um circulo. O proprio upstream documenta o defeito e observa que ele so nao
 * quebra nada porque o angulo e sempre zero onde a funcao e chamada — e com angulo zero as duas
 * versoes dao a identidade. Entao corrigir NAO pode mudar o comportamento atual, e a mesa autoral da
 * fase 8 pode precisar de um angulo de verdade.
 */
export function girarVetor(vetor: Vetor2, angulo: number): void {
  const s = Math.sin(angulo), c = Math.cos(angulo);
  const x = c * vetor.x - s * vetor.y;
  vetor.y = s * vetor.x + c * vetor.y;
  vetor.x = x;
}

export type BandeiraDaPa = 'parada' | 'estendendo' | 'recolhendo';

export interface Pa {
  bandeira: BandeiraDaPa;
  elasticidade: number;
  suavidade: number;
  origemDeRotacao: Vetor2;
  /** O sinal decide o lado: uma pa esquerda e uma direita giram em sentidos opostos. */
  anguloMaximo: number;
  anguloAtual: number;
  velocidadeDeMovimento: number;
  velocidadeDeExtensao: number;
  velocidadeDeRecolhimento: number;
  multiplicadorDeColisao: number;
  /** O comprimento de referencia da pa, ao quadrado. E o denominador do impulso. */
  divisorDeDistanciaAoQuadrado: number;
  raioBaseAoQuadrado: number;
  raioPontaAoQuadrado: number;

  a1Fonte: Vetor2; a2Fonte: Vetor2; b1Fonte: Vetor2; b2Fonte: Vetor2; t1Fonte: Vetor2;
  a1: Vetor2; a2: Vetor2; b1: Vetor2; b2: Vetor2; t1: Vetor2;
  linhaA: Linha; linhaB: Linha;
  circuloBase: Circulo; circuloPonta: Circulo;

  /** Resultado da ultima consulta, guardado como no original (`NextBallPosition`/`CollisionDirection`). */
  proximaPosicaoDaBola: Vetor2;
  direcaoDaColisao: Vetor2;
}

export interface OpcoesDaPa {
  origemDeRotacao: Vetor2;
  a1Fonte: Vetor2; a2Fonte: Vetor2; b1Fonte: Vetor2; b2Fonte: Vetor2; t1Fonte: Vetor2;
  raioBase: number; raioPonta: number;
  anguloMaximo: number;
  velocidadeDeExtensao: number; velocidadeDeRecolhimento: number;
  multiplicadorDeColisao: number; elasticidade: number; suavidade: number;
  divisorDeDistancia: number;
}

const copiar = (v: Vetor2): Vetor2 => ({ x: v.x, y: v.y });

export function criarPa(o: OpcoesDaPa): Pa {
  return {
    bandeira: 'parada',
    elasticidade: o.elasticidade,
    suavidade: o.suavidade,
    origemDeRotacao: copiar(o.origemDeRotacao),
    anguloMaximo: o.anguloMaximo,
    anguloAtual: 0,
    velocidadeDeMovimento: 0,
    velocidadeDeExtensao: o.velocidadeDeExtensao,
    velocidadeDeRecolhimento: o.velocidadeDeRecolhimento,
    multiplicadorDeColisao: o.multiplicadorDeColisao,
    divisorDeDistanciaAoQuadrado: o.divisorDeDistancia * o.divisorDeDistancia,
    raioBaseAoQuadrado: o.raioBase * o.raioBase,
    raioPontaAoQuadrado: o.raioPonta * o.raioPonta,
    a1Fonte: copiar(o.a1Fonte), a2Fonte: copiar(o.a2Fonte),
    b1Fonte: copiar(o.b1Fonte), b2Fonte: copiar(o.b2Fonte), t1Fonte: copiar(o.t1Fonte),
    a1: copiar(o.a1Fonte), a2: copiar(o.a2Fonte),
    b1: copiar(o.b1Fonte), b2: copiar(o.b2Fonte), t1: copiar(o.t1Fonte),
    linhaA: iniciarLinha(o.a1Fonte.x, o.a1Fonte.y, o.a2Fonte.x, o.a2Fonte.y),
    linhaB: iniciarLinha(o.b1Fonte.x, o.b1Fonte.y, o.b2Fonte.x, o.b2Fonte.y),
    circuloBase: { centro: copiar(o.origemDeRotacao), raioAoQuadrado: o.raioBase * o.raioBase },
    circuloPonta: { centro: copiar(o.t1Fonte), raioAoQuadrado: o.raioPonta * o.raioPonta },
    proximaPosicaoDaBola: { x: 0, y: 0 },
    direcaoDaColisao: { x: 0, y: 0 },
  };
}

/** `set_control_points`: gira os cinco pontos e refaz as duas linhas e os dois circulos. */
export function atualizarPontosDeControle(pa: Pa, angulo: number): void {
  const sen = Math.sin(angulo), cos = Math.cos(angulo);
  pa.a1 = copiar(pa.a1Fonte); pa.a2 = copiar(pa.a2Fonte);
  pa.b1 = copiar(pa.b1Fonte); pa.b2 = copiar(pa.b2Fonte); pa.t1 = copiar(pa.t1Fonte);
  for (const p of [pa.a1, pa.a2, pa.t1, pa.b1, pa.b2]) girarPonto(p, sen, cos, pa.origemDeRotacao);
  pa.linhaA = iniciarLinha(pa.a1.x, pa.a1.y, pa.a2.x, pa.a2.y);
  pa.linhaB = iniciarLinha(pa.b1.x, pa.b1.y, pa.b2.x, pa.b2.y);
  pa.circuloBase = { centro: copiar(pa.origemDeRotacao), raioAoQuadrado: pa.raioBaseAoQuadrado };
  pa.circuloPonta = { centro: copiar(pa.t1), raioAoQuadrado: pa.raioPontaAoQuadrado };
  pa.anguloAtual = angulo;
}

export interface AcertoNaPa {
  readonly distancia: number;
  readonly origem: Vetor2;
  readonly direcao: Vetor2;
}

/**
 * `maths::distance_to_flipper`: a mais proxima das quatro pecas.
 *
 * A ORDEM DO DESEMPATE E LINHA A, BASE, PONTA, LINHA B, com `<` estrito — entao num empate exato vence
 * quem foi testado primeiro. Reordenar trocaria a normal devolvida em casos de tangencia.
 */
export function distanciaAtePa(pa: Pa, raio: Raio): AcertoNaPa {
  let distancia = SEM_COLISAO;
  let peca: 'linhaA' | 'linhaB' | 'base' | 'ponta' | null = null;

  let d = raioIntersectaLinha(raio, pa.linhaA);
  if (d < distancia) { distancia = d; peca = 'linhaA'; }

  d = raioIntersectaCirculo(raio, pa.circuloBase);
  if (d < distancia) { distancia = d; peca = 'base'; }

  d = raioIntersectaCirculo(raio, pa.circuloPonta);
  if (d < distancia) { distancia = d; peca = 'ponta'; }

  d = raioIntersectaLinha(raio, pa.linhaB);
  if (d < distancia) { distancia = d; peca = 'linhaB'; }

  if (peca === 'linhaA') {
    pa.direcaoDaColisao = copiar(pa.linhaA.perpendicular);
    pa.proximaPosicaoDaBola = copiar(pa.linhaA.interseccao);
  } else if (peca === 'linhaB') {
    pa.direcaoDaColisao = copiar(pa.linhaB.perpendicular);
    pa.proximaPosicaoDaBola = copiar(pa.linhaB.interseccao);
  } else if (peca === 'base' || peca === 'ponta') {
    pa.proximaPosicaoDaBola = {
      x: distancia * raio.direcao.x + raio.origem.x,
      y: distancia * raio.direcao.y + raio.origem.y,
    };
    const centro = peca === 'base' ? pa.circuloBase.centro : pa.circuloPonta.centro;
    pa.direcaoDaColisao = {
      x: pa.proximaPosicaoDaBola.x - centro.x,
      y: pa.proximaPosicaoDaBola.y - centro.y,
    };
    normalizar2d(pa.direcaoDaColisao);
  }

  return { distancia, origem: pa.proximaPosicaoDaBola, direcao: pa.direcaoDaColisao };
}

/** `TFlipperEdge::EdgeCollision`. Usa o resultado da ultima `distanciaAtePa`, como o original. */
export function colisaoComPa(pa: Pa, bola: EstadoDaBola): void {
  if (pa.bandeira === 'parada') {
    colisaoBasica(bola, pa.proximaPosicaoDaBola, pa.direcaoDaColisao,
      { elasticidade: pa.elasticidade, suavidade: pa.suavidade, limiar: SEM_COLISAO, impulso: 0 });
    return;
  }

  // De que LADO da pa a bola esta: o sinal do produto vetorial entre o eixo ponta-pivo e o vetor
  // ponta-bola. Combinado com o sinal de `anguloMaximo` (que diz para que lado esta pa gira), decide
  // se a face atingida e a que esta sendo varrida ou a de tras.
  const pontaParaBola = {
    x: pa.proximaPosicaoDaBola.x - pa.t1.x,
    y: pa.proximaPosicaoDaBola.y - pa.t1.y,
  };
  const pontaParaPivo = { x: pa.origemDeRotacao.x - pa.t1.x, y: pa.origemDeRotacao.y - pa.t1.y };
  const cruzado = produtoVetorial(pontaParaPivo, pontaParaBola);

  let colisaoFrontal = cruzado <= 0 ? pa.anguloMaximo > 0 : pa.anguloMaximo <= 0;

  let perpendicularDeColisao: Vetor2;
  if (pa.bandeira === 'recolhendo') {
    // RECOLHENDO INVERTE TUDO: a face que varria passa a fugir da bola, e a de tras passa a avancar.
    colisaoFrontal = !colisaoFrontal;
    perpendicularDeColisao = pa.linhaB.perpendicular;
  } else {
    perpendicularDeColisao = pa.linhaA.perpendicular;
  }

  const dx = pa.proximaPosicaoDaBola.x - pa.origemDeRotacao.x;
  const dy = pa.proximaPosicaoDaBola.y - pa.origemDeRotacao.y;
  const distanciaAoQuadrado = dx * dx + dy * dy;
  // O `1.01` e do original: uma folga para nao aplicar impulso a bola encostada no proprio pivo.
  const foraDoPivo = pa.circuloBase.raioAoQuadrado * 1.01 < distanciaAoQuadrado;

  if (colisaoFrontal) {
    let impulso = 0;
    if (foraDoPivo) {
      const velocidadeTangencial = Math.abs(pa.velocidadeDeMovimento)
        * Math.sqrt(distanciaAoQuadrado / pa.divisorDeDistanciaAoQuadrado);
      const alinhamento = produtoEscalar(perpendicularDeColisao, pa.direcaoDaColisao);
      if (alinhamento >= 0) impulso = pa.multiplicadorDeColisao * alinhamento * velocidadeTangencial;
    }
    // Limiar -1 quando ha impulso: garante que ele SEMPRE se aplique. E o unico lugar do jogo que usa
    // limiar negativo, e e assim que a pa foge da regra de "so acima de tal velocidade de rebote".
    const limiar = impulso <= 0 ? SEM_COLISAO : -1;
    colisaoBasica(bola, pa.proximaPosicaoDaBola, pa.direcaoDaColisao,
      { elasticidade: pa.elasticidade, suavidade: pa.suavidade, limiar, impulso });
    return;
  }

  // POR TRAS: a pa cede, e cede mais na ponta.
  const elasticidade = foraDoPivo
    ? (1 - Math.sqrt(distanciaAoQuadrado / pa.divisorDeDistanciaAoQuadrado)) * pa.elasticidade
    : pa.elasticidade;
  colisaoBasica(bola, pa.proximaPosicaoDaBola, pa.direcaoDaColisao,
    { elasticidade, suavidade: pa.suavidade, limiar: SEM_COLISAO, impulso: 0 });
}

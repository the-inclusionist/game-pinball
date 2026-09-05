// SPDX-License-Identifier: AGPL-3.0-or-later
// maths — a geometria de colisao. Port de `maths.cpp`.
//
// Nao ha motor de fisica no Space Cadet: ha um raio, um circulo e um segmento de reta, e tudo o que a
// bola faz sai destas tres coisas. Por isso este arquivo e transcricao literal, e nao "equivalente".

/** O "nao houve colisao" do original: 1e9, e nao Infinity nem null. Comparacoes o tratam como longe. */
export const SEM_COLISAO = 1000000000;

export interface Vetor2 { x: number; y: number }

export interface Circulo {
  readonly centro: Vetor2;
  /** Ao QUADRADO: o original nunca guarda o raio, so o quadrado, para nao tirar raiz a toa. */
  readonly raioAoQuadrado: number;
}

export interface Raio {
  readonly origem: Vetor2;
  readonly direcao: Vetor2;
  readonly distanciaMaxima: number;
  /** Tolerancia de penetracao: aceita acerto ate `-distanciaMinima`. */
  readonly distanciaMinima: number;
  readonly mascaraDeColisao: number;
}

export interface Linha {
  direcao: Vetor2;
  /** Perpendicular HORARIA da direcao: (dir.y, -dir.x). E a normal da face que colide. */
  perpendicular: Vetor2;
  origem: Vetor2;
  fim: Vetor2;
  coordMin: number;
  coordMax: number;
  /** Onde o ultimo raio cruzou. Escrito por `raioIntersectaLinha`, como no original. */
  interseccao: Vetor2;
}

export function produtoVetorial(a: Vetor2, b: Vetor2): number {
  return a.x * b.y - a.y * b.x;
}

export function produtoEscalar(a: Vetor2, b: Vetor2): number {
  return a.x * b.x + a.y * b.y;
}

/** Normaliza NO LUGAR e devolve a magnitude ANTERIOR — o original usa esse retorno como velocidade. */
export function normalizar2d(v: Vetor2): number {
  const mag = Math.sqrt(v.x * v.x + v.y * v.y);
  if (mag !== 0) { v.x /= mag; v.y /= mag; }
  return mag;
}

/**
 * Distancia da origem do raio ate a primeira interseccao com o circulo.
 *
 * DUAS SAIDAS QUE PARECEM DEFEITO E NAO SAO:
 *
 * · `Tca < 0` corta ANTES do teste de "esta dentro". Quem ja esta dentro do circulo e se afastando do
 *   centro nao e empurrado de novo — sem isso a bola ficaria vibrando presa a borda.
 *
 * · quem esta DENTRO recebe distancia NEGATIVA, e sem passar pelo teste de distancia maxima. O sinal e
 *   a instrucao de recuar: a interseccao positiva mais proxima esta atras da bola, e devolve-la faria a
 *   bola atravessar o circulo em vez de sair dele.
 */
export function raioIntersectaCirculo(raio: Raio, circulo: Circulo): number {
  const lx = circulo.centro.x - raio.origem.x;
  const ly = circulo.centro.y - raio.origem.y;

  const tca = lx * raio.direcao.x + ly * raio.direcao.y;
  if (tca < 0) return SEM_COLISAO;

  const magAoQuadrado = lx * lx + ly * ly;
  const thcAoQuadrado = circulo.raioAoQuadrado - magAoQuadrado + tca * tca;

  if (magAoQuadrado < circulo.raioAoQuadrado) return tca - Math.sqrt(thcAoQuadrado);

  if (thcAoQuadrado < 0) return SEM_COLISAO;

  const t0 = tca - Math.sqrt(thcAoQuadrado);
  if (t0 < 0 || t0 > raio.distanciaMaxima) return SEM_COLISAO;
  return t0;
}

/** O epsilon do original para decidir que uma linha e vertical. */
const QUASE_ZERO = 0.000000001;

export function iniciarLinha(x0: number, y0: number, x1: number, y1: number): Linha {
  const direcao = { x: x1 - x0, y: y1 - y0 };
  normalizar2d(direcao);

  // POR QUE A DIRECAO E ENCAIXADA NO ZERO: `raioIntersectaLinha` decide em que eixo medir o segmento
  // testando `direcao.x !== 0`. Numa linha vertical, o X e o mesmo em todo ponto — medir o segmento por
  // ele transformaria o segmento inteiro num ponto e a colisao passaria a valer em qualquer altura.
  // Um resto de arredondamento em X e a diferenca entre uma parede e uma parede infinita.
  let inicio = x0, fim = x1;
  if (Math.abs(direcao.x) < QUASE_ZERO) {
    direcao.x = 0;
    inicio = y0;
    fim = y1;
  }

  return {
    direcao,
    perpendicular: { x: direcao.y, y: -direcao.x },
    origem: { x: x0, y: y0 },
    fim: { x: x1, y: y1 },
    coordMin: Math.min(inicio, fim),
    coordMax: Math.max(inicio, fim),
    interseccao: { x: 0, y: 0 },
  };
}

/**
 * Distancia ate o cruzamento com o SEGMENTO, e escreve o ponto em `linha.interseccao`.
 *
 * A LINHA E DE UM LADO SO. `v2 . v3 >= 0` devolve "sem colisao": um raio que chega pela face de tras
 * atravessa. Nao e omissao — e o que deixa o original usar segmentos como portoes de mao unica, e o
 * que impede a bola de ficar presa quando penetra uma parede entre dois quadros.
 */
export function raioIntersectaLinha(raio: Raio, linha: Linha): number {
  const v1 = { x: raio.origem.x - linha.origem.x, y: raio.origem.y - linha.origem.y };
  const v2 = linha.direcao;
  const v3 = { x: -raio.direcao.y, y: raio.direcao.x };

  const v2PontoV3 = produtoEscalar(v2, v3);
  if (v2PontoV3 >= 0) return SEM_COLISAO;

  const distancia = produtoVetorial(v2, v1) / v2PontoV3;
  if (distancia < -raio.distanciaMinima || distancia > raio.distanciaMaxima) return SEM_COLISAO;

  linha.interseccao.x = distancia * raio.direcao.x + raio.origem.x;
  linha.interseccao.y = distancia * raio.direcao.y + raio.origem.y;

  const pontoDeTeste = linha.direcao.x !== 0 ? linha.interseccao.x : linha.interseccao.y;
  if (pontoDeTeste < linha.coordMin || pontoDeTeste > linha.coordMax) return SEM_COLISAO;

  return distancia;
}

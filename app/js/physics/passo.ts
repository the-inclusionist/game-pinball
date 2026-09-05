// SPDX-License-Identifier: AGPL-3.0-or-later
// physics/passo — o avanco de um quadro da simulacao. Port de `pb::timed_frame`.
//
// E o coracao do jogo, e a estrutura dele responde a uma pergunta so: como mover uma bola rapida sem
// que ela atravesse uma parede fina. A resposta do original tem duas camadas.
//
//   1. SUBPASSOS DE MEIO RAIO. A distancia do quadro e partida em pedacos de meio raio, e a bola e
//      testada contra a mesa a cada pedaco. Uma bola nunca anda mais que meio raio sem ser conferida.
//
//   2. PASSO DE TEMPO RECORTADO PARA BOLA LENTA. Abaixo de 0,8 de velocidade o tempo do quadro e preso
//      em 0,01. Parece o contrario do que se esperaria — bola lenta e a que menos precisaria — mas a
//      razao e outra: bola lenta e a que fica encostada em coisas, e um quadro longo a empurraria para
//      dentro da geometria de uma vez so.
//
// A ORDEM DENTRO DO QUADRO TAMBEM E DELIBERADA: todas as forcas sao integradas ANTES de qualquer
// movimento, e so entao os subpassos rodam. Integrar e mover bola a bola faria a segunda bola sentir
// um campo ja alterado pela primeira.

import { SEM_COLISAO, normalizar2d, type Raio, type Vetor2 } from '../maths/maths.js';
import type { GerenciadorDeArestas } from './grade.js';
import { criarMemoriaDeColisoes, type MemoriaDeColisoes } from './bola.js';

/** Multiplicadores derivados do raio da bola, como em `pb::init`. */
const VELOCIDADE_MAXIMA_POR_RAIO = 200;
const FRACAO_DO_RAIO_POR_PASSO = 0.5;
/** Abaixo disto o passo de tempo e recortado. */
const VELOCIDADE_DE_BOLA_LENTA = 0.8;
const TEMPO_MAXIMO_DE_BOLA_LENTA = 0.01;
/** Tolerancia de penetracao do raio de colisao. */
const DISTANCIA_MINIMA_DO_RAIO = 0.002;

/** Um sink, um kicker: enquanto prende a bola, e ele quem a move. */
export interface ComponenteQuePrende {
  efeitoDeCampo(bola: Bola): void;
}

export interface Bola {
  ativa: boolean;
  posicao: Vetor2;
  direcao: Vetor2;
  velocidade: number;
  raio: number;
  deltaDeTempo: number;
  colisaoDesativada: boolean;
  mascaraDeColisao: number;
  componente: ComponenteQuePrende | null;
  memoria: MemoriaDeColisoes;
  /** O `EdgeCollisionResetFlag` do original — ver o comentario no laco interno. */
  precisaEsquecer: boolean;
}

export interface ContextoDoPasso {
  grade: GerenciadorDeArestas;
  /** A soma das forcas sobre a bola (gravidade da mesa, campos de rampa). Escreve em `destino`. */
  efeitosDeCampo(bola: Bola, destino: Vetor2): void;
}

export function criarBola(p: { raio: number; posicao: Vetor2; direcao: Vetor2; velocidade: number }): Bola {
  return {
    ativa: true, posicao: p.posicao, direcao: p.direcao, velocidade: p.velocidade, raio: p.raio,
    deltaDeTempo: 0, colisaoDesativada: false, mascaraDeColisao: 1, componente: null,
    memoria: criarMemoriaDeColisoes(), precisaEsquecer: false,
  };
}

export function avancarQuadro(bolas: readonly Bola[], ctx: ContextoDoPasso, deltaDeTempo: number): void {
  const passoDe = new Map<Bola, number>();
  const distanciaDe = new Map<Bola, number>();
  let maiorPasso = -1;

  // ---- FASE 1: integrar forcas e decidir quantos subpassos cada bola precisa ----
  for (const bola of bolas) {
    passoDe.set(bola, -1);
    if (!bola.ativa) continue;

    bola.deltaDeTempo = deltaDeTempo;
    if (bola.deltaDeTempo > TEMPO_MAXIMO_DE_BOLA_LENTA && bola.velocidade < VELOCIDADE_DE_BOLA_LENTA) {
      bola.deltaDeTempo = TEMPO_MAXIMO_DE_BOLA_LENTA;
    }
    bola.colisaoDesativada = false;

    if (bola.componente) {
      // PRESA: quem a move e o componente, e a grade nao a toca. Se tocasse, a bola sairia sozinha de
      // dentro do buraco em que caiu.
      bola.componente.efeitoDeCampo(bola);
      continue;
    }

    const forca: Vetor2 = { x: 0, y: 0 };
    ctx.efeitosDeCampo(bola, forca);
    forca.x *= bola.deltaDeTempo;
    forca.y *= bola.deltaDeTempo;

    // A DIRECAO E DESNORMALIZADA PARA VIRAR VELOCIDADE, a forca e somada, e a magnitude do resultado
    // volta a ser a velocidade. Nao ha vetor de aceleracao separado em lugar nenhum do jogo.
    bola.direcao.x *= bola.velocidade;
    bola.direcao.y *= bola.velocidade;
    bola.direcao.x += forca.x;
    bola.direcao.y += forca.y;
    bola.velocidade = normalizar2d(bola.direcao);

    const velocidadeMaxima = bola.raio * VELOCIDADE_MAXIMA_POR_RAIO;
    if (bola.velocidade > velocidadeMaxima) bola.velocidade = velocidadeMaxima;

    const distancia = bola.velocidade * bola.deltaDeTempo;
    distanciaDe.set(bola, distancia);

    const meioRaio = bola.raio * FRACAO_DO_RAIO_POR_PASSO;
    const passo = Math.ceil(distancia / meioRaio) - 1;
    passoDe.set(bola, passo);
    if (passo > maiorPasso) maiorPasso = passo;
  }

  // ---- FASE 2: os subpassos ----
  for (let passo = 0; passo <= maiorPasso; passo++) {
    for (const bola of bolas) {
      const meuPasso = passoDe.get(bola)!;
      if (bola.colisaoDesativada || meuPasso < passo) continue;

      const meioRaio = bola.raio * FRACAO_DO_RAIO_POR_PASSO;
      const distanciaTotal = distanciaDe.get(bola)!;

      for (let percorrido = 0; percorrido < meioRaio;) {
        // Copias, e nao referencias: no original o raio recebe os vetores por VALOR, e a resposta de
        // colisao mexe na bola no meio do caminho.
        const raio: Raio = {
          origem: { x: bola.posicao.x, y: bola.posicao.y },
          direcao: { x: bola.direcao.x, y: bola.direcao.y },
          // No ULTIMO subpasso sobra so o resto da distancia; nos demais, meio raio cheio.
          distanciaMaxima: meuPasso <= passo ? distanciaTotal - meuPasso * meioRaio : meioRaio,
          distanciaMinima: DISTANCIA_MINIMA_DO_RAIO,
          mascaraDeColisao: bola.mascaraDeColisao,
        };

        const achado = ctx.grade.encontrarDistanciaDeColisao(raio, (a) => bola.memoria.jaAtingiu(a));

        // A DANCA DA MEMORIA, transcrita: se alguma aresta se registrou desde a ultima volta, a marca
        // esta ligada e so se apaga a marca; senao, a memoria inteira e esquecida e a marca religa.
        // O efeito e que a memoria sobrevive enquanto houver colisao acontecendo, e e apagada uma
        // volta depois da primeira volta sem colisao.
        if (bola.precisaEsquecer) {
          bola.precisaEsquecer = false;
        } else {
          bola.memoria.esquecer();
          bola.precisaEsquecer = true;
        }

        if (achado.distancia >= SEM_COLISAO) {
          bola.posicao.x += raio.distanciaMaxima * raio.direcao.x;
          bola.posicao.y += raio.distanciaMaxima * raio.direcao.y;
          break;
        }

        achado.aresta!.aoColidir(bola, achado.distancia);
        if (achado.distancia <= 0 || bola.colisaoDesativada) break;
        percorrido += achado.distancia;
      }
    }
  }
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// physics/arestas — as duas arestas geometricas da mesa. Port de `TLine` e `TCircle`.
//
// ========================= A DIVISAO DE TRABALHO =========================
// A aresta sabe GEOMETRIA e mais nada: onde ela esta, a que distancia o raio a cruza, e qual e a
// normal no ponto de contato. O que ACONTECE na batida — quicar, pontuar, tocar som, acender luz — e
// do componente dono, que recebe tudo pronto por `colisao(...)`.
//
// E por isso que ha so duas arestas para quarenta componentes: um bumper e um alvo tem a mesma
// geometria e reagem diferente.
//
// ========================= POR QUE `deslocarLinha` EXISTE =========================
// A bola tem raio, mas o original nao testa circulo contra parede: ele EMPURRA a parede para fora pelo
// raio da bola e trata a bola como um ponto. Uma conta a menos por parede, por bola, por quadro — e a
// razao pela qual `install_wall` recebe um `offset`.

import {
  iniciarLinha, normalizar2d, raioIntersectaCirculo, raioIntersectaLinha,
  type Linha, type Raio, type Vetor2,
} from '../maths/maths.js';
import type { ComCirculo, ComSegmento } from './grade.js';

/** O que a aresta chama quando a bola bate. `TCollisionComponent::Collision` no original. */
export interface Componente {
  colisao(bola: unknown, posicao: Vetor2, direcao: Vetor2, distancia: number, aresta: unknown): void;
}

export interface ArestaDeLinha extends ComSegmento {
  readonly tipo: 'linha';
  linha: Linha;
  componente: Componente;
}

export interface ArestaDeCirculo extends ComCirculo {
  readonly tipo: 'circulo';
  componente: Componente;
}

export interface OpcoesDeLinha {
  componente: Componente;
  inicio: Vetor2;
  fim: Vetor2;
  ativa?: boolean;
  grupoDeColisao?: number;
}

export function criarLinha(o: OpcoesDeLinha): ArestaDeLinha {
  const aresta: ArestaDeLinha = {
    tipo: 'linha',
    ativa: o.ativa ?? true,
    grupoDeColisao: o.grupoDeColisao ?? 0xffff,
    componente: o.componente,
    x0: o.inicio.x, y0: o.inicio.y, x1: o.fim.x, y1: o.fim.y,
    linha: iniciarLinha(o.inicio.x, o.inicio.y, o.fim.x, o.fim.y),

    distanciaDeColisao(raio: Raio): number {
      return raioIntersectaLinha(raio, aresta.linha);
    },

    // O ponto de contato vem de `linha.interseccao`, que a consulta anterior escreveu. E o original
    // faz exatamente isso: guarda o resultado na propria linha e o le aqui.
    aoColidir(bola: unknown, distancia: number): void {
      aresta.componente.colisao(bola, aresta.linha.interseccao, aresta.linha.perpendicular, distancia, aresta);
    },
  };
  return aresta;
}

/** `TLine::Offset`: empurra a linha ao longo da propria perpendicular e a reconstroi. */
export function deslocarLinha(aresta: ArestaDeLinha, deslocamento: number): void {
  const dx = deslocamento * aresta.linha.perpendicular.x;
  const dy = deslocamento * aresta.linha.perpendicular.y;
  aresta.x0 += dx; aresta.y0 += dy;
  aresta.x1 += dx; aresta.y1 += dy;
  aresta.linha = iniciarLinha(aresta.x0, aresta.y0, aresta.x1, aresta.y1);
}

export interface OpcoesDeCirculo {
  componente: Componente;
  centro: Vetor2;
  raio: number;
  ativa?: boolean;
  grupoDeColisao?: number;
}

export function criarCirculo(o: OpcoesDeCirculo): ArestaDeCirculo {
  const circulo = { centro: { x: o.centro.x, y: o.centro.y }, raioAoQuadrado: o.raio * o.raio };

  const aresta: ArestaDeCirculo = {
    tipo: 'circulo',
    ativa: o.ativa ?? true,
    grupoDeColisao: o.grupoDeColisao ?? 0xffff,
    componente: o.componente,
    centro: circulo.centro,
    raio: o.raio,

    distanciaDeColisao(raio: Raio): number {
      return raioIntersectaCirculo(raio, circulo);
    },

    /**
     * O circulo NAO guarda o ponto de contato entre uma consulta e outra: ele o recalcula a partir da
     * posicao e da direcao da bola. E a diferenca real entre ele e a linha, e nao um detalhe de estilo
     * — e o que o torna seguro quando duas bolas consultam o mesmo circulo no mesmo quadro.
     */
    aoColidir(bola: unknown, distancia: number): void {
      const b = bola as { posicao: Vetor2; direcao: Vetor2 };
      const posicao = {
        x: distancia * b.direcao.x + b.posicao.x,
        y: distancia * b.direcao.y + b.posicao.y,
      };
      const direcao = { x: posicao.x - circulo.centro.x, y: posicao.y - circulo.centro.y };
      normalizar2d(direcao);
      aresta.componente.colisao(bola, posicao, direcao, distancia, aresta);
    },
  };
  return aresta;
}

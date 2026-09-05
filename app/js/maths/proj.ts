// SPDX-License-Identifier: AGPL-3.0-or-later
// maths/proj — a projecao da mesa para a tela. Port de `proj.cpp`.
//
// ========================= O "3D" DO 3D PINBALL E UMA ROTACAO DE 24 GRAUS =========================
// A matriz do jogo, transcrita do comentario do upstream, e a MESMA em todas as resolucoes:
//
//     1        0          0          0
//     0       -0.913545   0.406737   3.791398
//     0       -0.406737  -0.913545  24.675402
//
// `0.913545` e `cos(24 graus)` e `0.406737` e `sen(24 graus)`. Nao ha malha, nao ha profundidade real:
// a mesa e um plano inclinado 24 graus, a camera esta recuada 24,675 e erguida 3,79, e a divisao
// perspectiva faz o resto. O relevo aparente (rampas, calhas) vem do z-map, nao da geometria.
//
// E COMO A MATRIZ NAO MUDA COM A RESOLUCAO, so `d` (a distancia focal) e o centro da tela mudam. E por
// isso que reduzir a mesa a metade custa dois escalares e nao uma reescrita.

export interface Linha4 { x: number; y: number; z: number; w: number }
export interface Matriz { linha0: Linha4; linha1: Linha4; linha2: Linha4 }
export interface Vetor3 { x: number; y: number; z: number }

export const MATRIZ_DO_JOGO: Matriz = {
  linha0: { x: 1, y: 0, z: 0, w: 0 },
  linha1: { x: 0, y: -0.913545, z: 0.406737, w: 3.791398 },
  linha2: { x: 0, y: -0.406737, z: -0.913545, w: 24.675402 },
};

/** O coeficiente sentinela do original para quando o Z projetado da exatamente zero. */
const COEFICIENTE_DEGENERADO = 999999.88;

export interface Projecao {
  paraTela(v: Vetor3): { x: number; y: number };
  /** Desprojeta um pixel de volta para a mesa, SEMPRE no plano z = 0. */
  paraMesa(p: { x: number; y: number }): Vetor3;
  normalizarProfundidade(profundidade: number): number;
}

export interface Opcoes {
  readonly matriz: Matriz;
  /** Distancia focal. Muda por resolucao. */
  readonly d: number;
  readonly centroX: number;
  readonly centroY: number;
  readonly zMin: number;
  readonly zEscala: number;
}

function multiplicar(m: Matriz, v: Vetor3): Vetor3 {
  return {
    x: v.z * m.linha0.z + v.y * m.linha0.y + v.x * m.linha0.x + m.linha0.w,
    y: v.z * m.linha1.z + v.y * m.linha1.y + v.x * m.linha1.x + m.linha1.w,
    z: v.z * m.linha2.z + v.y * m.linha2.y + v.x * m.linha2.x + m.linha2.w,
  };
}

/** Escreve e le um Uint16Array para reproduzir o envolvimento do `static_cast<uint16_t>` do original. */
const DEZESSEIS_BITS = new Uint16Array(1);

export function criarProjecao(o: Opcoes): Projecao {
  const zMax = 0xffffffff / o.zEscala + o.zMin;

  return {
    paraTela(v: Vetor3): { x: number; y: number } {
      const p = multiplicar(o.matriz, v);
      const coeficiente = p.z === 0 ? COEFICIENTE_DEGENERADO : o.d / p.z;
      // TRUNCA na direcao do zero, como o `static_cast<int>` do original. Arredondar deslocaria meio
      // pixel em metade dos sprites — pouco, e o bastante para nenhuma comparacao pixel a pixel fechar.
      return {
        x: Math.trunc(p.x * coeficiente + o.centroX),
        y: Math.trunc(p.y * coeficiente + o.centroY),
      };
    },

    /**
     * A inversa, resolvida com z0 fixo em 0. O upstream deixa a derivacao escrita no proprio arquivo:
     *   y0 = (y2 * (A*z0 + G) - B*z0 - F) / (A + B*y2)
     *   x0 =  x2 * (A*z0 - B*y0 + G)
     * com A = matriz[1][1], B = matriz[1][2], F = matriz[1][3], G = matriz[2][3].
     */
    paraMesa(ponto: { x: number; y: number }): Vetor3 {
      const a = o.matriz.linha1.y, b = o.matriz.linha1.z, f = o.matriz.linha1.w, g = o.matriz.linha2.w;
      const x2 = (ponto.x - o.centroX) / o.d;
      const y2 = (ponto.y - o.centroY) / o.d;
      const z0 = 0;

      const y0 = (y2 * (a * z0 + g) - b * z0 - f) / (a + b * y2);
      const x0 = x2 * (a * z0 - b * y0 + g);
      return { x: x0, y: y0, z: z0 };
    },

    /**
     * Profundidade real para o inteiro de 16 bits do z-buffer.
     *
     * ⚠️ A GUARDA DO ORIGINAL COMPARA GRANDEZAS DIFERENTES: `depthScaled <= zmax`, sendo que `zmax` foi
     * calculado em unidades NAO escaladas (`0xffffffff / zEscala + zMin`). Entao ela quase nunca
     * dispara, e o cast para 16 bits ENVOLVE em vez de saturar. E defeito latente do original, nao
     * deste port. Fica transcrito e apontado: as profundidades reais da mesa nunca chegam la, e
     * "consertar" mudaria o comportamento sem que ninguem tivesse pedido.
     */
    normalizarProfundidade(profundidade: number): number {
      if (profundidade < o.zMin) return 0;
      const escalada = (profundidade - o.zMin) * o.zEscala;
      if (escalada > zMax) return 0xffff;
      DEZESSEIS_BITS[0] = escalada;
      return DEZESSEIS_BITS[0]!;
    },
  };
}

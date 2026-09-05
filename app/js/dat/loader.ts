// SPDX-License-Identifier: AGPL-3.0-or-later
// dat/loader — transforma os grupos crus do PARTOUT no modelo da mesa.
//
// Port da parte de `loader.cpp` que responde as tres perguntas de que tudo o mais depende: onde esta
// cada grupo, que tamanho tem a mesa, e quais objetos a compoem.

import { lerGrupos, TipoDeEntrada, type Grupo } from './partman.js';

/**
 * Os tipos de objeto da mesa do Space Cadet, conforme `Doc/.dat file format.txt`.
 * Os buracos na numeracao (1008, 1009, 1025, 1027, 1032) sao do formato, nao omissao aqui.
 */
export const TipoDeObjeto = {
  Plunger: 1001,
  Luz: 1002,
  FlipperEsquerdo: 1003,
  FlipperDireito: 1004,
  Bumper: 1005,
  AlvoAmarelo: 1006,
  Dreno: 1007,
  Bloco: 1011,
  Kout: 1012,
  Portao: 1013,
  Kicker: 1014,
  Rolagem: 1015,
  MaoUnica: 1016,
  Sink: 1017,
  Bandeira: 1018,
  AlvoVermelho: 1019,
  RolagemVerde: 1020,
  Rampa: 1021,
  BuracoDeRampa: 1022,
  Demo: 1023,
  Trip: 1024,
  Luzes: 1026,
  ListaDeBumpers: 1028,
  Kout2: 1029,
  BarraDeCombustivel: 1030,
  Som: 1031,
  CaixaDeTexto: 1033,
} as const;

export interface ObjetoDaMesa {
  readonly tipo: number;
  /** Indice do grupo que carrega os dados deste objeto. */
  readonly grupo: number;
}

export interface Mesa {
  readonly grupos: readonly Grupo[];
  /** `null`, e nao -1: um -1 usado sem conferir e um indice valido em JS e le `undefined` calado. */
  indiceDoGrupo(nome: string): number | null;
  readonly tamanhoDaMesa: { readonly largura: number; readonly altura: number } | null;
  readonly objetosDaMesa: readonly ObjetoDaMesa[];
}

/** Le a carga de uma entrada tipo 10 como int16 com sinal. */
function int16s(dados: Uint8Array): number[] {
  const dv = new DataView(dados.buffer, dados.byteOffset, dados.byteLength);
  const n = Math.floor(dados.byteLength / 2);
  const saida: number[] = [];
  for (let i = 0; i < n; i++) saida.push(dv.getInt16(i * 2, true));
  return saida;
}

function inteirosDoGrupo(grupos: readonly Grupo[], indice: number | null): number[] | null {
  if (indice === null) return null;
  const g = grupos[indice];
  if (!g) return null;
  const e = g.entradas.find((x) => x.tipo === TipoDeEntrada.Int16s);
  return e?.dados ? int16s(e.dados) : null;
}

export function carregarMesa(arquivo: Uint8Array): Mesa {
  const grupos = lerGrupos(arquivo);

  // Um mapa e nao uma varredura: `loader.cpp` procura grupo por nome o tempo todo, e uma varredura
  // linear por 541 grupos a cada consulta e o tipo de custo que so aparece quando a mesa ja esta grande.
  const porNome = new Map<string, number>();
  grupos.forEach((g, i) => { if (g.nome !== null && !porNome.has(g.nome)) porNome.set(g.nome, i); });
  const indiceDoGrupo = (nome: string): number | null => porNome.get(nome) ?? null;

  const medidas = inteirosDoGrupo(grupos, indiceDoGrupo('table_size'));
  const tamanhoDaMesa = medidas && medidas.length >= 2
    ? { largura: medidas[0]!, altura: medidas[1]! }
    : null;

  // O PRIMEIRO INTEIRO NAO E UM OBJETO. A spec o marca como desconhecido, e os pares vem depois dele;
  // comecar do zero desloca a lista inteira e cada objeto recebe o grupo do vizinho.
  const brutos = inteirosDoGrupo(grupos, indiceDoGrupo('table_objects')) ?? [];
  const objetosDaMesa: ObjetoDaMesa[] = [];
  for (let i = 1; i + 1 < brutos.length; i += 2) {
    objetosDaMesa.push({ tipo: brutos[i]!, grupo: brutos[i + 1]! });
  }

  return { grupos, indiceDoGrupo, tamanhoDaMesa, objetosDaMesa };
}

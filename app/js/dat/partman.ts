// SPDX-License-Identifier: AGPL-3.0-or-later
// dat/partman — leitor do arquivo PARTOUT (.DAT). Port de partman.cpp do upstream.
//
// Formato conforme `Doc/.dat file format.txt` (AdrienTD). Os tres campos de texto do cabecalho tem
// tamanho FIXO e sao preenchidos com zeros — o texto util e o que vem antes do primeiro NUL.

/** Deslocamentos do cabecalho, em bytes. Nomeados porque `0x47` sozinho nao diz o que e. */
const OFF = {
  assinatura: 0x00, nomeDoApp: 0x15, descricao: 0x47,
  tamanhoDoArquivo: 0xab, numeroDeGrupos: 0xaf, tamanhoDoCorpo: 0xb1,
} as const;
const TAM = { assinatura: 21, nomeDoApp: 50, descricao: 100 } as const;

/** Onde o corpo comeca. Nao e deduzido: e o fim do cabecalho de tamanho fixo, e o dump do upstream
 *  confirma listando o grupo 0 em `location: 0xB7`. */
export const INICIO_DO_CORPO = 0xb7;

/** A unica assinatura que este leitor aceita. Um arquivo com outra nao e um erro de leitura — e outro formato. */
export const ASSINATURA_ESPERADA = 'PARTOUT(4.0)RESOURCE';

/** Texto de um campo de tamanho fixo: para no primeiro NUL, e nao arrasta o preenchimento. */
function textoFixo(a: Uint8Array, inicio: number, tamanho: number): string {
  const campo = a.subarray(inicio, inicio + tamanho);
  const fim = campo.indexOf(0);
  return new TextDecoder('latin1').decode(fim === -1 ? campo : campo.subarray(0, fim));
}

export interface Cabecalho {
  readonly assinatura: string;
  readonly nomeDoApp: string;
  readonly descricao: string;
  readonly numeroDeGrupos: number;
  readonly tamanhoDoCorpo: number;
  readonly inicioDoCorpo: number;
}

export function lerCabecalho(arquivo: Uint8Array): Cabecalho {
  const assinatura = textoFixo(arquivo, OFF.assinatura, TAM.assinatura);
  // FALHA ALTO, e nao em silencio: seguir lendo offsets de um formato que nao e este daria numeros
  // plausiveis e um erro trinta funcoes adiante, longe da causa.
  if (assinatura !== ASSINATURA_ESPERADA) {
    throw new Error(`partman: assinatura inesperada ${JSON.stringify(assinatura)} — esperava ${JSON.stringify(ASSINATURA_ESPERADA)}`);
  }
  const dv = new DataView(arquivo.buffer, arquivo.byteOffset, arquivo.byteLength);
  return {
    assinatura,
    nomeDoApp: textoFixo(arquivo, OFF.nomeDoApp, TAM.nomeDoApp),
    descricao: textoFixo(arquivo, OFF.descricao, TAM.descricao),
    numeroDeGrupos: dv.getUint16(OFF.numeroDeGrupos, true),
    tamanhoDoCorpo: dv.getUint32(OFF.tamanhoDoCorpo, true),
    inicioDoCorpo: INICIO_DO_CORPO,
  };
}

/* ===================== CORPO: GRUPOS E ENTRADAS ===================== */

/**
 * Os tipos de entrada, conforme `Doc/.dat file format.txt`. Os numeros nao sao sequenciais porque
 * o formato original nao os fez sequenciais — 2, 4, 6, 7 e 8 simplesmente nao existem.
 */
export const TipoDeEntrada = {
  /** A ARMADILHA: nao tem DWORD de tamanho, tem WORD de valor. */
  Valor16: 0,
  Bitmap8: 1,
  NomeDeGrupo: 3,
  Paleta: 5,
  String: 9,
  Int16s: 10,
  /** Arrays de float: e aqui que mora a geometria de colisao. */
  Float32s: 11,
  ZMap: 12,
} as const;
export type TipoDeEntrada = (typeof TipoDeEntrada)[keyof typeof TipoDeEntrada];

export interface Entrada {
  readonly tipo: number;
  /** Os bytes crus da entrada. Ausente no tipo 0, que carrega `valor` em vez de dados. */
  readonly dados?: Uint8Array;
  /** So no tipo 0. */
  readonly valor?: number;
}

export interface Grupo {
  /** O texto da entrada tipo 3, quando o grupo tem uma. Nem todo grupo tem nome. */
  readonly nome: string | null;
  readonly entradas: readonly Entrada[];
}

export function lerGrupos(arquivo: Uint8Array): Grupo[] {
  const cab = lerCabecalho(arquivo);
  const dv = new DataView(arquivo.buffer, arquivo.byteOffset, arquivo.byteLength);
  const grupos: Grupo[] = [];
  let p = cab.inicioDoCorpo;

  for (let g = 0; g < cab.numeroDeGrupos; g++) {
    const quantas = dv.getUint8(p); p += 1;
    const entradas: Entrada[] = [];
    let nome: string | null = null;

    for (let e = 0; e < quantas; e++) {
      const tipo = dv.getUint8(p); p += 1;

      if (tipo === TipoDeEntrada.Valor16) {
        entradas.push({ tipo, valor: dv.getUint16(p, true) });
        p += 2;
        continue;
      }

      const tamanho = dv.getUint32(p, true); p += 4;
      const dados = arquivo.subarray(p, p + tamanho); p += tamanho;
      entradas.push({ tipo, dados });

      if (tipo === TipoDeEntrada.NomeDeGrupo) nome = textoFixo(dados, 0, dados.length);
    }

    grupos.push({ nome, entradas });
  }

  return grupos;
}

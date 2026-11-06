/** Esqueleto do RED (15-27, Task 2). O GREEN troca isto pela implementação. */

export interface ContagemPorColecao {
  readonly colecao: string;
  readonly linhas: number;
}

export interface EtapaDoRelatorio {
  readonly nome: string;
  readonly ordem: number;
  readonly probabilidade: number;
}

export interface FunilDoRelatorio {
  readonly id: string;
  readonly nome: string;
  readonly estado: string;
  readonly privado: boolean;
  readonly etapas: readonly EtapaDoRelatorio[];
  readonly referencias: readonly { readonly colecao: string; readonly quantidade: number }[];
  readonly destino: { readonly tipo: "migra"; readonly padrao: boolean } | { readonly tipo: "nao-migra"; readonly motivo: string };
}

export interface ListaDoRelatorio {
  readonly id: string;
  readonly nome: string;
  readonly tarefas: number;
}

export interface EntradaDoRelatorio {
  readonly espaco: string;
  readonly noRegistros: readonly ContagemPorColecao[];
  readonly conversasDeGrupo: number;
  readonly jaGuardadas: readonly ContagemPorColecao[];
  readonly funis: readonly FunilDoRelatorio[];
  readonly funisNoCrmNovo: { readonly total: number; readonly temPadrao: boolean };
  readonly pasta: { readonly existe: boolean; readonly nome: string | undefined; readonly listas: readonly ListaDoRelatorio[]; readonly removivel: boolean };
}

export function montarRelatorio(_entrada: EntradaDoRelatorio): string {
  return "";
}

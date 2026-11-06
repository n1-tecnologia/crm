/**
 * A Pasta "Meus negócios" e as Listas espelho dela (D-15-14): o CRM novo não tem espelho de Funil, então
 * a Pasta sai de todo Espaço onde nenhuma Lista tem Tarefa.
 *
 * Pura: planeja sobre o pedaço do estado que `formatos-antigos.ts` descreve e remove dele. Quem copia as
 * linhas antes e confere é `migrar-crm-antigo.ts`. As Listas trazem o Conjunto de Status DENTRO delas, então
 * ele sai junto; as Visualizações saem pelo `listId`.
 *
 * A Pasta é achada pelo id do seed (`fld_meus_negocios`), nunca pelo nome: uma Pasta que alguém criou com
 * o mesmo nome é dele e não é tocada.
 */

import type { EstadoComPasta } from "./formatos-antigos";
import type { ChaveDeRegistro } from "./guardar";

/** O id da Pasta espelho (`MEUS_NEGOCIOS_ID` do seed). Texto aqui porque o seed vai sair do domínio. */
export const ID_DA_PASTA_MEUS_NEGOCIOS = "fld_meus_negocios";

export interface ListaDaPasta {
  readonly id: string;
  readonly nome: string;
  /** Tarefas da Lista em qualquer estado (arquivada e na lixeira contam). */
  readonly tarefas: number;
}

export interface PlanoDaPasta {
  readonly existe: boolean;
  readonly nome: string | undefined;
  readonly listas: readonly ListaDaPasta[];
  /** Todas as Listas vazias: a Pasta inteira pode sair. Com uma Tarefa em qualquer Lista, nada sai. */
  readonly removivel: boolean;
}

export function planejarPasta(estado: EstadoComPasta): PlanoDaPasta {
  const pasta = estado.folders.find((f) => f.id === ID_DA_PASTA_MEUS_NEGOCIOS);
  if (!pasta) return { existe: false, nome: undefined, listas: [], removivel: false };
  const tarefasPorLista = new Map<string, number>();
  for (const tarefa of estado.tasks) tarefasPorLista.set(tarefa.listId, (tarefasPorLista.get(tarefa.listId) ?? 0) + 1);
  const listas = estado.lists
    .filter((l) => l.parentType === "folder" && l.parentId === pasta.id)
    .map((l) => ({ id: l.id, nome: l.name, tarefas: tarefasPorLista.get(l.id) ?? 0 }));
  return { existe: true, nome: pasta.name, listas, removivel: listas.every((l) => l.tarefas === 0) };
}

/** As linhas de `registros` que a remoção leva (a Pasta, as Listas e as Visualizações delas); vazio se a Pasta não é removível. */
export function chavesDaPasta(estado: EstadoComPasta, plano: PlanoDaPasta): ChaveDeRegistro[] {
  if (!plano.existe || !plano.removivel) return [];
  const idsDasListas = new Set(plano.listas.map((l) => l.id));
  return [
    { colecao: "folders", id: ID_DA_PASTA_MEUS_NEGOCIOS },
    ...plano.listas.map((l) => ({ colecao: "lists", id: l.id })),
    ...estado.views.filter((v) => idsDasListas.has(v.listId)).map((v) => ({ colecao: "views", id: v.id })),
  ];
}

function tirar<T>(itens: T[], remover: (item: T) => boolean): void {
  for (let i = itens.length - 1; i >= 0; i -= 1) {
    if (remover(itens[i]!)) itens.splice(i, 1);
  }
}

/** Tira do estado a Pasta, as Listas e as Visualizações dela, e só elas. Não faz nada se a Pasta não é removível. */
export function removerPasta(estado: EstadoComPasta, plano: PlanoDaPasta): void {
  if (!plano.existe || !plano.removivel) return;
  const idsDasListas = new Set(plano.listas.map((l) => l.id));
  tirar(estado.views, (v) => idsDasListas.has(v.listId));
  tirar(estado.lists, (l) => idsDasListas.has(l.id));
  tirar(estado.folders, (f) => f.id === ID_DA_PASTA_MEUS_NEGOCIOS);
}

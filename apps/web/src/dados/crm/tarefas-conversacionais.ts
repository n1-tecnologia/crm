"use client";

/**
 * O resumo da Tarefa conversacional, lido em lote da api (Fase 14, 3.3.3): o
 * Contato, o Canal, a última Mensagem e o Negócio de cada Tarefa vêm de
 * `POST /tarefas-conversacionais/resumo` (`apps/api`, plano 14-13), numa chamada
 * por Lista — não de uma consulta por cartão. Só HTTP: nenhum arquivo daqui
 * importa o workspace da api; o contrato é o JSON e os tipos de
 * `@n1/dominio/crm/resumo-da-tarefa`.
 *
 * Quem pergunta é a Tarefa, por ids: `vinculosDoCrmDaTarefa` lê de `state.links`
 * o Contato, a Conversa e o Negócio a que ela aponta (a Subtarefa lê a raiz) e
 * a api confere, nas tabelas, o que existe, o que está na lixeira e quem foi
 * mesclado. Por isso uma Tarefa cujos Vínculos ainda são ids do modelo antigo
 * volta com tudo `null`: o script de migração da Fase 15 é o que religa essas
 * Tarefas, e este código só vai ao ar junto com ele (D-01). Nenhum componente
 * cai de volta para a leitura antiga quando o resumo vem vazio.
 *
 * A chave de SWR é um array: o caminho e, depois dele, uma assinatura por
 * Tarefa (`taskId` + os três ids), em ordem. Os ids entram na chave porque o
 * resumo de uma Tarefa muda quando ela troca de Canal ou de Negócio, e o
 * `taskId` sozinho serviria o resumo velho. Uma Tarefa sem nenhum Vínculo do
 * CRM não vai à api: o resumo dela é vazio por definição, montado aqui.
 */

import { createContext, createElement, useContext, useMemo, type ReactNode } from "react";
import useSWR from "swr";
import { RESUMO_MAXIMO, type ResumoDaTarefaConversacional, type VinculoParaResumo } from "@n1/dominio/crm/resumo-da-tarefa";
import { vinculosDoCrmDaTarefa } from "@n1/dominio/derive-conversacional";
import type { Task } from "@n1/dominio/types";
import { useData } from "@/dados/store";
import { chamarCrm, ErroDeApi } from "./cliente-crm";

const CAMINHO_DO_RESUMO = "/tarefas-conversacionais/resumo";

interface RespostaDoResumo {
  readonly ok: true;
  readonly itens: readonly ResumoDaTarefaConversacional[];
  readonly total: number;
}

export interface ResultadoDoResumo {
  readonly porTarefa: ReadonlyMap<string, ResumoDaTarefaConversacional>;
  /** Primeira busca ainda sem resposta. Com resumo anterior na tela, uma busca nova não conta. */
  readonly carregando: boolean;
  readonly erro?: ErroDeApi;
}

function resumoVazio(taskId: string): ResumoDaTarefaConversacional {
  return { taskId, contato: null, canal: null, ultimaMensagem: null, negocio: null };
}

function temVinculo(v: VinculoParaResumo): boolean {
  return v.contatoId !== undefined || v.conversaId !== undefined || v.negocioId !== undefined;
}

function assinaturaDe(v: VinculoParaResumo): string {
  return [v.taskId, v.contatoId ?? "", v.conversaId ?? "", v.negocioId ?? ""].join("|");
}

/** Recusa 4xx não melhora ao repetir: só rede e 5xx tentam de novo. */
function valeRepetir(erro: Error): boolean {
  return !(erro instanceof ErroDeApi) || erro.status === 0 || erro.status >= 500;
}

/** Parte os Vínculos em lotes de `RESUMO_MAXIMO` e junta os itens na ordem pedida. */
async function buscarEmLotes(vinculos: readonly VinculoParaResumo[]): Promise<readonly ResumoDaTarefaConversacional[]> {
  const lotes: VinculoParaResumo[][] = [];
  for (let i = 0; i < vinculos.length; i += RESUMO_MAXIMO) lotes.push(vinculos.slice(i, i + RESUMO_MAXIMO));
  const respostas = await Promise.all(
    lotes.map((lote) => chamarCrm<RespostaDoResumo>(CAMINHO_DO_RESUMO, { method: "POST", corpo: { vinculos: lote } })),
  );
  return respostas.flatMap((r) => r.itens);
}

/** Os ids de cada Tarefa, sem repetir `taskId`, em ordem estável. */
function vinculosDasTarefas(state: Parameters<typeof vinculosDoCrmDaTarefa>[0], tarefas: readonly Task[]): VinculoParaResumo[] {
  const vistos = new Map<string, VinculoParaResumo>();
  for (const task of tarefas) {
    if (vistos.has(task.id)) continue;
    vistos.set(task.id, { taskId: task.id, ...vinculosDoCrmDaTarefa(state, task) });
  }
  return [...vistos.values()].sort((a, b) => (a.taskId < b.taskId ? -1 : a.taskId > b.taskId ? 1 : 0));
}

function useBuscaDoResumo(tarefas: readonly Task[]): ResultadoDoResumo {
  const state = useData((dados) => dados);
  const todos = vinculosDasTarefas(state, tarefas);
  const comVinculo = todos.filter(temVinculo);
  const semVinculo = todos.filter((v) => !temVinculo(v)).map((v) => v.taskId);
  const chave = comVinculo.length === 0 ? null : ([CAMINHO_DO_RESUMO, ...comVinculo.map(assinaturaDe)] as const);

  const busca = useSWR<readonly ResumoDaTarefaConversacional[], Error>(chave, () => buscarEmLotes(comVinculo), {
    // Filtro e ordem não mudam a chave; uma Tarefa nova sim, e o cartão antigo fica até a resposta chegar.
    keepPreviousData: true,
    shouldRetryOnError: valeRepetir,
  });

  const erro = busca.error instanceof ErroDeApi ? busca.error : undefined;
  const dados = erro ? undefined : busca.data;
  const idsLocais = semVinculo.join("|");
  const porTarefa = useMemo(() => {
    const mapa = new Map<string, ResumoDaTarefaConversacional>();
    for (const id of idsLocais === "" ? [] : idsLocais.split("|")) mapa.set(id, resumoVazio(id));
    for (const item of dados ?? []) mapa.set(item.taskId, item);
    return mapa;
  }, [dados, idsLocais]);

  return {
    porTarefa,
    carregando: chave !== null && busca.isLoading,
    ...(erro ? { erro } : {}),
  };
}

/**
 * O resumo de muitas Tarefas numa chamada só (lotes de 200). `porTarefa` tem uma
 * entrada por Tarefa que a api respondeu; a recusa fica em `erro` e deixa o mapa
 * sem os itens dela.
 */
export function useResumoDasTarefas(tarefas: readonly Task[]): ResultadoDoResumo {
  return useBuscaDoResumo(tarefas);
}

interface ValorDoProvedor extends ResultadoDoResumo {
  /** As Tarefas que o provedor foi buscar: quem não está aqui faz a própria chamada. */
  readonly cobre: ReadonlySet<string>;
}

const ContextoDoResumo = createContext<ValorDoProvedor | null>(null);

/** Uma busca por Lista: os cartões, as linhas e a ficha abaixo dele leem desta mesma resposta. */
export function ProvedorDoResumoDasTarefas({ tarefas, children }: { readonly tarefas: readonly Task[]; readonly children?: ReactNode }) {
  const resultado = useBuscaDoResumo(tarefas);
  const ids = tarefas.map((t) => t.id).join("|");
  const cobre = useMemo(() => new Set(ids === "" ? [] : ids.split("|")), [ids]);
  const { porTarefa, carregando, erro } = resultado;
  const valor = useMemo<ValorDoProvedor>(() => ({ porTarefa, carregando, cobre, ...(erro ? { erro } : {}) }), [porTarefa, carregando, erro, cobre]);
  return createElement(ContextoDoResumo.Provider, { value: valor }, children);
}

/**
 * O resumo de UMA Tarefa. Dentro de um `ProvedorDoResumoDasTarefas` que a cobre,
 * lê da resposta dele (nenhuma chamada nova); fora, faz a própria chamada, para a
 * ficha aberta sozinha. `pausado` não chama a api: o cartão de Tarefa comum só
 * precisa do resumo quando é uma Reunião. `undefined` enquanto a resposta não
 * chega, para uma Tarefa que não existe no estado ou quando está pausado.
 */
export function useResumoDaTarefa(taskId: string, opcoes: { readonly pausado?: boolean } = {}): ResumoDaTarefaConversacional | undefined {
  const doProvedor = useContext(ContextoDoResumo);
  const task = useData((dados) => dados.tasks.find((t) => t.id === taskId));
  const cobertaPeloProvedor = doProvedor !== null && doProvedor.cobre.has(taskId);
  const propria = useBuscaDoResumo(cobertaPeloProvedor || opcoes.pausado === true || task === undefined ? [] : [task]);
  return (cobertaPeloProvedor ? doProvedor : propria).porTarefa.get(taskId);
}

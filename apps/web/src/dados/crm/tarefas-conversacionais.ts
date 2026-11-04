"use client";

/**
 * A Tarefa conversacional por HTTP (Fase 14, 3.3.3 a 3.3.6). Leitura: o resumo
 * em lote. Escrita: criar, trocar o Canal, ligar e criar o Negócio.
 *
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
import type { ActorRef, Priority, Task, TaskDate } from "@n1/dominio/types";
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

/*
 * ESCRITA. Cada função manda só ids e a primeira Mensagem: o Contato do Vínculo,
 * a Etapa, o Proprietário e o que mais a Tarefa precisa o servidor lê e confere
 * nas tabelas, e os corpos `.strict()` da api recusam qualquer outro campo
 * (T-14-41). A tela chama `rehidratar()` depois de cada sucesso (A5): o
 * `GET /estado` traz a Tarefa nova ou alterada, e nada é aplicado à mão no store.
 * Por isso as funções não tocam o store nem o cache do SWR: a recusa da api sobe
 * como `ErroDeApi` com a mensagem do servidor, e quem chama decide onde mostrá-la.
 *
 * Só no deploy da Fase 15 (D-01): enquanto as Tarefas e as Conversas da tela
 * ainda são ids do modelo antigo, estas rotas respondem 404 para elas.
 */

/** A Conversa da Tarefa: `aberta: false` quer dizer que o Contato já tinha uma aberta no Canal e a Tarefa a reaproveitou. */
export interface ConversaDaTarefa {
  readonly id: string;
  readonly aberta: boolean;
}

/** O que o navegador PODE dizer ao criar: a Lista, o Contato, o Canal, a Mensagem e os campos da Tarefa (`.strict()` na api). */
export interface NovaTarefaConversacionalNaTela {
  readonly listId: string;
  readonly contatoId: string;
  readonly canalId: string;
  /** Obrigatória só quando o Contato não tem Conversa aberta no Canal (D-07). */
  readonly mensagem?: { readonly conteudo: string };
  readonly negocioId?: string;
  readonly title?: string;
  readonly statusId?: string;
  readonly assignees?: readonly ActorRef[];
  readonly priority?: Priority;
  readonly dueDate?: TaskDate;
  readonly taskTypeId?: string;
}

/** O corpo recortado de `POST /operacoes` (`value`, `diferenca`, `revisao`…) mais o que a rota acrescenta; a tela só lê estes campos. */
interface RespostaDaEscrita<V> {
  readonly ok: true;
  readonly dados: { readonly value: V; readonly conversa?: ConversaDaTarefa; readonly negocio?: { readonly id: string; readonly titulo: string } };
}

function caminhoDaTarefa(taskId: string): string {
  return `/tarefas-conversacionais/${encodeURIComponent(taskId)}`;
}

/** 3.3.4: a Tarefa nasce em `registros` e a Conversa abre (ou é reaproveitada) em `plataforma.conversas`, no mesmo commit. */
export async function criarTarefaConversacional(entrada: NovaTarefaConversacionalNaTela): Promise<{ readonly task: Task; readonly conversa: ConversaDaTarefa }> {
  const { dados } = await chamarCrm<RespostaDaEscrita<{ readonly task: Task }>>("/tarefas-conversacionais", { method: "POST", corpo: entrada });
  return { task: dados.value.task, conversa: dados.conversa as ConversaDaTarefa };
}

/** 3.3.5: troca o Canal. `mudou: false` é a Tarefa que já estava na Conversa do Canal pedido (nada foi gravado). */
export async function trocarCanalDaTarefa(
  taskId: string,
  entrada: { readonly canalId: string; readonly mensagem?: { readonly conteudo: string } },
): Promise<{ readonly task: Task; readonly mudou: boolean; readonly conversa: ConversaDaTarefa }> {
  const { dados } = await chamarCrm<RespostaDaEscrita<{ readonly task: Task; readonly mudou: boolean }>>(`${caminhoDaTarefa(taskId)}/canal`, {
    method: "POST",
    corpo: entrada,
  });
  return { task: dados.value.task, mudou: dados.value.mudou, conversa: dados.conversa as ConversaDaTarefa };
}

/** 3.3.6: liga um Negócio do Contato da Tarefa, ou o desliga com `null`. */
export async function vincularNegocioATarefa(taskId: string, negocioId: string | null): Promise<Task> {
  const { dados } = await chamarCrm<RespostaDaEscrita<Task>>(`${caminhoDaTarefa(taskId)}/negocio`, { method: "POST", corpo: { negocioId } });
  return dados.value;
}

/** 3.3.6: cria o Negócio na 1ª Etapa do Funil, do Contato da Tarefa, e liga a Tarefa a ele. `valor` é texto decimal como em `POST /negocios`. */
export async function criarNegocioDaTarefa(
  taskId: string,
  entrada: { readonly funilId: string; readonly titulo?: string; readonly valor?: string },
): Promise<{ readonly task: Task; readonly negocio: { readonly id: string; readonly titulo: string } }> {
  const { dados } = await chamarCrm<RespostaDaEscrita<Task>>(`${caminhoDaTarefa(taskId)}/negocio/novo`, { method: "POST", corpo: entrada });
  return { task: dados.value, negocio: dados.negocio as { readonly id: string; readonly titulo: string } };
}

interface RespostaDeConversas {
  readonly ok: true;
  readonly itens: readonly { readonly id: string }[];
  readonly total: number;
}

/**
 * A Conversa aberta do Contato no Canal, ou `null`. "Aberta" é a mesma regra da
 * api (D-07): situação `aberta` ou `pendente`, e `estado` ativo. A listagem aceita
 * uma situação por vez, então são duas perguntas de uma linha cada, juntas.
 */
export async function conversaAbertaDoPar(contatoId: string, canalId: string): Promise<{ readonly id: string } | null> {
  const perguntar = (situacao: "aberta" | "pendente") => {
    const parametros = new URLSearchParams({ contatoId, canalId, estado: "ativo", situacao, limite: "1" });
    return chamarCrm<RespostaDeConversas>(`/conversas?${parametros.toString()}`);
  };
  const [aberta, pendente] = await Promise.all([perguntar("aberta"), perguntar("pendente")]);
  const achada = aberta.itens[0] ?? pendente.itens[0];
  return achada ? { id: achada.id } : null;
}

/**
 * `conversaAbertaDoPar` como leitura da tela: `conversa` é `undefined` enquanto a
 * resposta não chega (ou o par está incompleto, ou `pausado`), `null` sem Conversa
 * aberta e `{ id }` com uma. A chave leva o par, então trocar o Canal volta a
 * "verificando" em vez de servir a resposta do Canal anterior.
 */
export function useConversaAbertaDoPar(
  contatoId: string | undefined,
  canalId: string | undefined,
  opcoes: { readonly pausado?: boolean } = {},
): { readonly conversa: { readonly id: string } | null | undefined; readonly erro?: Error } {
  const par = contatoId !== undefined && contatoId !== "" && canalId !== undefined && canalId !== "" && opcoes.pausado !== true;
  const chave = par ? `/conversas/aberta-do-par?contatoId=${encodeURIComponent(contatoId)}&canalId=${encodeURIComponent(canalId)}` : null;
  const busca = useSWR<{ readonly id: string } | null, Error>(chave, () => conversaAbertaDoPar(contatoId as string, canalId as string), {
    shouldRetryOnError: valeRepetir,
  });
  return { conversa: busca.data, ...(busca.error ? { erro: busca.error } : {}) };
}

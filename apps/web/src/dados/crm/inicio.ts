"use client";

/**
 * O agregado do Início no CRM novo (15-18, 3.4.7, UCR-07), lido só por HTTP:
 * `GET /crm/inicio/*` de `apps/api` (`rotas/crm/inicio.ts`) atrás de `chamarCrm`. Os
 * números saem somados do servidor; a web nunca soma listas paginadas (`paginaMaxima` é
 * 200). "Meu" é sempre o Membro da sessão: nenhum hook manda o id do Membro.
 *
 * `usePanoramaDoCrm()`, `useLeadsAAtender(qualificacoes)` e `useEstatisticasDoCrm(janela, fuso)` são
 * um hook por bloco do Início. Todas as chaves de SWR começam por `/crm/inicio/`. Nenhuma mutação invalida essas chaves
 * hoje: a tela do Início revalida ao abrir e ao focar, como as demais leituras do CRM.
 */

import useSWR from "swr";
import { QUALIFICACOES_MAXIMAS, type EstatisticasDoCrm, type LeadAAtenderDoCrm, type PanoramaDoCrm } from "@n1/dominio/crm/inicio";
import { chamarCrm, ErroDeApi } from "./cliente-crm";

const CAMINHO_DO_PANORAMA = "/crm/inicio/panorama";
const CAMINHO_DOS_LEADS = "/crm/inicio/leads-a-atender";
const CAMINHO_DAS_ESTATISTICAS = "/crm/inicio/estatisticas";

/** Recusa 4xx não melhora ao repetir: só rede e 5xx tentam de novo. */
function valeRepetir(erro: Error): boolean {
  return !(erro instanceof ErroDeApi) || erro.status === 0 || erro.status >= 500;
}

/** A resposta de `GET /crm/inicio/panorama`: um item, no envelope `{ ok, dados }`. */
interface RespostaDoPanorama {
  readonly ok: true;
  readonly dados: PanoramaDoCrm;
}

export interface ResultadoDoPanorama {
  /** O que a api somou; `undefined` até a primeira resposta (ou se a api recusa). */
  readonly panorama: PanoramaDoCrm | undefined;
  /** Primeira busca ainda sem resposta. */
  readonly carregando: boolean;
  readonly erro?: ErroDeApi;
}

/** Contatos recentes, Negócios abertos e Conversas não resolvidas do Espaço, somados no servidor. */
export function usePanoramaDoCrm(): ResultadoDoPanorama {
  const busca = useSWR<RespostaDoPanorama, Error>(CAMINHO_DO_PANORAMA, (caminho: string) => chamarCrm<RespostaDoPanorama>(caminho), {
    keepPreviousData: true,
    shouldRetryOnError: valeRepetir,
  });
  const erro = busca.error instanceof ErroDeApi ? busca.error : undefined;
  return { panorama: erro ? undefined : busca.data?.dados, carregando: busca.isLoading, ...(erro ? { erro } : {}) };
}

/** A resposta de `GET /crm/inicio/leads-a-atender`: lista no envelope `{ ok, itens, total }`. */
interface RespostaDeLeads {
  readonly ok: true;
  readonly itens: readonly LeadAAtenderDoCrm[];
  readonly total: number;
}

/**
 * A chave de SWR dos Leads: o caminho com as Qualificações únicas e em ordem. A mesma lista em
 * outra ordem, ou com repetição, dá a mesma chave e compartilha chamada e cache. `null` para lista
 * vazia: o SWR não busca e a api não é chamada.
 */
export function chaveDeLeads(qualificacoes: readonly string[]): string | null {
  const unicas = [...new Set(qualificacoes.filter((id) => id !== ""))].sort();
  if (unicas.length === 0) return null;
  const parametros = new URLSearchParams();
  for (const id of unicas.slice(0, QUALIFICACOES_MAXIMAS)) parametros.append("qualificacao", id);
  return `${CAMINHO_DOS_LEADS}?${parametros.toString()}`;
}

export interface ResultadoDeLeads {
  /** Quem espera há mais tempo primeiro (até 50), como a api devolveu; vazio até a primeira resposta. */
  readonly leads: readonly LeadAAtenderDoCrm[];
  readonly carregando: boolean;
  readonly erro?: ErroDeApi;
}

/**
 * Os Leads a atender do Membro da sessão: Contatos dele com Qualificação na lista pedida (os ids das
 * Definições chamadas "Lead", que a tela lê do Catálogo) que nunca tiveram Mensagem ou esperam resposta.
 * A api decide "meus" pela sessão; este hook não manda o Membro.
 */
export function useLeadsAAtender(qualificacoes: readonly string[]): ResultadoDeLeads {
  const chave = chaveDeLeads(qualificacoes);
  const busca = useSWR<RespostaDeLeads, Error>(chave, (caminho: string) => chamarCrm<RespostaDeLeads>(caminho), {
    keepPreviousData: true,
    shouldRetryOnError: valeRepetir,
  });
  const erro = busca.error instanceof ErroDeApi ? busca.error : undefined;
  return {
    leads: chave === null || erro ? [] : (busca.data?.itens ?? []),
    carregando: chave !== null && busca.isLoading,
    ...(erro ? { erro } : {}),
  };
}

/** A resposta de `GET /crm/inicio/estatisticas`: um item, no envelope `{ ok, dados }`. */
interface RespostaDeEstatisticas {
  readonly ok: true;
  readonly dados: EstatisticasDoCrm;
}

/** A janela das estatísticas: instantes ISO 8601 (a api aceita no máximo 400 dias entre eles). */
export interface JanelaDeEstatisticasDoCrm {
  readonly desde: string;
  readonly ate: string;
}

/** A chave de SWR das estatísticas: o caminho com a janela e o fuso. */
export function chaveDeEstatisticas(janela: JanelaDeEstatisticasDoCrm, fuso: string): string {
  const parametros = new URLSearchParams({ desde: janela.desde, ate: janela.ate, fuso });
  return `${CAMINHO_DAS_ESTATISTICAS}?${parametros.toString()}`;
}

export interface ResultadoDeEstatisticas {
  /** As séries por dia que a api somou; `undefined` até a primeira resposta (ou se a api recusa). */
  readonly estatisticas: EstatisticasDoCrm | undefined;
  readonly carregando: boolean;
  readonly erro?: ErroDeApi;
}

/**
 * O que o Membro da sessão fez por dia na janela (Mensagens enviadas, Conversas resolvidas de que era o
 * Atribuído, Negócios ganhos por moeda), com os dias cortados no `fuso`. `desde` e `ate` precisam ser
 * estáveis entre renderizações (arredonde "agora" ao minuto ou ao dia): eles formam a chave, e uma
 * janela que muda a cada render pediria à api sem parar.
 */
export function useEstatisticasDoCrm(janela: JanelaDeEstatisticasDoCrm, fuso: string): ResultadoDeEstatisticas {
  const busca = useSWR<RespostaDeEstatisticas, Error>(
    chaveDeEstatisticas(janela, fuso),
    (caminho: string) => chamarCrm<RespostaDeEstatisticas>(caminho),
    { keepPreviousData: true, shouldRetryOnError: valeRepetir },
  );
  const erro = busca.error instanceof ErroDeApi ? busca.error : undefined;
  return { estatisticas: erro ? undefined : busca.data?.dados, carregando: busca.isLoading, ...(erro ? { erro } : {}) };
}

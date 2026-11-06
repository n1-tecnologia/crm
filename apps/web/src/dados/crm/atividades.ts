"use client";

/**
 * A linha do tempo do CRM novo (15-37, D-15-09), lida só por HTTP: `GET /atividades`
 * de `apps/api` (`rotas/crm/atividades.ts`) atrás de `chamarCrm`. Aqui não há
 * escrita: quem grava a Atividade é cada gesto, na transação dele (15-04).
 *
 * Duas fontes convivem até a Fase 15 acabar: o modelo antigo grava em
 * `state.activity` (já hidratado pela carga do Espaço) e o CRM novo grava em
 * `plataforma.crm_atividades`. `useAtividades` junta as duas para UM objeto;
 * `useAtividadesDoCrm` lê só a nova, sem objeto, para a Auditoria (15-09), que
 * soma a antiga por conta própria. Os ids não colidem (`act_…` contra UUID); a
 * deduplicação por id é só uma rede.
 *
 * A chave de SWR começa por `/atividades`. Nenhuma mutação invalida essa chave
 * hoje: a Atividade nasce no servidor, dentro do gesto, e a tela que a mostra
 * revalida ao abrir (e ao focar), como as demais listas do CRM.
 */

import useSWR from "swr";
import { LIMITES_DE_ATIVIDADE } from "@n1/dominio/crm/atividades";
import type { ActivityRecord } from "@n1/dominio/types/primitives";
import { useData } from "@/dados/store";
import { chamarCrm, ErroDeApi } from "./cliente-crm";

/** A resposta de `GET /atividades`: sem `total`, a paginação é por tempo (`ate`). */
export interface RespostaDeAtividades {
  readonly ok: true;
  readonly itens: ActivityRecord[];
}

export interface FiltroDeAtividadesDoCrm {
  readonly objetoTipo?: string;
  readonly objetoId?: string;
  readonly limite?: number;
  /** Instante ISO, exclusivo: só vêm as Atividades anteriores a ele. */
  readonly ate?: string;
  /** O `id` da última linha recebida: com `ate`, o cursor composto que não pula o mesmo instante (15-09). */
  readonly ateId?: string;
}

export function chaveDeAtividades(filtro: FiltroDeAtividadesDoCrm): string {
  const parametros = new URLSearchParams();
  if (filtro.objetoTipo !== undefined) parametros.set("objetoTipo", filtro.objetoTipo);
  if (filtro.objetoId !== undefined) parametros.set("objetoId", filtro.objetoId);
  parametros.set("limite", String(filtro.limite ?? LIMITES_DE_ATIVIDADE.paginaPadrao));
  if (filtro.ate !== undefined) parametros.set("ate", filtro.ate);
  if (filtro.ateId !== undefined) parametros.set("ateId", filtro.ateId);
  return `/atividades?${parametros.toString()}`;
}

/** Recusa 4xx não melhora ao repetir: só rede e 5xx tentam de novo. */
function valeRepetir(erro: Error): boolean {
  return !(erro instanceof ErroDeApi) || erro.status === 0 || erro.status >= 500;
}

/**
 * As Atividades do CRM novo, sem objeto (a Auditoria) ou com ele; a ordem é da api.
 * `pausado` não lê nada (uma tela que ainda não sabe o objeto não vai à api).
 */
export function useAtividadesDoCrm(filtro: FiltroDeAtividadesDoCrm, opcoes: { readonly pausado?: boolean } = {}) {
  const chave = chaveDeAtividades(filtro);
  return useSWR<RespostaDeAtividades, Error>(opcoes.pausado ? null : chave, (k: string) => chamarCrm<RespostaDeAtividades>(k), {
    keepPreviousData: true,
    shouldRetryOnError: valeRepetir,
  });
}

/** `at` é ISO 8601 em UTC nas duas fontes; comparar o instante, não o texto. */
function maisRecentePrimeiro(a: ActivityRecord, b: ActivityRecord): number {
  return Date.parse(b.at) - Date.parse(a.at);
}

/**
 * A linha do tempo de UM objeto: `state.activity` do objeto (modelo antigo) junto
 * com `GET /atividades` (CRM novo), a mais recente primeiro, sem repetir id.
 * Enquanto a rota não responde, a antiga já aparece; se a rota falha, `erro`
 * diz e a antiga continua à mostra. Sem `alvo` (a tela ainda não achou o objeto)
 * nada é lido e a lista vem vazia: o hook pode ficar antes de um retorno antecipado.
 */
export function useAtividades(alvo: { readonly tipo: string; readonly id: string } | undefined) {
  const antigas = useData((data) => data.activity);
  const { data, error, isLoading } = useAtividadesDoCrm(
    alvo ? { objetoTipo: alvo.tipo, objetoId: alvo.id } : {},
    { pausado: alvo === undefined },
  );

  const porId = new Map<string, ActivityRecord>();
  for (const atividade of antigas) {
    if (alvo && atividade.objectId === alvo.id && atividade.objectType === alvo.tipo) porId.set(atividade.id, atividade);
  }
  for (const atividade of data?.itens ?? []) porId.set(atividade.id, atividade);

  return {
    atividades: [...porId.values()].sort(maisRecentePrimeiro),
    carregando: isLoading,
    erro: error,
  };
}

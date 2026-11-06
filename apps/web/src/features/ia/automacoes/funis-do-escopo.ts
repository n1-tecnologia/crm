"use client";

/**
 * Os Funis do CRM novo que as telas de Automação conferem como escopo (Fase 15, 3.4.9, UCR-08).
 *
 * O Funil de uma Automação não está mais no store: a lista vem de `GET /funis` (ativos e
 * arquivados — o que está na lixeira conta como eliminado para o escopo, como no domínio) e o
 * domínio a recebe por argumento (`inoperante(state, automação, funis)`, `criarAutomacao(…, funis)`).
 *
 * `pronto` é falso até as duas listas chegarem. Enquanto isso, `inoperanteComFunis` NÃO acusa
 * "escopo eliminado" para um escopo Funil: a lista vazia de quem ainda não carregou não é a prova
 * de que o Funil sumiu, e o aviso piscaria a cada abertura da tela. Se a api recusa a lista, o
 * escopo Funil também fica sem aviso (a tela não afirma o que não sabe). O teto é uma página
 * (`LIMITES_CRM.paginaMaxima`) por estado; o servidor, que relê o Funil por id, é quem decide ao gravar.
 */

import { useMemo } from "react";
import { LIMITES_CRM } from "@n1/dominio/crm/comum";
import { inoperante } from "@n1/dominio/derive-ia";
import type { FunisDoEscopo } from "@n1/dominio/operations";
import type { DataState } from "@n1/dominio/state";
import type { Automation, Id } from "@n1/dominio/types";
import { useFunis } from "@/dados/crm/funis";

export interface FunisParaOEscopo {
  /** Os Funis ativos e arquivados, na forma que o domínio confere (`id`, `estado`). */
  readonly funis: FunisDoEscopo;
  /** O nome de cada Funil da lista. */
  readonly nomes: ReadonlyMap<Id, string>;
  /** As duas listas já responderam. */
  readonly pronto: boolean;
}

/** `pausado` não lê nada (o diálogo de Nova Automação só precisa dos Funis quando o escopo é Funil). */
export function useFunisDoEscopo(opcoes: { readonly pausado?: boolean } = {}): FunisParaOEscopo {
  const ativos = useFunis({ estado: "ativo", limite: LIMITES_CRM.paginaMaxima }, opcoes);
  const arquivados = useFunis({ estado: "arquivado", limite: LIMITES_CRM.paginaMaxima }, opcoes);
  const itensAtivos = ativos.data?.itens;
  const itensArquivados = arquivados.data?.itens;
  return useMemo(() => {
    const todos = [...(itensAtivos ?? []), ...(itensArquivados ?? [])].map((i) => i.funil);
    return {
      funis: todos.map((f) => ({ id: f.id, estado: f.estado })),
      nomes: new Map(todos.map((f) => [f.id, f.nome] as const)),
      pronto: itensAtivos !== undefined && itensArquivados !== undefined,
    };
  }, [itensAtivos, itensArquivados]);
}

/** `inoperante` do domínio com os Funis da api; sem a lista, o escopo Funil não é dado como eliminado. */
export function inoperanteComFunis(state: DataState, automation: Automation, funis: FunisParaOEscopo): string | undefined {
  if (automation.scopeType === "funnel" && !funis.pronto) return undefined;
  return inoperante(state, automation, funis.funis);
}

"use client";

/**
 * O agregado do Início no CRM novo (15-18, 3.4.7, UCR-07), lido só por HTTP:
 * `GET /crm/inicio/*` de `apps/api` (`rotas/crm/inicio.ts`) atrás de `chamarCrm`. Os
 * números saem somados do servidor; a web nunca soma listas paginadas (`paginaMaxima` é
 * 200). "Meu" é sempre o Membro da sessão: nenhum hook manda o id do Membro.
 *
 * Todas as chaves de SWR começam por `/crm/inicio/`. Nenhuma mutação invalida essas chaves
 * hoje: a tela do Início revalida ao abrir e ao focar, como as demais leituras do CRM.
 */

import useSWR from "swr";
import type { PanoramaDoCrm } from "@n1/dominio/crm/inicio";
import { chamarCrm, ErroDeApi } from "./cliente-crm";

const CAMINHO_DO_PANORAMA = "/crm/inicio/panorama";

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

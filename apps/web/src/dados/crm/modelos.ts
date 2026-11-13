"use client";

/**
 * As Mensagens de modelo do WhatsApp oficial (Sessão 7, 7.3), lidas e sincronizadas só por HTTP: cada função aqui é uma rota
 * de `apps/api` (`rotas/crm/whatsapp-oficial.ts`) atrás de `chamarCrm`. O modelo nasce e é aprovado na Meta; o CRM só o
 * sincroniza e escolhe um para enviar. Quem decide o que é "enviável" é o domínio (`modeloNaLista`, que a api já aplica): a
 * tela não refaz a regra, só lê `enviavel` e `motivoDeNaoEnviavel`.
 *
 * A chave de SWR começa por `/canais/<id>/modelos`, debaixo de `/canais`: toda escrita de Canal (conectar, desconectar,
 * arquivar) revalida a lista junto. Enviar uma Mensagem de modelo não passa por aqui: é `enviarMensagem` com `modeloId` e
 * `variaveis` (`mensagens.ts`), e abrir Conversa ou Tarefa leva o mesmo par em `mensagem` (`conversas.ts` e
 * `tarefas-conversacionais.ts`).
 */

import useSWR from "swr";
import type { ModeloNaLista } from "@n1/dominio/crm/modelos";
import { chamarCrm, ErroDeApi, invalidarCrm } from "./cliente-crm";

/** O WhatsApp oficial é o único Canal que tem modelo: nos outros a lista é vazia e a tela nem a pede. */
export const PROVEDOR_COM_MODELOS = "whatsapp-cloud";

export interface RespostaDosModelos {
  readonly ok: true;
  readonly itens: ModeloNaLista[];
  readonly total: number;
}

/** O que a sincronização fez com a lista do Canal; `ignorados` são modelos de categoria ou estado que o CRM ainda não conhece. */
export interface ResultadoDaSincronizacaoDeModelos {
  readonly criados: number;
  readonly atualizados: number;
  readonly removidos: number;
  readonly ignorados: number;
}

/** `/canais/<id>/modelos` — a chave da lista e a base da sincronização. */
export function chaveDosModelos(canalId: string): string {
  return `/canais/${encodeURIComponent(canalId)}/modelos`;
}

/** Recusa 4xx não melhora ao repetir: só rede e 5xx tentam de novo. */
function valeRepetir(erro: Error): boolean {
  return !(erro instanceof ErroDeApi) || erro.status === 0 || erro.status >= 500;
}

/** Todos os modelos do Canal, em qualquer estado (a ficha mostra o motivo da rejeição). Sem Canal ou `pausado`, não chama a rede. */
export function useModelosDoCanal(canalId: string | undefined, opcoes: { readonly pausado?: boolean } = {}) {
  return useSWR<RespostaDosModelos, Error>(
    canalId === undefined || opcoes.pausado ? null : chaveDosModelos(canalId),
    (chave: string) => chamarCrm<RespostaDosModelos>(chave),
    { shouldRetryOnError: valeRepetir, revalidateOnFocus: false },
  );
}

export interface ModelosEnviaveis {
  /** O Canal tem modelo (é o WhatsApp oficial): os outros nunca mostram o seletor. */
  readonly oficial: boolean;
  /** Os modelos que dá para escolher agora: aprovados pela Meta e de um tipo que o CRM sabe preencher. */
  readonly enviaveis: readonly ModeloNaLista[];
  /** A lista ainda não chegou: nem o seletor nem a frase de "sem modelo" afirmam nada. */
  readonly carregando: boolean;
}

/**
 * O que um lugar que ENVIA precisa saber do Canal: se ele usa modelo e quais pode escolher. Uma falha na leitura vale
 * como "sem modelo": a tela mantém a frase de hoje, e a api decide de verdade (a recusa `JANELA_EXPIRADA` traz a lista).
 */
export function useModelosEnviaveis(canal: { readonly id: string; readonly provedor: string } | undefined, opcoes: { readonly pausado?: boolean } = {}): ModelosEnviaveis {
  const oficial = canal?.provedor === PROVEDOR_COM_MODELOS;
  const lista = useModelosDoCanal(oficial ? canal.id : undefined, opcoes);
  return {
    oficial,
    enviaveis: (lista.data?.itens ?? []).filter((m) => m.enviavel),
    carregando: oficial && !opcoes.pausado && lista.data === undefined && lista.error === undefined,
  };
}

/**
 * "Sincronizar com a Meta": lê os modelos da conta e deixa o Canal com exatamente eles. Só no sucesso a lista é revalidada;
 * a recusa (409 `CANAL_NAO_CONECTADO` e `TOKEN_RECUSADO`, 502, 503, 403) sobe como `ErroDeApi` com a frase da api.
 */
export async function sincronizarModelosDoCanal(canalId: string): Promise<ResultadoDaSincronizacaoDeModelos> {
  const resposta = await chamarCrm<{ ok: true; dados: ResultadoDaSincronizacaoDeModelos }>(`${chaveDosModelos(canalId)}/sincronizar`, { method: "POST" });
  await invalidarCrm(chaveDosModelos(canalId));
  return resposta.dados;
}

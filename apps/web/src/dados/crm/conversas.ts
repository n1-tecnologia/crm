"use client";

/**
 * Conversas do CRM, lidas e gravadas só por HTTP (D-04): cada função aqui é uma
 * rota de `apps/api` (`rotas/crm/conversas.ts`) atrás de `chamarCrm`. Nenhum
 * arquivo do web importa o workspace da api — o contrato é o JSON e os tipos de
 * `@n1/dominio/crm/*`.
 *
 * As chaves de SWR começam por `/conversas` para que `invalidarCrm("/conversas")`
 * alcance a lista e a ficha de uma vez depois de cada gravação. A invalidação
 * só acontece no sucesso: numa recusa (a segunda `resolverConversa` de uma
 * Conversa já resolvida, por exemplo) a `ErroDeApi` sobe com `status` e `codigo`
 * e o cache segue como estava.
 *
 * Uma exceção, de propósito: a leitura (`marcarConversa` só com `lidaAte`) roda
 * a cada abertura do fio e NÃO invalida a lista inteira — só a chave da própria
 * Conversa. A lista de não lidas se renova no ritmo dela.
 */

import useSWR from "swr";
import { LIMITES_CRM } from "@n1/dominio/crm/comum";
import type {
  Atribuicao,
  ConversaDetalhada,
  ConversaNaLista,
  EdicaoDeMarcacao,
  EstadoDaConversa,
  MarcacaoDaConversa,
  NovaConversa,
  SituacaoDaConversa,
} from "@n1/dominio/crm/conversas";
import type { Mensagem } from "@n1/dominio/crm/mensagens";
import { chamarCrm, ErroDeApi, invalidarCrm } from "./cliente-crm";

/** O filtro da lista de Conversas; `naoLidas` e `comEstrela` são sempre do Membro da sessão (a api decide). */
export interface FiltroDeConversasNaTela {
  readonly estado?: EstadoDaConversa;
  readonly canalId?: string;
  readonly contatoId?: string;
  readonly situacao?: SituacaoDaConversa;
  readonly naoLidas?: boolean;
  readonly comEstrela?: boolean;
  readonly atribuidoId?: string;
  readonly filaId?: string;
  readonly q?: string;
  readonly limite?: number;
  readonly deslocamento?: number;
}

export interface RespostaDaListaDeConversas {
  readonly ok: true;
  readonly itens: ConversaNaLista[];
  readonly total: number;
}

/**
 * `/conversas?estado=…&…&limite=…&deslocamento=…` — a mesma forma para a lista e
 * para a invalidação. A ordem das chaves é fixa (não depende da ordem das
 * propriedades do objeto), então um filtro tem um só item de cache.
 */
export function chaveDeConversas(filtro: FiltroDeConversasNaTela): string {
  const parametros = new URLSearchParams();
  parametros.set("estado", filtro.estado ?? "ativo");
  if (filtro.canalId !== undefined) parametros.set("canalId", filtro.canalId);
  if (filtro.contatoId !== undefined) parametros.set("contatoId", filtro.contatoId);
  if (filtro.situacao !== undefined) parametros.set("situacao", filtro.situacao);
  if (filtro.naoLidas !== undefined) parametros.set("naoLidas", String(filtro.naoLidas));
  if (filtro.comEstrela !== undefined) parametros.set("comEstrela", String(filtro.comEstrela));
  if (filtro.atribuidoId !== undefined) parametros.set("atribuidoId", filtro.atribuidoId);
  if (filtro.filaId !== undefined) parametros.set("filaId", filtro.filaId);
  const busca = (filtro.q ?? "").trim();
  if (busca !== "") parametros.set("q", busca);
  parametros.set("limite", String(filtro.limite ?? LIMITES_CRM.paginaPadrao));
  parametros.set("deslocamento", String(filtro.deslocamento ?? 0));
  return `/conversas?${parametros.toString()}`;
}

export function chaveDaConversa(id: string): string {
  return `/conversas/${id}`;
}

/** Recusa 4xx não melhora ao repetir (um 404, por exemplo): só rede e 5xx tentam de novo. */
function valeRepetir(erro: Error): boolean {
  return !(erro instanceof ErroDeApi) || erro.status === 0 || erro.status >= 500;
}

export function useConversas(filtro: FiltroDeConversasNaTela) {
  const chave = chaveDeConversas(filtro);
  // `keepPreviousData`: "Mostrar mais" e a troca de aba mudam a chave sem piscar o esqueleto.
  return useSWR<RespostaDaListaDeConversas, Error>(chave, (k: string) => chamarCrm<RespostaDaListaDeConversas>(k), {
    keepPreviousData: true,
    shouldRetryOnError: valeRepetir,
  });
}

/** A Conversa com o resumo do Canal. O 404 da api fica em `error` (`ErroDeApi`): a página decide o que mostrar. */
export function useConversa(id: string | undefined) {
  return useSWR<ConversaDetalhada, Error>(
    id === undefined ? null : chaveDaConversa(id),
    async (chave: string) => (await chamarCrm<{ ok: true; dados: ConversaDetalhada }>(chave)).dados,
    { shouldRetryOnError: valeRepetir },
  );
}

type Verbo = "POST" | "PUT";

async function gravar<T>(caminho: string, verbo: Verbo, prefixoInvalidado: string, corpo?: unknown): Promise<T> {
  const resposta = await chamarCrm<{ ok: true; dados: T }>(caminho, {
    method: verbo,
    ...(corpo !== undefined ? { corpo } : {}),
  });
  await invalidarCrm(prefixoInvalidado);
  return resposta.dados;
}

/** Abre a Conversa COM a primeira Mensagem, numa transação (INV-CXE-05). */
export async function abrirConversa(entrada: NovaConversa): Promise<ConversaDetalhada & { readonly primeiraMensagem: Mensagem }> {
  return gravar("/conversas", "POST", "/conversas", entrada);
}

export async function resolverConversa(id: string): Promise<ConversaDetalhada> {
  return gravar(`${chaveDaConversa(id)}/resolver`, "POST", "/conversas");
}

export async function reabrirConversa(id: string): Promise<ConversaDetalhada> {
  return gravar(`${chaveDaConversa(id)}/reabrir`, "POST", "/conversas");
}

/** Atribui a um Membro ou Agente; `null` tira a atribuição. */
export async function atribuirConversa(id: string, atribuido: Atribuicao): Promise<ConversaDetalhada> {
  return gravar(`${chaveDaConversa(id)}/atribuir`, "POST", "/conversas", { atribuido });
}

/** Troca o Contato da Conversa (3.2.5); `resolverExistente` resolve a que já ocupa o par. */
export async function moverConversa(id: string, contatoId: string, resolverExistente?: boolean): Promise<ConversaDetalhada> {
  return gravar(`${chaveDaConversa(id)}/mover`, "POST", "/conversas", {
    contatoId,
    ...(resolverExistente !== undefined ? { resolverExistente } : {}),
  });
}

/**
 * Estrela e leitura do PRÓPRIO Membro. Só `lidaAte` (abrir o fio) invalida a
 * chave da Conversa; com `estrela` a lista muda de composição e é invalidada.
 */
export async function marcarConversa(id: string, edicao: EdicaoDeMarcacao): Promise<MarcacaoDaConversa> {
  const soLeitura = edicao.estrela === undefined;
  return gravar(`${chaveDaConversa(id)}/marcacao`, "PUT", soLeitura ? chaveDaConversa(id) : "/conversas", edicao);
}

/** Só a Conversa resolvida vai para a lixeira (3.2.6). */
export async function conversaParaLixeira(id: string): Promise<ConversaDetalhada> {
  return gravar(`${chaveDaConversa(id)}/lixeira`, "POST", "/conversas");
}

export async function restaurarConversa(id: string): Promise<ConversaDetalhada> {
  return gravar(`${chaveDaConversa(id)}/restaurar`, "POST", "/conversas");
}

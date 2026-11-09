"use client";

/**
 * Mensagens do CRM (o fio de uma Conversa), lidas e gravadas só por HTTP (D-04):
 * cada função aqui é uma rota de `apps/api` (`rotas/crm/mensagens.ts`) atrás de
 * `chamarCrm`. A Mensagem `recebida` não nasce por aqui — só a integração a
 * registra —, então o envio é `enviada` ao Contato ou `interna` (nota). O Ator
 * e o Canal saem da sessão e da Conversa: o corpo leva só `conversaId`,
 * `direcao`, `conteudo` e, se for resposta, `emRespostaAId`.
 *
 * A chave de SWR começa por `/mensagens`. Depois de enviar, o fio e a lista de
 * Conversas (a última Mensagem e o `atualizadoEm` mudam) são revalidados — e só
 * no sucesso: numa recusa (409 de janela de 24 h, 403) a `ErroDeApi` sobe com
 * `status` e `codigo` e nada é invalidado.
 */

import useSWR from "swr";
import { LIMITES_CRM } from "@n1/dominio/crm/comum";
import type { Mensagem, NovaMensagem } from "@n1/dominio/crm/mensagens";
import { chamarCrm, ErroDeApi, invalidarCrm } from "./cliente-crm";

export interface RespostaDasMensagens {
  readonly ok: true;
  readonly itens: Mensagem[];
  readonly total: number;
}

export interface PaginaDeMensagens {
  readonly limite?: number;
  readonly deslocamento?: number;
}

/** `/mensagens?conversaId=…&limite=…&deslocamento=…` — a mesma forma para a leitura e para a invalidação. */
export function chaveDasMensagens(conversaId: string, pagina: PaginaDeMensagens = {}): string {
  const parametros = new URLSearchParams();
  parametros.set("conversaId", conversaId);
  parametros.set("limite", String(pagina.limite ?? LIMITES_CRM.paginaPadrao));
  parametros.set("deslocamento", String(pagina.deslocamento ?? 0));
  return `/mensagens?${parametros.toString()}`;
}

/** Recusa 4xx não melhora ao repetir: só rede e 5xx tentam de novo. */
function valeRepetir(erro: Error): boolean {
  return !(erro instanceof ErroDeApi) || erro.status === 0 || erro.status >= 500;
}

/** O fio da Conversa, na ordem da api (`criado_em`, `seq`). Sem Conversa escolhida, não chama a rede. */
export function useMensagens(conversaId: string | undefined, pagina: PaginaDeMensagens = {}) {
  return useSWR<RespostaDasMensagens, Error>(
    conversaId === undefined ? null : chaveDasMensagens(conversaId, pagina),
    (chave: string) => chamarCrm<RespostaDasMensagens>(chave),
    { keepPreviousData: true, shouldRetryOnError: valeRepetir },
  );
}

/** Envia (`enviada`) ou anota (`interna`). A regra de Canal e janela é da api; a tela mostra a recusa. */
export async function enviarMensagem(entrada: NovaMensagem): Promise<Mensagem> {
  const resposta = await chamarCrm<{ ok: true; dados: Mensagem }>("/mensagens", { method: "POST", corpo: entrada });
  await Promise.all([invalidarCrm("/mensagens"), invalidarCrm("/conversas")]);
  return resposta.dados;
}

/**
 * "Tentar de novo" (16-11, 3.7.3): a Mensagem `enviada` que `falhou` volta a `pendente` e à fila de saída.
 * Sem corpo — a Mensagem vem do `:id` e o Membro da sessão. A recusa (409 `NAO_FALHOU`, `CONVERSA_NA_LIXEIRA`,
 * `CANAL_ARQUIVADO`; 404; 403) sobe como `ErroDeApi` e nada é invalidado.
 */
export async function reenviarMensagem(id: string): Promise<Mensagem> {
  const resposta = await chamarCrm<{ ok: true; dados: Mensagem }>(`/mensagens/${encodeURIComponent(id)}/reenviar`, { method: "POST" });
  await Promise.all([invalidarCrm("/mensagens"), invalidarCrm("/conversas")]);
  return resposta.dados;
}

export interface RespostaDaUrlDoAnexo {
  readonly ok: true;
  readonly dados: { readonly url: string; readonly expiraEm: string };
}

/** `/mensagens/<id>/anexos/<indice>` — a chave de SWR da URL assinada do anexo. */
export function chaveDoAnexo(mensagemId: string, indice: number): string {
  return `/mensagens/${encodeURIComponent(mensagemId)}/anexos/${indice}`;
}

/**
 * A URL assinada de um anexo guardado (`GET /mensagens/:id/anexos/:indice`, 3.9.3): vale 5 minutos, então o SWR a
 * pede de novo a cada 4 (`refreshInterval`) e a cada abertura. O anexo `baixado: false` não tem o que pedir: sem
 * chave, nenhuma chamada. O foco da janela não revalida (cada revalidação assina uma URL nova).
 */
export function useUrlDoAnexo(mensagemId: string, indice: number, baixado: boolean) {
  return useSWR<RespostaDaUrlDoAnexo, Error>(
    baixado ? chaveDoAnexo(mensagemId, indice) : null,
    (chave: string) => chamarCrm<RespostaDaUrlDoAnexo>(chave),
    { refreshInterval: 240_000, revalidateOnFocus: false, shouldRetryOnError: valeRepetir },
  );
}

export interface PedidoDeTicketDeAnexo {
  readonly conversaId: string;
  readonly nome: string;
  readonly tipoDeMidia: string;
  readonly tamanhoBytes: number;
}

export interface TicketDeAnexo {
  readonly submissionId: string;
  readonly objectId: string;
  readonly uploadUrl: string;
}

/**
 * O ticket para anexar um arquivo (`POST /mensagens/anexos`, 16-09): a api confere o tipo, o tamanho e o Canal ANTES
 * de reservar o objeto, e devolve a URL assinada em que o navegador sobe os bytes. Nada muda no fio ainda, então
 * nada é invalidado; a recusa (422 `ARQUIVO_GRANDE_DEMAIS`, `TIPO_NAO_ACEITO`, `TIPO_NAO_ENVIADO_PELO_CANAL`; 409
 * `CANAL_ARQUIVADO`) sobe como `ErroDeApi`.
 */
export async function pedirTicketDeAnexo(entrada: PedidoDeTicketDeAnexo): Promise<TicketDeAnexo> {
  const resposta = await chamarCrm<{ ok: true; dados: TicketDeAnexo }>("/mensagens/anexos", { method: "POST", corpo: entrada });
  return resposta.dados;
}

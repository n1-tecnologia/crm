"use client";

/**
 * Canais do CRM, lidos e gravados só por HTTP (D-04, Fase 8): cada função é uma
 * rota da api (`rotas/crm/canais.ts`) atrás de `chamarCrm`. Nenhum
 * arquivo do web importa o workspace da api — o contrato é o JSON e os tipos de
 * `@n1/dominio/crm/canais`.
 *
 * As chaves de SWR começam por `/canais` para que `invalidarCrm("/canais")`
 * alcance a lista de uma vez depois de cada gravação. A invalidação só acontece
 * no sucesso: numa recusa a `ErroDeApi` sobe com `codigo` e `campo` (um 409 de
 * conta ou nome em uso) e a tela segue como estava.
 *
 * O resto do app (o fio da Conversa, a lista da Caixa) ainda lê o Canal projetado
 * em `GET /estado` (D-11): quem escreve um Canal por aqui também chama
 * `useRehidratar()` para esse espelho acompanhar. A ficha
 * (`[canal]/page.tsx`) lê o Canal de `GET /canais/:id` (`useCanal`).
 */

import useSWR from "swr";
import { LIMITES_CRM } from "@n1/dominio/crm/comum";
import type { Canal, EdicaoDeCanal, EstadoDoCanal, NovoCanal } from "@n1/dominio/crm/canais";
import { chamarCrm, ErroDeApi, invalidarCrm } from "./cliente-crm";

export interface FiltroDeCanais {
  readonly estado?: EstadoDoCanal;
  readonly limite?: number;
  readonly deslocamento?: number;
}

export interface RespostaDaListaDeCanais {
  readonly ok: true;
  readonly itens: Canal[];
  readonly total: number;
}

/** `/canais?estado=…&limite=…&deslocamento=…` — a mesma forma para a lista e para a invalidação. */
export function chaveDeCanais(filtro: FiltroDeCanais): string {
  const parametros = new URLSearchParams();
  parametros.set("estado", filtro.estado ?? "ativo");
  parametros.set("limite", String(filtro.limite ?? LIMITES_CRM.paginaPadrao));
  parametros.set("deslocamento", String(filtro.deslocamento ?? 0));
  return `/canais?${parametros.toString()}`;
}

/** `pausado` não lê nada (um diálogo fechado não vai à api). */
export function useCanais(filtro: FiltroDeCanais, opcoes: { readonly pausado?: boolean } = {}) {
  const chave = chaveDeCanais(filtro);
  return useSWR<RespostaDaListaDeCanais, Error>(opcoes.pausado ? null : chave, (k: string) => chamarCrm<RespostaDaListaDeCanais>(k), {
    keepPreviousData: true,
  });
}

type Verbo = "POST" | "PATCH";

/**
 * Uma escrita de Canal. O `corpo` só entra quando definido: `chamarCrm` manda
 * `content-type` apenas com corpo, e as ações de conexão são POST sem corpo —
 * um `content-type: application/json` sem corpo é recusado pelo Fastify.
 * Só o sucesso invalida `/canais`.
 */
async function gravar(caminho: string, verbo: Verbo, corpo?: unknown): Promise<Canal> {
  const resposta = await chamarCrm<{ ok: true; dados: Canal }>(caminho, {
    method: verbo,
    ...(corpo !== undefined ? { corpo } : {}),
  });
  await invalidarCrm("/canais");
  return resposta.dados;
}

export function chaveDoCanal(id: string): string {
  return `/canais/${id}`;
}

/** Recusa 4xx não melhora ao repetir (um 404, por exemplo): só rede e 5xx tentam de novo. */
function valeRepetir(erro: Error): boolean {
  return !(erro instanceof ErroDeApi) || erro.status === 0 || erro.status >= 500;
}

/** O Canal da ficha. O 404 da api fica em `error` (`ErroDeApi`): a página decide o que mostrar. */
export function useCanal(id: string | undefined) {
  return useSWR<Canal, Error>(
    id === undefined ? null : chaveDoCanal(id),
    async (chave: string) => (await chamarCrm<{ ok: true; dados: Canal }>(chave)).dados,
    { shouldRetryOnError: valeRepetir },
  );
}

/** Cria o Canal `desconectada` (D-08). Só o sucesso invalida a lista. */
export function criarCanal(entrada: NovoCanal): Promise<Canal> {
  return gravar("/canais", "POST", entrada);
}

/** D-11: nome, Fila padrão e Origem padrão. `null` limpa o padrão; ausente não mexe. */
export function editarCanal(id: string, edicao: EdicaoDeCanal): Promise<Canal> {
  return gravar(chaveDoCanal(id), "PATCH", edicao);
}

/** D-08: conecta marcando a conexão como simulada. A api recusa Canal arquivado ou já conectado (409 `TRANSICAO_INVALIDA`). */
export function simularConexaoDoCanal(id: string): Promise<Canal> {
  return gravar(`${chaveDoCanal(id)}/simular-conexao`, "POST");
}

export function desconectarCanal(id: string): Promise<Canal> {
  return gravar(`${chaveDoCanal(id)}/desconectar`, "POST");
}

/** 11.1: arquivar desconecta e libera a conta para um Canal novo. */
export function arquivarCanal(id: string): Promise<Canal> {
  return gravar(`${chaveDoCanal(id)}/arquivar`, "POST");
}

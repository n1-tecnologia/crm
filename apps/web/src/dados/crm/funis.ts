"use client";

/**
 * Funis e Etapas do CRM, lidos e gravados só por HTTP (D-04): cada função é
 * uma rota de `apps/api` (`rotas/crm/funis.ts`) atrás de `chamarCrm`. Nenhum
 * arquivo do web importa o workspace da api — o contrato é o JSON e os tipos de
 * `@n1/dominio/crm/funis`.
 *
 * As chaves de SWR começam por `/funis` para que `invalidarCrm("/funis")`
 * alcance a lista e a ficha de uma vez depois de cada gravação (a ficha traz as
 * Etapas, então não há chave de Etapa à parte). Remapear uma Etapa e migrar os
 * Negócios de um Funil mudam também onde os Negócios estão: essas duas
 * invalidam `/negocios` junto.
 *
 * A invalidação só acontece no sucesso: numa recusa a `ErroDeApi` sobe com
 * `codigo` e `bloqueios` (D-07) e a tela segue como estava.
 */

import useSWR from "swr";
import { LIMITES_CRM, type EstadoCrm } from "@n1/dominio/crm/comum";
import type {
  EdicaoDeEtapa,
  EdicaoDeFunil,
  FunilDetalhado,
  FunilResumo,
  MapeamentoDeEtapas,
  NovaEtapa,
  NovoFunil,
} from "@n1/dominio/crm/funis";
import { chamarCrm, ErroDeApi, invalidarCrm } from "./cliente-crm";

export interface FiltroDeFunis {
  readonly estado?: EstadoCrm;
  readonly limite?: number;
  readonly deslocamento?: number;
}

export interface RespostaDaListaDeFunis {
  readonly ok: true;
  readonly itens: FunilResumo[];
  readonly total: number;
}

/** `/funis?estado=…&limite=…&deslocamento=…` — a mesma forma para a lista e para a invalidação. */
export function chaveDeFunis(filtro: FiltroDeFunis): string {
  const parametros = new URLSearchParams();
  parametros.set("estado", filtro.estado ?? "ativo");
  parametros.set("limite", String(filtro.limite ?? LIMITES_CRM.paginaPadrao));
  parametros.set("deslocamento", String(filtro.deslocamento ?? 0));
  return `/funis?${parametros.toString()}`;
}

export function useFunis(filtro: FiltroDeFunis) {
  const chave = chaveDeFunis(filtro);
  // `keepPreviousData`: "Mostrar mais" (o `limite` muda a chave) não pisca o esqueleto nem volta ao topo.
  // Quem usa confere se os dados são do estado pedido (a troca de aba também muda a chave).
  return useSWR<RespostaDaListaDeFunis, Error>(chave, (k: string) => chamarCrm<RespostaDaListaDeFunis>(k), {
    keepPreviousData: true,
  });
}

export function chaveDoFunil(id: string): string {
  return `/funis/${id}`;
}

/** Recusa 4xx não melhora ao repetir (um 404 de Funil do modelo antigo, por exemplo): só rede e 5xx tentam de novo. */
function valeRepetir(erro: Error): boolean {
  return !(erro instanceof ErroDeApi) || erro.status === 0 || erro.status >= 500;
}

/** A ficha com as Etapas. O 404 da api fica em `error` (`ErroDeApi`): a página explica o Funil do cadastro anterior (D-15). */
export function useFunil(id: string | undefined) {
  return useSWR<FunilDetalhado, Error>(
    id === undefined ? null : chaveDoFunil(id),
    async (chave: string) => (await chamarCrm<{ ok: true; dados: FunilDetalhado }>(chave)).dados,
    { shouldRetryOnError: valeRepetir },
  );
}

type Verbo = "POST" | "PATCH" | "PUT" | "DELETE";

async function gravar<T>(caminho: string, verbo: Verbo, corpo?: unknown, tambemInvalida: readonly string[] = []): Promise<T> {
  const resposta = await chamarCrm<{ ok: true; dados: T }>(caminho, {
    method: verbo,
    ...(corpo !== undefined ? { corpo } : {}),
  });
  await invalidarCrm("/funis");
  for (const prefixo of tambemInvalida) await invalidarCrm(prefixo);
  return resposta.dados;
}

export function criarFunil(entrada: NovoFunil): Promise<FunilDetalhado> {
  return gravar("/funis", "POST", entrada);
}

export function editarFunil(id: string, edicao: EdicaoDeFunil): Promise<FunilDetalhado> {
  return gravar(chaveDoFunil(id), "PATCH", edicao);
}

/** D-13: o padrão só muda por esta rota; a api recusa Funil inativo ou privado. */
export function definirFunilPadrao(id: string): Promise<FunilDetalhado> {
  return gravar(`${chaveDoFunil(id)}/padrao`, "POST");
}

export function adicionarEtapa(funilId: string, etapa: NovaEtapa & { readonly posicao?: number }): Promise<FunilDetalhado> {
  return gravar(`${chaveDoFunil(funilId)}/etapas`, "POST", etapa);
}

export function editarEtapa(etapaId: string, edicao: EdicaoDeEtapa): Promise<FunilDetalhado> {
  return gravar(`/etapas/${etapaId}`, "PATCH", edicao);
}

/** A ordem é a permutação COMPLETA das Etapas do Funil (a api recusa uma parcial). */
export function reordenarEtapas(funilId: string, etapaIds: readonly string[]): Promise<FunilDetalhado> {
  return gravar(`${chaveDoFunil(funilId)}/etapas/ordem`, "PUT", { etapaIds });
}

/** Etapa com Negócios é recusada com 409 `ETAPA_COM_NEGOCIOS` (D-07); a saída é `remapearEtapa`. */
export function removerEtapa(etapaId: string): Promise<FunilDetalhado> {
  return gravar(`/etapas/${etapaId}`, "DELETE");
}

/** D-07: move os Negócios da Etapa para outra do mesmo Funil e remove a Etapa. */
export function remapearEtapa(etapaId: string, paraEtapaId: string): Promise<FunilDetalhado> {
  return gravar(`/etapas/${etapaId}/remapear`, "POST", { paraEtapaId }, ["/negocios"]);
}

export function arquivarFunil(id: string): Promise<FunilDetalhado> {
  return gravar(`${chaveDoFunil(id)}/arquivar`, "POST");
}

export function restaurarFunil(id: string): Promise<FunilDetalhado> {
  return gravar(`${chaveDoFunil(id)}/restaurar`, "POST");
}

/** D-06: "Excluir" na interface manda para a Lixeira; D-07 recusa com 409 enquanto houver Negócios. */
export function enviarFunilParaLixeira(id: string): Promise<FunilDetalhado> {
  return gravar(chaveDoFunil(id), "DELETE");
}

/** Só parte da Lixeira; o corpo da resposta é `{ id }`, não o Funil. */
export function excluirFunilPermanentemente(id: string): Promise<{ readonly id: string }> {
  return gravar(`${chaveDoFunil(id)}/permanente`, "DELETE");
}

/** D-07: migra os Negócios para outro Funil `ativo` com o mapeamento explícito de Etapa para Etapa. */
export function migrarNegociosDoFunil(
  id: string,
  entrada: { readonly paraFunilId: string; readonly mapeamento: MapeamentoDeEtapas },
): Promise<{ readonly migrados: number }> {
  return gravar(`${chaveDoFunil(id)}/migrar-negocios`, "POST", entrada, ["/negocios"]);
}

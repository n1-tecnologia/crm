"use client";

/**
 * Contatos do CRM, lidos e gravados só por HTTP (D-04): cada função aqui é uma
 * rota de `apps/api` (`rotas/crm/contatos.ts`) atrás de `chamarCrm`. Nenhum
 * arquivo do web importa o workspace da api — o contrato é o JSON e os tipos
 * de `@n1/dominio/crm/*`.
 *
 * As chaves de SWR começam por `/contatos` para que `invalidarCrm("/contatos")`
 * alcance a lista e a ficha de uma vez depois de cada gravação. A invalidação
 * só acontece no sucesso: numa recusa a `ErroDeApi` sobe com `codigo` e
 * `bloqueios` (D-09) e a tela segue como estava.
 */

import useSWR from "swr";
import { LIMITES_CRM, type EstadoCrm } from "@n1/dominio/crm/comum";
import type {
  ContatoDetalhado,
  ContatoResumo,
  EdicaoDeContato,
  EdicaoDeIdentificador,
  NovoContato,
  NovoIdentificadorDeContato,
} from "@n1/dominio/crm/contatos";
import { chamarCrm, ErroDeApi, invalidarCrm } from "./cliente-crm";

export interface FiltroDeContatos {
  readonly estado?: EstadoCrm;
  readonly q?: string;
  readonly limite?: number;
  readonly deslocamento?: number;
}

export interface RespostaDaListaDeContatos {
  readonly ok: true;
  readonly itens: ContatoResumo[];
  readonly total: number;
}

/** `/contatos?estado=…&q=…&limite=…&deslocamento=…` — a mesma forma para a lista e para a invalidação. */
export function chaveDeContatos(filtro: FiltroDeContatos): string {
  const parametros = new URLSearchParams();
  parametros.set("estado", filtro.estado ?? "ativo");
  const busca = (filtro.q ?? "").trim();
  if (busca !== "") parametros.set("q", busca);
  parametros.set("limite", String(filtro.limite ?? LIMITES_CRM.paginaPadrao));
  parametros.set("deslocamento", String(filtro.deslocamento ?? 0));
  return `/contatos?${parametros.toString()}`;
}

export function useContatos(filtro: FiltroDeContatos) {
  const chave = chaveDeContatos(filtro);
  // `keepPreviousData`: "Mostrar mais" (o `limite` muda a chave) não pisca o esqueleto nem volta ao topo.
  // Quem usa confere se os dados são do estado pedido (a troca de aba também muda a chave).
  return useSWR<RespostaDaListaDeContatos, Error>(chave, (k: string) => chamarCrm<RespostaDaListaDeContatos>(k), {
    keepPreviousData: true,
  });
}

export function chaveDoContato(id: string): string {
  return `/contatos/${id}`;
}

/** Recusa 4xx não melhora ao repetir (um 404 do modelo antigo, por exemplo): só rede e 5xx tentam de novo. */
function valeRepetir(erro: Error): boolean {
  return !(erro instanceof ErroDeApi) || erro.status === 0 || erro.status >= 500;
}

/** A ficha. O 404 da api fica em `error` (`ErroDeApi`): a página decide o recuo para a ficha antiga (D-15). */
export function useContato(id: string | undefined) {
  return useSWR<ContatoDetalhado, Error>(
    id === undefined ? null : chaveDoContato(id),
    async (chave: string) => (await chamarCrm<{ ok: true; dados: ContatoDetalhado }>(chave)).dados,
    { shouldRetryOnError: valeRepetir },
  );
}

type Verbo = "POST" | "PATCH" | "DELETE";

async function gravar<T>(caminho: string, verbo: Verbo, corpo?: unknown): Promise<T> {
  const resposta = await chamarCrm<{ ok: true; dados: T }>(caminho, {
    method: verbo,
    ...(corpo !== undefined ? { corpo } : {}),
  });
  await invalidarCrm("/contatos");
  return resposta.dados;
}

export function criarContato(entrada: NovoContato): Promise<ContatoDetalhado> {
  return gravar("/contatos", "POST", entrada);
}

export function editarContato(id: string, edicao: EdicaoDeContato): Promise<ContatoDetalhado> {
  return gravar(chaveDoContato(id), "PATCH", edicao);
}

export function adicionarIdentificador(id: string, entrada: NovoIdentificadorDeContato): Promise<ContatoDetalhado> {
  return gravar(`${chaveDoContato(id)}/identificadores`, "POST", entrada);
}

export function editarIdentificador(id: string, identificadorId: string, edicao: EdicaoDeIdentificador): Promise<ContatoDetalhado> {
  return gravar(`${chaveDoContato(id)}/identificadores/${identificadorId}`, "PATCH", edicao);
}

export function removerIdentificador(id: string, identificadorId: string): Promise<ContatoDetalhado> {
  return gravar(`${chaveDoContato(id)}/identificadores/${identificadorId}`, "DELETE");
}

export function arquivarContato(id: string): Promise<ContatoDetalhado> {
  return gravar(`${chaveDoContato(id)}/arquivar`, "POST");
}

export function restaurarContato(id: string): Promise<ContatoDetalhado> {
  return gravar(`${chaveDoContato(id)}/restaurar`, "POST");
}

/** D-06: "Excluir" na interface manda para a Lixeira; D-09 pode recusar com `bloqueios`. */
export function enviarContatoParaLixeira(id: string): Promise<ContatoDetalhado> {
  return gravar(chaveDoContato(id), "DELETE");
}

/** Só parte da Lixeira; o corpo da resposta é `{ id }`, não o Contato. */
export function excluirContatoPermanentemente(id: string): Promise<{ readonly id: string }> {
  return gravar(`${chaveDoContato(id)}/permanente`, "DELETE");
}

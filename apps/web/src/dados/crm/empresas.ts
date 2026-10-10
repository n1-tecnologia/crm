"use client";

/**
 * Empresas do CRM, lidas e gravadas só por HTTP (D-04): cada função aqui é uma
 * rota de `apps/api` (`rotas/crm/empresas.ts`) atrás de `chamarCrm`. Nenhum
 * arquivo do web importa o workspace da api — o contrato é o JSON e os tipos
 * de `@n1/dominio/crm/*`.
 *
 * As chaves de SWR começam por `/empresas`. Depois de cada gravação com
 * sucesso invalidam-se `/empresas` E `/contatos`: o vínculo Contato-Empresa
 * aparece na ficha do Contato, e trocar admin ou enviar a Empresa à lixeira
 * (que encerra vínculos, D-08) muda o que essa ficha mostra. Numa recusa a
 * `ErroDeApi` sobe com `codigo` e `bloqueios` e nada é invalidado.
 */

import useSWR from "swr";
import { LIMITES_CRM, type EstadoCrm } from "@n1/dominio/crm/comum";
import type {
  AdminDaNovaEmpresa,
  EdicaoDeEmpresa,
  EdicaoDeVinculo,
  EmpresaDetalhada,
  EmpresaResumo,
  NovaEmpresa,
  NovoIdentificadorDeEmpresa,
  NovoVinculo,
  TrocaDeAdmin,
} from "@n1/dominio/crm/empresas";
import { chamarCrm, ErroDeApi, invalidarCrm } from "./cliente-crm";

export interface FiltroDeEmpresas {
  readonly estado?: EstadoCrm;
  readonly q?: string;
  readonly limite?: number;
  readonly deslocamento?: number;
}

export interface RespostaDaListaDeEmpresas {
  readonly ok: true;
  readonly itens: EmpresaResumo[];
  readonly total: number;
}

/** O corpo de `POST /empresas` (D-08): a Empresa e o admin que ela nasce tendo, juntos. */
export interface EntradaDeNovaEmpresa {
  readonly empresa: NovaEmpresa;
  readonly admin: AdminDaNovaEmpresa;
}

/** Espelho do contrato de `PATCH /empresas/:id/identificadores/:id` (o web não importa a api). */
export interface EdicaoDeIdentificadorDeEmpresa {
  readonly principal?: boolean;
  readonly verificado?: boolean;
  readonly pais?: string;
}

/** Restaurar da lixeira pede o Contato admin; de arquivada, não pede nada. */
export interface CorpoDeRestauracaoDeEmpresa {
  readonly admin?: { readonly contatoId: string; readonly cargo?: string };
}

/** `/empresas?estado=…&q=…&limite=…&deslocamento=…` — a mesma forma para a lista e para a invalidação. */
export function chaveDeEmpresas(filtro: FiltroDeEmpresas): string {
  const parametros = new URLSearchParams();
  parametros.set("estado", filtro.estado ?? "ativo");
  const busca = (filtro.q ?? "").trim();
  if (busca !== "") parametros.set("q", busca);
  parametros.set("limite", String(filtro.limite ?? LIMITES_CRM.paginaPadrao));
  parametros.set("deslocamento", String(filtro.deslocamento ?? 0));
  return `/empresas?${parametros.toString()}`;
}

export function useEmpresas(filtro: FiltroDeEmpresas) {
  const chave = chaveDeEmpresas(filtro);
  // `keepPreviousData`: "Mostrar mais" (o `limite` muda a chave) não pisca o esqueleto nem volta ao topo.
  // Quem usa confere se os dados são do estado pedido (a troca de aba também muda a chave).
  return useSWR<RespostaDaListaDeEmpresas, Error>(chave, (k: string) => chamarCrm<RespostaDaListaDeEmpresas>(k), {
    keepPreviousData: true,
  });
}

export function chaveDaEmpresa(id: string): string {
  return `/empresas/${id}`;
}

/** Recusa 4xx não melhora ao repetir (um 404 do modelo antigo, por exemplo): só rede e 5xx tentam de novo. */
function valeRepetir(erro: Error): boolean {
  return !(erro instanceof ErroDeApi) || erro.status === 0 || erro.status >= 500;
}

/** A ficha. O 404 da api fica em `error` (`ErroDeApi`): a página decide o recuo para a ficha antiga (D-15). */
export function useEmpresa(id: string | undefined) {
  return useSWR<EmpresaDetalhada, Error>(
    id === undefined ? null : chaveDaEmpresa(id),
    async (chave: string) => (await chamarCrm<{ ok: true; dados: EmpresaDetalhada }>(chave)).dados,
    { shouldRetryOnError: valeRepetir },
  );
}

type Verbo = "POST" | "PATCH" | "DELETE";

async function gravar<T>(caminho: string, verbo: Verbo, corpo?: unknown): Promise<T> {
  const resposta = await chamarCrm<{ ok: true; dados: T }>(caminho, {
    method: verbo,
    ...(corpo !== undefined ? { corpo } : {}),
  });
  await invalidarCrm("/empresas");
  // O vínculo mora também na ficha do Contato (e a lixeira da Empresa o encerra).
  await invalidarCrm("/contatos");
  return resposta.dados;
}

export function criarEmpresa(entrada: EntradaDeNovaEmpresa): Promise<EmpresaDetalhada> {
  return gravar("/empresas", "POST", entrada);
}

export function editarEmpresa(id: string, edicao: EdicaoDeEmpresa): Promise<EmpresaDetalhada> {
  return gravar(chaveDaEmpresa(id), "PATCH", edicao);
}

export function adicionarIdentificadorDeEmpresa(id: string, entrada: NovoIdentificadorDeEmpresa): Promise<EmpresaDetalhada> {
  return gravar(`${chaveDaEmpresa(id)}/identificadores`, "POST", entrada);
}

export function editarIdentificadorDeEmpresa(
  id: string,
  identificadorId: string,
  edicao: EdicaoDeIdentificadorDeEmpresa,
): Promise<EmpresaDetalhada> {
  return gravar(`${chaveDaEmpresa(id)}/identificadores/${identificadorId}`, "PATCH", edicao);
}

export function removerIdentificadorDeEmpresa(id: string, identificadorId: string): Promise<EmpresaDetalhada> {
  return gravar(`${chaveDaEmpresa(id)}/identificadores/${identificadorId}`, "DELETE");
}

export function vincularContatoAEmpresa(id: string, entrada: NovoVinculo): Promise<EmpresaDetalhada> {
  return gravar(`${chaveDaEmpresa(id)}/contatos`, "POST", entrada);
}

export function editarVinculo(id: string, vinculoId: string, edicao: EdicaoDeVinculo): Promise<EmpresaDetalhada> {
  return gravar(`${chaveDaEmpresa(id)}/contatos/${vinculoId}`, "PATCH", edicao);
}

/** Sem corpo: o vínculo termina hoje. */
export function encerrarVinculo(id: string, vinculoId: string): Promise<EmpresaDetalhada> {
  return gravar(`${chaveDaEmpresa(id)}/contatos/${vinculoId}/encerrar`, "POST");
}

/** D-08: o admin novo e o rebaixamento do atual numa transação só, para a Empresa nunca ficar sem admin. */
export function trocarAdminDaEmpresa(id: string, troca: TrocaDeAdmin): Promise<EmpresaDetalhada> {
  return gravar(`${chaveDaEmpresa(id)}/trocar-admin`, "POST", troca);
}

export function arquivarEmpresa(id: string): Promise<EmpresaDetalhada> {
  return gravar(`${chaveDaEmpresa(id)}/arquivar`, "POST");
}

/** Da lixeira o corpo leva o Contato admin (D-08); de arquivada vai sem corpo e sem `content-type`. */
export function restaurarEmpresa(id: string, corpo?: CorpoDeRestauracaoDeEmpresa): Promise<EmpresaDetalhada> {
  return gravar(`${chaveDaEmpresa(id)}/restaurar`, "POST", corpo);
}

/** D-06: "Excluir" na interface manda para a Lixeira e encerra os vínculos vigentes (D-08); RN-EMP-09 pode recusar com `bloqueios`. */
export function enviarEmpresaParaLixeira(id: string): Promise<EmpresaDetalhada> {
  return gravar(chaveDaEmpresa(id), "DELETE");
}

/** Só parte da Lixeira; o corpo da resposta é `{ id }`, não a Empresa. */
export function excluirEmpresaPermanentemente(id: string): Promise<{ readonly id: string }> {
  return gravar(`${chaveDaEmpresa(id)}/permanente`, "DELETE");
}

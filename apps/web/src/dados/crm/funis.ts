"use client";

/** Esqueleto do RED: a assinatura existe, o comportamento não. */

import type { SWRResponse } from "swr";
import type { EstadoCrm } from "@n1/dominio/crm/comum";
import type {
  EdicaoDeEtapa,
  EdicaoDeFunil,
  FunilDetalhado,
  FunilResumo,
  MapeamentoDeEtapas,
  NovaEtapa,
  NovoFunil,
} from "@n1/dominio/crm/funis";

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

export function chaveDeFunis(_filtro: FiltroDeFunis): string {
  return undefined as never;
}
export function useFunis(_filtro: FiltroDeFunis): SWRResponse<RespostaDaListaDeFunis, Error> {
  return undefined as never;
}
export function chaveDoFunil(_id: string): string {
  return undefined as never;
}
export function useFunil(_id: string | undefined): SWRResponse<FunilDetalhado, Error> {
  return undefined as never;
}
export function criarFunil(_entrada: NovoFunil): Promise<FunilDetalhado> {
  return undefined as never;
}
export function editarFunil(_id: string, _edicao: EdicaoDeFunil): Promise<FunilDetalhado> {
  return undefined as never;
}
export function definirFunilPadrao(_id: string): Promise<FunilDetalhado> {
  return undefined as never;
}
export function adicionarEtapa(_funilId: string, _etapa: NovaEtapa & { readonly posicao?: number }): Promise<FunilDetalhado> {
  return undefined as never;
}
export function editarEtapa(_etapaId: string, _edicao: EdicaoDeEtapa): Promise<FunilDetalhado> {
  return undefined as never;
}
export function reordenarEtapas(_funilId: string, _etapaIds: readonly string[]): Promise<FunilDetalhado> {
  return undefined as never;
}
export function removerEtapa(_etapaId: string): Promise<FunilDetalhado> {
  return undefined as never;
}
export function remapearEtapa(_etapaId: string, _paraEtapaId: string): Promise<FunilDetalhado> {
  return undefined as never;
}
export function arquivarFunil(_id: string): Promise<FunilDetalhado> {
  return undefined as never;
}
export function restaurarFunil(_id: string): Promise<FunilDetalhado> {
  return undefined as never;
}
export function enviarFunilParaLixeira(_id: string): Promise<FunilDetalhado> {
  return undefined as never;
}
export function excluirFunilPermanentemente(_id: string): Promise<{ readonly id: string }> {
  return undefined as never;
}
export function migrarNegociosDoFunil(
  _id: string,
  _entrada: { readonly paraFunilId: string; readonly mapeamento: MapeamentoDeEtapas },
): Promise<{ readonly migrados: number }> {
  return undefined as never;
}

"use client";

// Esqueleto do RED (07-10 Task 1): compila e erra. O GREEN o substitui.

import type { EstadoCrm, SituacaoNegocio } from "@n1/dominio/crm/comum";
import type {
  EdicaoDeNegocio,
  Ganho,
  Movimento,
  NegocioDetalhado,
  NegocioResumo,
  NovoNegocio,
  Perda,
  Reabertura,
} from "@n1/dominio/crm/negocios";

export interface FiltroDeNegocios {
  readonly funilId?: string;
  readonly situacao?: SituacaoNegocio;
  readonly estado?: EstadoCrm;
  readonly empresaId?: string;
  readonly contatoId?: string;
  readonly q?: string;
  readonly limite?: number;
  readonly deslocamento?: number;
}

export interface RespostaDaListaDeNegocios {
  readonly ok: true;
  readonly itens: NegocioResumo[];
  readonly total: number;
}

export const chaveDeNegocios = (_filtro: FiltroDeNegocios): string => "";
export const useNegocios = (_filtro: FiltroDeNegocios, _opcoes?: { readonly pausado?: boolean }): never => undefined as never;
export const chaveDoNegocio = (_id: string): string => "";
export const useNegocio = (_id: string | undefined): never => undefined as never;
export const valorDigitadoParaDecimal = (_texto: string): string | undefined => "pendente";

const naoFeito = (): Promise<never> => Promise.resolve(undefined as never);

export const criarNegocio = (_entrada: NovoNegocio): Promise<NegocioDetalhado> => naoFeito();
export const editarNegocio = (_id: string, _edicao: EdicaoDeNegocio): Promise<NegocioDetalhado> => naoFeito();
export const moverNegocio = (_id: string, _movimento: Movimento): Promise<NegocioDetalhado> => naoFeito();
export const ganharNegocio = (_id: string, _ganho?: Ganho): Promise<NegocioDetalhado> => naoFeito();
export const perderNegocio = (_id: string, _perda?: Perda): Promise<NegocioDetalhado> => naoFeito();
export const reabrirNegocio = (_id: string, _destino?: Reabertura): Promise<NegocioDetalhado> => naoFeito();
export const arquivarNegocio = (_id: string): Promise<NegocioDetalhado> => naoFeito();
export const restaurarNegocio = (_id: string): Promise<NegocioDetalhado> => naoFeito();
export const enviarNegocioParaLixeira = (_id: string): Promise<NegocioDetalhado> => naoFeito();
export const excluirNegocioPermanentemente = (_id: string): Promise<{ readonly id: string }> => naoFeito();

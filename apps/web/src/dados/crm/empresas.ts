"use client";

// Esqueleto do RED (07-09 Task 1): compila e erra. O GREEN o substitui.

import type { EstadoCrm } from "@n1/dominio/crm/comum";
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

export const chaveDeEmpresas = (_filtro: FiltroDeEmpresas): string => "";
export const useEmpresas = (_filtro: FiltroDeEmpresas): never => undefined as never;
export const chaveDaEmpresa = (_id: string): string => "";
export const useEmpresa = (_id: string | undefined): never => undefined as never;

const naoFeito = (): Promise<never> => Promise.resolve(undefined as never);

export const criarEmpresa = (_entrada: { readonly empresa: NovaEmpresa; readonly admin: AdminDaNovaEmpresa }): Promise<EmpresaDetalhada> => naoFeito();
export const editarEmpresa = (_id: string, _edicao: EdicaoDeEmpresa): Promise<EmpresaDetalhada> => naoFeito();
export const adicionarIdentificadorDeEmpresa = (_id: string, _entrada: NovoIdentificadorDeEmpresa): Promise<EmpresaDetalhada> => naoFeito();
export const editarIdentificadorDeEmpresa = (_id: string, _identificadorId: string, _edicao: { readonly principal?: boolean }): Promise<EmpresaDetalhada> => naoFeito();
export const removerIdentificadorDeEmpresa = (_id: string, _identificadorId: string): Promise<EmpresaDetalhada> => naoFeito();
export const vincularContatoAEmpresa = (_id: string, _entrada: NovoVinculo): Promise<EmpresaDetalhada> => naoFeito();
export const editarVinculo = (_id: string, _vinculoId: string, _edicao: EdicaoDeVinculo): Promise<EmpresaDetalhada> => naoFeito();
export const encerrarVinculo = (_id: string, _vinculoId: string): Promise<EmpresaDetalhada> => naoFeito();
export const trocarAdminDaEmpresa = (_id: string, _troca: TrocaDeAdmin): Promise<EmpresaDetalhada> => naoFeito();
export const arquivarEmpresa = (_id: string): Promise<EmpresaDetalhada> => naoFeito();
export const restaurarEmpresa = (_id: string, _corpo?: { readonly admin?: { readonly contatoId: string } }): Promise<EmpresaDetalhada> => naoFeito();
export const enviarEmpresaParaLixeira = (_id: string): Promise<EmpresaDetalhada> => naoFeito();
export const excluirEmpresaPermanentemente = (_id: string): Promise<{ readonly id: string }> => naoFeito();

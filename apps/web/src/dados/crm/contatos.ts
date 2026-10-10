"use client";

// ESQUELETO do RED (07-06 Task 1): compila e erra; o GREEN o substitui.

import type { EstadoCrm } from "@n1/dominio/crm/comum";
import type { ContatoDetalhado, EdicaoDeContato, EdicaoDeIdentificador, NovoContato, NovoIdentificadorDeContato } from "@n1/dominio/crm/contatos";

export interface FiltroDeContatos {
  readonly estado?: EstadoCrm;
  readonly q?: string;
  readonly limite?: number;
  readonly deslocamento?: number;
}

export function chaveDeContatos(_filtro: FiltroDeContatos): string {
  return "";
}
export function useContatos(_filtro: FiltroDeContatos): { readonly data: undefined } {
  return { data: undefined };
}
export function chaveDoContato(_id: string): string {
  return "";
}
export function useContato(_id: string | undefined): { readonly data: undefined } {
  return { data: undefined };
}
const pendente = async (): Promise<ContatoDetalhado> => undefined as never;
export const criarContato = async (_entrada: NovoContato): Promise<ContatoDetalhado> => pendente();
export const editarContato = async (_id: string, _edicao: EdicaoDeContato): Promise<ContatoDetalhado> => pendente();
export const adicionarIdentificador = async (_id: string, _entrada: NovoIdentificadorDeContato): Promise<ContatoDetalhado> => pendente();
export const editarIdentificador = async (_id: string, _identificadorId: string, _edicao: EdicaoDeIdentificador): Promise<ContatoDetalhado> => pendente();
export const removerIdentificador = async (_id: string, _identificadorId: string): Promise<ContatoDetalhado> => pendente();
export const arquivarContato = async (_id: string): Promise<ContatoDetalhado> => pendente();
export const restaurarContato = async (_id: string): Promise<ContatoDetalhado> => pendente();
export const enviarContatoParaLixeira = async (_id: string): Promise<ContatoDetalhado> => pendente();
export const excluirContatoPermanentemente = async (_id: string): Promise<{ readonly id: string }> => undefined as never;

/**
 * O Funil do CRM novo e as Etapas dele: o processo pelo qual um Negócio
 * progride. Tipos camelCase dos campos de `plataforma.funis` e
 * `plataforma.etapas` (007), mais as regras que valem dos dois lados da
 * fronteira — a tela pré-valida e o endpoint aplica as MESMAS funções.
 *
 * Convive com `types/crm.ts` (modelo inglês) até a fase de unificação (D-01).
 * Nenhum tipo aqui carrega `workspaceId`: o Espaço de Trabalho vem da sessão,
 * nunca do corpo (D-10). Funil não tem Proprietário (INV-FUN-11): só `criadoPor`.
 *
 * Comparação de nome: `trim().toLocaleLowerCase("pt-BR")`, a mesma de
 * `lower(btrim(nome))` dos índices `funis_nome_uq` e `etapas_nome_uq` da 007.
 */

import { fail, ok, type OperationResult } from "../state";
import { LIMITES_CRM, type EstadoCrm } from "./comum";

export interface Funil {
  readonly id: string;
  readonly nome: string;
  readonly descricao: string | null;
  readonly cor: string | null;
  readonly ordem: number;
  /** O Funil que um Negócio recebe sem Funil explícito (D-13). Só muda por `POST /funis/:id/padrao`. */
  readonly padrao: boolean;
  /** D-10: só gravado; nenhuma visibilidade muda por ele nesta fase. */
  readonly privado: boolean;
  readonly exigeMotivoPerda: boolean;
  readonly exigeValorGanho: boolean;
  readonly estado: EstadoCrm;
  readonly criadoPor: string;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
}

export interface Etapa {
  readonly id: string;
  readonly funilId: string;
  readonly nome: string;
  readonly ordem: number;
  readonly probabilidadePadrao: number;
  readonly cor: string | null;
  readonly descricao: string | null;
  readonly criadoEm: string;
}

export interface NovaEtapa {
  readonly nome: string;
  readonly probabilidadePadrao?: number;
  readonly cor?: string;
  readonly descricao?: string;
}

export interface NovoFunil {
  readonly nome: string;
  readonly descricao?: string;
  readonly cor?: string;
  readonly privado?: boolean;
  readonly exigeMotivoPerda?: boolean;
  readonly exigeValorGanho?: boolean;
  readonly etapas: readonly NovaEtapa[];
}

/** O que se muda num Funil existente. Sem `padrao`: o padrão só muda por `POST /funis/:id/padrao`. */
export interface EdicaoDeFunil {
  readonly nome?: string;
  readonly descricao?: string;
  readonly cor?: string;
  readonly privado?: boolean;
  readonly exigeMotivoPerda?: boolean;
  readonly exigeValorGanho?: boolean;
  readonly ordem?: number;
}

export interface EdicaoDeEtapa {
  readonly nome?: string;
  readonly probabilidadePadrao?: number;
  readonly cor?: string;
  readonly descricao?: string;
}

/** Quantos Negócios referenciam uma Etapa (ou um Funil), em todas as situações e estados. */
export interface ContagemDeNegocios {
  readonly abertos: number;
  readonly ganhos: number;
  readonly perdidos: number;
  readonly arquivados: number;
  readonly naLixeira: number;
  readonly total: number;
}

export type EtapaDetalhada = Etapa & { readonly negocios: ContagemDeNegocios };

/** O que a lista mostra por linha. */
export interface FunilResumo {
  readonly funil: Funil;
  readonly totalEtapas: number;
  readonly negociosAbertos: number;
}

export interface FunilDetalhado {
  readonly funil: Funil;
  readonly etapas: readonly EtapaDetalhada[];
}

/** Etapa de origem → Etapa de destino, por id. */
export type MapeamentoDeEtapas = Readonly<Record<string, string>>;

/** A chave de comparação de nomes: a mesma de `lower(btrim(nome))` da 007. */
export function chaveDeNome(nome: string): string {
  return nome.trim().toLocaleLowerCase("pt-BR");
}

export function validarNomeDeFunil(nome: string): OperationResult<void> {
  void nome;
  return fail("pendente");
}

export function validarNomeDeEtapa(nome: string, existentes: readonly string[]): OperationResult<void> {
  void nome;
  void existentes;
  return fail("pendente");
}

export function validarNovoFunil(entrada: NovoFunil): OperationResult<void> {
  void entrada;
  return fail("pendente");
}

export function etapaInicial<T extends { readonly ordem: number }>(etapas: readonly T[]): T | undefined {
  void etapas;
  return undefined;
}

export function validarReordenacao(atuais: readonly string[], novos: readonly string[]): OperationResult<void> {
  void atuais;
  void novos;
  return fail("pendente");
}

export function validarRemocaoDeEtapa(totalDeEtapas: number): OperationResult<void> {
  void totalDeEtapas;
  return fail("pendente");
}

export function validarMudancaDeEstado(funil: { readonly padrao: boolean }, alvo: EstadoCrm): OperationResult<void> {
  void funil;
  void alvo;
  return fail("pendente");
}

export function validarPrivacidade(funil: { readonly padrao: boolean }, privado: boolean): OperationResult<void> {
  void funil;
  void privado;
  return fail("pendente");
}

export function deveNascerPadrao(existePadrao: boolean, privado: boolean): boolean {
  void existePadrao;
  void privado;
  return false;
}

export function validarNovoPadrao(funil: { readonly estado: EstadoCrm; readonly privado: boolean }): OperationResult<void> {
  void funil;
  return fail("pendente");
}

export function validarMigracao(entrada: {
  readonly origem: { readonly id: string };
  readonly destino: { readonly id: string; readonly estado: EstadoCrm };
  readonly etapasDoDestino: readonly { readonly id: string }[];
  readonly etapasDeOrigemComNegocios: readonly string[];
  readonly mapeamento: MapeamentoDeEtapas;
}): OperationResult<void> {
  void entrada;
  return fail("pendente");
}

export function fraseFunilComNegocios(total: number): string {
  void total;
  return "pendente";
}

export function fraseEtapaComNegocios(total: number): string {
  void total;
  return "pendente";
}

export function fraseFunilComNegociosAbertos(total: number): string {
  void total;
  return "pendente";
}

/** Reexportado para quem monta limites de tela junto das regras. */
export const LIMITE_DE_ETAPAS_POR_FUNIL = 40;
void LIMITES_CRM;

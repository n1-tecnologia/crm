/**
 * A Empresa do CRM novo: a organização, e o vínculo dela com os Contatos.
 * Tipos camelCase de `plataforma.empresas`, `empresa_identificadores` e
 * `contato_empresa` (007), mais as regras que valem dos dois lados da
 * fronteira — a tela e o endpoint aplicam as mesmas funções.
 *
 * Convive com `types/crm.ts` (modelo inglês) até a fase de unificação (D-01).
 * Nenhum tipo aqui carrega `workspaceId`: o Espaço de Trabalho vem da sessão,
 * nunca do corpo (D-10).
 */

import { fail, type OperationResult } from "../state";
import type { CivilDate } from "../types/primitives";
import type { BloqueiosCrm, CamposAdicionais, Endereco, EstadoCrm } from "./comum";
import type { NovoContato } from "./contatos";

/** Os tipos de Identificador de Empresa (007:177). Nunca resolvem Mensagens. */
export const TIPOS_IDENTIFICADOR_EMPRESA = ["dominio", "documento_fiscal", "telefone"] as const;
export type TipoIdentificadorEmpresa = (typeof TIPOS_IDENTIFICADOR_EMPRESA)[number];

export interface Empresa {
  readonly id: string;
  readonly nomeFantasia: string | null;
  readonly razaoSocial: string | null;
  readonly descricao: string | null;
  readonly matrizId: string | null;
  readonly enderecos: readonly Endereco[];
  readonly camposAdicionais: CamposAdicionais;
  readonly origem: string | null;
  readonly estado: EstadoCrm;
  readonly proprietarioId: string;
  readonly criadoPor: string;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
}

export interface IdentificadorDeEmpresa {
  readonly id: string;
  readonly empresaId: string;
  readonly tipo: TipoIdentificadorEmpresa;
  readonly valor: string;
  readonly pais: string | null;
  readonly verificado: boolean;
  readonly principal: boolean;
  readonly criadoEm: string;
}

/** Um vínculo Contato-Empresa, vigente (`fim` nulo) ou encerrado (`contato_empresa`). */
export interface VinculoDaEmpresa {
  readonly id: string;
  readonly contatoId: string;
  readonly contatoNome: string;
  readonly contatoEstado: EstadoCrm;
  readonly cargo: string | null;
  readonly admin: boolean;
  readonly inicio: CivilDate | null;
  readonly fim: CivilDate | null;
}

/** O que a lista mostra por linha. O nome de exibição é derivado, nunca gravado. */
export interface EmpresaResumo {
  readonly id: string;
  readonly nomeDeExibicao: string;
  readonly dominioPrincipal: string | null;
  readonly documentoPrincipal: string | null;
  readonly matriz: { readonly id: string; readonly nome: string } | null;
  readonly proprietarioId: string;
  readonly estado: EstadoCrm;
  readonly atualizadoEm: string;
}

export interface EmpresaDetalhada {
  readonly empresa: Empresa;
  readonly identificadores: readonly IdentificadorDeEmpresa[];
  readonly vinculos: readonly VinculoDaEmpresa[];
  readonly matriz: { readonly id: string; readonly nome: string; readonly estado: EstadoCrm } | null;
  readonly filiais: readonly { readonly id: string; readonly nome: string; readonly estado: EstadoCrm }[];
}

export interface NovoIdentificadorDeEmpresa {
  readonly tipo: TipoIdentificadorEmpresa;
  readonly valor: string;
  readonly pais?: string;
}

export interface NovaEmpresa {
  readonly nomeFantasia?: string;
  readonly razaoSocial?: string;
  readonly descricao?: string;
  readonly matrizId?: string;
  readonly enderecos?: readonly Endereco[];
  readonly camposAdicionais?: CamposAdicionais;
  readonly origem?: string;
  readonly proprietarioId?: string;
  readonly identificadores?: readonly NovoIdentificadorDeEmpresa[];
}

export type EdicaoDeEmpresa = Partial<Omit<NovaEmpresa, "identificadores">>;

/** O admin que a Empresa nasce tendo (D-08): um Contato que já existe, ou um novo criado junto. */
export type AdminDaNovaEmpresa =
  | { readonly contatoId: string; readonly cargo?: string }
  | { readonly novoContato: NovoContato; readonly cargo?: string };

export interface NovoVinculo {
  readonly contatoId: string;
  readonly cargo?: string;
  readonly admin?: boolean;
  readonly inicio?: CivilDate;
}

export interface EdicaoDeVinculo {
  readonly cargo?: string;
  readonly admin?: boolean;
}

export interface TrocaDeAdmin {
  readonly vinculoAtualId: string;
  readonly novoAdmin: { readonly contatoId: string; readonly cargo?: string };
}

export const FRASE_EMPRESA_SEM_ADMIN = "pendente";

export function nomeDeExibicaoDaEmpresa(_empresa: {
  readonly nomeFantasia?: string | null;
  readonly razaoSocial?: string | null;
}): string {
  return "pendente";
}

export function validarEmpresa(_entrada: {
  readonly nomeFantasia?: string | null;
  readonly razaoSocial?: string | null;
}): OperationResult<void> {
  return fail("pendente");
}

export function validarIdentificadorDeEmpresa(
  _entrada: NovoIdentificadorDeEmpresa,
): OperationResult<NovoIdentificadorDeEmpresa> {
  return fail("pendente");
}

export function validarMatriz(_entrada: {
  readonly empresaId?: string;
  readonly matriz: { readonly id: string; readonly estado: EstadoCrm };
  readonly ancestraisDaMatriz: readonly string[];
}): OperationResult<void> {
  return fail("pendente");
}

export function adminsVigentes(_vinculos: readonly VinculoDaEmpresa[]): readonly VinculoDaEmpresa[] {
  return [];
}

export function validarRetiradaDeAdmin(_vinculos: readonly VinculoDaEmpresa[], _vinculoId: string): OperationResult<void> {
  return fail("pendente");
}

export function fraseDeEmpresaBloqueada(_bloqueios: BloqueiosCrm): string {
  return "pendente";
}

/**
 * Permissão do CRM por Papel (D-14) — esqueleto do RED; a matriz vem no GREEN.
 */

import type { MemberState, SystemRole } from "../types/workspace";
import type { SituacaoNegocio } from "./comum";

export type RecursoCrm = "contato" | "empresa" | "funil" | "negocio";

export type AcaoCrm =
  | "ler"
  | "criar"
  | "editar"
  | "arquivar"
  | "enviar_para_lixeira"
  | "restaurar"
  | "excluir_permanentemente"
  | "mover"
  | "ganhar"
  | "perder"
  | "reabrir"
  | "definir_padrao";

export function ehAdministracao(_base: SystemRole | undefined): boolean {
  return false;
}

export function podeNoCrm(
  _base: SystemRole | undefined,
  _estado: MemberState | undefined,
  _acao: AcaoCrm,
  _recurso: RecursoCrm,
  _contexto?: { readonly situacao?: SituacaoNegocio },
): string | undefined {
  return undefined;
}

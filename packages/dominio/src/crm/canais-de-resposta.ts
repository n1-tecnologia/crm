/**
 * Esqueleto do RED (15-20): as assinaturas existem, o comportamento não. O GREEN
 * troca este arquivo pela implementação.
 */

import type { TipoComProvedor } from "../provedores-de-canal";
import type { Canal } from "./canais";
import type { IdentificadorDeContato } from "./contatos";
import type { ConversaNaLista } from "./conversas";

export const ORDEM_DOS_TIPOS_NAS_TABELAS: readonly TipoComProvedor[] = [];

export interface CanalDoFioNasTabelas {
  readonly canal: Canal;
  readonly alcancavel: boolean;
}

export type ConversaParaOFio = Pick<ConversaNaLista, "canalId" | "estado" | "ultimaRecebidaEm" | "atualizadoEm">;

type Identificadores = readonly Pick<IdentificadorDeContato, "tipo">[] | undefined;

export function canaisQueAlcancamNasTabelas(_canais: readonly Canal[], _identificadores: Identificadores): Canal[] {
  return [];
}

export function canaisDoFioNasTabelas(_canais: readonly Canal[], _identificadores: Identificadores): CanalDoFioNasTabelas[] {
  return [];
}

export function canaisDeRespostaNasTabelas(_canais: readonly Canal[], _identificadores: Identificadores): Canal[] {
  return [];
}

export function canalPadraoDeRespostaNasTabelas(
  _canais: readonly Canal[],
  _identificadores: Identificadores,
  _conversas: readonly ConversaParaOFio[],
): string | undefined {
  return undefined;
}

export function canalDaAbaInicialNasTabelas(
  _canais: readonly Canal[],
  _identificadores: Identificadores,
  _conversas: readonly ConversaParaOFio[],
): string | undefined {
  return undefined;
}

export function canalPadraoDoTipoNasTabelas(
  _canais: readonly Canal[],
  _identificadores: Identificadores,
  _conversas: readonly ConversaParaOFio[],
  _tipo: TipoComProvedor,
): string | undefined {
  return undefined;
}

export function rotuloDoCanalNasTabelas(_canal: Pick<Canal, "nome" | "provedor">): string {
  return "";
}

export function textoDoSeparadorNasTabelas(_canal: Pick<Canal, "nome" | "provedor">): string {
  return "";
}

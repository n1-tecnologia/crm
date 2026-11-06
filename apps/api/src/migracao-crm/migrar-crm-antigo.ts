/**
 * Esqueleto do RED (15-27, Task 1): a forma pública do script, sem o comportamento.
 * O GREEN troca isto pela implementação.
 */

import type { PoolClient } from "pg";

export interface GanchosDeTeste {
  /** Roda depois da cópia e antes da conferência; só os testes passam. */
  readonly antesDeConferir?: (cliente: PoolClient) => Promise<void>;
}

export interface OpcoesDeEscrita {
  readonly ganchosDeTeste?: GanchosDeTeste;
}

export interface ResultadoDeEscrita {
  readonly espaco: string;
  readonly nadaAFazer: boolean;
  readonly copiadas: number;
  readonly apagadas: Readonly<Record<string, number>>;
  readonly conversasDeGrupoQueFicaram: number;
  readonly revisao: number | undefined;
  readonly mensagem: string;
}

export async function guardarCrmAntigo(espaco: string, _opcoes: OpcoesDeEscrita = {}): Promise<ResultadoDeEscrita> {
  return { espaco, nadaAFazer: true, copiadas: 0, apagadas: {}, conversasDeGrupoQueFicaram: 0, revisao: undefined, mensagem: "" };
}

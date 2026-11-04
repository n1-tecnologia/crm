/**
 * A Nota do Contato (3.2.7). Esqueleto do RED: as duas regras ainda aceitam tudo.
 */

import { ok, type OperationResult } from "../state";
import type { Contato } from "./contatos";

export interface NotaDoContato {
  readonly id: string;
  readonly contatoId: string;
  readonly conteudo: string;
  readonly autorId: string;
  readonly criadoEm: string;
}

export interface NovaNota {
  readonly conteudo: string;
}

export function validarNovaNota(entrada: NovaNota): OperationResult<NovaNota> {
  return ok(entrada);
}

export function recusaDeNotaNoContato(_contato: Pick<Contato, "estado">): string | undefined {
  return undefined;
}

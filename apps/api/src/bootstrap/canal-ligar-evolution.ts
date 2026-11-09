/**
 * Esqueleto do RED (16-13): o contrato público do comando, sem a regra. O GREEN o substitui.
 */

import type { Pool } from "pg";
import type { ChavesDoCofre } from "../servicos/cofre";
import type { ClienteDaEvolution } from "../mensageria/provedores/evolution/cliente";

export class RecusaDaLigacao extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "RecusaDaLigacao";
  }
}

export interface ArgumentosDaLigacao {
  readonly canalId: string;
  readonly instancia: string;
  readonly seco: boolean;
  readonly urlPublica?: string;
}

export function lerArgumentos(_argv: readonly string[]): ArgumentosDaLigacao {
  throw new RecusaDaLigacao("não implementado");
}

export interface DependenciasDaLigacao {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly pool: () => Pick<Pool, "connect">;
  readonly chaves: () => ChavesDoCofre;
  readonly criarCliente: (url: string) => ClienteDaEvolution;
  readonly saida: { out(texto: string): void; err(texto: string): void };
}

export async function principal(_argv: readonly string[], _deps: DependenciasDaLigacao): Promise<number> {
  return 1;
}

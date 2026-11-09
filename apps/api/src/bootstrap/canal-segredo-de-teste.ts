/** Esqueleto do RED (16-02, D-16-03): o comando ainda não faz nada. */

import type { Pool } from "pg";
import type { ChavesDoCofre } from "../servicos/cofre";

export class RecusaDoSegredo extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "RecusaDoSegredo";
  }
}

export const USO = "Uso: npm run canal:segredo-de-teste -w @n1/api -- --canal <id>";

export interface ArgumentosDoSegredo {
  readonly canal: string;
}

export function lerArgumentos(_argv: readonly string[]): ArgumentosDoSegredo {
  return { canal: "" };
}

export interface ResultadoDoSegredo {
  readonly segredo: string;
  readonly canalId: string;
  readonly workspaceId: string;
}

export async function gerarSegredoDeTeste(_entrada: {
  readonly pool: Pick<Pool, "connect">;
  readonly chaves: ChavesDoCofre;
  readonly canalId: string;
}): Promise<ResultadoDoSegredo> {
  throw new RecusaDoSegredo("não implementado");
}

export interface DependenciasDoSegredo {
  readonly pool: () => Pick<Pool, "connect">;
  readonly chaves: () => ChavesDoCofre;
  readonly saida: { out(texto: string): void; err(texto: string): void };
}

export async function principal(_argv: readonly string[], _deps: DependenciasDoSegredo): Promise<number> {
  return 1;
}

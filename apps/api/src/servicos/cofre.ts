/**
 * Esqueleto do cofre de credenciais (Fase 9, D-17) - RED do Plan 09-10.
 * A implementação entra no commit seguinte.
 */

import type { PoolClient } from "pg";

export interface ChavesDoCofre {
  readonly atual: { readonly versao: number; readonly chave: Buffer };
  readonly anterior?: { readonly versao: number; readonly chave: Buffer };
}

export interface DonoDaCredencial {
  readonly workspaceId: string;
  readonly donoTipo: "canal" | "integracao";
  readonly donoId: string;
  readonly tipo: string;
}

export interface CredencialCifrada {
  readonly segredoCifrado: Buffer;
  readonly iv: Buffer;
  readonly etiqueta: Buffer;
  readonly versaoDaChave: number;
}

export function lerChavesDoCofre(_env: NodeJS.ProcessEnv = process.env): ChavesDoCofre {
  throw new Error("não implementado");
}

export function cifrar(_texto: string, _chave: Buffer, _versao: number, _dono: DonoDaCredencial): CredencialCifrada {
  throw new Error("não implementado");
}

export function decifrar(_linha: CredencialCifrada, _chaves: ChavesDoCofre, _dono: DonoDaCredencial): string {
  throw new Error("não implementado");
}

export async function guardarCredencial(
  _cliente: Pick<PoolClient, "query">,
  _chaves: ChavesDoCofre,
  _entrada: DonoDaCredencial & { readonly segredo: string },
): Promise<{ readonly id: string }> {
  throw new Error("não implementado");
}

export async function lerCredencial(
  _cliente: Pick<PoolClient, "query">,
  _chaves: ChavesDoCofre,
  _dono: DonoDaCredencial,
): Promise<string | undefined> {
  throw new Error("não implementado");
}

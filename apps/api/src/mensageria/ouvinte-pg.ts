/** Esqueleto (16-07, RED): o ouvinte ainda não abre conexão. */

import type { EventoDoCrm } from "@n1/dominio/crm/eventos";

export interface OpcoesDoOuvinteDoCrm {
  readonly url?: string;
  aoEvento(evento: EventoDoCrm): void;
  aoConectar(): void;
  aoCair(): void;
  readonly registrar?: (nivel: "info" | "warn" | "error", mensagem: string, dados?: Record<string, unknown>) => void;
}

export interface OuvinteDoCrm {
  iniciar(): void;
  parar(): Promise<void>;
  readonly ouvindo: boolean;
}

export function criarOuvinteDoCrm(_opcoes: OpcoesDoOuvinteDoCrm): OuvinteDoCrm {
  return { iniciar() {}, async parar() {}, ouvindo: false };
}

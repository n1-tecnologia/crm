/** Esqueleto do RED (15-27, Task 2). O GREEN troca isto pela implementação. */

import type { EstadoComPasta } from "./formatos-antigos";
import type { ChaveDeRegistro } from "./guardar";

export interface ListaDaPasta {
  readonly id: string;
  readonly nome: string;
  readonly tarefas: number;
}

export interface PlanoDaPasta {
  readonly existe: boolean;
  readonly nome: string | undefined;
  readonly listas: readonly ListaDaPasta[];
  readonly removivel: boolean;
}

export function planejarPasta(_estado: EstadoComPasta): PlanoDaPasta {
  return { existe: false, nome: undefined, listas: [], removivel: false };
}

export function chavesDaPasta(_estado: EstadoComPasta, _plano: PlanoDaPasta): ChaveDeRegistro[] {
  return [];
}

export function removerPasta(_estado: EstadoComPasta, _plano: PlanoDaPasta): void {}

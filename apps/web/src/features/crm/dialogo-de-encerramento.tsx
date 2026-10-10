"use client";

// Esqueleto do RED (07-10 Task 1): compila e não desenha nada. O GREEN o substitui.

import type { EstadoCrm, SituacaoNegocio } from "@n1/dominio/crm/comum";

export type ModoDeEncerramento = "ganhar" | "perder" | "reabrir";

export interface NegocioDoDialogo {
  readonly id: string;
  readonly titulo: string;
  readonly valor: string | null;
  readonly situacao: SituacaoNegocio;
  readonly estado: EstadoCrm;
}

export interface FunilDoDialogo {
  readonly estado: EstadoCrm;
  readonly exigeMotivoPerda: boolean;
  readonly exigeValorGanho: boolean;
}

export interface PropsDoDialogoDeEncerramento {
  readonly modo: ModoDeEncerramento;
  readonly negocio: NegocioDoDialogo;
  readonly funil: FunilDoDialogo;
  readonly etapas?: ReadonlyArray<{ readonly id: string; readonly nome: string }>;
  readonly onClose: () => void;
  readonly onConcluido: () => void;
}

export function DialogoDeEncerramento(_props: PropsDoDialogoDeEncerramento): null {
  return null;
}

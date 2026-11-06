/** Esqueleto do RED (15-27, Task 2). O GREEN troca isto pela implementação. */

import type { FunilAntigo } from "./formatos-antigos";

export type DecisaoDeFunil = "migrar" | "guardar";

export interface EtapaParaInserir {
  readonly idAntigo: string;
  readonly nome: string;
  readonly ordem: number;
  readonly probabilidade: number;
  readonly cor: string | null;
  readonly descricao: string | null;
}

export interface FunilParaInserir {
  readonly id: string;
  readonly nome: string;
  readonly descricao: string | null;
  readonly cor: string | null;
  readonly padrao: boolean;
  readonly privado: boolean;
  readonly exigeMotivoPerda: boolean;
  readonly exigeValorGanho: boolean;
  readonly estado: "ativo" | "arquivado" | "na_lixeira";
  readonly criadoPor: string;
  readonly criadoEm: string | null;
  readonly etapas: readonly EtapaParaInserir[];
}

export interface FunilNaoMigrado {
  readonly id: string;
  readonly nome: string;
  readonly motivo: string;
}

export interface PlanoDeFunis {
  readonly aInserir: readonly FunilParaInserir[];
  readonly naoMigrados: readonly FunilNaoMigrado[];
}

export interface FunilDoCrmNovo {
  readonly id: string;
  readonly nome: string;
  readonly padrao: boolean;
  readonly estado: string;
}

export function planejarFunis(
  _funisAntigos: readonly FunilAntigo[],
  _funisNovosDoEspaco: readonly FunilDoCrmNovo[],
  _decisao: DecisaoDeFunil,
  _preferidoId?: string,
): PlanoDeFunis {
  return { aInserir: [], naoMigrados: [] };
}

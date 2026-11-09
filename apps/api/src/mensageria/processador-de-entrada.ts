/**
 * Esqueleto do RED (16-03, Task 1): o processador existe mas não reivindica nada.
 */

import type { Pool } from "pg";
import type { ChavesDoCofre } from "../servicos/cofre";
import type { ServicoDeRecebimento } from "../servicos/crm/recebimento";
import type { Relogio } from "../testes/relogio";
import type { RegistroDeProvedores } from "./registro";

export interface OpcoesDoProcessadorDeEntrada {
  readonly workerId: string;
  readonly pool?: () => Pool;
  readonly chaves?: ChavesDoCofre;
  readonly registro?: RegistroDeProvedores;
  readonly recebimento?: ServicoDeRecebimento;
  readonly relogio?: Relogio;
  readonly intervaloMs?: number;
  readonly maxTentativas?: number;
  readonly travaVenceEmMs?: number;
  readonly registrar?: (nivel: "info" | "warn" | "error", mensagem: string, dados?: Record<string, unknown>) => void;
}

export interface ProcessadorDeEntrada {
  iniciar(): void;
  parar(): Promise<void>;
  processarUm(): Promise<boolean>;
  acordar(): void;
}

export function criarProcessadorDeEntrada(_opcoes: OpcoesDoProcessadorDeEntrada): ProcessadorDeEntrada {
  return {
    iniciar() {},
    async parar() {},
    async processarUm() {
      return false;
    },
    acordar() {},
  };
}

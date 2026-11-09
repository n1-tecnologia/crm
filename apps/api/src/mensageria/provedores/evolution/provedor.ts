/**
 * ESQUELETO do provedor da Evolution (16-12, Task 1, fase RED): existe só para o teste ponta a ponta
 * compilar e falhar na asserção. A implementação entra no commit seguinte.
 */

import type { ProvedorDeMensageria } from "../../provedor";

export interface OpcoesDoProvedorEvolution {
  readonly url: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

export function criarProvedorEvolution(_opcoes: OpcoesDoProvedorEvolution): ProvedorDeMensageria {
  return {
    provedor: "whatsapp-nao-oficial",
    verificarChamada: () => false,
    interpretarChamada: () => [],
    enviar: async () => ({ ok: false, transitorio: false, codigo: "NAO_IMPLEMENTADO", motivo: "não implementado" }),
    baixarMidia: async () => {
      throw new Error("não implementado");
    },
    estadoDaConexao: async () => "desconectada",
  };
}

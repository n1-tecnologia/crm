/** Esqueleto do RED (14-10): o serviço real entra no commit seguinte. */

import type { Pool } from "pg";
import type { SucessaoNoCrm } from "../../repositorios/crm/sucessao";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import type { ResultadoCrm } from "./resultado";

export interface ServicoDeSucessao {
  previa(membro: MembroDaSessao, membroId: string): Promise<ResultadoCrm<SucessaoNoCrm>>;
}

export function criarServicoDeSucessao(_deps: { readonly pool: () => Pool }): ServicoDeSucessao {
  return {
    async previa() {
      throw new Error("não implementado");
    },
  };
}

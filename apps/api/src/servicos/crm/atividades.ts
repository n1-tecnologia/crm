/**
 * Esqueleto do RED (15-37): só as assinaturas, para o import do teste não ser
 * falha de carga. A implementação vem no GREEN.
 */

import type { Pool } from "pg";
import type { FiltroDeAtividades } from "@n1/dominio/crm/atividades";
import type { ActivityRecord } from "@n1/dominio/types/primitives";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import type { AcessoAoCrm } from "./acesso";
import type { ResultadoCrm } from "./resultado";

export interface ServicoDeAtividades {
  listar(membro: MembroDaSessao, filtro: FiltroDeAtividades): Promise<ResultadoCrm<ActivityRecord[]>>;
}

export function criarServicoDeAtividades(_deps: { readonly pool: () => Pool; readonly acesso: AcessoAoCrm }): ServicoDeAtividades {
  return {
    async listar() {
      throw new Error("nao implementado");
    },
  };
}

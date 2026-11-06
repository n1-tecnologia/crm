/**
 * Serviço de nomes do CRM novo em lote (15-10, UCR-08). ESBOÇO DO RED: a
 * assinatura existe e nenhum nome é resolvido ainda.
 */

import type { Pool } from "pg";
import type { AlvoDoCrm, NomeDoAlvo } from "@n1/dominio/crm/nomes";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import type { AcessoAoCrm } from "./acesso";
import { sucesso, type ResultadoCrm } from "./resultado";

export interface ServicoDeNomes {
  /** Um item por alvo, na ordem pedida; `nome: null` quando o id não é deste Espaço ou o Papel não lê o tipo. */
  nomes(membro: MembroDaSessao, alvos: readonly AlvoDoCrm[]): Promise<ResultadoCrm<readonly NomeDoAlvo[]>>;
}

export function criarServicoDeNomes(_deps: { readonly pool: () => Pool; readonly acesso: AcessoAoCrm }): ServicoDeNomes {
  return {
    async nomes(_membro, alvos) {
      return sucesso(alvos.map((alvo) => ({ ...alvo, nome: null })));
    },
  };
}

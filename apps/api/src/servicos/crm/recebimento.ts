/**
 * Serviço de recebimento (3.6.2, MSG-01): o esqueleto do RED. A regra vem no GREEN.
 */

import type { Pool } from "pg";
import type { Conversa } from "@n1/dominio/crm/conversas";
import type { Mensagem } from "@n1/dominio/crm/mensagens";
import type { RecebidaDoProvedor } from "@n1/dominio/crm/recebimento";
import { recusa, type ResultadoCrm } from "./resultado";

export interface ResultadoDoRecebimento {
  readonly mensagem: Mensagem;
  readonly conversa: Conversa;
  readonly contatoId: string;
  readonly contatoNovo: boolean;
  readonly conversaNova: boolean;
  readonly conversaReaberta: boolean;
  readonly repetida: boolean;
}

export interface ServicoDeRecebimento {
  receberMensagem(workspaceId: string, canalId: string, evento: RecebidaDoProvedor): Promise<ResultadoCrm<ResultadoDoRecebimento>>;
}

export function criarServicoDeRecebimento(_deps: { readonly pool: () => Pool }): ServicoDeRecebimento {
  return {
    async receberMensagem() {
      return recusa<ResultadoDoRecebimento>(409, "não implementado");
    },
  };
}

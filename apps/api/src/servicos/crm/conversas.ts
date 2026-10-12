/**
 * Serviço de Conversas (esqueleto do RED de 08-06): tipos definitivos, métodos
 * que ainda não existem.
 */

import type { Pool } from "pg";
import type { Pagina } from "@n1/dominio/crm/comum";
import type { ConversaDetalhada, FiltroDeConversas, NovaConversa } from "@n1/dominio/crm/conversas";
import type { Conversa } from "@n1/dominio/crm/conversas";
import type { Mensagem } from "@n1/dominio/crm/mensagens";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import type { AcessoAoCrm } from "./acesso";
import type { ResultadoCrm } from "./resultado";

export interface ServicoDeConversas {
  listar(membro: MembroDaSessao, filtro: FiltroDeConversas): Promise<ResultadoCrm<Pagina<Conversa>>>;
  obter(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<ConversaDetalhada>>;
  criar(membro: MembroDaSessao, entrada: NovaConversa): Promise<ResultadoCrm<ConversaDetalhada & { readonly primeiraMensagem: Mensagem }>>;
  resolver(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<ConversaDetalhada>>;
  reabrir(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<ConversaDetalhada>>;
}

const naoImplementada = (nome: string): never => {
  throw new Error(`${nome}: ainda não implementada`);
};

export function criarServicoDeConversas(_deps: { readonly pool: () => Pool; readonly acesso: AcessoAoCrm }): ServicoDeConversas {
  return {
    listar: () => naoImplementada("listar"),
    obter: () => naoImplementada("obter"),
    criar: () => naoImplementada("criar"),
    resolver: () => naoImplementada("resolver"),
    reabrir: () => naoImplementada("reabrir"),
  };
}

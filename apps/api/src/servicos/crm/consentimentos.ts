/**
 * ESQUELETO do RED (14-08): o serviço de consentimento ainda não tem a regra.
 */

import type { Pool } from "pg";
import type { Pagina } from "@n1/dominio/crm/comum";
import type { ConsentimentoDoContato, NovoConsentimento } from "@n1/dominio/crm/consentimentos";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import type { AcessoAoCrm } from "./acesso";
import { recusa, type ResultadoCrm } from "./resultado";

export interface ServicoDeConsentimentos {
  listar(membro: MembroDaSessao, contatoId: string): Promise<ResultadoCrm<Pagina<ConsentimentoDoContato>>>;
  registrar(membro: MembroDaSessao, contatoId: string, entrada: NovoConsentimento): Promise<ResultadoCrm<ConsentimentoDoContato>>;
}

export function criarServicoDeConsentimentos(_deps: { readonly pool: () => Pool; readonly acesso: AcessoAoCrm }): ServicoDeConsentimentos {
  return {
    listar: async () => recusa<never>(404, "Ainda não implementado."),
    registrar: async () => recusa<never>(404, "Ainda não implementado."),
  };
}

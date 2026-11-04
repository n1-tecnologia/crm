/**
 * Serviço de Notas do Contato (14-06). Esqueleto do RED: nada é gravado nem lido.
 */

import type { Pool } from "pg";
import type { Pagina } from "@n1/dominio/crm/comum";
import type { NotaDoContato, NovaNota } from "@n1/dominio/crm/notas";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import type { AcessoAoCrm } from "./acesso";
import { recusa, type ResultadoCrm } from "./resultado";

export interface ServicoDeNotas {
  listar(
    membro: MembroDaSessao,
    contatoId: string,
    pagina: { readonly limite: number; readonly deslocamento: number },
  ): Promise<ResultadoCrm<Pagina<NotaDoContato>>>;
  adicionar(membro: MembroDaSessao, contatoId: string, entrada: NovaNota): Promise<ResultadoCrm<NotaDoContato>>;
}

export function criarServicoDeNotas(_deps: { readonly pool: () => Pool; readonly acesso: AcessoAoCrm }): ServicoDeNotas {
  const naoFeito = async () => recusa<never>(404, "Ainda não implementado.");
  return { listar: naoFeito, adicionar: naoFeito };
}

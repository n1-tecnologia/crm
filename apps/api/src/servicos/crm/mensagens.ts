/** Esqueleto da RED de 08-12 (Task 2): só a forma do serviço; a regra vem no GREEN. */

import type { Pool } from "pg";
import type { Pagina } from "@n1/dominio/crm/comum";
import type { Mensagem, MensagemRecebidaDoProvedor, NovaMensagem } from "@n1/dominio/crm/mensagens";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import type { AcessoAoCrm } from "./acesso";
import type { ResultadoCrm } from "./resultado";

export interface ServicoDeMensagens {
  listar(membro: MembroDaSessao, filtro: { readonly conversaId: string; readonly limite: number; readonly deslocamento: number }): Promise<ResultadoCrm<Pagina<Mensagem>>>;
  enviar(membro: MembroDaSessao, entrada: NovaMensagem): Promise<ResultadoCrm<Mensagem>>;
  registrarRecebida(workspaceId: string, entrada: MensagemRecebidaDoProvedor): Promise<ResultadoCrm<{ readonly mensagem: Mensagem; readonly repetida: boolean }>>;
}

export function criarServicoDeMensagens(_deps: { readonly pool: () => Pool; readonly acesso: AcessoAoCrm }): ServicoDeMensagens {
  const naoImplementado = (): never => {
    throw new Error("não implementado");
  };
  return { listar: naoImplementado, enviar: naoImplementado, registrarRecebida: naoImplementado };
}

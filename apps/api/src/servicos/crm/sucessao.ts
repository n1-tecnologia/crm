/**
 * A prévia da sucessão de um Membro nas tabelas do CRM (14-10, 3.2.8): quantos
 * Contatos, Empresas e Negócios passam ao Sucessor e quantas Conversas ficam sem
 * Atribuído (RN-ET-09 a e b) se ele for removido. Só números: a tela mostra o
 * que a remoção vai mudar ANTES de pedi-la (B28).
 *
 * O Papel de quem pede é lido do banco e conferido ANTES de olhar o Membro
 * pedido: quem não é Administrador nem Proprietário ativo recebe 403 mesmo
 * para um id que não existe, então não descobre quem é Membro (T-14-26). O Membro
 * pedido tem de existir NESTE Espaço (404 senão); a consulta é escopada por
 * `workspace_id`, e nada de outro Espaço entra na conta.
 *
 * Não usa `exigir`/`podeNoCrm`: a sucessão não é um recurso do CRM com ação por
 * Papel, é a mesma regra de `removeMember` (Administrador ou Proprietário ativo).
 */

import type { Pool } from "pg";
import { ehAdministracao } from "@n1/dominio/crm/permissoes";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { papelDoMembro } from "../../repositorios/crm/membros";
import { contarDoMembro, type SucessaoNoCrm } from "../../repositorios/crm/sucessao";
import { recusa, sucesso, type ResultadoCrm } from "./resultado";

export interface ServicoDeSucessao {
  /** As contagens do Membro `membroId` neste Espaço. */
  previa(membro: MembroDaSessao, membroId: string): Promise<ResultadoCrm<SucessaoNoCrm>>;
}

export function criarServicoDeSucessao(deps: { readonly pool: () => Pool }): ServicoDeSucessao {
  return {
    async previa(membro, membroId) {
      const cliente = deps.pool();
      const quemPede = await papelDoMembro(cliente, membro.workspaceId, membro.id);
      if (!ehAdministracao(quemPede?.base) || quemPede?.estado !== "ativo") {
        return recusa<SucessaoNoCrm>(403, "Só um Administrador ou o Proprietário ativo vê a sucessão de um Membro.", { codigo: "PERMISSAO" });
      }
      if (!(await papelDoMembro(cliente, membro.workspaceId, membroId))) {
        return recusa<SucessaoNoCrm>(404, "Membro não encontrado neste Espaço de Trabalho.", { codigo: "MEMBRO_NAO_ENCONTRADO" });
      }
      return sucesso(await contarDoMembro(cliente, membro.workspaceId, membroId));
    },
  };
}

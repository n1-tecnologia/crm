/**
 * Serviço de Contatos: a regra entre a rota e o repositório.
 *
 * O Espaço de Trabalho e o autor vêm SEMPRE de `membro` (a sessão) — nada que
 * chegue no corpo os substitui (D-10, T-07-01/T-07-02). Sem Proprietário
 * informado, o Proprietário e o `criado_por` são o Membro da sessão (D-11, o
 * padrão); a troca por outro Membro ativo chega em 07-02.
 */

import type { Pool } from "pg";
import type { EstadoCrm, Pagina } from "@n1/dominio/crm/comum";
import { validarContato, type ContatoDetalhado, type ContatoResumo, type NovoContato } from "@n1/dominio/crm/contatos";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { criarRepositorioDeContatosPg } from "../../repositorios/crm/contatos";
import { recusa, sucesso, type ResultadoCrm } from "./resultado";

export interface FiltroDeContatos {
  readonly estado: EstadoCrm;
  readonly q?: string | undefined;
  readonly limite: number;
  readonly deslocamento: number;
}

export interface ServicoDeContatos {
  listar(membro: MembroDaSessao, filtro: FiltroDeContatos): Promise<ResultadoCrm<Pagina<ContatoResumo>>>;
  criar(membro: MembroDaSessao, entrada: NovoContato): Promise<ResultadoCrm<ContatoDetalhado>>;
}

export function criarServicoDeContatos(deps: { readonly pool: () => Pool }): ServicoDeContatos {
  return {
    async listar(membro, filtro) {
      const repositorio = criarRepositorioDeContatosPg(deps.pool());
      return sucesso(
        await repositorio.listar(membro.workspaceId, {
          estado: filtro.estado,
          limite: filtro.limite,
          deslocamento: filtro.deslocamento,
        }),
      );
    },

    async criar(membro, entrada) {
      const validacao = validarContato(entrada);
      if (!validacao.ok) {
        return recusa(409, validacao.error, {
          codigo: "CONTATO_SEM_NOME_NEM_IDENTIFICADOR",
          ...(validacao.field !== undefined ? { campo: validacao.field } : {}),
        });
      }
      const repositorio = criarRepositorioDeContatosPg(deps.pool());
      const { identificadores: _identificadores, proprietarioId: _proprietarioId, ...campos } = entrada;
      const contato = await repositorio.inserir(membro.workspaceId, {
        ...campos,
        proprietarioId: membro.id,
        criadoPor: membro.id,
      });
      return sucesso({ contato, identificadores: [], vinculos: [] });
    },
  };
}

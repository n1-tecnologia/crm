/**
 * Serviço de Contatos: a regra entre a rota e o repositório.
 *
 * O Espaço de Trabalho e o autor vêm SEMPRE de `membro` (a sessão) — nada que
 * chegue no corpo os substitui (D-10, T-07-01/T-07-02). O Papel é exigido
 * ANTES de ler ou escrever (D-14). Sem Proprietário informado, o Proprietário
 * é o Membro da sessão; informado, tem de ser Membro ativo do mesmo Espaço
 * (D-11). O `criado_por` é sempre o Membro da sessão.
 */

import type { Pool } from "pg";
import type { EstadoCrm, Pagina } from "@n1/dominio/crm/comum";
import {
  validarContato,
  type ContatoDetalhado,
  type ContatoResumo,
  type EdicaoDeContato,
  type EdicaoDeIdentificador,
  type NovoContato,
  type NovoIdentificadorDeContato,
} from "@n1/dominio/crm/contatos";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { criarRepositorioDeContatosPg } from "../../repositorios/crm/contatos";
import { exigir, resolverProprietario, type AcessoAoCrm } from "./acesso";
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
  obter(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<ContatoDetalhado>>;
  editar(membro: MembroDaSessao, id: string, entrada: EdicaoDeContato): Promise<ResultadoCrm<ContatoDetalhado>>;
  adicionarIdentificador(
    membro: MembroDaSessao,
    id: string,
    entrada: NovoIdentificadorDeContato,
  ): Promise<ResultadoCrm<ContatoDetalhado>>;
  editarIdentificador(
    membro: MembroDaSessao,
    id: string,
    identificadorId: string,
    entrada: EdicaoDeIdentificador,
  ): Promise<ResultadoCrm<ContatoDetalhado>>;
  removerIdentificador(membro: MembroDaSessao, id: string, identificadorId: string): Promise<ResultadoCrm<ContatoDetalhado>>;
  arquivar(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<ContatoDetalhado>>;
  restaurar(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<ContatoDetalhado>>;
  enviarParaLixeira(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<ContatoDetalhado>>;
  excluirPermanentemente(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<{ readonly id: string }>>;
}

// Esqueleto do RED (07-03): compila e erra. O GREEN o substitui.
const pendente = async <T>(): Promise<ResultadoCrm<T>> => recusa(404, "pendente");

export function criarServicoDeContatos(deps: {
  readonly pool: () => Pool;
  readonly acesso: AcessoAoCrm;
}): ServicoDeContatos {
  return {
    async listar(membro, filtro) {
      const negado = await exigir(deps.acesso, membro, "ler", "contato");
      if (negado) return { ok: false, ...negado };
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
      const negado = await exigir(deps.acesso, membro, "criar", "contato");
      if (negado) return { ok: false, ...negado };
      const validacao = validarContato(entrada);
      if (!validacao.ok) {
        return recusa(409, validacao.error, {
          codigo: "CONTATO_SEM_NOME_NEM_IDENTIFICADOR",
          ...(validacao.field !== undefined ? { campo: validacao.field } : {}),
        });
      }
      const proprietario = await resolverProprietario(deps.acesso, membro, entrada.proprietarioId);
      if (!proprietario.ok) return proprietario;
      const repositorio = criarRepositorioDeContatosPg(deps.pool());
      const { identificadores: _identificadores, proprietarioId: _proprietarioId, ...campos } = entrada;
      const contato = await repositorio.inserir(membro.workspaceId, {
        ...campos,
        proprietarioId: proprietario.valor,
        criadoPor: membro.id,
      });
      return sucesso({ contato, identificadores: [], vinculos: [] });
    },

    obter: () => pendente(),
    editar: () => pendente(),
    adicionarIdentificador: () => pendente(),
    editarIdentificador: () => pendente(),
    removerIdentificador: () => pendente(),
    arquivar: () => pendente(),
    restaurar: () => pendente(),
    enviarParaLixeira: () => pendente(),
    excluirPermanentemente: () => pendente(),
  };
}

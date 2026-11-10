/**
 * Serviço de Notas do Contato (14-06, 3.2.7): a regra entre a rota e o repositório.
 *
 * O Espaço de Trabalho e o autor vêm SEMPRE de `membro` (a sessão) — nada que
 * chegue no corpo os substitui (T-14-13). O Papel é exigido ANTES de ler o
 * Contato ou validar o corpo: um Convidado nunca descobre se a nota era válida.
 * O Contato tem de existir NESTE Espaço (404 senão, T-14-14); a nota só entra
 * em Contato `ativo` ou `arquivado` (`recusaDeNotaNoContato`).
 *
 * O Contato é lido travado na transação de `adicionar`: a mesclagem (14-09)
 * também o trava, então uma nota não escapa para um Contato que acabou de ser
 * absorvido. O `conteudo` da nota é dado pessoal e nunca é logado (T-14-15).
 *
 * A nota grava a sua Atividade ("Nota registrada no Contato", 012) no mesmo
 * commit, sem o conteúdo (15-04). Ligar o fio da Caixa e a Reunião a estas notas
 * é a Fase 15 (3.4.2 e 3.4.5).
 */

import type { Pool, PoolClient } from "pg";
import type { Pagina } from "@n1/dominio/crm/comum";
import { ACOES_DO_CRM } from "@n1/dominio/crm/atividades";
import { nomeDeExibicaoDoContato } from "@n1/dominio/crm/contatos";
import { recusaDeNotaNoContato, validarNovaNota, type NotaDoContato, type NovaNota } from "@n1/dominio/crm/notas";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { registrarAtividade } from "../../repositorios/crm/atividades";
import { criarRepositorioDeContatosPg } from "../../repositorios/crm/contatos";
import { criarRepositorioDeNotasPg } from "../../repositorios/crm/notas";
import { exigir, type AcessoAoCrm } from "./acesso";
import { recusa, sucesso, type ResultadoCrm } from "./resultado";
import { comTransacao } from "./transacao";

export interface ServicoDeNotas {
  /** As notas do Contato, a mais recente primeiro. */
  listar(
    membro: MembroDaSessao,
    contatoId: string,
    pagina: { readonly limite: number; readonly deslocamento: number },
  ): Promise<ResultadoCrm<Pagina<NotaDoContato>>>;
  /** Grava a nota com o Membro da sessão como autor. */
  adicionar(membro: MembroDaSessao, contatoId: string, entrada: NovaNota): Promise<ResultadoCrm<NotaDoContato>>;
}

const contatoNaoEncontrado = () => recusa<never>(404, "Contato não encontrado.", { codigo: "CONTATO_NAO_ENCONTRADO" });

export function criarServicoDeNotas(deps: { readonly pool: () => Pool; readonly acesso: AcessoAoCrm }): ServicoDeNotas {
  return {
    async listar(membro, contatoId, pagina) {
      const negado = await exigir(deps.acesso, membro, "ler", "contato");
      if (negado) return { ok: false, ...negado };
      const cliente = deps.pool();
      const contato = await criarRepositorioDeContatosPg(cliente).obter(membro.workspaceId, contatoId);
      if (!contato) return contatoNaoEncontrado();
      // O Contato `mesclado` e o da lixeira continuam legíveis: o histórico não some com o estado.
      return sucesso(await criarRepositorioDeNotasPg(cliente).listar(membro.workspaceId, contatoId, pagina));
    },

    async adicionar(membro, contatoId, entrada) {
      const negado = await exigir(deps.acesso, membro, "editar", "contato");
      if (negado) return { ok: false, ...negado };

      const validacao = validarNovaNota(entrada);
      if (!validacao.ok) {
        return recusa<never>(400, validacao.error, {
          codigo: "VALOR_INVALIDO",
          ...(validacao.field !== undefined ? { campo: validacao.field } : {}),
        });
      }

      return comTransacao(deps.pool, async (cliente: PoolClient) => {
        const contato = await criarRepositorioDeContatosPg(cliente).obter(membro.workspaceId, contatoId, { travar: true });
        if (!contato) return contatoNaoEncontrado();
        const frase = recusaDeNotaNoContato(contato);
        if (frase !== undefined) return recusa<never>(409, frase, { codigo: "NOTA_RECUSADA" });
        // O autor é o Membro da sessão, nunca um campo do corpo (T-14-13).
        const nota = await criarRepositorioDeNotasPg(cliente).inserir(membro.workspaceId, contatoId, validacao.value.conteudo, membro.id);
        // A Atividade entra no MESMO commit da nota (D-15-09, UCR-03). O conteúdo da nota é dado
        // pessoal e não vai para `detalhe` (T-14-15, T-15-14); o ator é o Membro da sessão (T-15-13).
        await registrarAtividade(cliente, membro.workspaceId, {
          ator: { kind: "member", id: membro.id },
          acao: ACOES_DO_CRM.notaRegistrada,
          objetoTipo: "contact",
          objetoId: contatoId,
          objetoNome: nomeDeExibicaoDoContato(contato),
        });
        return sucesso(nota);
      });
    },
  };
}

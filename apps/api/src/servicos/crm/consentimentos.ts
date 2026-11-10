/**
 * Serviço de Consentimentos do Contato (14-08, 3.2.4): a regra entre a rota e o repositório.
 *
 * O Espaço de Trabalho e o registrador vêm SEMPRE de `membro` (a sessão) — nada
 * que chegue no corpo os substitui (T-14-19). O Papel é exigido ANTES de ler o
 * Contato ou validar o corpo: um Convidado nunca descobre se o consentimento
 * era válido. O Contato tem de existir NESTE Espaço (404 senão, T-14-20).
 *
 * O consentimento é só inserção: revogar é registrar um `revogado`. A finalidade
 * é conferida no Catálogo do Espaço (em `plataforma.registros`, OQ7) e a
 * evidência, quando vem, tem de ser Mensagem de uma Conversa deste Contato
 * neste Espaço. Contato `mesclado` (RN-CON-14) e o da lixeira não recebem
 * consentimento novo; o arquivado recebe, como recebe Nota e Negócio.
 *
 * O Contato é lido travado em `registrar`: a mesclagem (14-09) também o trava,
 * então um consentimento não escapa para um Contato que acabou de ser absorvido.
 * Nada do que chega no corpo é escrito em log (T-14-21).
 */

import type { Pool, PoolClient } from "pg";
import type { Pagina } from "@n1/dominio/crm/comum";
import { ACOES_DO_CRM } from "@n1/dominio/crm/atividades";
import { nomeDeExibicaoDoContato } from "@n1/dominio/crm/contatos";
import { validarNovoConsentimento, type ConsentimentoDoContato, type NovoConsentimento } from "@n1/dominio/crm/consentimentos";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { registrarAtividade } from "../../repositorios/crm/atividades";
import { criarRepositorioDeConsentimentosPg } from "../../repositorios/crm/consentimentos";
import { criarRepositorioDeContatosPg } from "../../repositorios/crm/contatos";
import { nomeDaFinalidadeAtiva } from "../../repositorios/crm/referencias";
import { exigir, type AcessoAoCrm } from "./acesso";
import { recusa, sucesso, type ResultadoCrm } from "./resultado";
import { comTransacao } from "./transacao";

export interface ServicoDeConsentimentos {
  /** O histórico do Contato, o mais recente primeiro; o vigente a tela calcula com `consentimentoVigente`. */
  listar(membro: MembroDaSessao, contatoId: string): Promise<ResultadoCrm<Pagina<ConsentimentoDoContato>>>;
  /** Grava a decisão com o Membro da sessão como registrador. Revogar é registrar `revogado`. */
  registrar(membro: MembroDaSessao, contatoId: string, entrada: NovoConsentimento): Promise<ResultadoCrm<ConsentimentoDoContato>>;
}

const contatoNaoEncontrado = () => recusa<never>(404, "Contato não encontrado.", { codigo: "CONTATO_NAO_ENCONTRADO" });

const valorInvalido = (error: string, campo: string) => recusa<never>(400, error, { codigo: "VALOR_INVALIDO", campo });

export function criarServicoDeConsentimentos(deps: { readonly pool: () => Pool; readonly acesso: AcessoAoCrm }): ServicoDeConsentimentos {
  return {
    async listar(membro, contatoId) {
      const negado = await exigir(deps.acesso, membro, "ler", "contato");
      if (negado) return { ok: false, ...negado };
      const cliente = deps.pool();
      const contato = await criarRepositorioDeContatosPg(cliente).obter(membro.workspaceId, contatoId);
      if (!contato) return contatoNaoEncontrado();
      // O Contato `mesclado` e o da lixeira continuam legíveis: o histórico não some com o estado.
      const itens = await criarRepositorioDeConsentimentosPg(cliente).listarDoContato(membro.workspaceId, contatoId);
      return sucesso({ itens, total: itens.length });
    },

    async registrar(membro, contatoId, entrada) {
      const negado = await exigir(deps.acesso, membro, "editar", "contato");
      if (negado) return { ok: false, ...negado };

      const validacao = validarNovoConsentimento(entrada, new Date().toISOString());
      if (!validacao.ok) return valorInvalido(validacao.error, validacao.field ?? "consentimento");
      const novo = validacao.value;

      return comTransacao(deps.pool, async (cliente: PoolClient) => {
        const contato = await criarRepositorioDeContatosPg(cliente).obter(membro.workspaceId, contatoId, { travar: true });
        if (!contato) return contatoNaoEncontrado();
        if (contato.estado === "mesclado") {
          return recusa<never>(409, "Um Contato mesclado é somente leitura. Registre o consentimento no Contato que ficou.", {
            codigo: "CONSENTIMENTO_RECUSADO",
          });
        }
        if (contato.estado === "na_lixeira") {
          return recusa<never>(409, "Este Contato está na lixeira. Restaure-o antes de registrar o consentimento.", {
            codigo: "CONSENTIMENTO_RECUSADO",
          });
        }

        const finalidade = await nomeDaFinalidadeAtiva(cliente, membro.workspaceId, novo.finalidadeId);
        if (finalidade === undefined) {
          return valorInvalido("A finalidade escolhida não existe neste Espaço de Trabalho.", "finalidadeId");
        }
        const consentimentos = criarRepositorioDeConsentimentosPg(cliente);
        if (
          novo.evidenciaMensagemId !== undefined &&
          !(await consentimentos.mensagemEhDoContato(membro.workspaceId, contatoId, novo.evidenciaMensagemId))
        ) {
          return valorInvalido("A Mensagem de evidência precisa ser de uma Conversa deste Contato.", "evidenciaMensagemId");
        }

        // O registrador é o Membro da sessão, nunca um campo do corpo (T-14-19).
        const registrado = await consentimentos.inserir(membro.workspaceId, contatoId, novo, membro.id);
        // A Atividade leva a finalidade, o tipo de Canal e a decisão. A evidência (Mensagem) e o texto
        // dela são dado pessoal e ficam de fora (T-15-27).
        await registrarAtividade(cliente, membro.workspaceId, {
          ator: { kind: "member", id: membro.id },
          acao: ACOES_DO_CRM.consentimentoRegistrado,
          objetoTipo: "contact",
          objetoId: contatoId,
          objetoNome: nomeDeExibicaoDoContato(contato),
          detalhe: `${finalidade} (${novo.tipoDeCanal}): ${novo.decisao}`,
        });
        return sucesso(registrado);
      });
    },
  };
}

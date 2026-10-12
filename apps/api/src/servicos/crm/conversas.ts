/**
 * Serviço de Conversas (08-06): a regra entre a rota e os repositórios.
 *
 * O Espaço de Trabalho e o autor vêm SEMPRE de `membro` (a sessão) — nada que
 * chegue no corpo os substitui (T-08-26). A Conversa nasce atribuída ao Membro
 * que a abriu e criada por ele; `situacao` e `estado` são defaults da 008.
 *
 * Abrir uma Conversa é uma transação só (INV-CXE-05): o Canal, o Contato e o
 * Identificador do tipo que o Canal resolve são conferidos, a Conversa é
 * inserida e a primeira Mensagem vai no MESMO `PoolClient`. Se a Mensagem
 * falha, o `rollback` leva a Conversa junto.
 *
 * Regras de produto aplicadas aqui:
 *   - B69: a primeira Mensagem nasce `enviada` num Canal `conectada` e
 *     `pendente` num Canal fora do ar; nada é descartado (`statusInicialDeEnvio`).
 *   - INV-CXE-03 / ontologia 12.4: uma Conversa aberta ou pendente por
 *     (Contato, Canal). O mesmo Contato conversa em outro Canal do mesmo tipo
 *     (ontologia 20.6: dois WhatsApps).
 *   - RN-CXE-21 / Pitfall 8: o Contato precisa de Identificador do tipo que o
 *     Canal resolve (`TIPO_DE_IDENTIFICADOR_DO_CANAL`); `telefone` não é WhatsApp.
 *   - A4.5: resolver e reabrir; a decisão da transição é do domínio
 *     (`proximaSituacao`), o serviço só a grava.
 *
 * O Papel é exigido ANTES de qualquer leitura ou transação (T-08-27) e a
 * validação de forma roda antes de abrir a transação. O `conteudo` da Mensagem
 * nunca é logado (T-08-29). O `SQLSTATE` traduzido por `FRASES` é a rede contra
 * a corrida da unicidade do par; a frase não carrega o nome do constraint.
 */

import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { Pagina } from "@n1/dominio/crm/comum";
import {
  proximaSituacao,
  TIPO_DE_IDENTIFICADOR_DO_CANAL,
  tituloDaConversa,
  validarNovaConversa,
  type AcaoDeSituacao,
  type Conversa,
  type ConversaDetalhada,
  type FiltroDeConversas,
  type NovaConversa,
  type ParticipanteDaConversa,
} from "@n1/dominio/crm/conversas";
import { statusInicialDeEnvio, type Mensagem } from "@n1/dominio/crm/mensagens";
import type { Canal } from "@n1/dominio/crm/canais";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { criarRepositorioDeCanaisPg } from "../../repositorios/crm/canais";
import { criarRepositorioDeContatosPg } from "../../repositorios/crm/contatos";
import { criarRepositorioDeConversasPg } from "../../repositorios/crm/conversas";
import { criarRepositorioDeMensagensPg } from "../../repositorios/crm/mensagens";
import { exigir, type AcessoAoCrm } from "./acesso";
import { recusa, sucesso, type ResultadoCrm } from "./resultado";
import { comTransacao, type FrasesDeRestricao } from "./transacao";

export interface ServicoDeConversas {
  listar(membro: MembroDaSessao, filtro: FiltroDeConversas): Promise<ResultadoCrm<Pagina<Conversa>>>;
  obter(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<ConversaDetalhada>>;
  criar(
    membro: MembroDaSessao,
    entrada: NovaConversa,
  ): Promise<ResultadoCrm<ConversaDetalhada & { readonly primeiraMensagem: Mensagem }>>;
  resolver(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<ConversaDetalhada>>;
  reabrir(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<ConversaDetalhada>>;
}

const FRASE_JA_ABERTA = "Este Contato já tem uma Conversa aberta neste Canal.";

/** Rede contra corrida: o constraint que segurou vira esta frase, sem o nome dele. */
const FRASES: FrasesDeRestricao = {
  conversas_nao_resolvida_uq: { codigo: "CONVERSA_JA_ABERTA", error: FRASE_JA_ABERTA },
};

const conversaNaoEncontrada = () => recusa<never>(404, "Conversa não encontrada.", { codigo: "CONVERSA_NAO_ENCONTRADA" });

const canalNaoEncontrado = () =>
  recusa<never>(404, "Canal não encontrado.", { codigo: "CANAL_NAO_ENCONTRADO", campo: "canalId" });

const contatoNaoEncontrado = () =>
  recusa<never>(404, "Contato não encontrado.", { codigo: "CONTATO_NAO_ENCONTRADO", campo: "contatoId" });

/** Valor mal formado (Mensagem vazia): 400 com o campo, para a tela marcar o `Field`. */
function valorInvalido(falha: { readonly error: string; readonly field?: string | undefined }) {
  return recusa<never>(400, falha.error, { codigo: "VALOR_INVALIDO", ...(falha.field !== undefined ? { campo: falha.field } : {}) });
}

const transicaoInvalida = (error: string) => recusa<never>(409, error, { codigo: "TRANSICAO_INVALIDA" });

/** 409 com a Conversa que já ocupa o par, para a tela levar a pessoa até ela. */
function jaAberta(existente: Pick<Conversa, "id" | "titulo">) {
  return recusa<never>(409, FRASE_JA_ABERTA, {
    codigo: "CONVERSA_JA_ABERTA",
    bloqueios: { conversas: { total: 1, itens: [{ id: existente.id, titulo: existente.titulo }] } },
  });
}

/** O resumo do Canal que a tela mostra junto da Conversa. */
function resumoDoCanal(canal: Canal): ConversaDetalhada["canal"] {
  return {
    id: canal.id,
    nome: canal.nome,
    tipo: canal.tipo,
    provedor: canal.provedor,
    conexao: canal.conexao,
    conexaoSimulada: canal.conexaoSimulada,
  };
}

export function criarServicoDeConversas(deps: { readonly pool: () => Pool; readonly acesso: AcessoAoCrm }): ServicoDeConversas {
  /** Resolver e reabrir: Papel, depois a Conversa travada NESTE Espaço, depois a transição. */
  async function mudarSituacao(membro: MembroDaSessao, id: string, acao: AcaoDeSituacao): Promise<ResultadoCrm<ConversaDetalhada>> {
    const negado = await exigir(deps.acesso, membro, acao === "resolver" ? "resolver" : "reabrir", "conversa");
    if (negado) return { ok: false, ...negado };

    return comTransacao(
      deps.pool,
      async (cliente: PoolClient) => {
        const conversas = criarRepositorioDeConversasPg(cliente);
        const atual = await conversas.obter(membro.workspaceId, id, { travar: true });
        if (!atual) return conversaNaoEncontrada();

        const proxima = proximaSituacao(atual, acao);
        if (!proxima.ok) return transicaoInvalida(proxima.error);

        if (acao === "reabrir") {
          const ocupante = await conversas.abertaDoPar(membro.workspaceId, atual.contatoId, atual.canalId);
          if (ocupante && ocupante.id !== atual.id) return jaAberta(ocupante);
        }

        const atualizada = await conversas.definirSituacao(membro.workspaceId, id, proxima.value.situacao);
        if (!atualizada) return conversaNaoEncontrada();
        const canal = await criarRepositorioDeCanaisPg(cliente).obter(membro.workspaceId, atualizada.canalId);
        if (!canal) return canalNaoEncontrado();
        return sucesso({ conversa: atualizada, canal: resumoDoCanal(canal) });
      },
      FRASES,
    );
  }

  return {
    async listar(membro, filtro) {
      const negado = await exigir(deps.acesso, membro, "ler", "conversa");
      if (negado) return { ok: false, ...negado };
      return sucesso(await criarRepositorioDeConversasPg(deps.pool()).listar(membro.workspaceId, filtro));
    },

    async obter(membro, id) {
      const negado = await exigir(deps.acesso, membro, "ler", "conversa");
      if (negado) return { ok: false, ...negado };
      const pool = deps.pool();
      const conversa = await criarRepositorioDeConversasPg(pool).obter(membro.workspaceId, id);
      if (!conversa) return conversaNaoEncontrada();
      const canal = await criarRepositorioDeCanaisPg(pool).obter(membro.workspaceId, conversa.canalId);
      if (!canal) return conversaNaoEncontrada();
      return sucesso({ conversa, canal: resumoDoCanal(canal) });
    },

    async criar(membro, entrada) {
      const negado = await exigir(deps.acesso, membro, "criar", "conversa");
      if (negado) return { ok: false, ...negado };

      const validacao = validarNovaConversa(entrada);
      if (!validacao.ok) return valorInvalido(validacao);

      return comTransacao(
        deps.pool,
        async (cliente: PoolClient) => {
          const canal = await criarRepositorioDeCanaisPg(cliente).obter(membro.workspaceId, entrada.canalId);
          if (!canal) return canalNaoEncontrado();
          if (canal.estado === "arquivado") {
            return recusa<never>(409, "Um Canal arquivado não abre Conversa. Escolha outro Canal.", {
              codigo: "CANAL_ARQUIVADO",
              campo: "canalId",
            });
          }

          const contatos = criarRepositorioDeContatosPg(cliente);
          const contato = await contatos.obter(membro.workspaceId, entrada.contatoId);
          if (!contato) return contatoNaoEncontrado();
          if (contato.estado !== "ativo") {
            return recusa<never>(409, "Só um Contato ativo abre Conversa.", { codigo: "CONTATO_INATIVO", campo: "contatoId" });
          }

          // O Identificador do tipo que o Canal resolve; o principal vem primeiro.
          const tipoDoIdentificador = TIPO_DE_IDENTIFICADOR_DO_CANAL[canal.tipo];
          const doTipo = (await contatos.listarIdentificadores(membro.workspaceId, contato.id)).filter(
            (identificador) => identificador.tipo === tipoDoIdentificador,
          );
          const identificador = doTipo.find((candidato) => candidato.principal) ?? doTipo[0];
          if (!identificador) {
            return recusa<never>(409, `Este Contato não tem ${rotuloDoIdentificador(tipoDoIdentificador)} para conversar por este Canal.`, {
              codigo: "CONTATO_SEM_IDENTIFICADOR_DO_CANAL",
              campo: "contatoId",
            });
          }

          const conversas = criarRepositorioDeConversasPg(cliente);
          const existente = await conversas.abertaDoPar(membro.workspaceId, contato.id, canal.id);
          if (existente) return jaAberta(existente);

          const agora = new Date().toISOString();
          const participantes: ParticipanteDaConversa[] = [
            { id: randomUUID(), sujeito: { tipo: "contato", id: contato.id }, papel: "contato", principal: true, entrouEm: agora, saiuEm: null },
            { id: randomUUID(), sujeito: { tipo: "membro", id: membro.id }, papel: "atendente", principal: false, entrouEm: agora, saiuEm: null },
          ];
          const conversa = await conversas.inserir(membro.workspaceId, {
            canalId: canal.id,
            contatoId: contato.id,
            titulo: tituloDaConversa(contato, identificador.valorExibido ?? identificador.valor),
            filaId: canal.filaPadraoId,
            atribuido: { tipo: "membro", id: membro.id },
            participantes,
            criadoPor: { tipo: "member", id: membro.id },
          });

          const primeiraMensagem = await criarRepositorioDeMensagensPg(cliente).inserir(membro.workspaceId, {
            conversaId: conversa.id,
            canalId: canal.id,
            direcao: "enviada",
            ator: { tipo: "member", id: membro.id },
            conteudo: entrada.mensagem.conteudo,
            statusEntrega: statusInicialDeEnvio(canal.conexao),
          });

          return sucesso({ conversa, canal: resumoDoCanal(canal), primeiraMensagem });
        },
        FRASES,
      );
    },

    resolver: (membro, id) => mudarSituacao(membro, id, "resolver"),

    reabrir: (membro, id) => mudarSituacao(membro, id, "reabrir"),
  };
}

function rotuloDoIdentificador(tipo: string): string {
  switch (tipo) {
    case "whatsapp":
      return "um WhatsApp cadastrado";
    case "email":
      return "um e-mail cadastrado";
    case "instagram":
      return "um Instagram cadastrado";
    default:
      return "um Identificador deste tipo";
  }
}

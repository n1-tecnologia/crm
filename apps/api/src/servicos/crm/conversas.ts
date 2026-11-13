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
 *   - B69 + 3.7.1 (MSG-02): a primeira Mensagem nasce SEMPRE `pendente`
 *     (`statusInicialDeEnvio`: só o provedor diz que saiu). Num Canal `conectada` ela entra
 *     na fila de saída (`enfileirarEnvio`, no MESMO `PoolClient`, e a Tarefa conversacional
 *     herda por usar `abrirConversaNoCliente`); num Canal fora do ar é só guardada, sem
 *     linha — nada é descartado.
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
 * nunca é logado (T-08-29). O `SQLSTATE` traduzido por `FRASES_DE_CONVERSAS` é a rede contra
 * a corrida da unicidade do par; a frase não carrega o nome do constraint.
 */

import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { ACOES_DO_CRM, type AcaoDoCrm } from "@n1/dominio/crm/atividades";
import type { Pagina } from "@n1/dominio/crm/comum";
import { nomeDeExibicaoDoContato } from "@n1/dominio/crm/contatos";
import {
  identificadorDeResposta,
  participantesComContato,
  proximaSituacao,
  TIPO_DE_IDENTIFICADOR_DO_CANAL,
  tituloDaConversa,
  validarAtribuicao,
  validarMover,
  validarLixeira,
  validarMarcacao,
  validarNovaConversa,
  validarRestauracao,
  type AcaoDeSituacao,
  type Atribuicao,
  type Conversa,
  type ConversaDetalhada,
  type ConversaNaLista,
  type EdicaoDeMarcacao,
  type FiltroDeConversas,
  type MarcacaoDaConversa,
  type NovaConversa,
  type ParticipanteDaConversa,
} from "@n1/dominio/crm/conversas";
import { capacidadesDoCanal } from "@n1/dominio/crm/capacidades";
import { recusaPorFaltaDeConsentimento } from "@n1/dominio/crm/consentimentos";
import { textoDoModelo } from "@n1/dominio/crm/modelos";
import { FRASE_SO_RESPONDE, statusInicialDeEnvio, validarEnvio, type Mensagem } from "@n1/dominio/crm/mensagens";
import type { Canal } from "@n1/dominio/crm/canais";
import { avisarCrm } from "../../mensageria/avisar";
import { enfileirarEnvio } from "../../mensageria/fila-de-saida";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { registrarAtividade } from "../../repositorios/crm/atividades";
import { criarRepositorioDeCanaisPg } from "../../repositorios/crm/canais";
import { criarRepositorioDeConsentimentosPg } from "../../repositorios/crm/consentimentos";
import { criarRepositorioDeContatosPg } from "../../repositorios/crm/contatos";
import { criarRepositorioDeConversasPg } from "../../repositorios/crm/conversas";
import { criarRepositorioDeMarcacoesPg } from "../../repositorios/crm/marcacoes";
import { criarRepositorioDeMensagensPg } from "../../repositorios/crm/mensagens";
import { membroAtivo } from "../../repositorios/crm/membros";
import { agenteAtivo, finalidadeDeMarketing, nomeDoAtribuido } from "../../repositorios/crm/referencias";
import { exigir, type AcessoAoCrm } from "./acesso";
import { modelosDoEnvio } from "./modelo-do-envio";
import { recusa, sucesso, type ResultadoCrm } from "./resultado";
import { comTransacao, type FrasesDeRestricao } from "./transacao";

export interface ServicoDeConversas {
  /** A estrela, o `naoLidas` e o filtro `comEstrela` são do Membro da sessão. */
  listar(membro: MembroDaSessao, filtro: FiltroDeConversas): Promise<ResultadoCrm<Pagina<ConversaNaLista>>>;
  obter(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<ConversaDetalhada>>;
  criar(
    membro: MembroDaSessao,
    entrada: NovaConversa,
  ): Promise<ResultadoCrm<ConversaDetalhada & { readonly primeiraMensagem: Mensagem }>>;
  resolver(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<ConversaDetalhada>>;
  reabrir(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<ConversaDetalhada>>;
  /** Troca o Contato da Conversa (3.2.5); o Canal e as Mensagens ficam. */
  mover(
    membro: MembroDaSessao,
    id: string,
    entrada: { readonly contatoId: string; readonly resolverExistente?: boolean },
  ): Promise<ResultadoCrm<ConversaDetalhada>>;
  /** Atribui a Conversa a um Membro ativo ou a um Agente deste Espaço; `null` tira a atribuição. */
  atribuir(membro: MembroDaSessao, id: string, entrada: { readonly atribuido: Atribuicao }): Promise<ResultadoCrm<ConversaDetalhada>>;
  /** Só a Conversa resolvida vai para a lixeira (3.2.6); grava `na_lixeira_em`. */
  enviarParaLixeira(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<ConversaDetalhada>>;
  /** Volta para `ativo` e zera `na_lixeira_em`; recusa quando o Contato está na lixeira. */
  restaurar(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<ConversaDetalhada>>;
  /** Estrela e leitura do PRÓPRIO Membro da sessão (3.2.6); devolve a marcação inteira depois da edição. */
  marcar(membro: MembroDaSessao, id: string, edicao: EdicaoDeMarcacao): Promise<ResultadoCrm<MarcacaoDaConversa>>;
}

const FRASE_JA_ABERTA = "Este Contato já tem uma Conversa aberta neste Canal.";

/** Rede contra corrida: o constraint que segurou vira esta frase, sem o nome dele. */
export const FRASES_DE_CONVERSAS: FrasesDeRestricao = {
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

/**
 * A Atividade de um gesto de Conversa (D-15-09, UCR-03), gravada no cliente da transação do
 * gesto e só depois da escrita: a recusa devolve antes de chegar aqui e o rollback leva a
 * linha junto. O ator é o Membro da sessão (T-15-13). `antes`/`depois` são NOMES de exibição
 * ou rótulos; nunca texto de Mensagem nem valor de Identificador (T-15-27).
 */
async function registrarAtividadeDaConversa(
  cliente: PoolClient,
  membro: MembroDaSessao,
  conversa: Pick<Conversa, "id" | "titulo">,
  acao: AcaoDoCrm,
  mudanca: { readonly antes?: string; readonly depois?: string } = {},
): Promise<void> {
  await registrarAtividade(cliente, membro.workspaceId, {
    ator: { kind: "member", id: membro.id },
    acao,
    objetoTipo: "conversation",
    objetoId: conversa.id,
    objetoNome: conversa.titulo,
    ...(mudanca.antes !== undefined ? { antes: mudanca.antes } : {}),
    ...(mudanca.depois !== undefined ? { depois: mudanca.depois } : {}),
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

/**
 * 16-07 / 3.8.2: o aviso ao tempo real, no MESMO cliente da transação do gesto (o Postgres só o entrega no `commit`).
 * Só ids: a aba relê a Conversa pelas rotas que conferem o acesso.
 */
const avisarConversaMudou = (cliente: PoolClient, membro: MembroDaSessao, conversaId: string) =>
  avisarCrm(cliente, { workspaceId: membro.workspaceId, tipo: "conversa.mudou", conversaId });

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
        await avisarConversaMudou(cliente, membro, atualizada.id);
        const canal = await criarRepositorioDeCanaisPg(cliente).obter(membro.workspaceId, atualizada.canalId);
        if (!canal) return canalNaoEncontrado();
        return sucesso({ conversa: atualizada, canal: resumoDoCanal(canal) });
      },
      FRASES_DE_CONVERSAS,
    );
  }

  return {
    async listar(membro, filtro) {
      const negado = await exigir(deps.acesso, membro, "ler", "conversa");
      if (negado) return { ok: false, ...negado };
      return sucesso(await criarRepositorioDeConversasPg(deps.pool()).listar(membro.workspaceId, filtro, membro.id));
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

      return comTransacao(deps.pool, (cliente: PoolClient) => abrirConversaNoCliente(cliente, membro, entrada), FRASES_DE_CONVERSAS);
    },

    async mover(membro, id, entrada) {
      const negado = await exigir(deps.acesso, membro, "mover", "conversa");
      if (negado) return { ok: false, ...negado };

      return comTransacao(
        deps.pool,
        async (cliente: PoolClient) => {
          const conversas = criarRepositorioDeConversasPg(cliente);
          const contatos = criarRepositorioDeContatosPg(cliente);

          // O Contato vem ANTES da Conversa na ordem das travas (uma mesclagem
          // concorrente trava Contatos e depois move Conversas): lê-se a Conversa
          // sem trava só para saber a origem, trava-se origem e destino em ordem
          // de id, e então a Conversa, conferindo que a origem não mudou.
          const lida = await conversas.obter(membro.workspaceId, id);
          if (!lida) return conversaNaoEncontrada();
          const [primeiro, segundo] = [lida.contatoId, entrada.contatoId].sort();
          const travados = new Map<string, Awaited<ReturnType<typeof contatos.obter>>>();
          for (const contatoId of new Set([primeiro!, segundo!])) {
            travados.set(contatoId, await contatos.obter(membro.workspaceId, contatoId, { travar: true }));
          }
          const destino = travados.get(entrada.contatoId);
          if (!destino) return contatoNaoEncontrado();

          const atual = await conversas.obter(membro.workspaceId, id, { travar: true });
          if (!atual) return conversaNaoEncontrada();
          if (atual.contatoId !== lida.contatoId) {
            return recusa<never>(409, "A Conversa mudou de Contato enquanto você a movia. Tente de novo.", { codigo: "CONFLITO" });
          }

          const valida = validarMover(atual, destino);
          if (!valida.ok) {
            return recusa<never>(409, valida.error, {
              codigo: "MOVER_INVALIDO",
              ...(valida.field !== undefined ? { campo: valida.field } : {}),
            });
          }

          // O índice único só cobre aberta e pendente: mover uma resolvida nunca colide.
          if (atual.situacao !== "resolvida") {
            const ocupante = await conversas.abertaDoPar(membro.workspaceId, destino.id, atual.canalId);
            if (ocupante && ocupante.id !== atual.id) {
              if (entrada.resolverExistente !== true) return jaAberta(ocupante);
              const travada = await conversas.obter(membro.workspaceId, ocupante.id, { travar: true });
              if (travada) {
                await conversas.definirSituacao(membro.workspaceId, travada.id, "resolvida");
                await avisarConversaMudou(cliente, membro, travada.id);
              }
            }
          }

          const movida = await conversas.trocarContato(
            membro.workspaceId,
            id,
            destino.id,
            participantesComContato(atual.participantes, atual.contatoId, destino.id),
          );
          if (!movida) return conversaNaoEncontrada();
          await avisarConversaMudou(cliente, membro, movida.id);
          const origem = travados.get(lida.contatoId);
          await registrarAtividadeDaConversa(cliente, membro, movida, ACOES_DO_CRM.conversaMovida, {
            ...(origem ? { antes: nomeDeExibicaoDoContato(origem) } : {}),
            depois: nomeDeExibicaoDoContato(destino),
          });
          const canal = await criarRepositorioDeCanaisPg(cliente).obter(membro.workspaceId, movida.canalId);
          if (!canal) return canalNaoEncontrado();
          return sucesso({ conversa: movida, canal: resumoDoCanal(canal) });
        },
        FRASES_DE_CONVERSAS,
      );
    },

    async atribuir(membro, id, entrada) {
      const negado = await exigir(deps.acesso, membro, "editar", "conversa");
      if (negado) return { ok: false, ...negado };

      return comTransacao(
        deps.pool,
        async (cliente: PoolClient) => {
          const conversas = criarRepositorioDeConversasPg(cliente);
          const atual = await conversas.obter(membro.workspaceId, id, { travar: true });
          if (!atual) return conversaNaoEncontrada();

          const valida = validarAtribuicao(atual);
          if (!valida.ok) return recusa<never>(409, valida.error, { codigo: "TRANSICAO_INVALIDA" });

          // Quem recebe precisa existir (e estar ativo) NESTE Espaço: o id vem do corpo (T-14-10).
          const destino = entrada.atribuido;
          if (destino !== null) {
            const existe =
              destino.tipo === "membro"
                ? await membroAtivo(cliente, membro.workspaceId, destino.id)
                : await agenteAtivo(cliente, membro.workspaceId, destino.id);
            if (!existe) {
              return recusa<never>(
                409,
                destino.tipo === "membro" ? "Só um Membro ativo deste Espaço pode receber a Conversa." : "Só um Agente ativo deste Espaço pode receber a Conversa.",
                { codigo: "ATRIBUIDO_INVALIDO", campo: "atribuido" },
              );
            }
          }

          const atualizada = await conversas.definirAtribuicao(membro.workspaceId, id, destino);
          if (!atualizada) return conversaNaoEncontrada();
          await avisarConversaMudou(cliente, membro, atualizada.id);
          // Os nomes são os de exibição; um registro que não achamos fica sem nome em vez de com o id.
          const nomeAntes = atual.atribuido ? await nomeDoAtribuido(cliente, membro.workspaceId, atual.atribuido) : undefined;
          const nomeDepois = destino ? await nomeDoAtribuido(cliente, membro.workspaceId, destino) : undefined;
          await registrarAtividadeDaConversa(
            cliente,
            membro,
            atualizada,
            destino === null ? ACOES_DO_CRM.atribuidoRemovido : ACOES_DO_CRM.conversaAtribuida,
            {
              ...(nomeAntes !== undefined ? { antes: nomeAntes } : {}),
              ...(nomeDepois !== undefined ? { depois: nomeDepois } : {}),
            },
          );
          const canal = await criarRepositorioDeCanaisPg(cliente).obter(membro.workspaceId, atualizada.canalId);
          if (!canal) return canalNaoEncontrado();
          return sucesso({ conversa: atualizada, canal: resumoDoCanal(canal) });
        },
        FRASES_DE_CONVERSAS,
      );
    },

    async enviarParaLixeira(membro, id) {
      const negado = await exigir(deps.acesso, membro, "enviar_para_lixeira", "conversa");
      if (negado) return { ok: false, ...negado };

      return comTransacao(
        deps.pool,
        async (cliente: PoolClient) => {
          const conversas = criarRepositorioDeConversasPg(cliente);
          const atual = await conversas.obter(membro.workspaceId, id, { travar: true });
          if (!atual) return conversaNaoEncontrada();

          const valida = validarLixeira(atual);
          if (!valida.ok) return transicaoInvalida(valida.error);

          const atualizada = await conversas.enviarParaLixeira(membro.workspaceId, id);
          if (!atualizada) return conversaNaoEncontrada();
          await avisarConversaMudou(cliente, membro, atualizada.id);
          await registrarAtividadeDaConversa(cliente, membro, atualizada, ACOES_DO_CRM.conversaParaLixeira);
          const canal = await criarRepositorioDeCanaisPg(cliente).obter(membro.workspaceId, atualizada.canalId);
          if (!canal) return canalNaoEncontrado();
          return sucesso({ conversa: atualizada, canal: resumoDoCanal(canal) });
        },
        FRASES_DE_CONVERSAS,
      );
    },

    async restaurar(membro, id) {
      const negado = await exigir(deps.acesso, membro, "restaurar", "conversa");
      if (negado) return { ok: false, ...negado };

      return comTransacao(
        deps.pool,
        async (cliente: PoolClient) => {
          const conversas = criarRepositorioDeConversasPg(cliente);
          const contatos = criarRepositorioDeContatosPg(cliente);

          // Contato antes da Conversa na ordem das travas (como em `mover`): lê-se a
          // Conversa sem trava só para saber o Contato, trava-se o Contato e então a
          // Conversa, conferindo que o Contato não mudou no meio.
          const lida = await conversas.obter(membro.workspaceId, id);
          if (!lida) return conversaNaoEncontrada();
          const contato = await contatos.obter(membro.workspaceId, lida.contatoId, { travar: true });
          if (!contato) return contatoNaoEncontrado();

          const atual = await conversas.obter(membro.workspaceId, id, { travar: true });
          if (!atual) return conversaNaoEncontrada();
          if (atual.contatoId !== lida.contatoId) {
            return recusa<never>(409, "A Conversa mudou de Contato enquanto você a restaurava. Tente de novo.", { codigo: "CONFLITO" });
          }

          const valida = validarRestauracao(atual, contato);
          if (!valida.ok) return transicaoInvalida(valida.error);

          const atualizada = await conversas.restaurar(membro.workspaceId, id);
          if (!atualizada) return conversaNaoEncontrada();
          await avisarConversaMudou(cliente, membro, atualizada.id);
          await registrarAtividadeDaConversa(cliente, membro, atualizada, ACOES_DO_CRM.conversaRestaurada);
          const canal = await criarRepositorioDeCanaisPg(cliente).obter(membro.workspaceId, atualizada.canalId);
          if (!canal) return canalNaoEncontrado();
          return sucesso({ conversa: atualizada, canal: resumoDoCanal(canal) });
        },
        FRASES_DE_CONVERSAS,
      );
    },

    async marcar(membro, id, edicao) {
      const negado = await exigir(deps.acesso, membro, "editar", "conversa");
      if (negado) return { ok: false, ...negado };

      const valida = validarMarcacao(edicao);
      if (!valida.ok) return valorInvalido(valida);

      // O Membro da marcação é SEMPRE o da sessão (T-14-17); a Conversa precisa existir NESTE Espaço.
      // A Atividade só nasce quando algo muda de fato (T-15-26): a estrela trocou, ou o `lidaAte`
      // avançou por cima de Mensagem recebida. Repetir o mesmo valor não grava linha.
      return comTransacao(deps.pool, async (cliente: PoolClient) => {
        const conversa = await criarRepositorioDeConversasPg(cliente).obter(membro.workspaceId, id);
        if (!conversa) return conversaNaoEncontrada();
        const marcacoes = criarRepositorioDeMarcacoesPg(cliente);
        const { anterior, atual } = await marcacoes.gravarComAnterior(membro.workspaceId, id, membro.id, valida.value);

        if (atual.estrela !== anterior.estrela) {
          await registrarAtividadeDaConversa(cliente, membro, conversa, atual.estrela ? ACOES_DO_CRM.estrelaMarcada : ACOES_DO_CRM.estrelaRemovida);
        }
        const avancou =
          atual.lidaAte !== null && (anterior.lidaAte === null || Date.parse(atual.lidaAte) > Date.parse(anterior.lidaAte));
        if (avancou && (await marcacoes.temRecebidaEntre(membro.workspaceId, id, anterior.lidaAte, atual.lidaAte!))) {
          await registrarAtividadeDaConversa(cliente, membro, conversa, ACOES_DO_CRM.conversaLida);
        }
        return sucesso(atual);
      });
    },

    resolver: (membro, id) => mudarSituacao(membro, id, "resolver"),

    reabrir: (membro, id) => mudarSituacao(membro, id, "reabrir"),
  };
}

/** 409 do Canal arquivado: ele não abre Conversa nem recebe Tarefa. */
export const canalArquivado = () =>
  recusa<never>(409, "Um Canal arquivado não abre Conversa. Escolha outro Canal.", { codigo: "CANAL_ARQUIVADO", campo: "canalId" });

/**
 * O Identificador do Contato que o Canal resolve (o principal vem primeiro), ou
 * o 409 com a frase. RN-CXE-21: `telefone` não é WhatsApp.
 */
export function identificadorDoCanal<I extends { readonly id: string; readonly tipo: string; readonly principal: boolean }>(
  identificadores: readonly I[],
  canal: Pick<Canal, "tipo">,
): ResultadoCrm<I> {
  // A regra de escolha é do domínio (WR-04, a mesma da resposta); sem o id de quem escreveu, abrir Conversa vai ao principal.
  const identificador = identificadorDeResposta(identificadores, canal);
  if (!identificador) {
    const tipoDoIdentificador = TIPO_DE_IDENTIFICADOR_DO_CANAL[canal.tipo];
    return recusa<never>(409, `Este Contato não tem ${rotuloDoIdentificador(tipoDoIdentificador)} para conversar por este Canal.`, {
      codigo: "CONTATO_SEM_IDENTIFICADOR_DO_CANAL",
      campo: "contatoId",
    });
  }
  return sucesso(identificador);
}

/**
 * Abre a Conversa e grava a primeira Mensagem no `cliente` que vier, dentro da
 * transação de quem chama (INV-CXE-05). É o mesmo código de `POST /conversas`
 * e do gesto misto da Tarefa conversacional (14-13), que escolhe o `id` da
 * Conversa antes de gravar para já apontar o Vínculo da Tarefa para ele.
 *
 * Confere Canal, Contato `ativo`, Identificador do tipo do Canal e o par livre;
 * a recusa volta como valor. O Papel e a forma da entrada ficam com quem chama,
 * ANTES da transação. Sem `opcoes.id`, o default do banco gera o id.
 */
export async function abrirConversaNoCliente(
  cliente: PoolClient,
  membro: MembroDaSessao,
  entrada: NovaConversa,
  opcoes: { readonly id?: string } = {},
): Promise<ResultadoCrm<ConversaDetalhada & { readonly primeiraMensagem: Mensagem }>> {
  const canal = await criarRepositorioDeCanaisPg(cliente).obter(membro.workspaceId, entrada.canalId);
  if (!canal) return canalNaoEncontrado();
  if (canal.estado === "arquivado") return canalArquivado();
  // Sessão 8 (8.3.4): no Instagram não se puxa conversa. Ela nasce quando o Contato escreve (o webhook).
  const capacidades = capacidadesDoCanal({ channelType: canal.tipo, provider: canal.provedor });
  if (capacidades.foraDaJanela === "bloqueado") {
    return recusa<never>(409, FRASE_SO_RESPONDE, { codigo: "CANAL_SO_RESPONDE", campo: "canalId" });
  }
  const contatos = criarRepositorioDeContatosPg(cliente);
  // `for update`: uma mesclagem confirmada no meio faz esta transação esperar e então enxergar
  // `mesclado`, em vez de abrir a Conversa para um Contato que já não aceita escrita (WR-01, RN-CON-14).
  const contato = await contatos.obter(membro.workspaceId, entrada.contatoId, { travar: true });
  if (!contato) return contatoNaoEncontrado();
  if (contato.estado === "mesclado") {
    return recusa<never>(409, "Este Contato foi mesclado e agora é somente leitura. Abra o Contato que ficou.", {
      codigo: "CONTATO_MESCLADO",
      campo: "contatoId",
    });
  }
  if (contato.estado !== "ativo") {
    return recusa<never>(409, "Só um Contato ativo abre Conversa.", { codigo: "CONTATO_INATIVO", campo: "contatoId" });
  }

  const doCanal = identificadorDoCanal(await contatos.listarIdentificadores(membro.workspaceId, contato.id), canal);
  if (!doCanal.ok) return doCanal;
  const identificador = doCanal.valor;

  const conversas = criarRepositorioDeConversasPg(cliente);
  const existente = await conversas.abertaDoPar(membro.workspaceId, contato.id, canal.id);
  if (existente) return jaAberta(existente);

  // Sessão 7 (7.2.6 e 7.3.4): no WhatsApp oficial a empresa só abre a conversa com Mensagem de modelo aprovada. A Conversa nova
  // não tem recebida, então vale a regra de "fora da janela": sem modelo escolhido a recusa vem antes de gravar (e leva os
  // modelos que a pessoa pode escolher), em vez de a Meta recusar depois (131047) e a Mensagem ficar `falhou`. Depois da
  // checagem do par: com uma Conversa já aberta a resposta certa é "já existe" (`CONVERSA_JA_ABERTA`).
  const dosModelos = await modelosDoEnvio(cliente, membro.workspaceId, canal, entrada.mensagem);
  if (!dosModelos.ok) return dosModelos;
  const { enviaveis, escolhido, variaveis } = dosModelos.valor;
  if (capacidades.foraDaJanela === "soModelo") {
    const envio = validarEnvio({
      capacidades,
      ultimaRecebidaEm: null,
      agora: Date.now(),
      ...(escolhido ? { modeloId: escolhido.id } : {}),
      modelosAprovados: enviaveis.map((m) => m.id),
    });
    if (!envio.ok) {
      return recusa<never>(409, envio.error, { codigo: "JANELA_EXPIRADA", campo: envio.field ?? "modelo", ...(enviaveis.length > 0 ? { modelos: enviaveis } : {}) });
    }
  }
  // 3.2.4: o modelo de marketing só sai com consentimento vigente do Contato, também ao ABRIR a conversa.
  if (escolhido) {
    const frase = recusaPorFaltaDeConsentimento({
      categoriaDoModelo: escolhido.categoria,
      registros: await criarRepositorioDeConsentimentosPg(cliente).listarDoContato(membro.workspaceId, contato.id),
      finalidadeDeMarketingId: await finalidadeDeMarketing(cliente, membro.workspaceId),
      tipoDoCanal: canal.tipo,
    });
    if (frase !== undefined) return recusa<never>(409, frase, { codigo: "SEM_CONSENTIMENTO", campo: "modelo" });
  }

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
    ...(opcoes.id !== undefined ? { id: opcoes.id } : {}),
  });

  const primeiraMensagem = await criarRepositorioDeMensagensPg(cliente).inserir(membro.workspaceId, {
    conversaId: conversa.id,
    canalId: canal.id,
    direcao: "enviada",
    ator: { tipo: "member", id: membro.id },
    // Na Mensagem de modelo o texto é o do modelo já preenchido: o atendente lê o que foi mandado, não `{{1}}`.
    conteudo: escolhido ? textoDoModelo(escolhido, variaveis) : entrada.mensagem.conteudo,
    statusEntrega: statusInicialDeEnvio(canal.conexao),
    ...(escolhido ? { modeloUsado: { idNoProvedor: escolhido.idNoProvedor, nome: escolhido.nome, idioma: escolhido.idioma, variaveis } } : {}),
  });
  // 3.7.1: o evento nasce no mesmo cliente da transação; se falhar, a Conversa e a Mensagem vão embora juntas.
  await enfileirarEnvio(cliente, membro.workspaceId, primeiraMensagem, canal);
  // 16-07: a Conversa e a primeira Mensagem nascem juntas; um aviso só (`mensagem.nova`) cobre as duas.
  await avisarCrm(cliente, { workspaceId: membro.workspaceId, tipo: "mensagem.nova", conversaId: conversa.id, mensagemId: primeiraMensagem.id });

  return sucesso({ conversa, canal: resumoDoCanal(canal), primeiraMensagem });
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

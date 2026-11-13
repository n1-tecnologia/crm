/**
 * Serviço de Mensagens (08-12): o fio de uma Conversa relacional e o envio
 * humano. A `recebida` não entra por aqui: a única porta dela é
 * `receberMensagem` (`recebimento.ts`, 3.6.2).
 *
 * O Espaço de Trabalho e o autor vêm SEMPRE de `membro` (a sessão) — nada que
 * chegue no corpo os substitui. O Papel é exigido ANTES de qualquer leitura ou
 * transação, e a forma (`validarNovaMensagem`) antes de abrir a transação.
 *
 * Regras de produto aplicadas aqui, todas vindas do domínio:
 *   - RN-CXE-19 / D-02: fora da janela de resposta, só Mensagem de modelo
 *     aprovada sai — e o que decide é o par (tipo, provedor) do Canal, via
 *     `capacidadesDoCanal` + `validarEnvio`. Esta fase não tem Mensagens de
 *     modelo (`modelosAprovados: []`): o WhatsApp oficial fora da janela recebe
 *     409 `JANELA_EXPIRADA` com `campo: "modelo"`; o não oficial nunca é
 *     barrado por janela. É o servidor que recusa, independente da tela.
 *   - B69 + 3.7.1 (MSG-02): `enviada` nasce SEMPRE `pendente`
 *     (`statusInicialDeEnvio`: só o provedor diz que saiu). Num Canal `conectada` entra, no
 *     MESMO cliente da transação, uma linha `mensagem.enviar.v1` no outbox
 *     (`enfileirarEnvio`); se ela falha, a Mensagem também não fica. Num Canal fora do ar a
 *     Mensagem é só guardada, sem linha. `interna` não tem status de entrega, não enfileira e
 *     não passa pela janela (INV-CXE-09).
 *   - 3.2.4: o modelo de marketing só sai se o consentimento vigente do Contato, para
 *     o tipo do Canal, é `concedido` — 409 `SEM_CONSENTIMENTO` (campo `modelo`). A regra
 *     é `recusaPorFaltaDeConsentimento` do domínio; quem diz a categoria do modelo é
 *     `deps.categoriaDoModelo`, que a Sessão 7 preenche (hoje ninguém, e a rota
 *     `POST /mensagens` não manda modelo).
 *   - INV-CXE-10: "em resposta a" é da MESMA Conversa; a FK composta da 008 é a
 *     rede e `FRASES` a traduz, sem o nome do constraint.
 *   - INV-CXE-08 / RN-CXE-17: a idempotência por (Canal, id externo), a
 *     reabertura e o Contato da `recebida` são de `receberMensagem`, não daqui.
 *   - 16-06 / 3.7.3: "Tentar de novo" (`reenviar`) só aceita a `enviada` que `falhou`: a Mensagem volta a
 *     `pendente` e a MESMA linha do outbox reabre (`reenfileirarEnvio`), tudo na transação. O Papel é
 *     `enviar` `mensagem`, o mesmo de escrever, e o Espaço é sempre o da sessão.
 *
 *   - 16-09 / 3.9.3 (MSG-04): o anexo é um arquivo guardado no bucket. `pedirTicketDeAnexo` abre a sessão de envio da
 *     Conversa (`formId = conversa-<id>`) e a chave do objeto nasce no servidor (`workspace/<ws>/conversas/<id>/<uuid>`);
 *     `enviar` confirma o arquivo (tipo reservado, tamanho, assinatura) e consome a sessão na MESMA transação da
 *     Mensagem; `urlDoAnexo` confere o Espaço e o Papel e devolve uma URL assinada nova. Nenhuma resposta cita a chave
 *     do objeto, e o log só leva o código do erro do armazenamento.
 *
 * Nem o `conteudo` nem a `cargaBruta` são escritos em log (T-08-46).
 */

import type { Pool, PoolClient } from "pg";
import type { Pagina } from "@n1/dominio/crm/comum";
import type { Conversa } from "@n1/dominio/crm/conversas";
import { recusaPorFaltaDeConsentimento } from "@n1/dominio/crm/consentimentos";
import {
  statusInicialDeEnvio,
  validarAnexosDoEnvio,
  validarEnvio,
  validarNovaMensagem,
  type AnexoConfirmado,
  type Mensagem,
  type NovaMensagem,
} from "@n1/dominio/crm/mensagens";
import { capacidadesDoCanal } from "@n1/dominio/crm/capacidades";
import { textoDoModelo, type ModeloDeMensagem } from "@n1/dominio/crm/modelos";
import { categoriaDaMidia, ehDocumento, normalizarTipoDeMidia, TIPOS_ACEITOS_NA_MENSAGEM, tiposAceitosParaOCanal } from "@n1/dominio/crm/midia";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { avisarCrm } from "../../mensageria/avisar";
import { enfileirarEnvio, reenfileirarEnvio } from "../../mensageria/fila-de-saida";
import { criarRepositorioDeCanaisPg } from "../../repositorios/crm/canais";
import { criarRepositorioDeConsentimentosPg } from "../../repositorios/crm/consentimentos";
import { criarRepositorioDeConversasPg } from "../../repositorios/crm/conversas";
import { criarRepositorioDeMensagensPg, type FiltroDeMensagens } from "../../repositorios/crm/mensagens";
import { finalidadeDeMarketing } from "../../repositorios/crm/referencias";
import { armazenamentoDeAnexosPadrao, type ArmazenamentoDeAnexos } from "../armazenamento-de-anexos";
import type { MotivoDeRecusaDeConfirmacao } from "../storage-uploads";
import { exigir, type AcessoAoCrm } from "./acesso";
import { modelosDoEnvio } from "./modelo-do-envio";
import { recusa, sucesso, type ResultadoCrm } from "./resultado";
import { comTransacao, type FrasesDeRestricao } from "./transacao";

/** O pedido de ticket para anexar um arquivo (16-09, 3.9.3): o tipo e o tamanho que o navegador diz que vai subir. */
export interface EntradaDeTicketDeAnexo {
  readonly conversaId: string;
  readonly nome: string;
  readonly tipoDeMidia: string;
  readonly tamanhoBytes: number;
}

/** O ticket: o navegador sobe os bytes em `uploadUrl` e devolve `submissionId` e `objectId` em `POST /mensagens`. */
export interface TicketDeAnexo {
  readonly submissionId: string;
  readonly objectId: string;
  readonly uploadUrl: string;
}

/** A URL assinada de um anexo: vale poucos minutos e é pedida de novo a cada abertura. */
export interface UrlDeAnexo {
  readonly url: string;
  readonly expiraEm: string;
}

export interface ServicoDeMensagens {
  listar(membro: MembroDaSessao, filtro: FiltroDeMensagens): Promise<ResultadoCrm<Pagina<Mensagem>>>;
  enviar(membro: MembroDaSessao, entrada: NovaMensagem): Promise<ResultadoCrm<Mensagem>>;
  /** "Tentar de novo" (16-06, 3.7.3): só a Mensagem `enviada` que `falhou`; volta a `pendente` e à fila. */
  reenviar(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<Mensagem>>;
  /** 16-09: abre a sessão de envio da Conversa e devolve o ticket para o navegador subir o arquivo ao bucket. */
  pedirTicketDeAnexo(membro: MembroDaSessao, entrada: EntradaDeTicketDeAnexo): Promise<ResultadoCrm<TicketDeAnexo>>;
  /** 16-09: uma URL assinada nova do anexo `indice` da Mensagem; só quem pode ler a Conversa. */
  urlDoAnexo(membro: MembroDaSessao, mensagemId: string, indice: number): Promise<ResultadoCrm<UrlDeAnexo>>;
}

/** Rede de SQLSTATE: a FK composta de "em resposta a" (INV-CXE-10) vira esta frase, sem o nome dela. */
const FRASES: FrasesDeRestricao = {
  mensagens_workspace_id_conversa_id_em_resposta_a_id_fkey: {
    codigo: "RESPOSTA_DE_OUTRA_CONVERSA",
    error: "A Mensagem respondida é de outra Conversa.",
  },
};

const conversaNaoEncontrada = () =>
  recusa<never>(404, "Conversa não encontrada.", { codigo: "CONVERSA_NAO_ENCONTRADA", campo: "conversaId" });

/** O `formId` da sessão de envio de uma Conversa. Sem `:`, porque a tabela de sessões o exige e a chave nasce da Conversa. */
export const formIdDaConversa = (conversaId: string): string => `conversa-${conversaId}`;

/** A recusa do servidor sobre o arquivo, em palavras de quem anexou — nunca o caminho do objeto (T-16-34). */
const RECUSA_DO_ARQUIVO: Readonly<Record<MotivoDeRecusaDeConfirmacao, { readonly codigo: string; readonly error: string }>> = {
  objeto_nao_pertence_a_sessao: { codigo: "ANEXO_DE_OUTRA_CONVERSA", error: "Este arquivo não é desta Conversa." },
  objeto_ausente: { codigo: "ARQUIVO_AUSENTE", error: "O arquivo não chegou ao armazenamento. Envie de novo." },
  tamanho_excedido: { codigo: "ARQUIVO_GRANDE_DEMAIS", error: "O arquivo passa do tamanho máximo." },
  tipo_nao_confere: { codigo: "TIPO_NAO_ACEITO", error: "Este tipo de arquivo não é aceito." },
  assinatura_nao_confere: { codigo: "ARQUIVO_NAO_CONFERE", error: "O conteúdo do arquivo não confere com o tipo dele." },
};

const anexoDeOutraConversa = () =>
  recusa<never>(422, "Este arquivo não é desta Conversa.", { codigo: "ANEXO_DE_OUTRA_CONVERSA", campo: "anexos" });
const tipoNaoEnviadoPeloCanal = () =>
  recusa<never>(422, "Este Canal não envia este tipo de arquivo.", { codigo: "TIPO_NAO_ENVIADO_PELO_CANAL", campo: "anexos" });
const arquivoGrandeDemais = () => recusa<never>(422, "O arquivo passa do tamanho máximo.", { codigo: "ARQUIVO_GRANDE_DEMAIS", campo: "tamanhoBytes" });
const arquivoIndisponivel = () => recusa<never>(404, "O arquivo não está disponível.", { codigo: "ARQUIVO_INDISPONIVEL" });

/** Uma falha do armazenamento sobe como erro genérico (500): só o código, nunca a mensagem, que pode citar a chave. */
async function noArmazenamento<T>(operacao: () => Promise<T>): Promise<T> {
  try {
    return await operacao();
  } catch (erro) {
    const codigo = erro instanceof Error ? (erro.message.split(":")[0] ?? "erro") : "erro";
    throw new Error(`armazenamento_indisponivel: ${codigo}`);
  }
}

const naoFalhou = () =>
  recusa<never>(409, "Só uma Mensagem que não foi enviada pode ser enviada de novo.", { codigo: "NAO_FALHOU" });

function valorInvalido(falha: { readonly error: string; readonly field?: string | undefined }) {
  return recusa<never>(400, falha.error, { codigo: "VALOR_INVALIDO", ...(falha.field !== undefined ? { campo: falha.field } : {}) });
}

export function criarServicoDeMensagens(deps: {
  readonly pool: () => Pool;
  readonly acesso: AcessoAoCrm;
  /**
   * A categoria do modelo que esta Mensagem usa (`"marketing"`, `"utilidade"`...), ou `undefined`
   * para texto livre. Os modelos chegam na Sessão 7 (Fase 16): `NovaMensagem` ainda não tem campo
   * de modelo, então hoje ninguém passa isto e o envio segue como estava. Quando passa, o modelo
   * de marketing só sai com consentimento vigente (3.2.4).
   */
  readonly categoriaDoModelo?: (cliente: PoolClient, workspaceId: string, conversa: Conversa, entrada: NovaMensagem) => Promise<string | undefined>;
  /** Quem enfileira o envio. Só o teste de rollback troca o padrão (`enfileirarEnvio`). */
  readonly enfileirar?: typeof enfileirarEnvio;
  /** Quem reabre a linha do outbox na "Tentar de novo". Só o teste de rollback troca o padrão (`reenfileirarEnvio`). */
  readonly reenfileirar?: typeof reenfileirarEnvio;
  /** O bucket dos anexos. Padrão: o do Supabase; os testes injetam `criarArmazenamentoFalso()`. */
  readonly armazenamento?: ArmazenamentoDeAnexos;
}): ServicoDeMensagens {
  const enfileirar = deps.enfileirar ?? enfileirarEnvio;
  const reenfileirar = deps.reenfileirar ?? reenfileirarEnvio;
  // O bucket só é tocado quando um anexo chega; criar o padrão não abre conexão nem lê variável.
  const armazenamento = deps.armazenamento ?? armazenamentoDeAnexosPadrao();
  return {
    async listar(membro, filtro) {
      const negado = await exigir(deps.acesso, membro, "ler", "mensagem");
      if (negado) return { ok: false, ...negado };

      const pool = deps.pool();
      const conversa = await criarRepositorioDeConversasPg(pool).obter(membro.workspaceId, filtro.conversaId);
      if (!conversa) return conversaNaoEncontrada();
      return sucesso(await criarRepositorioDeMensagensPg(pool).listar(membro.workspaceId, filtro));
    },

    async enviar(membro, entrada) {
      const negado = await exigir(deps.acesso, membro, "enviar", "mensagem");
      if (negado) return { ok: false, ...negado };

      const validacao = validarNovaMensagem(entrada);
      if (!validacao.ok) return valorInvalido(validacao);

      return comTransacao(
        deps.pool,
        async (cliente: PoolClient) => {
          const conversa = await criarRepositorioDeConversasPg(cliente).obter(membro.workspaceId, entrada.conversaId);
          if (!conversa) return conversaNaoEncontrada();
          if (conversa.estado === "na_lixeira") {
            return recusa<never>(409, "Uma Conversa na lixeira não recebe Mensagem. Restaure-a antes.", { codigo: "CONVERSA_NA_LIXEIRA" });
          }

          const canal = await criarRepositorioDeCanaisPg(cliente).obter(membro.workspaceId, conversa.canalId);
          if (!canal) return conversaNaoEncontrada();
          if (canal.estado === "arquivado") {
            return recusa<never>(409, "Um Canal arquivado não envia Mensagem.", { codigo: "CANAL_ARQUIVADO" });
          }

          const mensagens = criarRepositorioDeMensagensPg(cliente);
          let modeloEscolhido: ModeloDeMensagem | undefined;
          let variaveisDoModelo: readonly string[] = [];
          if (entrada.direcao === "enviada") {
            // 7.3.4: os modelos que o Canal envia e o que a pessoa escolheu (ver `modelo-do-envio.ts`).
            const dosModelos = await modelosDoEnvio(cliente, membro.workspaceId, canal, entrada);
            if (!dosModelos.ok) return dosModelos;
            const { enviaveis } = dosModelos.valor;
            modeloEscolhido = dosModelos.valor.escolhido;
            variaveisDoModelo = dosModelos.valor.variaveis;
            const envio = validarEnvio({
              capacidades: capacidadesDoCanal({ channelType: canal.tipo, provider: canal.provedor }),
              ultimaRecebidaEm: await mensagens.ultimaRecebidaEm(membro.workspaceId, conversa.id),
              agora: Date.now(),
              ...(modeloEscolhido ? { modeloId: modeloEscolhido.id } : {}),
              modelosAprovados: enviaveis.map((m) => m.id),
            });
            if (!envio.ok) {
              // A recusa leva os modelos que a pessoa pode escolher no lugar do texto livre.
              return recusa<never>(409, envio.error, { codigo: "JANELA_EXPIRADA", campo: envio.field ?? "modelo", ...(enviaveis.length > 0 ? { modelos: enviaveis } : {}) });
            }

            // 3.2.4: o modelo de marketing só sai com consentimento vigente do Contato para o tipo do Canal.
            const categoria = modeloEscolhido?.categoria ?? (await deps.categoriaDoModelo?.(cliente, membro.workspaceId, conversa, entrada));
            if (categoria !== undefined) {
              const frase = recusaPorFaltaDeConsentimento({
                categoriaDoModelo: categoria,
                registros: await criarRepositorioDeConsentimentosPg(cliente).listarDoContato(membro.workspaceId, conversa.contatoId),
                finalidadeDeMarketingId: await finalidadeDeMarketing(cliente, membro.workspaceId),
                tipoDoCanal: canal.tipo,
              });
              if (frase !== undefined) return recusa<never>(409, frase, { codigo: "SEM_CONSENTIMENTO", campo: "modelo" });
            }
          }

          // 16-09: o arquivo anexado é conferido no bucket ANTES de a Mensagem ser gravada; a sessão só é consumida depois.
          const confirmados: AnexoConfirmado[] = [];
          const sessoesDosAnexos: string[] = [];
          for (const referencia of entrada.anexos ?? []) {
            const sessao = await noArmazenamento(() => armazenamento.sessao(referencia.submissionId));
            if (!sessao) {
              return recusa<never>(422, "Envio não encontrado. Envie o arquivo de novo.", { codigo: "ANEXO_NAO_ENCONTRADO", campo: "anexos" });
            }
            // O Espaço e a Conversa são os da sessão do Membro e da Conversa do corpo: um envio de outra Conversa ou de outro Espaço nunca serve.
            if (sessao.workspaceId !== membro.workspaceId || sessao.formId !== formIdDaConversa(conversa.id)) return anexoDeOutraConversa();

            const confirmacao = await noArmazenamento(() =>
              armazenamento.confirmarObjeto({
                submissionId: referencia.submissionId,
                objectId: referencia.objectId,
                tipos: TIPOS_ACEITOS_NA_MENSAGEM,
                tetoBytes: (tipo) => armazenamento.tetoDoTipo(tipo),
              }),
            );
            if (!confirmacao.ok) {
              const { codigo, error } = RECUSA_DO_ARQUIVO[confirmacao.motivo];
              return recusa<never>(422, error, { codigo, campo: "anexos" });
            }
            confirmados.push({
              objectKey: confirmacao.objectKey,
              nome: confirmacao.displayName,
              tipoDeMidia: confirmacao.mediaType,
              tamanhoBytes: confirmacao.sizeBytes,
            });
            sessoesDosAnexos.push(referencia.submissionId);
          }
          // 3.9.1: o Canal só envia as categorias que declara. A nota interna não sai pelo Canal, então não passa por aqui.
          if (entrada.direcao === "enviada" && confirmados.length > 0) {
            const permitido = validarAnexosDoEnvio(confirmados, capacidadesDoCanal({ channelType: canal.tipo, provider: canal.provedor }).sendableMediaTypes);
            if (!permitido.ok) return tipoNaoEnviadoPeloCanal();
          }

          const mensagem = await mensagens.inserir(membro.workspaceId, {
            conversaId: conversa.id,
            canalId: canal.id,
            direcao: entrada.direcao,
            ator: { tipo: "member", id: membro.id },
            // Na Mensagem de modelo o texto é o do modelo já preenchido: o atendente lê o que foi mandado, não `{{1}}`.
            conteudo: modeloEscolhido
              ? textoDoModelo(modeloEscolhido, variaveisDoModelo)
              : entrada.conteudo.trim() === "" && confirmados.length > 0
                ? null
                : entrada.conteudo,
            statusEntrega: entrada.direcao === "enviada" ? statusInicialDeEnvio(canal.conexao) : null,
            ...(modeloEscolhido
              ? {
                  modeloUsado: {
                    idNoProvedor: modeloEscolhido.idNoProvedor,
                    nome: modeloEscolhido.nome,
                    idioma: modeloEscolhido.idioma,
                    variaveis: variaveisDoModelo,
                  },
                }
              : {}),
            ...(entrada.emRespostaAId !== undefined ? { emRespostaAId: entrada.emRespostaAId } : {}),
            ...(confirmados.length > 0
              ? {
                  anexos: confirmados.map((c) => ({
                    tipoDeMidia: c.tipoDeMidia,
                    nome: c.nome,
                    objectKey: c.objectKey,
                    tamanhoBytes: c.tamanhoBytes,
                    baixado: true,
                  })),
                }
              : {}),
          });
          // A sessão vira anexo uma vez só: consumi-la na mesma transação da Mensagem. Uma sessão já usada ou vencida desfaz tudo.
          for (const submissionId of sessoesDosAnexos) {
            try {
              await armazenamento.consumirSessao(cliente, submissionId);
            } catch (erro) {
              if (erro instanceof Error && erro.message.startsWith("sessao_")) {
                return recusa<never>(409, "Este arquivo já foi usado ou expirou. Envie-o de novo.", { codigo: "ANEXO_JA_USADO", campo: "anexos" });
              }
              throw erro;
            }
          }
          // 3.7.1: no mesmo cliente da transação, antes do commit. Só a `enviada` sai; a `interna` não.
          if (entrada.direcao === "enviada") await enfileirar(cliente, membro.workspaceId, mensagem, canal);
          // 16-07 / 3.8.2: o aviso ao tempo real no mesmo cliente; só chega às abas se a transação confirmar.
          await avisarCrm(cliente, { workspaceId: membro.workspaceId, tipo: "mensagem.nova", conversaId: conversa.id, mensagemId: mensagem.id });
          return sucesso(mensagem);
        },
        FRASES,
      );
    },

    async reenviar(membro, id) {
      const negado = await exigir(deps.acesso, membro, "enviar", "mensagem");
      if (negado) return { ok: false, ...negado };

      return comTransacao(
        deps.pool,
        async (cliente: PoolClient) => {
          const mensagens = criarRepositorioDeMensagensPg(cliente);
          const atual = await mensagens.obter(membro.workspaceId, id);
          if (!atual) return recusa<never>(404, "Mensagem não encontrada.", { codigo: "MENSAGEM_NAO_ENCONTRADA" });
          if (atual.direcao !== "enviada" || atual.statusEntrega !== "falhou") return naoFalhou();

          const conversa = await criarRepositorioDeConversasPg(cliente).obter(membro.workspaceId, atual.conversaId);
          if (!conversa) return conversaNaoEncontrada();
          if (conversa.estado === "na_lixeira") {
            return recusa<never>(409, "Uma Conversa na lixeira não recebe Mensagem. Restaure-a antes.", { codigo: "CONVERSA_NA_LIXEIRA" });
          }
          const canal = await criarRepositorioDeCanaisPg(cliente).obter(membro.workspaceId, atual.canalId);
          if (!canal) return conversaNaoEncontrada();
          if (canal.estado === "arquivado") {
            return recusa<never>(409, "Um Canal arquivado não envia Mensagem.", { codigo: "CANAL_ARQUIVADO" });
          }

          // Primeiro a Mensagem volta a `pendente`, depois a linha reabre: o entregador só envia o que está
          // `pendente` e dá por resolvida a que não está. O `where status = 'falhou'` do repositório decide a corrida
          // entre dois cliques: só um vence, o outro recebe o mesmo 409.
          const pendente = await mensagens.voltarParaPendente(membro.workspaceId, id);
          if (!pendente) return naoFalhou();
          // Canal fora do ar: a Mensagem fica guardada `pendente`; a linha reabre quando ele voltar (B69).
          if (canal.conexao === "conectada") await reenfileirar(cliente, membro.workspaceId, pendente);
          // 16-07: a Mensagem mudou de `falhou` para `pendente`; a aba troca o estado da entrega.
          await avisarCrm(cliente, { workspaceId: membro.workspaceId, tipo: "mensagem.status", conversaId: conversa.id, mensagemId: pendente.id });
          return sucesso(pendente);
        },
        FRASES,
      );
    },

    async pedirTicketDeAnexo(membro, entrada) {
      const negado = await exigir(deps.acesso, membro, "enviar", "mensagem");
      if (negado) return { ok: false, ...negado };

      const pool = deps.pool();
      const conversa = await criarRepositorioDeConversasPg(pool).obter(membro.workspaceId, entrada.conversaId);
      if (!conversa) return conversaNaoEncontrada();
      if (conversa.estado === "na_lixeira") {
        return recusa<never>(409, "Uma Conversa na lixeira não recebe Mensagem. Restaure-a antes.", { codigo: "CONVERSA_NA_LIXEIRA" });
      }
      const canal = await criarRepositorioDeCanaisPg(pool).obter(membro.workspaceId, conversa.canalId);
      if (!canal) return conversaNaoEncontrada();
      if (canal.estado === "arquivado") {
        return recusa<never>(409, "Um Canal arquivado não envia Mensagem.", { codigo: "CANAL_ARQUIVADO" });
      }

      const tipo = normalizarTipoDeMidia(entrada.tipoDeMidia);
      if (categoriaDaMidia(tipo) === undefined) {
        return recusa<never>(422, "Este tipo de arquivo não é aceito.", { codigo: "TIPO_NAO_ACEITO", campo: "tipoDeMidia" });
      }
      const tiposDoCanal = tiposAceitosParaOCanal(capacidadesDoCanal({ channelType: canal.tipo, provider: canal.provedor }).sendableMediaTypes);
      if (!tiposDoCanal.includes(tipo)) return tipoNaoEnviadoPeloCanal();
      // O teto vem antes de abrir a sessão: um arquivo grande demais não deixa sessão nem objeto reservados.
      const teto = armazenamento.tetoDoTipo(tipo);
      if (entrada.tamanhoBytes > teto) return arquivoGrandeDemais();

      const sessao = await noArmazenamento(() => armazenamento.abrirSessao({ workspaceId: membro.workspaceId, formId: formIdDaConversa(conversa.id) }));
      const ticket = await noArmazenamento(() =>
        armazenamento.emitirTicket({
          submissionId: sessao.submissionId,
          displayName: entrada.nome,
          mediaType: tipo,
          tipos: tiposDoCanal,
          prefixoDaChave: `workspace/${membro.workspaceId}/conversas/${conversa.id}`,
          tetoBytes: teto,
          tamanhoBytes: entrada.tamanhoBytes,
        }),
      );
      return sucesso({ submissionId: sessao.submissionId, objectId: ticket.objectId, uploadUrl: ticket.uploadUrl });
    },

    async urlDoAnexo(membro, mensagemId, indice) {
      const negado = await exigir(deps.acesso, membro, "ler", "mensagem");
      if (negado) return { ok: false, ...negado };

      const pool = deps.pool();
      // O Espaço é o da sessão: uma Mensagem de outro Espaço é "não encontrada", nunca "sem permissão".
      const mensagem = await criarRepositorioDeMensagensPg(pool).obter(membro.workspaceId, mensagemId);
      if (!mensagem) return recusa<never>(404, "Mensagem não encontrada.", { codigo: "MENSAGEM_NAO_ENCONTRADA" });
      const conversa = await criarRepositorioDeConversasPg(pool).obter(membro.workspaceId, mensagem.conversaId);
      if (!conversa) return conversaNaoEncontrada();

      const anexo = mensagem.anexos[indice];
      if (!anexo) return recusa<never>(404, "Anexo não encontrado.", { codigo: "ANEXO_NAO_ENCONTRADO" });
      if (!anexo.baixado || anexo.objectKey === undefined) return arquivoIndisponivel();
      // Rede de segurança: a chave tem de ser do Espaço da sessão, seja qual for o que a linha diga.
      if (!anexo.objectKey.startsWith(`workspace/${membro.workspaceId}/`)) return arquivoIndisponivel();

      const chave = anexo.objectKey;
      // Documento, XML e zip saem SEMPRE como anexo para baixar; imagem, áudio e vídeo abrem no próprio <img>/<audio>/<video>.
      const url = await noArmazenamento(() => armazenamento.urlAssinada(chave, ehDocumento(anexo.tipoDeMidia) ? { download: anexo.nome } : undefined));
      return sucesso({ url: url.downloadUrl, expiraEm: url.expiresAt.toISOString() });
    },
  };
}

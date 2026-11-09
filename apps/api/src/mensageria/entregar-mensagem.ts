/**
 * A saída da mensageria (16-05, 3.7.2, MSG-02): o worker que reivindica `mensagem.enviar.v1`, monta o envio,
 * chama `provedorDoCanal(canal).enviar` e grava o desfecho na Mensagem. Nenhuma chamada HTTP ao `automation/`:
 * o worker do `automation/` nem enxerga `mensagem.%` (16-04) e este não usa o `entregar()` dele.
 *
 * A política de tentativas existe para uma coisa: o cliente nunca receber a mesma Mensagem duas vezes por uma
 * tentativa automática. Só o que CERTAMENTE não saiu volta à fila:
 *
 *   - aceito → `gravarEnvio` (`enviada`, `id_externo`) e a linha do outbox `delivered`;
 *   - recusa permanente → `falhou` com o motivo do provedor (ou "O provedor recusou a Mensagem."), sem nova tentativa;
 *   - resposta ambígua (tempo esgotado, resposta perdida: o provedor pode ter enviado) → `falhou` com
 *     a frase de "sem confirmação" (`FRASES_DA_SAIDA.semConfirmacao`) e NUNCA reenvia sozinha: o
 *     reenvio é da pessoa, por "Tentar de novo" (T-16-16);
 *   - transitória (certamente não processada) → volta à fila na escada de `backoff()`, até `maxTentativas`; na
 *     última, `falhou` com "O provedor não respondeu depois de várias tentativas.";
 *   - Canal fora de `conectada` na hora de entregar (B69): não tenta; a Mensagem continua `pendente` e a linha do
 *     outbox vira `failed/CANAL_DESCONECTADO` até o Canal voltar (o 16-06 reenfileira);
 *   - Mensagem que já não está `pendente` (uma corrida com "Tentar de novo"): não reenvia, a linha é `entregue`.
 *
 * O anexo (16-10, 3.9.5): cada anexo `baixado` da Mensagem vai ao provedor por uma URL assinada NOVA do arquivo guardado
 * (`EnvioAoProvedor.anexos`; documento com `download`, para nunca abrir no navegador). Um anexo `baixado: false` numa Mensagem
 * enviada não deveria existir (o envio exige anexo confirmado): se aparecer, a Mensagem `falhou` sem chamar o provedor. Assinar
 * acontece ANTES de a chamada sair, então a falha do bucket é transitória e nada foi enviado.
 *
 * `motivo_falha` é sempre uma frase de produto ou o motivo do provedor passado por `sanitizarErro` (sem `apikey`,
 * sem Bearer, sem documento). Nada aqui loga conteúdo, telefone nem segredo.
 */

import type { Pool, PoolClient } from "pg";
import type { Canal } from "@n1/dominio/crm/canais";
import { ehDocumento } from "@n1/dominio/crm/midia";
import { pool as poolPadrao } from "../persistencia/conexao";
import { EVENTOS } from "../persistencia/outbox";
import {
  criarOutboxWorker,
  sanitizarErro,
  type DesfechoDaEntrega,
  type EntregadorDoOutbox,
  type LinhaOutbox,
  type OutboxWorker,
} from "../persistencia/outbox-worker";
import { criarRepositorioDeCanaisPg } from "../repositorios/crm/canais";
import { criarRepositorioDeContatosPg } from "../repositorios/crm/contatos";
import { criarRepositorioDeConversasPg } from "../repositorios/crm/conversas";
import { criarRepositorioDeMensagensPg } from "../repositorios/crm/mensagens";
import { armazenamentoDeAnexosPadrao, type ArmazenamentoDeAnexos } from "../servicos/armazenamento-de-anexos";
import type { ChavesDoCofre } from "../servicos/cofre";
import { identificadorDoCanal } from "../servicos/crm/conversas";
import { relogioDoSistema, type Relogio } from "../testes/relogio";
import { avisarCrm } from "./avisar";
import { ErroDeProvedor, type AnexoDoEnvio, type EnvioAoProvedor } from "./provedor";
import { canalParaProvedor, provedorDoCanal, registroPadrao, type RegistroDeProvedores } from "./registro";

export type { DesfechoDaEntrega };

const TIPO_DO_EVENTO = "mensagem.enviar.v1";

export const FRASES_DA_SAIDA = {
  semConfirmacao: "Sem confirmação do provedor: confira no WhatsApp antes de tentar de novo.",
  semResposta: "O provedor não respondeu depois de várias tentativas.",
  recusou: "O provedor recusou a Mensagem.",
  provedorNaoLigado: "O provedor deste Canal ainda não está ligado.",
  arquivoIndisponivel: "O arquivo desta Mensagem não está disponível.",
} as const;

/** "O Contato não tem um WhatsApp para esta Conversa." — o rótulo segue o tipo do Canal. */
const rotuloDoCanal: Readonly<Record<string, string>> = { whatsapp: "WhatsApp", instagram: "Instagram", email: "e-mail" };
const semIdentificador = (canal: Pick<Canal, "tipo">) =>
  `O Contato não tem um ${rotuloDoCanal[canal.tipo] ?? "Identificador"} para esta Conversa.`;

export interface DependenciasDoEntregador {
  readonly pool?: () => Pool;
  /** Padrão: a chave mestra do ambiente, lida quando uma linha é entregue (`canalParaProvedor`). */
  readonly chaves?: ChavesDoCofre;
  readonly registro?: RegistroDeProvedores;
  readonly relogio?: Relogio;
  /** O bucket dos anexos. Padrão: o do Supabase (só é tocado quando a Mensagem leva anexo); os testes injetam o falso. */
  readonly armazenamento?: ArmazenamentoDeAnexos;
}

const permanente = (code: string, summary: string): DesfechoDaEntrega => ({ desfecho: "desistir", erro: { code, summary } });

/** Quantas vezes se tenta gravar o `enviada` depois de o provedor ter aceitado (ver `gravarOAceite`). */
const TENTATIVAS_DE_GRAVAR_O_ACEITE = 3;

export function criarEntregadorDeMensagens(deps: DependenciasDoEntregador = {}): EntregadorDoOutbox {
  const pool = deps.pool ?? poolPadrao;
  const registro = deps.registro ?? registroPadrao();
  const relogio = deps.relogio ?? relogioDoSistema;
  const armazenamento = deps.armazenamento ?? armazenamentoDeAnexosPadrao();

  /**
   * Uma transação no cliente do pool: o desfecho da entrega e o aviso ao tempo real (16-07) saem juntos, e a aba só é
   * avisada de uma gravação que o `commit` confirmou.
   */
  async function emTransacao(fn: (cliente: PoolClient) => Promise<void>): Promise<void> {
    const cliente = await pool().connect();
    try {
      await cliente.query("begin");
      await fn(cliente);
      await cliente.query("commit");
    } catch (erro) {
      await cliente.query("rollback").catch(() => undefined);
      throw erro;
    } finally {
      cliente.release();
    }
  }

  /**
   * O provedor JÁ aceitou: se o banco falhar agora, repetir a linha inteira reenviaria ao cliente. Por isso se
   * tenta gravar de novo aqui, e se nada resolver a linha desiste (`ENVIADO_SEM_REGISTRO`) em vez de voltar à fila.
   */
  async function gravarOAceite(workspaceId: string, mensagemId: string, idExterno: string): Promise<DesfechoDaEntrega> {
    let ultimoErro: unknown;
    for (let i = 0; i < TENTATIVAS_DE_GRAVAR_O_ACEITE; i += 1) {
      try {
        await emTransacao(async (cliente) => {
          // `undefined` = já não estava `pendente` (alguém resolveu antes): nada a gravar nem a avisar, e a linha encerra igual.
          const gravada = await criarRepositorioDeMensagensPg(cliente).gravarEnvio(workspaceId, mensagemId, { idExterno, em: relogio.agora().toISOString() });
          if (gravada) await avisarCrm(cliente, { workspaceId, tipo: "mensagem.status", conversaId: gravada.conversaId, mensagemId: gravada.id });
        });
        return { desfecho: "entregue" };
      } catch (erro) {
        ultimoErro = erro;
      }
    }
    return permanente("ENVIADO_SEM_REGISTRO", sanitizarErro(ultimoErro, "ENVIADO_SEM_REGISTRO").summary);
  }

  async function recusarEnvio(workspaceId: string, mensagemId: string, motivo: string, code: string): Promise<DesfechoDaEntrega> {
    await emTransacao(async (cliente) => {
      const marcada = await criarRepositorioDeMensagensPg(cliente).marcarFalha(workspaceId, mensagemId, motivo);
      if (marcada) await avisarCrm(cliente, { workspaceId, tipo: "mensagem.status", conversaId: marcada.conversaId, mensagemId: marcada.id });
    });
    return permanente(code, motivo);
  }

  return async (linha: LinhaOutbox, { ultimaTentativa }): Promise<DesfechoDaEntrega> => {
    const evento = EVENTOS[TIPO_DO_EVENTO].safeParse(linha.payload);
    if (!evento.success) return permanente("PAYLOAD_INVALIDO", "O evento da fila de saída não tem o formato esperado.");
    const workspaceId = linha.workspace_id;
    const mensagens = criarRepositorioDeMensagensPg(pool());

    const mensagem = await mensagens.obter(workspaceId, evento.data.mensagemId);
    if (!mensagem) return permanente("MENSAGEM_NAO_ENCONTRADA", "A Mensagem do evento não existe mais.");
    // Uma corrida com "Tentar de novo" (ou com o retorno do provedor): quem a tirou de `pendente` já a resolveu.
    if (mensagem.statusEntrega !== "pendente") return { desfecho: "entregue" };

    const canal = await criarRepositorioDeCanaisPg(pool()).obter(workspaceId, mensagem.canalId);
    if (!canal) return permanente("CANAL_NAO_ENCONTRADO", "O Canal da Mensagem não existe mais.");
    // B69: Canal que caiu entre enfileirar e entregar. A Mensagem segue `pendente` (nada é descartado).
    if (canal.conexao !== "conectada") {
      return permanente("CANAL_DESCONECTADO", "O Canal não estava conectado na hora de entregar; a Mensagem aguarda a reconexão.");
    }

    const conversa = await criarRepositorioDeConversasPg(pool()).obter(workspaceId, mensagem.conversaId);
    if (!conversa) return permanente("CONVERSA_NAO_ENCONTRADA", "A Conversa da Mensagem não existe mais.");

    // T-16-19: o destino é sempre um Identificador do Contato DA Conversa, de uma leitura com `workspace_id`.
    const contatos = criarRepositorioDeContatosPg(pool());
    const destino = identificadorDoCanal(await contatos.listarIdentificadores(workspaceId, conversa.contatoId), canal);
    if (!destino.ok) return recusarEnvio(workspaceId, mensagem.id, semIdentificador(canal), "CONTATO_SEM_IDENTIFICADOR_DO_CANAL");

    // 16-10: o envio exige anexo confirmado e guardado; um `baixado: false` aqui é dado inconsistente, e nada sai.
    if (mensagem.anexos.some((anexo) => !anexo.baixado || !anexo.objectKey)) {
      return recusarEnvio(workspaceId, mensagem.id, FRASES_DA_SAIDA.arquivoIndisponivel, "ANEXO_INDISPONIVEL");
    }

    const respondida = mensagem.emRespostaAId ? await mensagens.obter(workspaceId, mensagem.emRespostaAId) : undefined;
    const envio: EnvioAoProvedor = {
      mensagemId: mensagem.id,
      destino: { tipo: destino.valor.tipo, valor: destino.valor.valor },
      ...(mensagem.conteudo === null ? {} : { conteudo: mensagem.conteudo }),
      ...(respondida?.idExterno ? { emRespostaAIdExterno: respondida.idExterno } : {}),
    };

    // Antes de a chamada sair (cofre, registro): uma exceção aqui é transitória, nada foi enviado.
    let paraOProvedor;
    let provedor;
    try {
      paraOProvedor = await canalParaProvedor(pool(), deps.chaves, workspaceId, canal);
      provedor = provedorDoCanal(canal, registro);
    } catch (erro) {
      if (erro instanceof ErroDeProvedor && erro.codigo === "PROVEDOR_INDISPONIVEL") {
        return recusarEnvio(workspaceId, mensagem.id, FRASES_DA_SAIDA.provedorNaoLigado, "PROVEDOR_INDISPONIVEL");
      }
      return ultimaTentativa
        ? recusarEnvio(workspaceId, mensagem.id, FRASES_DA_SAIDA.semResposta, "ERRO_DA_ENTREGA")
        : { desfecho: "tentar_de_novo", erro: sanitizarErro(erro, "ERRO_DA_ENTREGA") };
    }

    // 16-10 / 3.9.5: a URL assinada de cada anexo, NOVA a cada tentativa (vale poucos minutos). Antes do `enviar`: uma falha do
    // bucket aqui é transitória e nada foi enviado. A mensagem do erro do bucket pode citar a chave do objeto: não sobe.
    let anexosDoEnvio: AnexoDoEnvio[] = [];
    try {
      anexosDoEnvio = await Promise.all(
        mensagem.anexos.map(async (anexo): Promise<AnexoDoEnvio> => {
          const url = await armazenamento.urlAssinada(anexo.objectKey!, ehDocumento(anexo.tipoDeMidia) ? { download: anexo.nome } : undefined);
          return { urlAssinada: url.downloadUrl, tipoDeMidia: anexo.tipoDeMidia, nome: anexo.nome };
        }),
      );
    } catch {
      return ultimaTentativa
        ? recusarEnvio(workspaceId, mensagem.id, FRASES_DA_SAIDA.semResposta, "ARMAZENAMENTO_INDISPONIVEL")
        : { desfecho: "tentar_de_novo", erro: { code: "ARMAZENAMENTO_INDISPONIVEL", summary: "O arquivo não pôde ser preparado para o envio." } };
    }
    const envioComAnexos: EnvioAoProvedor = anexosDoEnvio.length > 0 ? { ...envio, anexos: anexosDoEnvio } : envio;

    // Dentro do `enviar`: os provedores devolvem `ambiguo` quando podem ter enviado. Uma exceção que escapou de lá
    // não diz se saiu, então vale como ambígua: nunca reenvia sozinha (T-16-16).
    let resultado;
    try {
      resultado = await provedor.enviar(paraOProvedor, envioComAnexos);
    } catch {
      return recusarEnvio(workspaceId, mensagem.id, FRASES_DA_SAIDA.semConfirmacao, "ERRO_NO_ENVIO");
    }

    if (resultado.ok) return gravarOAceite(workspaceId, mensagem.id, resultado.idExterno);

    const erro = sanitizarErro(resultado.motivo, resultado.codigo);
    // Primeiro o ambíguo: o provedor pode ter enviado, então nunca volta à fila (T-16-16).
    if (resultado.ambiguo) return recusarEnvio(workspaceId, mensagem.id, FRASES_DA_SAIDA.semConfirmacao, resultado.codigo);
    if (!resultado.transitorio) {
      return recusarEnvio(workspaceId, mensagem.id, erro.summary.trim() === "" ? FRASES_DA_SAIDA.recusou : erro.summary, resultado.codigo);
    }
    if (ultimaTentativa) return recusarEnvio(workspaceId, mensagem.id, FRASES_DA_SAIDA.semResposta, resultado.codigo);
    return { desfecho: "tentar_de_novo", erro };
  };
}

export interface OpcoesDoWorkerDeSaida extends DependenciasDoEntregador {
  /** Identifica esta instância em `locked_by` — dois processos precisam de valores distintos. */
  readonly workerId: string;
  /**
   * Só as linhas deste Espaço (como no worker do outbox). Em produção fica ausente: um worker global. Os testes o
   * passam para não reivindicar a fila de outro arquivo de teste que rode ao mesmo tempo na mesma tabela.
   */
  readonly workspaceId?: string;
  /** Padrão 5 s: só a reserva; quem acorda o worker é o ouvinte do tempo real (16-07). */
  readonly intervaloMs?: number;
  /** Padrão 5 (5 s, 30 s, 2 min, 10 min: a escada de `backoff()` cortada). */
  readonly maxTentativas?: number;
  readonly registrar?: (nivel: "info" | "warn" | "error", mensagem: string, dados?: Record<string, unknown>) => void;
}

/** Uma linha `delivering` com mais de 2 min é de um worker que caiu. */
const TRAVA_VENCE_EM_MS = 120_000;

/** O worker do outbox só com `mensagem.enviar.v1`, entregando pelo provedor do Canal. */
export function criarWorkerDeSaida(opcoes: OpcoesDoWorkerDeSaida): OutboxWorker {
  const { workerId, workspaceId, intervaloMs, maxTentativas, registrar, ...deps } = opcoes;
  return criarOutboxWorker({
    workerId,
    ...(workspaceId === undefined ? {} : { workspaceId }),
    tiposDeEvento: [TIPO_DO_EVENTO],
    entregador: criarEntregadorDeMensagens(deps),
    recuperarTravasVencidasMs: TRAVA_VENCE_EM_MS,
    maxTentativas: maxTentativas ?? 5,
    intervaloMs: intervaloMs ?? 5_000,
    ...(deps.relogio ? { relogio: deps.relogio } : {}),
    ...(registrar ? { registrar } : {}),
  });
}

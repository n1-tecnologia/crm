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
 * `motivo_falha` é sempre uma frase de produto ou o motivo do provedor passado por `sanitizarErro` (sem `apikey`,
 * sem Bearer, sem documento). Nada aqui loga conteúdo, telefone nem segredo.
 */

import type { Pool } from "pg";
import type { Canal } from "@n1/dominio/crm/canais";
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
import type { ChavesDoCofre } from "../servicos/cofre";
import { identificadorDoCanal } from "../servicos/crm/conversas";
import { relogioDoSistema, type Relogio } from "../testes/relogio";
import { ErroDeProvedor, type EnvioAoProvedor } from "./provedor";
import { canalParaProvedor, provedorDoCanal, registroPadrao, type RegistroDeProvedores } from "./registro";

export type { DesfechoDaEntrega };

const TIPO_DO_EVENTO = "mensagem.enviar.v1";

export const FRASES_DA_SAIDA = {
  semConfirmacao: "Sem confirmação do provedor: confira no WhatsApp antes de tentar de novo.",
  semResposta: "O provedor não respondeu depois de várias tentativas.",
  recusou: "O provedor recusou a Mensagem.",
  provedorNaoLigado: "O provedor deste Canal ainda não está ligado.",
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
}

const permanente = (code: string, summary: string): DesfechoDaEntrega => ({ desfecho: "desistir", erro: { code, summary } });

/** Quantas vezes se tenta gravar o `enviada` depois de o provedor ter aceitado (ver `gravarOAceite`). */
const TENTATIVAS_DE_GRAVAR_O_ACEITE = 3;

export function criarEntregadorDeMensagens(deps: DependenciasDoEntregador = {}): EntregadorDoOutbox {
  const pool = deps.pool ?? poolPadrao;
  const registro = deps.registro ?? registroPadrao();
  const relogio = deps.relogio ?? relogioDoSistema;

  /**
   * O provedor JÁ aceitou: se o banco falhar agora, repetir a linha inteira reenviaria ao cliente. Por isso se
   * tenta gravar de novo aqui, e se nada resolver a linha desiste (`ENVIADO_SEM_REGISTRO`) em vez de voltar à fila.
   */
  async function gravarOAceite(workspaceId: string, mensagemId: string, idExterno: string): Promise<DesfechoDaEntrega> {
    let ultimoErro: unknown;
    for (let i = 0; i < TENTATIVAS_DE_GRAVAR_O_ACEITE; i += 1) {
      try {
        // `undefined` = já não estava `pendente` (alguém resolveu antes): nada a gravar, e a linha encerra igual.
        await criarRepositorioDeMensagensPg(pool()).gravarEnvio(workspaceId, mensagemId, { idExterno, em: relogio.agora().toISOString() });
        return { desfecho: "entregue" };
      } catch (erro) {
        ultimoErro = erro;
      }
    }
    return permanente("ENVIADO_SEM_REGISTRO", sanitizarErro(ultimoErro, "ENVIADO_SEM_REGISTRO").summary);
  }

  async function recusarEnvio(workspaceId: string, mensagemId: string, motivo: string, code: string): Promise<DesfechoDaEntrega> {
    await criarRepositorioDeMensagensPg(pool()).marcarFalha(workspaceId, mensagemId, motivo);
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

    // Dentro do `enviar`: os provedores devolvem `ambiguo` quando podem ter enviado. Uma exceção que escapou de lá
    // não diz se saiu, então vale como ambígua: nunca reenvia sozinha (T-16-16).
    let resultado;
    try {
      resultado = await provedor.enviar(paraOProvedor, envio);
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
  const { workerId, intervaloMs, maxTentativas, registrar, ...deps } = opcoes;
  return criarOutboxWorker({
    workerId,
    tiposDeEvento: [TIPO_DO_EVENTO],
    entregador: criarEntregadorDeMensagens(deps),
    recuperarTravasVencidasMs: TRAVA_VENCE_EM_MS,
    maxTentativas: maxTentativas ?? 5,
    intervaloMs: intervaloMs ?? 5_000,
    ...(deps.relogio ? { relogio: deps.relogio } : {}),
    ...(registrar ? { registrar } : {}),
  });
}

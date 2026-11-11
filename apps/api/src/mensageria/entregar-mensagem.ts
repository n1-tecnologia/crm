/**
 * A saída da mensageria (16-05, 3.7.2, MSG-02): o worker que reivindica `mensagem.enviar.v1`, monta o envio,
 * chama `provedorDoCanal(canal).enviar` e grava o desfecho na Mensagem. Nenhuma chamada HTTP ao `automation/`:
 * o worker do `automation/` nem enxerga `mensagem.%` (16-04) e este não usa o `entregar()` dele.
 *
 * A política de tentativas existe para uma coisa: o cliente nunca receber a mesma Mensagem duas vezes por uma
 * tentativa automática. Só o que CERTAMENTE não saiu volta à fila:
 *
 *   - aceito → `gravarEnvio` (`enviada`, `id_externo`) e a linha do outbox `delivered`; se gravar o aceite falha 3 vezes
 *     (250 ms e 1 s de espera), `falhou` com a frase de "aceitou, mas não deu para registrar" e a linha `failed/ENVIADO_SEM_REGISTRO`:
 *     a tela mostra "Tentar de novo" e o Canal que volta a `conectada` nunca a reabre (WR-02, 16-20);
 *   - recusa permanente → `falhou` com o motivo do provedor (ou "O provedor recusou a Mensagem."), sem nova tentativa;
 *   - resposta ambígua (tempo esgotado, resposta perdida: o provedor pode ter enviado) → `falhou` com
 *     a frase de "sem confirmação" (`FRASES_DA_SAIDA.semConfirmacao`) e NUNCA reenvia sozinha: o
 *     reenvio é da pessoa, por "Tentar de novo" (T-16-16);
 *   - transitória (certamente não processada) → volta à fila na escada de `backoff()`, até `maxTentativas`; na
 *     última, `falhou` com "O provedor não respondeu depois de várias tentativas.";
 *   - Canal fora de `conectada` na hora de entregar (B69): não tenta; a Mensagem continua `pendente` e a linha do
 *     outbox vira `failed/CANAL_DESCONECTADO` até o Canal voltar (o 16-06 reenfileira SÓ essa linha);
 *   - Mensagem que já não está `pendente` (uma corrida com "Tentar de novo"): não reenvia, a linha é `entregue`;
 *   - linha que voltou à fila SEM desfecho (trava vencida: o worker caiu; ou exceção do entregador depois do envio) →
 *     `falhou` sem confirmação, e NUNCA reenvia: o processo pode ter morrido depois do aceite do provedor e antes de
 *     gravá-lo (WR-01, 16-20). O sinal é o `last_error_code` da linha (`TRAVA_VENCIDA` / `ERRO_DO_ENTREGADOR`);
 *   - falha ANTES do envio (leituras do banco, recusas que gravam): certamente não saiu, volta à fila na escada de
 *     `backoff()` com `ERRO_ANTES_DO_ENVIO`; por isso `ERRO_DO_ENTREGADOR` só sobra para a exceção depois do `enviar`.
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
import { identificadorDeResposta } from "@n1/dominio/crm/conversas";
import { numeroParaResponderNoWhatsapp } from "@n1/dominio/crm/normalizacao";
import { ehDocumento } from "@n1/dominio/crm/midia";
import { pool as poolPadrao } from "../persistencia/conexao";
import { EVENTOS } from "../persistencia/outbox";
import {
  CODIGO_DA_TRAVA_VENCIDA,
  CODIGO_DO_ERRO_DO_ENTREGADOR,
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
import { relogioDoSistema, type Relogio } from "../testes/relogio";
import { avisarCrm } from "./avisar";
import { CODIGO_DO_CANAL_DESCONECTADO } from "./fila-de-saida";
import { ErroDeProvedor, type AnexoDoEnvio, type CanalParaProvedor, type EnvioAoProvedor, type ProvedorDeMensageria } from "./provedor";
import { canalParaProvedor, provedorDoCanal, registroPadrao, type RegistroDeProvedores } from "./registro";

export type { DesfechoDaEntrega };

const TIPO_DO_EVENTO = "mensagem.enviar.v1";

export const FRASES_DA_SAIDA = {
  semConfirmacao: "Sem confirmação do provedor: confira no WhatsApp antes de tentar de novo.",
  semResposta: "O provedor não respondeu depois de várias tentativas.",
  aceitaSemRegistro: "O provedor aceitou a Mensagem, mas não deu para registrar o envio: confira no WhatsApp antes de tentar de novo.",
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
  /** A espera entre as tentativas de gravar o aceite (`ESPERAS_PARA_GRAVAR_O_ACEITE_MS`). Padrão: um `setTimeout`; os testes injetam um espião. */
  readonly esperar?: (ms: number) => Promise<void>;
}

const permanente = (code: string, summary: string): DesfechoDaEntrega => ({ desfecho: "desistir", erro: { code, summary } });

/**
 * A espera antes da 2ª e da 3ª tentativa de gravar o `enviada` depois de o provedor ter aceitado (ver `gravarOAceite`):
 * uma queda curta do banco passa em 1,25 s, e a Mensagem não fica presa em "Enviando…" por mais que isso a mais.
 */
export const ESPERAS_PARA_GRAVAR_O_ACEITE_MS: readonly number[] = [250, 1_000];

const esperaPadrao = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function criarEntregadorDeMensagens(deps: DependenciasDoEntregador = {}): EntregadorDoOutbox {
  const pool = deps.pool ?? poolPadrao;
  const registro = deps.registro ?? registroPadrao();
  const relogio = deps.relogio ?? relogioDoSistema;
  const armazenamento = deps.armazenamento ?? armazenamentoDeAnexosPadrao();
  const esperar = deps.esperar ?? esperaPadrao;

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
   * O provedor JÁ aceitou: se o banco falhar agora, repetir a linha inteira reenviaria ao cliente. Por isso se tenta
   * gravar de novo aqui (3 vezes, com `ESPERAS_PARA_GRAVAR_O_ACEITE_MS` entre elas). Se nada resolver, a Mensagem fica
   * `falhou` com `FRASES_DA_SAIDA.aceitaSemRegistro` (a tela sai de "Enviando…" e mostra "Tentar de novo") e a linha
   * desiste (`ENVIADO_SEM_REGISTRO`), nunca volta à fila (WR-02, 16-20). Se nem isso grava, a exceção sobe: o worker
   * a trata como `ERRO_DO_ENTREGADOR` (ou a trava vence) e a guarda de linha sem desfecho fecha a linha como ambígua
   * na volta seguinte, sem reenviar (WR-01).
   */
  async function gravarOAceite(workspaceId: string, mensagemId: string, idExterno: string): Promise<DesfechoDaEntrega> {
    for (let i = 0; i <= ESPERAS_PARA_GRAVAR_O_ACEITE_MS.length; i += 1) {
      try {
        await emTransacao(async (cliente) => {
          // `undefined` = já não estava `pendente` (alguém resolveu antes): nada a gravar nem a avisar, e a linha encerra igual.
          const gravada = await criarRepositorioDeMensagensPg(cliente).gravarEnvio(workspaceId, mensagemId, { idExterno, em: relogio.agora().toISOString() });
          if (gravada) await avisarCrm(cliente, { workspaceId, tipo: "mensagem.status", conversaId: gravada.conversaId, mensagemId: gravada.id });
        });
        return { desfecho: "entregue" };
      } catch {
        const espera = ESPERAS_PARA_GRAVAR_O_ACEITE_MS[i];
        if (espera !== undefined) await esperar(espera);
      }
    }
    return recusarEnvio(workspaceId, mensagemId, FRASES_DA_SAIDA.aceitaSemRegistro, "ENVIADO_SEM_REGISTRO");
  }

  async function recusarEnvio(workspaceId: string, mensagemId: string, motivo: string, code: string): Promise<DesfechoDaEntrega> {
    await emTransacao(async (cliente) => {
      const marcada = await criarRepositorioDeMensagensPg(cliente).marcarFalha(workspaceId, mensagemId, motivo);
      if (marcada) await avisarCrm(cliente, { workspaceId, tipo: "mensagem.status", conversaId: marcada.conversaId, mensagemId: marcada.id });
    });
    return permanente(code, motivo);
  }

  /** O que o preparo devolve: ou um desfecho já decidido (nada vai ao provedor), ou tudo que o `enviar` precisa. */
  type Preparo =
    | { readonly pronto: false; readonly desfecho: DesfechoDaEntrega }
    | {
        readonly pronto: true;
        readonly mensagemId: string;
        readonly provedor: ProvedorDeMensageria;
        readonly paraOProvedor: CanalParaProvedor;
        readonly envio: EnvioAoProvedor;
      };
  const encerra = (desfecho: DesfechoDaEntrega): Preparo => ({ pronto: false, desfecho });

  /**
   * Tudo que roda ANTES de `provedor.enviar`: as leituras, as conferências e as recusas que gravam. Uma exceção daqui
   * (o banco que caiu) é de QUEM CERTAMENTE NÃO ENVIOU: quem chama a trata como transitória (`ERRO_ANTES_DO_ENVIO`).
   */
  async function preparar(linha: LinhaOutbox, ultimaTentativa: boolean): Promise<Preparo> {
    const evento = EVENTOS[TIPO_DO_EVENTO].safeParse(linha.payload);
    if (!evento.success) return encerra(permanente("PAYLOAD_INVALIDO", "O evento da fila de saída não tem o formato esperado."));
    const workspaceId = linha.workspace_id;
    const mensagens = criarRepositorioDeMensagensPg(pool());

    const mensagem = await mensagens.obter(workspaceId, evento.data.mensagemId);
    if (!mensagem) return encerra(permanente("MENSAGEM_NAO_ENCONTRADA", "A Mensagem do evento não existe mais."));
    // Uma corrida com "Tentar de novo" (ou com o retorno do provedor): quem a tirou de `pendente` já a resolveu.
    if (mensagem.statusEntrega !== "pendente") return encerra({ desfecho: "entregue" });

    const canal = await criarRepositorioDeCanaisPg(pool()).obter(workspaceId, mensagem.canalId);
    if (!canal) return encerra(permanente("CANAL_NAO_ENCONTRADO", "O Canal da Mensagem não existe mais."));
    // B69: Canal que caiu entre enfileirar e entregar. A Mensagem segue `pendente` (nada é descartado).
    if (canal.conexao !== "conectada") {
      return encerra(permanente(CODIGO_DO_CANAL_DESCONECTADO, "O Canal não estava conectado na hora de entregar; a Mensagem aguarda a reconexão."));
    }

    const conversa = await criarRepositorioDeConversasPg(pool()).obter(workspaceId, mensagem.conversaId);
    if (!conversa) return encerra(permanente("CONVERSA_NAO_ENCONTRADA", "A Conversa da Mensagem não existe mais."));

    // T-16-19: o destino é sempre um Identificador do Contato DA Conversa, de uma leitura com `workspace_id`. WR-04: a
    // resposta vai por onde o Contato escreveu por último nesta Conversa; o id de quem escreveu só escolhe DENTRO dessa
    // lista (um número que passou a ser de outro Contato some dela e a resposta volta ao principal).
    const contatos = criarRepositorioDeContatosPg(pool());
    const identificadoresDoContato = await contatos.listarIdentificadores(workspaceId, conversa.contatoId);
    const idDeQuemEscreveu = await mensagens.identificadorDaUltimaRecebida(workspaceId, conversa.id);
    const destino = identificadorDeResposta(identificadoresDoContato, canal, idDeQuemEscreveu);
    if (!destino) return encerra(await recusarEnvio(workspaceId, mensagem.id, semIdentificador(canal), "CONTATO_SEM_IDENTIFICADOR_DO_CANAL"));
    // 4.4.3: o WhatsApp antigo entrega o celular sem o nono dígito e o Identificador guarda a forma com ele; a resposta sai pelo
    // número como o WhatsApp o conhece (o da última recebida), só quando é o mesmo celular do Identificador.
    const valorDoDestino =
      destino.tipo === "whatsapp"
        ? numeroParaResponderNoWhatsapp(destino.valor, await mensagens.remetenteExternoDaUltimaRecebida(workspaceId, conversa.id))
        : destino.valor;

    // 16-10: o envio exige anexo confirmado e guardado; um `baixado: false` aqui é dado inconsistente, e nada sai.
    if (mensagem.anexos.some((anexo) => !anexo.baixado || !anexo.objectKey)) {
      return encerra(await recusarEnvio(workspaceId, mensagem.id, FRASES_DA_SAIDA.arquivoIndisponivel, "ANEXO_INDISPONIVEL"));
    }

    const respondida = mensagem.emRespostaAId ? await mensagens.obter(workspaceId, mensagem.emRespostaAId) : undefined;
    const envio: EnvioAoProvedor = {
      mensagemId: mensagem.id,
      destino: { tipo: destino.tipo, valor: valorDoDestino },
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
        return encerra(await recusarEnvio(workspaceId, mensagem.id, FRASES_DA_SAIDA.provedorNaoLigado, "PROVEDOR_INDISPONIVEL"));
      }
      return encerra(
        ultimaTentativa
          ? await recusarEnvio(workspaceId, mensagem.id, FRASES_DA_SAIDA.semResposta, "ERRO_DA_ENTREGA")
          : { desfecho: "tentar_de_novo", erro: sanitizarErro(erro, "ERRO_DA_ENTREGA") },
      );
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
      return encerra(
        ultimaTentativa
          ? await recusarEnvio(workspaceId, mensagem.id, FRASES_DA_SAIDA.semResposta, "ARMAZENAMENTO_INDISPONIVEL")
          : { desfecho: "tentar_de_novo", erro: { code: "ARMAZENAMENTO_INDISPONIVEL", summary: "O arquivo não pôde ser preparado para o envio." } },
      );
    }
    const envioComAnexos: EnvioAoProvedor = anexosDoEnvio.length > 0 ? { ...envio, anexos: anexosDoEnvio } : envio;

    return { pronto: true, mensagemId: mensagem.id, provedor, paraOProvedor, envio: envioComAnexos };
  }

  return async (linha: LinhaOutbox, { ultimaTentativa }): Promise<DesfechoDaEntrega> => {
    const workspaceId = linha.workspace_id;

    let preparo: Preparo;
    try {
      preparo = await preparar(linha, ultimaTentativa);
    } catch (erro) {
      // O que falhou foi ANTES do `enviar` (leitura, recusa que grava): certamente não saiu, então volta à fila como qualquer
      // transitória. `sanitizarErro`: a mensagem do driver pode citar host e usuário do banco.
      const evento = EVENTOS[TIPO_DO_EVENTO].safeParse(linha.payload);
      if (ultimaTentativa && evento.success) {
        return recusarEnvio(workspaceId, evento.data.mensagemId, FRASES_DA_SAIDA.semResposta, "ERRO_ANTES_DO_ENVIO");
      }
      return { desfecho: "tentar_de_novo", erro: sanitizarErro(erro, "ERRO_ANTES_DO_ENVIO") };
    }
    if (!preparo.pronto) return preparo.desfecho;
    const { mensagemId, provedor, paraOProvedor, envio } = preparo;

    // WR-01 (16-20): a linha que voltou à fila SEM desfecho (o worker caiu com ela, ou uma exceção escapou do entregador
    // depois do `enviar`) pode já ter chegado ao cliente. Nunca reenvia sozinha: a pessoa confere e usa "Tentar de novo".
    // Fica depois das conferências, para uma linha que voltou por uma recusa que não gravou receber a frase certa agora.
    if (linha.last_error_code === CODIGO_DA_TRAVA_VENCIDA || linha.last_error_code === CODIGO_DO_ERRO_DO_ENTREGADOR) {
      return recusarEnvio(workspaceId, mensagemId, FRASES_DA_SAIDA.semConfirmacao, "ENVIO_SEM_DESFECHO");
    }

    // Dentro do `enviar`: os provedores devolvem `ambiguo` quando podem ter enviado. Uma exceção que escapou de lá
    // não diz se saiu, então vale como ambígua: nunca reenvia sozinha (T-16-16).
    let resultado;
    try {
      resultado = await provedor.enviar(paraOProvedor, envio);
    } catch {
      return recusarEnvio(workspaceId, mensagemId, FRASES_DA_SAIDA.semConfirmacao, "ERRO_NO_ENVIO");
    }

    if (resultado.ok) return gravarOAceite(workspaceId, mensagemId, resultado.idExterno);

    const erro = sanitizarErro(resultado.motivo, resultado.codigo);
    // Primeiro o ambíguo: o provedor pode ter enviado, então nunca volta à fila (T-16-16).
    if (resultado.ambiguo) return recusarEnvio(workspaceId, mensagemId, FRASES_DA_SAIDA.semConfirmacao, resultado.codigo);
    if (!resultado.transitorio) {
      return recusarEnvio(workspaceId, mensagemId, erro.summary.trim() === "" ? FRASES_DA_SAIDA.recusou : erro.summary, resultado.codigo);
    }
    if (ultimaTentativa) return recusarEnvio(workspaceId, mensagemId, FRASES_DA_SAIDA.semResposta, resultado.codigo);
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

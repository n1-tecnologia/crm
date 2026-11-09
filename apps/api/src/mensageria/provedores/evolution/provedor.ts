/**
 * O provedor da Evolution v2.3.7 (16-12, D-16-04, D-16-06, MSG-06): a implementação de `ProvedorDeMensageria` para o
 * Canal `whatsapp-nao-oficial`, sobre o cliente (`cliente.ts`) e o tradutor (`traduzir.ts`).
 *
 * A credencial do Canal no cofre (`tipo = "whatsapp-nao-oficial"`) é o JSON `{ instancia, apikey }`, com o TOKEN da
 * instância (não a chave global). A base da URL é sempre a `EVOLUTION_URL` com que o provedor foi criado: nenhuma URL
 * de corpo de webhook é seguida (sem SSRF).
 *
 * O webhook (D-16-06): `verificarChamada` confere o cabeçalho `x-n1-webhook-segredo` em tempo constante contra o segredo
 * do Canal E que o `instance` do corpo é a instância da credencial; qualquer diferença é a mesma recusa, de modo que o
 * segredo certo com a instância de outro Canal não passa (T-16-43).
 *
 * O envio nunca reenvia sozinho o que pode ter saído: tempo esgotado, resposta perdida e 500 são `ambiguo`; só o que
 * certamente não saiu (conexão recusada, 429, 502, 503, 504) é `transitorio`.
 *
 * Nada aqui loga corpo, texto, número, segredo nem `apikey`.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import type { ConexaoDoCanal } from "@n1/dominio/crm/canais";
import { categoriaDaMidia, normalizarTipoDeMidia } from "@n1/dominio/crm/midia";
import {
  CABECALHO_DO_SEGREDO,
  ErroDeProvedor,
  type CanalParaProvedor,
  type ChamadaDoWebhook,
  type EnvioAoProvedor,
  type EventoDoProvedor,
  type MidiaBaixada,
  type ProvedorDeMensageria,
  type ResultadoDoEnvio,
} from "../../provedor";
import { criarClienteDaEvolution, ErroDaEvolution, type RespostaDaEvolution } from "./cliente";
import { traduzirChamadaDaEvolution } from "./traduzir";

export interface OpcoesDoProvedorEvolution {
  readonly url: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

interface CredencialDaEvolution {
  readonly instancia: string;
  readonly apikey: string;
}

/** A credencial do Canal: `{ instancia, apikey }` em JSON. Qualquer outra forma é "sem credencial". */
function lerCredencial(canal: CanalParaProvedor): CredencialDaEvolution | undefined {
  if (canal.credencial === undefined || canal.credencial === "") return undefined;
  try {
    const lida: unknown = JSON.parse(canal.credencial);
    if (typeof lida !== "object" || lida === null) return undefined;
    const { instancia, apikey } = lida as { instancia?: unknown; apikey?: unknown };
    if (typeof instancia !== "string" || instancia === "" || typeof apikey !== "string" || apikey === "") return undefined;
    return { instancia, apikey };
  } catch {
    return undefined;
  }
}

function iguais(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

const FALHAS = {
  semCredencial: { codigo: "CREDENCIAL_AUSENTE", motivo: "O Canal não tem a credencial da Evolution." },
} as const;

function recusa(codigo: string, motivo: string): ResultadoDoEnvio {
  return { ok: false, transitorio: false, codigo, motivo };
}

/** O desfecho de um envio a partir do status HTTP da Evolution. Nunca lê nem repete o corpo da resposta. */
function resultadoDaResposta(resposta: RespostaDaEvolution): ResultadoDoEnvio {
  const { status } = resposta;
  if (status >= 200 && status < 300) {
    if (resposta.idExterno !== undefined) return { ok: true, idExterno: resposta.idExterno };
    // Aceito mas sem o id: saiu, e não há como deduplicar nem acompanhar. Nunca reenvia.
    return { ok: false, transitorio: false, ambiguo: true, codigo: "RESPOSTA_SEM_ID", motivo: "A Evolution aceitou o envio sem devolver o id da mensagem." };
  }
  const codigo = `HTTP_${status}`;
  if (status === 400) {
    return resposta.semWhatsapp === true
      ? recusa("NUMERO_SEM_WHATSAPP", "Este número não tem WhatsApp.")
      : recusa(codigo, "A Evolution recusou o envio.");
  }
  if (status === 401 || status === 403) return recusa(codigo, "A Evolution recusou a credencial do Canal.");
  if (status === 404) return recusa(codigo, "A instância da Evolution não foi encontrada.");
  if (status === 429 || status === 502 || status === 503 || status === 504) {
    return { ok: false, transitorio: true, codigo, motivo: "A Evolution está indisponível no momento." };
  }
  // 500 e qualquer outro 5xx: a Evolution pode ter enviado antes de falhar.
  if (status >= 500) return { ok: false, transitorio: false, ambiguo: true, codigo, motivo: "A Evolution falhou durante o envio." };
  return recusa(codigo, "A Evolution recusou o envio.");
}

function resultadoDoErro(erro: unknown): ResultadoDoEnvio {
  if (erro instanceof ErroDaEvolution) {
    if (erro.tipo === "rede") return { ok: false, transitorio: true, codigo: "EVOLUTION_INDISPONIVEL", motivo: "A Evolution não está acessível no momento." };
    if (erro.tipo === "tempo_esgotado") {
      return { ok: false, transitorio: false, ambiguo: true, codigo: "TEMPO_ESGOTADO", motivo: "A Evolution não respondeu a tempo." };
    }
    return { ok: false, transitorio: false, ambiguo: true, codigo: "RESPOSTA_PERDIDA", motivo: "A conexão com a Evolution caiu antes da resposta." };
  }
  // Uma falha que não é nossa nem do transporte não diz se saiu: vale como ambígua.
  return { ok: false, transitorio: false, ambiguo: true, codigo: "ERRO_NO_ENVIO", motivo: "Não foi possível confirmar o envio." };
}

/** O número só com dígitos, como o `sendText` espera (sem `+`). */
function digitosDoDestino(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function criarProvedorEvolution(opcoes: OpcoesDoProvedorEvolution): ProvedorDeMensageria {
  const cliente = criarClienteDaEvolution({
    url: opcoes.url,
    ...(opcoes.fetchImpl ? { fetchImpl: opcoes.fetchImpl } : {}),
    ...(opcoes.timeoutMs === undefined ? {} : { timeoutMs: opcoes.timeoutMs }),
  });

  return {
    provedor: "whatsapp-nao-oficial",

    verificarChamada(chamada: ChamadaDoWebhook, canal: CanalParaProvedor): boolean {
      const esperado = canal.segredoDoWebhook ?? "";
      const recebido = chamada.cabecalhos[CABECALHO_DO_SEGREDO] ?? "";
      // As duas conferências rodam sempre: nenhuma curto-circuita a outra.
      const segredoConfere = esperado !== "" && recebido !== "" && iguais(recebido, esperado);
      const credencial = lerCredencial(canal);
      const corpo = chamada.corpo;
      const instanciaDoCorpo = typeof corpo === "object" && corpo !== null ? (corpo as { instance?: unknown }).instance : undefined;
      const instanciaConfere = credencial !== undefined && typeof instanciaDoCorpo === "string" && iguais(instanciaDoCorpo, credencial.instancia);
      return segredoConfere && instanciaConfere;
    },

    interpretarChamada(corpo: unknown, canal: CanalParaProvedor): readonly EventoDoProvedor[] {
      const credencial = lerCredencial(canal);
      if (!credencial) return [{ tipo: "ignorado", motivo: "sem_credencial" }];
      const eventos = traduzirChamadaDaEvolution(corpo, credencial.instancia);
      return eventos.length > 0 ? eventos : [{ tipo: "ignorado", motivo: "evento_nao_tratado" }];
    },

    chaveDaChamada(corpo: unknown): string | undefined {
      if (typeof corpo !== "object" || corpo === null) return undefined;
      const dados = (corpo as { data?: unknown }).data;
      const chave = typeof dados === "object" && dados !== null ? (dados as { key?: unknown }).key : undefined;
      const id = typeof chave === "object" && chave !== null ? (chave as { id?: unknown }).id : undefined;
      return typeof id === "string" && id !== "" ? id : undefined;
    },

    async enviar(canal: CanalParaProvedor, envio: EnvioAoProvedor): Promise<ResultadoDoEnvio> {
      const credencial = lerCredencial(canal);
      if (!credencial) return recusa(FALHAS.semCredencial.codigo, FALHAS.semCredencial.motivo);
      if (envio.destino.tipo !== "whatsapp") return recusa("DESTINO_INVALIDO", "Este Canal só envia para um número de WhatsApp.");
      const numero = digitosDoDestino(envio.destino.valor);
      const texto = envio.conteudo ?? "";
      const anexos = envio.anexos ?? [];
      const { apikey, instancia } = credencial;
      try {
        if (anexos.length === 0) {
          if (texto.trim() === "") return recusa("MENSAGEM_VAZIA", "A Mensagem está vazia.");
          return resultadoDaResposta(await cliente.enviarTexto(apikey, instancia, { numero, texto }));
        }
        if (anexos.length > 1) return recusa("ANEXO_INVALIDO", "Uma Mensagem leva um arquivo por vez.");
        const anexo = anexos[0]!;
        const categoria = categoriaDaMidia(anexo.tipoDeMidia);
        if (categoria === undefined) return recusa("TIPO_NAO_ENVIADO", "Este tipo de arquivo não é enviado pelo WhatsApp.");

        if (categoria === "audio") {
          // A mensagem de voz não tem legenda: o texto, se houver, vai em seguida como mensagem à parte.
          const audio = resultadoDaResposta(await cliente.enviarAudio(apikey, instancia, { numero, audio: anexo.urlAssinada }));
          if (!audio.ok || texto.trim() === "") return audio;
          const depois = resultadoDaResposta(await cliente.enviarTexto(apikey, instancia, { numero, texto }));
          // O áudio já saiu: se o texto não se confirma, a Mensagem não volta à fila (reenviaria o áudio).
          if (!depois.ok) return { ok: false, transitorio: false, ambiguo: true, codigo: "TEXTO_NAO_CONFIRMADO", motivo: "O áudio saiu, mas o texto não pôde ser confirmado." };
          return audio;
        }

        // Um anexo com texto é UMA mensagem do WhatsApp: o texto vira a legenda do arquivo.
        return resultadoDaResposta(
          await cliente.enviarMidia(apikey, instancia, {
            numero,
            mediatype: categoria === "image" || categoria === "video" ? categoria : "document",
            media: anexo.urlAssinada,
            mimetype: normalizarTipoDeMidia(anexo.tipoDeMidia),
            fileName: anexo.nome,
            ...(texto.trim() === "" ? {} : { caption: texto }),
          }),
        );
      } catch (erro) {
        return resultadoDoErro(erro);
      }
    },

    async baixarMidia(canal: CanalParaProvedor, referenciaNoProvedor: string, opcoes: { tetoBytes: number }): Promise<MidiaBaixada> {
      const credencial = lerCredencial(canal);
      if (!credencial) throw new ErroDeProvedor("CREDENCIAL_AUSENTE", FALHAS.semCredencial.motivo);
      // A referência é o `{ key, message }` do webhook (traduzir.ts): é o que a Evolution precisa para achar a mídia.
      let message: unknown;
      try {
        message = JSON.parse(referenciaNoProvedor);
      } catch {
        message = undefined;
      }
      if (typeof message !== "object" || message === null) throw new ErroDeProvedor("MIDIA_INDISPONIVEL", "A mídia não está disponível no provedor.");
      try {
        const midia = await cliente.baixarMidia(credencial.apikey, credencial.instancia, { message, tetoBytes: opcoes.tetoBytes });
        return { bytes: midia.bytes, tipoDeMidia: midia.mimetype, ...(midia.fileName === undefined ? {} : { nome: midia.fileName }) };
      } catch (erro) {
        if (erro instanceof ErroDeProvedor) throw erro;
        if (erro instanceof ErroDaEvolution && erro.tipo === "http") {
          const status = erro.status ?? 0;
          // Fora do ar ou sobrecarregada: passa sozinha. Credencial recusada: nunca passa. O resto (404, 400): a mídia já não existe.
          if (status === 429 || status >= 500) throw new ErroDeProvedor("PROVEDOR_INDISPONIVEL", "A Evolution está indisponível no momento.");
          if (status === 401 || status === 403) throw new ErroDeProvedor("CREDENCIAL_AUSENTE", "A Evolution recusou a credencial do Canal.");
          throw new ErroDeProvedor("MIDIA_INDISPONIVEL", "A mídia não está disponível no provedor.");
        }
        throw new ErroDeProvedor("PROVEDOR_INDISPONIVEL", "A Evolution não respondeu.");
      }
    },

    async estadoDaConexao(canal: CanalParaProvedor): Promise<ConexaoDoCanal> {
      const credencial = lerCredencial(canal);
      if (!credencial) return "com_erro";
      try {
        const estado = await cliente.estadoDaConexao(credencial.apikey, credencial.instancia);
        return estado === "open" ? "conectada" : "desconectada";
      } catch (erro) {
        if (erro instanceof ErroDaEvolution && erro.tipo === "http") return "com_erro";
        throw new ErroDeProvedor("PROVEDOR_INDISPONIVEL", "A Evolution não respondeu.");
      }
    },
  };
}

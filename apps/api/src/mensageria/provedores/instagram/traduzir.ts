/**
 * O webhook do Instagram em `EventoDoProvedor` (Sessão 8, 8.3.2): puro, sem rede nem banco, como o tradutor da
 * Evolution. Corpo fora do formato vira `ignorado`, nunca exceção.
 *
 *   - `message` de quem escreveu → `mensagem`. O remetente sai como `igsid:<IGSID>`: o webhook nunca traz o @, e quem o
 *     troca pelo @ do perfil é `resolverRemetente`, antes de `receberMensagem`. O prefixo não passa por
 *     `normalizarInstagram` (tem `:`), então um IGSID que escapasse da troca seria recusado, nunca viraria o @ de alguém;
 *   - `message.is_echo` (o que a própria conta mandou, pela plataforma ou pelo aplicativo) → `ignorado:eco`;
 *   - `read` → `status` `lida` da Mensagem com aquele `mid`;
 *   - reação, mensagem apagada, edição, postback e referral → `ignorado` com o motivo.
 *
 * Só conta o `entry` da conta do Canal (`entry[].id` = o `contaId` da credencial): a rota da Meta já guarda um evento
 * por linha da fila, e um corpo com a conta de outro Canal não vira Mensagem neste.
 *
 * A mídia: `image`, `video`, `audio` e `file` viram anexo com a URL da Meta como referência (`baixarMidia` confere o
 * host). Publicação compartilhada, reel e menção no story não são arquivo: sem texto nem anexo, a Mensagem leva a frase
 * de `TEXTO_DE_MENSAGEM_NAO_SUPORTADA`, para o atendente ver que a pessoa mandou algo.
 */

import type { AnexoRecebidoDoProvedor } from "@n1/dominio/crm/recebimento";
import type { EventoDoProvedor } from "../../provedor";

/** O prefixo do remetente que só `resolverRemetente` entende. */
export const PREFIXO_DO_IGSID = "igsid:";

export const TEXTO_DE_MENSAGEM_NAO_SUPORTADA = "(O Instagram não repassa o conteúdo desta mensagem. Veja no aplicativo.)";

const texto = (valor: unknown): string | undefined =>
  typeof valor === "string" && valor.trim() !== "" ? valor : typeof valor === "number" && Number.isFinite(valor) ? String(valor) : undefined;

const objeto = (valor: unknown): Record<string, unknown> | undefined =>
  typeof valor === "object" && valor !== null && !Array.isArray(valor) ? (valor as Record<string, unknown>) : undefined;

/** A Meta manda o instante em milissegundos; um valor pequeno demais é segundo. Sem instante, `undefined`. */
function instante(valor: unknown): string | undefined {
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) return undefined;
  const data = new Date(valor < 1e12 ? valor * 1000 : valor);
  return Number.isNaN(data.getTime()) ? undefined : data.toISOString();
}

/** O tipo declarado de cada anexo que é arquivo: a guarda de mídia baixa, confere o tipo devolvido e a assinatura. */
const ANEXOS_QUE_SAO_ARQUIVO: Readonly<Record<string, { readonly tipoDeMidia: string; readonly nome: string }>> = {
  image: { tipoDeMidia: "image/jpeg", nome: "Imagem do Instagram" },
  video: { tipoDeMidia: "video/mp4", nome: "Vídeo do Instagram" },
  audio: { tipoDeMidia: "audio/mp4", nome: "Áudio do Instagram" },
  file: { tipoDeMidia: "application/pdf", nome: "Arquivo do Instagram" },
};

function anexosDe(mensagem: Record<string, unknown>): AnexoRecebidoDoProvedor[] {
  const lista = Array.isArray(mensagem.attachments) ? mensagem.attachments : [];
  return lista.flatMap((bruto) => {
    const anexo = objeto(bruto);
    const conhecido = ANEXOS_QUE_SAO_ARQUIVO[texto(anexo?.type) ?? ""];
    const url = texto(objeto(anexo?.payload)?.url);
    if (!conhecido || !url) return [];
    return [{ referenciaNoProvedor: url, tipoDeMidia: conhecido.tipoDeMidia, nome: conhecido.nome }];
  });
}

/** Os itens de um `entry`: `messaging` nos eventos de verdade, `changes` no botão "Testar" do painel da Meta. */
export function itensDaEntrada(entrada: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(entrada.messaging)) return entrada.messaging.map(objeto).filter((i): i is Record<string, unknown> => !!i);
  if (Array.isArray(entrada.changes)) {
    return entrada.changes
      .map(objeto)
      .filter((c): c is Record<string, unknown> => !!c && c.field === "messages")
      .map((c) => objeto(c.value))
      .filter((v): v is Record<string, unknown> => !!v);
  }
  return [];
}

/** As entradas de um corpo `object: "instagram"`, com o id da conta; qualquer outra forma, nenhuma. */
export function entradasDoCorpo(corpo: unknown): { readonly contaId: string; readonly entrada: Record<string, unknown> }[] {
  const raiz = objeto(corpo);
  if (!raiz || raiz.object !== "instagram" || !Array.isArray(raiz.entry)) return [];
  return raiz.entry.flatMap((bruta) => {
    const entrada = objeto(bruta);
    const contaId = texto(entrada?.id);
    return entrada && contaId ? [{ contaId, entrada }] : [];
  });
}

function traduzirItem(item: Record<string, unknown>): EventoDoProvedor {
  const mensagem = objeto(item.message);
  const leitura = objeto(item.read);
  const quando = instante(item.timestamp);

  if (mensagem) {
    const idExterno = texto(mensagem.mid);
    if (!idExterno) return { tipo: "ignorado", motivo: "sem_id" };
    if (mensagem.is_echo === true) return { tipo: "ignorado", motivo: "eco", idExterno };
    if (mensagem.is_deleted === true) return { tipo: "ignorado", motivo: "apagada", idExterno };
    const igsid = texto(objeto(item.sender)?.id);
    if (!igsid) return { tipo: "ignorado", motivo: "sem_remetente", idExterno };
    if (!quando) return { tipo: "ignorado", motivo: "sem_instante", idExterno };

    const anexos = anexosDe(mensagem);
    const conteudo = texto(mensagem.text) ?? (anexos.length === 0 ? TEXTO_DE_MENSAGEM_NAO_SUPORTADA : undefined);
    const emResposta = texto(objeto(mensagem.reply_to)?.mid);
    return {
      tipo: "mensagem",
      idExterno,
      criadoEm: quando,
      remetente: { tipo: "instagram", valor: `${PREFIXO_DO_IGSID}${igsid}` },
      ...(conteudo === undefined ? {} : { conteudo }),
      ...(anexos.length > 0 ? { anexos } : {}),
      ...(emResposta ? { emRespostaAIdExterno: emResposta } : {}),
      cargaBruta: item,
    };
  }

  if (leitura) {
    const idExterno = texto(leitura.mid);
    if (!idExterno) return { tipo: "ignorado", motivo: "leitura_sem_id" };
    // Sem instante, a data inválida faz o processador usar o relógio dele (`aplicarStatus`).
    return { tipo: "status", idExterno, status: "lida", em: quando ?? "" };
  }

  if (objeto(item.reaction)) return { tipo: "ignorado", motivo: "reacao" };
  if (objeto(item.message_edit)) return { tipo: "ignorado", motivo: "edicao" };
  if (objeto(item.postback)) return { tipo: "ignorado", motivo: "postback" };
  if (objeto(item.referral)) return { tipo: "ignorado", motivo: "referral" };
  return { tipo: "ignorado", motivo: "evento_nao_tratado" };
}

/** O corpo em eventos da conta `contaId`. Nunca lança; sempre devolve pelo menos um evento. */
export function traduzirChamadaDoInstagram(corpo: unknown, contaId: string): EventoDoProvedor[] {
  const entradas = entradasDoCorpo(corpo);
  if (entradas.length === 0) return [{ tipo: "ignorado", motivo: "corpo_invalido" }];
  const daConta = entradas.filter((e) => e.contaId === contaId);
  if (daConta.length === 0) return [{ tipo: "ignorado", motivo: "outra_conta" }];
  const eventos = daConta.flatMap(({ entrada }) => itensDaEntrada(entrada).map(traduzirItem));
  return eventos.length > 0 ? eventos : [{ tipo: "ignorado", motivo: "evento_nao_tratado" }];
}

/** A chave de deduplicação: o `mid` da mensagem, ou `lida:<mid>` da leitura. A rota guarda um item por linha. */
export function chaveDoItem(corpo: unknown): string | undefined {
  for (const { entrada } of entradasDoCorpo(corpo)) {
    for (const item of itensDaEntrada(entrada)) {
      const mid = texto(objeto(item.message)?.mid);
      if (mid) return mid;
      const lida = texto(objeto(item.read)?.mid);
      if (lida) return `lida:${lida}`;
    }
  }
  return undefined;
}

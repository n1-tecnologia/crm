/**
 * O webhook do WhatsApp oficial em `EventoDoProvedor` (Sessão 7, 7.2.4): puro, sem rede nem banco, como o tradutor do
 * Instagram e o da Evolution. Corpo fora do formato vira `ignorado`, nunca exceção.
 *
 * O corpo da Meta é `{ object: "whatsapp_business_account", entry: [{ id: <WABA>, changes: [{ field, value }] }] }`. Só o
 * campo `messages` interessa aqui (o `message_template_status_update` é da sincronização de modelos, 7.3). Cada `value`
 * traz o número (`metadata.phone_number_id`), quem escreveu (`contacts`) e dois vetores:
 *
 *   - `messages[]` de quem escreveu → `mensagem` (texto, imagem, áudio, vídeo, documento, figurinha, localização, contato,
 *     resposta de botão ou de lista) ou `reacao` (`reaction`);
 *   - `statuses[]` do que foi enviado → `status`: `sent` → `enviada`, `delivered` → `entregue`, `read` → `lida`,
 *     `failed` → `falhou` (com o motivo curto que a Meta dá).
 *
 * Só conta o `value` do número do Canal (`metadata.phone_number_id` = o `phoneNumberId` da credencial): a rota da Meta já
 * guarda um evento por linha da fila, e um corpo com o número de outro Canal não vira Mensagem neste.
 *
 * A mídia chega por ID (`image.id`, ...), não por URL: o ID é a `referenciaNoProvedor`, e `baixarMidia` troca o ID pelo
 * endereço temporário com o token do Canal. O tipo declarado (`mime_type`) é só uma dica: a guarda de mídia confere o
 * tipo devolvido e a assinatura do arquivo.
 *
 * NÃO conferido contra a Meta real: os nomes dos campos seguem a documentação da Cloud API.
 */

import type { AnexoRecebidoDoProvedor } from "@n1/dominio/crm/recebimento";
import type { EventoDoProvedor } from "../../provedor";

export const TEXTO_DE_MENSAGEM_NAO_SUPORTADA = "(O WhatsApp não repassa o conteúdo desta mensagem. Veja no aplicativo.)";

const texto = (valor: unknown): string | undefined =>
  typeof valor === "string" && valor.trim() !== "" ? valor : typeof valor === "number" && Number.isFinite(valor) ? String(valor) : undefined;

const objeto = (valor: unknown): Record<string, unknown> | undefined =>
  typeof valor === "object" && valor !== null && !Array.isArray(valor) ? (valor as Record<string, unknown>) : undefined;

/** A Meta manda o instante em segundos, como texto ou número. Sem instante válido, `undefined`. */
function instante(valor: unknown): string | undefined {
  const segundos = typeof valor === "string" ? Number(valor) : typeof valor === "number" ? valor : Number.NaN;
  if (!Number.isFinite(segundos) || segundos <= 0) return undefined;
  const data = new Date(segundos < 1e12 ? segundos * 1000 : segundos);
  return Number.isNaN(data.getTime()) ? undefined : data.toISOString();
}

/** Um `value` de `changes[]` do campo `messages`, com o número a que pertence e a conta (WABA) da `entry`. */
export interface ValorDoWebhook {
  readonly phoneNumberId: string;
  readonly wabaId: string | undefined;
  readonly valor: Record<string, unknown>;
}

/** Os `value` do campo `messages` de um corpo `object: "whatsapp_business_account"`; qualquer outra forma, nenhum. */
export function valoresDoCorpo(corpo: unknown): ValorDoWebhook[] {
  const raiz = objeto(corpo);
  if (!raiz || raiz.object !== "whatsapp_business_account" || !Array.isArray(raiz.entry)) return [];
  return raiz.entry.flatMap((bruta) => {
    const entrada = objeto(bruta);
    const wabaId = texto(entrada?.id);
    const mudancas = Array.isArray(entrada?.changes) ? entrada.changes : [];
    return mudancas.flatMap((mudanca) => {
      const c = objeto(mudanca);
      if (c?.field !== "messages") return [];
      const valor = objeto(c.value);
      const phoneNumberId = texto(objeto(valor?.metadata)?.phone_number_id);
      return valor && phoneNumberId ? [{ phoneNumberId, wabaId, valor }] : [];
    });
  });
}

/** Um item do webhook: uma mensagem recebida (com o perfil de quem a mandou) ou um status de entrega. */
export type ItemDoValor =
  | { readonly tipo: "mensagem"; readonly mensagem: Record<string, unknown>; readonly contato: Record<string, unknown> | undefined }
  | { readonly tipo: "status"; readonly status: Record<string, unknown> };

export function itensDoValor(valor: Record<string, unknown>): ItemDoValor[] {
  const contatos = (Array.isArray(valor.contacts) ? valor.contacts : []).map(objeto).filter((c): c is Record<string, unknown> => !!c);
  const mensagens = (Array.isArray(valor.messages) ? valor.messages : []).map(objeto).filter((m): m is Record<string, unknown> => !!m);
  const statuses = (Array.isArray(valor.statuses) ? valor.statuses : []).map(objeto).filter((s): s is Record<string, unknown> => !!s);
  return [
    ...mensagens.map((mensagem): ItemDoValor => ({
      tipo: "mensagem",
      mensagem,
      contato: contatos.find((c) => texto(c.wa_id) === texto(mensagem.from)) ?? (contatos.length === 1 ? contatos[0] : undefined),
    })),
    ...statuses.map((status): ItemDoValor => ({ tipo: "status", status })),
  ];
}

/**
 * Um corpo só com UM item: é o que a fila guarda por linha (a chave de deduplicação é do item, e um item que falha
 * não segura os outros). Mantém `metadata` e, para a mensagem, o perfil de quem a mandou.
 */
export function corpoDeUmItem(valor: ValorDoWebhook, item: ItemDoValor): Record<string, unknown> {
  const base = { messaging_product: "whatsapp", metadata: valor.valor.metadata };
  const novoValor =
    item.tipo === "mensagem"
      ? { ...base, ...(item.contato ? { contacts: [item.contato] } : {}), messages: [item.mensagem] }
      : { ...base, statuses: [item.status] };
  return {
    object: "whatsapp_business_account",
    entry: [{ ...(valor.wabaId ? { id: valor.wabaId } : {}), changes: [{ field: "messages", value: novoValor }] }],
  };
}

/** O tipo declarado de cada mídia: o `mime_type` do evento vale mais; esta é a dica quando ele falta. */
const MIDIA_PADRAO: Readonly<Record<string, { readonly tipoDeMidia: string; readonly nome: string }>> = {
  image: { tipoDeMidia: "image/jpeg", nome: "Imagem do WhatsApp" },
  video: { tipoDeMidia: "video/mp4", nome: "Vídeo do WhatsApp" },
  audio: { tipoDeMidia: "audio/ogg", nome: "Áudio do WhatsApp" },
  document: { tipoDeMidia: "application/pdf", nome: "Documento do WhatsApp" },
  sticker: { tipoDeMidia: "image/webp", nome: "Figurinha do WhatsApp" },
};

function anexoDe(tipo: string, carga: Record<string, unknown> | undefined): AnexoRecebidoDoProvedor | undefined {
  const padrao = MIDIA_PADRAO[tipo];
  const id = texto(carga?.id);
  if (!padrao || !id) return undefined;
  return {
    referenciaNoProvedor: id,
    tipoDeMidia: texto(carga?.mime_type) ?? padrao.tipoDeMidia,
    nome: texto(carga?.filename) ?? padrao.nome,
  };
}

/** A frase de uma localização: o que a pessoa vê no fio no lugar do mapa. */
function fraseDaLocalizacao(local: Record<string, unknown> | undefined): string {
  const nome = texto(local?.name);
  const endereco = texto(local?.address);
  const lat = texto(local?.latitude);
  const lon = texto(local?.longitude);
  const onde = [nome, endereco].filter(Boolean).join(", ");
  const coordenadas = lat && lon ? `${lat}, ${lon}` : undefined;
  return `Localização${onde ? `: ${onde}` : ""}${coordenadas ? ` (${coordenadas})` : ""}`;
}

function traduzirMensagem(item: Extract<ItemDoValor, { tipo: "mensagem" }>): EventoDoProvedor {
  const { mensagem, contato } = item;
  const idExterno = texto(mensagem.id);
  if (!idExterno) return { tipo: "ignorado", motivo: "sem_id" };
  const de = texto(mensagem.from);
  if (!de) return { tipo: "ignorado", motivo: "sem_remetente", idExterno };
  const quando = instante(mensagem.timestamp);
  if (!quando) return { tipo: "ignorado", motivo: "sem_instante", idExterno };
  const tipo = texto(mensagem.type) ?? "";

  if (tipo === "reaction") {
    const reacao = objeto(mensagem.reaction);
    const alvo = texto(reacao?.message_id);
    if (!alvo) return { tipo: "ignorado", motivo: "reacao_sem_alvo", idExterno };
    // `emoji` ausente ou vazio é a reação removida.
    return { tipo: "reacao", idExterno: alvo, autor: "contato", emoji: texto(reacao?.emoji) ?? "", em: quando };
  }
  if (tipo === "system") return { tipo: "ignorado", motivo: "sistema", idExterno };

  const remetente = { tipo: "whatsapp" as const, valor: `+${de}`, ...(texto(objeto(contato?.profile)?.name) ? { nomeExibido: texto(objeto(contato?.profile)?.name)! } : {}) };

  let conteudo: string | undefined;
  let anexos: AnexoRecebidoDoProvedor[] = [];
  switch (tipo) {
    case "text":
      conteudo = texto(objeto(mensagem.text)?.body);
      break;
    case "image":
    case "video":
    case "document":
    case "sticker":
    case "audio": {
      const anexo = anexoDe(tipo, objeto(mensagem[tipo]));
      if (anexo) anexos = [anexo];
      conteudo = texto(objeto(mensagem[tipo])?.caption);
      break;
    }
    case "location":
      conteudo = fraseDaLocalizacao(objeto(mensagem.location));
      break;
    case "contacts": {
      const nomes = (Array.isArray(mensagem.contacts) ? mensagem.contacts : [])
        .map((c) => texto(objeto(objeto(c)?.name)?.formatted_name))
        .filter((n): n is string => !!n);
      conteudo = nomes.length > 0 ? `Contato compartilhado: ${nomes.join(", ")}` : "Contato compartilhado";
      break;
    }
    case "button":
      conteudo = texto(objeto(mensagem.button)?.text);
      break;
    case "interactive": {
      const interativa = objeto(mensagem.interactive);
      const resposta = objeto(interativa?.button_reply) ?? objeto(interativa?.list_reply);
      // A resposta de um Flow (`nfm_reply`) é da 7.4 (Flows): não vira Mensagem por enquanto.
      if (!resposta) return { tipo: "ignorado", motivo: interativa?.type === "nfm_reply" ? "resposta_de_flow" : "interativa_nao_tratada", idExterno };
      conteudo = texto(resposta.title);
      break;
    }
    default:
      break;
  }
  if (conteudo === undefined && anexos.length === 0) conteudo = TEXTO_DE_MENSAGEM_NAO_SUPORTADA;

  const emResposta = texto(objeto(mensagem.context)?.id);
  return {
    tipo: "mensagem",
    idExterno,
    criadoEm: quando,
    remetente,
    ...(conteudo === undefined ? {} : { conteudo }),
    ...(anexos.length > 0 ? { anexos } : {}),
    ...(emResposta ? { emRespostaAIdExterno: emResposta } : {}),
    cargaBruta: mensagem,
  };
}

const STATUS_DA_META = { sent: "enviada", delivered: "entregue", read: "lida", failed: "falhou" } as const;

/** O motivo curto de uma falha: o título que a Meta dá, com o código; nunca o corpo inteiro. */
function motivoDaFalha(status: Record<string, unknown>): string | undefined {
  const erro = objeto(Array.isArray(status.errors) ? status.errors[0] : undefined);
  const titulo = texto(erro?.title) ?? texto(erro?.message);
  const codigo = texto(erro?.code);
  if (!titulo && !codigo) return undefined;
  return `${codigo ? `${codigo}: ` : ""}${(titulo ?? "").replace(/\s+/g, " ").slice(0, 160)}`.trim();
}

function traduzirStatus(item: Extract<ItemDoValor, { tipo: "status" }>): EventoDoProvedor {
  const idExterno = texto(item.status.id);
  if (!idExterno) return { tipo: "ignorado", motivo: "status_sem_id" };
  const novo = STATUS_DA_META[(texto(item.status.status) ?? "") as keyof typeof STATUS_DA_META];
  if (!novo) return { tipo: "ignorado", motivo: "status_desconhecido", idExterno };
  // Sem instante, a data inválida faz o processador usar o relógio dele (`aplicarStatus`).
  const em = instante(item.status.timestamp) ?? "";
  const motivo = novo === "falhou" ? motivoDaFalha(item.status) : undefined;
  return { tipo: "status", idExterno, status: novo, em, ...(motivo ? { motivo } : {}) };
}

/** O corpo em eventos do número `phoneNumberId`. Nunca lança; sempre devolve pelo menos um evento. */
export function traduzirChamadaDaCloudApi(corpo: unknown, phoneNumberId: string): EventoDoProvedor[] {
  const valores = valoresDoCorpo(corpo);
  if (valores.length === 0) return [{ tipo: "ignorado", motivo: "corpo_invalido" }];
  const doNumero = valores.filter((v) => v.phoneNumberId === phoneNumberId);
  if (doNumero.length === 0) return [{ tipo: "ignorado", motivo: "outro_numero" }];
  const eventos = doNumero.flatMap((v) => itensDoValor(v.valor).map((i) => (i.tipo === "mensagem" ? traduzirMensagem(i) : traduzirStatus(i))));
  return eventos.length > 0 ? eventos : [{ tipo: "ignorado", motivo: "evento_nao_tratado" }];
}

/**
 * A chave de deduplicação: o id da mensagem, ou `status:<id>:<estado>` do status (uma mesma mensagem tem `sent`,
 * `delivered` e `read`, cada um com a sua chave). A rota guarda um item por linha.
 */
export function chaveDoItem(corpo: unknown): string | undefined {
  for (const v of valoresDoCorpo(corpo)) {
    for (const item of itensDoValor(v.valor)) {
      if (item.tipo === "mensagem") {
        const id = texto(item.mensagem.id);
        if (id) return id;
      } else {
        const id = texto(item.status.id);
        const estado = texto(item.status.status);
        if (id && estado) return `status:${id}:${estado}`;
      }
    }
  }
  return undefined;
}

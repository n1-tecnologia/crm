/**
 * O tradutor do `MESSAGES_UPSERT` da Evolution v2.3.7 (16-12, D-16-04, MSG-06): o corpo do webhook vira os eventos
 * do provedor (`EventoDoProvedor`). Função pura: sem rede, sem banco, sem relógio.
 *
 * Só o que é mensagem de uma pessoa entra. O mesmo evento traz grupos, `status@broadcast`, reações, edições e o que o
 * próprio número enviou (`fromMe`): tudo isso vira `ignorado` com o motivo, nunca Contato nem Conversa fantasma
 * (Pitfall 7). `fromMe` é ignorado nesta fase: o socket da Evolution tem `emitOwnEvents: false`, então o que a
 * plataforma envia não volta, e o que foi digitado no celular só entra na Sessão 4.
 *
 * O instante vem só de `messageTimestamp` (segundos Unix). O `date_time` do corpo é hora local com sufixo `Z` e nunca
 * é lido (Pitfall 16). O corpo nunca leva `url` de mídia seguida: a mídia sai de `getBase64FromMediaMessage`.
 */

import type { EventoDoProvedor } from "../../provedor";

const EVENTO_DE_MENSAGEM = "messages.upsert";
const SUFIXO_DE_NUMERO = "@s.whatsapp.net";

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/**
 * Tira toda propriedade `apikey` do corpo (a Evolution a manda no topo, e é a credencial da instância): a carga bruta
 * vai para o banco junto de dado pessoal, e a chave nunca vai com ela (T-16-44).
 */
export function semApikey(corpo: unknown): unknown {
  function limpar(valor: unknown, profundidade: number): unknown {
    if (profundidade > 6) return valor;
    if (Array.isArray(valor)) return valor.map((item) => limpar(item, profundidade + 1));
    if (!ehObjeto(valor)) return valor;
    const saida: Record<string, unknown> = {};
    for (const [nome, conteudo] of Object.entries(valor)) {
      if (nome.toLowerCase() === "apikey") continue;
      saida[nome] = limpar(conteudo, profundidade + 1);
    }
    return saida;
  }
  return limpar(corpo, 0);
}

/** `messageTimestamp` em segundos (número, texto numérico ou `{ low }` de um Long serializado) → ISO; `undefined` se não vier. */
function instanteDoProvedor(valor: unknown): string | undefined {
  let segundos: number | undefined;
  if (typeof valor === "number") segundos = valor;
  else if (typeof valor === "string" && /^\d+$/.test(valor.trim())) segundos = Number(valor.trim());
  else if (ehObjeto(valor) && typeof valor.low === "number") segundos = valor.low;
  if (segundos === undefined || !Number.isFinite(segundos) || segundos <= 0) return undefined;
  const instante = new Date(segundos * 1000);
  return Number.isNaN(instante.getTime()) ? undefined : instante.toISOString();
}

function ignorado(motivo: string, idExterno?: string): readonly EventoDoProvedor[] {
  return [{ tipo: "ignorado", motivo, ...(idExterno === undefined ? {} : { idExterno }) }];
}

/** Os dígitos do número de um JID `<dígitos>@s.whatsapp.net`; `undefined` se não for (ex.: `@lid`). */
function numeroDoJid(jid: unknown): string | undefined {
  if (typeof jid !== "string" || !jid.endsWith(SUFIXO_DE_NUMERO)) return undefined;
  const digitos = jid.slice(0, -SUFIXO_DE_NUMERO.length);
  return /^\d{8,15}$/.test(digitos) ? digitos : undefined;
}

/** O embrulho de legenda do documento (`documentWithCaptionMessage`): o que vale está em `message.message`. */
function desembrulhar(mensagem: Record<string, unknown>): Record<string, unknown> {
  const embrulho = mensagem.documentWithCaptionMessage;
  return ehObjeto(embrulho) && ehObjeto(embrulho.message) ? embrulho.message : mensagem;
}

/** Os tipos de mídia que entram, na ordem em que se procura. A figurinha é sempre `image/webp` (Pitfall 7). */
const MIDIAS_ACEITAS: ReadonlyArray<{ campo: string; tipo?: string; tipoPadrao: string; rotulo: string }> = [
  { campo: "imageMessage", tipoPadrao: "image/jpeg", rotulo: "imagem" },
  { campo: "videoMessage", tipoPadrao: "video/mp4", rotulo: "video" },
  { campo: "audioMessage", tipoPadrao: "audio/ogg", rotulo: "audio" },
  { campo: "documentMessage", tipoPadrao: "application/octet-stream", rotulo: "documento" },
  { campo: "stickerMessage", tipo: "image/webp", tipoPadrao: "image/webp", rotulo: "figurinha" },
];

const EXTENSOES: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/zip": "zip",
};

/** Só o nome, sem separador de caminho nem caractere de controle: é o que a tela mostra e o que vira o nome do download. */
function nomeSeguro(bruto: string): string {
  const semLixo = bruto.replace(/[\u0000-\u001f\u007f]/g, "").split(/[\\/]/).pop() ?? "";
  return semLixo.replace(/^\.+/, "").trim().slice(0, 120);
}

/** O `fileName` do documento, ou `<tipo>-<id>.<extensão>` derivado do mimetype. */
function nomeDoAnexo(campo: string, midia: Record<string, unknown>, idExterno: string, tipoDeMidia: string): string {
  if (campo === "documentMessage" && typeof midia.fileName === "string") {
    const nome = nomeSeguro(midia.fileName);
    if (nome !== "") return nome;
  }
  const rotulo = MIDIAS_ACEITAS.find((m) => m.campo === campo)?.rotulo ?? "arquivo";
  const normalizado = (tipoDeMidia.split(";")[0] ?? "").trim().toLowerCase();
  const extensao = EXTENSOES[normalizado] ?? ((normalizado.split("/")[1] ?? "").replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin");
  return `${rotulo}-${nomeSeguro(idExterno).replace(/[^A-Za-z0-9_-]/g, "") || "anexo"}.${extensao}`;
}

/**
 * `instancia` é a instância guardada na credencial do Canal: um corpo de outra instância não é deste Canal e não vira
 * evento nenhum (`[]`), assim como um `event` que não é `messages.upsert`.
 */
export function traduzirChamadaDaEvolution(corpo: unknown, instancia: string): readonly EventoDoProvedor[] {
  if (!ehObjeto(corpo) || corpo.event !== EVENTO_DE_MENSAGEM || corpo.instance !== instancia) return [];
  const dados = corpo.data;
  if (!ehObjeto(dados) || !ehObjeto(dados.key)) return ignorado("formato_invalido");
  const chave = dados.key;
  const idExterno = typeof chave.id === "string" && chave.id !== "" ? chave.id : undefined;

  if (chave.fromMe === true) return ignorado("fromMe", idExterno);
  const jid = typeof chave.remoteJid === "string" ? chave.remoteJid : "";
  if (jid === "status@broadcast") return ignorado("status", idExterno);
  if (jid.endsWith("@g.us")) return ignorado("grupo", idExterno);
  if (idExterno === undefined) return ignorado("sem_id");

  // A Evolution já troca o `@lid` pelo Alt antes de emitir; se vier os dois, o Alt numérico é o número.
  const digitos = numeroDoJid(jid) ?? (jid.endsWith("@lid") ? numeroDoJid(chave.remoteJidAlt) : undefined);
  if (digitos === undefined) return ignorado("sem_numero", idExterno);

  const mensagem = desembrulhar(ehObjeto(dados.message) ? dados.message : {});
  const tipoDoCorpo = typeof dados.messageType === "string" ? dados.messageType : undefined;
  if (ehObjeto(mensagem.reactionMessage)) return ignorado("reacao", idExterno);
  if (ehObjeto(mensagem.protocolMessage) || ehObjeto(mensagem.editedMessage)) return ignorado("edicao", idExterno);

  const nome = typeof dados.pushName === "string" ? dados.pushName.trim() : "";
  const base = {
    tipo: "mensagem" as const,
    idExterno,
    criadoEm: instanteDoProvedor(dados.messageTimestamp) ?? new Date().toISOString(),
    remetente: { tipo: "whatsapp" as const, valor: `+${digitos}`, ...(nome === "" ? {} : { nomeExibido: nome }) },
    cargaBruta: semApikey(corpo),
  };

  const estendida = ehObjeto(mensagem.extendedTextMessage) ? mensagem.extendedTextMessage : undefined;
  const texto = typeof mensagem.conversation === "string" ? mensagem.conversation : typeof estendida?.text === "string" ? estendida.text : undefined;
  if (texto !== undefined) return [{ ...base, conteudo: texto }];

  for (const { campo, tipo, tipoPadrao } of MIDIAS_ACEITAS) {
    const midia = mensagem[campo];
    if (!ehObjeto(midia)) continue;
    const tipoDeMidia = tipo ?? (typeof midia.mimetype === "string" && midia.mimetype.trim() !== "" ? midia.mimetype.trim() : tipoPadrao);
    const legenda = typeof midia.caption === "string" && midia.caption.trim() !== "" ? midia.caption : undefined;
    return [
      {
        ...base,
        ...(legenda === undefined ? {} : { conteudo: legenda }),
        anexos: [
          {
            // O `{ key, message }` do webhook é o que `getBase64FromMediaMessage` precisa para achar a mídia; a `url` de dentro dela
            // é o CDN cifrado do WhatsApp e nunca é seguida.
            referenciaNoProvedor: JSON.stringify({ key: chave, message: dados.message }),
            tipoDeMidia,
            nome: nomeDoAnexo(campo, midia, idExterno, tipoDeMidia),
          },
        ],
      },
    ];
  }

  return ignorado(`tipo:${tipoDoCorpo ?? Object.keys(mensagem).find((campo) => campo !== "messageContextInfo") ?? "desconhecido"}`, idExterno);
}

/**
 * O tradutor do `MESSAGES_UPSERT` da Evolution v2.3.7 (16-12, D-16-04, MSG-06): o corpo do webhook vira os eventos
 * do provedor (`EventoDoProvedor`). Função pura: sem rede, sem banco, sem relógio.
 *
 * Só o que é mensagem de uma pessoa entra. O mesmo evento traz grupos, `status@broadcast`, reações e edições: tudo isso
 * vira `ignorado` com o motivo, nunca Contato nem Conversa fantasma (Pitfall 7).
 *
 * `fromMe` (Sessão 4, 4.4.2): a Mensagem que a pessoa digitou no celular entra como `digitadaNoAparelho`, com o Contato (o
 * `remoteJid`) como `remetente`. O `pushName` dela é o do DONO do número e nunca vira o nome do Contato. O socket da Evolution
 * tem `emitOwnEvents: false`, então o que a plataforma envia não volta por aqui (e, se um dia voltar, o id externo já gravado
 * descarta a repetida e `gravarEnvio` desfaz a cópia que chegou antes do aceite).
 *
 * Os demais eventos da Evolution que mudam uma Mensagem que já existe (4.4.5), conferidos no código dela (2.4.0-rc2):
 *   - `messages.update` `{ keyId, remoteJid, fromMe, status }`: o tique. `fromMe` é o da Mensagem (verdadeiro para a que NÓS
 *     mandamos). Sem instante no corpo: vale o da chegada. O mesmo evento carrega a edição (`message.editedMessage`) com um
 *     `status` falso, e por isso ela é descartada aqui;
 *   - `messages.delete` `{ remoteJid, fromMe, id, status: "DELETED" }`: apagada para todos; `fromMe` é de quem apagou;
 *   - `messages.edited`: o `ProtocolMessage` cru `{ key: { id }, type, editedMessage, timestampMs }`; a revogação também chega
 *     por aqui (e por `messages.delete`) e é descartada;
 *   - a Reação é um `MESSAGES_UPSERT` com `message.reactionMessage { key: { id }, text }`: `key.id` é a Mensagem reagida, e
 *     `text` vazio é a reação removida.
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

/** Milissegundos Unix (número, texto numérico ou um `Long` serializado `{ low, high }`) → ISO; `undefined` se não vier. */
function instanteEmMilissegundos(valor: unknown): string | undefined {
  let ms: number | undefined;
  if (typeof valor === "number") ms = valor;
  else if (typeof valor === "string" && /^\d+$/.test(valor.trim())) ms = Number(valor.trim());
  else if (ehObjeto(valor) && typeof valor.low === "number") ms = (typeof valor.high === "number" ? valor.high * 4294967296 : 0) + (valor.low >>> 0);
  if (ms === undefined || !Number.isFinite(ms) || ms <= 0) return undefined;
  const instante = new Date(ms);
  return Number.isNaN(instante.getTime()) ? undefined : instante.toISOString();
}

/** O nome do evento sem diferença de grafia: `messages.update` e `MESSAGES_UPDATE` são o mesmo. */
function ehEvento(evento: unknown, nome: string): boolean {
  return typeof evento === "string" && evento.trim().toLowerCase().replace(/_/g, ".") === nome;
}

function ignorado(motivo: string, idExterno?: string): readonly EventoDoProvedor[] {
  return [{ tipo: "ignorado", motivo, ...(idExterno === undefined ? {} : { idExterno }) }];
}

/** Os dígitos do número de um JID `<dígitos>@s.whatsapp.net`; `undefined` se não for (ex.: `@lid`). */
/**
 * `connection.update` (4.3.1). A Evolution emite o nome em minúsculas com ponto (`connection.update`); o nome do evento
 * ASSINADO no webhook é `CONNECTION_UPDATE`. As duas grafias valem aqui: a conferência na fonte (`conferirConexao`) é que
 * decide o que se grava, então tolerar a grafia não abre nada.
 */
function ehEventoDeConexao(evento: unknown): boolean {
  return typeof evento === "string" && evento.trim().toLowerCase().replace(/_/g, ".") === "connection.update";
}

/**
 * O `statusReason` do `close` de um aparelho REMOVIDO no celular ("Aparelhos conectados" › sair): o Baileys fecha com 401
 * (`DisconnectReason.loggedOut`). É a única razão que quer dizer "a pessoa desligou de propósito". Qualquer outra razão
 * (428 conexão fechada, 408 tempo esgotado, 440 substituída, 515 reinício, 500) é queda.
 */
const RAZAO_DE_APARELHO_REMOVIDO = 401;

/**
 * `data.state` de `connection.update`: `open` avisa que conectou (o `conferirConexao` do provedor confirma antes de gravar);
 * `close` com a razão 401 é o aparelho removido (`desconectada`) e com qualquer outra, uma queda (`com_erro`); `connecting`
 * não muda nada. O corpo nunca é guardado nem logado: só o estado e a razão numérica passam adiante.
 */
function traduzirConexao(dados: unknown): readonly EventoDoProvedor[] {
  const estado = ehObjeto(dados) && typeof dados.state === "string" ? dados.state : undefined;
  const razao = ehObjeto(dados) && typeof dados.statusReason === "number" && Number.isFinite(dados.statusReason) ? dados.statusReason : undefined;
  if (estado === "open") return [{ tipo: "conexao", conexao: "conectada", motivo: "open" }];
  if (estado === "close") {
    if (razao === RAZAO_DE_APARELHO_REMOVIDO) return [{ tipo: "conexao", conexao: "desconectada", motivo: "aparelho_removido" }];
    return [{ tipo: "conexao", conexao: "com_erro", motivo: razao === undefined ? "close" : `close:${razao}` }];
  }
  if (estado === "connecting") return ignorado("conectando");
  return ignorado("conexao_sem_estado");
}

/** O `status` de `messages.update` (renderStatus da Evolution) → o status de entrega do CRM. `PENDING` não diz nada que o CRM não saiba. */
const STATUS_DA_EVOLUTION: Readonly<Record<string, "enviada" | "entregue" | "lida" | "falhou">> = {
  SERVER_ACK: "enviada",
  DELIVERY_ACK: "entregue",
  READ: "lida",
  PLAYED: "lida",
  ERROR: "falhou",
};

/** `messages.update` (4.4.5): o tique de uma Mensagem que NÓS mandamos. Grupo e `status@broadcast` não entram (Sessão 6). */
function traduzirStatus(dados: unknown): readonly EventoDoProvedor[] {
  if (!ehObjeto(dados)) return ignorado("formato_invalido");
  const idExterno = typeof dados.keyId === "string" && dados.keyId !== "" ? dados.keyId : undefined;
  if (idExterno === undefined) return ignorado("status_sem_id");
  const jid = typeof dados.remoteJid === "string" ? dados.remoteJid : "";
  if (jid === "status@broadcast") return ignorado("status", idExterno);
  if (jid.endsWith("@g.us")) return ignorado("grupo", idExterno);
  // A edição chega aqui com um status de enfeite (`SERVER_ACK`): quem trata a edição é `messages.edited`.
  if (ehObjeto(dados.message) && ehObjeto(dados.message.editedMessage)) return ignorado("edicao_no_status", idExterno);
  // `fromMe` falso é o recibo de uma Mensagem que o Contato mandou (o nosso celular a leu): o CRM não tem status dela.
  if (dados.fromMe === false) return ignorado("status_de_recebida", idExterno);
  const bruto = typeof dados.status === "string" ? dados.status.trim().toUpperCase() : "";
  const status = STATUS_DA_EVOLUTION[bruto];
  if (status === undefined) return ignorado(bruto === "" ? "status_sem_valor" : `status:${bruto.toLowerCase()}`, idExterno);
  return [{ tipo: "status", idExterno, status, em: new Date().toISOString(), ...(status === "falhou" ? { motivo: bruto } : {}) }];
}

/** `messages.delete` (4.4.5): a Mensagem `id` foi apagada para todos. `fromMe` é de quem apagou. */
function traduzirExclusao(dados: unknown): readonly EventoDoProvedor[] {
  if (!ehObjeto(dados)) return ignorado("formato_invalido");
  const chave = ehObjeto(dados.key) ? dados.key : dados;
  const idExterno = typeof chave.id === "string" && chave.id !== "" ? chave.id : undefined;
  if (idExterno === undefined) return ignorado("exclusao_sem_id");
  const jid = typeof dados.remoteJid === "string" ? dados.remoteJid : typeof chave.remoteJid === "string" ? chave.remoteJid : "";
  if (jid === "status@broadcast") return ignorado("status", idExterno);
  if (jid.endsWith("@g.us")) return ignorado("grupo", idExterno);
  const fromMe = typeof dados.fromMe === "boolean" ? dados.fromMe : chave.fromMe === true;
  return [{ tipo: "exclusao", idExterno, porQuem: fromMe ? "celular_do_canal" : "remetente_externo", em: new Date().toISOString() }];
}

/** O `ProtocolMessage.type` que quer dizer revogação (apagar para todos): o Baileys o serializa como `REVOKE` ou como o número 0. */
function ehRevogacao(tipo: unknown): boolean {
  return tipo === 0 || (typeof tipo === "string" && tipo.trim().toUpperCase() === "REVOKE");
}

/** O texto novo de uma mensagem editada: `conversation`, ou `extendedTextMessage.text`, com ou sem o embrulho `message`. */
function textoDaEdicao(editada: unknown): string | undefined {
  if (!ehObjeto(editada)) return undefined;
  const corpo = ehObjeto(editada.message) ? editada.message : editada;
  if (typeof corpo.conversation === "string") return corpo.conversation;
  const estendida = ehObjeto(corpo.extendedTextMessage) ? corpo.extendedTextMessage : undefined;
  return typeof estendida?.text === "string" ? estendida.text : undefined;
}

/**
 * `messages.edited` (4.4.5): o `ProtocolMessage` cru. `key.id` é a Mensagem ORIGINAL (o `remoteJid` e o `fromMe` de dentro são do
 * ponto de vista de quem editou, e nunca são lidos). A revogação também chega aqui, e quem a trata é `messages.delete`.
 */
function traduzirEdicao(dados: unknown): readonly EventoDoProvedor[] {
  if (!ehObjeto(dados)) return ignorado("formato_invalido");
  const chave = ehObjeto(dados.key) ? dados.key : undefined;
  const idExterno = typeof chave?.id === "string" && chave.id !== "" ? chave.id : undefined;
  if (idExterno === undefined) return ignorado("edicao_sem_id");
  if (ehRevogacao(dados.type)) return ignorado("revogacao", idExterno);
  const jid = typeof chave?.remoteJid === "string" ? chave.remoteJid : "";
  if (jid.endsWith("@g.us")) return ignorado("grupo", idExterno);
  const conteudo = textoDaEdicao(dados.editedMessage);
  if (conteudo === undefined) return ignorado("edicao_sem_texto", idExterno);
  return [{ tipo: "edicao", idExterno, conteudo, em: instanteEmMilissegundos(dados.timestampMs) ?? new Date().toISOString() }];
}

/** A Mensagem que esta cita, pelo `stanzaId` do `contextInfo` (de onde ele vier em cada versão da Evolution); `undefined` se não cita nenhuma. */
function idDaCitada(dados: Record<string, unknown>, mensagem: Record<string, unknown>): string | undefined {
  const candidatos: unknown[] = [dados.contextInfo];
  for (const valor of Object.values(mensagem)) if (ehObjeto(valor)) candidatos.push(valor.contextInfo);
  for (const contexto of candidatos) {
    if (ehObjeto(contexto) && typeof contexto.stanzaId === "string" && contexto.stanzaId.trim() !== "") return contexto.stanzaId.trim();
  }
  return undefined;
}

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
  if (!ehObjeto(corpo) || corpo.instance !== instancia) return [];
  if (ehEventoDeConexao(corpo.event)) return traduzirConexao(corpo.data);
  if (ehEvento(corpo.event, "messages.update")) return traduzirStatus(corpo.data);
  if (ehEvento(corpo.event, "messages.delete")) return traduzirExclusao(corpo.data);
  if (ehEvento(corpo.event, "messages.edited")) return traduzirEdicao(corpo.data);
  if (corpo.event !== EVENTO_DE_MENSAGEM) return [];
  const dados = corpo.data;
  if (!ehObjeto(dados) || !ehObjeto(dados.key)) return ignorado("formato_invalido");
  const chave = dados.key;
  const idExterno = typeof chave.id === "string" && chave.id !== "" ? chave.id : undefined;

  const digitadaNoAparelho = chave.fromMe === true;
  const jid = typeof chave.remoteJid === "string" ? chave.remoteJid : "";
  if (jid === "status@broadcast") return ignorado("status", idExterno);
  if (jid.endsWith("@g.us")) return ignorado("grupo", idExterno);
  if (idExterno === undefined) return ignorado("sem_id");

  // A Evolution já troca o `@lid` pelo Alt antes de emitir; se vier os dois, o Alt numérico é o número.
  const digitos = numeroDoJid(jid) ?? (jid.endsWith("@lid") ? numeroDoJid(chave.remoteJidAlt) : undefined);
  if (digitos === undefined) return ignorado("sem_numero", idExterno);

  const mensagem = desembrulhar(ehObjeto(dados.message) ? dados.message : {});
  const tipoDoCorpo = typeof dados.messageType === "string" ? dados.messageType : undefined;
  if (ehObjeto(mensagem.reactionMessage)) {
    // A Reação não é Mensagem: `reactionMessage.key.id` é a Mensagem reagida e o `key.fromMe` de fora diz quem reagiu.
    const reagida = ehObjeto(mensagem.reactionMessage.key) && typeof mensagem.reactionMessage.key.id === "string" ? mensagem.reactionMessage.key.id : "";
    if (reagida === "") return ignorado("reacao_sem_alvo", idExterno);
    return [
      {
        tipo: "reacao",
        idExterno: reagida,
        autor: digitadaNoAparelho ? "canal" : "contato",
        emoji: typeof mensagem.reactionMessage.text === "string" ? mensagem.reactionMessage.text : "",
        em: instanteEmMilissegundos(mensagem.reactionMessage.senderTimestampMs) ?? instanteDoProvedor(dados.messageTimestamp) ?? new Date().toISOString(),
      },
    ];
  }
  if (ehObjeto(mensagem.protocolMessage) || ehObjeto(mensagem.editedMessage)) return ignorado("edicao", idExterno);

  const citada = idDaCitada(dados, mensagem);

  // O `pushName` de uma Mensagem `fromMe` é o nome de quem digitou (o dono do número), não o do Contato.
  const nome = !digitadaNoAparelho && typeof dados.pushName === "string" ? dados.pushName.trim() : "";
  const base = {
    tipo: "mensagem" as const,
    idExterno,
    criadoEm: instanteDoProvedor(dados.messageTimestamp) ?? new Date().toISOString(),
    remetente: { tipo: "whatsapp" as const, valor: `+${digitos}`, ...(nome === "" ? {} : { nomeExibido: nome }) },
    cargaBruta: semApikey(corpo),
    ...(digitadaNoAparelho ? { digitadaNoAparelho: true } : {}),
    ...(citada === undefined ? {} : { emRespostaAIdExterno: citada }),
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

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

  const mensagem = ehObjeto(dados.message) ? dados.message : {};
  const estendida = ehObjeto(mensagem.extendedTextMessage) ? mensagem.extendedTextMessage : undefined;
  const conteudo =
    typeof mensagem.conversation === "string" ? mensagem.conversation : typeof estendida?.text === "string" ? estendida.text : undefined;
  if (conteudo === undefined) {
    return ignorado(`tipo:${typeof dados.messageType === "string" ? dados.messageType : "desconhecido"}`, idExterno);
  }

  const nome = typeof dados.pushName === "string" ? dados.pushName.trim() : "";
  return [
    {
      tipo: "mensagem",
      idExterno,
      criadoEm: instanteDoProvedor(dados.messageTimestamp) ?? new Date().toISOString(),
      remetente: { tipo: "whatsapp", valor: `+${digitos}`, ...(nome === "" ? {} : { nomeExibido: nome }) },
      conteudo,
      cargaBruta: semApikey(corpo),
    },
  ];
}

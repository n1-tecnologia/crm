/**
 * O provedor do Canal (D-01, Fase 8): por onde a conta conversa. O Tipo de
 * Canal continua `whatsapp` / `instagram` / `email`; o provedor é atributo do
 * Canal e pertence a UM tipo só (A2.4) — "e-mail com provedor de WhatsApp" não
 * existe.
 *
 * Arquivo folha: importa só tipos de `./types/crm`. O `CHECK canais_provedor_tipo_ck`
 * da 008 (`apps/api/migracoes/008-canais-conversas-mensagens.sql`) e o `z.enum`
 * da rota `POST /canais` são cópia literal desta tabela — quem mudar um, muda
 * os três no mesmo commit.
 */

import type { ChannelType, ProvedorDeCanal } from "./types/crm";

/** Na ordem dos quatro cartões da tela de conexão (D-06). */
export const PROVEDORES_DE_CANAL = [
  "whatsapp-cloud",
  "whatsapp-nao-oficial",
  "instagram-graph",
  "email-imap-smtp",
] as const satisfies readonly ProvedorDeCanal[];

/** Os Tipos de Canal que têm provedor (`linkedin` e `chatDoSite` não têm). */
export const TIPOS_COM_PROVEDOR = ["whatsapp", "instagram", "email"] as const;
export type TipoComProvedor = (typeof TIPOS_COM_PROVEDOR)[number];

export const PROVEDORES: Readonly<
  Record<ProvedorDeCanal, { readonly tipo: TipoComProvedor; readonly rotulo: string; readonly selo: string }>
> = {
  "whatsapp-cloud": { tipo: "whatsapp", rotulo: "WhatsApp oficial", selo: "oficial" },
  "whatsapp-nao-oficial": { tipo: "whatsapp", rotulo: "WhatsApp não oficial", selo: "não oficial" },
  "instagram-graph": { tipo: "instagram", rotulo: "Instagram", selo: "oficial" },
  "email-imap-smtp": { tipo: "email", rotulo: "E-mail", selo: "IMAP/SMTP" },
};

/** O provedor de um Canal sem `provider` explícito (o seed, o `criarCanal` antigo). */
export const PROVEDOR_PADRAO_DO_TIPO: Readonly<Record<TipoComProvedor, ProvedorDeCanal>> = {
  whatsapp: "whatsapp-cloud",
  instagram: "instagram-graph",
  email: "email-imap-smtp",
};

export function ehProvedorDeCanal(valor: string): valor is ProvedorDeCanal {
  return (PROVEDORES_DE_CANAL as readonly string[]).includes(valor);
}

/**
 * O provedor efetivo do Canal: o `provider` quando existe, senão o padrão do
 * tipo. `undefined` para `linkedin` e `chatDoSite`, que não têm provedor.
 */
export function provedorDoCanal(canal: {
  readonly channelType: ChannelType;
  readonly provider?: ProvedorDeCanal;
}): ProvedorDeCanal | undefined {
  if (canal.provider !== undefined) return canal.provider;
  const tipo = canal.channelType;
  if (tipo === "whatsapp" || tipo === "instagram" || tipo === "email") return PROVEDOR_PADRAO_DO_TIPO[tipo];
  return undefined;
}

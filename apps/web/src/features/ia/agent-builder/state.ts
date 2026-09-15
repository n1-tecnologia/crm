/** O rascunho do Construtor: tudo que a tela edita antes de publicar. */

export type ResponseFormat = "texto" | "markdown" | "json" | "estruturado";
export type AccessPoint = "chat" | "whatsapp" | "api" | "webhook";
export type KnowledgeKind = "arquivo" | "url" | "base";

export interface KnowledgeEntry {
  readonly id: string;
  readonly kind: KnowledgeKind;
  readonly label: string;
}

export interface BuilderDraft {
  readonly name: string;
  readonly description: string;
  readonly avatarUrl: string | null;
  readonly instructions: string;
  readonly icebreakers: readonly string[];
  readonly knowledge: readonly KnowledgeEntry[];
  readonly modelId: string;
  readonly toolIds: readonly string[];
  readonly responseFormat: ResponseFormat;
  readonly accessPoints: readonly AccessPoint[];
}

export const INSTRUCTIONS_MAX = 4000;

export const EMPTY_DRAFT: BuilderDraft = {
  name: "",
  description: "",
  avatarUrl: null,
  instructions: "",
  icebreakers: [],
  knowledge: [],
  modelId: "",
  toolIds: [],
  responseFormat: "texto",
  accessPoints: ["chat"],
};

export const RESPONSE_FORMAT_LABEL: Record<ResponseFormat, string> = {
  texto: "Texto livre",
  markdown: "Markdown",
  json: "JSON",
  estruturado: "Formato estruturado",
};

export const ACCESS_POINT_LABEL: Record<AccessPoint, string> = {
  chat: "Chat da plataforma",
  whatsapp: "WhatsApp",
  api: "API",
  webhook: "Webhook",
};

export const KNOWLEDGE_KIND_LABEL: Record<KnowledgeKind, string> = {
  arquivo: "Arquivo",
  url: "URL",
  base: "Base de conhecimento",
};

export type Section =
  | "quebraGelos"
  | "conhecimento"
  | "modelo"
  | "ferramentas"
  | "formato"
  | "acesso"
  | "logs"
  | "dashboard";

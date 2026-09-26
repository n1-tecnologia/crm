/**
 * A FORMA dos `args` das operações de
 * `packages/dominio/src/operations/ia/conhecimento.ts` — 16 operações. Ver
 * `../esquemas/CONTEXT.md` para a regra da pasta.
 */

import type { Attachment, KnowledgeSource } from "@n1/dominio";
import type { AcaoDaConcessao, NovaFonteInput } from "@n1/dominio/operations";
import { ID, type Confere, type Esquemas, type Igual } from "./fragmentos";
import { z } from "zod";

const MEDIA_TYPE = z.enum([
  "image",
  "audio",
  "video",
  "document",
  "spreadsheet",
  "location",
  "sticker",
  "flow",
  "other",
]);
const TIPO_DE_FONTE = z.enum(["url", "integracao"]);
const POLITICA_DE_ATUALIZACAO = z.enum(["manual", "periodica"]);
const ACAO_DA_CONCESSAO = z.enum(["ver", "criar", "editar"]);

const NOVA_COLECAO_INPUT = z
  .object({ name: z.string(), description: z.string().optional(), isPrivate: z.boolean().optional() })
  .strict();

const EDITAR_COLECAO_INPUT = z
  .object({ name: z.string().optional(), description: z.string().optional(), isPrivate: z.boolean().optional() })
  .strict();

const NOVA_FONTE_INPUT = z
  .object({
    kind: TIPO_DE_FONTE,
    name: z.string(),
    config: z.string(),
    updatePolicy: z
      .object({ kind: POLITICA_DE_ATUALIZACAO, intervalHours: z.number().optional() })
      .strict()
      .optional(),
  })
  .strict();

/**
 * `EntradaDeConteudo` — a união de três variantes. `EntradaDeDocumento` é a
 * mesma união com `title`/`labels?` na raiz: como os objetos são `.strict()`,
 * cada variante carrega as chaves da raiz em vez de um `.and()`.
 */
const CONTEUDO_TEXTO = { kind: z.literal("texto"), text: z.string() };
const CONTEUDO_URL = { kind: z.literal("url"), url: z.string() };
const CONTEUDO_ARQUIVO = {
  kind: z.literal("arquivo"),
  fileName: z.string(),
  sizeBytes: z.number(),
  mediaType: MEDIA_TYPE,
};
const RAIZ_DO_DOCUMENTO = { title: z.string(), labels: z.array(z.string()).optional() };

const ENTRADA_DE_DOCUMENTO = z.discriminatedUnion("kind", [
  z.object({ ...RAIZ_DO_DOCUMENTO, ...CONTEUDO_TEXTO }).strict(),
  z.object({ ...RAIZ_DO_DOCUMENTO, ...CONTEUDO_URL }).strict(),
  z.object({ ...RAIZ_DO_DOCUMENTO, ...CONTEUDO_ARQUIVO }).strict(),
]);

/** `EntradaDeVersao` — só `texto` e `arquivo`: uma Versão nova não vem de URL. */
const ENTRADA_DE_VERSAO = z.discriminatedUnion("kind", [
  z.object(CONTEUDO_TEXTO).strict(),
  z.object(CONTEUDO_ARQUIVO).strict(),
]);

const EDITAR_DOCUMENTO_INPUT = z
  .object({ title: z.string().optional(), labels: z.array(z.string()).optional(), summary: z.string().optional() })
  .strict();

const CONCEDER_COLECAO_INPUT = z.object({ agentId: ID, actions: z.array(ACAO_DA_CONCESSAO) }).strict();

export const IA_CONHECIMENTO = {
  criarColecao: z.tuple([NOVA_COLECAO_INPUT]),
  editarColecao: z.tuple([ID, EDITAR_COLECAO_INPUT]),
  adicionarFonte: z.tuple([ID, NOVA_FONTE_INPUT]),
  arquivarColecao: z.tuple([ID]),
  restaurarColecao: z.tuple([ID]),
  adicionarDocumento: z.tuple([ID, ENTRADA_DE_DOCUMENTO]),
  novaVersaoDoDocumento: z.tuple([ID, ENTRADA_DE_VERSAO]),
  restaurarVersaoDoDocumento: z.tuple([ID, z.number()]),
  editarDocumento: z.tuple([ID, EDITAR_DOCUMENTO_INPUT]),
  moverDocumento: z.tuple([ID, ID]),
  comentarDocumento: z.tuple([ID, z.string()]),
  arquivarDocumento: z.tuple([ID]),
  enviarDocumentoALixeira: z.tuple([ID]),
  restaurarDocumento: z.tuple([ID]),
  concederColecao: z.tuple([ID, CONCEDER_COLECAO_INPUT]),
  revogarColecao: z.tuple([ID]),
} satisfies Esquemas;

// ── Portão de enum bidirecional — falta ou sobra de membro não compila ──

type _EnumsCompletos = Confere<
  [
    Igual<z.infer<typeof MEDIA_TYPE>, Attachment["mediaType"]>,
    Igual<z.infer<typeof TIPO_DE_FONTE>, NovaFonteInput["kind"]>,
    Igual<z.infer<typeof POLITICA_DE_ATUALIZACAO>, NonNullable<KnowledgeSource["updatePolicy"]>["kind"]>,
    Igual<z.infer<typeof ACAO_DA_CONCESSAO>, AcaoDaConcessao>,
  ]
>;

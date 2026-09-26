/**
 * As operações de Conhecimento (20): a Coleção que nasce com a sua Fonte
 * Envio manual (RN-CNH-04), as Fontes URL e Integração, o Documento com
 * Versões imutáveis (RN-CNH-12) e Fragmentos simulados (D9), a movimentação
 * entre Coleções (RN-CNH-08), o Comentário e a Concessão a Agente, que vive
 * na Coleção (17.3, DO-CNH-12). As recusas vêm de `permissoes-ia`: a mesma
 * frase que a tela mostra em `disabledReason`.
 */

import { fail, ok, type DataState, type OperationResult } from "../../state";
import type {
  Attachment,
  Collection,
  CollectionGrant,
  Comment,
  DocumentVersion,
  Fragment,
  Id,
  KnowledgeDocument,
  KnowledgeSource,
  Lifecycle,
  WorkspaceFile,
} from "../../types";
import { fragmentarTexto } from "../../derive-ia";
import { memberActor, nextId, recordActivity } from "../activity";
import { recusaDeConvidado, recusaNaColecao, recusaNoDocumento } from "./permissoes-ia";
import { CONTENT_TYPE_LABEL } from "../../rotulos";

const now = (): string => new Date().toISOString();

/** RN-CNH-28 — o tamanho de arquivo é Limite imposto (B34), verificado no ato de criar. */
const TAMANHO_MAXIMO_DO_ARQUIVO = 25 * 1024 * 1024;

const ENDERECO_WEB = /^https?:\/\/\S+$/;

/** 12.1 — a Política de retenção com que toda Coleção nasce (padrão da plataforma). */
const RETENCAO_PADRAO: Collection["versionRetention"] = { maxSuperseded: 5, maxDays: 365 };

/** A marca que distingue a pausa do Sistema (ao arquivar) de uma pausa de Ator: só a primeira é desfeita ao restaurar (12.5). */
const PAUSADA_AO_ARQUIVAR = "Pausada ao arquivar a Coleção";

export type AcaoDaConcessao = CollectionGrant["actions"][number];

/** A ordem canônica em que uma Concessão grava as suas ações. */
const ACOES_DA_CONCESSAO: readonly AcaoDaConcessao[] = ["ver", "criar", "editar"];

const RESTRICAO: Record<Lifecycle, number> = { ativo: 0, arquivado: 1, naLixeira: 2 };
const maisRestritivo = (a: Lifecycle, b: Lifecycle): Lifecycle => (RESTRICAO[a] >= RESTRICAO[b] ? a : b);

const colecaoPorId = (state: DataState, id: Id): Collection | undefined => state.collections.find((c) => c.id === id);
const documentoPorId = (state: DataState, id: Id): KnowledgeDocument | undefined => state.documents.find((d) => d.id === id);

/** RN-CNH-04 — a Fonte implícita de toda Coleção; é por ela que entra o envio manual. */
const fonteDeEnvioManual = (colecao: Collection): KnowledgeSource | undefined => colecao.sources.find((s) => s.kind === "envioManual");

/** B36 — o Documento segue a Coleção: o estado efetivo é o mais restritivo dos dois. */
function estadoEfetivoDoDocumento(state: DataState, documento: KnowledgeDocument): Lifecycle {
  const colecao = colecaoPorId(state, documento.collectionId);
  return colecao ? maisRestritivo(documento.lifecycle, colecao.lifecycle) : "naLixeira";
}

/** RN-CNH-02 — homônima entre Coleções `ativo`/`arquivado`, sem maiúsculas nem espaços nas pontas; a lixeira não reserva nome. */
function colecaoHomonima(state: DataState, name: string, exceto?: Id): Collection | undefined {
  const chave = name.trim().toLocaleLowerCase("pt-BR");
  return state.collections.find((c) => c.id !== exceto && c.lifecycle !== "naLixeira" && c.name.trim().toLocaleLowerCase("pt-BR") === chave);
}

const normalizarRotulos = (labels: readonly string[]): string[] => [...new Set(labels.map((l) => l.trim()).filter((l) => l.length > 0))];

interface RegistroDeAtividade {
  readonly action: string;
  readonly result?: "ok" | "denied" | "failed";
  readonly before?: string;
  readonly after?: string;
  readonly detail?: string;
}

function registrarNaColecao(state: DataState, actingMemberId: Id, colecao: Collection, registro: RegistroDeAtividade): void {
  recordActivity(state, { actor: memberActor(actingMemberId), ...registro, objectType: "collection", objectId: colecao.id, objectName: colecao.name });
}

function registrarNoDocumento(state: DataState, actingMemberId: Id, documento: KnowledgeDocument, registro: RegistroDeAtividade): void {
  recordActivity(state, { actor: memberActor(actingMemberId), ...registro, objectType: "document", objectId: documento.id, objectName: documento.title });
}

// ── Coleção ────────────────────────────────────────────────────────────────

export interface NovaColecaoInput {
  readonly name: string;
  readonly description?: string;
  readonly isPrivate?: boolean;
}

/**
 * 12.1 — atômica: a Coleção `ativo`, o Proprietário (quem cria), a Fonte
 * Envio manual, a Política de retenção padrão e o Registro de Atividade.
 * Sem Documentos, e sem Coleção padrão do Espaço de Trabalho (DO-CNH-02).
 */
export function criarColecao(state: DataState, actingMemberId: Id, input: NovaColecaoInput): OperationResult<Collection> {
  const recusa = recusaDeConvidado(state, actingMemberId, "cria Coleção");
  if (recusa) return fail(recusa);
  const name = input.name.trim();
  if (!name) return fail("Dê um nome à Coleção.", "nome");
  const homonima = colecaoHomonima(state, name);
  if (homonima) return fail(`Já existe uma Coleção chamada “${homonima.name}”.`, "nome");

  const colecao: Collection = {
    id: nextId("col"),
    workspaceId: state.workspace.id,
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
    lifecycle: "ativo",
    name,
    description: input.description?.trim() ?? "",
    ownerMemberId: actingMemberId,
    isPrivate: input.isPrivate ?? false,
    sources: [{ id: nextId("src"), kind: "envioManual", name: "Envio manual", state: "ativo" }],
    versionRetention: { ...RETENCAO_PADRAO },
  };
  state.collections.push(colecao);
  registrarNaColecao(state, actingMemberId, colecao, { action: "Coleção criada", detail: "Fonte Envio manual criada no mesmo ato (RN-CNH-04)" });
  return ok(colecao, colecao.id);
}

export interface EditarColecaoInput {
  readonly name?: string;
  readonly description?: string;
  readonly isPrivate?: boolean;
}

/** Nome, descrição e privacidade (RN-CNH-06: `administrar`). Tornar privada não toca as Concessões a Agentes — elas vivem na Coleção (17.3). */
export function editarColecao(state: DataState, actingMemberId: Id, colecaoId: Id, patch: EditarColecaoInput): OperationResult<Collection> {
  const colecao = colecaoPorId(state, colecaoId);
  if (!colecao) return fail("Coleção não encontrada.");
  const recusa = recusaNaColecao(state, actingMemberId, colecao, "administrar");
  if (recusa) return fail(recusa);
  if (colecao.lifecycle !== "ativo") return fail("Restaure a Coleção antes.");

  let name: string | undefined;
  if (patch.name !== undefined) {
    name = patch.name.trim();
    if (!name) return fail("Dê um nome à Coleção.", "nome");
    const homonima = colecaoHomonima(state, name, colecao.id);
    if (homonima) return fail(`Já existe uma Coleção chamada “${homonima.name}”.`, "nome");
  }

  if (name !== undefined && name !== colecao.name) {
    const antes = colecao.name;
    colecao.name = name;
    registrarNaColecao(state, actingMemberId, colecao, { action: "Coleção renomeada", before: antes, after: name });
  }
  if (patch.description !== undefined && patch.description.trim() !== colecao.description) {
    colecao.description = patch.description.trim();
    registrarNaColecao(state, actingMemberId, colecao, { action: "Descrição da Coleção alterada" });
  }
  if (patch.isPrivate !== undefined && patch.isPrivate !== colecao.isPrivate) {
    colecao.isPrivate = patch.isPrivate;
    registrarNaColecao(state, actingMemberId, colecao, {
      action: patch.isPrivate ? "Coleção tornada privada" : "Coleção tornada pública",
      ...(patch.isPrivate ? { detail: "Só o Proprietário age nela; as Concessões a Agentes permanecem (17.3)" } : {}),
    });
  }
  return ok(colecao, colecao.id);
}

export interface NovaFonteInput {
  readonly kind: "url" | "integracao";
  readonly name: string;
  /** O endereço (URL) ou o id da Integração. */
  readonly config: string;
  readonly updatePolicy?: KnowledgeSource["updatePolicy"];
}

/** RN-CNH-04 — Fontes URL e Integração são adicionadas por quem administra a Coleção; a Envio manual ninguém adiciona nem remove. */
export function adicionarFonte(state: DataState, actingMemberId: Id, colecaoId: Id, input: NovaFonteInput): OperationResult<KnowledgeSource> {
  const colecao = colecaoPorId(state, colecaoId);
  if (!colecao) return fail("Coleção não encontrada.");
  const recusa = recusaNaColecao(state, actingMemberId, colecao, "administrar");
  if (recusa) return fail(recusa);
  if (colecao.lifecycle !== "ativo") return fail("Restaure a Coleção antes.");
  const name = input.name.trim();
  if (!name) return fail("Dê um nome à Fonte.", "nome");
  const config = input.config.trim();

  let estadoInicial: KnowledgeSource["state"] = "ativo";
  let motivo: string | undefined;
  if (input.kind === "url") {
    if (!ENDERECO_WEB.test(config)) return fail("O endereço da Fonte começa por http:// ou https://.", "endereco");
  } else {
    const integration = state.integrations.find((i) => i.id === config);
    if (!integration) return fail("A Integração indicada não existe neste Espaço de Trabalho.", "integracao");
    // 20.6 — sem Integração conectada não há Atualização: a Fonte já nasce `comErro`.
    if (integration.state !== "conectada") {
      estadoInicial = "comErro";
      motivo = `Integração “${integration.name}” desconectada`;
    }
  }
  const updatePolicy = input.updatePolicy ?? { kind: "manual" };
  if (updatePolicy.kind === "periodica" && (updatePolicy.intervalHours ?? 0) <= 0) {
    return fail("A Política periódica precisa de um intervalo em horas maior que zero.", "intervalo");
  }

  const fonte: KnowledgeSource = {
    id: nextId("src"),
    kind: input.kind,
    name,
    config,
    updatePolicy,
    configuredByMemberId: actingMemberId,
    state: estadoInicial,
    ...(motivo !== undefined ? { lastUpdateResult: motivo } : {}),
  };
  colecao.sources.push(fonte);
  registrarNaColecao(state, actingMemberId, colecao, {
    action: "Fonte adicionada",
    detail: `${name} (${input.kind === "url" ? "URL" : "Integração"})${motivo !== undefined ? ` · ${motivo}` : ""}`,
  });
  return ok(fonte, fonte.id);
}

/**
 * 12.5 — arquivar pausa as Fontes (ato do Sistema) e tira a Coleção das
 * consultas dos Agentes no mesmo ato: `conhecimentoAcessivel` só devolve
 * Coleções `ativo`. As Concessões permanecem gravadas.
 */
export function arquivarColecao(state: DataState, actingMemberId: Id, colecaoId: Id): OperationResult<Collection> {
  const colecao = colecaoPorId(state, colecaoId);
  if (!colecao) return fail("Coleção não encontrada.");
  const recusa = recusaNaColecao(state, actingMemberId, colecao, "administrar");
  if (recusa) return fail(recusa);
  if (colecao.lifecycle !== "ativo") return fail("Só uma Coleção ativa é arquivada.");

  colecao.lifecycle = "arquivado";
  colecao.archivedAt = now();
  let pausadas = 0;
  for (const fonte of colecao.sources) {
    if (fonte.kind === "envioManual" || fonte.state !== "ativo") continue;
    fonte.state = "pausado";
    fonte.lastUpdateResult = PAUSADA_AO_ARQUIVAR;
    pausadas += 1;
  }
  registrarNaColecao(state, actingMemberId, colecao, {
    action: "Coleção arquivada",
    before: "ativo",
    after: "arquivado",
    detail: `${pausadas} Fonte(s) pausada(s); Agentes deixam de consultá-la`,
  });
  return ok(colecao, colecao.id);
}

/** B43 — devolve o estado anterior à exclusão; do arquivo, volta a `ativo`. Reativa só as Fontes que o Sistema pausou (12.5). */
export function restaurarColecao(state: DataState, actingMemberId: Id, colecaoId: Id): OperationResult<Collection> {
  const colecao = colecaoPorId(state, colecaoId);
  if (!colecao) return fail("Coleção não encontrada.");
  if (colecao.lifecycle === "ativo") return fail("A Coleção já está ativa.");
  const recusa = recusaNaColecao(state, actingMemberId, colecao, colecao.lifecycle === "naLixeira" ? "excluir" : "administrar");
  if (recusa) return fail(recusa);
  // RN-CNH-02 — a lixeira não reservou o nome: restaurar com colisão é rejeitado até renomear.
  const homonima = colecaoHomonima(state, colecao.name, colecao.id);
  if (homonima) return fail(`Já existe uma Coleção chamada “${homonima.name}”.`, "nome");

  const anterior = colecao.lifecycle;
  const destino: Lifecycle = anterior === "naLixeira" ? (colecao.lifecycleBeforeTrash ?? "ativo") : "ativo";
  colecao.lifecycle = destino;
  delete colecao.lifecycleBeforeTrash;
  delete colecao.trashedAt;
  if (destino === "ativo") {
    delete colecao.archivedAt;
    for (const fonte of colecao.sources) {
      if (fonte.state !== "pausado" || fonte.lastUpdateResult !== PAUSADA_AO_ARQUIVAR) continue;
      fonte.state = "ativo";
      delete fonte.lastUpdateResult;
    }
  }
  registrarNaColecao(state, actingMemberId, colecao, { action: "Coleção restaurada", before: anterior, after: destino });
  return ok(colecao, colecao.id);
}

// ── Documento ──────────────────────────────────────────────────────────────

export type EntradaDeConteudo =
  | { readonly kind: "texto"; readonly text: string }
  | { readonly kind: "url"; readonly url: string }
  | { readonly kind: "arquivo"; readonly fileName: string; readonly sizeBytes: number; readonly mediaType: Attachment["mediaType"] };

export type EntradaDeDocumento = { readonly title: string; readonly labels?: readonly string[] } & EntradaDeConteudo;

/** Uma Versão nova vem de texto próprio ou de Arquivo (12.3); a captura de URL é da Fonte, não da edição. */
export type EntradaDeVersao = Extract<EntradaDeConteudo, { kind: "texto" | "arquivo" }>;

function tipoDoArquivo(fileName: string, mediaType: Attachment["mediaType"]): KnowledgeDocument["contentType"] {
  switch (mediaType) {
    case "image":
      return "imagem";
    case "audio":
      return "audio";
    case "video":
      return "video";
    case "spreadsheet":
      return "arquivoEstruturado";
    case "document":
      return fileName.toLowerCase().endsWith(".pdf") ? "pdf" : "texto";
    default:
      return "texto";
  }
}

function tipoDoConteudo(entrada: EntradaDeConteudo): KnowledgeDocument["contentType"] {
  switch (entrada.kind) {
    case "texto":
      return "texto";
    case "url":
      return "paginaWeb";
    case "arquivo":
      return tipoDoArquivo(entrada.fileName.trim(), entrada.mediaType);
  }
}

/** 7.4 — a origem específica que a Proveniência guarda como valor. */
function origemEspecifica(entrada: EntradaDeConteudo): string {
  switch (entrada.kind) {
    case "texto":
      return "texto colado";
    case "url":
      return entrada.url.trim();
    case "arquivo":
      return entrada.fileName.trim();
  }
}

/** A recusa de uma entrada de conteúdo, com o campo — ou nada, se ela serve. */
function recusaDaEntrada(entrada: EntradaDeConteudo): { readonly error: string; readonly field: string } | undefined {
  switch (entrada.kind) {
    case "texto":
      return entrada.text.trim() ? undefined : { error: "Cole ou escreva o texto do Documento.", field: "texto" };
    case "url":
      return ENDERECO_WEB.test(entrada.url.trim()) ? undefined : { error: "O endereço da página começa por http:// ou https://.", field: "endereco" };
    case "arquivo":
      if (!entrada.fileName.trim()) return { error: "Dê um nome ao arquivo.", field: "arquivo" };
      if (entrada.sizeBytes > TAMANHO_MAXIMO_DO_ARQUIVO) return { error: "O arquivo passa de 25 MB.", field: "arquivo" };
      return undefined;
  }
}

interface ConteudoPreparado {
  readonly content: DocumentVersion["content"];
  readonly fragments: Fragment[];
  readonly processing: DocumentVersion["processing"];
  /** O Arquivo do Espaço de Trabalho que a Versão referencia — só na entrada por arquivo. */
  readonly arquivo?: WorkspaceFile;
}

/** D9 — URL e arquivo rendem um Fragmento só; o conteúdo real ficaria com a Indexação (12.6). */
const fragmentoSimulado = (title: string): Fragment => ({
  id: nextId("frg"),
  position: { order: 0, locator: "1" },
  derivedContent: `Conteúdo de “${title}” (simulado)`,
});

const esperaTranscricao = (contentType: KnowledgeDocument["contentType"]): boolean => contentType === "audio" || contentType === "video";

/** O processamento simulado (D9): texto colado por parágrafo, URL e arquivo com um Fragmento, áudio e vídeo `pendente` sem Fragmentos. */
function prepararConteudo(state: DataState, actingMemberId: Id, title: string, entrada: EntradaDeConteudo): ConteudoPreparado {
  switch (entrada.kind) {
    case "texto": {
      const text = entrada.text.trim();
      return { content: { text }, fragments: fragmentarTexto(text), processing: "processado" };
    }
    case "url": {
      const url = entrada.url.trim();
      return { content: { text: `Conteúdo capturado de ${url} (simulado).` }, fragments: [fragmentoSimulado(title)], processing: "processado" };
    }
    case "arquivo": {
      const fileId = nextId("fil");
      const arquivo: WorkspaceFile = {
        id: fileId,
        workspaceId: state.workspace.id,
        name: entrada.fileName.trim(),
        mediaType: entrada.mediaType,
        sizeBytes: entrada.sizeBytes,
        createdBy: memberActor(actingMemberId),
        createdAt: now(),
        // Processamento simulado (D9): sem upload autorizado por trás, a referência
        // é o mesmo placeholder estável de `attachFile`, nunca o nome do arquivo.
        objectKey: `legado/${fileId}`,
        state: "enviado",
      };
      const pendente = esperaTranscricao(tipoDoArquivo(arquivo.name, arquivo.mediaType));
      return { content: { fileId: arquivo.id }, fragments: pendente ? [] : [fragmentoSimulado(title)], processing: pendente ? "pendente" : "processado", arquivo };
    }
  }
}

/** RN-CNH-14 — restaurar regenera os Fragmentos: a Versão é nova, o Conteúdo é o mesmo; o Tipo é o que a Versão restaurada impõe. */
function regenerarConteudo(contentType: KnowledgeDocument["contentType"], title: string, origem: DocumentVersion): ConteudoPreparado {
  if (origem.content.text !== undefined) {
    return { content: { text: origem.content.text }, fragments: fragmentarTexto(origem.content.text), processing: "processado" };
  }
  const pendente = esperaTranscricao(contentType);
  return { content: { ...origem.content }, fragments: pendente ? [] : [fragmentoSimulado(title)], processing: pendente ? "pendente" : "processado" };
}

/**
 * INV-CNH-07 — o Tipo de conteúdo que uma Versão restaurada devolve ao
 * Documento: o do Arquivo que ela referencia; texto continua no Tipo textual
 * que o Documento já tem (`texto` ou `paginaWeb`) e volta a `texto` quando um
 * Arquivo o havia substituído.
 */
function tipoDaVersaoRestaurada(state: DataState, documento: KnowledgeDocument, origem: DocumentVersion): KnowledgeDocument["contentType"] {
  if (origem.content.fileId !== undefined) {
    const arquivo = state.files.find((f) => f.id === origem.content.fileId);
    return arquivo ? tipoDoArquivo(arquivo.name, arquivo.mediaType) : documento.contentType;
  }
  return documento.contentType === "paginaWeb" ? "paginaWeb" : "texto";
}

/**
 * INV-CNH-07 — o Tipo de conteúdo acompanha a Versão corrente. `contentType`
 * é `readonly`: como em `moverDocumento`, mudar é substituir o objeto no
 * array; quando o Tipo não muda, o registro fica o mesmo.
 */
function comTipoDeConteudo(state: DataState, documento: KnowledgeDocument, contentType: KnowledgeDocument["contentType"]): KnowledgeDocument {
  if (documento.contentType === contentType) return documento;
  const atualizado: KnowledgeDocument = { ...documento, contentType };
  state.documents[state.documents.indexOf(documento)] = atualizado;
  return atualizado;
}

/** O que o Registro diz quando o Tipo mudou com a Versão; vazio quando não mudou. */
const mudancaDeTipo = (antes: KnowledgeDocument["contentType"], depois: KnowledgeDocument["contentType"]): string | undefined =>
  antes === depois ? undefined : `Tipo de conteúdo: ${CONTENT_TYPE_LABEL[antes]} → ${CONTENT_TYPE_LABEL[depois]}`;

/** O Arquivo entra no Espaço de Trabalho e a Versão o referencia, não o contém (6.3). */
function anexarArquivo(state: DataState, documento: Pick<KnowledgeDocument, "attachments">, arquivo: WorkspaceFile): void {
  state.files.push(arquivo);
  documento.attachments.push({ fileId: arquivo.id, order: documento.attachments.length, mediaType: arquivo.mediaType, displayName: arquivo.name });
}

/** 12.3 — a Versão N+1 passa a corrente no mesmo ato; a anterior recebe "Superada em" e guarda os Fragmentos para as Referências históricas (RN-CNH-13). */
function acrescentarVersao(documento: KnowledgeDocument, conteudo: ConteudoPreparado, origin: DocumentVersion["origin"]): DocumentVersion {
  const numero = documento.versions.reduce((maior, v) => Math.max(maior, v.number), 0) + 1;
  const corrente = documento.versions.find((v) => v.number === documento.currentVersion);
  if (corrente) corrente.supersededAt = origin.at;
  const versao: DocumentVersion = {
    number: numero,
    content: conteudo.content,
    derivedRepresentations: [],
    processing: conteudo.processing,
    origin,
    fragments: conteudo.fragments,
    createdAt: origin.at,
  };
  documento.versions.push(versao);
  documento.currentVersion = numero;
  return versao;
}

/**
 * 12.2, caminho 1 — envio manual: o Documento `ativo`, a Versão 1, a
 * Proveniência (INV-CNH-05) e o Registro no mesmo ato. A Fonte é a Envio
 * manual da Coleção (INV-CNH-03). Exige `criar` na Coleção (RN-CNH-06).
 */
export function adicionarDocumento(state: DataState, actingMemberId: Id, colecaoId: Id, entrada: EntradaDeDocumento): OperationResult<KnowledgeDocument> {
  const colecao = colecaoPorId(state, colecaoId);
  if (!colecao) return fail("Coleção não encontrada.");
  const recusa = recusaNaColecao(state, actingMemberId, colecao, "criar");
  if (recusa) return fail(recusa);
  if (colecao.lifecycle !== "ativo") return fail("Restaure a Coleção antes.");
  const fonte = fonteDeEnvioManual(colecao);
  if (!fonte) return fail("A Coleção não tem a Fonte Envio manual (RN-CNH-04).");
  const title = entrada.title.trim();
  if (!title) return fail("Dê um título ao Documento.", "titulo");
  const invalida = recusaDaEntrada(entrada);
  if (invalida) return fail(invalida.error, invalida.field);

  const at = now();
  const conteudo = prepararConteudo(state, actingMemberId, title, entrada);
  const documento: KnowledgeDocument = {
    id: nextId("doc"),
    workspaceId: state.workspace.id,
    createdBy: memberActor(actingMemberId),
    createdAt: at,
    lifecycle: "ativo",
    collectionId: colecao.id,
    sourceId: fonte.id,
    title,
    contentType: tipoDoConteudo(entrada),
    versions: [
      {
        number: 1,
        content: conteudo.content,
        derivedRepresentations: [],
        processing: conteudo.processing,
        origin: { kind: "envio", by: memberActor(actingMemberId), at },
        fragments: conteudo.fragments,
        createdAt: at,
      },
    ],
    currentVersion: 1,
    metadata: { labels: normalizarRotulos(entrada.labels ?? []) },
    provenance: { kind: "fonte", sourceId: fonte.id, sourceName: fonte.name, at, sourceKind: fonte.kind, specificOrigin: origemEspecifica(entrada) },
    comments: [],
    attachments: [],
  };
  if (conteudo.arquivo) anexarArquivo(state, documento, conteudo.arquivo);
  state.documents.push(documento);
  registrarNoDocumento(state, actingMemberId, documento, {
    action: "Documento adicionado",
    detail: `${conteudo.fragments.length} Fragmento(s)${conteudo.processing === "pendente" ? " · processamento pendente" : ""}`,
  });
  return ok(documento, documento.id);
}

/** RN-CNH-12 — o Conteúdo é imutável: editar é criar a Versão N+1, que se torna corrente no mesmo ato; o Tipo de conteúdo acompanha (INV-CNH-07). */
export function novaVersaoDoDocumento(state: DataState, actingMemberId: Id, documentId: Id, entrada: EntradaDeVersao): OperationResult<DocumentVersion> {
  const existente = documentoPorId(state, documentId);
  if (!existente) return fail("Documento não encontrado.");
  const recusa = recusaNoDocumento(state, actingMemberId, existente, "editar");
  if (recusa) return fail(recusa);
  if (estadoEfetivoDoDocumento(state, existente) !== "ativo") return fail("Um Documento arquivado não recebe Versão nova.");
  const invalida = recusaDaEntrada(entrada);
  if (invalida) return fail(invalida.error, invalida.field);

  const conteudo = prepararConteudo(state, actingMemberId, existente.title, entrada);
  const documento = comTipoDeConteudo(state, existente, tipoDoConteudo(entrada));
  if (conteudo.arquivo) anexarArquivo(state, documento, conteudo.arquivo);
  const versao = acrescentarVersao(documento, conteudo, { kind: "edicao", by: memberActor(actingMemberId), at: now() });
  const tipo = mudancaDeTipo(existente.contentType, documento.contentType);
  registrarNoDocumento(state, actingMemberId, documento, {
    action: "Versão do Documento criada",
    after: `versão ${versao.number}`,
    detail: `${conteudo.fragments.length} Fragmento(s)${tipo ? ` · ${tipo}` : ""}`,
  });
  return ok(versao, documento.id);
}

/** RN-CNH-14 — restaurar é criar: Versão N+1 com o mesmo Conteúdo e Origem `restauração`; a corrente nunca volta para trás. O Tipo de conteúdo acompanha (INV-CNH-07). */
export function restaurarVersaoDoDocumento(state: DataState, actingMemberId: Id, documentId: Id, numero: number): OperationResult<DocumentVersion> {
  const existente = documentoPorId(state, documentId);
  if (!existente) return fail("Documento não encontrado.");
  const recusa = recusaNoDocumento(state, actingMemberId, existente, "editar");
  if (recusa) return fail(recusa);
  if (estadoEfetivoDoDocumento(state, existente) !== "ativo") return fail("Um Documento arquivado não recebe Versão nova.");
  const origem = existente.versions.find((v) => v.number === numero);
  if (!origem) return fail(`A Versão ${numero} não existe.`, "versao");
  if (numero === existente.currentVersion) return fail("Esta já é a Versão corrente.", "versao");
  if (origem.content.text === undefined && origem.content.fileId === undefined) {
    return fail(`O conteúdo da Versão ${numero} não está mais disponível.`, "versao");
  }

  const documento = comTipoDeConteudo(state, existente, tipoDaVersaoRestaurada(state, existente, origem));
  const conteudo = regenerarConteudo(documento.contentType, documento.title, origem);
  const versao = acrescentarVersao(documento, conteudo, { kind: "restauracao", by: memberActor(actingMemberId), at: now() });
  const tipo = mudancaDeTipo(existente.contentType, documento.contentType);
  registrarNoDocumento(state, actingMemberId, documento, {
    action: "Versão do Documento restaurada",
    before: `versão ${numero}`,
    after: `versão ${versao.number}`,
    ...(tipo ? { detail: tipo } : {}),
  });
  return ok(versao, documento.id);
}

export interface EditarDocumentoInput {
  readonly title?: string;
  readonly labels?: readonly string[];
  /** Vazio apaga o resumo. */
  readonly summary?: string;
}

/** RN-CNH-12 — título, Metadado e rótulos alteram-se sem criar Versão. */
export function editarDocumento(state: DataState, actingMemberId: Id, documentId: Id, patch: EditarDocumentoInput): OperationResult<KnowledgeDocument> {
  const documento = documentoPorId(state, documentId);
  if (!documento) return fail("Documento não encontrado.");
  const recusa = recusaNoDocumento(state, actingMemberId, documento, "editar");
  if (recusa) return fail(recusa);
  if (estadoEfetivoDoDocumento(state, documento) === "naLixeira") return fail("Restaure o Documento antes de editar.");

  let title: string | undefined;
  if (patch.title !== undefined) {
    title = patch.title.trim();
    if (!title) return fail("Dê um título ao Documento.", "titulo");
  }

  const mudancas: string[] = [];
  let antes: string | undefined;
  if (title !== undefined && title !== documento.title) {
    antes = documento.title;
    documento.title = title;
    mudancas.push("título");
  }
  if (patch.labels !== undefined) {
    const labels = normalizarRotulos(patch.labels);
    if (labels.join("\n") !== documento.metadata.labels.join("\n")) {
      documento.metadata.labels = labels;
      mudancas.push("rótulos");
    }
  }
  if (patch.summary !== undefined) {
    const summary = patch.summary.trim();
    if (summary !== (documento.metadata.summary ?? "")) {
      if (summary) documento.metadata.summary = summary;
      else delete documento.metadata.summary;
      mudancas.push("resumo");
    }
  }
  if (mudancas.length === 0) return ok(documento);

  registrarNoDocumento(state, actingMemberId, documento, {
    action: "Documento editado",
    ...(antes !== undefined ? { before: antes, after: documento.title } : {}),
    detail: mudancas.join(" · "),
  });
  return ok(documento, documento.id);
}

/**
 * RN-CNH-08 — atômica, só para Documentos da Fonte Envio manual (os
 * sincronizados seriam recriados pela Atualização seguinte): exige `excluir`
 * na origem e `criar` no destino; identidade, Versões, Comentários e
 * Proveniência acompanham; a permissão passa a ser a do destino.
 */
export function moverDocumento(state: DataState, actingMemberId: Id, documentId: Id, destinoId: Id): OperationResult<KnowledgeDocument> {
  const documento = documentoPorId(state, documentId);
  if (!documento) return fail("Documento não encontrado.");
  const origem = colecaoPorId(state, documento.collectionId);
  if (!origem) return fail("A Coleção deste Documento não existe mais.");
  const naOrigem = recusaNoDocumento(state, actingMemberId, documento, "excluir");
  if (naOrigem) return fail(naOrigem);
  if (documento.lifecycle === "naLixeira") return fail("Restaure o Documento da lixeira antes de mover.");
  const fonte = origem.sources.find((s) => s.id === documento.sourceId);
  if (fonte?.kind !== "envioManual") {
    return fail("Só Documentos de envio manual são movidos; os sincronizados seriam recriados pela Fonte (RN-CNH-08).");
  }
  const destino = colecaoPorId(state, destinoId);
  if (!destino) return fail("Coleção de destino não encontrada.", "destino");
  if (destino.id === origem.id) return fail("O Documento já está nesta Coleção.", "destino");
  if (destino.lifecycle !== "ativo") return fail("Restaure a Coleção de destino antes.", "destino");
  const noDestino = recusaNaColecao(state, actingMemberId, destino, "criar");
  if (noDestino) return fail(noDestino, "destino");
  const fonteDoDestino = fonteDeEnvioManual(destino);
  if (!fonteDoDestino) return fail("A Coleção de destino não tem a Fonte Envio manual (RN-CNH-04).", "destino");

  // `collectionId` e `sourceId` são `readonly`: mover é substituir o objeto no
  // array. A Proveniência fica como estava — é valor histórico (INV-CNH-05).
  const movido: KnowledgeDocument = { ...documento, collectionId: destino.id, sourceId: fonteDoDestino.id };
  state.documents[state.documents.indexOf(documento)] = movido;
  registrarNoDocumento(state, actingMemberId, movido, { action: "Documento movido", before: origem.name, after: destino.name });
  return ok(movido, movido.id);
}

/** Comentar exige `comentar` na Coleção (RN-CNH-06): qualquer Membro; privada, só o Proprietário. */
export function comentarDocumento(state: DataState, actingMemberId: Id, documentId: Id, content: string): OperationResult<Comment> {
  const documento = documentoPorId(state, documentId);
  if (!documento) return fail("Documento não encontrado.");
  const recusa = recusaNoDocumento(state, actingMemberId, documento, "comentar");
  if (recusa) return fail(recusa);
  if (estadoEfetivoDoDocumento(state, documento) === "naLixeira") return fail("Um Documento na lixeira não recebe Comentários.");
  const texto = content.trim();
  if (!texto) return fail("Escreva o comentário.", "conteudo");

  const comment: Comment = {
    id: nextId("cmt"),
    author: memberActor(actingMemberId),
    content: texto,
    attachments: [],
    mentions: [],
    createdAt: now(),
  };
  documento.comments.push(comment);
  registrarNoDocumento(state, actingMemberId, documento, {
    action: "Comentário no Documento",
    detail: texto.length > 80 ? `${texto.slice(0, 77)}…` : texto,
  });
  return ok(comment, comment.id);
}

/** 12.5 — arquivar/desarquivar Documento exige `editar`. */
export function arquivarDocumento(state: DataState, actingMemberId: Id, documentId: Id): OperationResult<KnowledgeDocument> {
  const documento = documentoPorId(state, documentId);
  if (!documento) return fail("Documento não encontrado.");
  const recusa = recusaNoDocumento(state, actingMemberId, documento, "editar");
  if (recusa) return fail(recusa);
  if (documento.lifecycle !== "ativo") return fail("Só um Documento ativo é arquivado.");
  if (colecaoPorId(state, documento.collectionId)?.lifecycle !== "ativo") return fail("Restaure a Coleção antes.");

  documento.lifecycle = "arquivado";
  documento.archivedAt = now();
  registrarNoDocumento(state, actingMemberId, documento, { action: "Documento arquivado", before: "ativo", after: "arquivado" });
  return ok(documento, documento.id);
}

/** 12.5 — lixeira exige `excluir`; B43 guarda o estado anterior. As Referências que o citam passam a resolver com marcador (RN-CNH-22). */
export function enviarDocumentoALixeira(state: DataState, actingMemberId: Id, documentId: Id): OperationResult<KnowledgeDocument> {
  const documento = documentoPorId(state, documentId);
  if (!documento) return fail("Documento não encontrado.");
  const recusa = recusaNoDocumento(state, actingMemberId, documento, "excluir");
  if (recusa) return fail(recusa);
  if (documento.lifecycle === "naLixeira") return fail("O Documento já está na lixeira.");

  const anterior = documento.lifecycle;
  documento.lifecycleBeforeTrash = anterior;
  documento.lifecycle = "naLixeira";
  documento.trashedAt = now();
  registrarNoDocumento(state, actingMemberId, documento, {
    action: "Documento enviado à lixeira",
    before: anterior,
    after: "naLixeira",
    detail: "Referências de Conhecimento passam a resolver com marcador (RN-CNH-22)",
  });
  return ok(documento, documento.id);
}

/** B43 — da lixeira volta ao estado anterior (`excluir`); do arquivo volta a `ativo` (`editar`). Exige a Coleção fora da lixeira (12.5). */
export function restaurarDocumento(state: DataState, actingMemberId: Id, documentId: Id): OperationResult<KnowledgeDocument> {
  const documento = documentoPorId(state, documentId);
  if (!documento) return fail("Documento não encontrado.");
  if (documento.lifecycle === "ativo") return fail("O Documento já está ativo.");
  const recusa = recusaNoDocumento(state, actingMemberId, documento, documento.lifecycle === "naLixeira" ? "excluir" : "editar");
  if (recusa) return fail(recusa);
  const colecao = colecaoPorId(state, documento.collectionId);
  if (!colecao || colecao.lifecycle === "naLixeira") return fail("Restaure a Coleção antes.");

  const anterior = documento.lifecycle;
  const destino: Lifecycle = anterior === "naLixeira" ? (documento.lifecycleBeforeTrash ?? "ativo") : "ativo";
  documento.lifecycle = destino;
  delete documento.lifecycleBeforeTrash;
  delete documento.trashedAt;
  if (destino === "ativo") delete documento.archivedAt;
  registrarNoDocumento(state, actingMemberId, documento, { action: "Documento restaurado", before: anterior, after: destino });
  return ok(documento, documento.id);
}

// ── Concessão a Agente ─────────────────────────────────────────────────────

export interface ConcederColecaoInput {
  readonly agentId: Id;
  readonly actions: readonly AcaoDaConcessao[];
}

/**
 * 17.3 — "Agente tem acesso à Coleção" é concessão direta de `ver` (e, se o
 * produto pedir, `criar`/`editar`) feita por quem administra a Coleção. Vive
 * na Coleção; o Agente a exibe como "Conhecimento acessível" (DO-CNH-12).
 */
export function concederColecao(state: DataState, actingMemberId: Id, colecaoId: Id, input: ConcederColecaoInput): OperationResult<CollectionGrant> {
  const colecao = colecaoPorId(state, colecaoId);
  if (!colecao) return fail("Coleção não encontrada.");
  const recusa = recusaNaColecao(state, actingMemberId, colecao, "administrar");
  if (recusa) return fail(recusa);
  if (colecao.lifecycle === "naLixeira") return fail("Restaure a Coleção antes.");
  const agent = state.agents.find((a) => a.id === input.agentId);
  if (!agent) return fail("Agente não encontrado.", "agente");
  if (agent.lifecycle === "naLixeira") return fail("Um Agente na lixeira não recebe acesso.", "agente");
  const actions = ACOES_DA_CONCESSAO.filter((a) => input.actions.includes(a));
  if (!actions.includes("ver")) return fail("Toda concessão a Agente inclui ver (17.3).", "acoes");
  if (state.collectionGrants.some((g) => g.collectionId === colecao.id && g.agentId === agent.id)) {
    return fail("Este Agente já tem acesso a esta Coleção: revogue e conceda de novo para mudar as ações.", "agente");
  }

  const grant: CollectionGrant = {
    id: nextId("cgr"),
    collectionId: colecao.id,
    agentId: agent.id,
    actions,
    grantedBy: actingMemberId,
    grantedAt: now(),
  };
  state.collectionGrants.push(grant);
  registrarNaColecao(state, actingMemberId, colecao, { action: "Acesso concedido a Agente", detail: `${agent.name} · ${actions.join(", ")}` });
  return ok(grant, grant.id);
}

/** Revogar é ato de quem administra a Coleção; a próxima consulta do Agente já não a encontra (B23). */
export function revogarColecao(state: DataState, actingMemberId: Id, grantId: Id): OperationResult<CollectionGrant> {
  const grant = state.collectionGrants.find((g) => g.id === grantId);
  if (!grant) return fail("Concessão não encontrada.");
  const colecao = colecaoPorId(state, grant.collectionId);
  if (!colecao) return fail("A Coleção desta Concessão não existe mais.");
  const recusa = recusaNaColecao(state, actingMemberId, colecao, "administrar");
  if (recusa) return fail(recusa);

  state.collectionGrants.splice(state.collectionGrants.indexOf(grant), 1);
  const agent = state.agents.find((a) => a.id === grant.agentId);
  registrarNaColecao(state, actingMemberId, colecao, { action: "Acesso de Agente revogado", detail: agent?.name ?? grant.agentId });
  return ok(grant, colecao.id);
}

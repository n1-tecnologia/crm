/**
 * Conhecimento (20): a Coleção com a sua Fonte, o Documento com Versões e
 * Fragmentos simulados, a movimentação, a privacidade, a Concessão a Agente e
 * o Comentário. Cada teste afirma o RESULTADO e o estado que ficou, nunca
 * que uma função foi chamada.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../../seed";
import type { DataState, OperationResult } from "../../state";
import { conhecimentoAcessivel } from "../../derive-ia";
import {
  adicionarDocumento,
  adicionarFonte,
  arquivarColecao,
  arquivarDocumento,
  comentarDocumento,
  concederColecao,
  criarColecao,
  editarColecao,
  editarDocumento,
  enviarDocumentoALixeira,
  moverDocumento,
  novaVersaoDoDocumento,
  restaurarColecao,
  restaurarDocumento,
  restaurarVersaoDoDocumento,
  revogarColecao,
} from "./conhecimento";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const registro = <T extends { readonly id: string }>(lista: readonly T[], id: string): T => {
  const item = lista.find((x) => x.id === id);
  if (!item) throw new Error(`seed sem ${id}`);
  return item;
};

const valor = <T>(r: OperationResult<T>): T => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

const PRIVADA = "Esta Coleção é privada: só o Proprietário age nela.";
const SO_PROPRIETARIO_ADMINISTRA = "Administrar esta Coleção exige ser o seu Proprietário ou administrar o Espaço de Trabalho.";

describe("Coleção", () => {
  it("criar Coleção cria a Fonte Envio manual no mesmo ato; nome repetido e Convidado são recusados", () => {
    const r = criarColecao(state, "mem_julia", { name: "  Perguntas frequentes ", description: " Dúvidas dos alunos " });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const colecao = r.value;
    expect(r.id).toBe(colecao.id);
    expect(colecao).toMatchObject({ name: "Perguntas frequentes", description: "Dúvidas dos alunos", ownerMemberId: "mem_julia", isPrivate: false, lifecycle: "ativo" });
    expect(colecao.createdBy).toEqual({ kind: "member", id: "mem_julia" });
    expect(colecao.sources).toHaveLength(1);
    expect(colecao.sources[0]).toMatchObject({ kind: "envioManual", name: "Envio manual", state: "ativo" });
    expect(colecao.versionRetention).toEqual({ maxSuperseded: 5, maxDays: 365 });
    expect(state.collections).toContain(colecao);
    expect(state.activity[0]).toMatchObject({
      action: "Coleção criada",
      objectType: "collection",
      objectId: colecao.id,
      detail: "Fonte Envio manual criada no mesmo ato (RN-CNH-04)",
    });

    // RN-CNH-02 — sem distinção de maiúsculas e espaços nas pontas.
    expect(criarColecao(state, "mem_julia", { name: "material COMERCIAL " })).toEqual({
      ok: false,
      error: "Já existe uma Coleção chamada “Material comercial”.",
      field: "nome",
    });
    expect(criarColecao(state, "mem_julia", { name: "   " })).toEqual({ ok: false, error: "Dê um nome à Coleção.", field: "nome" });
    expect(criarColecao(state, "mem_beatriz", { name: "Do Convidado" })).toEqual({ ok: false, error: "O Papel Convidado não cria Coleção." });
    expect(criarColecao(state, "mem_tiago", { name: "Do removido" })).toEqual({ ok: false, error: "Só um Membro ativo age sobre a IA do Espaço de Trabalho." });

    // A lixeira não reserva nome.
    registro(state.collections, "col_comercial").lifecycle = "naLixeira";
    expect(criarColecao(state, "mem_julia", { name: "Material comercial" }).ok).toBe(true);
  });

  it("editar renomeia com a mesma regra de nome e registra a mudança de privacidade", () => {
    expect(editarColecao(state, "mem_julia", "col_onboarding", { name: "Playbooks do Comercial" })).toEqual({
      ok: false,
      error: "Já existe uma Coleção chamada “Playbooks do comercial”.",
      field: "nome",
    });
    const colecao = registro(state.collections, "col_onboarding");
    const r = editarColecao(state, "mem_julia", "col_onboarding", { name: "Onboarding de alunos", isPrivate: true });
    expect(r.ok).toBe(true);
    // O mesmo nome não é renomeação: só a privacidade muda.
    expect(colecao.isPrivate).toBe(true);
    expect(state.activity[0]).toMatchObject({ action: "Coleção tornada privada", objectId: "col_onboarding" });
    expect(state.activity[1]?.action).not.toBe("Coleção renomeada");
    // Membro que não é Proprietário não administra.
    expect(editarColecao(state, "mem_marcos", "col_comercial", { name: "Outro" })).toEqual({ ok: false, error: SO_PROPRIETARIO_ADMINISTRA });
  });

  it("adicionar Fonte: endereço verificado; Integração desconectada nasce comErro e conectada nasce ativa", () => {
    expect(adicionarFonte(state, "mem_julia", "col_onboarding", { kind: "url", name: "Site", config: "exemplo.com/alunos" })).toEqual({
      ok: false,
      error: "O endereço da Fonte começa por http:// ou https://.",
      field: "endereco",
    });
    expect(adicionarFonte(state, "mem_julia", "col_onboarding", { kind: "url", name: " ", config: "https://exemplo.com" })).toEqual({
      ok: false,
      error: "Dê um nome à Fonte.",
      field: "nome",
    });
    const site = valor(
      adicionarFonte(state, "mem_julia", "col_onboarding", {
        kind: "url",
        name: "Site da escola",
        config: "https://exemplo.com/alunos",
        updatePolicy: { kind: "periodica", intervalHours: 24 },
      }),
    );
    expect(site).toMatchObject({ kind: "url", name: "Site da escola", config: "https://exemplo.com/alunos", state: "ativo", configuredByMemberId: "mem_julia" });
    expect(site.updatePolicy).toEqual({ kind: "periodica", intervalHours: 24 });
    expect(registro(state.collections, "col_onboarding").sources).toContain(site);
    expect(state.activity[0]).toMatchObject({ action: "Fonte adicionada", objectId: "col_onboarding", detail: "Site da escola (URL)" });

    expect(adicionarFonte(state, "mem_julia", "col_onboarding", { kind: "integracao", name: "Agenda", config: "int_inexistente" })).toEqual({
      ok: false,
      error: "A Integração indicada não existe neste Espaço de Trabalho.",
      field: "integracao",
    });
    // 20.6 — a Agenda do seed está desconectada.
    const agenda = valor(adicionarFonte(state, "mem_julia", "col_onboarding", { kind: "integracao", name: "Agenda", config: "int_agenda" }));
    expect(agenda.state).toBe("comErro");
    expect(agenda.updatePolicy).toEqual({ kind: "manual" });
    expect(agenda.lastUpdateResult).toBe("Integração “Agenda (Google)” desconectada");
    const erp = valor(adicionarFonte(state, "mem_julia", "col_onboarding", { kind: "integracao", name: "ERP", config: "int_erp" }));
    expect(erp.state).toBe("ativo");
    expect(erp.lastUpdateResult).toBeUndefined();

    expect(adicionarFonte(state, "mem_marcos", "col_onboarding", { kind: "url", name: "Outro", config: "https://exemplo.com" })).toEqual({
      ok: false,
      error: SO_PROPRIETARIO_ADMINISTRA,
    });
  });

  it("arquivar pausa as Fontes que o Sistema reativa ao restaurar; a Envio manual e uma Fonte comErro não mudam", () => {
    valor(adicionarFonte(state, "mem_julia", "col_onboarding", { kind: "url", name: "Site", config: "https://exemplo.com" }));
    const agenda = valor(adicionarFonte(state, "mem_julia", "col_onboarding", { kind: "integracao", name: "Agenda", config: "int_agenda" }));
    const colecao = registro(state.collections, "col_onboarding");
    valor(concederColecao(state, "mem_julia", "col_onboarding", { agentId: "agt_enriquecedor", actions: ["ver"] }));

    expect(arquivarColecao(state, "mem_julia", "col_onboarding").ok).toBe(true);
    expect(colecao.lifecycle).toBe("arquivado");
    expect(colecao.archivedAt).toBeDefined();
    expect(colecao.sources.map((s) => s.state)).toEqual(["ativo", "pausado", "comErro"]);
    expect(state.activity[0]).toMatchObject({ action: "Coleção arquivada", detail: "1 Fonte(s) pausada(s); Agentes deixam de consultá-la" });
    // A Concessão permanece; o Conhecimento acessível é que deixa de listar a Coleção.
    expect(state.collectionGrants.some((g) => g.collectionId === "col_onboarding")).toBe(true);
    expect(conhecimentoAcessivel(state, "agt_enriquecedor").map((c) => c.id)).not.toContain("col_onboarding");
    expect(arquivarColecao(state, "mem_julia", "col_onboarding")).toEqual({ ok: false, error: "Só uma Coleção ativa é arquivada." });
    expect(adicionarDocumento(state, "mem_julia", "col_onboarding", { kind: "texto", title: "Depois", text: "x" })).toEqual({
      ok: false,
      error: "Restaure a Coleção antes.",
    });

    expect(restaurarColecao(state, "mem_julia", "col_onboarding").ok).toBe(true);
    expect(colecao.lifecycle).toBe("ativo");
    expect(colecao.archivedAt).toBeUndefined();
    expect(colecao.sources.map((s) => s.state)).toEqual(["ativo", "ativo", "comErro"]);
    expect(agenda.lastUpdateResult).toBe("Integração “Agenda (Google)” desconectada");
    expect(conhecimentoAcessivel(state, "agt_enriquecedor").map((c) => c.id)).toContain("col_onboarding");
    expect(restaurarColecao(state, "mem_julia", "col_onboarding")).toEqual({ ok: false, error: "A Coleção já está ativa." });
  });
});

describe("Documento", () => {
  it("adicionar por texto: Versão 1 processada, um Fragmento por parágrafo e Proveniência pela Fonte Envio manual", () => {
    const r = adicionarDocumento(state, "mem_julia", "col_onboarding", {
      kind: "texto",
      title: " Primeira semana ",
      labels: ["onboarding", " onboarding", "turma", " "],
      text: "Bem-vindo à turma.\n\nA primeira aula é na segunda.\n\nTraga dúvidas.",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const doc = r.value;
    expect(r.id).toBe(doc.id);
    expect(doc).toMatchObject({ title: "Primeira semana", collectionId: "col_onboarding", sourceId: "src_col_onboarding_manual", contentType: "texto", currentVersion: 1, lifecycle: "ativo" });
    expect(doc.versions).toHaveLength(1);
    const v1 = doc.versions[0];
    expect(v1?.processing).toBe("processado");
    expect(v1?.content).toEqual({ text: "Bem-vindo à turma.\n\nA primeira aula é na segunda.\n\nTraga dúvidas." });
    expect(v1?.origin).toMatchObject({ kind: "envio", by: { kind: "member", id: "mem_julia" } });
    expect(v1?.fragments.map((f) => f.position.locator)).toEqual(["p1", "p2", "p3"]);
    expect(v1?.fragments[1]?.derivedContent).toBe("A primeira aula é na segunda.");
    expect(doc.provenance).toMatchObject({ kind: "fonte", sourceId: "src_col_onboarding_manual", sourceName: "Envio manual", sourceKind: "envioManual", specificOrigin: "texto colado" });
    expect(doc.metadata.labels).toEqual(["onboarding", "turma"]);
    expect(doc.attachments).toEqual([]);
    expect(state.documents).toContain(doc);
    expect(state.activity[0]).toMatchObject({ action: "Documento adicionado", objectType: "document", objectId: doc.id, detail: "3 Fragmento(s)" });

    expect(adicionarDocumento(state, "mem_julia", "col_onboarding", { kind: "texto", title: "Vazio", text: " \n\n " })).toEqual({
      ok: false,
      error: "Cole ou escreva o texto do Documento.",
      field: "texto",
    });
    expect(adicionarDocumento(state, "mem_julia", "col_onboarding", { kind: "texto", title: "  ", text: "x" })).toEqual({
      ok: false,
      error: "Dê um título ao Documento.",
      field: "titulo",
    });
    expect(adicionarDocumento(state, "mem_beatriz", "col_onboarding", { kind: "texto", title: "Do Convidado", text: "x" })).toEqual({
      ok: false,
      error: "O Papel Convidado não age sobre Coleções.",
    });
    // Criar é de qualquer Membro, mesmo fora da Coleção dele.
    expect(adicionarDocumento(state, "mem_marcos", "col_onboarding", { kind: "texto", title: "Do Marcos", text: "x" }).ok).toBe(true);
  });

  it("URL e arquivo rendem um só Fragmento; áudio fica pendente sem Fragmentos; endereço, nome e tamanho são verificados", () => {
    const pagina = valor(adicionarDocumento(state, "mem_julia", "col_onboarding", { kind: "url", title: "FAQ do site", url: " https://exemplo.com/faq " }));
    expect(pagina.contentType).toBe("paginaWeb");
    expect(pagina.versions[0]?.fragments).toHaveLength(1);
    expect(pagina.versions[0]?.fragments[0]?.derivedContent).toBe("Conteúdo de “FAQ do site” (simulado)");
    expect(pagina.versions[0]?.content.text).toBe("Conteúdo capturado de https://exemplo.com/faq (simulado).");
    expect(pagina.versions[0]?.processing).toBe("processado");
    expect(pagina.provenance.specificOrigin).toBe("https://exemplo.com/faq");
    expect(adicionarDocumento(state, "mem_julia", "col_onboarding", { kind: "url", title: "Sem esquema", url: "exemplo.com/faq" })).toEqual({
      ok: false,
      error: "O endereço da página começa por http:// ou https://.",
      field: "endereco",
    });

    const arquivosAntes = state.files.length;
    const pdf = valor(
      adicionarDocumento(state, "mem_julia", "col_onboarding", { kind: "arquivo", title: "Manual do aluno", fileName: "manual-do-aluno.PDF", sizeBytes: 2_000_000, mediaType: "document" }),
    );
    expect(pdf.contentType).toBe("pdf");
    expect(state.files).toHaveLength(arquivosAntes + 1);
    const arquivo = state.files[state.files.length - 1];
    expect(arquivo).toMatchObject({ name: "manual-do-aluno.PDF", sizeBytes: 2_000_000, mediaType: "document", createdBy: { kind: "member", id: "mem_julia" } });
    expect(pdf.attachments).toEqual([{ fileId: arquivo?.id, order: 0, mediaType: "document", displayName: "manual-do-aluno.PDF" }]);
    expect(pdf.versions[0]?.content).toEqual({ fileId: arquivo?.id });
    expect(pdf.versions[0]?.fragments).toHaveLength(1);
    expect(pdf.versions[0]?.processing).toBe("processado");
    expect(pdf.provenance.specificOrigin).toBe("manual-do-aluno.PDF");

    const audio = valor(adicionarDocumento(state, "mem_julia", "col_onboarding", { kind: "arquivo", title: "Aula gravada", fileName: "aula-1.mp3", sizeBytes: 5_000_000, mediaType: "audio" }));
    expect(audio.contentType).toBe("audio");
    expect(audio.versions[0]?.processing).toBe("pendente");
    expect(audio.versions[0]?.fragments).toEqual([]);
    expect(state.activity[0]).toMatchObject({ action: "Documento adicionado", objectId: audio.id, detail: "0 Fragmento(s) · processamento pendente" });

    expect(valor(adicionarDocumento(state, "mem_julia", "col_onboarding", { kind: "arquivo", title: "Tabela", fileName: "tabela.xlsx", sizeBytes: 10, mediaType: "spreadsheet" })).contentType).toBe("arquivoEstruturado");
    expect(valor(adicionarDocumento(state, "mem_julia", "col_onboarding", { kind: "arquivo", title: "Notas", fileName: "notas.docx", sizeBytes: 10, mediaType: "document" })).contentType).toBe("texto");
    expect(valor(adicionarDocumento(state, "mem_julia", "col_onboarding", { kind: "arquivo", title: "Foto", fileName: "turma.jpg", sizeBytes: 10, mediaType: "image" })).contentType).toBe("imagem");

    const antesDaRecusa = state.files.length;
    expect(adicionarDocumento(state, "mem_julia", "col_onboarding", { kind: "arquivo", title: "Grande demais", fileName: "video.mp4", sizeBytes: 26 * 1024 * 1024, mediaType: "video" })).toEqual({
      ok: false,
      error: "O arquivo passa de 25 MB.",
      field: "arquivo",
    });
    expect(adicionarDocumento(state, "mem_julia", "col_onboarding", { kind: "arquivo", title: "Sem nome", fileName: " ", sizeBytes: 10, mediaType: "document" })).toEqual({
      ok: false,
      error: "Dê um nome ao arquivo.",
      field: "arquivo",
    });
    // Uma recusa não deixa Arquivo para trás.
    expect(state.files).toHaveLength(antesDaRecusa);
  });

  it("nova Versão torna-se corrente e supera a anterior; restaurar uma antiga cria Versão nova; arquivado não recebe Versão", () => {
    const doc = registro(state.documents, "doc_3");
    const r = novaVersaoDoDocumento(state, "mem_rafael", "doc_3", { kind: "texto", text: "Caso da clínica Renovar.\n\nCaso da clínica Vida." });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const v2 = r.value;
    expect(r.id).toBe("doc_3");
    expect(v2).toMatchObject({ number: 2, processing: "processado", origin: { kind: "edicao", by: { kind: "member", id: "mem_rafael" } } });
    expect(v2.fragments).toHaveLength(2);
    expect(v2.supersededAt).toBeUndefined();
    expect(doc.currentVersion).toBe(2);
    expect(doc.versions).toHaveLength(2);
    // A anterior fica superada e guarda os Fragmentos para as Referências históricas (RN-CNH-13).
    expect(doc.versions[0]?.supersededAt).toBeDefined();
    expect(doc.versions[0]?.fragments).toHaveLength(1);
    expect(state.activity[0]).toMatchObject({ action: "Versão do Documento criada", objectId: "doc_3", after: "versão 2", detail: "2 Fragmento(s)" });

    // RN-CNH-14 — restaurar nunca volta o ponteiro: cria a v3 igual à v1.
    expect(restaurarVersaoDoDocumento(state, "mem_rafael", "doc_3", 2)).toEqual({ ok: false, error: "Esta já é a Versão corrente.", field: "versao" });
    expect(restaurarVersaoDoDocumento(state, "mem_rafael", "doc_3", 9)).toEqual({ ok: false, error: "A Versão 9 não existe.", field: "versao" });
    const v3 = valor(restaurarVersaoDoDocumento(state, "mem_rafael", "doc_3", 1));
    expect(v3.number).toBe(3);
    expect(v3.origin.kind).toBe("restauracao");
    expect(v3.content).toEqual(doc.versions[0]?.content);
    expect(v3.fragments).toHaveLength(1);
    expect(v3.fragments[0]?.id).not.toBe(doc.versions[0]?.fragments[0]?.id);
    expect(doc.currentVersion).toBe(3);
    expect(doc.versions.map((v) => v.number)).toEqual([1, 2, 3]);
    expect(v2.supersededAt).toBeDefined();
    expect(state.activity[0]).toMatchObject({ action: "Versão do Documento restaurada", before: "versão 1", after: "versão 3" });

    // Versão por arquivo: o Arquivo entra no Espaço e a Versão o referencia.
    const v4 = valor(novaVersaoDoDocumento(state, "mem_rafael", "doc_3", { kind: "arquivo", fileName: "casos.pdf", sizeBytes: 100, mediaType: "document" }));
    expect(v4.content.fileId).toBeDefined();
    expect(doc.attachments).toHaveLength(1);
    expect(doc.attachments[0]?.fileId).toBe(v4.content.fileId);
    // INV-CNH-07 — o Tipo acompanha a Versão corrente; `contentType` é readonly, então o registro é substituído (como em mover).
    const docPdf = registro(state.documents, "doc_3");
    expect(docPdf.contentType).toBe("pdf");
    expect(docPdf.currentVersion).toBe(4);

    // Membro sem `editar` na Coleção do Rafael.
    expect(novaVersaoDoDocumento(state, "mem_marcos", "doc_3", { kind: "texto", text: "x" })).toEqual({
      ok: false,
      error: "Editar nesta Coleção exige ser o seu Proprietário ou administrar o Espaço de Trabalho.",
    });
    docPdf.lifecycle = "arquivado";
    expect(novaVersaoDoDocumento(state, "mem_rafael", "doc_3", { kind: "texto", text: "x" })).toEqual({ ok: false, error: "Um Documento arquivado não recebe Versão nova." });
    expect(restaurarVersaoDoDocumento(state, "mem_rafael", "doc_3", 1)).toEqual({ ok: false, error: "Um Documento arquivado não recebe Versão nova." });
  });

  it("o Tipo de conteúdo acompanha a Versão corrente: nova Versão e restauração recalculam (INV-CNH-07)", () => {
    // Nasce por arquivo PDF.
    const criado = valor(adicionarDocumento(state, "mem_rafael", "col_comercial", { title: "Contrato de adesão", kind: "arquivo", fileName: "adesao.pdf", sizeBytes: 100, mediaType: "document" }));
    expect(criado.contentType).toBe("pdf");
    const doc = () => registro(state.documents, criado.id);

    // Versão 2 por texto: o Documento passa a `texto`, e o Registro diz que o Tipo mudou.
    valor(novaVersaoDoDocumento(state, "mem_rafael", criado.id, { kind: "texto", text: "Texto novo" }));
    expect(doc().contentType).toBe("texto");
    expect(doc().currentVersion).toBe(2);
    expect(state.activity[0]).toMatchObject({ action: "Versão do Documento criada", objectId: criado.id, detail: "1 Fragmento(s) · Tipo de conteúdo: PDF → texto" });

    // Versão 3 por áudio: `audio`, processamento pendente e sem Fragmentos — decidido pelo Tipo novo, não pelo antigo.
    const v3 = valor(novaVersaoDoDocumento(state, "mem_rafael", criado.id, { kind: "arquivo", fileName: "reuniao.mp3", sizeBytes: 100, mediaType: "audio" }));
    expect(doc().contentType).toBe("audio");
    expect(v3).toMatchObject({ number: 3, processing: "pendente" });
    expect(v3.fragments).toEqual([]);

    // Restaurar a v1 (PDF) devolve `pdf` e regenera pelo Tipo restaurado: um Fragmento simulado, processado.
    const v4 = valor(restaurarVersaoDoDocumento(state, "mem_rafael", criado.id, 1));
    expect(doc().contentType).toBe("pdf");
    expect(v4).toMatchObject({ number: 4, processing: "processado", origin: { kind: "restauracao" } });
    expect(v4.fragments).toHaveLength(1);
    expect(state.activity[0]).toMatchObject({ action: "Versão do Documento restaurada", before: "versão 1", after: "versão 4", detail: "Tipo de conteúdo: áudio → PDF" });

    // Restaurar a v2 (texto) devolve `texto`; restaurar a v3 (áudio) volta a `audio` e fica pendente de novo.
    valor(restaurarVersaoDoDocumento(state, "mem_rafael", criado.id, 2));
    expect(doc().contentType).toBe("texto");
    const v6 = valor(restaurarVersaoDoDocumento(state, "mem_rafael", criado.id, 3));
    expect(doc().contentType).toBe("audio");
    expect(v6.processing).toBe("pendente");

    // Quando o Tipo não muda, o registro é o mesmo objeto e o Registro não fala em Tipo.
    const antes = doc();
    valor(novaVersaoDoDocumento(state, "mem_rafael", criado.id, { kind: "arquivo", fileName: "outra.mp3", sizeBytes: 100, mediaType: "audio" }));
    expect(doc()).toBe(antes);
    expect(state.activity[0]?.detail).toBe("0 Fragmento(s)");
    expect(doc().versions.map((v) => v.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("editar título, rótulos e resumo não cria Versão (RN-CNH-12)", () => {
    const doc = registro(state.documents, "doc_3");
    const r = editarDocumento(state, "mem_rafael", "doc_3", { title: " Casos de sucesso 2026 ", labels: ["comercial", "prova social"], summary: " Três casos com números. " });
    expect(r.ok).toBe(true);
    expect(doc.title).toBe("Casos de sucesso 2026");
    expect(doc.metadata.labels).toEqual(["comercial", "prova social"]);
    expect(doc.metadata.summary).toBe("Três casos com números.");
    expect(doc.versions).toHaveLength(1);
    expect(doc.currentVersion).toBe(1);
    expect(state.activity[0]).toMatchObject({ action: "Documento editado", before: "Casos de sucesso dos alunos", after: "Casos de sucesso 2026", detail: "título · rótulos · resumo" });
    // Nada mudou: nada registrado.
    const registros = state.activity.length;
    expect(editarDocumento(state, "mem_rafael", "doc_3", { title: "Casos de sucesso 2026" }).ok).toBe(true);
    expect(state.activity).toHaveLength(registros);
    expect(editarDocumento(state, "mem_rafael", "doc_3", { summary: "" }).ok).toBe(true);
    expect(doc.metadata.summary).toBeUndefined();
    expect(editarDocumento(state, "mem_rafael", "doc_3", { title: " " })).toEqual({ ok: false, error: "Dê um título ao Documento.", field: "titulo" });
    // O Criador edita o próprio Documento mesmo sem ser Proprietário da Coleção
    // (`próprios`): doc_4 é do Thiago na Coleção do Rafael — rebaixado a Membro.
    expect(registro(state.documents, "doc_4").createdBy.id).toBe("mem_thiago");
    registro(state.members, "mem_thiago").roleId = "role_mem";
    expect(editarDocumento(state, "mem_thiago", "doc_4", { summary: "Do Criador." }).ok).toBe(true);
    expect(editarDocumento(state, "mem_thiago", "doc_3", { summary: "De outro." })).toEqual({
      ok: false,
      error: "Editar nesta Coleção exige ser o seu Proprietário ou administrar o Espaço de Trabalho.",
    });
  });

  it("mover recusa Documento de Fonte URL e move o de envio manual para a Fonte do destino, preservando identidade e Proveniência", () => {
    expect(moverDocumento(state, "mem_thiago", "doc_11", "col_comercial")).toEqual({
      ok: false,
      error: "Só Documentos de envio manual são movidos; os sincronizados seriam recriados pela Fonte (RN-CNH-08).",
    });

    const antes = registro(state.documents, "doc_9");
    expect(antes.collectionId).toBe("col_clinico");
    const r = moverDocumento(state, "mem_thiago", "doc_9", "col_onboarding");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const movido = r.value;
    expect(r.id).toBe("doc_9");
    expect(movido).toMatchObject({ id: "doc_9", collectionId: "col_onboarding", sourceId: "src_col_onboarding_manual" });
    expect(movido.provenance).toEqual(antes.provenance);
    expect(movido.versions).toBe(antes.versions);
    expect(movido.comments).toBe(antes.comments);
    expect(state.documents.filter((d) => d.id === "doc_9")).toHaveLength(1);
    expect(registro(state.documents, "doc_9")).toBe(movido);
    expect(state.activity[0]).toMatchObject({ action: "Documento movido", objectId: "doc_9", before: "Playbooks do comercial", after: "Onboarding de alunos" });

    expect(moverDocumento(state, "mem_thiago", "doc_9", "col_onboarding")).toEqual({ ok: false, error: "O Documento já está nesta Coleção.", field: "destino" });
    expect(moverDocumento(state, "mem_thiago", "doc_9", "col_inexistente")).toEqual({ ok: false, error: "Coleção de destino não encontrada.", field: "destino" });
    // Sem `excluir` na origem (doc_10 é do Thiago, na Coleção do Thiago).
    expect(moverDocumento(state, "mem_marcos", "doc_10", "col_onboarding")).toEqual({
      ok: false,
      error: "Excluir nesta Coleção exige ser o seu Proprietário ou administrar o Espaço de Trabalho.",
    });
    // Sem `criar` no destino: a privada só abre ao Proprietário dela.
    expect(moverDocumento(state, "mem_rafael", "doc_3", "col_interno")).toEqual({ ok: false, error: PRIVADA, field: "destino" });
    registro(state.collections, "col_onboarding").lifecycle = "arquivado";
    expect(moverDocumento(state, "mem_thiago", "doc_10", "col_onboarding")).toEqual({ ok: false, error: "Restaure a Coleção de destino antes.", field: "destino" });
  });

  it("arquivar, lixeira e restaurar: o Documento volta ao estado anterior à exclusão (B43)", () => {
    const doc = registro(state.documents, "doc_5");
    expect(arquivarDocumento(state, "mem_rafael", "doc_5").ok).toBe(true);
    expect(doc.lifecycle).toBe("arquivado");
    expect(doc.archivedAt).toBeDefined();
    expect(arquivarDocumento(state, "mem_rafael", "doc_5")).toEqual({ ok: false, error: "Só um Documento ativo é arquivado." });
    expect(comentarDocumento(state, "mem_rafael", "doc_5", "Ainda comentável arquivado.").ok).toBe(true);

    expect(enviarDocumentoALixeira(state, "mem_rafael", "doc_5").ok).toBe(true);
    expect(doc).toMatchObject({ lifecycle: "naLixeira", lifecycleBeforeTrash: "arquivado" });
    expect(doc.trashedAt).toBeDefined();
    expect(enviarDocumentoALixeira(state, "mem_rafael", "doc_5")).toEqual({ ok: false, error: "O Documento já está na lixeira." });
    expect(editarDocumento(state, "mem_rafael", "doc_5", { title: "Outro" })).toEqual({ ok: false, error: "Restaure o Documento antes de editar." });

    expect(restaurarDocumento(state, "mem_rafael", "doc_5").ok).toBe(true);
    expect(doc.lifecycle).toBe("arquivado");
    expect(doc.lifecycleBeforeTrash).toBeUndefined();
    expect(doc.trashedAt).toBeUndefined();
    expect(restaurarDocumento(state, "mem_rafael", "doc_5").ok).toBe(true);
    expect(doc.lifecycle).toBe("ativo");
    expect(doc.archivedAt).toBeUndefined();
    expect(restaurarDocumento(state, "mem_rafael", "doc_5")).toEqual({ ok: false, error: "O Documento já está ativo." });
    expect(state.activity[0]).toMatchObject({ action: "Documento restaurado", before: "arquivado", after: "ativo" });

    // Um Membro comum exclui só o que criou (`próprios`).
    expect(enviarDocumentoALixeira(state, "mem_marcos", "doc_5")).toEqual({
      ok: false,
      error: "Excluir nesta Coleção exige ser o seu Proprietário ou administrar o Espaço de Trabalho.",
    });
  });
});

describe("Privacidade, Concessão e Comentário", () => {
  it("a Coleção privada recusa o Administrador em tudo; tornada pública, abre", () => {
    expect(adicionarDocumento(state, "mem_rafael", "col_interno", { kind: "texto", title: "Cláusula", text: "x" })).toEqual({ ok: false, error: PRIVADA });
    expect(editarColecao(state, "mem_rafael", "col_interno", { name: "Jurídico" })).toEqual({ ok: false, error: PRIVADA });
    expect(concederColecao(state, "mem_rafael", "col_interno", { agentId: "agt_sdr", actions: ["ver"] })).toEqual({ ok: false, error: PRIVADA });
    // doc_13 foi criado pelo Rafael, e nem assim: comentar passa pela Coleção.
    expect(registro(state.documents, "doc_13").createdBy.id).toBe("mem_rafael");
    expect(comentarDocumento(state, "mem_rafael", "doc_13", "Revisar")).toEqual({ ok: false, error: PRIVADA });
    expect(editarDocumento(state, "mem_rafael", "doc_13", { summary: "Meu" })).toEqual({ ok: false, error: PRIVADA });

    expect(adicionarDocumento(state, "mem_thiago", "col_interno", { kind: "texto", title: "Cláusula de sigilo", text: "Texto." }).ok).toBe(true);
    expect(editarColecao(state, "mem_thiago", "col_interno", { isPrivate: false }).ok).toBe(true);
    expect(state.activity[0]).toMatchObject({ action: "Coleção tornada pública", objectId: "col_interno" });
    expect(comentarDocumento(state, "mem_rafael", "doc_13", "Revisar").ok).toBe(true);
    expect(concederColecao(state, "mem_rafael", "col_interno", { agentId: "agt_sdr", actions: ["ver"] }).ok).toBe(true);
  });

  it("conceder exige ver, recusa duplicada e Agente na lixeira; revogar remove — e o Conhecimento acessível segue a Concessão", () => {
    expect(concederColecao(state, "mem_julia", "col_onboarding", { agentId: "agt_enriquecedor", actions: ["criar"] })).toEqual({
      ok: false,
      error: "Toda concessão a Agente inclui ver (17.3).",
      field: "acoes",
    });
    expect(concederColecao(state, "mem_julia", "col_onboarding", { agentId: "agt_inexistente", actions: ["ver"] })).toEqual({ ok: false, error: "Agente não encontrado.", field: "agente" });

    const r = concederColecao(state, "mem_julia", "col_onboarding", { agentId: "agt_enriquecedor", actions: ["criar", "ver", "ver"] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const grant = r.value;
    expect(r.id).toBe(grant.id);
    expect(grant).toMatchObject({ collectionId: "col_onboarding", agentId: "agt_enriquecedor", actions: ["ver", "criar"], grantedBy: "mem_julia" });
    expect(state.collectionGrants).toContain(grant);
    expect(conhecimentoAcessivel(state, "agt_enriquecedor").map((c) => c.id)).toContain("col_onboarding");
    expect(state.activity[0]).toMatchObject({
      action: "Acesso concedido a Agente",
      objectType: "collection",
      objectId: "col_onboarding",
      detail: "Enriquecedor de leads · ver, criar",
    });

    expect(concederColecao(state, "mem_julia", "col_onboarding", { agentId: "agt_enriquecedor", actions: ["ver"] })).toEqual({
      ok: false,
      error: "Este Agente já tem acesso a esta Coleção: revogue e conceda de novo para mudar as ações.",
      field: "agente",
    });
    registro(state.agents, "agt_classificador").lifecycle = "naLixeira";
    expect(concederColecao(state, "mem_julia", "col_onboarding", { agentId: "agt_classificador", actions: ["ver"] })).toEqual({
      ok: false,
      error: "Um Agente na lixeira não recebe acesso.",
      field: "agente",
    });
    // Um Agente arquivado ainda recebe: a Concessão espera a reativação.
    registro(state.agents, "agt_redator").lifecycle = "arquivado";
    expect(concederColecao(state, "mem_julia", "col_onboarding", { agentId: "agt_redator", actions: ["ver"] }).ok).toBe(true);
    expect(concederColecao(state, "mem_marcos", "col_onboarding", { agentId: "agt_sdr", actions: ["ver"] })).toEqual({ ok: false, error: SO_PROPRIETARIO_ADMINISTRA });
    expect(concederColecao(state, "mem_beatriz", "col_onboarding", { agentId: "agt_sdr", actions: ["ver"] })).toEqual({ ok: false, error: "O Papel Convidado não age sobre Coleções." });

    expect(revogarColecao(state, "mem_marcos", grant.id)).toEqual({ ok: false, error: SO_PROPRIETARIO_ADMINISTRA });
    expect(revogarColecao(state, "mem_julia", "cgr_inexistente")).toEqual({ ok: false, error: "Concessão não encontrada." });
    const revogada = revogarColecao(state, "mem_julia", grant.id);
    expect(revogada.ok).toBe(true);
    expect(revogada.ok && revogada.id).toBe("col_onboarding");
    expect(state.collectionGrants).not.toContain(grant);
    expect(conhecimentoAcessivel(state, "agt_enriquecedor").map((c) => c.id)).not.toContain("col_onboarding");
    expect(state.activity[0]).toMatchObject({ action: "Acesso de Agente revogado", objectId: "col_onboarding", detail: "Enriquecedor de leads" });
    // O Administrador revoga a Concessão do seed em Coleção alheia não privada.
    expect(revogarColecao(state, "mem_rafael", "cgr_3").ok).toBe(true);
  });

  it("comentar grava o Comment no Documento com o Membro como autor; vazio, Convidado e lixeira são recusados", () => {
    const doc = registro(state.documents, "doc_4");
    const r = comentarDocumento(state, "mem_marcos", "doc_4", "  Atualizar com a turma de setembro.  ");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const comment = r.value;
    expect(r.id).toBe(comment.id);
    expect(comment).toMatchObject({ author: { kind: "member", id: "mem_marcos" }, content: "Atualizar com a turma de setembro.", attachments: [], mentions: [] });
    expect(comment.id.startsWith("cmt_")).toBe(true);
    expect(comment.parentCommentId).toBeUndefined();
    expect(doc.comments).toContain(comment);
    expect(doc.versions).toHaveLength(1);
    expect(state.activity[0]).toMatchObject({ action: "Comentário no Documento", objectType: "document", objectId: "doc_4", detail: "Atualizar com a turma de setembro." });

    expect(comentarDocumento(state, "mem_marcos", "doc_4", "   ")).toEqual({ ok: false, error: "Escreva o comentário.", field: "conteudo" });
    expect(comentarDocumento(state, "mem_beatriz", "doc_4", "Oi")).toEqual({ ok: false, error: "O Papel Convidado não age sobre Coleções." });
    expect(comentarDocumento(state, "mem_marcos", "doc_inexistente", "Oi")).toEqual({ ok: false, error: "Documento não encontrado." });
    doc.lifecycle = "naLixeira";
    expect(comentarDocumento(state, "mem_marcos", "doc_4", "Oi")).toEqual({ ok: false, error: "Um Documento na lixeira não recebe Comentários." });
    // A Coleção na lixeira arrasta o Documento (B36).
    doc.lifecycle = "ativo";
    registro(state.collections, "col_comercial").lifecycle = "naLixeira";
    expect(comentarDocumento(state, "mem_marcos", "doc_4", "Oi")).toEqual({ ok: false, error: "Um Documento na lixeira não recebe Comentários." });
  });
});

/**
 * `app.inject()` sobre as três rotas públicas do Formulário
 * (`./formularios-publicos.ts`, Plan 02-16) — os casos (a)-(k) do plano,
 * V02-02A (segredo/DTO/limite de taxa/superfície) e V02-02B (atomicidade).
 *
 * Parte "Superfície e segredo" ((a)-(f)): roda SEMPRE, sem `DATABASE_URL`
 * (D-DEC-09) — `formulariosPublicos.lerEstado` é o mesmo tipo de injeção de
 * dependência que `../app.ts` já usa para `verificarToken`/`resolverMembro`
 * em `operacoes.test.ts`: um `DataState` construído em memória via
 * `buildSeed()` + `createFieldDefinition`/`createForm` (o mesmo par que
 * `packages/dominio/src/operations/envio-de-formulario.test.ts` usa),
 * nenhuma rota destas chega perto de `pool()`.
 *
 * Parte "Atomicidade" ((g)-(k)): pula sem `DATABASE_URL`/`SUPABASE_STORAGE_BUCKET`
 * (e as credenciais que o client admin de Storage reaproveita) — o mesmo
 * gate de `../servicos/storage-uploads.test.ts`. Sobe um ticket de upload de
 * verdade pela própria rota (`POST .../uploads`), envia bytes reais pelo
 * `uploadUrl` assinado (via `objetosDaSessao` para descobrir o `objectKey` —
 * a rota nunca devolve isso na resposta HTTP, T-02-14) e só então submete.
 * Isolamento: `WS`/`RUN` levam timestamp + random por execução, e
 * `limparWorkspace()` roda em `beforeAll` E `afterAll` (nunca só um dos
 * dois) — o mesmo modelo de `../persistencia/outbox.test.ts` e
 * `../servicos/storage-uploads.test.ts`.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DataState, Form } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import { createFieldDefinition } from "@n1/dominio/operations/configuration";
import { createForm, updateForm } from "@n1/dominio/operations/scale";
import { buildApp } from "../app";
import { clienteAdmin } from "../autenticacao/verificar-token";
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { hidratar, semear } from "../persistencia/repositorio";
import { objetosDaSessao } from "../persistencia/sessoes-de-upload";
import { criarLimiteDeTaxa, type LimiteDeTaxa } from "../servicos/limite-de-taxa";

const LISTA = "lst_prospeccao"; // ativa no seed, alcançada por mem_thiago (mesma Lista de frm_demo)
const DONO = "mem_thiago";
/** Já existe no seed, definido em `spc_com` (ancestral de `lst_prospeccao`), `required: true` — o mesmo fixture de `envio-de-formulario.test.ts`. */
const CENTRO_DE_CUSTO_ID = "fd_centro";
/** Fora do formato de `PARAMS_SEGREDO` só por não existir — 24 caracteres válidos, nunca colide com um `secret()` real (hex de 24). */
const SEGREDO_INEXISTENTE = "0".repeat(24);
/** Só para os casos que nunca chegam a resolver um Formulário (falham no schema do corpo antes disso). */
const SEGREDO_DE_FORMATO_VALIDO = "0123456789abcdef01234567";

function montarCampoDeAnexo(state: DataState, sufixo: string): string {
  const anexo = createFieldDefinition(state, DONO, {
    name: `Anexo (teste 02-16 ${sufixo})`,
    type: "file",
    required: false,
    definedAtType: "list",
    definedAtId: LISTA,
  });
  if (!anexo.ok) throw new Error(`seed de teste: ${anexo.error}`);
  return anexo.value.id;
}

function montarFormulario(state: DataState, nome: string, anexoId: string): Form {
  const form = createForm(state, DONO, LISTA, {
    name: nome,
    questions: [
      { label: "Assunto", required: true, target: { kind: "title" } },
      { label: "Centro de Custo", required: true, target: { kind: "field", definitionId: CENTRO_DE_CUSTO_ID } },
      { label: "Anexo", required: false, target: { kind: "field", definitionId: anexoId } },
    ],
  });
  if (!form.ok) throw new Error(`seed de teste: ${form.error}`);
  return form.value;
}

function appComEstado(estado: DataState, opcoes: { readonly limitePorIp?: LimiteDeTaxa; readonly limitePorSegredo?: LimiteDeTaxa } = {}) {
  return buildApp({
    logger: false,
    formulariosPublicos: {
      lerEstado: async () => estado,
      limitePorIp: opcoes.limitePorIp ?? criarLimiteDeTaxa({ janelaMs: 60_000, maximo: 1000 }),
      limitePorSegredo: opcoes.limitePorSegredo ?? criarLimiteDeTaxa({ janelaMs: 60_000, maximo: 1000 }),
    },
  });
}

// ---------------------------------------------------------------------------
// Superfície e segredo — roda sempre, sem banco (D-DEC-09).
// ---------------------------------------------------------------------------

const ESTADO_STUB: DataState = buildSeed();
const ANEXO_STUB_ID = montarCampoDeAnexo(ESTADO_STUB, "stub");
const FORM_STUB = montarFormulario(ESTADO_STUB, "Formulário público (teste 02-16 — stub)", ANEXO_STUB_ID);
const FORM_PAUSADO_STUB = montarFormulario(ESTADO_STUB, "Formulário pausado (teste 02-16 — stub)", ANEXO_STUB_ID);
{
  const pausar = updateForm(ESTADO_STUB, DONO, FORM_PAUSADO_STUB.id, { enabled: false });
  if (!pausar.ok) throw new Error(`seed de teste: ${pausar.error}`);
}

describe("rotasDeFormulariosPublicos — superfície e segredo (sem banco)", () => {
  it("(a) segredo inexistente e Formulário pausado respondem exatamente a mesma 404", async () => {
    const app = appComEstado(ESTADO_STUB);
    const inexistente = await app.inject({ method: "GET", url: `/v1/public/forms/${SEGREDO_INEXISTENTE}` });
    const pausado = await app.inject({ method: "GET", url: `/v1/public/forms/${FORM_PAUSADO_STUB.secret}` });

    expect(inexistente.statusCode).toBe(404);
    expect(pausado.statusCode).toBe(404);
    expect(inexistente.body).toBe(pausado.body);
  });

  it("(b) segredo válido devolve um DTO sem ownerMemberId, listId, ids de Campo internos (fld_) nem contagem de envios", async () => {
    const app = appComEstado(ESTADO_STUB);
    const resposta = await app.inject({ method: "GET", url: `/v1/public/forms/${FORM_STUB.secret}` });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.body).not.toContain("ownerMemberId");
    expect(resposta.body).not.toContain("listId");
    expect(resposta.body).not.toContain("fld_");
    expect(resposta.body).not.toContain("submissions");

    const corpo = resposta.json();
    expect(corpo.formId).toBe(FORM_STUB.id);
    expect(corpo.title).toBe(FORM_STUB.name);
    expect(Array.isArray(corpo.questions)).toBe(true);
    expect(corpo.questions).toHaveLength(FORM_STUB.questions.length);
    expect(corpo.questions[0]).toMatchObject({ kind: "text", required: true });
  });

  it("(c) POST /submissions com chave extra 'ownerId' no corpo responde 400 (CORPO_SUBMISSAO é .strict())", async () => {
    const app = appComEstado(ESTADO_STUB);
    const resposta = await app.inject({
      method: "POST",
      url: `/v1/public/forms/${SEGREDO_DE_FORMATO_VALIDO}/submissions`,
      payload: { submissionId: randomUUID(), answers: {}, ownerId: "mem_julia" },
    });
    expect(resposta.statusCode).toBe(400);
  });

  it("(d) POST /submissions sem submissionId responde 400", async () => {
    const app = appComEstado(ESTADO_STUB);
    const resposta = await app.inject({
      method: "POST",
      url: `/v1/public/forms/${SEGREDO_DE_FORMATO_VALIDO}/submissions`,
      payload: { answers: {} },
    });
    expect(resposta.statusCode).toBe(400);
  });

  it("(e) limite de taxa por IP: a requisição além do máximo responde 429 com Retry-After", async () => {
    const limite = criarLimiteDeTaxa({ janelaMs: 60_000, maximo: 3 });
    const app = appComEstado(ESTADO_STUB, { limitePorIp: limite });

    for (let i = 0; i < 3; i += 1) {
      const resposta = await app.inject({ method: "GET", url: `/v1/public/forms/${FORM_STUB.secret}` });
      expect(resposta.statusCode).toBe(200);
    }
    const excedeu = await app.inject({ method: "GET", url: `/v1/public/forms/${FORM_STUB.secret}` });
    expect(excedeu.statusCode).toBe(429);
    expect(excedeu.headers["retry-after"]).toBeDefined();
  });

  it("(f) nenhuma das três rotas exige Authorization — nunca 401", async () => {
    const app = appComEstado(ESTADO_STUB);

    const get = await app.inject({ method: "GET", url: `/v1/public/forms/${FORM_STUB.secret}` });
    expect(get.statusCode).not.toBe(401);
    expect(get.statusCode).toBe(200);

    const uploads = await app.inject({
      method: "POST",
      url: `/v1/public/forms/${SEGREDO_INEXISTENTE}/uploads`,
      payload: { displayName: "nota.pdf", mediaType: "application/pdf" },
    });
    expect(uploads.statusCode).not.toBe(401);
    expect(uploads.statusCode).toBe(404);

    const submissions = await app.inject({
      method: "POST",
      url: `/v1/public/forms/${SEGREDO_INEXISTENTE}/submissions`,
      payload: { submissionId: randomUUID(), answers: {} },
    });
    expect(submissions.statusCode).not.toBe(401);
    expect(submissions.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Atomicidade — pula sem DATABASE_URL/SUPABASE_STORAGE_BUCKET.
// ---------------------------------------------------------------------------

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const temBucket = Boolean(
  process.env.SUPABASE_STORAGE_BUCKET && process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY,
);
const d = temBanco && temBucket ? describe : describe.skip;

const RUN = `formularios_publicos_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const WS = `ws_${RUN}`;

function armazenamentoDeTeste() {
  return clienteAdmin().storage.from(process.env.SUPABASE_STORAGE_BUCKET as string);
}

async function limparWorkspace(): Promise<void> {
  const cliente = await pool().connect();
  try {
    await cliente.query("delete from plataforma.integration_outbox where workspace_id = $1", [WS]);
    await cliente.query(
      "delete from plataforma.upload_objects where session_id in (select id from plataforma.upload_sessions where workspace_id = $1)",
      [WS],
    );
    await cliente.query("delete from plataforma.upload_sessions where workspace_id = $1", [WS]);
    await cliente.query("delete from plataforma.registros where workspace_id = $1", [WS]);
    await cliente.query("delete from plataforma.workspaces where workspace_id = $1", [WS]);
  } finally {
    cliente.release();
  }
}

d("rotasDeFormulariosPublicos — atomicidade contra o banco e o bucket de teste", () => {
  let FORM: Form;
  let ANEXO_ID: string;
  const chavesCriadas: string[] = [];

  beforeAll(async () => {
    await limparWorkspace(); // defensivo — uma execução anterior pode ter abortado antes do próprio afterAll.
    const state = buildSeed();
    ANEXO_ID = montarCampoDeAnexo(state, "db");
    FORM = montarFormulario(state, "Formulário público (teste 02-16 — db)", ANEXO_ID);
    const cliente = await pool().connect();
    try {
      await semear(cliente, WS, state);
    } finally {
      cliente.release();
    }
  });

  afterAll(async () => {
    if (chavesCriadas.length > 0) await armazenamentoDeTeste().remove(chavesCriadas);
    await limparWorkspace(); // a limpeza que de fato importa — sem ela, WS/outbox/upload_* vazam para sempre.
    await encerrar();
  });

  function appDb() {
    return buildApp({
      logger: false,
      workspaceId: WS,
      formulariosPublicos: {
        limitePorIp: criarLimiteDeTaxa({ janelaMs: 60_000, maximo: 1000 }),
        limitePorSegredo: criarLimiteDeTaxa({ janelaMs: 60_000, maximo: 1000 }),
      },
    });
  }

  function perguntas(): { readonly titulo: Form["questions"][number]; readonly centro: Form["questions"][number]; readonly anexo: Form["questions"][number] } {
    const titulo = FORM.questions[0]!;
    const centro = FORM.questions.find((q) => q.target.kind === "field" && q.target.definitionId === CENTRO_DE_CUSTO_ID)!;
    const anexo = FORM.questions.find((q) => q.target.kind === "field" && q.target.definitionId === ANEXO_ID)!;
    return { titulo, centro, anexo };
  }

  async function abrirTicketReal(
    app: ReturnType<typeof appDb>,
    displayName: string,
  ): Promise<{ readonly submissionId: string; readonly objectId: string; readonly uploadUrl: string; readonly token: string }> {
    const resposta = await app.inject({
      method: "POST",
      url: `/v1/public/forms/${FORM.secret}/uploads`,
      payload: { displayName, mediaType: "application/pdf" },
    });
    expect(resposta.statusCode, resposta.body).toBe(201);
    return resposta.json();
  }

  async function objectKeyDoTicket(submissionId: string, objectId: string): Promise<string> {
    const objetos = await objetosDaSessao(submissionId);
    const objeto = objetos.find((o) => o.id === objectId);
    if (!objeto) throw new Error("objeto do ticket não encontrado — bug no setup do teste");
    return objeto.objectKey;
  }

  /** Upload real pelo `uploadUrl` assinado — o mesmo `uploadToSignedUrl` de `../servicos/storage-uploads.test.ts`. */
  async function enviarConteudo(objectKey: string, token: string, conteudo: Buffer, contentType: string): Promise<void> {
    const resultado = await armazenamentoDeTeste().uploadToSignedUrl(objectKey, token, conteudo, { contentType });
    if (resultado.error) throw resultado.error;
    chavesCriadas.push(objectKey);
  }

  async function contarTarefas(): Promise<number> {
    const cliente = await pool().connect();
    try {
      return (await hidratar(cliente, WS)).state.tasks.length;
    } finally {
      cliente.release();
    }
  }

  async function contarOutboxTotal(): Promise<number> {
    const cliente = await pool().connect();
    try {
      const r = await cliente.query<{ n: string }>(
        "select count(*)::text as n from plataforma.integration_outbox where workspace_id = $1",
        [WS],
      );
      return Number(r.rows[0]!.n);
    } finally {
      cliente.release();
    }
  }

  it("(g) submissão válida: 201 com readableId; 1 Tarefa, Campos preenchidos, WorkspaceFile ligado, 1 Atividade Ator sistema, exatamente 1 linha de outbox", async () => {
    const app = appDb();
    const { titulo, centro, anexo } = perguntas();
    const ticket = await abrirTicketReal(app, "nota-fiscal-g.pdf");
    const objectKey = await objectKeyDoTicket(ticket.submissionId, ticket.objectId);
    await enviarConteudo(objectKey, ticket.token, Buffer.from("%PDF-1.4\n%02-16-caso-g\n"), "application/pdf");

    const resposta = await app.inject({
      method: "POST",
      url: `/v1/public/forms/${FORM.secret}/submissions`,
      payload: {
        submissionId: ticket.submissionId,
        answers: { [titulo.id]: "Pedido de teste 02-16 (caso g)", [centro.id]: "Comercial" },
        attachments: [{ questionId: anexo.id, objectId: ticket.objectId }],
      },
    });
    expect(resposta.statusCode, resposta.body).toBe(201);
    const corpo = resposta.json();
    expect(typeof corpo.readableId).toBe("string");
    expect(corpo.readableId.length).toBeGreaterThan(0);
    // D-05 — só o identificador legível: nenhum sinal de Status, aprovador ou taskId.
    expect(corpo.taskId).toBeUndefined();
    expect(corpo.status).toBeUndefined();

    const cliente = await pool().connect();
    try {
      const { state } = await hidratar(cliente, WS);
      const tarefa = state.tasks.find((t) => t.title === "Pedido de teste 02-16 (caso g)");
      expect(tarefa).toBeDefined();
      expect(tarefa?.fieldValues.find((v) => v.definitionId === CENTRO_DE_CUSTO_ID)?.value).toBe("Comercial");
      const arquivo = state.files.find((f) => f.objectKey === objectKey);
      expect(arquivo).toBeDefined();
      expect(arquivo?.createdBy.kind).toBe("system");
      expect(arquivo?.state).toBe("enviado");
      const atividades = state.activity.filter((a) => a.objectId === tarefa?.id);
      expect(atividades).toHaveLength(1);
      expect(atividades[0]?.actor.kind).toBe("system");

      const outbox = await cliente.query<{ n: string }>(
        "select count(*)::text as n from plataforma.integration_outbox where workspace_id = $1 and aggregate_id = $2",
        [WS, tarefa!.id],
      );
      expect(Number(outbox.rows[0]!.n)).toBe(1);
    } finally {
      cliente.release();
    }
  });

  it("(h) resposta inválida (Centro de Custo sem resposta) responde 400; zero Tarefas novas, outbox sem nova linha, sessão não consumida", async () => {
    const app = appDb();
    const { titulo, anexo } = perguntas();
    const ticket = await abrirTicketReal(app, "comprovante-h.pdf");
    const objectKey = await objectKeyDoTicket(ticket.submissionId, ticket.objectId);
    await enviarConteudo(objectKey, ticket.token, Buffer.from("%PDF-1.4\n%02-16-caso-h\n"), "application/pdf");

    const tarefasAntes = await contarTarefas();
    const outboxAntes = await contarOutboxTotal();

    const resposta = await app.inject({
      method: "POST",
      url: `/v1/public/forms/${FORM.secret}/submissions`,
      payload: {
        submissionId: ticket.submissionId,
        answers: { [titulo.id]: "Pedido sem centro de custo (caso h)" }, // Centro de Custo obrigatório, ausente.
        attachments: [{ questionId: anexo.id, objectId: ticket.objectId }],
      },
    });
    expect(resposta.statusCode).toBe(400);
    const corpo = resposta.json();
    expect(corpo.ok).toBe(false);
    expect(typeof corpo.field).toBe("string");

    expect(await contarTarefas()).toBe(tarefasAntes);
    expect(await contarOutboxTotal()).toBe(outboxAntes);

    const cliente = await pool().connect();
    try {
      const sessao = await cliente.query<{ consumed_at: Date | null }>(
        "select consumed_at from plataforma.upload_sessions where id = $1",
        [ticket.submissionId],
      );
      expect(sessao.rows[0]?.consumed_at ?? null).toBeNull();
    } finally {
      cliente.release();
    }
  });

  it("(i) reenviar a MESMA submissionId depois de um sucesso é recusado; nenhuma segunda Tarefa", async () => {
    const app = appDb();
    const { titulo, centro, anexo } = perguntas();
    const ticket = await abrirTicketReal(app, "nota-i.pdf");
    const objectKey = await objectKeyDoTicket(ticket.submissionId, ticket.objectId);
    await enviarConteudo(objectKey, ticket.token, Buffer.from("%PDF-1.4\n%02-16-caso-i\n"), "application/pdf");

    const payload = {
      submissionId: ticket.submissionId,
      answers: { [titulo.id]: "Pedido reenviado (caso i)", [centro.id]: "Comercial" },
      attachments: [{ questionId: anexo.id, objectId: ticket.objectId }],
    };

    const primeira = await app.inject({ method: "POST", url: `/v1/public/forms/${FORM.secret}/submissions`, payload });
    expect(primeira.statusCode, primeira.body).toBe(201);
    const tarefasDepoisDaPrimeira = await contarTarefas();

    const segunda = await app.inject({ method: "POST", url: `/v1/public/forms/${FORM.secret}/submissions`, payload });
    expect(segunda.statusCode).toBe(409);
    expect(segunda.json().ok).toBe(false);

    expect(await contarTarefas()).toBe(tarefasDepoisDaPrimeira);
  });

  it("(j) sem o worker de outbox rodando, a resposta de sucesso continua 201 (D-19)", async () => {
    // O worker (`../persistencia/outbox-worker.ts`) nunca é iniciado nesta suíte — a rota não faz
    // `fetch`/HTTP para `automation/` (ver o cabeçalho de `./formularios-publicos.ts`), só grava. Se a
    // confirmação dependesse da entrega, esta chamada travaria ou falharia; ela só confirma a persistência.
    const app = appDb();
    const { titulo, centro, anexo } = perguntas();
    const ticket = await abrirTicketReal(app, "nota-j.pdf");
    const objectKey = await objectKeyDoTicket(ticket.submissionId, ticket.objectId);
    await enviarConteudo(objectKey, ticket.token, Buffer.from("%PDF-1.4\n%02-16-caso-j\n"), "application/pdf");

    const resposta = await app.inject({
      method: "POST",
      url: `/v1/public/forms/${FORM.secret}/submissions`,
      payload: {
        submissionId: ticket.submissionId,
        answers: { [titulo.id]: "Pedido sem worker de outbox (caso j)", [centro.id]: "Comercial" },
        attachments: [{ questionId: anexo.id, objectId: ticket.objectId }],
      },
    });
    expect(resposta.statusCode, resposta.body).toBe(201);
  });

  it("(k) anexo cujo objectId pertence a OUTRA sessão responde 400; nenhuma Tarefa criada", async () => {
    const app = appDb();
    const { titulo, centro, anexo } = perguntas();
    const minha = await abrirTicketReal(app, "meu-arquivo-k.pdf");
    const alheio = await abrirTicketReal(app, "arquivo-de-outra-sessao-k.pdf");
    // Nem precisa enviar bytes: `objetosDaSessao(minha.submissionId)` já não encontra o objeto de `alheio`.

    const tarefasAntes = await contarTarefas();

    const resposta = await app.inject({
      method: "POST",
      url: `/v1/public/forms/${FORM.secret}/submissions`,
      payload: {
        submissionId: minha.submissionId,
        answers: { [titulo.id]: "Tentativa com anexo alheio (caso k)", [centro.id]: "Comercial" },
        attachments: [{ questionId: anexo.id, objectId: alheio.objectId }],
      },
    });
    expect(resposta.statusCode).toBe(400);
    expect(await contarTarefas()).toBe(tarefasAntes);
  });
});

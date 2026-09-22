/**
 * `app.inject()` sobre as sete rotas `/v1/integrations/payment-requests/*`
 * (Plan 02-13) — os casos (a)-(m) do plano, provando V02-05A (auth, escopo,
 * schema, replay, conflito) e V02-05C (sanitização).
 *
 * Parte sem banco ((a)-(c), (e), (g)): roda sempre — schema/headers são
 * validados ANTES de qualquer `hidratar()`/`pool()`, o mesmo motivo pelo
 * qual `operacoes.test.ts` separa os dois blocos (D-DEC-09).
 *
 * Parte com banco ((d), (f), (h)-(m)): pula sem `DATABASE_URL`, como todo
 * teste de integração desta pasta. Modelo de isolamento seguido literalmente
 * de `../persistencia/integracao.test.ts`: prefixo `RUN` por execução,
 * `WORKSPACE` derivado dele, `limparTudo()` em `beforeAll` E `afterAll` —
 * nunca só um dos dois.
 *
 * Identidade de serviço nos testes: `resolverCredencial` é injetado (como em
 * `../plugins/autenticacao-servico.test.ts`) e resolve para
 * `mem_maryane` — um Membro comum do seed, NUNCA para um Membro com
 * `roleId: SOL.papeis.agentePipeline`. Isso é deliberado, não um atalho:
 * `SOL.papeis.agentePipeline` tem `base: "convidado"`
 * (`solicitacao-de-pagamento-evolver.ts::baseParaPapel`), e
 * `taskWriteRefusal` (`packages/dominio/src/derive.ts`) recusa QUALQUER
 * escrita de um Convidado em qualquer Tarefa, sem exceção — confirmado
 * empiricamente durante este plano (`changeTaskStatus` devolve "Um
 * Convidado não altera Tarefa..." mesmo para o próprio Papel "Agente do
 * pipeline"). As rotas em si fazem tudo certo (`actingMemberId` é sempre
 * `request.servico.memberId`, nunca o corpo); o gap é de permissão no
 * domínio, fora de `packages/dominio` no `files_modified` deste plano — ver
 * "Known Limitations" no SUMMARY do Plan 02-13 e `deferred-items.md`. Este
 * teste prova a mecânica HTTP (auth, escopo, idempotência, forma,
 * sanitização) com um Membro que PODE escrever — exatamente o que V02-05A
 * pede — sem fingir que o gap de domínio não existe.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SOL, usuarioDoSeed } from "@n1/dominio";
import { addTaskComment, createTask, setTaskFieldValue } from "@n1/dominio/operations/tasks";
import { CP } from "@n1/dominio/operations";
import { buildSeed } from "@n1/dominio/seed";
import { evoluirConfiguracaoDeSolicitacoes } from "@n1/dominio/solicitacao-de-pagamento-evolver";
import { buildApp } from "../app";
import { EsquemasV1 } from "../contratos/v1";
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { hidratar, semear } from "../persistencia/repositorio";
import type { ResolverCredencial } from "../plugins/autenticacao-servico";

const MARYANE_USER = usuarioDoSeed("mem_maryane");
const semente = buildSeed();
const MEMBRO_SERVICO = semente.members.find((m) => m.userId === MARYANE_USER);
if (!MEMBRO_SERVICO) throw new Error("seed sem mem_maryane — fixture do teste ficou desatualizada");

const evolucao = evoluirConfiguracaoDeSolicitacoes(semente, MEMBRO_SERVICO.id);
if (!evolucao.ok) throw new Error(`evoluirConfiguracaoDeSolicitacoes falhou no setup do teste: ${evolucao.error}`);

const LISTA_ID = "lst_solicitacoes_de_pagamento";

function criarTarefaDeTeste(titulo: string, centroDeCusto = "TRIA") {
  const criado = createTask(semente, MEMBRO_SERVICO!.id, { listId: LISTA_ID, title: titulo });
  if (!criado.ok) throw new Error(`createTask falhou no setup do teste: ${criado.error}`);
  const custo = setTaskFieldValue(semente, MEMBRO_SERVICO!.id, criado.value.id, "fld_sp_a_centro_de_custo", centroDeCusto);
  if (!custo.ok) throw new Error(`setTaskFieldValue(costCenter) falhou no setup do teste: ${custo.error}`);
  return criado.value;
}

// Tarefa principal — usada por (d), (f) parcialmente, (j), (k).
const TAREFA_PRINCIPAL = criarTarefaDeTeste("Solicitação de teste — principal");
// Tarefa dedicada à idempotência de comentário — (h)/(i), nunca tocada por outro caso.
const TAREFA_COMENTARIOS = criarTarefaDeTeste("Solicitação de teste — comentários");
// Tarefa dedicada às escritas de (d). Precisa nascer AQUI, em escopo de módulo:
// `beforeAll` chama `semear()` uma vez, e só o que já está na semente naquele
// instante chega ao banco. Criada dentro do `it()`, ela existiria apenas em
// memória e a rota — que lê o Postgres — responderia 404.
const TAREFA_ESCRITAS = criarTarefaDeTeste("Solicitação de teste — caso (d) escritas");
// Tarefa dedicada ao erro interno — (l): seu Status é corrompido via SQL direto, nunca lida por outro caso.
const TAREFA_ERRO_INTERNO = criarTarefaDeTeste("Solicitação de teste — erro interno");
const VALOR_HOSTIL_CENTAVOS = "987654"; // 9876.54 em reais — string de busca no corpo do erro (caso l).
{
  const valor = setTaskFieldValue(semente, MEMBRO_SERVICO.id, TAREFA_ERRO_INTERNO.id, "fld_sp_t_valor", "9876.54");
  const cnpj = setTaskFieldValue(semente, MEMBRO_SERVICO.id, TAREFA_ERRO_INTERNO.id, "fld_sp_g_cnpj", "00.000.000/0001-91");
  const fornecedor = setTaskFieldValue(semente, MEMBRO_SERVICO.id, TAREFA_ERRO_INTERNO.id, "fld_sp_f_fornecedor", "CNPJ");
  if (!valor.ok || !cnpj.ok || !fornecedor.ok) {
    throw new Error("setup da Tarefa hostil (caso l) falhou");
  }
}

// Comentário raiz + resposta, para `getCommentReplies` — criados no domínio (não pela rota, fora de teste).
const COMENTARIO_RAIZ = (() => {
  const raiz = addTaskComment(semente, MEMBRO_SERVICO.id, TAREFA_PRINCIPAL.id, { content: "Fulano, para aprovação." });
  if (!raiz.ok) throw new Error(`addTaskComment (raiz) falhou no setup: ${raiz.error}`);
  const resposta = addTaskComment(semente, MEMBRO_SERVICO.id, TAREFA_PRINCIPAL.id, {
    content: "Aprovado.",
    parentCommentId: raiz.value.id,
  });
  if (!resposta.ok) throw new Error(`addTaskComment (resposta) falhou no setup: ${resposta.error}`);
  return raiz.value;
})();

// Uma Tarefa de outra Lista (Contas a pagar) — caso (f).
const TAREFA_DE_OUTRA_LISTA = semente.tasks.find((t) => t.listId === CP.listId);
if (!TAREFA_DE_OUTRA_LISTA) throw new Error("seed sem Tarefa de Contas a pagar — fixture do teste ficou desatualizada");

// ── Credenciais de serviço injetadas — sem rede, sem banco (D-DEC-09) ──────

const RUN = `teste_integracao_solicitacoes_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const WORKSPACE = `ws_${RUN}`;

interface CredencialDeTeste {
  readonly id: string;
  readonly segredo: string;
  readonly scopes: readonly string[];
}

const CREDENCIAL_ESCRITA: CredencialDeTeste = {
  id: RUN,
  segredo: "segredo-de-escrita",
  scopes: ["payment-requests:read", "payment-requests:write"],
};

const CREDENCIAL_SO_LEITURA: CredencialDeTeste = {
  id: `${RUN}_leitura`,
  segredo: "segredo-de-leitura",
  scopes: ["payment-requests:read"],
};

function tokenDe(credencial: CredencialDeTeste): string {
  return `${credencial.id}.${credencial.segredo}`;
}

function resolverCredencialDeTeste(credenciais: readonly CredencialDeTeste[]): ResolverCredencial {
  return async (token) => {
    const corte = token.indexOf(".");
    if (corte <= 0) return undefined;
    const id = token.slice(0, corte);
    const segredo = token.slice(corte + 1);
    const achada = credenciais.find((c) => c.id === id);
    if (!achada || achada.segredo !== segredo) return undefined;
    return { id: achada.id, workspaceId: WORKSPACE, memberId: MEMBRO_SERVICO!.id, scopes: achada.scopes, state: "ativa" };
  };
}

function appDeTeste() {
  return buildApp({
    logger: false,
    workspaceId: WORKSPACE,
    verificarToken: async (token) => (token === "token-humano-valido" ? { sub: MARYANE_USER } : null),
    resolverMembro: async (_workspaceId, userId) => (userId === MARYANE_USER ? MEMBRO_SERVICO : undefined),
    resolverCredencial: resolverCredencialDeTeste([CREDENCIAL_ESCRITA, CREDENCIAL_SO_LEITURA]),
  });
}

const FIXTURES_DIR = fileURLToPath(new URL("../../../../contratos/payment-requests-v1/", import.meta.url));

function lerFixture(metodo: string, categoria: string): { readonly resposta: { readonly corpo: unknown } } {
  const caminho = `${FIXTURES_DIR}${metodo}.${categoria}.json`;
  return JSON.parse(readFileSync(caminho, "utf8"));
}

// ═══════════════════════════════════════════════════════════════════════════
// Sem banco — auth, escopo, schema (D-DEC-09: roda sempre, antes de hidratar())
// ═══════════════════════════════════════════════════════════════════════════

describe("rotasDeIntegracaoDeSolicitacoes — sem banco", () => {
  it("(a) sem Authorization responde 401 no envelope do contrato", async () => {
    const resposta = await appDeTeste().inject({ method: "GET", url: "/v1/integrations/payment-requests/tarefa-x" });
    expect(resposta.statusCode).toBe(401);
    expect(resposta.json().error.code).toBe("CREDENCIAL_AUSENTE");
  });

  it("(b) credencial só com payment-requests:read em PUT /:taskId/status responde 403 ESCOPO_INSUFICIENTE", async () => {
    const resposta = await appDeTeste().inject({
      method: "PUT",
      url: "/v1/integrations/payment-requests/tarefa-x/status",
      headers: {
        authorization: `Bearer ${tokenDe(CREDENCIAL_SO_LEITURA)}`,
        "idempotency-key": "status:tarefa-x:aprovado",
      },
      payload: { status: "aprovado" },
    });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json()).toEqual({
      error: {
        code: "ESCOPO_INSUFICIENTE",
        message: "Credencial sem escopo para esta operação.",
        requestId: resposta.json().error.requestId,
        retryable: false,
      },
    });
  });

  it("(c) JWT humano válido em rota de integração responde 401 — o hook de serviço não aceita JWT", async () => {
    const resposta = await appDeTeste().inject({
      method: "GET",
      url: "/v1/integrations/payment-requests/tarefa-x",
      headers: { authorization: "Bearer token-humano-valido" },
    });
    expect(resposta.statusCode).toBe(401);
    expect(resposta.json().error.code).toBe("CREDENCIAL_INVALIDA");
  });

  it("(e) body que viola o schema responde 400 sanitizado, sem 'Expected' nem 'invalid_type' no corpo", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/v1/integrations/payment-requests/tarefa-x/comments",
      headers: {
        authorization: `Bearer ${tokenDe(CREDENCIAL_ESCRITA)}`,
        "idempotency-key": "comment:tarefa-x:routing-0001",
      },
      payload: { text: 123 },
    });
    expect(resposta.statusCode).toBe(400);
    const corpo = resposta.json();
    expect(corpo.error.code).toBe("SCHEMA_INVALIDO");
    const bruto = JSON.stringify(corpo);
    expect(bruto).not.toContain("Expected");
    expect(bruto).not.toContain("invalid_type");
  });

  it("(g) escrita sem Idempotency-Key responde 400", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/v1/integrations/payment-requests/tarefa-x/comments",
      headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_ESCRITA)}` },
      payload: { text: "ok" },
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().error.code).toBe("SCHEMA_INVALIDO");
  });

  it("(g bis) PUT /:taskId/tags/:tagId sem Idempotency-Key responde 400", async () => {
    const resposta = await appDeTeste().inject({
      method: "PUT",
      url: "/v1/integrations/payment-requests/tarefa-x/tags/tag-x",
      headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_ESCRITA)}` },
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().error.code).toBe("SCHEMA_INVALIDO");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Com banco — contrato, idempotência, sanitização (pula sem DATABASE_URL)
// ═══════════════════════════════════════════════════════════════════════════

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;

async function limparTudo(): Promise<void> {
  const cliente = await pool().connect();
  try {
    await cliente.query("delete from plataforma.registros where workspace_id = $1", [WORKSPACE]);
    await cliente.query("delete from plataforma.workspaces where workspace_id = $1", [WORKSPACE]);
    await cliente.query("delete from plataforma.integration_outbox where workspace_id = $1", [WORKSPACE]);
    await cliente.query("delete from plataforma.http_idempotency where service_id = $1", [CREDENCIAL_ESCRITA.id]);
  } finally {
    cliente.release();
  }
}

d("rotasDeIntegracaoDeSolicitacoes — com banco real", () => {
  beforeAll(async () => {
    await limparTudo();
    const cliente = await pool().connect();
    try {
      await semear(cliente, WORKSPACE, semente);
    } finally {
      cliente.release();
    }
  });

  afterAll(async () => {
    await limparTudo();
    await encerrar();
  });

  // ── (d) forma da resposta de sucesso casa com EsquemasV1 — para os 7 métodos ──

  describe("(d) resposta de sucesso casa com o schema de EsquemasV1", () => {
    it("getTask", async () => {
      // Lê as fixtures por caminho de arquivo (não copia objeto inline) — prova
      // que a MESMA matriz de schema que aceita a fixture canônica também
      // aceita a resposta real desta rota.
      const minimo = lerFixture("getTask", "sucesso-minimo");
      expect(EsquemasV1.getTask.resposta.safeParse(minimo.resposta.corpo).success).toBe(true);

      const resposta = await appDeTeste().inject({
        method: "GET",
        url: `/v1/integrations/payment-requests/${TAREFA_PRINCIPAL.id}`,
        headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_ESCRITA)}` },
      });
      expect(resposta.statusCode).toBe(200);
      const parse = EsquemasV1.getTask.resposta.safeParse(resposta.json());
      expect(parse.success, parse.success ? "" : JSON.stringify((parse as { error: { issues: unknown } }).error.issues)).toBe(true);
    });

    it("listPaymentRequestTasks", async () => {
      const resposta = await appDeTeste().inject({
        method: "GET",
        url: "/v1/integrations/payment-requests?limit=50",
        headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_ESCRITA)}` },
      });
      expect(resposta.statusCode).toBe(200);
      expect(EsquemasV1.listPaymentRequestTasks.resposta.safeParse(resposta.json()).success).toBe(true);
    });

    it("getCommentReplies", async () => {
      const resposta = await appDeTeste().inject({
        method: "GET",
        url: `/v1/integrations/payment-requests/comments/${COMENTARIO_RAIZ.id}/replies?limit=50`,
        headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_ESCRITA)}` },
      });
      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json();
      expect(EsquemasV1.getCommentReplies.resposta.safeParse(corpo).success).toBe(true);
      expect(corpo.items.length).toBe(1);
      expect(corpo.items[0].text).toBe("Aprovado.");
    });

    it("createComment / addTaskTag / updateTaskDueDate / updateTaskStatus", async () => {
      const tarefa = TAREFA_ESCRITAS;

      const comentario = await appDeTeste().inject({
        method: "POST",
        url: `/v1/integrations/payment-requests/${tarefa.id}/comments`,
        headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_ESCRITA)}`, "idempotency-key": `comment:${tarefa.id}:d` },
        payload: { text: "ok" },
      });
      expect(comentario.statusCode).toBe(200);
      expect(EsquemasV1.createComment.resposta.safeParse(comentario.json()).success).toBe(true);

      const tag = await appDeTeste().inject({
        method: "PUT",
        url: `/v1/integrations/payment-requests/${tarefa.id}/tags/${SOL.tags.contaTria}`,
        headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_ESCRITA)}`, "idempotency-key": `tag:${tarefa.id}:d` },
      });
      expect(tag.statusCode).toBe(200);
      expect(EsquemasV1.addTaskTag.resposta.safeParse(tag.json()).success).toBe(true);

      const dueDate = await appDeTeste().inject({
        method: "PUT",
        url: `/v1/integrations/payment-requests/${tarefa.id}/due-date`,
        headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_ESCRITA)}`, "idempotency-key": `duedate:${tarefa.id}:d` },
        payload: { dueDate: "2026-10-05" },
      });
      expect(dueDate.statusCode).toBe(200);
      expect(EsquemasV1.updateTaskDueDate.resposta.safeParse(dueDate.json()).success).toBe(true);

      const status = await appDeTeste().inject({
        method: "PUT",
        url: `/v1/integrations/payment-requests/${tarefa.id}/status`,
        headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_ESCRITA)}`, "idempotency-key": `status:${tarefa.id}:d` },
        payload: { status: "em aprovação" },
      });
      expect(status.statusCode).toBe(200);
      expect(EsquemasV1.updateTaskStatus.resposta.safeParse(status.json()).success).toBe(true);
    });
  });

  // ── (f) taskId de Tarefa que não é Solicitação → 404 ──────────────────────

  it("(f) taskId de Tarefa de outra Lista responde 404 ENTIDADE_NAO_ENCONTRADA", async () => {
    const resposta = await appDeTeste().inject({
      method: "GET",
      url: `/v1/integrations/payment-requests/${TAREFA_DE_OUTRA_LISTA!.id}`,
      headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_ESCRITA)}` },
    });
    expect(resposta.statusCode).toBe(404);
    expect(resposta.json().error.code).toBe("ENTIDADE_NAO_ENCONTRADA");
  });

  it("(f bis) taskId inexistente responde 404", async () => {
    const resposta = await appDeTeste().inject({
      method: "GET",
      url: "/v1/integrations/payment-requests/tsk_nao_existe",
      headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_ESCRITA)}` },
    });
    expect(resposta.statusCode).toBe(404);
  });

  // ── (h)/(i) idempotência de createComment ─────────────────────────────────

  it("(h) mesma chave + mesmo corpo duas vezes devolve a mesma resposta e cria um único Comentário", async () => {
    const chave = `comment:${TAREFA_COMENTARIOS.id}:replay-h`;
    const payload = { text: "Comentário replay (h)." };

    const primeira = await appDeTeste().inject({
      method: "POST",
      url: `/v1/integrations/payment-requests/${TAREFA_COMENTARIOS.id}/comments`,
      headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_ESCRITA)}`, "idempotency-key": chave },
      payload,
    });
    expect(primeira.statusCode).toBe(200);

    const segunda = await appDeTeste().inject({
      method: "POST",
      url: `/v1/integrations/payment-requests/${TAREFA_COMENTARIOS.id}/comments`,
      headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_ESCRITA)}`, "idempotency-key": chave },
      payload,
    });
    expect(segunda.statusCode).toBe(primeira.statusCode);
    expect(segunda.json()).toEqual(primeira.json());

    const cliente = await pool().connect();
    try {
      const { state } = await hidratar(cliente, WORKSPACE);
      const tarefa = state.tasks.find((t) => t.id === TAREFA_COMENTARIOS.id)!;
      const doReplay = tarefa.comments.filter((c) => c.content === payload.text);
      expect(doReplay.length).toBe(1);
    } finally {
      cliente.release();
    }
  });

  it("(i) mesma chave + corpo diferente responde 409 IDEMPOTENCY_KEY_REUSED", async () => {
    const chave = `comment:${TAREFA_COMENTARIOS.id}:replay-i`;

    const primeira = await appDeTeste().inject({
      method: "POST",
      url: `/v1/integrations/payment-requests/${TAREFA_COMENTARIOS.id}/comments`,
      headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_ESCRITA)}`, "idempotency-key": chave },
      payload: { text: "Primeiro corpo (i)." },
    });
    expect(primeira.statusCode).toBe(200);

    const segunda = await appDeTeste().inject({
      method: "POST",
      url: `/v1/integrations/payment-requests/${TAREFA_COMENTARIOS.id}/comments`,
      headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_ESCRITA)}`, "idempotency-key": chave },
      payload: { text: "Segundo corpo, diferente (i)." },
    });
    expect(segunda.statusCode).toBe(409);
    expect(segunda.json().error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  // ── (j) PUT /:taskId/status para o Status atual → 200 ─────────────────────

  it("(j) mudar o Status para o valor já vigente é sucesso (200), não erro", async () => {
    const resposta = await appDeTeste().inject({
      method: "PUT",
      url: `/v1/integrations/payment-requests/${TAREFA_PRINCIPAL.id}/status`,
      headers: {
        authorization: `Bearer ${tokenDe(CREDENCIAL_ESCRITA)}`,
        "idempotency-key": `status:${TAREFA_PRINCIPAL.id}:mesmo-valor`,
      },
      payload: { status: "para fazer" },
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().status).toBe("para fazer");
  });

  // ── (k) PUT /:taskId/tags/:tagId duas vezes → 200 nas duas, uma única Tag ─

  it("(k) adicionar a mesma Tag duas vezes (chaves diferentes) responde 200 nas duas e a Tag aparece uma única vez", async () => {
    const primeira = await appDeTeste().inject({
      method: "PUT",
      url: `/v1/integrations/payment-requests/${TAREFA_PRINCIPAL.id}/tags/${SOL.tags.contaTria}`,
      headers: {
        authorization: `Bearer ${tokenDe(CREDENCIAL_ESCRITA)}`,
        "idempotency-key": `tag:${TAREFA_PRINCIPAL.id}:k-1`,
      },
    });
    expect(primeira.statusCode).toBe(200);

    const segunda = await appDeTeste().inject({
      method: "PUT",
      url: `/v1/integrations/payment-requests/${TAREFA_PRINCIPAL.id}/tags/${SOL.tags.contaTria}`,
      headers: {
        authorization: `Bearer ${tokenDe(CREDENCIAL_ESCRITA)}`,
        "idempotency-key": `tag:${TAREFA_PRINCIPAL.id}:k-2`,
      },
    });
    expect(segunda.statusCode).toBe(200);

    const tagIds: string[] = segunda.json().tagIds;
    expect(tagIds.filter((id) => id === SOL.tags.contaTria).length).toBe(1);
  });

  // ── (l) erro interno nunca vaza dado financeiro (T-02-14) ─────────────────

  it("(l) erro interno responde o envelope do contrato, sem CPF/CNPJ/Bearer/valor no corpo", async () => {
    // Corrompe o Status da Tarefa dedicada direto no banco — fora do
    // Conjunto oficial de Status (D-01) — forçando `paraDtoV1` a lançar
    // dentro da rota. Nenhuma outra Tarefa/teste é afetado.
    const cliente = await pool().connect();
    try {
      await cliente.query(
        `update plataforma.registros
            set dados = jsonb_set(dados, '{statusId}', '"sts_inexistente"')
          where workspace_id = $1 and colecao = 'tasks' and id = $2`,
        [WORKSPACE, TAREFA_ERRO_INTERNO.id],
      );
    } finally {
      cliente.release();
    }

    const resposta = await appDeTeste().inject({
      method: "GET",
      url: `/v1/integrations/payment-requests/${TAREFA_ERRO_INTERNO.id}`,
      headers: { authorization: `Bearer ${tokenDe(CREDENCIAL_ESCRITA)}` },
    });
    expect(resposta.statusCode).toBe(500);
    const corpo = resposta.json();
    expect(corpo.error.code).toBe("ERRO_INTERNO");
    const bruto = JSON.stringify(corpo);
    expect(bruto).not.toContain("CPF");
    expect(bruto).not.toContain("CNPJ");
    expect(bruto).not.toContain("00.000.000/0001-91");
    expect(bruto).not.toContain("Bearer");
    expect(bruto).not.toContain(VALOR_HOSTIL_CENTAVOS);
  });

  // ── (m) getTask duas vezes → downloadUrl novo, gerado na leitura ──────────
  //
  // Deliberadamente `it.skip`, não gated por env: provar "URL nova a cada
  // leitura" exige um WorkspaceFile cujo `objectKey` exista de fato num
  // bucket do Supabase Storage — o fluxo de duas fases inteiro
  // (`abrirSessaoDeUpload` → `emitirTicket` → upload real →
  // `confirmarObjeto`) que `../servicos/storage-uploads.test.ts` já prova
  // como integração do Plan 02-11. Reimplementar esse fluxo aqui só para
  // gerar um `objectKey` válido duplicaria aquela suíte sem testar nada novo
  // desta rota — `paraDtoV1` (Task 1 deste plano) já chama `urlDeDownload`
  // por chamada, nunca reaproveita (ver `montarAnexos`,
  // `../servicos/dto-solicitacao.ts`); o que falta provar aqui é só a
  // integração fim-a-fim com um bucket real, fora do escopo de tempo desta
  // rodada. Ver "Known Limitations" no SUMMARY do Plan 02-13.
  it.skip("(m) getTask chamado duas vezes devolve downloadUrl DIFERENTES, sempre no futuro — requer bucket real de Storage", () => {
    expect(true).toBe(true);
  });
});

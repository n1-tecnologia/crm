/**
 * `POST /operacoes/:nome` — a rota genérica sobre `executar()`.
 *
 * A parte sem banco roda sempre (D-DEC-09), injetando `verificarToken`/
 * `resolverMembro` como `autenticacao.test.ts` já faz: prova o despacho por
 * `OPERACOES` (404 fora do registro, `__proto__` nunca resolve), 401/400,
 * sem depender de `DATABASE_URL`. A parte com Postgres real prova o caminho
 * inteiro — sucesso com diff, recusa do domínio em 200, Membro removido em
 * 403 — contra `apps/api/src/persistencia/unidade-de-trabalho.ts`.
 *
 * Os casos (k)–(r) provam CR-02: forma errada é 400 ANTES de `executar()`
 * para TODA operação (sem banco, (k)–(o); com banco, (p)/(q)) — nada chega
 * ao `jsonb`; (r) prova que o caminho feliz continua inteiro.
 * (s) prova WR-10 — o reviver protegido antes de qualquer schema.
 * (t)–(v) fecham a segunda rodada de CR-02 (Plan 01-16): `saveView` e as
 * demais — antes só cobertas pelo fallback estrutural — agora têm
 * schema próprio; nada muda no contrato HTTP em si, só a superfície
 * coberta.
 * (w)–(x) provam a costura de AUTO-02 (05-07, Task 2; migrado para a
 * Solicitação em 05-17/CR-05): a Automação de Canal publicada em
 * `CANAL_LISTA_ID` (Solicitações de pagamento) dispara por evento
 * (`tarefaEntrouEmStatus`, ao entrar em "em aprovação") e grava exatamente
 * um evento de outbox por Execução — nunca por operação comum sem Automação
 * de Canal envolvida. A derivação em si não é mais opt-in da rota: mora em
 * `persistencia/unidade-de-trabalho.ts::executar()` (05-17 Task 1).
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { usuarioDoSeed } from "@n1/dominio";
import { conversaoDeItemRecusada } from "@n1/dominio/derive";
import { evoluirConfiguracaoPorEmpresa } from "@n1/dominio/configuracao-por-empresa-evolver";
import { CP } from "@n1/dominio/operations";
import { CANAL_CAMPO_EMPRESA_ID, CANAL_CAMPO_WHATSAPP_ID, CANAL_LISTA_ID } from "@n1/dominio/operations/automations";
import { buildSeed } from "@n1/dominio/seed";
import { SOL } from "@n1/dominio/solicitacao-de-pagamento";
import { evoluirConfiguracaoDeSolicitacoes } from "@n1/dominio/solicitacao-de-pagamento-evolver";
import { buildApp } from "../app";
import { encerrar, pool } from "../persistencia/conexao";
import { hidratar, semear } from "../persistencia/repositorio";
import { criarRepositorioDeContatosPg } from "../repositorios/crm/contatos";
import { FRASE_DE_SUSPENSO } from "../plugins/autenticacao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal } from "../testes/banco-crm";
import {
  appDoEspaco,
  contatosDoVazamento,
  limparEspacoDeVazamento,
  montarEspacoDeVazamento,
  semearEspacoDeVazamento,
  TOKENS_DE_VAZAMENTO,
  type EspacoDeVazamento,
} from "../testes/espaco-de-vazamento";

// 1.1.5 — `inviteMember` resolve o e-mail no Supabase Auth ANTES da transação; o teste não vai à rede.
// O mock só troca `resolverUsuarioPorEmail`: nenhum e-mail do teste tem conta.
vi.mock("../autenticacao/resolver-usuario", async (importarOriginal) => ({
  ...(await importarOriginal<typeof import("../autenticacao/resolver-usuario")>()),
  resolverUsuarioPorEmail: async () => undefined,
}));

const MARYANE = usuarioDoSeed("mem_maryane"); // ativo, no seed do Financeiro
const TIAGO = usuarioDoSeed("mem_tiago"); // removido, no seed do CRM
const THIAGO = usuarioDoSeed("mem_thiago"); // Proprietário: conecta Canal (B35) e administra a Estrutura

const semente = buildSeed();
// CR-05/D5-19 (05-17) — o caso (w)/(x) migra para a Solicitação (colateral de
// 05-13): a Lista e as Integrações por Empresa precisam existir no MESMO
// `semente` que `semear()` grava em `ws_rotas_teste`, senão `destinoDeCanal`
// recusa por "Lista errada"/"Empresa sem Integração" antes de chegar ao que
// este caso prova.
{
  const solicitacoes = evoluirConfiguracaoDeSolicitacoes(semente, CP.financeiroId);
  if (!solicitacoes.ok) throw new Error(`fixture: ${solicitacoes.error}`);
  const empresas = evoluirConfiguracaoPorEmpresa(semente, CP.financeiroId);
  if (!empresas.ok) throw new Error(`fixture: ${empresas.error}`);
}
const membros = semente.members;

function appDeTeste(workspaceId = "ws_rotas_teste") {
  return buildApp({
    logger: false,
    workspaceId,
    verificarToken: async (token) =>
      token === "token-maryane"
        ? { sub: MARYANE }
        : token === "token-tiago"
          ? { sub: TIAGO }
          : token === "token-thiago"
            ? { sub: THIAGO }
            : null,
    resolverMembro: async (_workspaceId, userId) => membros.find((m) => m.userId === userId),
  });
}

describe("POST /operacoes/:nome — sem banco", () => {
  it("(a) nome fora do registro responde 404", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/naoExiste",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: [] },
    });
    expect(resposta.statusCode).toBe(404);
    expect(resposta.json().ok).toBe(false);
  });

  // Só no deploy da Fase 15 (14-17, T-14-42): a Tarefa conversacional nasce e muda pelas rotas
  // `/tarefas-conversacionais`, que conferem Contato, Canal, Conversa e Negócio nas tabelas.
  it.each(["criarTarefaConversacional", "trocarCanalDaTarefa", "vincularNegocioATarefa", "criarNegocioDaTarefa"])(
    "(a2) a operação antiga %s não está mais no registro: responde 404",
    async (nome) => {
      const resposta = await appDeTeste().inject({
        method: "POST",
        url: `/operacoes/${nome}`,
        headers: { authorization: "Bearer token-thiago" },
        payload: { args: [] },
      });
      expect(resposta.statusCode).toBe(404);
      expect(resposta.json()).toEqual({ ok: false, error: `Operação "${nome}" não existe.` });
    },
  );

  it("(b) um helper que não é caso de uso (nextId) responde 404 — não está em OPERACOES", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/nextId",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: [] },
    });
    expect(resposta.statusCode).toBe(404);
  });

  it("(c) __proto__ nunca resolve por herança de protótipo — 404 ou 400, nunca 200/500", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/__proto__",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: [] },
    });
    expect([400, 404]).toContain(resposta.statusCode);
    expect(resposta.json().ok).toBe(false);
  });

  it("(d) sem token responde 401", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/createTask",
      payload: { args: [] },
    });
    expect(resposta.statusCode).toBe(401);
  });

  it("(e) corpo sem args responde 400", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/createTask",
      headers: { authorization: "Bearer token-maryane" },
      payload: {},
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().ok).toBe(false);
  });

  it("(f) args que não é array responde 400", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/createTask",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: "x" },
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().ok).toBe(false);
  });

  it("(k) updateTask com title:123 responde 400 antes de executar() — nunca 500", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/updateTask",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: ["t1", { title: 123 }] },
    });
    expect(resposta.statusCode).toBe(400);
    const corpo = resposta.json();
    expect(corpo.ok).toBe(false);
    expect(corpo.error).toBe('Entrada inválida para "updateTask" em 1.title.');
  });

  it("(l) updateTask com description:{} responde 400 antes de executar()", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/updateTask",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: ["t1", { description: {} }] },
    });
    expect(resposta.statusCode).toBe(400);
    const corpo = resposta.json();
    expect(corpo.ok).toBe(false);
    expect(corpo.error).toContain("em 1.description");
  });

  it("(m) updateTask com chave desconhecida (titulo) responde 400 — .strict()", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/updateTask",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: ["t1", { titulo: "x" }] },
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().ok).toBe(false);
  });

  it("(n) runScheduledAutomations com marcador de Date inválido responde 400", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/runScheduledAutomations",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: ["l1", { $tipo: "Date", iso: "isso-nao-e-data" }] },
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().ok).toBe(false);
  });

  it("(o) trashTask com argumento a mais responde 400 — tupla fechada", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/trashTask",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: ["t1", "a-mais"] },
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().ok).toBe(false);
  });

  it("(s) corpo com 10.000 níveis de arrays aninhados em args responde 400 antes de qualquer schema — nunca 500 (WR-10)", async () => {
    // Limiar medido neste repositório: `reviverArgumentos` lança `RangeError`
    // a partir de ~3.000 níveis. 10.000 níveis são 20 KB — 50× abaixo do
    // `bodyLimit` padrão (1 MiB) — e estouram com folga.
    const n = 10000;
    const corpo = `{"args":[${"[".repeat(n)}${"]".repeat(n)}]}`;
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/updateTask",
      headers: { authorization: "Bearer token-maryane", "content-type": "application/json" },
      payload: corpo,
    });
    expect(resposta.statusCode).toBe(400);
    const respostaCorpo = resposta.json();
    expect(respostaCorpo.ok).toBe(false);
    expect(respostaCorpo.error).toBe('Entrada inválida para "updateTask".');
  });

  it("(t) saveView com kind:42 e um campo a mais responde 400 antes de executar()", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/saveView",
      headers: { authorization: "Bearer token-maryane" },
      payload: {
        args: [
          { listId: "lst_ativacao", name: "Visão", kind: 42, filters: {}, shared: false, lixo: { a: [1, 2] } },
        ],
      },
    });
    expect(resposta.statusCode).toBe(400);
    const corpo = resposta.json();
    expect(corpo.ok).toBe(false);
    expect(corpo.error.startsWith('Entrada inválida para "saveView"')).toBe(true);
  });
});

// D-15-07 — o bloco "contra o banco real" só roda com `DATABASE_URL` no Postgres LOCAL
// (`describeComBanco`, `../testes/banco-crm`). Este arquivo NÃO carrega o `.env`: ele aponta
// para o banco de produção, e um `npm test` sem `DATABASE_URL` já abriu esse banco por aqui.
const WS = "ws_rotas_teste";

/** A Automação de Canal do caso (w)/(x): publicada em `CANAL_LISTA_ID` (Solicitações de pagamento, D5-19/05-13), gatilho por evento — ao ENTRAR em "em aprovação". */
const AUTOMACAO_CANAL_ID = "aut_canal_operacoes_teste";

async function inserirAutomacaoDeCanal(workspaceId: string): Promise<void> {
  const dados = {
    id: AUTOMACAO_CANAL_ID,
    lifecycle: "ativo",
    scopeType: "list",
    scopeId: CANAL_LISTA_ID,
    name: "Canal de teste (05-17, migrado de 05-07 Task 2)",
    description: "",
    ownerMemberId: CP.financeiroId,
    reactsToAutomationEvents: false,
    versions: [
      {
        number: 1,
        state: "publicada",
        trigger: { kind: "evento", eventType: "tarefaEntrouEmStatus", eventSubtype: "em aprovação" },
        conditions: [],
        actions: [
          {
            order: 1,
            kind: "controle",
            controlKind: "notificar",
            params: JSON.stringify({ canal: "whatsapp", canalCampoDestinoId: CANAL_CAMPO_WHATSAPP_ID, canalMensagemId: "gasto-novo" }),
          },
        ],
        errorPolicy: { onActionFailure: "interromper", retries: 0 },
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  };
  const cliente = await pool().connect();
  try {
    await cliente.query(
      `insert into plataforma.registros (workspace_id, colecao, id, dados) values ($1, 'automations', $2, $3::jsonb)`,
      [workspaceId, AUTOMACAO_CANAL_ID, JSON.stringify(dados)],
    );
  } finally {
    cliente.release();
  }
}

/** Quantas linhas de `automacao.notificar-canal.v1` o payload aponta para `taskId` — a leitura que sobrevive a duas rodadas com aggregate_id distintos. */
async function contarOutboxCanalDaTarefa(taskId: string): Promise<number> {
  const cliente = await pool().connect();
  try {
    const r = await cliente.query<{ n: string }>(
      `select count(*)::text as n from plataforma.integration_outbox
        where workspace_id = $1 and event_type = 'automacao.notificar-canal.v1' and payload->>'taskId' = $2`,
      [WS, taskId],
    );
    return Number(r.rows[0]?.n ?? "0");
  } finally {
    cliente.release();
  }
}

describeComBanco("POST /operacoes/:nome — contra o banco real", () => {
  const tarefaDeContasAPagar = semente.tasks.find(
    (t) => t.listId === CP.listId && t.statusId === CP.status.paraPagar,
  );

  beforeAll(async () => {
    expect(tarefaDeContasAPagar, "o seed precisa ter uma conta em 'para pagar'").toBeDefined();
    const cliente = await pool().connect();
    try {
      // Os ids de Tarefa do seed se repetem entre execuções: sem limpar o outbox, as linhas
      // de Canal de uma rodada anterior entram na contagem de (w) e (x) da seguinte.
      await cliente.query("delete from plataforma.integration_outbox where workspace_id = $1", [WS]);
    } finally {
      cliente.release();
    }
    // O (z3) deixa Canal, Contato e Conversa nas tabelas do CRM: `limparEspaco` tira tudo do Espaço.
    await limparEspaco(WS);
    const clienteDoSeed = await pool().connect();
    try {
      await semear(clienteDoSeed, WS, semente);
    } finally {
      clienteDoSeed.release();
    }
    await inserirAutomacaoDeCanal(WS);
  });

  afterAll(async () => {
    const cliente = await pool().connect();
    try {
      await cliente.query("delete from plataforma.integration_outbox where workspace_id = $1", [WS]);
    } finally {
      cliente.release();
    }
    await limparEspaco(WS);
    await encerrar();
  });

  it("(g) addTaskComment com o Membro da sessão grava e devolve o diff (D-03)", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/addTaskComment",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: [tarefaDeContasAPagar!.id, { content: "Comentário pela rota." }] },
    });
    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json();
    expect(corpo.ok).toBe(true);
    expect(corpo.diferenca.gravados.length).toBeLessThanOrEqual(4);
    expect(corpo.diferenca.gravados.some((g: { colecao: string }) => g.colecao === "tasks")).toBe(true);
    expect(corpo.revisao).toBe(corpo.revisaoAnterior + 1);
    expect(corpo.value.content).toBe("Comentário pela rota.");
  });

  it("(h) recusa do domínio (RN-CP-04) responde 200 com ok:false e diff vazio", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/changeTaskStatus",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: [tarefaDeContasAPagar!.id, CP.status.pago] },
    });
    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json();
    expect(corpo.ok).toBe(false);
    expect(typeof corpo.error).toBe("string");
    expect(corpo.error.length).toBeGreaterThan(0);
    expect(corpo.diferenca.gravados.length).toBe(0);
  });

  it("(i) runScheduledAutomations revive o marcador de Date — nunca 400/500", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/runScheduledAutomations",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: [CP.listId, { $tipo: "Date", iso: new Date().toISOString() }] },
    });
    expect(resposta.statusCode).toBe(200);
    expect(typeof resposta.json().ok).toBe("boolean");
  });

  it("(j) Membro removido (Tiago) responde 403 antes de qualquer execução", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/addTaskComment",
      headers: { authorization: "Bearer token-tiago" },
      payload: { args: [tarefaDeContasAPagar!.id, { content: "Não deveria gravar." }] },
    });
    expect(resposta.statusCode).toBe(403);
  });

  it("(p) updateTask com title:123 e description:{} responde 400 e nunca persistido", async () => {
    const clienteAntes = await pool().connect();
    let tituloAntes: string | undefined;
    try {
      const { state } = await hidratar(clienteAntes, WS);
      tituloAntes = state.tasks.find((t) => t.id === tarefaDeContasAPagar!.id)?.title;
    } finally {
      clienteAntes.release();
    }

    const respostaTitulo = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/updateTask",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: [tarefaDeContasAPagar!.id, { title: 123 }] },
    });
    expect(respostaTitulo.statusCode).toBe(400);

    const respostaDescricao = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/updateTask",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: [tarefaDeContasAPagar!.id, { description: {} }] },
    });
    expect(respostaDescricao.statusCode).toBe(400);

    const clienteDepois = await pool().connect();
    try {
      const { state } = await hidratar(clienteDepois, WS);
      const tarefa = state.tasks.find((t) => t.id === tarefaDeContasAPagar!.id);
      expect(tarefa?.title).toBe(tituloAntes);
      expect(["string", "undefined"]).toContain(typeof tarefa?.description);
    } finally {
      clienteDepois.release();
    }
  });

  it("(q) createChatFolder com name:123 responde 400 pelo schema — antes de executar(), nada persistido", async () => {
    const clienteAntes = await pool().connect();
    let quantidadeAntes: number;
    try {
      const { state } = await hidratar(clienteAntes, WS);
      quantidadeAntes = state.chatFolders.length;
    } finally {
      clienteAntes.release();
    }

    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/createChatFolder",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: [{ name: 123 }] },
    });
    expect(resposta.statusCode).toBe(400);
    const corpo = resposta.json();
    expect(corpo.ok).toBe(false);
    expect(corpo.error).toBe('Entrada inválida para "createChatFolder" em 0.name.');

    const clienteDepois = await pool().connect();
    try {
      const { state } = await hidratar(clienteDepois, WS);
      expect(state.chatFolders.length).toBe(quantidadeAntes);
    } finally {
      clienteDepois.release();
    }
  });

  it("(r) updateTask com description válida grava e devolve o diff — o caminho feliz continua inteiro", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/updateTask",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: [tarefaDeContasAPagar!.id, { description: "Descrição pela rota." }] },
    });
    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json();
    expect(corpo.ok).toBe(true);
    expect(corpo.value.description).toBe("Descrição pela rota.");
    expect(corpo.diferenca.gravados.some((g: { colecao: string }) => g.colecao === "tasks")).toBe(true);

    const cliente = await pool().connect();
    try {
      const { state } = await hidratar(cliente, WS);
      const tarefa = state.tasks.find((t) => t.id === tarefaDeContasAPagar!.id);
      expect(tarefa?.description).toBe("Descrição pela rota.");
    } finally {
      cliente.release();
    }
  });

  it("(r2) updateTask com descriptionMentions grava a lista e o antes/depois do histórico, e a hidratação devolve os dois (Fase 11)", async () => {
    const maryane = membros.find((m) => m.userId === MARYANE);
    expect(maryane, "o seed precisa ter o Membro da sessão").toBeDefined();

    const clienteAntes = await pool().connect();
    let descricaoAntes = "";
    try {
      const { state } = await hidratar(clienteAntes, WS);
      descricaoAntes = state.tasks.find((t) => t.id === tarefaDeContasAPagar!.id)?.description ?? "";
    } finally {
      clienteAntes.release();
    }

    const nova = `@${maryane!.displayName} conferir o vencimento`;
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/updateTask",
      headers: { authorization: "Bearer token-maryane" },
      payload: {
        args: [tarefaDeContasAPagar!.id, { description: nova, descriptionMentions: [{ type: "member", id: maryane!.id }] }],
      },
    });
    expect(resposta.statusCode, resposta.body).toBe(200);
    const corpo = resposta.json();
    expect(corpo.ok, corpo.error).toBe(true);

    const cliente = await pool().connect();
    try {
      const { state } = await hidratar(cliente, WS);
      const tarefa = state.tasks.find((t) => t.id === tarefaDeContasAPagar!.id);
      expect(tarefa?.description).toBe(nova);
      expect(tarefa?.descriptionMentions).toEqual([{ type: "member", id: maryane!.id }]);
      const registro = state.activity.find(
        (a) => a.objectId === tarefaDeContasAPagar!.id && a.action === "Descrição alterada" && a.after === nova,
      );
      expect(registro, "o Registro da descrição precisa voltar na hidratação").toBeDefined();
      expect(registro?.before).toBe(descricaoAntes);
    } finally {
      cliente.release();
    }
  });

  it("(r2b) updateTask com descriptionMentions de um Membro que não existe responde ok:false e não grava a lista", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/updateTask",
      headers: { authorization: "Bearer token-maryane" },
      payload: {
        args: [tarefaDeContasAPagar!.id, { description: "@Fulano Inexistente olhe", descriptionMentions: [{ type: "member", id: "mem_que_nao_existe" }] }],
      },
    });
    expect(resposta.statusCode, resposta.body).toBe(200);
    const corpo = resposta.json();
    expect(corpo.ok).toBe(false);
    expect(corpo.diferenca.gravados.length).toBe(0);

    const cliente = await pool().connect();
    try {
      const { state } = await hidratar(cliente, WS);
      const tarefa = state.tasks.find((t) => t.id === tarefaDeContasAPagar!.id);
      expect(tarefa?.description).not.toBe("@Fulano Inexistente olhe");
    } finally {
      cliente.release();
    }
  });

  it("(r3) convertChecklistItem de três argumentos chega ao domínio; com quatro, o esquema responde 400 antes de executar() (Fase 11)", async () => {
    // Contas a pagar não usa Checklists nem Subtarefas: a prova do caminho de três argumentos
    // pede uma Lista que usa os dois — a de Revisões (`tsk_seed_1`), pelo Proprietário.
    const tarefaId = "tsk_seed_1";
    const chamar = (nome: string, args: unknown[]) =>
      appDeTeste().inject({
        method: "POST",
        url: `/operacoes/${nome}`,
        headers: { authorization: "Bearer token-thiago" },
        payload: { args },
      });

    const criada = await chamar("addChecklist", [tarefaId, "Passos da conta"]);
    expect(criada.statusCode, criada.body).toBe(200);
    expect(criada.json().ok, criada.json().error).toBe(true);
    // As duas operações devolvem a Tarefa inteira: o Checklist e o Item novos são os últimos da lista.
    const checklistId: string = criada.json().value.checklists.at(-1).id;

    const item = await chamar("addChecklistItem", [tarefaId, checklistId, "Conferir o boleto"]);
    expect(item.statusCode, item.body).toBe(200);
    expect(item.json().ok, item.json().error).toBe(true);
    const itemId: string = item.json().value.checklists.find((c: { id: string }) => c.id === checklistId).items.at(-1).id;

    // Quatro argumentos: o esquema recusa antes de `executar()` — nada é gravado.
    const quatro = await chamar("convertChecklistItem", [tarefaId, checklistId, itemId, "tsk_pai_alternativo"]);
    expect(quatro.statusCode).toBe(400);
    expect(quatro.json().ok).toBe(false);

    const clienteAntes = await pool().connect();
    let tarefasAntes: number;
    try {
      const { state } = await hidratar(clienteAntes, WS);
      tarefasAntes = state.tasks.length;
    } finally {
      clienteAntes.release();
    }

    // Três argumentos: chega ao domínio e a Subtarefa nasce sempre sob a Tarefa do Checklist (D-04).
    const tres = await chamar("convertChecklistItem", [tarefaId, checklistId, itemId]);
    expect(tres.statusCode, tres.body).toBe(200);
    const corpo = tres.json();
    expect(corpo.ok, corpo.error).toBe(true);

    const cliente = await pool().connect();
    try {
      const { state } = await hidratar(cliente, WS);
      const subtarefa = state.tasks.find((t) => t.id === corpo.value.id);
      expect(subtarefa?.parentTaskId).toBe(tarefaId);
      expect(state.tasks.length).toBe(tarefasAntes + 1);
    } finally {
      cliente.release();
    }
  });

  it("(r3b) convertChecklistItem numa Lista sem Subtarefas (Contas a pagar) responde ok:false com a frase da derivada e grava nada", async () => {
    const tarefaId = tarefaDeContasAPagar!.id;
    const cliente = await pool().connect();
    try {
      const { state } = await hidratar(cliente, WS);
      const tarefa = state.tasks.find((t) => t.id === tarefaId);
      expect(conversaoDeItemRecusada(state, "mem_maryane", tarefaId)).toBe("Esta Lista não usa Subtarefas.");
      expect(tarefa).toBeDefined();
    } finally {
      cliente.release();
    }
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/convertChecklistItem",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: [tarefaId, "chk_que_nao_importa", "chi_que_nao_importa"] },
    });
    expect(resposta.statusCode, resposta.body).toBe(200);
    const corpo = resposta.json();
    expect(corpo.ok).toBe(false);
    expect(corpo.error).toBe("Esta Lista não usa Subtarefas.");
    expect(corpo.diferenca.gravados.length).toBe(0);
  });

  it("(y) uma operação nova do frontend do main (criarColecao) grava e volta na hidratação — não fica só na cópia do cliente", async () => {
    const nome = `Coleção pela rota ${Date.now()}`;
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/criarColecao",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: [{ name: nome, description: "Criada pela integração do main.", isPrivate: false }] },
    });
    expect(resposta.statusCode, resposta.body).toBe(200);
    const corpo = resposta.json();
    expect(corpo.ok, corpo.error).toBe(true);

    const cliente = await pool().connect();
    try {
      const { state } = await hidratar(cliente, WS);
      expect(state.collections.some((c) => c.name === nome)).toBe(true);
    } finally {
      cliente.release();
    }
  });

  it("(z) createList com a forma literal de create-container-dialog.tsx (modeloDeTarefa) grava e volta na hidratação — era 400 pelo .strict() (FUND-05)", async () => {
    const nome = `Lista pela rota ${Date.now()}`;
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/createList",
      headers: { authorization: "Bearer token-maryane" },
      payload: {
        args: [{ name: nome, parentType: "folder", parentId: CP.folderId, isPrivate: false, modeloDeTarefa: "operacional" }],
      },
    });
    expect(resposta.statusCode, resposta.body).toBe(200);
    const corpo = resposta.json();
    expect(corpo.ok, corpo.error).toBe(true);

    const cliente = await pool().connect();
    try {
      const { state } = await hidratar(cliente, WS);
      const lista = state.lists.find((l) => l.name === nome);
      expect(lista).toBeDefined();
      expect(lista?.modeloDeTarefa).toBe("operacional");
    } finally {
      cliente.release();
    }
  });

  it("(z2) updateContainer e archiveContainer pela rota (POSC-09): renomeia e arquiva a Lista no banco, e volta na hidratação", async () => {
    const nome = `Lista renomeada ${Date.now()}`;
    const renomear = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/updateContainer",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: ["list", CP.listId, { name: nome }] },
    });
    expect(renomear.statusCode, renomear.body).toBe(200);
    expect(renomear.json().ok, renomear.json().error).toBe(true);
    const arquivar = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/archiveContainer",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: ["list", CP.listId] },
    });
    expect(arquivar.statusCode, arquivar.body).toBe(200);
    expect(arquivar.json().ok, arquivar.json().error).toBe(true);

    const cliente = await pool().connect();
    try {
      const { state } = await hidratar(cliente, WS);
      const lista = state.lists.find((l) => l.id === CP.listId);
      expect(lista?.name).toBe(nome);
      expect(lista?.lifecycle).toBe("arquivado");
    } finally {
      cliente.release();
    }
    // Desarquiva para não deixar a Lista de Contas a pagar arquivada para os casos seguintes.
    const desarquivar = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/unarchiveContainer",
      headers: { authorization: "Bearer token-maryane" },
      payload: { args: ["list", CP.listId] },
    });
    expect(desarquivar.json().ok, desarquivar.json().error).toBe(true);
  });

  it("(z3) FUND-18 — o fluxo conversacional pela rota: Canal e Contato nas tabelas, criar Lista conversacional com o Canal, trocar os canais e criar a Tarefa por POST /tarefas-conversacionais", async () => {
    const chamar = (nome: string, args: unknown[]) =>
      appDeTeste().inject({ method: "POST", url: `/operacoes/${nome}`, headers: { authorization: "Bearer token-thiago" }, payload: { args } });
    // 14-17 — a Tarefa conversacional não nasce mais por `POST /operacoes/criarTarefaConversacional`: o Canal e o
    // Contato vivem em `plataforma.canais` e `plataforma.contatos`, e a rota nova os confere ali.
    const sufixo = Date.now();
    const canalId = await semearCanal(WS, {
      nome: `Atendimento ${sufixo}`,
      tipo: "whatsapp",
      provedor: "whatsapp-cloud",
      identificadorExterno: `+5511${String(sufixo).slice(-9)}`,
      conexao: "conectada",
    });
    const repositorioDeContatos = criarRepositorioDeContatosPg(pool());
    const contato = await repositorioDeContatos.inserir(WS, { nome: "Contato", sobrenome: `da Tarefa ${sufixo}`, proprietarioId: "mem_thiago", criadoPor: "mem_thiago" });
    await repositorioDeContatos.inserirIdentificador(WS, contato.id, { tipo: "whatsapp", valor: `+5511988${String(sufixo).slice(-6)}`, principal: true });

    const lista = await chamar("createList", [
      { name: `Atendimento ${sufixo}`, parentType: "folder", parentId: CP.folderId, isPrivate: false, modeloDeTarefa: "conversacional", canaisDeAtendimento: [canalId] },
    ]);
    const listaCorpo = lista.json() as { ok: boolean; error?: string; value: { id: string; canaisDeAtendimento?: string[] } };
    expect(listaCorpo.ok, listaCorpo.error).toBe(true);
    expect(listaCorpo.value.canaisDeAtendimento).toEqual([canalId]);
    const listaId = listaCorpo.value.id;

    const canais = await chamar("definirCanaisDaLista", [listaId, [canalId]]);
    expect((canais.json() as { ok: boolean; error?: string }).ok, canais.body).toBe(true);

    const tarefa = await appDeTeste().inject({
      method: "POST",
      url: "/tarefas-conversacionais",
      headers: { authorization: "Bearer token-thiago" },
      payload: { listId: listaId, contatoId: contato.id, canalId, mensagem: { conteudo: "Olá, tudo bem?" } },
    });
    expect(tarefa.statusCode, tarefa.body).toBe(201);
    const tarefaCorpo = tarefa.json() as { ok: boolean; dados: { value: { task: { id: string; listId: string } }; conversa: { id: string; aberta: boolean } } };
    expect(tarefaCorpo.ok).toBe(true);
    // `aberta: true`: o par (Contato, Canal) não tinha Conversa e ela nasceu com a Tarefa.
    expect(tarefaCorpo.dados.conversa.aberta).toBe(true);

    const cliente = await pool().connect();
    try {
      const { state } = await hidratar(cliente, WS);
      const l = state.lists.find((x) => x.id === listaId);
      expect(l?.modeloDeTarefa).toBe("conversacional");
      expect(l?.canaisDeAtendimento).toEqual([canalId]);
      const nascida = state.tasks.find((t) => t.id === tarefaCorpo.dados.value.task.id);
      expect(nascida?.listId).toBe(listaId);
      // A Tarefa aponta para o CRM só por Vínculos, com os ids das tabelas.
      const vinculos = state.links.filter((v) => v.fromType === "task" && v.fromId === tarefaCorpo.dados.value.task.id);
      expect(vinculos.map((v) => `${v.toType}:${v.toId}`).sort()).toEqual([`contact:${contato.id}`, `conversation:${tarefaCorpo.dados.conversa.id}`].sort());
      const conversa = await cliente.query("select 1 from plataforma.conversas where workspace_id = $1 and id = $2 and canal_id = $3", [WS, tarefaCorpo.dados.conversa.id, canalId]);
      expect(conversa.rowCount).toBe(1);
    } finally {
      cliente.release();
    }
  });

  it("(v) saveView com filters arbitrário responde 400 e state.views inalterado; com filters:{} responde 200", async () => {
    const clienteAntes = await pool().connect();
    let quantidadeAntes: number;
    try {
      const { state } = await hidratar(clienteAntes, WS);
      quantidadeAntes = state.views.length;
    } finally {
      clienteAntes.release();
    }

    const respostaHostil = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/saveView",
      headers: { authorization: "Bearer token-maryane" },
      payload: {
        args: [
          {
            listId: CP.listId,
            name: "V",
            kind: "lista",
            filters: { qualquer: { coisa: true } },
            shared: false,
          },
        ],
      },
    });
    expect(respostaHostil.statusCode).toBe(400);
    const corpoHostil = respostaHostil.json();
    expect(corpoHostil.ok).toBe(false);
    expect(corpoHostil.error).toContain("em 0.filters");

    const clienteDepois = await pool().connect();
    try {
      const { state } = await hidratar(clienteDepois, WS);
      expect(state.views.length).toBe(quantidadeAntes);
    } finally {
      clienteDepois.release();
    }

    const respostaLegitima = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/saveView",
      headers: { authorization: "Bearer token-maryane" },
      payload: {
        args: [{ listId: CP.listId, name: "V", kind: "lista", filters: {}, shared: false }],
      },
    });
    expect(respostaLegitima.statusCode).toBe(200);
    expect(respostaLegitima.json().ok).toBe(true);
  });

  it("(w) cria Solicitação, preenche Empresa/WhatsApp e entra em 'em aprovação' com a Automação de Canal publicada: grava 1 linha por rodada — duas rodadas não colidem", async () => {
    const app = appDeTeste();

    async function rodarFluxoDeCanal(titulo: string): Promise<string> {
      // 1) Nasce em "para fazer" — a Automação de Canal reage a ENTRAR em
      // "em aprovação", nunca a `tarefaCriada`, então este passo não a dispara.
      const criacao = await app.inject({
        method: "POST",
        url: "/operacoes/createTask",
        headers: { authorization: "Bearer token-maryane" },
        payload: { args: [{ listId: CANAL_LISTA_ID, title: titulo, statusId: SOL.status.paraFazer }] },
      });
      expect(criacao.statusCode).toBe(200);
      const taskId: string = criacao.json().value.id;

      // 2) Preenche os Campos ANTES da Automação rodar — `setTaskFieldValue` não
      // dispara nenhum gatilho por si. `destinoDeCanal` (D5-19) lê Empresa E,
      // no modo campo, o WhatsApp — os dois precisam estar preenchidos.
      const empresa = await app.inject({
        method: "POST",
        url: "/operacoes/setTaskFieldValue",
        headers: { authorization: "Bearer token-maryane" },
        payload: { args: [taskId, CANAL_CAMPO_EMPRESA_ID, "Marcos Paulo"] },
      });
      expect(empresa.statusCode).toBe(200);
      expect(empresa.json().ok).toBe(true);

      const campo = await app.inject({
        method: "POST",
        url: "/operacoes/setTaskFieldValue",
        headers: { authorization: "Bearer token-maryane" },
        payload: { args: [taskId, CANAL_CAMPO_WHATSAPP_ID, "whatsapp-do-solicitante-teste"] },
      });
      expect(campo.statusCode).toBe(200);
      expect(campo.json().ok).toBe(true);

      // 3) Entrar em "em aprovação" dispara `tarefaEntrouEmStatus` — a Automação
      // de Canal roda dentro da MESMA transação e o evento nasce no mesmo commit.
      const mudanca = await app.inject({
        method: "POST",
        url: "/operacoes/changeTaskStatus",
        headers: { authorization: "Bearer token-maryane" },
        payload: { args: [taskId, SOL.status.emAprovacao] },
      });
      expect(mudanca.statusCode).toBe(200);
      expect(mudanca.json().ok).toBe(true);
      return taskId;
    }

    const primeiraTarefa = await rodarFluxoDeCanal("Solicitação de teste — Canal (05-17 w, 1ª rodada)");
    expect(await contarOutboxCanalDaTarefa(primeiraTarefa)).toBe(1);

    // Segunda rodada, TAREFA DIFERENTE: outra Execução, outro `executionId`, outro
    // `aggregate_id` (WR-04, `<executionId>:<indicePasso>`) — nenhum conflito.
    const segundaTarefa = await rodarFluxoDeCanal("Solicitação de teste — Canal (05-17 w, 2ª rodada)");
    expect(await contarOutboxCanalDaTarefa(segundaTarefa)).toBe(1);
    expect(segundaTarefa).not.toBe(primeiraTarefa);

    const cliente = await pool().connect();
    try {
      const execucoes = await cliente.query<{ objectid: string }>(
        `select r.dados->>'objectId' as objectid
           from plataforma.registros r
          where r.workspace_id = $1 and r.colecao = 'automationExecutions'
            and r.dados->>'automationId' = $2 and r.dados->>'objectId' in ($3, $4)`,
        [WS, AUTOMACAO_CANAL_ID, primeiraTarefa, segundaTarefa],
      );
      expect(execucoes.rowCount).toBe(2); // uma Execução por rodada, cada uma com o seu id

      const aggregateIds = await cliente.query<{ aggregate_id: string }>(
        `select aggregate_id from plataforma.integration_outbox
          where workspace_id = $1 and event_type = 'automacao.notificar-canal.v1' and payload->>'taskId' in ($2, $3)`,
        [WS, primeiraTarefa, segundaTarefa],
      );
      // WR-04 — `<executionId>:<indicePasso>`, nunca só o executionId.
      for (const linha of aggregateIds.rows) expect(linha.aggregate_id).toMatch(/^.+:0$/);
    } finally {
      cliente.release();
    }
  });

  it("(x) uma operação comum, sem a Automação de Canal envolvida, não grava evento de Canal nenhum", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/operacoes/createTask",
      headers: { authorization: "Bearer token-maryane" },
      // Nasce DIRETO em "em aprovação" (o status que a Automação vigia) — a
      // criação não é uma ENTRADA por `changeTaskStatus`, então
      // `tarefaEntrouEmStatus` nunca dispara e a Automação de Canal nunca roda.
      payload: { args: [{ listId: CANAL_LISTA_ID, title: "Solicitação de teste — sem Canal (05-17 x)", statusId: SOL.status.emAprovacao }] },
    });
    expect(resposta.statusCode).toBe(200);
    const taskId: string = resposta.json().value.id;

    expect(await contarOutboxCanalDaTarefa(taskId)).toBe(0);
  });
});

describeComBanco("POST /operacoes — resposta recortada pelo que o Membro enxerga (1.1.5, F1) e Membro suspenso (1.2.1)", () => {
  let espaco: EspacoDeVazamento;

  beforeAll(async () => {
    await prepararBancoCrm();
    espaco = montarEspacoDeVazamento("operacoes");
    // O seed não cria mais Contato (15-31): a matriz e o caso 1.2.1 de `trashContact` usam os do vazamento.
    espaco.estado.contacts.push(...contatosDoVazamento(espaco.estado.workspace.id, espaco.estado.workspace.ownerMemberId));
    await semearEspacoDeVazamento(espaco);
  });

  afterAll(async () => {
    await limparEspacoDeVazamento(espaco);
    await encerrar();
  });

  const chamar = (token: string, nome: string, args: unknown[]) =>
    appDoEspaco(espaco).inject({
      method: "POST",
      url: `/operacoes/${nome}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { args },
    });

  it("B grava um Campo numa Tarefa com link público e o corpo inteiro da resposta (value e diferenca) não traz o segredo", async () => {
    const { tarefaComLink, campoGravavelPorB, link } = espaco.segredos;
    const resposta = await chamar(TOKENS_DE_VAZAMENTO.b, "setTaskFieldValue", [tarefaComLink, campoGravavelPorB, 7]);
    expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(200);
    const corpo = resposta.json() as { ok: boolean; value?: { id: string }; diferenca: { gravados: Array<{ id: string }> } };
    expect(corpo.ok).toBe(true);
    // A gravação aconteceu e a Tarefa voltou nos dois lugares — só que sem o segredo.
    expect(corpo.value?.id).toBe(tarefaComLink);
    expect(corpo.diferenca.gravados.some((g) => g.id === tarefaComLink)).toBe(true);
    expect(resposta.body, "segredo do link público").not.toContain(link);
    expect(resposta.body, "segredo do Formulário").not.toContain(espaco.segredos.formulario);
    for (const frase of [...espaco.frases.a, ...espaco.frases.b]) expect(resposta.body, `frase privada: ${frase}`).not.toContain(frase);
  });

  it("o Proprietário convida pelo caminho SERVICOS e a resposta traz `sequencia` e `diferenca`, como a do outro ramo", async () => {
    const papel = espaco.estado.roles.find((r) => r.base === "membro");
    expect(papel, "o seed precisa de um Papel de base membro").toBeDefined();
    const email = `novo-${espaco.workspaceId}@exemplo.com`;
    const resposta = await chamar(TOKENS_DE_VAZAMENTO.proprietario, "inviteMember", [{ email, roleId: papel!.id }]);
    expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(200);
    const corpo = resposta.json() as { ok: boolean; sequencia?: number; diferenca?: { gravados: unknown[] }; value?: { invitedIdentity?: { value: string } } };
    expect(corpo.ok).toBe(true);
    expect(typeof corpo.sequencia).toBe("number");
    expect(corpo.diferenca).toBeDefined();
    // Quem convida administra o Espaço: o e-mail do convite que ele acabou de criar volta para ele.
    expect(corpo.value?.invitedIdentity?.value).toBe(email.toLowerCase());
    for (const frase of [...espaco.frases.a, ...espaco.frases.b]) expect(resposta.body, `frase privada: ${frase}`).not.toContain(frase);
  });

  it("uma operação que devolve ok:false responde 200 como antes: o erro, uma diferença vazia e nenhum value", async () => {
    // A Tarefa não existe: o domínio recusa (valor, não falha de transporte).
    const resposta = await chamar(TOKENS_DE_VAZAMENTO.b, "setTaskFieldValue", ["tsk_nao_existe", espaco.segredos.campoGravavelPorB, 7]);
    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json() as { ok: boolean; error?: string; value?: unknown; diferenca?: { gravados: unknown[]; removidos: unknown[] } };
    expect(corpo.ok).toBe(false);
    expect(typeof corpo.error).toBe("string");
    expect(corpo.value).toBeUndefined();
    expect(corpo.diferenca?.gravados ?? []).toHaveLength(0);
    expect(corpo.diferenca?.removidos ?? []).toHaveLength(0);
  });

  it("1.2.1 — o Membro suspenso chama trashContact e recebe 403; depois, o Contato continua ativo no banco", async () => {
    const contato = espaco.estado.contacts.find((c) => c.lifecycle === "ativo");
    expect(contato, "o seed precisa de um Contato ativo").toBeDefined();
    const resposta = await chamar(TOKENS_DE_VAZAMENTO.suspenso, "trashContact", [contato!.id]);
    expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(403);
    expect(resposta.json()).toEqual({ ok: false, error: FRASE_DE_SUSPENSO });

    const cliente = await pool().connect();
    try {
      const { state } = await hidratar(cliente, espaco.workspaceId);
      expect(state.contacts.find((c) => c.id === contato!.id)?.lifecycle).toBe("ativo");
    } finally {
      cliente.release();
    }
  });
});

describeComBanco("POST /operacoes/removeMember — a sucessão chega às tabelas do CRM no mesmo commit (14-10, 3.2.8)", () => {
  let espaco: EspacoDeVazamento;
  /** Outro Espaço com o mesmo `proprietario_id`: a passagem nunca atravessa o `workspace_id`. */
  let outroEspaco: string;
  let ids: { contatoA: string; contatoB: string; contatoDeOutro: string; empresa: string; negocio: string; conversaDoRemovido: string; conversaDeOutro: string; contatoDoOutroEspaco: string };

  const removido = () => espaco.membros.suspenso.id;
  const sucessor = () => espaco.membros.a.id;
  const donoDe = async (tabela: "contatos" | "empresas" | "negocios", workspaceId: string, id: string) =>
    (await pool().query<{ proprietario_id: string }>(`select proprietario_id from plataforma.${tabela} where workspace_id = $1 and id = $2`, [workspaceId, id])).rows[0]?.proprietario_id;
  const atribuicaoDe = async (id: string) =>
    (await pool().query<{ atribuido_tipo: string | null; atribuido_id: string | null }>("select atribuido_tipo, atribuido_id from plataforma.conversas where workspace_id = $1 and id = $2", [espaco.workspaceId, id])).rows[0];
  const chamar = (token: string, args: unknown[]) =>
    appDoEspaco(espaco).inject({ method: "POST", url: "/operacoes/removeMember", headers: { authorization: `Bearer ${token}` }, payload: { args } });

  async function contato(workspaceId: string, nome: string, dono: string): Promise<string> {
    const { rows } = await pool().query<{ id: string }>(
      "insert into plataforma.contatos (workspace_id, nome, proprietario_id, criado_por) values ($1, $2, $3, $3) returning id",
      [workspaceId, nome, dono],
    );
    return rows[0]!.id;
  }

  beforeAll(async () => {
    await prepararBancoCrm();
    espaco = montarEspacoDeVazamento("sucessao");
    await semearEspacoDeVazamento(espaco);
    outroEspaco = novoEspacoDeTeste("sucessaob");
    const ws = espaco.workspaceId;
    const contatoA = await contato(ws, "Do removido 1", removido());
    const contatoB = await contato(ws, "Do removido 2", removido());
    const contatoDeOutro = await contato(ws, "De outro Membro", espaco.membros.b.id);
    // A Empresa exige um Contato admin vigente já no commit (trigger deferido): Empresa e vínculo vão numa transação.
    let empresa: string;
    const cliente = await pool().connect();
    try {
      await cliente.query("begin");
      empresa = (
        await cliente.query<{ id: string }>("insert into plataforma.empresas (workspace_id, nome_fantasia, proprietario_id, criado_por) values ($1, 'Empresa do removido', $2, $2) returning id", [ws, removido()])
      ).rows[0]!.id;
      await cliente.query("insert into plataforma.contato_empresa (workspace_id, contato_id, empresa_id, admin, criado_por) values ($1, $2, $3, true, $4)", [ws, contatoA, empresa, removido()]);
      await cliente.query("commit");
    } catch (erro) {
      await cliente.query("rollback");
      throw erro;
    } finally {
      cliente.release();
    }
    const funil = (await pool().query<{ id: string }>("insert into plataforma.funis (workspace_id, nome, criado_por) values ($1, 'Funil', $2) returning id", [ws, removido()])).rows[0]!.id;
    const etapa = (await pool().query<{ id: string }>("insert into plataforma.etapas (workspace_id, funil_id, nome, ordem) values ($1, $2, 'Etapa', 1) returning id", [ws, funil])).rows[0]!.id;
    const negocio = (
      await pool().query<{ id: string }>(
        "insert into plataforma.negocios (workspace_id, titulo, contato_id, funil_id, etapa_id, proprietario_id, criado_por) values ($1, 'Negócio do removido', $2, $3, $4, $5, $5) returning id",
        [ws, contatoA, funil, etapa, removido()],
      )
    ).rows[0]!.id;
    const canal = await semearCanal(ws, { nome: "Canal", tipo: "whatsapp", provedor: "whatsapp-cloud", identificadorExterno: "5511900000000" });
    const conversa = async (contatoId: string, titulo: string, membroId: string) =>
      (
        await pool().query<{ id: string }>(
          `insert into plataforma.conversas (workspace_id, canal_id, contato_id, titulo, atribuido_tipo, atribuido_id, criado_por_tipo, criado_por_id)
           values ($1, $2, $3, $4, 'membro', $5, 'membro', $5) returning id`,
          [ws, canal, contatoId, titulo, membroId],
        )
      ).rows[0]!.id;
    const conversaDoRemovido = await conversa(contatoA, "Atribuída ao removido", removido());
    const conversaDeOutro = await conversa(contatoB, "Atribuída a outro", espaco.membros.b.id);
    const contatoDoOutroEspaco = await contato(outroEspaco, "Outro Espaço", removido());
    ids = { contatoA, contatoB, contatoDeOutro, empresa, negocio, conversaDoRemovido, conversaDeOutro, contatoDoOutroEspaco };
  });

  afterAll(async () => {
    await limparEspacoDeVazamento(espaco);
    await limparEspaco(outroEspaco);
    await encerrar();
  });

  it("quem não é Administrador nem Proprietário pede a remoção: o domínio recusa (200, ok:false) e as tabelas do CRM ficam iguais", async () => {
    const resposta = await chamar(TOKENS_DE_VAZAMENTO.b, [removido(), sucessor()]);
    expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(200);
    expect(resposta.json().ok).toBe(false);
    const ws = espaco.workspaceId;
    expect(await donoDe("contatos", ws, ids.contatoA)).toBe(removido());
    expect(await donoDe("contatos", ws, ids.contatoB)).toBe(removido());
    expect(await donoDe("empresas", ws, ids.empresa)).toBe(removido());
    expect(await donoDe("negocios", ws, ids.negocio)).toBe(removido());
    expect(await atribuicaoDe(ids.conversaDoRemovido)).toEqual({ atribuido_tipo: "membro", atribuido_id: removido() });
  });

  it("um Sucessor que o domínio recusa (Convidado) também não mexe nas tabelas", async () => {
    const resposta = await chamar(TOKENS_DE_VAZAMENTO.administrador, [removido(), espaco.membros.convidado.id]);
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().ok).toBe(false);
    expect(await donoDe("contatos", espaco.workspaceId, ids.contatoA)).toBe(removido());
  });

  it("o Administrador remove o Membro: Contatos, Empresa e Negócio passam ao Sucessor, a Conversa dele passa ao Sucessor como Atribuído, e o resto não muda", async () => {
    const resposta = await chamar(TOKENS_DE_VAZAMENTO.administrador, [removido(), sucessor()]);
    expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(200);
    expect(resposta.json().ok).toBe(true);
    const ws = espaco.workspaceId;
    expect(await donoDe("contatos", ws, ids.contatoA)).toBe(sucessor());
    expect(await donoDe("contatos", ws, ids.contatoB)).toBe(sucessor());
    expect(await donoDe("empresas", ws, ids.empresa)).toBe(sucessor());
    expect(await donoDe("negocios", ws, ids.negocio)).toBe(sucessor());
    // RN-ET-09 (a) e RN-CXE-24 emendadas (D-15-08): a Conversa passa ao Sucessor como Atribuído.
    expect(await atribuicaoDe(ids.conversaDoRemovido)).toEqual({ atribuido_tipo: "membro", atribuido_id: sucessor() });
    // 15-09: cada registro passado deixou a Atividade, no mesmo commit, com o Administrador que removeu como ator.
    const linhas = (
      await pool().query<{ acao: string; ator_id: string }>(
        "select acao, ator_id from plataforma.crm_atividades where workspace_id = $1 order by acao",
        [ws],
      )
    ).rows;
    expect(linhas.map((l) => l.acao)).toEqual([
      "Contato passado ao Sucessor",
      "Contato passado ao Sucessor",
      "Conversa passada ao Sucessor",
      "Empresa passada ao Sucessor",
      "Negócio passado ao Sucessor",
    ]);
    expect(linhas.every((l) => l.ator_id === espaco.membros.administrador.id)).toBe(true);
    // O que era de outro Membro e o que era de outro Espaço ficam como estavam.
    expect(await donoDe("contatos", ws, ids.contatoDeOutro)).toBe(espaco.membros.b.id);
    expect(await atribuicaoDe(ids.conversaDeOutro)).toEqual({ atribuido_tipo: "membro", atribuido_id: espaco.membros.b.id });
    expect(await donoDe("contatos", outroEspaco, ids.contatoDoOutroEspaco)).toBe(removido());
  });

  it("repetir a remoção de quem já saiu é sucesso do domínio, mas um Sucessor que não é Membro ativo do Espaço não recebe nada", async () => {
    const novo = await contato(espaco.workspaceId, "Chegou depois", removido());
    const resposta = await chamar(TOKENS_DE_VAZAMENTO.administrador, [removido(), "mem_que_nao_existe"]);
    expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(200);
    expect(resposta.json().ok).toBe(true);
    expect(await donoDe("contatos", espaco.workspaceId, novo)).toBe(removido());
  });
});

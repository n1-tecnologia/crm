/**
 * A ponte HTTP do Agente de lançamento (Plan 03-11, Task 2) — no molde de
 * `../persistencia/outbox-worker.test.ts`: casos PUROS (a)-(e) rodam sempre;
 * casos de REDE (f)-(m) usam `servidorFalso` (HTTP local de verdade, nunca
 * `vi.mock` de `fetch`) e também rodam sempre, injetando `hidratarEstado`
 * para não precisar de `DATABASE_URL`; casos de BANCO (n)-(o) precisam de
 * Postgres real com a migração `005` aplicada e pulam sem ele (DEC-09).
 *
 * Os casos (f) e (g) são o coração do plano: são eles que transformam "o
 * Ensaio está ligado" de promessa em asserção — zero requisições alcançam
 * `/lancar` enquanto o modo não for o literal `"lancar"`.
 */

import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildGestaoBootstrap } from "@n1/dominio/bootstrap-gestao";
import { buildSeed } from "@n1/dominio/seed";
import { CP } from "@n1/dominio/operations/financeiro";
import { createTask, setTaskFieldValue } from "@n1/dominio/operations/tasks";
import type { DataState, Id } from "@n1/dominio";
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { semear as semearEstadoInteiro } from "../persistencia/repositorio";
import { criarServidorFalso, type ServidorFalso } from "../testes/servidor-falso";
import { relogioFixo } from "../testes/relogio";
import {
  chaveDeIdempotencia,
  classificar,
  criarPonteDoAgente,
  lerCnpjPorEmpresa,
  mesclarDePara,
  resolverModo,
} from "./invocar-agente";

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;

const A7 = "aut_cp_a7";
const S = CP.status;

/** Move toda "para pagar" da Lista, exceto as citadas, para fora do jogo — isolamento de fixture, não regra de negócio. */
function isolarCandidatas(estado: DataState, manter: readonly string[]): void {
  for (const t of estado.tasks) {
    if (t.listId === CP.listId && t.statusId === S.paraPagar && !manter.includes(t.id)) {
      t.statusId = S.emLancamento;
    }
  }
}

function conta(estado: DataState, id: string) {
  const t = estado.tasks.find((x) => x.id === id);
  if (!t) throw new Error(`sem ${id}`);
  return t;
}

/* ═══════════════════════ (a)-(e) puras, sem banco e sem rede ═══════════════════════ */

describe("resolverModo (D3-03) — só o literal exato liga a caneta", () => {
  it.each([
    [undefined, "ensaio", false],
    ["", "ensaio", true],
    ["Lancar", "ensaio", true],
    ["true", "ensaio", true],
    ["0", "ensaio", true],
    ["ensaio", "ensaio", false],
    ["lancar", "lancar", false],
  ] as const)("(a) resolverModo(%o) → %s (aviso: %s)", (bruto, modoEsperado, temAviso) => {
    const { modo, aviso } = resolverModo(bruto);
    expect(modo).toBe(modoEsperado);
    expect(Boolean(aviso)).toBe(temAviso);
    if (aviso) {
      expect(aviso).toContain("AGENTE_CONTAS_A_PAGAR_MODO");
      if (bruto) expect(aviso).not.toContain(bruto);
    }
  });
});

describe("chaveDeIdempotencia — determinística, nunca Date.now()/randomUUID()", () => {
  it("(b) a mesma Tarefa produz sempre a mesma chave, no formato do contrato", () => {
    expect(chaveDeIdempotencia("tsk_cp_das")).toBe("tria:contas-a-pagar:tsk_cp_das");
    expect(chaveDeIdempotencia("tsk_cp_das")).toBe(chaveDeIdempotencia("tsk_cp_das"));
  });
});

describe("classificar — permanente vs. transitório (contrato v1 §4)", () => {
  it.each([400, 401, 403, 404, 422])("(c) HTTP %i sem envelope é permanente", (status) => {
    expect(classificar(status, undefined, undefined).permanente).toBe(true);
  });

  it("(c) 503 com retryable:false no corpo é permanente (CONFIGURACAO_AUSENTE)", () => {
    const r = classificar(503, { error: { code: "CONFIGURACAO_AUSENTE", retryable: false } }, undefined);
    expect(r.permanente).toBe(true);
    expect(r.code).toBe("CONFIGURACAO_AUSENTE");
  });

  it("(c) erro de rede / AbortError (sem status) é transitório", () => {
    expect(classificar(undefined, undefined, new DOMException("aborted", "AbortError")).permanente).toBe(false);
  });

  it.each([429, 500, 502, 503, 504])("(c) HTTP %i sem retryable declarado é transitório", (status) => {
    expect(classificar(status, undefined, undefined).permanente).toBe(false);
  });

  it("(c) 500 com retryable:true é transitório", () => {
    expect(classificar(500, { error: { retryable: true } }, undefined).permanente).toBe(false);
  });

  it("(c) status desconhecido é permanente, por segurança", () => {
    expect(classificar(418, undefined, undefined).permanente).toBe(true);
  });
});

describe("lerCnpjPorEmpresa — meia tabela é pior que nenhuma", () => {
  it("(d) JSON válido no formato de CNPJ vira mapa", () => {
    const { mapa, aviso } = lerCnpjPorEmpresa('{"Tria Company":"11.222.333/0001-81"}');
    expect(mapa).toEqual({ "Tria Company": "11.222.333/0001-81" });
    expect(aviso).toBeUndefined();
  });

  it.each([
    ["json inválido", "{not json"],
    ["não é objeto", '"uma string"'],
    ["valor não-string", '{"Tria Company": 123}'],
    ["string fora do formato", '{"Tria Company": "11222333000181"}'],
  ])("(d) %s derruba o mapa inteiro, com aviso que nomeia só a variável", (_rotulo, bruto) => {
    const { mapa, aviso } = lerCnpjPorEmpresa(bruto);
    expect(mapa).toEqual({});
    expect(aviso).toContain("AGENTE_CONTAS_A_PAGAR_CNPJ_POR_EMPRESA");
  });

  it("(d) ausente: mapa vazio, sem aviso (é o estado normal sem configuração)", () => {
    expect(lerCnpjPorEmpresa(undefined)).toEqual({ mapa: {} });
  });
});

describe("mesclarDePara — o mais conservador vence; conta divergente é erro", () => {
  it("(e) categoriaPorCampo: 'revisar' vence 'resolvida' na mesma chave", () => {
    const resultado = mesclarDePara([
      { contaPorTag: {}, categoriaPorCampo: { Impostos: { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01" } }, origem: "omie" },
      { contaPorTag: {}, categoriaPorCampo: { Impostos: { veredito: "revisar", nome: "Impostos e taxas", codigo: "2.06.01", similaridade: 0.4, motivo: "empate" } }, origem: "omie" },
    ]);
    expect("erro" in resultado).toBe(false);
    if (!("erro" in resultado)) expect(resultado.dePara.categoriaPorCampo["Impostos"]?.veredito).toBe("revisar");
  });

  it("(e) contaPorTag com a mesma Tag e contas divergentes recusa, nomeando só a Tag", () => {
    const resultado = mesclarDePara([
      { contaPorTag: { "conta tria": "TRIA" }, categoriaPorCampo: {}, origem: "omie" },
      { contaPorTag: { "conta tria": "TRIA COMPANY - ITAU" }, categoriaPorCampo: {}, origem: "omie" },
    ]);
    expect("erro" in resultado).toBe(true);
    if ("erro" in resultado) {
      expect(resultado.erro).toContain("conta tria");
      expect(resultado.erro).not.toContain("TRIA COMPANY");
    }
  });
});

/* ═══════════════════ (f)-(m) HTTP com servidorFalso — sempre rodam ═══════════════════ */

describe("criarPonteDoAgente — HTTP contra servidorFalso (sem DATABASE_URL)", () => {
  let servidor: ServidorFalso;

  afterEach(async () => {
    await servidor?.fechar();
  });

  const HOJE = new Date(2026, 7, 31, 12);

  function dePara200(categoria: string, resolucao: { readonly veredito: "resolvida" | "revisar"; readonly similaridade?: number; readonly motivo?: string }) {
    return {
      dePara: {
        contaPorTag: { "conta tria": "TRIA COMPANY - ITAU" },
        categoriaPorCampo: {
          [categoria]:
            resolucao.veredito === "resolvida"
              ? { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01", similaridade: resolucao.similaridade ?? 0.9 }
              : { veredito: "revisar", nome: "Impostos e taxas", codigo: "2.06.01", similaridade: resolucao.similaridade ?? 0.4, motivo: resolucao.motivo ?? "abaixo do corte" },
        },
        origem: "omie",
      },
    };
  }

  it("(f) Ensaio — TODAS as requisições terminam em /resolver, ZERO em /lancar", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    isolarCandidatas(estado, ["tsk_cp_das"]);
    servidor.enfileirar({ kind: "ok", status: 200, corpo: dePara200("Impostos", { veredito: "resolvida" }) });

    const ponte = criarPonteDoAgente({
      destinoUrl: servidor.url,
      token: "tok-ensaio",
      workspaceId: estado.workspace.id,
      listId: CP.listId,
      modo: "ensaio",
      relogio: relogioFixo(HOJE),
      hidratarEstado: async () => estado,
    });

    await ponte.aquecer();

    expect(servidor.recebidas.length).toBeGreaterThan(0);
    expect(servidor.recebidas.every((r) => r.caminho.endsWith("/resolver"))).toBe(true);
    expect(servidor.recebidas.filter((r) => r.caminho.endsWith("/lancar")).length).toBe(0);
  });

  it("(g) Ensaio — com AGENTE_CONTAS_A_PAGAR_MODO apagada do ambiente, continua ZERO requisições a /lancar", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    isolarCandidatas(estado, ["tsk_cp_das"]);
    servidor.enfileirar({ kind: "ok", status: 200, corpo: dePara200("Impostos", { veredito: "resolvida" }) });

    delete process.env.AGENTE_CONTAS_A_PAGAR_MODO;
    const { modo } = resolverModo(process.env.AGENTE_CONTAS_A_PAGAR_MODO);
    expect(modo).toBe("ensaio");

    const ponte = criarPonteDoAgente({
      destinoUrl: servidor.url,
      token: "tok-ensaio",
      workspaceId: estado.workspace.id,
      listId: CP.listId,
      modo,
      relogio: relogioFixo(HOJE),
      hidratarEstado: async () => estado,
    });

    await ponte.aquecer();
    expect(servidor.recebidas.filter((r) => r.caminho.endsWith("/lancar")).length).toBe(0);
  });

  /** Só `id` fica em "em lançamento omie", com tudo o que o Omie exige preenchido. */
  function prepararEmLancamento(estado: DataState, id: string, categoria: string): void {
    for (const t of estado.tasks) {
      if (t.listId !== CP.listId) continue;
      if (t.id === id) t.statusId = S.emLancamento;
      else if (t.statusId === S.emLancamento) t.statusId = S.lancado;
    }
    const t = conta(estado, id);
    const definir = (definitionId: string, value: string) => {
      const atual = t.fieldValues.find((v) => v.definitionId === definitionId);
      if (atual) Object.assign(atual, { value, state: "ativo" });
      else t.fieldValues.push({ definitionId, value, state: "ativo" } as (typeof t.fieldValues)[number]);
    };
    definir(CP.fields.categoria, categoria);
    definir(CP.fields.fornecedor, "CNPJ");
    definir(CP.fields.cnpj, "11.222.333/0001-81");
    definir(CP.fields.nomeFornecedor, "Fornecedor Teste");
  }

  /** A Unidade de Trabalho em memória: aplica a operação no estado do teste. */
  function executarEmMemoria(estado: DataState) {
    return async (operacao: (s: DataState) => { readonly ok: boolean; readonly error?: string }) => {
      const r = operacao(estado);
      return r.ok ? ({ ok: true } as const) : ({ ok: false, error: r.error ?? "recusado" } as const);
    };
  }

  it("(h) modo lancar — \"para pagar\" nunca lança; \"em lançamento omie\" resolvida chama /lancar (idempotency-key, Bearer) e vai para \"lançado omie\"; \"revisar\" não lança", async () => {
    // "para pagar": o aquecimento só resolve — nenhum /lancar.
    servidor = await criarServidorFalso();
    let estado = buildSeed();
    isolarCandidatas(estado, ["tsk_cp_das"]);
    servidor.enfileirar({ kind: "ok", status: 200, corpo: dePara200("Impostos", { veredito: "resolvida" }) });
    let ponte = criarPonteDoAgente({
      destinoUrl: servidor.url,
      token: "tok-lancar",
      workspaceId: estado.workspace.id,
      listId: CP.listId,
      modo: "lancar",
      relogio: relogioFixo(HOJE),
      hidratarEstado: async () => estado,
    });
    await ponte.aquecer();
    expect(servidor.recebidas.filter((r) => r.caminho.endsWith("/lancar"))).toHaveLength(0);

    // "em lançamento omie", categoria resolvida: lança e move.
    await servidor.fechar();
    servidor = await criarServidorFalso();
    estado = buildSeed();
    prepararEmLancamento(estado, "tsk_cp_das", "Impostos");
    servidor.enfileirar({ kind: "ok", status: 200, corpo: dePara200("Impostos", { veredito: "resolvida" }) });
    servidor.enfileirar({ kind: "ok", status: 200, corpo: { payableId: "pay_das_1", codigoLancamentoIntegracao: chaveDeIdempotencia("tsk_cp_das"), reaproveitado: false } });
    ponte = criarPonteDoAgente({
      destinoUrl: servidor.url,
      token: "tok-lancar",
      workspaceId: estado.workspace.id,
      listId: CP.listId,
      modo: "lancar",
      relogio: relogioFixo(HOJE),
      hidratarEstado: async () => estado,
      resolverAtor: async () => CP.financeiroId,
      executarOperacao: executarEmMemoria(estado),
    });
    await ponte.lancarContasEmLancamento();

    const lancamentos = servidor.recebidas.filter((r) => r.caminho.endsWith("/lancar"));
    expect(lancamentos).toHaveLength(1);
    expect(lancamentos[0]?.cabecalhos["idempotency-key"]).toBe(chaveDeIdempotencia("tsk_cp_das"));
    expect(lancamentos[0]?.cabecalhos.authorization?.startsWith("Bearer ")).toBe(true);
    const das = conta(estado, "tsk_cp_das");
    expect(das.statusId).toBe(S.lancado);
    expect(das.comments.some((c) => c.content.startsWith("📋 RESUMO DE PAGAMENTO"))).toBe(true);

    // "em lançamento omie", categoria em revisão: só /resolver, a conta fica.
    await servidor.fechar();
    servidor = await criarServidorFalso();
    estado = buildSeed();
    prepararEmLancamento(estado, "tsk_cp_trafego", "Tráfego Pago");
    servidor.enfileirar({ kind: "ok", status: 200, corpo: dePara200("Tráfego Pago", { veredito: "revisar" }) });
    ponte = criarPonteDoAgente({
      destinoUrl: servidor.url,
      token: "tok-lancar",
      workspaceId: estado.workspace.id,
      listId: CP.listId,
      modo: "lancar",
      relogio: relogioFixo(HOJE),
      hidratarEstado: async () => estado,
      resolverAtor: async () => CP.financeiroId,
      executarOperacao: executarEmMemoria(estado),
    });
    await ponte.lancarContasEmLancamento();
    expect(servidor.recebidas.every((r) => r.caminho.endsWith("/resolver"))).toBe(true);
    expect(conta(estado, "tsk_cp_trafego").statusId).toBe(S.emLancamento);
  });

  it("(i) payableId 'mock-payable-…' não é lançamento — a conta fica em \"em lançamento omie\" e o Agente avisa uma vez só", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    prepararEmLancamento(estado, "tsk_cp_das", "Impostos");
    for (let n = 0; n < 2; n += 1) {
      servidor.enfileirar({ kind: "ok", status: 200, corpo: dePara200("Impostos", { veredito: "resolvida" }) });
      servidor.enfileirar({ kind: "ok", status: 200, corpo: { payableId: "mock-payable-1730000000000", reaproveitado: false } });
    }
    const ponte = criarPonteDoAgente({
      destinoUrl: servidor.url,
      token: "tok-lancar",
      workspaceId: estado.workspace.id,
      listId: CP.listId,
      modo: "lancar",
      relogio: relogioFixo(HOJE),
      hidratarEstado: async () => estado,
      resolverAtor: async () => CP.financeiroId,
      executarOperacao: executarEmMemoria(estado),
    });
    await ponte.lancarContasEmLancamento();
    await ponte.lancarContasEmLancamento();

    const das = conta(estado, "tsk_cp_das");
    expect(das.statusId).toBe(S.emLancamento);
    expect(das.comments.filter((c) => c.content.includes("não confirmou o lançamento"))).toHaveLength(1);
  });

  it("(i2) falta Categoria ou fornecedor: nenhuma requisição, e o Agente diz o que falta", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    prepararEmLancamento(estado, "tsk_cp_das", "Impostos");
    const das = conta(estado, "tsk_cp_das");
    das.fieldValues = das.fieldValues.filter((v) => v.definitionId !== CP.fields.nomeFornecedor);
    const ponte = criarPonteDoAgente({
      destinoUrl: servidor.url,
      token: "tok-lancar",
      workspaceId: estado.workspace.id,
      listId: CP.listId,
      modo: "lancar",
      relogio: relogioFixo(HOJE),
      hidratarEstado: async () => estado,
      resolverAtor: async () => CP.financeiroId,
      executarOperacao: executarEmMemoria(estado),
    });
    await ponte.lancarContasEmLancamento();

    expect(servidor.recebidas).toHaveLength(0);
    expect(das.statusId).toBe(S.emLancamento);
    expect(das.comments.some((c) => c.content.startsWith("Não consegui lançar no Omie: falta") && c.content.includes("Nome do fornecedor"))).toBe(true);
  });

  it("(j) timeout: aborta, classifica transitório e o erro registrado passa por sanitizarErro", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    isolarCandidatas(estado, ["tsk_cp_das"]);
    servidor.enfileirar({ kind: "timeout" });

    const registrados: Array<{ nivel: string; mensagem: string; dados?: Record<string, string | number> }> = [];
    const ponte = criarPonteDoAgente({
      destinoUrl: servidor.url,
      token: "tok",
      workspaceId: estado.workspace.id,
      listId: CP.listId,
      modo: "ensaio",
      timeoutMs: 80,
      relogio: relogioFixo(HOJE),
      hidratarEstado: async () => estado,
      registrar: (nivel, mensagem, dados) => registrados.push({ nivel, mensagem, ...(dados ? { dados } : {}) }),
    });

    await ponte.aquecer();

    expect(registrados.some((r) => r.nivel === "warn")).toBe(true);
    // O corpo bruto do fetch abortado nunca chega a `registrar` — só o resumo sanitizado.
    expect(JSON.stringify(registrados)).not.toContain("Bearer tok");
  }, 10_000);

  it("(k) T-3-04 — nada entregue a registrar() contém chave Pix, código de barras, valor ou nome de fornecedor", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    isolarCandidatas(estado, ["tsk_cp_aluguel_out"]);
    servidor.enfileirar({ kind: "ok", status: 500, corpo: { error: { code: "ERRO_INTERNO", message: "falhou", retryable: true } } });

    const registrados: unknown[] = [];
    const ponte = criarPonteDoAgente({
      destinoUrl: servidor.url,
      token: "tok",
      workspaceId: estado.workspace.id,
      listId: CP.listId,
      modo: "ensaio",
      relogio: relogioFixo(HOJE),
      hidratarEstado: async () => estado,
      registrar: (nivel, mensagem, dados) => registrados.push({ nivel, mensagem, dados }),
    });
    await ponte.aquecer();

    const gravado = JSON.stringify(registrados);
    expect(gravado).not.toContain("23.456.789/0001-10"); // chave Pix/CNPJ do fornecedor
    expect(gravado).not.toContain("23793.38128"); // código de barras
    expect(gravado).not.toContain("4500"); // valor
    expect(gravado).not.toContain("Imobiliária Horizonte Azul"); // nome de fornecedor
    expect(gravado).not.toContain("Aluguel — sala 402"); // título
  });

  it("(l) D3-01 — Centro de Custo vazio não gera requisição; toda requisição emitida traz centroDeCusto não-vazio", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const t = conta(estado, "tsk_cp_das");
    t.fieldValues = t.fieldValues.filter((v) => v.definitionId !== CP.fields.centroDeCusto);
    isolarCandidatas(estado, ["tsk_cp_das"]);

    const ponte = criarPonteDoAgente({
      destinoUrl: servidor.url,
      token: "tok",
      workspaceId: estado.workspace.id,
      listId: CP.listId,
      modo: "ensaio",
      relogio: relogioFixo(HOJE),
      hidratarEstado: async () => estado,
    });
    await ponte.aquecer();
    expect(servidor.recebidas).toHaveLength(0);

    // Segunda rodada, com Centro de Custo presente: a requisição carrega o campo.
    servidor.enfileirar({ kind: "ok", status: 200, corpo: dePara200("Impostos", { veredito: "resolvida" }) });
    const estado2 = buildSeed();
    isolarCandidatas(estado2, ["tsk_cp_das"]);
    const ponte2 = criarPonteDoAgente({
      destinoUrl: servidor.url,
      token: "tok",
      workspaceId: estado2.workspace.id,
      listId: CP.listId,
      modo: "ensaio",
      relogio: relogioFixo(HOJE),
      hidratarEstado: async () => estado2,
    });
    await ponte2.aquecer();
    expect(servidor.recebidas).toHaveLength(1);
    const corpo = servidor.recebidas[0]?.corpo as { centroDeCusto?: string };
    expect(corpo.centroDeCusto).toBeTruthy();
  });

  it("(m) modo lancar sem credencial: nenhuma requisição, recusa permanente, NUNCA cai para ensaio silenciosamente", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    isolarCandidatas(estado, ["tsk_cp_das"]);

    const ponte = criarPonteDoAgente({
      destinoUrl: servidor.url,
      token: "", // credencial ausente
      workspaceId: estado.workspace.id,
      listId: CP.listId,
      modo: "lancar",
      relogio: relogioFixo(HOJE),
      hidratarEstado: async () => estado,
    });
    await ponte.aquecer();
    expect(servidor.recebidas).toHaveLength(0);

    const execucoesAntes = estado.automationExecutions.length;
    const r = ponte.rodarAgenda(estado, CP.financeiroId, CP.listId, HOJE);
    expect(r.ok).toBe(false); // recusa — nunca um Ensaio disfarçado
    expect(estado.automationExecutions.length).toBe(execucoesAntes); // nada rodou
  });
});

/* ═══════════════════════ (n)-(o) Postgres real (DEC-09) ═══════════════════════ */

const RUN = `invocaragente_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const WORKSPACE = `ws_${RUN}`;

d("criarPonteDoAgente — rodarAgenda contra Postgres real", () => {
  afterAll(async () => {
    const cliente = await pool().connect();
    try {
      await cliente.query("delete from plataforma.registros where workspace_id = $1", [WORKSPACE]);
      await cliente.query("delete from plataforma.workspaces where workspace_id = $1", [WORKSPACE]);
    } finally {
      cliente.release();
    }
    await encerrar();
  });

  it("(n) cache frio recusa e não roda a agenda; depois de aquecer(), roda com lancamento.dePara.origem === 'omie'", async () => {
    const hoje = new Date(2026, 7, 31, 12);
    const estado = buildGestaoBootstrap({ workspaceId: WORKSPACE });

    // `buildGestaoBootstrap` (fixtures: false) não tem Tarefas — cria-se uma
    // "para pagar", completa o bastante para A7 não recusar por dado faltando.
    const criacao = createTask(estado, CP.financeiroId, {
      listId: CP.listId,
      title: `Conta de teste (03-11) ${randomUUID()}`,
      statusId: CP.status.paraPagar,
      dueDate: { form: "civilDay", value: "2026-09-01" },
    });
    expect(criacao.ok, criacao.ok ? "" : criacao.error).toBe(true);
    if (!criacao.ok) return;
    const tarefa = criacao.value;
    const campos: Array<[Id, string | number]> = [
      [CP.fields.centroDeCusto, "TRIA"],
      [CP.fields.categoria, "Impostos"],
      [CP.fields.valor, 100],
      [CP.fields.forma, "Boleto"],
      [CP.fields.codigoBarras, "00000000000-0 00000000000-0 00000000000-0 00000000000-0"],
      [CP.fields.boleto, "boleto-teste.pdf"],
    ];
    for (const [definitionId, valor] of campos) {
      expect(setTaskFieldValue(estado, CP.financeiroId, tarefa.id, definitionId, valor).ok).toBe(true);
    }

    const cliente = await pool().connect();
    try {
      await cliente.query("insert into plataforma.workspaces (workspace_id) values ($1) on conflict do nothing", [WORKSPACE]);
      await semearEstadoInteiro(cliente, WORKSPACE, estado);
    } finally {
      cliente.release();
    }

    const servidor = await criarServidorFalso();
    try {
      servidor.enfileirar({
        kind: "ok",
        status: 200,
        corpo: {
          dePara: {
            contaPorTag: {},
            categoriaPorCampo: { Impostos: { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01", similaridade: 0.95 } },
            origem: "omie",
          },
        },
      });

      const ponte = criarPonteDoAgente({
        destinoUrl: servidor.url,
        token: "tok",
        workspaceId: WORKSPACE,
        listId: CP.listId,
        modo: "ensaio",
        relogio: relogioFixo(hoje),
      });

      // Cache frio: recusa, e nada roda.
      const frio = ponte.rodarAgenda(estado, CP.financeiroId, CP.listId, hoje);
      expect(frio.ok).toBe(false);
      const execucoesAntes = estado.automationExecutions.length;

      await ponte.aquecer();

      const quente = ponte.rodarAgenda(estado, CP.financeiroId, CP.listId, hoje);
      expect(quente.ok, quente.ok ? "" : quente.error).toBe(true);
      expect(estado.automationExecutions.length).toBeGreaterThan(execucoesAntes);
      const execucao = estado.agentExecutions.at(-1);
      expect(execucao?.rehearsal).toBe(true);
      expect(execucao?.steps[0]?.input).toBe("de-para ERP (omie)");
    } finally {
      await servidor.fechar();
    }
  });

  it("(o) um par (Espaço, Lista) diferente do configurado delega a runScheduledAutomations sem cache e sem recusa", async () => {
    const hoje = new Date(2026, 7, 31, 12);
    const estado = buildGestaoBootstrap({ workspaceId: WORKSPACE });
    const outraLista = "lst_nao_configurada";

    const servidor = await criarServidorFalso();
    try {
      const ponte = criarPonteDoAgente({
        destinoUrl: servidor.url,
        token: "tok",
        workspaceId: WORKSPACE,
        listId: CP.listId, // configurada para Contas a pagar
        modo: "ensaio",
        relogio: relogioFixo(hoje),
      });

      // Uma Lista qualquer que a Automação não conhece: o domínio recusa por
      // "Lista não encontrada", MAS a ponte delega — não trata como cache
      // frio, e não emite requisição nenhuma.
      const r = ponte.rodarAgenda(estado, CP.financeiroId, outraLista, hoje);
      expect(r.ok).toBe(false);
      if (!r.ok && !("conflito" in r)) expect(r.error).toContain("Lista não encontrada");
      expect(servidor.recebidas).toHaveLength(0);
    } finally {
      await servidor.fechar();
    }
  });
});

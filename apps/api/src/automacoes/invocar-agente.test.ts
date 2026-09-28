/**
 * A ponte HTTP do Agente de lançamento (Plan 03-11; plano pós-auditoria 1.4 e
 * 1.5) — no molde de `../persistencia/outbox-worker.test.ts`: casos PUROS
 * rodam sempre; casos de REDE usam `servidorFalso` (HTTP local de verdade,
 * nunca `vi.mock` de `fetch`) e também rodam sempre, injetando
 * `hidratarEstado`, `resolverAtor` e `executarOperacao` em memória — nenhum
 * caso deste arquivo precisa de `DATABASE_URL`.
 *
 * O que o plano pós-auditoria (1.4) acrescentou, e onde cada item é provado:
 *   (a) prazo por chamada, 10 s em `/resolver` e 60 s em `/lancar` — "prazos";
 *   (b) erro permanente comenta `details.motivo` e `code`, uma vez — "recusa permanente";
 *   (c) três falhas transitórias seguidas: um aviso e a conta para — "transitórias";
 *   (d) conta recusada não é reprocessada até a impressão mudar; sair do
 *       Status apaga o estado — "uma vez só";
 *   (e) só lança o que ENTROU em "em lançamento omie" por movimento — "entrouPorMovimento" e "nasceu";
 *   (f) sem aquecer: nada chama o Omie para "para pagar", e `rodarAgenda` faz
 *       A7 legada falhar sem de-para — "rodarAgenda";
 *   (g) ensaio só chama `/resolver` e registra — "ensaio";
 *   (h) `erpMissingFields` do domínio decide o que falta — "faltantes".
 */

import { afterEach, describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { CP, INVOCADOR_DO_LANCAMENTO } from "@n1/dominio/operations/financeiro";
import { importarContaAPagarHistorica } from "@n1/dominio/operations/importacao-contas-a-pagar";
import { changeTaskStatus } from "@n1/dominio/operations/tasks";
import type { Automation, DataState, Task } from "@n1/dominio";
import { criarServidorFalso, type ServidorFalso } from "../testes/servidor-falso";
import {
  TEXTO_NASCEU_EM_LANCAMENTO,
  TENTATIVAS_TRANSITORIAS,
  TIMEOUT_LANCAR_MS,
  TIMEOUT_RESOLVER_MS,
  chaveDeIdempotencia,
  classificar,
  criarPonteDoAgente,
  entrouPorMovimento,
  lerCnpjPorEmpresa,
  motivoDoEnvelope,
  resolverModo,
  textoDaRecusaPermanente,
  textoDasTransitorias,
  type OpcoesDaPonte,
} from "./invocar-agente";

const S = CP.status;
const F = CP.fields;
const MARYANE = CP.financeiroId;
const RESOLVER = "/v1/integrations/contas-a-pagar/resolver";
const LANCAR = "/v1/integrations/contas-a-pagar/lancar";

function conta(estado: DataState, id: string): Task {
  const t = estado.tasks.find((x) => x.id === id);
  if (!t) throw new Error(`sem ${id}`);
  return t;
}

function definir(task: Task, definitionId: string, value: string): void {
  task.fieldValues = task.fieldValues.filter((v) => v.definitionId !== definitionId);
  task.fieldValues.push({ definitionId, value, state: "ativo" });
}

/**
 * Só `id` fica em "em lançamento omie" (as outras contas do seed nesse Status
 * saem do jogo — isolamento de fixture, não regra) e ela ENTRA lá por
 * movimento: `changeTaskStatus` da Maryane, que confere as exigências de
 * saída de "para pagar" — o caminho real que a ponte espera.
 */
function prepararEmLancamento(estado: DataState, id: string, categoria: string): Task {
  for (const t of estado.tasks) {
    if (t.listId === CP.listId && t.id !== id && t.statusId === S.emLancamento) t.statusId = S.lancado;
  }
  const t = conta(estado, id);
  definir(t, F.categoria, categoria);
  expect(t.statusId).toBe(S.paraPagar);
  const movida = changeTaskStatus(estado, MARYANE, t.id, S.emLancamento);
  if (!movida.ok) throw new Error(movida.error);
  return t;
}

/** Sai e volta para "em lançamento omie", por movimento — o gesto que pede nova tentativa. */
function sairEVoltar(estado: DataState, id: string): void {
  const saiu = changeTaskStatus(estado, MARYANE, id, S.paraPagar);
  if (!saiu.ok) throw new Error(saiu.error);
  const voltou = changeTaskStatus(estado, MARYANE, id, S.emLancamento);
  if (!voltou.ok) throw new Error(voltou.error);
}

/** A Unidade de Trabalho em memória: aplica a operação no estado do teste. */
function executarEmMemoria(estado: DataState) {
  return async (operacao: (s: DataState) => { readonly ok: boolean; readonly error?: string }) => {
    const r = operacao(estado);
    return r.ok ? ({ ok: true } as const) : ({ ok: false, error: r.error ?? "recusado" } as const);
  };
}

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

const LANCADO_200 = { kind: "ok", status: 200, corpo: { payableId: "pay_das_1", codigoLancamentoIntegracao: chaveDeIdempotencia("tsk_cp_das"), reaproveitado: false } } as const;

function erro422(code: string, motivo?: string, message = "A plataforma recusou o lançamento.") {
  return {
    kind: "ok",
    status: 422,
    corpo: { error: { code, message, requestId: "req_1", retryable: false, ...(motivo !== undefined ? { details: { motivo } } : {}) } },
  } as const;
}

function erro503(code = "OMIE_INDISPONIVEL") {
  return { kind: "ok", status: 503, corpo: { error: { code, message: "Tente de novo.", requestId: "req_2", retryable: true } } } as const;
}

const comentariosDoAgente = (t: Task) => t.comments.filter((c) => c.author.kind === "agent" && c.author.id === CP.agentId);

/* ═══════════════════════ puras, sem banco e sem rede ═══════════════════════ */

describe("resolverModo (D3-03) — só o literal exato liga a caneta", () => {
  it.each([
    [undefined, "ensaio", false],
    ["", "ensaio", true],
    ["Lancar", "ensaio", true],
    ["true", "ensaio", true],
    ["0", "ensaio", true],
    ["ensaio", "ensaio", false],
    ["lancar", "lancar", false],
  ] as const)("resolverModo(%o) → %s (aviso: %s)", (bruto, modoEsperado, temAviso) => {
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
  it("a mesma Tarefa produz sempre a mesma chave, no formato do contrato", () => {
    expect(chaveDeIdempotencia("tsk_cp_das")).toBe("tria:contas-a-pagar:tsk_cp_das");
    expect(chaveDeIdempotencia("tsk_cp_das")).toBe(chaveDeIdempotencia("tsk_cp_das"));
  });
});

describe("classificar — permanente vs. transitório (contrato v1 §4)", () => {
  it.each([400, 401, 403, 404, 422])("HTTP %i sem envelope é permanente", (status) => {
    expect(classificar(status, undefined, undefined).permanente).toBe(true);
  });

  it("503 com retryable:false no corpo é permanente (CONFIGURACAO_AUSENTE)", () => {
    const r = classificar(503, { error: { code: "CONFIGURACAO_AUSENTE", retryable: false } }, undefined);
    expect(r.permanente).toBe(true);
    expect(r.code).toBe("CONFIGURACAO_AUSENTE");
  });

  it("422 do automation/ novo (FORNECEDOR_NAO_RESOLVIDO, OMIE_RECUSOU, CONTA_CORRENTE_NAO_RESOLVIDA) é permanente, com o code do envelope", () => {
    for (const code of ["FORNECEDOR_NAO_RESOLVIDO", "OMIE_RECUSOU", "CONTA_CORRENTE_NAO_RESOLVIDA"]) {
      expect(classificar(422, erro422(code, "x").corpo, undefined)).toEqual({ permanente: true, code });
    }
  });

  it("erro de rede / AbortError (sem status) é transitório", () => {
    expect(classificar(undefined, undefined, new DOMException("aborted", "AbortError")).permanente).toBe(false);
  });

  it.each([429, 500, 502, 503, 504])("HTTP %i sem retryable declarado é transitório", (status) => {
    expect(classificar(status, undefined, undefined).permanente).toBe(false);
  });

  it("500/503 com retryable:true é transitório", () => {
    expect(classificar(500, { error: { retryable: true } }, undefined).permanente).toBe(false);
    expect(classificar(503, erro503().corpo, undefined)).toEqual({ permanente: false, code: "OMIE_INDISPONIVEL" });
  });

  it("status desconhecido é permanente, por segurança", () => {
    expect(classificar(418, undefined, undefined).permanente).toBe(true);
  });
});

describe("motivoDoEnvelope — o texto legível do erro permanente (1.4, b)", () => {
  it("prefere error.details.motivo; sem ele, a message fixa; sem os dois, nada", () => {
    expect(motivoDoEnvelope(erro422("OMIE_RECUSOU", "Fornecedor bloqueado no Omie.").corpo)).toBe("Fornecedor bloqueado no Omie.");
    expect(motivoDoEnvelope(erro422("CONFIGURACAO_AUSENTE").corpo)).toBe("A plataforma recusou o lançamento.");
    expect(motivoDoEnvelope({ error: { code: "X" } })).toBeUndefined();
    expect(motivoDoEnvelope(undefined)).toBeUndefined();
    expect(motivoDoEnvelope("texto solto")).toBeUndefined();
  });

  it("junta linhas e espaços e corta no teto de 300 caracteres do contrato", () => {
    expect(motivoDoEnvelope(erro422("OMIE_RECUSOU", "  linha 1\n\n  linha 2  ").corpo)).toBe("linha 1 linha 2");
    const longo = motivoDoEnvelope(erro422("OMIE_RECUSOU", "a".repeat(500)).corpo) ?? "";
    expect(longo.length).toBe(300);
    expect(longo.endsWith("…")).toBe(true);
  });

  it("os textos fixos do plano", () => {
    expect(textoDaRecusaPermanente("Fornecedor não encontrado no Omie", "FORNECEDOR_NAO_RESOLVIDO")).toBe(
      "Não consegui lançar no Omie: Fornecedor não encontrado no Omie (FORNECEDOR_NAO_RESOLVIDO).",
    );
    expect(textoDasTransitorias("OMIE_INDISPONIVEL")).toBe(
      'O Omie não respondeu depois de 3 tentativas (OMIE_INDISPONIVEL). Tento de novo quando algum Campo da conta mudar ou ela sair e voltar para "em lançamento omie".',
    );
  });
});

describe("prazos e limites padrão (1.4, a e c)", () => {
  it("/resolver 10 s, /lancar 60 s, três tentativas transitórias", () => {
    expect(TIMEOUT_RESOLVER_MS).toBe(10_000);
    expect(TIMEOUT_LANCAR_MS).toBe(60_000);
    expect(TENTATIVAS_TRANSITORIAS).toBe(3);
  });
});

describe("lerCnpjPorEmpresa — meia tabela é pior que nenhuma", () => {
  it("JSON válido no formato de CNPJ vira mapa", () => {
    const { mapa, aviso } = lerCnpjPorEmpresa('{"Tria Company":"11.222.333/0001-81"}');
    expect(mapa).toEqual({ "Tria Company": "11.222.333/0001-81" });
    expect(aviso).toBeUndefined();
  });

  it.each([
    ["json inválido", "{not json"],
    ["não é objeto", '"uma string"'],
    ["valor não-string", '{"Tria Company": 123}'],
    ["string fora do formato", '{"Tria Company": "11222333000181"}'],
  ])("%s derruba o mapa inteiro, com aviso que nomeia só a variável", (_rotulo, bruto) => {
    const { mapa, aviso } = lerCnpjPorEmpresa(bruto);
    expect(mapa).toEqual({});
    expect(aviso).toContain("AGENTE_CONTAS_A_PAGAR_CNPJ_POR_EMPRESA");
  });

  it("ausente: mapa vazio, sem aviso (é o estado normal sem configuração)", () => {
    expect(lerCnpjPorEmpresa(undefined)).toEqual({ mapa: {} });
  });
});

/** Uma conta importada do ClickUp que termina em "em lançamento omie" — como `contas-a-pagar:importar` grava. */
function importarEmLancamento(estado: DataState): Task {
  const r = importarContaAPagarHistorica(estado, MARYANE, {
    legacyTaskId: "868legado1",
    titulo: "Conta importada do ClickUp",
    statusFinalId: S.emLancamento,
    criadaEm: "2026-08-01T12:00:00.000Z",
    vencimento: { form: "civilDay", value: "2026-10-10" },
    transicoes: [
      { em: "2026-08-01T12:00:00.000Z", statusId: S.paraPagar, nomeLegado: "para pagar" },
      { em: "2026-08-20T12:00:00.000Z", statusId: S.emLancamento, nomeLegado: "em lançamento omie" },
    ],
    campos: {
      [F.centroDeCusto]: "TRIA",
      [F.categoria]: "Impostos",
      [F.valor]: 10,
      [F.forma]: "Chave Pix",
      [F.chavePix]: "financeiro@exemplo.com.br",
      [F.fornecedor]: "CNPJ",
      [F.cnpj]: "11.222.333/0001-81",
      [F.nomeFornecedor]: "Receita Federal do Brasil",
    },
    tags: ["tag_cp_1"],
    lacunas: [],
  });
  if (!r.ok) throw new Error(r.error);
  // A importação aconteceu ANTES de hoje (como em ws_n1): o instante da
  // proveniência fica no passado, para que um movimento feito no teste seja
  // inequivocamente posterior a ela.
  const indice = estado.tasks.findIndex((t) => t.id === r.value.id);
  const importada = estado.tasks[indice]!;
  estado.tasks[indice] = { ...importada, provenance: { ...importada.provenance!, at: "2026-09-01T00:00:00.000Z" } };
  return estado.tasks[indice]!;
}

describe("entrouPorMovimento (1.4, e) — só o que entrou por movimento é lançado", () => {
  it("movida por changeTaskStatus: entrou", () => {
    const estado = buildSeed();
    const t = prepararEmLancamento(estado, "tsk_cp_das", "Impostos");
    expect(entrouPorMovimento(estado, t)).toBe(true);
  });

  it("posta no Status sem Registro (o que o seed faz com as contas de fixture): não entrou", () => {
    const estado = buildSeed();
    const t = conta(estado, "tsk_cp_das");
    t.statusId = S.emLancamento;
    expect(entrouPorMovimento(estado, t)).toBe(false);
  });

  it("importada do ClickUp já em \"em lançamento omie\": não entrou — mesmo com o Registro \"Status alterado\" do histórico", () => {
    const estado = buildSeed();
    const t = importarEmLancamento(estado);
    expect(t.statusId).toBe(S.emLancamento);
    const historico = estado.activity.filter((a) => a.objectId === t.id && a.action === "Status alterado");
    expect(historico.some((a) => a.after === "em lançamento omie")).toBe(true); // a armadilha: o Registro existe
    expect(entrouPorMovimento(estado, t)).toBe(false);
  });

  it("importada e depois movida para \"para pagar\" e de volta: entrou", () => {
    const estado = buildSeed();
    const t = importarEmLancamento(estado);
    sairEVoltar(estado, t.id);
    expect(entrouPorMovimento(estado, conta(estado, t.id))).toBe(true);
  });

  it("fora de \"em lançamento omie\" nunca conta como entrada", () => {
    const estado = buildSeed();
    expect(entrouPorMovimento(estado, conta(estado, "tsk_cp_das"))).toBe(false);
  });
});

/* ═══════════════════ HTTP com servidorFalso — sempre rodam ═══════════════════ */

describe("criarPonteDoAgente — contra servidorFalso (sem DATABASE_URL)", () => {
  let servidor: ServidorFalso;

  afterEach(async () => {
    await servidor?.fechar();
  });

  function ponteSobre(estado: DataState, extra: Partial<OpcoesDaPonte> = {}) {
    return criarPonteDoAgente({
      destinoUrl: servidor.url,
      token: "tok-lancar",
      workspaceId: estado.workspace.id,
      listId: CP.listId,
      modo: "lancar",
      hidratarEstado: async () => estado,
      resolverAtor: async () => MARYANE,
      executarOperacao: executarEmMemoria(estado),
      ...extra,
    });
  }

  describe("ensaio (1.4, g) — só /resolver, só registro", () => {
    it("chama só /resolver, registra o que lançaria, não escreve nada na conta e não repete na volta seguinte", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = prepararEmLancamento(estado, "tsk_cp_das", "Impostos");
      servidor.enfileirar({ kind: "ok", status: 200, corpo: dePara200("Impostos", { veredito: "resolvida" }) });
      const registrados: string[] = [];
      const ponte = ponteSobre(estado, {
        modo: "ensaio",
        registrar: (_nivel, mensagem) => registrados.push(mensagem),
        // O ensaio nunca grava: se pedir o Ator, o teste quebra.
        resolverAtor: async () => {
          throw new Error("o ensaio não deveria resolver o Ator");
        },
      });
      const comentarios = das.comments.length;

      await ponte.lancarContasEmLancamento();
      await ponte.lancarContasEmLancamento();

      expect(servidor.recebidas.map((r) => r.caminho)).toEqual([RESOLVER]);
      expect(registrados.some((m) => m.startsWith("Ensaio — lançaria: TRIA COMPANY - ITAU · Impostos e taxas (2.06.01)"))).toBe(true);
      expect(das.comments.length).toBe(comentarios);
      expect(das.statusId).toBe(S.emLancamento);
    });

    it("com AGENTE_CONTAS_A_PAGAR_MODO apagada do ambiente, continua ZERO requisições a /lancar", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      prepararEmLancamento(estado, "tsk_cp_das", "Impostos");
      servidor.enfileirar({ kind: "ok", status: 200, corpo: dePara200("Impostos", { veredito: "resolvida" }) });

      delete process.env.AGENTE_CONTAS_A_PAGAR_MODO;
      const { modo } = resolverModo(process.env.AGENTE_CONTAS_A_PAGAR_MODO);
      expect(modo).toBe("ensaio");

      await ponteSobre(estado, { modo }).lancarContasEmLancamento();
      expect(servidor.recebidas.filter((r) => r.caminho === LANCAR)).toHaveLength(0);
    });

    it("em ensaio, a conta que falta dado só é registrada — nenhum Comentário", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = prepararEmLancamento(estado, "tsk_cp_das", "Impostos");
      das.fieldValues = das.fieldValues.filter((v) => v.definitionId !== F.nomeFornecedor);
      const registrados: string[] = [];
      await ponteSobre(estado, { modo: "ensaio", registrar: (_n, m) => registrados.push(m) }).lancarContasEmLancamento();
      expect(servidor.recebidas).toHaveLength(0);
      expect(comentariosDoAgente(das)).toHaveLength(0);
      expect(registrados.some((m) => m.startsWith("Ensaio — não lançaria"))).toBe(true);
    });
  });

  describe("lançar (modo lancar)", () => {
    it("\"para pagar\" não gera requisição nenhuma — nem /resolver (1.4, f: sem aquecer)", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      for (const t of estado.tasks) if (t.listId === CP.listId && t.statusId === S.emLancamento) t.statusId = S.lancado;
      expect(estado.tasks.some((t) => t.listId === CP.listId && t.statusId === S.paraPagar)).toBe(true);
      await ponteSobre(estado).lancarContasEmLancamento();
      expect(servidor.recebidas).toHaveLength(0);
    });

    it("resolvida: /resolver e /lancar (Idempotency-Key, Bearer), Resumo publicado e a conta vai para \"lançado omie\"", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = prepararEmLancamento(estado, "tsk_cp_das", "Impostos");
      servidor.enfileirar({ kind: "ok", status: 200, corpo: dePara200("Impostos", { veredito: "resolvida" }) });
      servidor.enfileirar(LANCADO_200);

      await ponteSobre(estado).lancarContasEmLancamento();

      expect(servidor.recebidas.map((r) => r.caminho)).toEqual([RESOLVER, LANCAR]);
      const lancamento = servidor.recebidas[1];
      expect(lancamento?.cabecalhos["idempotency-key"]).toBe(chaveDeIdempotencia("tsk_cp_das"));
      expect(lancamento?.cabecalhos.authorization).toBe("Bearer tok-lancar");
      const corpo = lancamento?.corpo as { fornecedor?: { tipo?: string; documento?: string; nome?: string }; valorCentavos?: number };
      expect(corpo.fornecedor).toEqual({ tipo: "CNPJ", documento: "11.222.333/0001-81", nome: "Receita Federal do Brasil" });
      expect(corpo.valorCentavos).toBe(6626750);
      expect(das.statusId).toBe(S.lancado);
      expect(das.comments.some((c) => c.content.startsWith("📋 RESUMO DE PAGAMENTO"))).toBe(true);
      const execucao = estado.agentExecutions.filter((e) => e.anchor?.id === das.id).at(-1);
      expect(execucao?.invokedBy).toEqual({ kind: "automation", id: INVOCADOR_DO_LANCAMENTO });
    });

    it("categoria em revisão: só /resolver, a conta fica, o Agente comenta para o Financeiro — e não pergunta de novo", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const trafego = prepararEmLancamento(estado, "tsk_cp_trafego", "Tráfego Pago");
      servidor.enfileirar({ kind: "ok", status: 200, corpo: dePara200("Tráfego Pago", { veredito: "revisar" }) });
      const ponte = ponteSobre(estado);

      await ponte.lancarContasEmLancamento();
      await ponte.lancarContasEmLancamento();

      expect(servidor.recebidas.map((r) => r.caminho)).toEqual([RESOLVER]);
      expect(trafego.statusId).toBe(S.emLancamento);
      const pedidos = comentariosDoAgente(trafego).filter((c) => c.content.startsWith("Não lancei no Omie"));
      expect(pedidos).toHaveLength(1);
      expect(pedidos[0]?.mentions).toEqual([{ type: "member", id: CP.financeiroId }]);
    });

    it("payableId 'mock-payable-…' não é lançamento: a conta fica, o Agente avisa uma vez e o Omie não é chamado de novo", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = prepararEmLancamento(estado, "tsk_cp_das", "Impostos");
      servidor.enfileirar({ kind: "ok", status: 200, corpo: dePara200("Impostos", { veredito: "resolvida" }) });
      servidor.enfileirar({ kind: "ok", status: 200, corpo: { payableId: "mock-payable-1730000000000", reaproveitado: false } });
      const ponte = ponteSobre(estado);

      await ponte.lancarContasEmLancamento();
      await ponte.lancarContasEmLancamento();

      expect(servidor.recebidas.map((r) => r.caminho)).toEqual([RESOLVER, LANCAR]);
      expect(das.statusId).toBe(S.emLancamento);
      expect(das.comments.filter((c) => c.content.includes("não confirmou o lançamento"))).toHaveLength(1);
    });
  });

  describe("faltantes (1.4, h) — erpMissingFields do domínio decide", () => {
    it("falta Nome do fornecedor: nenhuma requisição, o Agente diz o que falta, uma vez", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = prepararEmLancamento(estado, "tsk_cp_das", "Impostos");
      // Apagado DEPOIS de entrar (a saída de "para pagar" já não deixaria entrar sem ele).
      das.fieldValues = das.fieldValues.filter((v) => v.definitionId !== F.nomeFornecedor);
      const ponte = ponteSobre(estado);

      await ponte.lancarContasEmLancamento();
      await ponte.lancarContasEmLancamento();

      expect(servidor.recebidas).toHaveLength(0);
      expect(das.statusId).toBe(S.emLancamento);
      const pedidos = comentariosDoAgente(das).filter((c) => c.content.startsWith("Não consegui lançar no Omie: falta"));
      expect(pedidos).toHaveLength(1);
      expect(pedidos[0]?.content).toContain("Nome do fornecedor");
      expect(pedidos[0]?.mentions).toEqual([{ type: "member", id: CP.financeiroId }]);
    });

    it("D3-01 — sem Centro de Custo: nenhuma requisição nasce, e o pedido nomeia o Campo", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = prepararEmLancamento(estado, "tsk_cp_das", "Impostos");
      das.fieldValues = das.fieldValues.filter((v) => v.definitionId !== F.centroDeCusto);
      await ponteSobre(estado).lancarContasEmLancamento();
      expect(servidor.recebidas).toHaveLength(0);
      expect(comentariosDoAgente(das).some((c) => c.content.includes("Centro de Custo"))).toBe(true);
    });

    it("Integração manual: o Agente não lança nem comenta", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = prepararEmLancamento(estado, "tsk_cp_das", "Impostos");
      definir(das, F.integracaoManual, "Manual");
      await ponteSobre(estado).lancarContasEmLancamento();
      expect(servidor.recebidas).toHaveLength(0);
      expect(comentariosDoAgente(das)).toHaveLength(0);
    });
  });

  describe("recusa permanente (1.4, b e d)", () => {
    it("422 com details.motivo: comenta \"Não consegui lançar no Omie: <motivo> (<code>).\" uma vez; nenhuma chamada nova até um Campo mudar", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = prepararEmLancamento(estado, "tsk_cp_das", "Impostos");
      servidor.enfileirar({ kind: "ok", status: 200, corpo: dePara200("Impostos", { veredito: "resolvida" }) });
      servidor.enfileirar(erro422("FORNECEDOR_NAO_RESOLVIDO", "O CNPJ 11.222.333/0001-81 não existe na Receita."));
      const ponte = ponteSobre(estado);

      await ponte.lancarContasEmLancamento();
      await ponte.lancarContasEmLancamento();
      await ponte.lancarContasEmLancamento();

      expect(servidor.recebidas.map((r) => r.caminho)).toEqual([RESOLVER, LANCAR]);
      const recusas = comentariosDoAgente(das).filter((c) => c.content.startsWith("Não consegui lançar no Omie"));
      expect(recusas.map((c) => c.content)).toEqual([
        "Não consegui lançar no Omie: O CNPJ 11.222.333/0001-81 não existe na Receita. (FORNECEDOR_NAO_RESOLVIDO).",
      ]);
      expect(das.statusId).toBe(S.emLancamento);

      // Corrigido um Campo, a impressão muda: tenta de novo — e desta vez lança.
      definir(das, F.cnpj, "11.222.333/0001-82");
      servidor.enfileirar({ kind: "ok", status: 200, corpo: dePara200("Impostos", { veredito: "resolvida" }) });
      servidor.enfileirar(LANCADO_200);
      await ponte.lancarContasEmLancamento();
      expect(servidor.recebidas.map((r) => r.caminho)).toEqual([RESOLVER, LANCAR, RESOLVER, LANCAR]);
      expect(das.statusId).toBe(S.lancado);
    });

    it("recusa permanente já no /resolver também comenta e para: sem /lancar", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = prepararEmLancamento(estado, "tsk_cp_das", "Impostos");
      servidor.enfileirar(erro422("CONTA_CORRENTE_NAO_RESOLVIDA", "Nenhuma conta corrente do Omie casa com \"TRIA\"."));
      const ponte = ponteSobre(estado);
      await ponte.lancarContasEmLancamento();
      await ponte.lancarContasEmLancamento();
      expect(servidor.recebidas.map((r) => r.caminho)).toEqual([RESOLVER]);
      expect(comentariosDoAgente(das).map((c) => c.content)).toEqual([
        'Não consegui lançar no Omie: Nenhuma conta corrente do Omie casa com "TRIA". (CONTA_CORRENTE_NAO_RESOLVIDA).',
      ]);
    });

    it("sem details.motivo, o texto usa a message fixa do envelope; sem nada, diz que o Financeiro recusou", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = prepararEmLancamento(estado, "tsk_cp_das", "Impostos");
      servidor.enfileirar({ kind: "ok", status: 503, corpo: { error: { code: "CONFIGURACAO_AUSENTE", message: "Credencial Omie ausente.", retryable: false } } });
      await ponteSobre(estado).lancarContasEmLancamento();
      expect(comentariosDoAgente(das).map((c) => c.content)).toEqual(["Não consegui lançar no Omie: Credencial Omie ausente. (CONFIGURACAO_AUSENTE)."]);

      await servidor.fechar();
      servidor = await criarServidorFalso();
      const outro = buildSeed();
      const das2 = prepararEmLancamento(outro, "tsk_cp_das", "Impostos");
      servidor.enfileirar({ kind: "ok", status: 404 });
      await ponteSobre(outro).lancarContasEmLancamento();
      expect(comentariosDoAgente(das2).map((c) => c.content)).toEqual([textoDaRecusaPermanente(undefined, "HTTP_404")]);
    });

    it("sair de \"em lançamento omie\" apaga o estado: sair e voltar reprocessa — com ou sem um ciclo no meio", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = prepararEmLancamento(estado, "tsk_cp_das", "Impostos");
      const ponte = ponteSobre(estado);

      // 1ª: recusa permanente, a conta para.
      servidor.enfileirar(erro422("OMIE_RECUSOU", "Título duplicado no Omie."));
      await ponte.lancarContasEmLancamento();
      expect(servidor.recebidas).toHaveLength(1);

      // Sai, a ponte vê a saída (um ciclo com ela fora), volta: tenta de novo.
      expect(changeTaskStatus(estado, MARYANE, das.id, S.paraPagar).ok).toBe(true);
      await ponte.lancarContasEmLancamento();
      expect(servidor.recebidas).toHaveLength(1);
      expect(changeTaskStatus(estado, MARYANE, das.id, S.emLancamento).ok).toBe(true);
      servidor.enfileirar(erro422("OMIE_RECUSOU", "Título duplicado no Omie."));
      await ponte.lancarContasEmLancamento();
      expect(servidor.recebidas).toHaveLength(2);

      // Sai e volta ENTRE dois ciclos (a ponte nunca a vê fora): a volta é impressão nova, tenta de novo.
      sairEVoltar(estado, das.id);
      servidor.enfileirar(erro422("OMIE_RECUSOU", "Título duplicado no Omie."));
      await ponte.lancarContasEmLancamento();
      expect(servidor.recebidas).toHaveLength(3);
    });

    it("a publicação recusada depois do lançamento confirmado vira aviso — e o Omie não é chamado de novo", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = prepararEmLancamento(estado, "tsk_cp_das", "Impostos");
      servidor.enfileirar({ kind: "ok", status: 200, corpo: dePara200("Impostos", { veredito: "resolvida" }) });
      servidor.enfileirar(LANCADO_200);
      let transacoes = 0;
      const ponte = ponteSobre(estado, {
        executarOperacao: async (operacao) => {
          transacoes += 1;
          // A transação do lançamento (a primeira) é recusada; o Comentário de aviso passa.
          if (transacoes === 1) return { ok: false, error: "Quem invoca não alcança a Tarefa." };
          return executarEmMemoria(estado)(operacao);
        },
      });

      await ponte.lancarContasEmLancamento();
      await ponte.lancarContasEmLancamento();

      expect(servidor.recebidas.map((r) => r.caminho)).toEqual([RESOLVER, LANCAR]);
      expect(das.statusId).toBe(S.emLancamento);
      const aviso = comentariosDoAgente(das).filter((c) => c.content.startsWith("O Omie confirmou o lançamento"));
      expect(aviso).toHaveLength(1);
      expect(aviso[0]?.content).toContain("Quem invoca não alcança a Tarefa.");
    });
  });

  describe("transitórias (1.4, c)", () => {
    it("na 3ª falha transitória seguida, um aviso só; a partir daí, nenhuma chamada até a impressão mudar", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = prepararEmLancamento(estado, "tsk_cp_das", "Impostos");
      for (let n = 0; n < TENTATIVAS_TRANSITORIAS; n += 1) servidor.enfileirar(erro503());
      const ponte = ponteSobre(estado);

      for (let n = 0; n < TENTATIVAS_TRANSITORIAS; n += 1) {
        await ponte.lancarContasEmLancamento();
        // Antes da terceira, nenhum Comentário: falha transitória não é recusa.
        if (n < TENTATIVAS_TRANSITORIAS - 1) expect(comentariosDoAgente(das)).toHaveLength(0);
      }
      await ponte.lancarContasEmLancamento();
      await ponte.lancarContasEmLancamento();

      expect(servidor.recebidas.map((r) => r.caminho)).toEqual([RESOLVER, RESOLVER, RESOLVER]);
      expect(comentariosDoAgente(das).map((c) => c.content)).toEqual([textoDasTransitorias("OMIE_INDISPONIVEL")]);
      expect(das.statusId).toBe(S.emLancamento);
    });

    it("duas falhas e depois sucesso: lança, sem aviso nenhum", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = prepararEmLancamento(estado, "tsk_cp_das", "Impostos");
      servidor.enfileirar(erro503());
      servidor.enfileirar({ kind: "ok", status: 200, corpo: dePara200("Impostos", { veredito: "resolvida" }) });
      servidor.enfileirar({ kind: "ok", status: 500, corpo: { error: { code: "ERRO_INTERNO", retryable: true } } });
      servidor.enfileirar({ kind: "ok", status: 200, corpo: dePara200("Impostos", { veredito: "resolvida" }) });
      servidor.enfileirar(LANCADO_200);
      const ponte = ponteSobre(estado);

      await ponte.lancarContasEmLancamento();
      await ponte.lancarContasEmLancamento();
      await ponte.lancarContasEmLancamento();

      expect(servidor.recebidas.map((r) => r.caminho)).toEqual([RESOLVER, RESOLVER, LANCAR, RESOLVER, LANCAR]);
      expect(das.statusId).toBe(S.lancado);
      expect(comentariosDoAgente(das).some((c) => c.content.startsWith("O Omie não respondeu"))).toBe(false);
    });
  });

  describe("prazos (1.4, a) — cada chamada com o seu", () => {
    it("/lancar lento dentro do seu prazo lança, mesmo com o prazo de /resolver curto", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = prepararEmLancamento(estado, "tsk_cp_das", "Impostos");
      servidor.enfileirar({ kind: "ok", status: 200, corpo: dePara200("Impostos", { veredito: "resolvida" }) });
      servidor.enfileirar({ kind: "atraso", ms: 250, status: 200, corpo: LANCADO_200.corpo });
      await ponteSobre(estado, { timeoutResolverMs: 100, timeoutLancarMs: 5_000 }).lancarContasEmLancamento();
      expect(das.statusId).toBe(S.lancado);
    }, 10_000);

    it("/lancar além do seu prazo aborta e conta como falha transitória (sem aviso na primeira)", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = prepararEmLancamento(estado, "tsk_cp_das", "Impostos");
      servidor.enfileirar({ kind: "ok", status: 200, corpo: dePara200("Impostos", { veredito: "resolvida" }) });
      servidor.enfileirar({ kind: "atraso", ms: 2_000, status: 200, corpo: LANCADO_200.corpo });
      const registrados: Array<{ nivel: string; dados?: Record<string, string | number> }> = [];
      await ponteSobre(estado, {
        timeoutResolverMs: 5_000,
        timeoutLancarMs: 100,
        registrar: (nivel, _m, dados) => registrados.push({ nivel, ...(dados ? { dados } : {}) }),
      }).lancarContasEmLancamento();
      expect(das.statusId).toBe(S.emLancamento);
      expect(comentariosDoAgente(das)).toHaveLength(0);
      expect(registrados.some((r) => r.nivel === "warn")).toBe(true);
    }, 10_000);

    it("/resolver que não responde aborta no prazo dele, e o que chega ao log passou por sanitizarErro", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      prepararEmLancamento(estado, "tsk_cp_das", "Impostos");
      servidor.enfileirar({ kind: "timeout" });
      const registrados: Array<{ nivel: string; mensagem: string; dados?: Record<string, string | number> }> = [];
      await ponteSobre(estado, {
        timeoutResolverMs: 80,
        registrar: (nivel, mensagem, dados) => registrados.push({ nivel, mensagem, ...(dados ? { dados } : {}) }),
      }).lancarContasEmLancamento();
      expect(registrados.some((r) => r.nivel === "warn")).toBe(true);
      expect(JSON.stringify(registrados)).not.toContain("Bearer tok");
    }, 10_000);
  });

  describe("nasceu em \"em lançamento omie\" (1.4, e)", () => {
    it("importada do ClickUp: nenhuma chamada, um pedido para mover para \"para pagar\" e de volta; depois do vaivém, lança", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      for (const t of estado.tasks) if (t.listId === CP.listId && t.statusId === S.emLancamento) t.statusId = S.lancado;
      const importada = importarEmLancamento(estado);
      const ponte = ponteSobre(estado);

      await ponte.lancarContasEmLancamento();
      await ponte.lancarContasEmLancamento();

      expect(servidor.recebidas).toHaveLength(0);
      expect(comentariosDoAgente(conta(estado, importada.id)).map((c) => c.content)).toEqual([TEXTO_NASCEU_EM_LANCAMENTO]);

      sairEVoltar(estado, importada.id);
      servidor.enfileirar({ kind: "ok", status: 200, corpo: dePara200("Impostos", { veredito: "resolvida" }) });
      servidor.enfileirar({ kind: "ok", status: 200, corpo: { payableId: "pay_importada_1", reaproveitado: false } });
      await ponte.lancarContasEmLancamento();
      expect(servidor.recebidas.map((r) => r.caminho)).toEqual([RESOLVER, LANCAR]);
      expect(conta(estado, importada.id).statusId).toBe(S.lancado);
    });

    it("posta no Status sem Registro nenhum (fixture do seed) também não é lançada", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      for (const t of estado.tasks) if (t.listId === CP.listId && t.statusId === S.emLancamento) t.statusId = S.lancado;
      const das = conta(estado, "tsk_cp_das");
      das.statusId = S.emLancamento;
      await ponteSobre(estado).lancarContasEmLancamento();
      expect(servidor.recebidas).toHaveLength(0);
      expect(comentariosDoAgente(das).map((c) => c.content)).toEqual([TEXTO_NASCEU_EM_LANCAMENTO]);
    });
  });

  it("T-3-04 — nada entregue a registrar() contém chave Pix, código de barras, valor, nome de fornecedor, título ou o motivo do Omie", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    prepararEmLancamento(estado, "tsk_cp_das", "Impostos");
    servidor.enfileirar({ kind: "ok", status: 500, corpo: { error: { code: "ERRO_INTERNO", message: "falhou", retryable: true } } });
    const registrados: unknown[] = [];
    const ponte = ponteSobre(estado, { registrar: (nivel, mensagem, dados) => registrados.push({ nivel, mensagem, dados }) });
    await ponte.lancarContasEmLancamento();

    // E uma recusa permanente cujo motivo cita o fornecedor: vai para a conta, nunca para o log.
    const outra = buildSeed();
    prepararEmLancamento(outra, "tsk_cp_das", "Impostos");
    servidor.enfileirar(erro422("OMIE_RECUSOU", "Receita Federal do Brasil bloqueado"));
    await ponteSobre(outra, { registrar: (nivel, mensagem, dados) => registrados.push({ nivel, mensagem, dados }) }).lancarContasEmLancamento();

    const gravado = JSON.stringify(registrados);
    expect(gravado).not.toContain("85810000005-6"); // código de barras
    expect(gravado).not.toContain("66267"); // valor
    expect(gravado).not.toContain("Receita Federal"); // fornecedor (e o motivo que o cita)
    expect(gravado).not.toContain("DAS — Simples Nacional"); // título
    expect(gravado).not.toContain("11.222.333/0001-81"); // documento
  });

  it("modo lancar sem credencial: nenhuma requisição, nenhum Comentário — NUNCA cai para ensaio silenciosamente", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = prepararEmLancamento(estado, "tsk_cp_das", "Impostos");
    await ponteSobre(estado, { token: "" }).lancarContasEmLancamento();
    expect(servidor.recebidas).toHaveLength(0);
    expect(comentariosDoAgente(das)).toHaveLength(0);
  });

  it("parar() espera o ciclo em voo terminar — a recarga do vite-node não deixa um ciclo velho rodando solto", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    prepararEmLancamento(estado, "tsk_cp_das", "Impostos");
    servidor.enfileirar({ kind: "atraso", ms: 200, status: 200, corpo: dePara200("Impostos", { veredito: "resolvida" }) });
    const registrados: string[] = [];
    const ponte = ponteSobre(estado, { modo: "ensaio", intervaloMs: 60_000, registrar: (_n, m) => registrados.push(m) });
    ponte.iniciar();
    await ponte.parar();
    expect(servidor.recebidas).toHaveLength(1);
    expect(registrados.some((m) => m.startsWith("Ensaio — lançaria"))).toBe(true);
  }, 10_000);
});

/* ═══════════════ rodarAgenda (1.4, f) — sem cache, sem rede, sem caneta ═══════════════ */

/** A A7 como o seed a montava até 1.5 — ainda gravada (pausada, depois do evolver) em ws_n1. */
function a7Legada(estado: DataState): Automation {
  const cond = (spec: object) => ({ kind: "valorDeCampo" as const, expression: JSON.stringify(spec) });
  return {
    id: INVOCADOR_DO_LANCAMENTO,
    workspaceId: estado.workspace.id,
    createdBy: { kind: "member", id: MARYANE },
    createdAt: "2026-06-01T12:00:00.000Z",
    lifecycle: "ativo",
    name: "A7 · D-1: lançar no Omie pelo Agente",
    description: "legada",
    scopeType: "list",
    scopeId: CP.listId,
    ownerMemberId: MARYANE,
    reactsToAutomationEvents: false,
    versions: [
      {
        number: 1,
        state: "publicada",
        trigger: { kind: "condicaoTemporal", temporalPredicate: JSON.stringify({ dueDateOffsetDays: -1 }) },
        conditions: [cond({ status: "para pagar" }), cond({ definitionId: F.integracaoManual, empty: true }), cond({ definitionId: F.valor, empty: false })],
        actions: [
          { order: 1, kind: "controle", controlKind: "invocarAgente", agentId: CP.agentId, params: "{}", maxAutonomy: "supervisionado" },
          { order: 2, kind: "escrita", toolId: "tarefa.alterarStatus", params: JSON.stringify({ statusName: "lançado omie" }) },
        ],
        errorPolicy: { onActionFailure: "interromper", retries: 0 },
        publishedBy: MARYANE,
        publishedAt: "2026-06-01T12:00:00.000Z",
        createdAt: "2026-06-01T12:00:00.000Z",
      },
    ],
  };
}

describe("rodarAgenda — a agenda nunca lança (1.4, f)", () => {
  const HOJE = new Date(2026, 7, 31, 12);
  const diaCivilEm = (dias: number) => {
    const d = new Date(HOJE.getFullYear(), HOJE.getMonth(), HOJE.getDate() + dias);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  function ponteSemRede(estado: DataState, fetchImpl: typeof fetch) {
    return criarPonteDoAgente({
      destinoUrl: "http://127.0.0.1:1",
      token: "tok",
      workspaceId: estado.workspace.id,
      listId: CP.listId,
      modo: "lancar",
      cnpjPorEmpresa: { "Tria Company": "11.222.333/0001-81" },
      fetchImpl,
      hidratarEstado: async () => estado,
    });
  }

  it("A7 legada ativa falha \"Lançamento não confirmado\" antes de invocar o Agente; A5 roda com o CNPJ; nenhuma requisição", () => {
    const estado = buildSeed();
    estado.automations.push(a7Legada(estado));
    const vespera = conta(estado, "tsk_cp_das");
    vespera.dueDate = { form: "civilDay", value: diaCivilEm(1) };
    const comPessoa = conta(estado, "tsk_cp_thiago_out");
    comPessoa.dueDate = { form: "civilDay", value: diaCivilEm(5) };
    let chamadas = 0;
    const ponte = ponteSemRede(estado, (async () => {
      chamadas += 1;
      throw new Error("a agenda não deveria chamar a rede");
    }) as unknown as typeof fetch);
    const execucoesDeAgente = estado.agentExecutions.length;

    const r = ponte.rodarAgenda(estado, MARYANE, CP.listId, HOJE);

    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(chamadas).toBe(0);
    const daA7 = estado.automationExecutions.filter((e) => e.automationId === INVOCADOR_DO_LANCAMENTO && e.objectId === vespera.id);
    expect(daA7.map((e) => e.state)).toEqual(["falhou"]);
    expect(daA7[0]?.terminationReason).toBe("Lançamento não confirmado pelo Omie para esta conta.");
    expect(estado.agentExecutions.length).toBe(execucoesDeAgente);
    expect(vespera.statusId).toBe(S.paraPagar);
    expect(vespera.comments.some((c) => c.content.startsWith("📋 RESUMO"))).toBe(false);
    expect(comPessoa.comments.some((c) => c.content.includes("11.222.333/0001-81 (Tria Company)"))).toBe(true);
  });

  it("sem A7 (o seed de hoje), a agenda da Lista configurada roda normalmente", () => {
    const estado = buildSeed();
    const ponte = ponteSemRede(estado, fetch);
    const r = ponte.rodarAgenda(estado, MARYANE, CP.listId, HOJE);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
  });

  it("outro par (Espaço, Lista) delega a runScheduledAutomations sem opções — a ponte não mexe na agenda das outras Listas", () => {
    const estado = buildSeed();
    const ponte = ponteSemRede(estado, fetch);
    const r = ponte.rodarAgenda(estado, MARYANE, "lst_nao_configurada", HOJE);
    expect(r.ok).toBe(false);
    if (!r.ok && !("conflito" in r)) expect(r.error).toContain("Lista não encontrada");
  });
});

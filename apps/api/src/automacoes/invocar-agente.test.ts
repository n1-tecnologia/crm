/**
 * A ponte HTTP do Agente de lançamento (Plan 03-11; plano pós-auditoria 1.4 e
 * 1.5; Plan 06-03, os dois momentos da Fase 6) — no molde de
 * `../persistencia/outbox-worker.test.ts`: casos PUROS rodam sempre; casos de
 * REDE usam `servidorFalso` (HTTP local de verdade, nunca `vi.mock` de
 * `fetch`) e também rodam sempre, injetando `hidratarEstado`, `resolverAtor`,
 * `executarOperacao` e `assinarAnexo` em memória — nenhum caso deste arquivo
 * precisa de `DATABASE_URL`.
 *
 * Os casos do Plan 06-03 (e onde cada um é provado):
 *   (a) `resolverModo` com `conferencia` — "resolverModo (D6-11)";
 *   (b) `lerOpcoesDeDecisao`; (c) `codigoNoPedido` — "variáveis de decisão";
 *   (d) ensaio: um `/resolver`, nada gravado, parada — "(d) ensaio";
 *   (e) conferencia: Resumo publicado, zero `/lancar` — "(e)";
 *   (f)–(h) a leitura do fio (D6-02) — "o fio";
 *   (i) conferencia com a conta conferida em "em lançamento omie" — "(i)";
 *   (j)–(n) lancar: o Momento 2 — "(j)"…"(n)";
 *   (o) Integração manual (D6-04); (p) D6-01; (q) `cutucar()` (D6-12);
 *   (r) T-3-04; e as portas G1 (legado importado), G2 (escopo por título) e
 *   G3 (quem a ponte avisa), dirigidas pelo orquestrador.
 *
 * Os casos de 1.4 que continuam valendo (prazos, recusa permanente,
 * transitórias, faltantes, nasceu, credencial ausente, `parar()`) foram
 * reescritos para o fluxo novo — o lançamento agora exige Conferência — na
 * exceção explícita a CON-05 que o Plan 06-03 concede a este arquivo.
 */

import { afterEach, describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { decideProcessApproval } from "@n1/dominio/operations/ai";
import {
  CP,
  INVOCADOR_DO_LANCAMENTO,
  TEXTOS_DA_CONFERENCIA,
  conferenciaDoResumo,
  publicarResumoParaConferencia,
  type ConferenciaDoResumo,
} from "@n1/dominio/operations/financeiro";
import { importarContaAPagarHistorica } from "@n1/dominio/operations/importacao-contas-a-pagar";
import { addTaskComment, changeTaskStatus } from "@n1/dominio/operations/tasks";
import type { ApprovalRequest, Automation, DataState, Task, WorkspaceFile } from "@n1/dominio";
import { criarServidorFalso, type ServidorFalso } from "../testes/servidor-falso";
import {
  ATRASO_DA_CUTUCADA_MS,
  DECISOES_PADRAO,
  MOTIVO_DA_DISPENSA,
  TEXTO_NASCEU_EM_LANCAMENTO,
  TEXTO_SAIU_ANTES_DO_REGISTRO,
  TENTATIVAS_TRANSITORIAS,
  TIMEOUT_LANCAR_MS,
  TIMEOUT_RESOLVER_MS,
  chaveDeIdempotencia,
  classificar,
  codigoNoPedido,
  criarPonteDoAgente,
  descreverEscopo,
  entrouPorMovimento,
  lerCnpjPorEmpresa,
  lerOpcoesDeDecisao,
  lerOpcoesDeEscopo,
  motivoDoEnvelope,
  movidaDepoisDaImportacao,
  resolverModo,
  textoDaRecusaDoResumo,
  textoDaRecusaPermanente,
  textoDasTransitorias,
  type OpcoesDaPonte,
} from "./invocar-agente";

const S = CP.status;
const F = CP.fields;
const MARYANE = CP.financeiroId;
/** O Membro que assina pela ponte nos testes (o "Agente do pipeline" de ws_n1 faz o papel em produção). */
const ATOR = "mem_thiago";
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
 * Só `id` fica nos Status que a ponte olha ("para pagar" e "em lançamento
 * omie"): as outras contas do seed saem do jogo (isolamento de fixture, não
 * regra), porque o Momento 1 publicaria um Resumo em cada conta completa.
 */
function isolar(estado: DataState, id: string, categoria = "Impostos"): Task {
  for (const t of estado.tasks) {
    if (t.listId === CP.listId && t.id !== id && (t.statusId === S.emLancamento || t.statusId === S.paraPagar)) t.statusId = S.lancado;
  }
  const t = conta(estado, id);
  definir(t, F.categoria, categoria);
  return t;
}

/**
 * Isola `id` e o faz ENTRAR em "em lançamento omie" por movimento:
 * `changeTaskStatus` da Maryane, que confere as exigências de saída de "para
 * pagar" — o caminho real que a ponte espera.
 */
function prepararEmLancamento(estado: DataState, id: string, categoria: string): Task {
  const t = isolar(estado, id, categoria);
  expect(t.statusId).toBe(S.paraPagar);
  const movida = changeTaskStatus(estado, MARYANE, t.id, S.emLancamento);
  if (!movida.ok) throw new Error(movida.error);
  return t;
}

function mover(estado: DataState, id: string, statusId: string): void {
  const r = changeTaskStatus(estado, MARYANE, id, statusId);
  if (!r.ok) throw new Error(r.error);
}

/** Sai e volta para "em lançamento omie", por movimento — o gesto que pede nova tentativa. */
function sairEVoltar(estado: DataState, id: string): void {
  mover(estado, id, S.paraPagar);
  mover(estado, id, S.emLancamento);
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
            ? { veredito: "resolvida" as const, nome: "Impostos e taxas", codigo: "2.06.01", similaridade: resolucao.similaridade ?? 0.9 }
            : { veredito: "revisar" as const, nome: "Impostos e taxas", codigo: "2.06.01", similaridade: resolucao.similaridade ?? 0.4, motivo: resolucao.motivo ?? "abaixo do corte" },
      },
      origem: "omie" as const,
    },
  };
}

const RESOLVIDA = { kind: "ok", status: 200, corpo: dePara200("Impostos", { veredito: "resolvida" }) } as const;
const LANCADO_200 = {
  kind: "ok",
  status: 200,
  corpo: { payableId: "pay_das_1", codigoLancamentoIntegracao: chaveDeIdempotencia("tsk_cp_das"), reaproveitado: false, anexos: [] },
} as const;

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
const resumosDe = (t: Task) => comentariosDoAgente(t).filter((c) => c.content.startsWith("📋 RESUMO DE PAGAMENTO"));

/** A Conferência vigente da conta (lança se não houver). */
function vigente(estado: DataState, t: Task): ConferenciaDoResumo {
  const c = conferenciaDoResumo(estado, t).conferencia;
  if (!c) throw new Error("sem Conferência");
  return c;
}

/** Publica o Resumo pelo domínio (como a ponte faria) e o confere por clique da Maryane. */
function conferirPeloDominio(estado: DataState, t: Task): ConferenciaDoResumo {
  const p = publicarResumoParaConferencia(estado, ATOR, t.id, { dePara: dePara200("Impostos", { veredito: "resolvida" }).dePara });
  if (!p.ok) throw new Error(p.error);
  const d = decideProcessApproval(estado, MARYANE, p.value.conferencia.id, "aprovada", { source: "click" });
  if (!d.ok) throw new Error(d.error);
  return p.value.conferencia;
}

/** `das` isolada, conferida e movida para "em lançamento omie" — pronta para o Momento 2. */
function conferidaEmLancamento(estado: DataState, id = "tsk_cp_das"): Task {
  const t = isolar(estado, id);
  conferirPeloDominio(estado, t);
  mover(estado, id, S.emLancamento);
  expect(conferenciaDoResumo(estado, t).estado).toBe("conferida");
  return t;
}

/** Um revisor responde no fio do Resumo. */
function responder(estado: DataState, t: Task, autor: string, texto: string): void {
  const c = vigente(estado, t);
  const r = addTaskComment(estado, autor, t.id, { content: texto, parentCommentId: c.origin.threadCommentId });
  if (!r.ok) throw new Error(r.error);
}

function arquivo(estado: DataState, id: string, name: string): WorkspaceFile {
  const f: WorkspaceFile = {
    id,
    workspaceId: estado.workspace.id,
    name,
    mediaType: "document",
    sizeBytes: 100,
    createdBy: { kind: "member", id: MARYANE },
    createdAt: "2026-09-01T12:00:00.000Z",
    objectKey: `obj/${id}`,
    state: "enviado",
  };
  estado.files.push(f);
  return f;
}

const assinarFalso = async (objectKey: string) => ({ downloadUrl: `https://storage.exemplo.invalid/${objectKey}?token=segredo-assinado` });

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

/* ═══════════════════ Plan 06-03 — puras novas ═══════════════════ */

describe("resolverModo (D6-11) — conferencia também só pelo literal exato", () => {
  it.each([
    ["conferencia", "conferencia", false],
    ["Conferencia", "ensaio", true],
    ["conferência", "ensaio", true],
    ["lancar ", "ensaio", true],
    [" conferencia", "ensaio", true],
  ] as const)("resolverModo(%o) → %s (aviso: %s)", (bruto, modoEsperado, temAviso) => {
    const { modo, aviso } = resolverModo(bruto);
    expect(modo).toBe(modoEsperado);
    expect(Boolean(aviso)).toBe(temAviso);
    if (aviso) {
      expect(aviso).toContain("AGENTE_CONTAS_A_PAGAR_MODO");
      expect(aviso).not.toContain(bruto);
    }
  });
});

describe("variáveis de decisão (b) e o código no pedido (c)", () => {
  it("(b) sem nada no ambiente: os padrões de 06-CONTEXT, sem aviso", () => {
    const r = lerOpcoesDeDecisao({});
    expect({ resumoAPartirDe: r.resumoAPartirDe, conferenciaPorComentario: r.conferenciaPorComentario, integracaoManual: r.integracaoManual }).toEqual(DECISOES_PADRAO);
    expect(DECISOES_PADRAO).toEqual({ resumoAPartirDe: "para-pagar", conferenciaPorComentario: true, integracaoManual: "nao-encosta" });
    expect(r.avisos).toEqual([]);
  });

  it("(b) os valores alternativos são lidos", () => {
    const r = lerOpcoesDeDecisao({
      AGENTE_CONTAS_A_PAGAR_RESUMO_A_PARTIR_DE: "em-lancamento-omie",
      AGENTE_CONTAS_A_PAGAR_CONFERENCIA_POR_COMENTARIO: "false",
      AGENTE_CONTAS_A_PAGAR_INTEGRACAO_MANUAL: "sem-conferencia",
    });
    expect(r).toEqual({ resumoAPartirDe: "em-lancamento-omie", conferenciaPorComentario: false, integracaoManual: "sem-conferencia", avisos: [] });
  });

  it.each([
    ["AGENTE_CONTAS_A_PAGAR_RESUMO_A_PARTIR_DE", "para_pagar"],
    ["AGENTE_CONTAS_A_PAGAR_CONFERENCIA_POR_COMENTARIO", "sim"],
    ["AGENTE_CONTAS_A_PAGAR_INTEGRACAO_MANUAL", "Sem-Conferencia"],
  ])("(b) %s desconhecido: vale o padrão, com aviso que nomeia a variável e não o valor", (nome, valor) => {
    const r = lerOpcoesDeDecisao({ [nome]: valor });
    expect(r.resumoAPartirDe).toBe("para-pagar");
    expect(r.conferenciaPorComentario).toBe(true);
    expect(r.integracaoManual).toBe("nao-encosta");
    expect(r.avisos).toHaveLength(1);
    expect(r.avisos[0]).toContain(nome);
    expect(r.avisos[0]).not.toContain(valor);
  });

  it("(c) codigoNoPedido acha d.dd.dd (e d.dd.dd.dd), e nada fora dessa forma", () => {
    expect(codigoNoPedido("use 2.02.98 por favor")).toBe("2.02.98");
    expect(codigoNoPedido("é a 2.02.98.01.")).toBe("2.02.98.01");
    expect(codigoNoPedido("categoria 2.06.01.")).toBe("2.06.01");
    expect(codigoNoPedido("é comercial")).toBeUndefined();
    expect(codigoNoPedido("valor 12.345,67")).toBeUndefined();
    expect(codigoNoPedido("12.02.98")).toBeUndefined();
  });

  it("G2/G3 — as portas de teste: vazias por padrão, aparadas quando definidas; o log de partida diz o escopo", () => {
    expect(lerOpcoesDeEscopo({})).toEqual({});
    expect(lerOpcoesDeEscopo({ AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM: "  ", AGENTE_CONTAS_A_PAGAR_AVISAR_ID: "" })).toEqual({});
    expect(lerOpcoesDeEscopo({ AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM: " TESTE AUTOMATIZADO ", AGENTE_CONTAS_A_PAGAR_AVISAR_ID: "mem_teste" })).toEqual({
      soTitulosCom: "TESTE AUTOMATIZADO",
      avisarId: "mem_teste",
    });
    expect(descreverEscopo(undefined)).toBe("escopo=todas");
    expect(descreverEscopo("TESTE AUTOMATIZADO")).toBe('escopo=titulos-com:"TESTE AUTOMATIZADO"');
  });

  it("D6-12 — a cutucada roda o ciclo em até 2 s", () => {
    expect(ATRASO_DA_CUTUCADA_MS).toBeLessThanOrEqual(2_000);
  });
});

/** Uma conta importada do ClickUp que termina em `statusFinalId` — como `contas-a-pagar:importar` grava. */
function importarNoStatus(estado: DataState, statusFinalId: string, legacyTaskId = "868legado2"): Task {
  const transicoes =
    statusFinalId === S.emLancamento
      ? [
          { em: "2026-08-01T12:00:00.000Z", statusId: S.paraPagar, nomeLegado: "para pagar" },
          { em: "2026-08-20T12:00:00.000Z", statusId: S.emLancamento, nomeLegado: "em lançamento omie" },
        ]
      : [{ em: "2026-08-01T12:00:00.000Z", statusId: S.paraPagar, nomeLegado: "para pagar" }];
  const r = importarContaAPagarHistorica(estado, MARYANE, {
    legacyTaskId,
    titulo: "Conta importada do ClickUp",
    statusFinalId,
    criadaEm: "2026-08-01T12:00:00.000Z",
    vencimento: { form: "civilDay", value: "2026-10-10" },
    transicoes,
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
  const indice = estado.tasks.findIndex((t) => t.id === r.value.id);
  const importada = estado.tasks[indice]!;
  estado.tasks[indice] = { ...importada, provenance: { ...importada.provenance!, at: "2026-09-01T00:00:00.000Z" } };
  return estado.tasks[indice]!;
}

describe("movidaDepoisDaImportacao (G1) — a mesma régua de entrouPorMovimento, em qualquer Status", () => {
  it("conta nativa: sempre", () => {
    const estado = buildSeed();
    expect(movidaDepoisDaImportacao(estado, conta(estado, "tsk_cp_das"))).toBe(true);
  });

  it("importada em \"para pagar\" sem movimento: não; movida aqui depois da importação: sim", () => {
    const estado = buildSeed();
    const t = importarNoStatus(estado, S.paraPagar);
    expect(movidaDepoisDaImportacao(estado, t)).toBe(false);
    mover(estado, t.id, S.emLancamento);
    mover(estado, t.id, S.paraPagar);
    expect(movidaDepoisDaImportacao(estado, conta(estado, t.id))).toBe(true);
  });
});

/* ═══════════════════ HTTP com servidorFalso — sempre rodam ═══════════════════ */

describe("criarPonteDoAgente — os dois momentos contra servidorFalso (sem DATABASE_URL)", () => {
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
      resolverAtor: async () => ATOR,
      executarOperacao: executarEmMemoria(estado),
      assinarAnexo: assinarFalso,
      ...extra,
    });
  }

  const caminhos = () => servidor.recebidas.map((r) => r.caminho);
  const lancamentos = () => servidor.recebidas.filter((r) => r.caminho === LANCAR);

  describe("(d) ensaio — um /resolver, nada gravado", () => {
    it("conta completa em \"para pagar\": UM /resolver, ZERO gravações, log \"Ensaio — publicaria\"; o segundo ciclo não pergunta de novo", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = isolar(estado, "tsk_cp_das");
      servidor.enfileirar(RESOLVIDA);
      const registrados: string[] = [];
      let gravacoes = 0;
      const ponte = ponteSobre(estado, {
        modo: "ensaio",
        registrar: (_nivel, mensagem) => registrados.push(mensagem),
        resolverAtor: async () => {
          throw new Error("o ensaio não deveria resolver o Ator");
        },
        executarOperacao: async () => {
          gravacoes += 1;
          return { ok: true };
        },
      });

      await ponte.processarContas();
      await ponte.processarContas();

      expect(caminhos()).toEqual([RESOLVER]);
      expect(gravacoes).toBe(0);
      expect(registrados.some((m) => m.startsWith("Ensaio — publicaria: TRIA COMPANY - ITAU · Impostos e taxas (2.06.01)"))).toBe(true);
      expect(comentariosDoAgente(das)).toHaveLength(0);
      expect(conferenciaDoResumo(estado, das).estado).toBe("sem-resumo");
    });

    it("com AGENTE_CONTAS_A_PAGAR_MODO apagada e a conta conferida em \"em lançamento omie\": ZERO /lancar, só o log", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = conferidaEmLancamento(estado);
      delete process.env.AGENTE_CONTAS_A_PAGAR_MODO;
      const { modo } = resolverModo(process.env.AGENTE_CONTAS_A_PAGAR_MODO);
      expect(modo).toBe("ensaio");
      const registrados: string[] = [];
      const comentarios = das.comments.length;

      const ponte = ponteSobre(estado, { modo, registrar: (_n, m) => registrados.push(m) });
      await ponte.processarContas();
      await ponte.processarContas();

      expect(servidor.recebidas).toHaveLength(0);
      expect(registrados.filter((m) => m.startsWith("Ensaio — lançaria: TRIA COMPANY - ITAU · Impostos e taxas (2.06.01)"))).toHaveLength(1);
      expect(das.comments.length).toBe(comentarios);
      expect(das.statusId).toBe(S.emLancamento);
    });

    it("em ensaio, a conta em \"em lançamento omie\" que falta dado só é registrada — nenhum Comentário", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = prepararEmLancamento(estado, "tsk_cp_das", "Impostos");
      das.fieldValues = das.fieldValues.filter((v) => v.definitionId !== F.nomeFornecedor);
      const registrados: string[] = [];
      await ponteSobre(estado, { modo: "ensaio", registrar: (_n, m) => registrados.push(m) }).processarContas();
      expect(servidor.recebidas).toHaveLength(0);
      expect(comentariosDoAgente(das)).toHaveLength(0);
      expect(registrados.some((m) => m.startsWith("Ensaio — não lançaria"))).toBe(true);
    });
  });

  describe("(e) conferencia — o Resumo antes do lançamento", () => {
    it("UM /resolver e UM publicarResumoParaConferencia: o Comentário e a Conferência pendente; ZERO /lancar", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = isolar(estado, "tsk_cp_das");
      servidor.enfileirar(RESOLVIDA);
      let gravacoes = 0;
      const emMemoria = executarEmMemoria(estado);
      const ponte = ponteSobre(estado, {
        modo: "conferencia",
        executarOperacao: async (op) => {
          gravacoes += 1;
          return emMemoria(op);
        },
      });

      await ponte.processarContas();
      await ponte.processarContas();

      expect(caminhos()).toEqual([RESOLVER]);
      expect(gravacoes).toBe(1);
      const resumos = resumosDe(das);
      expect(resumos).toHaveLength(1);
      expect(resumos[0]?.mentions).toEqual([{ type: "member", id: MARYANE }]);
      const { estado: estadoDaConferencia, conferencia } = conferenciaDoResumo(estado, das);
      expect(estadoDaConferencia).toBe("pendente");
      expect(conferencia?.origin.lancamento).toMatchObject({ conta: "TRIA COMPANY - ITAU", codigo: "2.06.01" });
      expect(conferencia?.approverMemberId).toBe(MARYANE);
      expect(lancamentos()).toHaveLength(0);
      expect(das.statusId).toBe(S.paraPagar);
    });

    it("categoria em revisão também publica: é o Financeiro quem decide no fio", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const trafego = isolar(estado, "tsk_cp_trafego", "Tráfego Pago");
      servidor.enfileirar({ kind: "ok", status: 200, corpo: dePara200("Tráfego Pago", { veredito: "revisar" }) });
      await ponteSobre(estado, { modo: "conferencia" }).processarContas();
      expect(caminhos()).toEqual([RESOLVER]);
      expect(resumosDe(trafego)).toHaveLength(1);
      expect(vigente(estado, trafego).origin.lancamento.veredito).toBe("revisar");
    });
  });

  describe("o fio (D6-02) — (f), (g), (h)", () => {
    async function comResumoPendente(extra: Partial<OpcoesDaPonte> = {}) {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = isolar(estado, "tsk_cp_das");
      servidor.enfileirar(RESOLVIDA);
      const ponte = ponteSobre(estado, { modo: "conferencia", ...extra });
      await ponte.processarContas();
      expect(conferenciaDoResumo(estado, das).estado).toBe("pendente");
      return { estado, das, ponte };
    }

    it("(f) \"ok\" de um revisor: decideProcessApproval(aprovada, comment) em nome dele; nenhum /resolver nem /lancar", async () => {
      const { estado, das, ponte } = await comResumoPendente();
      const antes = servidor.recebidas.length;
      responder(estado, das, MARYANE, "ok");

      await ponte.processarContas();

      expect(servidor.recebidas).toHaveLength(antes);
      const c = vigente(estado, das) as ApprovalRequest;
      expect(c.decision).toBe("aprovada");
      expect(c.decisionSource).toBe("comment");
      expect(c.decidedByMemberId).toBe(MARYANE);
      expect(conferenciaDoResumo(estado, das).estado).toBe("conferida");
      expect(das.comments.some((x) => x.content.startsWith("✅ Resumo conferido por"))).toBe(true);
    });

    it("(g) \"é comercial\": rejeitada com o texto; o ciclo seguinte pede /resolver com pedidoDeRevisao e republica no fio", async () => {
      const { estado, das, ponte } = await comResumoPendente();
      const primeira = vigente(estado, das);
      responder(estado, das, MARYANE, "é comercial");

      await ponte.processarContas();
      expect(caminhos()).toEqual([RESOLVER]);
      expect(primeira.decision).toBe("rejeitada");
      expect(primeira.decisionReason).toBe("é comercial");
      expect(conferenciaDoResumo(estado, das).estado).toBe("ajuste-pedido");

      servidor.enfileirar(RESOLVIDA);
      await ponte.processarContas();

      expect(caminhos()).toEqual([RESOLVER, RESOLVER]);
      const corpo = servidor.recebidas[1]?.corpo as Record<string, unknown>;
      expect(corpo.pedidoDeRevisao).toBe("é comercial");
      expect(corpo).not.toHaveProperty("codigoCategoriaConfirmado");
      const resumos = resumosDe(das);
      expect(resumos).toHaveLength(2);
      expect(resumos[1]?.parentCommentId).toBe(primeira.origin.threadCommentId);
      expect(resumos[1]?.content).toContain('Revisado a pedido de');
      expect(resumos[1]?.content).toContain('"é comercial"');
      // A impressão não mudou; a decisão anterior fica (rejeitada) e vale a nova, pendente.
      const nova = vigente(estado, das);
      expect(nova.id).not.toBe(primeira.id);
      expect(nova.origin.impressao).toBe(primeira.origin.impressao);
      expect(conferenciaDoResumo(estado, das).estado).toBe("pendente");
      expect(lancamentos()).toHaveLength(0);
    });

    it("(g) o pedido que cita um código d.dd.dd vai como codigoCategoriaConfirmado", async () => {
      const { estado, das, ponte } = await comResumoPendente();
      responder(estado, das, MARYANE, "use 2.02.98 por favor");
      await ponte.processarContas();
      servidor.enfileirar(RESOLVIDA);
      await ponte.processarContas();
      const corpo = servidor.recebidas[1]?.corpo as Record<string, unknown>;
      expect(corpo.pedidoDeRevisao).toBe("use 2.02.98 por favor");
      expect(corpo.codigoCategoriaConfirmado).toBe("2.02.98");
    });

    it("(h) \"pode lançar?\" não é decisão: nada gravado, nada requisitado", async () => {
      const { estado, das, ponte } = await comResumoPendente();
      responder(estado, das, MARYANE, "pode lançar?");
      const comentarios = das.comments.length;
      await ponte.processarContas();
      await ponte.processarContas();
      expect(caminhos()).toEqual([RESOLVER]);
      expect(das.comments.length).toBe(comentarios);
      expect(vigente(estado, das).decision).toBeUndefined();
    });

    it("(h) CONFERENCIA_POR_COMENTARIO=false: \"ok\" não decide nada", async () => {
      const { estado, das, ponte } = await comResumoPendente({ decisoes: { conferenciaPorComentario: false } });
      responder(estado, das, MARYANE, "ok");
      const comentarios = das.comments.length;
      await ponte.processarContas();
      expect(caminhos()).toEqual([RESOLVER]);
      expect(das.comments.length).toBe(comentarios);
      expect(vigente(estado, das).decision).toBeUndefined();
    });

    it("(h) CONFERENCIA_POR_COMENTARIO=false: o fio continua pedindo ajuste (D6-02, \"o tópico só pede ajuste\")", async () => {
      const { estado, das, ponte } = await comResumoPendente({ decisoes: { conferenciaPorComentario: false } });
      responder(estado, das, MARYANE, "é comercial");
      await ponte.processarContas();
      expect(vigente(estado, das).decision).toBe("rejeitada");
    });

    it("resposta de quem não é revisor não conta", async () => {
      const { estado, das, ponte } = await comResumoPendente();
      responder(estado, das, "mem_marcos_paulo", "ok");
      await ponte.processarContas();
      expect(vigente(estado, das).decision).toBeUndefined();
    });
  });

  describe("(i) conferencia — conta conferida em \"em lançamento omie\"", () => {
    it("ZERO /lancar; \"Resumo conferido. Neste ambiente…\" uma vez por chave; log \"Conferência — lançaria\"", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = isolar(estado, "tsk_cp_das");
      servidor.enfileirar(RESOLVIDA);
      const registrados: string[] = [];
      const ponte = ponteSobre(estado, { modo: "conferencia", registrar: (_n, m) => registrados.push(m) });

      await ponte.processarContas(); // Resumo
      responder(estado, das, MARYANE, "ok");
      await ponte.processarContas(); // conferido pelo fio
      mover(estado, das.id, S.emLancamento);
      await ponte.processarContas(); // o Momento 2 está desligado
      await ponte.processarContas();

      expect(caminhos()).toEqual([RESOLVER]);
      expect(lancamentos()).toHaveLength(0);
      const avisos = comentariosDoAgente(das).filter((c) => c.content === TEXTOS_DA_CONFERENCIA.modoConferencia);
      expect(avisos).toHaveLength(1);
      expect(avisos[0]?.mentions).toEqual([{ type: "member", id: MARYANE }]);
      expect(registrados.filter((m) => m.startsWith("Conferência — lançaria: TRIA COMPANY - ITAU · Impostos e taxas (2.06.01)"))).toHaveLength(1);
      expect(das.statusId).toBe(S.emLancamento);

      // Sair e voltar é chave nova: o aviso volta — e o /lancar continua inalcançável.
      sairEVoltar(estado, das.id);
      await ponte.processarContas();
      expect(lancamentos()).toHaveLength(0);
      expect(comentariosDoAgente(das).filter((c) => c.content === TEXTOS_DA_CONFERENCIA.modoConferencia)).toHaveLength(2);
    });
  });

  describe("(j)–(n) lancar — o Momento 2", () => {
    it("(j) conferida e entrou por movimento: /lancar com a chave, o código conferido, a Data de Emissão e os anexos; 200 ⇒ registrado e \"lançado omie\"", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = isolar(estado, "tsk_cp_das");
      arquivo(estado, "fil_nf", "NFS-e 0021.pdf");
      arquivo(estado, "fil_boleto", "boleto-outubro.pdf");
      definir(das, F.dataEmissao, "2026-09-15");
      das.fieldValues = das.fieldValues.filter((v) => v.definitionId !== F.boleto);
      das.fieldValues.push({ definitionId: F.anexo, value: ["fil_nf"], state: "ativo" });
      das.fieldValues.push({ definitionId: F.boleto, value: ["fil_boleto"], state: "ativo" });
      servidor.enfileirar(RESOLVIDA);
      const ponte = ponteSobre(estado);

      await ponte.processarContas(); // Momento 1 em "para pagar"
      expect(conferenciaDoResumo(estado, das).estado).toBe("pendente");
      const d = decideProcessApproval(estado, MARYANE, vigente(estado, das).id, "aprovada", { source: "click" });
      expect(d.ok).toBe(true);
      await ponte.processarContas(); // conferida em "para pagar": espera o humano mover
      expect(caminhos()).toEqual([RESOLVER]);

      mover(estado, das.id, S.emLancamento);
      servidor.enfileirar({
        kind: "ok",
        status: 200,
        corpo: {
          payableId: "pay_das_1",
          codigoLancamentoIntegracao: chaveDeIdempotencia("tsk_cp_das"),
          reaproveitado: false,
          anexos: [
            { nome: "NFS-e 0021.pdf", ok: true },
            { nome: "boleto-outubro.pdf", ok: false, erro: "ANEXO_DOWNLOAD_FALHOU" },
          ],
        },
      });
      await ponte.processarContas();

      expect(caminhos()).toEqual([RESOLVER, LANCAR]);
      const lancamento = servidor.recebidas[1];
      expect(lancamento?.cabecalhos["idempotency-key"]).toBe("tria:contas-a-pagar:tsk_cp_das");
      expect(lancamento?.cabecalhos.authorization).toBe("Bearer tok-lancar");
      const corpo = lancamento?.corpo as Record<string, unknown>;
      expect(corpo.codigoCategoriaConfirmado).toBe("2.06.01");
      expect(corpo.dataDeEmissao).toBe("2026-09-15");
      expect(corpo.anexos).toEqual([
        { url: "https://storage.exemplo.invalid/obj/fil_nf?token=segredo-assinado", nome: "NFS-e 0021.pdf" },
        { url: "https://storage.exemplo.invalid/obj/fil_boleto?token=segredo-assinado", nome: "boleto-outubro.pdf" },
      ]);
      expect(corpo.fornecedor).toEqual({ tipo: "CNPJ", documento: "11.222.333/0001-81", nome: "Receita Federal do Brasil" });
      expect(corpo.valorCentavos).toBe(6626750);
      expect(das.statusId).toBe(S.lancado);
      const confirmacao = comentariosDoAgente(das).find((c) => c.content.startsWith("✅ Lançado no Omie"));
      expect(confirmacao?.content).toBe(
        TEXTOS_DA_CONFERENCIA.lancado({
          payableId: "pay_das_1",
          conta: "TRIA COMPANY - ITAU",
          categoria: "Impostos e taxas",
          codigo: "2.06.01",
          reaproveitado: false,
          anexosPedidos: 2,
          anexos: [
            { nome: "NFS-e 0021.pdf", ok: true },
            { nome: "boleto-outubro.pdf", ok: false, erro: "ANEXO_DOWNLOAD_FALHOU" },
          ],
        }),
      );
      expect(JSON.stringify(das.comments)).not.toContain("token=");
      const execucao = estado.agentExecutions.filter((e) => e.anchor?.id === das.id).at(-1);
      expect(execucao?.invokedBy).toEqual({ kind: "automation", id: INVOCADOR_DO_LANCAMENTO });
      expect(execucao?.steps.some((p) => p.output === "título pay_das_1")).toBe(true);
    });

    it("(k) em \"em lançamento omie\" sem Resumo ⇒ Resumo e ZERO /lancar; pendente ⇒ ZERO requisições; desatualizada ⇒ Resumo novo \"dados mudaram\", ZERO /lancar", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = prepararEmLancamento(estado, "tsk_cp_das", "Impostos");
      const ponte = ponteSobre(estado);

      servidor.enfileirar(RESOLVIDA);
      await ponte.processarContas(); // sem-resumo
      expect(caminhos()).toEqual([RESOLVER]);
      expect(conferenciaDoResumo(estado, das).estado).toBe("pendente");

      await ponte.processarContas(); // pendente
      expect(caminhos()).toEqual([RESOLVER]);

      const d = decideProcessApproval(estado, MARYANE, vigente(estado, das).id, "aprovada", { source: "click" });
      expect(d.ok).toBe(true);
      definir(das, F.valor, "700"); // a conta muda depois da conferência
      expect(conferenciaDoResumo(estado, das).estado).toBe("desatualizada");
      servidor.enfileirar(RESOLVIDA);
      await ponte.processarContas();

      expect(caminhos()).toEqual([RESOLVER, RESOLVER]);
      expect(lancamentos()).toHaveLength(0);
      expect(resumosDe(das).at(-1)?.content).toContain("Os dados da conta mudaram depois da conferência.");
      expect(conferenciaDoResumo(estado, das).estado).toBe("pendente");
      expect(das.statusId).toBe(S.emLancamento);
    });

    it("(l) 422 OMIE_RECUSOU: registrarFalhaDoLancamento com motivo e code, a conta volta para \"para pagar\"; parada; mover de novo ⇒ lança", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = conferidaEmLancamento(estado);
      servidor.enfileirar(erro422("OMIE_RECUSOU", "Fornecedor bloqueado no Omie."));
      const ponte = ponteSobre(estado);

      await ponte.processarContas();
      expect(caminhos()).toEqual([LANCAR]);
      expect(das.statusId).toBe(S.paraPagar);
      const falhas = comentariosDoAgente(das).filter((c) => c.content.startsWith("Não consegui lançar no Omie"));
      expect(falhas.map((c) => c.content)).toEqual([TEXTOS_DA_CONFERENCIA.falha("Fornecedor bloqueado no Omie.", "OMIE_RECUSOU")]);
      expect(falhas[0]?.mentions).toEqual([{ type: "member", id: MARYANE }]);

      await ponte.processarContas();
      expect(caminhos()).toEqual([LANCAR]);

      mover(estado, das.id, S.emLancamento);
      servidor.enfileirar(LANCADO_200);
      await ponte.processarContas();
      expect(caminhos()).toEqual([LANCAR, LANCAR]);
      expect(das.statusId).toBe(S.lancado);
    });

    it("(l) sem details.motivo, a message fixa do envelope; 404 sem corpo, \"o Financeiro recusou a chamada\"", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = conferidaEmLancamento(estado);
      servidor.enfileirar({ kind: "ok", status: 503, corpo: { error: { code: "CONFIGURACAO_AUSENTE", message: "Credencial Omie ausente.", retryable: false } } });
      await ponteSobre(estado).processarContas();
      expect(comentariosDoAgente(das).at(-1)?.content).toBe(TEXTOS_DA_CONFERENCIA.falha("Credencial Omie ausente.", "CONFIGURACAO_AUSENTE"));

      await servidor.fechar();
      servidor = await criarServidorFalso();
      const outro = buildSeed();
      const das2 = conferidaEmLancamento(outro);
      servidor.enfileirar({ kind: "ok", status: 404 });
      await ponteSobre(outro).processarContas();
      expect(comentariosDoAgente(das2).at(-1)?.content).toBe(TEXTOS_DA_CONFERENCIA.falha("o Financeiro recusou a chamada", "HTTP_404"));
    });

    it("(m) /lancar em timeout três vezes: um aviso só (textoDasTransitorias), sem mudar Status; depois, nenhuma chamada", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = conferidaEmLancamento(estado);
      for (let n = 0; n < TENTATIVAS_TRANSITORIAS; n += 1) servidor.enfileirar({ kind: "timeout" });
      const ponte = ponteSobre(estado, { timeoutLancarMs: 60 });
      const antes = comentariosDoAgente(das).length;

      for (let n = 0; n < TENTATIVAS_TRANSITORIAS; n += 1) {
        await ponte.processarContas();
        if (n < TENTATIVAS_TRANSITORIAS - 1) expect(comentariosDoAgente(das)).toHaveLength(antes);
      }
      await ponte.processarContas();

      expect(caminhos()).toEqual([LANCAR, LANCAR, LANCAR]);
      expect(comentariosDoAgente(das).slice(antes).map((c) => c.content)).toEqual([textoDasTransitorias("ERRO_DE_REDE")]);
      expect(das.statusId).toBe(S.emLancamento);
    }, 10_000);

    it("(m) duas falhas transitórias e depois sucesso: lança, sem aviso", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = conferidaEmLancamento(estado);
      servidor.enfileirar(erro503());
      servidor.enfileirar({ kind: "ok", status: 500, corpo: { error: { code: "ERRO_INTERNO", retryable: true } } });
      servidor.enfileirar(LANCADO_200);
      const ponte = ponteSobre(estado);
      await ponte.processarContas();
      await ponte.processarContas();
      await ponte.processarContas();
      expect(caminhos()).toEqual([LANCAR, LANCAR, LANCAR]);
      expect(das.statusId).toBe(S.lancado);
      expect(das.comments.some((c) => c.content.startsWith("O Omie não respondeu"))).toBe(false);
    });

    it("(n) payableId 'mock-…' não é lançamento: recusa uma vez, ZERO registrarLancamentoNoOmie", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = conferidaEmLancamento(estado);
      servidor.enfileirar({ kind: "ok", status: 200, corpo: { payableId: "mock-payable-1730000000000", reaproveitado: false, anexos: [] } });
      const ponte = ponteSobre(estado);
      await ponte.processarContas();
      await ponte.processarContas();
      expect(caminhos()).toEqual([LANCAR]);
      expect(das.statusId).toBe(S.emLancamento);
      expect(das.comments.filter((c) => c.content.includes("não confirmou o lançamento"))).toHaveLength(1);
      expect(das.comments.some((c) => c.content.startsWith("✅ Lançado no Omie"))).toBe(false);
      expect(estado.activity.some((a) => a.objectId === das.id && a.action === "Lançado no Omie")).toBe(false);
    });

    it("a conta sai de \"em lançamento omie\" durante o /lancar: nada é registrado nem movido, e o Agente avisa que o título existe", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = conferidaEmLancamento(estado);
      servidor.enfileirar({ kind: "atraso", ms: 300, status: 200, corpo: LANCADO_200.corpo });
      const registrados: string[] = [];
      const emVoo = ponteSobre(estado, { registrar: (_n, m) => registrados.push(m) }).processarContas();

      for (let espera = 0; servidor.recebidas.length < 1 && espera < 100; espera += 1) await new Promise((r) => setTimeout(r, 10));
      expect(caminhos()).toEqual([LANCAR]);
      mover(estado, das.id, S.paraPagar);
      await emVoo;

      expect(das.statusId).toBe(S.paraPagar);
      expect(das.comments.some((c) => c.content.startsWith("✅ Lançado no Omie"))).toBe(false);
      expect(comentariosDoAgente(das).at(-1)?.content).toBe(TEXTO_SAIU_ANTES_DO_REGISTRO);
      expect(registrados.some((m) => m.startsWith("Conta lançada no Omie"))).toBe(false);
    }, 10_000);

    it("o registro recusado depois do lançamento confirmado vira aviso — e o Omie não é chamado de novo", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = conferidaEmLancamento(estado);
      servidor.enfileirar(LANCADO_200);
      let transacoes = 0;
      const ponte = ponteSobre(estado, {
        executarOperacao: async (operacao) => {
          transacoes += 1;
          if (transacoes === 1) return { ok: false, error: "Quem invoca não alcança a Tarefa." };
          return executarEmMemoria(estado)(operacao);
        },
      });
      await ponte.processarContas();
      await ponte.processarContas();
      expect(caminhos()).toEqual([LANCAR]);
      expect(das.statusId).toBe(S.emLancamento);
      const aviso = comentariosDoAgente(das).filter((c) => c.content.startsWith("O Omie confirmou o lançamento"));
      expect(aviso).toHaveLength(1);
      expect(aviso[0]?.content).toContain("Quem invoca não alcança a Tarefa.");
    });

    it("prazos: /lancar lento dentro do seu prazo lança; além dele, falha transitória sem aviso na primeira", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = conferidaEmLancamento(estado);
      servidor.enfileirar({ kind: "atraso", ms: 250, status: 200, corpo: LANCADO_200.corpo });
      await ponteSobre(estado, { timeoutResolverMs: 100, timeoutLancarMs: 5_000 }).processarContas();
      expect(das.statusId).toBe(S.lancado);

      await servidor.fechar();
      servidor = await criarServidorFalso();
      const outro = buildSeed();
      const das2 = conferidaEmLancamento(outro);
      servidor.enfileirar({ kind: "atraso", ms: 2_000, status: 200, corpo: LANCADO_200.corpo });
      const niveis: string[] = [];
      const antes = comentariosDoAgente(das2).length;
      await ponteSobre(outro, { timeoutLancarMs: 100, registrar: (nivel) => niveis.push(nivel) }).processarContas();
      expect(das2.statusId).toBe(S.emLancamento);
      expect(comentariosDoAgente(das2)).toHaveLength(antes);
      expect(niveis).toContain("warn");
    }, 10_000);

    it("Resumo conferido com a Categoria ausente do de-para (código de preenchimento 9.99.99): nenhuma requisição, um aviso", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = isolar(estado, "tsk_cp_das");
      const semCodigo = { contaPorTag: { "conta tria": "TRIA COMPANY - ITAU" }, categoriaPorCampo: {}, origem: "omie" as const };
      const p = publicarResumoParaConferencia(estado, ATOR, das.id, { dePara: semCodigo });
      if (!p.ok) throw new Error(p.error);
      expect(p.value.conferencia.origin.lancamento).toMatchObject({ veredito: "ausente", codigo: "9.99.99" });
      expect(decideProcessApproval(estado, MARYANE, p.value.conferencia.id, "aprovada", { source: "click" }).ok).toBe(false);
      // uma linha aprovada ANTES de 06-11, já gravada no banco: a guarda da ponte continua sendo a defesa em profundidade
      Object.assign(p.value.conferencia, { decision: "aprovada", decidedByMemberId: MARYANE, decidedAt: new Date().toISOString(), decisionSource: "click" });
      mover(estado, das.id, S.emLancamento);
      const ponte = ponteSobre(estado);
      await ponte.processarContas();
      await ponte.processarContas();
      expect(servidor.recebidas).toHaveLength(0);
      expect(comentariosDoAgente(das).filter((c) => c.content.includes("não tem um código de Categoria"))).toHaveLength(1);
    });
  });

  describe("Momento 1 — recusas, transitórias e prazos do /resolver", () => {
    it("recusa permanente no /resolver: comenta uma vez e para; um Campo que muda tenta de novo; sair e voltar também", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = isolar(estado, "tsk_cp_das");
      servidor.enfileirar(erro422("CONTA_CORRENTE_NAO_RESOLVIDA", 'Nenhuma conta corrente do Omie casa com "TRIA".'));
      const ponte = ponteSobre(estado, { modo: "conferencia" });

      await ponte.processarContas();
      await ponte.processarContas();
      expect(caminhos()).toEqual([RESOLVER]);
      expect(comentariosDoAgente(das).map((c) => c.content)).toEqual([
        textoDaRecusaDoResumo('Nenhuma conta corrente do Omie casa com "TRIA".', "CONTA_CORRENTE_NAO_RESOLVIDA"),
      ]);

      definir(das, F.cnpj, "11.222.333/0001-82");
      servidor.enfileirar(erro422("CONTA_CORRENTE_NAO_RESOLVIDA", "de novo"));
      await ponte.processarContas();
      expect(caminhos()).toEqual([RESOLVER, RESOLVER]);

      mover(estado, das.id, S.emLancamento);
      mover(estado, das.id, S.paraPagar);
      servidor.enfileirar(RESOLVIDA);
      await ponte.processarContas();
      expect(caminhos()).toEqual([RESOLVER, RESOLVER, RESOLVER]);
      expect(resumosDe(das)).toHaveLength(1);
    });

    it("três falhas transitórias seguidas no /resolver: um aviso só, e nenhuma chamada até a chave mudar", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = isolar(estado, "tsk_cp_das");
      for (let n = 0; n < TENTATIVAS_TRANSITORIAS; n += 1) servidor.enfileirar(erro503());
      const ponte = ponteSobre(estado, { modo: "conferencia" });
      for (let n = 0; n < TENTATIVAS_TRANSITORIAS + 2; n += 1) await ponte.processarContas();
      expect(caminhos()).toEqual([RESOLVER, RESOLVER, RESOLVER]);
      expect(comentariosDoAgente(das).map((c) => c.content)).toEqual([textoDasTransitorias("OMIE_INDISPONIVEL")]);
    });

    it("/resolver que não responde aborta no prazo dele, e o que chega ao log passou por sanitizarErro", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      isolar(estado, "tsk_cp_das");
      servidor.enfileirar({ kind: "timeout" });
      const registrados: Array<{ nivel: string; mensagem: string; dados?: Record<string, string | number> }> = [];
      await ponteSobre(estado, {
        modo: "conferencia",
        timeoutResolverMs: 80,
        registrar: (nivel, mensagem, dados) => registrados.push({ nivel, mensagem, ...(dados ? { dados } : {}) }),
      }).processarContas();
      expect(registrados.some((r) => r.nivel === "warn")).toBe(true);
      expect(JSON.stringify(registrados)).not.toContain("Bearer tok");
    }, 10_000);
  });

  describe("faltantes (1.4, h) — erpMissingFields do domínio decide", () => {
    it("em \"em lançamento omie\" falta Nome do fornecedor: nenhuma requisição, o Agente diz o que falta, uma vez, ao Financeiro", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = prepararEmLancamento(estado, "tsk_cp_das", "Impostos");
      das.fieldValues = das.fieldValues.filter((v) => v.definitionId !== F.nomeFornecedor);
      const ponte = ponteSobre(estado);
      await ponte.processarContas();
      await ponte.processarContas();
      expect(servidor.recebidas).toHaveLength(0);
      const pedidos = comentariosDoAgente(das).filter((c) => c.content.startsWith("Não consegui lançar no Omie: falta"));
      expect(pedidos).toHaveLength(1);
      expect(pedidos[0]?.content).toContain("Nome do fornecedor");
      expect(pedidos[0]?.mentions).toEqual([{ type: "member", id: MARYANE }]);
    });

    it("D3-01 — sem Centro de Custo: nenhuma requisição nasce, e o pedido nomeia o Campo", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = prepararEmLancamento(estado, "tsk_cp_das", "Impostos");
      das.fieldValues = das.fieldValues.filter((v) => v.definitionId !== F.centroDeCusto);
      await ponteSobre(estado).processarContas();
      expect(servidor.recebidas).toHaveLength(0);
      expect(comentariosDoAgente(das).some((c) => c.content.includes("Centro de Custo"))).toBe(true);
    });

    it("em \"para pagar\", a conta incompleta está sendo preenchida: silêncio total", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = isolar(estado, "tsk_cp_das");
      das.fieldValues = das.fieldValues.filter((v) => v.definitionId !== F.nomeFornecedor);
      await ponteSobre(estado, { modo: "conferencia" }).processarContas();
      expect(servidor.recebidas).toHaveLength(0);
      expect(comentariosDoAgente(das)).toHaveLength(0);
    });
  });

  describe("(o) Integração manual (D6-04)", () => {
    it("nao-encosta (padrão): nenhuma requisição, nenhum Comentário — em \"para pagar\" e em \"em lançamento omie\"", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = isolar(estado, "tsk_cp_das");
      definir(das, F.integracaoManual, "Manual");
      const ponte = ponteSobre(estado);
      await ponte.processarContas();
      mover(estado, das.id, S.emLancamento);
      await ponte.processarContas();
      expect(servidor.recebidas).toHaveLength(0);
      expect(comentariosDoAgente(das)).toHaveLength(0);
    });

    it("sem-conferencia: /resolver, Resumo e a Conferência dispensada pelo Membro de serviço (clique, com o motivo); em \"em lançamento omie\", lança", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = isolar(estado, "tsk_cp_das");
      definir(das, F.integracaoManual, "Manual");
      servidor.enfileirar(RESOLVIDA);
      const ponte = ponteSobre(estado, { decisoes: { integracaoManual: "sem-conferencia" } });

      await ponte.processarContas();
      expect(caminhos()).toEqual([RESOLVER]);
      const c = vigente(estado, das) as ApprovalRequest;
      expect(c.decision).toBe("aprovada");
      expect(c.decisionSource).toBe("click");
      expect(c.decidedByMemberId).toBe(ATOR);
      expect(c.decisionReason).toBe(MOTIVO_DA_DISPENSA);
      const registro = estado.activity.find((a) => a.objectId === c.id && a.action === "Aprovação decidida");
      expect(registro?.detail).toContain(MOTIVO_DA_DISPENSA);
      // Ninguém é chamado a conferir o que foi dispensado.
      expect(resumosDe(das)[0]?.mentions).toEqual([{ type: "member", id: ATOR }]);

      mover(estado, das.id, S.emLancamento);
      servidor.enfileirar(LANCADO_200);
      await ponte.processarContas();
      expect(caminhos()).toEqual([RESOLVER, LANCAR]);
      expect(das.statusId).toBe(S.lancado);
    });
  });

  describe("(p) D6-01 — RESUMO_A_PARTIR_DE=em-lancamento-omie", () => {
    it("completa em \"para pagar\": nada; ao entrar em \"em lançamento omie\": o Resumo", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = isolar(estado, "tsk_cp_das");
      const ponte = ponteSobre(estado, { modo: "conferencia", decisoes: { resumoAPartirDe: "em-lancamento-omie" } });
      await ponte.processarContas();
      expect(servidor.recebidas).toHaveLength(0);
      mover(estado, das.id, S.emLancamento);
      servidor.enfileirar(RESOLVIDA);
      await ponte.processarContas();
      expect(caminhos()).toEqual([RESOLVER]);
      expect(resumosDe(das)).toHaveLength(1);
    });
  });

  describe("nasceu em \"em lançamento omie\" (1.4, e) e o legado importado (G1)", () => {
    it("lancar — importada já em \"em lançamento omie\": nenhuma chamada, um pedido para mover; depois do vaivém, o Resumo (não o lançamento)", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      for (const t of estado.tasks) if (t.listId === CP.listId && (t.statusId === S.emLancamento || t.statusId === S.paraPagar)) t.statusId = S.lancado;
      const importada = importarNoStatus(estado, S.emLancamento);
      const ponte = ponteSobre(estado);

      await ponte.processarContas();
      await ponte.processarContas();
      expect(servidor.recebidas).toHaveLength(0);
      expect(comentariosDoAgente(conta(estado, importada.id)).map((c) => c.content)).toEqual([TEXTO_NASCEU_EM_LANCAMENTO]);

      sairEVoltar(estado, importada.id);
      servidor.enfileirar(RESOLVIDA);
      await ponte.processarContas();
      expect(caminhos()).toEqual([RESOLVER]);
      expect(lancamentos()).toHaveLength(0);
      expect(resumosDe(conta(estado, importada.id))).toHaveLength(1);
    });

    it("conferida e posta no Status sem Registro (fixture): lancar não lança e pede o vaivém", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = isolar(estado, "tsk_cp_das");
      conferirPeloDominio(estado, das);
      das.statusId = S.emLancamento;
      await ponteSobre(estado).processarContas();
      expect(servidor.recebidas).toHaveLength(0);
      expect(comentariosDoAgente(das).at(-1)?.content).toBe(TEXTO_NASCEU_EM_LANCAMENTO);
    });

    it.each(["ensaio", "conferencia", "lancar"] as const)(
      "G1 (%s) — importada e completa em \"para pagar\": ZERO /resolver, ZERO Comentários, só a contagem no log; movida aqui depois da importação, entra",
      async (modo) => {
        servidor = await criarServidorFalso();
        const estado = buildSeed();
        for (const t of estado.tasks) if (t.listId === CP.listId && (t.statusId === S.emLancamento || t.statusId === S.paraPagar)) t.statusId = S.lancado;
        const importada = importarNoStatus(estado, S.paraPagar);
        const registrados: Array<{ mensagem: string; dados?: Record<string, string | number> }> = [];
        const ponte = ponteSobre(estado, { modo, registrar: (_n, mensagem, dados) => registrados.push({ mensagem, ...(dados ? { dados } : {}) }) });

        await ponte.processarContas();
        await ponte.processarContas();
        expect(servidor.recebidas).toHaveLength(0);
        expect(comentariosDoAgente(conta(estado, importada.id))).toHaveLength(0);
        const contagens = registrados.filter((r) => r.mensagem.startsWith("Contas importadas sem movimento"));
        expect(contagens).toHaveLength(1); // só quando a contagem muda
        expect(contagens[0]?.dados?.contas).toBe(1);
        expect(JSON.stringify(registrados)).not.toContain("Conta importada do ClickUp");

        mover(estado, importada.id, S.emLancamento);
        mover(estado, importada.id, S.paraPagar);
        servidor.enfileirar(RESOLVIDA);
        await ponte.processarContas();
        expect(caminhos()).toEqual([RESOLVER]);
        expect(resumosDe(conta(estado, importada.id))).toHaveLength(modo === "ensaio" ? 0 : 1);
      },
    );
  });

  describe("G2 — AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM", () => {
    it("duas contas completas em \"para pagar\": só a que tem \"TESTE AUTOMATIZADO\" no título recebe /resolver e Resumo", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = isolar(estado, "tsk_cp_das");
      const trafego = conta(estado, "tsk_cp_trafego");
      trafego.statusId = S.paraPagar;
      definir(trafego, F.categoria, "Impostos");
      das.title = "DAS — TESTE AUTOMATIZADO";
      servidor.enfileirar(RESOLVIDA);
      const ponte = ponteSobre(estado, { modo: "conferencia", soTitulosCom: "TESTE AUTOMATIZADO" });

      await ponte.processarContas();
      await ponte.processarContas();

      expect(caminhos()).toEqual([RESOLVER]);
      expect((servidor.recebidas[0]?.corpo as { taskId?: string }).taskId).toBe(das.id);
      expect(resumosDe(das)).toHaveLength(1);
      expect(comentariosDoAgente(trafego)).toHaveLength(0);
    });

    it("o Momento 2 também: a conta conferida fora do escopo não é lançada", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      conferidaEmLancamento(estado);
      const ponte = ponteSobre(estado, { soTitulosCom: "TESTE AUTOMATIZADO" });
      await ponte.processarContas();
      expect(servidor.recebidas).toHaveLength(0);
    });
  });

  describe("G3 — AGENTE_CONTAS_A_PAGAR_AVISAR_ID", () => {
    const TESTE = "mem_marcos_paulo";

    it("em conferencia, nenhum Comentário da ponte menciona o Financeiro: Resumo, aviso do modo e pedido de dado vão ao Membro indicado", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = isolar(estado, "tsk_cp_das");
      servidor.enfileirar(RESOLVIDA);
      const ponte = ponteSobre(estado, { modo: "conferencia", avisarId: TESTE });

      await ponte.processarContas(); // Resumo
      expect(vigente(estado, das).approverMemberId).toBe(TESTE);
      responder(estado, das, "mem_thiago", "ok"); // um Proprietário (revisor) confere pelo fio
      await ponte.processarContas();
      expect(conferenciaDoResumo(estado, das).estado).toBe("conferida");
      mover(estado, das.id, S.emLancamento);
      await ponte.processarContas(); // aviso do modo conferência
      das.fieldValues = das.fieldValues.filter((v) => v.definitionId !== F.nomeFornecedor);
      await ponte.processarContas(); // pedido de dado

      const daPonte = comentariosDoAgente(das);
      expect(daPonte.length).toBeGreaterThanOrEqual(3);
      expect(daPonte.every((c) => c.mentions.every((m) => m.id === TESTE))).toBe(true);
      expect(JSON.stringify(daPonte.map((c) => c.mentions))).not.toContain(MARYANE);
      expect(lancamentos()).toHaveLength(0);
    });

    it("em lancar, o aviso de falha (registrarFalhaDoLancamento) também vai ao Membro indicado", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = conferidaEmLancamento(estado);
      servidor.enfileirar(erro422("OMIE_RECUSOU", "Fornecedor bloqueado no Omie."));
      await ponteSobre(estado, { avisarId: TESTE }).processarContas();
      expect(das.statusId).toBe(S.paraPagar);
      expect(comentariosDoAgente(das).at(-1)?.mentions).toEqual([{ type: "member", id: TESTE }]);
    });

    it("avisarId que não é Membro ativo: o ciclo não escreve nem chama nada, e avisa a cada ciclo (WR-01)", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = isolar(estado, "tsk_cp_das");
      servidor.enfileirar(RESOLVIDA);
      const avisos: string[] = [];
      const ponte = ponteSobre(estado, { modo: "conferencia", avisarId: "mem_nao_existe", registrar: (nivel, m) => nivel === "warn" && avisos.push(m) });
      await ponte.processarContas();
      await ponte.processarContas();
      expect(servidor.recebidas).toHaveLength(0);
      expect(resumosDe(das)).toHaveLength(0);
      expect(avisos.filter((m) => m.startsWith("AGENTE_CONTAS_A_PAGAR_AVISAR_ID"))).toHaveLength(2);
      expect(avisos.join(" ")).not.toContain("mem_nao_existe");
    });
  });

  describe("(q) cutucar() — D6-12", () => {
    const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

    function ponteContada(estado: DataState, atrasoDoHidratar = 0) {
      let ciclos = 0;
      const ponte = ponteSobre(estado, {
        modo: "ensaio",
        atrasoDaCutucadaMs: 100,
        soTitulosCom: "nenhuma conta tem este título",
        hidratarEstado: async () => {
          ciclos += 1;
          if (atrasoDoHidratar) await esperar(atrasoDoHidratar);
          return estado;
        },
      });
      return { ponte, ciclos: () => ciclos };
    }

    it("três cutucadas em 100 ms viram UM ciclo", async () => {
      servidor = await criarServidorFalso();
      const { ponte, ciclos } = ponteContada(buildSeed());
      ponte.cutucar();
      await esperar(40);
      ponte.cutucar();
      await esperar(40);
      ponte.cutucar();
      await esperar(350);
      expect(ciclos()).toBe(1);
      await ponte.parar();
    });

    it("cutucada durante um ciclo em voo: exatamente um ciclo a mais, logo depois dele", async () => {
      servidor = await criarServidorFalso();
      const { ponte, ciclos } = ponteContada(buildSeed(), 200);
      ponte.cutucar();
      await esperar(150); // o ciclo começou aos 100 ms e está em voo
      expect(ciclos()).toBe(1);
      ponte.cutucar();
      ponte.cutucar();
      await esperar(600);
      expect(ciclos()).toBe(2);
      await ponte.parar();
    });

    it("parar() cancela a cutucada pendente", async () => {
      servidor = await criarServidorFalso();
      const { ponte, ciclos } = ponteContada(buildSeed());
      ponte.cutucar();
      await ponte.parar();
      await esperar(250);
      expect(ciclos()).toBe(0);
      ponte.cutucar(); // depois de parada, cutucar é no-op
      await esperar(250);
      expect(ciclos()).toBe(0);
    });
  });

  it("(r) T-3-04 — nada entregue a registrar() contém Resumo, chave Pix, valor, fornecedor, título, URL assinada ou o pedido de revisão", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    das.title = "DAS — Fornecedor Sigiloso Ltda";
    definir(das, F.forma, "Chave Pix");
    definir(das, F.chavePix, "chave-pix-secreta@exemplo.com.br");
    arquivo(estado, "fil_nf", "nota.pdf");
    das.fieldValues.push({ definitionId: F.anexo, value: ["fil_nf"], state: "ativo" });
    const registrados: unknown[] = [];
    const ponte = ponteSobre(estado, { registrar: (nivel, mensagem, dados) => registrados.push({ nivel, mensagem, dados }) });
    const PEDIDO = "o fornecedor X pediu para trocar a categoria";

    servidor.enfileirar(RESOLVIDA);
    await ponte.processarContas(); // Resumo
    responder(estado, das, MARYANE, PEDIDO);
    await ponte.processarContas(); // ajuste pedido
    servidor.enfileirar({ kind: "ok", status: 500, corpo: { error: { code: "ERRO_INTERNO", message: "falhou", retryable: true } } });
    await ponte.processarContas(); // /resolver com o pedido: transitória
    servidor.enfileirar(RESOLVIDA);
    await ponte.processarContas(); // Resumo revisado
    responder(estado, das, MARYANE, "ok");
    await ponte.processarContas(); // conferido
    mover(estado, das.id, S.emLancamento);
    servidor.enfileirar(erro422("OMIE_RECUSOU", "Receita Federal do Brasil bloqueado"));
    await ponte.processarContas(); // /lancar recusado, com anexo assinado

    expect(servidor.recebidas.some((r) => JSON.stringify(r.corpo).includes("token=segredo-assinado"))).toBe(true);
    expect(servidor.recebidas.some((r) => JSON.stringify(r.corpo).includes(PEDIDO))).toBe(true);
    const gravado = JSON.stringify(registrados);
    expect(gravado).not.toContain("RESUMO DE PAGAMENTO");
    expect(gravado).not.toContain("chave-pix-secreta");
    expect(gravado).not.toContain("66267"); // valor
    expect(gravado).not.toContain("Receita Federal"); // fornecedor (e o motivo que o cita)
    expect(gravado).not.toContain("Sigiloso"); // título
    expect(gravado).not.toContain("11.222.333/0001-81"); // documento
    expect(gravado).not.toContain("token="); // URL assinada
    expect(gravado).not.toContain("storage.exemplo.invalid");
    expect(gravado).not.toContain("fornecedor X"); // o pedido de revisão
  });

  it("modo que grava sem credencial: nenhuma requisição, nenhum Comentário — NUNCA cai para ensaio silenciosamente", async () => {
    for (const modo of ["lancar", "conferencia"] as const) {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = conferidaEmLancamento(estado);
      const antes = comentariosDoAgente(das).length;
      await ponteSobre(estado, { modo, token: "" }).processarContas();
      expect(servidor.recebidas).toHaveLength(0);
      expect(comentariosDoAgente(das)).toHaveLength(antes);
      await servidor.fechar();
    }
    servidor = await criarServidorFalso();
  });

  it("parar() espera o ciclo em voo terminar — a recarga do vite-node não deixa um ciclo velho rodando solto", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    isolar(estado, "tsk_cp_das");
    servidor.enfileirar({ kind: "atraso", ms: 200, status: 200, corpo: dePara200("Impostos", { veredito: "resolvida" }) });
    const registrados: string[] = [];
    const ponte = ponteSobre(estado, { modo: "ensaio", intervaloMs: 60_000, registrar: (_n, m) => registrados.push(m) });
    ponte.iniciar();
    await ponte.parar();
    expect(servidor.recebidas).toHaveLength(1);
    expect(registrados.some((m) => m.startsWith("Ensaio — publicaria"))).toBe(true);
  }, 10_000);

  it("lancarContasEmLancamento é o mesmo ciclo (o nome de antes, para index.ts)", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    isolar(estado, "tsk_cp_das");
    servidor.enfileirar(RESOLVIDA);
    const ponte = ponteSobre(estado, { modo: "ensaio" });
    expect(ponte.lancarContasEmLancamento).toBe(ponte.processarContas);
    await ponte.lancarContasEmLancamento();
    expect(caminhos()).toEqual([RESOLVER]);
  });
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

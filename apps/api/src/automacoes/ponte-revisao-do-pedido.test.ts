/**
 * Checklist 6.1–6.4 — a ponte com a leitura do pedido de ajuste (contrato
 * `contas-a-pagar-v1` v1.3): o `/resolver` devolve `revisao` ao lado do
 * `dePara`, a ponte a valida e o domínio aplica as mudanças nos Campos como o
 * Agente, a pedido de quem pediu. Os exemplos do produtor são as respostas.
 *
 * Sem banco e sem rede real: servidor HTTP falso em loopback e Unidade de
 * Trabalho em memória, como `contrato-contas-a-pagar-ponte.test.ts`.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { CP, COMO_PEDIR_AJUSTE, conferenciaDoResumo } from "@n1/dominio/operations/financeiro";
import { addTaskComment, setTaskFieldValue, updateTask } from "@n1/dominio/operations/tasks";
import type { DataState, Task } from "@n1/dominio";
import { criarServidorFalso, type ServidorFalso } from "../testes/servidor-falso";
import { criarPonteDoAgente } from "./invocar-agente";
import { revisaoDoCorpo } from "./revisao-do-resolver";

interface Exemplo {
  readonly requisicao: { readonly body: Record<string, unknown> };
  readonly resposta: { readonly status: number; readonly corpo: Record<string, unknown> };
}

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PASTA = path.resolve(AQUI, "../../../../contratos/contas-a-pagar-v1");
const exemplo = (arquivo: string): Exemplo => JSON.parse(readFileSync(path.join(PASTA, arquivo), "utf8")) as Exemplo;
const responder = (arquivo: string) => {
  const { status, corpo } = exemplo(arquivo).resposta;
  return { kind: "ok", status, corpo } as const;
};

const S = CP.status;
const MARYANE = CP.financeiroId;
const ATOR = "mem_thiago";
const RESOLVER = "/v1/integrations/contas-a-pagar/resolver";
const valorDe = (t: Task) => t.fieldValues.find((v) => v.definitionId === CP.fields.valor && v.state === "ativo")?.value;

describe("revisaoDoCorpo — a leitura do pedido que a ponte aceita", () => {
  it("ausente é 'sem revisão'; a dos exemplos v1.3 é aceita como está", () => {
    expect(revisaoDoCorpo({ dePara: {} })).toEqual({ ok: true });
    for (const arquivo of ["resolver.sucesso-pedido-interpretado.json", "resolver.sucesso-pedido-nao-entendido.json"]) {
      const corpo = exemplo(arquivo).resposta.corpo;
      expect(revisaoDoCorpo(corpo), arquivo).toEqual({ ok: true, revisao: corpo.revisao });
    }
  });

  it("fora do contrato é recusada inteira: chave a mais, valor inválido, data inexistente, forma desconhecida", () => {
    for (const revisao of [
      { mudancas: {}, extra: 1 },
      { mudancas: { valorCentavos: -1 } },
      { mudancas: { valorCentavos: 10.5 } },
      { mudancas: { vencimento: "2026-02-31" } },
      { mudancas: { vencimento: "2026-13-01" } },
      { mudancas: { formaDePagamento: "Cartão" } },
      { mudancas: { chavePix: "" } },
      { categoria: { codigo: "2.08", nome: "x" }, mudancas: {} },
      { naoEntendido: "sem mudancas" },
    ]) {
      expect(revisaoDoCorpo({ dePara: {}, revisao }), JSON.stringify(revisao)).toEqual({ ok: false });
    }
  });
});

describe("a ponte com a leitura do pedido (v1.3)", () => {
  let servidor: ServidorFalso;
  afterEach(async () => {
    await servidor?.fechar();
  });

  /** Só a DAS do seed fica nos Status que a ponte olha, em "para pagar", com a Categoria dos exemplos. */
  function das(estado: DataState): Task {
    for (const t of estado.tasks) {
      if (t.listId === CP.listId && t.id !== "tsk_cp_das" && (t.statusId === S.emLancamento || t.statusId === S.paraPagar)) t.statusId = S.lancado;
    }
    const t = estado.tasks.find((x) => x.id === "tsk_cp_das");
    if (!t) throw new Error("sem tsk_cp_das no seed");
    t.fieldValues = t.fieldValues.filter((v) => v.definitionId !== CP.fields.categoria);
    t.fieldValues.push({ definitionId: CP.fields.categoria, value: "Impostos", state: "ativo" });
    return t;
  }

  function ponte(
    estado: DataState,
    extras: { readonly timeoutResolverMs?: number; readonly decisoes?: { readonly integracaoManual: "sem-conferencia" | "nao-encosta" } } = {},
  ) {
    return criarPonteDoAgente({
      destinoUrl: servidor.url,
      token: "tok-lancar",
      workspaceId: estado.workspace.id,
      listId: CP.listId,
      modo: "lancar",
      hidratarEstado: async () => estado,
      resolverAtor: async () => ATOR,
      executarOperacao: async (operacao) => {
        const r = operacao(estado);
        return r.ok ? ({ ok: true } as const) : ({ ok: false, error: r.error ?? "recusado" } as const);
      },
      assinarAnexo: async (k) => ({ downloadUrl: `https://storage.exemplo.invalid/${k}?token=x` }),
      ...extras,
    });
  }

  /** Publica o Resumo (resolver.sucesso-resolvida), a Maryane pede o ajuste no fio e a ponte o lê como ajuste pedido. */
  async function pedirAjuste(estado: DataState, t: Task, p: ReturnType<typeof ponte>, pedido: string): Promise<void> {
    servidor.enfileirar(responder("resolver.sucesso-resolvida.json"));
    await p.processarContas();
    const c = conferenciaDoResumo(estado, t).conferencia;
    if (!c) throw new Error("sem Conferência");
    const r = addTaskComment(estado, MARYANE, t.id, { content: pedido, parentCommentId: c.origin.threadCommentId });
    if (!r.ok) throw new Error(r.error);
    await p.processarContas(); // o fio vira ajuste pedido
    expect(conferenciaDoResumo(estado, t).estado).toBe("ajuste-pedido");
  }

  const ultimoResumo = (t: Task) => [...t.comments].reverse().find((c) => c.content.startsWith("📋 RESUMO DE PAGAMENTO"))?.content ?? "";

  it("resolver.sucesso-pedido-interpretado: as mudanças entram nos Campos, o Resumo diz o que mudou, a Conferência nova fica pendente e marca a Categoria pedida", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const t = das(estado);
    const p = ponte(estado);
    const pedido = exemplo("resolver.sucesso-pedido-interpretado.json").requisicao.body.pedidoDeRevisao as string;
    await pedirAjuste(estado, t, p, pedido);

    servidor.enfileirar(responder("resolver.sucesso-pedido-interpretado.json"));
    await p.processarContas();

    const enviado = servidor.recebidas[1]?.corpo as Record<string, unknown>;
    expect(servidor.recebidas[1]?.caminho).toBe(RESOLVER);
    expect(enviado.pedidoDeRevisao).toBe(pedido);
    expect(valorDe(t)).toBe(1250);
    expect(t.dueDate).toEqual({ form: "civilDay", value: "2026-10-20" });
    const resumo = ultimoResumo(t);
    expect(resumo).toContain("O que mudou: Categoria: Impostos e taxas (2.06.01) → Tarifas bancárias (2.08.05); Valor: ");
    const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(1250);
    expect(resumo).toContain(`→ ${brl}; Vencimento: `);
    expect(resumo).toContain("→ 20/10/2026.");
    expect(resumo).toContain("Código:         2.08.05");
    const agora = conferenciaDoResumo(estado, t);
    expect(agora.estado).toBe("pendente");
    expect(agora.conferencia?.origin.lancamento).toMatchObject({ codigo: "2.08.05", pedida: true });
    const registro = estado.activity.find((a) => a.objectId === t.id && a.action === "Valor alterado");
    expect(registro?.actor).toEqual({ kind: "agent", id: CP.agentId });
    expect(registro?.delegate).toEqual({ kind: "member", id: MARYANE });
  });

  it("depois, uma mudança de dado republica com a Categoria pedida antes (codigoCategoriaPedidoAnterior), sem pedido", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const t = das(estado);
    const p = ponte(estado);
    await pedirAjuste(estado, t, p, exemplo("resolver.sucesso-pedido-interpretado.json").requisicao.body.pedidoDeRevisao as string);
    servidor.enfileirar(responder("resolver.sucesso-pedido-interpretado.json"));
    await p.processarContas();

    const mudou = updateTask(estado, MARYANE, t.id, { description: "Tarifa da guia, outubro" });
    if (!mudou.ok) throw new Error(mudou.error);
    expect(conferenciaDoResumo(estado, t).estado).toBe("desatualizada");
    servidor.enfileirar(responder("resolver.sucesso-categoria-pedida-antes.json"));
    await p.processarContas();

    const enviado = servidor.recebidas[2]?.corpo as Record<string, unknown>;
    expect(enviado.codigoCategoriaPedidoAnterior).toBe("2.08.05");
    expect(enviado).not.toHaveProperty("pedidoDeRevisao");
    expect(enviado).not.toHaveProperty("codigoCategoriaConfirmado");
    const declarados = Object.keys(exemplo("resolver.sucesso-categoria-pedida-antes.json").requisicao.body);
    for (const campo of Object.keys(enviado)) expect(declarados, campo).toContain(campo);
    expect(conferenciaDoResumo(estado, t).conferencia?.origin.lancamento).toMatchObject({ codigo: "2.08.05", pedida: true });
  });

  it("resolver.sucesso-pedido-nao-entendido: nada muda, e o Resumo diz que não identificou o que mudar e como pedir", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const t = das(estado);
    const p = ponte(estado);
    const valorAntes = valorDe(t);
    await pedirAjuste(estado, t, p, exemplo("resolver.sucesso-pedido-nao-entendido.json").requisicao.body.pedidoDeRevisao as string);

    servidor.enfileirar(responder("resolver.sucesso-pedido-nao-entendido.json"));
    await p.processarContas();

    expect(valorDe(t)).toBe(valorAntes);
    const resumo = ultimoResumo(t);
    expect(resumo).toContain(`Não identifiquei o que mudar neste pedido (O pedido não diz qual campo mudar nem o valor novo): o Resumo segue igual. ${COMO_PEDIR_AJUSTE}`);
    expect(resumo).not.toContain("O que mudou:");
    expect(conferenciaDoResumo(estado, t).estado).toBe("pendente");
  });

  it("revisao fora do contrato: nenhum Campo muda e nenhum Resumo revisado sai", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const t = das(estado);
    const p = ponte(estado);
    const valorAntes = valorDe(t);
    await pedirAjuste(estado, t, p, "valor 99");
    const resumosAntes = t.comments.filter((c) => c.content.startsWith("📋 RESUMO DE PAGAMENTO")).length;

    const { corpo } = exemplo("resolver.sucesso-resolvida.json").resposta;
    servidor.enfileirar({ kind: "ok", status: 200, corpo: { ...corpo, revisao: { mudancas: { valorCentavos: 9900, juros: 1 } } } });
    await p.processarContas();

    expect(valorDe(t)).toBe(valorAntes);
    expect(t.comments.filter((c) => c.content.startsWith("📋 RESUMO DE PAGAMENTO"))).toHaveLength(resumosAntes);
    expect(t.comments.some((c) => c.content.includes("RESPOSTA_INVALIDA"))).toBe(true);
    expect(conferenciaDoResumo(estado, t).estado).toBe("ajuste-pedido");
  });

  it("revisão de código: numa conta Manual (sem-conferencia), o Resumo que mudou a conta a pedido NÃO é dispensado — alguém confere", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const t = das(estado);
    const p = ponte(estado, { decisoes: { integracaoManual: "sem-conferencia" } });
    await pedirAjuste(estado, t, p, exemplo("resolver.sucesso-pedido-interpretado.json").requisicao.body.pedidoDeRevisao as string);
    const manual = setTaskFieldValue(estado, MARYANE, t.id, CP.fields.integracaoManual, "Manual");
    if (!manual.ok) throw new Error(manual.error);

    servidor.enfileirar(responder("resolver.sucesso-pedido-interpretado.json"));
    await p.processarContas();

    expect(valorDe(t)).toBe(1250);
    expect(ultimoResumo(t)).toContain("O que mudou:");
    expect(conferenciaDoResumo(estado, t).estado).toBe("pendente");
    expect(t.comments.some((c) => c.content.startsWith("✅ Resumo conferido por"))).toBe(false);
  });

  it("com pedido, o /resolver tem o prazo maior: a leitura da IA não é cortada pelo prazo de 10 s", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const t = das(estado);
    const p = ponte(estado, { timeoutResolverMs: 100 });
    await pedirAjuste(estado, t, p, "valor 1.250,00");

    const { status, corpo } = exemplo("resolver.sucesso-pedido-interpretado.json").resposta;
    servidor.enfileirar({ kind: "atraso", ms: 400, status, corpo });
    await p.processarContas();

    expect(valorDe(t)).toBe(1250);
    expect(conferenciaDoResumo(estado, t).estado).toBe("pendente");
  });
});

/**
 * Checklist 6.3–6.5 — o Resumo revisado a pedido: o Agente aplica nos Campos
 * da conta o que a leitura do pedido devolveu, a pedido de quem pediu e com a
 * regra de escrita dessa pessoa; o Resumo diz o que mudou (ou, com
 * honestidade, que nada mudou) e as Observações registram o ajuste.
 *
 * `tsk_cp_das`: "para pagar", Boleto completo, Tag "conta tria", Categoria
 * "Impostos" — passa por `erpMissingFields`.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { ApprovalRequest, Task } from "../types";
import { decideProcessApproval } from "./ai";
import { CP, conferenciaDoResumo, impressaoDeLancamento, publicarResumoParaConferencia, type DeParaDeLancamento } from "./financeiro";
import { codigoDaCategoriaPedida, fieldValue } from "./financeiro-base";
import { setTaskFieldValue } from "./tasks";
import { COMO_PEDIR_AJUSTE } from "./financeiro-textos";

let state: DataState;

const das = (): Task => {
  const t = state.tasks.find((x) => x.id === "tsk_cp_das");
  if (!t) throw new Error("sem tsk_cp_das");
  return t;
};

const DE_PARA: DeParaDeLancamento = {
  contaPorTag: { "conta tria": "TRIA" },
  categoriaPorCampo: { Impostos: { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01" } },
  origem: "omie",
};

const DE_PARA_PEDIDO: DeParaDeLancamento = {
  contaPorTag: { "conta tria": "TRIA" },
  categoriaPorCampo: { Impostos: { veredito: "resolvida", nome: "Marketing digital", codigo: "2.02.98", similaridade: 1 } },
  origem: "omie",
};

type Opcoes = Parameters<typeof publicarResumoParaConferencia>[3];

function conferenciaVigente(): ApprovalRequest {
  const c = conferenciaDoResumo(state, das()).conferencia;
  if (!c) throw new Error("sem Conferência");
  return c;
}

/** Publica, rejeita com `pedido` (clique de quem confere) e devolve a Conferência rejeitada. */
function pedirAjuste(pedido: string): ApprovalRequest {
  const primeira = publicarResumoParaConferencia(state, CP.financeiroId, das().id, { dePara: DE_PARA });
  if (!primeira.ok) throw new Error(primeira.error);
  const rejeitada = decideProcessApproval(state, CP.financeiroId, primeira.value.conferencia.id, "rejeitada", { source: "click", reason: pedido });
  if (!rejeitada.ok) throw new Error(rejeitada.error);
  return conferenciaVigente();
}

function revisar(conferencia: ApprovalRequest, opcoes: Partial<Opcoes> = {}) {
  return publicarResumoParaConferencia(state, CP.financeiroId, das().id, { dePara: DE_PARA, conferenciaRejeitadaId: conferencia.id, ...opcoes });
}

beforeEach(() => {
  state = buildSeed();
});

describe("6.3 — o Agente aplica o que o pedido muda", () => {
  it("valor e vencimento mudam nos Campos; o Resumo e as Observações dizem o que mudou; a Conferência nova não nasce desatualizada", () => {
    const valorAntes = Number(fieldValue(das(), CP.fields.valor));
    const vencimentoAntes = das().dueDate?.value.slice(0, 10) ?? "";
    // O seed data o DAS a partir de hoje: uma data fixa aqui coincidia com a do seed em um dia
    // do mês ("15/10 → 15/10" não é mudança) e o teste falhava só naquele dia.
    const depois = new Date(`${vencimentoAntes}T12:00:00Z`);
    depois.setUTCDate(depois.getUTCDate() + 10);
    const vencimentoNovo = depois.toISOString().slice(0, 10);
    const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
    const dataBr = (iso: string) => iso.split("-").reverse().join("/");
    const rejeitada = pedirAjuste(`valor 1.234,56 e vencimento ${dataBr(vencimentoNovo)}`);

    const r = revisar(rejeitada, { mudancasDoPedido: { valorCentavos: 123456, vencimento: vencimentoNovo } });
    if (!r.ok) throw new Error(r.error);

    expect(fieldValue(das(), CP.fields.valor)).toBe("1234.56");
    expect(das().dueDate).toEqual({ form: "civilDay", value: vencimentoNovo });

    const linhas = `Valor: ${brl(valorAntes)} → ${brl(1234.56)}; Vencimento: ${dataBr(vencimentoAntes)} → ${dataBr(vencimentoNovo)}`;
    expect(r.value.comentario.content).toContain(`O que mudou: ${linhas}.`);
    expect(r.value.comentario.content).toContain(`Ajustado a pedido no fio: ${linhas}.`);
    expect(r.value.comentario.content).toContain(`💰 Valor:             ${brl(1234.56)}`);

    const agora = conferenciaDoResumo(state, das());
    expect(agora.estado).toBe("pendente");
    expect(r.value.conferencia.origin.impressao).toBe(impressaoDeLancamento(state, das()));
  });

  it("o Registro de Atividade sai com o Agente como ator e quem pediu como delegante", () => {
    const rejeitada = pedirAjuste("valor 99,90");
    const r = revisar(rejeitada, { mudancasDoPedido: { valorCentavos: 9990 } });
    if (!r.ok) throw new Error(r.error);
    const registro = state.activity.find((a) => a.objectId === das().id && a.action === "Valor alterado");
    expect(registro?.actor).toEqual({ kind: "agent", id: CP.agentId });
    expect(registro?.delegate).toEqual({ kind: "member", id: CP.financeiroId });
    expect(registro?.after).toBe("99.9");
  });

  it("a forma muda junto com o dado dela; sem o dado, não muda e o Resumo diz por quê", () => {
    const rejeitada = pedirAjuste("paga por pix");
    const sem = revisar(rejeitada, { mudancasDoPedido: { formaDePagamento: "Chave Pix" } });
    if (!sem.ok) throw new Error(sem.error);
    expect(fieldValue(das(), CP.fields.forma)).toBe("Boleto");
    expect(sem.value.comentario.content).toContain("Não mudei: Forma de pagamento: para Chave Pix, falta Chave pix no pedido.");
    expect(sem.value.comentario.content).toContain(`O Resumo segue igual. ${COMO_PEDIR_AJUSTE}`);

    const outra = decideProcessApproval(state, CP.financeiroId, sem.value.conferencia.id, "rejeitada", { source: "click", reason: "pix na chave 11999990000" });
    if (!outra.ok) throw new Error(outra.error);
    const com = revisar(conferenciaVigente(), { mudancasDoPedido: { formaDePagamento: "Chave Pix", chavePix: "11999990000" } });
    if (!com.ok) throw new Error(com.error);
    expect(fieldValue(das(), CP.fields.forma)).toBe("Chave Pix");
    expect(fieldValue(das(), CP.fields.chavePix)).toBe("11999990000");
    expect(com.value.comentario.content).toContain("Forma de pagamento: Boleto → Chave Pix; Chave pix: — → 11999990000");
  });

  it("quem pediu sem permissão de escrita na conta: o Agente também não escreve, e o Resumo diz o que não mudou", () => {
    const rejeitada = pedirAjuste("valor 10,00");
    const r = revisar(rejeitada, { pedidoPor: "mem_thiago_pereira", mudancasDoPedido: { valorCentavos: 1000 } });
    if (!r.ok) throw new Error(r.error);
    expect(fieldValue(das(), CP.fields.valor)).not.toBe("10");
    expect(r.value.comentario.content).toMatch(/Não mudei: Valor: /u);
  });

  it("uma mudança que deixaria a conta sem o que o Omie exige desfaz tudo, Campos inclusive", () => {
    const rejeitada = pedirAjuste("vai por QR Code");
    const antes = structuredClone(das().fieldValues);
    const comentarios = das().comments.length;
    const r = revisar(rejeitada, { mudancasDoPedido: { formaDePagamento: "QRCode Pix", pixCopiaECola: "00020126...", valorCentavos: 5000 } });
    // "para pagar" exige o arquivo do QR Code quando a forma é QRCode Pix (`dadoDePagamento`, seed).
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/^Não apliquei o ajuste pedido: a conta ficaria sem QR Code/u) });
    expect(das().fieldValues).toEqual(antes);
    expect(das().comments).toHaveLength(comentarios);
  });
});

describe("6.4 — pedido que não muda nada: a resposta honesta", () => {
  it("sem mudança nenhuma, o Resumo diz que não identificou o que mudar e como pedir", () => {
    const rejeitada = pedirAjuste("hmm, confere isso aí");
    const r = revisar(rejeitada, { pedidoNaoEntendido: "o pedido não cita campo nem valor." });
    if (!r.ok) throw new Error(r.error);
    expect(r.value.comentario.content).toContain(
      `Não identifiquei o que mudar neste pedido (o pedido não cita campo nem valor): o Resumo segue igual. ${COMO_PEDIR_AJUSTE}`,
    );
    expect(r.value.comentario.content).not.toContain("O que mudou:");
    expect(r.value.comentario.content).not.toContain("Ajustado a pedido no fio");
  });

  it("pedir o valor que a conta já tem não é mudança", () => {
    const atual = Math.round(Number(fieldValue(das(), CP.fields.valor)) * 100);
    const rejeitada = pedirAjuste("o valor está certo");
    const r = revisar(rejeitada, { mudancasDoPedido: { valorCentavos: atual } });
    if (!r.ok) throw new Error(r.error);
    expect(r.value.comentario.content).toContain("Não identifiquei o que mudar neste pedido");
    expect(state.activity.some((a) => a.objectId === das().id && a.action === "Valor alterado")).toBe(false);
  });
});

describe("6.1 — a Categoria pedida", () => {
  it("o Resumo diz a troca de Categoria e a Conferência guarda que ela foi pedida", () => {
    const rejeitada = pedirAjuste("categoria 2.02.98");
    const r = revisar(rejeitada, { dePara: DE_PARA_PEDIDO, categoriaPedida: true });
    if (!r.ok) throw new Error(r.error);
    expect(r.value.comentario.content).toContain("O que mudou: Categoria: Impostos e taxas (2.06.01) → Marketing digital (2.02.98).");
    const origem = r.value.conferencia.origin;
    expect(origem.kind === "processTask" && origem.processStep === "resumo" && origem.lancamento).toMatchObject({ codigo: "2.02.98", pedida: true });
  });

  it("sem `categoriaPedida`, a Conferência não marca a Categoria como pedida", () => {
    const r = publicarResumoParaConferencia(state, CP.financeiroId, das().id, { dePara: DE_PARA });
    if (!r.ok) throw new Error(r.error);
    const origem = r.value.conferencia.origin;
    expect(origem.kind === "processTask" && origem.processStep === "resumo" && "pedida" in origem.lancamento).toBe(false);
  });
});

describe("6.1 — a Categoria pedida continua valendo enquanto o Campo não muda", () => {
  it("vale depois da revisão; some quando alguém muda o Campo Categoria; não existe sem pedido", () => {
    expect(codigoDaCategoriaPedida(state, das())).toBeUndefined();
    const rejeitada = pedirAjuste("categoria 2.02.98");
    expect(codigoDaCategoriaPedida(state, das())).toBeUndefined();

    const r = revisar(rejeitada, { dePara: DE_PARA_PEDIDO, categoriaPedida: true });
    if (!r.ok) throw new Error(r.error);
    expect(codigoDaCategoriaPedida(state, das())).toBe("2.02.98");

    const outra = state.fieldDefinitions.find((d) => d.id === CP.fields.categoria)?.options?.find((o) => o !== "Impostos");
    if (!outra) throw new Error("o Campo Categoria sem outra opção");
    const mudou = setTaskFieldValue(state, CP.financeiroId, das().id, CP.fields.categoria, outra);
    if (!mudou.ok) throw new Error(mudou.error);
    expect(codigoDaCategoriaPedida(state, das())).toBeUndefined();
  });
});

describe("revisão de código", () => {
  it("o Resumo que mudou a conta a pedido não se dispensa: recusa e desfaz os Campos", () => {
    const rejeitada = pedirAjuste("valor 50,00");
    const antes = structuredClone(das().fieldValues);
    const r = revisar(rejeitada, { mudancasDoPedido: { valorCentavos: 5000 }, dispensada: true });
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("não se dispensa") });
    expect(das().fieldValues).toEqual(antes);
  });

  it("a Categoria pedida deixa de valer quando a Empresa muda (o código pode ser de outro plano)", () => {
    const rejeitada = pedirAjuste("categoria 2.02.98");
    const r = revisar(rejeitada, { dePara: DE_PARA_PEDIDO, categoriaPedida: true });
    if (!r.ok) throw new Error(r.error);
    expect(codigoDaCategoriaPedida(state, das())).toBe("2.02.98");
    const empresa = state.fieldDefinitions.find((d) => d.id === CP.fields.empresa)!;
    const outra = (empresa.options ?? []).find((o) => o !== fieldValue(das(), CP.fields.empresa))!;
    const mudou = setTaskFieldValue(state, CP.financeiroId, das().id, CP.fields.empresa, outra);
    if (!mudou.ok) throw new Error(mudou.error);
    expect(codigoDaCategoriaPedida(state, das())).toBeUndefined();
  });
});

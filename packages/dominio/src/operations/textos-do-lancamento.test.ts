/**
 * crm:IN-03 e os textos novos da ponte (06-11 Task 3). A confirmação do
 * lançamento conta os anexos pelo que de fato aconteceu — nunca "sem anexos"
 * quando havia anexos pedidos — e os dois 422 da v1.2
 * (`TITULO_EXISTENTE_DIVERGENTE`, `CONTA_DIVERGENTE`) têm texto pronto: só id
 * do título, nomes de campo e rótulos de conta, nenhum valor.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Task } from "../types";
import { decideProcessApproval } from "./ai";
import {
  CP,
  publicarResumoParaConferencia,
  registrarFalhaDoLancamento,
  registrarLancamentoNoOmie,
  TEXTOS_DA_CONFERENCIA,
  type DadosDoLancado,
  type DeParaDeLancamento,
} from "./financeiro";
import { changeTaskStatus } from "./tasks";

const PREFIXO = "✅ Lançado no Omie — título 123 · TRIA · Impostos e taxas (2.06.01) · ";
const BASE = { payableId: "123", conta: "TRIA", categoria: "Impostos e taxas", codigo: "2.06.01" } as const;
const lancado = (d: Omit<DadosDoLancado, keyof typeof BASE>) => TEXTOS_DA_CONFERENCIA.lancado({ ...BASE, ...d });

describe("(a) lancado conta os anexos pelo status real", () => {
  it.each([
    ["sem anexos pedidos", { reaproveitado: false, anexos: [] }, `${PREFIXO}sem anexos`, []],
    ["sem anexos pedidos, título reaproveitado", { reaproveitado: true, anexos: [] }, `${PREFIXO}sem anexos (título já existia)`, []],
    ["reaproveitado de um automation/ v1.1, sem resposta dos anexos", { anexosPedidos: 2, reaproveitado: true, anexos: [] }, `${PREFIXO}anexos do primeiro envio (título já existia)`, []],
    [
      "dois dos três já estavam no título",
      {
        anexosPedidos: 3,
        reaproveitado: true,
        anexos: [
          { nome: "nf.pdf", ok: true, jaExistia: true },
          { nome: "boleto.pdf", ok: true, jaExistia: true },
          { nome: "recibo.pdf", ok: true },
        ],
      },
      `${PREFIXO}anexos 3 de 3, 2 já estavam no título (título já existia)`,
      [],
    ],
    [
      "um já estava no título",
      {
        anexosPedidos: 2,
        reaproveitado: true,
        anexos: [
          { nome: "nf.pdf", ok: true, jaExistia: true },
          { nome: "boleto.pdf", ok: true },
        ],
      },
      `${PREFIXO}anexos 2 de 2, 1 já estava no título (título já existia)`,
      [],
    ],
    [
      "um subiu, um falhou",
      {
        anexosPedidos: 2,
        reaproveitado: false,
        anexos: [
          { nome: "nf.pdf", ok: true },
          { nome: "boleto.pdf", ok: false, erro: "ANEXO_DOWNLOAD_FALHOU" },
        ],
      },
      `${PREFIXO}anexos 1 de 2`,
      ["• boleto.pdf: não subiu (ANEXO_DOWNLOAD_FALHOU)"],
    ],
    ["um sem resposta do Omie", { anexosPedidos: 2, reaproveitado: false, anexos: [{ nome: "nf.pdf", ok: true }] }, `${PREFIXO}anexos 1 de 2`, ["• 1 anexo sem resposta do Omie"]],
  ] as const)("%s", (_rotulo, dados, primeira, linhas) => {
    const texto = lancado(dados as Omit<DadosDoLancado, keyof typeof BASE>);
    const [linha1, ...resto] = texto.split("\n");
    expect(linha1).toBe(primeira);
    expect(resto).toEqual([...linhas]);
    if (((dados as { anexosPedidos?: number }).anexosPedidos ?? 0) > 0) expect(texto).not.toContain("sem anexos");
  });

  it("dois sem resposta do Omie: o plural", () => {
    const texto = lancado({ anexosPedidos: 3, reaproveitado: false, anexos: [{ nome: "nf.pdf", ok: true }] });
    expect(texto.split("\n")).toEqual([`${PREFIXO}anexos 1 de 3`, "• 2 anexos sem resposta do Omie"]);
  });
});

describe("(b) tituloDivergente", () => {
  it("nomes de campo em pt-BR, nunca valores", () => {
    expect(TEXTOS_DA_CONFERENCIA.tituloDivergente("5872219943", ["valor", "vencimento"])).toBe(
      'o título 5872219943 já existe no Omie com outros dados (valor, vencimento): exclua-o ou corrija-o no Omie e mova a conta de novo para "em lançamento omie"',
    );
    expect(TEXTOS_DA_CONFERENCIA.tituloDivergente("5872219943", ["contaCorrente"])).toBe(
      'o título 5872219943 já existe no Omie com outros dados (conta corrente): exclua-o ou corrija-o no Omie e mova a conta de novo para "em lançamento omie"',
    );
    expect(TEXTOS_DA_CONFERENCIA.tituloDivergente("5872219943", [])).toBe(
      'o título 5872219943 já existe no Omie com outros dados: exclua-o ou corrija-o no Omie e mova a conta de novo para "em lançamento omie"',
    );
  });
});

describe("(c) contaDivergente", () => {
  it("só os rótulos das contas", () => {
    expect(TEXTOS_DA_CONFERENCIA.contaDivergente("TRIA", "TRIA COMPANY - ITAU")).toBe(
      "a conta corrente conferida no Resumo (TRIA) não é a que o Omie usaria agora (TRIA COMPANY - ITAU); confira o de-para de contas antes de mover a conta de novo",
    );
  });
});

const DE_PARA: DeParaDeLancamento = {
  contaPorTag: { "conta tria": "TRIA" },
  categoriaPorCampo: { Impostos: { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01" } },
  origem: "omie",
};

describe("com a conta pronta para registrar", () => {
  let state: DataState;
  let conta: Task;

  beforeEach(() => {
    state = buildSeed();
    const t = state.tasks.find((x) => x.id === "tsk_cp_das");
    if (!t) throw new Error("sem tsk_cp_das");
    conta = t;
    const p = publicarResumoParaConferencia(state, CP.financeiroId, conta.id, { dePara: DE_PARA });
    if (!p.ok) throw new Error(p.error);
    const d = decideProcessApproval(state, CP.financeiroId, p.value.conferencia.id, "aprovada", { source: "click" });
    if (!d.ok) throw new Error(d.error);
    const m = changeTaskStatus(state, CP.financeiroId, conta.id, CP.status.emLancamento);
    if (!m.ok) throw new Error(m.error);
  });

  describe("(d) o 422 TITULO_EXISTENTE_DIVERGENTE vira falha do lançamento", () => {
    it.each([
      [undefined, CP.financeiroId],
      ["mem_marcos_paulo", "mem_marcos_paulo"],
    ] as const)("avisarId %s → Menção a %s; Registro só com o code; nenhum valor no texto", (avisarId, mencionado) => {
      const motivo = TEXTOS_DA_CONFERENCIA.tituloDivergente("5872219943", ["valor", "vencimento"]);
      const code = "TITULO_EXISTENTE_DIVERGENTE";
      const r = registrarFalhaDoLancamento(state, CP.financeiroId, conta.id, { motivo, code }, avisarId ? { avisarId } : {});
      expect(r.ok, r.ok ? "" : r.error).toBe(true);
      const aviso = conta.comments.at(-1);
      expect(aviso?.content).toBe(TEXTOS_DA_CONFERENCIA.falha(motivo, code));
      expect(aviso?.mentions).toEqual([{ type: "member", id: mencionado }]);
      expect(state.activity.find((a) => a.objectId === conta.id && a.action === "Lançamento no Omie falhou")?.detail).toBe(code);

      const valor = conta.fieldValues.find((f) => f.definitionId === CP.fields.valor && f.state === "ativo")?.value;
      const vencimento = conta.dueDate?.value ?? "";
      expect(String(valor ?? "")).not.toBe("");
      expect(vencimento).not.toBe("");
      expect(aviso?.content).not.toContain(String(valor));
      expect(aviso?.content).not.toContain(vencimento);
      expect(aviso?.content).not.toContain(vencimento.slice(0, 10).split("-").reverse().join("/"));
    });
  });

  describe("(e) registrarLancamentoNoOmie repassa anexosPedidos", () => {
    it("título reaproveitado de um automation/ v1.1: anexos do primeiro envio", () => {
      const r = registrarLancamentoNoOmie(state, CP.financeiroId, conta.id, { payableId: "5872219943", reaproveitado: true, anexos: [], anexosPedidos: 2 });
      expect(r.ok, r.ok ? "" : r.error).toBe(true);
      const confirmacao = conta.comments.find((c) => c.content.startsWith("✅ Lançado no Omie"));
      expect(confirmacao?.content.split("\n")[0]).toBe("✅ Lançado no Omie — título 5872219943 · TRIA · Impostos e taxas (2.06.01) · anexos do primeiro envio (título já existia)");
    });
  });
});

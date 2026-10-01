/**
 * Checklist 7.3 — o anexo de verdade da conta. O arquivo já está no Storage
 * (chave real, conferida pelo servidor); a operação o liga à Tarefa como
 * anexo ou como valor de um Campo de arquivo, com as mesmas regras de quem
 * escreve: a Pessoa da conta (Convidado) só preenche os Campos liberados.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import { CP } from "./financeiro-base";
import { anexarArquivoEnviado, TETO_DO_ARQUIVO_ENVIADO, type ArquivoEnviado } from "./anexos-enviados";
import { setTaskFieldValue } from "./tasks";

const TAREFA = "tsk_cp_thiago_out"; // "para pagar", Pessoa = o Convidado abaixo
const FINANCEIRO = CP.financeiroId;
const PESSOA_DA_CONTA = "mem_thiago_pereira";

const pdf = (sobrescrever: Partial<ArquivoEnviado> = {}): ArquivoEnviado => ({
  nome: "NFS-e_21_03_08_2026.pdf",
  mime: "application/pdf",
  sizeBytes: 94_000,
  objectKey: "workspace/ws_n1/forms/tarefa-tsk_cp_thiago_out/9f0c/7a1d",
  sha256: "ab".repeat(32),
  ...sobrescrever,
});

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const tarefa = () => {
  const t = state.tasks.find((x) => x.id === TAREFA);
  if (!t) throw new Error("seed sem a conta de teste");
  return t;
};
const valorDoAnexo = () => tarefa().fieldValues.find((v) => v.definitionId === CP.fields.anexo)?.value;

describe("anexarArquivoEnviado — anexo da Tarefa", () => {
  it("o Financeiro anexa: Arquivo com a chave real do Storage, anexo na Tarefa e Atividade", () => {
    const r = anexarArquivoEnviado(state, FINANCEIRO, TAREFA, pdf(), { tipo: "anexo" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const arquivo = state.files.find((f) => f.id === r.value.fileId);
    expect(arquivo).toMatchObject({
      name: "NFS-e_21_03_08_2026.pdf",
      objectKey: "workspace/ws_n1/forms/tarefa-tsk_cp_thiago_out/9f0c/7a1d",
      sha256: "ab".repeat(32),
      mediaType: "document",
      state: "enviado",
    });
    expect(tarefa().attachments.at(-1)).toMatchObject({ fileId: r.value.fileId, displayName: "NFS-e_21_03_08_2026.pdf" });
    expect(state.activity[0]).toMatchObject({ action: "Anexo adicionado", objectId: TAREFA, after: "NFS-e_21_03_08_2026.pdf" });
  });

  it("a Pessoa da conta (Convidado) não anexa direto na Tarefa", () => {
    const antes = state.files.length;
    const r = anexarArquivoEnviado(state, PESSOA_DA_CONTA, TAREFA, pdf(), { tipo: "anexo" });
    expect(r.ok).toBe(false);
    expect(state.files).toHaveLength(antes);
  });
});

describe("anexarArquivoEnviado — Campo de arquivo", () => {
  it("a Pessoa da conta preenche o Anexo; o nome solto de antes sai e fica a lista de ids", () => {
    const anexo = tarefa().fieldValues.find((v) => v.definitionId === CP.fields.anexo);
    if (anexo) anexo.value = "nota-antiga.pdf";
    else tarefa().fieldValues.push({ definitionId: CP.fields.anexo, value: "nota-antiga.pdf", state: "ativo" });

    const primeiro = anexarArquivoEnviado(state, PESSOA_DA_CONTA, TAREFA, pdf(), { tipo: "campo", definitionId: CP.fields.anexo });
    expect(primeiro.ok).toBe(true);
    if (!primeiro.ok) return;
    expect(valorDoAnexo()).toEqual([primeiro.value.fileId]);

    const segundo = anexarArquivoEnviado(state, PESSOA_DA_CONTA, TAREFA, pdf({ nome: "boleto.pdf", objectKey: "workspace/ws_n1/forms/tarefa-x/1/2" }), {
      tipo: "campo",
      definitionId: CP.fields.anexo,
    });
    expect(segundo.ok).toBe(true);
    if (!segundo.ok) return;
    expect(valorDoAnexo()).toEqual([primeiro.value.fileId, segundo.value.fileId]);
  });

  it("a Pessoa da conta não preenche um Campo de arquivo que não foi liberado (Boleto)", () => {
    const r = anexarArquivoEnviado(state, PESSOA_DA_CONTA, TAREFA, pdf(), { tipo: "campo", definitionId: CP.fields.boleto });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/Como Convidado/);
  });

  it("um Campo que não é de arquivo é recusado", () => {
    const r = anexarArquivoEnviado(state, FINANCEIRO, TAREFA, pdf(), { tipo: "campo", definitionId: CP.fields.valor });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/não é de arquivo/);
  });
});

describe("anexarArquivoEnviado — o que nunca vira anexo", () => {
  it.each([
    ["sem nome", { nome: "   " }],
    ["tamanho zero", { sizeBytes: 0 }],
    ["acima de 25 MB", { sizeBytes: TETO_DO_ARQUIVO_ENVIADO + 1 }],
    ["a chave do protótipo", { objectKey: "legado/fil_x" }],
    ["sem chave", { objectKey: " " }],
  ] as const)("%s: recusa sem gravar nada", (_caso, sobrescrever) => {
    const antes = { files: state.files.length, anexos: tarefa().attachments.length };
    const r = anexarArquivoEnviado(state, FINANCEIRO, TAREFA, pdf(sobrescrever), { tipo: "anexo" });
    expect(r.ok).toBe(false);
    expect(state.files).toHaveLength(antes.files);
    expect(tarefa().attachments).toHaveLength(antes.anexos);
  });
});

describe("setTaskFieldValue — Campo de arquivo", () => {
  it("uma lista de ids só remove: tirar um arquivo do Anexo funciona", () => {
    const a = anexarArquivoEnviado(state, FINANCEIRO, TAREFA, pdf(), { tipo: "campo", definitionId: CP.fields.anexo });
    const b = anexarArquivoEnviado(state, FINANCEIRO, TAREFA, pdf({ objectKey: "workspace/ws_n1/forms/tarefa-x/3/4" }), { tipo: "campo", definitionId: CP.fields.anexo });
    if (!a.ok || !b.ok) throw new Error("setup");
    const r = setTaskFieldValue(state, FINANCEIRO, TAREFA, CP.fields.anexo, [b.value.fileId]);
    expect(r.ok).toBe(true);
    expect(valorDoAnexo()).toEqual([b.value.fileId]);
  });

  it("um id que não está no Campo é recusado — arquivo novo só pelo envio", () => {
    const deOutraTarefa = anexarArquivoEnviado(state, FINANCEIRO, "tsk_cp_das", pdf({ objectKey: "workspace/ws_n1/forms/tarefa-das/5/6" }), {
      tipo: "anexo",
    });
    if (!deOutraTarefa.ok) throw new Error(deOutraTarefa.error);
    const r = setTaskFieldValue(state, FINANCEIRO, TAREFA, CP.fields.anexo, [deOutraTarefa.value.fileId]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/envie o arquivo pela tela/);
  });

  it("o texto de antes (nome do arquivo) continua aceito", () => {
    const r = setTaskFieldValue(state, FINANCEIRO, TAREFA, CP.fields.anexo, "nota.pdf");
    expect(r.ok).toBe(true);
    expect(valorDoAnexo()).toBe("nota.pdf");
  });
});

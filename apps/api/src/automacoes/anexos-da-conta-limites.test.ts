/**
 * Os limites do pedido v1.2 do `/lancar` (06-07; 06-12 Task 3 (k)) em
 * `anexosDaConta` — puro: `buildSeed()`, arquivos fictícios e um `assinar`
 * falso. O schema do `/lancar` recusa com 400 `SCHEMA_INVALIDO` uma lista com
 * mais de 20 anexos ou uma `url` com mais de 2048 caracteres — e um 400 é
 * falha PERMANENTE da conta. A ponte nunca manda isso: só os primeiros 20 (em
 * ordem fixa) vão, o resto vira a contagem `acimaDoLimite`, e um link longo
 * demais vira aviso.
 *
 * Arquivo novo (CON-05): `anexos-da-conta.test.ts` fica como está.
 */

import { describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { CP } from "@n1/dominio/operations/financeiro";
import type { DataState, Task } from "@n1/dominio";
import { LIMITE_DE_ANEXOS, TAMANHO_MAXIMO_DA_URL_DO_ANEXO, anexosDaConta } from "./anexos-da-conta";

const F = CP.fields;

function contaLimpa(estado: DataState): Task {
  const t = estado.tasks.find((x) => x.id === "tsk_cp_das");
  if (!t) throw new Error("sem tsk_cp_das");
  t.fieldValues = t.fieldValues.filter((v) => v.definitionId !== F.anexo && v.definitionId !== F.boleto && v.definitionId !== F.qrCode);
  t.attachments = [];
  return t;
}

function arquivos(estado: DataState, quantos: number, nome = (i: number) => `arquivo-${String(i).padStart(2, "0")}.pdf`): string[] {
  const ids: string[] = [];
  for (let i = 1; i <= quantos; i += 1) {
    const id = `fil_${i}`;
    estado.files.push({
      id,
      workspaceId: estado.workspace.id,
      name: nome(i),
      mediaType: "document",
      sizeBytes: 100,
      createdBy: { kind: "member", id: CP.financeiroId },
      createdAt: "2026-09-01T12:00:00.000Z",
      objectKey: `obj/${id}`,
      state: "enviado",
    });
    ids.push(id);
  }
  return ids;
}

const assinarFalso = async (objectKey: string) => ({ downloadUrl: `https://storage.exemplo.invalid/${objectKey}?token=segredo` });

describe("anexosDaConta — os limites do pedido v1.2", () => {
  it("os mesmos números do schema do /lancar (06-07)", () => {
    expect(LIMITE_DE_ANEXOS).toBe(20);
    expect(TAMANHO_MAXIMO_DA_URL_DO_ANEXO).toBe(2048);
  });

  it("(k) 25 arquivos: 20 anexos, acimaDoLimite 5, e assinar chamado 20 vezes (não 25)", async () => {
    const estado = buildSeed();
    const t = contaLimpa(estado);
    const ids = arquivos(estado, 25);
    t.fieldValues.push({ definitionId: F.anexo, value: ids, state: "ativo" });
    let assinaturas = 0;
    const r = await anexosDaConta(estado, t, async (k) => {
      assinaturas += 1;
      return assinarFalso(k);
    });
    expect(r.anexos).toHaveLength(20);
    expect(r.anexos.map((a) => a.nome)).toEqual(ids.slice(0, 20).map((_, i) => `arquivo-${String(i + 1).padStart(2, "0")}.pdf`));
    expect(r.acimaDoLimite).toBe(5);
    expect(assinaturas).toBe(20);
  });

  it("(k) exatamente 20: sem a chave acimaDoLimite", async () => {
    const estado = buildSeed();
    const t = contaLimpa(estado);
    t.fieldValues.push({ definitionId: F.anexo, value: arquivos(estado, 20), state: "ativo" });
    const r = await anexosDaConta(estado, t, assinarFalso);
    expect(r.anexos).toHaveLength(20);
    expect(r).not.toHaveProperty("acimaDoLimite");
  });

  it("(k) a ordem fixa: Campos Anexo, Boleto e QR Code, depois os anexos da Tarefa — o que passa de 20 é o fim da lista", async () => {
    const estado = buildSeed();
    const t = contaLimpa(estado);
    const ids = arquivos(estado, 22);
    t.attachments = ids.slice(0, 19).map((fileId, order) => ({ fileId, order, mediaType: "document" as const, displayName: fileId }));
    t.fieldValues.push({ definitionId: F.qrCode, value: [ids[21]!], state: "ativo" });
    t.fieldValues.push({ definitionId: F.boleto, value: [ids[20]!], state: "ativo" });
    t.fieldValues.push({ definitionId: F.anexo, value: [ids[19]!], state: "ativo" });
    const r = await anexosDaConta(estado, t, assinarFalso);
    expect(r.anexos.slice(0, 3).map((a) => a.nome)).toEqual(["arquivo-20.pdf", "arquivo-21.pdf", "arquivo-22.pdf"]);
    expect(r.anexos).toHaveLength(20);
    expect(r.acimaDoLimite).toBe(2);
  });

  it("(k) URL assinada com 2 049 caracteres: aviso \"link de download longo demais\" e fora de anexos; com 2 048, vai", async () => {
    const estado = buildSeed();
    const t = contaLimpa(estado);
    const [longo, justo] = arquivos(estado, 2, (i) => (i === 1 ? "longo.pdf" : "justo.pdf"));
    t.fieldValues.push({ definitionId: F.anexo, value: [longo!, justo!], state: "ativo" });
    const r = await anexosDaConta(estado, t, async (k) => {
      const base = `https://storage.exemplo.invalid/${k}?token=`;
      const tamanho = k.endsWith("fil_1") ? 2049 : 2048;
      return { downloadUrl: base + "x".repeat(tamanho - base.length) };
    });
    expect(r.anexos.map((a) => a.nome)).toEqual(["justo.pdf"]);
    expect(r.anexos[0]?.url.length).toBe(2048);
    expect(r.avisos).toEqual([{ nome: "longo.pdf", erro: "link de download longo demais" }]);
    expect(JSON.stringify(r.avisos)).not.toContain("token=");
  });

  it("(k) nome só com espaços: o id do arquivo (como hoje)", async () => {
    const estado = buildSeed();
    const t = contaLimpa(estado);
    const [id] = arquivos(estado, 1, () => "   ");
    t.fieldValues.push({ definitionId: F.anexo, value: [id!], state: "ativo" });
    const r = await anexosDaConta(estado, t, assinarFalso);
    expect(r.anexos.map((a) => a.nome)).toEqual([id]);
  });
});

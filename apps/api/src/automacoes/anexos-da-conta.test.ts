/**
 * `anexosDaConta` (Plan 06-03, Task 1) — puro: `buildSeed()` com arquivos
 * fictícios em `state.files` e um `assinar` falso; nada toca o Storage, nada
 * precisa de `DATABASE_URL`.
 */

import { describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { CP } from "@n1/dominio/operations/financeiro";
import type { DataState, Task, WorkspaceFile } from "@n1/dominio";
import { anexosDaConta } from "./anexos-da-conta";

const F = CP.fields;

function arquivo(estado: DataState, id: string, name: string): WorkspaceFile {
  const f: WorkspaceFile = {
    id,
    workspaceId: estado.workspace.id,
    name,
    mediaType: "document",
    sizeBytes: 100,
    createdBy: { kind: "member", id: CP.financeiroId },
    createdAt: "2026-09-01T12:00:00.000Z",
    objectKey: `obj/${id}`,
    state: "enviado",
  };
  estado.files.push(f);
  return f;
}

function contaLimpa(estado: DataState): Task {
  const t = estado.tasks.find((x) => x.id === "tsk_cp_das");
  if (!t) throw new Error("sem tsk_cp_das");
  t.fieldValues = t.fieldValues.filter((v) => v.definitionId !== F.anexo && v.definitionId !== F.boleto && v.definitionId !== F.qrCode);
  t.attachments = [];
  return t;
}

const assinarFalso = async (objectKey: string) => ({ downloadUrl: `https://storage.exemplo.invalid/${objectKey}?token=segredo` });

describe("anexosDaConta — o que sobe ao Omie com o lançamento", () => {
  it("(a) Campos Anexo, Boleto, QR Code (Valores ativos) e anexos da Tarefa, em ordem e sem duplicata, com o nome original", async () => {
    const estado = buildSeed();
    const t = contaLimpa(estado);
    arquivo(estado, "fil_nf", "NFS-e 0021.pdf");
    arquivo(estado, "fil_boleto", "boleto-outubro.pdf");
    arquivo(estado, "fil_qr", "qrcode.png");
    arquivo(estado, "fil_extra", "comprovante.pdf");
    arquivo(estado, "fil_inativo", "antigo.pdf");
    t.fieldValues.push({ definitionId: F.anexo, value: ["fil_nf"], state: "ativo" });
    t.fieldValues.push({ definitionId: F.anexo, value: ["fil_inativo"], state: "arquivado" });
    t.fieldValues.push({ definitionId: F.boleto, value: ["fil_boleto", "fil_nf"], state: "ativo" });
    t.fieldValues.push({ definitionId: F.qrCode, value: "fil_qr", state: "ativo" });
    t.attachments = [
      { fileId: "fil_extra", order: 0, mediaType: "document", displayName: "comprovante.pdf" },
      { fileId: "fil_boleto", order: 1, mediaType: "document", displayName: "boleto" },
    ];
    const chaves: string[] = [];

    const { anexos, avisos } = await anexosDaConta(estado, t, async (k) => {
      chaves.push(k);
      return assinarFalso(k);
    });

    expect(anexos).toEqual([
      { url: "https://storage.exemplo.invalid/obj/fil_nf?token=segredo", nome: "NFS-e 0021.pdf" },
      { url: "https://storage.exemplo.invalid/obj/fil_boleto?token=segredo", nome: "boleto-outubro.pdf" },
      { url: "https://storage.exemplo.invalid/obj/fil_qr?token=segredo", nome: "qrcode.png" },
      { url: "https://storage.exemplo.invalid/obj/fil_extra?token=segredo", nome: "comprovante.pdf" },
    ]);
    expect(chaves).toEqual(["obj/fil_nf", "obj/fil_boleto", "obj/fil_qr", "obj/fil_extra"]);
    expect(avisos).toEqual([]);
  });

  it("(b) id sem WorkspaceFile vira aviso ('arquivo não encontrado'), nunca exceção — os outros seguem", async () => {
    const estado = buildSeed();
    const t = contaLimpa(estado);
    arquivo(estado, "fil_nf", "nf.pdf");
    t.fieldValues.push({ definitionId: F.anexo, value: ["fil_sumiu", "fil_nf"], state: "ativo" });

    const { anexos, avisos } = await anexosDaConta(estado, t, assinarFalso);

    expect(anexos.map((a) => a.nome)).toEqual(["nf.pdf"]);
    expect(avisos).toEqual([{ nome: "fil_sumiu", erro: "arquivo não encontrado" }]);
  });

  it("(c) assinatura que falha para um arquivo vira aviso com o nome (sem a mensagem da exceção); os outros seguem", async () => {
    const estado = buildSeed();
    const t = contaLimpa(estado);
    arquivo(estado, "fil_a", "a.pdf");
    arquivo(estado, "fil_b", "b.pdf");
    t.fieldValues.push({ definitionId: F.anexo, value: ["fil_a", "fil_b"], state: "ativo" });

    const { anexos, avisos } = await anexosDaConta(estado, t, async (k) => {
      if (k === "obj/fil_a") throw new Error("falhou em https://storage.exemplo.invalid/obj/fil_a?token=x");
      return assinarFalso(k);
    });

    expect(anexos.map((a) => a.nome)).toEqual(["b.pdf"]);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]?.nome).toBe("a.pdf");
    expect(JSON.stringify(avisos)).not.toContain("token");
  });

  it("(d) conta sem arquivo nenhum: listas vazias, e assinar nunca é chamado", async () => {
    const estado = buildSeed();
    const t = contaLimpa(estado);
    let chamadas = 0;
    const r = await anexosDaConta(estado, t, async (k) => {
      chamadas += 1;
      return assinarFalso(k);
    });
    expect(r).toEqual({ anexos: [], avisos: [] });
    expect(chamadas).toBe(0);
  });

  it("nome maior que o teto do contrato (200) é cortado — o /lancar recusaria o corpo inteiro", async () => {
    const estado = buildSeed();
    const t = contaLimpa(estado);
    arquivo(estado, "fil_longo", `${"a".repeat(250)}.pdf`);
    t.fieldValues.push({ definitionId: F.anexo, value: ["fil_longo"], state: "ativo" });
    const { anexos } = await anexosDaConta(estado, t, assinarFalso);
    expect(anexos[0]?.nome.length).toBe(200);
  });
});

/**
 * Checklist 7.3 — o anexo de verdade da Tarefa. Sem banco nem bucket: a
 * autenticação e a forma das duas rotas, as recusas da sessão de envio, as
 * mensagens, e a ponte levando ao `/lancar` o arquivo que
 * `anexarArquivoEnviado` ligou à conta (com a chave real do Storage).
 */
import { describe, expect, it } from "vitest";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import { CP } from "@n1/dominio/operations";
import { anexarArquivoEnviado } from "@n1/dominio/operations/anexos-enviados";
import { buildApp } from "../app";
import { anexosDaConta } from "../automacoes/anexos-da-conta";
import type { SessaoDeUpload } from "../persistencia/sessoes-de-upload";
import { formIdDaTarefa, mensagemDaRecusaDoArquivo, recusaDaSessaoDaTarefa } from "./anexos-da-tarefa";

const MARYANE = usuarioDoSeed("mem_maryane");
const semente = buildSeed();

function appDeTeste() {
  return buildApp({
    logger: false,
    workspaceId: "ws_anexos_teste",
    verificarToken: async (token) => (token === "token-maryane" ? { sub: MARYANE } : null),
    resolverMembro: async (_workspaceId, userId) => semente.members.find((m) => m.userId === userId),
  });
}

describe("as rotas de anexo da Tarefa — sem banco", () => {
  it.each(["ticket", "confirmar"])("POST …/anexos/%s sem token responde 401", async (rota) => {
    const resposta = await appDeTeste().inject({ method: "POST", url: `/tarefas/tsk_cp_das/anexos/${rota}`, payload: {} });
    expect(resposta.statusCode).toBe(401);
  });

  it("ticket com tipo de arquivo fora da lista responde 400 antes de qualquer leitura", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/tarefas/tsk_cp_das/anexos/ticket",
      headers: { authorization: "Bearer token-maryane" },
      payload: { nome: "planilha.xlsx", mime: "application/vnd.ms-excel" },
    });
    expect(resposta.statusCode).toBe(400);
  });

  it("confirmação com campo a mais responde 400 (corpo estrito)", async () => {
    const resposta = await appDeTeste().inject({
      method: "POST",
      url: "/tarefas/tsk_cp_das/anexos/confirmar",
      headers: { authorization: "Bearer token-maryane" },
      payload: { submissionId: "s", objectId: "o", objectKey: "workspace/forjada" },
    });
    expect(resposta.statusCode).toBe(400);
  });
});

describe("recusaDaSessaoDaTarefa", () => {
  const agora = new Date("2026-10-01T12:00:00Z");
  const sessao = (sobrescrever: Partial<SessaoDeUpload> = {}): SessaoDeUpload => ({
    id: "sess",
    workspaceId: "ws_n1",
    formId: formIdDaTarefa("tsk_a"),
    createdAt: new Date("2026-10-01T11:00:00Z"),
    expiresAt: new Date("2026-10-01T13:00:00Z"),
    consumedAt: null,
    ...sobrescrever,
  });

  it("a sessão desta Tarefa, neste Espaço, aberta e no prazo, serve", () => {
    expect(recusaDaSessaoDaTarefa(sessao(), "ws_n1", "tsk_a", agora)).toBeUndefined();
  });
  it.each([
    ["inexistente", undefined, "ws_n1", "tsk_a"],
    ["de outra Tarefa", sessao(), "ws_n1", "tsk_b"],
    ["de outro Espaço", sessao(), "ws_outro", "tsk_a"],
    ["de um Formulário público", sessao({ formId: "frm_123" }), "ws_n1", "tsk_a"],
    ["já consumida", sessao({ consumedAt: new Date("2026-10-01T11:30:00Z") }), "ws_n1", "tsk_a"],
    ["vencida", sessao({ expiresAt: new Date("2026-10-01T11:59:00Z") }), "ws_n1", "tsk_a"],
  ] as const)("%s: recusa", (_caso, s, ws, task) => {
    expect(recusaDaSessaoDaTarefa(s, ws, task, agora)).toBeTypeOf("string");
  });
  it("o formId da Tarefa não tem `:` (vira parte da chave do objeto)", () => {
    expect(formIdDaTarefa("tsk_cp_das")).toBe("tarefa-tsk_cp_das");
  });
});

describe("mensagemDaRecusaDoArquivo", () => {
  it.each(["objeto_nao_pertence_a_sessao", "objeto_ausente", "tamanho_excedido", "tipo_nao_confere", "assinatura_nao_confere"] as const)(
    "%s: frase para quem anexou, sem caminho de objeto",
    (motivo) => {
      const frase = mensagemDaRecusaDoArquivo(motivo);
      expect(frase.length).toBeGreaterThan(10);
      expect(frase).not.toMatch(/workspace\/|forms\/|storage/);
    },
  );
});

describe("a ponte leva ao /lancar o arquivo enviado", () => {
  it("o Anexo da conta vira { url assinada, nome } — nada de `legado/`", async () => {
    const state = buildSeed();
    const r = anexarArquivoEnviado(
      state,
      CP.financeiroId,
      "tsk_cp_das",
      { nome: "guia-das.pdf", mime: "application/pdf", sizeBytes: 1_234, objectKey: "workspace/ws_n1/forms/tarefa-tsk_cp_das/s/o" },
      { tipo: "campo", definitionId: CP.fields.anexo },
    );
    if (!r.ok) throw new Error(r.error);
    const task = state.tasks.find((t) => t.id === "tsk_cp_das");
    if (!task) throw new Error("seed sem tsk_cp_das");
    const assinadas: string[] = [];
    const { anexos, avisos } = await anexosDaConta(state, task, async (objectKey) => {
      assinadas.push(objectKey);
      return { downloadUrl: `https://projeto.supabase.co/storage/v1/object/sign/solicitacoes/${objectKey}?token=x` };
    });
    expect(assinadas).toContain("workspace/ws_n1/forms/tarefa-tsk_cp_das/s/o");
    expect(anexos).toContainEqual({ url: expect.stringContaining("/storage/v1/object/sign/"), nome: "guia-das.pdf" });
    expect(avisos.filter((a) => a.nome === "guia-das.pdf")).toHaveLength(0);
  });
});

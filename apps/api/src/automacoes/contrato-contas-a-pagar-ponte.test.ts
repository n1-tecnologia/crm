/**
 * Contrato `contas-a-pagar-v1`/v1.1 visto pela ponte em DOIS momentos (Plan
 * 06-03). O mesmo papel de `contrato-contas-a-pagar.test.ts` §"a ponte de
 * ponta a ponta com as respostas canônicas" — provar que a ponte age sobre
 * cada exemplo do produtor como o contrato declara —, agora no fluxo da Fase
 * 6: o `/resolver` publica o Resumo para conferência; o `/lancar` só sai com a
 * Conferência aprovada e a conta em "em lançamento omie"; a falha permanente
 * volta a conta para "para pagar" (D6-03).
 *
 * Arquivo novo (CON-05): os casos de ponta a ponta do arquivo antigo provam o
 * fluxo de antes da Fase 6 (lançar sem Conferência) e ficam como estão.
 *
 * Sem banco e sem rede real: servidor HTTP falso em loopback e Unidade de
 * Trabalho em memória.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { decideProcessApproval } from "@n1/dominio/operations/ai";
import { CP, conferenciaDoResumo } from "@n1/dominio/operations/financeiro";
import { addTaskComment, changeTaskStatus } from "@n1/dominio/operations/tasks";
import type { DataState, Task, WorkspaceFile } from "@n1/dominio";
import { criarServidorFalso, type ServidorFalso } from "../testes/servidor-falso";
import { criarPonteDoAgente } from "./invocar-agente";

interface Exemplo {
  readonly requisicao: { readonly caminho: string; readonly body: Record<string, unknown> };
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
const CATEGORIA = "Impostos";
const RESOLVER = "/v1/integrations/contas-a-pagar/resolver";
const LANCAR = "/v1/integrations/contas-a-pagar/lancar";

describe("contrato — a ponte em dois momentos com as respostas canônicas", () => {
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
    t.fieldValues.push({ definitionId: CP.fields.categoria, value: CATEGORIA, state: "ativo" });
    return t;
  }

  function ponte(estado: DataState) {
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
    });
  }

  /** Momento 1 com `resolver.sucesso-resolvida`, conferido por clique e movido para "em lançamento omie". */
  async function conferidaEmLancamento(estado: DataState, t: Task, p: ReturnType<typeof ponte>): Promise<void> {
    servidor.enfileirar(responder("resolver.sucesso-resolvida.json"));
    await p.processarContas();
    const c = conferenciaDoResumo(estado, t).conferencia;
    if (!c) throw new Error("sem Conferência depois do Momento 1");
    const d = decideProcessApproval(estado, MARYANE, c.id, "aprovada", { source: "click" });
    if (!d.ok) throw new Error(d.error);
    const m = changeTaskStatus(estado, MARYANE, t.id, S.emLancamento);
    if (!m.ok) throw new Error(m.error);
  }

  it("resolver.sucesso-resolvida publica o Resumo para conferência — nenhuma requisição a /lancar", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const t = das(estado);
    servidor.enfileirar(responder("resolver.sucesso-resolvida.json"));
    await ponte(estado).processarContas();
    expect(servidor.recebidas.map((r) => r.caminho)).toEqual([RESOLVER]);
    expect(t.comments.some((c) => c.content.startsWith("📋 RESUMO DE PAGAMENTO"))).toBe(true);
    expect(conferenciaDoResumo(estado, t).estado).toBe("pendente");
  });

  it.each([
    ["lancar.sucesso.json", ""],
    ["lancar.sucesso-reaproveitado.json", " (título já existia)"],
  ])("%s depois da conferência: a conta vai para \"lançado omie\" com a confirmação no fio", async (arquivo, sufixo) => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const t = das(estado);
    const p = ponte(estado);
    await conferidaEmLancamento(estado, t, p);
    servidor.enfileirar(responder(arquivo));

    await p.processarContas();

    expect(servidor.recebidas.map((r) => r.caminho)).toEqual([RESOLVER, LANCAR]);
    expect(t.statusId).toBe(S.lancado);
    const payableId = String(exemplo(arquivo).resposta.corpo.payableId);
    const confirmacao = t.comments.find((c) => c.content.startsWith("✅ Lançado no Omie"));
    expect(confirmacao?.content.startsWith(`✅ Lançado no Omie — título ${payableId} · `)).toBe(true);
    expect(confirmacao?.content.split("\n")[0]?.endsWith(`sem anexos${sufixo}`)).toBe(true);
  });

  it.each([
    "lancar.erro-422-omie-recusou.json",
    "lancar.erro-422-fornecedor-nao-resolvido.json",
    "lancar.erro-422-conta-corrente-nao-resolvida.json",
    "lancar.erro-422-regra-de-dominio.json",
  ])("%s: o motivo vira Comentário, a conta volta para \"para pagar\" (D6-03), e a ponte não chama de novo", async (arquivo) => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const t = das(estado);
    const p = ponte(estado);
    await conferidaEmLancamento(estado, t, p);
    servidor.enfileirar(responder(arquivo));

    await p.processarContas();
    await p.processarContas();

    const erro = exemplo(arquivo).resposta.corpo.error as { code: string; message: string; details?: { motivo?: string } };
    const motivo = (erro.details?.motivo ?? erro.message).replace(/\s+/g, " ").trim();
    expect(t.statusId).toBe(S.paraPagar);
    expect(t.comments.filter((c) => c.author.kind === "agent" && c.content.includes(motivo) && c.content.includes(`(${erro.code})`))).toHaveLength(1);
    expect(servidor.recebidas.map((r) => r.caminho)).toEqual([RESOLVER, LANCAR]);
  });

  it("lancar.erro-500-omie-indisponivel: transitório — sem Comentário na primeira falha, a conta fica", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const t = das(estado);
    const p = ponte(estado);
    await conferidaEmLancamento(estado, t, p);
    const antes = t.comments.length;
    servidor.enfileirar(responder("lancar.erro-500-omie-indisponivel.json"));
    await p.processarContas();
    expect(t.statusId).toBe(S.emLancamento);
    expect(t.comments.length).toBe(antes);
  });

  it("v1.1 — o /resolver do Resumo revisado usa só campos que o exemplo resolver.sucesso-pedido-de-revisao declara", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const t = das(estado);
    const p = ponte(estado);
    servidor.enfileirar(responder("resolver.sucesso-resolvida.json"));
    await p.processarContas();
    const c = conferenciaDoResumo(estado, t).conferencia;
    if (!c) throw new Error("sem Conferência");
    const r = addTaskComment(estado, MARYANE, t.id, { content: "é comercial", parentCommentId: c.origin.threadCommentId });
    if (!r.ok) throw new Error(r.error);
    await p.processarContas(); // o fio vira ajuste pedido
    servidor.enfileirar(responder("resolver.sucesso-pedido-de-revisao.json"));
    await p.processarContas();

    const enviado = servidor.recebidas[1]?.corpo as Record<string, unknown>;
    const declarados = Object.keys(exemplo("resolver.sucesso-pedido-de-revisao.json").requisicao.body);
    expect(enviado.pedidoDeRevisao).toBe("é comercial");
    for (const campo of Object.keys(enviado)) expect(declarados, campo).toContain(campo);
  });

  it("v1.1 — o /lancar com anexos manda a forma do exemplo lancar.sucesso-anexos-nomeados e conta o que a resposta devolve", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const t = das(estado);
    const arquivos: WorkspaceFile[] = [
      { id: "fil_1", workspaceId: estado.workspace.id, name: "NFS-e 21.pdf", mediaType: "document", sizeBytes: 1, createdBy: { kind: "member", id: MARYANE }, createdAt: "2026-09-01T00:00:00.000Z", objectKey: "obj_1", state: "enviado" },
      { id: "fil_2", workspaceId: estado.workspace.id, name: "Boleto outubro.pdf", mediaType: "document", sizeBytes: 1, createdBy: { kind: "member", id: MARYANE }, createdAt: "2026-09-01T00:00:00.000Z", objectKey: "obj_2", state: "enviado" },
    ];
    estado.files.push(...arquivos);
    t.fieldValues = t.fieldValues.filter((v) => v.definitionId !== CP.fields.boleto);
    t.fieldValues.push({ definitionId: CP.fields.anexo, value: ["fil_1"], state: "ativo" });
    t.fieldValues.push({ definitionId: CP.fields.boleto, value: ["fil_2"], state: "ativo" });
    const p = ponte(estado);
    await conferidaEmLancamento(estado, t, p);
    servidor.enfileirar(responder("lancar.sucesso-anexos-nomeados.json"));

    await p.processarContas();

    const enviado = servidor.recebidas[1]?.corpo as { anexos?: Array<Record<string, unknown>>; codigoCategoriaConfirmado?: string };
    const doExemplo = (exemplo("lancar.sucesso-anexos-nomeados.json").requisicao.body.anexos as unknown[]).find((a) => typeof a === "object") as Record<string, unknown>;
    expect(enviado.anexos?.map((a) => Object.keys(a).sort())).toEqual([Object.keys(doExemplo).sort(), Object.keys(doExemplo).sort()]);
    expect(enviado.anexos?.map((a) => a.nome)).toEqual(["NFS-e 21.pdf", "Boleto outubro.pdf"]);
    expect(enviado.codigoCategoriaConfirmado).toMatch(/^\d(\.\d{2}){2,3}$/);
    expect(t.statusId).toBe(S.lancado);
    const confirmacao = t.comments.find((c) => c.content.startsWith("✅ Lançado no Omie"))?.content ?? "";
    // v1.2 (06-12): a resposta é casada pelo nome com os DOIS anexos enviados
    // (um ok, um falhou); o terceiro item do exemplo (o anexo em string) não
    // tem par no pedido da ponte e vira só a contagem no log.
    expect(confirmacao).toContain("anexos 1 de 2");
    // v1.2 (06-07): o erro é um código da lista fechada; 06-12 traduz o código para texto.
    expect(confirmacao).toContain("• Boleto outubro.pdf: não subiu (ANEXO_DOWNLOAD_FALHOU)");
    expect(confirmacao).not.toContain("assinatura=");
  });
});

describe("contrato — os exemplos que a ponte em dois momentos usa", () => {
  it("estão todos na pasta", () => {
    const presentes = readdirSync(PASTA);
    for (const f of ["resolver.sucesso-resolvida.json", "resolver.sucesso-pedido-de-revisao.json", "lancar.sucesso-anexos-nomeados.json", "lancar.erro-422-regra-de-dominio.json"]) {
      expect(presentes).toContain(f);
    }
  });
});

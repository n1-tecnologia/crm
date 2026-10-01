/**
 * Checklist 7.3 — o envio do anexo da Tarefa pelo navegador: ticket, bytes
 * direto ao bucket, confirmação. Sem rede: `fetch` e o envio de bytes são
 * injetados.
 */
import { describe, expect, it, vi } from "vitest";
import { enviarArquivoDaTarefa, type DependenciasDoAnexo } from "./anexos-da-tarefa";

const pdf = (nome = "nota.pdf", tipo = "application/pdf", tamanho = 1_000) => new File([new Uint8Array(tamanho)], nome, { type: tipo });

function resposta(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
}

function deps(respostas: Response[], enviarBytes: DependenciasDoAnexo["enviarBytes"] = async () => true) {
  const fetchFalso = vi.fn<typeof fetch>(async () => {
    const proxima = respostas.shift();
    if (!proxima) throw new Error("fetch chamado mais vezes que o esperado");
    return proxima;
  });
  return {
    fetchFalso,
    deps: { apiUrl: "http://api.teste", token: async () => "tok", fetch: fetchFalso, enviarBytes } satisfies DependenciasDoAnexo,
  };
}

const TICKET_OK = { ok: true, submissionId: "sess-1", objectId: "obj-1", uploadUrl: "https://bucket/upload?token=x" };

describe("enviarArquivoDaTarefa", () => {
  it("ticket → bytes ao bucket → confirmação: devolve o id do Arquivo e manda o campo nas duas chamadas", async () => {
    const enviarBytes = vi.fn<DependenciasDoAnexo["enviarBytes"]>(async (_url, _file, aoProgredir) => {
      aoProgredir(100);
      return true;
    });
    const { fetchFalso, deps: d } = deps([resposta(200, TICKET_OK), resposta(200, { ok: true, value: { fileId: "fil_9" } })], enviarBytes);
    const progresso: number[] = [];
    const r = await enviarArquivoDaTarefa("tsk_1", pdf(), { campoId: "fd_cp_anexo", aoProgredir: (p) => progresso.push(p) }, d);

    expect(r).toEqual({ ok: true, fileId: "fil_9" });
    expect(enviarBytes).toHaveBeenCalledWith("https://bucket/upload?token=x", expect.any(File), expect.any(Function));
    expect(progresso).toEqual([100]);
    const [ticketUrl, ticketInit] = fetchFalso.mock.calls[0]!;
    expect(ticketUrl).toBe("http://api.teste/tarefas/tsk_1/anexos/ticket");
    expect(JSON.parse(String(ticketInit?.body))).toEqual({ nome: "nota.pdf", mime: "application/pdf", campoId: "fd_cp_anexo" });
    expect((ticketInit?.headers as Record<string, string>).authorization).toBe("Bearer tok");
    const [confirmarUrl, confirmarInit] = fetchFalso.mock.calls[1]!;
    expect(confirmarUrl).toBe("http://api.teste/tarefas/tsk_1/anexos/confirmar");
    expect(JSON.parse(String(confirmarInit?.body))).toEqual({ submissionId: "sess-1", objectId: "obj-1", campoId: "fd_cp_anexo" });
  });

  it("sem campo, é anexo da Tarefa: o corpo não leva campoId", async () => {
    const { fetchFalso, deps: d } = deps([resposta(200, TICKET_OK), resposta(200, { ok: true, value: { fileId: "fil_1" } })]);
    await enviarArquivoDaTarefa("tsk_1", pdf(), {}, d);
    expect(JSON.parse(String(fetchFalso.mock.calls[0]![1]?.body))).not.toHaveProperty("campoId");
  });

  it("tipo fora da lista é recusado no navegador, sem rede", async () => {
    const { fetchFalso, deps: d } = deps([]);
    const r = await enviarArquivoDaTarefa("tsk_1", pdf("planilha.xlsx", "application/vnd.ms-excel"), {}, d);
    expect(r.ok).toBe(false);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("a recusa do servidor no ticket volta com a frase dele", async () => {
    const { deps: d } = deps([resposta(403, { ok: false, error: "Como Convidado, você só preenche Anexo e Data de Emissão nesta Tarefa." })]);
    const r = await enviarArquivoDaTarefa("tsk_1", pdf(), { campoId: "fd_cp_boleto" }, d);
    expect(r).toEqual({ ok: false, erro: "Como Convidado, você só preenche Anexo e Data de Emissão nesta Tarefa." });
  });

  it("os bytes que não chegam ao bucket não pedem confirmação", async () => {
    const { fetchFalso, deps: d } = deps([resposta(200, TICKET_OK)], async () => false);
    const r = await enviarArquivoDaTarefa("tsk_1", pdf(), {}, d);
    expect(r.ok).toBe(false);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it("a confirmação recusada pelo servidor (422) volta com a frase dele", async () => {
    const { deps: d } = deps([resposta(200, TICKET_OK), resposta(422, { ok: false, error: "O conteúdo do arquivo não confere com o tipo dele." })]);
    expect(await enviarArquivoDaTarefa("tsk_1", pdf(), {}, d)).toEqual({ ok: false, erro: "O conteúdo do arquivo não confere com o tipo dele." });
  });

  it("a recusa do domínio vem com 200 e ok: false — também é erro", async () => {
    const { deps: d } = deps([resposta(200, TICKET_OK), resposta(200, { ok: false, error: "Esta Tarefa não está ativa." })]);
    expect(await enviarArquivoDaTarefa("tsk_1", pdf(), {}, d)).toEqual({ ok: false, erro: "Esta Tarefa não está ativa." });
  });

  it("sem sessão, nada é pedido", async () => {
    const { fetchFalso, deps: d } = deps([]);
    const r = await enviarArquivoDaTarefa("tsk_1", pdf(), {}, { ...d, token: async () => undefined });
    expect(r.ok).toBe(false);
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});

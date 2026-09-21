// @vitest-environment jsdom
/**
 * V02-02D — prova de seletor dos onze casos (a)-(k) do upload por arquivo e
 * da confirmação pública. Roda contra `FormularioPublico` inteiro (não o
 * `UploadDeArquivos` isolado) porque vários casos — (b) preservar respostas,
 * (d) travar o CTA, (h)/(i)/(j) a confirmação — só existem na integração
 * entre o controle de upload e o formulário. `transportePublico` é mockado;
 * a jornada de navegador contra o `apps/api` de verdade é o Playwright do
 * mesmo plano (`e2e/formulario-publico.spec.ts`).
 *
 * `XMLHttpRequest` é substituído por um fake controlável (`XhrFalso`) — o
 * envio de bytes ao bucket usa XHR (não `fetch`) por causa do progresso real
 * (`upload-de-arquivos.tsx`), e o teste dirige manualmente
 * `onprogress`/`onload`/`onerror` de cada instância.
 */

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FormularioPublico } from "./formulario";
import { transportePublico } from "@/dados/transporte-publico";
import type { FormularioPublicoDto } from "@/dados/transporte-publico";

vi.mock("@/dados/transporte-publico", () => ({
  transportePublico: {
    obterFormulario: vi.fn(),
    pedirTicket: vi.fn(),
    enviarSubmissao: vi.fn(),
  },
}));

const pedirTicketMock = vi.mocked(transportePublico.pedirTicket);
const enviarSubmissaoMock = vi.mocked(transportePublico.enviarSubmissao);

/** Um `XMLHttpRequest` falso e controlável — cada instância criada fica em `XhrFalso.instancias`. */
class XhrFalso {
  static instancias: XhrFalso[] = [];
  method = "";
  url = "";
  status = 0;
  enviados: unknown[] = [];
  upload: { onprogress: ((evento: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = {
    onprogress: null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  constructor() {
    XhrFalso.instancias.push(this);
  }
  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }
  send(body: unknown): void {
    this.enviados.push(body);
  }
  abort(): void {
    this.onabort?.();
  }
}

function ticketOk(overrides: Partial<{ submissionId: string; objectId: string; uploadUrl: string }> = {}) {
  return {
    tipo: "ok" as const,
    submissionId: overrides.submissionId ?? "sess_1",
    objectId: overrides.objectId ?? "obj_1",
    uploadUrl: overrides.uploadUrl ?? "https://bucket.teste/upload",
    token: "tok_1",
    expiresAt: "2026-01-01T00:00:00.000Z",
  };
}

/** `File` de teste com `size` controlado sem alocar bytes de verdade. */
function arquivoFalso(nome: string, tipo: string, tamanho = 1024): File {
  const arquivo = new File(["conteudo"], nome, { type: tipo });
  Object.defineProperty(arquivo, "size", { value: tamanho });
  return arquivo;
}

function montarFormulario(): FormularioPublicoDto {
  return {
    formId: "frm_teste",
    title: "Solicitação de pagamento",
    questions: [
      { id: "q_titulo", label: "O que deve ser pago?", required: true, kind: "text" },
      { id: "q_cc", label: "Centro de Custo", required: true, kind: "singleSelect", options: ["TRIA"] },
      { id: "q_anexo", label: "Anexo", required: false, kind: "file", accept: ["application/pdf"] },
    ],
  };
}

function renderizar() {
  return render(<FormularioPublico secret="segredo-de-teste" formulario={montarFormulario()} />);
}

function inputDeAnexo(): HTMLInputElement {
  return screen.getByLabelText("Anexo", { exact: false }) as HTMLInputElement;
}

function preencherMinimo(): void {
  fireEvent.change(screen.getByLabelText("O que deve ser pago?", { exact: false }), { target: { value: "Pagamento de teste" } });
  fireEvent.click(screen.getByRole("combobox", { name: "Centro de Custo" }));
  fireEvent.click(screen.getByRole("option", { name: "TRIA" }));
}

beforeEach(() => {
  pedirTicketMock.mockReset();
  enviarSubmissaoMock.mockReset();
  XhrFalso.instancias = [];
  vi.stubGlobal("XMLHttpRequest", XhrFalso as unknown as typeof XMLHttpRequest);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("UploadDeArquivos — estados por arquivo", () => {
  it("(a) escolher um arquivo mostra aguardando, depois enviando com percentual, depois enviado", async () => {
    pedirTicketMock.mockResolvedValue(ticketOk());
    renderizar();

    act(() => {
      fireEvent.change(inputDeAnexo(), { target: { files: [arquivoFalso("nota.pdf", "application/pdf")] } });
    });

    expect(screen.getByText("Aguardando envio")).toBeTruthy();

    await waitFor(() => expect(screen.getByText(/^Enviando \d+%$/)).toBeTruthy());

    const xhr = XhrFalso.instancias.at(-1)!;
    act(() => xhr.upload.onprogress?.({ lengthComputable: true, loaded: 42, total: 100 }));
    await waitFor(() => expect(screen.getByText("Enviando 42%")).toBeTruthy());

    xhr.status = 200;
    act(() => xhr.onload?.());
    await waitFor(() => expect(screen.getByText("Arquivo enviado")).toBeTruthy());
  });

  it("(b) falha no upload mostra a copy exata e preserva as outras respostas", async () => {
    pedirTicketMock.mockResolvedValue(ticketOk());
    renderizar();
    fireEvent.change(screen.getByLabelText("O que deve ser pago?", { exact: false }), { target: { value: "Não perder isto" } });

    act(() => {
      fireEvent.change(inputDeAnexo(), { target: { files: [arquivoFalso("nota.pdf", "application/pdf")] } });
    });
    await waitFor(() => expect(XhrFalso.instancias.length).toBe(1));

    const xhr = XhrFalso.instancias[0]!;
    xhr.status = 500;
    act(() => xhr.onload?.());

    await waitFor(() => expect(screen.getByText("Não foi possível enviar este arquivo.")).toBeTruthy());
    expect(screen.getByLabelText("O que deve ser pago?", { exact: false })).toHaveProperty("value", "Não perder isto");
  });

  it("(c) Tentar novamente reenvia com a MESMA submissionId da sessão já aberta", async () => {
    pedirTicketMock.mockResolvedValueOnce(ticketOk({ submissionId: "sess_aberta" }));
    renderizar();

    act(() => {
      fireEvent.change(inputDeAnexo(), { target: { files: [arquivoFalso("nota.pdf", "application/pdf")] } });
    });
    await waitFor(() => expect(XhrFalso.instancias.length).toBe(1));
    const primeiroXhr = XhrFalso.instancias[0]!;
    act(() => primeiroXhr.onerror?.());
    await waitFor(() => expect(screen.getByText("Tentar novamente")).toBeTruthy());

    pedirTicketMock.mockResolvedValueOnce(ticketOk({ submissionId: "sess_aberta" }));
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await waitFor(() => expect(pedirTicketMock).toHaveBeenCalledTimes(2));
    expect(pedirTicketMock.mock.calls[0]![0].submissionId).toBeUndefined();
    expect(pedirTicketMock.mock.calls[1]![0].submissionId).toBe("sess_aberta");
  });

  it("(d) com um arquivo enviando, o CTA principal fica desabilitado com o motivo visível", async () => {
    pedirTicketMock.mockResolvedValue(ticketOk());
    renderizar();

    act(() => {
      fireEvent.change(inputDeAnexo(), { target: { files: [arquivoFalso("nota.pdf", "application/pdf")] } });
    });
    await waitFor(() => expect(screen.getByText(/^Enviando \d+%$/)).toBeTruthy());

    const cta = screen.getByRole("button", { name: "Enviar solicitação" });
    expect(cta.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Aguarde o envio dos arquivos ou remova os que falharam.")).toBeTruthy();
  });

  it("(e) arquivo grande demais e tipo fora da allowlist são recusados no cliente; um arquivo válido no mesmo lote ainda chega ao servidor", async () => {
    pedirTicketMock.mockResolvedValue(ticketOk());
    renderizar();

    const grande = arquivoFalso("grande.pdf", "application/pdf", 26 * 1024 * 1024);
    const tipoErrado = arquivoFalso("virus.exe", "application/x-msdownload", 1024);
    const valido = arquivoFalso("ok.pdf", "application/pdf", 1024);

    act(() => {
      fireEvent.change(inputDeAnexo(), { target: { files: [grande, tipoErrado, valido] } });
    });

    expect(screen.getByText("Este arquivo é maior que 25 MB.")).toBeTruthy();
    expect(screen.getByText("Este tipo de arquivo não é aceito.")).toBeTruthy();

    // O cliente recusa DOIS dos três — mas o terceiro (válido) ainda pede ticket ao servidor:
    // a validação client-side é cortesia, nunca a única barreira.
    await waitFor(() => expect(pedirTicketMock).toHaveBeenCalledTimes(1));
    expect(pedirTicketMock.mock.calls[0]![0].displayName).toBe("ok.pdf");
  });

  it("(f) o 11º arquivo do envio é recusado", async () => {
    pedirTicketMock.mockResolvedValue(ticketOk());
    renderizar();

    const onze = Array.from({ length: 11 }, (_, i) => arquivoFalso(`arquivo-${i}.pdf`, "application/pdf", 1024));
    act(() => {
      fireEvent.change(inputDeAnexo(), { target: { files: onze } });
    });

    await waitFor(() => expect(pedirTicketMock).toHaveBeenCalledTimes(10));
    expect(screen.queryByText("arquivo-10.pdf")).toBeNull();
    expect(screen.getAllByText(/^arquivo-\d\.pdf$/)).toHaveLength(10);
  });

  it("(g) Remover arquivo não abre um ConfirmDialog destrutivo", async () => {
    pedirTicketMock.mockResolvedValue(ticketOk());
    renderizar();

    act(() => {
      fireEvent.change(inputDeAnexo(), { target: { files: [arquivoFalso("nota.pdf", "application/pdf")] } });
    });
    expect(screen.getByText("Aguardando envio")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Remover arquivo" }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByText("nota.pdf")).toBeNull();
  });

  it("(k) o upload é operável só por teclado: o input é alcançável pelo rótulo, sem exigir drag", () => {
    renderizar();
    const input = inputDeAnexo();
    expect(input.tagName).toBe("INPUT");
    expect(input.type).toBe("file");
    expect(input.hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "Adicionar arquivos" }).getAttribute("aria-disabled")).toBe("false");
  });
});

describe("Confirmacao — recibo público", () => {
  async function enviarComSucesso(): Promise<void> {
    enviarSubmissaoMock.mockResolvedValue({ tipo: "ok", readableId: "SP-0042" });
    renderizar();
    preencherMinimo();
    fireEvent.click(screen.getByRole("button", { name: "Enviar solicitação" }));
    await screen.findByText("Solicitação enviada");
  }

  it("(h) a ordem do UI-SPEC: o identificador fica dentro de role=status; o rótulo e os botões, fora", async () => {
    await enviarComSucesso();

    const regioes = screen.getAllByRole("status");
    const identificadorDentro = regioes.some((regiao) => within(regiao).queryByText("SP-0042") !== null);
    expect(identificadorDentro).toBe(true);

    const rotulo = screen.getByText("Número da solicitação");
    expect(regioes.some((regiao) => regiao.contains(rotulo))).toBe(false);

    const botaoCopiar = screen.getByRole("button", { name: "Copiar número" });
    const botaoOutra = screen.getByRole("button", { name: "Enviar outra solicitação" });
    expect(regioes.some((regiao) => regiao.contains(botaoCopiar))).toBe(false);
    expect(regioes.some((regiao) => regiao.contains(botaoOutra))).toBe(false);
  });

  it("(i) a confirmação não contém 'acompanhar'/'status'/'aprovador' como texto visível, nem link além de Enviar outra solicitação", async () => {
    const { container } = render(<FormularioPublico secret="segredo-de-teste" formulario={montarFormulario()} />);
    enviarSubmissaoMock.mockResolvedValue({ tipo: "ok", readableId: "SP-0099" });
    preencherMinimo();
    fireEvent.click(screen.getByRole("button", { name: "Enviar solicitação" }));
    await screen.findByText("Solicitação enviada");

    expect(container.textContent ?? "").not.toMatch(/acompanhar|aprovador|\bstatus\b/i);
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });

  it("(j) Enviar outra solicitação limpa as respostas e devolve o foco ao heading do formulário", async () => {
    await enviarComSucesso();

    fireEvent.click(screen.getByRole("button", { name: "Enviar outra solicitação" }));

    const heading = await screen.findByRole("heading", { level: 1, name: "Solicitação de pagamento" });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(screen.getByLabelText("O que deve ser pago?", { exact: false })).toHaveProperty("value", "");
  });
});

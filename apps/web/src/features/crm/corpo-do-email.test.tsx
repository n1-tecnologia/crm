// @vitest-environment jsdom
/**
 * O e-mail formatado numa moldura isolada (17-15, D-17-13, T-17-65 e T-17-66). O HTML que a api devolve já vem limpo,
 * mas a segunda barreira é a moldura: um `<iframe>` com `sandbox` sem nenhuma permissão, `srcDoc`, sem referrer e com a
 * CSP no próprio documento. Nenhum HTML de e-mail entra no DOM da aplicação.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";

const { obterSessao } = vi.hoisted(() => ({ obterSessao: vi.fn() }));
vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

import { CorpoDoEmail, CSP_DO_EMAIL } from "@/features/crm/corpo-do-email";

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
  fetchMock = vi.fn(async () => resposta(200, { ok: true, dados: { html: "<p>Olá, <b>oi</b></p>" } }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function montar() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <CorpoDoEmail mensagemId="msg_1" />
    </SWRConfig>,
  );
}

const ver = () => fireEvent.click(screen.getByRole("button", { name: "Ver e-mail formatado" }));
const moldura = () => document.querySelector("iframe") as HTMLIFrameElement;

describe("CorpoDoEmail", () => {
  it("(1) antes do clique só há o botão: nada é pedido e nenhuma moldura existe", () => {
    montar();
    expect(screen.getByRole("button", { name: "Ver e-mail formatado" })).toBeTruthy();
    expect(moldura()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("(2) clicar pede GET /mensagens/<id>/corpo-html e mostra uma moldura com sandbox VAZIO, sem referrer, titulada e com srcDoc", async () => {
    montar();
    ver();
    await waitFor(() => expect(moldura()).not.toBeNull());
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("http://api/mensagens/msg_1/corpo-html");
    const quadro = moldura();
    // `sandbox=""`: o atributo existe e não concede NADA (sem script, sem mesma origem, sem janela, sem formulário).
    expect(quadro.hasAttribute("sandbox")).toBe(true);
    expect(quadro.getAttribute("sandbox")).toBe("");
    expect(quadro.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(quadro.getAttribute("title")).toBe("E-mail formatado");
    expect(quadro.hasAttribute("src")).toBe(false);
    expect(quadro.getAttribute("srcdoc")).toContain("<p>Olá, <b>oi</b></p>");
  });

  it("(3) o documento da moldura COMEÇA pela CSP restritiva e ela nega tudo, menos imagem data: e estilo embutido", async () => {
    montar();
    ver();
    await waitFor(() => expect(moldura()).not.toBeNull());
    const documento = moldura().getAttribute("srcdoc") ?? "";
    expect(documento.startsWith(`<meta http-equiv="Content-Security-Policy" content="${CSP_DO_EMAIL}">`)).toBe(true);
    expect(CSP_DO_EMAIL).toBe("default-src 'none'; img-src data:; style-src 'unsafe-inline'");
  });

  it("(4) nenhum HTML do e-mail entra no DOM da aplicação: o <b> só existe dentro do srcDoc", async () => {
    montar();
    ver();
    await waitFor(() => expect(moldura()).not.toBeNull());
    expect(document.querySelector("b")).toBeNull();
    expect(document.querySelector("p")).toBeNull();
    expect(document.body.textContent).not.toContain("Olá");
  });

  it("(5) enquanto carrega mostra o estado de carregamento, como texto", async () => {
    let solta: (() => void) | undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          solta = () => resolve(resposta(200, { ok: true, dados: { html: "<p>x</p>" } }));
        }),
    );
    montar();
    ver();
    expect(await screen.findByText("Carregando o e-mail…")).toBeTruthy();
    expect(moldura()).toBeNull();
    solta?.();
    await waitFor(() => expect(moldura()).not.toBeNull());
    expect(screen.queryByText("Carregando o e-mail…")).toBeNull();
  });

  it("(6) a recusa da api (404, 403) aparece como texto com a frase dela, sem moldura", async () => {
    fetchMock.mockImplementation(async () => resposta(404, { ok: false, error: "Esta Mensagem não tem e-mail formatado.", codigo: "SEM_CORPO_HTML" }));
    montar();
    ver();
    expect((await screen.findByRole("alert")).textContent).toContain("Esta Mensagem não tem e-mail formatado.");
    expect(moldura()).toBeNull();
  });

  it("(7) falha de rede: frase genérica, sem vazar o erro", async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError("fetch failed");
    });
    montar();
    ver();
    expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível carregar o e-mail formatado.");
  });

  it("(8) “Ocultar” tira a moldura e o botão volta a oferecer o e-mail", async () => {
    montar();
    ver();
    await waitFor(() => expect(moldura()).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Ocultar e-mail formatado" }));
    expect(moldura()).toBeNull();
    expect(screen.getByRole("button", { name: "Ver e-mail formatado" })).toBeTruthy();
  });

  it("(9) o fonte não tem permissão de sandbox nem põe HTML cru no DOM", () => {
    const fonte = readFileSync(join(process.cwd(), "src/features/crm/corpo-do-email.tsx"), "utf-8");
    expect(fonte).not.toMatch(/allow-[a-z-]+/);
    expect(fonte).not.toContain("dangerouslySetInnerHTML");
    expect(fonte).not.toContain("innerHTML");
  });
});

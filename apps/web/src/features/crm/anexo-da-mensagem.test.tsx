// @vitest-environment jsdom
/**
 * 16-11 Task 2 (3.9.5, MSG-04): o anexo de uma Mensagem no fio. Áudio toca, vídeo
 * toca, imagem aparece e documento só baixa, sempre pela URL assinada que
 * `GET /mensagens/:id/anexos/:indice` devolve a cada abertura. Nenhuma rede.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import type { AnexoDaMensagem } from "@n1/dominio/crm/mensagens";

const { obterSessao } = vi.hoisted(() => ({ obterSessao: vi.fn() }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

import { AnexoDaMensagemNoFio } from "./anexo-da-mensagem";

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

function anexoGuardado(tipoDeMidia: string, nome: string, extras: Partial<AnexoDaMensagem> = {}): AnexoDaMensagem {
  return { tipoDeMidia, nome, objectKey: `workspace/ws/${nome}`, tamanhoBytes: 2048, baixado: true, ...extras };
}

let fetchMock: ReturnType<typeof vi.fn>;
let contador = 0;

/** Cada pedido de URL devolve uma URL assinada nova, como a api. */
function urlsAssinadas() {
  fetchMock.mockImplementation(async () => {
    contador += 1;
    return resposta(200, { ok: true, dados: { url: `https://armazem.test/arquivo?assinatura=${contador}`, expiraEm: "2026-11-09T20:05:00.000Z" } });
  });
}

function montar(anexo: AnexoDaMensagem, indice = 0) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <AnexoDaMensagemNoFio mensagemId="msg_1" indice={indice} anexo={anexo} />
    </SWRConfig>,
  );
}

const pedidosDeUrl = () => fetchMock.mock.calls.filter((c) => String(c[0]).includes("/mensagens/msg_1/anexos/"));

beforeEach(() => {
  contador = 0;
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  urlsAssinadas();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AnexoDaMensagemNoFio", () => {
  it("(a) áudio baixado vira <audio controls> com a URL de GET /mensagens/<id>/anexos/0", async () => {
    const { container } = montar(anexoGuardado("audio/ogg", "voz.ogg"));
    await waitFor(() => expect(container.querySelector("audio")).not.toBeNull());
    const audio = container.querySelector("audio") as HTMLAudioElement;
    expect(audio.hasAttribute("controls")).toBe(true);
    expect(audio.getAttribute("src")).toBe("https://armazem.test/arquivo?assinatura=1");
    expect(String(pedidosDeUrl()[0]?.[0])).toBe("http://api/mensagens/msg_1/anexos/0");
  });

  it("(b) vídeo mp4 vira <video controls>", async () => {
    const { container } = montar(anexoGuardado("video/mp4", "clipe.mp4"));
    await waitFor(() => expect(container.querySelector("video")).not.toBeNull());
    expect((container.querySelector("video") as HTMLVideoElement).hasAttribute("controls")).toBe(true);
  });

  it("(c) imagem vira <img> com o nome como texto alternativo", async () => {
    const { container } = montar(anexoGuardado("image/png", "foto.png"));
    await waitFor(() => expect(container.querySelector("img")).not.toBeNull());
    const imagem = container.querySelector("img") as HTMLImageElement;
    expect(imagem.getAttribute("alt")).toBe("foto.png");
    expect(imagem.getAttribute("src")).toBe("https://armazem.test/arquivo?assinatura=1");
  });

  it("(d) documento só baixa: link “Baixar contrato.pdf” com a URL, sem player", async () => {
    const { container } = montar(anexoGuardado("application/pdf", "contrato.pdf"));
    const link = await screen.findByRole("link", { name: "Baixar contrato.pdf" });
    expect(link.getAttribute("href")).toBe("https://armazem.test/arquivo?assinatura=1");
    expect(link.hasAttribute("download")).toBe(true);
    expect(container.querySelector("audio, video, img, iframe, embed, object")).toBeNull();
  });

  it("(e) vídeo 3gpp, que o navegador não toca, mostra o link de download no lugar do player", async () => {
    const { container } = montar(anexoGuardado("video/3gpp", "clipe.3gp"));
    const link = await screen.findByRole("link", { name: "Baixar clipe.3gp" });
    expect(link.getAttribute("href")).toBe("https://armazem.test/arquivo?assinatura=1");
    expect(container.querySelector("video")).toBeNull();
  });

  it("(f) anexo baixado: false mostra o aviso e não chama a rota de URL", () => {
    montar({ tipoDeMidia: "audio/ogg", nome: "voz.ogg", referenciaExterna: "wamid-midia-1", baixado: false });
    expect(screen.getByText("Arquivo indisponível: o provedor não entregou este arquivo.")).toBeTruthy();
    expect(pedidosDeUrl()).toHaveLength(0);
  });

  it("(g) erro de carregamento do <audio>: a URL é pedida de novo uma vez, e a nova entra no player", async () => {
    const { container } = montar(anexoGuardado("audio/ogg", "voz.ogg"));
    await waitFor(() => expect(container.querySelector("audio")).not.toBeNull());
    const audio = () => container.querySelector("audio") as HTMLAudioElement;
    fireEvent.error(audio());
    await waitFor(() => expect(audio().getAttribute("src")).toBe("https://armazem.test/arquivo?assinatura=2"));
    expect(pedidosDeUrl()).toHaveLength(2);
    // O arquivo continuar falhando não vira laço de pedidos.
    fireEvent.error(audio());
    await new Promise((r) => setTimeout(r, 20));
    expect(pedidosDeUrl()).toHaveLength(2);
  });

  it("(h) T-16-41: um nome de arquivo hostil aparece como texto, sem criar elemento", async () => {
    const hostil = "<img src=x onerror=alert(1)>.pdf";
    const { container } = montar(anexoGuardado("application/pdf", hostil));
    const link = await screen.findByRole("link");
    expect(link.textContent).toBe(`Baixar ${hostil}`);
    expect(container.querySelector("img")).toBeNull();
  });

  it("(i) a rota recusar (404 ARQUIVO_INDISPONIVEL) mostra a frase de arquivo indisponível, sem player", async () => {
    fetchMock.mockImplementation(async () => resposta(404, { ok: false, error: "Arquivo indisponível.", codigo: "ARQUIVO_INDISPONIVEL" }));
    const { container } = montar(anexoGuardado("audio/ogg", "voz.ogg"));
    await waitFor(() => expect(screen.getByText("Arquivo indisponível: o provedor não entregou este arquivo.")).toBeTruthy());
    expect(container.querySelector("audio")).toBeNull();
  });

  it("(j) falha de rede ao pedir a URL mostra o erro e “Tentar de novo” pede outra vez", async () => {
    fetchMock.mockImplementationOnce(async () => resposta(500, { ok: false, error: "Falha." }));
    montar(anexoGuardado("application/pdf", "contrato.pdf"));
    const tentar = await screen.findByRole("button", { name: "Tentar de novo" }, { timeout: 4000 });
    urlsAssinadas();
    fireEvent.click(tentar);
    expect(await screen.findByRole("link", { name: "Baixar contrato.pdf" }, { timeout: 4000 })).toBeTruthy();
  });

  it("(k) uma URL que não é http(s) nunca vira src nem href", async () => {
    fetchMock.mockImplementation(async () => resposta(200, { ok: true, dados: { url: "javascript:alert(1)", expiraEm: "2026-11-09T20:05:00.000Z" } }));
    const { container } = montar(anexoGuardado("application/pdf", "contrato.pdf"));
    await waitFor(() => expect(pedidosDeUrl().length).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 20));
    expect(container.querySelector("a")).toBeNull();
  });
});

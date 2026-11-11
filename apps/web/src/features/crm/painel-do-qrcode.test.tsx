// @vitest-environment jsdom
/**
 * Sessão 4 (4.2.4) — o painel do QR code da ficha do Canal (`PainelDoQrCode`), com relógio falso e a api falsa:
 *
 *   - ao abrir, pede o QR (`POST /canais/:id/conectar`, sem corpo) e mostra a imagem, o código de pareamento e SÓ o
 *     final do número do Canal;
 *   - renova o QR a cada 25 s; `aguardando` repete em 2 s;
 *   - relê o Canal (`GET /canais/:id`) a cada 3 s: `conectada` mostra "Conectado" e fecha sozinho; `com_erro` DEPOIS de
 *     pedir o QR mostra a frase honesta com o final do número (um Canal que já abriu `com_erro` não alarma);
 *   - 403, 409, 502 e 503 mostram a frase da api, param de renovar e deixam "Tentar de novo";
 *   - cancelar e desmontar param todos os temporizadores: nenhuma chamada depois de fechar;
 *   - uma imagem que não é `data:image/` nunca vira `<img>`.
 *
 * Nenhuma rede: `fetch` roteado. O relógio é falso (`vi.useFakeTimers`): as respostas são assíncronas, então cada passo
 * do tempo vai por `avancar`, que também libera as promessas.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";
import type { CanalNaFicha } from "@n1/dominio/crm/canais";
import { useCanal } from "@/dados/crm/canais";
import {
  FECHAR_DEPOIS_DE_CONECTAR_EM_MS,
  PainelDoQrCode,
  RELER_O_CANAL_A_CADA_MS,
  RENOVAR_O_QR_A_CADA_MS,
  REPETIR_SE_AGUARDANDO_EM_MS,
  finalDoNumero,
} from "@/features/crm/painel-do-qrcode";

const { obterSessao } = vi.hoisted(() => ({ obterSessao: vi.fn() }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

vi.mock("@/dados/crm/cliente-crm", async (original) => {
  const real = await original<typeof import("@/dados/crm/cliente-crm")>();
  return { ...real, invalidarCrm: vi.fn(async () => undefined) };
});

const NUMERO_INTEIRO = "5511977770001";
const ALT_DO_QR = "QR code para conectar o WhatsApp deste Canal";

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

function canalDoTeste(sobre: Partial<CanalNaFicha> = {}): CanalNaFicha {
  return {
    id: "uuid-1",
    nome: "Suporte do Zap",
    tipo: "whatsapp",
    provedor: "whatsapp-nao-oficial",
    identificadorExterno: `+${NUMERO_INTEIRO}`,
    conexao: "desconectada",
    conexaoSimulada: false,
    conectadaEm: null,
    estado: "ativo",
    arquivadoEm: null,
    configuradoPor: "mem_rafael",
    filaPadraoId: null,
    proprietarioPadraoId: null,
    origemPadraoId: null,
    gruposHabilitados: false,
    ligadoAoProvedor: true,
    simulacaoPermitida: false,
    criadoPor: "mem_rafael",
    criadoEm: "2026-11-01T00:00:00.000Z",
    atualizadoEm: "2026-11-01T00:00:00.000Z",
    ...sobre,
  };
}

const qr = (imagem: string, codigoDePareamento?: string) => ({
  ok: true,
  dados: { situacao: "qrcode", qrcode: { imagem, ...(codigoDePareamento === undefined ? {} : { codigoDePareamento }) } },
});
const png = (marca: string) => `data:image/png;base64,${marca}`;

let fetchMock: ReturnType<typeof vi.fn>;
/** O que cada rota responde AGORA (o teste troca no meio para simular o provedor confirmando ou falhando). */
let rotas: Record<string, () => Response>;
let canalNoServidor: CanalNaFicha;

const chamadas = (metodo: string, caminho: string) =>
  fetchMock.mock.calls.filter(([url, init]) => url === `http://api${caminho}` && ((init as RequestInit | undefined)?.method ?? "GET") === metodo);

beforeEach(() => {
  vi.useFakeTimers();
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
  canalNoServidor = canalDoTeste();
  rotas = {
    "GET /canais/uuid-1": () => resposta(200, { ok: true, dados: canalNoServidor }),
    "POST /canais/uuid-1/conectar": () => resposta(200, qr(png("AAAA"))),
  };
  fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const rota = rotas[`${init.method ?? "GET"} ${String(url).replace("http://api", "")}`];
    return rota ? rota() : resposta(404, { ok: false, error: "Rota não prevista no teste.", codigo: "NAO_ENCONTRADO" });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const avancar = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

/** Só o SWR com o mesmo `refreshInterval`: ele mesmo deixa um temporizador interno ao desmontar, e isso não é do painel. */
function LeituraSozinha() {
  useCanal("uuid-1", { atualizarACadaMs: RELER_O_CANAL_A_CADA_MS });
  return null;
}

/** Quantos temporizadores o SWR sozinho deixa pendentes depois de desmontar (calibra o teste, sem número mágico). */
async function residuoDoSwr(): Promise<number> {
  const { unmount } = render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <LeituraSozinha />
    </SWRConfig>,
  );
  await avancar(0);
  unmount();
  const residuo = vi.getTimerCount();
  vi.clearAllTimers();
  return residuo;
}

async function abrir(canal: CanalNaFicha = canalDoTeste()) {
  const onFechar = vi.fn();
  const onConectado = vi.fn();
  const visual = render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <PainelDoQrCode canal={canal} onFechar={onFechar} onConectado={onConectado} />
    </SWRConfig>,
  );
  await avancar(0);
  return { onFechar, onConectado, ...visual };
}

describe("finalDoNumero", () => {
  it("devolve só os 4 últimos dígitos, de qualquer formatação", () => {
    expect(finalDoNumero("+5511977770001")).toBe("0001");
    expect(finalDoNumero("+55 (11) 97777-0042")).toBe("0042");
    expect(finalDoNumero("12")).toBe("12");
  });
});

describe("o QR code", () => {
  it("ao abrir pede o QR (POST sem corpo) e mostra a imagem, o código de pareamento e só o final do número", async () => {
    rotas["POST /canais/uuid-1/conectar"] = () => resposta(200, qr(png("AAAA"), "WXYZ1234"));
    await abrir();

    const imagem = screen.getByAltText(ALT_DO_QR);
    expect(imagem.getAttribute("src")).toBe(png("AAAA"));
    expect(screen.getByText("WXYZ1234")).toBeTruthy();
    expect(screen.getByText(/final 0001/)).toBeTruthy();
    // O número inteiro nunca aparece no painel.
    expect(document.body.textContent).not.toContain(NUMERO_INTEIRO);

    const posts = chamadas("POST", "/canais/uuid-1/conectar");
    expect(posts).toHaveLength(1);
    const init = posts[0]![1] as RequestInit;
    expect(init.body).toBeUndefined();
    const cabecalhos = init.headers as Record<string, string>;
    expect(cabecalhos["authorization"]).toBe("Bearer tok");
    expect(Object.keys(cabecalhos).map((k) => k.toLowerCase())).not.toContain("content-type");
    // Os passos de conexão do provedor estão na tela.
    expect(screen.getByText("No celular, abra Aparelhos conectados e toque em Conectar um aparelho.")).toBeTruthy();
  });

  it("sem código de pareamento na resposta, o texto do código não aparece", async () => {
    await abrir();
    expect(screen.queryByText(/Conectar com número de telefone/)).toBeNull();
  });

  it("renova o QR a cada 25 s: um segundo POST e a imagem nova", async () => {
    let chamada = 0;
    rotas["POST /canais/uuid-1/conectar"] = () => resposta(200, qr(png(`QR${(chamada += 1)}`)));
    await abrir();
    expect(screen.getByAltText(ALT_DO_QR).getAttribute("src")).toBe(png("QR1"));

    await avancar(RENOVAR_O_QR_A_CADA_MS - 1);
    expect(chamadas("POST", "/canais/uuid-1/conectar")).toHaveLength(1);

    await avancar(1);
    expect(chamadas("POST", "/canais/uuid-1/conectar")).toHaveLength(2);
    expect(screen.getByAltText(ALT_DO_QR).getAttribute("src")).toBe(png("QR2"));

    await avancar(RENOVAR_O_QR_A_CADA_MS);
    expect(chamadas("POST", "/canais/uuid-1/conectar")).toHaveLength(3);
  });

  it("aguardando: avisa que a Evolution prepara o QR e repete em 2 s até ele chegar", async () => {
    let chamada = 0;
    rotas["POST /canais/uuid-1/conectar"] = () =>
      resposta(200, (chamada += 1) === 1 ? { ok: true, dados: { situacao: "aguardando" } } : qr(png("PRONTO")));
    await abrir();

    expect(screen.getByText("A Evolution está preparando o QR code…")).toBeTruthy();
    expect(screen.queryByAltText(ALT_DO_QR)).toBeNull();

    await avancar(REPETIR_SE_AGUARDANDO_EM_MS);
    expect(chamadas("POST", "/canais/uuid-1/conectar")).toHaveLength(2);
    expect(screen.getByAltText(ALT_DO_QR).getAttribute("src")).toBe(png("PRONTO"));
    expect(screen.queryByText("A Evolution está preparando o QR code…")).toBeNull();
  });

  it("o botão \"Gerar outro QR code\" pede um QR na hora", async () => {
    await abrir();
    fireEvent.click(screen.getByRole("button", { name: "Gerar outro QR code" }));
    await avancar(0);
    expect(chamadas("POST", "/canais/uuid-1/conectar")).toHaveLength(2);
  });

  it("uma imagem que não é data:image/ nunca vira <img>", async () => {
    rotas["POST /canais/uuid-1/conectar"] = () => resposta(200, qr("https://exemplo.invalido/qr.png"));
    await abrir();

    expect(screen.queryByAltText(ALT_DO_QR)).toBeNull();
    expect(screen.getByText("O QR code veio num formato inesperado. Gere outro.")).toBeTruthy();
    expect(document.body.innerHTML).not.toContain("exemplo.invalido");
  });
});

describe("a conexão acontece", () => {
  it("o Canal passa a conectada na leitura: mostra \"Conectado\", para de renovar e fecha sozinho", async () => {
    const { onFechar, onConectado } = await abrir();
    expect(screen.getByAltText(ALT_DO_QR)).toBeTruthy();

    canalNoServidor = canalDoTeste({ conexao: "conectada" });
    await avancar(RELER_O_CANAL_A_CADA_MS);

    expect(screen.getByText("Conectado")).toBeTruthy();
    expect(screen.queryByAltText(ALT_DO_QR)).toBeNull();
    expect(onFechar).not.toHaveBeenCalled();

    await avancar(FECHAR_DEPOIS_DE_CONECTAR_EM_MS);
    expect(onConectado).toHaveBeenCalledTimes(1);
    expect(onFechar).toHaveBeenCalledTimes(1);

    // Conectado, não há QR novo a pedir.
    await avancar(RENOVAR_O_QR_A_CADA_MS * 2);
    expect(chamadas("POST", "/canais/uuid-1/conectar")).toHaveLength(1);
  });

  it("a simulação (conectada com a marca de simulada) não conta como conexão de verdade", async () => {
    const { onFechar } = await abrir();
    canalNoServidor = canalDoTeste({ conexao: "conectada", conexaoSimulada: true });
    await avancar(RELER_O_CANAL_A_CADA_MS + FECHAR_DEPOIS_DE_CONECTAR_EM_MS);
    expect(screen.queryByText("Conectado")).toBeNull();
    expect(onFechar).not.toHaveBeenCalled();
  });

  it("a resposta conectada do POST (o aparelho já estava ligado e o número conferiu) também mostra Conectado e fecha", async () => {
    rotas["POST /canais/uuid-1/conectar"] = () =>
      resposta(200, { ok: true, dados: { situacao: "conectada", canal: canalDoTeste({ conexao: "conectada" }) } });
    const { onFechar, onConectado } = await abrir();

    expect(screen.getByText("Conectado")).toBeTruthy();
    await avancar(FECHAR_DEPOIS_DE_CONECTAR_EM_MS);
    expect(onConectado).toHaveBeenCalledTimes(1);
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it("com_erro DEPOIS de pedir o QR: a frase honesta, com o final do número e sem o número inteiro", async () => {
    await abrir();
    expect(screen.queryByText(/A conexão não foi concluída/)).toBeNull();

    canalNoServidor = canalDoTeste({ conexao: "com_erro" });
    await avancar(RELER_O_CANAL_A_CADA_MS);

    const alerta = screen.getByText(/A conexão não foi concluída/);
    expect(alerta.textContent).toBe(
      "A conexão não foi concluída. Confira se leu o QR code com o celular do número deste Canal (final 0001) e tente de novo.",
    );
    expect(document.body.textContent).not.toContain(NUMERO_INTEIRO);
    // O QR segue aí para outra tentativa.
    expect(screen.getByAltText(ALT_DO_QR)).toBeTruthy();
  });

  it("Canal que JÁ estava com erro ao abrir (Reconectar): não alarma só por continuar com erro", async () => {
    canalNoServidor = canalDoTeste({ conexao: "com_erro" });
    await abrir(canalDoTeste({ conexao: "com_erro" }));
    await avancar(RELER_O_CANAL_A_CADA_MS * 2);

    expect(screen.getByAltText(ALT_DO_QR)).toBeTruthy();
    expect(screen.queryByText(/A conexão não foi concluída/)).toBeNull();
  });
});

describe("as recusas da api", () => {
  it.each([
    [403, "PERMISSAO", "Só Administrador ou Proprietário conecta Canais."],
    [409, "TRANSICAO_INVALIDA", "O Canal já está conectado."],
    [502, "EVOLUTION_INDISPONIVEL", "Não foi possível falar com o WhatsApp. Tente de novo."],
    [503, "EVOLUTION_NAO_CONFIGURADA", "A Evolution não está configurada neste ambiente. Falta EVOLUTION_API_KEY."],
  ] as const)("%i %s: mostra a frase da api, para de renovar e deixa \"Tentar de novo\"", async (status, codigo, frase) => {
    rotas["POST /canais/uuid-1/conectar"] = () => resposta(status, { ok: false, error: frase, codigo });
    await abrir();

    expect(screen.getByRole("alert").textContent).toBe(frase);
    expect(screen.queryByAltText(ALT_DO_QR)).toBeNull();

    await avancar(RENOVAR_O_QR_A_CADA_MS * 3);
    expect(chamadas("POST", "/canais/uuid-1/conectar")).toHaveLength(1);

    rotas["POST /canais/uuid-1/conectar"] = () => resposta(200, qr(png("DEPOIS")));
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await avancar(0);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByAltText(ALT_DO_QR).getAttribute("src")).toBe(png("DEPOIS"));
    // Voltou a renovar.
    await avancar(RENOVAR_O_QR_A_CADA_MS);
    expect(chamadas("POST", "/canais/uuid-1/conectar")).toHaveLength(3);
  });

  it("falha de rede (sem frase da api): mostra a frase padrão", async () => {
    fetchMock.mockImplementation(async (url: string, init: RequestInit = {}) => {
      if ((init.method ?? "GET") === "POST") throw new TypeError("fetch failed");
      return rotas[`GET ${String(url).replace("http://api", "")}`]!();
    });
    await abrir();

    expect(screen.getByRole("alert").textContent).toBeTruthy();
    expect(screen.queryByAltText(ALT_DO_QR)).toBeNull();
  });
});

describe("fechar para tudo", () => {
  it("Cancelar chama onFechar", async () => {
    const { onFechar } = await abrir();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it("desmontar para os temporizadores: nenhuma chamada à api depois de fechar", async () => {
    // Antes de abrir o painel: o resíduo interno do SWR (medido à parte, sem número mágico) e a conta de chamadas limpa.
    const residuo = await residuoDoSwr();
    fetchMock.mockClear();

    const { unmount } = await abrir();
    const postsAntes = chamadas("POST", "/canais/uuid-1/conectar").length;
    const leiturasAntes = chamadas("GET", "/canais/uuid-1").length;
    expect(postsAntes).toBe(1);

    // Com o painel aberto há temporizadores do painel (renovar o QR) e do SWR (reler o Canal)...
    const abertos = vi.getTimerCount();
    unmount();
    // ...e fechar não deixa nenhum DO PAINEL: sobra no máximo o resíduo do SWR. Não basta a resposta tardia ser
    // ignorada: o relógio em si é desligado.
    expect(abertos).toBeGreaterThan(residuo);
    expect(vi.getTimerCount()).toBeLessThanOrEqual(residuo);
    await avancar(RENOVAR_O_QR_A_CADA_MS * 4);

    expect(chamadas("POST", "/canais/uuid-1/conectar")).toHaveLength(postsAntes);
    expect(chamadas("GET", "/canais/uuid-1")).toHaveLength(leiturasAntes);
  });

  it("uma resposta que chega depois de fechar é ignorada (nada de estado em componente desmontado)", async () => {
    let liberar: (r: Response) => void = () => undefined;
    rotas["POST /canais/uuid-1/conectar"] = () => {
      throw new Error("deve usar o fetch lento");
    };
    fetchMock.mockImplementation((url: string, init: RequestInit = {}) => {
      const rota = `${init.method ?? "GET"} ${String(url).replace("http://api", "")}`;
      if (rota === "POST /canais/uuid-1/conectar") return new Promise<Response>((resolver) => (liberar = resolver));
      return Promise.resolve(rotas[rota]!());
    });
    const erros = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { unmount } = await abrir();

    unmount();
    await act(async () => {
      liberar(resposta(200, qr(png("TARDE"))));
      await vi.advanceTimersByTimeAsync(0);
    });
    await avancar(RENOVAR_O_QR_A_CADA_MS * 2);

    expect(chamadas("POST", "/canais/uuid-1/conectar")).toHaveLength(1);
    expect(erros).not.toHaveBeenCalled();
    erros.mockRestore();
  });
});

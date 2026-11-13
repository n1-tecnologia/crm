// @vitest-environment jsdom
/**
 * Sessão 7 (7.2.5) — o painel do token da ficha do Canal (`PainelDoTokenDoWhatsApp`), com a api falsa:
 *
 *   - mostra os três passos de 7.1 e três campos (ID do número, ID da conta, token); o do token é de senha, sem `name` e
 *     com `autoComplete="off"`;
 *   - "Conectar" fica desabilitado até os três campos terem valor e enquanto há pedido em curso;
 *   - envia `POST /canais/:id/whatsapp-oficial/conectar` com os três valores APARADOS, chama `onConectado` e depois
 *     `onFechar`, e apaga o que foi colado;
 *   - a recusa 409 aparece junto do campo que a api aponta (`token`, `phoneNumberId`); a sem campo vai no topo;
 *   - o token digitado NUNCA aparece em frase de erro (nem se a api o repetisse), em URL, em `localStorage` nem em
 *     `sessionStorage`;
 *   - cancelar apaga o que foi colado e não chama a api.
 *
 * Nenhuma rede: `fetch` roteado.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { CanalNaFicha } from "@n1/dominio/crm/canais";
import { PainelDoTokenDoWhatsApp, semOToken } from "@/features/crm/painel-do-token";

const { obterSessao } = vi.hoisted(() => ({ obterSessao: vi.fn() }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

vi.mock("@/dados/crm/cliente-crm", async (original) => {
  const real = await original<typeof import("@/dados/crm/cliente-crm")>();
  return { ...real, invalidarCrm: vi.fn(async () => undefined) };
});

const TOKEN = "EAAG-token-permanente-de-teste-1234567890";
const ROTA = "POST /canais/uuid-1/whatsapp-oficial/conectar";

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

function canalDoTeste(sobre: Partial<CanalNaFicha> = {}): CanalNaFicha {
  return {
    id: "uuid-1",
    nome: "Oficial",
    tipo: "whatsapp",
    provedor: "whatsapp-cloud",
    identificadorExterno: "+5511977770001",
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
    ligadoAoProvedor: false,
    simulacaoPermitida: false,
    criadoPor: "mem_rafael",
    criadoEm: "2026-11-01T00:00:00.000Z",
    atualizadoEm: "2026-11-01T00:00:00.000Z",
    ...sobre,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;
let rotas: Record<string, () => Response | Promise<Response>>;
const onFechar = vi.fn();
const onConectado = vi.fn();

const pedidos = () => fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "POST");

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
  onFechar.mockReset();
  onConectado.mockReset();
  rotas = { [ROTA]: () => resposta(200, { ok: true, dados: canalDoTeste({ conexao: "conectada" }) }) };
  fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const rota = rotas[`${init.method ?? "GET"} ${String(url).replace("http://api", "")}`];
    return rota ? rota() : resposta(404, { ok: false, error: "Rota não prevista no teste.", codigo: "NAO_ENCONTRADO" });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

const campoNumero = () => screen.getByLabelText(/^ID do número de telefone/) as HTMLInputElement;
const campoConta = () => screen.getByLabelText(/^ID da conta do WhatsApp Business/) as HTMLInputElement;
const campoToken = () => screen.getByLabelText(/^Token de acesso/) as HTMLInputElement;
const botaoConectar = () => screen.getByRole("button", { name: "Conectar" });

function abrir() {
  render(<PainelDoTokenDoWhatsApp canal={canalDoTeste()} onFechar={onFechar} onConectado={onConectado} />);
}

function preencher(numero = "1098765432100", conta = "100200300400500", token = TOKEN) {
  fireEvent.change(campoNumero(), { target: { value: numero } });
  fireEvent.change(campoConta(), { target: { value: conta } });
  fireEvent.change(campoToken(), { target: { value: token } });
}

describe("o que o painel mostra", () => {
  it("o título, só o final do número do Canal, os três passos de 7.1 e os três campos", () => {
    abrir();
    const dialogo = screen.getByRole("alertdialog");
    expect(within(dialogo).getByText("Conectar o WhatsApp oficial")).toBeTruthy();
    expect(within(dialogo).getByText(/final 0001/)).toBeTruthy();
    // O número inteiro nunca aparece.
    expect(dialogo.textContent).not.toContain("5511977770001");
    const passos = within(dialogo).getAllByRole("listitem");
    expect(passos).toHaveLength(3);
    expect(passos[0]!.textContent).toMatch(/empresa verificada no Meta Business/);
    expect(passos[1]!.textContent).toMatch(/número dedicado/);
    expect(passos[2]!.textContent).toMatch(/usuário do sistema/);
    expect(campoNumero()).toBeTruthy();
    expect(campoConta()).toBeTruthy();
    expect(campoToken()).toBeTruthy();
  });

  it("cada campo diz onde achar o dado no painel da Meta", () => {
    abrir();
    expect(screen.getByText(/Configuração da API: “ID do número de telefone”/)).toBeTruthy();
    expect(screen.getByText(/“ID da conta do WhatsApp Business”/)).toBeTruthy();
    // O token: de onde vem e com quais permissões (o passo 3 também as cita, por isso a dica é pelo caminho do painel).
    expect(screen.getByText(/Configurações do negócio › Usuários do sistema/)).toBeTruthy();
    expect(screen.getByText(/Fica cifrado no servidor e não aparece de novo/)).toBeTruthy();
  });

  it("o campo do token é de senha, sem `name` e sem sugestão do navegador; os outros dois são de texto", () => {
    abrir();
    expect(campoToken().type).toBe("password");
    expect(campoToken().getAttribute("autocomplete")).toBe("off");
    expect(campoToken().getAttribute("name")).toBeNull();
    expect(campoNumero().type).toBe("text");
    expect(campoConta().type).toBe("text");
    expect(document.querySelector("form")?.getAttribute("autocomplete")).toBe("off");
  });
});

describe("enviar", () => {
  it("vazio: Conectar fica desabilitado, com a frase do que falta, e nada vai à api", () => {
    abrir();
    expect(botaoConectar().getAttribute("aria-disabled")).toBe("true");
    expect(botaoConectar().getAttribute("title")).toMatch(/Preencha o ID do número/);
    fireEvent.click(botaoConectar());
    expect(pedidos()).toHaveLength(0);

    fireEvent.change(campoNumero(), { target: { value: "1098765432100" } });
    fireEvent.change(campoConta(), { target: { value: "100200300400500" } });
    expect(botaoConectar().getAttribute("aria-disabled")).toBe("true");
    fireEvent.change(campoToken(), { target: { value: TOKEN } });
    expect(botaoConectar().getAttribute("aria-disabled")).not.toBe("true");
  });

  it("só espaço num campo não conta como preenchido", () => {
    abrir();
    preencher("   ", "100200300400500", TOKEN);
    expect(botaoConectar().getAttribute("aria-disabled")).toBe("true");
  });

  it("envia os três valores APARADOS, com Bearer e JSON; chama onConectado antes de onFechar e apaga o que foi colado", async () => {
    abrir();
    preencher(" 1098765432100 ", "100200300400500\n", ` ${TOKEN}\n`);
    await act(async () => {
      fireEvent.click(botaoConectar());
    });

    await waitFor(() => expect(onFechar).toHaveBeenCalledTimes(1));
    expect(onConectado).toHaveBeenCalledTimes(1);
    expect(onConectado.mock.invocationCallOrder[0]!).toBeLessThan(onFechar.mock.invocationCallOrder[0]!);

    expect(pedidos()).toHaveLength(1);
    const [url, init] = pedidos()[0] as [string, RequestInit];
    expect(url).toBe("http://api/canais/uuid-1/whatsapp-oficial/conectar");
    expect(JSON.parse(init.body as string)).toEqual({ phoneNumberId: "1098765432100", wabaId: "100200300400500", token: TOKEN });
    const cabecalhos = init.headers as Record<string, string>;
    expect(cabecalhos["authorization"]).toBe("Bearer tok");
    expect(cabecalhos["content-type"]).toBe("application/json");
    // O token só foi no corpo: nunca na URL.
    expect(url).not.toContain(TOKEN);

    // O que foi colado é apagado do estado: o campo do token volta vazio.
    expect(campoToken().value).toBe("");
    expect(campoNumero().value).toBe("");
    expect(campoConta().value).toBe("");
  });

  it("o Enter num campo (submit do formulário) também envia", async () => {
    abrir();
    preencher();
    await act(async () => {
      fireEvent.submit(campoToken().closest("form")!);
    });
    await waitFor(() => expect(onFechar).toHaveBeenCalledTimes(1));
    expect(pedidos()).toHaveLength(1);
  });

  it("enquanto o pedido está em curso, Conectar fica desabilitado, e um segundo clique não manda outro pedido", async () => {
    let liberar!: (r: Response) => void;
    rotas[ROTA] = () => new Promise<Response>((aceitar) => (liberar = aceitar));
    abrir();
    preencher();
    fireEvent.click(botaoConectar());
    await waitFor(() => expect(pedidos()).toHaveLength(1));

    expect(botaoConectar().getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(botaoConectar());
    fireEvent.submit(campoToken().closest("form")!);
    expect(pedidos()).toHaveLength(1);

    await act(async () => {
      liberar(resposta(200, { ok: true, dados: canalDoTeste({ conexao: "conectada" }) }));
    });
    await waitFor(() => expect(onFechar).toHaveBeenCalledTimes(1));
  });
});

describe("a recusa da api", () => {
  it("409 TOKEN_RECUSADO no campo `token`: a frase aparece junto do campo do token, o painel fica aberto e nada é fechado", async () => {
    rotas[ROTA] = () => resposta(409, { ok: false, error: "A Meta recusou o token: ele é inválido ou venceu.", codigo: "TOKEN_RECUSADO", campo: "token" });
    abrir();
    preencher();
    await act(async () => {
      fireEvent.click(botaoConectar());
    });

    const frase = await screen.findByText("A Meta recusou o token: ele é inválido ou venceu.");
    expect(campoToken().parentElement!.contains(frase)).toBe(true);
    expect(campoNumero().parentElement!.contains(frase)).toBe(false);
    expect(campoToken().getAttribute("aria-invalid")).toBe("true");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(onFechar).not.toHaveBeenCalled();
    expect(onConectado).not.toHaveBeenCalled();
    // Dá para corrigir e tentar de novo.
    expect(botaoConectar().getAttribute("aria-disabled")).not.toBe("true");
  });

  it("409 NUMERO_DIFERENTE no campo `phoneNumberId`: a frase aparece junto do campo do número", async () => {
    rotas[ROTA] = () => resposta(409, { ok: false, error: "Este token é de outro número.", codigo: "NUMERO_DIFERENTE", campo: "phoneNumberId" });
    abrir();
    preencher();
    await act(async () => {
      fireEvent.click(botaoConectar());
    });

    const frase = await screen.findByText("Este token é de outro número.");
    expect(campoNumero().parentElement!.contains(frase)).toBe(true);
    expect(campoToken().parentElement!.contains(frase)).toBe(false);
    expect(campoNumero().getAttribute("aria-invalid")).toBe("true");
  });

  it.each([
    [502, "WHATSAPP_INDISPONIVEL", "Não foi possível falar com o WhatsApp agora. Tente de novo em instantes."],
    [503, "WHATSAPP_OFICIAL_NAO_CONFIGURADO", "A integração com o WhatsApp oficial não está configurada neste ambiente. Falta no servidor: META_APP_SECRET."],
    [409, "NUMERO_EM_OUTRO_CANAL", "Este número do WhatsApp já está conectado em outro Canal. Desconecte-o lá antes."],
    [403, "SEM_PERMISSAO", "Você não tem permissão para conectar Canais."],
  ])("%i %s (sem campo): a frase vai no topo do painel, fora dos campos", async (status, codigo, error) => {
    rotas[ROTA] = () => resposta(status, { ok: false, error, codigo });
    abrir();
    preencher();
    await act(async () => {
      fireEvent.click(botaoConectar());
    });

    const frase = await screen.findByText(error);
    expect(frase.getAttribute("role")).toBe("alert");
    for (const campo of [campoNumero(), campoConta(), campoToken()]) expect(campo.parentElement!.contains(frase)).toBe(false);
  });

  it("falha de rede (sem resposta da api): mostra uma frase em português e o painel segue aberto", async () => {
    fetchMock.mockImplementationOnce(async () => {
      throw new TypeError("fetch failed");
    });
    abrir();
    preencher();
    await act(async () => {
      fireEvent.click(botaoConectar());
    });

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(onFechar).not.toHaveBeenCalled();
    expect(onConectado).not.toHaveBeenCalled();
  });
});

describe("o token nunca vaza", () => {
  it("nem se a api o repetisse numa frase: ele vira •••, e nada na tela, na URL ou no armazenamento do navegador o contém", async () => {
    rotas[ROTA] = () => resposta(409, { ok: false, error: `A Meta recusou o token ${TOKEN}.`, codigo: "TOKEN_RECUSADO", campo: "token" });
    abrir();
    preencher();
    await act(async () => {
      fireEvent.click(botaoConectar());
    });

    expect(await screen.findByText("A Meta recusou o token •••.")).toBeTruthy();
    expect(document.body.textContent).not.toContain(TOKEN);
    expect(JSON.stringify({ ...window.localStorage })).not.toContain(TOKEN);
    expect(JSON.stringify({ ...window.sessionStorage })).not.toContain(TOKEN);
    expect(window.location.href).not.toContain(TOKEN);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes(TOKEN))).toBe(false);
  });

  it("digitar o token não o grava em lugar nenhum antes de enviar", () => {
    abrir();
    preencher();
    expect(JSON.stringify({ ...window.localStorage })).not.toContain(TOKEN);
    expect(JSON.stringify({ ...window.sessionStorage })).not.toContain(TOKEN);
    expect(pedidos()).toHaveLength(0);
  });

  it("cancelar apaga o que foi colado, fecha e não chama a api", () => {
    abrir();
    preencher();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onFechar).toHaveBeenCalledTimes(1);
    expect(campoToken().value).toBe("");
    expect(campoNumero().value).toBe("");
    expect(pedidos()).toHaveLength(0);
    expect(onConectado).not.toHaveBeenCalled();
  });

  it("semOToken troca todas as ocorrências e não mexe numa frase sem o token nem com token vazio", () => {
    expect(semOToken(`a ${TOKEN} b ${TOKEN}`, TOKEN)).toBe("a ••• b •••");
    expect(semOToken("Sem segredo aqui.", TOKEN)).toBe("Sem segredo aqui.");
    expect(semOToken("qualquer coisa", "")).toBe("qualquer coisa");
  });
});

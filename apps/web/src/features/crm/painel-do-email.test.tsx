// @vitest-environment jsdom
/**
 * Fase 17 (9.2.4) — o painel do e-mail da ficha do Canal (`PainelDoEmail`), com a api falsa:
 *
 *   - "Conectar" abre três caminhos: "Entrar com o Google" e "Entrar com a Microsoft" só aparecem quando
 *     `GET /canais/:id/email/conta` diz que o servidor os tem; "Outro servidor" sempre;
 *   - "Outro servidor": usuário (com o endereço do Canal), senha (de senha, sem `name`, `autoComplete="off"`), servidor e
 *     porta do IMAP e do SMTP; envia `{ usuario, senha, imap, smtp }` exatamente;
 *   - Gmail e Outlook (pelo domínio do endereço) mandam SÓ o nome da predefinição; "Usar outros servidores" abre os campos;
 *   - a recusa 422 aparece junto do campo (`imap` ou `smtp`) e a senha é apagada; a senha nunca vai à URL, ao
 *     `localStorage`, ao `sessionStorage` nem a uma frase de erro;
 *   - Google e Microsoft: `POST /canais/:id/email/oauth/:servico/autorizar` e o navegador vai à URL devolvida;
 *   - nenhum texto do painel cita mês ou ano (a data da retirada do SMTP autenticado não está confirmada).
 *
 * Nenhuma rede: `fetch` roteado.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import type { CanalNaFicha } from "@n1/dominio/crm/canais";
import { PainelDoEmail, predefinicaoDoEndereco, semASenha } from "@/features/crm/painel-do-email";

const { obterSessao, irParaForaDoApp } = vi.hoisted(() => ({ obterSessao: vi.fn(), irParaForaDoApp: vi.fn() }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

vi.mock("@/dados/crm/cliente-crm", async (original) => {
  const real = await original<typeof import("@/dados/crm/cliente-crm")>();
  return { ...real, invalidarCrm: vi.fn(async () => undefined) };
});

vi.mock("@/features/crm/ir-para-fora", () => ({ irParaForaDoApp }));

const SENHA = "senha-de-teste-Zx9!";
const CONECTAR = "POST /canais/uuid-1/email/conectar";
const CONTA = "GET /canais/uuid-1/email/conta";

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

function canalDoTeste(sobre: Partial<CanalNaFicha> = {}): CanalNaFicha {
  return {
    id: "uuid-1",
    nome: "Vendas",
    tipo: "email",
    provedor: "email-imap-smtp",
    identificadorExterno: "vendas@empresa.com.br",
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

const SEM_LOGIN = { ok: true, dados: { conta: null, servicosDisponiveis: { google: false, microsoft: false } } };
const COM_LOGIN = { ok: true, dados: { conta: null, servicosDisponiveis: { google: true, microsoft: true } } };

let fetchMock: ReturnType<typeof vi.fn>;
let rotas: Record<string, () => Response | Promise<Response>>;
const onFechar = vi.fn();
const onConectado = vi.fn();

const pedidos = (metodo = "POST") => fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === metodo);

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
  irParaForaDoApp.mockReset();
  onFechar.mockReset();
  onConectado.mockReset();
  rotas = {
    [CONTA]: () => resposta(200, SEM_LOGIN),
    [CONECTAR]: () => resposta(200, { ok: true, dados: canalDoTeste({ conexao: "conectada" }) }),
  };
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

async function abrir(canal: CanalNaFicha = canalDoTeste()) {
  await act(async () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <PainelDoEmail canal={canal} onFechar={onFechar} onConectado={onConectado} />
      </SWRConfig>,
    );
  });
}

const botaoOutroServidor = () => screen.getByRole("button", { name: "Outro servidor" });
const botaoConectar = () => screen.getByRole("button", { name: "Conectar" });
const campoUsuario = () => screen.getByLabelText(/^Usuário/) as HTMLInputElement;
const campoSenha = () => screen.getByLabelText(/^Senha ou senha de app/) as HTMLInputElement;
const campoImap = () => screen.getByLabelText(/^Servidor IMAP/) as HTMLInputElement;
const campoSmtp = () => screen.getByLabelText(/^Servidor SMTP/) as HTMLInputElement;

async function abrirOutroServidor(canal?: CanalNaFicha) {
  await abrir(canal);
  fireEvent.click(botaoOutroServidor());
}

describe("os caminhos", () => {
  it("sem Google nem Microsoft no servidor: só 'Outro servidor', e nada é enviado ao abrir", async () => {
    await abrir();
    expect(screen.getByText("Conectar a caixa de e-mail")).toBeTruthy();
    expect(botaoOutroServidor()).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Entrar com o Google" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Entrar com a Microsoft" })).toBeNull();
    // Antes de escolher, Conectar fica desabilitado, com a frase.
    expect(botaoConectar().getAttribute("aria-disabled")).toBe("true");
    expect(pedidos()).toHaveLength(0);
  });

  it("com Google e Microsoft no servidor: os três caminhos aparecem", async () => {
    rotas[CONTA] = () => resposta(200, COM_LOGIN);
    await abrir();
    expect(await screen.findByRole("button", { name: "Entrar com o Google" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Entrar com a Microsoft" })).toBeTruthy();
    expect(botaoOutroServidor()).toBeTruthy();
  });

  it("só a Microsoft no servidor: o Google não aparece", async () => {
    rotas[CONTA] = () => resposta(200, { ok: true, dados: { conta: null, servicosDisponiveis: { google: false, microsoft: true } } });
    await abrir();
    expect(await screen.findByRole("button", { name: "Entrar com a Microsoft" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Entrar com o Google" })).toBeNull();
  });
});

describe("Outro servidor", () => {
  it("pede usuário (com o endereço do Canal), senha, e servidor e porta do IMAP e do SMTP; o campo de senha nunca vem preenchido", async () => {
    await abrirOutroServidor();
    expect(campoUsuario().value).toBe("vendas@empresa.com.br");
    expect(campoSenha().type).toBe("password");
    expect(campoSenha().value).toBe("");
    expect(campoSenha().getAttribute("autocomplete")).toBe("off");
    expect(campoSenha().getAttribute("name")).toBeNull();
    expect(document.querySelector("form")?.getAttribute("autocomplete")).toBe("off");
    expect(campoImap().value).toBe("");
    expect(campoSmtp().value).toBe("");
    // As portas começam na de TLS direto; a outra é a do STARTTLS.
    expect(screen.getByLabelText(/^Porta do IMAP/).textContent).toContain("993");
    expect(screen.getByLabelText(/^Porta do SMTP/).textContent).toContain("465");
  });

  it("sem os campos, Conectar fica desabilitado, com a frase do que falta, e nada vai à api", async () => {
    await abrirOutroServidor();
    expect(botaoConectar().getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(botaoConectar());
    expect(pedidos()).toHaveLength(0);
    fireEvent.change(campoSenha(), { target: { value: SENHA } });
    // Falta o servidor.
    expect(botaoConectar().getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(botaoConectar());
    expect(pedidos()).toHaveLength(0);
  });

  it("enviar manda exatamente { usuario, senha, imap, smtp }, fecha, avisa e apaga a senha", async () => {
    await abrirOutroServidor();
    fireEvent.change(campoUsuario(), { target: { value: " vendas@empresa.com.br " } });
    fireEvent.change(campoSenha(), { target: { value: SENHA } });
    fireEvent.change(campoImap(), { target: { value: " imap.empresa.com.br " } });
    fireEvent.change(campoSmtp(), { target: { value: "smtp.empresa.com.br" } });
    fireEvent.click(botaoConectar());

    await waitFor(() => expect(onFechar).toHaveBeenCalledTimes(1));
    expect(onConectado).toHaveBeenCalledTimes(1);
    const enviados = pedidos().filter(([url]) => String(url) === "http://api/canais/uuid-1/email/conectar");
    expect(enviados).toHaveLength(1);
    expect(JSON.parse((enviados[0]![1] as RequestInit).body as string)).toEqual({
      usuario: "vendas@empresa.com.br",
      senha: SENHA,
      imap: { host: "imap.empresa.com.br", porta: 993 },
      smtp: { host: "smtp.empresa.com.br", porta: 465 },
    });
    // A senha só foi no corpo do POST: nunca na URL, no armazenamento do navegador nem na tela.
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes(SENHA))).toBe(false);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.body.textContent).not.toContain(SENHA);
  });

  it("a porta do STARTTLS (143 e 587) vai como número", async () => {
    await abrirOutroServidor();
    fireEvent.change(campoSenha(), { target: { value: SENHA } });
    fireEvent.change(campoImap(), { target: { value: "imap.empresa.com.br" } });
    fireEvent.change(campoSmtp(), { target: { value: "smtp.empresa.com.br" } });
    fireEvent.click(screen.getByLabelText(/^Porta do IMAP/));
    fireEvent.click(screen.getByRole("option", { name: /143/ }));
    fireEvent.click(screen.getByLabelText(/^Porta do SMTP/));
    fireEvent.click(screen.getByRole("option", { name: /587/ }));
    fireEvent.click(botaoConectar());

    await waitFor(() => expect(onFechar).toHaveBeenCalled());
    const corpo = JSON.parse((pedidos()[0]![1] as RequestInit).body as string) as Record<string, unknown>;
    expect(corpo["imap"]).toEqual({ host: "imap.empresa.com.br", porta: 143 });
    expect(corpo["smtp"]).toEqual({ host: "smtp.empresa.com.br", porta: 587 });
  });

  it("a recusa 422 do IMAP aparece junto do servidor IMAP e a senha é apagada do campo", async () => {
    rotas[CONECTAR] = () =>
      resposta(422, {
        ok: false,
        error: "O servidor IMAP recusou o usuário ou a senha.",
        codigo: "CONEXAO_RECUSADA",
        campo: "imap",
      });
    await abrirOutroServidor();
    fireEvent.change(campoSenha(), { target: { value: SENHA } });
    fireEvent.change(campoImap(), { target: { value: "imap.empresa.com.br" } });
    fireEvent.change(campoSmtp(), { target: { value: "smtp.empresa.com.br" } });
    fireEvent.click(botaoConectar());

    const frase = await screen.findByText("O servidor IMAP recusou o usuário ou a senha.");
    expect(frase.closest("[data-erro]")).not.toBeNull();
    // Junto do campo do IMAP, não no topo.
    expect(frase.parentElement?.contains(campoImap())).toBe(true);
    expect(campoSenha().value).toBe("");
    expect(onFechar).not.toHaveBeenCalled();
    expect(onConectado).not.toHaveBeenCalled();
  });

  it("a recusa do SMTP vai junto do servidor SMTP", async () => {
    rotas[CONECTAR] = () =>
      resposta(422, { ok: false, error: "O servidor SMTP recusou o usuário ou a senha.", codigo: "CONEXAO_RECUSADA", campo: "smtp" });
    await abrirOutroServidor();
    fireEvent.change(campoSenha(), { target: { value: SENHA } });
    fireEvent.change(campoImap(), { target: { value: "imap.empresa.com.br" } });
    fireEvent.change(campoSmtp(), { target: { value: "smtp.empresa.com.br" } });
    fireEvent.click(botaoConectar());

    const frase = await screen.findByText("O servidor SMTP recusou o usuário ou a senha.");
    expect(frase.parentElement?.contains(campoSmtp())).toBe(true);
  });

  it("a recusa sem campo vai no topo; a frase da api é TEXTO (HTML não vira elemento) e nunca repete a senha", async () => {
    rotas[CONECTAR] = () =>
      resposta(503, { ok: false, error: `O cofre falhou <b id="x">negrito</b> com ${SENHA}.`, codigo: "COFRE_NAO_CONFIGURADO" });
    await abrirOutroServidor();
    fireEvent.change(campoSenha(), { target: { value: SENHA } });
    fireEvent.change(campoImap(), { target: { value: "imap.empresa.com.br" } });
    fireEvent.change(campoSmtp(), { target: { value: "smtp.empresa.com.br" } });
    fireEvent.click(botaoConectar());

    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toContain('<b id="x">negrito</b>');
    expect(alerta.textContent).toContain("•••");
    expect(document.querySelector("#x")).toBeNull();
    expect(document.body.textContent).not.toContain(SENHA);
  });

  it("sem resposta da api (rede), diz a frase do cliente e apaga a senha", async () => {
    rotas[CONECTAR] = () => {
      throw new Error("rede");
    };
    await abrirOutroServidor();
    fireEvent.change(campoSenha(), { target: { value: SENHA } });
    fireEvent.change(campoImap(), { target: { value: "imap.empresa.com.br" } });
    fireEvent.change(campoSmtp(), { target: { value: "smtp.empresa.com.br" } });
    fireEvent.click(botaoConectar());

    expect(await screen.findByText("Sem conexão com o servidor.")).toBeTruthy();
    expect(campoSenha().value).toBe("");
  });

  it("cancelar fecha, apaga o que foi digitado e não chama a api", async () => {
    await abrirOutroServidor();
    fireEvent.change(campoSenha(), { target: { value: SENHA } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onFechar).toHaveBeenCalledTimes(1);
    expect(pedidos()).toHaveLength(0);
  });
});

describe("a predefinição pelo domínio", () => {
  it("predefinicaoDoEndereco: Gmail, Outlook e o resto", () => {
    expect(predefinicaoDoEndereco("pessoa@gmail.com")).toBe("gmail");
    expect(predefinicaoDoEndereco("Pessoa@GoogleMail.com")).toBe("gmail");
    for (const dominio of ["outlook.com", "hotmail.com", "live.com", "msn.com"]) {
      expect(predefinicaoDoEndereco(`a@${dominio}`)).toBe("outlook");
    }
    expect(predefinicaoDoEndereco("vendas@empresa.com.br")).toBeUndefined();
    expect(predefinicaoDoEndereco("a@gmail.com.br")).toBeUndefined();
    expect(predefinicaoDoEndereco("sem-arroba")).toBeUndefined();
  });

  it("Gmail: mostra os servidores só para ler, explica a senha de app e manda só { usuario, senha, predefinicao }", async () => {
    await abrirOutroServidor(canalDoTeste({ identificadorExterno: "pessoa@gmail.com" }));
    expect(screen.getByText("Gmail")).toBeTruthy();
    expect(screen.getByText(/imap\.gmail\.com, porta 993/)).toBeTruthy();
    expect(screen.getByText(/smtp\.gmail\.com, porta 465/)).toBeTruthy();
    expect(
      screen.getByText("No Gmail, use uma senha de app (Conta do Google › Segurança › Senhas de app; exige a verificação em duas etapas)."),
    ).toBeTruthy();
    // Sem campos de servidor: a tela não escolhe host nem porta.
    expect(screen.queryByLabelText(/^Servidor IMAP/)).toBeNull();

    fireEvent.change(campoSenha(), { target: { value: SENHA } });
    fireEvent.click(botaoConectar());
    await waitFor(() => expect(onFechar).toHaveBeenCalled());
    expect(JSON.parse((pedidos()[0]![1] as RequestInit).body as string)).toEqual({
      usuario: "pessoa@gmail.com",
      senha: SENHA,
      predefinicao: "gmail",
    });
  });

  it("Outlook: a frase do SMTP autenticado, sem mês nem ano em nenhum texto do painel", async () => {
    await abrirOutroServidor(canalDoTeste({ identificadorExterno: "pessoa@outlook.com" }));
    expect(screen.getByText("Outlook")).toBeTruthy();
    expect(
      screen.getByText("No Microsoft 365, o SMTP autenticado pode estar desligado na caixa: se der erro, prefira Entrar com a Microsoft."),
    ).toBeTruthy();
    const texto = document.body.textContent ?? "";
    expect(texto).not.toMatch(/janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro/i);
    expect(texto).not.toMatch(/20[2-3]\d/);

    fireEvent.change(campoSenha(), { target: { value: SENHA } });
    fireEvent.click(botaoConectar());
    await waitFor(() => expect(onFechar).toHaveBeenCalled());
    expect(JSON.parse((pedidos()[0]![1] as RequestInit).body as string)).toEqual({
      usuario: "pessoa@outlook.com",
      senha: SENHA,
      predefinicao: "outlook",
    });
  });

  it("'Usar outros servidores' troca para os campos manuais e manda imap e smtp, sem predefinicao", async () => {
    await abrirOutroServidor(canalDoTeste({ identificadorExterno: "pessoa@gmail.com" }));
    fireEvent.click(screen.getByRole("button", { name: "Usar outros servidores" }));
    expect(campoImap()).toBeTruthy();
    fireEvent.change(campoSenha(), { target: { value: SENHA } });
    fireEvent.change(campoImap(), { target: { value: "imap.outro.com" } });
    fireEvent.change(campoSmtp(), { target: { value: "smtp.outro.com" } });
    fireEvent.click(botaoConectar());
    await waitFor(() => expect(onFechar).toHaveBeenCalled());
    const corpo = JSON.parse((pedidos()[0]![1] as RequestInit).body as string) as Record<string, unknown>;
    expect(corpo["predefinicao"]).toBeUndefined();
    expect(corpo["imap"]).toEqual({ host: "imap.outro.com", porta: 993 });
    expect(corpo["smtp"]).toEqual({ host: "smtp.outro.com", porta: 465 });
  });

  it("um domínio próprio não sugere predefinição nem mostra a ajuda do Gmail", async () => {
    await abrirOutroServidor();
    expect(screen.queryByText("Gmail")).toBeNull();
    expect(screen.queryByText(/senha de app \(Conta do Google/)).toBeNull();
  });
});

describe("Entrar com o Google e com a Microsoft", () => {
  it("Google: POST …/oauth/google/autorizar sem corpo e o navegador vai à URL devolvida", async () => {
    rotas[CONTA] = () => resposta(200, COM_LOGIN);
    rotas["POST /canais/uuid-1/email/oauth/google/autorizar"] = () => resposta(200, { ok: true, dados: { url: "https://accounts.google.com/o/oauth2/v2/auth?x=1" } });
    await abrir();
    fireEvent.click(await screen.findByRole("button", { name: "Entrar com o Google" }));

    await waitFor(() => expect(irParaForaDoApp).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2/v2/auth?x=1"));
    const envio = pedidos().find(([url]) => String(url).endsWith("/email/oauth/google/autorizar"))!;
    expect((envio[1] as RequestInit).body).toBeUndefined();
  });

  it("Microsoft: a mesma rota com o serviço microsoft", async () => {
    rotas[CONTA] = () => resposta(200, COM_LOGIN);
    rotas["POST /canais/uuid-1/email/oauth/microsoft/autorizar"] = () => resposta(200, { ok: true, dados: { url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?x=1" } });
    await abrir();
    fireEvent.click(await screen.findByRole("button", { name: "Entrar com a Microsoft" }));
    await waitFor(() => expect(irParaForaDoApp).toHaveBeenCalledWith("https://login.microsoftonline.com/common/oauth2/v2.0/authorize?x=1"));
  });

  it("a recusa da api aparece com a frase dela, como texto, e o navegador não sai", async () => {
    rotas[CONTA] = () => resposta(200, COM_LOGIN);
    rotas["POST /canais/uuid-1/email/oauth/google/autorizar"] = () =>
      resposta(503, { ok: false, error: "O login com o Google ainda não está disponível neste servidor. <i>x</i>", codigo: "EMAIL_OAUTH_NAO_CONFIGURADO" });
    await abrir();
    fireEvent.click(await screen.findByRole("button", { name: "Entrar com o Google" }));

    expect(await screen.findByText(/O login com o Google ainda não está disponível neste servidor\. <i>x<\/i>/)).toBeTruthy();
    expect(document.querySelector("i")).toBeNull();
    expect(irParaForaDoApp).not.toHaveBeenCalled();
  });
});

describe("semASenha", () => {
  it("troca a senha por ••• e não mexe no texto sem ela", () => {
    expect(semASenha(`erro ${SENHA} fim`, SENHA)).toBe("erro ••• fim");
    expect(semASenha("erro", "")).toBe("erro");
    expect(semASenha("erro", SENHA)).toBe("erro");
  });
});

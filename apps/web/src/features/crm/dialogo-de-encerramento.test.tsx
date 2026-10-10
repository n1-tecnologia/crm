// @vitest-environment jsdom
/**
 * 07-10 Task 1 — o `DialogoDeEncerramento` aplica as Regras de encerramento do
 * Funil ANTES do envio (D-05): Ganhar com `exigeValorGanho` e Perder com
 * `exigeMotivoPerda` desligam Confirmar com a frase do domínio; o valor
 * digitado à brasileira vira texto decimal no corpo; Reabrir um Negócio ganho
 * é desligado para quem não administra (RN-NEG-10, D-14) e uma recusa da api
 * (403/409) aparece sem fechar o diálogo. Nenhuma rede: `fetch` falso, sessão
 * falsa, `StoreProvider` de verdade com o seed.
 */

import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { buildSeed } from "@n1/dominio/seed";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import { DialogoDeEncerramento, type PropsDoDialogoDeEncerramento } from "./dialogo-de-encerramento";

const { obterSessao } = vi.hoisted(() => ({ obterSessao: vi.fn() }));

vi.mock("@/autenticacao/cliente-navegador", () => ({
  clienteDoNavegador: () => ({ auth: { getSession: obterSessao } }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/crm/negocios",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

const FRASE_VALOR = "Este Funil exige um valor maior que zero para marcar o Negócio como ganho.";
const FRASE_MOTIVO = "Este Funil exige o motivo da perda para marcar o Negócio como perdido.";
const FRASE_RN_NEG_10 = "Só Administrador ou Proprietário reabre um Negócio ganho (RN-NEG-10).";
const FRASE_FUNIL_ARQUIVADO = "O Funil deste Negócio está arquivado. Escolha um Funil ativo e uma Etapa para reabri-lo (RN-FUN-14).";

const FUNIL_ATIVO = { estado: "ativo" as const, exigeMotivoPerda: false, exigeValorGanho: false };
const ABERTO = { id: "n1", titulo: "Proposta Alfa", valor: null, situacao: "aberto" as const, estado: "ativo" as const };
const GANHO = { ...ABERTO, valor: "900.00", situacao: "ganho" as const };

const FUNIS_ATIVOS = {
  ok: true,
  total: 1,
  itens: [{ funil: { id: "f2", nome: "Pós-venda", estado: "ativo" }, totalEtapas: 2, negociosAbertos: 0 }],
};
const FUNIL_F2 = {
  ok: true,
  dados: {
    funil: { id: "f2", nome: "Pós-venda", estado: "ativo" },
    etapas: [
      { id: "e9", funilId: "f2", nome: "Boas-vindas", ordem: 1, probabilidadePadrao: 10, cor: null },
      { id: "e10", funilId: "f2", nome: "Acompanhamento", ordem: 2, probabilidadePadrao: 50, cor: null },
    ],
  },
};

let fetchMock: ReturnType<typeof vi.fn>;
let rotas: Record<string, (init: RequestInit) => Response>;

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api";
  rotas = {};
  fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const caminho = url.replace("http://api", "");
    if (caminho.startsWith("/funis?")) return resposta(200, FUNIS_ATIVOS);
    if (caminho === "/funis/f2") return resposta(200, FUNIL_F2);
    const rota = rotas[`${init.method ?? "GET"} ${caminho}`];
    if (rota) return rota(init);
    return resposta(404, { ok: false, error: "não roteado", codigo: "NAO_ROTEADO" });
  });
  vi.stubGlobal("fetch", fetchMock);
  obterSessao.mockReset();
  obterSessao.mockResolvedValue({ data: { session: { access_token: "tok" } } });
});

afterEach(() => {
  cleanup();
});

function montar(props: Partial<PropsDoDialogoDeEncerramento> & Pick<PropsDoDialogoDeEncerramento, "modo">, memberId = "mem_julia") {
  const onClose = vi.fn();
  const onConcluido = vi.fn();
  const transporte: Transporte = {
    gravar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
  const ui: ReactElement = (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <StoreProvider sessao={{ memberId }} estadoInicial={{ data: buildSeed(), revisao: 1, ordens: {} }} transporte={transporte}>
        <DialogoDeEncerramento negocio={ABERTO} funil={FUNIL_ATIVO} onClose={onClose} onConcluido={onConcluido} {...props} />
      </StoreProvider>
    </SWRConfig>
  );
  render(ui);
  return { onClose, onConcluido };
}

function gravacoes(): string[] {
  return (fetchMock.mock.calls as Array<[string, RequestInit | undefined]>)
    .filter(([, init]) => init?.method !== undefined && init.method !== "GET")
    .map(([url, init]) => `${init?.method} ${url.replace("http://api", "")}`);
}

function corpoDa(rotulo: string): unknown {
  const chamada = (fetchMock.mock.calls as Array<[string, RequestInit | undefined]>).find(
    ([url, init]) => `${init?.method} ${url.replace("http://api", "")}` === rotulo,
  );
  return chamada?.[1]?.body === undefined ? undefined : JSON.parse(chamada[1].body as string);
}

function botao(nome: string): HTMLElement {
  const encontrado = screen.queryByRole("button", { name: nome });
  expect(encontrado, `o botão "${nome}" está na tela`).not.toBeNull();
  return encontrado as HTMLElement;
}

describe("DialogoDeEncerramento — ganhar", () => {
  it("(b) com exigeValorGanho e Negócio sem valor, Confirmar fica desligado com a frase de validarGanho até digitar o valor; 1.234,56 vai como 1234.56", async () => {
    const { onConcluido } = montar({ modo: "ganhar", funil: { ...FUNIL_ATIVO, exigeValorGanho: true } });
    expect(botao("Marcar como ganho").getAttribute("aria-disabled")).toBe("true");
    expect(botao("Marcar como ganho").getAttribute("title")).toBe(FRASE_VALOR);
    fireEvent.click(botao("Marcar como ganho"));
    expect(gravacoes()).toEqual([]);

    rotas["POST /negocios/n1/ganhar"] = () => resposta(200, { ok: true, dados: {} });
    fireEvent.change(screen.getByLabelText(/^Valor/), { target: { value: "1.234,56" } });
    expect(botao("Marcar como ganho").getAttribute("aria-disabled")).not.toBe("true");
    fireEvent.click(botao("Marcar como ganho"));
    await waitFor(() => expect(onConcluido).toHaveBeenCalledTimes(1));
    expect(gravacoes()).toEqual(["POST /negocios/n1/ganhar"]);
    expect(corpoDa("POST /negocios/n1/ganhar")).toEqual({ valor: "1234.56" });
  });

  it("(b) o valor do Negócio vem preenchido, o motivo e a nota seguem no corpo, e um valor que não é número desliga Confirmar", async () => {
    const { onConcluido } = montar({ modo: "ganhar", negocio: { ...ABERTO, valor: "1500.00" }, funil: { ...FUNIL_ATIVO, exigeValorGanho: true } });
    expect((screen.getByLabelText(/^Valor/) as HTMLInputElement).value).toBe("1500,00");

    fireEvent.change(screen.getByLabelText(/^Valor/), { target: { value: "abc" } });
    expect(botao("Marcar como ganho").getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("alert").textContent).toMatch(/valor/i);

    rotas["POST /negocios/n1/ganhar"] = () => resposta(200, { ok: true, dados: {} });
    fireEvent.change(screen.getByLabelText(/^Valor/), { target: { value: "1600" } });
    fireEvent.change(screen.getByLabelText("Motivo do ganho"), { target: { value: "Preço e prazo" } });
    fireEvent.change(screen.getByLabelText("Nota de encerramento"), { target: { value: "Fechou na reunião." } });
    fireEvent.click(botao("Marcar como ganho"));
    await waitFor(() => expect(onConcluido).toHaveBeenCalledTimes(1));
    expect(corpoDa("POST /negocios/n1/ganhar")).toEqual({ valor: "1600", motivoGanho: "Preço e prazo", notaEncerramento: "Fechou na reunião." });
  });

  it("(b) a recusa NEGOCIO_EXIGE_VALOR da api (a tela estava velha) cai no campo Valor e o diálogo continua aberto", async () => {
    const { onConcluido } = montar({ modo: "ganhar", negocio: { ...ABERTO, valor: "10.00" } });
    rotas["POST /negocios/n1/ganhar"] = () =>
      resposta(409, { ok: false, error: FRASE_VALOR, codigo: "NEGOCIO_EXIGE_VALOR", campo: "valor" });
    fireEvent.click(botao("Marcar como ganho"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(FRASE_VALOR));
    expect(onConcluido).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^Valor/)).toBeTruthy();
  });
});

describe("DialogoDeEncerramento — perder", () => {
  it("(c) com exigeMotivoPerda, sem motivo Confirmar fica desligado com a frase de validarPerda; com motivo envia { motivoPerda, notaEncerramento }", async () => {
    const { onConcluido } = montar({ modo: "perder", funil: { ...FUNIL_ATIVO, exigeMotivoPerda: true } });
    expect(botao("Marcar como perdido").getAttribute("aria-disabled")).toBe("true");
    expect(botao("Marcar como perdido").getAttribute("title")).toBe(FRASE_MOTIVO);
    fireEvent.click(botao("Marcar como perdido"));
    expect(gravacoes()).toEqual([]);

    rotas["POST /negocios/n1/perder"] = () => resposta(200, { ok: true, dados: {} });
    fireEvent.change(screen.getByLabelText(/^Motivo da perda/), { target: { value: "Preço" } });
    fireEvent.change(screen.getByLabelText("Nota de encerramento"), { target: { value: "Foi para o concorrente." } });
    expect(botao("Marcar como perdido").getAttribute("aria-disabled")).not.toBe("true");
    fireEvent.click(botao("Marcar como perdido"));
    await waitFor(() => expect(onConcluido).toHaveBeenCalledTimes(1));
    expect(gravacoes()).toEqual(["POST /negocios/n1/perder"]);
    expect(corpoDa("POST /negocios/n1/perder")).toEqual({ motivoPerda: "Preço", notaEncerramento: "Foi para o concorrente." });
  });

  it("(c) sem a Regra, perder vai sem motivo; e a recusa NEGOCIO_EXIGE_MOTIVO da api cai no campo", async () => {
    const { onConcluido } = montar({ modo: "perder" });
    expect(botao("Marcar como perdido").getAttribute("aria-disabled")).not.toBe("true");
    rotas["POST /negocios/n1/perder"] = () =>
      resposta(409, { ok: false, error: FRASE_MOTIVO, codigo: "NEGOCIO_EXIGE_MOTIVO", campo: "motivoPerda" });
    fireEvent.click(botao("Marcar como perdido"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(FRASE_MOTIVO));
    expect(onConcluido).not.toHaveBeenCalled();
  });
});

describe("DialogoDeEncerramento — reabrir", () => {
  it("(d) reabrir um ganho para Membro de base membro fica desligado com a frase de RN-NEG-10 e não vai à api", () => {
    montar({ modo: "reabrir", negocio: GANHO }, "mem_julia");
    expect(botao("Reabrir Negócio").getAttribute("aria-disabled")).toBe("true");
    expect(botao("Reabrir Negócio").getAttribute("title")).toBe(FRASE_RN_NEG_10);
    fireEvent.click(botao("Reabrir Negócio"));
    expect(gravacoes()).toEqual([]);
  });

  it("(d) Administrador reabre sem corpo; e o 403 da api, se forçado, aparece por MensagemDeRecusa com o diálogo aberto", async () => {
    const { onConcluido } = montar({ modo: "reabrir", negocio: GANHO }, "mem_rafael");
    expect(botao("Reabrir Negócio").getAttribute("aria-disabled")).not.toBe("true");

    rotas["POST /negocios/n1/reabrir"] = () => resposta(403, { ok: false, error: FRASE_RN_NEG_10, codigo: "SEM_PERMISSAO" });
    fireEvent.click(botao("Reabrir Negócio"));
    await waitFor(() => expect(screen.getByText(FRASE_RN_NEG_10)).toBeTruthy());
    expect(onConcluido).not.toHaveBeenCalled();

    rotas["POST /negocios/n1/reabrir"] = () => resposta(200, { ok: true, dados: {} });
    fireEvent.click(botao("Reabrir Negócio"));
    await waitFor(() => expect(onConcluido).toHaveBeenCalledTimes(1));
    const chamada = (fetchMock.mock.calls as Array<[string, RequestInit]>).filter(([url]) => url.endsWith("/reabrir")).at(-1);
    expect(chamada?.[1].body).toBeUndefined();
  });

  it("(d) um perdido reabre para qualquer Membro, com a Etapa de destino opcional (manter a atual ou escolher outra)", async () => {
    const { onConcluido } = montar(
      { modo: "reabrir", negocio: { ...ABERTO, situacao: "perdido" }, etapas: [{ id: "e1", nome: "Prospecção" }, { id: "e2", nome: "Proposta" }] },
      "mem_julia",
    );
    expect(botao("Reabrir Negócio").getAttribute("aria-disabled")).not.toBe("true");
    rotas["POST /negocios/n1/reabrir"] = () => resposta(200, { ok: true, dados: {} });
    fireEvent.click(screen.getByRole("combobox", { name: /Etapa de destino/ }));
    fireEvent.click(screen.getByRole("option", { name: "Proposta" }));
    fireEvent.click(botao("Reabrir Negócio"));
    await waitFor(() => expect(onConcluido).toHaveBeenCalledTimes(1));
    expect(corpoDa("POST /negocios/n1/reabrir")).toEqual({ etapaId: "e2" });
  });

  it("(d) com o Funil arquivado, Confirmar espera um Funil ativo e uma Etapa (RN-FUN-14) e envia os dois", async () => {
    const { onConcluido } = montar({
      modo: "reabrir",
      negocio: { ...ABERTO, situacao: "perdido" },
      funil: { ...FUNIL_ATIVO, estado: "arquivado" },
    });
    expect(botao("Reabrir Negócio").getAttribute("aria-disabled")).toBe("true");
    expect(botao("Reabrir Negócio").getAttribute("title")).toBe(FRASE_FUNIL_ARQUIVADO);

    fireEvent.click(screen.getByRole("combobox", { name: /Funil de destino/ }));
    fireEvent.click(await screen.findByRole("option", { name: "Pós-venda" }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: /Etapa de destino/ }).getAttribute("aria-disabled")).not.toBe("true"));
    fireEvent.click(screen.getByRole("combobox", { name: /Etapa de destino/ }));
    fireEvent.click(await screen.findByRole("option", { name: "Boas-vindas" }));
    expect(botao("Reabrir Negócio").getAttribute("aria-disabled")).not.toBe("true");

    rotas["POST /negocios/n1/reabrir"] = () => resposta(200, { ok: true, dados: {} });
    fireEvent.click(botao("Reabrir Negócio"));
    await waitFor(() => expect(onConcluido).toHaveBeenCalledTimes(1));
    expect(corpoDa("POST /negocios/n1/reabrir")).toEqual({ funilId: "f2", etapaId: "e9" });
  });
});

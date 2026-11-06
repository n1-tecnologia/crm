// @vitest-environment jsdom
/**
 * 15-36 Task 2 — a página do Membro (`/configuracoes/membros/[membro]`) mostra a prévia da
 * sucessão de Contatos, Empresas, Negócios e Conversas lida das TABELAS (`useSucessaoNoCrm`),
 * não do estado em memória; Agentes, Automações e o resto seguem de `previewSuccession`.
 * As Conversas passam ao Sucessor (D-15-08): a página não as conta como "sem Responsável".
 * Molde de `membros-sucessao-no-crm.test.tsx`: `buildSeed()`, `StoreProvider` de verdade,
 * transporte falso, `useSucessaoNoCrm` falso. `params` é uma Promise já resolvida (`use`).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import { previewSuccession } from "@n1/dominio/operations";
import type { DataState } from "@n1/dominio/state";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import MembroPage from "@/app/(shell)/configuracoes/membros/[membro]/page";

const { sucessao, chamadas } = vi.hoisted(() => ({
  sucessao: { atual: { data: undefined, error: undefined } as { data: unknown; error: Error | undefined } },
  chamadas: [] as Array<string | undefined>,
}));

vi.mock("@/dados/crm/sucessao", () => ({
  useSucessaoNoCrm: (membroId: string | undefined) => {
    chamadas.push(membroId);
    return membroId === undefined ? { data: undefined, error: undefined } : sucessao.atual;
  },
  invalidarCrmDaSucessao: vi.fn(async () => undefined),
}));

let state: DataState;
let alvoId: string;

beforeEach(() => {
  state = buildSeed();
  const alvo = state.members.find((m) => m.state === "ativo" && m.id !== state.workspace.ownerMemberId && m.id !== "mem_julia");
  if (!alvo) throw new Error("o seed precisa de um Membro ativo que não seja o Proprietário");
  alvoId = alvo.id;
  sucessao.atual = { data: undefined, error: undefined };
  chamadas.length = 0;
});

afterEach(() => {
  cleanup();
});

/** `use(params)` devolve na hora uma Promise marcada como cumprida, sem Suspense. */
function paramsDe(membro: string): Promise<{ membro: string }> {
  const valor = { membro };
  return Object.assign(Promise.resolve(valor), { status: "fulfilled" as const, value: valor });
}

function montar(quem: string = state.workspace.ownerMemberId, membro: string = alvoId) {
  const transporte: Transporte = {
    gravar: vi.fn(),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
  render(
    <StoreProvider sessao={{ memberId: quem }} estadoInicial={{ data: state, revisao: 1, ordens: {} }} transporte={transporte}>
      <MembroPage params={paramsDe(membro)} />
    </StoreProvider>,
  );
}

/** O número ao lado do rótulo, na lista "O que este Membro possui". */
function contagemDe(rotulo: string): string | undefined {
  const linha = screen.queryByText(rotulo)?.closest("li");
  return linha ? within(linha).getAllByText(/^\d+$/)[0]?.textContent ?? undefined : undefined;
}

describe("a página do Membro lê a sucessão do CRM nas tabelas", () => {
  it("(a) Contatos, Empresas, Negócios e Conversas vêm da api, não do estado em memória", () => {
    const contatoAntigo = state.contacts[0];
    if (!contatoAntigo) throw new Error("o seed precisa de um Contato");
    contatoAntigo.ownerMemberId = alvoId;
    sucessao.atual = { data: { contatos: 7, empresas: 2, negocios: 5, conversasPassadas: 3 }, error: undefined };
    montar();
    expect(contagemDe("Contatos")).toBe("7");
    expect(contagemDe("Empresas")).toBe("2");
    expect(contagemDe("Negócios")).toBe("5");
    expect(contagemDe("Conversas")).toBe("3");
  });

  it("(b) o que mora em `registros` segue vindo do estado: um Agente do Membro aparece", () => {
    const agente = state.agents[0];
    if (!agente) throw new Error("o seed precisa de um Agente");
    agente.ownerMemberId = alvoId;
    sucessao.atual = { data: { contatos: 0, empresas: 0, negocios: 0, conversasPassadas: 0 }, error: undefined };
    montar();
    expect(contagemDe("Agentes")).toBeDefined();
    expect(screen.queryByText("Contatos")).toBeNull();
    expect(screen.queryByText("Conversas")).toBeNull();
  });

  it("(c) as Conversas passam ao Sucessor: a frase de fechamento não as conta como sem Responsável", () => {
    sucessao.atual = { data: { contatos: 0, empresas: 0, negocios: 0, conversasPassadas: 4 }, error: undefined };
    montar();
    const soltas = previewSuccession(state, alvoId).releases.length;
    expect(screen.getByText(new RegExp(`libera ${soltas} atribuição\\(ões\\) sem Responsável`))).toBeTruthy();
    expect(screen.getByText(/as Conversas que ele atende passam ao Sucessor/)).toBeTruthy();
    expect(screen.queryByText(/é liberad/)).toBeNull();
  });

  it("(d) enquanto a api não responde diz que está contando, e se recusar mostra a recusa", () => {
    montar();
    expect(screen.getByText("Contando o que está no CRM…")).toBeTruthy();
    cleanup();
    sucessao.atual = { data: undefined, error: new ErroDeApi(403, "Só um Administrador vê a sucessão.") };
    montar();
    expect(screen.getByText(/Não foi possível contar o CRM: Só um Administrador vê a sucessão\./)).toBeTruthy();
  });

  it("(e) só Administrador ou Proprietário lê a sucessão: quem não governa não chama a api", () => {
    montar("mem_julia");
    expect(chamadas.every((id) => id === undefined)).toBe(true);
    cleanup();
    chamadas.length = 0;
    montar();
    expect(chamadas).toContain(alvoId);
  });
});

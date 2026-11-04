// @vitest-environment jsdom
/**
 * 14-16 Task 3 — o diálogo de remover Membro mostra as contagens de Contatos,
 * Empresas, Negócios e Conversas liberadas lidas das TABELAS (`useSucessaoNoCrm`),
 * não as do estado em memória (`previewSuccession`); Agentes, Automações e o resto
 * continuam do estado. A remoção segue por `removeMember`. Molde de
 * `membros-sem-capacidade.test.tsx`: `buildSeed()`, `StoreProvider` de verdade,
 * transporte falso, `next/navigation` mockado (com `?remover-membro=`).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import type { DataState } from "@n1/dominio/state";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import MembrosPage from "@/app/(shell)/configuracoes/membros/page";

const { membroEmRemocao, sucessao } = vi.hoisted(() => ({
  membroEmRemocao: { atual: "" },
  sucessao: { atual: { data: undefined, error: undefined } as { data: unknown; error: Error | undefined } },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/configuracoes/membros",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(membroEmRemocao.atual ? { "remover-membro": membroEmRemocao.atual } : {}),
}));

vi.mock("@/dados/crm/sucessao", () => ({
  useSucessaoNoCrm: () => sucessao.atual,
  invalidarCrmDaSucessao: vi.fn(async () => undefined),
}));

let state: DataState;

beforeEach(() => {
  state = buildSeed();
  const alvo = state.members.find((m) => m.state === "ativo" && m.id !== state.workspace.ownerMemberId);
  if (!alvo) throw new Error("o seed precisa de um Membro ativo que não seja o Proprietário");
  membroEmRemocao.atual = alvo.id;
  sucessao.atual = { data: undefined, error: undefined };
});

afterEach(() => {
  cleanup();
});

function montar() {
  const transporte: Transporte = {
    gravar: vi.fn(),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
  render(
    <StoreProvider sessao={{ memberId: state.workspace.ownerMemberId }} estadoInicial={{ data: state, revisao: 1, ordens: {} }} transporte={transporte}>
      <MembrosPage />
    </StoreProvider>,
  );
}

describe("o diálogo de remover Membro lê a sucessão do CRM nas tabelas", () => {
  it("(a) mostra as contagens da api, sem listar Contatos, Empresas, Negócios ou Conversas do estado em memória", () => {
    // Um Contato do modelo antigo deste Membro: se o diálogo ainda lesse o estado, o nome dele apareceria.
    const alvoId = membroEmRemocao.atual;
    const contatoAntigo = state.contacts[0];
    if (!contatoAntigo) throw new Error("o seed precisa de um Contato");
    contatoAntigo.ownerMemberId = alvoId;
    contatoAntigo.firstName = "Zenaide";
    contatoAntigo.lastName = "Antiga-do-Estado";
    sucessao.atual = { data: { contatos: 7, empresas: 2, negocios: 5, conversasLiberadas: 3 }, error: undefined };
    montar();
    expect(screen.getByText("Contatos: 7")).toBeTruthy();
    expect(screen.getByText("Empresas: 2")).toBeTruthy();
    expect(screen.getByText("Negócios: 5")).toBeTruthy();
    expect(screen.getByText("Conversas: 3")).toBeTruthy();
    expect(screen.queryByText(/Zenaide/)).toBeNull();
    // Os totais dos títulos somam o que veio da api com o que o estado ainda conta (Agentes, Automações…).
    expect(screen.getByText(/Passa ao Sucessor \(\d+\)/)).toBeTruthy();
    expect(screen.getByText(/Fica sem Responsável \(\d+\)/)).toBeTruthy();
  });

  it("(b) o que não é do CRM continua vindo do estado: um Agente do Membro aparece na lista", () => {
    const alvoId = membroEmRemocao.atual;
    const agente = state.agents[0];
    if (!agente) throw new Error("o seed precisa de um Agente");
    agente.ownerMemberId = alvoId;
    agente.name = "Agente da Sucessão";
    sucessao.atual = { data: { contatos: 0, empresas: 0, negocios: 0, conversasLiberadas: 0 }, error: undefined };
    montar();
    expect(screen.getByText("Agente: Agente da Sucessão")).toBeTruthy();
  });

  it("(c) sem nada no CRM, as linhas de zero não aparecem", () => {
    sucessao.atual = { data: { contatos: 0, empresas: 0, negocios: 0, conversasLiberadas: 0 }, error: undefined };
    montar();
    expect(screen.queryByText(/^Contatos:/)).toBeNull();
    expect(screen.queryByText(/^Conversas:/)).toBeNull();
  });

  it("(d) enquanto a api não responde, diz que está contando, em vez de mostrar zero", () => {
    sucessao.atual = { data: undefined, error: undefined };
    montar();
    expect(screen.getAllByText("Contando o que está no CRM…").length).toBeGreaterThan(0);
  });

  it("(e) se a api recusar, a recusa aparece no lugar das contagens e o diálogo segue aberto", () => {
    sucessao.atual = { data: undefined, error: new ErroDeApi(403, "Só um Administrador vê a sucessão.") };
    montar();
    expect(screen.getAllByText(/Não foi possível contar o CRM: Só um Administrador vê a sucessão\./).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Remover Membro" })).toBeTruthy();
  });
});

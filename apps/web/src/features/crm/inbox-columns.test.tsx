// @vitest-environment jsdom
/**
 * 08-11 Task 2 — a lista de Conversas da Caixa de Entrada diz por qual CANAL
 * cada Conversa entrou (D-16), provado com dois WhatsApps no mesmo Espaço: o
 * nome do Canal no item, o filtro `?canal=` com o rótulo do provedor e, na
 * lista, a janela de resposta que só o provedor oficial tem (D-02).
 * `StoreProvider` de verdade com o seed e o transporte em memória; nenhuma rede.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import type { DataState } from "@n1/dominio/state";
import type { Channel, Contact, Conversation, Message } from "@n1/dominio/types";
import { StoreProvider } from "@/dados/store";
import { transporteEmMemoria } from "@/dados/transporte";
import { InboxColumns } from "@/features/crm/inbox-columns";

const { navegacao } = vi.hoisted(() => ({ navegacao: { busca: "" } }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/crm/caixa-de-entrada",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(navegacao.busca),
}));

let estado: DataState;
let contato: Contact;

function novoCanal(
  id: string,
  nome: string,
  provider: NonNullable<Channel["provider"]>,
  extras: Partial<Channel> = {},
): void {
  const base = estado.channels.find((c) => c.id === "chn_wpp");
  if (!base) throw new Error("o seed precisa do Canal chn_wpp");
  estado.channels.push({
    ...structuredClone(base),
    id,
    name: nome,
    externalId: `+5511${id.length}${nome.length}0000000`,
    connection: "conectada",
    provider,
    relational: true,
    messageTemplates: [],
    ...extras,
  });
}

type Troca = readonly [direcao: Message["direction"], criadoEm: string];

function novaConversa(modelo: Conversation, id: string, canalId: string, mensagens: readonly Troca[]): void {
  const mensagem = modelo.messages[0];
  if (!mensagem) throw new Error("o seed precisa de uma Conversa com Mensagem");
  estado.conversations.push({
    ...structuredClone(modelo),
    id,
    channelId: canalId,
    contactId: contato.id,
    lifecycle: "ativo",
    state: "aberta",
    drafts: [],
    messages: mensagens.map(([direction, createdAt], i) => ({
      ...structuredClone(mensagem),
      id: `${id}_m${i}`,
      conversationId: id,
      direction,
      content: `${id} mensagem ${i}`,
      createdAt,
    })),
  });
}

beforeEach(() => {
  navegacao.busca = "aba=todos";
  estado = buildSeed();
  const candidato = estado.contacts.find((c) => c.identifiers.some((i) => i.type === "identidadeDeWhatsApp"));
  const modelo = estado.conversations.find((c) => c.messages.length > 0);
  if (!candidato || !modelo) throw new Error("o seed precisa de um Contato com WhatsApp e de uma Conversa com Mensagem");
  contato = candidato;
  const molde = structuredClone(modelo);
  // Só as duas Conversas deste teste: a lista do seed não entra na conta.
  estado.conversations = [];

  novoCanal("chn_comercial", "Comercial", "whatsapp-cloud");
  novoCanal("chn_suporte", "Suporte", "whatsapp-nao-oficial", { simulatedConnection: true });

  // Recebida às 08h e uma resposta 30 h depois: passou da janela de 24 h do WhatsApp oficial.
  const trocas: readonly Troca[] = [
    ["recebida", "2026-10-10T08:00:00.000Z"],
    ["enviada", "2026-10-11T14:00:00.000Z"],
  ];
  novaConversa(molde, "cnv_comercial", "chn_comercial", trocas);
  novaConversa(molde, "cnv_suporte", "chn_suporte", trocas);
});

afterEach(() => {
  cleanup();
});

function montar() {
  return render(
    <StoreProvider
      sessao={{ memberId: "mem_thiago" }}
      estadoInicial={{ data: estado, revisao: 1, ordens: {} }}
      transporte={transporteEmMemoria()}
    >
      <InboxColumns>{null}</InboxColumns>
    </StoreProvider>,
  );
}

/** O link do item da lista de uma Conversa — onde o Canal e os marcadores moram. */
function itemDe(conversaId: string): HTMLElement {
  const link = screen
    .getAllByRole("link")
    .find((a) => a.getAttribute("href")?.startsWith(`/crm/caixa-de-entrada/${conversaId}`));
  if (!link) throw new Error(`sem item para a Conversa ${conversaId}`);
  return link;
}

describe("InboxColumns — a lista por Canal", () => {
  it("(1) sem filtro, cada Conversa diz o nome do seu Canal", () => {
    montar();
    expect(within(itemDe("cnv_comercial")).getByText("Comercial")).toBeTruthy();
    expect(within(itemDe("cnv_suporte")).getByText("Suporte")).toBeTruthy();
    // O disco do Canal também diz o provedor, para leitor de tela e para o `title`.
    expect(within(itemDe("cnv_suporte")).getByText("Suporte · WhatsApp não oficial")).toBeTruthy();
  });

  it("(2) com ?canal=<Suporte>, só a Conversa de Suporte aparece", () => {
    navegacao.busca = "aba=todos&canal=chn_suporte";
    montar();
    expect(itemDe("cnv_suporte")).toBeTruthy();
    expect(() => itemDe("cnv_comercial")).toThrow();
  });

  it("(3) o filtro Canal nomeia cada Canal com o rótulo do provedor", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Canal" }));
    expect(screen.getByRole("option", { name: "Suporte · WhatsApp não oficial" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Comercial · WhatsApp oficial" })).toBeTruthy();
  });

  it("(4) fora do Prazo só aparece no Canal oficial: o não oficial não tem janela", () => {
    montar();
    expect(within(itemDe("cnv_comercial")).getByText("fora do Prazo")).toBeTruthy();
    expect(within(itemDe("cnv_suporte")).queryByText("fora do Prazo")).toBeNull();
  });

  it("(5) o cabeçalho leva às Configurações da Caixa de Entrada, onde moram Canais e Filas", () => {
    montar();
    const atalho = screen.getByRole("link", { name: "Configurações da Caixa de Entrada" });
    expect(atalho.getAttribute("href")).toBe("/crm/caixa-de-entrada/configuracoes");
  });
});

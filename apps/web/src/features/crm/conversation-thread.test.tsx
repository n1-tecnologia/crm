// @vitest-environment jsdom
/**
 * 08-10 Task 3 — o fio da Conversa por Canal (D-13, D-14, D-15), provado com
 * dois WhatsApps no mesmo Espaço: uma aba por Canal, a aba que abre no Canal da
 * última recebida, o "Responder por" só com Canais conectados que alcançam o
 * Contato, a troca de Canal que abre (ou reutiliza) a Conversa sem mexer em
 * nenhuma existente (INV-CXE-04) e o envio pelo Canal da aba, nunca "pelo
 * primeiro do tipo". `StoreProvider` de verdade com o seed e o transporte em
 * memória; nenhuma rede.
 */

import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import type { DataState } from "@n1/dominio/state";
import type { Channel, Contact, Conversation, Message } from "@n1/dominio/types";
import { StoreProvider, useData } from "@/dados/store";
import { transporteEmMemoria } from "@/dados/transporte";
import { ConversationThread } from "@/features/crm/conversation-thread";

let estado: DataState;
let contato: Contact;
/** O estado vivo do store, relido pela sonda depois de cada renderização. */
const sonda: { dados: DataState | undefined } = { dados: undefined };

function Sonda() {
  const dados = useData((data) => data);
  useEffect(() => {
    sonda.dados = dados;
  });
  return null;
}

function dadosDoStore(): DataState {
  if (!sonda.dados) throw new Error("a sonda ainda não leu o store");
  return sonda.dados;
}

function novoCanal(
  id: string,
  nome: string,
  provider: NonNullable<Channel["provider"]>,
  connection: Channel["connection"],
  criadoEm: string,
  extras: Partial<Channel> = {},
): void {
  const base = estado.channels.find((c) => c.id === "chn_wpp");
  if (!base) throw new Error("o seed precisa do Canal chn_wpp");
  estado.channels.push({
    ...structuredClone(base),
    id,
    name: nome,
    externalId: `+5511${id.length}${nome.length}0000000`,
    connection,
    createdAt: criadoEm,
    provider,
    relational: true,
    messageTemplates: [],
    ...extras,
  });
}

type Troca = readonly [direcao: Message["direction"], criadoEm: string];

function novaConversa(id: string, canalId: string, mensagens: readonly Troca[]): void {
  const base = estado.conversations.find((c) => c.messages.length > 0);
  const modelo = base?.messages[0];
  if (!base || !modelo) throw new Error("o seed precisa de uma Conversa com Mensagem");
  const conversa: Conversation = {
    ...structuredClone(base),
    id,
    channelId: canalId,
    contactId: contato.id,
    lifecycle: "ativo",
    state: "aberta",
    drafts: [],
    messages: mensagens.map(([direction, createdAt], i) => ({
      ...structuredClone(modelo),
      id: `${id}_m${i}`,
      conversationId: id,
      direction,
      content: `${id} mensagem ${i}`,
      createdAt,
    })),
  };
  estado.conversations.push(conversa);
}

beforeEach(() => {
  estado = buildSeed();
  const candidato = estado.contacts.find((c) => c.identifiers.some((i) => i.type === "identidadeDeWhatsApp"));
  if (!candidato) throw new Error("o seed precisa de um Contato com WhatsApp");
  // Só o WhatsApp: o Canal de e-mail e os demais não alcançam este Contato.
  candidato.identifiers = candidato.identifiers.filter((i) => i.type === "identidadeDeWhatsApp");
  contato = candidato;
  estado.conversations = estado.conversations.filter((c) => c.contactId !== contato.id);

  novoCanal("chn_comercial", "Comercial", "whatsapp-cloud", "conectada", "2026-01-01T09:00:00.000Z");
  novoCanal("chn_suporte", "Suporte", "whatsapp-nao-oficial", "conectada", "2026-01-02T09:00:00.000Z", {
    simulatedConnection: true,
  });
  novoCanal("chn_desligado", "Desligado", "whatsapp-nao-oficial", "desconectada", "2026-01-03T09:00:00.000Z");

  // A Mensagem recebida mais recente de todas está em "Suporte".
  novaConversa("cnv_wpp", "chn_wpp", [
    ["recebida", "2026-10-09T10:00:00.000Z"],
    ["enviada", "2026-10-12T08:00:00.000Z"],
  ]);
  novaConversa("cnv_comercial", "chn_comercial", [["recebida", "2026-10-10T10:00:00.000Z"]]);
  novaConversa("cnv_suporte", "chn_suporte", [["recebida", "2026-10-11T09:00:00.000Z"]]);
});

afterEach(() => {
  cleanup();
  sonda.dados = undefined;
});

function montar() {
  return render(
    <StoreProvider
      sessao={{ memberId: "mem_thiago" }}
      estadoInicial={{ data: estado, revisao: 1, ordens: {} }}
      transporte={transporteEmMemoria()}
    >
      <Sonda />
      <ConversationThread contact={contato} />
    </StoreProvider>,
  );
}

const abas = () => screen.getAllByRole("tab");
const abaDe = (trecho: string) => {
  const aba = abas().find((a) => a.textContent?.includes(trecho));
  if (!aba) throw new Error(`sem aba com “${trecho}”`);
  return aba;
};
const respondePor = () => screen.getByRole("combobox", { name: "Responder por" });

describe("ConversationThread — o fio por Canal", () => {
  it("(1) uma aba por Canal ativo, com dois WhatsApps; a do Canal de e-mail fica desligada", () => {
    montar();
    expect(abaDe("Comercial · WhatsApp oficial")).toBeTruthy();
    expect(abaDe("Suporte · WhatsApp não oficial")).toBeTruthy();
    expect(abaDe("Comercial SP · WhatsApp oficial")).toBeTruthy();
    expect(abaDe("Comercial · WhatsApp oficial").getAttribute("aria-disabled")).toBe("false");
    expect(abaDe("contato@institutoigoralves.com.br").getAttribute("aria-disabled")).toBe("true");
    expect(abaDe("contato@institutoigoralves.com.br").textContent).toContain("Este Contato não tem E-mail.");
  });

  it("(2) abre na aba do Canal da última recebida e a barra do topo mostra Canal, selo e conexão simulada", () => {
    montar();
    expect(abaDe("Suporte · WhatsApp não oficial").getAttribute("aria-selected")).toBe("true");
    expect(abaDe("Comercial · WhatsApp oficial").getAttribute("aria-selected")).toBe("false");
    const barra = document.querySelector<HTMLElement>("[data-regra-do-canal]");
    expect(barra).not.toBeNull();
    const dentro = within(barra as HTMLElement);
    expect(dentro.getByText("Suporte")).toBeTruthy();
    expect(dentro.getByText("não oficial")).toBeTruthy();
    expect(dentro.getByText("conexão simulada")).toBeTruthy();
    // A Conversa da aba é a do Canal da aba, não a de outro WhatsApp.
    expect(screen.getByText("cnv_suporte mensagem 0")).toBeTruthy();
    expect(screen.queryByText("cnv_comercial mensagem 0")).toBeNull();
  });

  it("(3) o “Responder por” vale o Canal da última recebida e só oferece Canais conectados que alcançam o Contato", () => {
    montar();
    expect(respondePor().textContent).toContain("Suporte · WhatsApp não oficial");
    fireEvent.click(respondePor());
    const opcoes = screen.getAllByRole("option").map((o) => o.textContent ?? "");
    expect(opcoes.some((o) => o.includes("Comercial · WhatsApp oficial"))).toBe(true);
    expect(opcoes.some((o) => o.includes("Comercial SP · WhatsApp oficial"))).toBe(true);
    expect(opcoes.some((o) => o.includes("Suporte · WhatsApp não oficial"))).toBe(true);
    // Desconectado, de outro tipo ou sem Identificador do Contato: não é opção.
    expect(opcoes.some((o) => o.includes("Desligado"))).toBe(false);
    expect(opcoes.some((o) => o.includes("Instagram"))).toBe(false);
    expect(opcoes.some((o) => o.includes("E-mail"))).toBe(false);
    expect(opcoes).toHaveLength(3);
    // A aba do Canal desconectado existe (o Contato o alcança), só não recebe resposta nova.
    expect(abaDe("Desligado · WhatsApp não oficial").getAttribute("aria-disabled")).toBe("false");
  });

  it("(4) trocar o “Responder por” muda a aba, abre a Conversa do outro Canal e não toca no Canal de nenhuma existente", async () => {
    montar();
    const antes = new Map(dadosDoStore().conversations.map((c) => [c.id, c.channelId]));
    expect(antes.get("cnv_suporte")).toBe("chn_suporte");

    fireEvent.click(respondePor());
    const opcao = screen.getAllByRole("option").find((o) => o.textContent === "Comercial · WhatsApp oficial");
    expect(opcao).toBeTruthy();
    fireEvent.click(opcao as HTMLElement);

    await waitFor(() => {
      expect(abaDe("Comercial · WhatsApp oficial").getAttribute("aria-selected")).toBe("true");
    });
    expect(abaDe("Suporte · WhatsApp não oficial").getAttribute("aria-selected")).toBe("false");
    expect(screen.getByRole("status").textContent).toContain("Respondendo por Comercial · WhatsApp oficial.");
    // O fio passou a mostrar a Conversa de “Comercial”.
    expect(screen.getByText("cnv_comercial mensagem 0")).toBeTruthy();

    const doContato = dadosDoStore().conversations.filter((c) => c.contactId === contato.id);
    expect(doContato.some((c) => c.channelId === "chn_comercial")).toBe(true);
    // INV-CXE-04: o Canal de nenhuma Conversa que já existia mudou.
    for (const [id, canalId] of antes) {
      expect(dadosDoStore().conversations.find((c) => c.id === id)?.channelId).toBe(canalId);
    }
    expect(dadosDoStore().conversations.find((c) => c.id === "cnv_suporte")?.channelId).toBe("chn_suporte");
    expect(dadosDoStore().conversations.find((c) => c.id === "cnv_comercial")?.channelId).toBe("chn_comercial");
  });

  it("(5) numa aba por Canal a sequência é de um Canal só: nenhum separador “via …” no fio", () => {
    montar();
    const separadoresVia = screen.queryAllByRole("separator").filter((s) => s.textContent?.startsWith("via "));
    expect(separadoresVia).toHaveLength(0);
  });

  it("(6) a Mensagem sai pelo Canal da aba, não pelo primeiro Canal ativo do tipo", async () => {
    montar();
    const textarea = screen.getByRole("textbox", { name: /Escrever para/ });
    fireEvent.change(textarea, { target: { value: "olá, pelo Suporte" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    // O diálogo de confirmação diz por qual Canal a Mensagem sai.
    const dialogo = await screen.findByRole("alertdialog");
    expect(dialogo.textContent).toContain("Suporte · WhatsApp não oficial");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Enviar" }));

    await waitFor(() => {
      const suporte = dadosDoStore().conversations.find((c) => c.id === "cnv_suporte");
      expect(suporte?.messages.some((m) => m.content === "olá, pelo Suporte" && m.direction === "enviada")).toBe(true);
    });
    for (const id of ["cnv_wpp", "cnv_comercial"]) {
      const outra = dadosDoStore().conversations.find((c) => c.id === id);
      expect(outra?.messages.some((m) => m.content === "olá, pelo Suporte")).toBe(false);
    }
  });
});

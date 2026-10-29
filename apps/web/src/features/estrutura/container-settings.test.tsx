// @vitest-environment jsdom
/**
 * Fase 10, 2.1.8 (EST-03) — as Configurações do contêiner em abas, com a aba na
 * URL. O teste monta `ContainerSettings` com o seed real e o `StoreProvider` de
 * verdade; só `next/navigation` é falso, e `useSearchParams` devolve um
 * `URLSearchParams` REAL por teste (molde de `visibilidade-na-tela.test.tsx`).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import { blockedAbove, createFieldDefinition, overrideStatusSet, setContainerBlock } from "@n1/dominio/operations/configuration";
import { createFolder, createList, createSpace } from "@n1/dominio/operations/structure";
import type { DataState } from "@n1/dominio/state";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import { ContainerSettings, abaDasConfiguracoes } from "./container-settings";

const navegacao = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace: navegacao.replace, push: vi.fn() }),
  useSearchParams: () => navegacao.params,
}));

beforeEach(() => {
  navegacao.params = new URLSearchParams();
  navegacao.replace.mockReset();
});
afterEach(() => cleanup());

const TRANSPORTE: Transporte = {
  gravar: async () => ({ tipo: "falha", erro: "sem servidor neste teste." }),
  hidratar: async () => ({ tipo: "falha", erro: "sem servidor neste teste." }),
};

function montar(kind: "space" | "folder" | "list", id: string, estado: DataState = buildSeed()) {
  return render(
    <StoreProvider
      sessao={{ memberId: estado.workspace.ownerMemberId }}
      estadoInicial={{ data: estado, revisao: 1, ordens: {} }}
      transporte={TRANSPORTE}
    >
      <ContainerSettings kind={kind} id={id} />
    </StoreProvider>,
  );
}

const abaSelecionada = (): string => screen.getByRole("tab", { selected: true }).textContent ?? "";

describe("abaDasConfiguracoes — o fallback para `geral` (T-10-21)", () => {
  it("aceita só as chaves da lista fechada do nível e cai em `geral` no resto", () => {
    expect(abaDasConfiguracoes("campos", "list")).toBe("campos");
    expect(abaDasConfiguracoes("tipos-de-tarefa", "space")).toBe("tipos-de-tarefa");
    expect(abaDasConfiguracoes("formularios", "list")).toBe("formularios");
    expect(abaDasConfiguracoes("modelo-e-canais", "list")).toBe("modelo-e-canais");
    expect(abaDasConfiguracoes(null, "list")).toBe("geral");
    expect(abaDasConfiguracoes("", "list")).toBe("geral");
    expect(abaDasConfiguracoes("inexistente", "list")).toBe("geral");
    expect(abaDasConfiguracoes("formularios", "space")).toBe("geral");
    expect(abaDasConfiguracoes("modelo-e-canais", "folder")).toBe("geral");
    // 2.6.2 — a aba Visualizações existe nos três níveis.
    expect(abaDasConfiguracoes("visualizacoes", "list")).toBe("visualizacoes");
    expect(abaDasConfiguracoes("visualizacoes", "space")).toBe("visualizacoes");
    expect(abaDasConfiguracoes("visualizacoes", "folder")).toBe("visualizacoes");
  });
});

describe("ContainerSettings — a aba vem da URL", () => {
  it("?aba=campos abre a Lista direto em Campos, com o editor de Campos e sem o de Status", () => {
    navegacao.params = new URLSearchParams({ aba: "campos" });
    montar("list", "lst_prospeccao");

    expect(abaSelecionada()).toBe("Campos");
    expect(screen.getByRole("region", { name: "Campos herdados" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sobrescrever aqui" })).toBeNull();
  });

  it("?aba= ausente ou desconhecida cai em Geral, que traz a Identidade e o Ciclo de vida", () => {
    montar("list", "lst_prospeccao");
    expect(abaSelecionada()).toBe("Geral");
    cleanup();

    navegacao.params = new URLSearchParams({ aba: "inexistente" });
    montar("list", "lst_prospeccao");
    expect(abaSelecionada()).toBe("Geral");
  });

  it("Espaço com ?aba=formularios cai em Geral, e o Espaço não tem as abas só da Lista", () => {
    navegacao.params = new URLSearchParams({ aba: "formularios" });
    montar("space", "spc_com");

    expect(abaSelecionada()).toBe("Geral");
    expect(screen.queryByRole("tab", { name: "Formulários" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Modelo e canais" })).toBeNull();
  });

  it("a Lista tem Visualizações depois de Tipos de Tarefa, e Formulários e Modelo e canais no fim", () => {
    montar("list", "lst_prospeccao");
    const nomes = screen.getAllByRole("tab").map((aba) => aba.textContent);
    expect(nomes).toEqual(["Geral", "Status", "Funcionalidades", "Campos", "Tipos de Tarefa", "Visualizações", "Formulários", "Modelo e canais"]);
  });

  it("o Espaço também tem a aba Visualizações, com o editor e a linha de origem", () => {
    navegacao.params = new URLSearchParams({ aba: "visualizacoes" });
    montar("space", "spc_com");

    expect(abaSelecionada()).toBe("Visualizações");
    expect(screen.getByText("Padrão da plataforma")).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Visualização inicial" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Calendário" })).toBeTruthy();
  });

  it("clicar em Status faz router.replace com ?aba=status e scroll: false, mantendo os outros parâmetros", () => {
    navegacao.params = new URLSearchParams({ x: "1" });
    montar("list", "lst_prospeccao");

    fireEvent.click(screen.getByRole("tab", { name: "Status" }));

    expect(navegacao.replace).toHaveBeenCalledTimes(1);
    expect(navegacao.replace).toHaveBeenCalledWith("/?x=1&aba=status", { scroll: false });
  });

  it("o texto da tabela antiga não aparece em nenhuma das abas", () => {
    for (const aba of ["geral", "status", "funcionalidades", "campos", "tipos-de-tarefa", "visualizacoes", "formularios", "modelo-e-canais"]) {
      navegacao.params = new URLSearchParams({ aba });
      montar("list", "lst_prospeccao");
      expect(screen.queryByText(/Aspectos configuráveis/)).toBeNull();
      expect(screen.queryByText("Origem do valor")).toBeNull();
      cleanup();
    }
  });
});

/* ───────────── Task 2: a linha de origem, "Criado por" e o painel da aba ───────────── */

/** Um Espaço novo com uma Pasta e uma Lista: nenhum dado do seed interfere nas frases de origem. */
function cadeia() {
  const estado = buildSeed();
  const dono = estado.workspace.ownerMemberId;
  const espaco = createSpace(estado, dono, { name: "Operações novas" });
  if (!espaco.ok) throw new Error(espaco.error);
  const pasta = createFolder(estado, dono, { name: "Contratos", parentType: "space", parentId: espaco.value.id });
  if (!pasta.ok) throw new Error(pasta.error);
  const lista = createList(estado, dono, { name: "Vigentes", parentType: "folder", parentId: pasta.value.id });
  if (!lista.ok) throw new Error(lista.error);
  return { estado, dono, espacoId: espaco.value.id, pastaId: pasta.value.id, listaId: lista.value.id };
}

describe("ContainerSettings — a linha de origem de cada aba (D-16)", () => {
  it("Lista sem Conjunto próprio mostra \"Herdado de Espaço {nome}\"", () => {
    const { estado, listaId } = cadeia();
    navegacao.params = new URLSearchParams({ aba: "status" });
    montar("list", listaId, estado);

    expect(screen.getByText("Herdado de Espaço Operações novas")).toBeTruthy();
  });

  it("Lista com Conjunto próprio mostra \"Definido aqui\"", () => {
    const { estado, dono, listaId } = cadeia();
    const r = overrideStatusSet(estado, dono, "list", listaId);
    if (!r.ok) throw new Error(r.error);
    navegacao.params = new URLSearchParams({ aba: "status" });
    montar("list", listaId, estado);

    expect(screen.getByText("Definido aqui")).toBeTruthy();
    expect(screen.queryByText(/Herdado de/)).toBeNull();
  });

  it("Subpasta herda de Pasta: a palavra do tipo é \"Subpasta\"", () => {
    const { estado, dono, pastaId } = cadeia();
    const sub = createFolder(estado, dono, { name: "Aditivos", parentType: "folder", parentId: pastaId });
    if (!sub.ok) throw new Error(sub.error);
    const lista = createList(estado, dono, { name: "Abertos", parentType: "folder", parentId: sub.value.id });
    if (!lista.ok) throw new Error(lista.error);
    const sobrescreve = overrideStatusSet(estado, dono, "folder", sub.value.id);
    if (!sobrescreve.ok) throw new Error(sobrescreve.error);
    navegacao.params = new URLSearchParams({ aba: "status" });
    montar("list", lista.value.id, estado);

    expect(screen.getByText("Herdado de Subpasta Aditivos")).toBeTruthy();
  });

  it("Espaço que bloqueia o Conjunto: a Lista abaixo mostra \"Bloqueado por Espaço {nome}\" e a frase do domínio", () => {
    const { estado, dono, espacoId, listaId } = cadeia();
    const bloqueio = setContainerBlock(estado, dono, "space", espacoId, "statusSet", true);
    if (!bloqueio.ok) throw new Error(bloqueio.error);
    navegacao.params = new URLSearchParams({ aba: "status" });
    montar("list", listaId, estado);

    expect(screen.getByText("Bloqueado por Espaço Operações novas")).toBeTruthy();
    // A frase é a do domínio, literal: a mesma que a operação devolveria.
    const frase = blockedAbove(estado, "list", listaId, "statusSet");
    expect(frase).toContain("Espaço Operações novas bloqueia");
    expect(screen.getByText(`Somente leitura: ${frase}`)).toBeTruthy();
  });

  it("aba Funcionalidades bloqueada traz a frase do domínio uma vez só", () => {
    const { estado, dono, espacoId, listaId } = cadeia();
    const bloqueio = setContainerBlock(estado, dono, "space", espacoId, "features", true);
    if (!bloqueio.ok) throw new Error(bloqueio.error);
    navegacao.params = new URLSearchParams({ aba: "funcionalidades" });
    montar("list", listaId, estado);

    expect(screen.getByText("Bloqueado por Espaço Operações novas")).toBeTruthy();
    expect(screen.getAllByText(/Somente leitura: Espaço Operações novas bloqueia/)).toHaveLength(1);
    // Os interruptores ficam desligados pela mesma frase.
    for (const interruptor of screen.getAllByRole("switch")) expect(interruptor.hasAttribute("disabled") || interruptor.getAttribute("aria-disabled") === "true").toBe(true);
  });

  it("Campos de uma Pasta com 1 Campo próprio sob Espaço com 2: \"1 definido aqui · 2 herdados\"", () => {
    const { estado, dono, espacoId, pastaId } = cadeia();
    for (const nome of ["Região", "Segmento"]) {
      const r = createFieldDefinition(estado, dono, { name: nome, type: "text", definedAtType: "space", definedAtId: espacoId });
      if (!r.ok) throw new Error(r.error);
    }
    const propria = createFieldDefinition(estado, dono, { name: "Valor", type: "text", definedAtType: "folder", definedAtId: pastaId });
    if (!propria.ok) throw new Error(propria.error);
    navegacao.params = new URLSearchParams({ aba: "campos" });
    montar("folder", pastaId, estado);

    expect(screen.getByText("1 definido aqui · 2 herdados")).toBeTruthy();
  });

  it("Tipos de Tarefa sem nenhum Tipo: \"0 definidos aqui · 0 herdados\"", () => {
    const { estado, pastaId } = cadeia();
    navegacao.params = new URLSearchParams({ aba: "tipos-de-tarefa" });
    montar("folder", pastaId, estado);

    expect(screen.getByText("0 definidos aqui · 0 herdados")).toBeTruthy();
  });
});

describe("ContainerSettings — Geral e o painel da aba", () => {
  it("a aba Geral mostra \"Criado por {nome}\" entre a Identidade e o Ciclo de vida", () => {
    montar("space", "spc_com");
    const criador = buildSeed().members.find((m) => m.id === buildSeed().spaces.find((s) => s.id === "spc_com")?.createdBy.id)?.displayName ?? "Sistema";
    expect(screen.getByText(`Criado por ${criador}`)).toBeTruthy();
  });

  it("o conteúdo da aba é um tabpanel ligado à aba ativa", () => {
    navegacao.params = new URLSearchParams({ aba: "campos" });
    montar("list", "lst_prospeccao");

    const painel = screen.getByRole("tabpanel");
    const aba = screen.getByRole("tab", { name: "Campos" });
    expect(aba.getAttribute("aria-controls")).toBe(painel.id);
    expect(painel.getAttribute("aria-labelledby")).toBe(aba.id);
    expect(within(painel).getByRole("region", { name: "Campos herdados" })).toBeTruthy();
  });

  it("contêiner inexistente mostra \"Contêiner não encontrado.\"", () => {
    montar("list", "lst_que_nao_existe");
    expect(screen.getByText("Contêiner não encontrado.")).toBeTruthy();
  });
});

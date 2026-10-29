// @vitest-environment jsdom
/**
 * Fase 10, 2.3.3 (D-10, D-11, EST-06) — "Mover para…" pelo menu. A casca de
 * verdade (`AppShell`, com a árvore e o diálogo) sobre o `StoreProvider` de
 * verdade e um transporte falso que confirma: o que a tela mostra depois de
 * mover é o que o servidor devolveu, nunca o que a cópia aceitou.
 *
 * Molde de `visibilidade-na-tela.test.tsx`. `next/navigation` guarda os
 * parâmetros de endereço num armazém reativo, para que `router.replace` abra e
 * feche o diálogo como o navegador faz.
 */

import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import type { Ordens } from "@n1/dominio";
import {
  createFieldDefinition,
  createFolder,
  createList,
  createSpace,
  createTask,
  createTaskType,
  setContainerFeature,
  setTaskFieldValue,
  shareTaskPublicly,
  updateTask,
} from "@n1/dominio/operations";
import type { DataState } from "@n1/dominio/state";
import { StoreProvider } from "@/dados/store";
import type { RespostaDeGravacao, Transporte } from "@/dados/transporte";
import { AppShell } from "@/features/shell/app-shell";

// O robô flutuante mede a tela com APIs que o jsdom não tem, e o Guia do Financeiro não é o assunto aqui.
vi.mock("@/features/shell/robo-flutuante", () => ({ RoboFlutuante: () => null }));
vi.mock("@/features/financeiro/guia/guia-do-financeiro-dialogo", () => ({
  GuiaDoFinanceiro: () => null,
  abrirGuiaDoFinanceiro: () => undefined,
}));

vi.mock("next/navigation", async () => {
  const React = await import("react");
  let atuais = new URLSearchParams();
  const ouvintes = new Set<() => void>();
  const definir = (proximos: URLSearchParams) => {
    atuais = proximos;
    for (const ouvinte of ouvintes) ouvinte();
  };
  const assinar = (ouvinte: () => void) => {
    ouvintes.add(ouvinte);
    return () => {
      ouvintes.delete(ouvinte);
    };
  };
  return {
    usePathname: () => "/estrutura/espacos/spc_com",
    useRouter: () => ({
      replace: (url: string) => definir(new URLSearchParams(url.split("?")[1] ?? "")),
      push: vi.fn(),
      prefetch: vi.fn(),
    }),
    useSearchParams: () => React.useSyncExternalStore(assinar, () => atuais, () => atuais),
    __params: () => atuais,
    __definir: definir,
  };
});

async function enderecoAtual(): Promise<URLSearchParams> {
  const nav = (await import("next/navigation")) as unknown as { __params: () => URLSearchParams };
  return nav.__params();
}

async function limparEndereco() {
  const nav = (await import("next/navigation")) as unknown as { __definir: (p: URLSearchParams) => void };
  nav.__definir(new URLSearchParams());
}

function ordensDeTodasAsColecoes(estado: DataState): Ordens {
  const resultado: Ordens = {};
  for (const [colecao, valor] of Object.entries(estado)) {
    if (!Array.isArray(valor)) continue;
    const porId: Record<string, number> = {};
    valor.forEach((registro, indice) => {
      if (registro && typeof registro === "object" && "id" in registro) {
        porId[(registro as { readonly id: string }).id] = indice;
      }
    });
    resultado[colecao] = porId;
  }
  return resultado;
}

/** O que o servidor responde a cada gravação: confirma pondo a cópia como estado, ou recusa com a frase pedida. */
interface Servidor {
  readonly transporte: Transporte;
  readonly gravar: ReturnType<typeof vi.fn>;
  recusarCom: (frase: string | null) => void;
  segurar: () => () => void;
}

function servidorFalso(): Servidor {
  let recusa: string | null = null;
  let seguranca: Promise<void> | null = null;
  const gravar = vi.fn(async (pedido: { readonly copia: DataState; readonly revisao: number; readonly resultado: unknown }): Promise<RespostaDeGravacao> => {
    if (seguranca) await seguranca;
    if (recusa !== null) return { tipo: "falha", erro: recusa };
    return {
      tipo: "estado",
      resultado: pedido.resultado as never,
      estado: { data: pedido.copia, revisao: pedido.revisao + 1, ordens: ordensDeTodasAsColecoes(pedido.copia), memberId: "" },
    };
  });
  return {
    transporte: {
      gravar: gravar as unknown as Transporte["gravar"],
      hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    },
    gravar,
    recusarCom: (frase) => {
      recusa = frase;
    },
    segurar: () => {
      let soltar: () => void = () => undefined;
      seguranca = new Promise<void>((resolver) => {
        soltar = resolver;
      });
      return () => {
        soltar();
        seguranca = null;
      };
    },
  };
}

let state: DataState;
let servidor: Servidor;

const THIAGO = "mem_thiago"; // Proprietário
const JULIA = "mem_julia"; // Papel de vendas: não administra
const BEATRIZ = "mem_beatriz"; // Convidada

function montar(ui: ReactElement, memberId = THIAGO) {
  return render(
    <StoreProvider
      sessao={{ memberId }}
      estadoInicial={{ data: state, revisao: 1, ordens: ordensDeTodasAsColecoes(state) }}
      transporte={servidor.transporte}
    >
      {ui}
    </StoreProvider>,
  );
}

const pasta = (nome: string, parentId = "spc_com", parentType: "space" | "folder" = "space"): string => {
  const r = createFolder(state, THIAGO, { name: nome, parentType, parentId });
  if (!r.ok) throw new Error(r.error);
  return r.value.id;
};

const lista = (nome: string, parentId: string, parentType: "space" | "folder" = "folder"): string => {
  const r = createList(state, THIAGO, { name: nome, parentType, parentId });
  if (!r.ok) throw new Error(r.error);
  return r.value.id;
};

const tarefa = (listId: string, title: string, statusId?: string): string => {
  const r = createTask(state, THIAGO, { listId, title, ...(statusId ? { statusId } : {}) });
  if (!r.ok) throw new Error(r.error);
  return r.value.id;
};

/** A linha da árvore pelo id do contêiner: o link `arvore-no-{id}` e a linha que o contém. */
function linha(id: string): HTMLElement {
  const link = document.getElementById(`arvore-no-${id}`);
  if (!link) throw new Error(`Sem linha da árvore para ${id}`);
  return link.parentElement as HTMLElement;
}

const temLinha = (id: string): boolean => document.getElementById(`arvore-no-${id}`) !== null;

function abrirMenuDaLinha(id: string) {
  fireEvent.click(within(linha(id)).getByRole("button", { name: /^Ações de / }));
}

function moverPeloMenu(id: string) {
  abrirMenuDaLinha(id);
  fireEvent.click(screen.getByRole("menuitem", { name: /Mover para…/ }));
}

/** As opções abertas do Select, como [rótulo, motivo de estar desligada]. */
function opcoesAbertas(): Array<{ rotulo: string; desligadaPor: string | null; elemento: HTMLElement }> {
  return screen.getAllByRole("option").map((elemento) => ({
    rotulo: elemento.querySelector("span.truncate")?.textContent ?? "",
    desligadaPor: elemento.getAttribute("aria-disabled") === "true" ? elemento.getAttribute("title") : null,
    elemento,
  }));
}

function abrirSelect(rotulo: string | RegExp) {
  fireEvent.click(screen.getByRole("combobox", { name: rotulo }));
}

function escolherNoSelect(rotulo: string | RegExp, opcao: string) {
  abrirSelect(rotulo);
  const alvo = opcoesAbertas().find((o) => o.rotulo === opcao);
  if (!alvo) throw new Error(`Sem a opção ${opcao}: ${opcoesAbertas().map((o) => o.rotulo).join(" | ")}`);
  fireEvent.click(alvo.elemento);
}

const confirmar = () => screen.getByRole("button", { name: "Mover" });

/** Por que o "Mover" está desligado: o `title` que o `Button` põe quando fica inativo. */
const motivoDoMover = (): string | null => {
  const botao = confirmar();
  return botao.getAttribute("aria-disabled") === "true" ? botao.getAttribute("title") : null;
};

const alerta = (): HTMLElement | null => document.querySelector('[role="alertdialog"] p[role="alert"]');

beforeEach(async () => {
  // A casca mede o robô flutuante e a barra com observadores que o jsdom não traz.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  state = buildSeed();
  servidor = servidorFalso();
  await limparEndereco();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Mover para… — o traçador: a Lista \"Propostas\" vai para a Pasta \"Clientes\" (EST-06)", () => {
  it("o ⋯ da Lista tem \"Mover para…\", que abre o diálogo com o título e a contagem de Tarefas", async () => {
    const PROPOSTAS = lista("Propostas", "fld_propostas");
    montar(<AppShell>{null}</AppShell>);
    await waitFor(() => expect(temLinha(PROPOSTAS)).toBe(true));

    moverPeloMenu(PROPOSTAS);

    expect(screen.getByRole("alertdialog", { name: "Mover “Propostas”" })).toBeTruthy();
    expect(screen.getByText("A Lista muda de lugar.")).toBeTruthy();
    expect((await enderecoAtual()).get("mover")).toBe(PROPOSTAS);
  });

  it("escolher \"Clientes\" e confirmar move pelo servidor, avisa depois da resposta e a árvore mostra a Lista na Pasta nova", async () => {
    const PROPOSTAS = lista("Propostas", "fld_propostas");
    montar(<AppShell>{null}</AppShell>);
    await waitFor(() => expect(temLinha(PROPOSTAS)).toBe(true));
    expect(linha(PROPOSTAS).closest("li")?.parentElement?.closest("li")?.querySelector("a")?.id).toBe("arvore-no-fld_propostas");

    moverPeloMenu(PROPOSTAS);
    escolherNoSelect("Destino", "Clientes");
    fireEvent.click(confirmar());

    await waitFor(() => expect(screen.getByText("Lista Propostas movida para Clientes.")).toBeTruthy());
    expect(servidor.gravar).toHaveBeenCalledTimes(1);
    expect(servidor.gravar.mock.calls[0]?.[0]?.chamadas[0]?.nome).toBe("moveContainer");
    expect(state.lists.find((l) => l.id === PROPOSTAS)?.parentId).toBe("fld_propostas"); // a cópia do teste não foi tocada
    // A árvore agora mostra "Propostas" dentro de "Clientes".
    expect(linha(PROPOSTAS).closest("li")?.parentElement?.closest("li")?.querySelector("a")?.id).toBe("arvore-no-fld_clientes");
    expect((await enderecoAtual()).get("mover")).toBeNull();
    await waitFor(() => expect(document.activeElement?.id).toBe(`arvore-no-${PROPOSTAS}`));
  });

  it("cancelar fecha o diálogo e limpa ?mover=, sem gravar", async () => {
    const PROPOSTAS = lista("Propostas", "fld_propostas");
    montar(<AppShell>{null}</AppShell>);
    await waitFor(() => expect(temLinha(PROPOSTAS)).toBe(true));
    moverPeloMenu(PROPOSTAS);
    expect(screen.getByRole("alertdialog")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect((await enderecoAtual()).get("mover")).toBeNull();
    expect(servidor.gravar).not.toHaveBeenCalled();
  });
});

describe("Mover para… — o diálogo inteiro (D-11, L1, L2)", () => {
  // Origem A (Conjunto de Comercial) tem a Lista Alfa; "Entrega" é outro Espaço, de outro Conjunto.
  let A: string;
  let ALFA: string;
  beforeEach(() => {
    A = pasta("Origem A");
    ALFA = lista("Alfa", A);
  });

  async function abrir(id: string, memberId = THIAGO) {
    montar(<AppShell>{null}</AppShell>, memberId);
    await waitFor(() => expect(temLinha(id)).toBe(true));
    moverPeloMenu(id);
  }

  it("com outro Conjunto de Status pede onde cada Status em uso passa a ficar, e \"Mover\" só liga com todos mapeados", async () => {
    tarefa(ALFA, "Primeira", "st_com_novo");
    tarefa(ALFA, "Segunda", "st_com_novo");
    tarefa(ALFA, "Terceira", "st_com_exec");
    await abrir(ALFA);
    expect(screen.queryByText(/O destino usa outro Conjunto de Status/)).toBeNull();

    escolherNoSelect("Destino", "Entrega");

    expect(screen.getByText("O destino usa outro Conjunto de Status. Escolha onde cada Status em uso passa a ficar.")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Novo · 2 Tarefas" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Em execução · 1 Tarefa" })).toBeTruthy();
    expect(motivoDoMover()).toBe("2 Status de origem ainda sem destino.");

    abrirSelect("Novo · 2 Tarefas");
    // Os Status do destino saem por `order`, com a categoria por extenso.
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "A fazerNão iniciado",
      "Em andamentoEm andamento",
      "ConcluídoConcluído",
      "ArquivadoFechado",
    ]);
    fireEvent.click(opcoesAbertas()[0]!.elemento);
    expect(motivoDoMover()).toBe("1 Status de origem ainda sem destino.");

    escolherNoSelect("Em execução · 1 Tarefa", "Em andamento");
    expect(motivoDoMover()).toBeNull();
  });

  it("a dica da linha diz a categoria de origem, ou a mudança de categoria com a concordância certa", async () => {
    tarefa(ALFA, "Primeira", "st_com_novo");
    tarefa(ALFA, "Segunda", "st_com_novo");
    tarefa(ALFA, "Terceira", "st_com_exec");
    await abrir(ALFA);
    escolherNoSelect("Destino", "Entrega");

    expect(screen.getByText("Categoria de origem: Não iniciado")).toBeTruthy();
    expect(screen.getByText("Categoria de origem: Em andamento")).toBeTruthy();

    escolherNoSelect("Novo · 2 Tarefas", "Concluído");
    expect(screen.getByText("2 Tarefas passam de Não iniciado para Concluído")).toBeTruthy();

    escolherNoSelect("Em execução · 1 Tarefa", "Concluído");
    expect(screen.getByText("1 Tarefa passa de Em andamento para Concluído")).toBeTruthy();
    // O remapeamento não grava conclusão (o domínio só troca o Status): a dica não promete evento.
    expect(screen.queryByText(/evento de conclusão/)).toBeNull();
  });

  it("confirmar com o mapeamento completo grava as Tarefas no Status escolhido e a Lista aparece no Espaço novo", async () => {
    const t = tarefa(ALFA, "Primeira", "st_com_novo");
    await abrir(ALFA);
    escolherNoSelect("Destino", "Entrega");
    escolherNoSelect("Novo · 1 Tarefa", "A fazer");

    fireEvent.click(confirmar());

    await waitFor(() => expect(screen.getByText("Lista Alfa movida para Entrega.")).toBeTruthy());
    const chamada = servidor.gravar.mock.calls[0]?.[0]?.chamadas[0];
    expect(chamada?.nome).toBe("moveContainer");
    const gravado = servidor.gravar.mock.calls[0]?.[0]?.copia as DataState;
    expect(gravado.tasks.find((x) => x.id === t)?.statusId).toBe("st_ops_fazer");
    expect(linha(ALFA).closest("li")?.parentElement?.closest("li")?.querySelector("a")?.id).toBe("arvore-no-spc_ops");
  });

  it("o painel âmbar diz quais Campos deixam de valer e quantos Valores ficam arquivados, no singular e no plural", async () => {
    const campo = createFieldDefinition(state, THIAGO, { name: "Turma da origem", type: "text", definedAtType: "folder", definedAtId: A });
    if (!campo.ok) throw new Error(campo.error);
    const um = tarefa(ALFA, "Com Campo");
    expect(setTaskFieldValue(state, THIAGO, um, campo.value.id, "Turma de outubro").ok).toBe(true);
    const B = pasta("Destino B");
    await abrir(ALFA);

    escolherNoSelect("Destino", "Destino B");
    expect(screen.getByText("Campos que deixam de valer: Turma da origem.")).toBeTruthy();
    expect(screen.getByText("1 Valor fica arquivado nas Tarefas. Nada é apagado.")).toBeTruthy();
    expect(B).toBeTruthy();
    cleanup();

    const dois = tarefa(ALFA, "Outra com Campo");
    expect(setTaskFieldValue(state, THIAGO, dois, campo.value.id, "Turma de novembro").ok).toBe(true);
    await abrir(ALFA);
    escolherNoSelect("Destino", "Destino B");
    expect(screen.getByText("2 Valores ficam arquivados nas Tarefas. Nada é apagado.")).toBeTruthy();
    // Mesmo Conjunto: sem tabela de Status.
    expect(screen.queryByText(/O destino usa outro Conjunto de Status/)).toBeNull();
  });

  it("(Q4) avisa quantas Tarefas caem no primeiro Tipo do destino e quantos links públicos são revogados", async () => {
    const B = pasta("Sem link");
    expect(setContainerFeature(state, THIAGO, "folder", B, "compartilhamentoPublico", false).ok).toBe(true);
    // As duas compartilhadas nascem antes do Tipo novo: ficam no Tipo padrão, que o destino também tem.
    const outra = tarefa(ALFA, "Compartilhada");
    expect(shareTaskPublicly(state, THIAGO, outra, { showsComments: false, showsAttachments: false }).ok).toBe(true);
    const mais = tarefa(ALFA, "Também compartilhada");
    expect(shareTaskPublicly(state, THIAGO, mais, { showsComments: false, showsAttachments: false }).ok).toBe(true);
    const tipo = createTaskType(state, THIAGO, { name: "Visita", icon: "map-pin", definedAtType: "folder", definedAtId: A });
    if (!tipo.ok) throw new Error(tipo.error);
    const visita = tarefa(ALFA, "Visita ao cliente");
    expect(updateTask(state, THIAGO, visita, { taskTypeId: tipo.value.id }).ok).toBe(true);
    await abrir(ALFA);

    escolherNoSelect("Destino", "Sem link");

    expect(screen.getByText("1 Tarefa passa ao primeiro Tipo de Tarefa do destino.")).toBeTruthy();
    expect(screen.getByText("2 links públicos são revogados: o destino não permite compartilhamento público.")).toBeTruthy();
  });

  it("uma Pasta com Subpastas não pode entrar em outra Pasta: a opção fica desligada com a frase do domínio", async () => {
    const MAE = pasta("Mãe");
    pasta("Filha", MAE, "folder");
    await abrir(MAE);

    abrirSelect("Destino");
    const origemA = opcoesAbertas().find((o) => o.rotulo === "Origem A");
    expect(origemA?.desligadaPor).toBe("Uma Pasta com Subpastas não vai para dentro de outra Pasta.");
    // Um Espaço é destino possível.
    expect(opcoesAbertas().find((o) => o.rotulo === "Entrega")?.desligadaPor).toBeNull();
    // Nem ela, nem a Subpasta dela, nem o pai atual (Comercial) são oferecidos.
    expect(opcoesAbertas().map((o) => o.rotulo)).not.toContain("Mãe");
    expect(opcoesAbertas().map((o) => o.rotulo)).not.toContain("Filha");
    expect(opcoesAbertas().map((o) => o.rotulo)).not.toContain("Comercial");
  });

  it("o servidor recusa: a frase aparece em role=alert, o diálogo fica aberto e destino e mapeamento ficam", async () => {
    tarefa(ALFA, "Primeira", "st_com_novo");
    await abrir(ALFA);
    escolherNoSelect("Destino", "Entrega");
    escolherNoSelect("Novo · 1 Tarefa", "A fazer");
    servidor.recusarCom("Mapeie “Novo” antes de mover.");

    fireEvent.click(confirmar());

    await waitFor(() => expect(alerta()?.textContent).toBe("Mapeie “Novo” antes de mover."));
    expect(screen.getByRole("alertdialog", { name: "Mover “Alfa”" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Destino" }).textContent).toContain("Entrega");
    expect(screen.getByRole("combobox", { name: "Novo · 1 Tarefa" }).textContent).toContain("A fazer");
    expect(screen.queryByText(/movida para/)).toBeNull();
    expect(motivoDoMover()).toBeNull();
  });

  it("enquanto grava, o botão fica carregando com \"Movendo…\" e o diálogo só fecha depois da resposta", async () => {
    await abrir(ALFA);
    escolherNoSelect("Destino", "Entrega");
    const soltar = servidor.segurar();

    fireEvent.click(confirmar());

    await waitFor(() => expect(confirmar().getAttribute("aria-busy")).toBe("true"));
    expect(motivoDoMover()).toBe("Movendo…");
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.queryByText(/movida para/)).toBeNull();
    // Cancelar durante a gravação não fecha: o fim é a resposta.
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect((await enderecoAtual()).get("mover")).toBe(ALFA);

    soltar();
    await waitFor(() => expect(screen.getByText("Lista Alfa movida para Entrega.")).toBeTruthy());
    expect((await enderecoAtual()).get("mover")).toBeNull();
  });

  it("a descrição conta as Tarefas no singular e no plural, e a da Pasta fala de Listas e Tarefas", async () => {
    tarefa(ALFA, "Primeira");
    await abrir(ALFA);
    expect(screen.getByText("A Lista e a sua Tarefa mudam de lugar juntas.")).toBeTruthy();
    cleanup();

    tarefa(ALFA, "Segunda");
    await abrir(ALFA);
    expect(screen.getByText("A Lista e as suas 2 Tarefas mudam de lugar juntas.")).toBeTruthy();
    cleanup();

    await limparEndereco();
    await abrir(A);
    expect(screen.getByText("A Pasta, as Listas e as Tarefas dela mudam de lugar juntas.")).toBeTruthy();
  });

  it("(T-10-30) os destinos nunca incluem contêiner privado que o Membro não alcança", async () => {
    const reservado = createSpace(state, THIAGO, { name: "Reservado", isPrivate: true });
    if (!reservado.ok) throw new Error(reservado.error);

    await abrir(ALFA);
    abrirSelect("Destino");
    expect(opcoesAbertas().map((o) => o.rotulo)).toContain("Reservado");
    cleanup();
    await limparEndereco();

    montar(<AppShell>{null}</AppShell>, JULIA);
    const nav = (await import("next/navigation")) as unknown as { __definir: (p: URLSearchParams) => void };
    nav.__definir(new URLSearchParams({ mover: ALFA }));
    await waitFor(() => expect(screen.getByRole("alertdialog")).toBeTruthy());
    abrirSelect("Destino");
    expect(opcoesAbertas().map((o) => o.rotulo)).not.toContain("Reservado");
    expect(opcoesAbertas().length).toBeGreaterThan(0);
  });

  it("(T-10-31) ?mover= com id desconhecido, ou de contêiner que o Membro não alcança, não abre o diálogo", async () => {
    const reservado = createSpace(state, THIAGO, { name: "Reservado", isPrivate: true });
    if (!reservado.ok) throw new Error(reservado.error);
    const secreta = lista("Secreta", pasta("Pasta secreta", reservado.value.id, "space"));

    montar(<AppShell>{null}</AppShell>, JULIA);
    const nav = (await import("next/navigation")) as unknown as { __definir: (p: URLSearchParams) => void };
    await act(async () => nav.__definir(new URLSearchParams({ mover: "nao_existe" })));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await act(async () => nav.__definir(new URLSearchParams({ mover: secreta })));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

describe("Mover para… — sem destino disponível", () => {
  it("quando nada pode receber o item, o Select abre com \"Nenhum destino disponível.\"", async () => {
    // Um Espaço só, com a Lista direto nele: o único destino possível seria o pai atual.
    const so = state.lists.find((l) => l.parentType === "space" && l.parentId === "spc_com") ?? state.lists[0]!;
    state.spaces = state.spaces.filter((s) => s.id === so.parentId);
    state.folders = [];
    state.lists = [so];
    state.tasks = [];
    montar(<AppShell>{null}</AppShell>);
    const nav = (await import("next/navigation")) as unknown as { __definir: (p: URLSearchParams) => void };
    await act(async () => nav.__definir(new URLSearchParams({ mover: so.id })));
    await waitFor(() => expect(screen.getByRole("alertdialog")).toBeTruthy());

    abrirSelect("Destino");

    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("Nenhum destino disponível.")).toBeTruthy();
  });
});

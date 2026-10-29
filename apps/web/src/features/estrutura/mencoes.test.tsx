// @vitest-environment jsdom
/**
 * Fase 11, TAR-04 (tela) — o "@" da descrição e do Comentário é o mesmo hook
 * (`useMencoes`, D-06). Aqui: as funções puras do menu e a prova de ponta a
 * ponta no jsdom — digitar "@Jú" na descrição abre "Pessoas para mencionar",
 * escolher grava "@Júlia Prado " e Salvar manda `descriptionMentions` ao
 * servidor; o Comentário segue com o mesmo teclado e leva `mentions`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import type { Ordens } from "@n1/dominio";
import type { DataState } from "@n1/dominio/state";
import type { Task } from "@n1/dominio/types";
import { StoreProvider } from "@/dados/store";
import type { RespostaDeGravacao, Transporte } from "@/dados/transporte";
import { TaskComments, TaskTitleDescriptionEditor } from "./task-editors";
import { arrobaEmCurso, normalizar } from "./mencoes";

const TAREFA = "tsk_seed_1";
const THIAGO = "mem_thiago";

/** `ordem = índice` — o mesmo que `GET /estado` devolveria (molde de `timeline.test.tsx`). */
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

interface TransporteFalso extends Transporte {
  readonly gravarMock: ReturnType<typeof vi.fn<Transporte["gravar"]>>;
}

function transporteFalso(): TransporteFalso {
  const gravarMock = vi.fn<Transporte["gravar"]>();
  // Nunca resolve: o teste só olha o que foi mandado ao servidor.
  gravarMock.mockImplementation(() => new Promise<RespostaDeGravacao>(() => {}));
  return {
    gravar: gravarMock,
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    gravarMock,
  };
}

let state: DataState;
let transporte: TransporteFalso;

beforeEach(() => {
  state = buildSeed();
  transporte = transporteFalso();
});

afterEach(() => {
  cleanup();
});

const tarefa = (): Task => {
  const achada = state.tasks.find((t) => t.id === TAREFA);
  if (!achada) throw new Error("seed sem a Tarefa do teste");
  return achada;
};

function noStore(filho: React.ReactNode) {
  return render(
    <StoreProvider sessao={{ memberId: THIAGO }} estadoInicial={{ data: state, revisao: 1, ordens: ordensDeTodasAsColecoes(state) }} transporte={transporte}>
      {filho}
    </StoreProvider>,
  );
}

function editorDaDescricao(task: Task) {
  return noStore(<TaskTitleDescriptionEditor task={task} report={vi.fn()} onClose={vi.fn()} />);
}

function comentarios(task: Task) {
  return noStore(<TaskComments task={task} report={vi.fn()} authorLabel={() => "Alguém"} readOnly={false} />);
}

/** As chamadas de uma operação que o store mandou ao transporte. */
function chamadasDe(nome: string) {
  return transporte.gravarMock.mock.calls.flatMap(([pedido]) => pedido.chamadas.filter((c) => c.nome === nome));
}

/** Escolhe a Júlia no menu de "@" (pointerdown, como o usuário: o click tiraria o foco do campo). */
function escolherAJulia() {
  const opcao = screen.queryByRole("option", { name: /Júlia Prado/ });
  expect(opcao).not.toBeNull();
  fireEvent.pointerDown(opcao as HTMLElement);
}

describe("funções puras do menu de menção", () => {
  it("arrobaEmCurso acha o @ em curso antes do cursor e respeita o limite de dois espaços", () => {
    expect(arrobaEmCurso("Oi @Jú", 6)).toEqual({ inicio: 3, consulta: "Jú" });
    expect(arrobaEmCurso("@Júlia Prado e mais", 19)).toBeNull();
  });

  it("arrobaEmCurso ignora e-mail, e normalizar tira acento e caixa", () => {
    expect(arrobaEmCurso("email@x.com", 11)).toBeNull();
    expect(normalizar("Galvão")).toBe("galvao");
  });
});

describe("descrição — o @ menciona como no Comentário (TAR-04)", () => {
  it("@Jú abre o menu, escolher grava o nome e Salvar manda descriptionMentions", async () => {
    editorDaDescricao(tarefa());
    const campo = screen.getByLabelText("Descrição") as HTMLTextAreaElement;

    fireEvent.change(campo, { target: { value: "Revisar com @Jú" } });
    expect(screen.queryByRole("listbox", { name: "Pessoas para mencionar" })).not.toBeNull();
    escolherAJulia();

    expect((screen.getByLabelText("Descrição") as HTMLTextAreaElement).value).toBe("Revisar com @Júlia Prado ");
    expect(screen.queryByRole("listbox")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(chamadasDe("updateTask")).toHaveLength(1));
    const [, entrada] = chamadasDe("updateTask")[0]!.args as [string, { description: string; descriptionMentions: unknown[] }];
    expect(entrada.description).toBe("Revisar com @Júlia Prado ");
    expect(entrada.descriptionMentions).toEqual([{ type: "member", id: "mem_julia" }]);
  });

  it("apagar o @Nome do texto antes de Salvar manda a lista sem aquele Membro", async () => {
    editorDaDescricao(tarefa());
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Revisar com @Jú" } });
    escolherAJulia();
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Revisar sem ninguém" } });

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(chamadasDe("updateTask")).toHaveLength(1));
    const [, entrada] = chamadasDe("updateTask")[0]!.args as [string, { descriptionMentions: unknown[] }];
    expect(entrada.descriptionMentions).toEqual([]);
  });

  it("o menu só oferece Membro ativo", () => {
    const julia = state.members.find((m) => m.id === "mem_julia");
    if (!julia) throw new Error("seed sem a Júlia");
    julia.state = "suspenso";
    editorDaDescricao(tarefa());
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Revisar com @Jú" } });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("salvar só o título mantém a menção que a Tarefa já tinha", async () => {
    const task = tarefa();
    task.description = "Revisar com @Júlia Prado agora";
    task.descriptionMentions = [{ type: "member", id: "mem_julia" }];
    editorDaDescricao(task);

    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Título novo da tarefa" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(chamadasDe("updateTask")).toHaveLength(1));
    const [, entrada] = chamadasDe("updateTask")[0]!.args as [string, { descriptionMentions: unknown[] }];
    expect(entrada.descriptionMentions).toEqual([{ type: "member", id: "mem_julia" }]);
  });
});

describe("Comentário — o mesmo menu, o mesmo teclado", () => {
  it("setas mudam a opção ativa, Esc fecha só o menu e Enter escolhe", () => {
    comentarios(tarefa());
    const campo = screen.getByLabelText("Novo comentário") as HTMLTextAreaElement;

    fireEvent.change(campo, { target: { value: "@" } });
    const opcoes = screen.getAllByRole("option");
    expect(opcoes.length).toBeGreaterThan(1);
    expect(opcoes[0]!.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(campo, { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[1]!.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(campo, { key: "ArrowUp" });
    expect(screen.getAllByRole("option")[0]!.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(campo, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect((screen.getByLabelText("Novo comentário") as HTMLTextAreaElement).value).toBe("@");

    fireEvent.change(campo, { target: { value: "Oi @Jú" } });
    fireEvent.keyDown(campo, { key: "Enter" });
    expect((screen.getByLabelText("Novo comentário") as HTMLTextAreaElement).value).toBe("Oi @Júlia Prado ");
  });

  it("Ctrl+Enter envia o Comentário com mentions do Membro escolhido", async () => {
    comentarios(tarefa());
    const campo = screen.getByLabelText("Novo comentário") as HTMLTextAreaElement;

    fireEvent.change(campo, { target: { value: "Oi @Jú" } });
    escolherAJulia();
    fireEvent.keyDown(screen.getByLabelText("Novo comentário"), { key: "Enter", ctrlKey: true });

    await waitFor(() => expect(chamadasDe("addTaskComment")).toHaveLength(1));
    const [, entrada] = chamadasDe("addTaskComment")[0]!.args as [string, { content: string; mentions: unknown[] }];
    expect(entrada.mentions).toEqual([{ type: "member", id: "mem_julia" }]);
  });
});

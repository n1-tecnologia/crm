// @vitest-environment jsdom
/**
 * 11-04 (TAR-05) — Notificações › "Menções a você" com as duas origens: o
 * Comentário (texto de sempre) e a descrição da Tarefa ("na descrição de").
 *
 * Molde de `pagina-do-espaco.test.tsx`: `buildSeed()`, `StoreProvider` de
 * verdade, zero rede.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import { addTaskComment, changeTaskStatus, updateTask } from "@n1/dominio/operations";
import type { DataState } from "@n1/dominio/state";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import NotificacoesPage from "@/app/(shell)/notificacoes/page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const THIAGO = "mem_thiago";
const JULIA = "mem_julia";
const TAREFA = "tsk_seed_1";

let state: DataState;

beforeEach(() => {
  state = buildSeed();
});

afterEach(() => {
  cleanup();
});

async function montar(memberId = JULIA) {
  const transporte: Transporte = {
    gravar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
    hidratar: vi.fn(async () => ({ tipo: "falha" as const, erro: "não configurado neste teste." })),
  };
  await act(async () => {
    render(
      <StoreProvider sessao={{ memberId }} estadoInicial={{ data: state, revisao: 1, ordens: {} }} transporte={transporte}>
        <NotificacoesPage />
      </StoreProvider>,
    );
  });
}

const tarefa = () => state.tasks.find((t) => t.id === TAREFA)!;

describe("Notificações › Menções a você (11-04)", () => {
  it("mostra a menção da descrição com o título, o trecho e o link para a Tarefa", async () => {
    const r = updateTask(state, THIAGO, TAREFA, {
      description: "Pedir a @Júlia Prado a revisão",
      descriptionMentions: [{ type: "member", id: JULIA }],
    });
    expect(r.ok).toBe(true);

    await montar();

    expect(screen.getByText("Menções a você")).toBeTruthy();
    expect(screen.getByText(`Menção a você na descrição de “${tarefa().title}”`)).toBeTruthy();
    expect(screen.getByText(/@Júlia Prado/)).toBeTruthy();
    const link = screen.getByText(`Menção a você na descrição de “${tarefa().title}”`).closest("a");
    expect(link?.getAttribute("href")).toBe(`/estrutura/tarefas/${TAREFA}`);
  });

  it("o aviso de Comentário continua com o texto e o link de sempre", async () => {
    const c = addTaskComment(state, THIAGO, TAREFA, { content: "Júlia, olha isto", mentions: [{ type: "member", id: JULIA }] });
    expect(c.ok).toBe(true);

    await montar();

    const texto = screen.getByText(`Thiago Nascimento mencionou você em “${tarefa().title}”`);
    expect(texto.closest("a")?.getAttribute("href")).toBe(`/estrutura/tarefas/${TAREFA}#comentario-${c.ok ? c.value.id : ""}`);
    expect(screen.queryByText(/na descrição de/)).toBeNull();
  });
});

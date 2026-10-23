// @vitest-environment jsdom
/**
 * Fase 9, 1.1.3 / Pattern 2 — quem não administra a Lista recebe `secret: ""`
 * (a chave fica, o valor some). A tela não monta `/p/` nem `/f/` sem segredo:
 * mostra "Só quem administra a Lista vê o link.". `StoreProvider` de verdade
 * sobre um `Transporte` falso, como em `forms-editor.test.tsx`.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { buildSeed } from "@n1/dominio/seed";
import type { DataState } from "@n1/dominio/state";
import type { Task } from "@n1/dominio/types";
import { StoreProvider } from "@/dados/store";
import type { Transporte } from "@/dados/transporte";
import { linkVisivel, SEM_LINK_PARA_QUEM_NAO_ADMINISTRA } from "./link-publico";
import { ShareTaskDialog } from "./share-task-dialog";

const transporte: Transporte = {
  gravar: async () => ({ tipo: "falha", erro: "fim do teste" }),
  hidratar: async () => ({ tipo: "falha", erro: "sem servidor" }),
};

function tarefaCompartilhada(estado: DataState, secret: string): Task {
  const base = estado.tasks.find((t) => t.publicShare !== undefined) ?? estado.tasks[0]!;
  const publicShare = { ...(base.publicShare ?? { createdBy: estado.workspace.ownerMemberId, createdAt: base.createdAt, showsComments: false, showsAttachments: true }), secret, active: true };
  return { ...base, publicShare };
}

function montar(secret: string) {
  const estado = buildSeed();
  const task = tarefaCompartilhada(estado, secret);
  render(
    <StoreProvider sessao={{ memberId: estado.workspace.ownerMemberId }} estadoInicial={{ data: estado, revisao: 1, ordens: {} }} transporte={transporte}>
      <ShareTaskDialog task={task} open onClose={() => {}} report={() => {}} permitido={undefined} revogarRecusado={undefined} />
    </StoreProvider>,
  );
}

afterEach(() => cleanup());

describe("linkVisivel", () => {
  it("é verdadeiro para um segredo de verdade", () => {
    expect(linkVisivel("abc")).toBe(true);
  });
  it("é falso para o segredo vazio que o servidor manda a quem não administra a Lista", () => {
    expect(linkVisivel("")).toBe(false);
  });
  it("é falso quando não há segredo", () => {
    expect(linkVisivel(undefined)).toBe(false);
  });
});

describe("ShareTaskDialog — o link da Tarefa", () => {
  it("segredo vazio: a frase no lugar do link, sem '/p/' no DOM e sem copiar nem abrir", () => {
    montar("");
    expect(screen.getByText(SEM_LINK_PARA_QUEM_NAO_ADMINISTRA)).toBeTruthy();
    expect(document.body.textContent ?? "").not.toContain("/p/");
    expect(document.querySelector('a[href*="/p/"]')).toBeNull();
    expect(screen.queryByRole("button", { name: "Copiar link" })).toBeNull();
  });

  it("com segredo: o link /p/<segredo> aparece como hoje", () => {
    montar("abc");
    expect(document.body.textContent ?? "").toContain("/p/abc");
    expect(screen.getByRole("button", { name: "Copiar link" })).toBeTruthy();
    expect(screen.queryByText(SEM_LINK_PARA_QUEM_NAO_ADMINISTRA)).toBeNull();
  });
});

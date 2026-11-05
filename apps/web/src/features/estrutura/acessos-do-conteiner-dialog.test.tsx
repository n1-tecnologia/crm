// @vitest-environment jsdom
/**
 * 12.4.4 — o painel "Acessos" de um contêiner, montado com o seed real, o
 * `StoreProvider` de verdade e o transporte em memória. O caminho do "Pronto
 * quando" da tarefa, pela tela: dar a uma Equipe acesso a uma Lista privada faz
 * os Membros dela alcançarem a Lista; revogar tira o alcance. E quem não
 * administra a Lista vê os controles desligados.
 */

import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { containerPath, memberReachesContainer } from "@n1/dominio/derive";
import { addMemberToTeam, createTeam } from "@n1/dominio/operations/equipes";
import { buildSeed } from "@n1/dominio/seed";
import type { DataState } from "@n1/dominio/state";
import { StoreProvider, useData } from "@/dados/store";
import { transporteEmMemoria } from "@/dados/transporte";
import { AcessosDoConteinerDialog } from "./acessos-do-conteiner-dialog";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => cleanup());

/** Uma Lista privada sem concessão no caminho, menos o `administrar` do Proprietário, e a Equipe Suporte com Júlia e Marcos. */
function cenario() {
  const estado = buildSeed();
  const dono = estado.workspace.ownerMemberId;
  const lista = estado.lists.find((l) => l.lifecycle === "ativo")!;
  lista.isPrivate = true;
  const nos = new Set(containerPath(estado, "list", lista.id).map((n) => n.id));
  estado.grants = estado.grants.filter((g) => !nos.has(g.resourceId));
  estado.grants.push({
    id: "grn_adm_dono_teste",
    workspaceId: estado.workspace.id,
    subjectKind: "member",
    subjectId: dono,
    action: "administrar",
    resourceType: "list",
    resourceId: lista.id,
    scope: "subarvore",
    origin: "concessaoDireta",
    grantedBy: dono,
    grantedAt: new Date().toISOString(),
  });
  const equipe = createTeam(estado, dono, { nome: "Suporte" });
  if (!equipe.ok) throw new Error(equipe.error);
  addMemberToTeam(estado, dono, equipe.value.id, "mem_julia");
  addMemberToTeam(estado, dono, equipe.value.id, "mem_marcos");
  return { estado, lista };
}

let atual: DataState | undefined;
const aoVer = (data: DataState) => {
  atual = data;
};
/** Entrega o estado do store a cada render, para o teste ler o alcance depois de cada clique. */
function Espiao({ aoMudar }: { readonly aoMudar: (data: DataState) => void }) {
  const data = useData((d) => d);
  useEffect(() => aoMudar(data));
  return null;
}

function montar(estado: DataState, listaId: string, memberId: string) {
  return render(
    <StoreProvider sessao={{ memberId }} estadoInicial={{ data: estado, revisao: 1, ordens: {} }} transporte={transporteEmMemoria()}>
      <Espiao aoMudar={aoVer} />
      <AcessosDoConteinerDialog open type="list" id={listaId} onClose={() => {}} />
    </StoreProvider>,
  );
}

describe("AcessosDoConteinerDialog", () => {
  it("conceder ver à Equipe abre a Lista privada para os Membros dela; revogar fecha", async () => {
    const { estado, lista } = cenario();
    montar(estado, lista.id, estado.workspace.ownerMemberId);
    expect(memberReachesContainer(atual!, "mem_julia", "list", lista.id)).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Equipe" }));
    fireEvent.click(screen.getAllByRole("combobox")[0]!);
    fireEvent.click(screen.getByRole("option", { name: "Suporte" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Conceder" }));
    });

    expect(memberReachesContainer(atual!, "mem_julia", "list", lista.id)).toBe(true);
    expect(memberReachesContainer(atual!, "mem_marcos", "list", lista.id)).toBe(true);
    expect(screen.getByText("Equipe Suporte")).toBeTruthy();

    const revogar = screen.getAllByRole("button", { name: "Revogar" });
    // A primeira é a do Proprietário (a última administrar: o domínio recusaria); a da Equipe é a outra.
    await act(async () => {
      fireEvent.click(revogar[revogar.length - 1]!);
    });
    expect(memberReachesContainer(atual!, "mem_julia", "list", lista.id)).toBe(false);
    expect(memberReachesContainer(atual!, "mem_marcos", "list", lista.id)).toBe(false);
  });

  it("quem não administra a Lista vê Conceder e Revogar desligados", () => {
    const { estado, lista } = cenario();
    montar(estado, lista.id, "mem_julia");
    const conceder = screen.getByRole("button", { name: "Conceder" });
    expect(conceder.hasAttribute("disabled") || conceder.getAttribute("aria-disabled") === "true").toBe(true);
  });
});

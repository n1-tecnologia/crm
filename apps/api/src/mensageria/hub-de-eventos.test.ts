/**
 * O hub de eventos (16-07, 3.8.3, MSG-03), sem banco: o evento de um Espaço nunca chega a outro, quem deixa de poder
 * ler Conversas perde o fluxo na reconferência, o Membro tem no máximo 5 fluxos e `encerrarTodos` não deixa nenhum
 * aberto (T-16-24, T-16-25, T-16-26, T-16-28).
 */

import { describe, expect, it, vi } from "vitest";
import type { EventoParaATela } from "@n1/dominio/crm/eventos";
import type { MembroDaSessao } from "../plugins/autenticacao";
import { criarHubDeEventos } from "./hub-de-eventos";

const membro = (id: string, workspaceId: string): MembroDaSessao => ({ id, workspaceId, state: "ativo" });

/** Um fluxo falso: guarda o que recebeu e conta os `fechar`. */
function fluxo() {
  const recebidos: EventoParaATela[] = [];
  const fechar = vi.fn();
  return { recebidos, fechar, enviar: (e: EventoParaATela) => void recebidos.push(e) };
}

const novo = (opcoes: Partial<Parameters<typeof criarHubDeEventos>[0]> = {}) =>
  criarHubDeEventos({ podeLer: async () => true, reconferirMs: 20, ...opcoes });

describe("hub de eventos: o Espaço do evento", () => {
  it("publicar de um Espaço entrega só aos fluxos desse Espaço, sem o workspaceId", () => {
    const hub = novo();
    const deA = fluxo();
    const deB = fluxo();
    hub.assinar(membro("mem_a", "ws_a"), deA.enviar, deA.fechar);
    hub.assinar(membro("mem_b", "ws_b"), deB.enviar, deB.fechar);

    hub.publicar({ workspaceId: "ws_a", tipo: "mensagem.nova", conversaId: "c1", mensagemId: "m1" });
    hub.publicar({ workspaceId: "ws_a", tipo: "conversa.mudou", conversaId: "c2" });

    expect(deA.recebidos).toEqual([
      { tipo: "mensagem.nova", conversaId: "c1", mensagemId: "m1" },
      { tipo: "conversa.mudou", conversaId: "c2" },
    ]);
    expect(deB.recebidos).toEqual([]);
    expect(Object.keys(deA.recebidos[0]!)).not.toContain("workspaceId");
  });

  it("um fluxo que lança em enviar não impede os outros de receber", () => {
    const hub = novo();
    const bom = fluxo();
    hub.assinar(membro("mem_a", "ws_a"), () => {
      throw new Error("socket quebrado");
    }, () => undefined);
    hub.assinar(membro("mem_c", "ws_a"), bom.enviar, bom.fechar);

    hub.publicar({ workspaceId: "ws_a", tipo: "mensagem.status", conversaId: "c1", mensagemId: "m1" });

    expect(bom.recebidos).toHaveLength(1);
  });

  it("quem sai (a função devolvida) não recebe mais, e sair duas vezes não chama fechar", () => {
    const hub = novo();
    const a = fluxo();
    const sair = hub.assinar(membro("mem_a", "ws_a"), a.enviar, a.fechar);
    expect(hub.assinantes).toBe(1);

    sair();
    sair();
    hub.publicar({ workspaceId: "ws_a", tipo: "conversa.mudou", conversaId: "c1" });

    expect(hub.assinantes).toBe(0);
    expect(a.recebidos).toEqual([]);
    expect(a.fechar).not.toHaveBeenCalled();
  });
});

describe("hub de eventos: o Papel é reconferido", () => {
  it("quando podeLer passa a devolver false, o fluxo é fechado na reconferência e os outros ficam", async () => {
    let pode = true;
    const hub = novo({ podeLer: async (m) => m.id !== "mem_a" || pode });
    const a = fluxo();
    const b = fluxo();
    hub.assinar(membro("mem_a", "ws_a"), a.enviar, a.fechar);
    hub.assinar(membro("mem_b", "ws_a"), b.enviar, b.fechar);

    await new Promise((resolver) => setTimeout(resolver, 60));
    expect(a.fechar).not.toHaveBeenCalled();

    pode = false;
    await vi.waitFor(() => expect(a.fechar).toHaveBeenCalledTimes(1), { timeout: 1_000 });
    expect(b.fechar).not.toHaveBeenCalled();
    expect(hub.assinantes).toBe(1);

    hub.publicar({ workspaceId: "ws_a", tipo: "conversa.mudou", conversaId: "c1" });
    expect(a.recebidos).toEqual([]);
    expect(b.recebidos).toHaveLength(1);
    hub.encerrarTodos();
  });

  it("um podeLer que lança (o banco falhou) não é negação: o fluxo fica e a próxima volta tenta de novo", async () => {
    let falhar = true;
    const consultas = vi.fn(async () => {
      if (falhar) throw new Error("conexão caiu");
      return true;
    });
    const hub = novo({ podeLer: consultas });
    const a = fluxo();
    hub.assinar(membro("mem_a", "ws_a"), a.enviar, a.fechar);

    await vi.waitFor(() => expect(consultas.mock.calls.length).toBeGreaterThanOrEqual(2), { timeout: 1_000 });
    expect(a.fechar).not.toHaveBeenCalled();
    expect(hub.assinantes).toBe(1);

    falhar = false;
    hub.encerrarTodos();
  });
});

describe("hub de eventos: abas demais", () => {
  it("a 6ª assinatura do mesmo Membro fecha a 1ª; a de outro Membro não conta", () => {
    const hub = novo();
    const abas = Array.from({ length: 6 }, () => fluxo());
    const outro = fluxo();
    hub.assinar(membro("mem_outro", "ws_a"), outro.enviar, outro.fechar);
    abas.forEach((a) => hub.assinar(membro("mem_a", "ws_a"), a.enviar, a.fechar));

    expect(abas[0]!.fechar).toHaveBeenCalledTimes(1);
    for (const a of abas.slice(1)) expect(a.fechar).not.toHaveBeenCalled();
    expect(outro.fechar).not.toHaveBeenCalled();
    expect(hub.assinantes).toBe(6);
    hub.encerrarTodos();
  });

  it("maxPorMembro é configurável; o mesmo id em outro Espaço é outro Membro", () => {
    const hub = novo({ maxPorMembro: 1 });
    const primeira = fluxo();
    const doutroEspaco = fluxo();
    const segunda = fluxo();
    hub.assinar(membro("mem_a", "ws_a"), primeira.enviar, primeira.fechar);
    hub.assinar(membro("mem_a", "ws_b"), doutroEspaco.enviar, doutroEspaco.fechar);
    expect(primeira.fechar).not.toHaveBeenCalled();

    hub.assinar(membro("mem_a", "ws_a"), segunda.enviar, segunda.fechar);
    expect(primeira.fechar).toHaveBeenCalledTimes(1);
    expect(doutroEspaco.fechar).not.toHaveBeenCalled();
    hub.encerrarTodos();
  });
});

describe("hub de eventos: o desligamento", () => {
  it("encerrarTodos fecha todos os fluxos e deixa assinantes em 0", () => {
    const hub = novo();
    const abas = [fluxo(), fluxo(), fluxo()];
    abas.forEach((a, i) => hub.assinar(membro(`mem_${i}`, "ws_a"), a.enviar, a.fechar));

    hub.encerrarTodos();

    for (const a of abas) expect(a.fechar).toHaveBeenCalledTimes(1);
    expect(hub.assinantes).toBe(0);
  });

  it("nasce indisponível; definirDisponivel(true) liga e definirDisponivel(false) encerra todos", () => {
    const hub = novo();
    expect(hub.disponivel).toBe(false);
    hub.definirDisponivel(true);
    expect(hub.disponivel).toBe(true);

    const a = fluxo();
    hub.assinar(membro("mem_a", "ws_a"), a.enviar, a.fechar);
    hub.definirDisponivel(false);

    expect(hub.disponivel).toBe(false);
    expect(a.fechar).toHaveBeenCalledTimes(1);
    expect(hub.assinantes).toBe(0);
  });

  it("a reconferência não deixa o processo aberto: sem assinantes não há temporizador vivo", async () => {
    const consultas = vi.fn(async () => true);
    const hub = novo({ podeLer: consultas });
    const a = fluxo();
    const sair = hub.assinar(membro("mem_a", "ws_a"), a.enviar, a.fechar);
    sair();

    const antes = consultas.mock.calls.length;
    await new Promise((resolver) => setTimeout(resolver, 80));
    expect(consultas.mock.calls.length).toBe(antes);
  });
});

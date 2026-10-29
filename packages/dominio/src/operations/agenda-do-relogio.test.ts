/**
 * 10-05 (D-01, D-02, F3, Q1) — o regime e o ator de cada volta do relógio, como
 * funções puras do domínio. O worker de `apps/api` só as chama dentro do
 * `executar()`; as regras moram aqui para a tela e o servidor nunca divergirem.
 *
 * Base: `buildSeed()`. A Lista `lst_revisoes` (Espaço público `spc_ops`) já tem
 * a Tarefa `tsk_seed_9`, recorrente por calendário, e a Automação `aut_revisao`
 * PAUSADA, de gatilho por evento — nenhuma das duas conta como agenda por
 * vencimento. Os casos montam a Automação por vencimento por cima.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Automation, Grant } from "../types";
import { atorDoRelogio, listaTemAgendaPorVencimento, regimeDaPrimeiraVolta } from "./agenda-do-relogio";

const LISTA = "lst_revisoes";
const ESPACO = "spc_ops";
const PROPRIETARIO = "mem_thiago";
const ADMINISTRADOR = "mem_rafael";
const MEMBRO = "mem_julia";
const CONVIDADO = "mem_beatriz";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

/** Automação de Lista, ativa e publicada, de gatilho por vencimento — por cima do molde que o seed já tem. */
function automacaoPorVencimento(id: string, listId: string, sobrescrever: Partial<Automation> = {}): Automation {
  const molde = state.automations.find((a) => a.id === "aut_revisao");
  if (!molde) throw new Error("o seed perdeu aut_revisao");
  const [versao] = molde.versions;
  if (!versao) throw new Error("aut_revisao sem versão");
  return {
    ...molde,
    id,
    lifecycle: "ativo",
    scopeType: "list",
    scopeId: listId,
    versions: [{ ...versao, state: "publicada", trigger: { kind: "condicaoTemporal", temporalPredicate: JSON.stringify({ dueDateOffsetDays: 0 }) } }],
    ...sobrescrever,
  };
}

function concessaoDeAdministrar(membroId: string, tipo: "list" | "space", recursoId: string): Grant {
  return {
    id: `gr_teste_${membroId}_${recursoId}`,
    workspaceId: state.workspace.id,
    subjectKind: "member",
    subjectId: membroId,
    action: "administrar",
    resourceType: tipo,
    resourceId: recursoId,
    scope: "subarvore",
    origin: "concessaoDireta",
    grantedBy: PROPRIETARIO,
    grantedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("listaTemAgendaPorVencimento / regimeDaPrimeiraVolta — D-02", () => {
  it("a Lista só com Tarefa recorrente por calendário nasce direto: sem Automação por vencimento, sem ensaio", () => {
    expect(state.tasks.some((t) => t.listId === LISTA && t.recurrence?.triggerMode === "porCalendario")).toBe(true);
    expect(listaTemAgendaPorVencimento(state, LISTA)).toBe(false);
    expect(regimeDaPrimeiraVolta(state, LISTA)).toBe("direto");
  });

  it("a Lista com Automação ativa de gatilho por vencimento publicado fica em ensaio", () => {
    state.automations.push(automacaoPorVencimento("aut_teste_venc", LISTA));
    expect(listaTemAgendaPorVencimento(state, LISTA)).toBe(true);
    expect(regimeDaPrimeiraVolta(state, LISTA)).toBe("ensaio");
  });

  it("a Lista com as duas coisas (recorrência por calendário e Automação por vencimento) mantém o ensaio", () => {
    state.automations.push(automacaoPorVencimento("aut_teste_venc", LISTA));
    expect(state.tasks.some((t) => t.listId === LISTA && t.recurrence?.triggerMode === "porCalendario")).toBe(true);
    expect(regimeDaPrimeiraVolta(state, LISTA)).toBe("ensaio");
  });

  it("a Automação cuja ÚLTIMA versão publicada é de outro gatilho não conta: o regime é direto", () => {
    const antiga = automacaoPorVencimento("aut_teste_troca", LISTA);
    const [v1] = antiga.versions;
    if (!v1) throw new Error("sem v1");
    antiga.versions = [
      { ...v1, number: 1, state: "obsoleta" },
      { ...v1, number: 2, state: "publicada", trigger: { kind: "evento", eventType: "tarefaCriada" } },
    ];
    state.automations.push(antiga);
    expect(listaTemAgendaPorVencimento(state, LISTA)).toBe(false);
    expect(regimeDaPrimeiraVolta(state, LISTA)).toBe("direto");
  });

  it("a Automação por vencimento PAUSADA ou de outra Lista não põe esta Lista em ensaio", () => {
    state.automations.push(automacaoPorVencimento("aut_teste_pausada", LISTA, { lifecycle: "pausado" }));
    state.automations.push(automacaoPorVencimento("aut_teste_outra", "lst_propostas"));
    expect(listaTemAgendaPorVencimento(state, LISTA)).toBe(false);
    expect(regimeDaPrimeiraVolta(state, LISTA)).toBe("direto");
    expect(regimeDaPrimeiraVolta(state, "lst_propostas")).toBe("ensaio");
  });

  it("a Automação de escopo Espaço (não Lista) não conta, mesmo com gatilho por vencimento", () => {
    state.automations.push(automacaoPorVencimento("aut_teste_espaco", ESPACO, { scopeType: "space" }));
    expect(listaTemAgendaPorVencimento(state, LISTA)).toBe(false);
  });
});

describe("atorDoRelogio — F3, Q1 (autoria humana a confirmar com o dono)", () => {
  it("o preferido que administra a Lista (concessão direta) é o ator", () => {
    state.grants.push(concessaoDeAdministrar(MEMBRO, "list", LISTA));
    expect(atorDoRelogio(state, LISTA, MEMBRO)).toBe(MEMBRO);
  });

  it("o preferido Convidado sem concessão na Lista não vale: cai no Proprietário do Espaço de Trabalho", () => {
    expect(atorDoRelogio(state, LISTA, CONVIDADO)).toBe(state.workspace.ownerMemberId);
    expect(atorDoRelogio(state, LISTA, CONVIDADO)).toBe(PROPRIETARIO);
  });

  it("o preferido ausente (a resolução do Agente do pipeline falhou) cai no Proprietário", () => {
    expect(atorDoRelogio(state, LISTA, undefined)).toBe(PROPRIETARIO);
  });

  it("o preferido que não é Membro do Espaço (id solto) também cai no Proprietário", () => {
    expect(atorDoRelogio(state, LISTA, "mem_que_nao_existe")).toBe(PROPRIETARIO);
  });

  it("o Proprietário suspenso não assina: o primeiro Administrador ativo assume", () => {
    const dono = state.members.find((m) => m.id === PROPRIETARIO);
    if (!dono) throw new Error("sem Proprietário no seed");
    dono.state = "suspenso";
    expect(atorDoRelogio(state, LISTA, undefined)).toBe(ADMINISTRADOR);
  });

  it("Lista em Espaço privado: o Proprietário sem concessão não alcança, o Administrador com concessão assina", () => {
    const espaco = state.spaces.find((s) => s.id === ESPACO);
    if (!espaco) throw new Error("sem spc_ops");
    espaco.isPrivate = true;
    state.grants.push(concessaoDeAdministrar(ADMINISTRADOR, "space", ESPACO));
    expect(atorDoRelogio(state, LISTA, undefined)).toBe(ADMINISTRADOR);
    expect(atorDoRelogio(state, LISTA, PROPRIETARIO)).toBe(ADMINISTRADOR);
  });

  it("ninguém administra a Lista (Espaço privado e nenhuma concessão): devolve undefined", () => {
    const espaco = state.spaces.find((s) => s.id === ESPACO);
    if (!espaco) throw new Error("sem spc_ops");
    espaco.isPrivate = true;
    expect(atorDoRelogio(state, LISTA, undefined)).toBeUndefined();
  });

  it("o Membro de Papel comum com concessão só em OUTRA Lista não é ator desta", () => {
    state.grants.push(concessaoDeAdministrar(MEMBRO, "list", "lst_propostas"));
    expect(atorDoRelogio(state, LISTA, MEMBRO)).toBe(PROPRIETARIO);
  });
});

/**
 * PRIV-03 — o estado que cada Membro enxerga. O seed tem o Espaço "Gestão"
 * privado (CPF, dado bancário) com concessão só para o Financeiro e para
 * mem_thiago: para qualquer outro Membro, Gestão e o que está abaixo dela não
 * existem — nem no estado, nem no diff, nem nas ordens.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { memberNamedOnTask, memberReachesContainer, memberSeesTask } from "./derive";
import { estadoVisivelPara, filtrarDiferenca, filtrarOrdens, membroVeArquivo, tarefasComOArquivo, visibilidadePara } from "./derive-visibilidade";
import { CP } from "./operations/financeiro-base";
import { createList } from "./operations/structure";
import { buildSeed } from "./seed";
import type { DataState } from "./state";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

/**
 * Um Membro ativo que não enxerga NADA de Gestão: sem concessão e sem Tarefa
 * que o nomeie num Campo de pessoa (quem é nomeado vê a própria conta, e isso
 * puxa o caminho da Lista — RN-ESP-15).
 */
function semGestao(): string {
  const m = state.members.find((x) => x.state === "ativo" && visibilidadePara(state, x.id).ocultos.has(CP.spaceId));
  if (!m) throw new Error("o seed precisa de um Membro ativo que não enxergue Gestão");
  return m.id;
}

describe("visibilidadePara", () => {
  it("quem não alcança Gestão não recebe o Espaço, as Pastas, as Listas nem as Tarefas dele", () => {
    const { estado, ocultos } = visibilidadePara(state, semGestao());
    expect(estado.spaces.some((s) => s.id === CP.spaceId)).toBe(false);
    expect(estado.folders.some((f) => f.id === CP.folderId)).toBe(false);
    expect(estado.lists.some((l) => l.id === CP.listId)).toBe(false);
    expect(estado.tasks.some((t) => t.listId === CP.listId)).toBe(false);
    expect(ocultos.has(CP.spaceId)).toBe(true);
    expect(ocultos.has(CP.listId)).toBe(true);
    // O que não é privado continua inteiro, e o que a leitura de alcance precisa também.
    expect(estado.spaces.length).toBeGreaterThan(0);
    expect(estado.members).toBe(state.members);
    expect(estado.grants).toBe(state.grants);
    // Registros de Atividade e Aprovações sobre o que saiu também saem.
    expect(estado.activity.some((a) => ocultos.has(a.objectId))).toBe(false);
    expect(estado.approvals.some((a) => ocultos.has(a.object.targetResourceId))).toBe(false);
  });

  it("quem tem concessão em Gestão recebe Gestão inteira; e quem alcança tudo recebe o mesmo objeto", () => {
    const { estado } = visibilidadePara(state, CP.financeiroId);
    expect(estado.spaces.some((s) => s.id === CP.spaceId)).toBe(true);
    expect(estado.tasks.filter((t) => t.listId === CP.listId).length).toBe(state.tasks.filter((t) => t.listId === CP.listId).length);
    // Um Membro nomeado num Campo de pessoa vê a própria conta, e só ela (RN-ESP-15): o caminho vem junto, as irmãs não.
    const nomeado = state.members.find((x) => x.state === "ativo" && !visibilidadePara(state, x.id).ocultos.has(CP.spaceId) && !state.grants.some((g) => g.resourceId === CP.spaceId && g.subjectId === x.id));
    if (nomeado) {
      const dele = estadoVisivelPara(state, nomeado.id);
      expect(dele.tasks.filter((t) => t.listId === CP.listId).length).toBeLessThan(state.tasks.filter((t) => t.listId === CP.listId).length);
    }
    // Quem alcança toda a Estrutura recebe a Estrutura inteira. Já não existe o atalho
    // "nada oculto, devolve o mesmo objeto" (Fase 9, Pitfall 1): a IA pessoal alheia sai
    // para todo Papel, então o recorte sempre monta o estado novo.
    const dono = state.workspace.ownerMemberId;
    const doDono = visibilidadePara(state, dono).estado;
    expect(doDono.spaces).toHaveLength(state.spaces.length);
    expect(doDono.lists).toHaveLength(state.lists.length);
    expect(doDono.tasks).toHaveLength(state.tasks.length);
  });

  it("uma Lista compartilhada dentro do Espaço privado expõe o caminho (RN-ESP-15), não as irmãs", () => {
    const membro = semGestao();
    const nova = createList(state, CP.financeiroId, { name: "Compartilhada", parentType: "space", parentId: CP.spaceId });
    if (!nova.ok) throw new Error(nova.error);
    state.grants.push({
      id: "gr_teste_compartilhada",
      workspaceId: state.workspace.id,
      subjectKind: "member",
      subjectId: membro,
      action: "ver",
      resourceType: "list",
      resourceId: nova.value.id,
      scope: "subarvore",
      origin: "compartilhamento",
      grantedBy: CP.financeiroId,
      grantedAt: new Date().toISOString(),
    });
    const { estado } = visibilidadePara(state, membro);
    expect(estado.lists.some((l) => l.id === nova.value.id)).toBe(true);
    expect(estado.spaces.some((s) => s.id === CP.spaceId)).toBe(true);
    expect(estado.lists.some((l) => l.id === CP.listId)).toBe(false);
    expect(estado.tasks.some((t) => t.listId === CP.listId)).toBe(false);
  });

  it("HIST-10 — a Pessoa da conta recebe a própria conta e o caminho da Lista, não as outras contas: 'Compartilhadas comigo' sobrevive ao recorte do servidor", () => {
    const pessoa = "mem_thiago_pereira";
    const { estado, ocultos } = visibilidadePara(state, pessoa);
    // A Tarefa em que ela é a Pessoa chega, com a Lista e o Espaço que a situam.
    expect(estado.tasks.some((t) => t.id === "tsk_cp_thiago_out")).toBe(true);
    expect(estado.lists.some((l) => l.id === CP.listId)).toBe(true);
    expect(estado.spaces.some((s) => s.id === CP.spaceId)).toBe(true);
    // As contas em que ela NÃO é a Pessoa não chegam: estão no conjunto oculto.
    // (Ela pode ser a Pessoa de mais de uma — a série recorrente do mesmo fornecedor.)
    const outras = state.tasks.filter((t) => t.listId === CP.listId && !memberNamedOnTask(state, pessoa, t));
    expect(outras.length).toBeGreaterThan(0);
    expect(outras.every((t) => ocultos.has(t.id))).toBe(true);
    expect(estado.tasks.filter((t) => t.listId === CP.listId).every((t) => memberNamedOnTask(state, pessoa, t))).toBe(true);
    // O que a seção pergunta ("vejo e não alcanço a Lista") continua verdadeiro sobre o estado recortado.
    expect(memberSeesTask(estado, pessoa, "tsk_cp_thiago_out")).toBe(true);
    expect(memberReachesContainer(estado, pessoa, "list", CP.listId)).toBe(false);
  });

  it("POSC-08 — um Arquivo segue as Tarefas que o carregam: quem não vê a Tarefa não vê nem baixa o Arquivo", () => {
    const membro = semGestao();
    const conta = state.tasks.find((t) => t.listId === CP.listId && t.lifecycle === "ativo");
    if (!conta) throw new Error("seed sem conta a pagar");
    state.files.push({
      id: "wf_teste_boleto",
      workspaceId: state.workspace.id,
      name: "boleto.pdf",
      mediaType: "document",
      sizeBytes: 1234,
      createdBy: { kind: "member", id: CP.financeiroId },
      createdAt: new Date().toISOString(),
      objectKey: "privado/wf_teste_boleto.pdf",
      state: "enviado",
    });
    conta.attachments.push({ fileId: "wf_teste_boleto", order: conta.attachments.length, mediaType: "document", displayName: "boleto.pdf" });
    expect(tarefasComOArquivo(state, "wf_teste_boleto").map((t) => t.id)).toEqual([conta.id]);
    expect(membroVeArquivo(state, membro, "wf_teste_boleto")).toBe(false);
    expect(membroVeArquivo(state, CP.financeiroId, "wf_teste_boleto")).toBe(true);
    expect(membroVeArquivo(state, membro, "wf_nao_existe")).toBe(false);
    const { estado, ocultos } = visibilidadePara(state, membro);
    expect(estado.files.some((f) => f.id === "wf_teste_boleto")).toBe(false);
    expect(ocultos.has("wf_teste_boleto")).toBe(true);
    // Pelo valor de um Campo de arquivo também conta.
    state.files.push({ ...state.files.find((f) => f.id === "wf_teste_boleto")!, id: "wf_teste_campo", objectKey: "privado/wf_teste_campo.pdf" });
    conta.fieldValues.push({ definitionId: "fld_qualquer", value: ["wf_teste_campo"], state: "ativo" });
    expect(membroVeArquivo(state, membro, "wf_teste_campo")).toBe(false);
    // Sem Tarefa nenhuma, fica aberto a quem tem sessão no Espaço.
    state.files.push({ ...state.files.find((f) => f.id === "wf_teste_boleto")!, id: "wf_solto", objectKey: "privado/wf_solto.pdf" });
    expect(membroVeArquivo(state, membro, "wf_solto")).toBe(true);
    expect(visibilidadePara(state, membro).estado.files.some((f) => f.id === "wf_solto")).toBe(true);
  });

  it("filtrarDiferenca e filtrarOrdens tiram só os ids ocultos", () => {
    const ocultos = new Set(["t_oculta", "lst_oculta"]);
    const diff = filtrarDiferenca(
      {
        gravados: [
          { colecao: "tasks", id: "t_oculta", dados: {}, ordem: 1 },
          { colecao: "tasks", id: "t_visivel", dados: {}, ordem: 2 },
        ],
        removidos: [{ colecao: "lists", id: "lst_oculta" }, { colecao: "lists", id: "lst_visivel" }],
      },
      ocultos,
    );
    expect(diff.gravados.map((g) => g.id)).toEqual(["t_visivel"]);
    expect(diff.removidos.map((r) => r.id)).toEqual(["lst_visivel"]);
    expect(filtrarOrdens({ tasks: { t_oculta: 1, t_visivel: 2 }, lists: { lst_oculta: 0 } }, ocultos)).toEqual({ tasks: { t_visivel: 2 }, lists: {} });
  });
});

/**
 * D-01 / D-22 — a IA pessoal (Sessão de Chat, pasta, Execução de Sessão) só sai
 * do servidor para quem a lê (DO-CHT-09). No seed, mem_thiago é o dono de
 * cht_1, cht_2 e cht_6 (e das pastas cfd_propostas e cfd_processo); mem_rafael,
 * mem_julia e mem_marcos têm uma Sessão cada. mem_thiago também é o Proprietário.
 */
describe("visibilidadePara — Sessão de Chat, pasta e execução (D-01, D-22)", () => {
  const DONO = "mem_thiago";
  const OUTRO = "mem_rafael"; // está em team_com e team_closers
  const idsDe = (itens: ReadonlyArray<{ readonly id: string }>) => itens.map((i) => i.id);
  const sessao = (id: string) => {
    const s = state.chatSessions.find((x) => x.id === id);
    if (!s) throw new Error(`o seed precisa da Sessão ${id}`);
    return s;
  };

  it("sem compartilhamento, o outro Membro não recebe a Sessão; o dono recebe as dele", () => {
    const { estado, ocultos } = visibilidadePara(state, OUTRO);
    for (const id of ["cht_1", "cht_2", "cht_6"]) {
      expect(idsDe(estado.chatSessions)).not.toContain(id);
      expect(ocultos.has(id)).toBe(true);
    }
    expect(idsDe(estado.chatSessions)).toContain("cht_3");
    const doDono = visibilidadePara(state, DONO).estado;
    expect(idsDe(doDono.chatSessions)).toEqual(expect.arrayContaining(["cht_1", "cht_2", "cht_6"]));
  });

  it("a Sessão compartilhada com o Membro (sharedWithMemberIds) chega", () => {
    sessao("cht_6").sharedWithMemberIds.push(OUTRO);
    const { estado, ocultos } = visibilidadePara(state, OUTRO);
    expect(idsDe(estado.chatSessions)).toContain("cht_6");
    expect(ocultos.has("cht_6")).toBe(false);
    // Compartilhar uma Sessão não abre as outras do mesmo dono.
    expect(idsDe(estado.chatSessions)).not.toContain("cht_1");
  });

  it("a Sessão compartilhada com uma Equipe do Membro (sharedWithTeamIds) chega; com Equipe que não é dele, não", () => {
    sessao("cht_6").sharedWithTeamIds.push("team_closers");
    sessao("cht_1").sharedWithTeamIds.push("team_ops");
    const { estado } = visibilidadePara(state, OUTRO);
    expect(idsDe(estado.chatSessions)).toContain("cht_6");
    expect(idsDe(estado.chatSessions)).not.toContain("cht_1");
  });

  it("a pasta de chat de outro Membro nunca chega; a Sessão compartilhada chega sem folderId e o estado de origem não muda", () => {
    expect(sessao("cht_1").folderId).toBe("cfd_propostas");
    sessao("cht_1").sharedWithMemberIds.push(OUTRO);
    const { estado, ocultos } = visibilidadePara(state, OUTRO);
    expect(idsDe(estado.chatFolders)).not.toContain("cfd_propostas");
    expect(ocultos.has("cfd_propostas")).toBe(true);
    expect(ocultos.has("cfd_processo")).toBe(true);
    const chegou = estado.chatSessions.find((x) => x.id === "cht_1");
    expect(chegou).toBeDefined();
    expect("folderId" in chegou!).toBe(false);
    // Nunca muta o estado inteiro: o servidor segue com a pasta no registro.
    expect(sessao("cht_1").folderId).toBe("cfd_propostas");
    // O dono continua com as pastas e com o folderId das próprias Sessões.
    const doDono = visibilidadePara(state, DONO).estado;
    expect(idsDe(doDono.chatFolders)).toEqual(expect.arrayContaining(["cfd_propostas", "cfd_processo"]));
    expect(doDono.chatSessions.find((x) => x.id === "cht_1")?.folderId).toBe("cfd_propostas");
  });

  it("as Execuções de Sessão oculta saem (com os ids em ocultos); as de outras origens e as de Sessão visível ficam", () => {
    const deCht2 = state.agentExecutions.filter((e) => e.chatSessionId === "cht_2").map((e) => e.id);
    expect(deCht2.length).toBeGreaterThan(0);
    const deOutraOrigem = state.agentExecutions.filter((e) => e.origin !== "sessaoDeChat").map((e) => e.id);
    expect(deOutraOrigem.length).toBeGreaterThan(0);

    const antes = visibilidadePara(state, OUTRO);
    for (const id of deCht2) {
      expect(idsDe(antes.estado.agentExecutions)).not.toContain(id);
      expect(antes.ocultos.has(id)).toBe(true);
    }
    expect(idsDe(antes.estado.agentExecutions)).toEqual(expect.arrayContaining(deOutraOrigem));
    expect(antes.estado.agentExecutions.some((e) => e.origin === "sessaoDeChat" && e.chatSessionId !== undefined && !idsDe(antes.estado.chatSessions).includes(e.chatSessionId))).toBe(false);

    // Compartilhada a Sessão, a conversa dela volta junto.
    sessao("cht_2").sharedWithMemberIds.push(OUTRO);
    const depois = visibilidadePara(state, OUTRO);
    expect(idsDe(depois.estado.agentExecutions)).toEqual(expect.arrayContaining(deCht2));
    expect(deCht2.some((id) => depois.ocultos.has(id))).toBe(false);
  });

  it("Pitfall 1 — o Proprietário alcança toda a Estrutura e mesmo assim não recebe a Sessão de outro Membro", () => {
    expect(state.workspace.ownerMemberId).toBe(DONO);
    const { estado, ocultos } = visibilidadePara(state, DONO);
    // Nada da Estrutura saiu...
    expect(estado.tasks).toHaveLength(state.tasks.length);
    expect(estado.lists).toHaveLength(state.lists.length);
    // ...e ainda assim as Sessões de Rafael, Julia e Marcos não vieram, nem as Execuções delas.
    for (const id of ["cht_3", "cht_4", "cht_5"]) {
      expect(idsDe(estado.chatSessions)).not.toContain(id);
      expect(ocultos.has(id)).toBe(true);
    }
    // Vale para todo Papel: quem não é dono nem recebeu o compartilhamento não lê.
    const doRafael = visibilidadePara(state, OUTRO).estado;
    expect(doRafael.chatSessions.every((x) => x.ownerMemberId === OUTRO)).toBe(true);
  });

  it("filtrarOrdens tira os ids de Sessão, pasta e Execução ocultas; a ordem das Sessões que ficam é a do estado", () => {
    const { estado, ocultos } = visibilidadePara(state, OUTRO);
    const ordens = filtrarOrdens(
      {
        chatSessions: Object.fromEntries(state.chatSessions.map((x, i) => [x.id, i])),
        chatFolders: Object.fromEntries(state.chatFolders.map((x, i) => [x.id, i])),
        agentExecutions: Object.fromEntries(state.agentExecutions.map((x, i) => [x.id, i])),
      },
      ocultos,
    );
    expect(Object.keys(ordens.chatSessions ?? {})).toEqual(idsDe(estado.chatSessions));
    expect(Object.keys(ordens.chatFolders ?? {})).toEqual([]);
    expect(Object.keys(ordens.agentExecutions ?? {})).toEqual(idsDe(estado.agentExecutions));
    // Só filtra: a ordem relativa é a do estado.
    expect(idsDe(estado.chatSessions)).toEqual(idsDe(state.chatSessions).filter((id) => !ocultos.has(id)));
  });
});

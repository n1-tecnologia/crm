/**
 * PRIV-03 — o estado que cada Membro enxerga. O seed tem o Espaço "Gestão"
 * privado (CPF, dado bancário) com concessão só para o Financeiro e para
 * mem_thiago: para qualquer outro Membro, Gestão e o que está abaixo dela não
 * existem — nem no estado, nem no diff, nem nas ordens.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { memberNamedOnTask, memberReachesContainer, memberSeesTask } from "./derive";
import { estadoVisivelPara, filtrarDiferenca, filtrarOrdens, membroVeArquivo, recortarRegistro, tarefasComOArquivo, visibilidadePara } from "./derive-visibilidade";
import { CP } from "./operations/financeiro-base";
import { createList } from "./operations/structure";
import { buildSeed } from "./seed";
import type { DataState } from "./state";
import type { Form, Member, Task, View } from "./types";

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

/**
 * D-01 (1.1.2, 1.1.3) — dado pessoal de outro Membro e segredos de link. No seed:
 * mem_thiago é o Proprietário e tem um item de Memória; mem_rafael é
 * Administrador; mem_julia (Papel Vendas, base membro) é a leitora comum.
 */
describe("recortarRegistro e visibilidadePara — dado pessoal e segredos (D-01)", () => {
  const PROPRIETARIO = "mem_thiago";
  const ADMIN = "mem_rafael";
  const COMUM = "mem_julia";
  const membroDe = (estado: DataState, id: string): Member => {
    const m = estado.members.find((x) => x.id === id);
    if (!m) throw new Error(`o estado precisa do Membro ${id}`);
    return m;
  };
  const pendente = (): Member => ({
    id: "mem_convidado_pendente",
    workspaceId: state.workspace.id,
    invitedIdentity: { type: "email", value: "novo@exemplo.com" },
    displayName: "novo@exemplo.com",
    state: "pendente",
    roleId: "role_mem",
    invitedBy: PROPRIETARIO,
    availability: { value: "indisponivel", at: new Date().toISOString(), origin: "membro" },
    userMemory: { enabled: true, items: [] },
  });
  const concessao = (listId: string, membroId: string, acao: "administrar" | "ver") => ({
    id: `gr_teste_${acao}_${listId}_${membroId}`,
    workspaceId: state.workspace.id,
    subjectKind: "member" as const,
    subjectId: membroId,
    action: acao,
    resourceType: "list",
    resourceId: listId,
    scope: "subarvore" as const,
    origin: "concessaoDireta" as const,
    grantedBy: PROPRIETARIO,
    grantedAt: new Date().toISOString(),
  });
  const tarefaComLink = (): Task => {
    const t = state.tasks.find((x) => x.publicShare !== undefined);
    if (!t) throw new Error("o seed precisa de uma Tarefa com link público");
    return t;
  };
  const formularioDoSeed = (): Form => {
    const f = state.forms[0];
    if (!f) throw new Error("o seed precisa de um Formulário");
    return f;
  };

  it("a Memória de Usuário de outro Membro chega vazia (com o enabled dele); a própria chega com os itens", () => {
    expect(membroDe(state, PROPRIETARIO).userMemory.items.length).toBeGreaterThan(0);
    const deOutro = membroDe(visibilidadePara(state, COMUM).estado, PROPRIETARIO);
    expect(deOutro.userMemory).toEqual({ enabled: membroDe(state, PROPRIETARIO).userMemory.enabled, items: [] });
    const propria = membroDe(visibilidadePara(state, PROPRIETARIO).estado, PROPRIETARIO);
    expect(propria.userMemory.items).toHaveLength(membroDe(state, PROPRIETARIO).userMemory.items.length);
    // O Proprietário também não lê a Memória de outro (a regra é por dono, não por Papel).
    state.members[state.members.findIndex((m) => m.id === COMUM)]!.userMemory.items.push({
      id: "umi_teste",
      content: "segredo da Júlia",
      origin: { kind: "membro" },
      createdAt: new Date().toISOString(),
      state: "ativo",
    });
    expect(JSON.stringify(visibilidadePara(state, PROPRIETARIO).estado.members)).not.toContain("segredo da Júlia");
    expect(JSON.stringify(visibilidadePara(state, COMUM).estado.members)).toContain("segredo da Júlia");
  });

  it("o e-mail de um convite pendente só chega a Administrador e Proprietário; os demais veem 'Convite pendente'", () => {
    state.members.push(pendente());
    const comum = membroDe(visibilidadePara(state, COMUM).estado, "mem_convidado_pendente");
    expect("invitedIdentity" in comum).toBe(false);
    expect(comum.displayName).toBe("Convite pendente");
    expect(JSON.stringify(visibilidadePara(state, COMUM).estado.members)).not.toContain("novo@exemplo.com");
    for (const quem of [ADMIN, PROPRIETARIO]) {
      const m = membroDe(visibilidadePara(state, quem).estado, "mem_convidado_pendente");
      expect(m.invitedIdentity).toEqual({ type: "email", value: "novo@exemplo.com" });
      expect(m.displayName).toBe("novo@exemplo.com");
    }
    // Quem está ativo não é escondido: só o pendente vira "Convite pendente".
    expect(membroDe(visibilidadePara(state, COMUM).estado, ADMIN).displayName).toBe(membroDe(state, ADMIN).displayName);
  });

  it("a Visão pessoal de outro Membro não chega (id em ocultos); a própria e a de contêiner chegam", () => {
    const base = { kind: "lista", listId: CP.listId, filters: {}, isDefault: false, createdBy: PROPRIETARIO, createdAt: new Date().toISOString() } as const;
    const deOutro: View = { ...base, id: "viw_do_dono", name: "Do dono", ownerKind: "member", ownerId: PROPRIETARIO };
    const propria: View = { ...base, id: "viw_da_julia", name: "Da Júlia", ownerKind: "member", ownerId: COMUM };
    const compartilhada: View = { ...base, id: "viw_do_conteiner", name: "Do contêiner", ownerKind: "container", ownerId: CP.listId };
    state.views.push(deOutro, propria, compartilhada);
    const { estado, ocultos } = visibilidadePara(state, COMUM);
    const ids = estado.views.map((v) => v.id);
    expect(ids).not.toContain("viw_do_dono");
    expect(ocultos.has("viw_do_dono")).toBe(true);
    expect(ids).toEqual(expect.arrayContaining(["viw_da_julia", "viw_do_conteiner"]));
    expect(ocultos.has("viw_da_julia")).toBe(false);
  });

  it("o segredo do link público de uma Tarefa some para quem não administra a Lista; a chave fica e o resto também", () => {
    const tarefa = tarefaComLink();
    expect(visibilidadePara(state, COMUM).ocultos.has(tarefa.id)).toBe(false);
    const veio = visibilidadePara(state, COMUM).estado.tasks.find((t) => t.id === tarefa.id);
    expect(veio?.publicShare).toBeDefined();
    expect(veio?.publicShare?.secret).toBe("");
    expect(veio?.publicShare?.active).toBe(tarefa.publicShare?.active);
    expect(veio?.publicShare?.showsAttachments).toBe(tarefa.publicShare?.showsAttachments);
    expect(JSON.stringify(visibilidadePara(state, COMUM).estado.tasks)).not.toContain(tarefa.publicShare!.secret);
    // Quem administra o Espaço de Trabalho e alcança a Lista recebe o segredo.
    expect(visibilidadePara(state, ADMIN).estado.tasks.find((t) => t.id === tarefa.id)?.publicShare?.secret).toBe(tarefa.publicShare?.secret);
    // E quem tem a concessão direta de administrar a Lista também.
    state.grants.push(concessao(tarefa.listId, COMUM, "administrar"));
    expect(visibilidadePara(state, COMUM).estado.tasks.find((t) => t.id === tarefa.id)?.publicShare?.secret).toBe(tarefa.publicShare?.secret);
  });

  it("o segredo do Formulário chega a quem administra a Lista, vem vazio a quem só a alcança, e o de Lista oculta não chega", () => {
    const form = formularioDoSeed();
    expect(visibilidadePara(state, PROPRIETARIO).estado.forms.find((f) => f.id === form.id)?.secret).toBe(form.secret);
    const alcancado = visibilidadePara(state, COMUM);
    expect(alcancado.ocultos.has(form.id)).toBe(false);
    expect(alcancado.estado.forms.find((f) => f.id === form.id)?.secret).toBe("");
    expect(JSON.stringify(alcancado.estado.forms)).not.toContain(form.secret);
    // Formulário de uma Lista privada que o Membro não alcança: fora, com o id em ocultos.
    const doFinanceiro: Form = { ...form, id: "frm_gestao", listId: CP.listId, secret: "segredo-da-gestao" };
    state.forms.push(doFinanceiro);
    const quemNaoAlcanca = visibilidadePara(state, semGestao());
    expect(quemNaoAlcanca.estado.forms.some((f) => f.id === "frm_gestao")).toBe(false);
    expect(quemNaoAlcanca.ocultos.has("frm_gestao")).toBe(true);
    expect(JSON.stringify(quemNaoAlcanca.estado)).not.toContain("segredo-da-gestao");
  });

  it("recortarRegistro('tasks'/'forms'/'members') aplica a mesma regra a um registro solto; coleção sem regra volta intacta", () => {
    const tarefa = tarefaComLink();
    expect(recortarRegistro("tasks", tarefa, state, COMUM).publicShare?.secret).toBe("");
    expect(recortarRegistro("tasks", tarefa, state, PROPRIETARIO)).toBe(tarefa);
    const form = formularioDoSeed();
    expect(recortarRegistro("forms", form, state, COMUM).secret).toBe("");
    const dono = membroDe(state, PROPRIETARIO);
    expect(recortarRegistro("members", dono, state, COMUM).userMemory.items).toEqual([]);
    const canal = { id: "ch_1", nome: "Canal projetado" };
    expect(recortarRegistro("channels", canal, state, COMUM)).toBe(canal);
  });

  it("nunca muta o estado inteiro", () => {
    state.members.push(pendente());
    state.forms.push({ ...formularioDoSeed(), id: "frm_gestao", listId: CP.listId, secret: "segredo-da-gestao" });
    const antes = structuredClone(state);
    visibilidadePara(state, COMUM);
    visibilidadePara(state, ADMIN);
    expect(state).toEqual(antes);
  });
});

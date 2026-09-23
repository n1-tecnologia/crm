/**
 * `alterarStatusEmLote` — a prova em memória do critério 5 do ROADMAP
 * (PAG-05): 61 fechamentos num só gesto, A1 disparando uma vez por
 * fechamento, a recusa de um item não derrubando os outros, e a reexecução
 * do MESMO lote não mexendo em nada.
 *
 * Molde de `contas-a-receber.test.ts`/`recorrencia-contas-a-pagar.test.ts`:
 * `beforeEach` com `buildSeed()`, helper `conta(id)` que lança se não achar.
 * Os casos `(a)`…`(k)` seguem a numeração do bloco `<behavior>` de
 * `03-12-PLAN.md`. Fixtures inventadas — nenhum CPF, CNPJ, chave Pix ou
 * código de barras real entra no repositório.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import { memberSeesTask } from "../derive";
import type { DataState } from "../state";
import type { Grant, Task } from "../types";
import { setRecurrence } from "./collaboration";
import { CP, CR } from "./financeiro";
import { alterarStatusEmLote, LIMITE_DO_LOTE } from "./lote";
import { changeTaskStatus, createTask, setTaskFieldValue } from "./tasks";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const conta = (id: string): Task => {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) throw new Error(`sem ${id}`);
  return t;
};

const nascidasDe = (sourceId: string): Task[] =>
  state.tasks.filter((t) => t.provenance?.kind === "recurrence" && t.provenance.sourceId === sourceId);

/** A mesma regra do seed (`recorrente()`, dia útil anterior) — mensal, transferida ao fechar. */
const REGRA_MENSAL = {
  frequency: "mensal" as const,
  interval: 1,
  triggerMode: "aoConcluir" as const,
  businessDays: "anterior" as const,
  copies: { checklists: false, subtasks: false, assignees: false, fieldValues: true },
};

/**
 * Três vencimentos que travam D3-06/D3-07 por par exato de data (os mesmos de
 * `recorrencia-contas-a-pagar.test.ts`), e um quarto que só serve de volume:
 * o índice 0 satura e recua (D3-07), o 1 é domingo (D3-06), o 2 é sábado
 * (D3-06), os demais são um dia de semana comum que não se move.
 */
function vencimentoPorIndice(indice: number): string {
  if (indice === 0) return "2026-01-31";
  if (indice === 1) return "2026-10-15";
  if (indice === 2) return "2026-02-07";
  return "2026-02-05";
}

/** `n` contas recorrentes já em `statusId` (padrão: `em autorização bancária`), com vencimento conhecido. */
function semearRecorrentes(n: number, statusId: string = CP.status.emAutorizacao): string[] {
  const ids: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const criado = createTask(
      state,
      CP.financeiroId,
      {
        listId: CP.listId,
        title: `Conta em lote ${i + 1}`,
        statusId,
        taskTypeId: CP.taskTypeId,
        dueDate: { form: "civilDay", value: vencimentoPorIndice(i) },
      },
      { runAutomations: false },
    );
    if (!criado.ok) throw new Error(`falha ao semear conta ${i}: ${criado.error}`);
    const r = setRecurrence(state, CP.financeiroId, criado.value.id, REGRA_MENSAL);
    // Se a Lista recusasse Recorrência, isso é defeito a denunciar, não a contornar.
    if (!r.ok) throw new Error(`falha ao definir recorrência da conta ${i}: ${r.error}`);
    ids.push(criado.value.id);
  }
  return ids;
}

describe("alterarStatusEmLote — PAG-05, critério 5", () => {
  it("(a) 61 fechamentos, 61 ocorrências, cada uma com o vencimento exato de D3-06/D3-07", () => {
    const ids = semearRecorrentes(61);
    const tasksAntes = state.tasks.length;
    const recorrentesAntes = state.tasks.filter((t) => t.provenance?.kind === "recurrence").length;

    const r = alterarStatusEmLote(state, CP.aprovadorId, ids, CP.status.pago);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("sem relatório");

    expect(r.value.alteradas).toBe(61);
    expect(r.value.jaEstavam).toBe(0);
    expect(r.value.recusadas).toBe(0);
    expect(r.value.parciais).toBe(0);
    expect(r.value.ocorrenciasCriadas).toBe(61);
    expect(r.value.itens).toHaveLength(61);
    expect(state.tasks.length - tasksAntes).toBe(61);
    expect(state.tasks.filter((t) => t.provenance?.kind === "recurrence").length - recorrentesAntes).toBe(61);

    for (const id of ids) {
      expect(conta(id).recurrence).toBeUndefined();
      expect(nascidasDe(id)).toHaveLength(1);
    }

    // (c) — o vencimento das ocorrências é o par exato que D3-06/D3-07 travam.
    expect(nascidasDe(ids[0]!)[0]?.dueDate?.value).toBe("2026-02-27");
    expect(nascidasDe(ids[1]!)[0]?.dueDate?.value).toBe("2026-11-13");
    expect(nascidasDe(ids[2]!)[0]?.dueDate?.value).toBe("2026-03-06");
  });

  it("(b) reexecução é inócua (T-3-46) — sem alterar Tarefas, Atividade nem Execuções de Automação", () => {
    const ids = semearRecorrentes(61);

    const primeira = alterarStatusEmLote(state, CP.aprovadorId, ids, CP.status.pago);
    expect(primeira.ok, primeira.ok ? "" : primeira.error).toBe(true);

    const tasksDepoisDaPrimeira = state.tasks.length;
    const activityDepoisDaPrimeira = state.activity.length;
    const execucoesDepoisDaPrimeira = state.automationExecutions.length;

    const segunda = alterarStatusEmLote(state, CP.aprovadorId, ids, CP.status.pago);
    expect(segunda.ok, segunda.ok ? "" : segunda.error).toBe(true);
    if (!segunda.ok) throw new Error("sem relatório");

    expect(segunda.value.alteradas).toBe(0);
    expect(segunda.value.jaEstavam).toBe(61);
    expect(segunda.value.ocorrenciasCriadas).toBe(0);
    expect(state.tasks.length).toBe(tasksDepoisDaPrimeira);
    expect(state.activity.length).toBe(activityDepoisDaPrimeira);
    expect(state.automationExecutions.length).toBe(execucoesDepoisDaPrimeira);
  });

  it("(d) falha parcial não derruba o lote — uma recusa entre 61 não impede as outras 60", () => {
    const ids = semearRecorrentes(61);
    const incompleta = ids[5]!;
    // Volta para "para pagar" com Centro de Custo preenchido, mas sem Valor nem Forma de pagamento.
    expect(changeTaskStatus(state, CP.financeiroId, incompleta, CP.status.paraPagar).ok).toBe(true);
    expect(setTaskFieldValue(state, CP.financeiroId, incompleta, CP.fields.centroDeCusto, "TRIA").ok).toBe(true);

    const r = alterarStatusEmLote(state, CP.aprovadorId, ids, CP.status.pago);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("sem relatório");

    expect(r.value.alteradas).toBe(60);
    expect(r.value.recusadas).toBe(1);
    expect(r.value.ocorrenciasCriadas).toBe(60);
    const item = r.value.itens.find((i) => i.taskId === incompleta);
    expect(item?.resultado).toBe("recusada");
    expect(item?.motivo).toMatch(/^Para sair de/);
    expect(item?.motivo).toContain("Valor");
    expect(item?.motivo).toContain("Forma de pagamento");
  });

  it("(e) a aritmética do relatório fecha, na primeira chamada e na reexecução", () => {
    const ids = semearRecorrentes(10);

    const r = alterarStatusEmLote(state, CP.aprovadorId, ids, CP.status.pago);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("sem relatório");
    expect(r.value.solicitadas).toBe(r.value.alteradas + r.value.jaEstavam + r.value.recusadas + r.value.parciais);
    expect(r.value.itens.length).toBe(r.value.solicitadas);
    expect(r.value.ocorrenciasCriadas).toBe(r.value.itens.filter((i) => i.ocorrenciaCriadaId).length);

    const segunda = alterarStatusEmLote(state, CP.aprovadorId, ids, CP.status.pago);
    expect(segunda.ok, segunda.ok ? "" : segunda.error).toBe(true);
    if (!segunda.ok) throw new Error("sem relatório");
    expect(segunda.value.solicitadas).toBe(
      segunda.value.alteradas + segunda.value.jaEstavam + segunda.value.recusadas + segunda.value.parciais,
    );
    expect(segunda.value.itens.length).toBe(segunda.value.solicitadas);
  });

  it("(f) ator errado não fecha nada (RN-CP-04, T-3-45)", () => {
    const ids = semearRecorrentes(61);
    const tasksAntes = state.tasks.length;
    const activityAntes = state.activity.length;

    const r = alterarStatusEmLote(state, CP.financeiroId, ids, CP.status.pago);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("sem relatório");

    expect(r.value.recusadas).toBe(61);
    expect(r.value.alteradas).toBe(0);
    expect(r.value.ocorrenciasCriadas).toBe(0);
    expect(state.tasks.length).toBe(tasksAntes);
    expect(state.activity.length).toBe(activityAntes);
    expect(r.value.itens.every((i) => i.motivo?.includes("Marcos Paulo"))).toBe(true);
  });

  it("(g) quem não enxerga não muda, item a item (T-3-45)", () => {
    const ids = semearRecorrentes(5);
    // Pré-condição explícita: nenhuma destas contas tem o Campo Pessoa preenchido com Pedro.
    for (const id of ids) {
      expect(memberSeesTask(state, "mem_thiago_pereira", id)).toBe(false);
    }
    const tasksAntes = state.tasks.length;

    const r = alterarStatusEmLote(state, "mem_thiago_pereira", ids, CP.status.pago);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("sem relatório");

    expect(r.value.recusadas).toBe(5);
    expect(r.value.alteradas).toBe(0);
    expect(state.tasks.length).toBe(tasksAntes);
    for (const item of r.value.itens) {
      expect(item.titulo).toBeUndefined();
      expect(item.readableId).toBeUndefined();
    }
  });

  it("(g.2) num lote misto — metade visível por concessão direta, metade não — só a metade visível muda", () => {
    const ids = semearRecorrentes(2);
    const [visivel, invisivel] = ids as [string, string];
    const grant: Grant = {
      id: "gr_teste_lote_julia",
      workspaceId: state.workspace.id,
      subjectKind: "member",
      subjectId: "mem_julia",
      action: "editar",
      resourceType: "task",
      resourceId: visivel,
      scope: "subarvore",
      origin: "concessaoDireta",
      grantedBy: CP.financeiroId,
      grantedAt: new Date().toISOString(),
    };
    state.grants.push(grant);
    expect(memberSeesTask(state, "mem_julia", visivel)).toBe(true);
    expect(memberSeesTask(state, "mem_julia", invisivel)).toBe(false);

    // "em remessa bancária" não tem `entryAllowedMemberIds`: qualquer Membro
    // com acesso de escrita à Tarefa pode mover — o que está sob prova aqui
    // é a visibilidade item a item, não RN-CP-04.
    const r = alterarStatusEmLote(state, "mem_julia", ids, CP.status.emRemessa);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("sem relatório");

    const itemVisivel = r.value.itens.find((i) => i.taskId === visivel);
    const itemInvisivel = r.value.itens.find((i) => i.taskId === invisivel);
    expect(itemVisivel?.resultado).toBe("alterada");
    expect(itemInvisivel?.resultado).toBe("recusada");
    expect(itemInvisivel?.titulo).toBeUndefined();
  });

  it("(h) guardas do gesto — lista vazia, acima do limite, id repetido", () => {
    const tasksAntes = state.tasks.length;
    const activityAntes = state.activity.length;

    const vazio = alterarStatusEmLote(state, CP.financeiroId, [], CP.status.pago);
    expect(vazio.ok).toBe(false);

    const quantidadeAcimaDoLimite = LIMITE_DO_LOTE + 1;
    const acimaDoLimite = alterarStatusEmLote(
      state,
      CP.financeiroId,
      Array.from({ length: quantidadeAcimaDoLimite }, (_, i) => `tsk_falso_${i}`),
      CP.status.pago,
    );
    expect(acimaDoLimite.ok).toBe(false);
    if (!acimaDoLimite.ok) {
      expect(acimaDoLimite.error).toContain(String(LIMITE_DO_LOTE));
      expect(acimaDoLimite.error).toContain(String(quantidadeAcimaDoLimite));
    }

    const repetido = alterarStatusEmLote(state, CP.financeiroId, ["tsk_a", "tsk_a"], CP.status.pago);
    expect(repetido.ok).toBe(false);

    expect(state.tasks.length).toBe(tasksAntes);
    expect(state.activity.length).toBe(activityAntes);
  });

  it("(i) status fora do Conjunto de Status efetivo da Lista (T-3-50) — sem guarda nova no lote", () => {
    const ids = semearRecorrentes(1);
    const r = alterarStatusEmLote(state, CP.financeiroId, ids, CR.status.recebido);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("sem relatório");

    expect(r.value.recusadas).toBe(1);
    expect(r.value.itens[0]?.resultado).toBe("recusada");
    expect(r.value.itens[0]?.motivo).toBe("Este status não pertence ao Conjunto de Status efetivo desta Lista.");
  });

  it("(j) Registro consolidado (T-3-48) — um só, com contagens, sem título de Tarefa", () => {
    const ids = semearRecorrentes(61);
    const consolidados = () =>
      state.activity.filter((a) => a.action === "Status alterado em lote" && a.objectType === "list" && a.objectId === CP.listId);
    const statusAlteradoIndividual = () => state.activity.filter((a) => a.action === "Status alterado" && ids.includes(a.objectId));

    const primeira = alterarStatusEmLote(state, CP.aprovadorId, ids, CP.status.pago);
    expect(primeira.ok, primeira.ok ? "" : primeira.error).toBe(true);

    expect(consolidados()).toHaveLength(1);
    const registro = consolidados()[0]!;
    expect(registro.detail).toContain("61 alterada(s)");
    for (const id of ids) {
      const titulo = conta(id).title;
      expect(registro.detail?.includes(titulo)).toBe(false);
      expect(registro.objectName?.includes(titulo)).toBe(false);
    }
    expect(statusAlteradoIndividual()).toHaveLength(61);

    const segunda = alterarStatusEmLote(state, CP.aprovadorId, ids, CP.status.pago);
    expect(segunda.ok, segunda.ok ? "" : segunda.error).toBe(true);
    expect(consolidados()).toHaveLength(1);
  });

  it("(k) achado a pinar, não a corrigir: RN-CP-05 × isTerminalCategory — lote para 'negado' cria ocorrências hoje", () => {
    const ids = semearRecorrentes(3);
    const r = alterarStatusEmLote(state, CP.financeiroId, ids, CP.status.negado);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("sem relatório");

    // RN-CP-05 diz que "aprovado"/"negado" não disparam recorrência; o código
    // trata os dois como `concluido` (`isTerminalCategory`), então A1 dispara
    // assim mesmo. Pinado aqui — corrigir mexeria em `derive.ts`/`tasks.ts`,
    // fora deste plano (ver `<verification>` de `03-12-PLAN.md`).
    expect(r.value.alteradas).toBe(3);
    expect(r.value.ocorrenciasCriadas).toBe(3);
  });
});

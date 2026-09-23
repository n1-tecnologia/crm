/**
 * O relatório do Ensaio de D3-03 (Plan 03-14, Task 3) — no molde de
 * `../importacao/clickup/importar-contas-a-pagar.test.ts`: casos PUROS
 * (a)-(h) rodam sempre, sobre `ResultadoDaConferencia` sintéticos (nunca
 * precisam de `DataState`/Postgres — `agregar`/`renderizar` não tocam
 * nenhum dos dois); o caso (i), contra `plataforma.automacao_agenda` de
 * verdade, pula sem `DATABASE_URL` (DEC-09).
 *
 * A regra de acerto (`compararEnsaio`) já foi provada em
 * `packages/dominio/src/operations/ensaio-do-agente.test.ts` (Task 1) — este
 * arquivo prova a AGREGAÇÃO, a RENDERIZAÇÃO e a COBERTURA POR DIA, não a
 * regra de novo.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { addTaskComment, createTask, setTaskFieldValue } from "@n1/dominio/operations/tasks";
import { CP, DE_PARA_DO_PROTOTIPO, LIMIAR_DA_CANETA, compararEnsaio, runLancamentoAgent, textoDoLancamentoHumano, type ResultadoDaConferencia, type VereditoDaConferencia } from "@n1/dominio/operations/financeiro";
import type { DataState } from "@n1/dominio";
import { CODIGOS_DA_AGENDA } from "../automacoes/scheduler-worker";
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { agregar, coberturaDaJanela, renderizar, type Cobertura } from "./ensaio-do-agente";

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;

/* ═══════════════════════ Fixtures puras — sem DataState, sem banco ═══════════════════════ */

const TRIPLA_A = { conta: "TRIA", categoria: "Impostos e taxas", codigo: "2.06.01" };

function resultado(
  overrides: { readonly taskId: string; readonly veredito: VereditoDaConferencia } & Partial<Omit<ResultadoDaConferencia, "taskId" | "veredito">>,
): ResultadoDaConferencia {
  return { semTagDeConta: false, nomeDaCategoriaDiverge: false, ...overrides };
}

/** Um dia só, `medido` — o suficiente para `agregar` não sair `INCONCLUSIVO` por cobertura em testes que não são sobre cobertura. */
const COBERTURA_TRIVIAL: Cobertura = {
  janela: { de: "2031-01-01", ate: "2031-01-01" },
  dias: [{ dia: "2031-01-01", classificacao: "medido" }],
  diasSemMedicao: 0,
};

describe("agregar — pura (a)", () => {
  it("roda sem DATABASE_URL, sem tocar banco, disco ou relógio", () => {
    const relatorio = agregar([resultado({ taskId: "tsk_1", veredito: "confere", agente: TRIPLA_A, humano: TRIPLA_A })], COBERTURA_TRIVIAL, LIMIAR_DA_CANETA);
    expect(["CONCEDER", "ADIAR", "INCONCLUSIVO"]).toContain(relatorio.veredito);
    expect(relatorio.totalResultados).toBe(1);
  });
});

describe("recusa_correta fora do denominador (b)", () => {
  it("10 pares (4 recusa_correta + 6 confere) ⇒ acerto de código 100% sobre denominador 6, e taxa de recusa 40% — nunca 60%", () => {
    const resultados: ResultadoDaConferencia[] = [
      ...Array.from({ length: 4 }, (_, i) => resultado({ taskId: `tsk_recusa_${i}`, veredito: "recusa_correta" })),
      ...Array.from({ length: 6 }, (_, i) => resultado({ taskId: `tsk_confere_${i}`, veredito: "confere", agente: TRIPLA_A, humano: TRIPLA_A })),
    ];
    const relatorio = agregar(resultados, COBERTURA_TRIVIAL, LIMIAR_DA_CANETA);

    expect(relatorio.acertoDeCodigo).toEqual({ n: 6, denominador: 6, taxa: 1 });
    expect(relatorio.taxaDeRecusa).toEqual({ n: 4, denominador: 10, taxa: 0.4 });

    const { markdown, json } = renderizar(relatorio);
    expect(markdown).toContain("100.0% (6/6)");
    expect(markdown).toContain("40.0% (4/10)");
    expect(JSON.parse(json).taxaDeRecusa.taxa).toBe(0.4);
  });
});

describe("renderizar — todo percentual carrega o seu denominador (c)", () => {
  it("nenhuma linha com '%' aparece sem um par (n/d) na mesma linha", () => {
    const resultados: ResultadoDaConferencia[] = [
      resultado({ taskId: "tsk_1", veredito: "confere", agente: TRIPLA_A, humano: TRIPLA_A }),
      resultado({ taskId: "tsk_2", veredito: "diverge_conta", agente: TRIPLA_A, humano: { conta: "KOPS", categoria: "Impostos e taxas", codigo: "2.06.01" } }),
      resultado({ taskId: "tsk_3", veredito: "diverge_categoria", agente: TRIPLA_A, humano: { conta: "TRIA", categoria: "Comissões", codigo: "2.02.03" } }),
      resultado({ taskId: "tsk_4", veredito: "recusa_correta" }),
      resultado({ taskId: "tsk_5", veredito: "sem_lancamento_humano" }),
      resultado({ taskId: "tsk_6", veredito: "nao_medivel" }),
    ];
    const relatorio = agregar(resultados, COBERTURA_TRIVIAL, LIMIAR_DA_CANETA, { credenciaisOmieOk: true });
    const { markdown } = renderizar(relatorio);

    for (const linha of markdown.split("\n")) {
      if (linha.includes("%")) expect(linha, `linha sem denominador: "${linha}"`).toMatch(/\(\d+\/\d+\)/);
    }
  });
});

describe("INCONCLUSIVO por dia sem medição (d)", () => {
  it("um dia sem medição na janela ⇒ INCONCLUSIVO, sem nenhuma taxa impressa", () => {
    const coberturaComFalha: Cobertura = {
      janela: { de: "2031-01-01", ate: "2031-01-02" },
      dias: [
        { dia: "2031-01-01", classificacao: "medido" },
        { dia: "2031-01-02", classificacao: "sem_agenda" },
      ],
      diasSemMedicao: 1,
    };
    const relatorio = agregar([resultado({ taskId: "tsk_1", veredito: "confere", agente: TRIPLA_A, humano: TRIPLA_A })], coberturaComFalha, LIMIAR_DA_CANETA);
    expect(relatorio.veredito).toBe("INCONCLUSIVO");
    expect(relatorio.motivo).toMatch(/dia\(s\) sem medição/);

    const { markdown, json } = renderizar(relatorio);
    expect(markdown).not.toContain("## ACERTO");
    expect(markdown).not.toMatch(/\d\.\d%/);
    expect(JSON.parse(json).veredito).toBe("INCONCLUSIVO");
  });
});

describe("INCONCLUSIVO por viés de seleção (e)", () => {
  it("sem_lancamento_humano acima de 20% dos Ensaios ⇒ INCONCLUSIVO, nomeando o viés", () => {
    // 10 Ensaios totais (nenhum sem_ensaio no denominador): 3 sem_lancamento_humano (30%, acima do teto de 20%) + 7 confere.
    const resultados: ResultadoDaConferencia[] = [
      ...Array.from({ length: 3 }, (_, i) => resultado({ taskId: `tsk_slh_${i}`, veredito: "sem_lancamento_humano" })),
      ...Array.from({ length: 7 }, (_, i) => resultado({ taskId: `tsk_c_${i}`, veredito: "confere", agente: TRIPLA_A, humano: TRIPLA_A })),
    ];
    const relatorio = agregar(resultados, COBERTURA_TRIVIAL, LIMIAR_DA_CANETA);
    expect(relatorio.veredito).toBe("INCONCLUSIVO");
    expect(relatorio.taxaDeSemLancamentoHumano).toEqual({ n: 3, denominador: 10, taxa: 0.3 });
    expect(relatorio.motivo).toMatch(/viés de seleção/);
  });
});

describe("Os sete portões (f)", () => {
  const paresPerfeitos: ResultadoDaConferencia[] = Array.from({ length: 25 }, (_, i) => resultado({ taskId: `tsk_${i}`, veredito: "confere", agente: TRIPLA_A, humano: TRIPLA_A }));

  it("G7 sai PENDENTE sem --credenciais-omie=ok, e OK com ele; CONCEDER só quando os sete passam", () => {
    const semCredenciais = agregar(paresPerfeitos, COBERTURA_TRIVIAL, LIMIAR_DA_CANETA);
    const g7Sem = semCredenciais.portoes.find((p) => p.id === "G7");
    expect(g7Sem?.medido).toBe("PENDENTE");
    expect(g7Sem?.passou).toBe(false);
    expect(semCredenciais.veredito).toBe("ADIAR");

    const comCredenciais = agregar(paresPerfeitos, COBERTURA_TRIVIAL, LIMIAR_DA_CANETA, { credenciaisOmieOk: true });
    const g7Com = comCredenciais.portoes.find((p) => p.id === "G7");
    expect(g7Com?.medido).toBe("OK");
    expect(g7Com?.passou).toBe(true);
    expect(comCredenciais.veredito).toBe("CONCEDER");
    expect(comCredenciais.portoes.every((p) => p.passou)).toBe(true);
  });

  it("ADIAR quando algum portão falha (menos de 20 pares ⇒ G1)", () => {
    const poucosPares = paresPerfeitos.slice(0, 5);
    const relatorio = agregar(poucosPares, COBERTURA_TRIVIAL, LIMIAR_DA_CANETA, { credenciaisOmieOk: true });
    expect(relatorio.portoes.find((p) => p.id === "G1")?.passou).toBe(false);
    expect(relatorio.veredito).toBe("ADIAR");
    expect(relatorio.motivo).toContain("G1");
  });
});

describe("G4 é independente da taxa global (g)", () => {
  it("40 pares (39 confere + 1 diverge_conta com semTagDeConta) ⇒ G4 falha e o veredito é ADIAR, mesmo com taxa global alta", () => {
    const resultados: ResultadoDaConferencia[] = [
      ...Array.from({ length: 39 }, (_, i) => resultado({ taskId: `tsk_ok_${i}`, veredito: "confere", agente: TRIPLA_A, humano: TRIPLA_A })),
      resultado({
        taskId: "tsk_sem_tag",
        veredito: "diverge_conta",
        semTagDeConta: true,
        agente: TRIPLA_A,
        humano: { conta: "KOPS", categoria: "Impostos e taxas", codigo: "2.06.01" },
      }),
    ];
    const relatorio = agregar(resultados, COBERTURA_TRIVIAL, LIMIAR_DA_CANETA, { credenciaisOmieOk: true });
    expect(relatorio.paresMensuraveis).toBe(40);
    expect(relatorio.portoes.find((p) => p.id === "G4")?.passou).toBe(false);
    expect(relatorio.semTagDeConta).toEqual({ total: 1, conferiu: 0, divergiuConta: 1 });
    expect(relatorio.veredito).toBe("ADIAR");
  });
});

describe("T-3-65 — o relatório versionado não vaza (h)", () => {
  let state: DataState;

  beforeEach(() => {
    state = buildSeed();
  });

  it("markdown e json não contêm título, CNPJ, chave Pix, valor formatado nem taskId — sobre uma Tarefa de fixture com todos preenchidos", () => {
    const tarefa = state.tasks.find((t) => t.id === "tsk_cp_das");
    if (!tarefa) throw new Error("sem tsk_cp_das");
    // `tsk_cp_das` já nasce com título, CNPJ e valor (`seed-financeiro.ts`); a chave Pix é injetada aqui para reforçar o caso, mesmo fora do molde "Boleto" desta Tarefa.
    const comPix = setTaskFieldValue(state, CP.financeiroId, tarefa.id, CP.fields.chavePix, "pix-secreta-99999-teste-h");
    expect(comPix.ok, comPix.ok ? "" : comPix.error).toBe(true);

    const ensaio = runLancamentoAgent(state, CP.financeiroId, CP.agentId, tarefa.id, "aut_cp_a7", {
      dePara: { contaPorTag: { "conta tria": "TRIA" }, categoriaPorCampo: { Impostos: { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01" } }, origem: "omie" },
      rehearsal: true,
    });
    expect(ensaio.ok, ensaio.ok ? "" : ensaio.error).toBe(true);

    // Código humano DIVERGENTE do que o Agente ensaiou, para que `divergenciasDeCodigo` seja exercitada — e mostrar que nem ela vaza dado sensível (só carrega os dois códigos do plano de contas).
    const humano = addTaskComment(state, CP.financeiroId, tarefa.id, { content: textoDoLancamentoHumano({ conta: "TRIA", categoria: "Impostos e taxas", codigo: "9.99.99" }) });
    expect(humano.ok, humano.ok ? "" : humano.error).toBe(true);

    const resultadoDaConferencia = compararEnsaio(state, tarefa);
    if (!resultadoDaConferencia) throw new Error("sem ResultadoDaConferencia");
    expect(resultadoDaConferencia.veredito).toBe("diverge_categoria");

    const relatorio = agregar([resultadoDaConferencia], COBERTURA_TRIVIAL, LIMIAR_DA_CANETA, { credenciaisOmieOk: true });
    const { markdown, json } = renderizar(relatorio);

    for (const saida of [markdown, json]) {
      expect(saida).not.toContain(tarefa.title); // "DAS — Simples Nacional"
      expect(saida).not.toContain("11.222.333/0001-81"); // CNPJ da fixture
      expect(saida).not.toContain("pix-secreta-99999-teste-h"); // chave Pix
      expect(saida).not.toContain("66267"); // valor (66267.5) — qualquer forma de formatação
      expect(saida).not.toMatch(/tsk_/); // nenhum id de Tarefa
    }
    // O par de código agregado é esperado e não é vazamento (T-3-65 permite `<código> → <código>`).
    expect(markdown).toContain("2.06.01 → 9.99.99");
  });
});

/* ═══════════════════════ (i) Postgres real (DEC-09) ═══════════════════════ */

const RUN = `ensaiorelatorio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const WORKSPACE = `ws_${RUN}`;

const DIA_SEM_AGENDA = "2031-04-01";
const DIA_NAO_CONCLUIDO = "2031-04-02";
const DIA_ENSAIO_NAO_LIBERADO = "2031-04-03";
const DIA_ZERO_ENSAIOS = "2031-04-04";
const DIA_MEDIDO = "2031-04-05";

d("coberturaDaJanela — Postgres real (i)", () => {
  afterAll(async () => {
    const cliente = await pool().connect();
    try {
      await cliente.query("delete from plataforma.automacao_agenda where workspace_id = $1", [WORKSPACE]);
    } finally {
      cliente.release();
    }
    await encerrar();
  });

  it("classifica sem_agenda, agenda_nao_concluida, ensaio_primeira_volta_nao_liberado, zero_ensaios_com_candidatas e medido — cinco dias, cinco classificações", async () => {
    const cliente = await pool().connect();
    try {
      await cliente.query(
        `insert into plataforma.automacao_agenda (workspace_id, list_id, dia_civil, estado, last_error_code) values
           ($1, $2, $3, 'processando', null),
           ($1, $2, $4, 'concluido', $5),
           ($1, $2, $6, 'concluido', null),
           ($1, $2, $7, 'concluido', null)`,
        [WORKSPACE, CP.listId, DIA_NAO_CONCLUIDO, DIA_ENSAIO_NAO_LIBERADO, CODIGOS_DA_AGENDA.ENSAIO_PRIMEIRA_VOLTA, DIA_ZERO_ENSAIOS, DIA_MEDIDO],
      );
      // DIA_SEM_AGENDA deliberadamente sem nenhuma linha — é o próprio caso `sem_agenda`.

      const state = buildSeed();

      const candidataZeroEnsaios = createTask(state, CP.financeiroId, {
        listId: CP.listId,
        title: `Candidata de teste (03-14, i) ${RUN} — zero Ensaios`,
        statusId: CP.status.paraPagar,
        dueDate: { form: "civilDay", value: "2031-04-05" }, // um dia depois de DIA_ZERO_ENSAIOS
      });
      expect(candidataZeroEnsaios.ok, candidataZeroEnsaios.ok ? "" : candidataZeroEnsaios.error).toBe(true);
      if (candidataZeroEnsaios.ok) {
        const v = setTaskFieldValue(state, CP.financeiroId, candidataZeroEnsaios.value.id, CP.fields.valor, 100);
        expect(v.ok, v.ok ? "" : v.error).toBe(true);
      }
      // Nenhum Ensaio nasce para esta candidata — é exatamente o que faz o dia sair `zero_ensaios_com_candidatas`.

      const candidataMedida = createTask(state, CP.financeiroId, {
        listId: CP.listId,
        title: `Candidata de teste (03-14, i) ${RUN} — medida`,
        statusId: CP.status.paraPagar,
        dueDate: { form: "civilDay", value: "2031-04-06" }, // um dia depois de DIA_MEDIDO
      });
      expect(candidataMedida.ok, candidataMedida.ok ? "" : candidataMedida.error).toBe(true);
      if (candidataMedida.ok) {
        const v = setTaskFieldValue(state, CP.financeiroId, candidataMedida.value.id, CP.fields.valor, 200);
        expect(v.ok, v.ok ? "" : v.error).toBe(true);

        // O resultado do Ensaio (concluído ou recusado) não importa aqui — só a
        // EXISTÊNCIA de uma `AgentExecution` de sombra naquele dia civil. A
        // Tarefa recém-criada não tem Centro de Custo/Forma de pagamento, então
        // a recusa (`ok: false`) é o caminho esperado; `rehearsal`/`anchor` são
        // gravados de qualquer forma (ver `runLancamentoAgent`, `finish()`).
        runLancamentoAgent(state, CP.financeiroId, CP.agentId, candidataMedida.value.id, "aut_cp_a7", { dePara: DE_PARA_DO_PROTOTIPO, rehearsal: true });
        const execucao = state.agentExecutions.filter((e) => e.anchor?.id === candidataMedida.value.id).at(-1);
        if (!execucao) throw new Error("sem AgentExecution para a candidata medida");
        // Força o dia civil do Ensaio para DIA_MEDIDO (`startedAt` nasce como `now()` real) — meio da tarde UTC cai no mesmo dia civil em America/Sao_Paulo.
        state.agentExecutions = state.agentExecutions.map((e) => (e.id === execucao.id ? { ...e, startedAt: `${DIA_MEDIDO}T15:00:00.000Z` } : e));
      }

      const cobertura = await coberturaDaJanela(cliente, {
        workspaceId: WORKSPACE,
        listId: CP.listId,
        de: DIA_SEM_AGENDA,
        ate: DIA_MEDIDO,
        state,
      });

      const porDia = new Map(cobertura.dias.map((linha) => [linha.dia, linha.classificacao]));
      expect(porDia.get(DIA_SEM_AGENDA)).toBe("sem_agenda");
      expect(porDia.get(DIA_NAO_CONCLUIDO)).toBe("agenda_nao_concluida");
      expect(porDia.get(DIA_ENSAIO_NAO_LIBERADO)).toBe("ensaio_primeira_volta_nao_liberado");
      expect(porDia.get(DIA_ZERO_ENSAIOS)).toBe("zero_ensaios_com_candidatas");
      expect(porDia.get(DIA_MEDIDO)).toBe("medido");
      expect(cobertura.diasSemMedicao).toBe(4);
    } finally {
      cliente.release();
    }
  });
});

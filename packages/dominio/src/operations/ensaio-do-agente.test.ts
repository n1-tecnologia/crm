/**
 * A conferência do Ensaio (D3-03) — o que 03-14 mede é a tripla que o Agente
 * ENSAIOU (`AgentExecution` com `rehearsal: true`, gravada por 03-04) contra
 * a tripla que o humano DE FATO lançou no Omie (um Comentário de prefixo
 * fixo, `PREFIXO_LANCAMENTO_HUMANO`, publicado pelo próprio Financeiro no
 * instante do lançamento — nunca uma leitura de volta do Omie, que exigiria
 * junção aproximada por fornecedor/vencimento/valor).
 *
 * A junção com a Tarefa é sempre pelo id dela, nunca heurística. `REVISAR`
 * (recusa do Agente) é o resultado CORRETO e sai do denominador das taxas —
 * é por isso que o vocabulário de veredito tem oito valores, não dois.
 *
 * Estes testes rodam `runLancamentoAgent` de verdade (não simulam a forma do
 * passo de raciocínio à mão): se o formato que 03-04 grava mudar um
 * caractere, o caso (a) falha em voz alta em vez de o relatório de 03-14
 * emudecer silenciosamente.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Task } from "../types";
import { addTaskComment } from "./tasks";
import {
  CP,
  compararEnsaio,
  contaSemResumo,
  DE_PARA_DO_PROTOTIPO,
  descreverPassoDeDePara,
  lancamentoHumanoDe,
  lerPassoDeDePara,
  LIMIAR_DA_CANETA,
  PREFIXO_LANCAMENTO_HUMANO,
  runLancamentoAgent,
  textoDoLancamentoHumano,
  type DeParaDeLancamento,
  type ResolucaoDeCategoria,
} from "./financeiro";

const A7 = "aut_cp_a7";

let state: DataState;

function conta(id: string): Task {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) throw new Error(`sem ${id}`);
  return t;
}

/** `tsk_cp_das`: "para pagar", Boleto completo, Tag "conta tria" — passa por `erpMissingFields` sem ajuste. */
const das = () => conta("tsk_cp_das");
/** `tsk_cp_trafego`: idem, Categoria "Tráfego Pago", Centro de Custo "Tria Tech". */
const trafego = () => conta("tsk_cp_trafego");

/** Um de-para de UMA entrada — o que a rota de 03-07 devolve por Tarefa. */
function deParaDe(categoria: string, resolucao: ResolucaoDeCategoria, origem: DeParaDeLancamento["origem"] = "omie"): DeParaDeLancamento {
  return { contaPorTag: { "conta tria": "TRIA" }, categoriaPorCampo: { [categoria]: resolucao }, origem };
}

const lancar = (tarefa: Task, opcoes?: Parameters<typeof runLancamentoAgent>[5]) => runLancamentoAgent(state, CP.financeiroId, CP.agentId, tarefa.id, A7, opcoes);

const registrarHumano = (tarefa: Task, l: { readonly conta: string; readonly categoria: string; readonly codigo: string }) =>
  addTaskComment(state, CP.financeiroId, tarefa.id, { content: textoDoLancamentoHumano(l) });

/** `createdAt` é `readonly` no tipo — substitui o objeto no array em vez de mutar a propriedade, só para controlar ordem em teste. */
function forcarCreatedAt(tarefa: Task, commentId: string, iso: string) {
  tarefa.comments = tarefa.comments.map((c) => (c.id === commentId ? { ...c, createdAt: iso } : c));
}

beforeEach(() => {
  state = buildSeed();
});

describe("descreverPassoDeDePara / lerPassoDeDePara: o par escritor/leitor do passo de de-para", () => {
  it("ida e volta pura: o output de um vira o input do outro, sem perda", () => {
    const resumo = { texto: "x", conta: "KOPS", categoria: "Comissões", codigo: "2.02.03", veredito: "resolvida" as const, origem: "omie" as const };
    const passo = descreverPassoDeDePara(resumo, "omie");
    expect(passo).toEqual({ input: "de-para ERP (omie)", output: "Conta KOPS · Comissões · 2.02.03" });
    expect(lerPassoDeDePara(passo)).toEqual({ conta: "KOPS", categoria: "Comissões", codigo: "2.02.03", origem: "omie" });
  });

  it("forma inesperada devolve undefined, nunca um palpite", () => {
    expect(lerPassoDeDePara({ input: "de-para ERP (omie)", output: "formato quebrado" })).toBeUndefined();
    expect(lerPassoDeDePara({ input: "sem parênteses", output: "Conta X · Y · Z" })).toBeUndefined();
    expect(lerPassoDeDePara({ input: "de-para ERP (marciano)", output: "Conta X · Y · Z" })).toBeUndefined();
    expect(lerPassoDeDePara({})).toBeUndefined();
  });

  it("(a) ida e volta contra o `runLancamentoAgent` de verdade: o formato de 03-04 não mudou", () => {
    const tarefa = das();
    const r = lancar(tarefa, { dePara: deParaDe("Impostos", { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01" }), rehearsal: true });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    const execucao = state.agentExecutions.filter((e) => e.anchor?.id === tarefa.id).at(-1);
    if (!execucao) throw new Error("sem AgentExecution");
    const lido = lerPassoDeDePara(execucao.steps[0]);
    expect(lido).toEqual({ conta: "TRIA", categoria: "Impostos e taxas", codigo: "2.06.01", origem: "omie" });
  });
});

describe("lancamentoHumanoDe: onde o humano responde, e só quando é humano (T-3-70)", () => {
  it("(b) um Comentário de Agente com o prefixo é ignorado; o de Membro é lido; dois registros valem o mais recente por createdAt", () => {
    const tarefa = das();
    const doAgente = addTaskComment(state, CP.financeiroId, tarefa.id, {
      content: textoDoLancamentoHumano({ conta: "ERRADO", categoria: "Errado", codigo: "0.00.00" }),
      actor: { kind: "agent", id: CP.agentId },
    });
    expect(doAgente.ok).toBe(true);
    expect(lancamentoHumanoDe(state, tarefa)).toBeUndefined();

    const primeiro = registrarHumano(tarefa, { conta: "TRIA", categoria: "Impostos e taxas", codigo: "2.06.01" });
    expect(primeiro.ok).toBe(true);
    if (primeiro.ok) forcarCreatedAt(tarefa, primeiro.value.id, "2026-01-01T10:00:00.000Z");
    expect(lancamentoHumanoDe(state, tarefa)).toMatchObject({ conta: "TRIA", categoria: "Impostos e taxas", codigo: "2.06.01" });

    const segundo = registrarHumano(tarefa, { conta: "KONQ", categoria: "Aluguel e condomínio", codigo: "2.03.01" });
    expect(segundo.ok).toBe(true);
    if (segundo.ok) forcarCreatedAt(tarefa, segundo.value.id, "2026-01-02T10:00:00.000Z");
    expect(lancamentoHumanoDe(state, tarefa)?.conta).toBe("KONQ");
  });

  it("(c) ida e volta do registro humano: os três valores voltam intactos, inclusive espaços internos no nome da categoria", () => {
    const tarefa = trafego();
    const r = registrarHumano(tarefa, { conta: "TF TRIA", categoria: "Viagens e Hospedagens", codigo: "2.04.05" });
    expect(r.ok).toBe(true);
    const humano = lancamentoHumanoDe(state, tarefa);
    expect(humano).toMatchObject({ conta: "TF TRIA", categoria: "Viagens e Hospedagens", codigo: "2.04.05" });
    expect(humano?.por).toBe(CP.financeiroId);
    expect(humano?.em).toBeDefined();
  });

  it("o prefixo é o contrato: um comentário sem ele não é lido como registro humano", () => {
    const tarefa = das();
    addTaskComment(state, CP.financeiroId, tarefa.id, { content: "Lancei no Omie: Conta TRIA · Impostos e taxas · 2.06.01" });
    expect(lancamentoHumanoDe(state, tarefa)).toBeUndefined();
    expect(PREFIXO_LANCAMENTO_HUMANO).toBe("Lançado no Omie: ");
  });
});

describe("compararEnsaio: o que conta como acerto, e o que não conta nem como acerto nem como erro", () => {
  it("(d) confere: conta e código iguais; diferença só de caixa na conta, ou só no nome da categoria, continuam confere", () => {
    const tarefa = das();
    lancar(tarefa, { dePara: deParaDe("Impostos", { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01" }), rehearsal: true });
    registrarHumano(tarefa, { conta: "tria", categoria: "Impostos (retido)", codigo: "2.06.01" });
    const resultado = compararEnsaio(state, tarefa);
    expect(resultado?.veredito).toBe("confere");
    expect(resultado?.nomeDaCategoriaDiverge).toBe(true);
  });

  it("(e) as três divergências: código diferente é diverge_categoria, conta diferente é diverge_conta, os dois é diverge_ambos", () => {
    const soCodigo = das();
    lancar(soCodigo, { dePara: deParaDe("Impostos", { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01" }), rehearsal: true });
    registrarHumano(soCodigo, { conta: "TRIA", categoria: "Impostos e taxas", codigo: "2.06.99" });
    expect(compararEnsaio(state, soCodigo)?.veredito).toBe("diverge_categoria");

    const soConta = trafego();
    lancar(soConta, { dePara: deParaDe("Tráfego Pago", { veredito: "resolvida", nome: "Mídia paga", codigo: "2.07.01" }), rehearsal: true });
    registrarHumano(soConta, { conta: "KONQ", categoria: "Mídia paga", codigo: "2.07.01" });
    expect(compararEnsaio(state, soConta)?.veredito).toBe("diverge_conta");

    // Reaproveita `das()` numa terceira Tarefa (a guarda de sombra é por Tarefa, não global).
    const ambos = conta("tsk_cp_caucao");
    ambos.fieldValues = [...ambos.fieldValues, { definitionId: CP.fields.forma, value: "Boleto", state: "ativo" }, { definitionId: CP.fields.codigoBarras, value: "000", state: "ativo" }];
    lancar(ambos, { dePara: deParaDe("Administrativo", { veredito: "resolvida", nome: "Despesas administrativas", codigo: "2.04.01" }), rehearsal: true });
    registrarHumano(ambos, { conta: "KOPS", categoria: "Despesas administrativas", codigo: "9.99.99" });
    expect(compararEnsaio(state, ambos)?.veredito).toBe("diverge_ambos");
  });

  it("(f) recusa_correta: Ensaio que terminou falhou por veredito revisar vira recusa_correta, mesmo com registro humano — nunca diverge_*", () => {
    const tarefa = das();
    const r = lancar(tarefa, {
      dePara: deParaDe("Impostos", { veredito: "revisar", nome: "Impostos e taxas", codigo: "2.06.01", similaridade: 0.4, motivo: "teste" }),
      rehearsal: true,
    });
    expect(r.ok).toBe(false);
    registrarHumano(tarefa, { conta: "TRIA", categoria: "Impostos e taxas", codigo: "2.06.01" });
    expect(compararEnsaio(state, tarefa)?.veredito).toBe("recusa_correta");
  });

  it("(g) ausências: registro humano sem Ensaio é sem_ensaio; Ensaio sem registro humano é sem_lancamento_humano; nenhum dos dois some da amostra", () => {
    const semNada = das();
    expect(compararEnsaio(state, semNada)).toBeUndefined();

    const soHumano = das();
    registrarHumano(soHumano, { conta: "TRIA", categoria: "Impostos e taxas", codigo: "2.06.01" });
    expect(compararEnsaio(state, soHumano)?.veredito).toBe("sem_ensaio");

    const soEnsaio = trafego();
    lancar(soEnsaio, { dePara: deParaDe("Tráfego Pago", { veredito: "resolvida", nome: "Mídia paga", codigo: "2.07.01" }), rehearsal: true });
    expect(compararEnsaio(state, soEnsaio)?.veredito).toBe("sem_lancamento_humano");
  });

  it("(h) nao_medivel: Ensaio com origem prototipo não é medível, mesmo conferindo com o registro humano", () => {
    const tarefa = das();
    lancar(tarefa, { dePara: DE_PARA_DO_PROTOTIPO, rehearsal: true });
    registrarHumano(tarefa, { conta: "TRIA", categoria: "Impostos e taxas", codigo: "2.06.01" });
    expect(compararEnsaio(state, tarefa)?.veredito).toBe("nao_medivel");
  });

  it("(i) semTagDeConta: marca o palpite sem evidência, e o veredito segue sendo o da comparação — confere quando acerta, diverge_conta quando erra", () => {
    const acerto = das();
    acerto.tagIds = acerto.tagIds.filter((id) => (state.tags.find((t) => t.id === id)?.name ?? "") !== "conta tria");
    lancar(acerto, { dePara: deParaDe("Impostos", { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01" }), rehearsal: true });
    registrarHumano(acerto, { conta: "TRIA", categoria: "Impostos e taxas", codigo: "2.06.01" }); // centro "TRIA" é o fallback sem Tag
    const resultadoAcerto = compararEnsaio(state, acerto);
    expect(resultadoAcerto?.semTagDeConta).toBe(true);
    expect(resultadoAcerto?.veredito).toBe("confere");

    const erro = trafego();
    erro.tagIds = erro.tagIds.filter((id) => (state.tags.find((t) => t.id === id)?.name ?? "") !== "conta tria");
    lancar(erro, { dePara: deParaDe("Tráfego Pago", { veredito: "resolvida", nome: "Mídia paga", codigo: "2.07.01" }), rehearsal: true });
    registrarHumano(erro, { conta: "KONQ", categoria: "Mídia paga", codigo: "2.07.01" }); // o fallback seria "TRIA TECH" (Centro de Custo)
    const resultadoErro = compararEnsaio(state, erro);
    expect(resultadoErro?.semTagDeConta).toBe(true);
    expect(resultadoErro?.veredito).toBe("diverge_conta");
  });
});

describe("INV-CP-01 aditivo: o registro de lançamento humano também apaga o aviso (D3-03)", () => {
  it("(j) uma conta em lançado omie sem Resumo e sem Integração manual, mas com registro humano, não é apontada", () => {
    const negada = conta("tsk_cp_negada"); // já usada em operations.test.ts como exemplo de conta sem Resumo (INV-CP-01)
    expect(contaSemResumo(state, negada)).toBe(true);
    registrarHumano(negada, { conta: "TRIA", categoria: "Prestação de Serviços", codigo: "2.04.08" });
    expect(contaSemResumo(state, negada)).toBe(false);
  });

  it("sem nenhuma das três formas, a conta continua sendo apontada", () => {
    const negada = conta("tsk_cp_negada");
    expect(contaSemResumo(state, negada)).toBe(true);
  });
});

describe("LIMIAR_DA_CANETA: a régua é anterior aos dados", () => {
  it("os cinco números são exatamente os que o plano declara, antes de qualquer relatório existir", () => {
    expect(LIMIAR_DA_CANETA).toEqual({
      paresMinimos: 20,
      acertoDeCodigo: 0.95,
      acertoDeConta: 0.98,
      tetoDeSemRegistroHumano: 0.2,
      tetoDeRecusaParaUtilidade: 0.4,
    });
  });
});

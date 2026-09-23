/**
 * O Agente de lançamento, nas duas metades que D3-03 exige separadas: a que
 * DECIDE (`buildResumoDePagamento` — qual conta, qual categoria, qual código)
 * e a que EXECUTA (`runLancamentoAgent` — publica, resolve, registra).
 *
 * A decisão vai deixar de ler as tabelas fictícias do módulo e passar a
 * **receber** um de-para por parâmetro (D3-02: o domínio nunca busca o de-para;
 * quem lê `conciliador_contas_pagar_tria` por HTTP é o `apps/api`). Como a
 * parametrização mexe na ORIGEM dos dados e não no formato, o risco real é o
 * texto do RESUMO mudar sem ninguém perceber — CON-CP-08 é contrato entre dois
 * sistemas, byte a byte (`docs/07-processos/contas-a-pagar.md` §6.3).
 *
 * Por isso os dois primeiros testes são de CARACTERIZAÇÃO, com literal golden:
 * eles passam ANTES do refactor e têm que continuar passando depois. Os dois
 * literais são IMUTÁVEIS — quem precisar editá-los está mudando o contrato,
 * não o código.
 *
 * O vencimento é fixado à mão antes de cada captura porque o seed usa datas
 * relativas a hoje (`d(12)`), e um golden com data relativa expira amanhã.
 *
 * O ` ` depois de `R$` é o espaço inquebrável que o `Intl.NumberFormat`
 * pt-BR emite. Está escapado de propósito: um NBSP literal no arquivo é
 * invisível na revisão e some no primeiro "formatar documento".
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Task } from "../types";
import { CP, DE_PARA_DO_PROTOTIPO, buildResumoDePagamento, runLancamentoAgent, type DeParaDeLancamento, type ResolucaoDeCategoria } from "./financeiro";

const A7 = "aut_cp_a7";

const VENCIMENTO = "2026-03-10";

/** O RESUMO de `tsk_cp_das` como o processo o produz hoje — CON-CP-08. */
const GOLDEN_COM_TAG = `📋 RESUMO DE PAGAMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O que pagar:    DAS — Simples Nacional
Centro de custo: TRIA
Conta pagamento: TRIA
Categoria:      Impostos e taxas
Código:         2.06.01

📅 Vencimento:        10/03/2026
📅 Previsão pagto:    10/03/2026
💰 Valor:             R$ 66.267,50

💳 Forma de pagamento:
  • Tipo: Boleto: 85810000005-6 86267500000-1 26092600000-2 00000000000-3

📝 Observações: Conta de Pagamento definida como "TRIA" pela Tag "conta tria" e mapeamento por Centro de Custo "TRIA". Código da categoria conforme de-para "Impostos".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O que é e como será utilizado. Caso hajam parcelas, especifique aqui:
Imposto mensal`;

/** A outra frase de `observacao`: sem Tag `conta *`, a conta vem do Centro de Custo. */
const GOLDEN_SEM_TAG = `📋 RESUMO DE PAGAMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O que pagar:    DAS — Simples Nacional
Centro de custo: TRIA
Conta pagamento: TRIA
Categoria:      Impostos e taxas
Código:         2.06.01

📅 Vencimento:        10/03/2026
📅 Previsão pagto:    10/03/2026
💰 Valor:             R$ 66.267,50

💳 Forma de pagamento:
  • Tipo: Boleto: 85810000005-6 86267500000-1 26092600000-2 00000000000-3

📝 Observações: Sem Tag "conta *": Conta de Pagamento inferida do Centro de Custo "TRIA". Confirmar antes da remessa.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O que é e como será utilizado. Caso hajam parcelas, especifique aqui:
Imposto mensal`;

let state: DataState;

function conta(id: string): Task {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) throw new Error(`sem ${id}`);
  return t;
}

/** `tsk_cp_das` com vencimento fixo — a conta que A7 lança no processo real. */
function das(): Task {
  const t = conta("tsk_cp_das");
  t.dueDate = { form: "civilDay", value: VENCIMENTO };
  return t;
}

/** Um de-para de UMA entrada — que é o que a rota de 03-07 devolve por Tarefa. */
function deParaDe(categoria: string, resolucao: ResolucaoDeCategoria, origem: DeParaDeLancamento["origem"] = "omie"): DeParaDeLancamento {
  return { contaPorTag: { "conta tria": "TRIA" }, categoriaPorCampo: { [categoria]: resolucao }, origem };
}

beforeEach(() => {
  state = buildSeed();
});

describe("buildResumoDePagamento: o texto de CON-CP-08 é o que não pode mudar", () => {
  it("caracterização: o RESUMO de tsk_cp_das é byte a byte o de sempre", () => {
    const resumo = buildResumoDePagamento(state, das());
    expect(resumo.texto).toBe(GOLDEN_COM_TAG);
    expect(resumo.conta).toBe("TRIA");
    expect(resumo.categoria).toBe("Impostos e taxas");
    expect(resumo.codigo).toBe("2.06.01");
  });

  it("caracterização: sem Tag “conta *”, a segunda frase de Observações também é a de sempre", () => {
    const resumo = buildResumoDePagamento(state, { ...das(), tagIds: [] });
    expect(resumo.texto).toBe(GOLDEN_SEM_TAG);
    expect(resumo.conta).toBe("TRIA"); // do Centro de Custo, em caixa alta
  });

  it("passar DE_PARA_DO_PROTOTIPO à mão é idêntico a não passar nada", () => {
    const tarefa = das();
    const semArgumento = buildResumoDePagamento(state, tarefa);
    expect(buildResumoDePagamento(state, tarefa, DE_PARA_DO_PROTOTIPO)).toEqual(semArgumento);
    expect(semArgumento.veredito).toBe("resolvida");
    expect(semArgumento.origem).toBe("prototipo");
  });
});

describe("buildResumoDePagamento: a decisão chega por parâmetro (D3-02/D3-03)", () => {
  it("de-para injetado manda no nome, no código e na origem", () => {
    const resumo = buildResumoDePagamento(
      state,
      das(),
      deParaDe("Impostos", { veredito: "resolvida", nome: "Tributos federais", codigo: "2.06.99", similaridade: 0.97 }),
    );
    expect(resumo.categoria).toBe("Tributos federais");
    expect(resumo.codigo).toBe("2.06.99");
    expect(resumo.origem).toBe("omie");
    expect(resumo.veredito).toBe("resolvida");
    expect(resumo.texto).toContain("Categoria:      Tributos federais");
    expect(resumo.texto).toContain("Código:         2.06.99");
    expect(resumo.conta).toBe("TRIA"); // a conta também sai do de-para recebido
  });

  it("“revisar” não muda o texto: o RESUMO é documento para o humano ler, com o melhor palpite", () => {
    const resumo = buildResumoDePagamento(
      state,
      das(),
      deParaDe("Impostos", { veredito: "revisar", nome: "Impostos e taxas", codigo: "2.06.01", similaridade: 0.41, motivo: "abaixo do corte de confiança" }),
    );
    expect(resumo.veredito).toBe("revisar");
    expect(resumo.texto).toBe(GOLDEN_COM_TAG); // quem formata tolera; quem executa recusa
  });

  it("chave ausente no de-para recebido: veredito “ausente” e o mesmo fallback de hoje", () => {
    const resumo = buildResumoDePagamento(state, das(), { contaPorTag: { "conta tria": "TRIA" }, categoriaPorCampo: {}, origem: "omie" });
    expect(resumo.veredito).toBe("ausente");
    expect(resumo.categoria).toBe("Impostos"); // o valor do Campo, como sempre foi
    expect(resumo.codigo).toBe("9.99.99");
  });

  it("DE_PARA_DO_PROTOTIPO espelha as tabelas do módulo e se declara fictício", () => {
    expect(DE_PARA_DO_PROTOTIPO.origem).toBe("prototipo");
    expect(DE_PARA_DO_PROTOTIPO.contaPorTag["conta konq"]).toBe("KONQ");
    expect(DE_PARA_DO_PROTOTIPO.categoriaPorCampo["Impostos"]).toEqual({ veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01" });
  });
});

/** A Execução que o Agente acabou de gravar para esta conta. */
function execucaoDe(tarefa: Task) {
  const e = state.agentExecutions.filter((x) => x.agentId === CP.agentId && x.anchor?.id === tarefa.id).at(-1);
  if (!e) throw new Error("sem AgentExecution");
  return e;
}

const lancar = (tarefa: Task, opcoes?: Parameters<typeof runLancamentoAgent>[5]) => runLancamentoAgent(state, CP.financeiroId, CP.agentId, tarefa.id, A7, opcoes);

describe("runLancamentoAgent: o Ensaio de D3-03 pensa em voz alta e não encosta na Tarefa", () => {
  it("compatibilidade: a chamada de cinco argumentos de `runAction` continua lançando como hoje", () => {
    const tarefa = das();
    const r = lancar(tarefa);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    const resumo = tarefa.comments.find((c) => c.content.startsWith("📋 RESUMO DE PAGAMENTO"));
    expect(resumo?.author).toEqual({ kind: "agent", id: CP.agentId });
    expect(resumo?.resolved).toBeDefined();
    expect(execucaoDe(tarefa).rehearsal).toBe(false);
    expect(execucaoDe(tarefa).state).toBe("concluida");
  });

  it("T-3-08: com `rehearsal: true` nada muda na Tarefa — só nasce a Execução de sombra", () => {
    const tarefa = das();
    const comentarios = tarefa.comments.length;
    const status = tarefa.statusId;
    const atividade = state.activity.length;
    const execucoes = state.agentExecutions.length;

    const r = lancar(tarefa, { dePara: DE_PARA_DO_PROTOTIPO, rehearsal: true });

    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(tarefa.comments.length).toBe(comentarios);
    expect(tarefa.statusId).toBe(status);
    expect(state.activity.length).toBe(atividade);
    expect(state.agentExecutions.length).toBe(execucoes + 1);
    const execucao = execucaoDe(tarefa);
    expect(execucao.rehearsal).toBe(true);
    expect(execucao.state).toBe("concluida");
    expect(execucao.output).toContain("TRIA");
    expect(execucao.output).toContain("Impostos e taxas");
    expect(execucao.output).toContain("2.06.01");
    if (r.ok) expect(r.value.startsWith("Ensaio —")).toBe(true);
  });

  it("T-3-09: a Execução de sombra guarda a tripla, nunca o texto do RESUMO", () => {
    const tarefa = das();
    lancar(tarefa, { dePara: DE_PARA_DO_PROTOTIPO, rehearsal: true });
    const execucao = execucaoDe(tarefa);
    const gravado = JSON.stringify({ output: execucao.output, steps: execucao.steps, input: execucao.input });
    expect(gravado).not.toContain("RESUMO DE PAGAMENTO");
    expect(gravado).not.toContain("85810000005-6"); // código de barras
    expect(gravado).not.toContain("66.267,50"); // valor
  });

  it("o Ensaio é idempotente: uma Tarefa tem UM registro de sombra", () => {
    const tarefa = das();
    const antes = state.agentExecutions.length;
    expect(lancar(tarefa, { dePara: DE_PARA_DO_PROTOTIPO, rehearsal: true }).ok).toBe(true);
    const segundo = lancar(tarefa, { dePara: DE_PARA_DO_PROTOTIPO, rehearsal: true });
    expect(segundo.ok).toBe(true);
    expect(state.agentExecutions.length).toBe(antes + 1);
  });

  it("a guarda de sombra não é guarda de lançamento: depois do Ensaio, o lançamento real acontece", () => {
    const tarefa = das();
    expect(lancar(tarefa, { dePara: DE_PARA_DO_PROTOTIPO, rehearsal: true }).ok).toBe(true);
    expect(tarefa.comments.some((c) => c.content.startsWith("📋 RESUMO DE PAGAMENTO"))).toBe(false);
    expect(lancar(tarefa).ok).toBe(true);
    expect(tarefa.comments.some((c) => c.content.startsWith("📋 RESUMO DE PAGAMENTO"))).toBe(true);
    expect(state.agentExecutions.filter((e) => e.anchor?.id === tarefa.id).map((e) => e.rehearsal)).toEqual([true, false]);
  });

  it("T-3-07: o passo de raciocínio nomeia a origem do de-para usado, nos dois caminhos", () => {
    const real = das();
    lancar(real);
    expect(execucaoDe(real).steps[0]?.input).toBe("de-para ERP (prototipo)");

    const ensaiada = conta("tsk_cp_trafego");
    lancar(ensaiada, { dePara: deParaDe("Tráfego Pago", { veredito: "resolvida", nome: "Mídia paga", codigo: "2.07.01" }), rehearsal: true });
    expect(execucaoDe(ensaiada).steps[0]?.input).toBe("de-para ERP (omie)");
  });
});

describe("runLancamentoAgent: classificação fraca para a conta e chama o humano (T-3-10)", () => {
  it("“revisar”: recusa, comenta ABERTO com Menção ao Financeiro citando o motivo, e não publica RESUMO", () => {
    const tarefa = das();
    const r = lancar(tarefa, {
      dePara: deParaDe("Impostos", { veredito: "revisar", nome: "Impostos e taxas", codigo: "2.06.01", similaridade: 0.41, motivo: "duas categorias empatadas no Omie" }),
    });
    expect(r.ok).toBe(false);
    expect(tarefa.comments.some((c) => c.content.startsWith("📋 RESUMO DE PAGAMENTO"))).toBe(false);
    expect(tarefa.statusId).toBe(CP.status.paraPagar);
    const pedido = tarefa.comments.at(-1);
    expect(pedido?.resolved).toBeUndefined(); // aberto: é pergunta, não registro
    expect(pedido?.mentions.some((m) => m.id === CP.financeiroId)).toBe(true);
    expect(pedido?.content).toContain("Impostos");
    expect(pedido?.content).toContain("2.06.01");
    expect(pedido?.content).toContain("duas categorias empatadas no Omie");
    expect(pedido?.content).toContain("0,41");
    expect(execucaoDe(tarefa).state).toBe("falhou");
  });

  it("“ausente”: um de-para que não traz a Categoria pedida é falha de resolução, não licença para lançar “A classificar”", () => {
    const tarefa = das();
    const r = lancar(tarefa, { dePara: { contaPorTag: { "conta tria": "TRIA" }, categoriaPorCampo: {}, origem: "omie" } });
    expect(r.ok).toBe(false);
    expect(tarefa.comments.some((c) => c.content.startsWith("📋 RESUMO DE PAGAMENTO"))).toBe(false);
    expect(tarefa.comments.at(-1)?.content).toContain("Impostos");
    expect(execucaoDe(tarefa).state).toBe("falhou");
  });

  it("no Ensaio, nem a recusa escreve na Tarefa — ela vira passo da Execução", () => {
    const tarefa = das();
    const comentarios = tarefa.comments.length;
    const r = lancar(tarefa, {
      dePara: deParaDe("Impostos", { veredito: "revisar", nome: "Impostos e taxas", codigo: "2.06.01", similaridade: 0.4, motivo: "confiança baixa" }),
      rehearsal: true,
    });
    expect(r.ok).toBe(false);
    expect(tarefa.comments.length).toBe(comentarios);
    expect(execucaoDe(tarefa).state).toBe("falhou");
    expect(execucaoDe(tarefa).rehearsal).toBe(true);
  });
});

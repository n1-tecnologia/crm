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
import { buildResumoDePagamento } from "./financeiro";

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
});

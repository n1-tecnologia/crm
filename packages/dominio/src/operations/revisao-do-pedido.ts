/**
 * Fluxo 6 (checklist 6.2/6.3) — as mudanças que um pedido de ajuste no fio do
 * Resumo pede à conta: o `/resolver` do `automation/` lê o pedido com a IA e
 * devolve o que mudar (valor, vencimento, forma e dado de pagamento,
 * descrição); este módulo as aplica nos Campos da conta.
 *
 * Quem age é o Agente, A PEDIDO de quem pediu: cada mudança passa pela regra
 * de escrita de quem pediu (`setTaskFieldValue`/`updateTask` rodam com o id
 * dessa pessoa), e o Registro de Atividade sai com o Agente como ator e a
 * pessoa como delegante. O que ela não poderia mudar pela tela, o Agente
 * também não muda — vira uma linha em `recusadas`, nunca uma escrita.
 *
 * Uma mudança recusada não derruba as outras: o Resumo revisado diz o que
 * mudou e o que não mudou, e por quê.
 */

import type { DataState } from "../state";
import type { Id, Task } from "../types";
import { memberActor } from "./activity";
import { CP, fieldValue } from "./financeiro-base";
import { setTaskFieldValue, updateTask } from "./tasks";

/** As formas de pagamento que o `/lancar` aceita — as opções do Campo "Forma de pagamento". */
export const FORMAS_DO_PEDIDO = ["Chave Pix", "Boleto", "QRCode Pix"] as const;
export type FormaDoPedido = (typeof FORMAS_DO_PEDIDO)[number];

/** O que o pedido muda. Tudo opcional: ausente é "não mexer". */
export interface MudancasDoPedido {
  /** Inteiro, em centavos, maior que zero — a convenção do contrato. */
  readonly valorCentavos?: number;
  /** AAAA-MM-DD. */
  readonly vencimento?: string;
  readonly formaDePagamento?: FormaDoPedido;
  readonly chavePix?: string;
  readonly codigoDeBarras?: string;
  readonly pixCopiaECola?: string;
  readonly descricao?: string;
}

export interface ResultadoDasMudancas {
  /** "Valor: R$ 100,00 → R$ 120,00" — uma linha por mudança aplicada. */
  readonly aplicadas: readonly string[];
  /** "Vencimento: <motivo>" — uma linha por mudança pedida e não aplicada. */
  readonly recusadas: readonly string[];
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (iso: string | undefined): string => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const DADO_DA_FORMA: Readonly<Record<FormaDoPedido, Id>> = {
  "Chave Pix": CP.fields.chavePix,
  Boleto: CP.fields.codigoBarras,
  "QRCode Pix": CP.fields.pixCopiaECola,
};

const nomeDoCampo = (state: DataState, id: Id): string => state.fieldDefinitions.find((d) => d.id === id)?.name ?? id;

/** `true` quando `mudancas` não pede nada. */
export function semMudancas(mudancas: MudancasDoPedido | undefined): boolean {
  return !mudancas || Object.values(mudancas).every((v) => v === undefined);
}

/**
 * Aplica `mudancas` em `task` como o Agente `agentId`, a pedido de
 * `quemPediuId`. Muta `state` (quem chama desfaz numa recusa posterior).
 * Só registra o que de fato mudou: pedir o valor que a conta já tem não é
 * mudança.
 */
export function aplicarMudancasDoPedido(
  state: DataState,
  task: Task,
  mudancas: MudancasDoPedido,
  atores: { readonly agentId: Id; readonly quemPediuId: Id },
): ResultadoDasMudancas {
  const aplicadas: string[] = [];
  const recusadas: string[] = [];

  /** O Registro que a operação acabou de gravar (sempre no índice 0) sai com o Agente como ator. */
  const comoAgente = (registrosAntes: number) => {
    const novos = state.activity.length - registrosAntes;
    for (let i = 0; i < novos; i++) {
      const registro = state.activity[i];
      if (registro) state.activity[i] = { ...registro, actor: { kind: "agent", id: atores.agentId }, delegate: memberActor(atores.quemPediuId) };
    }
  };

  const campo = (id: Id, valor: string | number, rotulo: (antes: string, depois: string) => string) => {
    const antes = fieldValue(task, id);
    if (antes === String(valor)) return;
    const registros = state.activity.length;
    const r = setTaskFieldValue(state, atores.quemPediuId, task.id, id, valor);
    if (!r.ok) {
      recusadas.push(`${nomeDoCampo(state, id)}: ${r.error}`);
      return;
    }
    comoAgente(registros);
    aplicadas.push(rotulo(antes, fieldValue(task, id)));
  };

  // A forma muda junto com o dado dela, ou não muda: Boleto sem código de
  // barras deixaria a conta sem o que o Omie exige.
  const formaPedida = mudancas.formaDePagamento;
  const dadoPedido = (forma: FormaDoPedido): string | undefined =>
    forma === "Chave Pix" ? mudancas.chavePix : forma === "Boleto" ? mudancas.codigoDeBarras : mudancas.pixCopiaECola;
  let formaRecusada = false;
  if (formaPedida && formaPedida !== fieldValue(task, CP.fields.forma)) {
    const dado = dadoPedido(formaPedida)?.trim() || fieldValue(task, DADO_DA_FORMA[formaPedida]);
    if (!dado) {
      formaRecusada = true;
      recusadas.push(`${nomeDoCampo(state, CP.fields.forma)}: para ${formaPedida}, falta ${nomeDoCampo(state, DADO_DA_FORMA[formaPedida])} no pedido.`);
    } else {
      campo(CP.fields.forma, formaPedida, (antes, depois) => `${nomeDoCampo(state, CP.fields.forma)}: ${antes || "—"} → ${depois}`);
    }
  }

  const dados: ReadonlyArray<readonly [string | undefined, Id, FormaDoPedido]> = [
    [mudancas.chavePix, CP.fields.chavePix, "Chave Pix"],
    [mudancas.codigoDeBarras, CP.fields.codigoBarras, "Boleto"],
    [mudancas.pixCopiaECola, CP.fields.pixCopiaECola, "QRCode Pix"],
  ];
  for (const [valor, id, forma] of dados) {
    const texto = valor?.trim();
    if (!texto) continue;
    // O dado de uma forma recusada não entra sozinho.
    if (formaRecusada && formaPedida === forma) continue;
    campo(id, texto, (antes, depois) => `${nomeDoCampo(state, id)}: ${antes || "—"} → ${depois}`);
  }

  if (mudancas.valorCentavos !== undefined) {
    if (!Number.isInteger(mudancas.valorCentavos) || mudancas.valorCentavos <= 0) {
      recusadas.push(`${nomeDoCampo(state, CP.fields.valor)}: o valor pedido não é um valor maior que zero.`);
    } else {
      const reais = mudancas.valorCentavos / 100;
      campo(CP.fields.valor, reais, (antes, depois) => {
        const formatar = (v: string) => (v && Number.isFinite(Number(v)) ? brl.format(Number(v)) : "—");
        return `${nomeDoCampo(state, CP.fields.valor)}: ${formatar(antes)} → ${formatar(depois)}`;
      });
    }
  }

  const nativo = (rotulo: string, mudou: boolean, aplicar: () => ReturnType<typeof updateTask>, linha: () => string) => {
    if (!mudou) return;
    const registros = state.activity.length;
    const r = aplicar();
    if (!r.ok) {
      recusadas.push(`${rotulo}: ${r.error}`);
      return;
    }
    comoAgente(registros);
    aplicadas.push(linha());
  };

  if (mudancas.vencimento !== undefined) {
    const novo = mudancas.vencimento;
    const antes = task.dueDate?.value.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(novo) || Number.isNaN(Date.parse(`${novo}T00:00:00Z`))) {
      recusadas.push("Vencimento: a data pedida não é uma data válida.");
    } else {
      nativo(
        "Vencimento",
        antes !== novo,
        () => updateTask(state, atores.quemPediuId, task.id, { dueDate: { form: "civilDay", value: novo } }),
        () => `Vencimento: ${dataBr(antes)} → ${dataBr(novo)}`,
      );
    }
  }

  if (mudancas.descricao !== undefined) {
    const nova = mudancas.descricao.trim();
    nativo(
      "Descrição",
      nova !== "" && nova !== (task.description ?? ""),
      () => updateTask(state, atores.quemPediuId, task.id, { description: nova }),
      () => "Descrição alterada",
    );
  }

  return { aplicadas, recusadas };
}

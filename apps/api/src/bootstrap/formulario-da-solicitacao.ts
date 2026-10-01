/**
 * Checklist 1.8 — `criarFormularioDaSolicitacao()` aplica
 * `garantirFormularioDaSolicitacao` (`@n1/dominio`) contra um Espaço de
 * Trabalho que já rodou `solicitacoes:configurar` — a Lista existe e já não
 * usa os Campos de Contas a pagar com o mesmo nome dos dela (sem isso, o
 * Formulário exigiria um segundo "Centro de Custo" e a criação recusa).
 *
 * Cria UMA vez: existindo o Formulário, nada muda — o que foi editado pela
 * tela não é sobrescrito. `dryRun` (o padrão do CLI) roda numa transação e
 * dá `rollback`, como `./solicitacoes.ts`.
 */

import { garantirFormularioDaSolicitacao } from "@n1/dominio/formulario-da-solicitacao";
import { syncIdSequence } from "@n1/dominio/operations";
import { pool } from "../persistencia/conexao";
import { hidratar } from "../persistencia/repositorio";
import { executar } from "../persistencia/unidade-de-trabalho";

export interface OpcoesDoFormularioDaSolicitacao {
  readonly workspaceId: string;
  /** O dono do Formulário: o envio anônimo cria a Tarefa em nome dele. */
  readonly actingMemberId: string;
  readonly dryRun: boolean;
}

export type ResultadoDoFormularioDaSolicitacao =
  | {
      readonly ok: true;
      readonly dryRun: boolean;
      readonly criado: boolean;
      readonly formId: string;
      readonly perguntas: number;
      /** O segredo do link — só depois de gravar; no dry-run o segredo é descartado. */
      readonly segredo?: string;
    }
  | { readonly ok: false; readonly dryRun: boolean; readonly error: string };

export async function criarFormularioDaSolicitacao(opcoes: OpcoesDoFormularioDaSolicitacao): Promise<ResultadoDoFormularioDaSolicitacao> {
  const { workspaceId, actingMemberId, dryRun } = opcoes;

  if (dryRun) {
    const cliente = await pool().connect();
    try {
      await cliente.query("begin");
      const { state } = await hidratar(cliente, workspaceId);
      syncIdSequence(state);
      const r = garantirFormularioDaSolicitacao(state, actingMemberId);
      if (!r.ok) return { ok: false, dryRun: true, error: r.error };
      return {
        ok: true,
        dryRun: true,
        criado: r.value.criado,
        formId: r.value.form.id,
        perguntas: r.value.form.questions.length,
        ...(r.value.criado ? {} : { segredo: r.value.form.secret }),
      };
    } finally {
      await cliente.query("rollback").catch(() => undefined);
      cliente.release();
    }
  }

  const resultado = await executar(workspaceId, (state) => garantirFormularioDaSolicitacao(state, actingMemberId));
  if ("conflito" in resultado) return { ok: false, dryRun: false, error: resultado.error };
  if (!resultado.ok) return { ok: false, dryRun: false, error: resultado.error };
  return {
    ok: true,
    dryRun: false,
    criado: resultado.value.criado,
    formId: resultado.value.form.id,
    perguntas: resultado.value.form.questions.length,
    segredo: resultado.value.form.secret,
  };
}

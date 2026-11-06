/**
 * O seed que o app carrega: só o que o produto já define — Comercial ›
 * atalho da Caixa de entrada e Pós-venda, e Gestão › Financeiro › Contas a
 * pagar. Os Espaços de demonstração (Entrega, Marketing) e a árvore antiga
 * do Comercial (Clientes, Propostas, Prospecção, Indicadores) continuam no
 * seed completo, que é o que os testes exercitam; aqui eles são podados com
 * tudo o que dependia deles.
 *
 * Desde o 15-31 (D-15-13) o seed não traz mais o CRM antigo nem a Pasta "Meus
 * negócios" com as Listas espelho dos Funis; o CRM de demonstração é o
 * `bootstrap:crm-demo`. As Reuniões do processo comercial, que moravam nessas
 * Listas, ficam na árvore de demonstração e saem com ela.
 */

import { buildSeed } from "./seed";
import type { DataState } from "./state";
import type { Id } from "./types";

const DEMO_SPACES: readonly Id[] = ["spc_ops", "spc_mkt"];
const DEMO_COMERCIAL: readonly Id[] = ["fld_clientes", "fld_propostas", "lst_prospeccao", "lst_indicadores"];

export function buildProductSeed(): DataState {
  const state = buildSeed();
  pruneDemo(state);
  return state;
}

/** Remove os contêineres de demonstração e, por varredura, toda referência a eles. */
export function pruneDemo(state: DataState): void {
  const removed = new Set<Id>([...DEMO_SPACES, ...DEMO_COMERCIAL]);

  // Descendentes: Pastas e Listas cujo pai foi removido, até o ponto fixo.
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of state.folders) {
      if (!removed.has(f.id) && removed.has(f.parentId)) {
        removed.add(f.id);
        grew = true;
      }
    }
    for (const l of state.lists) {
      if (!removed.has(l.id) && removed.has(l.parentId)) {
        removed.add(l.id);
        grew = true;
      }
    }
  }
  for (const t of state.tasks) if (removed.has(t.listId)) removed.add(t.id);
  for (const d of state.fieldDefinitions) if (d.definedAtId !== undefined && removed.has(d.definedAtId)) removed.add(d.id);
  for (const tt of state.taskTypes) if (removed.has(tt.definedAtId)) removed.add(tt.id);
  for (const v of state.views) if ((v.listId !== undefined && removed.has(v.listId)) || removed.has(v.ownerId)) removed.add(v.id);
  for (const f of state.forms) if (removed.has(f.listId)) removed.add(f.id);
  for (const a of state.automations) if (removed.has(a.scopeId)) removed.add(a.id);
  for (const p of state.panels) if (p.anchor && removed.has(p.anchor.id)) removed.add(p.id);
  for (const e of state.agentExecutions) if (e.anchor && removed.has(e.anchor.id)) removed.add(e.id);
  for (const e of state.automationExecutions) if (removed.has(e.automationId) || (e.objectId !== undefined && removed.has(e.objectId))) removed.add(e.id);
  for (const a of state.approvals) {
    // D-06 — só o ramo `agentExecution` tem `executionId`; `processTask` não referencia Execução.
    if ((a.origin.kind === "agentExecution" && removed.has(a.origin.executionId)) || removed.has(a.object.targetResourceId)) {
      removed.add(a.id);
    }
  }
  for (const g of state.grants) if (removed.has(g.resourceId)) removed.add(g.id);
  for (const l of state.links) if (removed.has(l.fromId) || removed.has(l.toId)) removed.add(l.id);
  for (const a of state.activity) if (removed.has(a.objectId)) removed.add(a.id);

  const keep = <T extends { readonly id: Id }>(items: T[]) => {
    for (let i = items.length - 1; i >= 0; i -= 1) {
      const item = items[i];
      if (item && removed.has(item.id)) items.splice(i, 1);
    }
  };
  keep(state.spaces);
  keep(state.folders);
  keep(state.lists);
  keep(state.tasks);
  keep(state.fieldDefinitions);
  keep(state.taskTypes);
  keep(state.views);
  keep(state.forms);
  keep(state.automations);
  keep(state.panels);
  keep(state.agentExecutions);
  keep(state.automationExecutions);
  keep(state.approvals);
  keep(state.grants);
  keep(state.links);
  keep(state.activity);

  // Varredura: o que sobrou não pode apontar para um id removido — um item de
  // array que cite um some inteiro; um escalar solto é apagado.
  for (const [key, value] of Object.entries(state)) {
    if (key === "models" || key === "tools" || !Array.isArray(value)) continue;
    for (const record of value) scrub(record, removed);
  }
  scrub(state.workspace, removed);
  scrub(state.inbox, removed);
}

const mentions = (value: unknown, removed: ReadonlySet<Id>): boolean => {
  if (typeof value === "string") return removed.has(value);
  if (Array.isArray(value)) return value.some((v) => mentions(v, removed));
  if (value && typeof value === "object") return Object.values(value).some((v) => mentions(v, removed));
  return false;
};

function scrub(record: object, removed: ReadonlySet<Id>): void {
  // A varredura muda os registros no lugar; os tipos são readonly só para o código de aplicação.
  const target = record as Record<string, unknown>;
  for (const [key, value] of Object.entries(target)) {
    if (typeof value === "string") {
      if (removed.has(value)) delete target[key];
    } else if (Array.isArray(value)) {
      const kept = value.filter((v) => !mentions(v, removed));
      if (kept.length !== value.length) target[key] = kept;
      for (const v of kept) if (v && typeof v === "object") scrub(v, removed);
    } else if (value && typeof value === "object") {
      // Um objeto aninhado (âncora, proveniência) que cite um id removido
      // sai inteiro: um `anchor` sem `id` seria um registro inválido.
      if (mentions(value, removed)) delete target[key];
      else scrub(value, removed);
    }
  }
}

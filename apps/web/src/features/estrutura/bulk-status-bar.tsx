"use client";

/**
 * Mudança de Status em lote numa Lista — o Financeiro fecha 61 contas como
 * "pago" no mesmo minuto. Quatro coisas para quem for mexer aqui de novo:
 *
 * 1. **O gesto é UMA chamada**, não um laço. `alterarStatusEmLote` (Plan
 *    03-12) roda numa transação só no servidor — a razão é DEC-06: escritas
 *    são serializadas por Espaço de Trabalho, então 61 `run()` seriam 61
 *    hidratações do Espaço inteiro enfileiradas, e a partir da segunda o
 *    servidor responde 409 (a cópia local já não bate com a revisão real).
 *    Um laço de `run()` sem `await` dispara tudo concorrente e reidrata a
 *    cada conflito — o antigo código deste arquivo fazia exatamente isso.
 * 2. **`alterarStatusEmLote` não reimplementa nada.** Ela chama
 *    `changeTaskStatus` item a item, DENTRO do domínio: é de lá que vêm
 *    permissão, RN-CP-02 (requisitos de saída), RN-CP-04 (quem pode entrar) e
 *    A1 (a próxima ocorrência da Recorrência). A prévia desta tela
 *    (`statusOptionRefusal`) é eco dessa mesma checagem, nunca decisão —
 *    quem decide de verdade é sempre o domínio.
 * 3. **Falha parcial é valor, não exceção.** Quem lê e renderiza os quatro
 *    resultados (`alterada`/`jaEstava`/`recusada`/`parcial`) do
 *    `RelatorioDeLote` é `relatorio-de-lote.tsx` — este arquivo só chama a
 *    operação e repassa o relatório para cima (`onRelatorio`), porque a barra
 *    desmonta quando a seleção esvazia e o relatório precisa sobreviver a
 *    isso (a página é quem guarda).
 * 4. **A importação vem do barril instrumentado.** `@n1/dominio/operations`
 *    embrulha `alterarStatusEmLote` para que `gravarChamadas` observe a
 *    chamada e `apps/api` a receba de verdade; a versão crua de
 *    `@n1/dominio/operations/lote` rodaria só na cópia que `run()` descarta —
 *    61 contas fechadas na tela, nenhuma no banco (T-3-60).
 *
 * Também o botão "Rodar automações por vencimento": o relógio do protótipo,
 * intocado por este plano.
 */

import { useState } from "react";
import { useData, useRun, useSession } from "@/dados/store";
import { alterarStatusEmLote, LIMITE_DO_LOTE, runScheduledAutomations, statusOptionRefusal } from "@n1/dominio/operations";
import { containerAdminRefusal } from "@n1/dominio/derive";
import { Button, ConfirmDialog, Field, Painel, Select } from "@/features/shell/ui";
import type { StatusDefinition, Task } from "@n1/dominio/types";
// Tipo só — nunca a operação crua. `import type` não tem efeito em tempo de
// execução, então não escapa da instrumentação do barril acima (T-3-60).
import type { RelatorioDeLote } from "@n1/dominio/operations/lote";

type Report = (result: { ok: boolean; error?: string }, message: string) => void;

export function BulkStatusBar({
  tasks,
  definitions,
  selected,
  onSelect,
  onClear,
  onRelatorio,
  report,
}: {
  readonly tasks: readonly Task[];
  readonly definitions: readonly StatusDefinition[];
  readonly selected: ReadonlySet<string>;
  readonly onSelect: (ids: ReadonlySet<string>) => void;
  readonly onClear: () => void;
  /** A página guarda o relatório — esta barra desmonta quando a seleção esvazia. */
  readonly onRelatorio: (relatorio: RelatorioDeLote) => void;
  readonly report: Report;
}) {
  const run = useRun();
  const { memberId } = useSession();
  const state = useData((data) => data);
  const [statusId, setStatusId] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const alvo = definitions.find((d) => d.id === statusId);
  const todosSelecionados = tasks.length > 0 && tasks.every((t) => selected.has(t.id));

  /*
   * Prévia de recusa, antes do clique. Eco de `statusOptionRefusal` — a mesma
   * função que as ações rápidas de `contas-view.tsx` já usam — nunca decisão
   * própria: quem decide de verdade, item a item, é `alterarStatusEmLote`
   * dentro do domínio.
   */
  const selecionadas = tasks.filter((t) => selected.has(t.id));
  const motivosPrevistos = alvo
    ? selecionadas
        .map((t) => statusOptionRefusal(state, memberId, t, alvo.id))
        .filter((motivo): motivo is string => motivo !== undefined)
    : [];
  const primeiroMotivo = motivosPrevistos[0];
  /*
   * "Aplicar" só desabilita quando TODAS as selecionadas seriam recusadas.
   * Recusa parcial é resultado legítimo — 03-06 cria contas com "Lacuna de
   * conversão" de propósito, e RN-CP-02 as recusa de propósito — bloquear no
   * primeiro item recusado reintroduziria o tudo-ou-nada que 03-12 recusou
   * com números.
   */
  const todasRecusariam = alvo !== undefined && selecionadas.length > 0 && motivosPrevistos.length === selecionadas.length;
  const acimaDoLimite = selected.size > LIMITE_DO_LOTE;

  const desabilitado = selected.size === 0 || !alvo || acimaDoLimite || todasRecusariam;
  // Nunca truncar a seleção acima do teto: um lote silenciosamente cortado é
  // um lote em que o operador acredita ter fechado 300 contas e fechou 200
  // (T-3-57). A tela recusa antes do clique; o domínio recusa de novo se
  // alguém contornar.
  const razaoDoTeto = `Um lote fecha no máximo ${LIMITE_DO_LOTE} Tarefas por vez; ${selected.size} foram selecionadas. Use os filtros para recortar a seleção.`;
  const disabledReason =
    selected.size === 0
      ? "Selecione ao menos uma Tarefa."
      : !alvo
        ? "Escolha o Status de destino."
        : acimaDoLimite
          ? razaoDoTeto
          : todasRecusariam
            ? (primeiroMotivo ?? "Nenhuma das selecionadas pode entrar neste Status.")
            : "";

  return (
    <Painel className="flex flex-wrap items-center gap-2 px-3 py-2">
      <ConfirmDialog
        open={confirmando}
        title={`Mover ${selected.size} Tarefa(s) para “${alvo?.name ?? ""}”?`}
        description="O lote vai numa transação só. Cada conta passa pelas mesmas regras de uma mudança individual (requisitos de saída, quem pode entrar, Recorrência); as que forem recusadas ficam onde estão e são listadas depois."
        confirmLabel="Mover todas"
        onConfirm={() => {
          setConfirmando(false);
          if (!alvo) return;
          // Uma lista só, uma chamada só — o laço morreu aqui (03-13).
          const ids = [...selected];
          const r = run((data, me) => alterarStatusEmLote(data, me, ids, alvo.id));
          if (!r.ok) {
            // Recusa do gesto inteiro (lista vazia, acima do teto, id
            // repetido) — nada foi à rede (D-05 de `store.ts`).
            report(r, "");
            return;
          }
          onRelatorio(r.value);
          report(
            { ok: true },
            `${r.value.alteradas} alterada(s), ${r.value.jaEstavam} já estava(m), ${r.value.recusadas} recusada(s), ${r.value.parciais} parcial(is) — ${r.value.ocorrenciasCriadas} ocorrência(s) do mês seguinte criada(s).`,
          );
          /*
           * O que fechou não tem mais o que fazer ali; o que já estava é
           * ruído benigno; o que resta selecionado é exatamente o que ainda
           * pede a mão do Financeiro. Por id, nunca por título — títulos se
           * repetem entre meses.
           */
          const pendentes = r.value.itens
            .filter((item) => item.resultado === "recusada" || item.resultado === "parcial")
            .map((item) => item.taskId);
          if (pendentes.length > 0) onSelect(new Set(pendentes));
          else onClear();
        }}
        onCancel={() => setConfirmando(false)}
      />
      <label className="app-base flex items-center gap-2" style={{ color: "var(--texto)" }}>
        <input
          type="checkbox"
          checked={todosSelecionados}
          onChange={(event) => onSelect(event.target.checked ? new Set(tasks.map((t) => t.id)) : new Set())}
          className="size-4 accent-[var(--acento)]"
        />
        {selected.size === 0 ? "Selecionar todas as visíveis" : `${selected.size} selecionada(s)`}
      </label>
      <span className="min-w-56">
        <Field label="Mover para">
          {(id) => <Select id={id} value={statusId} onChange={setStatusId} placeholder="Escolher Status" options={definitions.map((d) => ({ value: d.id, label: d.name }))} />}
        </Field>
      </span>
      {alvo && motivosPrevistos.length > 0 ? (
        <p className="app-meta" style={{ color: "var(--aviso)" }}>
          {motivosPrevistos.length} de {selecionadas.length} seria(m) recusada(s){primeiroMotivo ? `: ${primeiroMotivo}` : "."}
        </p>
      ) : null}
      <Button variant="primary" onClick={() => setConfirmando(true)} disabled={desabilitado} disabledReason={disabledReason}>
        Aplicar
      </Button>
      {selected.size > 0 ? (
        <Button variant="ghost" onClick={onClear}>
          Limpar seleção
        </Button>
      ) : null}
    </Painel>
  );
}

/** Só aparece quando a Lista tem Automação por vencimento; roda com a data de hoje. */
export function RunScheduledButton({ listId, report }: { readonly listId: string; readonly report: Report }) {
  const run = useRun();
  const { memberId } = useSession();
  const state = useData((data) => data);
  const agendadas = state.automations.filter((a) => a.lifecycle === "ativo" && a.scopeType === "list" && a.scopeId === listId && a.versions.some((v) => v.state === "publicada" && v.trigger?.kind === "condicaoTemporal"));
  if (agendadas.length === 0) return null;
  const bloqueio = containerAdminRefusal(state, memberId, "list", listId);
  return (
    <span title={`${agendadas.length} Automação(ões) por vencimento: ${agendadas.map((a) => a.name).join("; ")}`}>
      <Button
        onClick={() => {
          const r = run((data, me) => runScheduledAutomations(data, me, listId, new Date()));
          if (r.ok && r.value.failed > 0) {
            report(
              { ok: false, error: `${r.value.executed} executada(s); ${r.value.failed} falhou(aram): ${r.value.failures.map((f) => `${f.title} — ${f.reason}`).join(" · ")}` },
              "",
            );
          } else {
            report(r, r.ok ? `Automações por vencimento: ${r.value.executed} executada(s), ${r.value.skipped} já rodada(s) ou fora da condição.` : "");
          }
        }}
        disabled={bloqueio !== undefined}
        disabledReason={bloqueio ?? ""}
      >
        Rodar automações por vencimento (hoje)
      </Button>
    </span>
  );
}

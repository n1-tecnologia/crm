"use client";

/**
 * ENSAIAR UM AGENTE (DO-AGE-13, B82): uma Execução real, gravada com
 * `rehearsal`, em que a Composição do Contexto e as leituras acontecem e
 * toda escrita vira um Passo `simulado` — sem efeito, sem Registro no alvo e
 * sem Memória. É a única Execução que um rascunho admite (RN-AGE-10), e por
 * isso é o botão primário do Agente ativo e o caminho de teste do rascunho.
 *
 * A Âncora é opcional: uma Tarefa, um Negócio ou um Contato ativo que entra
 * na Composição do Contexto como registro-alvo (DO-AGE-09).
 */

import { useState } from "react";
import { useData, useRun, useSession } from "@/dados/store";
import { ensaiarAgente, recusaDeGovernarAgente } from "@n1/dominio/operations";
import { contactDisplayName } from "@n1/dominio/derive";
import { versaoCorrenteDoAgente } from "@n1/dominio/derive-ia";
import { useNavegar } from "@/features/shell/navegacao";
import { ConfirmDialog, Field, Select, TextArea } from "@/features/shell/ui";

const ANCORA_LABEL: Record<string, string> = { task: "Tarefa", deal: "Negócio", contact: "Contato" };

export function EnsaiarDialog({ agentId, open, onClose }: { readonly agentId: string; readonly open: boolean; readonly onClose: () => void }) {
  const state = useData((data) => data);
  const run = useRun();
  const { memberId } = useSession();
  const [navegar, pendente] = useNavegar();
  const [texto, setTexto] = useState("");
  // `tipo:id` num valor só: o Select é de string, e a Âncora tem duas partes.
  const [ancora, setAncora] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const agent = state.agents.find((a) => a.id === agentId);
  const version = agent ? versaoCorrenteDoAgente(agent) : undefined;

  const motivo = !agent
    ? "Agente não encontrado."
    : (recusaDeGovernarAgente(state, memberId, agent, "editar") ??
      (agent.lifecycle !== "rascunho" && agent.lifecycle !== "ativo"
        ? "Só um Agente em rascunho ou ativo ensaia (DO-AGE-13)."
        : !version?.instructions.trim()
          ? "Escreva as instruções antes de ensaiar: sem elas o Agente não sabe o que fazer."
          : !texto.trim()
            ? "Escreva o pedido do ensaio."
            : pendente
              ? "Abrindo a Execução…"
              : undefined));

  const opcoes = [
    ...state.tasks.filter((t) => t.lifecycle === "ativo").map((t) => ({ value: `task:${t.id}`, label: t.title, detail: ANCORA_LABEL.task ?? "Tarefa" })),
    ...state.deals.filter((d) => d.lifecycle === "ativo").map((d) => ({ value: `deal:${d.id}`, label: d.title, detail: ANCORA_LABEL.deal ?? "Negócio" })),
    ...state.contacts.filter((c) => c.lifecycle === "ativo").map((c) => ({ value: `contact:${c.id}`, label: contactDisplayName(c), detail: ANCORA_LABEL.contact ?? "Contato" })),
  ];

  const reset = () => {
    setTexto("");
    setAncora("");
    setErro(null);
  };

  const confirmar = () => {
    const separador = ancora.indexOf(":");
    const anchor = separador > 0 ? { type: ancora.slice(0, separador), id: ancora.slice(separador + 1) } : undefined;
    const result = run((data, me) => ensaiarAgente(data, me, agentId, { texto, ...(anchor ? { anchor } : {}) }));
    if (!result.ok) {
      setErro(result.error);
      return;
    }
    reset();
    onClose();
    navegar(`/ia/execucoes/${result.value.id}`);
  };

  return (
    <ConfirmDialog
      open={open}
      title={`Ensaiar ${agent?.name ?? "o Agente"}`}
      description="Escritas são simuladas, sem efeito e sem Memória (B82). Consome custo."
      confirmLabel="Ensaiar"
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={confirmar}
      onCancel={() => {
        reset();
        onClose();
      }}
    >
      <div className="grid gap-5">
        <Field label="Pedido" required {...(version ? { hint: `Respondido com as instruções da Versão ${version.number}.` } : {})}>
          {(id) => <TextArea id={id} value={texto} onChange={setTexto} rows={4} placeholder="O que o Agente deve fazer neste ensaio" />}
        </Field>
        <Field label="Âncora" hint="O registro que entra na Composição do Contexto (DO-AGE-09). Opcional.">
          {(id) => (
            <Select
              id={id}
              value={ancora}
              onChange={setAncora}
              searchable
              placeholder="Sem Âncora"
              options={[{ value: "", label: "Sem Âncora", detail: "só o pedido" }, ...opcoes]}
            />
          )}
        </Field>
        {erro ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {erro}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}

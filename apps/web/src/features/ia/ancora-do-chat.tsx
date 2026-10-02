"use client";

/**
 * O DIÁLOGO DA ÂNCORA (B83) — escolher o registro que dá o contexto inicial da
 * Sessão. Um só para a home (a Âncora vai na criação) e para a Sessão ainda
 * sem Mensagens (a Âncora ainda pode mudar); com Mensagens ela se fixa, e quem
 * chama não oferece mais o diálogo.
 *
 * O diálogo edita um RASCUNHO: Cancelar não mexe na Âncora que já existia (a
 * versão anterior, na home, apagava a Âncora ao cancelar).
 */

import { useState } from "react";
import { useData, useSession } from "@/dados/store";
import type { DataState } from "@n1/dominio/state";
import type { ChatAnchor } from "@n1/dominio/types";
import { contactDisplayName, memberSeesTask } from "@n1/dominio/derive";
import { ConfirmDialog, Field, Select } from "@/features/shell/ui";

/** B83 — as famílias que o Chat oferece para ancorar uma Sessão. */
export const TIPOS_DE_ANCORA = [
  { value: "deal", label: "Negócio" },
  { value: "task", label: "Tarefa" },
  { value: "contact", label: "Contato" },
  { value: "conversation", label: "Conversa" },
  { value: "knowledgeDocument", label: "Documento de Conhecimento" },
] as const satisfies ReadonlyArray<{ readonly value: ChatAnchor["type"]; readonly label: string }>;

type TipoOferecido = (typeof TIPOS_DE_ANCORA)[number]["value"];

export interface EscolhaDeAncora {
  readonly type: ChatAnchor["type"];
  readonly id: string;
}

/**
 * Os registros ativos de uma família, como opções de escolha — só os que o
 * Membro VÊ (RN-CHT-03; a Tarefa é a família com visibilidade por Membro, e a
 * operação recusa a Âncora numa Tarefa alheia com a mesma regra).
 */
export function registrosParaAncora(state: DataState, memberId: string, tipo: string): ReadonlyArray<{ readonly value: string; readonly label: string }> {
  switch (tipo as TipoOferecido) {
    case "deal":
      return state.deals.filter((d) => d.lifecycle === "ativo").map((d) => ({ value: d.id, label: d.title }));
    case "task":
      return state.tasks.filter((t) => t.lifecycle === "ativo" && memberSeesTask(state, memberId, t.id)).map((t) => ({ value: t.id, label: t.title }));
    case "contact":
      return state.contacts.filter((c) => c.lifecycle === "ativo").map((c) => ({ value: c.id, label: contactDisplayName(c) }));
    case "conversation":
      return state.conversations.filter((c) => c.lifecycle === "ativo").map((c) => ({ value: c.id, label: c.title }));
    case "knowledgeDocument":
      return state.documents.filter((d) => d.lifecycle === "ativo").map((d) => ({ value: d.id, label: d.title }));
    default:
      return [];
  }
}

/** O nome de uma escolha de Âncora (antes de ela virar valor na Sessão). */
export function nomeDaEscolha(state: DataState, memberId: string, escolha: EscolhaDeAncora): string | undefined {
  return registrosParaAncora(state, memberId, escolha.type).find((r) => r.value === escolha.id)?.label;
}

export function useDialogoDeAncora(aoConfirmar: (escolha: EscolhaDeAncora) => void) {
  const state = useData((data) => data);
  const { memberId } = useSession();
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState("");
  const [registro, setRegistro] = useState("");
  const opcoes = registrosParaAncora(state, memberId, tipo);
  const motivo = tipo === "" ? "Escolha o tipo de registro." : registro === "" ? "Escolha o registro." : undefined;

  const dialogo = (
    <ConfirmDialog
      open={aberto}
      title="Ancorar a Sessão"
      description="A Âncora dá contexto à Sessão e se fixa com a primeira Mensagem: ela guarda o nome que o registro tem agora."
      confirmLabel="Usar esta Âncora"
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={() => {
        if (motivo) return;
        aoConfirmar({ type: tipo as TipoOferecido, id: registro });
        setAberto(false);
      }}
      onCancel={() => setAberto(false)}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ancorar em">
          {(id) => (
            <Select
              id={id}
              value={tipo}
              onChange={(valor) => {
                setTipo(valor);
                setRegistro("");
              }}
              placeholder="Escolher o tipo"
              options={TIPOS_DE_ANCORA.map((t) => ({ value: t.value, label: t.label }))}
            />
          )}
        </Field>
        {tipo ? (
          <Field label="Registro">
            {(id) => <Select id={id} value={registro} onChange={setRegistro} searchable placeholder="Escolher" options={opcoes} />}
          </Field>
        ) : null}
      </div>
    </ConfirmDialog>
  );

  return {
    dialogo,
    /** Abre com a Âncora atual (se houver) no rascunho. */
    abrir: (atual?: EscolhaDeAncora) => {
      const oferecido = atual && TIPOS_DE_ANCORA.some((t) => t.value === atual.type) ? atual : undefined;
      setTipo(oferecido?.type ?? "");
      setRegistro(oferecido?.id ?? "");
      setAberto(true);
    },
  };
}

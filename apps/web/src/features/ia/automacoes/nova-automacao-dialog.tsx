"use client";

/**
 * NOVA AUTOMAÇÃO (19, 12.1): Nome, Descrição, o escopo — tipo e registro,
 * fixados na criação (RN-AUT-02) — e um Gatilho inicial opcional, filtrado
 * pelo que ocorre no escopo (RN-AUT-07). Nasce em rascunho com a Versão 1
 * em rascunho; ao criar, quem chama abre o editor.
 */

import { useState } from "react";
import type { DataState } from "@n1/dominio/state";
import { containerPath } from "@n1/dominio/derive";
import { useData, useRun, useSession } from "@/dados/store";
import { criarAutomacao, eventoDoCatalogo, eventosDoEscopo, recusaDeConvidado } from "@n1/dominio/operations";
import type { AutomationScopeType, AutomationTrigger, Id, TriggerKind } from "@n1/dominio/types";
import { OBJECT_TYPE_LABEL, TRIGGER_KIND_LABEL } from "@/features/shell/format";
import { ConfirmDialog, Field, Select, TextArea, TextInput, type Option } from "@/features/shell/ui";
import { EXECUTA_LABEL, NAO_EXECUTA_LABEL } from "../rotulos";

const ESCOPOS: readonly AutomationScopeType[] = ["workspace", "space", "folder", "list", "funnel", "inbox", "queue", "grupo", "comunidade", "flow"];

const TIPOS_DE_GATILHO: readonly TriggerKind[] = ["evento", "agendamento", "manual", "condicaoTemporal"];

export function NovaAutomacaoDialog({
  open,
  onClose,
  onDone,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDone: (message: string, automationId: Id) => void;
}) {
  // Desmontar ao fechar zera o formulário: reabrir começa limpo.
  if (!open) return null;
  return <Formulario onClose={onClose} onDone={onDone} />;
}

function Formulario({ onClose, onDone }: { readonly onClose: () => void; readonly onDone: (message: string, automationId: Id) => void }) {
  const state = useData((data) => data);
  const run = useRun();
  const { memberId } = useSession();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [scopeType, setScopeType] = useState<AutomationScopeType>("list");
  const [scopeId, setScopeId] = useState("");
  const [tipoDoGatilho, setTipoDoGatilho] = useState<TriggerKind | "">("");
  const [eventType, setEventType] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const convidado = recusaDeConvidado(state, memberId, "cria Automação");
  const registros = registrosDoEscopo(state, scopeType);
  const escopoFixo = scopeType === "workspace" || scopeType === "inbox";
  const registroId = escopoFixo ? (registros[0]?.value ?? "") : scopeId;
  const eventos = eventosDoEscopo(scopeType);
  const eventoValido = eventType !== "" && eventos.some((e) => e.id === eventType);

  const motivo =
    convidado ??
    (!nome.trim()
      ? "Dê um nome à Automação."
      : !registroId
        ? `Escolha ${OBJECT_TYPE_LABEL[scopeType] ? `a ${OBJECT_TYPE_LABEL[scopeType]}` : "o registro"} do escopo.`
        : tipoDoGatilho === "evento" && eventType !== "" && !eventoValido
          ? "O Evento escolhido não ocorre neste escopo (RN-AUT-07)."
          : undefined);

  const trocarEscopo = (tipo: AutomationScopeType) => {
    setScopeType(tipo);
    setScopeId("");
    // Um Evento de outra família não sobrevive à troca de escopo (RN-AUT-07).
    if (eventType && !eventosDoEscopo(tipo).some((e) => e.id === eventType)) setEventType("");
  };

  const gatilhoInicial = (): AutomationTrigger | undefined => {
    if (tipoDoGatilho === "") return undefined;
    if (tipoDoGatilho === "evento") return { kind: "evento", ...(eventoValido ? { eventType } : {}) };
    return { kind: tipoDoGatilho };
  };

  return (
    <ConfirmDialog
      open
      title="Nova Automação"
      description="Reage a um Gatilho, avalia Condições e executa Ações em nome do seu Proprietário. Nasce em rascunho, com a Versão 1 em rascunho; o resto se monta no editor."
      confirmLabel="Criar e abrir o editor"
      wide
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={() => {
        const trigger = gatilhoInicial();
        const r = run((data, me) => criarAutomacao(data, me, { name: nome, description: descricao, scopeType, scopeId: registroId, ...(trigger ? { trigger } : {}) }));
        if (!r.ok) {
          setErro(r.error);
          return;
        }
        onDone(`Automação “${r.value.name}” criada com a Versão 1 em rascunho.`, r.value.id);
      }}
      onCancel={onClose}
    >
      <div className="grid gap-4">
        <Field label="Nome" required>
          {(id) => <TextInput id={id} value={nome} onChange={setNome} placeholder="Por exemplo: Avisar o Comercial ao criar Tarefa" />}
        </Field>
        <Field label="Descrição" hint="Uso interno: o que ela faz e por quê.">
          {(id) => <TextArea id={id} value={descricao} onChange={setDescricao} rows={2} placeholder="Para que serve esta Automação" />}
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Escopo" required hint="Fixado na criação e nunca mudado depois (RN-AUT-02): delimita onde o Gatilho escuta, não onde as Ações agem.">
            {(id) => <Select id={id} value={scopeType} onChange={(v) => trocarEscopo(v as AutomationScopeType)} options={ESCOPOS.map((t) => ({ value: t, label: OBJECT_TYPE_LABEL[t] ?? t }))} />}
          </Field>
          <Field label={OBJECT_TYPE_LABEL[scopeType] ?? "Registro"} required {...(registros.length === 0 ? { hint: "Nenhum registro ativo deste tipo." } : {})}>
            {(id) => (
              <Select
                id={id}
                value={registroId}
                onChange={setScopeId}
                placeholder={`Escolher ${OBJECT_TYPE_LABEL[scopeType] ?? "o registro"}`}
                searchable={registros.length > 6}
                options={registros}
                disabled={escopoFixo}
                {...(escopoFixo ? { disabledReason: "Há um só registro deste tipo no Espaço de Trabalho." } : {})}
              />
            )}
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Gatilho inicial" hint="Pode ficar para o editor; publicar exige exatamente um Gatilho (INV-AUT-03).">
            {(id) => (
              <Select
                id={id}
                value={tipoDoGatilho}
                onChange={(v) => setTipoDoGatilho(v as TriggerKind | "")}
                placeholder="Escolher no editor"
                options={[{ value: "", label: "Escolher no editor" }, ...TIPOS_DE_GATILHO.map((t) => ({ value: t, label: TRIGGER_KIND_LABEL[t] ?? t }))]}
              />
            )}
          </Field>
          {tipoDoGatilho === "evento" ? (
            <Field label="Evento" hint="Só os Eventos que ocorrem no escopo escolhido (RN-AUT-07).">
              {(id) => (
                <Select
                  id={id}
                  value={eventType}
                  onChange={setEventType}
                  placeholder="Escolher no editor"
                  searchable={eventos.length > 8}
                  options={[{ value: "", label: "Escolher no editor" }, ...eventos.map((e) => ({ value: e.id, label: e.rotulo, detail: e.executa ? EXECUTA_LABEL : NAO_EXECUTA_LABEL }))]}
                />
              )}
            </Field>
          ) : null}
        </div>
        {tipoDoGatilho === "evento" && eventoValido && eventoDoCatalogo(eventType)?.subtipo === "status" ? (
          <p className="app-sm" style={{ color: "var(--texto-3)" }}>
            O Status de entrada se escolhe no editor, entre os da Lista do escopo.
          </p>
        ) : null}

        {erro ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {erro}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}

/** "Espaço › Pasta" — onde a Lista ou a Pasta mora, para desempatar nomes iguais. */
const caminho = (state: DataState, type: "folder" | "list", id: Id): string =>
  containerPath(state, type, id)
    .slice(0, -1)
    .map((n) => n.name)
    .join(" › ");

/** As coleções ativas de cada tipo de escopo, como opções; o Espaço de Trabalho e a Caixa de Entrada são únicos. */
function registrosDoEscopo(state: DataState, scopeType: AutomationScopeType): Option[] {
  const ativos = <T extends { readonly id: Id; readonly lifecycle: string }>(lista: readonly T[]): T[] => lista.filter((r) => r.lifecycle === "ativo");
  switch (scopeType) {
    case "workspace":
      return [{ value: state.workspace.id, label: state.workspace.name }];
    case "space":
      return ativos(state.spaces).map((s) => ({ value: s.id, label: s.name }));
    case "folder":
      return ativos(state.folders).map((f) => ({ value: f.id, label: f.name, detail: caminho(state, "folder", f.id) }));
    case "list":
      return ativos(state.lists).map((l) => ({ value: l.id, label: l.name, detail: caminho(state, "list", l.id) }));
    case "funnel":
      return ativos(state.funnels).map((f) => ({ value: f.id, label: f.name }));
    case "inbox":
      return [{ value: state.inbox.id, label: "Caixa de Entrada" }];
    case "queue":
      return ativos(state.queues).map((q) => ({ value: q.id, label: q.name }));
    case "grupo":
      return ativos(state.grupos).map((g) => ({ value: g.id, label: g.nome }));
    case "comunidade":
      return ativos(state.comunidades).map((c) => ({ value: c.id, label: c.nome }));
    case "flow":
      return ativos(state.flows).map((f) => ({ value: f.id, label: f.nome }));
  }
}
